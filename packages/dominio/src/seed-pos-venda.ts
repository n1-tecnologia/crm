/**
 * A Lista conversacional SEM Funil (C35): Comercial › Pós-venda. Cada Tarefa
 * nasce de um Contato que já conversa com o Instituto e carrega a conversa
 * dele por Vínculos — Contato e Conversa sempre, Negócio só quando há um.
 *
 * É a prova de que o modelo conversacional não depende de "Meus negócios":
 * aqui não há Etapa nem valor, só o atendimento a quem já comprou. Como o
 * espelho comercial, é uma CÓPIA de seed, aberta em Quadro por padrão.
 */

import type { DataState } from "./state";
import type { ActorRef, Id, Link, StatusDefinition, Task } from "./types";

interface Clock {
  readonly at: (daysAgo: number, hour?: number) => string;
  readonly day: (daysFromNow: number) => string;
  readonly workspaceId: Id;
}

const member = (id: Id): ActorRef => ({ kind: "member", id });

export const POS_VENDA_LIST_ID = "lst_pos_venda";

const STATUS = {
  novo: "st_pv_novo",
  conversa: "st_pv_conversa",
  aguardando: "st_pv_aguardando",
  resolvido: "st_pv_resolvido",
  encerrado: "st_pv_encerrado",
} as const;

/**
 * Cada Tarefa aponta para um Contato que JÁ tem Conversa de WhatsApp ativa no
 * seed. Atenção ao seed: `cnv_1` é da Marina (`cnt_2`, reatribuída para o
 * Rascunho de IA), e `cnv_13` é a Conversa da lixeira — por isso a resolvida
 * aqui é a `cnv_17`.
 */
const TAREFAS: ReadonlyArray<{
  readonly id: Id;
  readonly title: string;
  readonly contactId: Id;
  readonly conversationId: Id;
  readonly statusId: Id;
  readonly assignee: Id;
  readonly daysAgo: number;
  readonly dueInDays?: number;
  readonly dealId?: Id;
}> = [
  { id: "tsk_pv_1", title: "Enviar cronograma do Elite", contactId: "cnt_2", conversationId: "cnv_1", statusId: STATUS.conversa, assignee: "mem_julia", daysAgo: 2, dueInDays: 1 },
  { id: "tsk_pv_2", title: "Dúvida sobre acompanhamento de casos", contactId: "cnt_5", conversationId: "cnv_5", statusId: STATUS.novo, assignee: "mem_marcos", daysAgo: 1 },
  { id: "tsk_pv_3", title: "Remarcar treinamento da equipe", contactId: "cnt_9", conversationId: "cnv_9", statusId: STATUS.aguardando, assignee: "mem_julia", daysAgo: 4 },
  { id: "tsk_pv_4", title: "Confirmar acesso à plataforma", contactId: "cnt_17", conversationId: "cnv_17", statusId: STATUS.resolvido, assignee: "mem_marcos", daysAgo: 6 },
  { id: "tsk_pv_5", title: "Retorno sobre parcelamento", contactId: "cnt_35", conversationId: "cnv_sdr_1", statusId: STATUS.conversa, assignee: "mem_julia", daysAgo: 0, dealId: "deal_sdr_1" },
];

export function applyPosVenda(state: DataState, clock: Clock): void {
  const { at, day, workspaceId } = clock;
  const listId = POS_VENDA_LIST_ID;
  const definitions: StatusDefinition[] = [
    { id: STATUS.novo, name: "Novo", color: "#94a3b8", category: "naoIniciado", order: 0 },
    { id: STATUS.conversa, name: "Em conversa", color: "#3b82f6", category: "emAndamento", order: 1 },
    { id: STATUS.aguardando, name: "Aguardando aluno", color: "#f59e0b", category: "emAndamento", order: 2 },
    { id: STATUS.resolvido, name: "Resolvido", color: "#10b981", category: "concluido", order: 3 },
    { id: STATUS.encerrado, name: "Encerrado", color: "#6b7280", category: "fechado", order: 4 },
  ];
  state.lists.push({
    id: listId,
    workspaceId,
    createdBy: member("mem_julia"),
    createdAt: at(120),
    lifecycle: "ativo",
    name: "Pós-venda",
    description: "Atendimento a quem já comprou: cada Tarefa nasce de um Contato e traz a conversa dele.",
    // Depois das Listas diretas do Espaço (Prospecção 1, Indicadores 2).
    order: 3,
    isPrivate: false,
    modeloDeTarefa: "conversacional",
    // C36 — atende por WhatsApp (as cinco Tarefas conversam por ele) e pelo
    // e-mail do Suporte.
    canaisDeAtendimento: ["chn_wpp", "chn_mail"],
    modes: { statusSet: "sobrescrito" },
    blocks: {},
    statusSet: { id: "sts_pos_venda", definitions },
    parentType: "space",
    parentId: "spc_com",
  });
  // Quadro por padrão, como o espelho comercial.
  state.views.push({
    id: `viw_${listId}_quadro`,
    name: "Quadro de atendimento",
    kind: "quadro",
    ownerKind: "container",
    ownerId: listId,
    listId,
    filters: {},
    isDefault: true,
    createdBy: "mem_julia",
    createdAt: at(120),
  });

  for (const [i, entrada] of TAREFAS.entries()) {
    const contact = state.contacts.find((c) => c.id === entrada.contactId);
    const conversation = state.conversations.find((c) => c.id === entrada.conversationId);
    // A Conversa tem que ser DESTE Contato: um par trocado nasceria com fio de outra pessoa.
    if (!contact || !conversation || conversation.contactId !== contact.id) continue;
    const nome = `${contact.firstName} ${contact.lastName}`.trim();
    const criadaEm = at(entrada.daysAgo, 10);
    const task: Task = {
      id: entrada.id,
      workspaceId,
      createdBy: member(entrada.assignee),
      createdAt: criadaEm,
      lifecycle: "ativo",
      listId,
      siblingOrder: i,
      readableId: `PV-${String(i + 1).padStart(3, "0")}`,
      title: entrada.title,
      description: "",
      statusId: entrada.statusId,
      taskTypeId: "tt_tarefa_com",
      priority: "normal",
      ...(entrada.dueInDays !== undefined ? { dueDate: { form: "civilDay", value: day(entrada.dueInDays) } } : {}),
      ...(entrada.statusId === STATUS.resolvido ? { completedAt: at(1, 15) } : {}),
      assignees: [member(entrada.assignee)],
      observerMemberIds: [],
      tagIds: [],
      fieldValues: [],
      checklists: [],
      timeEntries: [],
      dependencies: [],
      attachments: [],
      comments: [],
      provenance: { kind: "contact", sourceId: contact.id, sourceName: nome, at: criadaEm },
      updatedAt: criadaEm,
    };
    state.tasks.push(task);
    const vinculo = (sufixo: string, toType: Link["toType"], toId: Id, role: string): Link => ({
      id: `lnk_${task.id}_${sufixo}`,
      fromType: "task",
      fromId: task.id,
      toType,
      toId,
      role,
      createdBy: task.createdBy,
      createdAt: criadaEm,
    });
    state.links.push(vinculo("contato", "contact", contact.id, "contato da Tarefa"));
    state.links.push(vinculo("conversa", "conversation", conversation.id, "conversa da Tarefa"));
    if (entrada.dealId && state.deals.some((d) => d.id === entrada.dealId)) {
      state.links.push(vinculo("negocio", "deal", entrada.dealId, "Negócio da Tarefa"));
    }
  }
}
