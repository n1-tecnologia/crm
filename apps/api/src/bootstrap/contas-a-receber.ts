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

import { fail, ok, type DataState, type Id, type OperationResult } from "@n1/dominio";
import { evoluirConfiguracaoDeContasAReceber, type DiffDeConfiguracao } from "@n1/dominio/contas-a-receber-evolver";
import { syncIdSequence } from "@n1/dominio/operations";
import { memberActor, recordActivity } from "@n1/dominio/operations/activity";
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

/* ═══════════════ Task 2 — o prazo de R4/R5 vira parâmetro (D5-15) ═══════════════
 *
 * `aut_cr_r4`/`aut_cr_r5` disparam por `condicaoTemporal`
 * (`{ dueDateOffsetDays: N }` no `temporalPredicate` da versão PUBLICADA —
 * `runScheduledAutomations`, `packages/dominio/src/operations/automations.ts`
 * lê esse dado de registro, nunca uma constante de código). 30/60 são o valor
 * INICIAL do seed (D5-15, caso Kennedy, `seed-contas-a-receber.ts`). Mudar o
 * prazo é editar esse registro — nenhuma operação de domínio expõe "editar
 * versão publicada de Automação" ainda, então a mutação acontece aqui, dentro
 * de `executar()`, exatamente como o evolver de Status faz para Contas a
 * receber (Task 1): é edição de CONFIGURAÇÃO, não de regra (mesmo mecanismo
 * de D-07), auditada por `recordActivity` com antes/depois (T-5-34).
 */

const AUT_R4_ID: Id = "aut_cr_r4";
const AUT_R5_ID: Id = "aut_cr_r5";

export interface DiffDeAjusteDePrazo {
  readonly r4: { readonly antes: number; readonly depois: number };
  readonly r5: { readonly antes: number; readonly depois: number };
}

/** `NaN` quando o `temporalPredicate` gravado não tem `dueDateOffsetDays` numérico — estado que este comando recusa a interpretar como prazo. */
function offsetAtual(temporalPredicate: string | undefined): number {
  if (!temporalPredicate) return NaN;
  try {
    const parsed = JSON.parse(temporalPredicate) as { readonly dueDateOffsetDays?: unknown };
    return typeof parsed.dueDateOffsetDays === "number" ? parsed.dueDateOffsetDays : NaN;
  } catch {
    return NaN;
  }
}

function aplicarAjusteDePrazo(
  state: DataState,
  actingMemberId: Id,
  prazoR4: number,
  prazoR5: number,
): OperationResult<DiffDeAjusteDePrazo> {
  if (!Number.isInteger(prazoR4) || prazoR4 <= 0) return fail("O prazo de R4 é um inteiro maior que zero.");
  if (!Number.isInteger(prazoR5) || prazoR5 <= 0) return fail("O prazo de R5 é um inteiro maior que zero.");
  // O escalonamento tem que escalonar: R5 age depois de R4, nunca antes nem no mesmo dia.
  if (prazoR5 <= prazoR4) return fail(`O prazo de R5 (${prazoR5}) precisa ser maior que o de R4 (${prazoR4}) — o escalonamento tem que escalonar.`);

  const r4 = state.automations.find((a) => a.id === AUT_R4_ID);
  const r5 = state.automations.find((a) => a.id === AUT_R5_ID);
  if (!r4 || !r5) {
    return fail(`Automações "${AUT_R4_ID}"/"${AUT_R5_ID}" não encontradas — rode "contas-a-receber:configurar" (Task 1) antes.`);
  }
  const v4 = r4.versions.find((v) => v.state === "publicada");
  const v5 = r5.versions.find((v) => v.state === "publicada");
  if (!v4?.trigger || !v5?.trigger) {
    return fail(`Versão publicada de "${AUT_R4_ID}"/"${AUT_R5_ID}" sem gatilho de agenda — estado inconsistente, fora do que este comando corrige.`);
  }

  const antesR4 = offsetAtual(v4.trigger.temporalPredicate);
  const antesR5 = offsetAtual(v5.trigger.temporalPredicate);

  const ator = memberActor(actingMemberId);
  const agora = new Date().toISOString();

  v4.trigger = { ...v4.trigger, temporalPredicate: JSON.stringify({ dueDateOffsetDays: prazoR4 }) };
  v5.trigger = { ...v5.trigger, temporalPredicate: JSON.stringify({ dueDateOffsetDays: prazoR5 }) };

  recordActivity(state, { actor: ator, action: "Prazo de cobrança ajustado", objectType: "automation", objectId: r4.id, objectName: r4.name, before: String(antesR4), after: String(prazoR4), at: agora });
  recordActivity(state, { actor: ator, action: "Prazo de cobrança ajustado", objectType: "automation", objectId: r5.id, objectName: r5.name, before: String(antesR5), after: String(prazoR5), at: agora });

  return ok({ r4: { antes: antesR4, depois: prazoR4 }, r5: { antes: antesR5, depois: prazoR5 } });
}

export interface OpcoesDeAjusteDePrazo {
  readonly workspaceId: string;
  readonly actingMemberId: string;
  /** Padrão `true` no CLI — aplicar exige intenção explícita (`--apply`). */
  readonly dryRun: boolean;
  readonly prazoR4: number;
  readonly prazoR5: number;
}

export type ResultadoDoAjusteDePrazo =
  | { readonly ok: true; readonly dryRun: boolean; readonly diff: DiffDeAjusteDePrazo }
  | { readonly ok: false; readonly dryRun: boolean; readonly error: string };

export async function ajustarPrazosDeCobranca(opcoes: OpcoesDeAjusteDePrazo): Promise<ResultadoDoAjusteDePrazo> {
  const { workspaceId, actingMemberId, dryRun, prazoR4, prazoR5 } = opcoes;

  if (dryRun) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const { state } = await hidratar(cliente, workspaceId);
      syncIdSequence(state);
      const resultado = aplicarAjusteDePrazo(state, actingMemberId, prazoR4, prazoR5);
      return resultado.ok
        ? { ok: true, dryRun: true, diff: resultado.value }
        : { ok: false, dryRun: true, error: resultado.error };
    } finally {
      await cliente.query("rollback").catch(() => undefined);
      cliente.release();
    }
  }

  const resultado = await executar(workspaceId, (state) => aplicarAjusteDePrazo(state, actingMemberId, prazoR4, prazoR5));
  if ("conflito" in resultado) {
    return { ok: false, dryRun: false, error: resultado.error };
  }
  return resultado.ok
    ? { ok: true, dryRun: false, diff: resultado.value }
    : { ok: false, dryRun: false, error: resultado.error };
}
