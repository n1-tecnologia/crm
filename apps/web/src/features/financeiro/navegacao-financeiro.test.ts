import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP, CR } from "@n1/dominio/operations/financeiro";
import { TELAS_DO_FINANCEIRO, vePastaFinanceiro } from "./navegacao-financeiro";

describe("navegacao-financeiro — o assunto e as oito telas", () => {
  it("as oito href estão presentes, nesta ordem exata, e o Dashboard não tem prefixo", () => {
    expect(TELAS_DO_FINANCEIRO.map((t) => t.href)).toEqual([
      "/financeiro",
      "/financeiro/notas-fiscais",
      "/financeiro/produtos",
      "/financeiro/plano-contas",
      "/financeiro/extratos",
      "/financeiro/workflows",
      "/financeiro/problemas",
      "/financeiro/aprovacoes-pendentes",
    ]);
    expect(TELAS_DO_FINANCEIRO[0]!.prefixo).toBeUndefined();
  });

  it("nenhum href começa com /ferramentas (D4-08 — não é uma ferramenta, é assunto de primeiro nível)", () => {
    expect(TELAS_DO_FINANCEIRO.some((t) => t.href.startsWith("/ferramentas"))).toBe(false);
  });
});

describe("vePastaFinanceiro — a visibilidade deriva do alcance, não de Concessão nova", () => {
  const seed = buildSeed();

  it("quem alcança a Pasta Financeiro (Financeiro administra o Espaço Gestão) vê o assunto", () => {
    expect(vePastaFinanceiro(seed, CP.financeiroId)).toBe(true);
  });

  it("quem não alcança (sem Concessão na Gestão, Espaço privado) não vê", () => {
    expect(vePastaFinanceiro(seed, CR.comercialId)).toBe(false);
  });

  it("sem Membro (sessão vazia), nunca aparece — T-4-18", () => {
    expect(vePastaFinanceiro(seed, null)).toBe(false);
    expect(vePastaFinanceiro(seed, "")).toBe(false);
  });
});
