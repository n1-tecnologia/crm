/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/agent-builder.ts` — 2 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import type { AgentDraft } from "@n1/dominio/operations/agent-builder";
import { ID, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

// `instructions.length > 4000` é REGRA do domínio, `validate()` em
// `agent-builder.ts:37` — não repetir aqui.
const AGENT_DRAFT = z
  .object({
    name: z.string(),
    description: z.string(),
    instructions: z.string(),
    modelId: z.string(),
    allowedToolIds: z.array(z.string()),
    icebreakers: z.array(z.string()),
    knowledgeSources: z.array(
      z.object({ kind: z.enum(["arquivo", "url", "base"]), label: z.string() }).strict(),
    ),
    responseFormat: z.enum(["texto", "markdown", "json", "estruturado"]),
    accessPoints: z.array(z.enum(["chat", "whatsapp", "api", "webhook"])),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const CONSTRUTOR_DE_AGENTES = {
  createAgent: z.tuple([AGENT_DRAFT]),
  publishAgentVersion: z.tuple([ID, AGENT_DRAFT]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [
    Igual<z.infer<typeof AGENT_DRAFT>["responseFormat"], AgentDraft["responseFormat"]>,
    Igual<
      z.infer<typeof AGENT_DRAFT>["knowledgeSources"][number]["kind"],
      AgentDraft["knowledgeSources"][number]["kind"]
    >,
    Igual<z.infer<typeof AGENT_DRAFT>["accessPoints"][number], AgentDraft["accessPoints"][number]>,
  ]
>;
