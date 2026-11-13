/**
 * A Mensagem de modelo (Sessão 7, 7.3): as regras puras sobre os componentes no formato da Meta. Cada teste afirma o
 * resultado devolvido, nunca que uma função foi chamada.
 */

import { describe, expect, it } from "vitest";
import {
  corpoDoModelo,
  MAX_DA_VARIAVEL,
  modeloEnviavel,
  modeloNaLista,
  motivoDeNaoEnviavel,
  quantidadeDeVariaveis,
  textoDoModelo,
  validarVariaveis,
  variaveisDoTexto,
  type ComponenteDeModelo,
  type ModeloDeMensagem,
} from "./modelos";

const BODY = (text: string): ComponenteDeModelo => ({ type: "BODY", text });
const modelo = (componentes: readonly ComponenteDeModelo[], extras: Partial<ModeloDeMensagem> = {}): ModeloDeMensagem => ({
  id: "mdl_1",
  canalId: "canal_1",
  idNoProvedor: "190001",
  nome: "boas_vindas",
  idioma: "pt_BR",
  categoria: "utilidade",
  estado: "aprovado",
  motivoDeRejeicao: null,
  componentes,
  quantidadeDeVariaveis: quantidadeDeVariaveis(componentes),
  sincronizadoEm: "2026-11-13T12:00:00.000Z",
  ...extras,
});

describe("variaveisDoTexto e quantidadeDeVariaveis", () => {
  it("acha {{1}}, {{2}}… sem repetir e em ordem, tolerando espaço dentro das chaves", () => {
    expect(variaveisDoTexto("Olá {{1}}, seu pedido {{ 2 }} sai {{1}}.")).toEqual([1, 2]);
    expect(variaveisDoTexto("sem variável")).toEqual([]);
    expect(variaveisDoTexto("{{10}} e {{2}}")).toEqual([2, 10]);
  });

  it("a quantidade é a maior variável do CORPO (o cabeçalho e o rodapé não contam)", () => {
    expect(quantidadeDeVariaveis([BODY("Oi {{1}}, {{2}} e {{3}}")])).toBe(3);
    expect(quantidadeDeVariaveis([{ type: "HEADER", format: "TEXT", text: "{{1}}" }, BODY("sem variável")])).toBe(0);
    expect(quantidadeDeVariaveis([])).toBe(0);
  });

  it("aceita o tipo do componente em qualquer caixa", () => {
    expect(corpoDoModelo([{ type: "body", text: "Oi {{1}}" }])).toBe("Oi {{1}}");
    expect(corpoDoModelo([{ type: "FOOTER", text: "só rodapé" }])).toBe("");
  });
});

describe("motivoDeNaoEnviavel e modeloEnviavel", () => {
  it("corpo com variáveis, cabeçalho de texto fixo, rodapé e botões fixos: enviável", () => {
    const m = modelo([
      { type: "HEADER", format: "TEXT", text: "Tria" },
      BODY("Olá {{1}}"),
      { type: "FOOTER", text: "Responda SAIR para parar" },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Sim" }, { type: "URL", text: "Site", url: "https://tria.example/ajuda" }, { type: "PHONE_NUMBER", text: "Ligar", phone_number: "+5511" }] },
    ]);
    expect(motivoDeNaoEnviavel(m)).toBeUndefined();
    expect(modeloEnviavel(m)).toBe(true);
  });

  it.each([
    ["cabeçalho de imagem", [{ type: "HEADER", format: "IMAGE" }, BODY("oi")], /cabeçalho de imagem/],
    ["cabeçalho de documento", [{ type: "HEADER", format: "DOCUMENT" }, BODY("oi")], /cabeçalho de imagem, vídeo ou documento/],
    ["variável no cabeçalho", [{ type: "HEADER", format: "TEXT", text: "Olá {{1}}" }, BODY("oi")], /variável no cabeçalho/],
    ["botão de link com variável", [BODY("oi"), { type: "BUTTONS", buttons: [{ type: "URL", text: "Ver", url: "https://x.example/{{1}}" }] }], /endereço de um botão/],
    ["botão de código", [BODY("oi"), { type: "BUTTONS", buttons: [{ type: "COPY_CODE", text: "Copiar" }] }], /botão de código/],
    ["botão de Flow", [BODY("oi"), { type: "BUTTONS", buttons: [{ type: "FLOW", text: "Abrir" }] }], /botão de código, catálogo ou Flow/],
    ["componente novo (carrossel)", [BODY("oi"), { type: "CAROUSEL" }], /carrossel/],
    ["sem corpo", [{ type: "FOOTER", text: "x" }], /sem corpo/i],
  ] as const)("%s: não enviável, e diz por quê", (_nome, componentes, motivo) => {
    const m = modelo(componentes as unknown as ComponenteDeModelo[]);
    expect(motivoDeNaoEnviavel(m)).toMatch(motivo);
    expect(modeloEnviavel(m)).toBe(false);
  });

  it("modelo de autenticação não é enviável (código de uso único)", () => {
    expect(modeloEnviavel(modelo([BODY("Seu código é {{1}}")], { categoria: "autenticacao" }))).toBe(false);
  });

  it.each(["pendente", "rejeitado", "pausado", "desativado"] as const)("estado %s: não enviável mesmo com componentes bons", (estado) => {
    expect(modeloEnviavel(modelo([BODY("Olá {{1}}")], { estado }))).toBe(false);
  });
});

describe("validarVariaveis", () => {
  const m = modelo([BODY("Olá {{1}}, seu pedido {{2}}")]);

  it("na quantidade certa e preenchidas: devolve os valores aparados", () => {
    expect(validarVariaveis(m, ["  Ana ", "1234"])).toEqual({ ok: true, value: ["Ana", "1234"] });
  });

  it("quantidade errada: diz quantas o modelo pede, no campo variaveis", () => {
    expect(validarVariaveis(m, ["Ana"])).toEqual({ ok: false, error: "O modelo “boas_vindas” pede 2 variáveis, e vieram 1.", field: "variaveis" });
    expect(validarVariaveis(modelo([BODY("Oi {{1}}")]), [])).toMatchObject({ ok: false, error: expect.stringMatching(/pede 1 variável,/) });
  });

  it("modelo sem variável: valor nenhum é aceito", () => {
    expect(validarVariaveis(modelo([BODY("Oi")]), [])).toEqual({ ok: true, value: [] });
    expect(validarVariaveis(modelo([BODY("Oi")]), ["x"])).toMatchObject({ ok: false, error: expect.stringMatching(/não tem variáveis/) });
  });

  it("vazia (ou só espaço) é recusada apontando QUAL variável", () => {
    expect(validarVariaveis(m, ["Ana", "   "])).toEqual({ ok: false, error: "Preencha a variável {{2}} do modelo.", field: "variaveis" });
  });

  it("quebra de linha e tabulação são recusadas (a Meta recusa)", () => {
    expect(validarVariaveis(m, ["Ana\nSouza", "1"])).toMatchObject({ ok: false, error: expect.stringMatching(/\{\{1\}\} não pode ter quebra de linha/) });
    expect(validarVariaveis(m, ["Ana", "1\t2"])).toMatchObject({ ok: false, error: expect.stringMatching(/\{\{2\}\} não pode ter/) });
  });

  it("passa de 1024 caracteres é recusada; 1024 passa", () => {
    expect(validarVariaveis(m, ["a".repeat(MAX_DA_VARIAVEL), "1"]).ok).toBe(true);
    expect(validarVariaveis(m, ["a".repeat(MAX_DA_VARIAVEL + 1), "1"])).toMatchObject({ ok: false, error: expect.stringMatching(/vai até 1024/) });
  });
});

describe("textoDoModelo", () => {
  it("cabeçalho, corpo preenchido e rodapé, separados por linha em branco; sem botões", () => {
    const m = modelo([
      { type: "HEADER", format: "TEXT", text: "Pedido confirmado" },
      BODY("Olá {{1}}, o pedido {{2}} saiu."),
      { type: "FOOTER", text: "Tria" },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Ok" }] },
    ]);
    expect(textoDoModelo(m, ["Ana", "1234"])).toBe("Pedido confirmado\n\nOlá Ana, o pedido 1234 saiu.\n\nTria");
  });

  it("só o corpo, e a mesma variável usada duas vezes", () => {
    expect(textoDoModelo(modelo([BODY("{{1}}, {{1}}!")]), ["Ana"])).toBe("Ana, Ana!");
  });

  it("variável sem valor fica como está (a validação vem antes de gravar)", () => {
    expect(textoDoModelo(modelo([BODY("Olá {{1}} {{2}}")]), ["Ana"])).toBe("Olá Ana {{2}}");
  });

  it("um valor com $ ou chaves não é lido como padrão de troca", () => {
    expect(textoDoModelo(modelo([BODY("Total {{1}}")]), ["$& {{1}} $1"])).toBe("Total $& {{1}} $1");
  });
});

describe("modeloNaLista", () => {
  it("aprovado e enviável: enviavel sem motivo", () => {
    expect(modeloNaLista(modelo([BODY("Olá {{1}}")]))).toMatchObject({ enviavel: true, motivoDeNaoEnviavel: null });
  });

  it("aprovado mas com cabeçalho de imagem: não enviável, com o motivo para a tela", () => {
    const m = modeloNaLista(modelo([{ type: "HEADER", format: "IMAGE" }, BODY("oi")]));
    expect(m.enviavel).toBe(false);
    expect(m.motivoDeNaoEnviavel).toMatch(/cabeçalho de imagem/);
  });

  it("rejeitado: não enviável e SEM motivo de formato (o estado e a rejeição da Meta já explicam)", () => {
    expect(modeloNaLista(modelo([{ type: "HEADER", format: "IMAGE" }, BODY("oi")], { estado: "rejeitado", motivoDeRejeicao: "INVALID_FORMAT" }))).toMatchObject({
      enviavel: false,
      motivoDeNaoEnviavel: null,
      motivoDeRejeicao: "INVALID_FORMAT",
    });
  });
});
