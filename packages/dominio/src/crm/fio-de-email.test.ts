/**
 * O fio do e-mail (D-17-14, D-17-16): qual Mensagem um e-mail responde e quais
 * cabeçalhos a resposta leva. Cada teste afirma o resultado devolvido.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_REFERENCIAS_NA_SAIDA,
  assuntoDaResposta,
  cabecalhosDaResposta,
  idLimpo,
  idsDoCabecalho,
  mensagemRespondida,
  messageIdDaMensagem,
  motivoParaIgnorarEmail,
  type MensagemDoFio,
} from "./fio-de-email";

/** A busca em memória: conhece só os ids que a Conversa já tem, e conta as chamadas. */
function buscaEmMemoria(conhecidos: Readonly<Record<string, MensagemDoFio>>) {
  const consultados: string[] = [];
  const buscar = async (idExterno: string): Promise<MensagemDoFio | undefined> => {
    consultados.push(idExterno);
    return conhecidos[idExterno];
  };
  return { buscar, consultados };
}

describe("idLimpo (D-17-14)", () => {
  it("tira os colchetes e os espaços e preserva as maiúsculas", () => {
    expect(idLimpo("  <Abc.123@Exemplo.com> ")).toBe("Abc.123@Exemplo.com");
  });

  it("devolve undefined para vazio, só colchetes e ausente", () => {
    expect(idLimpo("")).toBeUndefined();
    expect(idLimpo("<>")).toBeUndefined();
    expect(idLimpo(undefined)).toBeUndefined();
  });
});

describe("idsDoCabecalho (D-17-14)", () => {
  it("lê os ids de References mesmo quebrados em linhas dobradas", () => {
    expect(idsDoCabecalho("<a@x> <b@x>\r\n <c@x>")).toEqual(["a@x", "b@x", "c@x"]);
  });

  it("um id repetido aparece uma vez, na primeira posição", () => {
    expect(idsDoCabecalho("<a@x> <b@x> <a@x>")).toEqual(["a@x", "b@x"]);
  });

  it("cabeçalho ausente ou vazio não tem id", () => {
    expect(idsDoCabecalho(undefined)).toEqual([]);
    expect(idsDoCabecalho("   ")).toEqual([]);
  });
});

describe("mensagemRespondida (EML-04, D-17-14)", () => {
  const A: MensagemDoFio = { mensagemId: "m1", conversaId: "c1" };
  const B: MensagemDoFio = { mensagemId: "m2", conversaId: "c1" };

  it("numa troca de três e-mails cada um acha o anterior pelo In-Reply-To", async () => {
    const { buscar } = buscaEmMemoria({ "a@x": A, "b@x": B });
    // A: sem fio. B responde A. C responde B e leva References com os dois.
    expect(await mensagemRespondida({ inReplyTo: [], references: [] }, buscar)).toBeUndefined();
    expect(await mensagemRespondida({ inReplyTo: ["a@x"], references: [] }, buscar)).toEqual(A);
    expect(await mensagemRespondida({ inReplyTo: ["b@x"], references: ["a@x", "b@x"] }, buscar)).toEqual(B);
  });

  it("In-Reply-To desconhecido cai no References, do último para o primeiro", async () => {
    const { buscar, consultados } = buscaEmMemoria({ "a@x": A, "b@x": B });
    const achada = await mensagemRespondida({ inReplyTo: ["desconhecido@x"], references: ["a@x", "b@x", "zz@x"] }, buscar);
    expect(achada).toEqual(B);
    expect(consultados).toEqual(["desconhecido@x", "zz@x", "b@x"]);
  });

  it("acha a última que existe quando o fim do References é desconhecido", async () => {
    const { buscar } = buscaEmMemoria({ "a@x": A });
    expect(await mensagemRespondida({ inReplyTo: [], references: ["a@x", "zz@x"] }, buscar)).toEqual(A);
  });

  it("cada id é tentado uma vez só", async () => {
    const { buscar, consultados } = buscaEmMemoria({});
    await mensagemRespondida({ inReplyTo: ["a@x"], references: ["a@x", "b@x"] }, buscar);
    expect(consultados).toEqual(["a@x", "b@x"]);
  });

  it("os ids chegam à busca na forma limpa, sem colchetes", async () => {
    const { buscar, consultados } = buscaEmMemoria({});
    await mensagemRespondida({ inReplyTo: ["<A@x>"], references: [] }, buscar);
    expect(consultados).toEqual(["A@x"]);
  });

  it("só os 50 últimos ids de References entram na busca", async () => {
    const { buscar, consultados } = buscaEmMemoria({});
    const references = Array.from({ length: 60 }, (_, i) => `r${i}@x`);
    await mensagemRespondida({ inReplyTo: [], references }, buscar);
    expect(consultados).toHaveLength(50);
    expect(consultados[0]).toBe("r59@x");
    expect(consultados.at(-1)).toBe("r10@x");
  });

  it("assunto começando com Re: sem cabeçalho de fio não acha nada e a busca nem é chamada", async () => {
    const { buscar, consultados } = buscaEmMemoria({ "a@x": A });
    const achada = await mensagemRespondida({ inReplyTo: [], references: [], assunto: "Re: Orçamento" }, buscar);
    expect(achada).toBeUndefined();
    expect(consultados).toEqual([]);
  });
});

describe("cabecalhosDaResposta (D-17-16, RFC 5322 §3.6.4)", () => {
  it("responde ao id dado e leva o fio inteiro em References", () => {
    expect(cabecalhosDaResposta({ idsDoFio: ["a@x", "b@x", "c@x"], respondida: "c@x" })).toEqual({
      inReplyTo: "c@x",
      references: ["a@x", "b@x", "c@x"],
    });
  });

  it("com 30 ids leva 20 referências: o primeiro e os 19 últimos", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `m${i}@x`);
    const { references } = cabecalhosDaResposta({ idsDoFio: ids });
    expect(MAX_REFERENCIAS_NA_SAIDA).toBe(20);
    expect(references).toHaveLength(20);
    expect(references[0]).toBe("m0@x");
    expect(references.slice(1)).toEqual(ids.slice(11));
  });

  it("sem respondida, o In-Reply-To é o último do fio", () => {
    expect(cabecalhosDaResposta({ idsDoFio: ["a@x", "b@x"] }).inReplyTo).toBe("b@x");
  });

  it("fio vazio não tem In-Reply-To", () => {
    expect(cabecalhosDaResposta({ idsDoFio: [] })).toEqual({ references: [] });
  });

  it("limpa os colchetes dos ids e não repete id", () => {
    expect(cabecalhosDaResposta({ idsDoFio: ["<a@x>", "a@x", "<b@x>"] })).toEqual({
      inReplyTo: "b@x",
      references: ["a@x", "b@x"],
    });
  });
});

describe("messageIdDaMensagem (D-17-16)", () => {
  it("usa o id da Mensagem e o domínio do endereço do Canal em minúsculas", () => {
    expect(messageIdDaMensagem("msg_7f3a", "Vendas@Empresa.com.br")).toBe("n1.msg_7f3a@empresa.com.br");
  });

  it("troca por hífen o caractere do id fora de [A-Za-z0-9._-]", () => {
    expect(messageIdDaMensagem("msg 7f/3a>", "a@b.com")).toBe("n1.msg-7f-3a-@b.com");
  });

  it("endereço sem @ usa n1.invalid", () => {
    expect(messageIdDaMensagem("m1", "sem-arroba")).toBe("n1.m1@n1.invalid");
  });
});

describe("assuntoDaResposta (D-17-16)", () => {
  it("acrescenta Re: ao assunto", () => {
    expect(assuntoDaResposta("Orçamento")).toBe("Re: Orçamento");
  });

  it("não empilha Re: quando já começa com ele, em qualquer caixa", () => {
    expect(assuntoDaResposta("RE: Orçamento")).toBe("RE: Orçamento");
    expect(assuntoDaResposta("re: Orçamento")).toBe("re: Orçamento");
  });

  it("sem assunto devolve vazio", () => {
    expect(assuntoDaResposta(null)).toBe("");
    expect(assuntoDaResposta(undefined)).toBe("");
  });
});

describe("motivoParaIgnorarEmail (D-17-11)", () => {
  const CANAL = "Vendas@Empresa.com";
  const base = { cabecalhos: {}, de: "cliente@exemplo.com", enderecoDoCanal: CANAL, tipoDeConteudo: "text/plain; charset=utf-8" };
  const com = (mudanca: Partial<typeof base>) => motivoParaIgnorarEmail({ ...base, ...mudanca });

  it("um e-mail comum de cliente entra", () => {
    expect(motivoParaIgnorarEmail(base)).toBeUndefined();
  });

  it("Auto-Submitted diferente de no é resposta automática", () => {
    expect(com({ cabecalhos: { "Auto-Submitted": "auto-replied" } })).toBe("resposta_automatica");
    expect(com({ cabecalhos: { "Auto-Submitted": "auto-generated; foo=bar" } })).toBe("resposta_automatica");
  });

  it("Auto-Submitted: no não descarta", () => {
    expect(com({ cabecalhos: { "Auto-Submitted": "no" } })).toBeUndefined();
  });

  it("multipart/report é aviso de não entrega", () => {
    expect(com({ tipoDeConteudo: "multipart/report; report-type=delivery-status" })).toBe("nao_entrega");
  });

  it("MAILER-DAEMON e postmaster no From são não entrega", () => {
    expect(com({ de: "MAILER-DAEMON@mx.exemplo.com" })).toBe("nao_entrega");
    expect(com({ de: "postmaster@exemplo.com" })).toBe("nao_entrega");
  });

  it("Precedence bulk, list e junk é lista, em qualquer caixa; first-class não", () => {
    expect(com({ cabecalhos: { Precedence: "bulk" } })).toBe("lista");
    expect(com({ cabecalhos: { Precedence: "LIST" } })).toBe("lista");
    expect(com({ cabecalhos: { Precedence: "junk" } })).toBe("lista");
    expect(com({ cabecalhos: { Precedence: "first-class" } })).toBeUndefined();
  });

  it("o From igual ao endereço do Canal, com outras maiúsculas, é o próprio Canal", () => {
    expect(com({ de: "vendas@EMPRESA.com" })).toBe("proprio_canal");
  });

  it("googlemail.com e gmail.com são o mesmo endereço do próprio Canal", () => {
    expect(com({ de: "pessoa@googlemail.com", enderecoDoCanal: "pessoa@gmail.com" })).toBe("proprio_canal");
  });

  it("o From no formato Nome <endereço> também é comparado pelo endereço", () => {
    expect(com({ de: "Vendas <vendas@empresa.com>" })).toBe("proprio_canal");
  });

  it("List-Unsubscribe sozinho NÃO descarta o e-mail", () => {
    expect(com({ cabecalhos: { "List-Unsubscribe": "<mailto:sair@exemplo.com>" } })).toBeUndefined();
  });

  it("os nomes de cabeçalho valem em qualquer caixa", () => {
    expect(com({ cabecalhos: { "AUTO-SUBMITTED": "auto-replied" } })).toBe("resposta_automatica");
    expect(com({ cabecalhos: { precedence: "bulk" } })).toBe("lista");
  });

  it("o próprio Canal vence os outros motivos", () => {
    expect(com({ de: "vendas@empresa.com", cabecalhos: { "Auto-Submitted": "auto-replied" } })).toBe("proprio_canal");
  });
});
