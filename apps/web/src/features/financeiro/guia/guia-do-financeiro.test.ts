import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP, CR } from "@n1/dominio/operations/financeiro";
import {
  PASSOS_DO_GUIA,
  PROGRESSO_INICIAL,
  VEZES_DO_GUIA,
  arquivoDoGuia,
  deveAbrirSozinho,
  dispensarGuia,
  lerProgresso,
  passosPara,
  registrarAbertura,
} from "./guia-do-financeiro";

describe("Guia do Financeiro — quando abre sozinho", () => {
  it("abre nas três primeiras entradas e não na quarta", () => {
    let progresso = PROGRESSO_INICIAL;
    for (let vez = 1; vez <= VEZES_DO_GUIA; vez += 1) {
      expect(deveAbrirSozinho(progresso, false)).toBe(true);
      progresso = registrarAbertura(progresso);
    }
    expect(progresso.vezes).toBe(3);
    expect(deveAbrirSozinho(progresso, false)).toBe(false);
  });

  it("não abre de novo na mesma entrada (recarregar ou navegar não conta)", () => {
    expect(deveAbrirSozinho(PROGRESSO_INICIAL, true)).toBe(false);
  });

  it("“Não mostrar mais” vale antes da terceira vez", () => {
    const dispensado = dispensarGuia(registrarAbertura(PROGRESSO_INICIAL));
    expect(dispensado).toEqual({ vezes: 1, dispensado: true });
    expect(deveAbrirSozinho(dispensado, false)).toBe(false);
  });

  it("o que o navegador guardou fora da forma volta ao começo, sem quebrar", () => {
    expect(lerProgresso(null)).toEqual(PROGRESSO_INICIAL);
    expect(lerProgresso("não é json")).toEqual(PROGRESSO_INICIAL);
    expect(lerProgresso("[1,2]")).toEqual(PROGRESSO_INICIAL);
    expect(lerProgresso('{"vezes":-2,"dispensado":"sim"}')).toEqual(PROGRESSO_INICIAL);
    expect(lerProgresso('{"vezes":2,"dispensado":true}')).toEqual({ vezes: 2, dispensado: true });
  });
});

describe("Guia do Financeiro — os passos", () => {
  const seed = buildSeed();

  it("quem alcança as Listas do Financeiro vê os passos delas, com destino em cada uma", () => {
    const passos = passosPara(seed, CP.financeiroId);
    expect(passos.map((p) => p.id)).toEqual(expect.arrayContaining(["contas-a-pagar", "resumo", "contas-a-receber"]));
    for (const passo of passos) expect(passo.destino?.href).toMatch(/^\/estrutura\/listas\//);
  });

  it("quem não alcança a Pasta Financeiro não vê passo nenhum", () => {
    expect(passosPara(seed, CR.comercialId)).toEqual([]);
  });

  it("todo passo tem título e ao menos um parágrafo", () => {
    for (const passo of PASSOS_DO_GUIA) {
      expect(passo.titulo.length).toBeGreaterThan(0);
      expect(passo.paragrafos.length).toBeGreaterThan(0);
    }
  });
});

describe("o vídeo — o arquivo que o guia toca", () => {
  it("vem do bucket público `guias` do Storage do Supabase do projeto", () => {
    expect(arquivoDoGuia("financeiro.mp4", "https://projeto.supabase.co")).toBe("https://projeto.supabase.co/storage/v1/object/public/guias/financeiro.mp4");
    expect(arquivoDoGuia("financeiro.jpg", "https://projeto.supabase.co/")).toBe("https://projeto.supabase.co/storage/v1/object/public/guias/financeiro.jpg");
  });
});
