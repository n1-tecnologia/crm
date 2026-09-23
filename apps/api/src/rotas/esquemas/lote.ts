/**
 * A FORMA dos `args` da operação de fechamento em lote (PAG-05 — D3-08
 * irmão: `packages/dominio/src/operations/lote.ts`), arquivo novo por ser
 * módulo novo do domínio (regra 1/7 de `../CONTEXT.md`).
 *
 * Um id e um array de ids — nada mais: quem decide o tamanho máximo do lote
 * (`LIMITE_DO_LOTE`), a permissão item a item e o relato de falha parcial é o
 * domínio, nunca o corpo da requisição (`fragmentos.ts` é explícito: limite
 * numérico é regra de negócio, não forma de transporte — por isso o array de
 * ids não ganha um teto de tamanho aqui).
 *
 * Sem `z.enum` nesta operação: nada a acrescentar a nenhum portão
 * `Confere<[Igual<…>]>` (regra 4 da pasta).
 */

import { ID, type Esquemas } from "./fragmentos";
import { z } from "zod";

export const LOTE = {
  alterarStatusEmLote: z.tuple([z.array(ID), ID]),
} satisfies Esquemas;
