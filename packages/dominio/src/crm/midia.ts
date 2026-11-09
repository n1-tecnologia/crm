/**
 * Esqueleto do RED (16-09, Task 1): as assinaturas existem para os testes
 * compilarem; os valores ainda não são os da regra.
 */

export const TIPOS_ACEITOS_NA_MENSAGEM: readonly string[] = [];

export type CategoriaDeMidia = "image" | "audio" | "video" | "document";

export function normalizarTipoDeMidia(mime: string): string {
  return mime;
}

export function categoriaDaMidia(_mime: string): CategoriaDeMidia | undefined {
  return undefined;
}

export function tiposAceitosParaOCanal(_sendableMediaTypes: readonly string[]): readonly string[] {
  return [];
}

export const TETO_PADRAO_DE_MIDIA_BYTES = 0;
export const TETO_PADRAO_DE_DOCUMENTO_BYTES = 0;

export function tetoDaMidia(_mime: string, tetos: { readonly midia: number; readonly demais: number }): number {
  return tetos.demais;
}

export function ehDocumento(_mime: string): boolean {
  return false;
}
