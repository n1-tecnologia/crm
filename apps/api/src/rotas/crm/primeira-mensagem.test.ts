/**
 * O esquema da primeira Mensagem de uma Conversa (Sessão 7, 7.3): serve a `POST /conversas`, a `POST /tarefas-conversacionais` e
 * a troca de Canal da Tarefa. Texto livre OU modelo do Canal com as variáveis; um dos dois é obrigatório.
 */

import { describe, expect, it } from "vitest";
import { PRIMEIRA_MENSAGEM, VARIAVEIS_DO_MODELO } from "./comum";

describe("PRIMEIRA_MENSAGEM", () => {
  it("texto livre: passa, e o conteúdo é aparado", () => {
    expect(PRIMEIRA_MENSAGEM.parse({ conteudo: "  Olá!  " })).toEqual({ conteudo: "Olá!" });
  });

  it("modelo sem conteúdo: passa, e o conteúdo vira vazio (o servidor grava o texto do modelo)", () => {
    expect(PRIMEIRA_MENSAGEM.parse({ modeloId: "mdl_1", variaveis: ["Ana"] })).toEqual({ conteudo: "", modeloId: "mdl_1", variaveis: ["Ana"] });
  });

  it("modelo com conteúdo junto também passa (o serviço usa o modelo)", () => {
    expect(PRIMEIRA_MENSAGEM.safeParse({ conteudo: "ignorado", modeloId: "mdl_1", variaveis: [] }).success).toBe(true);
  });

  it.each([
    ["nem texto nem modelo", {}],
    ["só espaços", { conteudo: "   " }],
    ["variáveis sem modelo nem texto", { variaveis: ["Ana"] }],
    ["modeloId vazio sem texto", { modeloId: "" }],
    ["campo desconhecido (.strict)", { conteudo: "x", canalId: "outro" }],
    ["variável acima de 1024 caracteres", { modeloId: "m", variaveis: ["a".repeat(1025)] }],
    ["mais de 20 variáveis", { modeloId: "m", variaveis: Array.from({ length: 21 }, () => "x") }],
    ["variáveis que não são texto", { modeloId: "m", variaveis: [1, 2] }],
  ])("%s: recusada", (_nome, corpo) => {
    expect(PRIMEIRA_MENSAGEM.safeParse(corpo).success).toBe(false);
  });

  it("a recusa de 'nem texto nem modelo' aponta o campo conteudo, com a frase do produto", () => {
    const r = PRIMEIRA_MENSAGEM.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]).toMatchObject({ path: ["conteudo"], message: "Escreva a primeira Mensagem da Conversa." });
  });
});

describe("VARIAVEIS_DO_MODELO", () => {
  it("aceita de zero a 20 valores de até 1024 caracteres", () => {
    expect(VARIAVEIS_DO_MODELO.safeParse([]).success).toBe(true);
    expect(VARIAVEIS_DO_MODELO.safeParse(Array.from({ length: 20 }, () => "a".repeat(1024))).success).toBe(true);
  });
});
