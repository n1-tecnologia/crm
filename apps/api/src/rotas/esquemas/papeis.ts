/**
 * A FORMA dos `args` de `packages/dominio/src/operations/papeis.ts` (12.4.1).
 * A base `proprietario` passa aqui de propósito: recusá-la é regra do domínio
 * (`createRole`), não forma.
 */

import type { Modulo, SystemRole } from "@n1/dominio";
import { z } from "zod";
import { ID, type Confere, type Esquemas, type Igual } from "./fragmentos";

const MODULO = z.enum(["trabalho", "crm", "ia", "ferramentas", "paineis", "financeiro"]);
const BASE = z.enum(["proprietario", "administrador", "membro", "convidado"]);

export const PAPEIS = {
  createRole: z.tuple([z.object({ nome: z.string().max(200), base: BASE, modulos: z.array(MODULO).max(12) }).strict()]),
  updateRole: z.tuple([ID, z.object({ nome: z.string().max(200).optional(), modulos: z.array(MODULO).max(12).optional() }).strict()]),
} satisfies Esquemas;

type _EnumsCompletos = Confere<[Igual<z.infer<typeof MODULO>, Modulo>, Igual<z.infer<typeof BASE>, SystemRole>]>;
