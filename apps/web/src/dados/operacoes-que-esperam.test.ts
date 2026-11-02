/**
 * A lista de exceções de D-13 (Fase 12, plano 07): as operações cujo resultado
 * local não é o que o servidor grava esperam a resposta, como antes da fase.
 * Aqui só a lista e `esperaOServidor`; o efeito no store está em
 * `store.test.ts` (describe "D-13 — a mudança aparece na hora").
 */

import { describe, expect, it } from "vitest";
import { ehNomeDeOperacao } from "@n1/dominio/operations/registro";
import { OPERACOES_QUE_ESPERAM, esperaOServidor } from "./operacoes-que-esperam";

describe("OPERACOES_QUE_ESPERAM — a lista de D-13", () => {
  it("não está vazia", () => {
    expect(OPERACOES_QUE_ESPERAM.size).toBeGreaterThan(0);
  });

  it("toda chave é o nome de uma operação do registro", () => {
    for (const nome of OPERACOES_QUE_ESPERAM.keys()) {
      expect(ehNomeDeOperacao(nome), `${nome} não está em OPERACOES`).toBe(true);
    }
  });

  it("todo motivo é uma frase (pelo menos 20 caracteres)", () => {
    for (const [nome, motivo] of OPERACOES_QUE_ESPERAM) {
      expect(motivo.trim().length, `o motivo de ${nome} é curto demais`).toBeGreaterThanOrEqual(20);
    }
  });
});

/**
 * O conjunto que o levantamento da Fase 12 (plano 07, Task 2) fechou, em ordem
 * alfabética: `12-PROVAS.md` § "Operações que esperam o servidor (D-13)". Mudar
 * a lista exige mudar esta constante — e o levantamento junto com ela.
 */
const ESPERADAS_PELO_LEVANTAMENTO: readonly string[] = [
  "copiarFlow",
  "createForm",
  "criarComunidade",
  "criarGrupo",
  "definirPontoDeTrocaDeDados",
  "inviteMember",
  "publicarVersao",
  "regenerarChavesDoPonto",
  "regenerarLinkDeConvite",
  "rotateFormSecret",
  "runCalendarRecurrences",
  "runScheduledAutomations",
  "shareTaskPublicly",
  "sincronizarGrupo",
];

/** As candidatas que o levantamento leu e deixou otimistas: o valor local é o que o servidor grava. */
const LIDAS_E_DEIXADAS_OTIMISTAS = [
  "importarGruposDoCanal",
  "criarRascunhoAPartirDe",
  "enviarFlow",
  "ensaiarAgente",
  "sendChatMessage",
  "runLancamentoAgent",
  "converterSolicitacaoEmContaAPagar",
] as const;

describe("OPERACOES_QUE_ESPERAM — o conjunto fechado pelo levantamento", () => {
  it("a constante do teste está em ordem alfabética (sem repetição)", () => {
    expect(ESPERADAS_PELO_LEVANTAMENTO).toEqual([...new Set(ESPERADAS_PELO_LEVANTAMENTO)].sort());
  });

  it("as chaves do Map são exatamente as do levantamento", () => {
    expect([...OPERACOES_QUE_ESPERAM.keys()].sort()).toEqual(ESPERADAS_PELO_LEVANTAMENTO);
  });

  it.each(LIDAS_E_DEIXADAS_OTIMISTAS)("%s foi lida, não gera valor que o servidor decida, e fica otimista", (nome) => {
    expect(ehNomeDeOperacao(nome), `${nome} não está em OPERACOES`).toBe(true);
    expect(OPERACOES_QUE_ESPERAM.has(nome as never)).toBe(false);
    expect(esperaOServidor([{ nome: nome as never, args: [] }])).toBe(false);
  });
});

describe("esperaOServidor", () => {
  it("é verdadeiro quando a chamada está na lista", () => {
    expect(esperaOServidor([{ nome: "createForm", args: [] }])).toBe(true);
  });

  it("é falso quando nenhuma chamada está na lista", () => {
    expect(esperaOServidor([{ nome: "createList", args: [] }])).toBe(false);
  });

  it("é verdadeiro quando QUALQUER chamada do gesto está na lista", () => {
    expect(
      esperaOServidor([
        { nome: "createList", args: [] },
        { nome: "createForm", args: [] },
      ]),
    ).toBe(true);
  });

  it("é falso para um gesto sem chamada alguma", () => {
    expect(esperaOServidor([])).toBe(false);
  });
});
