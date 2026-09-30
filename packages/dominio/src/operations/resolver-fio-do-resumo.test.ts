/**
 * crm:IN-02 (06-11 Task 1) — a exceção de `resolveTaskComment` para o fio do
 * Resumo vale só para RESOLVER, e só para quem confere a Conferência VIGENTE
 * daquele fio (o aprovador dela, ou um Membro de `revisoresDoResumo`). O
 * aprovador de uma Conferência cancelada não resolve, e ninguém reabre pela
 * exceção: reabrir o fio não reabre a Conferência, cuja decisão fica.
 *
 * O Resumo é publicado por `mem_thiago` (Proprietário), para que o autor
 * delegado do fio não seja quem se testa.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { CP, publicarResumoParaConferencia, revisoresDoResumo, type DeParaDeLancamento } from "./financeiro";
import { addTaskComment, resolveTaskComment } from "./tasks";

const PUBLICADOR = "mem_thiago";
/** Membro comum (Papel base "membro"): nem autor do fio, nem Administrador, nem revisor. */
const MARCOS_PAULO = "mem_marcos_paulo";
const RECUSA = "Só quem abriu o fio, ou um Administrador, o resolve.";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

let state: DataState;
let conta: Task;

function publicar(opcoes: { readonly avisarId?: string; readonly pedidoDeRevisao?: string } = {}) {
  const r = publicarResumoParaConferencia(state, PUBLICADOR, conta.id, { dePara: DE_PARA, ...opcoes });
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

const raizDe = (id: string) => conta.comments.find((c) => c.id === id);

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
  expect(revisoresDoResumo(state)).not.toContain(MARCOS_PAULO);
});

describe("(a) o aprovador da Conferência vigente resolve o fio", () => {
  it("não é autor nem Administrador, e resolve", () => {
    const { conferencia } = publicar({ avisarId: MARCOS_PAULO });
    const raiz = conferencia.origin.threadCommentId;
    const r = resolveTaskComment(state, MARCOS_PAULO, conta.id, raiz, true);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(raizDe(raiz)?.resolved?.by).toBe(MARCOS_PAULO);
  });
});

describe("(b) o aprovador de uma Conferência cancelada não resolve", () => {
  it("a anterior (Marcos Paulo) foi superada pela vigente (Maryane): recusa, fio aberto", () => {
    const primeira = publicar({ avisarId: MARCOS_PAULO });
    const segunda = publicar({ pedidoDeRevisao: "trocar a conta" });
    expect(primeira.conferencia.decision).toBe("cancelada");
    expect(segunda.conferencia.approverMemberId).toBe(CP.financeiroId);
    const raiz = segunda.conferencia.origin.threadCommentId;
    expect(raiz).toBe(primeira.conferencia.origin.threadCommentId);

    const r = resolveTaskComment(state, MARCOS_PAULO, conta.id, raiz, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(RECUSA);
    expect(raizDe(raiz)?.resolved).toBeUndefined();
  });
});

describe("(c) um revisor do Resumo resolve, mesmo sem ser o aprovador", () => {
  it("a Maryane (revisora, Papel base membro) resolve o fio cuja aprovadora não é ela", () => {
    const { conferencia } = publicar({ avisarId: MARCOS_PAULO });
    const maryane = state.members.find((m) => m.id === CP.financeiroId);
    const base = state.roles.find((r) => r.id === maryane?.roleId)?.base;
    expect(base).toBe("membro");
    expect(conferencia.approverMemberId).toBe(MARCOS_PAULO);
    const raiz = conferencia.origin.threadCommentId;
    const r = resolveTaskComment(state, CP.financeiroId, conta.id, raiz, true);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(raizDe(raiz)?.resolved?.by).toBe(CP.financeiroId);
  });
});

describe("(d) ninguém reabre pela exceção", () => {
  it("o aprovador resolve e não reabre; o autor delegado (Proprietário) reabre", () => {
    const { conferencia } = publicar({ avisarId: MARCOS_PAULO });
    const raiz = conferencia.origin.threadCommentId;
    expect(resolveTaskComment(state, MARCOS_PAULO, conta.id, raiz, true).ok).toBe(true);

    const reabrir = resolveTaskComment(state, MARCOS_PAULO, conta.id, raiz, false);
    expect(reabrir.ok).toBe(false);
    if (!reabrir.ok) expect(reabrir.error).toBe(RECUSA);
    expect(raizDe(raiz)?.resolved?.by).toBe(MARCOS_PAULO);

    const peloAutor = resolveTaskComment(state, PUBLICADOR, conta.id, raiz, false);
    expect(peloAutor.ok, peloAutor.ok ? "" : peloAutor.error).toBe(true);
    expect(raizDe(raiz)?.resolved).toBeUndefined();
  });
});

describe("(e) a exceção não vaza para outro fio", () => {
  it("um Comentário raiz comum de mem_thiago não se resolve pelo Marcos Paulo", () => {
    publicar({ avisarId: MARCOS_PAULO });
    const comum = addTaskComment(state, PUBLICADOR, conta.id, { content: "um fio qualquer" });
    if (!comum.ok) throw new Error(comum.error);
    const r = resolveTaskComment(state, MARCOS_PAULO, conta.id, comum.value.id, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(RECUSA);
  });
});
