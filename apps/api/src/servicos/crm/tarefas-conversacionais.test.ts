/**
 * `ServicoDeTarefasConversacionais` (14-13 e 14-14: 3.3.1, 3.3.3 a 3.3.6) contra o Postgres LOCAL:
 * a Tarefa nasce em `plataforma.registros` e a Conversa em `plataforma.conversas`, no
 * mesmo commit; o resumo do cartão sai de `plataforma.*` numa consulta só; trocar o Canal
 * e ligar ou criar o Negócio da Tarefa mexem só nos Vínculos dela e, se for o caso, nas tabelas.
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
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ok } from "@n1/dominio/state";
import { buildSeed } from "@n1/dominio/seed";
import type { TipoIdentificadorContato } from "@n1/dominio/crm/contatos";
import { RESUMO_MAXIMO } from "@n1/dominio/crm/resumo-da-tarefa";
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
    const canalEmail = await semearCanal(ws, { nome: "Atendimento por e-mail", tipo: "email", provedor: "email-imap-smtp", identificadorExterno: "atendimento@exemplo.com", conexao: "conectada" });
    await executar(ws, (state) => {
      const lista = state.lists.find((l) => l.id === LISTA);
      if (!lista) throw new Error("o seed precisa de lst_pos_venda");
      lista.canaisDeAtendimento = [canal, canalDesconectado, canalEmail];
      return ok(undefined);
    });
    return { ws, canal, canalDesconectado, canalSemLista, canalEmail };
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

  /** Uma Tarefa conversacional pela api (WhatsApp, Conversa nova), com o id dela e o da Conversa. */
  async function tarefaNova(e: Awaited<ReturnType<typeof espaco>>, contatoId: string, extra: Partial<NovaTarefaConversacional> = {}): Promise<{ taskId: string; conversaId: string }> {
    const criada = valor(await servico.criar(membro(e.ws), entrada(e, contatoId, extra)));
    return { taskId: (criada as unknown as { value: { task: { id: string } } }).value.task.id, conversaId: criada.conversa.id };
  }

  const conversaDaTarefa = async (ws: string, taskId: string): Promise<string | undefined> =>
    (await vinculosDaTarefa(ws, taskId)).find((v) => v.toType === "conversation")?.toId;

  describe("trocarCanal (3.3.5)", () => {
    const COM_EMAIL = [{ tipo: "whatsapp", valor: "+5511955550001" }, { tipo: "email", valor: "marina@exemplo.com" }] as const;

    it("com Mensagem e sem aberta no Canal novo: abre a Conversa de e-mail nas tabelas, o Vínculo passa a ela e a de WhatsApp continua aberta e ativa", async () => {
      const e = await espaco("trocar");
      const marina = await contato(e.ws, "Marina Duarte", COM_EMAIL);
      const { taskId, conversaId: doWhatsapp } = await tarefaNova(e, marina);
      const registros = await conversasEmRegistros(e.ws);

      const r = valor(await servico.trocarCanal(membro(e.ws), taskId, { canalId: e.canalEmail, mensagem: { conteudo: "Escrevo por e-mail também." } }));

      expect(r.conversa.aberta).toBe(true);
      expect(r.conversa.id).not.toBe(doWhatsapp);
      expect((r as unknown as { value: { mudou: boolean } }).value.mudou).toBe(true);
      expect(typeof r.sequencia).toBe("number");
      expect(await conversasNasTabelas(e.ws)).toBe(2);
      expect(await conversasEmRegistros(e.ws)).toBe(registros);
      const nova = await criarRepositorioDeConversasPg(pool()).obter(e.ws, r.conversa.id);
      expect(nova).toMatchObject({ contatoId: marina, canalId: e.canalEmail, situacao: "aberta" });
      expect(await conversaDaTarefa(e.ws, taskId)).toBe(r.conversa.id);
      // Só o Vínculo trocou: o Contato segue ligado, e a Conversa antiga não mudou de situação.
      expect((await vinculosDaTarefa(e.ws, taskId)).filter((v) => v.toType === "conversation")).toHaveLength(1);
      expect(await criarRepositorioDeConversasPg(pool()).obter(e.ws, doWhatsapp)).toMatchObject({ situacao: "aberta", estado: "ativo", canalId: e.canal });
      const { rows } = await pool().query<{ conteudo: string }>("select conteudo from plataforma.mensagens where workspace_id = $1 and conversa_id = $2", [e.ws, r.conversa.id]);
      expect(rows).toEqual([{ conteudo: "Escrevo por e-mail também." }]);
    });

    it("o Contato já tem Conversa aberta no Canal novo: reaproveita, sem Conversa nem Mensagem nova (a Mensagem do corpo é ignorada)", async () => {
      const e = await espaco("trocarreaproveita");
      const marina = await contato(e.ws, "Marina Duarte", COM_EMAIL);
      const doEmail = await conversaAberta(e.ws, e.canalEmail, marina);
      const { taskId } = await tarefaNova(e, marina);
      const conversas = await conversasNasTabelas(e.ws);
      const mensagens = await mensagensNasTabelas(e.ws);

      const r = valor(await servico.trocarCanal(membro(e.ws), taskId, { canalId: e.canalEmail, mensagem: { conteudo: "ignorada" } }));

      expect(r.conversa).toEqual({ id: doEmail, aberta: false });
      expect(await conversaDaTarefa(e.ws, taskId)).toBe(doEmail);
      expect(await conversasNasTabelas(e.ws)).toBe(conversas);
      expect(await mensagensNasTabelas(e.ws)).toBe(mensagens);
    });

    it("sem Conversa aberta no Canal novo e sem Mensagem → 400 VALOR_INVALIDO campo mensagem, e o Vínculo fica como estava (D-07)", async () => {
      const e = await espaco("trocarsemmensagem");
      const marina = await contato(e.ws, "Marina Duarte", COM_EMAIL);
      const { taskId, conversaId } = await tarefaNova(e, marina);
      const conversas = await conversasNasTabelas(e.ws);

      const r = recusado(await servico.trocarCanal(membro(e.ws), taskId, { canalId: e.canalEmail }));
      expect(r).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "mensagem" });
      expect(await conversaDaTarefa(e.ws, taskId)).toBe(conversaId);
      expect(await conversasNasTabelas(e.ws)).toBe(conversas);
    });

    it("Mensagem mal formada → 400 com o campo conteudo, antes de abrir transação", async () => {
      const e = await espaco("trocarmensagemruim");
      const marina = await contato(e.ws, "Marina Duarte", COM_EMAIL);
      const { taskId } = await tarefaNova(e, marina);
      const r = recusado(await servico.trocarCanal(membro(e.ws), taskId, { canalId: e.canalEmail, mensagem: { conteudo: "   " } }));
      expect(r).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "conteudo" });
    });

    it.each([
      ["fora da Lista", "canalSemLista"],
      ["desconectado", "canalDesconectado"],
    ] as const)("Canal %s → 409 RECUSA_DO_DOMINIO campo canal, sem Conversa nem Mensagem nova e com o Vínculo intacto", async (_rotulo, qual) => {
      const e = await espaco("trocarrecusa");
      const marina = await contato(e.ws, "Marina Duarte", COM_EMAIL);
      const { taskId, conversaId } = await tarefaNova(e, marina);
      const conversas = await conversasNasTabelas(e.ws);
      const mensagens = await mensagensNasTabelas(e.ws);

      const r = recusado(await servico.trocarCanal(membro(e.ws), taskId, { canalId: e[qual], mensagem: { conteudo: "Oi" } }));
      expect(r).toMatchObject({ status: 409, codigo: "RECUSA_DO_DOMINIO", campo: "canal" });
      expect(await conversasNasTabelas(e.ws)).toBe(conversas);
      expect(await mensagensNasTabelas(e.ws)).toBe(mensagens);
      expect(await conversaDaTarefa(e.ws, taskId)).toBe(conversaId);
    });

    it("Canal de outro Espaço → 404; Canal arquivado → 409; Contato sem Identificador do tipo do Canal → 409", async () => {
      const e = await espaco("trocarcanais");
      const outro = await espaco("trocarcanaisb");
      const marina = await contato(e.ws, "Marina Duarte", COM_EMAIL);
      const soWhatsapp = await contato(e.ws, "Só WhatsApp");
      const { taskId } = await tarefaNova(e, marina);
      const { taskId: taskSoWhatsapp } = await tarefaNova(e, soWhatsapp);
      const mensagem = { conteudo: "Oi" };

      expect(recusado(await servico.trocarCanal(membro(e.ws), taskId, { canalId: outro.canalEmail, mensagem }))).toMatchObject({ status: 404, codigo: "CANAL_NAO_ENCONTRADO" });
      expect(recusado(await servico.trocarCanal(membro(e.ws), taskSoWhatsapp, { canalId: e.canalEmail, mensagem }))).toMatchObject({ status: 409, codigo: "CONTATO_SEM_IDENTIFICADOR_DO_CANAL" });
      await pool().query("update plataforma.canais set estado = 'arquivado', conexao = 'desconectada', arquivado_em = now() where workspace_id = $1 and id = $2", [e.ws, e.canalEmail]);
      expect(recusado(await servico.trocarCanal(membro(e.ws), taskId, { canalId: e.canalEmail, mensagem }))).toMatchObject({ status: 409, codigo: "CANAL_ARQUIVADO" });
    });

    it("Tarefa inexistente (ou de outro Espaço) → 409 pela operação do domínio; Tarefa sem Vínculo de Contato → 409 \"Esta Tarefa não tem Contato vinculado.\"", async () => {
      const e = await espaco("trocartarefa");
      const outro = await espaco("trocartarefab");
      const marina = await contato(e.ws, "Marina Duarte", COM_EMAIL);
      const { taskId } = await tarefaNova(e, marina);
      const deOutro = await tarefaNova(outro, await contato(outro.ws, "Outro", COM_EMAIL));
      const mensagem = { conteudo: "Oi" };

      expect(recusado(await servico.trocarCanal(membro(e.ws), "tsk_que_nao_existe", { canalId: e.canalEmail, mensagem }))).toMatchObject({ status: 409, codigo: "RECUSA_DO_DOMINIO", error: "Tarefa não encontrada." });
      expect(recusado(await servico.trocarCanal(membro(e.ws), deOutro.taskId, { canalId: e.canalEmail, mensagem }))).toMatchObject({ status: 409, error: "Tarefa não encontrada." });

      await pool().query("delete from plataforma.registros where workspace_id = $1 and colecao = 'links' and dados->>'fromId' = $2 and dados->>'toType' = 'contact'", [e.ws, taskId]);
      expect(recusado(await servico.trocarCanal(membro(e.ws), taskId, { canalId: e.canalEmail, mensagem }))).toMatchObject({ status: 409, error: "Esta Tarefa não tem Contato vinculado." });
      expect(await conversasNasTabelas(e.ws)).toBe(1);
    });

    it("trocar para o Canal da Conversa atual → ok, nada muda (nem Conversa, nem Mensagem, nem Vínculo)", async () => {
      const e = await espaco("trocarigual");
      const marina = await contato(e.ws, "Marina Duarte", COM_EMAIL);
      const { taskId, conversaId } = await tarefaNova(e, marina);
      const vinculos = await vinculosDaTarefa(e.ws, taskId);
      const conversas = await conversasNasTabelas(e.ws);
      const mensagens = await mensagensNasTabelas(e.ws);

      const r = valor(await servico.trocarCanal(membro(e.ws), taskId, { canalId: e.canal }));
      expect(r.conversa).toEqual({ id: conversaId, aberta: false });
      expect((r as unknown as { value: { mudou: boolean } }).value.mudou).toBe(false);
      expect(await conversasNasTabelas(e.ws)).toBe(conversas);
      expect(await mensagensNasTabelas(e.ws)).toBe(mensagens);
      expect(await vinculosDaTarefa(e.ws, taskId)).toEqual(vinculos);
    });

    it("o Contato da Tarefa foi mesclado: a Conversa nova abre para o Contato que ficou, e um Contato arquivado recusa", async () => {
      const e = await espaco("trocarmesclado");
      const sobrevivente = await contato(e.ws, "Sobrevivente", [{ tipo: "whatsapp", valor: "+5511955550009" }, { tipo: "email", valor: "sobrevivente@exemplo.com" }]);
      const absorvido = await contato(e.ws, "Absorvido", COM_EMAIL);
      const arquivado = await contato(e.ws, "Arquivado", [{ tipo: "whatsapp", valor: "+5511955550002" }, { tipo: "email", valor: "arquivado@exemplo.com" }]);
      const { taskId } = await tarefaNova(e, absorvido);
      const { taskId: taskDoArquivado } = await tarefaNova(e, arquivado);
      await poolDoDono().query("update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2", [e.ws, absorvido, sobrevivente]);
      await pool().query("update plataforma.contatos set estado = 'arquivado' where workspace_id = $1 and id = $2", [e.ws, arquivado]);

      const r = valor(await servico.trocarCanal(membro(e.ws), taskId, { canalId: e.canalEmail, mensagem: { conteudo: "Oi" } }));
      expect(await criarRepositorioDeConversasPg(pool()).obter(e.ws, r.conversa.id)).toMatchObject({ contatoId: sobrevivente, canalId: e.canalEmail });

      expect(recusado(await servico.trocarCanal(membro(e.ws), taskDoArquivado, { canalId: e.canalEmail, mensagem: { conteudo: "Oi" } }))).toMatchObject({ status: 409, codigo: "CONTATO_INATIVO" });
    });

    it("Convidado → 403 antes de ler qualquer coisa", async () => {
      const e = await espaco("trocarpapel");
      const marina = await contato(e.ws, "Marina Duarte", COM_EMAIL);
      const { taskId } = await tarefaNova(e, marina);
      const conversas = await conversasNasTabelas(e.ws);
      expect(recusado(await servico.trocarCanal(membro(e.ws, "mem_convidado_teste"), taskId, { canalId: e.canalEmail, mensagem: { conteudo: "Oi" } }))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
      expect(await conversasNasTabelas(e.ws)).toBe(conversas);
    });
  });

  describe("resumo (3.3.3)", () => {
    /** Uma Mensagem na Conversa, na hora dada. `recebida` leva o `id_externo` que a 008 exige; `enviada`, o status. */
    async function mensagem(ws: string, conversaId: string, canalId: string, direcao: "recebida" | "enviada" | "interna", conteudo: string, criadoEm: string): Promise<void> {
      await pool().query(
        `insert into plataforma.mensagens (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, conteudo, status_entrega, id_externo, criado_em)
         values ($1, $2, $3, $4, 'member', $5, $6, $7, $8, $9)`,
        [ws, conversaId, canalId, direcao, SESSAO, conteudo, direcao === "enviada" ? "enviada" : null, direcao === "recebida" ? `ext-${randomUUID()}` : null, criadoEm],
      );
    }

    async function conversa(ws: string, canalId: string, contatoId: string): Promise<string> {
      return (await criarRepositorioDeConversasPg(pool()).inserir(ws, {
        canalId,
        contatoId,
        titulo: "Conversa",
        filaId: null,
        atribuido: { tipo: "membro", id: SESSAO },
        participantes: [],
        criadoPor: { tipo: "member", id: SESSAO },
      })).id;
    }

    const resolver = (ws: string, id: string) =>
      pool().query("update plataforma.conversas set situacao = 'resolvida', resolvida_em = now() where workspace_id = $1 and id = $2", [ws, id]);

    it("50 Vínculos numa consulta só: 50 itens na ordem pedida, com Contato, Canal, última Mensagem e Negócio", async () => {
      const e = await espaco("resumolote");
      const marina = await contato(e.ws, "Marina", [{ tipo: "whatsapp", valor: "+5511911110001" }]);
      const joao = await contato(e.ws, "João", [{ tipo: "whatsapp", valor: "+5511911110002" }]);
      const conversaDaMarina = await conversa(e.ws, e.canal, marina);
      const conversaDoJoao = await conversa(e.ws, e.canal, joao);
      await mensagem(e.ws, conversaDaMarina, e.canal, "recebida", "Oi, quero renovar", "2026-03-01T10:00:00Z");
      await mensagem(e.ws, conversaDoJoao, e.canal, "enviada", "Bom dia, João", "2026-03-02T10:00:00Z");
      const renovacao = await negocio(e.ws, marina, "Renovação 2027");

      const vinculos = Array.from({ length: 50 }, (_, i) =>
        i % 2 === 0
          ? { taskId: `tsk_${i}`, contatoId: marina, conversaId: conversaDaMarina, negocioId: renovacao }
          : { taskId: `tsk_${i}`, contatoId: joao, conversaId: conversaDoJoao },
      );
      let consultas = 0;
      const contado = { query: (...a: unknown[]) => { consultas += 1; return (pool().query as (...x: unknown[]) => unknown)(...a); } } as unknown as Pool;
      const contador = criarServicoDeTarefasConversacionais({ pool: () => contado, acesso: criarAcessoAoCrmPg(pool) });

      const itens = valor(await contador.resumo(membro(e.ws), vinculos));
      expect(consultas).toBe(1);
      expect(itens.map((i) => i.taskId)).toEqual(vinculos.map((v) => v.taskId));
      expect(itens[0]).toEqual({
        taskId: "tsk_0",
        contato: { id: marina, nome: "Marina" },
        canal: { id: e.canal, nome: "Comercial", tipo: "whatsapp", provedor: "whatsapp-cloud", conexao: "conectada" },
        ultimaMensagem: { trecho: "Oi, quero renovar", direcao: "recebida", criadoEm: "2026-03-01T10:00:00.000Z" },
        negocio: { id: renovacao, titulo: "Renovação 2027", etapa: "Início" },
      });
      expect(itens[1]).toMatchObject({
        contato: { id: joao, nome: "João" },
        ultimaMensagem: { trecho: "Bom dia, João", direcao: "enviada" },
        negocio: null,
      });
    });

    it("Contato mesclado em B → o item mostra B (id e nome), com a Mensagem das Conversas de B", async () => {
      const e = await espaco("resumomesclado");
      const b = await contato(e.ws, "Marina Duarte");
      const a = await contato(e.ws, "Marina D.");
      const conversaDeA = await conversa(e.ws, e.canal, a);
      await mensagem(e.ws, conversaDeA, e.canal, "recebida", "Mensagem do absorvido", "2026-03-01T10:00:00Z");
      await poolDoDono().query(
        "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
        [e.ws, a, b],
      );
      await pool().query("update plataforma.conversas set contato_id = $3 where workspace_id = $1 and id = $2", [e.ws, conversaDeA, b]);

      const [item] = valor(await servico.resumo(membro(e.ws), [{ taskId: "t", contatoId: a, conversaId: conversaDeA }]));
      expect(item!.contato).toEqual({ id: b, nome: "Marina Duarte" });
      expect(item!.ultimaMensagem?.trecho).toBe("Mensagem do absorvido");
    });

    it("duas Conversas ativas do Contato no Canal: vale a Mensagem mais recente; interna e Conversa na lixeira não contam", async () => {
      const e = await espaco("resumoultima");
      const marina = await contato(e.ws, "Marina");
      const velha = await conversa(e.ws, e.canal, marina);
      await mensagem(e.ws, velha, e.canal, "recebida", "primeira", "2026-03-01T10:00:00Z");
      await resolver(e.ws, velha);
      const nova = await conversa(e.ws, e.canal, marina);
      await mensagem(e.ws, nova, e.canal, "enviada", "a mais recente", "2026-03-03T10:00:00Z");
      await mensagem(e.ws, nova, e.canal, "interna", "nota interna, depois de todas", "2026-03-09T10:00:00Z");
      const vinculo = { taskId: "t", contatoId: marina, conversaId: nova };

      expect(valor(await servico.resumo(membro(e.ws), [vinculo]))[0]!.ultimaMensagem?.trecho).toBe("a mais recente");

      // Uma terceira, resolvida e na lixeira, com a Mensagem mais nova de todas: não conta.
      // O par só aceita uma aberta (INV-CXE-03): a `nova` é resolvida antes de abrir a próxima.
      await resolver(e.ws, nova);
      const naLixeira = await conversa(e.ws, e.canal, marina);
      await mensagem(e.ws, naLixeira, e.canal, "recebida", "da lixeira, a mais nova", "2026-03-20T10:00:00Z");
      await resolver(e.ws, naLixeira);
      await pool().query("update plataforma.conversas set estado = 'na_lixeira', na_lixeira_em = now() where workspace_id = $1 and id = $2", [e.ws, naLixeira]);
      expect(valor(await servico.resumo(membro(e.ws), [vinculo]))[0]!.ultimaMensagem?.trecho).toBe("a mais recente");
    });

    it("a última Mensagem é a do Canal da Tarefa: a Conversa do mesmo Contato em outro Canal não entra; trecho vai até 140 caracteres", async () => {
      const e = await espaco("resumocanal");
      const marina = await contato(e.ws, "Marina");
      const doCanal = await conversa(e.ws, e.canal, marina);
      const deOutro = await conversa(e.ws, e.canalSemLista, marina);
      await mensagem(e.ws, doCanal, e.canal, "recebida", "x".repeat(300), "2026-03-01T10:00:00Z");
      await mensagem(e.ws, deOutro, e.canalSemLista, "recebida", "em outro canal, mais nova", "2026-03-05T10:00:00Z");

      const [item] = valor(await servico.resumo(membro(e.ws), [{ taskId: "t", contatoId: marina, conversaId: doCanal }]));
      expect(item!.ultimaMensagem?.trecho).toHaveLength(140);
      expect(item!.canal?.id).toBe(e.canal);
    });

    it("Conversa sem Mensagem não tem última Mensagem; Negócio na lixeira não aparece", async () => {
      const e = await espaco("resumovazio");
      const marina = await contato(e.ws, "Marina");
      const vazia = await conversa(e.ws, e.canal, marina);
      const naLixeira = await negocio(e.ws, marina, "Descartado", "na_lixeira");

      const [item] = valor(await servico.resumo(membro(e.ws), [{ taskId: "t", contatoId: marina, conversaId: vazia, negocioId: naLixeira }]));
      expect(item).toMatchObject({ ultimaMensagem: null, negocio: null, contato: { id: marina } });
    });

    it("ids de outro Espaço voltam vazios (não 404, não erro) e não vazam nome, Canal, trecho nem título", async () => {
      const e = await espaco("resumomeu");
      const outro = await espaco("resumooutro");
      const dele = await contato(outro.ws, "Segredo do Outro");
      const conversaDele = await conversa(outro.ws, outro.canal, dele);
      await mensagem(outro.ws, conversaDele, outro.canal, "recebida", "texto privado do outro Espaço", "2026-03-01T10:00:00Z");
      const negocioDele = await negocio(outro.ws, dele, "Negócio privado");

      const itens = valor(await servico.resumo(membro(e.ws), [{ taskId: "t", contatoId: dele, conversaId: conversaDele, negocioId: negocioDele }]));
      expect(itens).toEqual([{ taskId: "t", contato: null, canal: null, ultimaMensagem: null, negocio: null }]);
      expect(JSON.stringify(itens)).not.toMatch(/Segredo|privado|Comercial/);
    });

    it("Vínculos sem Conversa, sem Contato e lote vazio", async () => {
      const e = await espaco("resumoparcial");
      const marina = await contato(e.ws, "Marina");
      const itens = valor(await servico.resumo(membro(e.ws), [{ taskId: "a", contatoId: marina }, { taskId: "b" }]));
      expect(itens).toEqual([
        { taskId: "a", contato: { id: marina, nome: "Marina" }, canal: null, ultimaMensagem: null, negocio: null },
        { taskId: "b", contato: null, canal: null, ultimaMensagem: null, negocio: null },
      ]);
      expect(valor(await servico.resumo(membro(e.ws), []))).toEqual([]);
    });

    it("mais de RESUMO_MAXIMO Vínculos → 400, sem consultar o banco; Convidado lê", async () => {
      const e = await espaco("resumoteto");
      const demais = Array.from({ length: RESUMO_MAXIMO + 1 }, (_, i) => ({ taskId: `t${i}` }));
      expect(recusado(await servico.resumo(membro(e.ws), demais))).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "vinculos" });
      const noLimite = demais.slice(0, RESUMO_MAXIMO);
      expect(valor(await servico.resumo(membro(e.ws, "mem_convidado_teste"), noLimite))).toHaveLength(RESUMO_MAXIMO);
    });
  });
});
