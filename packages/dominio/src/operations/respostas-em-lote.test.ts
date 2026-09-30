/**
 * crm:WR-04 (06-11 Task 2) — todas as respostas de revisores no fio do Resumo
 * contam. `respostasDeConferenciaPendentes` exclui as mensagens do processo
 * pela autoria (o Agente) e pela forma canônica exata (`FORMAS_CANONICAS_DO_FIO`),
 * nunca pelo emoji inicial: "⚠️ o valor está errado" e "✅" de um revisor são
 * respostas. `decisaoDasRespostasPendentes` percorre o lote em ordem, e o
 * primeiro `ajuste` vence qualquer `aprovacao` do mesmo lote.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Comment, Task } from "../types";
import { decideProcessApproval } from "./ai";
import {
  CP,
  decisaoDasRespostasPendentes,
  FORMAS_CANONICAS_DO_FIO,
  publicarResumoParaConferencia,
  respostasDeConferenciaPendentes,
  revisoresDoResumo,
  TEXTOS_DA_CONFERENCIA,
  type ConferenciaDoResumo,
  type DeParaDeLancamento,
} from "./financeiro";
import { addTaskComment } from "./tasks";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

/** Proprietário: revisor do Resumo por `revisoresDoResumo`. */
const THIAGO = "mem_thiago";

let state: DataState;
let conta: Task;
let conferencia: ConferenciaDoResumo;
let raiz: string;

function responder(autor: string, content: string): Comment {
  const r = addTaskComment(state, autor, conta.id, { content, parentCommentId: raiz });
  if (!r.ok) throw new Error(`${autor}: ${r.error}`);
  return r.value;
}

const COM_APROVACAO = { aprovacaoPorComentario: true } as const;

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
  const r = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA });
  if (!r.ok) throw new Error(r.error);
  conferencia = r.value.conferencia;
  raiz = conferencia.origin.threadCommentId;
  expect(revisoresDoResumo(state)).toContain(THIAGO);
});

describe("(a) um ⚠️ humano é resposta, não mensagem do processo", () => {
  it('"⚠️ o valor está errado" da Maryane entra e decide ajuste', () => {
    const aviso = responder(CP.financeiroId, "⚠️ o valor está errado");
    expect(respostasDeConferenciaPendentes(state, conta).map((c) => c.id)).toEqual([aviso.id]);
    const d = decisaoDasRespostasPendentes(state, conta, COM_APROVACAO);
    expect(d.sentido).toBe("ajuste");
    if (d.sentido === "ajuste") expect(d.resposta.id).toBe(aviso.id);
    expect(d.ultimaLida).toBe(aviso.id);
  });
});

describe("(b) um ✅ sozinho de um revisor", () => {
  it("entra e decide aprovação", () => {
    const visto = responder(THIAGO, "✅");
    expect(respostasDeConferenciaPendentes(state, conta).map((c) => c.id)).toEqual([visto.id]);
    const d = decisaoDasRespostasPendentes(state, conta, COM_APROVACAO);
    expect(d.sentido).toBe("aprovacao");
    if (d.sentido === "aprovacao") expect(d.resposta.id).toBe(visto.id);
  });
});

describe("(c) ficam fora as formas canônicas e as mensagens do Agente", () => {
  it("conferido/ajuste escritos por Membro e o ⚠️ do Agente não são respostas", () => {
    responder(THIAGO, TEXTOS_DA_CONFERENCIA.conferido("Thiago"));
    responder(CP.financeiroId, TEXTOS_DA_CONFERENCIA.ajuste("Maryane", "x"));
    const agente = addTaskComment(state, CP.financeiroId, conta.id, { content: "⚠️ aviso", parentCommentId: raiz, actor: { kind: "agent", id: CP.agentId } });
    expect(agente.ok).toBe(true);
    expect(respostasDeConferenciaPendentes(state, conta)).toEqual([]);
    expect(decisaoDasRespostasPendentes(state, conta, COM_APROVACAO)).toEqual({ sentido: "nenhum" });
  });
});

describe("(d) uma pergunta depois do ajuste não esconde o ajuste", () => {
  it("o primeiro ajuste decide; ultimaLida é a pergunta", () => {
    const pedido = responder(CP.financeiroId, "mude a categoria para comercial");
    const pergunta = responder(CP.financeiroId, "pode ver?");
    const d = decisaoDasRespostasPendentes(state, conta, COM_APROVACAO);
    expect(d.sentido).toBe("ajuste");
    if (d.sentido === "ajuste") expect(d.resposta.id).toBe(pedido.id);
    expect(d.ultimaLida).toBe(pergunta.id);
  });
});

describe("(e) o ajuste vence a aprovação no mesmo lote", () => {
  it("ajuste antes do ok: ajuste em nome da Maryane", () => {
    const pedido = responder(CP.financeiroId, "troque o vencimento");
    const okDoThiago = responder(THIAGO, "ok");
    const d = decisaoDasRespostasPendentes(state, conta, COM_APROVACAO);
    expect(d.sentido).toBe("ajuste");
    if (d.sentido === "ajuste") {
      expect(d.resposta.id).toBe(pedido.id);
      expect(d.resposta.author).toEqual({ kind: "member", id: CP.financeiroId });
    }
    expect(d.ultimaLida).toBe(okDoThiago.id);
  });

  it("ok antes do ajuste: ainda ajuste", () => {
    responder(THIAGO, "ok");
    const pedido = responder(CP.financeiroId, "troque o vencimento");
    const d = decisaoDasRespostasPendentes(state, conta, COM_APROVACAO);
    expect(d.sentido).toBe("ajuste");
    if (d.sentido === "ajuste") expect(d.resposta.id).toBe(pedido.id);
    expect(d.ultimaLida).toBe(pedido.id);
  });
});

describe("(f) a aprovação decide mesmo com uma pergunta depois", () => {
  it('"ok" e depois "?" → aprovação com o "ok"', () => {
    const ok = responder(CP.financeiroId, "ok");
    const pergunta = responder(CP.financeiroId, "?");
    const d = decisaoDasRespostasPendentes(state, conta, COM_APROVACAO);
    expect(d.sentido).toBe("aprovacao");
    if (d.sentido === "aprovacao") expect(d.resposta.id).toBe(ok.id);
    expect(d.ultimaLida).toBe(pergunta.id);
  });
});

describe("(g) sem aprovação por comentário (D6-02)", () => {
  it('só "ok": nenhum, com ultimaLida', () => {
    const ok = responder(CP.financeiroId, "ok");
    expect(decisaoDasRespostasPendentes(state, conta, { aprovacaoPorComentario: false })).toEqual({ sentido: "nenhum", ultimaLida: ok.id });
  });

  it('"é comercial": o fio continua pedindo ajuste', () => {
    const pedido = responder(CP.financeiroId, "é comercial");
    const d = decisaoDasRespostasPendentes(state, conta, { aprovacaoPorComentario: false });
    expect(d.sentido).toBe("ajuste");
    if (d.sentido === "ajuste") expect(d.resposta.id).toBe(pedido.id);
  });
});

describe("(h) nada a decidir", () => {
  it("sem respostas: nenhum, sem ultimaLida", () => {
    expect(decisaoDasRespostasPendentes(state, conta, COM_APROVACAO)).toEqual({ sentido: "nenhum" });
  });

  it("Conferência já decidida: nenhum", () => {
    const r = decideProcessApproval(state, CP.financeiroId, conferencia.id, "aprovada", { source: "click" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    responder(CP.financeiroId, "troque o vencimento");
    expect(decisaoDasRespostasPendentes(state, conta, COM_APROVACAO)).toEqual({ sentido: "nenhum" });
  });
});

describe("(i) os textos e as formas não se desencontram", () => {
  it("FORMAS_CANONICAS_DO_FIO casa com conferido e ajuste", () => {
    expect(FORMAS_CANONICAS_DO_FIO[0]?.test(TEXTOS_DA_CONFERENCIA.conferido("Qualquer Nome"))).toBe(true);
    expect(FORMAS_CANONICAS_DO_FIO[1]?.test(TEXTOS_DA_CONFERENCIA.ajuste("Qualquer Nome", "m"))).toBe(true);
    expect(FORMAS_CANONICAS_DO_FIO.some((f) => f.test("✅"))).toBe(false);
    expect(FORMAS_CANONICAS_DO_FIO.some((f) => f.test("⚠️ o valor está errado"))).toBe(false);
  });
});
