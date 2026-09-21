/**
 * A FORMA dos `args` das operações de `packages/dominio/src/operations/ai.ts`
 * — 9 operações. Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import type { ChatAnchor } from "@n1/dominio";
import { ID, opcional, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const CHAT_ANCHOR_TYPE = z.enum([
  "task",
  "deal",
  "contact",
  "company",
  "conversation",
  "knowledgeDocument",
  "space",
  "folder",
  "list",
]);

const CHAT_ANCHOR = z.object({ type: CHAT_ANCHOR_TYPE, id: ID }).strict();

const CREATE_CHAT_SESSION_INPUT = z
  .object({
    title: z.string(),
    mainAgentId: ID.optional(),
    anchor: CHAT_ANCHOR.optional(),
    chosenModelId: ID.optional(),
    folderId: ID.optional(),
    skillId: ID.optional(),
  })
  .strict();

/**
 * `?: T | null` — ausente é "não mexe", `null` é "limpa"; `.nullable().optional()`
 * preserva os dois (diferente de `opcional()`, que colapsaria `null` para `undefined`).
 */
const CONFIGURE_CHAT_SESSION_INPUT = z
  .object({
    folderId: ID.nullable().optional(),
    skillId: ID.nullable().optional(),
    chosenModelId: ID.nullable().optional(),
    mainAgentId: ID.nullable().optional(),
    anchor: CHAT_ANCHOR.nullable().optional(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
const SOLICITAR_APROVACAO_INPUT = z
  .object({
    taskId: ID,
    approverMemberId: ID,
    threadCommentId: ID,
    reason: opcional(z.string()),
  })
  .strict();

const DECIDE_PROCESS_APPROVAL_OPTIONS = z
  .object({
    source: z.enum(["click", "comment"]),
    reason: opcional(z.string()),
  })
  .strict();

export const IA = {
  decideApproval: z.tuple([ID, z.enum(["aprovada", "rejeitada"]), opcional(z.string())]),
  decideProcessApproval: z.tuple([ID, z.enum(["aprovada", "rejeitada"]), DECIDE_PROCESS_APPROVAL_OPTIONS]),
  solicitarAprovacao: z.tuple([SOLICITAR_APROVACAO_INPUT]),
  publishAutomation: z.tuple([ID]),
  restoreAgent: z.tuple([ID]),
  restoreAutomation: z.tuple([ID]),
  createChatSession: z.tuple([CREATE_CHAT_SESSION_INPUT]),
  configureChatSession: z.tuple([ID, CONFIGURE_CHAT_SESSION_INPUT]),
  sendChatMessage: z.tuple([ID, z.string()]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<[Igual<z.infer<typeof CHAT_ANCHOR_TYPE>, ChatAnchor["type"]>]>;
