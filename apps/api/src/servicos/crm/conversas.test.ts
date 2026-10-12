/**
 * Serviço de Conversas (08-06, Task 2), contra o Postgres LOCAL.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55586/postgres npx vitest run src/servicos/crm/conversas.test.ts
 *
 * Contatos e Identificadores entram pelo repositório de Contatos da Fase 7 e
 * os Canais por `semearCanal`. A Fila padrão do Canal não é semeada aqui (o
 * seed antigo é do Espaço antigo): a Conversa nasce com `filaId` nulo.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeConversas } from "./conversas";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeConversas({ pool, acesso: criarAcessoAoCrmPg(pool) });

const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

describeComBanco("ServicoDeConversas — Postgres local", () => {
  const espacos: string[] = [];

  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    return { ws, admin: sessao(ws, "mem_admin"), membro: sessao(ws, "mem_ana"), convidado: sessao(ws, "mem_convidado") };
  }
  type Contexto = Awaited<ReturnType<typeof espaco>>;

  /** Contato relacional com os Identificadores dados (o 1º de cada tipo é o principal). */
  async function contato(ws: string, nome: string, identificadores: ReadonlyArray<{ tipo: "whatsapp" | "telefone" | "email" | "instagram"; valor: string }>) {
    const repositorio = criarRepositorioDeContatosPg(pool());
    const criado = await repositorio.inserir(ws, { nome, proprietarioId: "mem_ana", criadoPor: "mem_ana" });
    for (const [i, identificador] of identificadores.entries()) {
      await repositorio.inserirIdentificador(ws, criado.id, { ...identificador, principal: i === 0 });
    }
    return criado.id;
  }

  const comercial = (ws: string, extras: { identificadorExterno?: string } = {}) =>
    semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-cloud",
      identificadorExterno: extras.identificadorExterno ?? "+5511977770001",
      conexao: "conectada",
    });
  const suporte = (ws: string) =>
    semearCanal(ws, {
      nome: "Suporte",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770002",
      conexao: "desconectada",
    });

  const contarMensagens = async (ws: string) =>
    Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.mensagens where workspace_id = $1", [ws])).rows[0]!.n);
  const contarConversas = async (ws: string) =>
    Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.conversas where workspace_id = $1", [ws])).rows[0]!.n);

  const abrir = (c: Contexto, canalId: string, contatoId: string, conteudo = "Olá!") =>
    servico.criar(c.membro, { canalId, contatoId, mensagem: { conteudo } });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  describe("criar", () => {
    it("a mesma Ana abre Conversa nos dois WhatsApps: enviada no conectado, pendente no desconectado", async () => {
      const c = await espaco("doisws");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660001" }]);
      const canalA = await comercial(c.ws);
      const canalB = await suporte(c.ws);

      const a = valor(await abrir(c, canalA, ana, "Oi, Ana"));
      expect(a.conversa).toMatchObject({ canalId: canalA, contatoId: ana, situacao: "aberta", estado: "ativo", titulo: "Ana", reaberturas: 0 });
      expect(a.conversa.atribuido).toEqual({ tipo: "membro", id: "mem_ana" });
      expect(a.conversa.criadoPor).toEqual({ tipo: "member", id: "mem_ana" });
      expect(a.conversa.participantes).toHaveLength(2);
      expect(a.conversa.participantes.map((p) => p.papel).sort()).toEqual(["atendente", "contato"]);
      expect(a.conversa.participantes.find((p) => p.papel === "contato")).toMatchObject({ principal: true, sujeito: { tipo: "contato", id: ana } });
      expect(a.canal).toMatchObject({ id: canalA, nome: "Comercial", tipo: "whatsapp", provedor: "whatsapp-cloud", conexao: "conectada" });
      expect(a.primeiraMensagem).toMatchObject({
        conversaId: a.conversa.id,
        canalId: canalA,
        direcao: "enviada",
        statusEntrega: "enviada",
        conteudo: "Oi, Ana",
        ator: { tipo: "member", id: "mem_ana" },
      });

      const b = valor(await abrir(c, canalB, ana, "Oi pelo suporte"));
      expect(b.conversa.canalId).toBe(canalB);
      expect(b.primeiraMensagem.statusEntrega).toBe("pendente");
      expect(b.primeiraMensagem.statusEntregaEm).not.toBeNull();
      expect(b.conversa.id).not.toBe(a.conversa.id);
    });

    it("a 2ª Conversa aberta do par → 409 CONVERSA_JA_ABERTA apontando a existente, sem gravar Mensagem", async () => {
      const c = await espaco("duplicada");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660002" }]);
      const canal = await comercial(c.ws);
      const primeira = valor(await abrir(c, canal, ana));
      const antes = { mensagens: await contarMensagens(c.ws), conversas: await contarConversas(c.ws) };

      const r = recusado(await abrir(c, canal, ana, "de novo"));
      expect(r).toMatchObject({ status: 409, codigo: "CONVERSA_JA_ABERTA" });
      expect(r.bloqueios?.conversas?.total).toBe(1);
      expect(r.bloqueios?.conversas?.itens[0]?.id).toBe(primeira.conversa.id);
      expect(await contarMensagens(c.ws)).toBe(antes.mensagens);
      expect(await contarConversas(c.ws)).toBe(antes.conversas);
    });

    it("Contato sem Identificador do tipo do Canal → 409 CONTATO_SEM_IDENTIFICADOR_DO_CANAL (e telefone não é WhatsApp)", async () => {
      const c = await espaco("semident");
      const soTelefone = await contato(c.ws, "Só telefone", [{ tipo: "telefone", valor: "+5511966660003" }]);
      const soWhatsapp = await contato(c.ws, "Só WhatsApp", [{ tipo: "whatsapp", valor: "+5511966660004" }]);
      const whats = await comercial(c.ws);
      const email = await semearCanal(c.ws, {
        nome: "E-mail",
        tipo: "email",
        provedor: "email-imap-smtp",
        identificadorExterno: "vendas@empresa.com",
        conexao: "conectada",
      });

      expect(recusado(await abrir(c, email, soWhatsapp))).toMatchObject({ status: 409, codigo: "CONTATO_SEM_IDENTIFICADOR_DO_CANAL" });
      expect(recusado(await abrir(c, whats, soTelefone))).toMatchObject({ status: 409, codigo: "CONTATO_SEM_IDENTIFICADOR_DO_CANAL" });
      expect(await contarConversas(c.ws)).toBe(0);
    });

    it("Canal arquivado → 409 CANAL_ARQUIVADO; Contato fora do ar → 409 CONTATO_INATIVO", async () => {
      const c = await espaco("arquivado");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660005" }]);
      const canal = await comercial(c.ws);
      await pool().query(
        "update plataforma.canais set estado = 'arquivado', conexao = 'desconectada', arquivado_em = now() where workspace_id = $1 and id = $2",
        [c.ws, canal],
      );
      expect(recusado(await abrir(c, canal, ana))).toMatchObject({ status: 409, codigo: "CANAL_ARQUIVADO" });

      const ativo = await suporte(c.ws);
      await pool().query("update plataforma.contatos set estado = 'arquivado' where workspace_id = $1 and id = $2", [c.ws, ana]);
      expect(recusado(await abrir(c, ativo, ana))).toMatchObject({ status: 409, codigo: "CONTATO_INATIVO" });
    });

    it("Canal ou Contato de outro Espaço → 404 com campo", async () => {
      const c = await espaco("meu");
      const outro = await espaco("outro");
      const meuContato = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660006" }]);
      const meuCanal = await comercial(c.ws);
      const contatoDeFora = await contato(outro.ws, "Bia", [{ tipo: "whatsapp", valor: "+5511966660007" }]);
      const canalDeFora = await comercial(outro.ws);

      expect(recusado(await abrir(c, canalDeFora, meuContato))).toMatchObject({ status: 404, codigo: "CANAL_NAO_ENCONTRADO", campo: "canalId" });
      expect(recusado(await abrir(c, meuCanal, contatoDeFora))).toMatchObject({ status: 404, codigo: "CONTATO_NAO_ENCONTRADO", campo: "contatoId" });
    });

    it("conteúdo vazio → 400 VALOR_INVALIDO com campo conteudo, sem abrir transação", async () => {
      const c = await espaco("vazio");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660008" }]);
      const canal = await comercial(c.ws);
      const r = recusado(await abrir(c, canal, ana, "   "));
      expect(r).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "conteudo" });
      expect(await contarConversas(c.ws)).toBe(0);
    });

    it("Convidado → 403 PERMISSAO; Membro cria (A7)", async () => {
      const c = await espaco("papel");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660009" }]);
      const canal = await comercial(c.ws);
      const r = recusado(await servico.criar(c.convidado, { canalId: canal, contatoId: ana, mensagem: { conteudo: "oi" } }));
      expect(r).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      expect(await contarConversas(c.ws)).toBe(0);
      expect(valor(await abrir(c, canal, ana)).conversa.situacao).toBe("aberta");
    });

    it("se a Mensagem falha, nenhuma Conversa fica (INV-CXE-05)", async () => {
      const c = await espaco("atomica");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660010" }]);
      const canal = await comercial(c.ws);
      // O membro da sessão existe no Papel, mas o conteúdo viola o CHECK de comprimento? Não: força a falha
      // da Mensagem com um byte nulo, que o Postgres recusa em texto.
      await expect(abrir(c, canal, ana, "oi\u0000")).rejects.toBeDefined();
      expect(await contarConversas(c.ws)).toBe(0);
      expect(await contarMensagens(c.ws)).toBe(0);
    });
  });

  describe("resolver e reabrir (A4.5)", () => {
    it("resolver → resolvida com resolvidaEm; reabrir → aberta com reaberturas 1", async () => {
      const c = await espaco("ciclo");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660011" }]);
      const canal = await comercial(c.ws);
      const aberta = valor(await abrir(c, canal, ana));

      const resolvida = valor(await servico.resolver(c.membro, aberta.conversa.id));
      expect(resolvida.conversa.situacao).toBe("resolvida");
      expect(resolvida.conversa.resolvidaEm).not.toBeNull();
      expect(resolvida.canal.id).toBe(canal);

      expect(recusado(await servico.resolver(c.membro, aberta.conversa.id))).toMatchObject({ status: 409, codigo: "TRANSICAO_INVALIDA" });

      const reaberta = valor(await servico.reabrir(c.membro, aberta.conversa.id));
      expect(reaberta.conversa).toMatchObject({ situacao: "aberta", reaberturas: 1 });
      expect(reaberta.conversa.reabertaEm).not.toBeNull();

      expect(recusado(await servico.reabrir(c.membro, aberta.conversa.id))).toMatchObject({ status: 409, codigo: "TRANSICAO_INVALIDA" });
    });

    it("reabrir com outra Conversa aberta do par → 409 CONVERSA_JA_ABERTA", async () => {
      const c = await espaco("reabrirdup");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660012" }]);
      const canal = await comercial(c.ws);
      const primeira = valor(await abrir(c, canal, ana));
      valor(await servico.resolver(c.membro, primeira.conversa.id));
      const segunda = valor(await abrir(c, canal, ana, "outra"));

      const r = recusado(await servico.reabrir(c.membro, primeira.conversa.id));
      expect(r).toMatchObject({ status: 409, codigo: "CONVERSA_JA_ABERTA" });
      expect(r.bloqueios?.conversas?.itens[0]?.id).toBe(segunda.conversa.id);
    });

    it("Convidado não resolve nem reabre (403); id de outro Espaço → 404", async () => {
      const c = await espaco("papel2");
      const outro = await espaco("papel2b");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660013" }]);
      const canal = await comercial(c.ws);
      const aberta = valor(await abrir(c, canal, ana));

      expect(recusado(await servico.resolver(c.convidado, aberta.conversa.id))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      expect(recusado(await servico.reabrir(c.convidado, aberta.conversa.id))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      expect(recusado(await servico.resolver(outro.membro, aberta.conversa.id))).toMatchObject({ status: 404, codigo: "CONVERSA_NAO_ENCONTRADA" });
      expect(recusado(await servico.reabrir(outro.membro, aberta.conversa.id))).toMatchObject({ status: 404, codigo: "CONVERSA_NAO_ENCONTRADA" });
    });
  });

  describe("listar e obter", () => {
    it("lista por Espaço com filtros, e o Convidado lê; outro Espaço não vê nada", async () => {
      const c = await espaco("lista");
      const outro = await espaco("listab");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966660014" }]);
      const canalA = await comercial(c.ws);
      const canalB = await suporte(c.ws);
      const a = valor(await abrir(c, canalA, ana));
      valor(await abrir(c, canalB, ana));
      valor(await servico.resolver(c.membro, a.conversa.id));

      expect(valor(await servico.listar(c.convidado, { estado: "ativo", limite: 50, deslocamento: 0 })).total).toBe(2);
      expect(valor(await servico.listar(c.membro, { estado: "ativo", limite: 50, deslocamento: 0, canalId: canalB })).total).toBe(1);
      expect(valor(await servico.listar(c.membro, { estado: "ativo", limite: 50, deslocamento: 0, situacao: "resolvida" })).itens[0]?.id).toBe(
        a.conversa.id,
      );
      expect(valor(await servico.listar(c.membro, { estado: "ativo", limite: 50, deslocamento: 0, contatoId: ana })).total).toBe(2);
      expect(valor(await servico.listar(outro.membro, { estado: "ativo", limite: 50, deslocamento: 0 })).total).toBe(0);

      const detalhe = valor(await servico.obter(c.convidado, a.conversa.id));
      expect(detalhe.conversa.id).toBe(a.conversa.id);
      expect(detalhe.canal).toMatchObject({ id: canalA, nome: "Comercial", provedor: "whatsapp-cloud" });
      expect(recusado(await servico.obter(outro.membro, a.conversa.id))).toMatchObject({ status: 404, codigo: "CONVERSA_NAO_ENCONTRADA" });
    });
  });
});
