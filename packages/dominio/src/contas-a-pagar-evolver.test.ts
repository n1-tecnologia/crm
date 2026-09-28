/**
 * `contas-a-pagar:configurar` na parte que é regra (plano pós-auditoria, 2.1 e
 * 1.5): `updateStatus` passa a gravar requisitos de saída, e o evolver leva a
 * `ws_n1` as exigências novas de "para pagar" e pausa a A7 legada — puro, sem
 * banco. O CLI em `apps/api` só hidrata, chama `evoluirConfiguracaoDeContasAPagar`
 * e grava (ou desfaz, no dry-run).
 *
 * "Antes de 2.1" é montado à mão a partir do bootstrap de produção: os onze
 * requisitos que o seed gravava até esta mudança e a A7 ativa — exatamente o
 * que `ws_n1` tem hoje.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { A7_LEGADA, evoluirConfiguracaoDeContasAPagar } from "./contas-a-pagar-evolver";
import { updateStatus } from "./operations/configuration";
import { CP } from "./operations/financeiro";
import { createTask, setTaskFieldValue } from "./operations/tasks";
import type { DataState } from "./state";
import type { Automation, FieldRequirement, Member, StatusDefinition } from "./types";

const F = CP.fields;
const AGORA = "2026-09-28T12:00:00.000Z";
const MARYANE = "mem_maryane";

/** Os onze requisitos de saída de "para pagar" que o seed gravava até 2.1 — o que `ws_n1` tem. */
const EXIGENCIAS_ANTES_DE_2_1: readonly FieldRequirement[] = [
  { definitionId: F.centroDeCusto },
  { definitionId: F.valor },
  { attribute: "dueDate" },
  { definitionId: F.forma },
  { definitionId: F.chavePix, whenDefinitionId: F.forma, whenValue: "Chave Pix" },
  { definitionId: F.codigoBarras, whenDefinitionId: F.forma, whenValue: "Boleto" },
  { definitionId: F.boleto, whenDefinitionId: F.forma, whenValue: "Boleto" },
  { definitionId: F.pixCopiaECola, whenDefinitionId: F.forma, whenValue: "QRCode Pix" },
  { definitionId: F.qrCode, whenDefinitionId: F.forma, whenValue: "QRCode Pix" },
  { definitionId: F.cpf, whenDefinitionId: F.fornecedor, whenValue: "CPF" },
  { definitionId: F.cnpj, whenDefinitionId: F.fornecedor, whenValue: "CNPJ" },
];

function a7Legada(workspaceId: string): Automation {
  const cond = (spec: object) => ({ kind: "valorDeCampo" as const, expression: JSON.stringify(spec) });
  return {
    id: A7_LEGADA,
    workspaceId,
    createdBy: { kind: "member", id: CP.financeiroId },
    createdAt: AGORA,
    lifecycle: "ativo",
    name: "A7 · D-1: lançar no Omie pelo Agente",
    description: "Na véspera, em “para pagar”, sem Integração manual e com Valor: o Agente publica o Resumo e a conta vai para “lançado omie” (A8).",
    scopeType: "list",
    scopeId: CP.listId,
    ownerMemberId: CP.financeiroId,
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        trigger: { kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: -1 }) },
        conditions: [cond({ status: "para pagar" }), cond({ definitionId: F.integracaoManual, empty: true }), cond({ definitionId: F.valor, empty: false })],
        actions: [
          { order: 1, kind: "controle", controlKind: "invocarAgente", agentId: CP.agentId, params: "{}", maxAutonomy: "supervisionado" },
          { order: 2, kind: "escrita", toolId: "tarefa.alterarStatus", params: JSON.stringify({ statusName: "lançado omie" }) },
        ],
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        publishedBy: CP.financeiroId,
        publishedAt: AGORA,
        createdAt: AGORA,
      },
    ],
  };
}

function paraPagarDe(state: DataState): StatusDefinition {
  const def = state.lists.find((l) => l.id === CP.listId)?.statusSet?.definitions.find((d) => d.id === CP.status.paraPagar);
  if (!def) throw new Error("sem para pagar");
  return def;
}

/** `ws_n1` como está hoje: bootstrap de produção com os requisitos de antes de 2.1 e a A7 ativa. */
function wsN1AntesDe21(): DataState {
  const state = buildGestaoBootstrap({ workspaceId: "ws_teste_cp_evolver", agora: AGORA });
  paraPagarDe(state).exitRequirements = [...EXIGENCIAS_ANTES_DE_2_1];
  state.automations.push(a7Legada(state.workspace.id));
  return state;
}

let state: DataState;
beforeEach(() => {
  state = wsN1AntesDe21();
});

describe("updateStatus grava requisitos de saída (a operação que o evolver usa)", () => {
  it("(a) substitui a lista, grava normalizada e registra a mudança na Atividade", () => {
    const antes = state.activity.length;
    const r = updateStatus(state, MARYANE, "list", CP.listId, CP.status.paraPagar, {
      exitRequirements: [{ whenValue: "CPF", whenDefinitionId: F.fornecedor, definitionId: F.cpf }, { definitionId: F.valor }],
    });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    // Chaves sempre na mesma ordem, independente de como chegaram.
    expect(JSON.stringify(paraPagarDe(state).exitRequirements)).toBe(
      JSON.stringify([{ definitionId: F.cpf, whenDefinitionId: F.fornecedor, whenValue: "CPF" }, { definitionId: F.valor }]),
    );
    expect(state.activity.length).toBe(antes + 1);
    const registro = state.activity.find((a) => a.action === "Status alterado na configuração");
    expect(registro?.detail).toContain("requisitos de saída");
  });

  it("(b) a mesma lista de novo não é mudança: nenhum Registro novo", () => {
    expect(updateStatus(state, MARYANE, "list", CP.listId, CP.status.paraPagar, { exitRequirements: EXIGENCIAS_ANTES_DE_2_1 }).ok).toBe(true);
    const antes = state.activity.length;
    expect(updateStatus(state, MARYANE, "list", CP.listId, CP.status.paraPagar, { exitRequirements: EXIGENCIAS_ANTES_DE_2_1 }).ok).toBe(true);
    expect(state.activity.length).toBe(antes);
  });

  it.each([
    ["Campo inexistente", [{ definitionId: "fd_nao_existe" }]],
    ["Campo e atributo juntos", [{ definitionId: F.valor, attribute: "dueDate" as const }]],
    ["nem Campo nem atributo", [{ label: "algo" }]],
    ["condição sem valor", [{ definitionId: F.cpf, whenDefinitionId: F.fornecedor }]],
    ["condição com Campo inexistente", [{ definitionId: F.cpf, whenDefinitionId: "fd_nao_existe", whenValue: "CPF" }]],
  ])("(c) %s é recusado sem mudar nada", (_rotulo, requisitos) => {
    const antes = JSON.stringify(paraPagarDe(state).exitRequirements);
    const r = updateStatus(state, MARYANE, "list", CP.listId, CP.status.paraPagar, { exitRequirements: requisitos });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(paraPagarDe(state).exitRequirements)).toBe(antes);
  });

  it("(d) quem não administra a Lista não mexe nos requisitos", () => {
    const membro: Member = {
      id: "mem_sem_acesso",
      workspaceId: state.workspace.id,
      displayName: "Sem acesso",
      state: "ativo",
      roleId: "role_mem",
      availability: { value: "disponivel", at: AGORA, origin: "membro" },
      userMemory: { enabled: true, items: [] },
    };
    state.members.push(membro);
    const r = updateStatus(state, membro.id, "list", CP.listId, CP.status.paraPagar, { exitRequirements: [] });
    expect(r.ok).toBe(false);
    expect(paraPagarDe(state).exitRequirements).toHaveLength(EXIGENCIAS_ANTES_DE_2_1.length);
  });
});

describe("evoluirConfiguracaoDeContasAPagar — ws_n1 ganha as exigências de 2.1 e a A7 pausada", () => {
  it("(e) acrescenta Categoria, Fornecedor e Nome do fornecedor, mantém os onze de antes e pausa a A7", () => {
    const r = evoluirConfiguracaoDeContasAPagar(state, MARYANE);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.exigenciasAcrescentadas).toEqual([F.categoria, F.fornecedor, F.nomeFornecedor]);
    expect(r.value.automacoesPausadas).toEqual([A7_LEGADA]);
    expect(r.value.divergentes).toEqual([]);

    const catalogo = buildGestaoBootstrap({ workspaceId: "ws_catalogo", agora: AGORA });
    expect(paraPagarDe(state).exitRequirements).toEqual(paraPagarDe(catalogo).exitRequirements);
    for (const antiga of EXIGENCIAS_ANTES_DE_2_1) expect(paraPagarDe(state).exitRequirements).toContainEqual(antiga);
    expect(state.automations.find((a) => a.id === A7_LEGADA)?.lifecycle).toBe("pausado");
    // As duas mudanças deixam rastro, pelas operações de sempre.
    expect(state.activity.some((a) => a.action === "Status alterado na configuração" && a.objectId === CP.listId)).toBe(true);
    expect(state.activity.some((a) => a.action === "Automação pausada" && a.objectId === A7_LEGADA)).toBe(true);
  });

  it("(f) idempotente: a segunda execução não acrescenta nem pausa nada, e não escreve Atividade", () => {
    expect(evoluirConfiguracaoDeContasAPagar(state, MARYANE).ok).toBe(true);
    const atividade = state.activity.length;
    const r = evoluirConfiguracaoDeContasAPagar(state, MARYANE);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.exigenciasAcrescentadas).toEqual([]);
    expect(r.value.automacoesPausadas).toEqual([]);
    expect(r.value.conferidos).toEqual([`${CP.status.paraPagar}.exitRequirements`, `${A7_LEGADA}:pausado`]);
    expect(state.activity.length).toBe(atividade);
  });

  it("(g) um requisito que o catálogo não prevê é divergência: recusa e NADA muda — nem os requisitos, nem a A7", () => {
    paraPagarDe(state).exitRequirements = [...EXIGENCIAS_ANTES_DE_2_1, { definitionId: F.anexo }];
    const antes = JSON.stringify(paraPagarDe(state).exitRequirements);
    const r = evoluirConfiguracaoDeContasAPagar(state, MARYANE);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("nada foi sobrescrito");
      expect(r.error).toContain(F.anexo);
    }
    expect(JSON.stringify(paraPagarDe(state).exitRequirements)).toBe(antes);
    expect(state.automations.find((a) => a.id === A7_LEGADA)?.lifecycle).toBe("ativo");
  });

  it("(h) o Status \"para pagar\" renomeado é divergência — o evolver não mexe no que não reconhece", () => {
    paraPagarDe(state).name = "a pagar";
    const r = evoluirConfiguracaoDeContasAPagar(state, MARYANE);
    expect(r.ok).toBe(false);
    expect(state.automations.find((a) => a.id === A7_LEGADA)?.lifecycle).toBe("ativo");
  });

  it("(i) um Espaço sem a A7 (bootstrap novo) só confere: A7 ausente não é erro", () => {
    const novo = buildGestaoBootstrap({ workspaceId: "ws_novo", agora: AGORA });
    const r = evoluirConfiguracaoDeContasAPagar(novo, MARYANE);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.exigenciasAcrescentadas).toEqual([]);
    expect(r.value.conferidos).toContain(`${A7_LEGADA}:ausente`);
  });

  it("(j) uma A7 já pausada (0.2, pela tela) é conferida, não pausada de novo", () => {
    const a7 = state.automations.find((a) => a.id === A7_LEGADA);
    if (!a7) throw new Error("sem A7");
    a7.lifecycle = "pausado";
    const r = evoluirConfiguracaoDeContasAPagar(state, MARYANE);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.automacoesPausadas).toEqual([]);
    expect(r.value.conferidos).toContain(`${A7_LEGADA}:pausado`);
  });

  it("(k) nunca toca Tarefa: uma conta em \"para pagar\" sem os dados novos continua exatamente como estava", () => {
    const criada = createTask(state, MARYANE, { listId: CP.listId, title: "Conta antiga, sem fornecedor" });
    expect(criada.ok, criada.ok ? "" : criada.error).toBe(true);
    if (!criada.ok) return;
    expect(setTaskFieldValue(state, MARYANE, criada.value.id, F.centroDeCusto, "TRIA").ok).toBe(true);
    const antes = JSON.stringify(state.tasks);
    expect(evoluirConfiguracaoDeContasAPagar(state, MARYANE).ok).toBe(true);
    expect(JSON.stringify(state.tasks)).toBe(antes);
  });

  it("(l) quem não pode configurar a Lista recebe a recusa da própria operação, e nada é gravado", () => {
    const membro: Member = {
      id: "mem_sem_acesso",
      workspaceId: state.workspace.id,
      displayName: "Sem acesso",
      state: "ativo",
      roleId: "role_mem",
      availability: { value: "disponivel", at: AGORA, origin: "membro" },
      userMemory: { enabled: true, items: [] },
    };
    state.members.push(membro);
    const r = evoluirConfiguracaoDeContasAPagar(state, membro.id);
    expect(r.ok).toBe(false);
    expect(paraPagarDe(state).exitRequirements).toHaveLength(EXIGENCIAS_ANTES_DE_2_1.length);
    expect(state.automations.find((a) => a.id === A7_LEGADA)?.lifecycle).toBe("ativo");
  });
});
