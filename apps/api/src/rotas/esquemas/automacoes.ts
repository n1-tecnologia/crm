/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/automations.ts` — 1 operação. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import { ID, type Esquemas } from "./fragmentos";
import { z } from "zod";

export const AUTOMACOES = {
  // A validação roda DEPOIS de `reviverArgumentos` (`operacoes.ts`) — por
  // isso `z.date()`, e não o marcador serializado `{ $tipo: "Date", iso }`
  // que só existe no corpo HTTP.
  runScheduledAutomations: z.tuple([ID, z.date()]),
} satisfies Esquemas;
