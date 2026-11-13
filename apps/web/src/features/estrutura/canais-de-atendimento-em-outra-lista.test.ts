/**
 * 5.1.2 (A) — `motivoDeCanalEmOutraLista`: a frase que a tela mostra quando o Canal já atende em OUTRA Lista conversacional,
 * lida do estado de verdade (sem mock). A regra em si é do domínio (`listaConversacionalQueAtendePeloCanal`); aqui se
 * prova a ponte com a tela: o nome da Lista na frase, a Lista atual de fora e a Lista arquivada que não segura o Canal.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio/state";
import { motivoDeCanalEmOutraLista } from "./canais-de-atendimento";
import { LISTA_DO_ESPELHO, montarTarefaConversacional } from "./tarefa-conversacional-de-teste";

// O seed já tem uma Lista conversacional (Pós-venda) com os Canais dele: o teste usa um Canal que só a "SDR" atende.
const CANAL = { id: "chn_so_sdr", nome: "Comercial" };
let state: DataState;

beforeEach(() => {
  state = buildSeed();
  // Lista conversacional "SDR", que atende por `chn_so_sdr`.
  montarTarefaConversacional(state);
  const sdr = state.lists.find((l) => l.id === LISTA_DO_ESPELHO);
  if (!sdr) throw new Error("a Lista do teste não existe");
  sdr.canaisDeAtendimento = [CANAL.id];
});

describe("motivoDeCanalEmOutraLista (5.1.2)", () => {
  it("diz qual Lista já atende pelo Canal", () => {
    expect(motivoDeCanalEmOutraLista(state, CANAL)).toBe("O Canal “Comercial” já atende na Lista “SDR”: um Canal só atende em uma Lista conversacional.");
  });

  it("a Lista que está sendo configurada não conta como “outra”", () => {
    expect(motivoDeCanalEmOutraLista(state, CANAL, LISTA_DO_ESPELHO)).toBeUndefined();
  });

  it("um Canal que nenhuma Lista atende está livre", () => {
    expect(motivoDeCanalEmOutraLista(state, { id: "chn_livre", nome: "Livre" })).toBeUndefined();
  });

  it("a Lista arquivada não segura o Canal", () => {
    const lista = state.lists.find((l) => l.id === LISTA_DO_ESPELHO);
    if (!lista) throw new Error("a Lista do teste não existe");
    lista.lifecycle = "arquivado";
    expect(motivoDeCanalEmOutraLista(state, CANAL)).toBeUndefined();
  });
});
