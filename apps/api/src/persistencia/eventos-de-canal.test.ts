/**
 * `eventos-de-canal.ts` — unitário, sem Postgres: `execucoesNovas` isolando
 * o que nasceu na transação, e `eventosDeNotificacaoPorCanal` traduzindo o
 * pedido pobre do domínio no `EventoDeSaida` do tipo
 * `automacao.notificar-canal.v1`. Mesmo molde de
 * `packages/dominio/src/operations/automations-canal.test.ts`: Automação de
 * Canal publicada ANTES da Tarefa, disparo manual via `runListAutomations`.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio";
import type { Automation, AutomationAction, AutomationTrigger, AutomationVersion, Id, Integration, Task } from "@n1/dominio";
import { CP } from "@n1/dominio/operations/financeiro";
import { createTask, setTaskFieldValue } from "@n1/dominio/operations/tasks";
import { runListAutomations } from "@n1/dominio/operations/automations";
import { EVENTOS } from "./outbox";
import { eventosDeNotificacaoPorCanal, execucoesNovas } from "./eventos-de-canal";

const DONO = CP.financeiroId;
const CARIMBO = "2026-01-01T12:00:00.000Z";

function publicarCanal(state: DataState, id: Id, params: object): Automation {
  const trigger: AutomationTrigger = { kind: "evento", eventType: "tarefaCriada" };
  const action: AutomationAction = { order: 1, kind: "controle", controlKind: "notificar", params: JSON.stringify(params) };
  const version: AutomationVersion = {
    number: 1,
    state: "publicada",
    trigger,
    conditions: [],
    actions: [action],
    errorPolicy: { onActionFailure: "interromper", retries: 0 },
    publishedBy: DONO,
    publishedAt: CARIMBO,
    createdAt: CARIMBO,
  };
  const automation: Automation = {
    id,
    workspaceId: state.workspace.id,
    createdBy: { kind: "member", id: DONO },
    createdAt: CARIMBO,
    lifecycle: "ativo",
    name: id,
    description: id,
    scopeType: "list",
    scopeId: CP.listId,
    ownerMemberId: DONO,
    reactsToAutomationEvents: false,
    versions: [version],
  };
  state.automations.push(automation);
  return automation;
}

function novaConta(state: DataState): Task {
  const r = createTask(state, DONO, { listId: CP.listId, title: "Conta de teste (05-07)" }, { runAutomations: false });
  if (!r.ok) throw new Error(`fixture: ${r.error}`);
  return r.value;
}

const integracaoMarcosPaulo = (state: DataState): Integration => ({
  id: "int_teste_marcos_paulo_05_07",
  workspaceId: state.workspace.id,
  name: "Omie · Marcos Paulo (teste 05-07)",
  systemType: "erp",
  state: "conectada",
  configuredBy: DONO,
  createdBy: { kind: "member", id: DONO },
  createdAt: CARIMBO,
  exposedTools: [],
  empresa: "Marcos Paulo",
  avisosPorCanal: { whatsapp: ["mari", "marcos", "grupo-financeiro"] },
});

describe("execucoesNovas — só o que nasceu depois de idsAntes", () => {
  it("devolve só as Execuções cujo id não estava no conjunto capturado antes", () => {
    const state = buildSeed();
    const automacao = publicarCanal(state, "aut_canal_execnovas", { canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalMensagemId: "gasto-novo" });
    const t = novaConta(state);
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.whatsapp, "whatsapp-teste-execnovas-01").ok).toBe(true);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    // A Lista "Contas a pagar" já tem A9 (`tarefaCriada`, Observadores) publicada no seed:
    // `runListAutomations` dispara as DUAS Automações, então `execucoesNovas` devolve duas
    // Execuções novas — o filtro por `automationId` isola a NOSSA para a asserção de id.
    runListAutomations(state, { kind: "tarefaCriada", taskId: t.id });

    const novas = execucoesNovas(state, idsAntes);
    expect(novas.length).toBeGreaterThanOrEqual(1);
    for (const execucao of novas) expect(idsAntes.has(execucao.id)).toBe(false);
    const nossa = novas.filter((e) => e.automationId === automacao.id);
    expect(nossa).toHaveLength(1);

    // Uma segunda chamada com o MESMO conjunto (agora atualizado) não devolve nada novo —
    // a garantia é sobre o conjunto passado, não sobre "só roda uma vez": quem chama é
    // responsável por capturar idsAntes no início do turno.
    expect(execucoesNovas(state, new Set(state.automationExecutions.map((e) => e.id)))).toHaveLength(0);
  });
});

describe("eventosDeNotificacaoPorCanal — pedido do domínio → EventoDeSaida", () => {
  it("modo Campo: evento com campoDestinoId e SEM rotulos", () => {
    const state = buildSeed();
    const automacao = publicarCanal(state, "aut_canal_campo", { canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalMensagemId: "gasto-novo" });
    const t = novaConta(state);
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.whatsapp, "whatsapp-teste-modo-campo-02").ok).toBe(true);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    runListAutomations(state, { kind: "tarefaCriada", taskId: t.id });
    const novas = execucoesNovas(state, idsAntes);
    const nossa = novas.find((e) => e.automationId === automacao.id);
    expect(nossa?.state).toBe("concluida");

    // A9 (Observadores) também roda no mesmo disparo, mas não é Ação de Canal — só a
    // NOSSA produz pedido, então o evento continua sendo exatamente um.
    const eventos = eventosDeNotificacaoPorCanal(state, novas);
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    expect(evento.type).toBe("automacao.notificar-canal.v1");
    expect(evento.aggregateType).toBe("automationExecution");
    expect(evento.aggregateId).toBe(nossa!.id);
    expect(evento.payload).toMatchObject({ destinoTipo: "campo", campoDestinoId: CP.fields.whatsapp, mensagemId: "gasto-novo" });
    expect("rotulos" in evento.payload).toBe(false);
    expect(JSON.stringify(evento.payload)).not.toContain("whatsapp-teste-modo-campo-02");
  });

  it("modo Empresa: evento com rotulos e SEM campoDestinoId — o inverso do modo Campo", () => {
    const state = buildSeed();
    state.integrations.push(integracaoMarcosPaulo(state));
    publicarCanal(state, "aut_canal_empresa", { canal: "whatsapp", canalDestinatariosDaEmpresa: true, canalMensagemId: "relatorio" });
    const t = novaConta(state);
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.empresa, "Marcos Paulo").ok).toBe(true);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    runListAutomations(state, { kind: "tarefaCriada", taskId: t.id });
    const novas = execucoesNovas(state, idsAntes);

    const eventos = eventosDeNotificacaoPorCanal(state, novas);
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    expect(evento.payload).toMatchObject({ destinoTipo: "rotulos", rotulos: ["mari", "marcos", "grupo-financeiro"], mensagemId: "relatorio" });
    expect("campoDestinoId" in evento.payload).toBe(false);
  });

  it("Execução que recusou (destino vazio) não produz evento", () => {
    const state = buildSeed();
    const automacao = publicarCanal(state, "aut_canal_recusa", { canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalMensagemId: "gasto-novo" });
    const t = novaConta(state);
    // Campo NUNCA preenchido: destinoDeCanal recusa, a Execução fecha "falhou".

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    runListAutomations(state, { kind: "tarefaCriada", taskId: t.id });
    const novas = execucoesNovas(state, idsAntes);
    const nossa = novas.find((e) => e.automationId === automacao.id);
    expect(nossa?.state).toBe("falhou");

    // Mesmo com A9 (Observadores) também tendo rodado no mesmo disparo, nenhum evento de
    // Canal nasce: A9 não é uma Ação de Canal, e a nossa recusou.
    expect(eventosDeNotificacaoPorCanal(state, novas)).toHaveLength(0);
  });
});

describe("EVENTOS[\"automacao.notificar-canal.v1\"] — schema fechado e pobre", () => {
  const base = {
    taskId: "tsk_x",
    automationId: "aut_x",
    executionId: "aex_x",
    canal: "whatsapp" as const,
    mensagemId: "gasto-novo" as const,
  };

  it("aceita o payload em modo campo e em modo rótulos", () => {
    expect(EVENTOS["automacao.notificar-canal.v1"].safeParse({ ...base, destinoTipo: "campo", campoDestinoId: "fd_x" }).success).toBe(true);
    expect(EVENTOS["automacao.notificar-canal.v1"].safeParse({ ...base, destinoTipo: "rotulos", rotulos: ["mari"] }).success).toBe(true);
  });

  it("rejeita uma chave a mais (numero) — .strict()", () => {
    // O VALOR não importa para provar `.strict()` — o que importa é a CHAVE a
    // mais. Nenhum dígito de telefone entra neste arquivo (T-5-21).
    const r = EVENTOS["automacao.notificar-canal.v1"].safeParse({
      ...base,
      destinoTipo: "campo",
      campoDestinoId: "fd_x",
      numero: "nao-deveria-existir-aqui",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita mensagemId fora do enum de dois valores", () => {
    const r = EVENTOS["automacao.notificar-canal.v1"].safeParse({
      ...base,
      mensagemId: "outra",
      destinoTipo: "campo",
      campoDestinoId: "fd_x",
    });
    expect(r.success).toBe(false);
  });
});
