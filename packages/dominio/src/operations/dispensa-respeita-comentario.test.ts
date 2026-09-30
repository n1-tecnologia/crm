/**
 * 06-22 — crm2:WR-01 residual (06-REVIEW-4 Aviso): a checagem de resposta
 * pendente que bloqueia `dispensarConferenciaDoResumo` (06-21) passava
 * `aprovacaoPorComentario: true` fixo, mesmo quando a política REAL do
 * espaço de trabalho (`conferenciaPorComentario`, D6-02) está desligada —
 * travando a dispensa `sem-conferencia` (D6-04) para sempre atrás de um "ok"
 * trivial que a própria política já diz não valer como decisão.
 *
 * Este arquivo prova o lado do domínio: `dispensarConferenciaDoResumo` ganha
 * um 4º parâmetro opcional `opcoes?.aprovacaoPorComentario` (padrão `true`,
 * sem regressão para quem chama sem ele) que governa só o ramo `aprovacao`
 * da checagem — o ramo `ajuste` continua bloqueando em qualquer política.
 *
 * Molde de fixtures: `dispensa-com-resposta-pendente.test.ts` (06-21, NÃO
 * editado por este plano). Arquivo novo (CON-05). Puro, sem I/O.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { CP, TEXTOS_DA_CONFERENCIA, conferenciaDoResumo, dispensarConferenciaDoResumo, publicarResumoParaConferencia, type DeParaDeLancamento } from "./financeiro";
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
// que responde nos casos abaixo. `dispensarConferenciaDoResumo` é chamado com
// SERVICO (proprietário), que sempre pode decidir, então a dispensa em si não
// depende de quem é o aprovador — só a LEITURA do fio depende.
function publicarDispensavel(): ReturnType<typeof publicarResumoParaConferencia> {
  return publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA });
}

function responderNoFio(memberId: string, texto: string, threadCommentId: string) {
  const r = addTaskComment(state, memberId, conta.id, { content: texto, parentCommentId: threadCommentId });
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
});

describe('(a) "ok" pendente não bloqueia com a política desligada (opcoes.aprovacaoPorComentario: false)', () => {
  it("a dispensa é ACEITA, como se não houvesse resposta nenhuma", () => {
    manual("Manual");
    const p = publicarDispensavel();
    if (!p.ok) throw new Error(p.error);
    const conf = p.value.conferencia;
    responderNoFio(MARYANE, "ok, pode lançar", conf.origin.threadCommentId);

    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id, { aprovacaoPorComentario: false });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conf.decision).toBe("aprovada");
    expect(conf.decisionWaiver).toBe("integracaoManual");
    expect(conferenciaDoResumo(state, conta).estado).toBe("conferida");
  });
});

describe("(b) um ajuste de verdade continua bloqueando em qualquer política", () => {
  it("fail com recusaDispensaComRespostaPendente mesmo com aprovacaoPorComentario: false", () => {
    manual("Manual");
    const p = publicarDispensavel();
    if (!p.ok) throw new Error(p.error);
    const conf = p.value.conferencia;
    responderNoFio(MARYANE, "ajuste: usa a conta 1.02.02", conf.origin.threadCommentId);

    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id, { aprovacaoPorComentario: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente);
    expect(conf.decision).toBeUndefined();
    expect(conferenciaDoResumo(state, conta).estado).toBe("pendente");
  });
});

describe("(c) sem passar o 4º argumento, o comportamento de 06-21 continua idêntico", () => {
  it('um "ok" pendente BLOQUEIA a dispensa (padrão true, sem regressão)', () => {
    manual("Manual");
    const p = publicarDispensavel();
    if (!p.ok) throw new Error(p.error);
    const conf = p.value.conferencia;
    responderNoFio(MARYANE, "ok, pode lançar", conf.origin.threadCommentId);

    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente);
    expect(conf.decision).toBeUndefined();
  });
});

describe("(d) aprovacaoPorComentario: true explícito é idêntico ao padrão", () => {
  it('mesmo resultado de (c): um "ok" pendente BLOQUEIA a dispensa', () => {
    manual("Manual");
    const p = publicarDispensavel();
    if (!p.ok) throw new Error(p.error);
    const conf = p.value.conferencia;
    responderNoFio(MARYANE, "ok, pode lançar", conf.origin.threadCommentId);

    const r = dispensarConferenciaDoResumo(state, SERVICO, conf.id, { aprovacaoPorComentario: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente);
    expect(conf.decision).toBeUndefined();
  });
});
