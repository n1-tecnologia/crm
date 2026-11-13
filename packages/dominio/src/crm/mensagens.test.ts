/**
 * A Mensagem relacional (Fase 8): validação de uma Mensagem nova, a regra de
 * envio por (tipo, provedor) — RN-CXE-19 — e o status inicial (B69). Cada
 * teste afirma o resultado devolvido, nunca que uma função foi chamada.
 */

import { describe, expect, it } from "vitest";
import {
  DIRECOES_DA_MENSAGEM,
  DIRECOES_DE_ENVIO,
  FRASE_SO_MODELO_PRIMEIRO,
  FRASE_SO_RESPONDE,
  fraseDaJanelaBloqueada,
  STATUS_DE_ENTREGA,
  TIPOS_DE_ATOR_DA_MENSAGEM,
  leEdicoesExternas,
  leMarcacaoDeExclusao,
  leReacoes,
  proximaEdicaoExterna,
  proximaMarcacaoDeExclusao,
  proximasReacoes,
  proximoStatusDeEntrega,
  reacoesVigentes,
  statusInicialDeEnvio,
  validarAnexosDoEnvio,
  validarEnvio,
  validarNovaMensagem,
  type AnexoConfirmado,
  type Reacao,
} from "./mensagens";
import { categoriaDaMidia } from "./midia";

const HORA = 3_600_000;
const AGORA = Date.parse("2026-10-12T12:00:00.000Z");
const haHoras = (horas: number): string => new Date(AGORA - horas * HORA).toISOString();

const OFICIAL = { responseWindowHours: 24, foraDaJanela: "soModelo" } as const;
const NAO_OFICIAL = { foraDaJanela: "livre" } as const;
const INSTAGRAM = { responseWindowHours: 24, foraDaJanela: "bloqueado" } as const;

describe("validarEnvio no Instagram (`bloqueado`, Sessão 8 8.3.4)", () => {
  it("antes da primeira mensagem do Contato, recusa: só se responde a quem escreveu", () => {
    expect(validarEnvio({ capacidades: INSTAGRAM, ultimaRecebidaEm: null, agora: AGORA, modelosAprovados: [] })).toEqual({
      ok: false,
      error: FRASE_SO_RESPONDE,
      field: "conteudo",
    });
  });

  it("dentro das 24 h, passa; no último instante da janela, ainda passa", () => {
    expect(validarEnvio({ capacidades: INSTAGRAM, ultimaRecebidaEm: haHoras(3), agora: AGORA, modelosAprovados: [] }).ok).toBe(true);
    expect(validarEnvio({ capacidades: INSTAGRAM, ultimaRecebidaEm: haHoras(24), agora: AGORA, modelosAprovados: [] }).ok).toBe(true);
  });

  it("fora das 24 h, recusa falando que só o Contato reabre, nunca em Mensagem de modelo", () => {
    const resultado = validarEnvio({ capacidades: INSTAGRAM, ultimaRecebidaEm: haHoras(30), agora: AGORA, modelosAprovados: ["m1"], modeloId: "m1" });
    expect(resultado).toEqual({ ok: false, error: fraseDaJanelaBloqueada(24), field: "conteudo" });
    if (!resultado.ok) expect(resultado.error).not.toMatch(/modelo/i);
  });
});

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

  describe("oficial sem nenhuma recebida (7.2.6): a empresa só abre a conversa com modelo aprovado", () => {
    it("texto livre é recusado, com o campo modelo e a frase de começar a conversa", () => {
      const resultado = validarEnvio({ capacidades: OFICIAL, ultimaRecebidaEm: null, agora: AGORA, modelosAprovados: ["m1"] });
      expect(resultado).toEqual({ ok: false, error: FRASE_SO_MODELO_PRIMEIRO, field: "modelo" });
    });

    it("sem modelo aprovado no Canal, recusa dizendo que não há como começar", () => {
      const resultado = validarEnvio({ capacidades: OFICIAL, ultimaRecebidaEm: null, agora: AGORA, modelosAprovados: [] });
      expect(resultado).toMatchObject({ ok: false, field: "modelo" });
      expect(!resultado.ok && resultado.error).toMatch(/não dá para começar a conversa/);
    });

    it("modelo aprovado passa", () => {
      expect(
        validarEnvio({ capacidades: OFICIAL, ultimaRecebidaEm: null, agora: AGORA, modeloId: "m1", modelosAprovados: ["m1"] }),
      ).toEqual({ ok: true, value: undefined });
    });

    it("modelo que não é do Canal é recusado", () => {
      expect(
        validarEnvio({ capacidades: OFICIAL, ultimaRecebidaEm: null, agora: AGORA, modeloId: "x", modelosAprovados: ["m1"] }),
      ).toMatchObject({ ok: false, field: "modelo" });
    });

    it("não muda o que não é oficial: o não oficial continua livre sem recebida", () => {
      expect(validarEnvio({ capacidades: NAO_OFICIAL, ultimaRecebidaEm: null, agora: AGORA, modelosAprovados: [] })).toEqual({
        ok: true,
        value: undefined,
      });
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

describe("Reações (4.4.5): o registro é de acréscimo, e vale a última de cada autor", () => {
  const reacao = (autor: Reacao["autor"], emoji: string, em: string): Reacao => ({ autor, emoji, em });
  const T1 = "2026-10-12T12:00:00.000Z";
  const T2 = "2026-10-12T12:01:00.000Z";
  const T3 = "2026-10-12T12:02:00.000Z";

  it("a primeira reação entra no registro", () => {
    expect(proximasReacoes([], reacao("contato", "👍", T1))).toEqual([reacao("contato", "👍", T1)]);
  });

  it("trocar o símbolo ACRESCENTA: o antigo continua no registro e vale o novo", () => {
    const depois = proximasReacoes([reacao("contato", "👍", T1)], reacao("contato", "❤️", T2))!;
    expect(depois).toHaveLength(2);
    expect(reacoesVigentes(depois)).toEqual([{ autor: "contato", emoji: "❤️" }]);
  });

  it("remover é um registro com o símbolo vazio, e a reação some das vigentes", () => {
    const depois = proximasReacoes([reacao("contato", "👍", T1)], reacao("contato", "", T2))!;
    expect(depois).toHaveLength(2);
    expect(reacoesVigentes(depois)).toEqual([]);
  });

  it("a repetida (o provedor reenvia) não muda nada", () => {
    expect(proximasReacoes([reacao("contato", "👍", T1)], reacao("contato", "👍", T1))).toBeNull();
  });

  it("remover o que não existia não muda nada", () => {
    expect(proximasReacoes([], reacao("contato", "", T1))).toBeNull();
    expect(proximasReacoes([reacao("contato", "👍", T1), reacao("contato", "", T2)], reacao("contato", "", T3))).toBeNull();
  });

  it("a que chega mais VELHA que a vigente do mesmo autor é ignorada (a rede não garante a ordem)", () => {
    expect(proximasReacoes([reacao("contato", "❤️", T2)], reacao("contato", "👍", T1))).toBeNull();
  });

  it("o Contato e o celular do Canal reagem à mesma Mensagem, cada um com a sua, e o Contato vem primeiro", () => {
    const registro = proximasReacoes([reacao("canal", "🙏", T1)], reacao("contato", "👍", T2))!;
    expect(reacoesVigentes(registro)).toEqual([
      { autor: "contato", emoji: "👍" },
      { autor: "canal", emoji: "🙏" },
    ]);
  });

  it("o momento inválido não entra", () => {
    expect(proximasReacoes([], reacao("contato", "👍", "ontem"))).toBeNull();
  });

  it("reacoesVigentes escolhe pelo momento, não pela ordem em que foram gravadas", () => {
    expect(reacoesVigentes([reacao("contato", "❤️", T2), reacao("contato", "👍", T1)])).toEqual([{ autor: "contato", emoji: "❤️" }]);
  });

  it("leReacoes fica só com o formato de hoje: o dado antigo da migração não passa", () => {
    expect(leReacoes([reacao("contato", "👍", T1), { emoji: "x" }, "texto", null, { autor: "outro", emoji: "a", em: T1 }])).toEqual([reacao("contato", "👍", T1)]);
    expect(leReacoes(null)).toEqual([]);
    expect(leReacoes({})).toEqual([]);
  });
});

describe("Marcação de exclusão (4.4.5): terminal", () => {
  const nova = { porQuem: "remetente_externo", em: "2026-10-12T12:00:00.000Z" } as const;

  it("a primeira vale", () => {
    expect(proximaMarcacaoDeExclusao(null, nova)).toEqual(nova);
  });

  it("a segunda não muda nada: a primeira fica", () => {
    expect(proximaMarcacaoDeExclusao(nova, { porQuem: "celular_do_canal", em: "2026-10-12T13:00:00.000Z" })).toBeNull();
  });

  it("o momento inválido não vale", () => {
    expect(proximaMarcacaoDeExclusao(null, { porQuem: "interno", em: "amanhã" })).toBeNull();
  });

  it("leMarcacaoDeExclusao lê só o formato de hoje", () => {
    expect(leMarcacaoDeExclusao(nova)).toEqual(nova);
    expect(leMarcacaoDeExclusao({ porQuem: "alguem", em: nova.em })).toBeNull();
    expect(leMarcacaoDeExclusao(null)).toBeNull();
    expect(leMarcacaoDeExclusao("apagada")).toBeNull();
  });
});

describe("Edição pelo remetente externo (4.4.5; RN-CXE-16)", () => {
  const recebida = { direcao: "recebida", conteudo: "oi, tudo bem?", marcacaoExclusao: null, edicoesExternas: [] } as const;
  const EM = "2026-10-12T12:05:00.000Z";

  it("o conteúdo passa a ser o novo e o anterior vai para o histórico", () => {
    expect(proximaEdicaoExterna(recebida, "oi, tudo bem com você?", EM)).toEqual({
      conteudo: "oi, tudo bem com você?",
      edicoesExternas: [{ conteudoAnterior: "oi, tudo bem?", em: EM }],
    });
  });

  it("a segunda edição acrescenta ao histórico, da mais antiga à mais nova", () => {
    const primeira = { conteudoAnterior: "a", em: "2026-10-12T12:01:00.000Z" };
    const r = proximaEdicaoExterna({ ...recebida, conteudo: "b", edicoesExternas: [primeira] }, "c", EM)!;
    expect(r.edicoesExternas).toEqual([primeira, { conteudoAnterior: "b", em: EM }]);
  });

  it("a `enviada` e a `interna` nunca são editadas: corrige-se enviando outra", () => {
    expect(proximaEdicaoExterna({ ...recebida, direcao: "enviada" }, "novo", EM)).toBeNull();
    expect(proximaEdicaoExterna({ ...recebida, direcao: "interna" }, "novo", EM)).toBeNull();
  });

  it("a Mensagem apagada é terminal: a edição não a muda", () => {
    expect(proximaEdicaoExterna({ ...recebida, marcacaoExclusao: { porQuem: "remetente_externo", em: EM } }, "novo", EM)).toBeNull();
  });

  it("não muda nada quando o conteúdo novo é vazio ou igual ao atual (o provedor reenvia)", () => {
    expect(proximaEdicaoExterna(recebida, "   ", EM)).toBeNull();
    expect(proximaEdicaoExterna(recebida, "oi, tudo bem?", EM)).toBeNull();
  });

  it("o momento inválido não vale", () => {
    expect(proximaEdicaoExterna(recebida, "novo", "agora")).toBeNull();
  });

  it("leEdicoesExternas lê só o formato de hoje", () => {
    expect(leEdicoesExternas([{ conteudoAnterior: "a", em: EM }, { conteudoAnterior: null, em: EM }, { em: EM }, 3])).toEqual([
      { conteudoAnterior: "a", em: EM },
      { conteudoAnterior: null, em: EM },
    ]);
  });
});

describe("validarNovaMensagem com modelo (7.3)", () => {
  const base = { conversaId: "c1", direcao: "enviada" as const, conteudo: "", modeloId: "mdl_1", variaveis: ["Ana"] };

  it("a Mensagem de modelo passa com o conteúdo vazio: o texto vem do modelo", () => {
    expect(validarNovaMensagem(base)).toEqual({ ok: true, value: base });
  });

  it("só a Mensagem enviada usa modelo: a nota interna é recusada no campo modeloId", () => {
    expect(validarNovaMensagem({ ...base, direcao: "interna" })).toEqual({ ok: false, error: "Só uma Mensagem enviada usa modelo.", field: "modeloId" });
  });

  it("o modelo não leva arquivo", () => {
    const anexo = { submissionId: "s", objectId: "o" };
    expect(validarNovaMensagem({ ...base, anexos: [anexo] })).toEqual({ ok: false, error: "Uma Mensagem de modelo não leva arquivo.", field: "anexos" });
  });

  it("sem modelo nada muda: o conteúdo vazio sem anexo continua recusado", () => {
    expect(validarNovaMensagem({ conversaId: "c1", direcao: "enviada", conteudo: "" })).toMatchObject({ ok: false, field: "conteudo" });
    expect(validarNovaMensagem({ conversaId: "c1", direcao: "enviada", conteudo: "", modeloId: "" })).toMatchObject({ ok: false, field: "conteudo" });
  });
});
