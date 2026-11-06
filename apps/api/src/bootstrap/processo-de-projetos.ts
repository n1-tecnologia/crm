/**
 * `configurarProcessoDeProjetos()` aplica `evoluirProcessoDeProjetos`
 * (`@n1/dominio`) contra um Espaço de Trabalho já vivo.
 *
 * `dryRun` (o padrão do CLI): `executar()` (Unidade de Trabalho) não serve aqui,
 * porque devolver `fail` de propósito depois de calcular o diff perderia o diff.
 * Hidratamos dentro de uma transação e damos `rollback` ao final. Mesmo molde de
 * `solicitacoes.ts` e `contas-a-receber.ts`.
 */

import { syncIdSequence } from "@n1/dominio/operations";
import { evoluirProcessoDeProjetos, inspecionarEspacosDoProcesso, type DiffDoProcesso, type EspacoInspecionado } from "@n1/dominio/processo-de-projetos-evolver";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";

export interface OpcoesDeConfiguracao {
  readonly workspaceId: string;
  readonly actingMemberId: string;
  /** Padrão `true` no CLI: aplicar exige intenção explícita (`--apply`). */
  readonly dryRun: boolean;
  readonly clientes?: readonly string[];
  readonly espacoExistenteId?: string;
}

export type ResultadoDaConfiguracao =
  | { readonly ok: true; readonly dryRun: boolean; readonly diff: DiffDoProcesso }
  | { readonly ok: false; readonly dryRun: boolean; readonly error: string };

export async function configurarProcessoDeProjetos(opcoes: OpcoesDeConfiguracao): Promise<ResultadoDaConfiguracao> {
  const { workspaceId, actingMemberId, dryRun, clientes, espacoExistenteId } = opcoes;
  const doProcesso = { ...(clientes ? { clientes } : {}), ...(espacoExistenteId ? { espacoExistenteId } : {}) };

  if (dryRun) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const { state } = await hidratar(cliente, workspaceId);
      // Mesma sincronização que `executar()` faz: `recordActivity` gera ids por
      // contador de módulo, que precisa começar acima do maior id já hidratado.
      syncIdSequence(state);
      const resultado = evoluirProcessoDeProjetos(state, actingMemberId, doProcesso);
      return resultado.ok
        ? { ok: true, dryRun: true, diff: resultado.value }
        : { ok: false, dryRun: true, error: resultado.error };
    } finally {
      await cliente.query("rollback").catch(() => undefined);
      cliente.release();
    }
  }

  const resultado = await executar(workspaceId, (state) => evoluirProcessoDeProjetos(state, actingMemberId, doProcesso));
  if ("conflito" in resultado) {
    return { ok: false, dryRun: false, error: resultado.error };
  }
  return resultado.ok
    ? { ok: true, dryRun: false, diff: resultado.value }
    : { ok: false, dryRun: false, error: resultado.error };
}

/** Só lê, numa transação `read only`: o banco recusa qualquer escrita aqui. */
export async function inspecionarEspacoDoProcesso(workspaceId: string): Promise<readonly EspacoInspecionado[]> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin read only");
    const { state } = await hidratar(cliente, workspaceId);
    return inspecionarEspacosDoProcesso(state);
  } finally {
    await cliente.query("rollback").catch(() => undefined);
    cliente.release();
  }
}
