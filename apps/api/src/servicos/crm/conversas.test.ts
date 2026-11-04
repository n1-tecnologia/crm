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
import { criarRepositorioDeMensagensPg } from "../../repositorios/crm/mensagens";
import {
  describeComBanco,
  limparEspaco,
  novoEspacoDeTeste,
  poolDoDono,
  prepararBancoCrm,
  semearCanal,
  semearMembro,
} from "../../testes/banco-crm";
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
  describe("mover (3.2.5)", () => {
    const mensagensDaConversa = async (ws: string, conversaId: string) =>
      Number(
        (await pool().query<{ n: string }>("select count(*) as n from plataforma.mensagens where workspace_id = $1 and conversa_id = $2", [ws, conversaId]))
          .rows[0]!.n,
      );

    it("A para B sem colisão: Contato B, mesmo Canal, mesmas Mensagens, Participante principal aponta B", async () => {
      const c = await espaco("mover");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966661001" }]);
      const bia = await contato(c.ws, "Bia", [{ tipo: "whatsapp", valor: "+5511966661002" }]);
      const canal = await comercial(c.ws);
      const aberta = valor(await abrir(c, canal, ana));
      const mensagens = await mensagensDaConversa(c.ws, aberta.conversa.id);

      const movida = valor(await servico.mover(c.membro, aberta.conversa.id, { contatoId: bia }));
      expect(movida.conversa).toMatchObject({ id: aberta.conversa.id, contatoId: bia, canalId: canal, situacao: "aberta" });
      expect(movida.canal.id).toBe(canal);
      expect(await mensagensDaConversa(c.ws, aberta.conversa.id)).toBe(mensagens);
      const doContato = movida.conversa.participantes.find((p) => p.sujeito.tipo === "contato");
      expect(doContato).toMatchObject({ principal: true, sujeito: { tipo: "contato", id: bia } });
      expect(movida.conversa.participantes.find((p) => p.sujeito.tipo === "membro")?.sujeito.id).toBe("mem_ana");
    });

    it("destino com Conversa aberta no mesmo Canal: sem resolverExistente → 409 CONVERSA_JA_ABERTA e nada muda", async () => {
      const c = await espaco("movercolide");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966661003" }]);
      const bia = await contato(c.ws, "Bia", [{ tipo: "whatsapp", valor: "+5511966661004" }]);
      const canal = await comercial(c.ws);
      const daAna = valor(await abrir(c, canal, ana));
      const daBia = valor(await abrir(c, canal, bia));

      const r = recusado(await servico.mover(c.membro, daAna.conversa.id, { contatoId: bia }));
      expect(r).toMatchObject({ status: 409, codigo: "CONVERSA_JA_ABERTA" });
      expect(r.bloqueios?.conversas?.itens[0]?.id).toBe(daBia.conversa.id);
      expect(valor(await servico.obter(c.membro, daAna.conversa.id)).conversa.contatoId).toBe(ana);
      expect(valor(await servico.obter(c.membro, daBia.conversa.id)).conversa.situacao).toBe("aberta");
    });

    it("resolverExistente: a existente fica resolvida (sem adiamento) e a movida vai para o destino", async () => {
      const c = await espaco("moverresolve");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966661005" }]);
      const bia = await contato(c.ws, "Bia", [{ tipo: "whatsapp", valor: "+5511966661006" }]);
      const canal = await comercial(c.ws);
      const daAna = valor(await abrir(c, canal, ana));
      const daBia = valor(await abrir(c, canal, bia));
      await pool().query(
        "update plataforma.conversas set situacao = 'pendente', adiada_ate = now() + interval '1 day', adiamento_motivo = 'volto' where workspace_id = $1 and id = $2",
        [c.ws, daBia.conversa.id],
      );

      const movida = valor(await servico.mover(c.membro, daAna.conversa.id, { contatoId: bia, resolverExistente: true }));
      expect(movida.conversa.contatoId).toBe(bia);
      const existente = valor(await servico.obter(c.membro, daBia.conversa.id)).conversa;
      expect(existente).toMatchObject({ situacao: "resolvida", adiadaAte: null, adiamentoMotivo: null });
      expect(existente.resolvidaEm).not.toBeNull();
    });

    it("Conversa resolvida nunca colide: vai mesmo com Conversa aberta no destino", async () => {
      const c = await espaco("moverresolvida");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966661007" }]);
      const bia = await contato(c.ws, "Bia", [{ tipo: "whatsapp", valor: "+5511966661008" }]);
      const canal = await comercial(c.ws);
      const daAna = valor(await abrir(c, canal, ana));
      valor(await servico.resolver(c.membro, daAna.conversa.id));
      const daBia = valor(await abrir(c, canal, bia));

      const movida = valor(await servico.mover(c.membro, daAna.conversa.id, { contatoId: bia }));
      expect(movida.conversa).toMatchObject({ contatoId: bia, situacao: "resolvida" });
      expect(valor(await servico.obter(c.membro, daBia.conversa.id)).conversa.situacao).toBe("aberta");
    });

    it("destino arquivado ou mesclado → 409 com campo contatoId; o mesmo Contato também", async () => {
      const c = await espaco("moverdestino");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966661009" }]);
      const arquivado = await contato(c.ws, "Arq", [{ tipo: "whatsapp", valor: "+5511966661010" }]);
      const absorvido = await contato(c.ws, "Abs", [{ tipo: "whatsapp", valor: "+5511966661011" }]);
      const canal = await comercial(c.ws);
      const aberta = valor(await abrir(c, canal, ana));
      await pool().query("update plataforma.contatos set estado = 'arquivado' where workspace_id = $1 and id = $2", [c.ws, arquivado]);
      await poolDoDono().query(
        "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
        [c.ws, absorvido, ana],
      );

      for (const destino of [arquivado, absorvido]) {
        expect(recusado(await servico.mover(c.membro, aberta.conversa.id, { contatoId: destino }))).toMatchObject({ status: 409, campo: "contatoId" });
      }
      expect(recusado(await servico.mover(c.membro, aberta.conversa.id, { contatoId: ana }))).toMatchObject({ status: 409, campo: "contatoId" });
      expect(valor(await servico.obter(c.membro, aberta.conversa.id)).conversa.contatoId).toBe(ana);
    });

    it("Conversa na lixeira não muda de Contato (409)", async () => {
      const c = await espaco("movertrash");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966661012" }]);
      const bia = await contato(c.ws, "Bia", [{ tipo: "whatsapp", valor: "+5511966661013" }]);
      const canal = await comercial(c.ws);
      const aberta = valor(await abrir(c, canal, ana));
      await pool().query(
        "update plataforma.conversas set situacao = 'resolvida', estado = 'na_lixeira', na_lixeira_em = now() where workspace_id = $1 and id = $2",
        [c.ws, aberta.conversa.id],
      );
      expect(recusado(await servico.mover(c.membro, aberta.conversa.id, { contatoId: bia }))).toMatchObject({ status: 409 });
      expect(valor(await servico.obter(c.membro, aberta.conversa.id)).conversa.contatoId).toBe(ana);
    });

    it("Convidado → 403 antes de ler; Conversa ou Contato de outro Espaço → 404", async () => {
      const c = await espaco("moverpapel");
      const outro = await espaco("moverpapelb");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966661014" }]);
      const bia = await contato(c.ws, "Bia", [{ tipo: "whatsapp", valor: "+5511966661015" }]);
      const deFora = await contato(outro.ws, "Fora", [{ tipo: "whatsapp", valor: "+5511966661016" }]);
      const canal = await comercial(c.ws);
      const aberta = valor(await abrir(c, canal, ana));

      expect(recusado(await servico.mover(c.convidado, aberta.conversa.id, { contatoId: bia }))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      expect(recusado(await servico.mover(outro.membro, aberta.conversa.id, { contatoId: deFora }))).toMatchObject({
        status: 404,
        codigo: "CONVERSA_NAO_ENCONTRADA",
      });
      expect(recusado(await servico.mover(c.membro, aberta.conversa.id, { contatoId: deFora }))).toMatchObject({
        status: 404,
        codigo: "CONTATO_NAO_ENCONTRADO",
        campo: "contatoId",
      });
      expect(valor(await servico.obter(c.membro, aberta.conversa.id)).conversa.contatoId).toBe(ana);
    });
  });
  describe("atribuir (3.2.6, parte 1)", () => {
    async function agente(ws: string, id: string, lifecycle: string) {
      await pool().query(
        `insert into plataforma.registros (workspace_id, colecao, id, dados)
         values ($1, 'agents', $2, $3::jsonb)
         on conflict (workspace_id, colecao, id) do update set dados = excluded.dados`,
        [ws, id, JSON.stringify({ id, lifecycle, name: id })],
      );
    }

    async function conversaAberta(c: Contexto, valorWhats: string) {
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: valorWhats }]);
      const canal = await comercial(c.ws);
      return valor(await abrir(c, canal, ana)).conversa;
    }

    it("Membro ativo do Espaço, Agente ativo e null: grava, troca e tira a atribuição", async () => {
      const c = await espaco("atribuir");
      await semearMembro(c.ws, { id: "mem_bia", base: "membro", state: "ativo" });
      await agente(c.ws, "agt_1", "ativo");
      const conversa = await conversaAberta(c, "+5511966662001");

      const paraMembro = valor(await servico.atribuir(c.membro, conversa.id, { atribuido: { tipo: "membro", id: "mem_bia" } }));
      expect(paraMembro.conversa.atribuido).toEqual({ tipo: "membro", id: "mem_bia" });
      const paraAgente = valor(await servico.atribuir(c.membro, conversa.id, { atribuido: { tipo: "agente", id: "agt_1" } }));
      expect(paraAgente.conversa.atribuido).toEqual({ tipo: "agente", id: "agt_1" });
      expect(paraAgente.canal.id).toBe(conversa.canalId);
      const livre = valor(await servico.atribuir(c.membro, conversa.id, { atribuido: null }));
      expect(livre.conversa.atribuido).toBeNull();
      const { rows } = await pool().query("select atribuido_tipo, atribuido_id from plataforma.conversas where workspace_id = $1 and id = $2", [c.ws, conversa.id]);
      expect(rows[0]).toEqual({ atribuido_tipo: null, atribuido_id: null });
    });

    it("Membro de outro Espaço, suspenso ou removido → 409 com campo atribuido, e nada muda", async () => {
      const c = await espaco("atribuirinvalido");
      const outro = await espaco("atribuirinvalidob");
      await semearMembro(outro.ws, { id: "mem_fora", base: "membro", state: "ativo" });
      await semearMembro(c.ws, { id: "mem_susp", base: "membro", state: "suspenso" });
      await semearMembro(c.ws, { id: "mem_rem", base: "membro", state: "removido" });
      const conversa = await conversaAberta(c, "+5511966662002");

      for (const id of ["mem_fora", "mem_susp", "mem_rem", "mem_inexistente"]) {
        const r = recusado(await servico.atribuir(c.membro, conversa.id, { atribuido: { tipo: "membro", id } }));
        expect(r).toMatchObject({ status: 409, codigo: "ATRIBUIDO_INVALIDO", campo: "atribuido" });
      }
      expect(valor(await servico.obter(c.membro, conversa.id)).conversa.atribuido).toEqual({ tipo: "membro", id: "mem_ana" });
    });

    it("Agente inexistente, de outro Espaço ou fora do ar → 409 com campo atribuido", async () => {
      const c = await espaco("atribuiragente");
      const outro = await espaco("atribuiragenteb");
      await agente(outro.ws, "agt_fora", "ativo");
      await agente(c.ws, "agt_pausado", "pausado");
      const conversa = await conversaAberta(c, "+5511966662003");

      for (const id of ["agt_nao_existe", "agt_fora", "agt_pausado"]) {
        const r = recusado(await servico.atribuir(c.membro, conversa.id, { atribuido: { tipo: "agente", id } }));
        expect(r).toMatchObject({ status: 409, codigo: "ATRIBUIDO_INVALIDO", campo: "atribuido" });
      }
    });

    it("Conversa na lixeira → 409; Convidado → 403 antes de ler; outro Espaço → 404", async () => {
      const c = await espaco("atribuirpapel");
      const outro = await espaco("atribuirpapelb");
      const conversa = await conversaAberta(c, "+5511966662004");

      expect(recusado(await servico.atribuir(c.convidado, conversa.id, { atribuido: null }))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      expect(recusado(await servico.atribuir(outro.membro, conversa.id, { atribuido: null }))).toMatchObject({
        status: 404,
        codigo: "CONVERSA_NAO_ENCONTRADA",
      });

      await pool().query(
        "update plataforma.conversas set situacao = 'resolvida', estado = 'na_lixeira', na_lixeira_em = now() where workspace_id = $1 and id = $2",
        [c.ws, conversa.id],
      );
      expect(recusado(await servico.atribuir(c.membro, conversa.id, { atribuido: { tipo: "membro", id: "mem_admin" } }))).toMatchObject({ status: 409 });
    });
  });

  describe("lixeira e restaurar (3.2.6)", () => {
    async function resolvida(c: Contexto, valorWhats: string, nome = "Ana") {
      const ana = await contato(c.ws, nome, [{ tipo: "whatsapp", valor: valorWhats }]);
      const canal = await comercial(c.ws, { identificadorExterno: `+55119${valorWhats.slice(-8)}` });
      const aberta = valor(await abrir(c, canal, ana));
      valor(await servico.resolver(c.membro, aberta.conversa.id));
      return { ana, canal, id: aberta.conversa.id };
    }

    const filtro = (estado: "ativo" | "na_lixeira") => ({ estado, limite: 50, deslocamento: 0 });

    it("Conversa resolvida → lixeira guarda na_lixeira_em, sai de ativo e aparece em na_lixeira; restaurar volta e zera a data", async () => {
      const c = await espaco("lixeira");
      const { id } = await resolvida(c, "+5511966663001");

      const mandada = valor(await servico.enviarParaLixeira(c.membro, id));
      expect(mandada.conversa).toMatchObject({ id, estado: "na_lixeira", situacao: "resolvida" });
      expect(mandada.conversa.naLixeiraEm).not.toBeNull();
      expect(mandada.canal.id).toBeTruthy();
      expect(valor(await servico.listar(c.membro, filtro("ativo"))).itens.map((i) => i.id)).not.toContain(id);
      expect(valor(await servico.listar(c.membro, filtro("na_lixeira"))).itens.map((i) => i.id)).toEqual([id]);

      const volta = valor(await servico.restaurar(c.membro, id));
      expect(volta.conversa).toMatchObject({ id, estado: "ativo", naLixeiraEm: null });
      const { rows } = await pool().query("select estado, na_lixeira_em from plataforma.conversas where workspace_id = $1 and id = $2", [c.ws, id]);
      expect(rows[0]).toEqual({ estado: "ativo", na_lixeira_em: null });
      expect(valor(await servico.listar(c.membro, filtro("na_lixeira"))).total).toBe(0);
    });

    it("Conversa aberta → 409 TRANSICAO_INVALIDA com a frase; já na lixeira também; restaurar fora da lixeira também", async () => {
      const c = await espaco("lixeiraaberta");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966663002" }]);
      const canal = await comercial(c.ws);
      const aberta = valor(await abrir(c, canal, ana));

      expect(recusado(await servico.enviarParaLixeira(c.membro, aberta.conversa.id))).toMatchObject({
        status: 409,
        codigo: "TRANSICAO_INVALIDA",
        error: "Resolva a Conversa antes de mandá-la para a lixeira.",
      });
      expect(recusado(await servico.restaurar(c.membro, aberta.conversa.id))).toMatchObject({ status: 409, codigo: "TRANSICAO_INVALIDA" });

      valor(await servico.resolver(c.membro, aberta.conversa.id));
      valor(await servico.enviarParaLixeira(c.membro, aberta.conversa.id));
      expect(recusado(await servico.enviarParaLixeira(c.membro, aberta.conversa.id))).toMatchObject({ status: 409, codigo: "TRANSICAO_INVALIDA" });
    });

    it("restaurar com o Contato na lixeira → 409 e a Conversa continua na lixeira", async () => {
      const c = await espaco("lixeiracontato");
      const { ana, id } = await resolvida(c, "+5511966663003");
      valor(await servico.enviarParaLixeira(c.membro, id));
      await pool().query("update plataforma.contatos set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [c.ws, ana]);

      const r = recusado(await servico.restaurar(c.membro, id));
      expect(r).toMatchObject({ status: 409, codigo: "TRANSICAO_INVALIDA" });
      expect(r.error).toContain("Restaure o Contato antes");
      expect(valor(await servico.obter(c.membro, id)).conversa.estado).toBe("na_lixeira");
    });

    it("Convidado → 403 nas duas; outro Espaço → 404 nas duas", async () => {
      const c = await espaco("lixeirapapel");
      const outro = await espaco("lixeirapapelb");
      const { id } = await resolvida(c, "+5511966663004");

      expect(recusado(await servico.enviarParaLixeira(c.convidado, id))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      expect(recusado(await servico.restaurar(c.convidado, id))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      expect(recusado(await servico.enviarParaLixeira(outro.membro, id))).toMatchObject({ status: 404, codigo: "CONVERSA_NAO_ENCONTRADA" });
      expect(recusado(await servico.restaurar(outro.membro, id))).toMatchObject({ status: 404, codigo: "CONVERSA_NAO_ENCONTRADA" });
      expect(valor(await servico.obter(c.membro, id)).conversa.estado).toBe("ativo");
    });
  });

  describe("marcação por Membro e listagem com filtros (3.2.6)", () => {
    const todas = { estado: "ativo", limite: 50, deslocamento: 0 } as const;
    const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

    async function recebida(ws: string, conversaId: string, canalId: string, idExterno: string, criadoEm: string) {
      await criarRepositorioDeMensagensPg(pool()).inserirRecebida(ws, {
        conversaId,
        canalId,
        idExterno,
        criadoEm,
        conteudo: "oi",
        anexos: [],
        assunto: null,
        enderecosAdicionais: [],
        remetenteExterno: null,
        identificadorId: null,
        cargaBruta: {},
      });
    }

    it("a estrela é do Membro: X marca, Y não vê e a lista de Y tem estrela false", async () => {
      const c = await espaco("estrela");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966664001" }]);
      const canal = await comercial(c.ws);
      const { conversa } = valor(await abrir(c, canal, ana));

      expect(valor(await servico.marcar(c.membro, conversa.id, { estrela: true }))).toEqual({ estrela: true, lidaAte: null });

      const deX = valor(await servico.listar(c.membro, { ...todas, comEstrela: true }));
      expect(deX.itens.map((i) => i.id)).toEqual([conversa.id]);
      expect(deX.itens[0]?.estrela).toBe(true);
      expect(valor(await servico.listar(c.admin, { ...todas, comEstrela: true })).total).toBe(0);
      expect(valor(await servico.listar(c.admin, todas)).itens[0]?.estrela).toBe(false);
      expect(valor(await servico.listar(c.membro, { ...todas, comEstrela: false })).total).toBe(0);

      // Y desmarcar a própria não mexe na de X.
      valor(await servico.marcar(c.admin, conversa.id, { estrela: false }));
      expect(valor(await servico.listar(c.membro, { ...todas, comEstrela: true })).total).toBe(1);
    });

    it("naoLidas conta as recebidas depois do lidaAte do Membro; sem marcação conta todas; enviada não conta", async () => {
      const c = await espaco("naolidas");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966664002" }]);
      const canal = await comercial(c.ws);
      const { conversa } = valor(await abrir(c, canal, ana));
      await recebida(c.ws, conversa.id, canal, "wamid.1", horasAtras(2));
      await recebida(c.ws, conversa.id, canal, "wamid.2", horasAtras(1));
      const naoLidas = async (quem: MembroDaSessao) => valor(await servico.listar(quem, todas)).itens[0]?.naoLidas;

      expect(await naoLidas(c.membro)).toBe(2);
      valor(await servico.marcar(c.membro, conversa.id, { lidaAte: horasAtras(1.5) }));
      expect(await naoLidas(c.membro)).toBe(1);
      expect(valor(await servico.marcar(c.membro, conversa.id, { lidaAte: new Date().toISOString() })).estrela).toBe(false);
      expect(await naoLidas(c.membro)).toBe(0);
      expect(await naoLidas(c.admin)).toBe(2);
    });

    it("marcar só um campo não apaga o outro", async () => {
      const c = await espaco("doiscampos");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966664003" }]);
      const canal = await comercial(c.ws);
      const { conversa } = valor(await abrir(c, canal, ana));
      const lidaAte = horasAtras(1);

      valor(await servico.marcar(c.membro, conversa.id, { estrela: true }));
      const depois = valor(await servico.marcar(c.membro, conversa.id, { lidaAte }));
      expect(depois).toEqual({ estrela: true, lidaAte });
      expect(valor(await servico.marcar(c.membro, conversa.id, { estrela: false }))).toEqual({ estrela: false, lidaAte });
    });

    it("atribuidoId e filaId filtram; q acha o título sem diferenciar maiúscula", async () => {
      const c = await espaco("filtros");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966664004" }]);
      const bia = await contato(c.ws, "Bia", [{ tipo: "whatsapp", valor: "+5511966664005" }]);
      const canal = await comercial(c.ws);
      const daAna = valor(await abrir(c, canal, ana)).conversa;
      const daBia = valor(await abrir(c, canal, bia)).conversa;
      valor(await servico.atribuir(c.membro, daBia.id, { atribuido: { tipo: "membro", id: "mem_admin" } }));
      await pool().query("update plataforma.conversas set fila_id = 'fila_vendas', titulo = 'Conversa com João' where workspace_id = $1 and id = $2", [c.ws, daAna.id]);
      const ids = async (filtro: object) => valor(await servico.listar(c.membro, { ...todas, ...filtro })).itens.map((i) => i.id);

      expect(await ids({ atribuidoId: "mem_admin" })).toEqual([daBia.id]);
      expect(await ids({ atribuidoId: "mem_ana" })).toEqual([daAna.id]);
      expect(await ids({ filaId: "fila_vendas" })).toEqual([daAna.id]);
      expect(await ids({ filaId: "fila_nao_existe" })).toEqual([]);
      expect(await ids({ q: "joão" })).toEqual([daAna.id]);
      expect(await ids({ q: "JOÃO" })).toEqual([daAna.id]);
      expect(await ids({ q: "com jo", filaId: "fila_vendas", atribuidoId: "mem_ana" })).toEqual([daAna.id]);
      expect(await ids({ q: "com jo", atribuidoId: "mem_admin" })).toEqual([]);
    });

    it("q é literal: % e _ não viram curinga e aspas não quebram a consulta (T-14-16)", async () => {
      const c = await espaco("qliteral");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966664006" }]);
      const bia = await contato(c.ws, "Bia", [{ tipo: "whatsapp", valor: "+5511966664007" }]);
      const canal = await comercial(c.ws);
      const daAna = valor(await abrir(c, canal, ana)).conversa;
      valor(await abrir(c, canal, bia));
      await pool().query("update plataforma.conversas set titulo = '100% certo_mesmo' where workspace_id = $1 and id = $2", [c.ws, daAna.id]);
      const ids = async (q: string) => valor(await servico.listar(c.membro, { ...todas, q })).itens.map((i) => i.id);

      expect(await ids("%")).toEqual([daAna.id]);
      expect(await ids("_")).toEqual([daAna.id]);
      expect(await ids("%%")).toEqual([]);
      expect(await ids("a_b")).toEqual([]);
      expect(await ids("x'; drop table plataforma.conversas; --")).toEqual([]);
      expect(await contarConversas(c.ws)).toBe(2);
    });

    it("cada item traz contatoNome: nome e sobrenome, ou o e-mail/telefone principal", async () => {
      const c = await espaco("contatonome");
      const completo = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966664008" }]);
      await pool().query("update plataforma.contatos set sobrenome = 'Silva' where workspace_id = $1 and id = $2", [c.ws, completo]);
      const semNome = await contato(c.ws, "Provisorio", [{ tipo: "email", valor: "zeca@exemplo.com" }, { tipo: "whatsapp", valor: "+5511966664009" }]);
      await pool().query("update plataforma.contatos set nome = null where workspace_id = $1 and id = $2", [c.ws, semNome]);
      const canal = await comercial(c.ws);
      const a = valor(await abrir(c, canal, completo)).conversa;
      const b = valor(await abrir(c, canal, semNome)).conversa;

      const itens = valor(await servico.listar(c.membro, todas)).itens;
      expect(itens.find((i) => i.id === a.id)?.contatoNome).toBe("Ana Silva");
      expect(itens.find((i) => i.id === b.id)?.contatoNome).toBe("zeca@exemplo.com");
    });

    it("a lista de outro Espaço não vê a Conversa, e q e filtros não vazam entre Espaços", async () => {
      const c = await espaco("isolamento");
      const outro = await espaco("isolamentob");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966664010" }]);
      const canal = await comercial(c.ws);
      const { conversa } = valor(await abrir(c, canal, ana));
      valor(await servico.marcar(c.membro, conversa.id, { estrela: true }));

      expect(valor(await servico.listar(outro.membro, { ...todas, q: "Ana" })).total).toBe(0);
      expect(valor(await servico.listar(outro.membro, { ...todas, comEstrela: true })).total).toBe(0);
    });

    it("marcar: {} e lidaAte inválida → 400; outro Espaço → 404; Convidado → 403, e nada é gravado", async () => {
      const c = await espaco("marcarerros");
      const outro = await espaco("marcarerrosb");
      const ana = await contato(c.ws, "Ana", [{ tipo: "whatsapp", valor: "+5511966664011" }]);
      const canal = await comercial(c.ws);
      const { conversa } = valor(await abrir(c, canal, ana));

      expect(recusado(await servico.marcar(c.membro, conversa.id, {}))).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO" });
      expect(recusado(await servico.marcar(c.membro, conversa.id, { lidaAte: "ontem" }))).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "lidaAte" });
      expect(recusado(await servico.marcar(outro.membro, conversa.id, { estrela: true }))).toMatchObject({ status: 404, codigo: "CONVERSA_NAO_ENCONTRADA" });
      expect(recusado(await servico.marcar(c.convidado, conversa.id, { estrela: true }))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      const { rows } = await pool().query("select count(*)::int as n from plataforma.conversa_marcacoes where workspace_id = $1", [c.ws]);
      expect(rows[0]?.n).toBe(0);
    });
  });
});
