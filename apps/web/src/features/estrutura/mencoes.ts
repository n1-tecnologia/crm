/**
 * Esqueleto do hook do "@" (Fase 11, D-06). A implementação vem no GREEN do
 * Plan 11-05; até lá as funções devolvem o valor neutro, para o teste falhar
 * na asserção do comportamento e não no import.
 */

export function normalizar(texto: string): string {
  return texto;
}

export function arrobaEmCurso(_texto: string, _cursor: number): { readonly inicio: number; readonly consulta: string } | null {
  return null;
}
