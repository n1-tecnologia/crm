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
  proximoStatusDeEntrega,
  statusInicialDeEnvio,
  validarAnexosDoEnvio,
  validarEnvio,
  validarNovaMensagem,
  type AnexoConfirmado,
} from "./mensagens";
import { categoriaDaMidia } from "./midia";

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
  it.each(["conectada", "desconectada", "com_erro"] as const)("Canal %s: a Mensagem nasce pendente (só o provedor diz que saiu)", (conexao) => {
    expect(statusInicialDeEnvio(conexao)).toBe("pendente");
  });
});

describe("validarNovaMensagem", () => {
  it("recusa conteúdo vazio sem anexo, no campo conteudo", () => {
    const r = validarNovaMensagem({ conversaId: "x", direcao: "enviada", conteudo: "" });
    expect(r).toEqual({ ok: false, error: "Escreva a mensagem ou anexe um arquivo antes de enviar.", field: "conteudo" });
    expect(validarNovaMensagem({ conversaId: "x", direcao: "enviada", conteudo: " ", anexos: [] }).ok).toBe(false);
  });

  it("INV-CXE-07: aceita a Mensagem só com anexo (conteúdo vazio, uma referência)", () => {
    const entrada = { conversaId: "x", direcao: "enviada", conteudo: "", anexos: [{ submissionId: "s1", objectId: "o1" }] } as const;
    expect(validarNovaMensagem(entrada)).toEqual({ ok: true, value: entrada });
  });

  it("aceita texto com anexo e recusa mais de um anexo (uma Mensagem tem um id externo só)", () => {
    const um = { conversaId: "x", direcao: "enviada", conteudo: "veja", anexos: [{ submissionId: "s1", objectId: "o1" }] } as const;
    expect(validarNovaMensagem(um).ok).toBe(true);
    const dois = { ...um, anexos: [...um.anexos, { submissionId: "s2", objectId: "o2" }] };
    const r = validarNovaMensagem(dois);
    expect(!r.ok && r.field).toBe("anexos");
  });

  it("recusa referência de anexo sem submissionId ou sem objectId", () => {
    const base = { conversaId: "x", direcao: "enviada", conteudo: "" } as const;
    expect(validarNovaMensagem({ ...base, anexos: [{ submissionId: " ", objectId: "o1" }] }).ok).toBe(false);
    expect(validarNovaMensagem({ ...base, anexos: [{ submissionId: "s1", objectId: "" }] }).ok).toBe(false);
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

describe("validarAnexosDoEnvio (3.9.1: o Canal só envia as categorias que declara)", () => {
  const anexo = (tipoDeMidia: string): AnexoConfirmado => ({ objectKey: "k", nome: "arquivo", tipoDeMidia, tamanhoBytes: 10 });

  it("um Canal que não envia vídeo recusa vídeo, com a frase do produto e o campo anexos", () => {
    const r = validarAnexosDoEnvio([anexo("video/mp4")], ["image", "document"]);
    expect(r).toEqual({ ok: false, error: "Este Canal não envia este tipo de arquivo.", field: "anexos" });
  });

  it("aceita o que a categoria do Canal cobre, inclusive o tipo com parâmetro", () => {
    expect(validarAnexosDoEnvio([anexo("image/png")], ["image", "document"]).ok).toBe(true);
    expect(validarAnexosDoEnvio([anexo("application/pdf")], ["document"]).ok).toBe(true);
    expect(validarAnexosDoEnvio([anexo("audio/ogg; codecs=opus")], ["audio"]).ok).toBe(true);
    expect(validarAnexosDoEnvio([], []).ok).toBe(true);
  });

  it("recusa o tipo que nem está na lista da Mensagem, mesmo que o Canal declare a categoria", () => {
    expect(validarAnexosDoEnvio([anexo("application/x-msdownload")], ["image", "video", "audio", "document"]).ok).toBe(false);
    expect(categoriaDaMidia("application/x-msdownload")).toBeUndefined();
  });

  it("o Instagram (sem documento) recusa um PDF e aceita uma imagem", () => {
    expect(validarAnexosDoEnvio([anexo("application/pdf")], ["image", "video", "audio"]).ok).toBe(false);
    expect(validarAnexosDoEnvio([anexo("image/jpeg")], ["image", "video", "audio"]).ok).toBe(true);
  });
});

describe("proximoStatusDeEntrega (3.6.5: o status do provedor só avança)", () => {
  it.each([
    ["pendente", "enviada", "enviada"],
    ["enviada", "entregue", "entregue"],
    ["entregue", "lida", "lida"],
    ["enviada", "lida", "lida"],
    ["pendente", "entregue", "entregue"],
    ["pendente", "falhou", "falhou"],
    ["enviada", "falhou", "falhou"],
  ] as const)("(%s, %s) avança para %s", (atual, novo, esperado) => {
    expect(proximoStatusDeEntrega(atual, novo)).toBe(esperado);
  });

  it.each([
    ["lida", "entregue"],
    ["lida", "enviada"],
    ["entregue", "enviada"],
    ["enviada", "pendente"],
    ["entregue", "pendente"],
    ["lida", "lida"],
    ["enviada", "enviada"],
  ] as const)("(%s, %s) não anda para trás nem repete: continua %s", (atual, novo) => {
    expect(proximoStatusDeEntrega(atual, novo)).toBe(atual);
  });

  it("falhou só nasce de pendente ou de enviada: entregue e lida continuam como estão", () => {
    expect(proximoStatusDeEntrega("entregue", "falhou")).toBe("entregue");
    expect(proximoStatusDeEntrega("lida", "falhou")).toBe("lida");
  });

  it("nada sai de falhou por status do provedor (só 'Tentar de novo' tira)", () => {
    for (const novo of STATUS_DE_ENTREGA) expect(proximoStatusDeEntrega("falhou", novo)).toBe("falhou");
  });

  it("Mensagem sem status de entrega (recebida, interna) continua sem: null", () => {
    for (const novo of STATUS_DE_ENTREGA) expect(proximoStatusDeEntrega(null, novo)).toBeNull();
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
