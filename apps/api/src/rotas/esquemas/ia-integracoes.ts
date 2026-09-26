/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ia/integracoes.ts` — 2 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import { ID, type Esquemas } from "./fragmentos";
import { z } from "zod";

export const IA_INTEGRACOES = {
  conectarIntegracao: z.tuple([ID]),
  desconectarIntegracao: z.tuple([ID]),
} satisfies Esquemas;
