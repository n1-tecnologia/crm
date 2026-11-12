/**
 * `ServicoDaTarefaDaMensagem` (Sessão 5, 5.1.5) contra o Postgres LOCAL: a Mensagem recebida cria a Tarefa do Contato na Lista
 * conversacional que atende pelo Canal, reabre a concluída da mesma Conversa e nunca cria uma segunda. Cada caso tem o seu
 * Espaço: o seed (a Lista `lst_pos_venda` é conversacional) com o Canal marcado nela, e Contato e Conversa pelo repositório,
 * como a Mensagem recebida os deixa.
 *
 *   docker run -d --rm --name crm-n1-pg-s5 -e POSTGRES_PASSWORD=x -p 55750:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55750/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55750/postgres \
 *     npx vitest run src/servicos/crm/tarefa-da-mensagem.test.ts
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { ok } from "@n1/dominio/state";
import { changeTaskStatus } from "@n1/dominio/operations";
import { encerrar, pool } from "../../persistencia/conexao";
import { semear } from "../../persistencia/repositorio";
import { executar } from "../../persistencia/unidade-de-trabalho";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../../testes/banco-crm";
import { criarServicoDaTarefaDaMensagem } from "./tarefa-da-mensagem";

const LISTA = "lst_pos_venda";
const DONA = "mem_thiago";
const servico = criarServicoDaTarefaDaMensagem({ pool });

interface LinhaDeTarefa {
  readonly id: string;
  readonly titulo: string;
  readonly statusId: string;
  readonly assignees: readonly { kind: string; id: string }[];
  readonly createdBy: { kind: string; id: string };
}

describeComBanco("ServicoDaTarefaDaMensagem — Postgres local", () => {
  const espacos: string[] = [];

  /** Um Espaço novo com o seed, a Lista conversacional atendendo por `canal` e `canalSemLista` fora dela. */
  async function espaco(rotulo: string) {
    await prepararBancoCrm();
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    const cliente = await pool().connect();
    try {
      await semear(cliente, ws, buildSeed());
    } finally {
      cliente.release();
    }
    const canal = await semearCanal(ws, { nome: "Comercial", tipo: "whatsapp", provedor: "whatsapp-nao-oficial", identificadorExterno: "+5511977770001", conexao: "conectada" });
    const canalSemLista = await semearCanal(ws, { nome: "Suporte", tipo: "whatsapp", provedor: "whatsapp-nao-oficial", identificadorExterno: "+5511977770003", conexao: "conectada" });
    await executar(ws, (state) => {
      const lista = state.lists.find((l) => l.id === LISTA);
      if (!lista) throw new Error("o seed precisa de lst_pos_venda");
      lista.canaisDeAtendimento = [canal];
      return ok(undefined);
    });
    return { ws, canal, canalSemLista };
  }

  async function contato(ws: string, nome: string, numero: string): Promise<string> {
    const repositorio = criarRepositorioDeContatosPg(pool());
    const criado = await repositorio.inserir(ws, { nome, proprietarioId: DONA, criadoPor: DONA });
    await repositorio.inserirIdentificador(ws, criado.id, { tipo: "whatsapp", valor: numero, principal: true });
    return criado.id;
  }

  async function conversa(ws: string, canalId: string, contatoId: string, atribuidoA?: string): Promise<string> {
    const criada = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
      canalId,
      contatoId,
      titulo: "Conversa",
      filaId: null,
      atribuido: atribuidoA ? { tipo: "membro", id: atribuidoA } : null,
      participantes: [],
      criadoPor: { tipo: "integration", id: canalId },
    });
    return criada.id;
  }

  const tarefas = async (ws: string): Promise<LinhaDeTarefa[]> => {
    const { rows } = await pool().query<{ dados: { id: string; title: string; statusId: string; assignees: LinhaDeTarefa["assignees"]; createdBy: LinhaDeTarefa["createdBy"] } }>(
      "select dados from plataforma.registros where workspace_id = $1 and colecao = 'tasks' and dados->>'listId' = $2 order by dados->>'createdAt', id",
      [ws, LISTA],
    );
    // As Tarefas do seed já moram na Lista e apontam para Contatos do demo: o teste só conta as dos Contatos que ele criou.
    const doTeste = await pool().query<{ from_id: string }>(
      `select l.dados->>'fromId' as from_id
         from plataforma.registros l
         join plataforma.contatos c on c.workspace_id = l.workspace_id and c.id::text = l.dados->>'toId'
        where l.workspace_id = $1 and l.colecao = 'links' and l.dados->>'toType' = 'contact'`,
      [ws],
    );
    const ids = new Set(doTeste.rows.map((r) => r.from_id));
    return rows.filter((r) => ids.has(r.dados.id)).map((r) => ({ id: r.dados.id, titulo: r.dados.title, statusId: r.dados.statusId, assignees: r.dados.assignees, createdBy: r.dados.createdBy }));
  };

  const revisao = async (ws: string): Promise<number> => Number((await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [ws])).rows[0]!.revisao);

  const vinculos = async (ws: string, taskId: string) =>
    (
      await pool().query<{ dados: { toType: string; toId: string; role: string; createdBy: { kind: string; id: string } } }>(
        "select dados from plataforma.registros where workspace_id = $1 and colecao = 'links' and dados->>'fromId' = $2",
        [ws, taskId],
      )
    ).rows.map((r) => r.dados);

  async function concluir(ws: string, taskId: string): Promise<string> {
    let inicial = "";
    await executar(ws, (state) => {
      inicial = state.tasks.find((t) => t.id === taskId)!.statusId;
      const concluido = state.lists.find((l) => l.id === LISTA)!.statusSet!.definitions.find((d) => d.category === "concluido")!;
      return changeTaskStatus(state, DONA, taskId, concluido.id);
    });
    return inicial;
  }

  /** Escuta os avisos de tempo real (`pg_notify('crm_eventos')`) deste Espaço enquanto `corpo` roda; o Postgres só os entrega no commit. */
  async function avisosDurante(ws: string, corpo: () => Promise<void>): Promise<Array<{ tipo: string; conversaId?: string }>> {
    const ouvinte = await pool().connect();
    const recebidos: Array<{ workspaceId: string; tipo: string; conversaId?: string }> = [];
    ouvinte.on("notification", (n) => {
      if (n.payload) recebidos.push(JSON.parse(n.payload) as (typeof recebidos)[number]);
    });
    try {
      await ouvinte.query("listen crm_eventos");
      await corpo();
      // O NOTIFY chega ao ouvinte por uma conexão à parte: um ida e volta a mais dá tempo de ele ser lido.
      await ouvinte.query("select 1");
      return recebidos.filter((a) => a.workspaceId === ws);
    } finally {
      await ouvinte.query("unlisten crm_eventos").catch(() => undefined);
      ouvinte.release();
    }
  }

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  it("Canal que nenhuma Lista conversacional atende: nada é lido nem gravado, e a revisão do Espaço não sobe", async () => {
    const { ws, canalSemLista } = await espaco("tmsemlista");
    const c = await contato(ws, "Ana Souza", "+5511987654321");
    const v = await conversa(ws, canalSemLista, c);
    const antes = await revisao(ws);
    expect(await servico.aplicar({ workspaceId: ws, canalId: canalSemLista, contatoId: c, conversaId: v })).toEqual({ tipo: "sem_lista" });
    expect(await tarefas(ws)).toEqual([]);
    expect(await revisao(ws)).toBe(antes);
  });

  it("a primeira Mensagem de um Contato cria a Tarefa na Lista do Canal: nome do Contato, Vínculos, sem responsável, assinada pelo Canal", async () => {
    const { ws, canal } = await espaco("tmcria");
    const c = await contato(ws, "Ana Souza", "+5511987654321");
    const v = await conversa(ws, canal, c);
    const antes = await revisao(ws);

    let desfecho: Awaited<ReturnType<typeof servico.aplicar>> | undefined;
    const avisos = await avisosDurante(ws, async () => {
      desfecho = await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: v });
    });
    expect(desfecho!.tipo).toBe("criada");
    // A tela confere a revisão do Espaço quando recebe isto: o aviso leva só o tipo e a Conversa.
    expect(avisos).toEqual([{ workspaceId: ws, tipo: "conversa.mudou", conversaId: v }]);

    const [tarefa, ...resto] = await tarefas(ws);
    expect(resto).toEqual([]);
    expect(tarefa).toMatchObject({ titulo: "Ana Souza", assignees: [], createdBy: { kind: "system", id: `mensagem:${canal}` } });
    expect((desfecho as { taskId: string }).taskId).toBe(tarefa!.id);
    const links = await vinculos(ws, tarefa!.id);
    expect(links.map((l) => [l.toType, l.toId, l.role]).sort()).toEqual(
      [
        ["contact", c, "contato da Tarefa"],
        ["conversation", v, "conversa da Tarefa"],
      ].sort(),
    );
    for (const l of links) expect(l.createdBy).toEqual({ kind: "system", id: `mensagem:${canal}` });
    expect(await revisao(ws)).toBeGreaterThan(antes);
  });

  it("a segunda Mensagem do mesmo Contato não cria outra Tarefa e não sobe a revisão (repetir o passo é seguro)", async () => {
    const { ws, canal } = await espaco("tmsegunda");
    const c = await contato(ws, "Ana Souza", "+5511987654321");
    const v = await conversa(ws, canal, c);
    expect((await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: v })).tipo).toBe("criada");
    const antes = await revisao(ws);

    const avisos = await avisosDurante(ws, async () => {
      expect(await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: v })).toEqual({ tipo: "nada" });
    });
    expect(avisos).toEqual([]);
    expect(await tarefas(ws)).toHaveLength(1);
    expect(await revisao(ws)).toBe(antes);
  });

  it("o atribuído da Conversa vira o responsável da Tarefa nova", async () => {
    const { ws, canal } = await espaco("tmresponsavel");
    const c = await contato(ws, "Bia Lima", "+5511987654322");
    const v = await conversa(ws, canal, c, "mem_maryane");
    expect((await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: v })).tipo).toBe("criada");
    const [tarefa] = await tarefas(ws);
    expect(tarefa!.assignees).toEqual([{ kind: "member", id: "mem_maryane" }]);
  });

  it("Tarefa concluída e a mesma Conversa: reabre, no Status inicial; Conversa nova: Tarefa nova, e a concluída fica", async () => {
    const { ws, canal } = await espaco("tmreabre");
    const c = await contato(ws, "Caio Dias", "+5511987654323");
    const v = await conversa(ws, canal, c);
    expect((await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: v })).tipo).toBe("criada");
    const [primeira] = await tarefas(ws);
    const inicial = await concluir(ws, primeira!.id);
    expect((await tarefas(ws))[0]!.statusId).not.toBe(inicial);

    const reaberta = await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: v });
    expect(reaberta).toEqual({ tipo: "reaberta", taskId: primeira!.id });
    expect((await tarefas(ws))[0]!.statusId).toBe(inicial);

    // Conclui de novo; agora a Conversa é outra (a anterior foi resolvida e passou da janela).
    await concluir(ws, primeira!.id);
    await pool().query("update plataforma.conversas set situacao = 'resolvida', resolvida_em = now() where workspace_id = $1 and id = $2", [ws, v]);
    const v2 = await conversa(ws, canal, c);
    expect((await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: v2 })).tipo).toBe("criada");
    const todas = await tarefas(ws);
    expect(todas).toHaveLength(2);
    expect(todas.map((t) => t.id)).toContain(primeira!.id);
  });

  it("Contato arquivado, ou Conversa de outro Contato: a Tarefa não nasce e o passo diz por quê", async () => {
    const { ws, canal } = await espaco("tmpula");
    const c = await contato(ws, "Duda Reis", "+5511987654324");
    const outro = await contato(ws, "Edu Lopes", "+5511987654325");
    const v = await conversa(ws, canal, outro);
    expect(await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: v })).toEqual({ tipo: "pulada", motivo: "conversa_fora_do_par" });

    const vc = await conversa(ws, canal, c);
    await pool().query("update plataforma.contatos set estado = 'arquivado' where workspace_id = $1 and id = $2", [ws, c]);
    expect(await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: vc })).toEqual({ tipo: "pulada", motivo: "contato_nao_ativo" });
    expect(await tarefas(ws)).toEqual([]);
  });

  it("ninguém que possa escrever na Lista: pulada, sem Tarefa", async () => {
    const { ws, canal } = await espaco("tmsemautorizador");
    await executar(ws, (state) => {
      for (const m of state.members) m.state = "suspenso";
      return ok(undefined);
    });
    const c = await contato(ws, "Fabi Melo", "+5511987654326");
    const v = await conversa(ws, canal, c);
    expect(await servico.aplicar({ workspaceId: ws, canalId: canal, contatoId: c, conversaId: v })).toEqual({ tipo: "pulada", motivo: "sem_autorizador" });
    expect(await tarefas(ws)).toEqual([]);
  });
});
