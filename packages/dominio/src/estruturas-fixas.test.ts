/**
 * Q2 / A7 — o conjunto fechado de estruturas fixas confere com as constantes de
 * origem. `estruturas-fixas.ts` repete dois ids para não criar ciclo de carga;
 * este teste é o que impede a cópia de divergir.
 */

import { describe, expect, it } from "vitest";
import { CP, CR } from "./operations/financeiro";
import { MEUS_NEGOCIOS_ID } from "./seed-comercial";
import { LISTA_ID } from "./solicitacao-de-pagamento-evolver";
import { ehEstruturaFixa, LISTA_CONTAS_A_RECEBER_ID, LISTA_SOLICITACOES_DE_PAGAMENTO_ID, PASTA_MEUS_NEGOCIOS_ID } from "./estruturas-fixas";

describe("estruturas fixas (Q2)", () => {
  it("cada id confere com a constante de origem", () => {
    expect(PASTA_MEUS_NEGOCIOS_ID).toBe(MEUS_NEGOCIOS_ID);
    expect(LISTA_CONTAS_A_RECEBER_ID).toBe(CR.listId);
    expect(LISTA_SOLICITACOES_DE_PAGAMENTO_ID).toBe(LISTA_ID);
  });

  it("reconhece a Pasta Meus negócios e as três Listas, e só elas", () => {
    expect(ehEstruturaFixa("folder", MEUS_NEGOCIOS_ID)).toBe(true);
    expect(ehEstruturaFixa("list", CP.listId)).toBe(true);
    expect(ehEstruturaFixa("list", CR.listId)).toBe(true);
    expect(ehEstruturaFixa("list", LISTA_ID)).toBe(true);
    expect(ehEstruturaFixa("folder", "fld_clientes")).toBe(false);
    expect(ehEstruturaFixa("list", "lst_prospeccao")).toBe(false);
    // O tipo conta: o id de uma Lista não vale como Pasta.
    expect(ehEstruturaFixa("folder", CP.listId)).toBe(false);
  });
});
