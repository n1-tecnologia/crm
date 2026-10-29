/**
 * Fase 10, 2.1.10 / D-17 — as recusas do domínio que chegam às telas da
 * Estrutura não mostram código interno de regra entre parênteses.
 *
 * O teste da web (`sem-codigo-de-regra.test.ts`) lê os `.tsx` e não enxerga
 * estas frases, que moram no domínio e voltam ao usuário literais. Cada uma
 * ganha aqui a asserção da frase exata e a conferência de que ela não casa com
 * a expressão do UI-SPEC S10 (a mesma do teste da web).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { CP, createReceivableSeries } from "./financeiro";
import { createFolder } from "./structure";

/** A expressão do UI-SPEC S10: RN-/INV-/DO-, (B..) e (A..). */
const CODIGO_DE_REGRA = /\((RN|INV|DO)-[A-Z]+-[0-9]+\)|\(B[0-9]+[a-z]?\)|\(A[0-9]+\.[0-9]+\)/;

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const hoje = new Date();
const em = (dias: number) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function recusa(resultado: { readonly ok: boolean; readonly error?: string }): string {
  expect(resultado.ok).toBe(false);
  if (resultado.ok || resultado.error === undefined) throw new Error("deveria recusar com uma frase");
  return resultado.error;
}

describe("recusas do domínio sem código de regra (UI-SPEC S10)", () => {
  it("série de parcelas sem Centro de Custo: \"Centro de Custo é obrigatório.\"", () => {
    const erro = recusa(
      createReceivableSeries(state, CP.financeiroId, { contactId: "cnt_2", centroDeCusto: "  ", valorParcela: 100, parcelas: 2, primeiroVencimento: em(5) }),
    );
    expect(erro).toBe("Centro de Custo é obrigatório.");
    expect(erro).not.toMatch(CODIGO_DE_REGRA);
  });

  it("segunda Entrada do mesmo cliente nesta Lista: a frase termina em \"nesta Lista.\"", () => {
    const primeira = createReceivableSeries(state, CP.financeiroId, {
      contactId: "cnt_2",
      centroDeCusto: "Tria Tech",
      valorEntrada: 5000,
      vencimentoEntrada: em(1),
      valorParcela: 2500,
      parcelas: 1,
      primeiroVencimento: em(30),
    });
    expect(primeira.ok).toBe(true);
    const erro = recusa(
      createReceivableSeries(state, CP.financeiroId, { contactId: "cnt_2", centroDeCusto: "Tria Tech", valorEntrada: 1, vencimentoEntrada: em(1), valorParcela: 1, parcelas: 1, primeiroVencimento: em(60) }),
    );
    expect(erro).toBe("Marina Alves já tem uma Entrada em aberto ou recebida nesta Lista.");
    expect(erro).not.toMatch(CODIGO_DE_REGRA);
  });

  it("Parcela repetida do mesmo cliente nesta Lista: \"Descarte a série antiga antes de criar outra.\"", () => {
    const primeira = createReceivableSeries(state, CP.financeiroId, { contactId: "cnt_2", centroDeCusto: "Tria Tech", valorParcela: 2500, parcelas: 2, primeiroVencimento: em(30) });
    expect(primeira.ok).toBe(true);
    const erro = recusa(
      createReceivableSeries(state, CP.financeiroId, { contactId: "cnt_2", centroDeCusto: "Tria Tech", valorParcela: 1, parcelas: 1, primeiroVencimento: em(60) }),
    );
    expect(erro).toBe("Marina Alves já tem a 1ª Parcela nesta Lista. Descarte a série antiga antes de criar outra.");
    expect(erro).not.toMatch(CODIGO_DE_REGRA);
  });

  it("Template de Pasta com Subpastas dentro de outra Pasta: a frase termina em \"dentro de um Espaço.\"", () => {
    const template = state.templates.find((t) => t.kind === "pasta");
    if (!template) throw new Error("seed sem Template de Pasta");
    (template as { containsSubfolders?: boolean }).containsSubfolders = true;
    const pai = state.folders.find((f) => f.parentType === "space");
    if (!pai) throw new Error("seed sem Pasta de primeiro nível");
    const erro = recusa(createFolder(state, "mem_thiago", { name: "Com subpastas", parentType: "folder", parentId: pai.id, templateId: template.id }));
    expect(erro).toBe("Este Template contém Subpastas e só pode ser instanciado dentro de um Espaço.");
    expect(erro).not.toMatch(CODIGO_DE_REGRA);
  });
});
