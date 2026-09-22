/**
 * A FORMA de `params`/`query`/`body`/`headers` das sete rotas
 * `/v1/integrations/payment-requests/*` (`../integracao-solicitacoes.ts`) —
 * composta inteiramente a partir de `EsquemasV1`
 * (`../../contratos/v1.ts`), sem redefinir forma: mudar a forma de um método
 * aqui seria divergir do contrato, não uma opção deste arquivo.
 *
 * Diferente de `./fragmentos.ts` (a forma dos `args` das 200 operações
 * internas, validada por `POST /operacoes/:nome`), este módulo valida a
 * borda que o `automation/` chama de FORA, com credencial de serviço — ver
 * `../../contratos/CONTEXT.md`, "O que este contrato NÃO é".
 *
 * As rotas de escrita fazem a validação manualmente (`.safeParse()` dentro do
 * handler, nunca `{ schema: {...} }` do Fastify): um erro de schema aqui
 * precisa responder o envelope do §3 do contrato (`erroDoContrato`), não o
 * `{ ok:false, error }` genérico que `app.ts::setErrorHandler` devolve para
 * `hasZodFastifySchemaValidationErrors` — o mesmo motivo pelo qual
 * `rotas/operacoes.ts` valida `args` manualmente por operação.
 */

import { CabecalhosDeEscritaV1, EsquemasV1 } from "../../contratos/v1";

export const ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES = {
  getTask: {
    params: EsquemasV1.getTask.params,
  },
  listPaymentRequestTasks: {
    query: EsquemasV1.listPaymentRequestTasks.query,
  },
  getCommentReplies: {
    params: EsquemasV1.getCommentReplies.params,
    query: EsquemasV1.getCommentReplies.query,
  },
  createComment: {
    params: EsquemasV1.createComment.params,
    body: EsquemasV1.createComment.body,
    headers: CabecalhosDeEscritaV1,
  },
  addTaskTag: {
    params: EsquemasV1.addTaskTag.params,
    headers: CabecalhosDeEscritaV1,
  },
  updateTaskDueDate: {
    params: EsquemasV1.updateTaskDueDate.params,
    body: EsquemasV1.updateTaskDueDate.body,
    headers: CabecalhosDeEscritaV1,
  },
  updateTaskStatus: {
    params: EsquemasV1.updateTaskStatus.params,
    body: EsquemasV1.updateTaskStatus.body,
    headers: CabecalhosDeEscritaV1,
  },
} as const;
