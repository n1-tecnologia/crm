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
import { candidatosDaLixeira, catalogoDeListasComAgenda, CODIGOS_DA_AGENDA, type LinhaAgenda } from "./scheduler-worker";

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

/**
 * A terceira fonte do catálogo (a lixeira) mora com as outras duas, em
 * `scheduler-worker.ts`: o worker não pode importar este arquivo (que já
 * importa o worker). Reexportada aqui porque é por ela que a prévia a conhece.
 */
export { candidatosDaLixeira };

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

/**
 * Uma volta do relógio por (Espaço, Lista, dia civil), como `plataforma.automacao_agenda`
 * a guarda (10-16, D-04): é o que o dono lê no dia seguinte ao ligar o agendador.
 * Só números e códigos — a tabela nunca carrega título de Tarefa (T-3-04).
 */
export interface LinhaDaAgenda {
  readonly workspaceId: string;
  readonly listId: string;
  /** O nome da Lista no `plataforma.registros`, ou `-` quando a Lista já não existe. */
  readonly nomeDaLista: string;
  readonly diaCivil: string;
  readonly estado: LinhaAgenda["estado"];
  /** `last_error_code`: o motivo do último evento não rotineiro do dia (`SEM_ATOR`, `ENSAIO_PRIMEIRA_VOLTA`…). */
  readonly codigo: string | null;
  readonly executadas: number | null;
  readonly falhadas: number | null;
  readonly puladas: number | null;
}

/** `Date` local → `"YYYY-MM-DD"`, o mesmo dia civil que o worker grava em `dia_civil`. */
function diaCivilLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * As voltas dos últimos `dias` dias civis (hoje inclusive) por Lista: estado, código,
 * contagens e o nome da Lista. SÓ LEITURA — uma transação `read only` que termina
 * em rollback. O corte é calculado em horário local, como o worker semeia os dias.
 */
export async function voltasRecentes(opcoes: { readonly workspaceId?: string; readonly dias: number; readonly hoje?: Date }): Promise<readonly LinhaDaAgenda[]> {
  const hoje = opcoes.hoje ?? new Date();
  const desde = diaCivilLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (Math.max(1, Math.floor(opcoes.dias)) - 1)));
  const parametros: unknown[] = [desde];
  let filtroWorkspace = "";
  if (opcoes.workspaceId !== undefined) {
    parametros.push(opcoes.workspaceId);
    filtroWorkspace = `and a.workspace_id = $${parametros.length}`;
  }

  const cliente = await pool().connect();
  try {
    await cliente.query("begin read only");
    try {
      const r = await cliente.query<{
        workspace_id: string;
        list_id: string;
        nome: string | null;
        dia_civil: string;
        estado: LinhaAgenda["estado"];
        last_error_code: string | null;
        executadas: number | null;
        falhadas: number | null;
        puladas: number | null;
      }>(
        `select a.workspace_id, a.list_id, l.dados->>'name' as nome,
                to_char(a.dia_civil, 'YYYY-MM-DD') as dia_civil,
                a.estado, a.last_error_code, a.executadas, a.falhadas, a.puladas
           from plataforma.automacao_agenda a
           left join plataforma.registros l
             on l.workspace_id = a.workspace_id and l.colecao = 'lists' and l.id = a.list_id
          where a.dia_civil >= $1::date ${filtroWorkspace}
          order by a.workspace_id, a.list_id, a.dia_civil`,
        parametros,
      );
      return r.rows.map((linha) => ({
        workspaceId: linha.workspace_id,
        listId: linha.list_id,
        nomeDaLista: linha.nome ?? "-",
        diaCivil: linha.dia_civil,
        estado: linha.estado,
        codigo: linha.last_error_code,
        executadas: linha.executadas,
        falhadas: linha.falhadas,
        puladas: linha.puladas,
      }));
    } finally {
      await cliente.query("rollback");
    }
  } finally {
    cliente.release();
  }
}

/**
 * A tabela de texto de `--agenda`: colunas fixas e, no fim, quantas linhas `falhou` e
 * quantas carregam `SEM_ATOR` e `RECUSA_DO_DOMINIO` (o que o dono quer ver em zero). Pura.
 */
export function formatarAgenda(linhas: readonly LinhaDaAgenda[]): string {
  const cabecalho = ["Espaço de Trabalho", "Lista", "Nome", "Dia", "Estado", "Código", "Executadas", "Falhadas", "Puladas"];
  const numero = (n: number | null): string => (n === null ? "-" : String(n));
  const corpo = linhas.map((l) => [l.workspaceId, l.listId, l.nomeDaLista, l.diaCivil, l.estado, l.codigo ?? "-", numero(l.executadas), numero(l.falhadas), numero(l.puladas)]);
  const larguras = cabecalho.map((titulo, i) => Math.max(titulo.length, ...corpo.map((linha) => (linha[i] ?? "").length)));
  const montar = (celulas: readonly string[]): string => celulas.map((c, i) => c.padEnd(larguras[i] ?? 0)).join("  ").trimEnd();
  const falhou = linhas.filter((l) => l.estado === "falhou").length;
  const semAtor = linhas.filter((l) => l.codigo === CODIGOS_DA_AGENDA.SEM_ATOR).length;
  const recusa = linhas.filter((l) => l.codigo === CODIGOS_DA_AGENDA.RECUSA_DO_DOMINIO).length;
  return [
    montar(cabecalho),
    montar(larguras.map((n) => "-".repeat(n))),
    ...corpo.map(montar),
    "",
    `${linhas.length} volta(s). ${falhou} falhou · ${semAtor} ${CODIGOS_DA_AGENDA.SEM_ATOR} · ${recusa} ${CODIGOS_DA_AGENDA.RECUSA_DO_DOMINIO}.`,
  ].join("\n");
}
