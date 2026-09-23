/**
 * PAG-05, critério 5: o fechamento em lote das contas, contra o Postgres
 * real — o item da Wave 0 de `03-VALIDATION.md` que mede o tempo de lock por
 * Espaço (DEC-06). Molde de `criar-conta.test.ts`: `carregarEnv()`,
 * `temBanco`, `describe.skip` sem `DATABASE_URL`, `appDeTeste()` com
 * `verificarToken` por apelido.
 *
 * **Duas identidades.** `maryane` resolve para `CP.financeiroId` (o
 * Financeiro); `aprovador` para `CP.aprovadorId`. O gesto de lote do
 * Financeiro é a movimentação até "em autorização bancária"; quem entra em
 * "pago" é o Aprovador — `CP.status.pago` tem `entryAllowedMemberIds` e
 * RN-CP-04 é explícita. O critério 5 do ROADMAP diz "o Financeiro fecha 61
 * contas", mas a leitura literal manda para o ator errado: este cenário fecha
 * com o Aprovador, como o domínio exige.
 *
 * **Espaço próprio, limpeza em duas linhas.** `ws_lote_teste` (a constante
 * `WS` abaixo) nasce por `bootstrapGestao()` no `beforeAll` e morre nos dois
 * `delete` do `afterAll` — nenhuma linha das 61 contas + 61 ocorrências é
 * limpa uma a uma. O Espaço de produção da plataforma não é tocado em
 * nenhum momento neste arquivo, nem para ler.
 *
 * **O Aprovador não nasce do bootstrap de produção.** `buildGestaoBootstrap`
 * grava só a Maryane (Proprietária); `gr_cp_aprovador` — a concessão que dá
 * ao Aprovador acesso de escrita à Lista — só existe com `fixtures: true`
 * (D-08: o Aprovador entra por convite em produção). `garantirAprovador()`
 * grava os dois (Membro + concessão) uma vez, no molde da fixture que
 * `conversao-de-solicitacao.test.ts` já usa para o mesmo motivo.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ok, usuarioDoSeed, type DataState, type OperationResult } from "@n1/dominio";
import { setRecurrence } from "@n1/dominio/operations/collaboration";
import { CP } from "@n1/dominio/operations/financeiro";
import { createTask } from "@n1/dominio/operations/tasks";
import { buildApp } from "../app";
import { bootstrapGestao } from "../bootstrap/gestao";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { membroPorUsuario } from "../persistencia/membros";
import { executar } from "../persistencia/unidade-de-trabalho";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const WS = "ws_lote_teste";
const AUTH_MARYANE = { authorization: "Bearer maryane" };
const AUTH_APROVADOR = { authorization: "Bearer aprovador" };

/** Um `buildApp()` por chamada — cada `.inject()` é outra "requisição de casca". */
function appDeTeste() {
  return buildApp({
    logger: false,
    workspaceId: WS,
    verificarToken: async (token) =>
      token === "maryane"
        ? { sub: usuarioDoSeed(CP.financeiroId) }
        : token === "aprovador"
          ? { sub: usuarioDoSeed(CP.aprovadorId) }
          : null,
    resolverMembro: membroPorUsuario,
  });
}

async function revisaoDoWorkspace(): Promise<number> {
  const cliente = await pool().connect();
  try {
    const { rows } = await cliente.query<{ revisao: number }>(
      "select revisao from plataforma.workspaces where workspace_id = $1",
      [WS],
    );
    return Number(rows[0]?.revisao ?? -1);
  } finally {
    cliente.release();
  }
}

/**
 * O Aprovador (RN-CP-04) — o bootstrap de produção só grava a Maryane. Grava
 * o Membro e a concessão de escrita à Lista (`gr_cp_aprovador` de
 * `seed-financeiro.ts`, fixture-only) uma vez, idempotente contra reexecução.
 */
async function garantirAprovador(): Promise<void> {
  await executar(WS, (state: DataState): OperationResult<void> => {
    if (state.members.some((m) => m.id === CP.aprovadorId)) return ok(undefined);
    const agora = new Date().toISOString();
    state.members.push({
      id: CP.aprovadorId,
      workspaceId: WS,
      userId: usuarioDoSeed(CP.aprovadorId),
      displayName: "Marcos Paulo",
      state: "ativo",
      roleId: "role_mem",
      joinedAt: agora,
      availability: { value: "disponivel", at: agora, origin: "membro" },
      userMemory: { enabled: true, items: [] },
    });
    state.grants.push({
      id: "gr_teste_lote_aprovador",
      workspaceId: WS,
      subjectKind: "member",
      subjectId: CP.aprovadorId,
      action: "editar",
      resourceType: "list",
      resourceId: CP.listId,
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: CP.financeiroId,
      grantedAt: agora,
    });
    return ok(undefined);
  });
}

/**
 * `n` contas recorrentes já em `statusId` (padrão "em autorização
 * bancária"), numa transação só — 122 contas em duas chamadas de
 * `executar()`, não em 122 requisições: a semeadura não é o que este arquivo
 * mede. Import cru de `tasks.ts`/`collaboration.ts` (não do barril
 * instrumentado de `operations/index.ts`).
 */
async function semear(n: number, prefixo: string, statusId: string = CP.status.emAutorizacao): Promise<string[]> {
  const resultado = await executar(WS, (state: DataState): OperationResult<string[]> => {
    const ids: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const criado = createTask(
        state,
        CP.financeiroId,
        {
          listId: CP.listId,
          title: `${prefixo} ${i + 1}`,
          statusId,
          taskTypeId: CP.taskTypeId,
          dueDate: { form: "civilDay", value: "2026-09-04" },
        },
        { runAutomations: false },
      );
      if (!criado.ok) return criado;
      const regra = setRecurrence(state, CP.financeiroId, criado.value.id, {
        frequency: "mensal",
        interval: 1,
        triggerMode: "aoConcluir",
        businessDays: "anterior",
        copies: { checklists: false, subtasks: false, assignees: false, fieldValues: true },
      });
      if (!regra.ok) return regra;
      ids.push(criado.value.id);
    }
    return ok(ids);
  });
  if (!resultado.ok) throw new Error(`falha ao semear "${prefixo}": ${resultado.error}`);
  return resultado.value;
}

d("PAG-05, critério 5: 61 contas fecham num só gesto — uma transação, revisão +1, tempo de lock medido contra DEC-06", () => {
  let idsPrincipais: string[] = [];

  // ws_lote_teste nasce vazio aqui — os dois `delete` abaixo garantem isso
  // mesmo depois de uma execução anterior interrompida.
  beforeAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
      const resultado = await bootstrapGestao(cliente, { workspaceId: WS });
      expect(resultado.criado, resultado.motivo ?? "bootstrap deveria criar em Espaço vazio").toBe(true);
    } finally {
      cliente.release();
    }
    await garantirAprovador();
  });

  // ws_lote_teste morre aqui — dois `delete`, nenhuma linha das 61 contas +
  // 61 ocorrências (nem das medições da Task 3) apagada uma a uma.
  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  it("(a) uma transação por gesto — 200, alteradas:61, ocorrenciasCriadas:61, revisão avança exatamente 1", async () => {
    idsPrincipais = await semear(61, "Conta em lote");
    const revisaoAntes = await revisaoDoWorkspace();

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/alterarStatusEmLote",
      headers: AUTH_APROVADOR,
      payload: { args: [idsPrincipais, CP.status.pago] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.value.alteradas).toBe(61);
    expect(corpo.value.ocorrenciasCriadas).toBe(61);

    const revisaoDepois = await revisaoDoWorkspace();
    expect(revisaoDepois - revisaoAntes).toBe(1);
  });

  it("(b) o que foi para o banco é o que o relatório diz — 61 ocorrências novas, as 61 origens em pago sem recorrência", async () => {
    const resposta = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH_MARYANE });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    const daLista = (corpo.data.tasks as Array<{ id: string; listId: string; statusId: string; recurrence?: unknown; provenance?: { kind: string; sourceId: string } }>).filter(
      (t) => t.listId === CP.listId,
    );

    const origens = daLista.filter((t) => idsPrincipais.includes(t.id));
    expect(origens).toHaveLength(61);
    expect(origens.every((t) => t.statusId === CP.status.pago)).toBe(true);
    expect(origens.every((t) => t.recurrence === undefined)).toBe(true);

    const novas = daLista.filter((t) => t.provenance?.kind === "recurrence" && idsPrincipais.includes(t.provenance.sourceId));
    expect(novas).toHaveLength(61);
  });

  it("(c) reexecução no-op — alteradas:0, jaEstavam:61, contagem de Tarefas idêntica, revisão avança 1 e só 1", async () => {
    const estadoAntes = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH_MARYANE });
    const tasksAntes = (estadoAntes.json().data.tasks as Array<{ listId: string }>).filter((t) => t.listId === CP.listId).length;
    const revisaoAntes = await revisaoDoWorkspace();

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/alterarStatusEmLote",
      headers: AUTH_APROVADOR,
      payload: { args: [idsPrincipais, CP.status.pago] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.value.alteradas).toBe(0);
    expect(corpo.value.jaEstavam).toBe(61);
    expect(corpo.value.ocorrenciasCriadas).toBe(0);

    // A diferença declarada em relação a 03-10: a barreira daqui
    // (`task.statusId`) só existe no estado hidratado, então o no-op AINDA
    // abre transação e avança `revisao` em 1 — e só 1.
    const revisaoDepois = await revisaoDoWorkspace();
    expect(revisaoDepois - revisaoAntes).toBe(1);

    const estadoDepois = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH_MARYANE });
    const tasksDepois = (estadoDepois.json().data.tasks as Array<{ listId: string }>).filter((t) => t.listId === CP.listId).length;
    expect(tasksDepois).toBe(tasksAntes);
  });

  it("(d) o piso e o teto do lock (DEC-06) — tLote custa uma hidratação, tN custa 61", async () => {
    // t1 — a escrita mais barata possível no mesmo Espaço: um `updateTask`
    // numa única Tarefa (uma hidratação, um diff de uma linha).
    const [alvoUnico] = await semear(1, "Conta para medir t1");
    const inicioT1 = performance.now();
    const respostaT1 = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: AUTH_MARYANE,
      payload: { args: [alvoUnico, { title: "Conta para medir t1 (atualizada)" }] },
    });
    const t1 = performance.now() - inicioT1;
    expect(respostaT1.statusCode).toBe(200);
    expect(respostaT1.json().ok).toBe(true);

    // tLote — o lote de 61, sobre um conjunto NOVO (o primeiro já está em
    // "pago": medir `jaEstava` mediria o caminho mais barato, não o do gesto real).
    const idsParaLote = await semear(61, "Conta para medir tLote");
    const inicioLote = performance.now();
    const respostaLote = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/alterarStatusEmLote",
      headers: AUTH_APROVADOR,
      payload: { args: [idsParaLote, CP.status.pago] },
    });
    const tLote = performance.now() - inicioLote;
    expect(respostaLote.statusCode).toBe(200);
    expect(respostaLote.json().ok).toBe(true);

    // tN — 61 `POST /operacoes/changeTaskStatus` individuais, sobre um
    // segundo conjunto equivalente: 61 hidratações em vez de uma.
    const idsIndividuais = await semear(61, "Conta para medir tN");
    const inicioN = performance.now();
    for (const id of idsIndividuais) {
      const resposta = await appDeTeste().inject({
        method: "POST",
        url: "/operacoes/changeTaskStatus",
        headers: AUTH_APROVADOR,
        payload: { args: [id, CP.status.pago] },
      });
      expect(resposta.statusCode).toBe(200);
      expect(resposta.json().ok).toBe(true);
    }
    const tN = performance.now() - inicioN;

    // eslint-disable-next-line no-console -- linha que o operador da Task 4 cola no SUMMARY.
    console.log(`[lote] t1=${t1.toFixed(1)}ms · tLote=${tLote.toFixed(1)}ms · tN=${tN.toFixed(1)}ms · tN/tLote=${(tN / tLote).toFixed(2)}`);

    // O lote custa uma hidratação mais o diff, não uma campanha — relativo ao
    // piso do próprio Espaço, nunca um teto absoluto em milissegundos.
    expect(tLote).toBeLessThan(3 * t1 + 1000);
    expect(tN).toBeGreaterThan(3 * tLote);
  });

  it("(e) falha parcial atravessa o HTTP como valor — 200 (não 4xx), as 4 boas ficam no banco", async () => {
    const ids = await semear(5, "Conta para medir falha parcial");
    const incompleta = ids[0]!;

    const paraParaPagar = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/changeTaskStatus",
      headers: AUTH_MARYANE,
      payload: { args: [incompleta, CP.status.paraPagar] },
    });
    expect(paraParaPagar.statusCode).toBe(200);
    expect(paraParaPagar.json().ok).toBe(true);

    // Centro de Custo presente (o único sempre obrigatório), Valor e Forma
    // de pagamento ausentes — a mesma lacuna do caso (d) do domínio.
    const comCentro = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/setTaskFieldValue",
      headers: AUTH_MARYANE,
      payload: { args: [incompleta, CP.fields.centroDeCusto, "TRIA"] },
    });
    expect(comCentro.statusCode).toBe(200);
    expect(comCentro.json().ok).toBe(true);

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/alterarStatusEmLote",
      headers: AUTH_APROVADOR,
      payload: { args: [ids, CP.status.pago] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.value.alteradas).toBe(4);
    expect(corpo.value.recusadas).toBe(1);

    const estado = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH_MARYANE });
    const pagas = (estado.json().data.tasks as Array<{ id: string; statusId: string }>).filter(
      (t) => ids.includes(t.id) && t.statusId === CP.status.pago,
    );
    expect(pagas).toHaveLength(4);
  });

  it("(f) gesto malformado é 200 com ok:false, não 500 — revisão inalterada (rollback numa transação que não escreveu)", async () => {
    const revisaoAntes = await revisaoDoWorkspace();
    const idsFalsos = Array.from({ length: 201 }, (_, i) => `tsk_falso_${i}`);

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/alterarStatusEmLote",
      headers: AUTH_APROVADOR,
      payload: { args: [idsFalsos, CP.status.pago] },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ok).toBe(false);

    const revisaoDepois = await revisaoDoWorkspace();
    expect(revisaoDepois).toBe(revisaoAntes);
  });
});
