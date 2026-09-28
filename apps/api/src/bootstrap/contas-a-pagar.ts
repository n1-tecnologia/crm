/**
 * `configurarContasAPagar()` aplica `evoluirConfiguracaoDeContasAPagar`
 * (`@n1/dominio`, plano pós-auditoria 2.1 e 1.5) contra um Espaço de Trabalho
 * que já rodou o bootstrap da Fase 1 (`bootstrapGestao()`, `./gestao.ts`): as
 * exigências novas de saída de "para pagar" (o que o Omie exige) e a A7
 * legada pausada. A regra mora toda no domínio; este módulo só hidrata, chama
 * e grava — ou desfaz.
 *
 * `dryRun` (o padrão do CLI): `executar()` (Unidade de Trabalho) não serve
 * aqui, porque devolver `fail` de propósito depois de calcular o diff
 * perderia justamente o diff que o dry-run precisa mostrar — só o `ok`
 * chega a `gravar()`. Em vez disso, hidratamos por conta própria dentro de
 * uma transação e damos `rollback` ao final, preservando o `diff` calculado
 * mesmo sem confirmar nada no banco. Mesmo molde de `./solicitacoes.ts` e
 * `./configuracao-por-empresa.ts`.
 */

import { evoluirConfiguracaoDeContasAPagar, type DiffDeContasAPagar } from "@n1/dominio/contas-a-pagar-evolver";
import { syncIdSequence } from "@n1/dominio/operations";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";

export interface OpcoesDeContasAPagar {
  readonly workspaceId: string;
  readonly actingMemberId: string;
  /** Padrão `true` no CLI — aplicar exige intenção explícita (`--apply`). */
  readonly dryRun: boolean;
}

export type ResultadoDeContasAPagar =
  | { readonly ok: true; readonly dryRun: boolean; readonly diff: DiffDeContasAPagar }
  | { readonly ok: false; readonly dryRun: boolean; readonly error: string };

/**
 * As flags do CLI, puras (o teste as prova sem banco): sem `--apply`, é
 * dry-run — um acidente de automação nunca grava sem a intenção escrita.
 * `--workspace=<id>` vence `WORKSPACE_ID`, que vence `"ws_n1"`;
 * `--membro=<id>` vence `"mem_maryane"` (a Proprietária do bootstrap).
 */
export function opcoesDaLinhaDeComando(argv: readonly string[], env: NodeJS.ProcessEnv): OpcoesDeContasAPagar {
  const valorDe = (chave: string): string | undefined => argv.find((a) => a.startsWith(`--${chave}=`))?.slice(chave.length + 3);
  return {
    workspaceId: valorDe("workspace") || env.WORKSPACE_ID || "ws_n1",
    actingMemberId: valorDe("membro") || "mem_maryane",
    dryRun: !argv.includes("--apply"),
  };
}

export async function configurarContasAPagar(opcoes: OpcoesDeContasAPagar): Promise<ResultadoDeContasAPagar> {
  const { workspaceId, actingMemberId, dryRun } = opcoes;

  if (dryRun) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const { state } = await hidratar(cliente, workspaceId);
      // Mesma sincronização que `executar()` faz: `recordActivity` (dentro
      // das operações que o evolver chama) gera ids por contador de módulo,
      // que precisa começar acima do maior id já hidratado.
      syncIdSequence(state);
      const resultado = evoluirConfiguracaoDeContasAPagar(state, actingMemberId);
      return resultado.ok
        ? { ok: true, dryRun: true, diff: resultado.value }
        : { ok: false, dryRun: true, error: resultado.error };
    } finally {
      await cliente.query("rollback").catch(() => undefined);
      cliente.release();
    }
  }

  const resultado = await executar(workspaceId, (state) => evoluirConfiguracaoDeContasAPagar(state, actingMemberId));
  if ("conflito" in resultado) {
    return { ok: false, dryRun: false, error: resultado.error };
  }
  return resultado.ok
    ? { ok: true, dryRun: false, diff: resultado.value }
    : { ok: false, dryRun: false, error: resultado.error };
}
