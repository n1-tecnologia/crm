/**
 * O critério 1 do ROADMAP, ponta a ponta, sem navegador (ver `CONTEXT.md`
 * desta pasta): um Espaço "Gestão" bootstrapado, a Maryane (Membro real,
 * resolvida pelo `sub` do token — nunca por um id que o corpo mande) cria
 * uma Conta a pagar por `POST /operacoes/createTask`, e ao "recarregar a
 * página" (um `buildApp()` novo, simulando outra requisição de casca) a
 * Conta continua lá. Fecha a lacuna que `STATE.md`/`CONCERNS.md` apontavam:
 * "sem teste ponta a ponta tela → Postgres; resolução de sessão → Membro".
 *
 * `it`s sequenciais, no mesmo `describe`, compartilhando estado — é um
 * cenário, não uma bateria de casos independentes. Precisa de
 * `DATABASE_URL`; sem ele, pula inteiro (D-DEC-09).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aplicarDiferenca, usuarioDoSeed, type DataState, type Diferenca, type Ordens } from "@n1/dominio";
import { CP } from "@n1/dominio/operations";
import { resetIdSequence } from "@n1/dominio/operations/activity";
import { buildApp } from "../app";
import { bootstrapGestao } from "../bootstrap/gestao";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { membroPorUsuario } from "../persistencia/membros";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const WS = "ws_e2e_teste";
const AUTH = { authorization: "Bearer maryane" };

/** Um `buildApp()` por chamada — cada `.inject()` é literalmente "outra requisição de casca", a mesma coisa que um F5 dispara do lado do servidor. */
function appDeTeste() {
  return buildApp({
    logger: false,
    workspaceId: WS,
    verificarToken: async (token) =>
      token === "maryane"
        ? { sub: usuarioDoSeed("mem_maryane") }
        : token === "estranho"
          ? { sub: "00000000-0000-0000-0000-000000000000" }
          : null,
    resolverMembro: membroPorUsuario,
  });
}

d("Critério 1 do ROADMAP: Membro real cria uma Conta pela API e ela continua lá", () => {
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
  });

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

  let revisao0: number;
  let tarefaId: string;
  let estadoRecarga: { data: unknown; ordens: Ordens };
  let diferencaSegundoProcesso: Diferenca;

  it("(1) sessão → Membro pela API: o Espaço bootstrapado está vazio de Tarefas", async () => {
    const resposta = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();

    expect(corpo.sessao.memberId).toBe("mem_maryane");
    expect(corpo.data.members.length).toBe(1);
    expect(corpo.data.tasks.length).toBe(0);
    expect(corpo.data.lists.some((l: { id: string }) => l.id === CP.listId)).toBe(true);

    revisao0 = corpo.revisao;
  });

  it("(2) quem não é Membro deste Espaço vê 403", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/estado",
      headers: { authorization: "Bearer estranho" },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it("(3) a Maryane cria a Conta pela API", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: AUTH,
      payload: { args: [{ listId: CP.listId, title: "Aluguel de setembro" }], revisao: revisao0 },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();

    expect(corpo.ok).toBe(true);
    expect(corpo.value.title).toBe("Aluguel de setembro");
    expect(corpo.revisaoAnterior).toBe(revisao0);
    expect(corpo.revisao).toBe(revisao0 + 1);
    expect(
      corpo.diferenca.gravados.some(
        (g: { colecao: string; id: string }) => g.colecao === "tasks" && g.id === corpo.value.id,
      ),
    ).toBe(true);
    expect(corpo.diferenca.gravados.some((g: { colecao: string }) => g.colecao === "activity")).toBe(true);

    tarefaId = corpo.value.id;
  });

  it('(4) "recarregar a página": um app novo ainda vê a Conta — ela persistiu', async () => {
    const resposta = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();

    expect(corpo.data.tasks.length).toBe(1);
    expect(corpo.data.tasks[0].id).toBe(tarefaId);
    expect(corpo.data.tasks[0].statusId).toBe(CP.status.paraPagar);
    expect(corpo.revisao).toBe(revisao0 + 1);
    expect(typeof corpo.ordens.tasks[tarefaId]).toBe("number");

    estadoRecarga = { data: corpo.data, ordens: corpo.ordens };
  });

  it("(5) a recusa do domínio (RN-CP-04) chega pela rota em 200 e não altera nada", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/changeTaskStatus",
      headers: AUTH,
      payload: { args: [tarefaId, CP.status.pago] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();

    expect(corpo.ok).toBe(false);
    expect(typeof corpo.error).toBe("string");
    expect(corpo.error.length).toBeGreaterThan(0);
    expect(corpo.diferenca.gravados.length).toBe(0);
    expect(corpo.revisao).toBe(corpo.revisaoAnterior);

    const conferencia = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH });
    expect(conferencia.json().revisao).toBe(revisao0 + 1);
  });

  it("(6) um segundo processo (contador de ids zerado) cria outra Conta sem colidir", async () => {
    // Simula um `apps/api` recém-subido: o contador de módulo deste
    // processo de teste volta a zero. `executar()` sincroniza de novo a
    // partir do estado hidratado (Plan 01-04) — é essa sincronização que
    // este passo prova, não o `resetIdSequence` em si.
    resetIdSequence(0);

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: AUTH,
      payload: { args: [{ listId: CP.listId, title: "Internet de setembro" }] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();

    expect(corpo.ok).toBe(true);
    expect(corpo.value.id).not.toBe(tarefaId);
    diferencaSegundoProcesso = corpo.diferenca;

    const conferencia = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH });
    const corpoConferencia = conferencia.json();

    expect(corpoConferencia.data.tasks.length).toBe(2);
    const idsDeTasks = new Set(corpoConferencia.data.tasks.map((t: { id: string }) => t.id));
    expect(idsDeTasks.size).toBe(2);

    expect(corpoConferencia.data.activity.length).toBeGreaterThanOrEqual(2);
    const idsDeActivity = new Set(corpoConferencia.data.activity.map((a: { id: string }) => a.id));
    expect(idsDeActivity.size).toBe(corpoConferencia.data.activity.length);
  });

  it("(7) o diff aplicado no cliente ≡ a re-hidratação — D-03/D-05 fechados de ponta a ponta", async () => {
    // Parte do estado que o passo (4) já tinha ("a página antes de recarregar
    // de novo") e aplica só o diff do passo (6) por cima — exatamente o que
    // `apps/web/src/dados/store.ts` faz a cada `POST` bem-sucedido, nunca
    // re-hidratando o Espaço inteiro.
    const state = structuredClone(estadoRecarga.data) as unknown as DataState;
    const ordens = structuredClone(estadoRecarga.ordens);
    aplicarDiferenca(state, ordens, diferencaSegundoProcesso);

    const resposta = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH });
    const corpo = resposta.json();

    expect(state.tasks).toStrictEqual(corpo.data.tasks);
  });

  it("(8) sem token responde 401 — nada é gravado", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      payload: { args: [{ listId: CP.listId, title: "Não deveria gravar" }] },
    });
    expect(resposta.statusCode).toBe(401);

    const conferencia = await appDeTeste().inject({ method: "GET", url: "/estado", headers: AUTH });
    expect(conferencia.json().data.tasks.length).toBe(2);
  });
});
