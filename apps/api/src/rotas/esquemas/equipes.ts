/** A FORMA dos `args` de `packages/dominio/src/operations/equipes.ts` (12.4.2). */

import { z } from "zod";
import { ID, type Esquemas } from "./fragmentos";

export const EQUIPES = {
  createTeam: z.tuple([z.object({ nome: z.string().max(200), descricao: z.string().max(1000).optional() }).strict()]),
  updateTeam: z.tuple([ID, z.object({ nome: z.string().max(200).optional(), descricao: z.string().max(1000).optional() }).strict()]),
  addMemberToTeam: z.tuple([ID, ID]),
  removeMemberFromTeam: z.tuple([ID, ID]),
  deleteTeam: z.tuple([ID]),
} satisfies Esquemas;
