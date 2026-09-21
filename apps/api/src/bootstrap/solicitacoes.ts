/**
 * `configurarSolicitacoes()` aplica `evoluirConfiguracaoDeSolicitacoes`
 * (`@n1/dominio`, Plan 02-08) contra um Espaço de Trabalho que já rodou o
 * bootstrap da Fase 1 (`bootstrapGestao()`, `./gestao.ts`) — é o evolver
 * reaplicável que falta porque aquele bootstrap só grava em Espaço vazio.
 *
 * `dryRun` (o padrão do CLI): `executar()` (Unidade de Trabalho) não serve
 * aqui, porque devolver `fail` de propósito depois de calcular o diff
 * perderia justamente o diff que o dry-run precisa mostrar — só o `ok`
 * chega a `gravar()`. Em vez disso, hidratamos por conta própria dentro de
 * uma transação e damos `rollback` ao final, preservando o `diff` calculado
 * mesmo sem confirmar nada no banco.
 */

import { evoluirConfiguracaoDeSolicitacoes, type DiffDeConfiguracao } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { syncIdSequence } from "@n1/dominio/operations";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";

export interface OpcoesDeConfiguracao {
  readonly workspaceId: string;
  readonly actingMemberId: string;
  /** Padrão `true` no CLI — aplicar exige intenção explícita (`--apply`). */
  readonly dryRun: boolean;
  readonly tasksPerListMinimo?: number;
}

export type ResultadoDaConfiguracao =
  | { readonly ok: true; readonly dryRun: boolean; readonly diff: DiffDeConfiguracao }
  | { readonly ok: false; readonly dryRun: boolean; readonly error: string };

export async function configurarSolicitacoes(opcoes: OpcoesDeConfiguracao): Promise<ResultadoDaConfiguracao> {
  const { workspaceId, actingMemberId, dryRun, tasksPerListMinimo } = opcoes;

  if (dryRun) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const { state } = await hidratar(cliente, workspaceId);
      // Mesma sincronização que `executar()` faz: `recordActivity` (dentro do
      // evolver) gera ids por contador de módulo, que precisa começar acima
      // do maior id já hidratado para não colidir com Atividade já gravada.
      syncIdSequence(state);
      const resultado = evoluirConfiguracaoDeSolicitacoes(state, actingMemberId, { tasksPerListMinimo });
      return resultado.ok
        ? { ok: true, dryRun: true, diff: resultado.value }
        : { ok: false, dryRun: true, error: resultado.error };
    } finally {
      await cliente.query("rollback").catch(() => undefined);
      cliente.release();
    }
  }

  const resultado = await executar(workspaceId, (state) =>
    evoluirConfiguracaoDeSolicitacoes(state, actingMemberId, { tasksPerListMinimo }),
  );
  if ("conflito" in resultado) {
    return { ok: false, dryRun: false, error: resultado.error };
  }
  return resultado.ok
    ? { ok: true, dryRun: false, diff: resultado.value }
    : { ok: false, dryRun: false, error: resultado.error };
}
