/**
 * Q2 / A7 (Fase 10, `owner-confirmation: pending`) — as estruturas que o código
 * endereça por id e que `moveContainer` recusa mover: a Pasta Meus negócios
 * (CRM e ponte), as Listas Contas a pagar e Contas a receber (evoluers do
 * Financeiro) e Solicitações de pagamento (`solicitacoes:configurar
 * --conferir`). Mudar uma delas de lugar não apaga nada, mas quebra o que a
 * endereça pelo caminho.
 *
 * Por que este arquivo existe: `CR` mora em `operations/financeiro` e `LISTA_ID`
 * em `solicitacao-de-pagamento-evolver`, e os dois chegam a `operations/tasks`,
 * que importa `operations/structure` — importá-los de lá faria um ciclo de
 * carga. Os dois ids vêm escritos aqui; `estruturas-fixas.test.ts` confere cada
 * um contra a constante de origem, então a cópia não pode divergir em silêncio.
 * `CP` e `MEUS_NEGOCIOS_ID` vêm de módulos-folha, sem ciclo.
 */

import { CP } from "./operations/financeiro-base";
import { MEUS_NEGOCIOS_ID } from "./seed-comercial";
import type { Id } from "./types";

/** A Pasta espelho dos Funis do CRM. */
export const PASTA_MEUS_NEGOCIOS_ID: Id = MEUS_NEGOCIOS_ID;

/** Contas a receber (`CR.listId`). */
export const LISTA_CONTAS_A_RECEBER_ID: Id = "lst_contas_a_receber";

/** Solicitações de pagamento (`LISTA_ID` de `solicitacao-de-pagamento-evolver`). */
export const LISTA_SOLICITACOES_DE_PAGAMENTO_ID: Id = "lst_solicitacoes_de_pagamento";

const PASTAS_FIXAS: ReadonlySet<Id> = new Set([PASTA_MEUS_NEGOCIOS_ID]);
const LISTAS_FIXAS: ReadonlySet<Id> = new Set([CP.listId, LISTA_CONTAS_A_RECEBER_ID, LISTA_SOLICITACOES_DE_PAGAMENTO_ID]);

/** Este contêiner é uma das estruturas fixas, que não mudam de lugar? */
export function ehEstruturaFixa(tipo: "folder" | "list", id: Id): boolean {
  return tipo === "folder" ? PASTAS_FIXAS.has(id) : LISTAS_FIXAS.has(id);
}
