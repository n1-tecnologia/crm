import { describe, expect, it } from "vitest";
import {
  BATIDA_DO_FLUXO_MS,
  SILENCIO_MAXIMO_DO_FLUXO_MS,
  TIPOS_DE_EVENTO_DO_CRM,
  lerEventoDoCrm,
  lerEventoParaATela,
} from "./eventos";

const valido = { workspaceId: "ws_a", tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" };

describe("lerEventoDoCrm (16-07, D-16-01): só ids e o tipo", () => {
  it("os quatro tipos de evento do CRM", () => {
    expect([...TIPOS_DE_EVENTO_DO_CRM]).toEqual(["mensagem.nova", "mensagem.status", "conversa.mudou", "canal.mudou"]);
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

describe("o evento do Canal (Sessão 4): a conexão do WhatsApp que cai ou volta", () => {
  const canal = { workspaceId: "ws_a", tipo: "canal.mudou", canalId: "c1" };

  it("aceita o id do Canal e mais nada, do NOTIFY e para a aba", () => {
    expect(lerEventoDoCrm(canal)).toEqual(canal);
    expect(lerEventoParaATela({ tipo: "canal.mudou", canalId: "c1" })).toEqual({ tipo: "canal.mudou", canalId: "c1" });
  });

  it("recusa o evento de Canal sem canalId, com id vazio ou com mais de 64 caracteres", () => {
    expect(lerEventoDoCrm({ workspaceId: "ws_a", tipo: "canal.mudou" })).toBeUndefined();
    expect(lerEventoDoCrm({ ...canal, canalId: "" })).toBeUndefined();
    expect(lerEventoDoCrm({ ...canal, canalId: "c".repeat(65) })).toBeUndefined();
  });

  it("recusa o evento de Canal que traz conversaId ou mensagemId, e o de Conversa que traz canalId", () => {
    expect(lerEventoDoCrm({ ...canal, conversaId: "c1" })).toBeUndefined();
    expect(lerEventoDoCrm({ ...canal, mensagemId: "m1" })).toBeUndefined();
    expect(lerEventoDoCrm({ ...valido, canalId: "c1" })).toBeUndefined();
    expect(lerEventoParaATela({ tipo: "mensagem.nova", conversaId: "c1", canalId: "c1" })).toBeUndefined();
  });

  it("a aba não aceita o Espaço no evento de Canal", () => {
    expect(lerEventoParaATela(canal)).toBeUndefined();
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

describe("a batida do fluxo e o silêncio máximo da aba (WR-08, 16-19)", () => {
  it("o servidor bate a cada 25 s e a aba só dá a conexão por morta depois de mais de duas batidas", () => {
    expect(BATIDA_DO_FLUXO_MS).toBe(25_000);
    expect(SILENCIO_MAXIMO_DO_FLUXO_MS).toBeGreaterThan(2 * BATIDA_DO_FLUXO_MS);
  });
});
