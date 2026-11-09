/**
 * Casca vazia do traçador (RED do 16-15): só existe para o teste falhar na asserção do comportamento planejado,
 * e não por erro de importação. A implementação vem no commit seguinte.
 */

export interface ResultadoDaProva {
  readonly papel: string;
  readonly porta: number;
  readonly recebidoEmMs: number;
}

export async function provarTempoReal(_opcoes: { url: string; esperaMs?: number; notificar?: boolean }): Promise<ResultadoDaProva> {
  return { papel: "", porta: 0, recebidoEmMs: -1 };
}

export async function principal(_argv: readonly string[], _opcoes?: { url?: string; esperaMs?: number; notificar?: boolean; saida?: { out(t: string): void; err(t: string): void } }): Promise<number> {
  return 99;
}
