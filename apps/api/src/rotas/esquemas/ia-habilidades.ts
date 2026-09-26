/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ia/habilidades.ts` — 13 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import { ID, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";

const CRIAR_HABILIDADE_INPUT = z.object({ name: z.string(), description: z.string().optional() }).strict();

const EDITAR_HABILIDADE_INPUT = z
  .object({ name: z.string().optional(), description: z.string().optional() })
  .strict();

/** `SkillParameter` (`types/ai.ts`). `type` é `string` no domínio, não uma união. */
const SKILL_PARAMETER = z
  .object({ name: z.string(), type: z.string(), required: z.boolean(), description: z.string() })
  .strict();

/** `PatchDoRascunhoDaHabilidade` — `Partial<Pick<SkillVersion, …>>`. */
const PATCH_DO_RASCUNHO = z
  .object({
    instructions: z.string().optional(),
    inputContract: z.array(SKILL_PARAMETER).optional(),
    outputContract: z.object({ structured: z.array(SKILL_PARAMETER), text: z.boolean() }).strict().optional(),
    toolRequirements: z.array(z.object({ toolId: z.string(), mandatory: z.boolean() }).strict()).optional(),
    dependencies: z.array(z.object({ skillId: ID, pinnedVersion: z.number().optional() }).strict()).optional(),
    recommendedCollectionIds: z.array(ID).optional(),
  })
  .strict();

const CONCEDER_HABILIDADE_INPUT = z
  .object({ agentId: ID, skillId: ID, pinnedVersion: z.number().optional() })
  .strict();

export const IA_HABILIDADES = {
  criarHabilidade: z.tuple([CRIAR_HABILIDADE_INPUT]),
  // `versao?`/`deVersao?` posicionais no fim: a tela manda `undefined` para
  // "a corrente" — vira `null` no JSON, por isso `opcional()`.
  copiarHabilidadeDaPlataforma: z.tuple([ID, opcional(z.number())]),
  editarHabilidade: z.tuple([ID, EDITAR_HABILIDADE_INPUT]),
  criarRascunhoDaHabilidade: z.tuple([ID, opcional(z.number())]),
  editarRascunhoDaHabilidade: z.tuple([ID, PATCH_DO_RASCUNHO]),
  descartarRascunhoDaHabilidade: z.tuple([ID]),
  publicarVersaoDaHabilidade: z.tuple([ID]),
  obsoletarVersaoDaHabilidade: z.tuple([ID, z.number()]),
  arquivarHabilidade: z.tuple([ID]),
  restaurarHabilidade: z.tuple([ID]),
  concederHabilidade: z.tuple([CONCEDER_HABILIDADE_INPUT]),
  // `null` (obrigatório na assinatura) — a Concessão volta a seguir a corrente.
  fixarVersaoDaConcessao: z.tuple([ID, z.number().nullable()]),
  revogarHabilidade: z.tuple([ID]),
} satisfies Esquemas;
