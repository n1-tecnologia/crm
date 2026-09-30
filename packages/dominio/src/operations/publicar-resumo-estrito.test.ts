/**
 * crm:WR-12 (06-11 Task 3) — o Resumo não sai sobre dados que mudaram no
 * meio do ciclo, nem em dobro. `impressaoEsperada` é a impressão sobre a qual
 * quem chama resolveu o de-para (o snapshot da ponte); `conferenciaRejeitadaId`
 * é a Conferência rejeitada que o Resumo revisado responde. As duas recusam
 * SEM efeito; sem elas, nada muda.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { decideProcessApproval } from "./ai";
import { CP, impressaoDeLancamento, publicarResumoParaConferencia, type ConferenciaDoResumo, type DeParaDeLancamento } from "./financeiro";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

let state: DataState;
let conta: Task;

type Opcoes = Omit<Parameters<typeof publicarResumoParaConferencia>[3], "dePara">;
const publicar = (opcoes: Opcoes = {}) => publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA, ...opcoes });

function publicado(opcoes: Opcoes = {}): ConferenciaDoResumo {
  const r = publicar(opcoes);
  if (!r.ok) throw new Error(r.error);
  return r.value.conferencia;
}

function rejeitar(c: ConferenciaDoResumo) {
  const r = decideProcessApproval(state, CP.financeiroId, c.id, "rejeitada", { source: "click", reason: "é comercial" });
  if (!r.ok) throw new Error(r.error);
}

/** O retrato do que uma recusa não pode ter mudado. */
const retrato = () => ({
  comments: conta.comments.length,
  approvals: state.approvals.length,
  activity: state.activity.length,
  executions: state.agentExecutions.length,
});

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
});

describe("(a) impressaoEsperada igual à atual", () => {
  it("publica como sem a opção", () => {
    const esperada = impressaoDeLancamento(state, conta);
    const r = publicar({ impressaoEsperada: esperada });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(r.value.conferencia.origin.impressao).toBe(esperada);
  });
});

describe("(b) a conta mudou entre a leitura e a publicação", () => {
  it("recusa sem efeito", () => {
    const lida = impressaoDeLancamento(state, conta);
    const categoria = conta.fieldValues.find((f) => f.definitionId === CP.fields.categoria && f.state === "ativo");
    if (!categoria) throw new Error("sem Categoria");
    (categoria as { value: unknown }).value = "Marketing";
    expect(impressaoDeLancamento(state, conta)).not.toBe(lida);

    const antes = retrato();
    const r = publicar({ impressaoEsperada: lida });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Os dados da conta mudaram desde a leitura: o Resumo não foi publicado.");
    expect(retrato()).toEqual(antes);
  });
});

describe("(c) o Resumo revisado sai uma vez só", () => {
  it("a segunda chamada com a mesma Conferência rejeitada recusa, e a revisada continua pendente", () => {
    const p1 = publicado();
    rejeitar(p1);
    const p2 = publicar({ pedidoDeRevisao: "é comercial", conferenciaRejeitadaId: p1.id });
    expect(p2.ok, p2.ok ? "" : p2.error).toBe(true);
    if (!p2.ok) return;
    expect(p2.value.conferencia.decision).toBeUndefined();

    const antes = retrato();
    const denovo = publicar({ pedidoDeRevisao: "é comercial", conferenciaRejeitadaId: p1.id });
    expect(denovo.ok).toBe(false);
    if (!denovo.ok) expect(denovo.error).toBe("A Conferência que pediu este ajuste não é mais a vigente: o Resumo revisado não foi publicado.");
    expect(retrato()).toEqual(antes);
    expect(p2.value.conferencia.decision).toBeUndefined();
  });
});

describe("(d) conferenciaRejeitadaId de uma Conferência que não foi rejeitada", () => {
  it("recusa sem efeito", () => {
    const pendente = publicado();
    const antes = retrato();
    const r = publicar({ pedidoDeRevisao: "é comercial", conferenciaRejeitadaId: pendente.id });
    expect(r.ok).toBe(false);
    expect(retrato()).toEqual(antes);
    expect(pendente.decision).toBeUndefined();
  });
});

describe("(e) as duas opções juntas, com estado fresco e coerente", () => {
  it("publica", () => {
    const p1 = publicado();
    rejeitar(p1);
    const r = publicar({ pedidoDeRevisao: "é comercial", conferenciaRejeitadaId: p1.id, impressaoEsperada: impressaoDeLancamento(state, conta) });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
  });
});
