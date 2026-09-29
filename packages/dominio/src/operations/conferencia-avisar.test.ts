/**
 * `avisarId` (Plan 06-03, desvio G3 dirigido pelo orquestrador): a porta que a
 * ponte do `apps/api` usa em ambiente de teste para que nenhuma Menção da
 * Conferência chegue a uma pessoa real. Aditiva: sem a opção, os testes de
 * 06-01 (`conferencia-do-resumo.test.ts`, `lancamento-registrado.test.ts`)
 * continuam provando a regra de sempre, intocados.
 *
 * O que muda com `avisarId`: a Menção e a chamada do Resumo, o aprovador da
 * Conferência e a Menção do aviso de falha. O que NÃO muda: quem revisa
 * (`revisoresDoResumo` — o Financeiro e os Administradores/Proprietários).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { decideProcessApproval } from "./ai";
import {
  CP,
  avisadoDaConferencia,
  publicarResumoParaConferencia,
  registrarFalhaDoLancamento,
  revisoresDoResumo,
  type DeParaDeLancamento,
} from "./financeiro";
import { changeTaskStatus } from "./tasks";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

/** Um Membro ativo que alcança a Lista e não é o Financeiro nem revisor (Papel base "membro"). */
const TESTE = "mem_marcos_paulo";

let state: DataState;
let conta: Task;
let nomeDoTeste: string;
let nomeDaMaryane: string;

beforeEach(() => {
  state = buildSeed();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  conta = t;
  nomeDoTeste = state.members.find((m) => m.id === TESTE)?.displayName ?? "";
  nomeDaMaryane = state.members.find((m) => m.id === CP.financeiroId)?.displayName ?? "";
  expect(nomeDoTeste).not.toBe("");
});

describe("avisadoDaConferencia", () => {
  it("avisarId de Membro ativo vence; ausente, inativo ou desconhecido cai na regra de sempre", () => {
    expect(avisadoDaConferencia(state, CP.financeiroId, TESTE)).toBe(TESTE);
    expect(avisadoDaConferencia(state, "mem_thiago")).toBe(CP.financeiroId);
    expect(avisadoDaConferencia(state, "mem_thiago", "mem_nao_existe")).toBe(CP.financeiroId);
    expect(avisadoDaConferencia(state, "mem_thiago", "mem_tiago")).toBe(CP.financeiroId); // removido
  });
});

describe("publicarResumoParaConferencia com avisarId", () => {
  it("a Menção, a chamada e o aprovador são o Membro indicado; quem revisa não muda", () => {
    const revisoresAntes = revisoresDoResumo(state);
    const r = publicarResumoParaConferencia(state, "mem_thiago", conta.id, { dePara: DE_PARA, avisarId: TESTE });
    if (!r.ok) throw new Error(r.error);

    expect(r.value.comentario.mentions).toEqual([{ type: "member", id: TESTE }]);
    expect(r.value.comentario.content).toContain(`\n\n${nomeDoTeste}, confira: responda "ok" para eu lançar, ou diga o que ajustar.`);
    expect(r.value.comentario.content).not.toContain(nomeDaMaryane);
    expect(r.value.conferencia.approverMemberId).toBe(TESTE);
    expect(revisoresDoResumo(state)).toEqual(revisoresAntes);
    expect(revisoresDoResumo(state)).toContain(CP.financeiroId);
    expect(revisoresDoResumo(state)).not.toContain(TESTE);
  });

  it("o aprovador indicado decide por clique", () => {
    const r = publicarResumoParaConferencia(state, "mem_thiago", conta.id, { dePara: DE_PARA, avisarId: TESTE });
    if (!r.ok) throw new Error(r.error);
    const d = decideProcessApproval(state, TESTE, r.value.conferencia.id, "aprovada", { source: "click" });
    expect(d.ok, d.ok ? "" : d.error).toBe(true);
  });

  it("revisado a pedido: a chamada nomeia o Membro indicado", () => {
    const p1 = publicarResumoParaConferencia(state, "mem_thiago", conta.id, { dePara: DE_PARA, avisarId: TESTE });
    if (!p1.ok) throw new Error(p1.error);
    // Com o aprovador trocado, decide o indicado ou um Administrador/Proprietário
    // (`mayDecideApproval`): no seed a Maryane tem Papel base "membro".
    const rej = decideProcessApproval(state, "mem_thiago", p1.value.conferencia.id, "rejeitada", { source: "comment", reason: "é comercial" });
    if (!rej.ok) throw new Error(rej.error);
    const p2 = publicarResumoParaConferencia(state, "mem_thiago", conta.id, { dePara: DE_PARA, avisarId: TESTE });
    if (!p2.ok) throw new Error(p2.error);
    expect(p2.value.comentario.content).toContain(`\n${nomeDoTeste}, confira de novo:`);
    expect(p2.value.comentario.mentions).toEqual([{ type: "member", id: TESTE }]);
    expect(p2.value.conferencia.approverMemberId).toBe(TESTE);
  });

  it("avisarId que não é Membro ativo: a regra de sempre (o Financeiro)", () => {
    const r = publicarResumoParaConferencia(state, "mem_thiago", conta.id, { dePara: DE_PARA, avisarId: "mem_nao_existe" });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.comentario.mentions).toEqual([{ type: "member", id: CP.financeiroId }]);
    expect(r.value.conferencia.approverMemberId).toBe(CP.financeiroId);
  });
});

describe("registrarFalhaDoLancamento com avisarId", () => {
  it("o aviso de falha menciona o Membro indicado; sem a opção, o Financeiro", () => {
    const p = publicarResumoParaConferencia(state, "mem_thiago", conta.id, { dePara: DE_PARA, avisarId: TESTE });
    if (!p.ok) throw new Error(p.error);
    expect(changeTaskStatus(state, CP.financeiroId, conta.id, CP.status.emLancamento).ok).toBe(true);

    const r = registrarFalhaDoLancamento(state, "mem_thiago", conta.id, { motivo: "Fornecedor bloqueado", code: "OMIE_RECUSOU" }, { avisarId: TESTE });
    if (!r.ok) throw new Error(r.error);
    expect(conta.comments.at(-1)?.mentions).toEqual([{ type: "member", id: TESTE }]);

    const outro = buildSeed();
    const c2 = outro.tasks.find((x) => x.id === "tsk_cp_das");
    if (!c2) throw new Error("sem tsk_cp_das");
    const r2 = registrarFalhaDoLancamento(outro, "mem_thiago", c2.id, { motivo: "x", code: "Y" });
    if (!r2.ok) throw new Error(r2.error);
    expect(c2.comments.at(-1)?.mentions).toEqual([{ type: "member", id: CP.financeiroId }]);
  });
});
