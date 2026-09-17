/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/contacts.ts` — 17 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import type { CompanyIdentifier, ContactIdentifierType } from "@n1/dominio";
import { ID, opcional, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const CONTACT_IDENTIFIER_TYPE = z.enum([
  "telefone",
  "email",
  "identidadeDeWhatsApp",
  "usuarioDeInstagram",
  "identificadorDeChatDoSite",
  "perfilDeLinkedIn",
  "perfilDeTikTok",
]);

const COMPANY_IDENTIFIER_TYPE = z.enum(["dominio", "documentoFiscal", "telefone"]);

const IMPORT_ROW = z
  .object({
    firstName: z.string(),
    lastName: z.string().optional(),
    identifierType: CONTACT_IDENTIFIER_TYPE.optional(),
    identifierValue: z.string().optional(),
  })
  .strict();

const IMPORT_OPTIONS = z
  .object({
    onCollision: z.enum(["rejeitar", "atualizar"]),
    ownerMemberId: ID.optional(),
    originId: ID.optional(),
  })
  .strict();

const CREATE_CONTACT_INPUT = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    identifierType: CONTACT_IDENTIFIER_TYPE.optional(),
    identifierValue: z.string().optional(),
    companyId: ID.optional(),
    role: z.string().optional(),
    ownerMemberId: ID.optional(),
  })
  .strict();

const CREATE_COMPANY_INPUT = z
  .object({
    tradeName: z.string(),
    legalName: z.string(),
    parentCompanyId: ID.optional(),
    ownerMemberId: ID.optional(),
  })
  .strict();

const LINK_CONTACT_TO_COMPANY_INPUT = z
  .object({
    contactId: ID,
    companyId: ID,
    role: z.string(),
    principalForCompany: z.boolean().optional(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const CONTATOS = {
  addContactIdentifier: z.tuple([ID, CONTACT_IDENTIFIER_TYPE, z.string()]),
  transferContactIdentifier: z.tuple([ID, ID, ID]),
  mergeContacts: z.tuple([ID, ID]),
  endContactCompanyLink: z.tuple([ID, z.string()]),
  trashContact: z.tuple([ID]),
  trashCompany: z.tuple([ID]),
  restoreMergedCopy: z.tuple([ID]),
  importContacts: z.tuple([z.array(IMPORT_ROW), IMPORT_OPTIONS]),
  restoreContact: z.tuple([ID]),
  restoreCompany: z.tuple([ID]),
  markContactsAsDistinct: z.tuple([ID, ID]),
  addContactNote: z.tuple([ID, z.string()]),
  createContact: z.tuple([CREATE_CONTACT_INPUT]),
  createCompany: z.tuple([CREATE_COMPANY_INPUT]),
  linkContactToCompany: z.tuple([LINK_CONTACT_TO_COMPANY_INPUT]),
  addCompanyIdentifier: z.tuple([ID, COMPANY_IDENTIFIER_TYPE, z.string()]),
  // Posição obrigatória tipada `Id | undefined`: `contact-card.tsx` manda
  // `undefined` para limpar — vira `null` no JSON, por isso `opcional()`.
  setContactCatalogValue: z.tuple([ID, z.enum(["qualificacao", "temperatura"]), opcional(ID)]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [
    Igual<z.infer<typeof CONTACT_IDENTIFIER_TYPE>, ContactIdentifierType>,
    Igual<z.infer<typeof COMPANY_IDENTIFIER_TYPE>, CompanyIdentifier["type"]>,
  ]
>;
