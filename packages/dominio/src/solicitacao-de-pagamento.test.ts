/**
 * Prova de paridade entre `CATALOGO_SOLICITACAO_DE_PAGAMENTO` e
 * `docs/07-processos/solicitacao-de-pagamento.md`: 5 Status (D5-06
 * acrescentou "em revisão" à Fase 5), 25 Campos, as opções exatas da spec, e
 * o roteamento do aprovador (RN-SP-03) como configuração — nunca `if` de
 * tela nem `undefined` silencioso (D-07).
 *
 * A contagem de "Empresa" é a segunda exceção deliberada à spec original:
 * D5-19/TEN-01 (2026-09-24, fechamento de lacunas de CR-02) acrescentou
 * "Marcos Paulo" como 12ª opção, ao final, sem reordenar as 11 da spec — é
 * o alvo do Canal (`packages/dominio/src/operations/automations.ts`,
 * `CANAL_CAMPO_EMPRESA_ID`), provado à parte em `automations-canal.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  CATALOGO_SOLICITACAO_DE_PAGAMENTO,
  resolverAprovador,
  type RegraDeRoteamento,
} from "./solicitacao-de-pagamento";

const { statusSet, campos, roteamento, papeis } = CATALOGO_SOLICITACAO_DE_PAGAMENTO;

describe("CATALOGO_SOLICITACAO_DE_PAGAMENTO — Status (§3)", () => {
  it("(a) exatamente 5 Status, nesta ordem — D5-06 destrava `em revisão`, `convertida` continua proibido", () => {
    expect(statusSet.definitions.map((d) => d.name)).toEqual([
      "para fazer",
      "em aprovação",
      "não aprovado",
      "aprovado",
      "em revisão",
    ]);
    for (const nomeProibido of ["convertida", "recebida", "em validação"]) {
      expect(statusSet.definitions.some((d) => d.name === nomeProibido)).toBe(false);
    }
  });
});

describe("CATALOGO_SOLICITACAO_DE_PAGAMENTO — Campos (§4)", () => {
  it("(b) exatamente 25 Campos, `ordem` estritamente crescente e sem buraco", () => {
    expect(campos.length).toBe(25);
    const ordens = campos.map((c) => c.ordem);
    for (let i = 1; i < ordens.length; i += 1) {
      expect(ordens[i]).toBe((ordens[i - 1] as number) + 1);
    }
    expect(ordens[0]).toBe(1);
  });

  it("(c) Centro de Custo é o único Campo obrigatório", () => {
    const obrigatorios = campos.filter((c) => c.obrigatorio);
    expect(obrigatorios).toHaveLength(1);
    expect(obrigatorios[0]?.rotulo).toBe("Centro de Custo");
  });

  it("(d) M-Forma de pagamento tem exatamente as quatro opções, incluindo Cartão", () => {
    const forma = campos.find((c) => c.rotulo === "Forma de pagamento");
    expect(forma?.opcoes).toEqual(["Chave Pix", "Boleto", "QRCode Pix", "Cartão"]);
  });

  it("(e) as contagens de opções batem com a spec (A=16, B=13, C=12 com D5-19, D=24, F=2, U=1)", () => {
    const contagem = (rotulo: string) => campos.find((c) => c.rotulo === rotulo)?.opcoes?.length;
    expect(contagem("Centro de Custo")).toBe(16);
    expect(contagem("BU")).toBe(13);
    // C-Empresa: 11 na spec original + "Marcos Paulo" (D5-19/TEN-01, 12ª opção, ao final).
    expect(contagem("Empresa")).toBe(12);
    expect(contagem("Categoria de pagamento")).toBe(24);
    expect(contagem("Fornecedor")).toBe(2);
    expect(contagem("Integração manual")).toBe(1);
  });

  it("(f) Y-Produto está marcado como lacuna — opções vazias + marcador, nunca opções inventadas", () => {
    const produto = campos.find((c) => c.rotulo === "Produto");
    expect(produto?.opcoes).toEqual([]);
    expect(produto?.lacuna).toBe("LACUNA-SP-Y");
  });
});

describe("resolverAprovador (§6.3, §11 RN-SP-03)", () => {
  it("(g) Presidência e TRIA: corte em R$ 5.000 (500000 centavos) — >= vai para a faixa alta", () => {
    const alta = resolverAprovador({ costCenter: "Presidência", amountCents: 500_000 }, roteamento);
    const baixa = resolverAprovador({ costCenter: "Presidência", amountCents: 499_999 }, roteamento);
    expect(alta.minAmountCents).toBe(500_000);
    expect(baixa.minAmountCents).toBeUndefined();
    expect(alta).not.toBe(baixa);

    const altaTria = resolverAprovador({ costCenter: "TRIA", amountCents: 500_000 }, roteamento);
    const baixaTria = resolverAprovador({ costCenter: "TRIA", amountCents: 499_999 }, roteamento);
    expect(altaTria.minAmountCents).toBe(500_000);
    expect(baixaTria.minAmountCents).toBeUndefined();
  });

  it("(h) Centro de Custo desconhecido cai no fallback explícito, nunca `undefined`", () => {
    const regra = resolverAprovador({ costCenter: "Centro Inexistente", amountCents: 1 }, roteamento);
    expect(regra).toBeDefined();
    expect(regra.costCenters).toBe("qualquer");
  });

  it("lança erro explícito quando a configuração não tem fallback (nunca undefined silencioso)", () => {
    const semFallback: RegraDeRoteamento[] = [
      { ordem: 1, costCenters: ["Presidência"], alvo: { kind: "papel", roleId: "rol_sp_aprovador" } },
    ];
    expect(() => resolverAprovador({ costCenter: "Centro Inexistente", amountCents: 1 }, semFallback)).toThrow();
  });

  it("(i) nenhuma regra de roteamento tem alvo `kind: 'membro'` — só `papel`", () => {
    expect(roteamento.length).toBeGreaterThan(0);
    for (const regra of roteamento) {
      expect(regra.alvo.kind).toBe("papel");
    }
  });
});

describe("Integridade do catálogo", () => {
  it("(j) nenhum id de Papel ou de Campo se repete no catálogo inteiro", () => {
    const idsDePapel = papeis.map((p) => p.id);
    const idsDeCampo = campos.map((c) => c.id);
    expect(new Set(idsDePapel).size).toBe(idsDePapel.length);
    expect(new Set(idsDeCampo).size).toBe(idsDeCampo.length);
    // Os dois universos de id (rol_sp_*, fld_sp_*) nunca colidem entre si.
    const todos = [...idsDePapel, ...idsDeCampo];
    expect(new Set(todos).size).toBe(todos.length);
  });
});
