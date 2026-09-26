/**
 * `esquemas/ia-conhecimento.ts` — testes puros, sem banco: só a FORMA dos
 * argumentos. (a) cobertura, (b) as formas LITERAIS de `apps/web` passam,
 * (c) formas hostis caem.
 */

import { describe, expect, it } from "vitest";
import { IA_CONHECIMENTO } from "./ia-conhecimento";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/ia-conhecimento — a forma dos args de ia/conhecimento.ts", () => {
  it("(a) cobertura — as 16 chaves de ia/conhecimento.ts em registro.ts", () => {
    const esperadas = [
      "criarColecao",
      "editarColecao",
      "adicionarFonte",
      "arquivarColecao",
      "restaurarColecao",
      "adicionarDocumento",
      "novaVersaoDoDocumento",
      "restaurarVersaoDoDocumento",
      "editarDocumento",
      "moverDocumento",
      "comentarDocumento",
      "arquivarDocumento",
      "enviarDocumentoALixeira",
      "restaurarDocumento",
      "concederColecao",
      "revogarColecao",
    ].sort();
    expect(Object.keys(IA_CONHECIMENTO).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const K = IA_CONHECIMENTO;
    // nova-colecao-dialog.tsx / colecao-completa.tsx
    expect(K.criarColecao.safeParse(viaJson([{ name: "C", description: "", isPrivate: true }])).success).toBe(true);
    expect(K.editarColecao.safeParse(viaJson(["col_1", { isPrivate: false }])).success).toBe(true);
    expect(K.arquivarColecao.safeParse(viaJson(["col_1"])).success).toBe(true);
    expect(K.restaurarColecao.safeParse(viaJson(["col_1"])).success).toBe(true);
    // nova-fonte-dialog.tsx
    expect(
      K.adicionarFonte.safeParse(
        viaJson(["col_1", { kind: "url", name: "Site", config: "https://x", updatePolicy: { kind: "periodica", intervalHours: 24 } }]),
      ).success,
    ).toBe(true);
    expect(
      K.adicionarFonte.safeParse(viaJson(["col_1", { kind: "integracao", name: "Drive", config: "int_1", updatePolicy: { kind: "manual" } }]))
        .success,
    ).toBe(true);
    // adicionar-documento-dialog.tsx — as três variantes de conteúdo
    expect(K.adicionarDocumento.safeParse(viaJson(["col_1", { title: "D", labels: [], kind: "texto", text: "t" }])).success).toBe(
      true,
    );
    expect(K.adicionarDocumento.safeParse(viaJson(["col_1", { title: "D", labels: ["a"], kind: "url", url: "https://x" }])).success).toBe(
      true,
    );
    expect(
      K.adicionarDocumento.safeParse(
        viaJson(["col_1", { title: "D", labels: [], kind: "arquivo", fileName: "a.pdf", sizeBytes: 10, mediaType: "document" }]),
      ).success,
    ).toBe(true);
    // nova-versao-dialog.tsx
    expect(K.novaVersaoDoDocumento.safeParse(viaJson(["doc_1", { kind: "texto", text: "t" }])).success).toBe(true);
    expect(
      K.novaVersaoDoDocumento.safeParse(viaJson(["doc_1", { kind: "arquivo", fileName: "a.pdf", sizeBytes: 1, mediaType: "document" }])).success,
    ).toBe(true);
    // documento-completo.tsx / colecao-completa.tsx / mover-documento-dialog.tsx
    expect(K.restaurarVersaoDoDocumento.safeParse(viaJson(["doc_1", 2])).success).toBe(true);
    expect(K.editarDocumento.safeParse(viaJson(["doc_1", { summary: "" }])).success).toBe(true);
    expect(K.editarDocumento.safeParse(viaJson(["doc_1", { labels: ["a", "b"] }])).success).toBe(true);
    expect(K.moverDocumento.safeParse(viaJson(["doc_1", "col_2"])).success).toBe(true);
    expect(K.comentarDocumento.safeParse(viaJson(["doc_1", "comentário"])).success).toBe(true);
    expect(K.arquivarDocumento.safeParse(viaJson(["doc_1"])).success).toBe(true);
    expect(K.enviarDocumentoALixeira.safeParse(viaJson(["doc_1"])).success).toBe(true);
    expect(K.restaurarDocumento.safeParse(viaJson(["doc_1"])).success).toBe(true);
    // conceder-colecao-dialog.tsx
    expect(K.concederColecao.safeParse(viaJson(["col_1", { agentId: "agt_1", actions: ["ver", "criar"] }])).success).toBe(true);
    expect(K.revogarColecao.safeParse(viaJson(["cgr_1"])).success).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    const K = IA_CONHECIMENTO;
    // Versão nova não vem de URL
    expect(K.novaVersaoDoDocumento.safeParse(["doc_1", { kind: "url", url: "https://x" }]).success).toBe(false);
    // variante com chave de outra variante
    expect(K.adicionarDocumento.safeParse(["col_1", { title: "D", kind: "texto", text: "t", url: "x" }]).success).toBe(false);
    expect(K.adicionarDocumento.safeParse(["col_1", { kind: "texto", text: "t" }]).success).toBe(false);
    expect(K.adicionarFonte.safeParse(["col_1", { kind: "envioManual", name: "x", config: "y" }]).success).toBe(false);
    expect(K.concederColecao.safeParse(["col_1", { agentId: "agt_1", actions: ["apagar"] }]).success).toBe(false);
  });
});
