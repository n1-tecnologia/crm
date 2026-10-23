/**
 * Fase 9, 1.2.3 — `restoreList` recusa como `restoreContainer` recusa, e
 * `createReceivableSeries` confere quem chama antes de criar parcela. As duas
 * ficavam fora da varredura de escritas sem conferência.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { List } from "../types";
import { CP, CR, createReceivableSeries, type ReceivableSeriesInput } from "./financeiro";
import { restoreList } from "./tasks";
import { restoreContainer } from "./structure";

const CONVIDADO = "mem_beatriz";
const LISTA_NA_LIXEIRA = "lst_piloto";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const lista = (id: string): List => {
  const l = state.lists.find((x) => x.id === id);
  if (!l) throw new Error(`Lista ${id} não está no seed.`);
  return l;
};
const tarefasDaListaDeContasAReceber = (): number => state.tasks.filter((t) => t.listId === CR.listId).length;

describe("restoreList (1.2.3)", () => {
  it("o seed traz a Lista na lixeira, que é o ponto de partida dos testes", () => {
    expect(lista(LISTA_NA_LIXEIRA).lifecycle).toBe("naLixeira");
  });

  it("o Convidado não restaura a Lista: ok: false, a Lista continua na lixeira e o estado não muda", () => {
    const antes = structuredClone(state);
    const r = restoreList(state, CONVIDADO, LISTA_NA_LIXEIRA);
    expect(r.ok).toBe(false);
    expect(lista(LISTA_NA_LIXEIRA).lifecycle).toBe("naLixeira");
    expect(state).toStrictEqual(antes);
  });

  it("recusa com a mesma frase que restoreContainer dá ao mesmo ator", () => {
    const viaContainer = restoreContainer(structuredClone(state), CONVIDADO, "list", LISTA_NA_LIXEIRA);
    const viaLista = restoreList(state, CONVIDADO, LISTA_NA_LIXEIRA);
    expect(viaContainer.ok).toBe(false);
    expect(viaLista.ok).toBe(false);
    if (!viaContainer.ok && !viaLista.ok) expect(viaLista.error).toBe(viaContainer.error);
  });

  it("um Membro sem excluir na Lista também é recusado (administrar ou concessão direta é o que vale)", () => {
    const antes = structuredClone(state);
    const r = restoreList(state, "mem_julia", LISTA_NA_LIXEIRA);
    expect(r.ok).toBe(false);
    expect(state).toStrictEqual(antes);
  });

  it("quem administra a Lista restaura com ok: true", () => {
    const r = restoreList(state, "mem_thiago", LISTA_NA_LIXEIRA);
    expect(r.ok).toBe(true);
    expect(lista(LISTA_NA_LIXEIRA).lifecycle).not.toBe("naLixeira");
  });
});

describe("createReceivableSeries (1.2.3)", () => {
  const entrada = (over: Partial<ReceivableSeriesInput> = {}): ReceivableSeriesInput => ({
    contactId: "cnt_4",
    centroDeCusto: "Tria Tech",
    valorParcela: 100,
    parcelas: 2,
    primeiroVencimento: "2030-01-31",
    ...over,
  });

  it("o Convidado não cria a série: ok: false e nenhuma Tarefa nasce na Lista de Contas a receber", () => {
    const antes = structuredClone(state);
    const total = tarefasDaListaDeContasAReceber();
    const r = createReceivableSeries(state, CONVIDADO, entrada());
    expect(r.ok).toBe(false);
    expect(tarefasDaListaDeContasAReceber()).toBe(total);
    expect(state).toStrictEqual(antes);
  });

  it("a conferência de quem chama vem antes da validação da entrada: entrada inválida não vaza mensagem de validação ao Convidado", () => {
    const r = createReceivableSeries(state, CONVIDADO, entrada({ contactId: "cnt_que_nao_existe" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Convidado/);
  });

  it("um Membro do Financeiro do seed cria a série com ok: true", () => {
    const total = tarefasDaListaDeContasAReceber();
    const r = createReceivableSeries(state, CP.financeiroId, entrada());
    expect(r.ok).toBe(true);
    expect(tarefasDaListaDeContasAReceber()).toBeGreaterThan(total);
  });
});
