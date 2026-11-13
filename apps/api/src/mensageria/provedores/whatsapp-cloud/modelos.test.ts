/**
 * A tradução do modelo da Meta para o do CRM (7.3.2): pura, sem rede nem banco. NÃO é prova contra a Meta real: os modelos
 * são exemplos escritos a partir da documentação (`message_templates`).
 */

import { describe, expect, it } from "vitest";
import type { ModeloDaMeta } from "./cliente";
import { traduzirModelo } from "./modelos";

const base = (extras: Partial<ModeloDaMeta> = {}): ModeloDaMeta => ({
  id: "190001",
  name: "boas_vindas",
  language: "pt_BR",
  category: "UTILITY",
  status: "APPROVED",
  components: [{ type: "BODY", text: "Olá {{1}}, seu pedido {{2}} saiu." }, { type: "FOOTER", text: "Tria" }],
  ...extras,
});

describe("traduzirModelo", () => {
  it("aprovado: id, nome e idioma da Meta, categoria e estado em português e a quantidade de variáveis do corpo", () => {
    expect(traduzirModelo(base())).toEqual({
      idNoProvedor: "190001",
      nome: "boas_vindas",
      idioma: "pt_BR",
      categoria: "utilidade",
      estado: "aprovado",
      motivoDeRejeicao: null,
      componentes: [{ type: "BODY", text: "Olá {{1}}, seu pedido {{2}} saiu." }, { type: "FOOTER", text: "Tria" }],
      quantidadeDeVariaveis: 2,
    });
  });

  it.each([
    ["UTILITY", "utilidade"],
    ["MARKETING", "marketing"],
    ["AUTHENTICATION", "autenticacao"],
    ["marketing", "marketing"],
  ] as const)("categoria %s → %s", (da, para) => {
    expect(traduzirModelo(base({ category: da }))?.categoria).toBe(para);
  });

  it.each([
    ["APPROVED", "aprovado"],
    ["PENDING", "pendente"],
    ["IN_APPEAL", "pendente"],
    ["REJECTED", "rejeitado"],
    ["PAUSED", "pausado"],
    ["FLAGGED", "pausado"],
    ["LIMIT_EXCEEDED", "pausado"],
    ["DISABLED", "desativado"],
    ["DELETED", "desativado"],
    ["PENDING_DELETION", "desativado"],
    ["ARCHIVED", "desativado"],
  ] as const)("estado %s → %s (só APPROVED envia)", (da, para) => {
    expect(traduzirModelo(base({ status: da }))?.estado).toBe(para);
  });

  it("categoria ou estado que o CRM não conhece: o modelo fica de fora, em vez de entrar com valor que o banco recusa", () => {
    expect(traduzirModelo(base({ category: "SERVICE_NEW" }))).toBeUndefined();
    expect(traduzirModelo(base({ status: "ESTADO_NOVO" }))).toBeUndefined();
  });

  it("o motivo da rejeição só vale em modelo rejeitado e nunca é 'NONE' nem vazio", () => {
    expect(traduzirModelo(base({ status: "REJECTED", rejected_reason: "INVALID_FORMAT" }))?.motivoDeRejeicao).toBe("INVALID_FORMAT");
    expect(traduzirModelo(base({ status: "REJECTED", rejected_reason: "NONE" }))?.motivoDeRejeicao).toBeNull();
    expect(traduzirModelo(base({ status: "REJECTED" }))?.motivoDeRejeicao).toBeNull();
    // Um motivo solto num modelo aprovado não aparece: o estado já diz tudo.
    expect(traduzirModelo(base({ status: "APPROVED", rejected_reason: "INVALID_FORMAT" }))?.motivoDeRejeicao).toBeNull();
  });

  it("componentes malformados (sem tipo, ou que não são objeto) são descartados, o resto fica", () => {
    const m = traduzirModelo(base({ components: [{ type: "BODY", text: "Oi {{1}}" }, { sem: "tipo" }, null, "texto", 42] }));
    expect(m?.componentes).toEqual([{ type: "BODY", text: "Oi {{1}}" }]);
    expect(m?.quantidadeDeVariaveis).toBe(1);
  });

  it("modelo sem componentes: lista vazia e zero variáveis (o domínio o marca como sem corpo)", () => {
    expect(traduzirModelo(base({ components: [] }))).toMatchObject({ componentes: [], quantidadeDeVariaveis: 0 });
  });

  it("o motivo longo é cortado em 500 caracteres", () => {
    expect(traduzirModelo(base({ status: "REJECTED", rejected_reason: "x".repeat(900) }))?.motivoDeRejeicao).toHaveLength(500);
  });
});
