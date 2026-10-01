import { describe, expect, it } from "vitest";
import { partesDoTextoRico } from "./timeline";

const texto = (entrada: string) =>
  partesDoTextoRico(entrada)
    .map((p) => (p.tipo === "texto" ? p.texto : `<${p.tipo}>${p.texto}</${p.tipo}>`))
    .join("");

describe("partesDoTextoRico — o sublinhado só vira itálico na borda da palavra", () => {
  it("um código com sublinhados fica inteiro (a recusa do Omie no fio)", () => {
    const motivo =
      "O número máximo de caracteres permitido para o elemento [RAZAO_SOCIAL] é de 60 (FORNECEDOR_NAO_RESOLVIDO).";
    expect(texto(motivo)).toBe(motivo);
  });

  it("um nome de arquivo com sublinhados fica inteiro", () => {
    expect(texto("Anexei NFS-e_21_03_08_2026.pdf no campo.")).toBe("Anexei NFS-e_21_03_08_2026.pdf no campo.");
  });

  it("_itálico_ entre espaços e junto de pontuação continua itálico", () => {
    expect(texto("isto é _importante_ e (_isto_ também).")).toBe(
      "isto é <italico>importante</italico> e (<italico>isto</italico> também).",
    );
  });

  it("**negrito** continua negrito, inclusive com sublinhado dentro", () => {
    expect(texto("**FORNECEDOR_NAO_RESOLVIDO** no fio")).toBe("<negrito>FORNECEDOR_NAO_RESOLVIDO</negrito> no fio");
  });

  it("itálico não atravessa a quebra de linha", () => {
    expect(texto("_começo\nfim_")).toBe("_começo\nfim_");
  });
});
