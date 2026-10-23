/**
 * O anexo de verdade da Tarefa (checklist 7.3) — o mesmo envio em duas fases
 * do Formulário público (D-04, `servicos/storage-uploads.ts`), agora com a
 * sessão do Membro:
 *
 *   1. `POST /tarefas/:taskId/anexos/ticket` — confere no domínio se o Membro
 *      pode pôr um arquivo ali (anexo da Tarefa ou Campo de arquivo) e devolve
 *      um ticket assinado de escopo mínimo;
 *   2. o NAVEGADOR sobe os bytes direto ao bucket privado;
 *   3. `POST /tarefas/:taskId/anexos/confirmar` — o servidor confere o que
 *      chegou (tamanho, tipo, assinatura) e só então liga o arquivo à Tarefa
 *      (`anexarArquivoEnviado`), na mesma transação que consome a sessão.
 *
 * A sessão de envio usa o `formId` sintético `tarefa-<taskId>`: a tabela de
 * sessões exige um, e a chave do objeto nasce dele — um envio de uma conta
 * nunca é aceito como de outra. A chave fica sob `/storage/v1/object/`, o
 * único caminho que o `/lancar` do `automation/` aceita para baixar anexo.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DataState } from "@n1/dominio/state";
import { anexarArquivoEnviado, recusaDeArquivoEnviado, type DestinoDoArquivo } from "@n1/dominio/operations/anexos-enviados";
import { cutucarPonte } from "../automacoes/ponte-ativa";
import { pool } from "../persistencia/conexao";
import { recusarSuspensoNaEscrita } from "../plugins/autenticacao";
import { hidratar } from "../persistencia/repositorio";
import { consumirSessao, obterSessao, objetosDaSessao, type SessaoDeUpload } from "../persistencia/sessoes-de-upload";
import { executar } from "../persistencia/unidade-de-trabalho";
import {
  abrirSessaoDeUpload,
  confirmarObjeto,
  emitirTicket,
  TIPOS_ACEITOS,
  type MotivoDeRecusaDeConfirmacao,
} from "../servicos/storage-uploads";

/** O `formId` da sessão de envio de uma Tarefa — sem `:`, porque vira parte da chave do objeto. */
export const formIdDaTarefa = (taskId: string): string => `tarefa-${taskId}`;

const PARAMETROS = z.object({ taskId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/) }).strict();
const CAMPO = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const CORPO_DO_TICKET = z
  .object({
    nome: z.string().trim().min(1).max(200),
    mime: z.enum(TIPOS_ACEITOS),
    campoId: CAMPO.optional(),
  })
  .strict();

export const CORPO_DA_CONFIRMACAO = z
  .object({
    submissionId: z.string().min(1).max(64),
    objectId: z.string().min(1).max(64),
    campoId: CAMPO.optional(),
  })
  .strict();

const destinoDe = (campoId: string | undefined): DestinoDoArquivo => (campoId ? { tipo: "campo", definitionId: campoId } : { tipo: "anexo" });

/** Por que esta sessão de envio não serve para confirmar um arquivo desta Tarefa, ou `undefined`. */
export function recusaDaSessaoDaTarefa(sessao: SessaoDeUpload | undefined, workspaceId: string, taskId: string, agora: Date): string | undefined {
  if (!sessao) return "Envio não encontrado. Envie o arquivo de novo.";
  if (sessao.workspaceId !== workspaceId || sessao.formId !== formIdDaTarefa(taskId)) return "Este envio não pertence a esta conta.";
  if (sessao.consumedAt) return "Este envio já foi usado.";
  if (sessao.expiresAt.getTime() < agora.getTime()) return "Este envio expirou. Envie o arquivo de novo.";
  return undefined;
}

/** A recusa do servidor, em palavras de quem anexou — nunca o caminho do objeto. */
export function mensagemDaRecusaDoArquivo(motivo: MotivoDeRecusaDeConfirmacao): string {
  switch (motivo) {
    case "objeto_nao_pertence_a_sessao":
      return "Este envio não pertence a esta conta. Envie o arquivo de novo.";
    case "objeto_ausente":
      return "O arquivo não chegou ao armazenamento. Envie de novo.";
    case "tamanho_excedido":
      return "O arquivo passa de 25 MB.";
    case "tipo_nao_confere":
      return "Este tipo de arquivo não é aceito: PDF, XML, JPG, PNG ou WebP.";
    case "assinatura_nao_confere":
      return "O conteúdo do arquivo não confere com o tipo dele.";
  }
}

async function hidratarSomente(workspaceId: string): Promise<DataState> {
  const cliente = await pool().connect();
  try {
    return (await hidratar(cliente, workspaceId)).state;
  } finally {
    cliente.release();
  }
}

export async function rotasDeAnexosDaTarefa(app: FastifyInstance): Promise<void> {
  // 1.2 — o Membro suspenso não anexa nem confirma anexo.
  app.addHook("preValidation", recusarSuspensoNaEscrita);
  app.post<{ Params: { taskId: string } }>("/tarefas/:taskId/anexos/ticket", async (request, reply) => {
    const parametros = PARAMETROS.safeParse(request.params);
    const corpo = CORPO_DO_TICKET.safeParse(request.body);
    if (!parametros.success || !corpo.success) return reply.code(400).send({ ok: false, error: "Pedido de envio inválido." });
    const { taskId } = parametros.data;
    const membro = request.membro;

    const state = await hidratarSomente(membro.workspaceId);
    const recusa = recusaDeArquivoEnviado(state, membro.id, taskId, destinoDe(corpo.data.campoId));
    if (recusa) return reply.code(403).send({ ok: false, error: recusa });

    try {
      const sessao = await abrirSessaoDeUpload({ workspaceId: membro.workspaceId, formId: formIdDaTarefa(taskId) });
      const ticket = await emitirTicket({ submissionId: sessao.submissionId, displayName: corpo.data.nome, mediaType: corpo.data.mime });
      return reply.code(200).send({ ok: true, submissionId: sessao.submissionId, objectId: ticket.objectId, uploadUrl: ticket.uploadUrl });
    } catch (erro) {
      // Só o código, nunca a mensagem: ela pode citar a chave do objeto.
      const codigo = erro instanceof Error ? erro.message.split(":")[0] : "erro";
      request.log.warn({ rota: "anexos/ticket", taskId, codigo }, "Ticket de anexo recusado");
      return reply.code(400).send({ ok: false, error: "Não foi possível preparar o envio deste arquivo." });
    }
  });

  app.post<{ Params: { taskId: string } }>("/tarefas/:taskId/anexos/confirmar", async (request, reply) => {
    const parametros = PARAMETROS.safeParse(request.params);
    const corpo = CORPO_DA_CONFIRMACAO.safeParse(request.body);
    if (!parametros.success || !corpo.success) return reply.code(400).send({ ok: false, error: "Confirmação de envio inválida." });
    const { taskId } = parametros.data;
    const { submissionId, objectId, campoId } = corpo.data;
    const membro = request.membro;

    const recusaDaSessao = recusaDaSessaoDaTarefa(await obterSessao(submissionId), membro.workspaceId, taskId, new Date());
    if (recusaDaSessao) return reply.code(409).send({ ok: false, error: recusaDaSessao });
    const objeto = (await objetosDaSessao(submissionId)).find((o) => o.id === objectId);
    if (!objeto) return reply.code(409).send({ ok: false, error: mensagemDaRecusaDoArquivo("objeto_nao_pertence_a_sessao") });

    const confirmacao = await confirmarObjeto({ submissionId, objectId });
    if (!confirmacao.ok) {
      request.log.warn({ rota: "anexos/confirmar", taskId, motivo: confirmacao.motivo }, "Anexo recusado na confirmação");
      return reply.code(422).send({ ok: false, error: mensagemDaRecusaDoArquivo(confirmacao.motivo) });
    }

    let listId: string | undefined;
    let resultado: Awaited<ReturnType<typeof executar<{ readonly fileId: string }>>>;
    try {
      resultado = await executar(
        membro.workspaceId,
        (state) => {
          const r = anexarArquivoEnviado(
            state,
            membro.id,
            taskId,
            {
              nome: objeto.displayName,
              mime: objeto.mediaType,
              sizeBytes: confirmacao.sizeBytes,
              objectKey: objeto.objectKey,
              ...(confirmacao.sha256 ? { sha256: confirmacao.sha256 } : {}),
            },
            destinoDe(campoId),
          );
          if (r.ok) listId = state.tasks.find((t) => t.id === taskId)?.listId;
          return r;
        },
        {
          aoConfirmar: async (cliente) => {
            await consumirSessao(cliente, submissionId);
          },
        },
      );
    } catch (erro) {
      if (erro instanceof Error && erro.message.startsWith("sessao_")) {
        return reply.code(409).send({ ok: false, error: "Este envio já foi usado ou expirou. Envie o arquivo de novo." });
      }
      throw erro;
    }

    if ("conflito" in resultado && resultado.conflito) return reply.code(409).send(resultado);
    // D6-12 — o anexo entra na chave da ponte e vai no `/lancar`: cutuca, como `attachFile`.
    if (resultado.ok && listId) {
      try {
        cutucarPonte({ workspaceId: membro.workspaceId, listId });
      } catch (erro) {
        request.log.warn({ rota: "anexos/confirmar", causa: erro instanceof Error ? erro.message.slice(0, 200) : "erro" }, "Não consegui cutucar a ponte do Agente");
      }
    }
    return reply.code(200).send(resultado);
  });
}
