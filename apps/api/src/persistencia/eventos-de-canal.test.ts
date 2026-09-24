/**
 * `eventos-de-canal.ts` — unitário, sem Postgres: `execucoesNovas` isolando
 * o que nasceu na transação, e `eventosDeNotificacaoPorCanal` traduzindo o
 * pedido pobre do domínio no `EventoDeSaida` do tipo
 * `automacao.notificar-canal.v1`. Migrado para a Solicitação (05-13 Task 2,
 * CR-02/D5-19): mesmo molde de
 * `packages/dominio/src/operations/automations-canal.test.ts` — estado por
 * `buildSeed()` + `evoluirConfiguracaoDeSolicitacoes` +
 * `evoluirConfiguracaoPorEmpresa`, Campos preenchidos ANTES do gatilho
 * (`tarefaCriada` via `runListAutomations`, disparado manualmente).
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio";
import type { Automation, AutomationAction, AutomationTrigger, AutomationVersion, Id, Task } from "@n1/dominio";
import { CP } from "@n1/dominio/operations/financeiro";
import { createTask, setTaskFieldValue } from "@n1/dominio/operations/tasks";
import { CANAL_CAMPO_EMPRESA_ID, CANAL_CAMPO_WHATSAPP_ID, CANAL_LISTA_ID, runListAutomations } from "@n1/dominio/operations/automations";
import { evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { evoluirConfiguracaoPorEmpresa } from "@n1/dominio/configuracao-por-empresa-evolver";
import { EVENTOS } from "./outbox";
import { eventosDeNotificacaoPorCanal, execucoesNovas } from "./eventos-de-canal";

const DONO = CP.financeiroId;
const CARIMBO = "2026-01-01T12:00:00.000Z";

/** Estado com a Lista de Solicitações e as 6 Integrações reais (Marcos Paulo incluída) já materializadas. */
function estadoComSolicitacoes(): DataState {
  const state = buildSeed();
  const solicitacoes = evoluirConfiguracaoDeSolicitacoes(state, DONO);
  if (!solicitacoes.ok) throw new Error(`fixture (Solicitações): ${solicitacoes.error}`);
  const empresas = evoluirConfiguracaoPorEmpresa(state, DONO);
  if (!empresas.ok) throw new Error(`fixture (Empresas): ${empresas.error}`);
  return state;
}

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
    scopeId: CANAL_LISTA_ID,
    ownerMemberId: DONO,
    reactsToAutomationEvents: false,
    versions: [version],
  };
  state.automations.push(automation);
  return automation;
}

/** Publica uma Automação de Canal com DOIS passos — WR-04, aggregateId por passo. */
function publicarCanalComDoisPassos(state: DataState, id: Id, params1: object, params2: object): Automation {
  const trigger: AutomationTrigger = { kind: "evento", eventType: "tarefaCriada" };
  const acao1: AutomationAction = { order: 1, kind: "controle", controlKind: "notificar", params: JSON.stringify(params1) };
  const acao2: AutomationAction = { order: 2, kind: "controle", controlKind: "notificar", params: JSON.stringify(params2) };
  const version: AutomationVersion = {
    number: 1,
    state: "publicada",
    trigger,
    conditions: [],
    actions: [acao1, acao2],
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
    scopeId: CANAL_LISTA_ID,
    ownerMemberId: DONO,
    reactsToAutomationEvents: false,
    versions: [version],
  };
  state.automations.push(automation);
  return automation;
}

function novaSolicitacao(state: DataState): Task {
  const r = createTask(state, DONO, { listId: CANAL_LISTA_ID, title: "Solicitação de teste (05-13)" }, { runAutomations: false });
  if (!r.ok) throw new Error(`fixture: ${r.error}`);
  return r.value;
}

describe("execucoesNovas — só o que nasceu depois de idsAntes", () => {
  it("devolve só as Execuções cujo id não estava no conjunto capturado antes", () => {
    const state = estadoComSolicitacoes();
    const automacao = publicarCanal(state, "aut_canal_execnovas", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao(state);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-teste-execnovas-01").ok).toBe(true);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
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
  it("modo Campo: evento com campoDestinoId e SEM rotulos, aggregateId `<executionId>:0`", () => {
    const state = estadoComSolicitacoes();
    const automacao = publicarCanal(state, "aut_canal_campo", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao(state);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-teste-modo-campo-02").ok).toBe(true);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    runListAutomations(state, { kind: "tarefaCriada", taskId: t.id });
    const novas = execucoesNovas(state, idsAntes);
    const nossa = novas.find((e) => e.automationId === automacao.id);
    expect(nossa?.state).toBe("concluida");

    const eventos = eventosDeNotificacaoPorCanal(state, novas);
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    expect(evento.type).toBe("automacao.notificar-canal.v1");
    expect(evento.aggregateType).toBe("automationExecution");
    expect(evento.aggregateId).toBe(`${nossa!.id}:0`);
    expect(evento.payload).toMatchObject({ destinoTipo: "campo", campoDestinoId: CANAL_CAMPO_WHATSAPP_ID, mensagemId: "gasto-novo" });
    expect("rotulos" in evento.payload).toBe(false);
    expect("indicePasso" in evento.payload).toBe(false);
    expect(JSON.stringify(evento.payload)).not.toContain("whatsapp-teste-modo-campo-02");
  });

  it("modo Empresa: evento com rotulos e SEM campoDestinoId — o inverso do modo Campo", () => {
    const state = estadoComSolicitacoes();
    publicarCanal(state, "aut_canal_empresa", { canal: "whatsapp", canalDestinatariosDaEmpresa: true, canalMensagemId: "relatorio" });
    const t = novaSolicitacao(state);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    runListAutomations(state, { kind: "tarefaCriada", taskId: t.id });
    const novas = execucoesNovas(state, idsAntes);

    const eventos = eventosDeNotificacaoPorCanal(state, novas);
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    expect(evento.payload).toMatchObject({ destinoTipo: "rotulos", rotulos: ["mari", "marcos", "grupo-financeiro"], mensagemId: "relatorio" });
    expect("campoDestinoId" in evento.payload).toBe(false);
  });

  it("Solicitação da Empresa “Tria Company” (sem avisosPorCanal): recusa do domínio, zero eventos", () => {
    const state = estadoComSolicitacoes();
    const automacao = publicarCanal(state, "aut_canal_tria", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao(state);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Tria Company").ok).toBe(true);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-teste-tria-03").ok).toBe(true);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    runListAutomations(state, { kind: "tarefaCriada", taskId: t.id });
    const novas = execucoesNovas(state, idsAntes);
    const nossa = novas.find((e) => e.automationId === automacao.id);
    expect(nossa?.state).toBe("falhou");

    expect(eventosDeNotificacaoPorCanal(state, novas)).toHaveLength(0);
  });

  it("Execução que recusou (destino vazio) não produz evento", () => {
    const state = estadoComSolicitacoes();
    const automacao = publicarCanal(state, "aut_canal_recusa", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao(state);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);
    // Campo WhatsApp NUNCA preenchido: destinoDeCanal recusa, a Execução fecha "falhou".

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    runListAutomations(state, { kind: "tarefaCriada", taskId: t.id });
    const novas = execucoesNovas(state, idsAntes);
    const nossa = novas.find((e) => e.automationId === automacao.id);
    expect(nossa?.state).toBe("falhou");

    expect(eventosDeNotificacaoPorCanal(state, novas)).toHaveLength(0);
  });

  it("Automação com DOIS passos de Canal: dois eventos, aggregateId `<executionId>:0` e `<executionId>:1`", () => {
    const state = estadoComSolicitacoes();
    const automacao = publicarCanalComDoisPassos(
      state,
      "aut_canal_dois_passos",
      { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" },
      { canal: "whatsapp", canalDestinatariosDaEmpresa: true, canalMensagemId: "relatorio" },
    );
    const t = novaSolicitacao(state);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-teste-dois-passos-04").ok).toBe(true);

    const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
    runListAutomations(state, { kind: "tarefaCriada", taskId: t.id });
    const novas = execucoesNovas(state, idsAntes);
    const nossa = novas.find((e) => e.automationId === automacao.id);
    expect(nossa?.state).toBe("concluida");

    const eventos = eventosDeNotificacaoPorCanal(state, novas);
    expect(eventos).toHaveLength(2);
    expect(eventos.map((e) => e.aggregateId).sort()).toEqual([`${nossa!.id}:0`, `${nossa!.id}:1`]);
    // Os dois eventos apontam para a MESMA Execução — só o índice do passo distingue.
    expect(eventos.every((e) => e.aggregateId.startsWith(`${nossa!.id}:`))).toBe(true);
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

  it("rejeita indicePasso — o payload continua sem essa chave, mesmo depois de WR-04", () => {
    const r = EVENTOS["automacao.notificar-canal.v1"].safeParse({
      ...base,
      destinoTipo: "campo",
      campoDestinoId: "fd_x",
      indicePasso: 0,
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
