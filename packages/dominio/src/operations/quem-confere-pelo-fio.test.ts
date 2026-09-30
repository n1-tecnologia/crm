/**
 * crm2:WR-03, lado do domínio (06-18 Task 1) — quem confere pelo fio é quem
 * confere pelo clique.
 *
 * `podeDecidirAConferencia` é a régua única: alcança a conta e é o aprovador
 * designado ou Administrador/Proprietário ativo. Ela filtra as respostas do
 * fio (`respostasDeConferenciaPendentes`) e decide os botões da tela. Um "ok"
 * que não confere recebe resposta no fio (`respostaSemEfeitoNoFio`) — de quem
 * não confere, ou com a decisão por comentário desligada —, uma vez só: o fio
 * é a memória. E, com a decisão por comentário desligada, nenhum texto do
 * Resumo pede "ok" (`aprovacaoPorComentario: false` ⇒ `aprovacaoPeloFio`).
 *
 * Na seed: `mem_thiago` é Proprietário e alcança a conta; `mem_rafael` é
 * Administrador e NÃO alcança `tsk_cp_das`; `mem_walter` e a Maryane são
 * `membro` e alcançam; `mem_julia` é `membro` e não alcança.
 *
 * Arquivo novo (CON-05). Puro, sem I/O.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Comment, Task } from "../types";
import { decideProcessApproval, podeDecidirAConferencia } from "./ai";
import {
  CP,
  TEXTOS_DA_CONFERENCIA,
  decisaoDasRespostasPendentes,
  publicarResumoParaConferencia,
  registrarFalhaDoLancamento,
  respostaSemEfeitoNoFio,
  respostasDeConferenciaPendentes,
  type ConferenciaDoResumo,
  type DeParaDeLancamento,
} from "./financeiro";
import { addTaskComment, changeTaskStatus, setTaskFieldValue } from "./tasks";

const SERVICO = "mem_thiago";
const MARYANE = CP.financeiroId;
const WALTER = "mem_walter";
const NOME_DA_MARYANE = "Maryane Generozo";
const NOME_DO_WALTER = "Walter Galvão Neto";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

let state: DataState;
let conta: Task;

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
});

function publicar(extra: { readonly avisarId?: string; readonly aprovacaoPorComentario?: boolean } = {}): ConferenciaDoResumo {
  const p = publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA, ...extra });
  if (!p.ok) throw new Error(p.error);
  return p.value.conferencia;
}

function responder(conf: ConferenciaDoResumo, autor: string, texto: string): Comment {
  const r = addTaskComment(state, autor, conta.id, { content: texto, parentCommentId: conf.origin.threadCommentId });
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function respostaDoAgente(conf: ConferenciaDoResumo, texto: string): void {
  const r = addTaskComment(state, SERVICO, conta.id, { content: texto, actor: { kind: "agent", id: CP.agentId }, parentCommentId: conf.origin.threadCommentId });
  if (!r.ok) throw new Error(r.error);
}

describe("(i) podeDecidirAConferencia — a régua única", () => {
  it("padrão (aprovadora a Maryane) e G3 (aprovador o mem_walter)", () => {
    const padrao = publicar();
    const tabela = (conf: ConferenciaDoResumo) =>
      Object.fromEntries(["mem_maryane", "mem_walter", "mem_thiago", "mem_rafael", "mem_julia"].map((id) => [id, podeDecidirAConferencia(state, id, conf)]));
    expect(tabela(padrao)).toEqual({ mem_maryane: true, mem_walter: false, mem_thiago: true, mem_rafael: false, mem_julia: false });

    const g3 = publicar({ avisarId: WALTER });
    expect(g3.approverMemberId).toBe(WALTER);
    expect(tabela(g3)).toEqual({ mem_maryane: false, mem_walter: true, mem_thiago: true, mem_rafael: false, mem_julia: false });

    const walter = state.members.find((m) => m.id === WALTER);
    if (!walter) throw new Error("sem mem_walter");
    walter.state = "removido";
    expect(podeDecidirAConferencia(state, WALTER, g3)).toBe(false);
  });
});

describe("(j) G3 — o aprovador designado confere respondendo \"ok\"", () => {
  it("a resposta do mem_walter é lida e vira aprovação em nome dele", () => {
    const g3 = publicar({ avisarId: WALTER });
    const ok = responder(g3, WALTER, "ok");
    expect(respostasDeConferenciaPendentes(state, conta).map((c) => c.id)).toEqual([ok.id]);
    const d = decisaoDasRespostasPendentes(state, conta, { aprovacaoPorComentario: true });
    expect(d.sentido).toBe("aprovacao");
    if (d.sentido === "aprovacao") expect(d.resposta.id).toBe(ok.id);
    const r = decideProcessApproval(state, WALTER, g3.id, "aprovada", { source: "comment" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
  });
});

describe("(k) G3 — o \"ok\" da Maryane não confere, e ela fica sabendo por quê, uma vez", () => {
  it("fora das respostas pendentes; okDeQuemNaoConfere(Walter); depois da resposta do Agente, nada", () => {
    const g3 = publicar({ avisarId: WALTER });
    const ok = responder(g3, MARYANE, "ok");
    expect(respostasDeConferenciaPendentes(state, conta)).toEqual([]);
    const sem = respostaSemEfeitoNoFio(state, conta, { aprovacaoPorComentario: true });
    expect(sem?.resposta.id).toBe(ok.id);
    expect(sem?.texto).toBe(TEXTOS_DA_CONFERENCIA.okDeQuemNaoConfere(NOME_DO_WALTER));

    respostaDoAgente(g3, TEXTOS_DA_CONFERENCIA.okDeQuemNaoConfere(NOME_DO_WALTER));
    expect(respostaSemEfeitoNoFio(state, conta, { aprovacaoPorComentario: true })).toBeUndefined();
  });

  it("um pedido de ajuste da Maryane não é \"ok\": nada a responder", () => {
    const g3 = publicar({ avisarId: WALTER });
    responder(g3, MARYANE, "é comercial");
    expect(respostaSemEfeitoNoFio(state, conta, { aprovacaoPorComentario: true })).toBeUndefined();
  });
});

describe("(l) decisão por comentário desligada", () => {
  it("o \"ok\" da aprovadora: decisão nenhum (a forma de sempre) e okPeloFioDesligado", () => {
    const conf = publicar({ aprovacaoPorComentario: false });
    const ok = responder(conf, MARYANE, "ok");
    expect(decisaoDasRespostasPendentes(state, conta, { aprovacaoPorComentario: false })).toEqual({ sentido: "nenhum", ultimaLida: ok.id });
    const sem = respostaSemEfeitoNoFio(state, conta, { aprovacaoPorComentario: false });
    expect(sem).toMatchObject({ resposta: { id: ok.id }, texto: TEXTOS_DA_CONFERENCIA.okPeloFioDesligado });
    // Com a decisão por comentário ligada, o mesmo "ok" confere: nada a responder.
    expect(respostaSemEfeitoNoFio(state, conta, { aprovacaoPorComentario: true })).toBeUndefined();
  });

  it("com um ajuste no mesmo lote, o ajuste decide: nada a responder", () => {
    const conf = publicar({ aprovacaoPorComentario: false });
    responder(conf, MARYANE, "ok");
    responder(conf, MARYANE, "troque o vencimento");
    expect(respostaSemEfeitoNoFio(state, conta, { aprovacaoPorComentario: false })).toBeUndefined();
  });
});

describe("(m) sem decisão por comentário, nenhum texto pede \"ok\"", () => {
  it("chamada, revisado, dados mudaram e superado pelo botão; aprovacaoPeloFio = false na Conferência", () => {
    const c1 = publicar({ aprovacaoPorComentario: false });
    const primeiro = conta.comments.find((c) => c.id === c1.origin.resumoCommentId)?.content ?? "";
    expect(primeiro).not.toContain('responda "ok"');
    expect(primeiro).toContain('"Conferido, pode lançar"');
    expect(c1.origin.aprovacaoPeloFio).toBe(false);

    const revisado = publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA, pedidoDeRevisao: "troque a categoria", aprovacaoPorComentario: false });
    if (!revisado.ok) throw new Error(revisado.error);
    expect(revisado.value.comentario.content).toContain("Revisado a pedido de");
    expect(revisado.value.comentario.content).not.toContain('responda "ok"');
    expect(revisado.value.conferencia.origin.aprovacaoPeloFio).toBe(false);

    const valor = setTaskFieldValue(state, MARYANE, conta.id, CP.fields.valor, 999);
    if (!valor.ok) throw new Error(valor.error);
    const mudou = publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA, motivo: "dados-mudaram", aprovacaoPorComentario: false });
    if (!mudou.ok) throw new Error(mudou.error);
    expect(mudou.value.comentario.content).toContain("Os dados da conta mudaram");
    expect(mudou.value.comentario.content).not.toContain('responda "ok"');

    const d = decideProcessApproval(state, MARYANE, mudou.value.conferencia.id, "aprovada", { source: "click" });
    if (!d.ok) throw new Error(d.error);
    const m = changeTaskStatus(state, MARYANE, conta.id, CP.status.emLancamento);
    if (!m.ok) throw new Error(m.error);
    const f = registrarFalhaDoLancamento(state, SERVICO, conta.id, { motivo: "a conta mudou", code: "CONTA_DIVERGENTE" }, { superarConferencia: true });
    if (!f.ok) throw new Error(f.error);
    const superado = publicarResumoParaConferencia(state, SERVICO, conta.id, { dePara: DE_PARA, aprovacaoPorComentario: false });
    if (!superado.ok) throw new Error(superado.error);
    expect(superado.value.comentario.content).toContain(TEXTOS_DA_CONFERENCIA.superada(NOME_DA_MARYANE, false));
    expect(superado.value.comentario.content).not.toContain('responda "ok"');

    for (const texto of [
      TEXTOS_DA_CONFERENCIA.chamada(NOME_DA_MARYANE, false),
      TEXTOS_DA_CONFERENCIA.revisado("Thiago", "x", NOME_DA_MARYANE, false),
      TEXTOS_DA_CONFERENCIA.dadosMudaram(NOME_DA_MARYANE, false),
      TEXTOS_DA_CONFERENCIA.superada(NOME_DA_MARYANE, false),
    ]) {
      expect(texto).not.toContain('responda "ok"');
      expect(texto).toContain('"Conferido, pode lançar"');
    }
  });

  it("sem a opção (ou true): sem aprovacaoPeloFio, e o texto byte a byte o de hoje", () => {
    const c1 = publicar();
    expect("aprovacaoPeloFio" in c1.origin).toBe(false);
    const conteudo = conta.comments.find((c) => c.id === c1.origin.resumoCommentId)?.content ?? "";
    expect(TEXTOS_DA_CONFERENCIA.chamada(NOME_DA_MARYANE)).toBe(`\n\n${NOME_DA_MARYANE}, confira: responda "ok" para eu lançar, ou diga o que ajustar.`);
    expect(conteudo.endsWith(TEXTOS_DA_CONFERENCIA.chamada(NOME_DA_MARYANE))).toBe(true);

    const outro = buildSeed();
    const t = outro.tasks.find((x) => x.id === "tsk_cp_das");
    if (!t) throw new Error("sem tsk_cp_das");
    const p = publicarResumoParaConferencia(outro, SERVICO, t.id, { dePara: DE_PARA, aprovacaoPorComentario: true });
    if (!p.ok) throw new Error(p.error);
    expect("aprovacaoPeloFio" in p.value.conferencia.origin).toBe(false);
    expect(p.value.comentario.content).toBe(conteudo);
  });
});
