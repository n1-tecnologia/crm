/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/canais.ts` — 2 operações.
 * `recusaDeGerirCanais` (recusa pré-calculada), `validarCanaisDeAtendimento`
 * e `identificadorCanonico` (helpers) não entram em `OPERACOES` nem têm
 * schema aqui. Ver `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import type { TipoDeAtendimento } from "@n1/dominio/operations";
import { ID, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const TIPO_DE_ATENDIMENTO = z.enum(["whatsapp", "email", "instagram", "linkedin"]);

const CRIAR_CANAL_INPUT = z
  .object({
    channelType: TIPO_DE_ATENDIMENTO,
    name: z.string(),
    externalId: z.string(),
    defaultQueueId: ID.optional(),
    defaultOriginId: ID.optional(),
  })
  .strict();

/** `?: Id | null` — ausente é "não mexe", `null` é "limpa". */
const CONFIGURAR_CANAL_INPUT = z
  .object({
    name: z.string().optional(),
    defaultQueueId: ID.nullable().optional(),
    defaultOriginId: ID.nullable().optional(),
  })
  .strict();

export const CANAIS = {
  criarCanal: z.tuple([CRIAR_CANAL_INPUT]),
  configurarCanal: z.tuple([ID, CONFIGURAR_CANAL_INPUT]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<[Igual<z.infer<typeof TIPO_DE_ATENDIMENTO>, TipoDeAtendimento>]>;
