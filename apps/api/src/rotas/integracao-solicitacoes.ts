/**
 * As sete rotas `/v1/integrations/payment-requests/*` (Plan 02-13) — o lado
 * servidor dos sete métodos do adapter (`docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`
 * §6). Registradas por `rotasDeIntegracaoDeSolicitacoes(app)` DENTRO do
 * plugin encapsulado de `/v1/integrations` (`../app.ts`), herdando
 * `registrarAutenticacaoDeServico` (Plan 02-09) — cada rota declara
 * `config: { escopo }`, nunca confia em nada além da credencial resolvida.
 *
 * Diferente de `./operacoes.ts` (despacho genérico sobre `OPERACOES`, exige
 * Membro humano, sem idempotência HTTP), estas rotas:
 *   - exigem credencial de SERVIÇO (`request.servico`), nunca JWT humano;
 *   - toda escrita exige `Idempotency-Key` e passa por `comIdempotencia`
 *     (`../servicos/idempotencia.ts`) — replay com o mesmo corpo devolve a
 *     resposta gravada, sem repetir o efeito;
 *   - respondem exatamente os DTOs de `../contratos/v1.ts`, projetados por
 *     `../servicos/dto-solicitacao.ts`.
 *
 * `actingMemberId` de toda escrita é `request.servico.memberId` — o Membro
 * "Agente do pipeline" resolvido pela credencial (D-15) — nunca um id vindo
 * do corpo (T-02-12, grep de `request\.body\.(memberId|actingMemberId|actorId)`
 * no plano deve devolver zero linhas).
 *
 * Mapa de erro→HTTP: schema inválido é sempre `400 SCHEMA_INVALIDO`; Tarefa
 * ausente ou fora da Lista "Solicitações de pagamento" é `404
 * ENTIDADE_NAO_ENCONTRADA`; recusa de domínio é `422 REGRA_DE_DOMINIO`, EXCETO
 * `updateTaskStatus`, onde a recusa de `changeTaskStatus` é `409
 * CONFLITO_DE_ORDEM` (transição inválida) — a fixture canônica
 * `updateTaskStatus.erro-409.json` é normativa aqui, não a prosa do plano;
 * conflito de revisão otimista da Unidade de Trabalho (`../persistencia/unidade-de-trabalho.ts`,
 * depois de esgotar as tentativas automáticas) é `409 CONFLITO_DE_REVISAO`,
 * `retryable: true` — código acrescentado ao catálogo por este mesmo plano
 * (`../contratos/erros.ts`), ausente antes porque nenhuma rota o produzia.
 *
 * Nenhuma rota loga corpo financeiro: `request.log` recebe só
 * `{ rota, taskId, requestId, status }`.
 */

import { createHash } from "node:crypto";
import type { Comment, DataState, OperationResult, Task } from "@n1/dominio";
import { fail } from "@n1/dominio";
import { addTaskComment, changeTaskStatus, setTaskTags, updateTask } from "@n1/dominio/operations/tasks";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { type CodigoDeErroV1, erroDoContrato } from "../contratos/erros";
import { pool } from "../persistencia/conexao";
import { canonico } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";
import type { EventoDeSaida } from "../persistencia/outbox";
import { hidratar } from "../persistencia/repositorio";
import {
  ID_DO_STATUS,
  LISTA_SOLICITACOES_DE_PAGAMENTO_ID,
  paraCommentDtoV1,
  paraDtoV1,
} from "../servicos/dto-solicitacao";
import { comIdempotencia, type ResultadoDeIdempotencia } from "../servicos/idempotencia";
import { urlDeDownload } from "../servicos/storage-uploads";
import { ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES } from "./esquemas/integracao-solicitacoes";

const DEPS_DE_PROJECAO = { urlDeDownload };

const ROTA = {
  getTask: "GET /payment-requests/:taskId",
  listPaymentRequestTasks: "GET /payment-requests",
  getCommentReplies: "GET /payment-requests/comments/:commentId/replies",
  createComment: "POST /payment-requests/:taskId/comments",
  addTaskTag: "PUT /payment-requests/:taskId/tags/:tagId",
  updateTaskDueDate: "PUT /payment-requests/:taskId/due-date",
  updateTaskStatus: "PUT /payment-requests/:taskId/status",
} as const;

// ── Helpers comuns ──────────────────────────────────────────────────────────

function logarRota(request: FastifyRequest, args: { readonly rota: string; readonly taskId?: string; readonly status: number }): void {
  request.log.info({ rota: args.rota, ...(args.taskId ? { taskId: args.taskId } : {}), requestId: request.id, status: args.status });
}

function responderSchemaInvalido(request: FastifyRequest, reply: FastifyReply, rota: string, erro: z.ZodError): FastifyReply {
  request.log.warn({ rota, requestId: request.id, problemas: erro.issues }, "Entrada inválida para rota de integração");
  logarRota(request, { rota, status: 400 });
  return reply.code(400).send(erroDoContrato("SCHEMA_INVALIDO", request.id));
}

function responderNaoEncontrado(request: FastifyRequest, reply: FastifyReply, rota: string, taskId?: string): FastifyReply {
  logarRota(request, { rota, taskId, status: 404 });
  return reply.code(404).send(erroDoContrato("ENTIDADE_NAO_ENCONTRADA", request.id));
}

async function hidratarSomente(workspaceId: string): Promise<DataState> {
  const cliente = await pool().connect();
  try {
    return (await hidratar(cliente, workspaceId)).state;
  } finally {
    cliente.release();
  }
}

function tarefaDaLista(state: DataState, taskId: string): Task | undefined {
  const task = state.tasks.find((t) => t.id === taskId);
  return task && task.listId === LISTA_SOLICITACOES_DE_PAGAMENTO_ID ? task : undefined;
}

/** sha-256 do corpo canonicalizado (chaves ordenadas) — `canonico()` é a mesma serialização que `../persistencia/repositorio.ts` usa para comparar registros. */
function hashDoCorpo(corpo: unknown): string {
  return createHash("sha256").update(canonico(corpo)).digest("hex");
}

interface ResultadoDeEscrita {
  readonly status: number;
  readonly corpo: unknown;
}

/**
 * Roda `operacao` dentro de `executar()` (a Unidade de Trabalho) e traduz o
 * resultado para `{status, corpo}` do envelope do contrato — conflito de
 * revisão vira `409 CONFLITO_DE_REVISAO`; recusa de domínio vira o
 * `status`/`codigo` de `recusa` (padrão `422 REGRA_DE_DOMINIO`); sucesso
 * projeta a resposta com `paraResposta`, que recebe o `DataState` depois da
 * operação (capturado no fechamento — `operacao` roda de forma síncrona
 * dentro de `executar()`, no mesmo turno em que a referência é atribuída).
 */
async function executarEscrita<T>(args: {
  readonly workspaceId: string;
  readonly requestId: string;
  readonly operacao: (state: DataState) => OperationResult<T>;
  readonly eventos?: (valor: T, state: DataState) => readonly EventoDeSaida[];
  readonly paraResposta: (valor: T, state: DataState) => Promise<unknown>;
  readonly recusa?: { readonly status: number; readonly codigo: CodigoDeErroV1 };
}): Promise<ResultadoDeEscrita> {
  let estadoFinal: DataState | undefined;
  const transacao = await executar(
    args.workspaceId,
    (state) => {
      estadoFinal = state;
      return args.operacao(state);
    },
    args.eventos ? { eventos: args.eventos } : {},
  );

  if ("conflito" in transacao && transacao.conflito) {
    return { status: 409, corpo: erroDoContrato("CONFLITO_DE_REVISAO", args.requestId, transacao.error) };
  }
  if (!transacao.ok) {
    const recusa = args.recusa ?? { status: 422, codigo: "REGRA_DE_DOMINIO" as const };
    return { status: recusa.status, corpo: erroDoContrato(recusa.codigo, args.requestId, transacao.error) };
  }
  const corpo = await args.paraResposta(transacao.value, estadoFinal!);
  return { status: 200, corpo };
}

function responderIdempotente(request: FastifyRequest, reply: FastifyReply, rota: string, taskId: string, resultado: ResultadoDeIdempotencia<unknown>): FastifyReply {
  if (!resultado.ok) {
    if (resultado.motivo === "IDEMPOTENCY_KEY_REUSED") {
      logarRota(request, { rota, taskId, status: 409 });
      return reply.code(409).send(erroDoContrato("IDEMPOTENCY_KEY_REUSED", request.id));
    }
    logarRota(request, { rota, taskId, status: 409 });
    return reply
      .code(409)
      .header("Retry-After", String(resultado.retryAfterSegundos))
      .send(erroDoContrato("REQUEST_IN_PROGRESS", request.id));
  }
  logarRota(request, { rota, taskId, status: resultado.status });
  return reply.code(resultado.status).send(resultado.corpo);
}

// ── Cursor opaco — comum a `listPaymentRequestTasks` e `getCommentReplies` ─

interface ChaveDeCursor {
  readonly chave: string;
  readonly id: string;
}

function decodificarCursor(cursor: string | undefined): ChaveDeCursor | undefined {
  if (!cursor) return undefined;
  try {
    const texto = Buffer.from(cursor, "base64url").toString("utf8");
    const separador = texto.indexOf("|");
    if (separador <= 0) return undefined;
    return { chave: texto.slice(0, separador), id: texto.slice(separador + 1) };
  } catch {
    return undefined;
  }
}

function codificarCursor(item: ChaveDeCursor): string {
  return Buffer.from(`${item.chave}|${item.id}`, "utf8").toString("base64url");
}

/** Fatia `[limite]` itens a partir de (exclusive) `cursor`, na ordem `(chave, id)` já ordenada de `itens`. */
function paginar<T>(itens: readonly T[], chaveDe: (item: T) => ChaveDeCursor, cursor: ChaveDeCursor | undefined, limite: number): { readonly janela: readonly T[]; readonly nextCursor: string | undefined } {
  const inicio = cursor
    ? itens.findIndex((item) => {
        const k = chaveDe(item);
        return k.chave > cursor.chave || (k.chave === cursor.chave && k.id > cursor.id);
      })
    : 0;
  if (inicio === -1) return { janela: [], nextCursor: undefined };
  const janela = itens.slice(inicio, inicio + limite);
  const temProxima = itens.length > inicio + janela.length;
  const ultimo = janela[janela.length - 1];
  return { janela, nextCursor: temProxima && ultimo ? codificarCursor(chaveDe(ultimo)) : undefined };
}

export async function rotasDeIntegracaoDeSolicitacoes(app: FastifyInstance): Promise<void> {
  // ── Leituras (escopo `payment-requests:read`, sem Idempotency-Key) ───────

  app.get("/payment-requests/:taskId", { config: { escopo: "payment-requests:read" } }, async (request, reply) => {
    const params = ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES.getTask.params.safeParse(request.params);
    if (!params.success) return responderSchemaInvalido(request, reply, ROTA.getTask, params.error);

    const state = await hidratarSomente(request.servico.workspaceId);
    const task = tarefaDaLista(state, params.data.taskId);
    if (!task) return responderNaoEncontrado(request, reply, ROTA.getTask, params.data.taskId);

    const dto = await paraDtoV1(state, task, DEPS_DE_PROJECAO);
    if (!dto) return responderNaoEncontrado(request, reply, ROTA.getTask, params.data.taskId);
    logarRota(request, { rota: ROTA.getTask, taskId: task.id, status: 200 });
    return reply.code(200).send(dto);
  });

  app.get("/payment-requests", { config: { escopo: "payment-requests:read" } }, async (request, reply) => {
    const query = ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES.listPaymentRequestTasks.query.safeParse(request.query);
    if (!query.success) return responderSchemaInvalido(request, reply, ROTA.listPaymentRequestTasks, query.error);

    const state = await hidratarSomente(request.servico.workspaceId);
    const limite = query.data.limit ?? 50;
    const cursor = decodificarCursor(query.data.cursor);
    const candidatos = state.tasks
      .filter((t) => t.listId === LISTA_SOLICITACOES_DE_PAGAMENTO_ID)
      .filter((t) => !query.data.updatedAfter || t.updatedAt > query.data.updatedAfter)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
    const { janela, nextCursor } = paginar(candidatos, (t) => ({ chave: t.updatedAt, id: t.id }), cursor, limite);

    const itens = await Promise.all(janela.map((t) => paraDtoV1(state, t, DEPS_DE_PROJECAO)));
    const items = itens.filter((dto): dto is NonNullable<typeof dto> => dto !== undefined);
    logarRota(request, { rota: ROTA.listPaymentRequestTasks, status: 200 });
    return reply.code(200).send({ items, ...(nextCursor ? { nextCursor } : {}) });
  });

  app.get("/payment-requests/comments/:commentId/replies", { config: { escopo: "payment-requests:read" } }, async (request, reply) => {
    const params = ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES.getCommentReplies.params.safeParse(request.params);
    if (!params.success) return responderSchemaInvalido(request, reply, ROTA.getCommentReplies, params.error);
    const query = ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES.getCommentReplies.query.safeParse(request.query);
    if (!query.success) return responderSchemaInvalido(request, reply, ROTA.getCommentReplies, query.error);

    const state = await hidratarSomente(request.servico.workspaceId);
    let raiz: { readonly task: Task; readonly comment: Comment } | undefined;
    for (const task of state.tasks) {
      if (task.listId !== LISTA_SOLICITACOES_DE_PAGAMENTO_ID) continue;
      const comment = task.comments.find((c) => c.id === params.data.commentId);
      if (comment) {
        raiz = { task, comment };
        break;
      }
    }
    if (!raiz) return responderNaoEncontrado(request, reply, ROTA.getCommentReplies);

    const limite = query.data.limit ?? 50;
    const cursor = decodificarCursor(query.data.cursor);
    const respostas = raiz.task.comments
      .filter((c) => c.parentCommentId === params.data.commentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const { janela, nextCursor } = paginar(respostas, (c) => ({ chave: c.createdAt, id: c.id }), cursor, limite);

    const items = janela.map((c) => paraCommentDtoV1(state, raiz.task.id, c));
    logarRota(request, { rota: ROTA.getCommentReplies, status: 200 });
    return reply.code(200).send({ items, ...(nextCursor ? { nextCursor } : {}) });
  });

  // ── Escritas (escopo `payment-requests:write`, Idempotency-Key obrigatório) ─

  app.post("/payment-requests/:taskId/comments", { config: { escopo: "payment-requests:write" } }, async (request, reply) => {
    const esquema = ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES.createComment;
    const params = esquema.params.safeParse(request.params);
    if (!params.success) return responderSchemaInvalido(request, reply, ROTA.createComment, params.error);
    const headers = esquema.headers.safeParse(request.headers);
    if (!headers.success) return responderSchemaInvalido(request, reply, ROTA.createComment, headers.error);
    const body = esquema.body.safeParse(request.body);
    if (!body.success) return responderSchemaInvalido(request, reply, ROTA.createComment, body.error);

    const { taskId } = params.data;
    const servico = request.servico;

    const estadoAtual = await hidratarSomente(servico.workspaceId);
    if (!tarefaDaLista(estadoAtual, taskId)) return responderNaoEncontrado(request, reply, ROTA.createComment, taskId);

    const resultado = await comIdempotencia(
      {
        servicoId: servico.credencialId,
        rota: ROTA.createComment,
        chave: headers.data["idempotency-key"],
        requestHash: hashDoCorpo(body.data),
      },
      () =>
        executarEscrita<Comment>({
          workspaceId: servico.workspaceId,
          requestId: request.id,
          operacao: (state) => {
            const task = tarefaDaLista(state, taskId);
            if (!task) return fail("Tarefa não encontrada.");
            return addTaskComment(state, servico.memberId, taskId, {
              content: body.data.text,
              ...(body.data.parentCommentId ? { parentCommentId: body.data.parentCommentId } : {}),
              ...(body.data.mentionMemberIds
                ? { mentions: body.data.mentionMemberIds.map((id) => ({ type: "member", id })) }
                : {}),
            });
          },
          eventos: (comentario) => [
            {
              type: "solicitacao.comentario-criado.v1",
              aggregateType: "task",
              aggregateId: taskId,
              payload: {
                taskId,
                commentId: comentario.id,
                ...(comentario.parentCommentId ? { parentCommentId: comentario.parentCommentId } : {}),
                authorMemberId: servico.memberId,
              },
            },
          ],
          paraResposta: async (comentario, state) => paraCommentDtoV1(state, taskId, comentario),
        }),
    );

    return responderIdempotente(request, reply, ROTA.createComment, taskId, resultado);
  });

  app.put("/payment-requests/:taskId/tags/:tagId", { config: { escopo: "payment-requests:write" } }, async (request, reply) => {
    const esquema = ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES.addTaskTag;
    const params = esquema.params.safeParse(request.params);
    if (!params.success) return responderSchemaInvalido(request, reply, ROTA.addTaskTag, params.error);
    const headers = esquema.headers.safeParse(request.headers);
    if (!headers.success) return responderSchemaInvalido(request, reply, ROTA.addTaskTag, headers.error);

    const { taskId, tagId } = params.data;
    const servico = request.servico;

    const estadoAtual = await hidratarSomente(servico.workspaceId);
    if (!tarefaDaLista(estadoAtual, taskId)) return responderNaoEncontrado(request, reply, ROTA.addTaskTag, taskId);

    const corpoLogico = { tagId };
    const resultado = await comIdempotencia(
      {
        servicoId: servico.credencialId,
        rota: ROTA.addTaskTag,
        chave: headers.data["idempotency-key"],
        requestHash: hashDoCorpo(corpoLogico),
      },
      () =>
        executarEscrita<Task>({
          workspaceId: servico.workspaceId,
          requestId: request.id,
          operacao: (state) => {
            const task = tarefaDaLista(state, taskId);
            if (!task) return fail("Tarefa não encontrada.");
            const uniao = [...new Set([...task.tagIds, tagId])];
            return setTaskTags(state, servico.memberId, taskId, uniao);
          },
          paraResposta: async (task, state) => {
            const dto = await paraDtoV1(state, task, DEPS_DE_PROJECAO);
            return dto ?? erroDoContrato("ENTIDADE_NAO_ENCONTRADA", request.id);
          },
        }),
    );

    return responderIdempotente(request, reply, ROTA.addTaskTag, taskId, resultado);
  });

  app.put("/payment-requests/:taskId/due-date", { config: { escopo: "payment-requests:write" } }, async (request, reply) => {
    const esquema = ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES.updateTaskDueDate;
    const params = esquema.params.safeParse(request.params);
    if (!params.success) return responderSchemaInvalido(request, reply, ROTA.updateTaskDueDate, params.error);
    const headers = esquema.headers.safeParse(request.headers);
    if (!headers.success) return responderSchemaInvalido(request, reply, ROTA.updateTaskDueDate, headers.error);
    const body = esquema.body.safeParse(request.body);
    if (!body.success) return responderSchemaInvalido(request, reply, ROTA.updateTaskDueDate, body.error);

    const { taskId } = params.data;
    const servico = request.servico;

    const estadoAtual = await hidratarSomente(servico.workspaceId);
    if (!tarefaDaLista(estadoAtual, taskId)) return responderNaoEncontrado(request, reply, ROTA.updateTaskDueDate, taskId);

    const resultado = await comIdempotencia(
      {
        servicoId: servico.credencialId,
        rota: ROTA.updateTaskDueDate,
        chave: headers.data["idempotency-key"],
        requestHash: hashDoCorpo(body.data),
      },
      () =>
        executarEscrita<Task>({
          workspaceId: servico.workspaceId,
          requestId: request.id,
          operacao: (state) => {
            const task = tarefaDaLista(state, taskId);
            if (!task) return fail("Tarefa não encontrada.");
            return updateTask(state, servico.memberId, taskId, {
              dueDate: body.data.dueDate === null ? null : { form: "civilDay", value: body.data.dueDate },
            });
          },
          paraResposta: async (task, state) => {
            const dto = await paraDtoV1(state, task, DEPS_DE_PROJECAO);
            return dto ?? erroDoContrato("ENTIDADE_NAO_ENCONTRADA", request.id);
          },
        }),
    );

    return responderIdempotente(request, reply, ROTA.updateTaskDueDate, taskId, resultado);
  });

  app.put("/payment-requests/:taskId/status", { config: { escopo: "payment-requests:write" } }, async (request, reply) => {
    const esquema = ESQUEMAS_DE_INTEGRACAO_DE_SOLICITACOES.updateTaskStatus;
    const params = esquema.params.safeParse(request.params);
    if (!params.success) return responderSchemaInvalido(request, reply, ROTA.updateTaskStatus, params.error);
    const headers = esquema.headers.safeParse(request.headers);
    if (!headers.success) return responderSchemaInvalido(request, reply, ROTA.updateTaskStatus, headers.error);
    const body = esquema.body.safeParse(request.body);
    if (!body.success) return responderSchemaInvalido(request, reply, ROTA.updateTaskStatus, body.error);

    const { taskId } = params.data;
    const servico = request.servico;

    const estadoAtual = await hidratarSomente(servico.workspaceId);
    if (!tarefaDaLista(estadoAtual, taskId)) return responderNaoEncontrado(request, reply, ROTA.updateTaskStatus, taskId);

    const resultado = await comIdempotencia(
      {
        servicoId: servico.credencialId,
        rota: ROTA.updateTaskStatus,
        chave: headers.data["idempotency-key"],
        requestHash: hashDoCorpo(body.data),
      },
      () =>
        executarEscrita<Task>({
          workspaceId: servico.workspaceId,
          requestId: request.id,
          operacao: (state) => {
            const task = tarefaDaLista(state, taskId);
            if (!task) return fail("Tarefa não encontrada.");
            // `reason` (opcional) não tem onde ser gravado hoje: `changeTaskStatus`
            // não aceita motivo, e não há Campo dedicado no catálogo (mesma lacuna
            // de `manualReason`, `../servicos/dto-solicitacao.ts`). Aceito e
            // validado pelo schema, mas sem efeito de domínio nesta rodada —
            // ver SUMMARY do Plan 02-13, "Known Limitations".
            return changeTaskStatus(state, servico.memberId, taskId, ID_DO_STATUS[body.data.status]);
          },
          // `changeTaskStatus.erro-409.json` é a fixture canônica: recusa de
          // domínio aqui é transição inválida (§3 do contrato,
          // `CONFLITO_DE_ORDEM`), não `REGRA_DE_DOMINIO` — diferente das
          // outras três escritas.
          recusa: { status: 409, codigo: "CONFLITO_DE_ORDEM" },
          paraResposta: async (task, state) => {
            const dto = await paraDtoV1(state, task, DEPS_DE_PROJECAO);
            return dto ?? erroDoContrato("ENTIDADE_NAO_ENCONTRADA", request.id);
          },
        }),
    );

    return responderIdempotente(request, reply, ROTA.updateTaskStatus, taskId, resultado);
  });
}
