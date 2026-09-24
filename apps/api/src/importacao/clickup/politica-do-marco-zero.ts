/**
 * A decisão pura sobre o `MARCO_ZERO` da importação de Contas a receber
 * (WR-07, `05-REVIEW.md`) — extraída de `./importar-contas-a-receber.cli.ts`
 * para que o CLI só EXECUTE, nunca decida.
 *
 * `MARCO_ZERO` (`./marco-zero.ts`) significa "a importação terminou" — é a
 * primeira das duas barreiras contra o agendador de Automações (Plan 03-08)
 * alcançar o passado importado. Duas regras, as duas fail-closed:
 *
 * 1. **A marca nunca nasce de uma importação parcial.** `rejeitadas > 0`
 *    recusa ANTES de gravar — abrir a agenda como se a importação tivesse
 *    terminado, quando na verdade parou na metade, é pior do que não abrir
 *    (a mensagem de recusa do CLI é literal sobre isso).
 * 2. **`--so-marco-zero` nunca escreve sem `--apply`.** Era o único caminho
 *    de escrita da importação que fugia do padrão dry-run-por-omissão; sem
 *    `--apply`, o ramo só CONSULTA se a marca existe e relata — nunca grava.
 *
 * `soMarcoZero`/`apply` espelham as flags do CLI (`temFlag("so-marco-zero")`,
 * `temFlag("apply")`); `rejeitadas` é a contagem do fluxo normal de
 * importação (`resultado.rejeitadas`), irrelevante quando `soMarcoZero` é
 * `true` (não há importação nova acontecendo, só a marca).
 */

export type DecisaoDoMarcoZero =
  | { readonly acao: "nenhuma" }
  | { readonly acao: "relatar" }
  | { readonly acao: "gravar" }
  | { readonly acao: "recusar"; readonly motivo: string };

export interface OpcoesDaDecisaoDoMarcoZero {
  /** `--so-marco-zero`: só a marca, sem rodar a importação. */
  readonly soMarcoZero: boolean;
  /** `--apply`: o único jeito de gravar (importação real OU `--so-marco-zero`). */
  readonly apply: boolean;
  /** `resultado.rejeitadas` do fluxo normal; ignorado quando `soMarcoZero` é `true`. */
  readonly rejeitadas?: number;
}

/**
 * Decide o que o CLI faz com o `MARCO_ZERO` — nunca grava dentro desta
 * função (pura, sem I/O); o CLI só executa a `acao` devolvida.
 */
export function decidirMarcoZero(opcoes: OpcoesDaDecisaoDoMarcoZero): DecisaoDoMarcoZero {
  const { soMarcoZero, apply, rejeitadas = 0 } = opcoes;

  // --so-marco-zero: o único caminho de escrita fora do padrão dry-run —
  // sem --apply, relata só; a importação real não está rodando aqui, então
  // "rejeitadas" não entra na decisão.
  if (soMarcoZero) {
    return apply ? { acao: "gravar" } : { acao: "relatar" };
  }

  // Fluxo normal: dry-run da importação (sem --apply) nunca toca a marca —
  // não há nada "terminado" para marcar.
  if (!apply) return { acao: "nenhuma" };

  // --apply do fluxo normal: importação parcial nunca grava a marca —
  // "terminou" e "terminou pela metade" não podem responder a mesma pergunta.
  if (rejeitadas > 0) {
    return {
      acao: "recusar",
      motivo: `${rejeitadas} linha(s) recusada(s) — importar pela metade é pior que não importar.`,
    };
  }

  return { acao: "gravar" };
}
