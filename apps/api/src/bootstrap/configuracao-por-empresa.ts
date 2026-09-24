/**
 * `configurarEmpresas()` aplica `evoluirConfiguracaoPorEmpresa`
 * (`@n1/dominio`, TEN-01/D5-03) contra um Espaço de Trabalho que já rodou o
 * bootstrap da Fase 1 (`bootstrapGestao()`, `./gestao.ts`) — o evolver
 * reaplicável que acrescenta a opção "Marcos Paulo" ao Campo `Empresa` e as
 * 6 Integrações Omie por Empresa a um Espaço "Gestão" que já opera em
 * `ws_n1`.
 *
 * `dryRun` (o padrão do CLI): `executar()` (Unidade de Trabalho) não serve
 * aqui, porque devolver `fail` de propósito depois de calcular o diff
 * perderia justamente o diff que o dry-run precisa mostrar — só o `ok`
 * chega a `gravar()`. Em vez disso, hidratamos por conta própria dentro de
 * uma transação e damos `rollback` ao final, preservando o `diff` calculado
 * mesmo sem confirmar nada no banco. Mesmo molde de `./solicitacoes.ts`.
 */

import { evoluirConfiguracaoPorEmpresa, type DiffDeEmpresas } from "@n1/dominio/configuracao-por-empresa-evolver";
import { syncIdSequence } from "@n1/dominio/operations";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";

export interface OpcoesDeConfiguracaoPorEmpresa {
  readonly workspaceId: string;
  readonly actingMemberId: string;
  /** Padrão `true` no CLI — aplicar exige intenção explícita (`--apply`). */
  readonly dryRun: boolean;
}

export type ResultadoDaConfiguracaoPorEmpresa =
  | { readonly ok: true; readonly dryRun: boolean; readonly diff: DiffDeEmpresas }
  | { readonly ok: false; readonly dryRun: boolean; readonly error: string };

export async function configurarEmpresas(opcoes: OpcoesDeConfiguracaoPorEmpresa): Promise<ResultadoDaConfiguracaoPorEmpresa> {
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
      const resultado = evoluirConfiguracaoPorEmpresa(state, actingMemberId);
      return resultado.ok
        ? { ok: true, dryRun: true, diff: resultado.value }
        : { ok: false, dryRun: true, error: resultado.error };
    } finally {
      await cliente.query("rollback").catch(() => undefined);
      cliente.release();
    }
  }

  const resultado = await executar(workspaceId, (state) => evoluirConfiguracaoPorEmpresa(state, actingMemberId));
  if ("conflito" in resultado) {
    return { ok: false, dryRun: false, error: resultado.error };
  }
  return resultado.ok
    ? { ok: true, dryRun: false, diff: resultado.value }
    : { ok: false, dryRun: false, error: resultado.error };
}
