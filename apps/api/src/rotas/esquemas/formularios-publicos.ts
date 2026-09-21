/**
 * A FORMA do `params`/`body` das três rotas públicas do Formulário
 * (`../formularios-publicos.ts`, Plan 02-16) — `PARAMS_SEGREDO`,
 * `CORPO_TICKET`, `CORPO_SUBMISSAO`.
 *
 * Diferente do resto de `esquemas/` (a FORMA dos `args` de
 * `POST /operacoes/:nome`, validação de transporte pura, sem `.min()`/
 * `.max()`/regex — ver `./CONTEXT.md`), estes schemas validam a borda de
 * uma superfície SEM autenticação nenhuma (T-02-03/T-02-04): o formato do
 * segredo, o tamanho de uma resposta e a forma fechada do corpo de envio
 * são a primeira linha de defesa antes de qualquer leitura de estado.
 *
 * `.strict()` nos três — a decisão de segurança do envio público é que
 * `CORPO_SUBMISSAO` NUNCA aceita uma chave a mais: `ownerId`, `actorId`,
 * `status`, `origem`, `taskId` não têm onde entrar. O navegador não decide
 * quem é o Ator do envio — `formActor(form.id)` decide (D-03,
 * `@n1/dominio/operations/scale.ts`) — nem em que Status ou por qual origem
 * a Tarefa nasce; uma chave extra aqui é rejeitada com 400 pelo schema, não
 * silenciosamente descartada (T-02-04).
 */

import { z } from "zod";
import { MAX_ARQUIVOS_POR_ENVIO, TIPOS_ACEITOS } from "../../servicos/storage-uploads";

/**
 * Um segredo fora deste formato nunca corresponde a um Formulário real
 * (`secret()`, `scale.ts`, gera hex de 24 caracteres) — por isso a rota
 * devolve 404 direto, nunca 400 com detalhe: o formato do segredo não é
 * informação que valha a pena confirmar a quem não o possui (T-02-03,
 * enumeração).
 */
export const PARAMS_SEGREDO = z
  .object({ secret: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/) })
  .strict();

/** `POST /v1/public/forms/:secret/uploads` — pede o ticket de upload de um arquivo (Plan 02-11). */
export const CORPO_TICKET = z
  .object({
    /** Ausente = abre uma sessão nova; presente = mais um arquivo na mesma sessão/submissão. */
    submissionId: z.uuid().optional(),
    displayName: z.string().min(1).max(255),
    mediaType: z.enum(TIPOS_ACEITOS),
  })
  .strict();

/** `POST /v1/public/forms/:secret/submissions` — o envio em si. */
export const CORPO_SUBMISSAO = z
  .object({
    submissionId: z.uuid(),
    answers: z.record(z.string(), z.string().max(10_000)),
    attachments: z
      .array(z.object({ questionId: z.string(), objectId: z.uuid() }).strict())
      .max(MAX_ARQUIVOS_POR_ENVIO)
      .optional(),
  })
  .strict();
