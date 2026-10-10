/**
 * Auxiliares de SQL dos repositórios do CRM (Contatos, Empresas e Negócios).
 *
 * Busca textual é `ilike $n escape '\'` com o texto do usuário ESCAPADO: sem
 * isso `%` e `_` digitados na busca virariam curinga e `q = "50%"` casaria com
 * tudo (T-07-12). O texto vai sempre como parâmetro `$n`, nunca interpolado.
 */

/** A cláusula que acompanha todo `ilike` que recebe `contemTexto`. */
export const CLAUSULA_ESCAPE = "escape '\\'";

/** Escapa `\`, `%` e `_` para que valham como texto literal num `ilike ... escape '\'`. */
export function escaparIlike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}

/** `%texto%` com o texto escapado: "contém", sem curinga vindo do usuário. */
export function contemTexto(texto: string): string {
  return `%${escaparIlike(texto)}%`;
}
