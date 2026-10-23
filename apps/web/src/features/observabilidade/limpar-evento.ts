// Esqueleto do RED (09-16): as funções existem e nada limpam ainda.
export function limparEvento<T extends object>(evento: T): T {
  return evento;
}

export function limparMigalha<T extends object>(migalha: T): T {
  return migalha;
}

export function opcoesDoSentryNaWeb(_dsn: string | undefined): Record<string, unknown> {
  return {};
}
