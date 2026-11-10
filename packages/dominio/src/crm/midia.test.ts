/**
 * A mídia da Mensagem (16-09, 3.9.2, D-16-08, D-16-09): a lista de tipos que uma Mensagem aceita, a categoria de cada
 * um (é a que o Canal declara em `sendableMediaTypes`) e o teto de tamanho. Pura: sem I/O.
 */

import { describe, expect, it } from "vitest";
import {
  TETO_PADRAO_DE_DOCUMENTO_BYTES,
  TETO_PADRAO_DE_MIDIA_BYTES,
  TIPOS_ACEITOS_NA_MENSAGEM,
  categoriaDaMidia,
  ehDocumento,
  normalizarTipoDeMidia,
  tetoDaMidia,
  tiposAceitosParaOCanal,
} from "./midia";

const MIB = 1024 * 1024;

describe("TIPOS_ACEITOS_NA_MENSAGEM (D-16-09)", () => {
  it("tem os 17 tipos da 3.9.2 mais docx, xlsx, pptx, csv, txt e zip", () => {
    expect([...TIPOS_ACEITOS_NA_MENSAGEM].sort()).toEqual(
      [
        "application/pdf",
        "application/xml",
        "image/jpeg",
        "image/png",
        "image/webp",
        "audio/ogg",
        "audio/mpeg",
        "audio/mp4",
        "audio/aac",
        "video/mp4",
        "video/3gpp",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/csv",
        "text/plain",
        "application/zip",
      ].sort(),
    );
    expect(TIPOS_ACEITOS_NA_MENSAGEM).toHaveLength(17);
  });

  it("não repete nenhum tipo e todo tipo já vem normalizado", () => {
    expect(new Set(TIPOS_ACEITOS_NA_MENSAGEM).size).toBe(TIPOS_ACEITOS_NA_MENSAGEM.length);
    for (const tipo of TIPOS_ACEITOS_NA_MENSAGEM) expect(normalizarTipoDeMidia(tipo)).toBe(tipo);
  });
});

describe("normalizarTipoDeMidia (Pitfall 8)", () => {
  it("tira os parâmetros, os espaços e as maiúsculas", () => {
    expect(normalizarTipoDeMidia("audio/ogg; codecs=opus")).toBe("audio/ogg");
    expect(normalizarTipoDeMidia("  Image/PNG ")).toBe("image/png");
    expect(normalizarTipoDeMidia("text/plain;charset=utf-8")).toBe("text/plain");
  });
});

describe("categoriaDaMidia", () => {
  it("image, audio e video pelo prefixo; todo o resto da lista é document", () => {
    expect(categoriaDaMidia("image/png")).toBe("image");
    expect(categoriaDaMidia("audio/ogg; codecs=opus")).toBe("audio");
    expect(categoriaDaMidia("video/3gpp")).toBe("video");
    expect(categoriaDaMidia("application/pdf")).toBe("document");
    expect(categoriaDaMidia("application/zip")).toBe("document");
    expect(categoriaDaMidia("text/csv")).toBe("document");
    expect(categoriaDaMidia("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("document");
  });

  it("um tipo fora da lista não tem categoria", () => {
    expect(categoriaDaMidia("application/x-msdownload")).toBeUndefined();
    expect(categoriaDaMidia("image/gif")).toBeUndefined();
    expect(categoriaDaMidia("")).toBeUndefined();
  });
});

describe("tiposAceitosParaOCanal", () => {
  it("um Canal sem audio e sem video não aceita audio/* nem video/*", () => {
    const tipos = tiposAceitosParaOCanal(["image", "document"]);
    expect(tipos.some((t) => t.startsWith("audio/") || t.startsWith("video/"))).toBe(false);
    expect(tipos).toContain("image/png");
    expect(tipos).toContain("application/pdf");
    expect(tipos).toContain("application/zip");
  });

  it("um Canal só de mídia não aceita documento; categoria que a lista não conhece é ignorada", () => {
    const tipos = tiposAceitosParaOCanal(["image", "video", "audio", "sticker", "location"]);
    expect(tipos).toContain("audio/ogg");
    expect(tipos).toContain("video/mp4");
    expect(tipos).not.toContain("application/pdf");
    expect(tiposAceitosParaOCanal([])).toEqual([]);
  });
});

describe("tetoDaMidia (D-16-08)", () => {
  it("os padrões são 16 MiB para áudio e vídeo e 25 MiB para o resto", () => {
    expect(TETO_PADRAO_DE_MIDIA_BYTES).toBe(16 * MIB);
    expect(TETO_PADRAO_DE_DOCUMENTO_BYTES).toBe(25 * MIB);
  });

  it("áudio e vídeo usam o teto de mídia; imagem e documento, o dos demais", () => {
    const tetos = { midia: 16, demais: 25 };
    expect(tetoDaMidia("video/mp4", tetos)).toBe(16);
    expect(tetoDaMidia("audio/ogg; codecs=opus", tetos)).toBe(16);
    expect(tetoDaMidia("image/png", tetos)).toBe(25);
    expect(tetoDaMidia("application/pdf", tetos)).toBe(25);
  });
});

describe("ehDocumento", () => {
  it("documento é tudo o que não é imagem, áudio nem vídeo (e sai sempre como anexo)", () => {
    expect(ehDocumento("application/pdf")).toBe(true);
    expect(ehDocumento("text/plain")).toBe(true);
    expect(ehDocumento("application/xml")).toBe(true);
    expect(ehDocumento("image/png")).toBe(false);
    expect(ehDocumento("audio/mpeg")).toBe(false);
    expect(ehDocumento("video/mp4")).toBe(false);
    expect(ehDocumento("application/x-desconhecido")).toBe(false);
  });
});
