/**
 * Importação histórica de Contas a pagar (PAG-01, D3-04).
 *
 * Esta função é irmã de `importarSolicitacaoHistorica` (`./importacao.ts`,
 * Plan 02-22) e diverge dela num ponto só — o ponto que importa. O cabeçalho
 * daquele arquivo, linhas 34-41, autoriza a composição com
 * `changeTaskStatus` com uma justificativa explícita: "o evolver do Plan
 * 02-08 não configura nenhuma Automação na Lista 'Solicitações de
 * pagamento'". A Lista de Contas a pagar tem sete Automações ativas
 * (`../seed-financeiro.ts`, seção 8) e a própria Tarefa carrega a Regra de
 * Recorrência A1. Replayar 2.861 históricos por `changeTaskStatus` faria:
 *
 * - A1 parir uma ocorrência fantasma para cada conta paga há meses (a
 *   Recorrência dispara no fechamento, B6);
 * - A5/A6 comentarem cobrança de nota fiscal em conta fechada há mais de um
 *   ano, marcando a Pessoa;
 * - A2/A3/A4 reescreverem Responsável de contas antigas;
 * - A9 adicionar Observadores retroativamente.
 *
 * Um desastre de dados, e silencioso. Por isso aqui a mudança de Status
 * nunca passa pela operação de mudar Status: o Status final é dado a
 * `createTask` na criação, com `runAutomations: false`, e o histórico é
 * escrito à mão.
 *
 * Há um segundo motivo, independente do primeiro: aquela operação não aceita
 * `at` nem `runAutomations`, então nem com as Automações desligadas
 * preservaria a data original — toda transição nasceria com o relógio da
 * importação. `recordActivity` **aceita `at`** (`./activity.ts`, linha 100:
 * `at: input.at ?? new Date().toISOString()`). É essa a costura que torna
 * D3-04 possível.
 *
 * As três obrigações literais de D3-04, e onde cada uma é cumprida:
 *
 * 1. A data de criação e a de fechamento são as originais — `createdAt` é
 *    `entrada.criadaEm` e `completedAt` é `entrada.fechadaEm` (ou o instante
 *    da última transição, quando o export traz `date_closed: null` numa
 *    Tarefa fechada); nunca o instante em que a importação rodou.
 * 2. Todo o histórico de status vira trilha — um Registro de Atividade
 *    "Status alterado" por transição do `status_history`, cada um com o `at`
 *    daquela transição. É dessa trilha, e só dela, que "tempo em 'para
 *    pagar'" é calculável depois.
 * 3. A data de vencimento vive só no campo nativo — chega por um único
 *    portador (`entrada.vencimento`), vira `task.dueDate` e nenhum Valor de
 *    Campo a duplica. Duas cópias divergiriam na primeira edição.
 *
 * NÃO é registrada em `OPERACOES` (`./registro.ts`), pela mesma razão do
 * precedente: quem importa não é um Membro usando a interface, é o CLI do
 * `apps/api` (Plan 03-10), que chama esta função diretamente. Ela sai crua
 * do barril `./index.ts`.
 *
 * NÃO faz I/O nenhum: sem rede, sem disco, sem variável de ambiente. O
 * export do ClickUp chega aqui já parseado, como dado, porque
 * `packages/dominio` não conhece ninguém (`../../CONTEXT.md`). A leitura de
 * `apps/api/exportacoes/clickup/901107637383/`, a conversão de epoch-ms para
 * ISO-8601 e o de-para de usuários (PREP-04) são do Plan 03-10.
 *
 * Uma consequência conhecida, registrada aqui para não virar surpresa: as
 * contas importadas que ficam em "para pagar" com vencimento no passado são
 * alvo legítimo de A5/A6/A7 na primeira volta do agendador (Plan 03-08).
 * Decidir se a primeira volta as ignora é assunto de 03-08/03-10 — esta
 * função não dispara nada e não tem opinião sobre isso.
 *
 * Proveniência: o catálogo de `Provenance.kind` (`../types/primitives.ts`)
 * só tem o literal em inglês `"import"`, como o Plan 02-22 já registrou.
 */

import { isTerminalCategory, statusDefinition } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { ActorRef, FieldValue, Id, Instant, Task, TaskDate } from "../types";
import { memberActor, recordActivity } from "./activity";
import { CP } from "./financeiro";
import { importActor, jaImportada } from "./importacao";
import { createTask, setTaskFieldValue } from "./tasks";

/**
 * A origem desta importação, numa fonte só para os dois lados: é o
 * `provenance.sourceName` de cada Tarefa criada aqui e o valor de
 * `plataforma.importacao_ledger.origem` que o Plan 03-10 grava (a convenção
 * registrada no rodapé da migração `005`). Não há tabela de ledger nova, e
 * não há campo `origem` na entrada — para que os dois valores não possam
 * divergir.
 */
export const ORIGEM_CONTAS_A_PAGAR = "clickup:901107637383";

/** Uma linha do `status_history` do ClickUp, já convertida pelo Plan 03-10. */
export interface TransicaoHistoricaDeStatus {
  /** O `since` daquele estado (epoch-ms no export), em ISO-8601 UTC. */
  readonly em: Instant;
  /** Status da plataforma, quando o de-para do CLI resolve. */
  readonly statusId?: Id;
  /**
   * O nome cru do ClickUp, sempre presente: `to do` e `complete` aparecem no
   * export e não têm equivalente no Conjunto de oito Status — a trilha nunca
   * perde o vocabulário de origem.
   */
  readonly nomeLegado: string;
}

/** O contrato que o Plan 03-10 preenche, linha a linha, a partir do export. */
export interface EntradaDeContaAPagarHistorica {
  readonly legacyTaskId: string;
  readonly titulo: string;
  readonly descricao?: string;
  readonly statusFinalId: Id;
  /** `date_created` — presente em todas as 2.861 Tarefas do export. */
  readonly criadaEm: Instant;
  /** `date_closed`; ausente mesmo em conta paga, por isso é opcional. */
  readonly fechadaEm?: Instant;
  /** O ÚNICO portador da data de vencimento em toda a entrada (D3-04). */
  readonly vencimento?: TaskDate;
  readonly transicoes: readonly TransicaoHistoricaDeStatus[];
  readonly campos: Readonly<Record<Id, FieldValue["value"]>>;
  readonly tags?: readonly Id[];
  readonly responsaveis?: readonly Id[];
  readonly observadores?: readonly Id[];
  readonly autoriaConhecida?: { readonly memberId: Id };
  /** Categorias levantadas pelo CLI — nunca o valor problemático (D-25). */
  readonly lacunas: readonly string[];
}

/**
 * A barreira em memória de T-3-02, delegada a `jaImportada` de
 * `./importacao.ts` em vez de reescrita: duas cópias do mesmo predicado de
 * `provenance` divergiriam na primeira mudança. É o que o Plan 03-10 chama
 * para contar "pulada" sem depender do texto da recusa.
 */
export function contaAPagarJaImportada(state: DataState, legacyTaskId: string): boolean {
  return jaImportada(state, ORIGEM_CONTAS_A_PAGAR, legacyTaskId);
}

/**
 * Importa uma Conta a pagar histórica: a Tarefa nasce já no Status final e a
 * trilha é escrita com o instante de cada transição. Ver o cabeçalho do
 * arquivo para o desenho completo.
 */
export function importarContaAPagarHistorica(
  state: DataState,
  actingMemberId: Id,
  entrada: EntradaDeContaAPagarHistorica,
): OperationResult<Task> {
  if (!entrada.legacyTaskId.trim()) return fail("O id da Tarefa legada não pode ficar vazio.");
  if (!entrada.titulo.trim()) return fail("O título da Conta a pagar importada não pode ficar vazio.");
  if (entrada.transicoes.length === 0) {
    return fail("Uma Conta a pagar importada precisa de ao menos uma transição de Status.");
  }
  if (contaAPagarJaImportada(state, entrada.legacyTaskId)) {
    return fail(`A linha "${entrada.legacyTaskId}" (${ORIGEM_CONTAS_A_PAGAR}) já foi importada.`);
  }

  // Resolver o Status final ANTES de criar: `createTask` cai no primeiro
  // `naoIniciado` quando `input.statusId` não existe no Conjunto efetivo
  // (`./tasks.ts`, linhas 126-133). Sem esta recusa (T-3-08), uma linha
  // malclassificada viraria uma conta em "para pagar" para alguém pagar de
  // novo — e ninguém notaria.
  const statusFinal = statusDefinition(state, CP.listId, entrada.statusFinalId);
  if (!statusFinal) {
    return fail(`O Status "${entrada.statusFinalId}" não existe no Conjunto efetivo da Lista de Contas a pagar.`);
  }

  // Um de-para desatualizado não pode espalhar referência pendurada por
  // 2.861 linhas: a recusa cita o id, nunca o valor de um Campo (T-3-07).
  const responsaveis = entrada.responsaveis ?? [];
  const observadores = entrada.observadores ?? [];
  const tags = entrada.tags ?? [];
  const membrosCitados = [
    ...responsaveis,
    ...observadores,
    ...(entrada.autoriaConhecida ? [entrada.autoriaConhecida.memberId] : []),
  ];
  for (const memberId of membrosCitados) {
    if (!state.members.some((m) => m.id === memberId)) return fail(`Membro "${memberId}" não encontrado.`);
  }
  for (const tagId of tags) {
    if (!state.tags.some((t) => t.id === tagId)) return fail(`Tag "${tagId}" não encontrada.`);
  }

  // No export a transição corrente vem primeiro, não em ordem cronológica
  // (ver `time-in-status/868c0qx31.json`). A cópia local é ordenada; a
  // entrada do chamador nunca é mutada.
  const transicoes = [...entrada.transicoes].sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
  const ultima = transicoes[transicoes.length - 1];

  const ator: ActorRef = entrada.autoriaConhecida
    ? memberActor(entrada.autoriaConhecida.memberId)
    : importActor(ORIGEM_CONTAS_A_PAGAR);
  const delegate = ator.kind !== "member" ? memberActor(actingMemberId) : undefined;

  // Divergência entre o Status final classificado e o que o histórico diz
  // vira Registro auditável, não recusa: parar a importação de 2.861 linhas
  // por isso seria pior que registrá-la.
  const ultimaResolvida = [...transicoes].reverse().find((t) => t.statusId !== undefined);
  const diverge = ultimaResolvida !== undefined && ultimaResolvida.statusId !== entrada.statusFinalId;
  const lacunas =
    diverge && !entrada.lacunas.includes("status_final_diverge_do_historico")
      ? [...entrada.lacunas, "status_final_diverge_do_historico"]
      : entrada.lacunas;

  // Tudo ou nada, como no precedente (`./importacao.ts`, linhas 136-146).
  const antes = {
    tasks: state.tasks.length,
    activity: state.activity.length,
    readable: state.workspace.taskReadableId.next,
  };
  const desfazer = (motivo: string, field?: Id): OperationResult<Task> => {
    state.tasks.splice(antes.tasks);
    state.activity.splice(0, state.activity.length - antes.activity);
    state.workspace.taskReadableId.next = antes.readable;
    return fail(motivo, field);
  };

  // `runAutomations: false` desliga o gatilho `tarefaCriada` (A9); o
  // `statusId` na criação é o que dispensa a operação de mudar Status e, com
  // ela, A2/A3/A4 e a Recorrência A1.
  const criada = createTask(
    state,
    actingMemberId,
    {
      listId: CP.listId,
      title: entrada.titulo,
      statusId: entrada.statusFinalId,
      taskTypeId: CP.taskTypeId,
      ...(entrada.vencimento ? { dueDate: entrada.vencimento } : {}),
      ...(responsaveis.length > 0 ? { assignees: responsaveis.map(memberActor) } : {}),
    },
    { runAutomations: false },
  );
  if (!criada.ok) return criada;
  let task = criada.value;

  for (const [definitionId, valor] of Object.entries(entrada.campos)) {
    const r = setTaskFieldValue(state, actingMemberId, task.id, definitionId as Id, valor);
    if (!r.ok) return desfazer(`Campo "${definitionId}": ${r.error}`, definitionId);
  }

  // Os Registros transitórios da criação e dos Campos foram atribuídos ao
  // operador do CLI, com o relógio de agora — o Ator resolvido e o instante
  // histórico os substituem.
  state.activity.splice(0, state.activity.length - antes.activity);

  // `createdAt`, `createdBy` e `id` são `readonly` (`RecordBase`): honrar as
  // datas originais só é possível substituindo a entrada de `state.tasks`.
  const indice = state.tasks.findIndex((t) => t.id === task.id);
  const fechamento = entrada.fechadaEm ?? ultima?.em;
  const tarefaFinal: Task = {
    ...task,
    createdAt: entrada.criadaEm,
    createdBy: ator,
    ...(delegate ? { createdByDelegate: delegate } : {}),
    provenance: {
      kind: "import",
      sourceId: entrada.legacyTaskId,
      sourceName: ORIGEM_CONTAS_A_PAGAR,
      // O único `new Date()` do arquivo, e legitimamente o instante da
      // importação: é o que a proveniência quer dizer.
      at: new Date().toISOString(),
    },
    ...(entrada.descricao !== undefined ? { description: entrada.descricao } : {}),
    tagIds: [...tags],
    observerMemberIds: [...observadores],
    // `completedAt` só existe em categoria terminal: um Status final não
    // terminal não fecha conta, mesmo com `date_closed` preenchido.
    ...(isTerminalCategory(statusFinal.category) && fechamento !== undefined ? { completedAt: fechamento } : {}),
  };
  state.tasks[indice] = tarefaFinal;
  task = tarefaFinal;

  recordActivity(state, {
    actor: ator,
    ...(delegate ? { delegate } : {}),
    action: "Tarefa importada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: ORIGEM_CONTAS_A_PAGAR,
    at: entrada.criadaEm,
  });

  let anterior: string | undefined;
  for (const transicao of transicoes) {
    const nome = (transicao.statusId ? statusDefinition(state, CP.listId, transicao.statusId)?.name : undefined) ?? transicao.nomeLegado;
    recordActivity(state, {
      actor: ator,
      ...(delegate ? { delegate } : {}),
      action: "Status alterado",
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
      ...(anterior !== undefined ? { before: anterior } : {}),
      after: nome,
      detail: transicao.nomeLegado,
      at: transicao.em,
    });
    anterior = nome;
  }

  for (const lacuna of lacunas) {
    recordActivity(state, {
      actor: ator,
      ...(delegate ? { delegate } : {}),
      action: "Lacuna de importação",
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
      detail: lacuna,
      at: entrada.criadaEm,
    });
  }

  return ok(task);
}
