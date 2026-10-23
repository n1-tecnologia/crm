/**
 * `mascararSegredoDeUrl` (D-18, 1.5.1) é a regra única de máscara de segredo de
 * link: o log da api, o Sentry (api e web) e o `map` do nginx dependem dela.
 */

import { describe, expect, it } from "vitest";
import { mascararSegredoDeUrl } from "./url-segura";

describe("mascararSegredoDeUrl", () => {
  it("troca o segredo do Formulário público por ***", () => {
    expect(mascararSegredoDeUrl("/v1/public/forms/abc123")).toBe("/v1/public/forms/***");
  });

  it("preserva o resto do caminho e a query", () => {
    expect(mascararSegredoDeUrl("/v1/public/forms/abc123/submissions?x=1")).toBe(
      "/v1/public/forms/***/submissions?x=1",
    );
  });

  it("troca o segredo da Tarefa pública por ***", () => {
    expect(mascararSegredoDeUrl("/v1/public/tasks/tok-9")).toBe("/v1/public/tasks/***");
  });

  it("mascara os caminhos da web /f/<s> e /p/<s> quando são o começo do caminho", () => {
    expect(mascararSegredoDeUrl("https://app.exemplo.com/f/SEGREDO?utm=1")).toBe("https://app.exemplo.com/f/***?utm=1");
    expect(mascararSegredoDeUrl("/p/SEGREDO")).toBe("/p/***");
    expect(mascararSegredoDeUrl("/f/SEGREDO")).toBe("/f/***");
  });

  it("deixa como veio o que não carrega segredo", () => {
    for (const url of ["/financeiro/f/abc", "/estado", "/operacoes/updateTask", "", "https://app.exemplo.com/financeiro/p/abc"]) {
      expect(mascararSegredoDeUrl(url)).toBe(url);
    }
  });

  it("mascara todas as ocorrências na mesma string", () => {
    expect(
      mascararSegredoDeUrl("GET /v1/public/forms/AAA depois /v1/public/tasks/BBB e de novo /v1/public/forms/AAA/submissions"),
    ).toBe("GET /v1/public/forms/*** depois /v1/public/tasks/*** e de novo /v1/public/forms/***/submissions");
  });

  it("mascara a rota pública atrás de esquema://host", () => {
    expect(mascararSegredoDeUrl("https://api.exemplo.com/v1/public/forms/SEGREDO?a=b#c")).toBe(
      "https://api.exemplo.com/v1/public/forms/***?a=b#c",
    );
  });
});
