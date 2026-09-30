/**
 * crm2:WR-01, lado do domínio (06-19 Task 1).
 *
 * Antes do `/lancar`, a ponte grava a marca "Lançamento no Omie em curso" —
 * um Registro de Atividade do Agente em nome do Membro de serviço. Enquanto
 * ela vale (até o registro, a falha, o encerramento ou o prazo), nenhum OUTRO
 * Membro muda o Status da conta nem registra o lançamento à mão pelo diálogo
 * "Lançado no Omie": a mesma recusa na tela e no endpoint, porque mora em
 * `changeTaskStatus` e `addTaskComment`.
 *
 * `ATOR` (`mem_thiago`) faz o Membro de serviço, como nos testes da ponte.
 *
 * Arquivo novo (CON-05). Puro, sem I/O.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { ActivityRecord, Task } from "../types";
import { decideProcessApproval } from "./ai";
import {
  CP,
  PRAZO_DO_LANCAMENTO_EM_CURSO_MS,
  RECUSA_LANCAMENTO_EM_CURSO,
  REGISTRO_LANCADO_NO_OMIE,
  REGISTRO_LANCAMENTO_EM_CURSO,
  REGISTRO_LANCAMENTO_FALHOU,
  REGISTRO_LANCAMENTO_INTERROMPIDO,
  conferenciaDoResumo,
  encerrarLancamentoEmCurso,
  lancamentoEmCursoDe,
  marcarLancamentoEmCurso,
  publicarResumoParaConferencia,
  registrarFalhaDoLancamento,
  registrarLancamentoNoOmie,
  textoDoLancamentoHumano,
  type DeParaDeLancamento,
} from "./financeiro";
import { addTaskComment, changeTaskStatus, setTaskFieldValue } from "./tasks";

const ATOR = "mem_thiago";
const MARYANE = CP.financeiroId;

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};
const RESULTADO = { payableId: "4100000001", reaproveitado: false, anexos: [] } as const;
const HUMANO = textoDoLancamentoHumano({ conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" });

let state: DataState;
let conta: Task;

const retrato = () => ({
  comments: conta.comments.length,
  activity: state.activity.length,
  approvals: state.approvals.length,
  executions: state.agentExecutions.length,
  statusId: conta.statusId,
});

const registrosDa = (acao: string): ActivityRecord[] =>
  state.activity.filter((a) => a.objectType === "task" && a.objectId === conta.id && a.action === acao);

function marcar(): void {
  const r = marcarLancamentoEmCurso(state, ATOR, conta.id);
  if (!r.ok) throw new Error(r.error);
}

/** Troca o Registro `id` por uma cópia com outro `at` (o Registro é `readonly`). */
function reescreverAt(acao: string, at: string): void {
  const i = state.activity.findIndex((a) => a.objectType === "task" && a.objectId === conta.id && a.action === acao);
  if (i < 0) throw new Error(`sem ${acao}`);
  state.activity[i] = { ...state.activity[i]!, at };
}

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
  const p = publicarResumoParaConferencia(state, ATOR, conta.id, { dePara: DE_PARA });
  if (!p.ok) throw new Error(p.error);
  const d = decideProcessApproval(state, MARYANE, p.value.conferencia.id, "aprovada", { source: "click" });
  if (!d.ok) throw new Error(d.error);
  const m = changeTaskStatus(state, MARYANE, conta.id, CP.status.emLancamento);
  if (!m.ok) throw new Error(m.error);
  expect(conferenciaDoResumo(state, conta).estado).toBe("conferida");
});

describe("(a) a marca", () => {
  it("Registro do Agente em nome do Membro de serviço; lancamentoEmCursoDe devolve desde, até e quem", () => {
    const r = marcarLancamentoEmCurso(state, ATOR, conta.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const [marca, ...outras] = registrosDa(REGISTRO_LANCAMENTO_EM_CURSO);
    expect(outras).toHaveLength(0);
    expect(marca?.actor).toEqual({ kind: "agent", id: CP.agentId });
    expect(marca?.delegate).toEqual({ kind: "member", id: ATOR });
    const emCurso = lancamentoEmCursoDe(state, conta);
    expect(emCurso).toBeDefined();
    expect(emCurso?.porMembroId).toBe(ATOR);
    expect(emCurso?.desde).toBe(marca?.at);
    expect(Date.parse(emCurso?.ate ?? "") - Date.parse(emCurso?.desde ?? "")).toBe(PRAZO_DO_LANCAMENTO_EM_CURSO_MS);
  });

  it("sem marca, nada em curso", () => {
    expect(lancamentoEmCursoDe(state, conta)).toBeUndefined();
  });
});

describe("(b) com a marca, outro Membro não muda o Status", () => {
  it("recusa RECUSA_LANCAMENTO_EM_CURSO, sem efeito; o mesmo Status não é recusado pela marca", () => {
    marcar();
    const antes = retrato();
    const r = changeTaskStatus(state, MARYANE, conta.id, CP.status.paraPagar);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(RECUSA_LANCAMENTO_EM_CURSO);
    expect(retrato()).toEqual(antes);
    expect(conta.statusId).toBe(CP.status.emLancamento);

    const mesmo = changeTaskStatus(state, MARYANE, conta.id, CP.status.emLancamento);
    if (!mesmo.ok) expect(mesmo.error).not.toBe(RECUSA_LANCAMENTO_EM_CURSO);
  });
});

describe("(c) quem marcou passa", () => {
  it("registrarFalhaDoLancamento pelo Membro de serviço volta a conta para \"para pagar\" e encerra a marca", () => {
    marcar();
    const r = registrarFalhaDoLancamento(state, ATOR, conta.id, { motivo: "o Omie recusou", code: "OMIE_RECUSOU" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.statusId).toBe(CP.status.paraPagar);
    expect(registrosDa(REGISTRO_LANCAMENTO_FALHOU)).toHaveLength(1);
    expect(lancamentoEmCursoDe(state, conta)).toBeUndefined();
  });
});

describe("(d) com a marca, o registro humano do lançamento é recusado", () => {
  it("o texto do diálogo \"Lançado no Omie\" é recusado; um Comentário comum passa; o Agente não é recusado pela marca", () => {
    marcar();
    const antes = retrato();
    const humano = addTaskComment(state, MARYANE, conta.id, { content: HUMANO });
    expect(humano.ok).toBe(false);
    if (!humano.ok) expect(humano.error).toBe(RECUSA_LANCAMENTO_EM_CURSO);
    expect(retrato()).toEqual(antes);

    const comum = addTaskComment(state, MARYANE, conta.id, { content: "Estou acompanhando." });
    expect(comum.ok, comum.ok ? "" : comum.error).toBe(true);

    const doAgente = addTaskComment(state, MARYANE, conta.id, { content: HUMANO, actor: { kind: "agent", id: CP.agentId } });
    if (!doAgente.ok) expect(doAgente.error).not.toBe(RECUSA_LANCAMENTO_EM_CURSO);
  });
});

describe("(e) o registro do lançamento encerra a marca", () => {
  it("\"lançado omie\"; sem marca; a Maryane move a conta livremente depois", () => {
    marcar();
    const r = registrarLancamentoNoOmie(state, ATOR, conta.id, RESULTADO);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(conta.statusId).toBe(CP.status.lancado);
    expect(registrosDa(REGISTRO_LANCADO_NO_OMIE)).toHaveLength(1);
    expect(lancamentoEmCursoDe(state, conta)).toBeUndefined();
    const m = changeTaskStatus(state, MARYANE, conta.id, CP.status.emRemessa);
    if (!m.ok) expect(m.error).not.toBe(RECUSA_LANCAMENTO_EM_CURSO);
  });
});

describe("(f) encerrarLancamentoEmCurso", () => {
  it("Registro \"interrompido\" com o código; a marca sai", () => {
    marcar();
    const r = encerrarLancamentoEmCurso(state, ATOR, conta.id, "OMIE_INDISPONIVEL");
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const [interrompido, ...outros] = registrosDa(REGISTRO_LANCAMENTO_INTERROMPIDO);
    expect(outros).toHaveLength(0);
    expect(interrompido?.detail).toBe("OMIE_INDISPONIVEL");
    expect(interrompido?.actor).toEqual({ kind: "agent", id: CP.agentId });
    expect(interrompido?.delegate).toEqual({ kind: "member", id: ATOR });
    expect(lancamentoEmCursoDe(state, conta)).toBeUndefined();
    const m = changeTaskStatus(state, MARYANE, conta.id, CP.status.paraPagar);
    expect(m.ok, m.ok ? "" : m.error).toBe(true);
  });

  it("sem marca vigente: recusa sem efeito", () => {
    const antes = retrato();
    const r = encerrarLancamentoEmCurso(state, ATOR, conta.id, "OMIE_INDISPONIVEL");
    expect(r.ok).toBe(false);
    expect(retrato()).toEqual(antes);
  });

  it("marca de outro Membro: recusa sem efeito, e a marca continua", () => {
    marcar();
    const antes = retrato();
    const r = encerrarLancamentoEmCurso(state, MARYANE, conta.id, "OMIE_INDISPONIVEL");
    expect(r.ok).toBe(false);
    expect(retrato()).toEqual(antes);
    expect(lancamentoEmCursoDe(state, conta)?.porMembroId).toBe(ATOR);
  });
});

describe("(g) o prazo", () => {
  it("a marca vencida não vale; a Maryane move", () => {
    marcar();
    const velho = new Date(Date.now() - PRAZO_DO_LANCAMENTO_EM_CURSO_MS - 1_000).toISOString();
    reescreverAt(REGISTRO_LANCAMENTO_EM_CURSO, velho);
    expect(lancamentoEmCursoDe(state, conta)).toBeUndefined();
    const m = changeTaskStatus(state, MARYANE, conta.id, CP.status.paraPagar);
    expect(m.ok, m.ok ? "" : m.error).toBe(true);
  });

  it("`agora` explícito decide pelo instante passado", () => {
    marcar();
    const desde = lancamentoEmCursoDe(state, conta)?.desde ?? "";
    const dentro = new Date(Date.parse(desde) + PRAZO_DO_LANCAMENTO_EM_CURSO_MS - 1).toISOString();
    const fora = new Date(Date.parse(desde) + PRAZO_DO_LANCAMENTO_EM_CURSO_MS + 1).toISOString();
    expect(lancamentoEmCursoDe(state, conta, dentro)?.porMembroId).toBe(ATOR);
    expect(lancamentoEmCursoDe(state, conta, fora)).toBeUndefined();
  });
});

describe("(h) desempate no mesmo milissegundo", () => {
  it("marca e \"Lançado no Omie\" com o mesmo `at`: vale o de maior sequência (o mais novo) — encerrada", () => {
    marcar();
    const r = registrarLancamentoNoOmie(state, ATOR, conta.id, RESULTADO);
    if (!r.ok) throw new Error(r.error);
    const mesmo = new Date().toISOString();
    reescreverAt(REGISTRO_LANCAMENTO_EM_CURSO, mesmo);
    reescreverAt(REGISTRO_LANCADO_NO_OMIE, mesmo);
    // A ordem no array não decide: a marca vai para o começo, como se fosse a mais nova por posição.
    const i = state.activity.findIndex((a) => a.objectId === conta.id && a.action === REGISTRO_LANCAMENTO_EM_CURSO);
    const [marca] = state.activity.splice(i, 1);
    state.activity.unshift(marca!);
    expect(lancamentoEmCursoDe(state, conta)).toBeUndefined();
  });
});

describe("(i) as recusas de marcarLancamentoEmCurso, sem efeito", () => {
  it("conta fora de \"em lançamento omie\"", () => {
    const m = changeTaskStatus(state, MARYANE, conta.id, CP.status.paraPagar);
    if (!m.ok) throw new Error(m.error);
    const antes = retrato();
    expect(marcarLancamentoEmCurso(state, ATOR, conta.id).ok).toBe(false);
    expect(retrato()).toEqual(antes);
  });

  it("Conferência que não está `conferida`", () => {
    const v = setTaskFieldValue(state, MARYANE, conta.id, CP.fields.valor, 99999);
    if (!v.ok) throw new Error(v.error);
    expect(conferenciaDoResumo(state, conta).estado).toBe("desatualizada");
    const antes = retrato();
    expect(marcarLancamentoEmCurso(state, ATOR, conta.id).ok).toBe(false);
    expect(retrato()).toEqual(antes);
  });

  it("Agente pausado", () => {
    const agente = state.agents.find((a) => a.id === CP.agentId);
    if (!agente) throw new Error("sem Agente");
    agente.lifecycle = "pausado";
    const antes = retrato();
    expect(marcarLancamentoEmCurso(state, ATOR, conta.id).ok).toBe(false);
    expect(retrato()).toEqual(antes);
  });

  it("marca vigente de OUTRO Membro; do MESMO Membro renova o prazo", () => {
    marcar();
    const antes = retrato();
    expect(marcarLancamentoEmCurso(state, MARYANE, conta.id).ok).toBe(false);
    expect(retrato()).toEqual(antes);

    const velho = new Date(Date.now() - 60_000).toISOString();
    reescreverAt(REGISTRO_LANCAMENTO_EM_CURSO, velho);
    const renovada = marcarLancamentoEmCurso(state, ATOR, conta.id);
    expect(renovada.ok, renovada.ok ? "" : renovada.error).toBe(true);
    expect(registrosDa(REGISTRO_LANCAMENTO_EM_CURSO)).toHaveLength(2);
    expect(Date.parse(lancamentoEmCursoDe(state, conta)?.desde ?? "")).toBeGreaterThan(Date.parse(velho));
  });
});
