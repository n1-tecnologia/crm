import { describe, expect, it } from "vitest";
import { MOTIVO_CURTO, comoResolver, estadoEmPalavras } from "./frases-do-microfone";

describe("o estado da conversa por voz em palavras", () => {
  it("o microfone de verdade: nada desligado, a frase de cada estado, e respondendo por cima", () => {
    expect(estadoEmPalavras({ microfone: "desligado", respondendo: false, simulacao: null })).toEqual({ aviso: "", agora: "" });
    expect(estadoEmPalavras({ microfone: "ouvindo", respondendo: false, simulacao: null }).agora).toBe("Pode falar — estou ouvindo.");
    expect(estadoEmPalavras({ microfone: "ouvindo", respondendo: true, simulacao: null }).agora).toBe("Respondendo…");
  });

  it("a conversa simulada: o motivo curto e o ponto da conversa", () => {
    const falando = { motivo: "sem-microfone", fase: "falando", pergunta: "Quantas tarefas vencidas eu tenho?" } as const;
    expect(estadoEmPalavras({ microfone: "desligado", respondendo: false, simulacao: falando })).toEqual({
      aviso: "Nenhum microfone encontrado — simulando a sua fala.",
      agora: "“Quantas tarefas vencidas eu tenho?”",
    });
    expect(estadoEmPalavras({ microfone: "desligado", respondendo: true, simulacao: { ...falando, fase: "esperando" } }).agora).toBe("Respondendo…");
    expect(estadoEmPalavras({ microfone: "desligado", respondendo: false, simulacao: { ...falando, fase: "esperando" } }).agora).toBe(
      "Toque de novo para encerrar a conversa.",
    );
  });

  it("todo motivo tem uma frase curta (cabe numa linha) e um caminho para resolver", () => {
    for (const [motivo, curto] of Object.entries(MOTIVO_CURTO)) {
      expect(curto.length).toBeLessThanOrEqual(40);
      expect(comoResolver("windows", motivo as keyof typeof MOTIVO_CURTO).length).toBeGreaterThan(20);
    }
  });

  it("o caminho segue o sistema, e só manda tentar de novo quando adianta", () => {
    expect(comoResolver("windows", "sistema")).toMatch(/Configurações › Privacidade e segurança › Microfone/);
    expect(comoResolver("mac", "sistema")).toMatch(/Ajustes do Sistema/);
    expect(comoResolver("windows", "sem-microfone")).toMatch(/Sistema › Som › Entrada/);
    expect(comoResolver("mac", "sem-microfone")).not.toMatch(/Sistema › Som/);
    expect(comoResolver("windows", "negado")).toMatch(/toque no microfone de novo/);
    expect(comoResolver("windows", "inseguro")).not.toMatch(/de novo/);
  });
});
