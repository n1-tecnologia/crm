// Esqueleto do RED: nível fixo e nenhuma máscara. A regra entra no GREEN.
export function opcoesDoLogger(_env: NodeJS.ProcessEnv = process.env, destino?: { write(linha: string): void }) {
  return {
    level: "info",
    ...(destino ? { stream: destino } : {}),
  };
}
