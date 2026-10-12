/**
 * `validarNovoCanal` e a tabela de provedores (D-01, D-03, D-08). O tipo sai do
 * provedor; o identificador vira a forma canônica que `canais_conta_uq` compara.
 */

import { describe, expect, it } from "vitest";
import {
  PROVEDORES,
  PROVEDORES_DE_CANAL,
  TIPOS_COM_PROVEDOR,
  ehProvedorDeCanal,
  provedorDoCanal,
} from "../provedores-de-canal";
import { proximaConexao, validarArquivamento, validarEdicaoDeCanal, validarNovoCanal } from "./canais";

describe("validarNovoCanal", () => {
  it.each(["whatsapp-cloud", "whatsapp-nao-oficial"] as const)("%s deriva o tipo whatsapp e o número canônico", (provedor) => {
    const r = validarNovoCanal({ provedor, nome: "Suporte", identificador: "+55 11 98765-4321" });
    expect(r).toEqual({
      ok: true,
      value: { tipo: "whatsapp", provedor, nome: "Suporte", identificadorExterno: "+5511987654321" },
    });
  });

  it("instagram-graph canonicaliza o usuário", () => {
    const r = validarNovoCanal({ provedor: "instagram-graph", nome: "Perfil", identificador: "@Empresa" });
    expect(r.ok && r.value.identificadorExterno).toBe("empresa");
    expect(r.ok && r.value.tipo).toBe("instagram");
  });

  it("email-imap-smtp põe o endereço em minúsculas", () => {
    const r = validarNovoCanal({ provedor: "email-imap-smtp", nome: "Caixa", identificador: "Atendimento@Empresa.COM" });
    expect(r.ok && r.value.identificadorExterno).toBe("atendimento@empresa.com");
    expect(r.ok && r.value.tipo).toBe("email");
  });

  it("apara o nome", () => {
    const r = validarNovoCanal({ provedor: "email-imap-smtp", nome: "  Caixa  ", identificador: "a@b.co" });
    expect(r.ok && r.value.nome).toBe("Caixa");
  });

  it("nome vazio → campo nome", () => {
    const r = validarNovoCanal({ provedor: "whatsapp-cloud", nome: "   ", identificador: "+55 11 98765-4321" });
    expect(r).toMatchObject({ ok: false, field: "nome" });
  });

  it("nome acima do limite → campo nome", () => {
    const r = validarNovoCanal({ provedor: "whatsapp-cloud", nome: "x".repeat(201), identificador: "+55 11 98765-4321" });
    expect(r).toMatchObject({ ok: false, field: "nome" });
  });

  it("número sem DDI → campo identificador", () => {
    const r = validarNovoCanal({ provedor: "whatsapp-cloud", nome: "Suporte", identificador: "11 98765-4321" });
    expect(r).toMatchObject({ ok: false, field: "identificador" });
  });

  it("provedor desconhecido → campo provedor", () => {
    const r = validarNovoCanal({
      provedor: "telegram" as unknown as "whatsapp-cloud",
      nome: "Suporte",
      identificador: "+55 11 98765-4321",
    });
    expect(r).toMatchObject({ ok: false, field: "provedor" });
  });
});

describe("tabela de provedores (D-01)", () => {
  it.each(PROVEDORES_DE_CANAL)("%s pertence a um tipo com provedor e o devolve", (p) => {
    expect(TIPOS_COM_PROVEDOR).toContain(PROVEDORES[p].tipo);
    expect(provedorDoCanal({ channelType: PROVEDORES[p].tipo, provider: p })).toBe(p);
    expect(ehProvedorDeCanal(p)).toBe(true);
  });

  it("Canal sem provider usa o padrão do tipo", () => {
    expect(provedorDoCanal({ channelType: "whatsapp" })).toBe("whatsapp-cloud");
    expect(provedorDoCanal({ channelType: "instagram" })).toBe("instagram-graph");
    expect(provedorDoCanal({ channelType: "email" })).toBe("email-imap-smtp");
  });

  it("linkedin e chatDoSite não têm provedor", () => {
    expect(provedorDoCanal({ channelType: "linkedin" })).toBeUndefined();
    expect(provedorDoCanal({ channelType: "chatDoSite" })).toBeUndefined();
  });

  it("ehProvedorDeCanal recusa o que não é provedor", () => {
    expect(ehProvedorDeCanal("telegram")).toBe(false);
    expect(ehProvedorDeCanal("")).toBe(false);
  });

  it("os rótulos e selos da D-01", () => {
    expect(PROVEDORES["whatsapp-cloud"]).toEqual({ tipo: "whatsapp", rotulo: "WhatsApp oficial", selo: "oficial" });
    expect(PROVEDORES["whatsapp-nao-oficial"].selo).toBe("não oficial");
    expect(PROVEDORES["email-imap-smtp"].selo).toBe("IMAP/SMTP");
  });
});

describe("proximaConexao (D-08, ontologia 12.2)", () => {
  it.each(["desconectada", "com_erro"] as const)("simular a partir de %s conecta, marcando a conexão como simulada", (conexao) => {
    expect(proximaConexao({ conexao, estado: "ativo" }, "simular_conexao")).toEqual({
      ok: true,
      value: { conexao: "conectada", conexaoSimulada: true },
    });
  });

  it("simular um Canal já conectado falha", () => {
    expect(proximaConexao({ conexao: "conectada", estado: "ativo" }, "simular_conexao")).toMatchObject({
      ok: false,
      error: "O Canal já está conectado.",
    });
  });

  it("simular um Canal arquivado falha", () => {
    expect(proximaConexao({ conexao: "desconectada", estado: "arquivado" }, "simular_conexao")).toMatchObject({
      ok: false,
      error: "Um Canal arquivado não se conecta.",
    });
  });

  it("desconectar um Canal conectado o leva a desconectada e apaga a marca de simulada", () => {
    expect(proximaConexao({ conexao: "conectada", estado: "ativo" }, "desconectar")).toEqual({
      ok: true,
      value: { conexao: "desconectada", conexaoSimulada: false },
    });
  });

  it("desconectar um Canal desconectado falha", () => {
    expect(proximaConexao({ conexao: "desconectada", estado: "ativo" }, "desconectar")).toMatchObject({
      ok: false,
      error: "O Canal já está desconectado.",
    });
  });
});

describe("validarArquivamento (11.1)", () => {
  it("Canal arquivado não arquiva de novo", () => {
    expect(validarArquivamento({ estado: "arquivado" })).toMatchObject({ ok: false, error: "O Canal já está arquivado." });
  });

  it("Canal ativo arquiva", () => {
    expect(validarArquivamento({ estado: "ativo" }).ok).toBe(true);
  });
});

describe("validarEdicaoDeCanal (INV-CXE-02)", () => {
  it("nome em branco → campo nome", () => {
    expect(validarEdicaoDeCanal({ nome: "  " })).toMatchObject({ ok: false, field: "nome" });
  });

  it("nome acima do limite → campo nome", () => {
    expect(validarEdicaoDeCanal({ nome: "x".repeat(201) })).toMatchObject({ ok: false, field: "nome" });
  });

  it("limpar a Fila padrão (null) é válido", () => {
    expect(validarEdicaoDeCanal({ filaPadraoId: null }).ok).toBe(true);
  });

  it("apara o nome", () => {
    const r = validarEdicaoDeCanal({ nome: "  Comercial " });
    expect(r.ok && r.value.nome).toBe("Comercial");
  });
});
