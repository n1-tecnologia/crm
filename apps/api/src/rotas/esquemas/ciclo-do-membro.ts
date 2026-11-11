/** A FORMA dos `args` de `packages/dominio/src/operations/ciclo-do-membro.ts` (12.3.3 e 12.3.7). */

import { z } from "zod";
import { ID, type Esquemas } from "./fragmentos";

export const CICLO_DO_MEMBRO = {
  aceitarConvite: z.tuple([z.object({ nome: z.string().max(200) }).strict()]),
  suspenderMembro: z.tuple([ID]),
  reativarMembro: z.tuple([ID]),
} satisfies Esquemas;
