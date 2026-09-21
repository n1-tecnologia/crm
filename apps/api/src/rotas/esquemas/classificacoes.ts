/**
 * A FORMA do corpo de `POST /v1/integrations/payment-approvals/classifications`
 * (`../classificacoes.ts`, Plan 02-24) — o callback que o classificador de
 * comentário do `automation/` chama depois de ler uma resposta no tópico de
 * roteamento.
 *
 * Corpo `.strict()` de propósito: **não existe** um campo de identidade de
 * quem decidiu, nem um campo apontando direto para a Solicitação de
 * Aprovação ou para o Membro. O serviço não declara quem decidiu nem sobre
 * qual Solicitação de Aprovação — só `commentId`, e a plataforma resolve
 * autor, tópico e aprovação a partir do dado persistido (T-02-18,
 * Spoofing). Um corpo com qualquer um desses três campos é rejeitado pelo
 * `.strict()` antes de qualquer lógica de rota rodar.
 *
 * `headers` reaproveita `CabecalhosDeEscritaV1` (mesma forma das escritas de
 * `../../contratos/v1.ts`) — `Idempotency-Key` obrigatória, mínimo 16
 * caracteres. A rota confere, além da FORMA validada aqui, que o cabeçalho é
 * exatamente igual a `eventId` (T-02-08) — verificação de CONTEÚDO, fora do
 * escopo de um schema Zod, feita em `../classificacoes.ts`.
 */

import { z } from "zod";
import { CabecalhosDeEscritaV1 } from "../../contratos/v1";

export const CorpoDeClassificacaoV1 = z
  .object({
    eventId: z.uuid(),
    commentId: z.string().min(1),
    decision: z.enum(["aprovado", "reprovado", "irrelevante"]),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const ESQUEMAS_DE_CLASSIFICACOES = {
  postClassification: {
    body: CorpoDeClassificacaoV1,
    headers: CabecalhosDeEscritaV1,
  },
} as const;
