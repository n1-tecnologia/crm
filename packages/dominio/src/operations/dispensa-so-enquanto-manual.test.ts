/**
 * crm2:CR-01 e crm2:IN-01, lado do domínio (06-18 Task 1).
 *
 * A dispensa D6-04 (`sem-conferencia`) é DADO da Conferência
 * (`decisionWaiver = "integracaoManual"`), e só vale enquanto o Campo
 * "Integração manual" da conta é "Manual": desmarcado, ninguém conferiu nada,
 * e a Conferência dispensada passa a ser `desatualizada` para todo consumidor
 * (ponte, `registrarLancamentoNoOmie`, tela). `dispensarConferenciaDoResumo`
 * decide sobre o estado RECEBIDO (dentro da Unidade de Trabalho, o da
 * gravação), nunca sobre um snapshot.
 *
 * E o fio único (crm2:IN-01): depois de `superarConferencia`, o Resumo novo é
 * resposta no fio da Conferência mais recente (mesmo cancelada), não um fio
 * novo com o texto de primeira chamada.
 *
 * O Resumo dispensado é publicado como a ponte publica: pelo Membro de serviço
 * (`mem_thiago` nos testes), com ele mesmo como aprovador (`avisarId`).
 *
 * Arquivo novo (CON-05). Puro, sem I/O.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { decideProcessApproval } from "./ai";
import {
  CP,
  MOTIVO_DA_DISPENSA,
  TEXTOS_DA_CONFERENCIA,
  conferenciaDoResumo,
  dispensaDaConferencia,
  dispensaSemManual,
  dispensarConferenciaDoResumo,
  publicarResumoParaConferencia,
  registrarFalhaDoLancamento,
  registrarLancamentoNoOmie,
  type ConferenciaDoResumo,
  type DeParaDeLancamento,
} from "./financeiro";
import { changeTaskStatus, setTaskFieldValue } from "./tasks";

const SERVICO = "mem_thiago";
const MARYANE = CP.financeiroId;
const NOME_DA_MARYANE = "Maryane Generozo";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};
const DE_PARA_SEM_CODIGO: DeParaDeLancamento = { contaPorTag: { "conta tria": "TRIA" }, categoriaPorCampo: {}, origem: "omie" };

let state: DataState;
let conta: Task;

function manual(valor: "Manual" | null): void {
  const r = setTaskFieldValue(state, MARYANE, conta.id, CP.fields.integracaoManual, valor);
  if (!r.ok) throw new Error(r.error);
}

function publicarDispensavel(dePara: DeParaDeLancamento = DE_PARA): ConferenciaDoResumo {
  const p = publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara, avisarId: SERVICO });
  if (!p.ok) throw new Error(p.error);
  return p.value.conferencia;
}

const retrato = () => ({
  comments: conta.comments.length,
  activity: state.activity.length,
  approvals: state.approvals.length,
  executions: state.agentExecutions.length,
  statusId: conta.statusId,
  decisoes: state.approvals.map((a) => [a.id, a.decision ?? null, a.decisionWaiver ?? null]),
});

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
});

describe("(a) a dispensa é um dado", () => {
  it("conta Manual: aprovada por clique, com o motivo e decisionWaiver = integracaoManual; conferida; Registro \"Aprovação decidida\"", () => {
    manual("Manual");
    const conf = publicarDispensavel();
    expect(conf.approverMemberId).toBe(SERVICO);
    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conf.decision).toBe("aprovada");
    expect(conf.decisionSource).toBe("click");
    expect(conf.decisionReason).toBe(MOTIVO_DA_DISPENSA);
    expect(conf.decisionWaiver).toBe("integracaoManual");
    expect(conferenciaDoResumo(state, conta).estado).toBe("conferida");
    expect(state.activity.filter((a) => a.objectId === conf.id && a.action === "Aprovação decidida")).toHaveLength(1);
  });
});

describe("(b) desmarcar \"Manual\" desfaz o que a dispensa cobria", () => {
  it("desatualizada; registrarLancamentoNoOmie recusa sem efeito; \"Manual\" de volta ⇒ conferida de novo", () => {
    manual("Manual");
    const conf = publicarDispensavel();
    const d = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    if (!d.ok) throw new Error(d.error);

    manual(null);
    expect(conferenciaDoResumo(state, conta).estado).toBe("desatualizada");
    expect(dispensaSemManual(conta, conf)).toBe(true);

    const m = changeTaskStatus(state, MARYANE, conta.id, CP.status.emLancamento);
    if (!m.ok) throw new Error(m.error);
    const antes = retrato();
    const r = registrarLancamentoNoOmie(state, SERVICO, conta.id, { payableId: "4100000001", reaproveitado: false, anexos: [] });
    expect(r.ok).toBe(false);
    expect(retrato()).toEqual(antes);
    expect(conta.statusId).toBe(CP.status.emLancamento);

    manual("Manual");
    expect(dispensaSemManual(conta, conf)).toBe(false);
    expect(conferenciaDoResumo(state, conta).estado).toBe("conferida");
  });
});

describe("(c) conta que não é \"Manual\" não se dispensa", () => {
  it("recusa com recusaDispensaSemManual, sem efeito; a Conferência continua pendente", () => {
    const conf = publicarDispensavel();
    const antes = retrato();
    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDispensaSemManual);
    expect(retrato()).toEqual(antes);
    expect(conf.decision).toBeUndefined();
    expect(conferenciaDoResumo(state, conta).estado).toBe("pendente");
  });
});

describe("(d) Resumo sem código numa conta Manual", () => {
  it("recusa com recusaSemCodigo, sem decisionWaiver", () => {
    manual("Manual");
    const conf = publicarDispensavel(DE_PARA_SEM_CODIGO);
    const antes = retrato();
    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaSemCodigo);
    expect(conf.decisionWaiver).toBeUndefined();
    expect(retrato()).toEqual(antes);
  });
});

describe("(e) a aprovação humana não depende do Campo", () => {
  it("clique da Maryane: marcar e desmarcar \"Manual\" não muda conferida", () => {
    const p = publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA });
    if (!p.ok) throw new Error(p.error);
    const d = decideProcessApproval(state, MARYANE, p.value.conferencia.id, "aprovada", { source: "click" });
    if (!d.ok) throw new Error(d.error);
    expect(dispensaDaConferencia(p.value.conferencia)).toBe(false);
    manual("Manual");
    expect(conferenciaDoResumo(state, conta).estado).toBe("conferida");
    manual(null);
    expect(conferenciaDoResumo(state, conta).estado).toBe("conferida");
  });
});

describe("(f) a leitura de compatibilidade (registros de antes de 06-18), fail-closed", () => {
  it("aprovada sem decisionWaiver, com MOTIVO_DA_DISPENSA e decisor = aprovador ⇒ é dispensa, e sem \"Manual\" vira desatualizada", () => {
    manual("Manual");
    const conf = publicarDispensavel();
    // A forma que a ponte gravava antes de 06-18: `decideProcessApproval` direto.
    const d = decideProcessApproval(state, SERVICO, conf.id, "aprovada", { source: "click", reason: MOTIVO_DA_DISPENSA });
    if (!d.ok) throw new Error(d.error);
    expect(conf.decisionWaiver).toBeUndefined();
    expect(dispensaDaConferencia(conf)).toBe(true);
    expect(conferenciaDoResumo(state, conta).estado).toBe("conferida");
    manual(null);
    expect(conferenciaDoResumo(state, conta).estado).toBe("desatualizada");

    expect(dispensaDaConferencia({ ...conf, decisionReason: "conferido à mão" })).toBe(false);
    expect(dispensaDaConferencia({ ...conf, decidedByMemberId: MARYANE })).toBe(false);
    expect(dispensaDaConferencia({ ...conf, decision: "rejeitada" })).toBe(false);
  });
});

describe("(g) a dispensa desmarcada: o Resumo novo vai a uma pessoa, no mesmo fio", () => {
  it("motivo dados-mudaram ⇒ resposta no fio, dadosMudaram(Maryane), aprovadora a Maryane, pendente e vigente", () => {
    manual("Manual");
    const conf = publicarDispensavel();
    const d = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    if (!d.ok) throw new Error(d.error);
    manual(null);

    const p = publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA, motivo: "dados-mudaram" });
    expect(p.ok, p.ok ? "" : p.error).toBe(true);
    if (!p.ok) return;
    expect(p.value.conferencia.id).not.toBe(conf.id);
    expect(p.value.comentario.parentCommentId).toBe(conf.origin.threadCommentId);
    expect(p.value.comentario.content.endsWith(TEXTOS_DA_CONFERENCIA.dadosMudaram(NOME_DA_MARYANE))).toBe(true);
    expect(p.value.conferencia.approverMemberId).toBe(CP.financeiroId);
    expect(conferenciaDoResumo(state, conta)).toMatchObject({ estado: "pendente", conferencia: { id: p.value.conferencia.id } });
  });
});

describe("(h) crm2:IN-01 — depois da superação, o Resumo novo é resposta no fio de antes", () => {
  it("resposta no fio de C1, com superada(Maryane) e o pedido do ok; o fio reaberto; um só Comentário raiz de Resumo", () => {
    const p1 = publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA });
    if (!p1.ok) throw new Error(p1.error);
    const c1 = p1.value.conferencia;
    const d = decideProcessApproval(state, MARYANE, c1.id, "aprovada", { source: "click" });
    if (!d.ok) throw new Error(d.error);
    const m = changeTaskStatus(state, MARYANE, conta.id, CP.status.emLancamento);
    if (!m.ok) throw new Error(m.error);
    const f = registrarFalhaDoLancamento(
      state,
      SERVICO,
      conta.id,
      { motivo: TEXTOS_DA_CONFERENCIA.contaDivergente("TRIA", "TRIA COMPANY - ITAU"), code: "CONTA_DIVERGENTE" },
      { superarConferencia: true },
    );
    if (!f.ok) throw new Error(f.error);
    expect(c1.decision).toBe("cancelada");
    const reabertosAntes = state.activity.filter((a) => a.objectId === conta.id && a.action === "Comentário reaberto").length;

    const p2 = publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA });
    expect(p2.ok, p2.ok ? "" : p2.error).toBe(true);
    if (!p2.ok) return;
    const conteudo = p2.value.comentario.content;
    expect(p2.value.comentario.parentCommentId).toBe(c1.origin.threadCommentId);
    expect(p2.value.conferencia.origin.threadCommentId).toBe(c1.origin.threadCommentId);
    expect(conteudo).toContain(TEXTOS_DA_CONFERENCIA.superada(NOME_DA_MARYANE));
    expect(conteudo).toContain('confira: responda "ok" para eu lançar');
    expect(conteudo).not.toContain("Revisado a pedido de");

    const raiz = conta.comments.find((c) => c.id === c1.origin.threadCommentId);
    expect(raiz?.resolved).toBeUndefined();
    expect(state.activity.filter((a) => a.objectId === conta.id && a.action === "Comentário reaberto")).toHaveLength(reabertosAntes + 1);

    const raizesDeResumo = conta.comments.filter(
      (c) => !c.deletedAt && c.author.kind === "agent" && !c.parentCommentId && c.content.startsWith("📋 RESUMO DE PAGAMENTO"),
    );
    expect(raizesDeResumo).toHaveLength(1);
  });
});
