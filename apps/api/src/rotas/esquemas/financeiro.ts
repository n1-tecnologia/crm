/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/financeiro.ts` — 2 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import { ID, type Esquemas } from "./fragmentos";
import { z } from "zod";

const RECEIVABLE_SERIES_INPUT = z
  .object({
    contactId: ID,
    centroDeCusto: z.string(),
    empresa: z.string().optional(),
    produto: z.string().optional(),
    forma: z.string().optional(),
    valorEntrada: z.number().optional(),
    vencimentoEntrada: z.string().optional(),
    valorParcela: z.number(),
    parcelas: z.number(),
    primeiroVencimento: z.string(),
  })
  .strict();

export const FINANCEIRO = {
  createReceivableSeries: z.tuple([RECEIVABLE_SERIES_INPUT]),
  runLancamentoAgent: z.tuple([ID, ID, ID]),
} satisfies Esquemas;
