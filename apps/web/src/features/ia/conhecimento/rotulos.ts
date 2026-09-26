import type { TomPilula } from "@/design/basicos";
import type { Attachment, DocumentVersion, KnowledgeDocument, KnowledgeSource } from "@n1/dominio/types";
import { CONTENT_TYPE_LABEL } from "@n1/dominio/rotulos";

export { CONTENT_TYPE_LABEL };

/**
 * Rótulos e tons do Conhecimento (20), pt-BR, num lugar só: a Coleção e o
 * Documento leem daqui para um Documento "processado" ter a mesma cor e a
 * mesma palavra na lista e na ficha.
 */


/** 11.3 — o estado de processamento da Versão corrente. */
export const PROCESSING_TOM: Record<DocumentVersion["processing"], TomPilula> = {
  pendente: "aviso",
  processado: "sucesso",
  comErro: "erro",
};

/** 6.4 — de onde veio a Versão. */
export const VERSION_ORIGIN_LABEL: Record<DocumentVersion["origin"]["kind"], string> = {
  envio: "envio",
  edicao: "edição",
  atualizacao: "atualização",
  restauracao: "restauração",
};

/** 11.2 — o estado da Fonte. */
export const SOURCE_STATE_TOM: Record<KnowledgeSource["state"], TomPilula> = {
  ativo: "sucesso",
  pausado: "neutro",
  comErro: "erro",
};

/** 17.3 — as ações que uma Concessão a Agente carrega. */
export const GRANT_ACTION_LABEL: Record<"ver" | "criar" | "editar", string> = {
  ver: "ver",
  criar: "criar",
  editar: "editar",
};

/** 7.5 — a Política de atualização de uma Fonte, por extenso. */
export function politicaDeAtualizacao(policy: KnowledgeSource["updatePolicy"]): string {
  if (!policy || policy.kind === "manual") return "manual";
  const horas = policy.intervalHours ?? 0;
  return horas === 1 ? "a cada hora" : `a cada ${horas} horas`;
}

/** O tamanho de um arquivo como a pessoa lê. */
export function tamanhoDoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Só o tipo de mídia sai do navegador: o conteúdo do arquivo nunca é lido (D9). */
export function mediaTypeDoArquivo(file: File): Attachment["mediaType"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (/spreadsheet|excel|csv/.test(file.type)) return "spreadsheet";
  if (/pdf|document|text\/|presentation/.test(file.type) || /\.(pdf|docx?|txt|md)$/i.test(file.name)) return "document";
  return "other";
}

export const MEDIA_TYPE_LABEL: Record<Attachment["mediaType"], string> = {
  image: "imagem",
  audio: "áudio",
  video: "vídeo",
  document: "documento",
  spreadsheet: "planilha",
  location: "localização",
  sticker: "figurinha",
  flow: "fluxo",
  other: "outro",
};
