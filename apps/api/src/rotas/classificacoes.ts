/**
 * `POST /v1/integrations/payment-approvals/classifications` (Plan 02-24,
 * SOL-08) — o callback do classificador de comentário do `automation/`. É a
 * mudança de fundo do plano: o `automation/` classifica TEXTO, a plataforma
 * DECIDE. Clique e comentário convergem na MESMA operação de domínio
 * (`decideProcessApproval`, `@n1/dominio/operations/ai`) — o comentário não
 * tem um caminho de negócio paralelo (D-09).
 *
 * Registrada dentro do mesmo plugin encapsulado de `/v1/integrations`
 * (`../app.ts`), herdando `registrarAutenticacaoDeServico` — mesma
 * disciplina de `./integracao-solicitacoes.ts`: escopo `payment-requests:write`,
 * `actingMemberId` de qualquer efeito é sempre o AUTOR DO COMENTÁRIO
 * PERSISTIDO (resolvido aqui dentro, nunca um id vindo do corpo — T-02-18,
 * Spoofing) — o corpo só carrega `commentId`.
 *
 * Ordem da rota, e por que cada motivo de "sem efeito" responde `200` (é
 * política, não erro do chamador):
 *   1. `decision: "irrelevante"` — sem efeito, sem sequer hidratar o Espaço.
 *   2. Resolve o Comentário por `commentId` (só dentro da Lista "Solicitações
 *      de pagamento") — `404` se não existir.
 *   3. `dentroDaJanela` falso (D-10, `../servicos/janela-de-fallback.ts`) —
 *      `fora_da_janela`. Sem prazo configurado a análise vale sempre
 *      (checklist 3.3); só um prazo vencido (ou ilegível) a desliga.
 *   4. Resolve a `ApprovalRequest` de processo cujo `origin.threadCommentId`
 *      é o PAI do Comentário — comentário raiz (sem `parentCommentId`) ou pai
 *      que não é o tópico de roteamento vira `fora_do_topico` (RN-SP-05, o
 *      bug que o código antigo do `automation/` corrigiu e que não pode
 *      voltar).
 *   5. Resolve o autor do Comentário — precisa ser um Membro, e precisa ser
 *      o aprovador designado ou administrador/proprietário; senão,
 *      `autor_nao_autorizado`. Esta é a defesa de T-02-18: a autorização usa
 *      SEMPRE o autor já persistido do Comentário, nunca nada do corpo.
 *   6. `decideProcessApproval(..., { source: "comment" })` dentro da mesma
 *      Unidade de Trabalho que toda escrita de integração usa — publica a
 *      resposta canônica no tópico, decide, muda o Status, emite
 *      `solicitacao.aprovacao-decidida.v1`. Repetir a MESMA decisão é
 *      `aplicado: true, replay: true` sem efeito novo (a operação já é
 *      idempotente — D-09); a decisão OPOSTA depois de já decidida é `409`.
 *
 * `Idempotency-Key` é obrigatória (forma validada por
 * `./esquemas/classificacoes.ts`) e precisa ser EXATAMENTE `eventId` do
 * corpo (T-02-08) — o mesmo princípio de `webhooks-plataforma.ts` no
 * `automation/`: cabeçalho e corpo divergentes são duas requisições coladas,
 * nunca um replay legítimo.
 */

import type { ApprovalRequest, Comment, DataState, Task } from "@n1/dominio";
import { decideProcessApproval } from "@n1/dominio/operations/ai";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { erroDoContrato } from "../contratos/erros";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";
import { dentroDaJanela } from "../servicos/janela-de-fallback";
import { type Relogio, relogioDoSistema } from "../testes/relogio";
import { LISTA_SOLICITACOES_DE_PAGAMENTO_ID } from "../servicos/dto-solicitacao";
import { ESQUEMAS_DE_CLASSIFICACOES } from "./esquemas/classificacoes";

const ROTA = "POST /payment-approvals/classifications";

export interface OpcoesDeClassificacoes {
  /** Padrão: `relogioDoSistema`. Testes injetam `relogioFixo` (V02-08B). */
  readonly relogio?: Relogio;
}

function logarRota(request: FastifyRequest, status: number, motivo?: string): void {
  request.log.info({ rota: ROTA, requestId: request.id, status, ...(motivo ? { motivo } : {}) });
}

function responderSemEfeito(request: FastifyRequest, reply: FastifyReply, motivo: string): FastifyReply {
  logarRota(request, 200, motivo);
  return reply.code(200).send({ aplicado: false, motivo });
}

async function hidratarSomente(workspaceId: string): Promise<DataState> {
  const cliente = await pool().connect();
  try {
    return (await hidratar(cliente, workspaceId)).state;
  } finally {
    cliente.release();
  }
}

interface ComentarioResolvido {
  readonly task: Task;
  readonly comment: Comment;
}

/** Busca um Comentário por id, restrita à Lista "Solicitações de pagamento" (D-01) — nenhum outro Comentário do Espaço pode disparar uma decisão de aprovação. */
function resolverComentario(state: DataState, commentId: string): ComentarioResolvido | undefined {
  for (const task of state.tasks) {
    if (task.listId !== LISTA_SOLICITACOES_DE_PAGAMENTO_ID) continue;
    const comment = task.comments.find((c) => c.id === commentId && !c.deletedAt);
    if (comment) return { task, comment };
  }
  return undefined;
}

/**
 * A Solicitação de pagamento (`processStep: "pagamento"`) cujo tópico de
 * roteamento é exatamente o PAI do Comentário — nunca o próprio Comentário,
 * nunca um tópico de outra Tarefa. 06-13 (crm:CR-04): uma Conferência do
 * Resumo (`processStep: "resumo"`) NUNCA é achada aqui — sem isso, a
 * credencial de serviço do `automation/` conseguiria decidir uma Conferência
 * (e abrir caminho ao `/lancar`) mandando a classificação de uma resposta no
 * fio de uma Conta a pagar.
 */
export function resolverAprovacaoPeloTopico(state: DataState, parentCommentId: string | undefined): ApprovalRequest | undefined {
  if (!parentCommentId) return undefined;
  return state.approvals.find(
    (a) => a.origin.kind === "processTask" && a.origin.processStep === "pagamento" && a.origin.threadCommentId === parentCommentId,
  );
}

/**
 * RN-SP-05 — o aprovador designado, ou um Membro com papel base
 * administrador/proprietário. Mesmo critério de `mayDecideApproval`
 * (`@n1/dominio/operations/ai`, não exportado) para o ramo `processTask`, que
 * não tem dono extra de Execução de Agente.
 */
/**
 * A reprovação exige motivo no domínio (`decideProcessApproval`); por
 * comentário, o motivo é a própria resposta do aprovador. Sem isso, todo
 * "reprovado" classificado voltava 409.
 */
export function opcoesDaDecisaoPorComentario(
  decisao: "aprovada" | "rejeitada",
  textoDaResposta: string,
): { readonly source: "comment"; readonly reason?: string } {
  if (decisao === "aprovada") return { source: "comment" };
  return { source: "comment", reason: textoDaResposta.trim() || "Reprovado por comentário." };
}

function autorAutorizado(state: DataState, autorMemberId: string, approverMemberId: string): boolean {
  if (autorMemberId === approverMemberId) return true;
  const membro = state.members.find((m) => m.id === autorMemberId);
  if (!membro || membro.state !== "ativo") return false;
  const role = state.roles.find((r) => r.id === membro.roleId);
  return role?.base === "administrador" || role?.base === "proprietario";
}

export function rotasDeClassificacoes(app: FastifyInstance, opcoes: OpcoesDeClassificacoes = {}): void {
  const relogio = opcoes.relogio ?? relogioDoSistema;

  app.post(
    "/payment-approvals/classifications",
    { config: { escopo: "payment-requests:write" } },
    async (request, reply) => {
      const esquema = ESQUEMAS_DE_CLASSIFICACOES.postClassification;
      const headers = esquema.headers.safeParse(request.headers);
      if (!headers.success) {
        logarRota(request, 400);
        return reply.code(400).send(erroDoContrato("SCHEMA_INVALIDO", request.id));
      }
      const body = esquema.body.safeParse(request.body);
      if (!body.success) {
        logarRota(request, 400);
        return reply.code(400).send(erroDoContrato("SCHEMA_INVALIDO", request.id));
      }
      // T-02-08 — cabeçalho e `eventId` divergentes são duas requisições
      // coladas, nunca um replay legítimo do MESMO evento.
      if (headers.data["idempotency-key"] !== body.data.eventId) {
        logarRota(request, 400);
        return reply.code(400).send(erroDoContrato("SCHEMA_INVALIDO", request.id));
      }

      const { commentId, decision } = body.data;
      const servico = request.servico;

      // 1) `irrelevante` — sem efeito, sem hidratar.
      if (decision === "irrelevante") {
        return responderSemEfeito(request, reply, "irrelevante");
      }

      const estadoAtual = await hidratarSomente(servico.workspaceId);

      // 2) Comentário — 404 se não existir.
      const resolvido = resolverComentario(estadoAtual, commentId);
      if (!resolvido) {
        logarRota(request, 404);
        return reply.code(404).send(erroDoContrato("ENTIDADE_NAO_ENCONTRADA", request.id));
      }

      // 3) Prazo da análise por comentário (D-10, checklist 3.3) — sem prazo, vale; vencido, não decide.
      if (!dentroDaJanela(relogio)) {
        return responderSemEfeito(request, reply, "fora_da_janela");
      }

      // 4) O pai do Comentário precisa ser o tópico de roteamento (RN-SP-05).
      const approval = resolverAprovacaoPeloTopico(estadoAtual, resolvido.comment.parentCommentId);
      if (!approval) {
        return responderSemEfeito(request, reply, "fora_do_topico");
      }

      // 5) O autor persistido do Comentário — nunca nada do corpo (T-02-18).
      const autor = resolvido.comment.author;
      if (autor.kind !== "member" || !autorAutorizado(estadoAtual, autor.id, approval.approverMemberId)) {
        return responderSemEfeito(request, reply, "autor_nao_autorizado");
      }

      const decisaoAlvo = decision === "aprovado" ? "aprovada" : "rejeitada";
      const approvalId = approval.id;
      const autorMemberId = autor.id;
      const opcoesDaDecisao = opcoesDaDecisaoPorComentario(decisaoAlvo, resolvido.comment.content);
      let eraReplay = false;

      let estadoFinal: DataState | undefined;
      const transacao = await executar(
        servico.workspaceId,
        (state) => {
          estadoFinal = state;
          const atual = state.approvals.find((a) => a.id === approvalId);
          eraReplay = atual?.decision === decisaoAlvo;
          return decideProcessApproval(state, autorMemberId, approvalId, decisaoAlvo, opcoesDaDecisao);
        },
        {
          eventos: (valor) => {
            if (eraReplay) return [];
            if (valor.origin.kind !== "processTask") return [];
            // A mesma guarda de `operacoes.ts` (crm:CR-04): só Solicitação emite.
            if (valor.origin.processStep !== "pagamento") return [];
            return [
              {
                type: "solicitacao.aprovacao-decidida.v1",
                aggregateType: "task",
                aggregateId: valor.origin.taskId,
                payload: {
                  taskId: valor.origin.taskId,
                  approvalId: valor.id,
                  decision: decisaoAlvo,
                  source: "comment",
                  decidedByMemberId: autorMemberId,
                },
              },
            ];
          },
        },
      );

      if ("conflito" in transacao && transacao.conflito) {
        logarRota(request, 409);
        return reply.code(409).send(erroDoContrato("CONFLITO_DE_REVISAO", request.id, transacao.error));
      }
      if (!transacao.ok) {
        logarRota(request, 409);
        return reply.code(409).send(erroDoContrato("CONFLITO_DE_ORDEM", request.id, transacao.error));
      }
      void estadoFinal;

      logarRota(request, 200, eraReplay ? "replay" : "decidido");
      return reply.code(200).send({ aplicado: true, ...(eraReplay ? { replay: true } : {}) });
    },
  );
}
