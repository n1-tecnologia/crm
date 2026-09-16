/**
 * `OPERACOES` é a única porta de despacho (T-1-04); `gravarChamadas` é o que
 * permite a `run()` do web descobrir nome + argumentos de um closure sem
 * mudar assinatura (Open Question #2). Estes testes provam as duas coisas
 * separadas dos testes de regra de negócio de `operations.test.ts`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { resetIdSequence } from "./activity";
import { createTask as createTaskCrua, watchTask as watchTaskCrua } from "./tasks";
import * as idx from "./index";
import { OPERACOES, ehNomeDeOperacao, gravarChamadas, reviverArgumentos, serializarArgumentos } from "./registro";

beforeEach(() => {
  resetIdSequence();
});

describe("OPERACOES", () => {
  it("toda entrada é uma função com pelo menos (state, actingMemberId)", () => {
    for (const nome of Object.keys(OPERACOES) as (keyof typeof OPERACOES)[]) {
      const operacao = OPERACOES[nome];
      expect(typeof operacao).toBe("function");
      expect(operacao.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("operations/index.ts instrumenta TODAS as chaves — nenhuma esquecida", () => {
    const idxTyped = idx as unknown as Record<string, unknown>;
    expect(idx.createTask).not.toBe(createTaskCrua);
    expect(idx.createTask).not.toBe(OPERACOES.createTask);
    for (const nome of Object.keys(OPERACOES)) {
      expect(typeof idxTyped[nome]).toBe("function");
      expect(idxTyped[nome]).not.toBe(OPERACOES[nome as keyof typeof OPERACOES]);
    }
  });

  it("helpers, leituras e recusas não entram no registro", () => {
    expect(ehNomeDeOperacao("nextId")).toBe(false);
    expect(ehNomeDeOperacao("recordActivity")).toBe(false);
    expect(ehNomeDeOperacao("submitForm")).toBe(false);
    expect(ehNomeDeOperacao("listWriteRefusal")).toBe(false);
    expect(ehNomeDeOperacao("__proto__")).toBe(false);
    expect(ehNomeDeOperacao("constructor")).toBe(false);
    expect(ehNomeDeOperacao("toString")).toBe(false);
    expect(ehNomeDeOperacao("createTask")).toBe(true);
  });
});

describe("gravarChamadas", () => {
  it("observa nome e argumentos de uma chamada instrumentada", () => {
    const state = buildSeed();
    const taskId = "tsk_seed_1";
    const { resultado, chamadas } = gravarChamadas(() =>
      idx.addTaskComment(state, "mem_maryane", taskId, { content: "x" }),
    );
    expect(resultado.ok).toBe(true);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toEqual({ nome: "addTaskComment", args: [taskId, { content: "x" }] });
  });

  it("fora de gravarChamadas, a versão instrumentada devolve o mesmo resultado que a crua", () => {
    resetIdSequence();
    const estadoInstrumentado = buildSeed();
    const resultadoInstrumentado = idx.watchTask(estadoInstrumentado, "mem_maryane", "tsk_seed_1", "mem_maryane", true);

    resetIdSequence();
    const estadoCru = buildSeed();
    const resultadoCru = watchTaskCrua(estadoCru, "mem_maryane", "tsk_seed_1", "mem_maryane", true);

    expect(resultadoInstrumentado.ok).toBe(resultadoCru.ok);
    if (resultadoInstrumentado.ok && resultadoCru.ok) {
      expect(resultadoInstrumentado.value.id).toBe(resultadoCru.value.id);
    }
  });

  it("gravador aninhado: o de fora não recebe a chamada do de dentro (restauração no finally)", () => {
    const state = buildSeed();
    const { chamadas: externas } = gravarChamadas(() => {
      const { chamadas: internas } = gravarChamadas(() =>
        idx.watchTask(state, "mem_maryane", "tsk_seed_1", "mem_maryane", true),
      );
      expect(internas).toHaveLength(1);
      return internas;
    });
    expect(externas).toHaveLength(0);
  });
});

describe("serializarArgumentos / reviverArgumentos", () => {
  it("marca Date com { $tipo: 'Date', iso } e volta a ser Date preservando o instante", () => {
    const dataInicio = new Date("2026-01-01T00:00:00Z");
    const dataEpoch = new Date(0);
    const original: readonly [Date, string, { readonly a: readonly [number, Date] }] = [
      dataInicio,
      "x",
      { a: [1, dataEpoch] },
    ];
    const serializado = serializarArgumentos(original);
    expect(serializado).toEqual([
      { $tipo: "Date", iso: "2026-01-01T00:00:00.000Z" },
      "x",
      { a: [1, { $tipo: "Date", iso: "1970-01-01T00:00:00.000Z" }] },
    ]);

    const revivido = reviverArgumentos(serializado) as [Date, string, { a: [number, Date] }];
    expect(revivido[0]).toBeInstanceOf(Date);
    expect(revivido[0].getTime()).toBe(dataInicio.getTime());
    expect(revivido[2].a[1]).toBeInstanceOf(Date);
    expect((revivido[2].a[1] as Date).getTime()).toBe(dataEpoch.getTime());
  });
});
