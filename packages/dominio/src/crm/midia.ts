/**
 * A mídia que uma Mensagem aceita (Fase 16, 3.9.2, D-16-08, D-16-09): a lista de tipos, a categoria de cada um e o
 * teto de tamanho. Mora no domínio para a mesma lista valer nos dois lados: a api confere o arquivo contra ela e a
 * tela (16-11) monta o seletor de arquivo com ela, sem importar a api.
 *
 * Esta lista é SÓ da Mensagem. O Formulário público e a Tarefa têm a lista deles (`TIPOS_ACEITOS` de
 * `apps/api/src/servicos/storage-uploads.ts`: PDF, XML, JPEG, PNG e WebP) e continuam recusando áudio, vídeo, Office e
 * zip: abrir esta lista nunca alarga a deles.
 *
 * Os tipos vêm normalizados (`normalizarTipoDeMidia`): o provedor manda `audio/ogg; codecs=opus`, e o que se compara
 * e se guarda é `audio/ogg`.
 *
 * Sem I/O: só valores e funções puras. Quem confere o CONTEÚDO do arquivo (assinatura) é a api.
 */

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const TIPOS_ACEITOS_NA_MENSAGEM = [
  "application/pdf",
  "application/xml",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "video/mp4",
  "video/3gpp",
  DOCX,
  XLSX,
  PPTX,
  "text/csv",
  "text/plain",
  "application/zip",
] as const;

export type TipoDeMidiaDaMensagem = (typeof TIPOS_ACEITOS_NA_MENSAGEM)[number];

/** As categorias que um Canal declara em `sendableMediaTypes` (`Attachment["mediaType"]`) e que esta lista cobre. */
export type CategoriaDeMidia = "image" | "audio" | "video" | "document";

/** Minúsculas, sem `; parâmetros` e sem espaços: `Audio/OGG; codecs=opus` → `audio/ogg`. */
export function normalizarTipoDeMidia(mime: string): string {
  const semParametros = mime.split(";")[0] ?? "";
  return semParametros.trim().toLowerCase();
}

const ACEITOS: ReadonlySet<string> = new Set(TIPOS_ACEITOS_NA_MENSAGEM);

/**
 * A categoria do tipo: `image/*`, `audio/*` e `video/*` pelo prefixo, e todo o resto da lista é `document` (o
 * WhatsApp manda planilha e zip como documento). Um tipo fora da lista não tem categoria.
 */
export function categoriaDaMidia(mime: string): CategoriaDeMidia | undefined {
  const tipo = normalizarTipoDeMidia(mime);
  if (!ACEITOS.has(tipo)) return undefined;
  if (tipo.startsWith("image/")) return "image";
  if (tipo.startsWith("audio/")) return "audio";
  if (tipo.startsWith("video/")) return "video";
  return "document";
}

/** Os tipos da lista que um Canal envia, dado o `sendableMediaTypes` dele (por categoria). */
export function tiposAceitosParaOCanal(sendableMediaTypes: readonly string[]): readonly string[] {
  return TIPOS_ACEITOS_NA_MENSAGEM.filter((tipo) => {
    const categoria = categoriaDaMidia(tipo);
    return categoria !== undefined && sendableMediaTypes.includes(categoria);
  });
}

/** D-16-08: 16 MiB para áudio e vídeo; 25 MiB para os demais (configuráveis por variável de ambiente na api). */
export const TETO_PADRAO_DE_MIDIA_BYTES = 16 * 1024 * 1024;
export const TETO_PADRAO_DE_DOCUMENTO_BYTES = 25 * 1024 * 1024;

/** O teto de tamanho do tipo: áudio e vídeo usam `tetos.midia`; o resto, `tetos.demais`. */
export function tetoDaMidia(mime: string, tetos: { readonly midia: number; readonly demais: number }): number {
  const tipo = normalizarTipoDeMidia(mime);
  return tipo.startsWith("audio/") || tipo.startsWith("video/") ? tetos.midia : tetos.demais;
}

/**
 * Documento é tudo o que a lista aceita e não é imagem, áudio nem vídeo. Um documento (PDF, XML, Office, csv, txt, zip)
 * sai SEMPRE como anexo para baixar, nunca aberto no navegador: XML e SVG ativos executariam no domínio do bucket.
 */
export function ehDocumento(mime: string): boolean {
  return categoriaDaMidia(mime) === "document";
}
