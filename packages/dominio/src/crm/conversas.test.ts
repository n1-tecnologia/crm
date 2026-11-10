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
  identificadorDeResposta,
  participantesComContato,
  proximaSituacao,
  tituloDaConversa,
  validarAtribuicao,
  validarLixeira,
  validarMover,
  validarMarcacao,
  validarNovaConversa,
  validarRestauracao,
  type ParticipanteDaConversa,
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

describe("validarMover (3.2.5: a Conversa muda de Contato, o Canal e as Mensagens ficam)", () => {
  const conversa = { estado: "ativo", contatoId: "c1" } as const;

  it("aceita um Contato ativo diferente do atual", () => {
    expect(validarMover(conversa, { id: "c2", estado: "ativo" })).toEqual({ ok: true, value: undefined });
  });

  it("recusa Conversa na lixeira", () => {
    expect(validarMover({ estado: "na_lixeira", contatoId: "c1" }, { id: "c2", estado: "ativo" })).toEqual({
      ok: false,
      error: "Uma Conversa na lixeira não muda de Contato.",
    });
  });

  it("recusa o mesmo Contato, no campo contatoId", () => {
    expect(validarMover(conversa, { id: "c1", estado: "ativo" })).toEqual({
      ok: false,
      error: "A Conversa já é deste Contato.",
      field: "contatoId",
    });
  });

  it.each(["arquivado", "na_lixeira", "mesclado"] as const)("recusa destino %s, no campo contatoId", (estado) => {
    expect(validarMover(conversa, { id: "c2", estado })).toEqual({
      ok: false,
      error: "Escolha um Contato ativo.",
      field: "contatoId",
    });
  });
});

describe("participantesComContato", () => {
  const participante = (id: string, tipo: ParticipanteDaConversa["sujeito"]["tipo"], sujeitoId: string, principal: boolean): ParticipanteDaConversa => ({
    id,
    sujeito: { tipo, id: sujeitoId },
    papel: tipo === "contato" ? "contato" : "atendente",
    principal,
    entrouEm: "2026-01-01T00:00:00.000Z",
    saiuEm: null,
  });

  it("troca só o sujeito dos Participantes contato que apontavam para a origem, mantendo principal", () => {
    const antes = [participante("p1", "contato", "c1", true), participante("p2", "membro", "c1", false), participante("p3", "contato", "c9", false)];
    const depois = participantesComContato(antes, "c1", "c2");
    expect(depois.map((p) => [p.id, p.sujeito.tipo, p.sujeito.id, p.principal])).toEqual([
      ["p1", "contato", "c2", true],
      ["p2", "membro", "c1", false],
      ["p3", "contato", "c9", false],
    ]);
  });

  it("não muda a lista original", () => {
    const antes = [participante("p1", "contato", "c1", true)];
    participantesComContato(antes, "c1", "c2");
    expect(antes[0]?.sujeito.id).toBe("c1");
  });
});

describe("validarAtribuicao (3.2.6, parte 1)", () => {
  it("aceita Conversa ativa", () => {
    expect(validarAtribuicao({ estado: "ativo" })).toEqual({ ok: true, value: undefined });
  });

  it("recusa Conversa na lixeira", () => {
    expect(validarAtribuicao({ estado: "na_lixeira" })).toEqual({
      ok: false,
      error: "Uma Conversa na lixeira não é atribuída. Restaure-a antes.",
    });
  });
});

describe("validarLixeira (3.2.6: só a Conversa resolvida vai para a lixeira)", () => {
  it("aceita a Conversa resolvida e ativa", () => {
    expect(validarLixeira({ situacao: "resolvida", estado: "ativo" })).toEqual({ ok: true, value: undefined });
  });

  it.each(["aberta", "pendente"] as const)("recusa a Conversa %s: resolva antes", (situacao) => {
    expect(validarLixeira({ situacao, estado: "ativo" })).toEqual({
      ok: false,
      error: "Resolva a Conversa antes de mandá-la para a lixeira.",
    });
  });

  it("recusa a Conversa que já está na lixeira", () => {
    expect(validarLixeira({ situacao: "resolvida", estado: "na_lixeira" })).toEqual({
      ok: false,
      error: "A Conversa já está na lixeira.",
    });
  });
});

describe("validarRestauracao (3.2.6: a Conversa volta para ativo, mas não para um Contato na lixeira)", () => {
  it("aceita a Conversa na lixeira com Contato ativo, arquivado ou mesclado", () => {
    for (const estado of ["ativo", "arquivado", "mesclado"] as const) {
      expect(validarRestauracao({ estado: "na_lixeira" }, { estado })).toEqual({ ok: true, value: undefined });
    }
  });

  it("recusa a Conversa que não está na lixeira", () => {
    expect(validarRestauracao({ estado: "ativo" }, { estado: "ativo" })).toEqual({
      ok: false,
      error: "A Conversa não está na lixeira.",
    });
  });

  it("recusa quando o Contato está na lixeira: restaure o Contato antes", () => {
    expect(validarRestauracao({ estado: "na_lixeira" }, { estado: "na_lixeira" })).toEqual({
      ok: false,
      error: "O Contato está na lixeira. Restaure o Contato antes: uma Conversa sem Contato resolvido não é roteável.",
    });
  });
});

describe("validarMarcacao (3.2.6: estrela e leitura são do Membro)", () => {
  it("aceita só a estrela, só a leitura ou as duas", () => {
    expect(validarMarcacao({ estrela: false })).toEqual({ ok: true, value: { estrela: false } });
    expect(validarMarcacao({ lidaAte: "2026-11-04T10:00:00.000Z" })).toEqual({ ok: true, value: { lidaAte: "2026-11-04T10:00:00.000Z" } });
    expect(validarMarcacao({ estrela: true, lidaAte: "2026-11-04T10:00:00Z" }).ok).toBe(true);
  });

  it("recusa a edição sem campo algum", () => {
    expect(validarMarcacao({})).toEqual({ ok: false, error: "Informe a estrela ou até quando a Conversa foi lida." });
  });

  it.each(["ontem", "2026-11-04", "2026-13-45T00:00:00Z", ""])("recusa lidaAte %j, no campo lidaAte", (lidaAte) => {
    expect(validarMarcacao({ lidaAte })).toEqual({
      ok: false,
      error: "Informe a data de leitura em ISO 8601, com hora (AAAA-MM-DDTHH:MM:SSZ).",
      field: "lidaAte",
    });
  });
});

describe("identificadorDeResposta (WR-04: a resposta vai por onde o Contato escreveu)", () => {
  const A = { id: "a", tipo: "whatsapp", principal: true } as const;
  const B = { id: "b", tipo: "whatsapp", principal: false } as const;
  const email = { id: "e", tipo: "email", principal: true } as const;
  const canalWhatsapp = { tipo: "whatsapp" } as const;

  it("WR-04: com o id de quem escreveu entre os do tipo do Canal, devolve esse (B, não o principal A)", () => {
    expect(identificadorDeResposta([A, B], canalWhatsapp, B.id)).toBe(B);
  });

  it("WR-04: sem id de quem escreveu (null ou undefined) devolve o principal do tipo", () => {
    expect(identificadorDeResposta([B, A], canalWhatsapp, null)).toBe(A);
    expect(identificadorDeResposta([B, A], canalWhatsapp)).toBe(A);
  });

  it("WR-04: um id que não está na lista (transferido ou removido) volta ao principal", () => {
    expect(identificadorDeResposta([A, B], canalWhatsapp, "outro-contato")).toBe(A);
  });

  it("WR-04: o id de um Identificador de outro tipo (e-mail) num Canal de WhatsApp volta ao principal", () => {
    expect(identificadorDeResposta([A, B, email], canalWhatsapp, email.id)).toBe(A);
  });

  it("WR-04: sem principal do tipo devolve o primeiro do tipo, e sem nenhum do tipo, undefined", () => {
    const C = { id: "c", tipo: "whatsapp", principal: false } as const;
    expect(identificadorDeResposta([B, C], canalWhatsapp)).toBe(B);
    expect(identificadorDeResposta([email], canalWhatsapp)).toBeUndefined();
    expect(identificadorDeResposta([], canalWhatsapp, "a")).toBeUndefined();
  });
});
