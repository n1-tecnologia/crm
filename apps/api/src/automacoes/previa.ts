/**
 * A PRÉVIA do relógio — o que o agendador visitaria e faria, Lista por Lista,
 * SEM rodar nada (10-15, checkpoints Q3 e D-04). É o que o dono lê, contra o
 * banco de produção, antes de ligar `AUTOMACOES_WORKER_ATIVO=true`: a primeira
 * volta real do expurgo ELIMINA de vez a Tarefa da lixeira acima da retenção, e
 * essa contagem tem de ser vista antes, não depois.
 *
 * SÓ LEITURA, por construção: cada Espaço de Trabalho é hidratado dentro de uma
 * transação `read only` que termina em rollback, e este arquivo não contém
 * nenhuma instrução que grave. A saída só tem contagens, nomes de Lista e nomes
 * de Membro — nunca o título ou o conteúdo de uma Tarefa (precedente T-3-04): o
 * texto colado no chat não pode vazar nome de fornecedor nem valor.
 *
 * As decisões são do domínio, não do SQL: o SQL só acha os pares CANDIDATOS
 * (o catálogo do worker mais a lixeira); regime, ator e a contagem de vencidas
 * saem de `regimeDaPrimeiraVolta`, `atorDoRelogio` e `tarefasDaLixeiraVencidas`
 * sobre o estado hidratado — a mesma regra que o expurgo usa.
 */

import type { DataState, Id } from "@n1/dominio";
import { atorDoRelogio, listaTemAgendaPorVencimento, type RegimeDaPrimeiraVolta, regimeDaPrimeiraVolta } from "@n1/dominio/operations/agenda-do-relogio";
import { tarefasDaLixeiraVencidas } from "@n1/dominio/operations/tasks";
import { resolverMembroAgenteDoPipeline } from "../persistencia/credenciais-de-servico";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { catalogoDeListasComAgenda } from "./scheduler-worker";

/** Por onde uma Lista entra no relógio. */
export type EntradaNoRelogio = "automacao" | "recorrencia" | "lixeira";

export interface LinhaDaPrevia {
  readonly workspaceId: string;
  readonly listId: string;
  readonly nomeDaLista: string;
  readonly entraPor: readonly EntradaNoRelogio[];
  readonly regime: RegimeDaPrimeiraVolta;
  /** O nome do Membro que assinaria a Atividade do relógio nesta Lista, ou `sem ator`. */
  readonly ator: string;
  /** Quantas Tarefas da lixeira a primeira volta real eliminaria nesta Lista. */
  readonly lixeiraVencida: number;
  readonly seriesPorCalendario: number;
}

/** O texto de `ator` quando `atorDoRelogio` não acha ninguém que administre a Lista (a volta fecharia `SEM_ATOR`). */
export const SEM_ATOR_NA_PREVIA = "sem ator";

interface ParCandidato {
  readonly workspaceId: string;
  readonly listId: string;
}

/**
 * Terceira fonte candidata do catálogo (D-01): as (Espaço, Lista) com ao menos
 * uma Tarefa na lixeira (`dados->>'lifecycle' = 'naLixeira'`). Candidato, não
 * decisão: se a Tarefa já passou da retenção é `tarefasDaLixeiraVencidas`, no
 * domínio, quem diz. Filtro opcional de Espaço, como o resto do catálogo.
 */
export async function candidatosDaLixeira(workspaceId?: string): Promise<ParCandidato[]> {
  const parametros: unknown[] = [];
  let filtroWorkspace = "";
  if (workspaceId !== undefined) {
    parametros.push(workspaceId);
    filtroWorkspace = `and workspace_id = $${parametros.length}`;
  }
  const resultado = await pool().query<{ workspace_id: string; list_id: string }>(
    `select distinct workspace_id, list_id
       from plataforma.registros
      where colecao = 'tasks'
        and list_id is not null
        and dados->>'lifecycle' = 'naLixeira'
        ${filtroWorkspace}`,
    parametros,
  );
  return resultado.rows.map((linha) => ({ workspaceId: linha.workspace_id, listId: linha.list_id }));
}

/** Hidrata um Espaço SÓ para ler: `begin read only` e rollback, nunca commit (T-10-38). */
async function hidratarSoParaLer(workspaceId: string): Promise<DataState> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin read only");
    try {
      return (await hidratar(cliente, workspaceId)).state;
    } finally {
      await cliente.query("rollback");
    }
  } finally {
    cliente.release();
  }
}

/** O preferido do relógio, como o worker o resolve: o Agente do pipeline; sem ele, ninguém preferido. */
async function preferidoDoEspaco(workspaceId: string): Promise<Id | undefined> {
  try {
    return (await resolverMembroAgenteDoPipeline(workspaceId)).id;
  } catch {
    return undefined;
  }
}

/** As linhas da prévia para um Espaço, sobre o estado já hidratado. */
function linhasDoEspaco(state: DataState, workspaceId: string, listIds: readonly string[], preferidoId: Id | undefined, hoje: Date): LinhaDaPrevia[] {
  const linhas: LinhaDaPrevia[] = [];
  for (const listId of listIds) {
    const lista = state.lists.find((l) => l.id === listId);
    if (!lista) continue; // a Lista já não existe no estado: sai da prévia.

    const lixeiraVencida = tarefasDaLixeiraVencidas(state, listId, hoje).length;
    const seriesPorCalendario = state.tasks.filter((t) => t.listId === listId && t.recurrence?.triggerMode === "porCalendario").length;
    const temTarefaNaLixeira = state.tasks.some((t) => t.listId === listId && t.lifecycle === "naLixeira");

    const entraPor: EntradaNoRelogio[] = [];
    if (listaTemAgendaPorVencimento(state, listId)) entraPor.push("automacao");
    if (seriesPorCalendario > 0) entraPor.push("recorrencia");
    if (temTarefaNaLixeira) entraPor.push("lixeira");

    const atorId = atorDoRelogio(state, listId, preferidoId);
    const ator = atorId === undefined ? SEM_ATOR_NA_PREVIA : (state.members.find((m) => m.id === atorId)?.displayName ?? atorId);

    linhas.push({
      workspaceId,
      listId,
      nomeDaLista: lista.name,
      entraPor,
      regime: regimeDaPrimeiraVolta(state, listId),
      ator,
      lixeiraVencida,
      seriesPorCalendario,
    });
  }
  return linhas;
}

/**
 * Por (Espaço de Trabalho, Lista) candidata: por onde entra no relógio, o
 * regime da primeira volta, quem assinaria, quantas Tarefas da lixeira ela
 * eliminaria e quantas séries por calendário tem. Não grava nada.
 */
export async function previaDaAgenda(opcoes: { readonly workspaceId?: string; readonly hoje: Date }): Promise<readonly LinhaDaPrevia[]> {
  const [doCatalogo, daLixeira] = await Promise.all([catalogoDeListasComAgenda(opcoes.workspaceId), candidatosDaLixeira(opcoes.workspaceId)]);

  const listasPorEspaco = new Map<string, Set<string>>();
  for (const par of [...doCatalogo, ...daLixeira]) {
    const listas = listasPorEspaco.get(par.workspaceId) ?? new Set<string>();
    listas.add(par.listId);
    listasPorEspaco.set(par.workspaceId, listas);
  }

  const linhas: LinhaDaPrevia[] = [];
  for (const [workspaceId, listas] of [...listasPorEspaco].sort(([a], [b]) => a.localeCompare(b))) {
    const state = await hidratarSoParaLer(workspaceId);
    const preferidoId = await preferidoDoEspaco(workspaceId);
    linhas.push(...linhasDoEspaco(state, workspaceId, [...listas], preferidoId, opcoes.hoje));
  }
  return linhas.sort((a, b) => a.workspaceId.localeCompare(b.workspaceId) || a.nomeDaLista.localeCompare(b.nomeDaLista) || a.listId.localeCompare(b.listId));
}

/** O nome de cada fonte, como a tabela do CLI a imprime. */
const ROTULO_DA_ENTRADA: Readonly<Record<EntradaNoRelogio, string>> = {
  automacao: "automação",
  recorrencia: "recorrência",
  lixeira: "lixeira",
};

/**
 * A tabela de texto da prévia: colunas fixas, sem título de Tarefa, e a soma da
 * lixeira vencida no fim. Pura — o CLI só imprime o que ela devolve.
 */
export function formatarPrevia(linhas: readonly LinhaDaPrevia[]): string {
  const cabecalho = ["Espaço de Trabalho", "Lista", "Nome", "Entra por", "Regime", "Ator", "Lixeira vencida", "Séries"];
  const corpo = linhas.map((l) => [
    l.workspaceId,
    l.listId,
    l.nomeDaLista,
    l.entraPor.map((e) => ROTULO_DA_ENTRADA[e]).join(", ") || "-",
    l.regime,
    l.ator,
    String(l.lixeiraVencida),
    String(l.seriesPorCalendario),
  ]);
  const larguras = cabecalho.map((titulo, i) => Math.max(titulo.length, ...corpo.map((linha) => (linha[i] ?? "").length)));
  const montar = (celulas: readonly string[]): string => celulas.map((c, i) => c.padEnd(larguras[i] ?? 0)).join("  ").trimEnd();
  const total = linhas.reduce((soma, l) => soma + l.lixeiraVencida, 0);
  return [
    montar(cabecalho),
    montar(larguras.map((n) => "-".repeat(n))),
    ...corpo.map(montar),
    "",
    `${linhas.length} Lista(s) candidata(s). Lixeira vencida (o que a primeira volta real eliminaria): ${total} Tarefa(s).`,
  ].join("\n");
}
