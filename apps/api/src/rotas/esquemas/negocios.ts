/**
 * A FORMA dos `args` das operações de `packages/dominio/src/operations/deals.ts`
 * — 12 operações. Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import type { DealContactRole } from "@n1/dominio";
import { ID, MONEY, opcional, STATUS_MAPPING, VALOR_DE_CAMPO, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const DEAL_CONTACT_ROLE = z.enum(["decisor", "influenciador", "comprador", "tecnico", "usuario", "outro"]);

const WIN_DEAL_INPUT = z
  .object({
    value: MONEY.optional(),
    winReasonId: ID.optional(),
    closingNote: z.string().optional(),
  })
  .strict();

const LOSE_DEAL_INPUT = z
  .object({
    lossReasonId: ID.optional(),
    closingNote: z.string().optional(),
  })
  .strict();

const CREATE_DEAL_INPUT = z
  .object({
    title: z.string(),
    funnelId: ID,
    companyId: ID.optional(),
    contactId: ID.optional(),
    value: MONEY.optional(),
    originId: ID.optional(),
    ownerMemberId: ID.optional(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const NEGOCIOS = {
  moveDealToStage: z.tuple([ID, ID]),
  winDeal: z.tuple([ID, WIN_DEAL_INPUT]),
  loseDeal: z.tuple([ID, LOSE_DEAL_INPUT]),
  reopenDeal: z.tuple([ID]),
  linkContactToDeal: z.tuple([ID, ID, DEAL_CONTACT_ROLE]),
  removeStage: z.tuple([ID, ID, ID]),
  // `scope` tem default na assinatura ("todos") — parâmetro com default é
  // opcional na chamada; `opcional()` aceita ausência e `null`.
  migrateDealsToFunnel: z.tuple([ID, ID, z.array(STATUS_MAPPING), opcional(z.enum(["abertos", "todos"]))]),
  restoreDeal: z.tuple([ID]),
  moveDealToFunnel: z.tuple([ID, ID, ID, opcional(ID)]),
  createDeal: z.tuple([CREATE_DEAL_INPUT]),
  unlinkContactFromDeal: z.tuple([ID, ID]),
  setDealFieldValue: z.tuple([ID, ID, VALOR_DE_CAMPO]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<[Igual<z.infer<typeof DEAL_CONTACT_ROLE>, DealContactRole>]>;
