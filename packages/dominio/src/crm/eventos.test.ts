import { describe, expect, it } from "vitest";
import { TIPOS_DE_EVENTO_DO_CRM, lerEventoDoCrm, lerEventoParaATela } from "./eventos";

const valido = { workspaceId: "ws_a", tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" };

describe("lerEventoDoCrm (16-07, D-16-01): só ids e o tipo", () => {
  it("os três tipos de evento do CRM", () => {
    expect([...TIPOS_DE_EVENTO_DO_CRM]).toEqual(["mensagem.nova", "mensagem.status", "conversa.mudou"]);
  });

  it("aceita o evento completo e o sem mensagemId", () => {
    expect(lerEventoDoCrm(valido)).toEqual(valido);
    expect(lerEventoDoCrm({ workspaceId: "ws_a", tipo: "conversa.mudou", conversaId: "c1" })).toEqual({
      workspaceId: "ws_a",
      tipo: "conversa.mudou",
      conversaId: "c1",
    });
  });

  it("recusa tipo desconhecido", () => {
    expect(lerEventoDoCrm({ ...valido, tipo: "mensagem.apagada" })).toBeUndefined();
  });

  it("recusa conversaId, workspaceId e mensagemId vazios ou com mais de 64 caracteres", () => {
    expect(lerEventoDoCrm({ ...valido, conversaId: "" })).toBeUndefined();
    expect(lerEventoDoCrm({ ...valido, conversaId: "x".repeat(65) })).toBeUndefined();
    expect(lerEventoDoCrm({ ...valido, workspaceId: "" })).toBeUndefined();
    expect(lerEventoDoCrm({ ...valido, mensagemId: "" })).toBeUndefined();
    expect(lerEventoDoCrm({ ...valido, mensagemId: "m".repeat(65) })).toBeUndefined();
    expect(lerEventoDoCrm({ ...valido, conversaId: "x".repeat(64) })).toBeDefined();
  });

  it("recusa campos a mais: nada de texto, nome nem telefone viaja no aviso", () => {
    expect(lerEventoDoCrm({ ...valido, conteudo: "oi" })).toBeUndefined();
    expect(lerEventoDoCrm({ ...valido, telefone: "+5511987654321" })).toBeUndefined();
  });

  it("recusa o que não é objeto, ou tem campo do tipo errado", () => {
    for (const lixo of [null, undefined, 1, "texto", [], [valido]]) expect(lerEventoDoCrm(lixo)).toBeUndefined();
    expect(lerEventoDoCrm({ ...valido, conversaId: 7 })).toBeUndefined();
    expect(lerEventoDoCrm({ ...valido, mensagemId: null })).toBeUndefined();
  });
});

describe("lerEventoParaATela: o evento sem o Espaço", () => {
  it("aceita o que sai para a aba, com ou sem mensagemId", () => {
    expect(lerEventoParaATela({ tipo: "mensagem.status", conversaId: "c1", mensagemId: "m1" })).toEqual({
      tipo: "mensagem.status",
      conversaId: "c1",
      mensagemId: "m1",
    });
    expect(lerEventoParaATela({ tipo: "conversa.mudou", conversaId: "c1" })).toEqual({ tipo: "conversa.mudou", conversaId: "c1" });
  });

  it("recusa o que traz o Espaço (ele não sai do servidor) e o que traz campo a mais", () => {
    expect(lerEventoParaATela(valido)).toBeUndefined();
    expect(lerEventoParaATela({ tipo: "mensagem.nova", conversaId: "c1", nome: "Ana" })).toBeUndefined();
  });
});
