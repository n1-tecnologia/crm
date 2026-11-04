/**
 * `ServicoDeTarefasConversacionais` (14-13, 3.3.1, 3.3.3 e 3.3.4) contra o Postgres LOCAL:
 * a Tarefa nasce em `plataforma.registros` e a Conversa em `plataforma.conversas`, no
 * mesmo commit; o resumo do cartão sai de `plataforma.*` numa consulta só.
 *
 *   docker run -d --rm --name crm-n1-pg-1413 -e POSTGRES_PASSWORD=x -p 55673:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55673/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55673/postgres \
 *     npx vitest run src/servicos/crm/tarefas-conversacionais.test.ts
 *   docker rm -f crm-n1-pg-1413
 *
 * Cada caso tem o seu Espaço: o seed (a Lista `lst_pos_venda` é conversacional), um
 * Canal conectado marcado nela, e Contatos pelo repositório. Nas recusas, o que se
 * prova é o que NÃO ficou: nenhuma Tarefa nova em `registros` e nenhuma Conversa nova.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ok } from "@n1/dominio/state";
import { buildSeed } from "@n1/dominio/seed";
import type { TipoIdentificadorContato } from "@n1/dominio/crm/contatos";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { executar } from "../../persistencia/unidade-de-trabalho";
import { semear } from "../../persistencia/repositorio";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, poolDoDono, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import type { ResultadoCrm } from "./resultado";
import { criarServicoDeTarefasConversacionais, type NovaTarefaConversacional } from "./tarefas-conversacionais";

const SESSAO = "mem_thiago";
const LISTA = "lst_pos_venda";
const OPERACIONAL = "lst_ativacao";
const servico = criarServicoDeTarefasConversacionais({ pool, acesso: criarAcessoAoCrmPg(pool) });

const membro = (workspaceId: string, id = SESSAO): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

describeComBanco("ServicoDeTarefasConversacionais — Postgres local", () => {
  const espacos: string[] = [];

  /** Um Espaço novo com o seed, a Lista conversacional atendendo por `canal` e `canalSemLista` fora dela. */
  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    const cliente = await pool().connect();
    try {
      await semear(cliente, ws, buildSeed());
    } finally {
      cliente.release();
    }
    await semearMembro(ws, { id: "mem_convidado_teste", base: "convidado", state: "ativo" });
    const canal = await semearCanal(ws, { nome: "Comercial", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511977770001", conexao: "conectada" });
    const canalDesconectado = await semearCanal(ws, { nome: "Antigo", tipo: "whatsapp", provedor: "whatsapp-nao-oficial", identificadorExterno: "+5511977770002", conexao: "desconectada" });
    const canalSemLista = await semearCanal(ws, { nome: "Suporte", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511977770003", conexao: "conectada" });
    await executar(ws, (state) => {
      const lista = state.lists.find((l) => l.id === LISTA);
      if (!lista) throw new Error("o seed precisa de lst_pos_venda");
      lista.canaisDeAtendimento = [canal, canalDesconectado];
      return ok(undefined);
    });
    return { ws, canal, canalDesconectado, canalSemLista };
  }

  async function contato(ws: string, nome: string, identificadores: readonly { tipo: TipoIdentificadorContato; valor: string }[] = [{ tipo: "whatsapp", valor: `+55119${Math.floor(Math.random() * 1e8)}` }]): Promise<string> {
    const repositorio = criarRepositorioDeContatosPg(pool());
    const criado = await repositorio.inserir(ws, { nome, proprietarioId: SESSAO, criadoPor: SESSAO });
    for (const [i, identificador] of identificadores.entries()) await repositorio.inserirIdentificador(ws, criado.id, { ...identificador, principal: i === 0 });
    return criado.id;
  }

  /** Uma Conversa já aberta do par, com uma Mensagem (a que a Tarefa deve reaproveitar). */
  async function conversaAberta(ws: string, canalId: string, contatoId: string): Promise<string> {
    const criada = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
      canalId,
      contatoId,
      titulo: "Conversa que já existia",
      filaId: null,
      atribuido: { tipo: "membro", id: SESSAO },
      participantes: [],
      criadoPor: { tipo: "member", id: SESSAO },
    });
    await pool().query(
      `insert into plataforma.mensagens (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, conteudo, id_externo)
       values ($1, $2, $3, 'recebida', 'member', $4, 'oi, já falávamos', 'ext-1')`,
      [ws, criada.id, canalId, SESSAO],
    );
    return criada.id;
  }

  async function negocio(ws: string, contatoId: string, titulo: string, estado = "ativo"): Promise<string> {
    const funil = await pool().query<{ id: string }>("insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, $2, $3) returning id", [ws, `Funil ${randomUUID().slice(0, 6)}`, SESSAO]);
    const etapa = await pool().query<{ id: string }>("insert into plataforma.etapas (workspace_id, funil_id, nome, ordem) values ($1, $2, 'Início', 1) returning id", [ws, funil.rows[0]!.id]);
    const criado = await pool().query<{ id: string }>(
      `insert into plataforma.negocios (workspace_id, titulo, contato_id, funil_id, etapa_id, proprietario_id, criado_por, estado)
       values ($1, $2, $3, $4, $5, $6, $6, $7) returning id`,
      [ws, titulo, contatoId, funil.rows[0]!.id, etapa.rows[0]!.id, SESSAO, estado],
    );
    return criado.rows[0]!.id;
  }

  const contar = async (sql: string, ws: string): Promise<number> => Number((await pool().query<{ n: string }>(sql, [ws])).rows[0]!.n);
  const conversasNasTabelas = (ws: string) => contar("select count(*) as n from plataforma.conversas where workspace_id = $1", ws);
  const mensagensNasTabelas = (ws: string) => contar("select count(*) as n from plataforma.mensagens where workspace_id = $1", ws);
  const colecao = (nome: string) => (ws: string) => contar(`select count(*) as n from plataforma.registros where workspace_id = $1 and colecao = '${nome}'`, ws);
  const conversasEmRegistros = colecao("conversations");
  const tarefasEmRegistros = colecao("tasks");
  const vinculosEmRegistros = colecao("links");

  async function vinculosDaTarefa(ws: string, taskId: string): Promise<{ toType: string; toId: string }[]> {
    const { rows } = await pool().query<{ dados: { fromId: string; toType: string; toId: string } }>(
      "select dados from plataforma.registros where workspace_id = $1 and colecao = 'links' and dados->>'fromId' = $2",
      [ws, taskId],
    );
    return rows.map((r) => ({ toType: r.dados.toType, toId: r.dados.toId }));
  }

  const entrada = (e: Awaited<ReturnType<typeof espaco>>, contatoId: string, extra: Partial<NovaTarefaConversacional> = {}): NovaTarefaConversacional => ({
    listId: LISTA,
    contatoId,
    canalId: e.canal,
    mensagem: { conteudo: "Olá, tudo bem?" },
    ...extra,
  });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  describe("criar", () => {
    it("sem Conversa aberta: +1 Conversa e +1 Mensagem nas tabelas, 0 Conversas em registros, e os Vínculos da Tarefa apontam para os ids das tabelas", async () => {
      const e = await espaco("criar");
      const marina = await contato(e.ws, "Marina Duarte");
      const antes = { registros: await conversasEmRegistros(e.ws), tarefas: await tarefasEmRegistros(e.ws) };

      const criada = valor(await servico.criar(membro(e.ws), entrada(e, marina)));

      expect(criada.conversa.aberta).toBe(true);
      expect(await conversasNasTabelas(e.ws)).toBe(1);
      expect(await mensagensNasTabelas(e.ws)).toBe(1);
      expect(await conversasEmRegistros(e.ws)).toBe(antes.registros);
      expect(await tarefasEmRegistros(e.ws)).toBe(antes.tarefas + 1);

      expect(criada.ok).toBe(true);
      const tarefa = (criada as unknown as { value: { task: { id: string; title: string; listId: string } } }).value.task;
      expect(tarefa).toMatchObject({ title: "Marina Duarte", listId: LISTA });
      const conversa = await criarRepositorioDeConversasPg(pool()).obter(e.ws, criada.conversa.id);
      expect(conversa).toMatchObject({ contatoId: marina, canalId: e.canal, situacao: "aberta" });
      const vinculos = await vinculosDaTarefa(e.ws, tarefa.id);
      expect(vinculos).toEqual(expect.arrayContaining([{ toType: "contact", toId: marina }, { toType: "conversation", toId: criada.conversa.id }]));
      const { rows } = await pool().query<{ conteudo: string; direcao: string }>("select conteudo, direcao from plataforma.mensagens where workspace_id = $1", [e.ws]);
      expect(rows).toEqual([{ conteudo: "Olá, tudo bem?", direcao: "enviada" }]);
      // A resposta sai pelo recorte de POST /operacoes: traz a diferença e a sequência de ids.
      expect(typeof criada.sequencia).toBe("number");
      expect(criada.diferenca).toBeDefined();
    });

    it("com Conversa aberta no par: reaproveita, e nenhuma Conversa nem Mensagem nova nasce (a Mensagem do corpo é ignorada)", async () => {
      const e = await espaco("reaproveita");
      const marina = await contato(e.ws, "Marina Duarte");
      const existente = await conversaAberta(e.ws, e.canal, marina);

      const sem = valor(await servico.criar(membro(e.ws), { listId: LISTA, contatoId: marina, canalId: e.canal }));
      expect(sem.conversa).toEqual({ id: existente, aberta: false });
      const com = valor(await servico.criar(membro(e.ws), entrada(e, marina)));
      expect(com.conversa).toEqual({ id: existente, aberta: false });

      expect(await conversasNasTabelas(e.ws)).toBe(1);
      expect(await mensagensNasTabelas(e.ws)).toBe(1);
      const tarefa = (com as unknown as { value: { task: { id: string } } }).value.task;
      expect(await vinculosDaTarefa(e.ws, tarefa.id)).toEqual(expect.arrayContaining([{ toType: "conversation", toId: existente }]));
    });

    it("sem Conversa aberta e sem Mensagem → 400 VALOR_INVALIDO campo mensagem, e nada fica gravado (D-07)", async () => {
      const e = await espaco("semmensagem");
      const marina = await contato(e.ws, "Marina Duarte");
      const tarefas = await tarefasEmRegistros(e.ws);

      const r = recusado(await servico.criar(membro(e.ws), { listId: LISTA, contatoId: marina, canalId: e.canal }));
      expect(r).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "mensagem" });
      expect(await conversasNasTabelas(e.ws)).toBe(0);
      expect(await tarefasEmRegistros(e.ws)).toBe(tarefas);
    });

    it("Mensagem mal formada → 400 com o campo conteudo, antes de abrir transação", async () => {
      const e = await espaco("mensagemruim");
      const marina = await contato(e.ws, "Marina Duarte");
      const r = recusado(await servico.criar(membro(e.ws), entrada(e, marina, { mensagem: { conteudo: "   " } })));
      expect(r).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "conteudo" });
      expect(await conversasNasTabelas(e.ws)).toBe(0);
    });

    it.each([
      ["Lista operacional", (e: { canal: string }) => ({ listId: OPERACIONAL, canalId: e.canal }), "lista"],
      ["Canal fora da Lista", (e: { canalSemLista: string }) => ({ canalId: e.canalSemLista }), "canal"],
      ["Canal desconectado", (e: { canalDesconectado: string }) => ({ canalId: e.canalDesconectado }), "canal"],
    ] as const)("%s → 409 RECUSA_DO_DOMINIO com o campo, sem Tarefa, Conversa nem Mensagem", async (_rotulo, sobre, campo) => {
      const e = await espaco("recusa");
      const marina = await contato(e.ws, "Marina Duarte");
      const tarefas = await tarefasEmRegistros(e.ws);
      const vinculos = await vinculosEmRegistros(e.ws);

      const r = recusado(await servico.criar(membro(e.ws), entrada(e, marina, sobre(e as never))));
      expect(r).toMatchObject({ status: 409, codigo: "RECUSA_DO_DOMINIO", campo });
      expect(await conversasNasTabelas(e.ws)).toBe(0);
      expect(await mensagensNasTabelas(e.ws)).toBe(0);
      expect(await tarefasEmRegistros(e.ws)).toBe(tarefas);
      expect(await vinculosEmRegistros(e.ws)).toBe(vinculos);
    });

    it("Contato mesclado → 409 CONTATO_MESCLADO; arquivado → 409 CONTATO_INATIVO; sem Identificador do tipo do Canal → 409; de outro Espaço → 404", async () => {
      const e = await espaco("contatos");
      const outro = await espaco("contatosb");
      const sobrevivente = await contato(e.ws, "Sobrevivente");
      const absorvido = await contato(e.ws, "Absorvido");
      const arquivado = await contato(e.ws, "Arquivado");
      const semWhatsapp = await contato(e.ws, "Só e-mail", [{ tipo: "email", valor: "so@exemplo.com" }]);
      const deOutro = await contato(outro.ws, "De outro Espaço");
      await poolDoDono().query(
        "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
        [e.ws, absorvido, sobrevivente],
      );
      await pool().query("update plataforma.contatos set estado = 'arquivado' where workspace_id = $1 and id = $2", [e.ws, arquivado]);

      expect(recusado(await servico.criar(membro(e.ws), entrada(e, absorvido)))).toMatchObject({ status: 409, codigo: "CONTATO_MESCLADO" });
      expect(recusado(await servico.criar(membro(e.ws), entrada(e, arquivado)))).toMatchObject({ status: 409, codigo: "CONTATO_INATIVO" });
      expect(recusado(await servico.criar(membro(e.ws), entrada(e, semWhatsapp)))).toMatchObject({ status: 409, codigo: "CONTATO_SEM_IDENTIFICADOR_DO_CANAL" });
      expect(recusado(await servico.criar(membro(e.ws), entrada(e, deOutro)))).toMatchObject({ status: 404, codigo: "CONTATO_NAO_ENCONTRADO" });
      expect(await conversasNasTabelas(e.ws)).toBe(0);
    });

    it("Canal arquivado → 409 CANAL_ARQUIVADO; Canal de outro Espaço → 404", async () => {
      const e = await espaco("canais");
      const outro = await espaco("canaisb");
      const marina = await contato(e.ws, "Marina Duarte");
      await pool().query("update plataforma.canais set estado = 'arquivado', conexao = 'desconectada', arquivado_em = now() where workspace_id = $1 and id = $2", [e.ws, e.canal]);

      expect(recusado(await servico.criar(membro(e.ws), entrada(e, marina)))).toMatchObject({ status: 409, codigo: "CANAL_ARQUIVADO" });
      expect(recusado(await servico.criar(membro(e.ws), entrada(e, marina, { canalId: outro.canal })))).toMatchObject({ status: 404, codigo: "CANAL_NAO_ENCONTRADO" });
      expect(await conversasNasTabelas(e.ws)).toBe(0);
    });

    it("Negócio do Contato vincula; de outro Contato, de outro Espaço ou fora de `ativo` → 409 com a frase do domínio", async () => {
      const e = await espaco("negocio");
      const outro = await espaco("negociob");
      const marina = await contato(e.ws, "Marina Duarte");
      const joao = await contato(e.ws, "João");
      const dela = await negocio(e.ws, marina, "Renovação 2027");
      const dele = await negocio(e.ws, joao, "Do João");
      const arquivado = await negocio(e.ws, marina, "Arquivado", "arquivado");
      const deOutroEspaco = await negocio(outro.ws, await contato(outro.ws, "X"), "De outro Espaço");

      const feita = valor(await servico.criar(membro(e.ws), entrada(e, marina, { negocioId: dela })));
      const tarefa = (feita as unknown as { value: { task: { id: string } } }).value.task;
      expect(await vinculosDaTarefa(e.ws, tarefa.id)).toEqual(expect.arrayContaining([{ toType: "deal", toId: dela }]));

      const tarefas = await tarefasEmRegistros(e.ws);
      for (const id of [dele, arquivado, deOutroEspaco]) {
        const r = recusado(await servico.criar(membro(e.ws), entrada(e, marina, { negocioId: id })));
        expect(r).toMatchObject({ status: 409, error: "Este Negócio não é deste Contato.", campo: "negocioId" });
      }
      expect(await tarefasEmRegistros(e.ws)).toBe(tarefas);
    });

    it("Convidado → 403 antes de ler qualquer coisa; Membro cria", async () => {
      const e = await espaco("papel");
      const marina = await contato(e.ws, "Marina Duarte");
      expect(recusado(await servico.criar(membro(e.ws, "mem_convidado_teste"), entrada(e, marina)))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      expect(await conversasNasTabelas(e.ws)).toBe(0);
    });
  });
});
