/**
 * A Mensagem relacional (Fase 8): validação de uma Mensagem nova, a regra de
 * envio por (tipo, provedor) — RN-CXE-19 — e o status inicial (B69). Cada
 * teste afirma o resultado devolvido, nunca que uma função foi chamada.
 */

import { describe, expect, it } from "vitest";
import {
  DIRECOES_DA_MENSAGEM,
  DIRECOES_DE_ENVIO,
  STATUS_DE_ENTREGA,
  TIPOS_DE_ATOR_DA_MENSAGEM,
  statusInicialDeEnvio,
  validarEnvio,
  validarNovaMensagem,
} from "./mensagens";

const HORA = 3_600_000;
const AGORA = Date.parse("2026-10-12T12:00:00.000Z");
const haHoras = (horas: number): string => new Date(AGORA - horas * HORA).toISOString();

const OFICIAL = { responseWindowHours: 24, requiresTemplateOutsideWindow: true } as const;
const NAO_OFICIAL = { requiresTemplateOutsideWindow: false } as const;

describe("validarEnvio (RN-CXE-19 por tipo e provedor)", () => {
  it("oficial fora da janela, sem nenhum modelo aprovado: recusa dizendo que o Canal não tem modelo", () => {
    expect(
      validarEnvio({ capacidades: OFICIAL, ultimaRecebidaEm: haHoras(30), agora: AGORA, modelosAprovados: [] }),
    ).toEqual({
      ok: false,
      error: "Este Canal não tem Mensagem de modelo aprovada: não dá para enviar fora da janela de resposta.",
      field: "modelo",
    });
  });

  it("oficial fora da janela, com modelos aprovados e sem escolha: pede o modelo", () => {
    expect(
      validarEnvio({ capacidades: OFICIAL, ultimaRecebidaEm: haHoras(30), agora: AGORA, modelosAprovados: ["m1"] }),
    ).toEqual({
      ok: false,
      error: "A janela de resposta deste Canal expirou. Só é possível enviar uma Mensagem de modelo aprovada.",
      field: "modelo",
    });
  });

  it("oficial fora da janela, com modelo que não é dos aprovados: recusa", () => {
    expect(
      validarEnvio({
        capacidades: OFICIAL,
        ultimaRecebidaEm: haHoras(30),
        agora: AGORA,
        modeloId: "m2",
        modelosAprovados: ["m1"],
      }),
    ).toEqual({ ok: false, error: "Escolha uma Mensagem de modelo aprovada pelo provedor.", field: "modelo" });
  });

  it("oficial fora da janela, com modelo aprovado: libera", () => {
    expect(
      validarEnvio({
        capacidades: OFICIAL,
        ultimaRecebidaEm: haHoras(30),
        agora: AGORA,
        modeloId: "m1",
        modelosAprovados: ["m1"],
      }),
    ).toEqual({ ok: true, value: undefined });
  });

  it("oficial dentro da janela (2 h): libera texto livre", () => {
    expect(
      validarEnvio({ capacidades: OFICIAL, ultimaRecebidaEm: haHoras(2), agora: AGORA, modelosAprovados: [] }),
    ).toEqual({ ok: true, value: undefined });
  });

  it("oficial no instante exato do fim da janela: ainda libera (a janela vale até o fim)", () => {
    expect(
      validarEnvio({ capacidades: OFICIAL, ultimaRecebidaEm: haHoras(24), agora: AGORA, modelosAprovados: [] }),
    ).toEqual({ ok: true, value: undefined });
  });

  it("oficial sem nenhuma recebida: libera (a janela só existe depois da primeira recebida)", () => {
    expect(validarEnvio({ capacidades: OFICIAL, ultimaRecebidaEm: null, agora: AGORA, modelosAprovados: [] })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("não oficial: libera mesmo com a recebida há 30 h", () => {
    expect(
      validarEnvio({ capacidades: NAO_OFICIAL, ultimaRecebidaEm: haHoras(30), agora: AGORA, modelosAprovados: [] }),
    ).toEqual({ ok: true, value: undefined });
  });
});

describe("statusInicialDeEnvio (B69)", () => {
  it("Canal conectado: a Mensagem sai enviada", () => {
    expect(statusInicialDeEnvio("conectada")).toBe("enviada");
  });

  it.each(["desconectada", "com_erro"] as const)("Canal %s: a Mensagem fica pendente", (conexao) => {
    expect(statusInicialDeEnvio(conexao)).toBe("pendente");
  });
});

describe("validarNovaMensagem", () => {
  it("recusa conteúdo vazio, no campo conteudo", () => {
    const r = validarNovaMensagem({ conversaId: "x", direcao: "enviada", conteudo: "" });
    expect(r).toEqual({ ok: false, error: "Escreva a mensagem antes de enviar.", field: "conteudo" });
  });

  it("recusa conteúdo só de espaços", () => {
    const r = validarNovaMensagem({ conversaId: "x", direcao: "interna", conteudo: "   \n " });
    expect(!r.ok && r.field).toBe("conteudo");
  });

  it("recusa conteúdo acima do teto do texto longo", () => {
    const r = validarNovaMensagem({ conversaId: "x", direcao: "enviada", conteudo: "a".repeat(5001) });
    expect(!r.ok && r.field).toBe("conteudo");
  });

  it("recusa Conversa em branco", () => {
    const r = validarNovaMensagem({ conversaId: " ", direcao: "enviada", conteudo: "oi" });
    expect(!r.ok && r.field).toBe("conversaId");
  });

  it("recusa a direção recebida: uma pessoa não cria Mensagem recebida", () => {
    const r = validarNovaMensagem({ conversaId: "x", direcao: "recebida" as never, conteudo: "oi" });
    expect(!r.ok && r.field).toBe("direcao");
  });

  it("aceita enviada e interna com conteúdo", () => {
    const enviada = { conversaId: "x", direcao: "enviada", conteudo: "Olá" } as const;
    const interna = { conversaId: "x", direcao: "interna", conteudo: "Nota", emRespostaAId: "m1" } as const;
    expect(validarNovaMensagem(enviada)).toEqual({ ok: true, value: enviada });
    expect(validarNovaMensagem(interna)).toEqual({ ok: true, value: interna });
  });
});

describe("valores discretos espelham os CHECK da 008", () => {
  it("DIRECOES_DE_ENVIO não contém recebida (T-08-22)", () => {
    expect([...DIRECOES_DE_ENVIO]).toEqual(["enviada", "interna"]);
    expect(DIRECOES_DE_ENVIO as readonly string[]).not.toContain("recebida");
  });

  it("direções, status de entrega e atores", () => {
    expect([...DIRECOES_DA_MENSAGEM]).toEqual(["recebida", "enviada", "interna"]);
    expect([...STATUS_DE_ENTREGA]).toEqual(["pendente", "enviada", "entregue", "lida", "falhou"]);
    expect([...TIPOS_DE_ATOR_DA_MENSAGEM]).toEqual(["member", "agent", "automation", "integration", "system"]);
  });
});
