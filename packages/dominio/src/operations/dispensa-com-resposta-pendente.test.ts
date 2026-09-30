/**
 * crm2:CR-01 residual (06-REVIEW-3 Crítico), lado do domínio (06-21 Task 1).
 *
 * Remarcar "Manual" depois de um humano já ter respondido no fio (ajuste ou
 * aprovação) para a Conferência vigente NUNCA dispensa essa resposta.
 * `dispensarConferenciaDoResumo` recusa (`recusaDispensaComRespostaPendente`)
 * quando há, no fio da Conferência vigente, uma resposta de Membro ainda não
 * processada (`decisaoDasRespostasPendentes(state, task, { aprovacaoPorComentario:
 * true }).sentido !== "nenhum"`).
 *
 * Arquivo novo (CON-05). Puro, sem I/O.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import {
  CP,
  TEXTOS_DA_CONFERENCIA,
  conferenciaDoResumo,
  decisaoDasRespostasPendentes,
  dispensarConferenciaDoResumo,
  publicarResumoParaConferencia,
  type DeParaDeLancamento,
} from "./financeiro";
import { decideProcessApproval } from "./ai";
import { addTaskComment, setTaskFieldValue } from "./tasks";

const SERVICO = "mem_thiago";
const MARYANE = CP.financeiroId;

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

let state: DataState;
let conta: Task;

function manual(valor: "Manual" | null): void {
  const r = setTaskFieldValue(state, MARYANE, conta.id, CP.fields.integracaoManual, valor);
  if (!r.ok) throw new Error(r.error);
}

// Sem `avisarId`: o aprovador default é CP.financeiroId (Maryane) — o Membro
// que responde nos casos (a)-(c)/(e). `dispensarConferenciaDoResumo` é chamado
// com SERVICO (proprietário), que sempre pode decidir, então a dispensa em
// si não depende de quem é o aprovador — só a LEITURA do fio depende.
function publicarDispensavel(): ReturnType<typeof publicarResumoParaConferencia> {
  return publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA });
}

function responderNoFio(memberId: string, texto: string, threadCommentId: string) {
  const r = addTaskComment(state, memberId, conta.id, { content: texto, parentCommentId: threadCommentId });
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

const retrato = () => ({
  comments: conta.comments.length,
  activity: state.activity.length,
  approvals: state.approvals.length,
  decisoes: state.approvals.map((a) => [a.id, a.decision ?? null, a.decidedByMemberId ?? null]),
});

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
});

describe("(a) ajuste pendente no fio bloqueia a dispensa", () => {
  it("fail com recusaDispensaComRespostaPendente; a Conferência continua pendente, sem decision", () => {
    manual("Manual");
    const p = publicarDispensavel();
    if (!p.ok) throw new Error(p.error);
    const conf = p.value.conferencia;
    responderNoFio(MARYANE, "ajuste: usa a conta 1.02.02", conf.origin.threadCommentId);

    const antes = retrato();
    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente);
    expect(retrato()).toEqual(antes);
    expect(conf.decision).toBeUndefined();
    expect(conferenciaDoResumo(state, conta).estado).toBe("pendente");
  });
});

describe("(b) aprovação pendente no fio também bloqueia a dispensa", () => {
  it("fail com recusaDispensaComRespostaPendente mesmo para um \"ok\"", () => {
    manual("Manual");
    const p = publicarDispensavel();
    if (!p.ok) throw new Error(p.error);
    const conf = p.value.conferencia;
    responderNoFio(MARYANE, "ok, pode lançar", conf.origin.threadCommentId);

    const antes = retrato();
    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente);
    expect(retrato()).toEqual(antes);
    expect(conf.decision).toBeUndefined();
  });
});

describe("(c) mesmo com a conferência por comentário desligada, o ajuste ainda bloqueia", () => {
  it("dispensarConferenciaDoResumo usa aprovacaoPorComentario: true fixo — o ramo ajuste de decisaoDasRespostasPendentes ignora essa opção", () => {
    manual("Manual");
    const p = publicarDispensavel();
    if (!p.ok) throw new Error(p.error);
    const conf = p.value.conferencia;
    responderNoFio(MARYANE, "ajuste: fornecedor errado", conf.origin.threadCommentId);

    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente);
  });
});

describe("(d) sem resposta pendente, a dispensa continua funcionando (não regride 06-18)", () => {
  it("ok; aprovada com decisionWaiver = integracaoManual", () => {
    manual("Manual");
    const p = publicarDispensavel();
    if (!p.ok) throw new Error(p.error);
    const conf = p.value.conferencia;
    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conf.decision).toBe("aprovada");
    expect(conf.decisionWaiver).toBe("integracaoManual");
  });
});

describe("(e) resposta pendente já lida não bloqueia", () => {
  it("depois de decideProcessApproval consumir a resposta do fio, uma dispensa sobre a Conferência SEGUINTE não vê resposta pendente", () => {
    manual("Manual");
    const p1 = publicarDispensavel();
    if (!p1.ok) throw new Error(p1.error);
    const conf1 = p1.value.conferencia;
    responderNoFio(MARYANE, "ok, pode lançar", conf1.origin.threadCommentId);

    // A resposta decide a Conferência 1 (via decideProcessApproval, como a ponte faria ao ler o fio).
    const lida = decisaoDasRespostasPendentes(state, conta, { aprovacaoPorComentario: true });
    expect(lida.sentido).toBe("aprovacao");
    if (lida.sentido !== "aprovacao") return;
    const dec = decideProcessApproval(state, lida.resposta.author.kind === "member" ? lida.resposta.author.id : MARYANE, conf1.id, "aprovada", {
      source: "comment",
      reason: lida.resposta.content.trim(),
    });
    if (!dec.ok) throw new Error(dec.error);
    expect(conferenciaDoResumo(state, conta)).toMatchObject({ estado: "conferida", conferencia: { id: conf1.id } });

    // Nenhuma Conferência pendente sobra: dispensar de novo (mesma, já decidida) recusa por outro motivo,
    // não por resposta pendente — prova que a resposta lida não bloqueia mais nada.
    const r = dispensarConferenciaDoResumo(state, SERVICO, conf1.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toBe(TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente);
  });
});
