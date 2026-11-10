/**
 * O recebimento de Mensagem (3.6.2, MSG-01): em que Conversa a recebida cai
 * (RN-CXE-09) e o que o Contato que a mandou vira (RN-CON-13).
 */

import { describe, expect, it } from "vitest";
import { JANELA_DE_REABERTURA_PADRAO_HORAS, contatoDaRecebida, destinoDaRecebida } from "./recebimento";

const AGORA = Date.parse("2026-11-09T12:00:00.000Z");
const horasAtras = (horas: number) => new Date(AGORA - horas * 3_600_000).toISOString();

describe("destinoDaRecebida (RN-CXE-09)", () => {
  it("sem Conversa aberta e sem resolvida, abre uma", () => {
    expect(destinoDaRecebida({ aberta: null, ultimaResolvida: null, janelaDeReaberturaHoras: 72, agora: AGORA })).toEqual({ acao: "abrir" });
  });

  it("reaproveita a Conversa aberta sem mudar a situação", () => {
    expect(
      destinoDaRecebida({ aberta: { id: "c1", situacao: "aberta" }, ultimaResolvida: null, janelaDeReaberturaHoras: 72, agora: AGORA }),
    ).toEqual({ acao: "usar", conversaId: "c1", voltaParaAberta: false });
  });

  it("a Conversa pendente é reaproveitada e volta a aberta", () => {
    expect(
      destinoDaRecebida({ aberta: { id: "c2", situacao: "pendente" }, ultimaResolvida: null, janelaDeReaberturaHoras: 72, agora: AGORA }),
    ).toEqual({ acao: "usar", conversaId: "c2", voltaParaAberta: true });
  });

  it("a aberta vence a resolvida: a resolvida mais nova é ignorada quando há aberta", () => {
    expect(
      destinoDaRecebida({
        aberta: { id: "c3", situacao: "aberta" },
        ultimaResolvida: { id: "c0", resolvidaEm: horasAtras(1), naLixeira: false },
        janelaDeReaberturaHoras: 72,
        agora: AGORA,
      }),
    ).toEqual({ acao: "usar", conversaId: "c3", voltaParaAberta: false });
  });

  it("reabre a resolvida há 10 h quando a janela é de 72 h", () => {
    expect(
      destinoDaRecebida({
        aberta: null,
        ultimaResolvida: { id: "c4", resolvidaEm: horasAtras(10), naLixeira: false },
        janelaDeReaberturaHoras: 72,
        agora: AGORA,
      }),
    ).toEqual({ acao: "reabrir", conversaId: "c4" });
  });

  it("abre outra quando a resolvida passou da janela (80 h contra 72 h)", () => {
    expect(
      destinoDaRecebida({
        aberta: null,
        ultimaResolvida: { id: "c5", resolvidaEm: horasAtras(80), naLixeira: false },
        janelaDeReaberturaHoras: 72,
        agora: AGORA,
      }),
    ).toEqual({ acao: "abrir" });
  });

  it("os dois lados do limite da janela: exatamente na hora ainda reabre, um milissegundo depois não", () => {
    const naHora = new Date(AGORA - 72 * 3_600_000).toISOString();
    const depois = new Date(AGORA - 72 * 3_600_000 - 1).toISOString();
    const base = { aberta: null, janelaDeReaberturaHoras: 72, agora: AGORA } as const;
    expect(destinoDaRecebida({ ...base, ultimaResolvida: { id: "c6", resolvidaEm: naHora, naLixeira: false } })).toEqual({ acao: "reabrir", conversaId: "c6" });
    expect(destinoDaRecebida({ ...base, ultimaResolvida: { id: "c6", resolvidaEm: depois, naLixeira: false } })).toEqual({ acao: "abrir" });
  });

  it("uma resolvida que está na lixeira nunca é reaberta: abre outra", () => {
    expect(
      destinoDaRecebida({
        aberta: null,
        ultimaResolvida: { id: "c7", resolvidaEm: horasAtras(1), naLixeira: true },
        janelaDeReaberturaHoras: 72,
        agora: AGORA,
      }),
    ).toEqual({ acao: "abrir" });
  });

  it("janela menor muda o desfecho: 2 h contra 1 h abre outra", () => {
    expect(
      destinoDaRecebida({
        aberta: null,
        ultimaResolvida: { id: "c8", resolvidaEm: horasAtras(2), naLixeira: false },
        janelaDeReaberturaHoras: 1,
        agora: AGORA,
      }),
    ).toEqual({ acao: "abrir" });
  });
});

describe("contatoDaRecebida (RN-CON-13)", () => {
  it("o Contato ativo fica como está", () => {
    expect(contatoDaRecebida("ativo")).toEqual({ acao: "manter" });
  });

  it("o Contato arquivado volta a ativo", () => {
    expect(contatoDaRecebida("arquivado")).toEqual({ acao: "reativar" });
  });

  it("o Contato na lixeira volta a ativo", () => {
    expect(contatoDaRecebida("na_lixeira")).toEqual({ acao: "reativar" });
  });

  it("o Contato mesclado é recusado: o Identificador dele vive no sobrevivente", () => {
    expect(contatoDaRecebida("mesclado")).toEqual({ acao: "recusar" });
  });
});

describe("JANELA_DE_REABERTURA_PADRAO_HORAS", () => {
  it("é o padrão do seed, 72 h", () => {
    expect(JANELA_DE_REABERTURA_PADRAO_HORAS).toBe(72);
  });
});
