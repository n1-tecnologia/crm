/**
 * A lógica pura do comando `gravacao:medir` (Fase 12, D-01/D-02/D-07): ler a
 * linha "gravacao medida" de 12-01, mediana, pior caso, o resumo por gesto e o
 * relatório. Sem banco e sem rede.
 */

import { describe, expect, it } from "vitest";
import {
  ETAPAS_DA_GRAVACAO,
  LIMITE_DO_HIDRATAR_MS,
  formatarRelatorio,
  lerLinhaDeMedicao,
  mediana,
  piorCaso,
  resumirGesto,
  type AmostraDoGesto,
  type MedicaoLida,
  type RelatorioDaMedicao,
} from "./medicao-da-gravacao";

function medicao(extra: Partial<MedicaoLida> = {}): MedicaoLida {
  return {
    conexaoMs: 1,
    inicioMs: 1,
    travaMs: 2,
    hidratarMs: 10,
    canaisMs: 1,
    operacaoMs: 1,
    atualizaMs: 2,
    gravarMs: 3,
    eventosMs: 1,
    commitMs: 1,
    tentativas: 1,
    linhasLidas: 100,
    linhasGravadas: 4,
    desfecho: "gravou",
    recorteMs: 2,
    totalMs: 30,
    ...extra,
  };
}

describe("lerLinhaDeMedicao", () => {
  it("devolve operacao e medicao para a linha 'gravacao medida'", () => {
    const linha = JSON.stringify({ level: 30, time: 1, msg: "gravacao medida", operacao: "createList", medicao: medicao() });
    const lida = lerLinhaDeMedicao(linha);
    expect(lida?.operacao).toBe("createList");
    expect(lida?.medicao.hidratarMs).toBe(10);
    expect(lida?.medicao.desfecho).toBe("gravou");
  });

  it("devolve undefined para outra mensagem, texto que não é JSON e linha vazia", () => {
    expect(lerLinhaDeMedicao(JSON.stringify({ msg: "incoming request", operacao: "createList", medicao: medicao() }))).toBeUndefined();
    expect(lerLinhaDeMedicao("isto não é json")).toBeUndefined();
    expect(lerLinhaDeMedicao("")).toBeUndefined();
    expect(lerLinhaDeMedicao("   \n")).toBeUndefined();
    expect(lerLinhaDeMedicao(JSON.stringify({ msg: "gravacao medida", operacao: "createList" }))).toBeUndefined();
  });
});

describe("mediana e piorCaso", () => {
  it("mediana: vazio 0, um valor, par (média dos dois do meio), ordem de entrada ignorada", () => {
    expect(mediana([])).toBe(0);
    expect(mediana([5])).toBe(5);
    expect(mediana([1, 9, 3, 7])).toBe(5);
    expect(mediana([9, 1, 7, 3])).toBe(5);
    expect(mediana([3, 1, 2])).toBe(2);
  });

  it("mediana de dez valores é a média do 5º e do 6º ordenados", () => {
    const dez = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5];
    expect(mediana(dez)).toBe(5.5);
  });

  it("piorCaso é o máximo, 0 com lista vazia, ordem ignorada", () => {
    expect(piorCaso([2, 8, 3])).toBe(8);
    expect(piorCaso([8, 3, 2])).toBe(8);
    expect(piorCaso([])).toBe(0);
  });

  it("não altera a lista recebida", () => {
    const entrada = [3, 1, 2];
    mediana(entrada);
    piorCaso(entrada);
    expect(entrada).toEqual([3, 1, 2]);
  });
});

describe("resumirGesto", () => {
  const amostras: AmostraDoGesto[] = [
    { medicao: medicao({ hidratarMs: 10, totalMs: 30 }), pedidoMs: 40 },
    { medicao: medicao({ hidratarMs: 20, totalMs: 40, tentativas: 2 }), pedidoMs: 60 },
    { medicao: medicao({ hidratarMs: 30, totalMs: 50, desfecho: "recusou" }), pedidoMs: 80 },
  ];

  it("mediana e pior por etapa, e o número de amostras", () => {
    const resumo = resumirGesto("criar Lista", "createList", amostras);
    expect(resumo.gesto).toBe("criar Lista");
    expect(resumo.operacao).toBe("createList");
    expect(resumo.amostras).toBe(3);
    expect(resumo.etapas.hidratarMs).toEqual({ mediana: 20, pior: 30 });
    expect(resumo.etapas.totalMs).toEqual({ mediana: 40, pior: 50 });
    expect(resumo.etapas.commitMs).toEqual({ mediana: 1, pior: 1 });
    expect(resumo.tentativas).toEqual({ mediana: 1, pior: 2 });
    expect(resumo.linhasLidas).toEqual({ mediana: 100, pior: 100 });
    expect(resumo.linhasGravadas).toEqual({ mediana: 4, pior: 4 });
    expect(resumo.pedidoMs).toEqual({ mediana: 60, pior: 80 });
  });

  it("foraDoHandlerMs = pedidoMs - totalMs, por amostra", () => {
    const resumo = resumirGesto("criar Lista", "createList", amostras);
    // 40-30, 60-40, 80-50 = 10, 20, 30
    expect(resumo.foraDoHandlerMs).toEqual({ mediana: 20, pior: 30 });
  });

  it("foraDasEtapasMs = totalMs - (soma das etapas de executar + recorteMs), sem contar atualizaMs duas vezes", () => {
    // etapas de executar (sem atualizaMs, que já está dentro de travaMs): 1+1+2+hidratar+1+1+3+1+1 = 11+hidratar; recorte 2.
    // amostra 1: 30 - (21 + 2) = 7; amostra 2: 40 - (31 + 2) = 7; amostra 3: 50 - (41 + 2) = 7.
    const resumo = resumirGesto("criar Lista", "createList", amostras);
    expect(resumo.foraDasEtapasMs).toEqual({ mediana: 7, pior: 7 });
  });

  it("regimes vazio sem o campo, e o que as linhas trazem quando trazem", () => {
    expect(resumirGesto("g", "createList", amostras).regimes).toEqual([]);
    const comRegime = amostras.map((a) => ({ ...a, medicao: { ...a.medicao, regime: "otimista" } }));
    expect(resumirGesto("g", "createList", comRegime).regimes).toEqual(["otimista"]);
  });

  it("conta os desfechos", () => {
    const resumo = resumirGesto("g", "createList", amostras);
    expect(resumo.desfechos).toEqual({ gravou: 2, recusou: 1 });
  });

  it("sem amostras, tudo zero", () => {
    const resumo = resumirGesto("g", "createList", []);
    expect(resumo.amostras).toBe(0);
    expect(resumo.etapas.hidratarMs).toEqual({ mediana: 0, pior: 0 });
    expect(resumo.desfechos).toEqual({});
  });
});

describe("ETAPAS_DA_GRAVACAO e LIMITE_DO_HIDRATAR_MS", () => {
  it("o limite da sessão C é 300 ms (D-07)", () => {
    expect(LIMITE_DO_HIDRATAR_MS).toBe(300);
  });

  it("lista as dez etapas de executar, depois recorteMs e totalMs", () => {
    expect(ETAPAS_DA_GRAVACAO).toEqual([
      "conexaoMs",
      "inicioMs",
      "travaMs",
      "hidratarMs",
      "canaisMs",
      "operacaoMs",
      "atualizaMs",
      "gravarMs",
      "eventosMs",
      "commitMs",
      "recorteMs",
      "totalMs",
    ]);
  });
});

function relatorio(hidratarMediana: number): RelatorioDaMedicao {
  return {
    quando: "2026-10-30T12:00:00.000Z",
    revisaoDoCodigo: "abc1234",
    workspaceId: "ws_n1",
    repeticoes: 3,
    idaEVolta: { amostras: 3, mediana: 4.2, pior: 6.1 },
    hidratarDireto: { amostras: 3, mediana: hidratarMediana, pior: hidratarMediana + 10, registros: 1234 },
    estado: { amostras: 3, mediana: 150.5, pior: 170 },
    tamanho: {
      porColecao: [
        { colecao: "tasks", registros: 800, comprimido: 600_000, texto: 900_000 },
        { colecao: "lists", registros: 40, comprimido: 20_000, texto: 30_000 },
      ],
      total: { registros: 840, comprimido: 620_000, texto: 930_000 },
    },
    gestos: [
      resumirGesto("criar Lista", "createList", [{ medicao: medicao(), pedidoMs: 40 }]),
      resumirGesto("renomear Lista", "updateContainer", [{ medicao: medicao(), pedidoMs: 41 }]),
      resumirGesto("Espaço com Listas à lixeira", "trashContainer", [{ medicao: medicao(), pedidoMs: 42 }]),
      resumirGesto("mudar Status", "changeTaskStatus", [{ medicao: medicao(), pedidoMs: 43 }]),
    ],
  };
}

describe("formatarRelatorio", () => {
  it("traz o nome de cada gesto e de cada operação, e o cabeçalho de cada etapa", () => {
    const texto = formatarRelatorio(relatorio(120));
    for (const nome of ["criar Lista", "renomear Lista", "Espaço com Listas à lixeira", "mudar Status"]) {
      expect(texto).toContain(nome);
    }
    for (const operacao of ["createList", "updateContainer", "trashContainer", "changeTaskStatus"]) {
      expect(texto).toContain(operacao);
    }
    for (const etapa of ETAPAS_DA_GRAVACAO) expect(texto).toContain(etapa);
    for (const extra of ["pedidoMs", "foraDasEtapasMs", "foraDoHandlerMs", "tentativas", "linhasLidas", "linhasGravadas"]) {
      expect(texto).toContain(extra);
    }
  });

  it("traz o cabeçalho (quando, revisão do código, Espaço de Trabalho, repetições)", () => {
    const texto = formatarRelatorio(relatorio(120));
    expect(texto).toContain("2026-10-30T12:00:00.000Z");
    expect(texto).toContain("abc1234");
    expect(texto).toContain("ws_n1");
    expect(texto).toMatch(/repetições:?\s*3/);
  });

  it("a linha do hidratar direto diz 300 ms e abaixo, ou acima", () => {
    const abaixo = formatarRelatorio(relatorio(120));
    expect(abaixo).toContain("300 ms");
    expect(abaixo).toContain("abaixo");
    expect(abaixo).not.toMatch(/\bacima\b/);

    const acima = formatarRelatorio(relatorio(450));
    expect(acima).toContain("300 ms");
    expect(acima).toContain("acima");
    expect(acima).not.toMatch(/\babaixo\b/);
  });

  it("traz as seções de ida e volta, GET /estado e plataforma.registros, com KB em uma casa", () => {
    const texto = formatarRelatorio(relatorio(120));
    expect(texto).toContain("Ida e volta (select 1)");
    expect(texto).toContain("GET /estado (total)");
    expect(texto).toContain("plataforma.registros");
    expect(texto).toContain("tasks");
    expect(texto).toContain("lists");
    // 620_000 bytes comprimidos = 605,5 KB (1024 por KB), 930_000 de texto = 908,2 KB
    expect(texto).toMatch(/605[.,]5 KB/);
    expect(texto).toMatch(/908[.,]2 KB/);
  });

  it("diz que a consulta D-05 foi recusada, quando foi", () => {
    const base = relatorio(120);
    const texto = formatarRelatorio({ ...base, tamanho: { porColecao: [], total: { registros: 0, comprimido: 0, texto: 0 }, recusada: true } });
    expect(texto).toContain("consulta D-05 recusada pelo banco: rodar à mão no psql");
  });

  it("mostra regimes quando as linhas trazem", () => {
    const base = relatorio(120);
    const com = {
      ...base,
      gestos: [resumirGesto("criar Lista", "createList", [{ medicao: medicao({ regime: "travado" }), pedidoMs: 40 }])],
    };
    expect(formatarRelatorio(com)).toContain("travado");
  });
});
