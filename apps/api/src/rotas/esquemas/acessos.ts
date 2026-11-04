/** A FORMA dos `args` de `packages/dominio/src/operations/acessos.ts` (12.4.3). */

import type { AcaoDeAcesso, SujeitoDeAcesso } from "@n1/dominio/operations/acessos";
import { z } from "zod";
import { CONTAINER_TYPE, ID, type Confere, type Esquemas, type Igual } from "./fragmentos";

const SUJEITO = z.enum(["member", "team", "role"]);
const ACAO = z.enum(["ver", "comentar", "editar", "administrar"]);

export const ACESSOS = {
  concederAcesso: z.tuple([
    z.object({ subjectKind: SUJEITO, subjectId: ID, action: ACAO, resourceType: CONTAINER_TYPE, resourceId: ID }).strict(),
  ]),
  revogarAcesso: z.tuple([ID]),
} satisfies Esquemas;

type _EnumsCompletos = Confere<[Igual<z.infer<typeof SUJEITO>, SujeitoDeAcesso>, Igual<z.infer<typeof ACAO>, AcaoDeAcesso>]>;
