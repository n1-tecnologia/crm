/**
 * crm2:WR-04, lado do domínio (06-19 Task 1).
 *
 * A porta de teste G3 (`avisarId`) cai em silêncio na regra de sempre quando
 * o Membro indicado não é ativo (`avisadoDaConferencia`): a Maryane vira
 * aprovadora e recebe a Menção. Com `avisarEstrito: true`, que a ponte passa
 * sempre que tem `avisarId`, a operação RECUSA sem efeito
 * (`TEXTOS_DA_CONFERENCIA.recusaAvisarInativo`) — a porta falha fechada
 * também no meio do ciclo. Sem a opção, nada muda.
 *
 * Arquivo novo (CON-05). Puro, sem I/O.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Member, Task } from "../types";
import { decideProcessApproval } from "./ai";
import { CP, TEXTOS_DA_CONFERENCIA, publicarResumoParaConferencia, registrarFalhaDoLancamento, type DeParaDeLancamento } from "./financeiro";
import { changeTaskStatus } from "./tasks";

const ATOR = "mem_thiago";
const MARYANE = CP.financeiroId;
const WALTER = "mem_walter";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

let state: DataState;
let conta: Task;
let walter: Member;

const retrato = () => ({
  comments: conta.comments.length,
  activity: state.activity.length,
  approvals: state.approvals.length,
  executions: state.agentExecutions.length,
  statusId: conta.statusId,
});

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
  const w = state.members.find((m) => m.id === WALTER);
  if (!w) throw new Error("sem mem_walter");
  walter = w;
});

describe("(j) publicarResumoParaConferencia com avisarEstrito", () => {
  it("mem_walter removido + estrito ⇒ recusaAvisarInativo, sem efeito", () => {
    walter.state = "removido";
    const antes = retrato();
    const r = publicarResumoParaConferencia(state, ATOR, conta.id, { dePara: DE_PARA, avisarId: WALTER, avisarEstrito: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaAvisarInativo);
    expect(retrato()).toEqual(antes);
  });

  it("estrito recusa antes da idempotência: com uma Conferência pendente já publicada, também recusa", () => {
    const p = publicarResumoParaConferencia(state, ATOR, conta.id, { dePara: DE_PARA, avisarId: WALTER, avisarEstrito: true });
    if (!p.ok) throw new Error(p.error);
    walter.state = "removido";
    const antes = retrato();
    const r = publicarResumoParaConferencia(state, ATOR, conta.id, { dePara: DE_PARA, avisarId: WALTER, avisarEstrito: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaAvisarInativo);
    expect(retrato()).toEqual(antes);
  });

  it("sem avisarEstrito: o comportamento de sempre (aprovadora a Maryane)", () => {
    walter.state = "removido";
    const r = publicarResumoParaConferencia(state, ATOR, conta.id, { dePara: DE_PARA, avisarId: WALTER });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(r.value.conferencia.approverMemberId).toBe(MARYANE);
  });

  it("mem_walter ativo + estrito ⇒ aprovador mem_walter, Menção a ele", () => {
    const r = publicarResumoParaConferencia(state, ATOR, conta.id, { dePara: DE_PARA, avisarId: WALTER, avisarEstrito: true });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) {
      expect(r.value.conferencia.approverMemberId).toBe(WALTER);
      expect(r.value.comentario.mentions).toEqual([{ type: "member", id: WALTER }]);
    }
  });
});

describe("(k) registrarFalhaDoLancamento com avisarEstrito", () => {
  beforeEach(() => {
    const p = publicarResumoParaConferencia(state, ATOR, conta.id, { dePara: DE_PARA, avisarId: WALTER, avisarEstrito: true });
    if (!p.ok) throw new Error(p.error);
    const d = decideProcessApproval(state, WALTER, p.value.conferencia.id, "aprovada", { source: "click" });
    if (!d.ok) throw new Error(d.error);
    const m = changeTaskStatus(state, MARYANE, conta.id, CP.status.emLancamento);
    if (!m.ok) throw new Error(m.error);
  });

  it("mem_walter removido + estrito ⇒ recusaAvisarInativo; Status e retrato iguais", () => {
    walter.state = "removido";
    const antes = retrato();
    const r = registrarFalhaDoLancamento(state, ATOR, conta.id, { motivo: "o Omie recusou", code: "OMIE_RECUSOU" }, { avisarId: WALTER, avisarEstrito: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaAvisarInativo);
    expect(retrato()).toEqual(antes);
    expect(conta.statusId).toBe(CP.status.emLancamento);
  });

  it("mem_walter ativo + estrito ⇒ Menção a mem_walter, nenhuma à Maryane", () => {
    const antes = conta.comments.length;
    const r = registrarFalhaDoLancamento(state, ATOR, conta.id, { motivo: "o Omie recusou", code: "OMIE_RECUSOU" }, { avisarId: WALTER, avisarEstrito: true });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const novos = conta.comments.slice(antes);
    expect(novos).toHaveLength(1);
    expect(novos[0]?.mentions).toEqual([{ type: "member", id: WALTER }]);
    expect(conta.statusId).toBe(CP.status.paraPagar);
  });
});
