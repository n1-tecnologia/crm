/**
 * A Conversa relacional (Fase 8): a regra da primeira Mensagem (INV-CXE-05), a
 * mudança de situação (resolver/reabrir), o título derivado do Contato e a
 * tabela que diz qual Identificador cada Canal resolve (Pitfall 8).
 */

import { describe, expect, it } from "vitest";
import { TIPOS_COM_PROVEDOR } from "../provedores-de-canal";
import {
  ESTADOS_DA_CONVERSA,
  SITUACOES_DA_CONVERSA,
  TIPO_DE_IDENTIFICADOR_DO_CANAL,
  proximaSituacao,
  tituloDaConversa,
  validarNovaConversa,
} from "./conversas";

describe("validarNovaConversa (INV-CXE-05: a Conversa nasce com Mensagem)", () => {
  it("recusa a primeira Mensagem em branco, no campo conteudo", () => {
    expect(validarNovaConversa({ canalId: "c", contatoId: "k", mensagem: { conteudo: "  " } })).toEqual({
      ok: false,
      error: "Escreva a primeira Mensagem da Conversa.",
      field: "conteudo",
    });
  });

  it("recusa Canal e Contato em branco", () => {
    const semCanal = validarNovaConversa({ canalId: " ", contatoId: "k", mensagem: { conteudo: "oi" } });
    expect(!semCanal.ok && semCanal.field).toBe("canalId");
    const semContato = validarNovaConversa({ canalId: "c", contatoId: "", mensagem: { conteudo: "oi" } });
    expect(!semContato.ok && semContato.field).toBe("contatoId");
  });

  it("respeita o teto do texto longo", () => {
    const r = validarNovaConversa({ canalId: "c", contatoId: "k", mensagem: { conteudo: "a".repeat(5001) } });
    expect(!r.ok && r.field).toBe("conteudo");
  });

  it("aceita uma Conversa com Canal, Contato e primeira Mensagem", () => {
    const entrada = { canalId: "c", contatoId: "k", mensagem: { conteudo: "Olá" } };
    expect(validarNovaConversa(entrada)).toEqual({ ok: true, value: entrada });
  });
});

describe("proximaSituacao", () => {
  it.each(["aberta", "pendente"] as const)("resolver uma Conversa %s a resolve", (situacao) => {
    expect(proximaSituacao({ situacao, estado: "ativo" }, "resolver")).toEqual({
      ok: true,
      value: { situacao: "resolvida" },
    });
  });

  it("resolver uma Conversa resolvida falha", () => {
    expect(proximaSituacao({ situacao: "resolvida", estado: "ativo" }, "resolver")).toEqual({
      ok: false,
      error: "A Conversa já está resolvida.",
    });
  });

  it("reabrir uma Conversa resolvida a deixa aberta", () => {
    expect(proximaSituacao({ situacao: "resolvida", estado: "ativo" }, "reabrir")).toEqual({
      ok: true,
      value: { situacao: "aberta" },
    });
  });

  it.each(["aberta", "pendente"] as const)("reabrir uma Conversa %s falha", (situacao) => {
    expect(proximaSituacao({ situacao, estado: "ativo" }, "reabrir")).toEqual({
      ok: false,
      error: "Só uma Conversa resolvida é reaberta.",
    });
  });

  it.each(["resolver", "reabrir"] as const)("na lixeira, %s falha", (acao) => {
    expect(proximaSituacao({ situacao: "resolvida", estado: "na_lixeira" }, acao)).toEqual({
      ok: false,
      error: "Uma Conversa na lixeira não muda de situação.",
    });
  });
});

describe("tituloDaConversa", () => {
  it("junta nome e sobrenome", () => {
    expect(tituloDaConversa({ nome: "Ana", sobrenome: "Lima" }, "+5511...")).toBe("Ana Lima");
  });

  it("só o nome, ou só o sobrenome", () => {
    expect(tituloDaConversa({ nome: "Ana", sobrenome: null }, "+5511...")).toBe("Ana");
    expect(tituloDaConversa({ nome: null, sobrenome: "Lima" }, "+5511...")).toBe("Lima");
  });

  it("sem nome, o título é o identificador", () => {
    expect(tituloDaConversa({ nome: null, sobrenome: null }, "ana@exemplo.com")).toBe("ana@exemplo.com");
    expect(tituloDaConversa({ nome: "  ", sobrenome: "" }, "ana@exemplo.com")).toBe("ana@exemplo.com");
  });
});

describe("TIPO_DE_IDENTIFICADOR_DO_CANAL (Pitfall 8)", () => {
  it("WhatsApp resolve o Identificador whatsapp, Instagram o instagram, E-mail o email", () => {
    expect(TIPO_DE_IDENTIFICADOR_DO_CANAL.whatsapp).toBe("whatsapp");
    expect(TIPO_DE_IDENTIFICADOR_DO_CANAL.instagram).toBe("instagram");
    expect(TIPO_DE_IDENTIFICADOR_DO_CANAL.email).toBe("email");
  });

  it("cobre todo tipo com provedor e nenhum valor é telefone", () => {
    expect(Object.keys(TIPO_DE_IDENTIFICADOR_DO_CANAL).sort()).toEqual([...TIPOS_COM_PROVEDOR].sort());
    expect(Object.values(TIPO_DE_IDENTIFICADOR_DO_CANAL)).not.toContain("telefone");
  });
});

describe("os valores discretos espelham os CHECK da 008", () => {
  it("situações e estados", () => {
    expect([...SITUACOES_DA_CONVERSA]).toEqual(["aberta", "pendente", "resolvida"]);
    expect([...ESTADOS_DA_CONVERSA]).toEqual(["ativo", "na_lixeira"]);
  });
});
