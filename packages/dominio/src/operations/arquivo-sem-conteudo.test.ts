/**
 * FUND-07 — o Arquivo do `attachFile` antigo (chave `legado/<id>`) nunca subiu
 * ao Storage: a ficha e a rota de download o reconhecem pelo mesmo critério
 * que `anexarArquivoEnviado` usa para recusar uma chave assim.
 */
import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { arquivoSemConteudo } from "./anexos-enviados";
import { attachFile } from "./collaboration";

describe("arquivoSemConteudo", () => {
  it("é verdadeiro para o Arquivo que o attachFile antigo grava, e falso para um objeto do Storage", () => {
    const state = buildSeed();
    const tarefa = state.tasks.find((t) => t.lifecycle === "ativo" && attachFile(buildSeed(), "mem_thiago", t.id, { name: "a.pdf", mediaType: "document", sizeBytes: 1 }).ok);
    if (!tarefa) throw new Error("seed sem Tarefa em que o Thiago anexe");
    const anexo = attachFile(state, "mem_thiago", tarefa.id, { name: "rascunho.pdf", mediaType: "document", sizeBytes: 10 });
    if (!anexo.ok) throw new Error(anexo.error);
    const arquivo = state.files.find((f) => f.id === anexo.value.fileId)!;

    expect(arquivoSemConteudo(arquivo)).toBe(true);
    expect(arquivoSemConteudo({ objectKey: "" })).toBe(true);
    expect(arquivoSemConteudo({ objectKey: "privado/ws/fil_1.pdf" })).toBe(false);
  });
});
