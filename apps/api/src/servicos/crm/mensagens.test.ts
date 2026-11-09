/**
 * Serviço de Mensagens (08-12, Task 2), contra o Postgres LOCAL.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55592/postgres npx vitest run src/servicos/crm/mensagens.test.ts
 *
 * "Comercial" é o WhatsApp oficial (`whatsapp-cloud`, janela de 24 h) e
 * "Suporte" o não oficial (sem janela). A `recebida` de 30 h atrás entra por
 * `receberMensagem` (3.6.2), a única porta da recebida; a idempotência, o Canal
 * da Conversa e o 404 de outro Espaço ficam provados em `recebimento.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { criarRepositorioDeConsentimentosPg } from "../../repositorios/crm/consentimentos";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeMensagens } from "./mensagens";
import { criarServicoDeRecebimento } from "./recebimento";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool) });
const recebimento = criarServicoDeRecebimento({ pool });

/** O WhatsApp da Ana: é por ele que o remetente da recebida acha o Contato. */
const WHATSAPP_DA_ANA = "+5511987654321";

const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });
const horasAtras = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString();

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

describeComBanco("ServicoDeMensagens — Postgres local", () => {
  const espacos: string[] = [];

  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    const contato = await criarRepositorioDeContatosPg(pool()).inserir(ws, { nome: "Ana", proprietarioId: "mem_ana", criadoPor: "mem_ana" });
    await criarRepositorioDeContatosPg(pool()).inserirIdentificador(ws, contato.id, { tipo: "whatsapp", valor: WHATSAPP_DA_ANA, principal: true });

    const abrir = async (nome: string, provedor: string, identificadorExterno: string, conexao: "conectada" | "desconectada") => {
      const canalId = await semearCanal(ws, { nome, tipo: "whatsapp", provedor, identificadorExterno, conexao });
      const conversa = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
        canalId,
        contatoId: contato.id,
        titulo: `Ana — ${nome}`,
        filaId: null,
        atribuido: { tipo: "membro", id: "mem_ana" },
        participantes: [],
        criadoPor: { tipo: "member", id: "mem_ana" },
      });
      return { canalId, conversaId: conversa.id };
    };
    const comercial = await abrir("Comercial", "whatsapp-cloud", "+5511977770001", "conectada");
    const suporte = await abrir("Suporte", "whatsapp-nao-oficial", "+5511977770002", "desconectada");
    return { ws, membro: sessao(ws, "mem_ana"), convidado: sessao(ws, "mem_convidado"), comercial, suporte };
  }

  const receber = (ws: string, canalId: string, extras: { idExterno?: string; criadoEm?: string } = {}) =>
    recebimento.receberMensagem(ws, canalId, {
      idExterno: extras.idExterno ?? "wamid.9",
      criadoEm: extras.criadoEm ?? horasAtras(30),
      remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA },
      conteudo: "oi",
      cargaBruta: { entry: [{ changes: [{ value: { text: "oi" } }] }] },
    });

  const contar = async (ws: string) =>
    (await pool().query<{ n: number }>("select count(*)::int as n from plataforma.mensagens where workspace_id = $1", [ws])).rows[0]!.n;

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  it("WhatsApp oficial com recebida de 30 h: enviada dá 409 JANELA_EXPIRADA (campo modelo); interna passa sem status", async () => {
    const c = await espaco("janela");
    valor(await receber(c.ws, c.comercial.canalId));

    const expirada = recusado(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "enviada", conteudo: "Bom dia" }));
    expect(expirada).toMatchObject({ status: 409, codigo: "JANELA_EXPIRADA", campo: "modelo" });
    expect(await contar(c.ws)).toBe(1);

    const interna = valor(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "interna", conteudo: "Lembrar do retorno" }));
    expect(interna).toMatchObject({ direcao: "interna", statusEntrega: null, ator: { tipo: "member", id: "mem_ana" }, idExterno: null });
  });

  it("WhatsApp oficial com recebida de 2 h: enviada sai com status enviada", async () => {
    const c = await espaco("dentro");
    valor(await receber(c.ws, c.comercial.canalId, { criadoEm: horasAtras(2) }));
    const m = valor(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "enviada", conteudo: "Bom dia" }));
    expect(m).toMatchObject({ direcao: "enviada", statusEntrega: "enviada", conteudo: "Bom dia", canalId: c.comercial.canalId });
  });

  it("WhatsApp não oficial com recebida de 30 h envia: pendente se desconectado, enviada se conectado", async () => {
    const c = await espaco("naooficial");
    valor(await receber(c.ws, c.suporte.canalId));

    const pendente = valor(await servico.enviar(c.membro, { conversaId: c.suporte.conversaId, direcao: "enviada", conteudo: "Oi" }));
    expect(pendente.statusEntrega).toBe("pendente");

    await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [c.ws, c.suporte.canalId]);
    const enviada = valor(await servico.enviar(c.membro, { conversaId: c.suporte.conversaId, direcao: "enviada", conteudo: "Oi de novo" }));
    expect(enviada.statusEntrega).toBe("enviada");
  });

  it("oficial sem nenhuma recebida ainda não tem janela: a primeira enviada passa", async () => {
    const c = await espaco("semrecebida");
    const m = valor(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "enviada", conteudo: "Olá" }));
    expect(m.statusEntrega).toBe("enviada");
  });

  it("emRespostaAId de outra Conversa dá 409 RESPOSTA_DE_OUTRA_CONVERSA; da mesma Conversa grava", async () => {
    const c = await espaco("resposta");
    const doSuporte = valor(await servico.enviar(c.membro, { conversaId: c.suporte.conversaId, direcao: "interna", conteudo: "nota" }));
    const r = recusado(
      await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "interna", conteudo: "resposta", emRespostaAId: doSuporte.id }),
    );
    expect(r).toMatchObject({ status: 409, codigo: "RESPOSTA_DE_OUTRA_CONVERSA" });
    expect(JSON.stringify(r)).not.toContain("_fkey");

    const daMesma = valor(await servico.enviar(c.membro, { conversaId: c.suporte.conversaId, direcao: "interna", conteudo: "resposta", emRespostaAId: doSuporte.id }));
    expect(daMesma.emRespostaAId).toBe(doSuporte.id);
  });

  it("Conversa na lixeira, Canal arquivado e Conversa inexistente recusam o envio", async () => {
    const c = await espaco("recusas");
    await pool().query("update plataforma.conversas set situacao = 'resolvida', estado = 'na_lixeira', na_lixeira_em = now() where workspace_id = $1 and id = $2", [
      c.ws,
      c.suporte.conversaId,
    ]);
    expect(recusado(await servico.enviar(c.membro, { conversaId: c.suporte.conversaId, direcao: "interna", conteudo: "x" }))).toMatchObject({
      status: 409,
      codigo: "CONVERSA_NA_LIXEIRA",
    });

    await pool().query("update plataforma.canais set estado = 'arquivado', arquivado_em = now(), conexao = 'desconectada' where workspace_id = $1 and id = $2", [
      c.ws,
      c.comercial.canalId,
    ]);
    expect(recusado(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "interna", conteudo: "x" }))).toMatchObject({
      status: 409,
      codigo: "CANAL_ARQUIVADO",
    });

    expect(recusado(await servico.enviar(c.membro, { conversaId: "nao-existe", direcao: "interna", conteudo: "x" }))).toMatchObject({
      status: 404,
      codigo: "CONVERSA_NAO_ENCONTRADA",
      campo: "conversaId",
    });
  });

  it("Convidado não envia (403) mas lê; Mensagem vazia é 400 VALOR_INVALIDO; Membro envia", async () => {
    const c = await espaco("papeis");
    const negado = recusado(await servico.enviar(c.convidado, { conversaId: c.suporte.conversaId, direcao: "interna", conteudo: "x" }));
    expect(negado).toMatchObject({ status: 403, codigo: "PERMISSAO" });
    expect(await contar(c.ws)).toBe(0);

    expect(recusado(await servico.enviar(c.membro, { conversaId: c.suporte.conversaId, direcao: "enviada", conteudo: "   " }))).toMatchObject({
      status: 400,
      codigo: "VALOR_INVALIDO",
      campo: "conteudo",
    });

    valor(await servico.enviar(c.membro, { conversaId: c.suporte.conversaId, direcao: "interna", conteudo: "ok" }));
    const lista = valor(await servico.listar(c.convidado, { conversaId: c.suporte.conversaId, limite: 50, deslocamento: 0 }));
    expect(lista.total).toBe(1);
  });

  it("listar devolve o fio da Conversa, sem cargaBruta, e 404 para Conversa de outro Espaço", async () => {
    const c = await espaco("lista");
    const outro = await espaco("lista_outro");
    valor(await receber(c.ws, c.comercial.canalId, { criadoEm: horasAtras(2) }));
    valor(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "enviada", conteudo: "Resposta" }));

    const fio = valor(await servico.listar(c.membro, { conversaId: c.comercial.conversaId, limite: 50, deslocamento: 0 }));
    expect(fio.itens.map((m) => m.direcao)).toEqual(["recebida", "enviada"]);
    for (const item of fio.itens) expect(item).not.toHaveProperty("cargaBruta");

    expect(recusado(await servico.listar(outro.membro, { conversaId: c.comercial.conversaId, limite: 50, deslocamento: 0 }))).toMatchObject({
      status: 404,
      codigo: "CONVERSA_NAO_ENCONTRADA",
    });
  });
  describe("SEM_CONSENTIMENTO (14-08, 3.2.4): modelo de marketing exige consentimento vigente", () => {
    /** O serviço com o resolvedor de modelo injetado: a Sessão 7 trará os modelos de verdade. */
    const comCategoria = (categoria: string | undefined) =>
      criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool), categoriaDoModelo: async () => categoria });

    const enviarSuporte = (svc: ReturnType<typeof comCategoria>, c: Awaited<ReturnType<typeof espaco>>, direcao: "enviada" | "interna" = "enviada") =>
      svc.enviar(c.membro, { conversaId: c.suporte.conversaId, direcao, conteudo: "Novidades do mês" });

    /** O Espaço de teste com a finalidade "Marketing" no Catálogo e o id do Contato da Conversa. */
    async function espacoComMarketing(rotulo: string) {
      const c = await espaco(rotulo);
      await pool().query(
        `insert into plataforma.registros (workspace_id, colecao, id, dados)
         values ($1, 'catalog', 'cat_fin_mkt', $2::jsonb)
         on conflict (workspace_id, colecao, id) do nothing`,
        [c.ws, JSON.stringify({ id: "cat_fin_mkt", kind: "finalidadeConsentimento", name: "Marketing", lifecycle: "ativo" })],
      );
      const { rows } = await pool().query<{ contato_id: string }>("select contato_id from plataforma.conversas where workspace_id = $1 and id = $2", [
        c.ws,
        c.suporte.conversaId,
      ]);
      return { ...c, contatoId: rows[0]!.contato_id };
    }

    const consentir = (ws: string, contatoId: string, extra: { tipoDeCanal?: "whatsapp" | "email" | "todos"; decisao?: "concedido" | "revogado"; em: string }) =>
      criarRepositorioDeConsentimentosPg(pool()).inserir(
        ws,
        contatoId,
        { finalidadeId: "cat_fin_mkt", tipoDeCanal: extra.tipoDeCanal ?? "whatsapp", decisao: extra.decisao ?? "concedido", origem: "formulario", em: extra.em },
        "mem_ana",
      );

    it("modelo de marketing sem nenhum consentimento: 409 SEM_CONSENTIMENTO (campo modelo) e nenhuma Mensagem nova", async () => {
      const c = await espacoComMarketing("semconsent");
      const r = recusado(await enviarSuporte(comCategoria("marketing"), c));
      expect(r).toMatchObject({ status: 409, codigo: "SEM_CONSENTIMENTO", campo: "modelo" });
      expect(r.error).toBe("Este Contato não consentiu receber marketing por este Canal.");
      expect(await contar(c.ws)).toBe(0);
    });

    it("com concedido de marketing para o tipo do Canal, a Mensagem é gravada", async () => {
      const c = await espacoComMarketing("comconsent");
      await consentir(c.ws, c.contatoId, { em: horasAtras(48) });
      const m = valor(await enviarSuporte(comCategoria("marketing"), c));
      expect(m).toMatchObject({ direcao: "enviada", canalId: c.suporte.canalId });
      expect(await contar(c.ws)).toBe(1);
    });

    it("um revogado posterior volta a recusar; um concedido para todos libera de novo", async () => {
      const c = await espacoComMarketing("revogado");
      await consentir(c.ws, c.contatoId, { em: horasAtras(48) });
      await consentir(c.ws, c.contatoId, { decisao: "revogado", em: horasAtras(24) });
      expect(recusado(await enviarSuporte(comCategoria("marketing"), c))).toMatchObject({ status: 409, codigo: "SEM_CONSENTIMENTO" });
      expect(await contar(c.ws)).toBe(0);

      await consentir(c.ws, c.contatoId, { tipoDeCanal: "todos", em: horasAtras(1) });
      valor(await enviarSuporte(comCategoria("marketing"), c));
      expect(await contar(c.ws)).toBe(1);
    });

    it("o consentimento de outro tipo de Canal não vale para o WhatsApp", async () => {
      const c = await espacoComMarketing("outrotipo");
      await consentir(c.ws, c.contatoId, { tipoDeCanal: "email", em: horasAtras(48) });
      expect(recusado(await enviarSuporte(comCategoria("marketing"), c))).toMatchObject({ status: 409, codigo: "SEM_CONSENTIMENTO" });
    });

    it("sem a finalidade Marketing no Catálogo não há como provar o consentimento: recusa", async () => {
      const c = await espaco("semfinalidade");
      expect(recusado(await enviarSuporte(comCategoria("marketing"), c))).toMatchObject({ status: 409, codigo: "SEM_CONSENTIMENTO" });
    });

    it("categoria utilidade, ou nenhum resolvedor, não muda nada em relação a hoje", async () => {
      const c = await espacoComMarketing("utilidade");
      valor(await enviarSuporte(comCategoria("utilidade"), c));
      valor(await enviarSuporte(comCategoria(undefined), c));
      valor(await enviarSuporte(servico, c));
      expect(await contar(c.ws)).toBe(3);
    });

    it("a Mensagem interna não passa pela regra", async () => {
      const c = await espacoComMarketing("interna");
      const m = valor(await enviarSuporte(comCategoria("marketing"), c, "interna"));
      expect(m).toMatchObject({ direcao: "interna", statusEntrega: null });
    });
  });
});
