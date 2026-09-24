/**
 * Importação histórica de Contas a receber (REC-01, D5-11/05-11).
 *
 * Irmã de `importarContaAPagarHistorica` (`./importacao-contas-a-pagar.ts`,
 * Plan 03-09) — o mesmo desenho, adaptado a UMA Lista que hoje tem seis
 * Automações ativas e o relógio ligado (05-10). Replayar as 240 Tarefas
 * históricas de `901107648977` pela operação de mudar Status faria:
 *
 * - R2 mover contas já fechadas de volta para `pendente` (D+1 do vencimento
 *   sem recebimento) e aplicar a Tag/Campo "em cobrança" sobre contas quitadas
 *   há mais de um ano;
 * - R2b marcar a Situação de cobrança como "em cobrança" pelo mesmo motivo;
 * - R3 reescrever a Data de pagamento com o relógio da importação, por cima
 *   da data real que o histórico carrega;
 * - R4/R5 comentarem cobrança com Menção ao Comercial e à Diretoria sobre
 *   parcelas de 2025 já recebidas ou já descartadas.
 *
 * Por isso aqui, como lá, a mudança de Status nunca passa pela operação de
 * mudar Status: o Status final é dado a `createTask` na criação, com
 * `runAutomations: false`, e o histórico é escrito à mão com `recordActivity`,
 * que aceita `at` — a costura que preserva a data original sem acordar
 * nenhuma das seis Automações.
 *
 * Duas coisas próprias desta Lista, que o irmão de Contas a pagar não tem:
 *
 * 1. **Vínculo ao cliente (D5-12).** O cliente é um Contato ou uma Empresa do
 *    CRM — nunca a Lista "Gestão de clientes" do ClickUp (`901109161381`,
 *    NÃO recriada). Quando o mapeador (Plan 05-11 Task 2) resolve o nome
 *    contra o CRM, `entrada.clienteRef` chega com o tipo e o id já resolvidos;
 *    esta operação só valida que o alvo existe e cria o Vínculo
 *    (`CR.linkRole`, o mesmo papel que `createReceivableSeries` usa em
 *    `./financeiro.ts`). Quando `clienteRef` não vier — RN-CR-02 diz que duas
 *    das 240 não têm cliente (Romero Albuquerque) — NADA é inventado: a
 *    lacuna `"sem-cliente"` entra na trilha e a importação segue.
 * 2. **Data de pagamento (D5-16/CR-06).** A precedência (Campo "Data de
 *    pagamento" do ClickUp sobre `date_closed`) é decisão do MAPEADOR — esta
 *    operação só grava o que recebeu em `entrada.dataPagamento`, sem
 *    fallback próprio, para que a regra more num lugar só. O Campo da
 *    plataforma (`CR.fields.dataPagamento`) é do tipo `date` (dia civil); o
 *    mapeador já entrega o dia civil RESOLVIDO em `America/Sao_Paulo`
 *    (`instanteDaDataDePagamento` + `comoDiaCivil`, `apps/api/.../contas-a-receber.ts`)
 *    — esta operação só valida o formato `AAAA-MM-DD` e grava sem cortar.
 *    Antes desta correção (CR-06), o valor chegava como `Instant` UTC e esta
 *    operação cortava só os dez primeiros caracteres do texto — um
 *    fechamento entre 21:00 e 23:59 de Brasília cai no dia seguinte em UTC, e
 *    o Campo recebia D+1. Cortar em UTC nunca é o dia civil certo para um
 *    Espaço de Trabalho em São Paulo — por isso o corte não mora mais aqui.
 *
 * NÃO é registrada em `OPERACOES` (`./registro.ts`) — mesmo motivo do
 * precedente: quem importa é o CLI do `apps/api` (Plan 05-11 Task 3), nunca
 * um Membro pela interface. Sai crua do barril `./index.ts`.
 *
 * NÃO faz I/O: sem rede, sem disco, sem variável de ambiente. O export do
 * ClickUp chega já parseado e traduzido pelo mapeador de `apps/api`
 * (`../../CONTEXT.md` — o domínio não conhece ninguém).
 */

import { isTerminalCategory, statusDefinition } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { ActorRef, CivilDate, FieldValue, Id, Instant, Task, TaskDate } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { CP, CR } from "./financeiro";
import { importActor, jaImportada } from "./importacao";
import { createTask, setTaskFieldValue } from "./tasks";

/**
 * A origem desta importação — o `provenance.sourceName` de cada Tarefa
 * criada aqui e o `plataforma.importacao_ledger.origem` que o Plan 05-11
 * grava. Mesma convenção do irmão de Contas a pagar (não há campo `origem`
 * na entrada, de propósito: os dois valores não podem divergir).
 */
export const ORIGEM_CONTAS_A_RECEBER = "clickup:901107648977";

/** Uma linha do `status_history` do ClickUp, já convertida pelo Plan 05-11. */
export interface TransicaoHistoricaDeStatusCR {
  /** O `since` daquele estado (epoch-ms no export), em ISO-8601 UTC. */
  readonly em: Instant;
  /** Status da plataforma, quando o de-para do CLI resolve. */
  readonly statusId?: Id;
  /** O nome cru do ClickUp, sempre presente — a trilha nunca perde o vocabulário de origem. */
  readonly nomeLegado: string;
}

/** O contrato que o Plan 05-11 preenche, linha a linha, a partir do export. */
export interface EntradaDeContaAReceberHistorica {
  readonly legacyTaskId: string;
  readonly titulo: string;
  readonly descricao?: string;
  readonly statusFinalId: Id;
  readonly criadaEm: Instant;
  /** `date_closed`; ausente em conta ainda aberta, por isso é opcional. */
  readonly fechadaEm?: Instant;
  /** O único portador da data de vencimento nativa (mesma disciplina do irmão). */
  readonly vencimento?: TaskDate;
  readonly transicoes: readonly TransicaoHistoricaDeStatusCR[];
  readonly campos: Readonly<Record<Id, FieldValue["value"]>>;
  readonly tags?: readonly Id[];
  readonly responsaveis?: readonly Id[];
  readonly observadores?: readonly Id[];
  readonly autoriaConhecida?: { readonly memberId: Id };
  /** Categorias levantadas pelo mapeador — nunca o valor problemático (D-25). */
  readonly lacunas: readonly string[];
  /** D5-12 — o cliente já resolvido contra o CRM (Contato ou Empresa); ausente vira lacuna "sem-cliente", nunca dado inventado. */
  readonly clienteRef?: { readonly tipo: "contact" | "company"; readonly id: Id };
  /**
   * D5-16/CR-06 — a precedência (Campo "Data de pagamento" sobre
   * `date_closed`) é decisão do mapeador; ver o cabeçalho do arquivo. Já
   * chega como `CivilDate` (`AAAA-MM-DD`), resolvido em `America/Sao_Paulo`
   * pelo mapeador — esta operação nunca corta um `Instant`.
   */
  readonly dataPagamento?: CivilDate;
}

/**
 * A barreira em memória de T-3-02 (mesma de 03-09), delegada a `jaImportada`
 * em vez de reescrita.
 */
export function contaAReceberJaImportada(state: DataState, legacyTaskId: string): boolean {
  return jaImportada(state, ORIGEM_CONTAS_A_RECEBER, legacyTaskId);
}

/** `AAAA-MM-DD` — ver item 2 do cabeçalho: o dia civil chega resolvido pelo mapeador, nunca cortado aqui. */
const FORMATO_DE_DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Importa uma Conta a receber histórica: a Tarefa nasce já no Status final e
 * a trilha é escrita com o instante de cada transição. Ver o cabeçalho do
 * arquivo para o desenho completo.
 */
export function importarContaAReceberHistorica(
  state: DataState,
  actingMemberId: Id,
  entrada: EntradaDeContaAReceberHistorica,
): OperationResult<Task> {
  if (!entrada.legacyTaskId.trim()) return fail("O id da Tarefa legada não pode ficar vazio.");
  if (!entrada.titulo.trim()) return fail("O título da Conta a receber importada não pode ficar vazio.");
  if (entrada.transicoes.length === 0) {
    return fail("Uma Conta a receber importada precisa de ao menos uma transição de Status.");
  }
  if (contaAReceberJaImportada(state, entrada.legacyTaskId)) {
    return fail(`A linha "${entrada.legacyTaskId}" (${ORIGEM_CONTAS_A_RECEBER}) já foi importada.`);
  }

  // Resolver o Status final ANTES de criar (mesma razão de T-3-08 no irmão):
  // `createTask` cai no primeiro `naoIniciado` quando `input.statusId` não
  // existe no Conjunto efetivo — sem esta recusa, uma linha malclassificada
  // viraria uma conta "para receber" que ninguém notaria.
  const statusFinal = statusDefinition(state, CR.listId, entrada.statusFinalId);
  if (!statusFinal) {
    return fail(`O Status "${entrada.statusFinalId}" não existe no Conjunto efetivo da Lista de Contas a receber.`);
  }

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

  // D5-12 — o alvo do Vínculo precisa existir; a recusa cita o id, nunca um
  // nome (T-3-07 do irmão vale aqui igual).
  if (entrada.clienteRef) {
    const existeNoCrm =
      entrada.clienteRef.tipo === "contact"
        ? state.contacts.some((c) => c.id === entrada.clienteRef!.id)
        : state.companies.some((c) => c.id === entrada.clienteRef!.id);
    if (!existeNoCrm) {
      return fail(`Cliente "${entrada.clienteRef.id}" (${entrada.clienteRef.tipo}) não encontrado no CRM.`);
    }
  }

  // No export a transição corrente vem primeiro, não em ordem cronológica —
  // a cópia local é ordenada; a entrada do chamador nunca é mutada.
  const transicoes = [...entrada.transicoes].sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
  const ultima = transicoes[transicoes.length - 1];

  const ator: ActorRef = entrada.autoriaConhecida
    ? memberActor(entrada.autoriaConhecida.memberId)
    : importActor(ORIGEM_CONTAS_A_RECEBER);
  const delegate = ator.kind !== "member" ? memberActor(actingMemberId) : undefined;

  // Divergência entre o Status final classificado e o que o histórico diz
  // vira Registro auditável, não recusa — mesma disciplina do irmão.
  const ultimaResolvida = [...transicoes].reverse().find((t) => t.statusId !== undefined);
  const diverge = ultimaResolvida !== undefined && ultimaResolvida.statusId !== entrada.statusFinalId;
  const comDivergencia =
    diverge && !entrada.lacunas.includes("status_final_diverge_do_historico")
      ? [...entrada.lacunas, "status_final_diverge_do_historico"]
      : entrada.lacunas;
  // D5-12 — sem cliente, a lacuna entra aqui (não no mapeador): é esta
  // operação que decide se o Vínculo nasce, então é ela quem sabe se faltou.
  const lacunas =
    !entrada.clienteRef && !comDivergencia.includes("sem-cliente") ? [...comDivergencia, "sem-cliente"] : comDivergencia;

  // Tudo ou nada, como no precedente.
  const antes = {
    tasks: state.tasks.length,
    activity: state.activity.length,
    links: state.links.length,
    readable: state.workspace.taskReadableId.next,
  };
  const desfazer = (motivo: string, field?: Id): OperationResult<Task> => {
    state.tasks.splice(antes.tasks);
    state.activity.splice(0, state.activity.length - antes.activity);
    state.links.splice(antes.links);
    state.workspace.taskReadableId.next = antes.readable;
    return fail(motivo, field);
  };

  // `runAutomations: false` desliga o gatilho de criação; o `statusId` na
  // criação é o que dispensa a operação de mudar Status e, com ela, R2/R2b/R3.
  const criada = createTask(
    state,
    actingMemberId,
    {
      listId: CR.listId,
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

  // D5-16/CR-06 — grava o que o mapeador decidiu; sem fallback próprio (ver
  // cabeçalho). Fora do formato AAAA-MM-DD é lixo, não um dia civil válido —
  // desfaz a importação daquela conta em vez de gravar algo que não é uma
  // data (mesmo caminho de recusa das outras rejeições de Campo).
  if (entrada.dataPagamento !== undefined) {
    if (!FORMATO_DE_DIA_CIVIL.test(entrada.dataPagamento)) {
      return desfazer(
        `Campo "${CR.fields.dataPagamento}": "${entrada.dataPagamento}" não é um dia civil no formato AAAA-MM-DD.`,
        CR.fields.dataPagamento,
      );
    }
    const r = setTaskFieldValue(state, actingMemberId, task.id, CR.fields.dataPagamento, entrada.dataPagamento);
    if (!r.ok) return desfazer(`Campo "${CR.fields.dataPagamento}": ${r.error}`, CR.fields.dataPagamento);
  }

  // D5-12 — o Vínculo ao cliente, no mesmo molde de `createReceivableSeries` (`./financeiro.ts`).
  if (entrada.clienteRef) {
    state.links.push({
      id: nextId("lnk"),
      fromType: "task",
      fromId: task.id,
      toType: entrada.clienteRef.tipo,
      toId: entrada.clienteRef.id,
      role: CR.linkRole,
      createdBy: memberActor(actingMemberId),
      createdAt: entrada.criadaEm,
    });
  }

  // Os Registros transitórios da criação e dos Campos foram atribuídos ao
  // operador do CLI, com o relógio de agora — o Ator resolvido e o instante
  // histórico os substituem.
  state.activity.splice(0, state.activity.length - antes.activity);

  // `createdAt`, `createdBy` e `id` são `readonly` (`RecordBase`): a única
  // forma correta de honrar as datas originais é substituir a entrada de
  // `state.tasks`.
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
      sourceName: ORIGEM_CONTAS_A_RECEBER,
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
    detail: ORIGEM_CONTAS_A_RECEBER,
    at: entrada.criadaEm,
  });

  let anterior: string | undefined;
  for (const transicao of transicoes) {
    const nome = (transicao.statusId ? statusDefinition(state, CR.listId, transicao.statusId)?.name : undefined) ?? transicao.nomeLegado;
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
    // D5-18 — as lacunas de subtarefa desamarrada e de parcela duplicada
    // viajam com o id legado do outro lado, citado pelo mapeador dentro do
    // próprio texto da categoria (nunca o nome do cliente nem o valor).
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
