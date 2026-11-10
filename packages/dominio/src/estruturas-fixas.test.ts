/**
 * Q2 / A7 — o conjunto fechado de estruturas fixas confere com as constantes de
 * origem. `estruturas-fixas.ts` repete dois ids para não criar ciclo de carga;
 * este teste é o que impede a cópia de divergir.
 */

import { describe, expect, it } from "vitest";
import { CP, CR } from "./operations/financeiro";
import { LISTA_ID } from "./solicitacao-de-pagamento-evolver";
import * as estruturasFixas from "./estruturas-fixas";
import { ehEstruturaFixa, LISTA_CONTAS_A_RECEBER_ID, LISTA_SOLICITACOES_DE_PAGAMENTO_ID } from "./estruturas-fixas";

describe("estruturas fixas (Q2)", () => {
  it("cada id confere com a constante de origem", () => {
    expect(LISTA_CONTAS_A_RECEBER_ID).toBe(CR.listId);
    expect(LISTA_SOLICITACOES_DE_PAGAMENTO_ID).toBe(LISTA_ID);
  });

  it("a constante da Pasta Meus negócios saiu do módulo (15-43): nenhuma regra a lê", () => {
    // Só os ids das duas Listas e a função: a Pasta não tem mais constante, e quem a citasse por nome não compilaria.
    expect(Object.keys(estruturasFixas).sort()).toEqual([
      "LISTA_CONTAS_A_RECEBER_ID",
      "LISTA_SOLICITACOES_DE_PAGAMENTO_ID",
      "ehEstruturaFixa",
    ]);
  });

  it("reconhece as três Listas fixas, e só elas: a Pasta Meus negócios deixou de ser fixa (15-41, D-15-14)", () => {
    expect(ehEstruturaFixa("folder", "fld_meus_negocios")).toBe(false);
    expect(ehEstruturaFixa("list", CP.listId)).toBe(true);
    expect(ehEstruturaFixa("list", CR.listId)).toBe(true);
    expect(ehEstruturaFixa("list", LISTA_ID)).toBe(true);
    expect(ehEstruturaFixa("folder", "fld_clientes")).toBe(false);
    expect(ehEstruturaFixa("list", "lst_prospeccao")).toBe(false);
    // O tipo conta: o id de uma Lista não vale como Pasta.
    expect(ehEstruturaFixa("folder", CP.listId)).toBe(false);
  });
});
