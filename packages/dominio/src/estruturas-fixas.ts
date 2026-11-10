/**
 * Q2 / A7 (Fase 10, `owner-confirmation: pending`) — as estruturas que o código
 * endereça por id e que `moveContainer` recusa mover: as Listas Contas a pagar
 * e Contas a receber (evoluers do Financeiro) e Solicitações de pagamento
 * (`solicitacoes:configurar --conferir`). Mudar uma delas de lugar não apaga
 * nada, mas quebra o que a endereça pelo caminho.
 *
 * A Pasta Meus negócios saiu do conjunto (15-41, D-15-14): ela só era fixa
 * porque o espelho dos Funis a endereçava por id, e o espelho saiu (F14-D-06).
 * A constante do id dela saiu no 15-43; nos Espaços de teste que ainda a guardam
 * ela é uma Pasta comum.
 *
 * Por que este arquivo existe: `CR` mora em `operations/financeiro` e `LISTA_ID`
 * em `solicitacao-de-pagamento-evolver`, e os dois chegam a `operations/tasks`,
 * que importa `operations/structure` — importá-los de lá faria um ciclo de
 * carga. Os dois ids vêm escritos aqui; `estruturas-fixas.test.ts` confere cada
 * um contra a constante de origem, então a cópia não pode divergir em silêncio.
 * `CP` vem de um módulo-folha, sem ciclo.
 */

import { CP } from "./operations/financeiro-base";
import type { Id } from "./types";

/** Contas a receber (`CR.listId`). */
export const LISTA_CONTAS_A_RECEBER_ID: Id = "lst_contas_a_receber";

/** Solicitações de pagamento (`LISTA_ID` de `solicitacao-de-pagamento-evolver`). */
export const LISTA_SOLICITACOES_DE_PAGAMENTO_ID: Id = "lst_solicitacoes_de_pagamento";

const LISTAS_FIXAS: ReadonlySet<Id> = new Set([CP.listId, LISTA_CONTAS_A_RECEBER_ID, LISTA_SOLICITACOES_DE_PAGAMENTO_ID]);

/** Este contêiner é uma das estruturas fixas, que não mudam de lugar? */
export function ehEstruturaFixa(tipo: "folder" | "list", id: Id): boolean {
  // Nenhuma Pasta é fixa desde o 15-41: só as Listas acima.
  return tipo === "list" && LISTAS_FIXAS.has(id);
}
