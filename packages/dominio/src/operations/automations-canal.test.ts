/**
 * `case "notificar"` por Canal (AUTO-02, D5-09/D3-02/D5-10), realinhado pelo
 * fechamento de lacunas de CR-02/D5-19 (05-13): o alvo real é a Lista
 * "Solicitações de pagamento", lendo a Empresa em `fld_sp_c_empresa` e, no
 * modo campo, o destino em `fld_sp_z_whatsapp` ("Contato do solicitante") —
 * nunca mais Contas a pagar. Estado: `buildSeed()` (que já bootstrapa Espaço
 * "Gestão" › Pasta "Financeiro" via `applyContasAPagar`) mais
 * `evoluirConfiguracaoDeSolicitacoes` (materializa a Lista de Solicitações,
 * com "Marcos Paulo" já na 12ª opção de `fld_sp_c_empresa` — Task 1 deste
 * plano) e `evoluirConfiguracaoPorEmpresa` (cria as 6 Integrações reais,
 * inclusive a do Marcos Paulo com `avisosPorCanal`). A Solicitação nasce por
 * `createTask(..., { runAutomations: false })`, recebe Campos por
 * `setTaskFieldValue`, e só então o gatilho roda — a mesma ordem de
 * `submitForm` (`scale.ts:563-622`).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { evoluirConfiguracaoPorEmpresa } from "../configuracao-por-empresa-evolver";
import { buildSeed } from "../seed";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "../solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes, LISTA_ID as SOLICITACAO_LISTA_ID } from "../solicitacao-de-pagamento-evolver";
import type { DataState } from "../state";
import type { Automation, AutomationAction, AutomationTrigger, AutomationVersion, Id, Task } from "../types";
import { CANAL_CAMPO_EMPRESA_ID, CANAL_CAMPO_WHATSAPP_ID, CANAL_LISTA_ID, pedidosDeNotificacaoPorCanal, runListAutomations } from "./automations";
import { CP } from "./financeiro";
import { createTask, setTaskFieldValue } from "./tasks";

const DONO = CP.financeiroId;
const CARIMBO = "2026-01-01T12:00:00.000Z";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
  const solicitacoes = evoluirConfiguracaoDeSolicitacoes(state, DONO);
  if (!solicitacoes.ok) throw new Error(`fixture (Solicitações): ${solicitacoes.error}`);
  const empresas = evoluirConfiguracaoPorEmpresa(state, DONO);
  if (!empresas.ok) throw new Error(`fixture (Empresas): ${empresas.error}`);
});

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
    scopeId: SOLICITACAO_LISTA_ID,
    ownerMemberId: DONO,
    reactsToAutomationEvents: false,
    versions: [version],
  };
  state.automations.push(automation);
  return automation;
};

/** Publica a mesma Automação de Canal, mas com DOIS passos de Canal (WR-04). */
const publicarCanalComDoisPassos = (id: Id, params1: object, params2: object): Automation => {
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
    scopeId: SOLICITACAO_LISTA_ID,
    ownerMemberId: DONO,
    reactsToAutomationEvents: false,
    versions: [version],
  };
  state.automations.push(automation);
  return automation;
};

/** Nasce em `SOLICITACAO_LISTA_ID` sem disparar Automações ainda — dá tempo de preencher Campos antes do gatilho. */
const novaSolicitacao = (): Task => {
  const r = createTask(state, DONO, { listId: SOLICITACAO_LISTA_ID, title: "Solicitação de teste (05-13)" }, { runAutomations: false });
  if (!r.ok) throw new Error(`fixture: ${r.error}`);
  return r.value;
};

/** Nasce em `CP.listId` (Contas a pagar) — só para o caso (c), que prova a recusa fora da Lista de Solicitações. */
const novaContaAPagar = (): Task => {
  const r = createTask(state, DONO, { listId: CP.listId, title: "Conta de teste (05-13)" }, { runAutomations: false });
  if (!r.ok) throw new Error(`fixture: ${r.error}`);
  return r.value;
};

const disparar = (taskId: Id) => runListAutomations(state, { kind: "tarefaCriada", taskId });

const execucoesDe = (automationId: Id, objectId: Id) => state.automationExecutions.filter((e) => e.automationId === automationId && e.objectId === objectId);

describe('Ramo de Canal do "notificar" (AUTO-02/D5-19) — alvo é a Solicitação, recusa visível, sem número exposto', () => {
  it("(a) Solicitação de “Marcos Paulo” com fld_sp_z_whatsapp preenchido: Execução concluída, pedido campo, indicePasso 0", () => {
    publicarCanal("aut_canal_a", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao();
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);
    const numero = "whatsapp-teste-1234";
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_WHATSAPP_ID, numero).ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_a", t.id).at(-1);
    expect(execucao?.state).toBe("concluida");

    const registro = state.activity.find((a) => a.objectId === t.id && a.action === "notificou por WhatsApp");
    expect(registro?.detail).toContain("••••");
    expect(registro?.detail).not.toContain(numero);
    expect(registro?.detail).toContain(numero.slice(-4));

    const pedidos = pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id);
    expect(pedidos).toHaveLength(1);
    const pedido = pedidos[0]!;
    expect(pedido.destinoTipo).toBe("campo");
    expect(pedido.rotulos).toBeUndefined();
    expect(pedido.campoDestinoId).toBe(CANAL_CAMPO_WHATSAPP_ID);
    expect(pedido.indicePasso).toBe(0);
    expect(pedido.mensagemId).toBe("gasto-novo");
    expect(JSON.stringify(pedido)).not.toContain(numero);
  });

  it("(b) canalDestinatariosDaEmpresa com Empresa “Marcos Paulo”: pedido com os três rótulos, na ordem da Integração", () => {
    publicarCanal("aut_canal_b", { canal: "whatsapp", canalDestinatariosDaEmpresa: true, canalMensagemId: "relatorio" });
    const t = novaSolicitacao();
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_b", t.id).at(-1);
    expect(execucao?.state).toBe("concluida");
    const pedidos = pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.destinoTipo).toBe("rotulos");
    expect(pedidos[0]?.rotulos).toEqual(["mari", "marcos", "grupo-financeiro"]);
    expect(pedidos[0]?.campoDestinoId).toBeUndefined();
    expect(pedidos[0]?.mensagemId).toBe("relatorio");
  });

  it("(c) Tarefa de Contas a pagar (fora da Lista de Solicitações): recusa “só notifica Solicitações de pagamento”, zero pedidos", () => {
    const trigger: AutomationTrigger = { kind: "evento", eventType: "tarefaCriada" };
    const action: AutomationAction = { order: 1, kind: "controle", controlKind: "notificar", params: JSON.stringify({ canal: "whatsapp", canalCampoDestinoId: CP.fields.whatsapp, canalMensagemId: "gasto-novo" }) };
    const version: AutomationVersion = { number: 1, state: "publicada", trigger, conditions: [], actions: [action], errorPolicy: { onActionFailure: "interromper", retries: 0 }, publishedBy: DONO, publishedAt: CARIMBO, createdAt: CARIMBO };
    state.automations.push({
      id: "aut_canal_c",
      workspaceId: state.workspace.id,
      createdBy: { kind: "member", id: DONO },
      createdAt: CARIMBO,
      lifecycle: "ativo",
      name: "aut_canal_c",
      description: "aut_canal_c",
      scopeType: "list",
      scopeId: CP.listId,
      ownerMemberId: DONO,
      reactsToAutomationEvents: false,
      versions: [version],
    });
    const t = novaContaAPagar();
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.empresa, "Marcos Paulo").ok).toBe(true);
    expect(setTaskFieldValue(state, DONO, t.id, CP.fields.whatsapp, "whatsapp-teste-9999").ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_c", t.id).at(-1);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toContain("só notifica Solicitações de pagamento");
    expect(pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id)).toHaveLength(0);
  });

  it("(d) canalCampoDestinoId de Contas a pagar (fd_cp_whatsapp) sobre uma Solicitação: recusa “o destino por Campo é o WhatsApp do solicitante”, zero pedidos", () => {
    publicarCanal("aut_canal_d", { canal: "whatsapp", canalCampoDestinoId: "fd_cp_whatsapp", canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao();
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_d", t.id).at(-1);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toBe("“notificar” por WhatsApp recusado: o destino por Campo é o WhatsApp do solicitante — nada foi enviado.");
    expect(pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id)).toHaveLength(0);
  });

  it("(e) Empresa “Tria Company” (Integração sem avisosPorCanal) no modo campo, WhatsApp preenchido: recusa, zero pedidos", () => {
    publicarCanal("aut_canal_e", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao();
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Tria Company").ok).toBe(true);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-teste-0000").ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_e", t.id).at(-1);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toContain("Tria Company");
    expect(execucao?.terminationReason).toContain("não declara destinatário de WhatsApp");
    expect(pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id)).toHaveLength(0);
  });

  it("(f) Solicitação sem Empresa: recusa “a Tarefa não tem Empresa”, zero pedidos", () => {
    publicarCanal("aut_canal_f", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao();

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_f", t.id).at(-1);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toBe("“notificar” por WhatsApp recusado: a Tarefa não tem Empresa — nada foi enviado.");
    expect(pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id)).toHaveLength(0);
  });

  it("(g) WhatsApp vazio no modo campo (Empresa “Marcos Paulo”): recusa de Campo vazio, zero pedidos, nenhum Comentário", () => {
    publicarCanal("aut_canal_g", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao();
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);
    const antes = t.comments.length;

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_g", t.id).at(-1);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toBe("“notificar” por WhatsApp recusado: Campo “WhatsApp” vazio — nada foi enviado.");
    expect(pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id)).toHaveLength(0);
    expect(t.comments.length).toBe(antes);

    const registro = state.activity.find((a) => a.objectId === t.id && a.action === "tentou notificar por WhatsApp e recusou");
    expect(registro).toBeDefined();
    expect(t.comments.length).toBe(antes);
  });

  it("(h) os dois modos de destino declarados juntos: recusa, sem escolher um por acaso", () => {
    publicarCanal("aut_canal_h", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalDestinatariosDaEmpresa: true, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao();
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-teste-0001").ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_h", t.id).at(-1);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toBe(
      "“notificar” por Canal sem destino declarado: escolha canalCampoDestinoId ou canalDestinatariosDaEmpresa, nunca os dois.",
    );
  });

  it("(i) Automação com DOIS passos de Canal: dois pedidos, mesmo executionId, indicePasso 0 e 1 (WR-04)", () => {
    publicarCanalComDoisPassos(
      "aut_canal_dois_passos",
      { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" },
      { canal: "whatsapp", canalDestinatariosDaEmpresa: true, canalMensagemId: "relatorio" },
    );
    const t = novaSolicitacao();
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-teste-0002").ok).toBe(true);

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_dois_passos", t.id).at(-1);
    expect(execucao?.state).toBe("concluida");
    const pedidos = pedidosDeNotificacaoPorCanal(state, state.automationExecutions).filter((p) => p.executionId === execucao?.id);
    expect(pedidos).toHaveLength(2);
    expect(pedidos.map((p) => p.executionId)).toEqual([execucao?.id, execucao?.id]);
    expect(pedidos.map((p) => p.indicePasso).sort()).toEqual([0, 1]);
  });

  it("(j) `notificar` SEM canal continua in-app: publica Comentário com Menção, como antes (não-regressão)", () => {
    const trigger: AutomationTrigger = { kind: "evento", eventType: "tarefaCriada" };
    const action: AutomationAction = {
      order: 1,
      kind: "controle",
      controlKind: "notificar",
      params: JSON.stringify({ template: "Aviso de teste (05-13).", mentionMemberIds: [CP.aprovadorId] }),
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
      id: "aut_canal_j",
      workspaceId: state.workspace.id,
      createdBy: { kind: "member", id: DONO },
      createdAt: CARIMBO,
      lifecycle: "ativo",
      name: "aut_canal_j",
      description: "aut_canal_j",
      scopeType: "list",
      scopeId: SOLICITACAO_LISTA_ID,
      ownerMemberId: DONO,
      reactsToAutomationEvents: false,
      versions: [version],
    });
    const t = novaSolicitacao();

    disparar(t.id);

    const execucao = execucoesDe("aut_canal_j", t.id).at(-1);
    expect(execucao?.state).toBe("concluida");
    expect(t.comments.some((c) => c.content.startsWith("Aviso de teste") && c.mentions.some((m) => m.type === "member" && m.id === CP.aprovadorId))).toBe(true);
  });

  it("`pedidosDeNotificacaoPorCanal` é determinística: duas chamadas com os mesmos argumentos devolvem listas iguais", () => {
    publicarCanal("aut_canal_determ", { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
    const t = novaSolicitacao();
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo").ok).toBe(true);
    expect(setTaskFieldValue(state, DONO, t.id, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-teste-0003").ok).toBe(true);

    disparar(t.id);

    const primeira = pedidosDeNotificacaoPorCanal(state, state.automationExecutions);
    const segunda = pedidosDeNotificacaoPorCanal(state, state.automationExecutions);
    expect(primeira).toEqual(segunda);
  });
});

describe("Deriva das constantes CANAL_* contra o catálogo real da Solicitação", () => {
  it("CANAL_LISTA_ID é o LISTA_ID do evolver da Solicitação", () => {
    expect(CANAL_LISTA_ID).toBe(SOLICITACAO_LISTA_ID);
    expect(CANAL_LISTA_ID).toBe("lst_solicitacoes_de_pagamento");
  });

  it("CANAL_CAMPO_EMPRESA_ID é o id do Campo “Empresa” do catálogo real", () => {
    const campo = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === "Empresa");
    expect(CANAL_CAMPO_EMPRESA_ID).toBe(campo?.id);
    expect(CANAL_CAMPO_EMPRESA_ID).toBe("fld_sp_c_empresa");
  });

  it("CANAL_CAMPO_WHATSAPP_ID é o id do Campo “WhatsApp” do catálogo real", () => {
    const campo = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === "WhatsApp");
    expect(CANAL_CAMPO_WHATSAPP_ID).toBe(campo?.id);
    expect(CANAL_CAMPO_WHATSAPP_ID).toBe("fld_sp_z_whatsapp");
  });
});

describe("Catálogo da Solicitação — “Marcos Paulo” em fld_sp_c_empresa (D5-19)", () => {
  it("tem 12 opções, “Marcos Paulo” na última posição, e as 11 anteriores na mesma ordem", () => {
    const campo = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.id === "fld_sp_c_empresa");
    const opcoes = campo?.opcoes ?? [];
    expect(opcoes).toHaveLength(12);
    expect(opcoes.at(-1)).toBe("Marcos Paulo");
    expect(opcoes.filter((o) => o === "Marcos Paulo")).toHaveLength(1);
    expect(opcoes.slice(0, 11)).toEqual([
      "Tria Company", "Oliveira Participações", "EXO Loteamento", "EXO Participações", "Loovi",
      "PLX digital", "IVL", "USI", "Konq Intermediações", "O2", "Inevitaveis",
    ]);
  });
});
