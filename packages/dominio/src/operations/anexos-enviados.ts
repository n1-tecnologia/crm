/**
 * O anexo de verdade da Tarefa (checklist 7.3). O arquivo já subiu ao Storage
 * e o servidor já conferiu tamanho, tipo e assinatura (`apps/api`,
 * `confirmarObjeto`): esta operação só o liga à Tarefa, como anexo ou como
 * valor de um Campo de arquivo (Anexo, Boleto, QR Code). É o caminho que leva
 * o arquivo ao `/lancar` — o `attachFile` antigo grava só nome, tipo e
 * tamanho, com a chave `legado/<id>`, e nada sobe.
 *
 * Fica FORA do despacho genérico de operações (`registro.ts`): a chave do
 * objeto vem do servidor, nunca do navegador.
 */

import { effectiveLifecycleOfTask, taskWriteRefusal } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Attachment, Id, WorkspaceFile } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { escritaDeCampo, idsDeArquivoDoValor } from "./tasks";

const now = (): string => new Date().toISOString();

/**
 * FUND-07 — um Arquivo gravado pelo `attachFile` antigo (chave `legado/<id>`)
 * nunca subiu ao Storage: não há o que baixar nem o que lançar. A ficha mostra
 * isso em vez de oferecer "Baixar", e o servidor recusa gerar URL para ele.
 */
export function arquivoSemConteudo(file: Pick<WorkspaceFile, "objectKey">): boolean {
  return file.objectKey.trim() === "" || file.objectKey.startsWith("legado/");
}

/** O mesmo teto do envio ao Storage (`UPLOAD_MAX_BYTES`, 25 MiB). */
export const TETO_DO_ARQUIVO_ENVIADO = 25 * 1024 * 1024;

export interface ArquivoEnviado {
  /** O nome que a pessoa deu ao arquivo — vai ao Omie no `IncluirAnexo`. */
  readonly nome: string;
  readonly mime: string;
  readonly sizeBytes: number;
  /** A chave do objeto no bucket privado, conferido pelo servidor. */
  readonly objectKey: string;
  readonly sha256?: string;
}

export type DestinoDoArquivo = { readonly tipo: "anexo" } | { readonly tipo: "campo"; readonly definitionId: Id };

/** A categoria de mídia a partir do MIME — a mesma regra de `submitForm`. */
function categoriaDeMidia(mime: string): Attachment["mediaType"] {
  const tipo = mime.toLocaleLowerCase("pt-BR");
  if (tipo.startsWith("image/")) return "image";
  if (tipo.startsWith("audio/")) return "audio";
  if (tipo.startsWith("video/")) return "video";
  if (tipo.includes("spreadsheet") || tipo.includes("excel") || tipo === "text/csv") return "spreadsheet";
  return "document";
}

/**
 * Por que este Membro não pode pôr um arquivo neste destino, ou `undefined`.
 * Anexo da Tarefa: quem escreve na Tarefa. Campo de arquivo: a regra do Campo
 * (inclusive a Pessoa da conta, que só preenche os Campos liberados).
 */
export function recusaDeArquivoEnviado(state: DataState, actingMemberId: Id, taskId: Id, destino: DestinoDoArquivo): string | undefined {
  if (destino.tipo === "anexo") {
    const recusa = taskWriteRefusal(state, actingMemberId, taskId);
    if (recusa) return recusa;
    if (!state.tasks.some((t) => t.id === taskId)) return "Tarefa não encontrada.";
    if (effectiveLifecycleOfTask(state, taskId) !== "ativo") return "Esta Tarefa não está ativa. Restaure-a para editá-la.";
    return undefined;
  }
  const escrita = escritaDeCampo(state, actingMemberId, taskId, destino.definitionId);
  if ("erro" in escrita) return escrita.erro;
  if (escrita.definition.type !== "file") return `O Campo “${escrita.definition.name}” não é de arquivo.`;
  return undefined;
}

export function anexarArquivoEnviado(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  arquivo: ArquivoEnviado,
  destino: DestinoDoArquivo,
): OperationResult<{ readonly fileId: Id }> {
  const recusa = recusaDeArquivoEnviado(state, actingMemberId, taskId, destino);
  if (recusa) return fail(recusa);
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return fail("Tarefa não encontrada.");

  const nome = arquivo.nome.trim();
  if (!nome) return fail("O arquivo precisa de um nome.");
  if (!Number.isFinite(arquivo.sizeBytes) || arquivo.sizeBytes <= 0) return fail("Tamanho inválido.");
  if (arquivo.sizeBytes > TETO_DO_ARQUIVO_ENVIADO) return fail("O arquivo passa de 25 MB.");
  const objectKey = arquivo.objectKey.trim();
  if (arquivoSemConteudo({ objectKey })) return fail("O arquivo não está no Storage.");

  const fileId = nextId("fil");
  const mediaType = categoriaDeMidia(arquivo.mime);
  const workspaceFile: WorkspaceFile = {
    id: fileId,
    workspaceId: state.workspace.id,
    name: nome,
    mediaType,
    sizeBytes: arquivo.sizeBytes,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    objectKey,
    ...(arquivo.sha256 ? { sha256: arquivo.sha256 } : {}),
    state: "enviado",
  };
  state.files.push(workspaceFile);

  if (destino.tipo === "anexo") {
    task.attachments.push({ fileId, order: (task.attachments.at(-1)?.order ?? -1) + 1, mediaType, displayName: nome });
    task.updatedAt = now();
    recordActivity(state, { actor: memberActor(actingMemberId), action: "Anexo adicionado", objectType: "task", objectId: task.id, objectName: task.title, after: nome });
    return ok({ fileId }, task.id);
  }

  const definition = state.fieldDefinitions.find((d) => d.id === destino.definitionId);
  const existente = task.fieldValues.find((v) => v.definitionId === destino.definitionId);
  if (existente?.state === "arquivado") return fail("Este Valor está arquivado: ele é preservado, não editado.");
  // O nome solto que o editor antigo gravava não é arquivo: sai, e fica a lista de ids.
  const ids = [...idsDeArquivoDoValor(state, existente?.value), fileId];
  if (existente) existente.value = ids;
  else task.fieldValues.push({ definitionId: destino.definitionId, value: ids, state: "ativo" });
  task.updatedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: `${definition?.name ?? "Campo"} alterado`,
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    after: nome,
  });
  return ok({ fileId }, task.id);
}
