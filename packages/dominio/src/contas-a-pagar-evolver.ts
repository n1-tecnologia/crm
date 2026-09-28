/**
 * Evolver idempotente de "Contas a pagar" (plano pós-auditoria,
 * `docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md`, 2.1 e
 * 1.5): leva a um Espaço já em produção (`ws_n1`) as duas mudanças de
 * configuração que o seed não alcança — `bootstrapGestao()` só grava em Espaço
 * vazio, e editar `seed-financeiro.ts` não muda o que já está gravado.
 *
 *   1. **As exigências novas de saída de "para pagar"** — Categoria de
 *      pagamento, Fornecedor, o documento do tipo escolhido e Nome do
 *      fornecedor, o que o Omie exige para achar ou cadastrar o fornecedor
 *      (2.1). A lista esperada é a do catálogo (`buildGestaoBootstrap()`, o
 *      mesmo `DataState` de produção), nunca uma cópia digitada aqui.
 *   2. **A A7 pausada** — "A7 · D-1: lançar no Omie pelo Agente" saiu do seed
 *      (1.5); em `ws_n1` ela continua gravada e, ativa, registraria "falhou" na
 *      véspera do vencimento de toda conta em "para pagar".
 *
 * As duas passam pelas operações de domínio de sempre — `updateStatus`
 * (`operations/configuration.ts`) e `pausarAutomacao`
 * (`operations/ia/automacoes-editor.ts`) —, com a permissão e o Registro de
 * Atividade que a tela teria. Nenhuma gravação direta no estado.
 *
 * Regras duras, as do molde (`solicitacao-de-pagamento-evolver.ts`,
 * `contas-a-receber-evolver.ts`):
 *   - NUNCA remove nem reescreve o que alguém configurou: a lista atual de
 *     requisitos precisa ser um SUBCONJUNTO da esperada — o evolver só
 *     acrescenta o que falta. Um requisito a mais (que o catálogo não prevê)
 *     ou um Status "para pagar" renomeado é divergência reportada, e NADA é
 *     gravado.
 *   - NUNCA toca `state.tasks`: exigir um Campo novo não preenche Campo de
 *     conta nenhuma. As contas já em "para pagar" sem os dados novos só não
 *     saem de lá até alguém completá-las — que é o ponto.
 *   - Reaplicar é no-op: a segunda execução devolve `ok` sem acrescentar nem
 *     pausar nada.
 */

import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { updateStatus } from "./operations/configuration";
import { CP, INVOCADOR_DO_LANCAMENTO } from "./operations/financeiro";
import { pausarAutomacao } from "./operations/ia/automacoes-editor";
import type { DivergenciaDeConfiguracao } from "./solicitacao-de-pagamento-evolver";
import { fail, ok, type DataState, type OperationResult } from "./state";
import type { FieldRequirement, Id } from "./types";

/** Reexportado do molde (mesmo tipo, sem gêmeo) — `apps/api` importa daqui. */
export type { DivergenciaDeConfiguracao };

/**
 * A A7 legada — o mesmo id que `INVOCADOR_DO_LANCAMENTO` guarda, de propósito
 * (ver o comentário daquela constante em `operations/financeiro.ts`).
 */
export const A7_LEGADA: Id = INVOCADOR_DO_LANCAMENTO;

export interface DiffDeContasAPagar {
  /** Requisitos acrescentados à saída de "para pagar", descritos (`fd_cp_categoria`, `fd_cp_cpf quando fd_cp_fornecedor = CPF`…). */
  readonly exigenciasAcrescentadas: string[];
  /** Automações pausadas nesta execução (só a A7 legada, quando ativa). */
  readonly automacoesPausadas: string[];
  readonly conferidos: string[];
  readonly divergentes: DivergenciaDeConfiguracao[];
}

/**
 * Serialização canônica (chaves em ordem alfabética) — cópia deliberada de
 * `contas-a-receber-evolver.ts::canonico`, pela mesma razão de lá: a função
 * não é exportada daquele arquivo, e duas cópias de UMA linha pura são mais
 * baratas que um módulo a mais só para ela.
 */
function canonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  const partes: string[] = [];
  for (const chave of Object.keys(valor as object).sort()) {
    const v = (valor as Record<string, unknown>)[chave];
    if (v === undefined) continue;
    partes.push(`${JSON.stringify(chave)}:${canonico(v)}`);
  }
  return `{${partes.join(",")}}`;
}

/** Um requisito em palavras de id — o que o CLI imprime. Nunca valor de Campo de Tarefa. */
function descrever(req: FieldRequirement): string {
  const alvo = req.definitionId ?? req.attribute ?? "?";
  return req.whenDefinitionId ? `${alvo} quando ${req.whenDefinitionId} = ${req.whenValue ?? ""}` : alvo;
}

function formatarDivergencias(divergentes: readonly DivergenciaDeConfiguracao[]): string {
  const linhas = divergentes.map((d) => `${d.id}.${d.campo}: esperado "${d.esperado}", encontrado "${d.encontrado}"`);
  return `Configuração da Lista "Contas a pagar" diverge do catálogo — nada foi sobrescrito:\n${linhas.join("\n")}`;
}

/**
 * Ordem:
 *   1. localizar a Lista e o Status "para pagar" (recusa se ausentes);
 *   2. comparar os requisitos de saída com os do catálogo: sobra ou Status
 *      renomeado → divergência, `fail`, nada gravado;
 *   3. se falta algum, `updateStatus` com a lista do catálogo (os atuais
 *      inclusos, na ordem do catálogo);
 *   4. se a A7 legada existe e está ativa, `pausarAutomacao`.
 * Qualquer recusa das operações também é `fail` — e a Unidade de Trabalho
 * desfaz o passo 3 se o 4 recusar: tudo ou nada.
 */
export function evoluirConfiguracaoDeContasAPagar(state: DataState, actingMemberId: Id): OperationResult<DiffDeContasAPagar> {
  const lista = state.lists.find((l) => l.id === CP.listId);
  if (!lista) {
    return fail(`Lista "Contas a pagar" (${CP.listId}) não existe — rode o bootstrap da Fase 1 (bootstrapGestao) antes de evoluir esta configuração.`);
  }
  const paraPagar = lista.statusSet?.definitions.find((d) => d.id === CP.status.paraPagar);
  if (!paraPagar) {
    return fail(`O Status "para pagar" (${CP.status.paraPagar}) não existe no Conjunto próprio da Lista "Contas a pagar" — estado fora do que este evolver corrige.`);
  }

  const catalogo = buildGestaoBootstrap({ workspaceId: state.workspace.id });
  const paraPagarCatalogo = catalogo.lists.find((l) => l.id === CP.listId)?.statusSet?.definitions.find((d) => d.id === CP.status.paraPagar);
  if (!paraPagarCatalogo) {
    throw new Error(`Status "${CP.status.paraPagar}" ausente do catálogo — bug no seed, não no evolver.`);
  }

  const exigenciasAcrescentadas: string[] = [];
  const automacoesPausadas: string[] = [];
  const conferidos: string[] = [];
  const divergentes: DivergenciaDeConfiguracao[] = [];

  /* ── 2. Requisitos de saída: o atual precisa caber no esperado ──────────── */
  if (paraPagar.name !== paraPagarCatalogo.name) {
    divergentes.push({ id: paraPagar.id, campo: "name", esperado: paraPagarCatalogo.name, encontrado: paraPagar.name });
  }
  const esperados = paraPagarCatalogo.exitRequirements ?? [];
  const atuais = paraPagar.exitRequirements ?? [];
  const chavesEsperadas = new Set(esperados.map(canonico));
  const chavesAtuais = new Set(atuais.map(canonico));
  for (const atual of atuais) {
    if (!chavesEsperadas.has(canonico(atual))) {
      divergentes.push({
        id: paraPagar.id,
        campo: "exitRequirements",
        esperado: "ausente do catálogo",
        encontrado: `requisito ${descrever(atual)} presente mas não previsto no catálogo`,
      });
    }
  }
  const faltando = esperados.filter((req) => !chavesAtuais.has(canonico(req)));

  const a7 = state.automations.find((a) => a.id === A7_LEGADA);
  if (a7 && (a7.scopeType !== "list" || a7.scopeId !== CP.listId)) {
    // O id é o da A7, mas não é ela — pausar o que não se reconhece seria pior que parar.
    divergentes.push({ id: a7.id, campo: "scopeId", esperado: CP.listId, encontrado: a7.scopeId });
  }

  if (divergentes.length > 0) return fail(formatarDivergencias(divergentes));

  /* ── 3. Acrescentar o que falta, pela operação de configuração ─────────── */
  if (faltando.length > 0) {
    const atualizado = updateStatus(state, actingMemberId, "list", CP.listId, CP.status.paraPagar, { exitRequirements: esperados });
    if (!atualizado.ok) return fail(`Não consegui gravar as exigências de saída de "para pagar": ${atualizado.error}`);
    exigenciasAcrescentadas.push(...faltando.map(descrever));
  } else {
    conferidos.push(`${paraPagar.id}.exitRequirements`);
  }

  /* ── 4. Pausar a A7 legada, se ainda estiver ativa ─────────────────────── */
  if (a7?.lifecycle === "ativo") {
    const pausada = pausarAutomacao(state, actingMemberId, a7.id);
    if (!pausada.ok) return fail(`Não consegui pausar a A7 (${a7.id}): ${pausada.error}`);
    automacoesPausadas.push(a7.id);
  } else {
    conferidos.push(`${A7_LEGADA}:${a7 ? a7.lifecycle : "ausente"}`);
  }

  return ok({ exigenciasAcrescentadas, automacoesPausadas, conferidos, divergentes });
}
