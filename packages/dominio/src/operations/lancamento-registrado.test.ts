/**
 * O lançamento registrado (Fase 6, Fluxo 7 — 06-01 Task 3): o domínio só
 * registra o título que o Omie devolveu sobre um Resumo CONFERIDO para os
 * dados atuais, com a conta em "em lançamento omie"; confirma no fio, resolve
 * o fio, grava a Execução com o `payableId` real e move para "lançado omie".
 * A falha permanente comenta o motivo e volta a conta para "para pagar"
 * (D6-03).
 *
 * `state.activity` é newest-first: Registros achados por `objectId`/`action`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { decideProcessApproval } from "./ai";
import {
  CP,
  contaSemResumo,
  conferenciaDoResumo,
  publicarResumoParaConferencia,
  registrarFalhaDoLancamento,
  registrarLancamentoNoOmie,
  type ConferenciaDoResumo,
  type DeParaDeLancamento,
} from "./financeiro";
import { changeTaskStatus, resolveTaskComment } from "./tasks";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

const RESULTADO = {
  payableId: "5872219943",
  reaproveitado: false,
  anexos: [
    { nome: "nf.pdf", ok: true },
    { nome: "boleto.pdf", ok: false, erro: "download 404" },
  ],
} as const;

let state: DataState;
let conta: Task;

function publicar(): ConferenciaDoResumo {
  const r = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA });
  if (!r.ok) throw new Error(r.error);
  return r.value.conferencia;
}

function aprovar(conferencia: ConferenciaDoResumo) {
  const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "click" });
  if (!r.ok) throw new Error(r.error);
}

function paraEmLancamento() {
  const r = changeTaskStatus(state, CP.financeiroId, conta.id, CP.status.emLancamento);
  if (!r.ok) throw new Error(r.error);
}

/** A conta pronta para o registro: Resumo publicado, conferido, em "em lançamento omie". */
function prontaParaRegistrar(): ConferenciaDoResumo {
  const conferencia = publicar();
  aprovar(conferencia);
  paraEmLancamento();
  expect(conferenciaDoResumo(state, conta).estado).toBe("conferida");
  return conferencia;
}

const retrato = () => ({ comments: conta.comments.length, activity: state.activity.length, executions: state.agentExecutions.length, statusId: conta.statusId });

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
});

describe("(a) o lançamento registrado", () => {
  it("confirmação no fio, fio resolvido, Execução com o payableId real, Registro e “lançado omie”", () => {
    const conferencia = prontaParaRegistrar();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, RESULTADO);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);

    const confirmacao = conta.comments.at(-1);
    expect(confirmacao?.parentCommentId).toBe(conferencia.origin.threadCommentId);
    expect(confirmacao?.author).toEqual({ kind: "agent", id: CP.agentId });
    expect(confirmacao?.content).toBe(
      "✅ Lançado no Omie — título 5872219943 · TRIA · Impostos e taxas (2.06.01) · anexos 1 de 2\n• boleto.pdf: não subiu (download 404)",
    );
    expect(conta.comments.find((c) => c.id === conferencia.origin.threadCommentId)?.resolved).toBeDefined();

    const execucao = state.agentExecutions.filter((e) => e.anchor?.id === conta.id).at(-1);
    expect(execucao?.rehearsal).toBe(false);
    expect(execucao?.state).toBe("concluida");
    const passo = execucao?.steps.find((s) => s.toolId === "omie_lancar_conta_a_pagar");
    expect(passo).toMatchObject({ input: "TRIA · Impostos e taxas · 2.06.01", output: "título 5872219943", result: "concluido" });
    expect(execucao?.output).toBe("Lançado: TRIA · Impostos e taxas (2.06.01)");

    const registro = state.activity.find((a) => a.objectId === conta.id && a.action === "Lançado no Omie");
    expect(registro?.detail).toContain("5872219943");
    expect(conta.statusId).toBe(CP.status.lancado);
  });

  it("um fio reaberto à mão é resolvido pelo Agente no registro", () => {
    const conferencia = prontaParaRegistrar();
    const reaberto = resolveTaskComment(state, CP.financeiroId, conta.id, conferencia.origin.threadCommentId, false);
    expect(reaberto.ok, reaberto.ok ? "" : reaberto.error).toBe(true);
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, RESULTADO);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.comments.find((c) => c.id === conferencia.origin.threadCommentId)?.resolved?.by).toBe(CP.agentId);
  });
});

describe("(a2) tudo ou nada", () => {
  it("se “lançado omie” recusar a entrada, nada do registro fica: nem Comentário, nem Execução, nem Registro, nem fio resolvido", () => {
    const conferencia = prontaParaRegistrar();
    const reaberto = resolveTaskComment(state, CP.financeiroId, conta.id, conferencia.origin.threadCommentId, false);
    expect(reaberto.ok).toBe(true);
    const lista = state.lists.find((l) => l.id === CP.listId);
    const lancado = lista?.statusSet?.definitions.find((d) => d.id === CP.status.lancado);
    if (!lancado) throw new Error("sem “lançado omie” na Lista");
    lancado.entryAllowedMemberIds = [CP.aprovadorId];
    const antes = retrato();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, RESULTADO);
    expect(r.ok).toBe(false);
    expect(retrato()).toEqual(antes);
    expect(conta.comments.find((c) => c.id === conferencia.origin.threadCommentId)?.resolved).toBeUndefined();
  });
});

describe("(b) variações do texto", () => {
  it("sem anexos", () => {
    prontaParaRegistrar();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, { payableId: "123", reaproveitado: false, anexos: [] });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.comments.at(-1)?.content).toBe("✅ Lançado no Omie — título 123 · TRIA · Impostos e taxas (2.06.01) · sem anexos");
  });

  it("título reaproveitado", () => {
    prontaParaRegistrar();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, { payableId: "123", reaproveitado: true, anexos: [] });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.comments.at(-1)?.content).toContain(" (título já existia)");
  });

  it("título simulado (`mock-`) é recusado", () => {
    prontaParaRegistrar();
    const antes = retrato();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, { payableId: "mock-1", reaproveitado: false, anexos: [] });
    expect(r.ok).toBe(false);
    expect(retrato()).toEqual(antes);
  });
});

describe("(c) sem Conferência aprovada para os dados atuais: nada gravado", () => {
  it("sem Resumo", () => {
    paraEmLancamento();
    const antes = retrato();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, RESULTADO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("sem-resumo");
    expect(retrato()).toEqual(antes);
  });

  it("Conferência pendente", () => {
    publicar();
    paraEmLancamento();
    const antes = retrato();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, RESULTADO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("pendente");
    expect(retrato()).toEqual(antes);
  });

  it("Conferência desatualizada (a conta mudou depois da aprovação)", () => {
    prontaParaRegistrar();
    conta.title = "DAS — Simples Nacional (retificado)";
    const antes = retrato();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, RESULTADO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("desatualizada");
    expect(retrato()).toEqual(antes);
    expect(conta.statusId).toBe(CP.status.emLancamento);
  });
});

describe("(d) só a partir de “em lançamento omie”", () => {
  it("conta conferida mas em “para pagar”: recusa", () => {
    aprovar(publicar());
    expect(conta.statusId).toBe(CP.status.paraPagar);
    const antes = retrato();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, RESULTADO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("em lançamento omie");
    expect(retrato()).toEqual(antes);
  });
});

describe("(e) a falha permanente (D6-03)", () => {
  it("comenta o motivo no fio, com Menção ao Financeiro, e a conta volta para “para pagar”", () => {
    const conferencia = prontaParaRegistrar();
    const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, { motivo: "Fornecedor sem CNPJ válido", code: "FORNECEDOR_NAO_RESOLVIDO" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const aviso = conta.comments.at(-1);
    expect(aviso?.content).toBe('Não consegui lançar no Omie: Fornecedor sem CNPJ válido (FORNECEDOR_NAO_RESOLVIDO). A conta voltou para "para pagar".');
    expect(aviso?.author).toEqual({ kind: "agent", id: CP.agentId });
    expect(aviso?.parentCommentId).toBe(conferencia.origin.threadCommentId);
    expect(aviso?.mentions).toContainEqual({ type: "member", id: CP.financeiroId });
    expect(conta.statusId).toBe(CP.status.paraPagar);
    const registro = state.activity.find((a) => a.objectId === conta.id && a.action === "Lançamento no Omie falhou");
    expect(registro?.detail).toBe("FORNECEDOR_NAO_RESOLVIDO");
    expect(registro?.detail).not.toContain("CNPJ");
  });

  it("sem fio de Resumo, o aviso é raiz", () => {
    paraEmLancamento();
    const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, { motivo: "Omie fora do ar", code: "OMIE_INDISPONIVEL" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.comments.at(-1)?.parentCommentId).toBeUndefined();
    expect(conta.statusId).toBe(CP.status.paraPagar);
  });

  it("fora de “em lançamento omie”, o Status não muda e o aviso não diz que voltou", () => {
    const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, { motivo: "Omie fora do ar", code: "OMIE_INDISPONIVEL" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.statusId).toBe(CP.status.paraPagar);
    expect(conta.comments.at(-1)?.content).toBe("Não consegui lançar no Omie: Omie fora do ar (OMIE_INDISPONIVEL).");
  });
});

describe("(f) INV-CP-01", () => {
  it("contaSemResumo é falso para a conta lançada por este caminho", () => {
    prontaParaRegistrar();
    const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, RESULTADO);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.statusId).toBe(CP.status.lancado);
    expect(contaSemResumo(state, conta)).toBe(false);
  });
});
