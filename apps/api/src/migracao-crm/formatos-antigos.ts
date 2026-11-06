/**
 * Os formatos do CRM antigo que o script lê, SÓ os campos que ele usa.
 *
 * Interfaces estruturais locais, de propósito: `@n1/dominio` vai apagar `Contact`, `Deal`, `Funnel`
 * e o resto na 3.5.4, e o script (com o `--verificar`) tem de continuar compilando depois disso.
 * Nada aqui importa do domínio. Tudo é leitura: o que o script grava são linhas de `registros`
 * copiadas como estão (`dados jsonb`), não objetos reconstruídos.
 */

/** A linha de `plataforma.registros` / `registros_crm_antigo` / da fixture. */
export interface RegistroAntigo {
  readonly colecao: string;
  readonly id: string;
  readonly dados: unknown;
  readonly ordem: number;
}
