/**
 * Contrato HTTP v1 entre `apps/api` e `automation/` (`financeiro-tria`) —
 * os sete métodos do adapter de Solicitação de pagamento (D-16, CON-13).
 * Espelho executável de `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`:
 * mudar um schema aqui sem atualizar aquele documento e as fixtures de
 * `contratos/payment-requests-v1/` é deriva, não detalhe de implementação
 * (ver `./CONTEXT.md`).
 *
 * Política fail-closed do §9 do contrato: todo objeto é `.strict()` — um
 * campo desconhecido em request ou response é rejeitado, nunca ignorado
 * em silêncio.
 *
 * `StatusSolicitacaoV1` e `FormaDePagamentoV1` são os enums CANÔNICOS deste
 * contrato — travados por D-01 e D-08 de `02-CONTEXT.md` (o Conjunto de
 * Status real da Lista e a inclusão de "Cartão"). Diferente de `PRIORITY`/
 * `STATUS_CATEGORY` em `../rotas/esquemas/fragmentos.ts`, NÃO existe hoje um
 * tipo TypeScript no domínio (`@n1/dominio`) para "Status de Solicitação" ou
 * "Forma de pagamento" — a Lista/Campos da Solicitação ainda não existem
 * como entidade do domínio nesta onda do plano (nascem em Status/Campo
 * CONFIGURADOS por dado, não por union literal hardcoded). Por isso estes
 * dois enums não passam pelo portão `Igual<>`/`Confere<>` — não há domínio
 * para fechar contra. `CommentDtoV1.author.kind`, que TEM um tipo real no
 * domínio (`ActorKind`), é fechado abaixo pelo mesmo mecanismo que
 * `fragmentos.ts` já usa para `ACTOR_REF`.
 */

import type { ActorKind } from "@n1/dominio";
import { z } from "zod";

// ── Portão de enum bidirecional (mesmo mecanismo de ../rotas/esquemas/fragmentos.ts) ──

type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Confere<T extends readonly true[]> = T;

// ── Enums canônicos do contrato ──────────────────────────────────────────

// 5º valor "em revisão" por último: chega com o Family Office (D5-06, 05-CONTEXT.md);
// os quatro anteriores continuam travados por D-01 (02-CONTEXT.md).
export const StatusSolicitacaoV1 = z.enum(["para fazer", "em aprovação", "não aprovado", "aprovado", "em revisão"]);

export const FormaDePagamentoV1 = z.enum(["Chave Pix", "Boleto", "QRCode Pix", "Cartão"]);

const ACTOR_KIND_V1 = z.enum(["member", "agent", "automation", "integration", "system"]);

type _EnumsFechadosContraODominio = Confere<[Igual<z.infer<typeof ACTOR_KIND_V1>, ActorKind>]>;

// ── Fragmentos ────────────────────────────────────────────────────────────

export const AnexoDtoV1 = z
  .object({
    id: z.string(),
    role: z.enum(["invoice", "boleto", "qrCode", "other"]),
    name: z.string(),
    mediaType: z.string(),
    size: z.number().int().nonnegative(),
    downloadUrl: z.url(),
    expiresAt: z.iso.datetime(),
  })
  .strict();

const CAMPOS_DO_DTO_V1 = z
  .object({
    costCenter: z.string(),
    businessUnit: z.string().nullable(),
    company: z.string().nullable(),
    paymentCategory: z.string().nullable(),
    personId: z.string().nullable(),
    supplierType: z.enum(["CPF", "CNPJ"]).nullable(),
    supplierDocument: z.string().nullable(),
    supplierName: z.string().nullable(),
    requesterName: z.string().nullable(),
    requesterWhatsApp: z.string().nullable(),
    issueDate: z.iso.date().nullable(),
    dueDate: z.iso.date().nullable(),
    amountCents: z.number().int().nullable(),
    paymentMethod: FormaDePagamentoV1.nullable(),
    pixKey: z.string().nullable(),
    barcode: z.string().nullable(),
    pixCopyPaste: z.string().nullable(),
    paymentLink: z.string().nullable(),
    manual: z.boolean(),
    manualReason: z.string().nullable(),
    productIds: z.array(z.string()),
  })
  .strict();

// ── DTOs canônicos ────────────────────────────────────────────────────────

export const PaymentRequestDtoV1 = z
  .object({
    id: z.string(),
    readableId: z.string(),
    origin: z.enum(["plataforma", "clickup"]),
    title: z.string(),
    description: z.string().nullable(),
    status: StatusSolicitacaoV1,
    dueDate: z.iso.date().nullable(),
    assigneeIds: z.array(z.string()),
    tagIds: z.array(z.string()),
    fields: CAMPOS_DO_DTO_V1,
    attachments: z.array(AnexoDtoV1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const CommentDtoV1 = z
  .object({
    id: z.string(),
    taskId: z.string(),
    parentCommentId: z.string().nullable(),
    author: z
      .object({
        kind: ACTOR_KIND_V1,
        id: z.string(),
        displayName: z.string(),
      })
      .strict(),
    text: z.string(),
    mentionMemberIds: z.array(z.string()),
    createdAt: z.iso.datetime(),
  })
  .strict();

// ── Envelope de cabeçalhos de escrita ─────────────────────────────────────

export const CabecalhosDeEscritaV1 = z
  .object({
    "idempotency-key": z.string().min(16).max(200),
  })
  .catchall(z.string());

// ── Cursor de paginação — comum a listPaymentRequestTasks e getCommentReplies ──

const CURSOR_QUERY_V1 = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

const PARAMS_TASK_ID_V1 = z.object({ taskId: z.string() }).strict();

// ── Schemas de request/response por endpoint ──────────────────────────────

export const EsquemasV1 = {
  getTask: {
    params: PARAMS_TASK_ID_V1,
    resposta: PaymentRequestDtoV1,
  },
  listPaymentRequestTasks: {
    query: CURSOR_QUERY_V1.extend({ updatedAfter: z.iso.datetime().optional() }).strict(),
    resposta: z
      .object({
        items: z.array(PaymentRequestDtoV1),
        nextCursor: z.string().optional(),
      })
      .strict(),
  },
  createComment: {
    params: PARAMS_TASK_ID_V1,
    body: z
      .object({
        text: z.string(),
        parentCommentId: z.string().optional(),
        mentionMemberIds: z.array(z.string()).optional(),
      })
      .strict(),
    resposta: CommentDtoV1,
  },
  getCommentReplies: {
    params: z.object({ commentId: z.string() }).strict(),
    query: CURSOR_QUERY_V1,
    resposta: z
      .object({
        items: z.array(CommentDtoV1),
        nextCursor: z.string().optional(),
      })
      .strict(),
  },
  addTaskTag: {
    params: PARAMS_TASK_ID_V1.extend({ tagId: z.string() }).strict(),
    resposta: PaymentRequestDtoV1,
  },
  updateTaskDueDate: {
    params: PARAMS_TASK_ID_V1,
    body: z.object({ dueDate: z.iso.date().nullable() }).strict(),
    resposta: PaymentRequestDtoV1,
  },
  updateTaskStatus: {
    params: PARAMS_TASK_ID_V1,
    body: z.object({ status: StatusSolicitacaoV1, reason: z.string().optional() }).strict(),
    resposta: PaymentRequestDtoV1,
  },
} as const;

export type NomeDeEndpointV1 = keyof typeof EsquemasV1;
