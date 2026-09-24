/**
 * `configurarContasAReceber()` aplica `evoluirConfiguracaoDeContasAReceber`
 * (`@n1/dominio`, Plan 05-10) contra um Espaço de Trabalho que já rodou o
 * bootstrap da Fase 1 (`bootstrapGestao()`, `./gestao.ts`) — cria o que a
 * conferência de 05-09 achou faltando e confere o que já está lá, sem
 * sobrescrever nada.
 *
 * `dryRun` (o padrão do CLI): `executar()` (Unidade de Trabalho) não serve
 * aqui, porque devolver `fail` de propósito depois de calcular o diff
 * perderia justamente o diff que o dry-run precisa mostrar — só o `ok`
 * chega a `gravar()`. Em vez disso, hidratamos por conta própria dentro de
 * uma transação e damos `rollback` ao final, preservando o `diff` calculado
 * mesmo sem confirmar nada no banco. Mesmo molde de `solicitacoes.ts`
 * (Plan 02-08).
 */

import { evoluirConfiguracaoDeContasAReceber, type DiffDeConfiguracao } from "@n1/dominio/contas-a-receber-evolver";
import { syncIdSequence } from "@n1/dominio/operations";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";

export interface OpcoesDeConfiguracao {
  readonly workspaceId: string;
  readonly actingMemberId: string;
  /** Padrão `true` no CLI — aplicar exige intenção explícita (`--apply`). */
  readonly dryRun: boolean;
}

export type ResultadoDaConfiguracao =
  | { readonly ok: true; readonly dryRun: boolean; readonly diff: DiffDeConfiguracao }
  | { readonly ok: false; readonly dryRun: boolean; readonly error: string };

export async function configurarContasAReceber(opcoes: OpcoesDeConfiguracao): Promise<ResultadoDaConfiguracao> {
  const { workspaceId, actingMemberId, dryRun } = opcoes;

  if (dryRun) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const { state } = await hidratar(cliente, workspaceId);
      // Mesma sincronização que `executar()` faz: `recordActivity` (dentro do
      // evolver) gera ids por contador de módulo, que precisa começar acima
      // do maior id já hidratado para não colidir com Atividade já gravada.
      syncIdSequence(state);
      const resultado = evoluirConfiguracaoDeContasAReceber(state, actingMemberId);
      return resultado.ok
        ? { ok: true, dryRun: true, diff: resultado.value }
        : { ok: false, dryRun: true, error: resultado.error };
    } finally {
      await cliente.query("rollback").catch(() => undefined);
      cliente.release();
    }
  }

  const resultado = await executar(workspaceId, (state) => evoluirConfiguracaoDeContasAReceber(state, actingMemberId));
  if ("conflito" in resultado) {
    return { ok: false, dryRun: false, error: resultado.error };
  }
  return resultado.ok
    ? { ok: true, dryRun: false, diff: resultado.value }
    : { ok: false, dryRun: false, error: resultado.error };
}
