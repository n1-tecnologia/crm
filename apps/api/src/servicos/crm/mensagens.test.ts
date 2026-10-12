/**
 * Serviço de Mensagens (08-12, Task 2), contra o Postgres LOCAL.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55592/postgres npx vitest run src/servicos/crm/mensagens.test.ts
 *
 * "Comercial" é o WhatsApp oficial (`whatsapp-cloud`, janela de 24 h) e
 * "Suporte" o não oficial (sem janela). A `recebida` de 30 h atrás entra por
 * `registrarRecebida`, o caminho interno que a integração usará.
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeMensagens } from "./mensagens";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool) });

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

  const receber = (ws: string, conversaId: string, extras: { idExterno?: string; criadoEm?: string } = {}) =>
    servico.registrarRecebida(ws, {
      conversaId,
      idExterno: extras.idExterno ?? "wamid.9",
      criadoEm: extras.criadoEm ?? horasAtras(30),
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

  it("registrarRecebida grava uma vez e a 2ª igual devolve a mesma Mensagem com repetida", async () => {
    const c = await espaco("recebida");
    const primeira = valor(await receber(c.ws, c.comercial.conversaId));
    expect(primeira.repetida).toBe(false);
    expect(primeira.mensagem).toMatchObject({
      direcao: "recebida",
      canalId: c.comercial.canalId,
      statusEntrega: null,
      ator: { tipo: "integration", id: c.comercial.canalId },
    });

    const segunda = valor(await receber(c.ws, c.comercial.conversaId));
    expect(segunda.repetida).toBe(true);
    expect(segunda.mensagem.id).toBe(primeira.mensagem.id);
    expect(await contar(c.ws)).toBe(1);
  });

  it("registrarRecebida usa o Canal da Conversa, mesmo que a entrada traga outro, e o mesmo id externo noutro Canal grava", async () => {
    const c = await espaco("canaldaconversa");
    const entrada = { conversaId: c.comercial.conversaId, idExterno: "wamid.9", criadoEm: horasAtras(1), conteudo: "oi", cargaBruta: {}, canalId: c.suporte.canalId };
    const { mensagem } = valor(await servico.registrarRecebida(c.ws, entrada));
    expect(mensagem.canalId).toBe(c.comercial.canalId);

    const outra = valor(await receber(c.ws, c.suporte.conversaId, { idExterno: "wamid.9" }));
    expect(outra.repetida).toBe(false);
    expect(outra.mensagem.id).not.toBe(mensagem.id);
  });

  it("registrarRecebida numa Conversa de outro Espaço dá 404", async () => {
    const c = await espaco("ws1");
    const outro = await espaco("ws2");
    const r = recusado(await receber(outro.ws, c.comercial.conversaId));
    expect(r).toMatchObject({ status: 404, codigo: "CONVERSA_NAO_ENCONTRADA" });
    expect(await contar(outro.ws)).toBe(0);
  });

  it("registrarRecebida recusa com 400 o que o banco recusaria: id externo vazio, instante inválido, sem conteúdo nem anexo", async () => {
    const c = await espaco("guarda");
    const base = { conversaId: c.comercial.conversaId, idExterno: "wamid.x", criadoEm: horasAtras(1), conteudo: "oi", cargaBruta: {} };
    expect(recusado(await servico.registrarRecebida(c.ws, { ...base, idExterno: " " }))).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "idExterno" });
    expect(recusado(await servico.registrarRecebida(c.ws, { ...base, criadoEm: "ontem" }))).toMatchObject({ status: 400, campo: "criadoEm" });
    expect(recusado(await servico.registrarRecebida(c.ws, { ...base, conteudo: "  " }))).toMatchObject({ status: 400, campo: "conteudo" });
    expect(await contar(c.ws)).toBe(0);
  });

  it("WhatsApp oficial com recebida de 30 h: enviada dá 409 JANELA_EXPIRADA (campo modelo); interna passa sem status", async () => {
    const c = await espaco("janela");
    valor(await receber(c.ws, c.comercial.conversaId));

    const expirada = recusado(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "enviada", conteudo: "Bom dia" }));
    expect(expirada).toMatchObject({ status: 409, codigo: "JANELA_EXPIRADA", campo: "modelo" });
    expect(await contar(c.ws)).toBe(1);

    const interna = valor(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "interna", conteudo: "Lembrar do retorno" }));
    expect(interna).toMatchObject({ direcao: "interna", statusEntrega: null, ator: { tipo: "member", id: "mem_ana" }, idExterno: null });
  });

  it("WhatsApp oficial com recebida de 2 h: enviada sai com status enviada", async () => {
    const c = await espaco("dentro");
    valor(await receber(c.ws, c.comercial.conversaId, { criadoEm: horasAtras(2) }));
    const m = valor(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "enviada", conteudo: "Bom dia" }));
    expect(m).toMatchObject({ direcao: "enviada", statusEntrega: "enviada", conteudo: "Bom dia", canalId: c.comercial.canalId });
  });

  it("WhatsApp não oficial com recebida de 30 h envia: pendente se desconectado, enviada se conectado", async () => {
    const c = await espaco("naooficial");
    valor(await receber(c.ws, c.suporte.conversaId));

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
    await pool().query("update plataforma.conversas set situacao = 'resolvida', estado = 'na_lixeira' where workspace_id = $1 and id = $2", [
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
    valor(await receber(c.ws, c.comercial.conversaId, { criadoEm: horasAtras(2) }));
    valor(await servico.enviar(c.membro, { conversaId: c.comercial.conversaId, direcao: "enviada", conteudo: "Resposta" }));

    const fio = valor(await servico.listar(c.membro, { conversaId: c.comercial.conversaId, limite: 50, deslocamento: 0 }));
    expect(fio.itens.map((m) => m.direcao)).toEqual(["recebida", "enviada"]);
    for (const item of fio.itens) expect(item).not.toHaveProperty("cargaBruta");

    expect(recusado(await servico.listar(outro.membro, { conversaId: c.comercial.conversaId, limite: 50, deslocamento: 0 }))).toMatchObject({
      status: 404,
      codigo: "CONVERSA_NAO_ENCONTRADA",
    });
  });
});
