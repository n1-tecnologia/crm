import { describe, expect, it } from "vitest";
import { FALA_OUVIDA, ROTEIRO_SIMULADO, intencaoDe, normalizar, responderEmTexto, type Panorama } from "./respostas-do-robo";

const PANORAMA: Panorama = {
  nome: "Thiago",
  tarefas: { abertas: 4, vencidas: 2, urgentes: ["Ligar para a Ana", "Enviar a proposta"] },
  notificacoes: { total: 5, mencoes: 1, aprovacoes: 1, conversas: 1, vencidas: 2 },
  contatos: { total: 12, recentes: ["Ana Souza", "Bruno Lima"] },
  negocios: { abertos: 3, valorPonderado: "R$ 12.500,00" },
  conversas: { abertas: 6, minhas: 2 },
};

const VAZIO: Panorama = {
  nome: "",
  tarefas: { abertas: 0, vencidas: 0, urgentes: [] },
  notificacoes: { total: 0, mencoes: 0, aprovacoes: 0, conversas: 0, vencidas: 0 },
  contatos: { total: 0, recentes: [] },
  negocios: { abertos: 0, valorPonderado: null },
  conversas: { abertas: 0, minhas: 0 },
};

describe("normalizar", () => {
  it("tira acento e maiúscula e junta espaços", () => {
    expect(normalizar("  Quantas   TAREFAS   VENCIDAS? ")).toBe("quantas tarefas vencidas?");
    expect(normalizar("Notificações, menções e aprovações")).toBe("notificacoes, mencoes e aprovacoes");
  });
});

describe("intenção", () => {
  it("reconhece cada assunto por radical, com ou sem acento", () => {
    expect(intencaoDe("Quantas tarefas vencidas eu tenho?")).toBe("tarefas");
    expect(intencaoDe("tem algo atrasado?")).toBe("tarefas");
    expect(intencaoDe("Há notificações?")).toBe("notificacoes");
    expect(intencaoDe("alguma menção pra mim")).toBe("notificacoes");
    expect(intencaoDe("como está o funil de vendas")).toBe("negocios");
    expect(intencaoDe("quais os últimos contatos")).toBe("contatos");
    expect(intencaoDe("tem conversa aberta na caixa de entrada?")).toBe("conversas");
    expect(intencaoDe("Quem é você?")).toBe("ajuda");
    expect(intencaoDe("Olá!")).toBe("saudacao");
  });

  it("o assunto ganha da saudação: 'oi, quantas tarefas eu tenho?' é de tarefas", () => {
    expect(intencaoDe("oi, quantas tarefas eu tenho?")).toBe("tarefas");
  });

  it("'oi' é palavra inteira: 'foi' não cumprimenta", () => {
    expect(intencaoDe("foi bom")).toBeNull();
    expect(intencaoDe("oi")).toBe("saudacao");
  });

  it("sem assunto conhecido, nada", () => {
    expect(intencaoDe("qual a capital da França")).toBeNull();
  });
});

describe("o roteiro da conversa simulada", () => {
  it("cada pergunta cai numa intenção que o robô sabe responder, sem repetir assunto", () => {
    const intencoes = ROTEIRO_SIMULADO.map(intencaoDe);
    expect(intencoes.every((i) => i !== null)).toBe(true);
    expect(new Set(intencoes).size).toBe(ROTEIRO_SIMULADO.length);
    expect(intencoes).toEqual(["ajuda", "tarefas", "notificacoes", "negocios", "contatos", "conversas"]);
  });
});

describe("responderEmTexto", () => {
  it("uma fala pelo microfone (null) diz que o robô só reage ao som", () => {
    expect(responderEmTexto(null, PANORAMA)).toBe(FALA_OUVIDA);
  });

  it("tarefas: conta as abertas, as vencidas e lista os títulos", () => {
    expect(responderEmTexto("quantas tarefas eu tenho?", PANORAMA)).toBe(
      "Você tem 4 tarefas abertas, 2 vencidas: Ligar para a Ana e Enviar a proposta. Está tudo em Minhas Tarefas.",
    );
    expect(responderEmTexto("tarefas", { ...PANORAMA, tarefas: { abertas: 1, vencidas: 0, urgentes: [] } })).toBe(
      "Você tem 1 tarefa aberta, nenhuma vencida. Está tudo em Minhas Tarefas.",
    );
    expect(responderEmTexto("tarefas", VAZIO)).toMatch(/nenhuma tarefa aberta/);
  });

  it("notificações: soma as partes e nomeia cada uma", () => {
    expect(responderEmTexto("o que espera por mim?", PANORAMA)).toBe(
      "5 coisas esperam por você: 2 tarefas vencidas, 1 menção, 1 aprovação e 1 conversa com você. Está tudo no sino, em Notificações.",
    );
    expect(responderEmTexto("notificações", VAZIO)).toMatch(/Nada espera por você/);
  });

  it("negócios, contatos e conversas leem o panorama", () => {
    expect(responderEmTexto("e os negócios?", PANORAMA)).toBe("Há 3 negócios abertos — R$ 12.500,00 em valor ponderado. Os funis estão em Negócios.");
    expect(responderEmTexto("negócios", { ...PANORAMA, negocios: { abertos: 1, valorPonderado: null } })).toBe(
      "Há 1 negócio aberto. Os funis estão em Negócios.",
    );
    expect(responderEmTexto("contatos recentes", PANORAMA)).toBe(
      "São 12 contatos no Espaço de Trabalho; os mais recentes: Ana Souza e Bruno Lima. Está tudo em Contatos.",
    );
    expect(responderEmTexto("conversas abertas", PANORAMA)).toBe("Há 6 conversas abertas na Caixa de Entrada, 2 delas com você.");
    expect(responderEmTexto("conversas", VAZIO)).toMatch(/Nenhuma conversa aberta/);
  });

  it("saúda pelo primeiro nome e explica o que sabe", () => {
    expect(responderEmTexto("Olá!", PANORAMA)).toBe("Olá, Thiago! Pergunte sobre suas tarefas, notificações, negócios, contatos e conversas.");
    expect(responderEmTexto("bom dia", VAZIO)).toBe("Olá! Pergunte sobre suas tarefas, notificações, negócios, contatos e conversas.");
    expect(responderEmTexto("quem é você", VAZIO)).toMatch(/^Sou o robô da N1\./);
  });

  it("o que não reconhece, diz que não sabe — e o que sabe", () => {
    expect(responderEmTexto("qual a capital da França?", PANORAMA)).toMatch(/^Ainda não sei responder isso/);
  });
});
