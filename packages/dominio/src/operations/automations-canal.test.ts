/**
 * `case "notificar"` por Canal (AUTO-02, D5-09/D3-02/D5-10) — cobertura de
 * recusa por destino vazio, de rótulos por Empresa e de ausência de I/O.
 * Espelha o estilo de `automations-motor.test.ts` (Automação publicada ANTES
 * da Tarefa, gatilho `tarefaCriada` disparado manualmente).
 *
 * Usa a Lista "Contas a pagar" do seed real: `CP.fields.whatsapp` (já
 * reachable nela) faz o papel do Campo `Z WhatsApp` da Tarefa que D5-10
 * descreve; `CP.fields.empresa` é o Campo real que `destinoDeCanal` lê —
 * hardcoded no domínio — no modo Empresa.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Automation, AutomationAction, AutomationTrigger, AutomationVersion, Id, Integration, Task } from "../types";
import { pedidosDeNotificacaoPorCanal, runListAutomations } from "./automations";
import { CP } from "./financeiro";
import { createTask, setTaskFieldValue } from "./tasks";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const DONO = CP.financeiroId;
const CARIMBO = "2026-01-01T12:00:00.000Z";

/** Publica uma Automação de Canal direto no `state`, ANTES da Tarefa — o gatilho é `tarefaCriada`. */
const publicarCanal = (id: Id, params: object): Automation => {
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
};

/** Nasce em `CP.listId` sem disparar Automações ainda — dá tempo de preencher Campos antes do gatilho. */
const novaConta = (): Task => {
  const r = createTask(state, DONO, { listId: CP.listId, title: "Conta de teste (05-06)" }, { runAutomations: false });
  if (!r.ok) throw new Error(`fixture: ${r.error}`);
  return r.value;
};

const disparar = (taskId: Id) => runListAutomations(state, { kind: "tarefaCriada", taskId });

const execucoesDe = (automationId: Id, objectId: Id) => state.automationExecutions.filter((e) => e.automationId === automationId && e.objectId === objectId);

/** Simula o resultado do evolver de 05-01 já aplicado — Integração com os três rótulos, nunca um número. */
const integracaoMarcosPaulo = (): Integration => ({
  id: "int_teste_marcos_paulo",
  workspaceId: state.workspace.id,
  name: "Omie · Marcos Paulo (teste)",
  systemType: "erp",
  state: "conectada",
  configuredBy: DONO,
  createdBy: { kind: "member", id: DONO },
  createdAt: CARIMBO,
  exposedTools: [],
  empresa: "Marcos Paulo",
  avisosPorCanal: { whatsapp: ["mari", "marcos", "grupo-financeiro"] },
});

describe('Ramo de Canal do "notificar" (AUTO-02) — recusa visível, rótulos por Empresa, sem número exposto', () => {
  it("(a) Campo de destino PREENCHIDO: Execução concluída, pedido com destinoTipo campo e sem o número", () => {
    publicarCanal("aut_canal_a", { canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalMensagemId: "gasto-novo" });
    const t = novaConta();
    const numero = "+5511987654321";
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.whatsapp, numero).ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_a", t.id).at(-1);
    expect(execucao?.state).toBe("concluida");

    const pedidos = pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id);
    expect(pedidos).toHaveLength(1);
    const pedido = pedidos[0]!;
    expect(pedido.destinoTipo).toBe("campo");
    expect(pedido.rotulos).toBeUndefined();
    expect(pedido.campoDestinoId).toBe(CP.fields.whatsapp);
    expect(pedido.mensagemId).toBe("gasto-novo");
    expect(JSON.stringify(pedido)).not.toContain(numero);
  });

  it("(b) Campo de destino VAZIO: Execução falhou com o texto da UI-SPEC, nenhum pedido, nenhum Comentário novo", () => {
    publicarCanal("aut_canal_b", { canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalMensagemId: "gasto-novo" });
    const t = novaConta();
    const antes = t.comments.length;

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_b", t.id).at(-1);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toBe("“notificar” por WhatsApp recusado: Campo “WhatsApp” vazio — nada foi enviado.");
    expect(pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id)).toHaveLength(0);
    expect(t.comments.length).toBe(antes);
  });

  it("(c) canalDestinatariosDaEmpresa com a Tarefa na Empresa “Marcos Paulo”: pedido com os três rótulos", () => {
    state.integrations.push(integracaoMarcosPaulo());
    publicarCanal("aut_canal_c", { canal: "whatsapp", canalDestinatariosDaEmpresa: true, canalMensagemId: "relatorio" });
    const t = novaConta();
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.empresa, "Marcos Paulo").ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_c", t.id).at(-1);
    expect(execucao?.state).toBe("concluida");
    const pedidos = pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.destinoTipo).toBe("rotulos");
    expect(pedidos[0]?.rotulos).toEqual(["mari", "marcos", "grupo-financeiro"]);
    expect(pedidos[0]?.campoDestinoId).toBeUndefined();
    expect(pedidos[0]?.mensagemId).toBe("relatorio");
  });

  it("(d) canalDestinatariosDaEmpresa com a Tarefa numa Empresa sem Integração de avisos: recusa, lista vazia", () => {
    publicarCanal("aut_canal_d", { canal: "whatsapp", canalDestinatariosDaEmpresa: true, canalMensagemId: "relatorio" });
    const t = novaConta();
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.empresa, "Tria Company").ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_d", t.id).at(-1);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toContain("Tria Company");
    expect(pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id)).toHaveLength(0);
  });

  it("(e) os dois modos de destino declarados juntos: recusa, sem escolher um por acaso", () => {
    publicarCanal("aut_canal_e", { canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalDestinatariosDaEmpresa: true, canalMensagemId: "gasto-novo" });
    const t = novaConta();
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.whatsapp, "+5511900000000").ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_e", t.id).at(-1);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toBe(
      "“notificar” por Canal sem destino declarado: escolha canalCampoDestinoId ou canalDestinatariosDaEmpresa, nunca os dois.",
    );
  });

  it("(f) `notificar` SEM canal continua in-app: publica Comentário com Menção, como antes (não-regressão)", () => {
    const trigger: AutomationTrigger = { kind: "evento", eventType: "tarefaCriada" };
    const action: AutomationAction = {
      order: 1,
      kind: "controle",
      controlKind: "notificar",
      params: JSON.stringify({ template: "Aviso de teste (05-06).", mentionMemberIds: [CP.aprovadorId] }),
    };
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
    state.automations.push({
      id: "aut_canal_f",
      workspaceId: state.workspace.id,
      createdBy: { kind: "member", id: DONO },
      createdAt: CARIMBO,
      lifecycle: "ativo",
      name: "aut_canal_f",
      description: "aut_canal_f",
      scopeType: "list",
      scopeId: CP.listId,
      ownerMemberId: DONO,
      reactsToAutomationEvents: false,
      versions: [version],
    });
    const t = novaConta();

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_f", t.id).at(-1);
    expect(execucao?.state).toBe("concluida");
    expect(t.comments.some((c) => c.content.startsWith("Aviso de teste") && c.mentions.some((m) => m.type === "member" && m.id === CP.aprovadorId))).toBe(true);
  });

  it("(g) o Registro de Atividade de sucesso mostra só os quatro últimos dígitos, nunca o número inteiro", () => {
    publicarCanal("aut_canal_g", { canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalMensagemId: "gasto-novo" });
    const t = novaConta();
    const numero = "+5511998877665";
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.whatsapp, numero).ok).toBe(true);

    disparar(t.id);

    const registro = state.activity.find((a) => a.objectId === t.id && a.action === "notificou por WhatsApp");
    expect(registro?.detail).toContain("••••");
    expect(registro?.detail).not.toContain(numero);
    // O sufixo — quatro últimos caracteres — segue exposto: só o PREFIXO some.
    expect(registro?.detail).toContain(numero.slice(-4));
  });

  it("a recusa vira Registro de Atividade na Tarefa, nunca Comentário fantasma", () => {
    publicarCanal("aut_canal_recusa_ativ", { canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalMensagemId: "gasto-novo" });
    const t = novaConta();
    const antes = t.comments.length;

    disparar(t.id);

    const registro = state.activity.find((a) => a.objectId === t.id && a.action === "tentou notificar por WhatsApp e recusou");
    expect(registro).toBeDefined();
    expect(registro?.detail).toContain("Campo “WhatsApp” vazio");
    expect(t.comments.length).toBe(antes);
  });

  it("`pedidosDeNotificacaoPorCanal` é determinística: duas chamadas com os mesmos argumentos devolvem listas iguais", () => {
    publicarCanal("aut_canal_determ", { canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalMensagemId: "gasto-novo" });
    const t = novaConta();
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.whatsapp, "+5511911112222").ok).toBe(true);

    disparar(t.id);

    const primeira = pedidosDeNotificacaoPorCanal(state, state.automationExecutions);
    const segunda = pedidosDeNotificacaoPorCanal(state, state.automationExecutions);
    expect(primeira).toEqual(segunda);
  });
});
