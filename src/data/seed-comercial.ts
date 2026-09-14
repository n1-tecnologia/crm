/**
 * Espelho do processo comercial na Estrutura: Espaço "Comercial" › Pasta
 * "Meus negócios" › uma Lista por Funil (SDR, Closer, Validação Full Face
 * Avançado, Venda direta), cada uma com o Conjunto de Status copiado das
 * Etapas e uma Tarefa por Negócio, aberta em Quadro (Kanban) por padrão.
 * Ao lado da Pasta, no nível de Lista, o atalho "Caixa de entrada": a Caixa
 * de Entrada do CRM recortada às Conversas de quem está olhando.
 *
 * É uma CÓPIA de seed, não um espelho vivo: a Tarefa nasce com Proveniência
 * `deal` e um Vínculo com o Negócio, mas mover o Negócio de Etapa não move a
 * Tarefa (nem o contrário). Ligar os dois é decisão de produto — ver
 * docs/PENDENCIAS-FRONTEND.md, C33.
 */

import type { DataState } from "./state";
import type { ActorRef, Id, StatusDefinition, Task } from "./types";

interface Clock {
  readonly at: (daysAgo: number, hour?: number) => string;
  readonly workspaceId: Id;
}

const member = (id: Id): ActorRef => ({ kind: "member", id });
const STAGE_COLORS = ["#94a3b8", "#60a5fa", "#a78bfa", "#f59e0b", "#f97316", "#22d3ee", "#e879f9", "#84cc16"];

/** A Pasta espelho; a tela da Lista avisa que é uma cópia do Funil. */
export const MEUS_NEGOCIOS_ID = "fld_meus_negocios";

export function applyEspelhoComercial(state: DataState, clock: Clock): void {
  const { at, workspaceId } = clock;
  const spaceId = "spc_com";
  const folderId = MEUS_NEGOCIOS_ID;
  state.folders.push({
    id: folderId,
    workspaceId,
    createdBy: member("mem_julia"),
    createdAt: at(200),
    lifecycle: "ativo",
    name: "Meus negócios",
    description: "Uma Lista por Funil de Negócios, com as Etapas como Status e cada Negócio como Tarefa.",
    order: 3,
    isPrivate: false,
    modes: {},
    blocks: {},
    parentType: "space",
    parentId: spaceId,
  });
  // O atalho fica no nível das Listas do Espaço; abre a Caixa de Entrada do
  // CRM já filtrada em "Minhas".
  const space = state.spaces.find((s) => s.id === spaceId);
  if (space) {
    space.shortcuts = [
      ...(space.shortcuts ?? []),
      { id: "atl_com_caixa", name: "Caixa de entrada", target: "caixaDeEntrada", scope: "minhas" },
    ];
  }

  const funnels = state.funnels.filter((f) => f.lifecycle === "ativo").sort((a, b) => a.order - b.order);
  let readable = 1;
  for (const [ordem, funnel] of funnels.entries()) {
    const listId = `lst_funil_${funnel.id.replace(/^fnl_/, "")}`;
    const stages = [...funnel.stages].sort((a, b) => a.order - b.order);
    const definitions: StatusDefinition[] = [
      ...stages.map((s, i) => ({
        id: `st_${listId}_${s.id}`,
        name: s.name,
        color: s.color ?? STAGE_COLORS[i % STAGE_COLORS.length] ?? "#94a3b8",
        category: (i === 0 ? "naoIniciado" : "emAndamento") as StatusDefinition["category"],
        order: i,
      })),
      { id: `st_${listId}_ganho`, name: "Ganho", color: "#22c55e", category: "concluido", order: stages.length },
      { id: `st_${listId}_perdido`, name: "Perdido", color: "#64748b", category: "fechado", order: stages.length + 1 },
    ];
    state.lists.push({
      id: listId,
      workspaceId,
      createdBy: member("mem_julia"),
      createdAt: at(200),
      lifecycle: "ativo",
      name: funnel.name,
      description: `Espelho do Funil ${funnel.name}: Etapas como Status, Negócios como Tarefas.`,
      order: ordem,
      isPrivate: false,
      modes: { statusSet: "sobrescrito" },
      blocks: {},
      statusSet: { id: `sts_${listId}`, definitions },
      // Negócio não tem Subtarefa nem Checklist aqui: a Tarefa é o cartão do Kanban.
      features: { subtarefas: false, checklists: false },
      parentType: "folder",
      parentId: folderId,
    });
    // Kanban por padrão: a Visualização compartilhada e padrão da Lista é o Quadro.
    state.views.push({
      id: `viw_${listId}_quadro`,
      name: "Quadro do Funil",
      kind: "quadro",
      ownerKind: "container",
      ownerId: listId,
      listId,
      filters: {},
      isDefault: true,
      createdBy: "mem_julia",
      createdAt: at(200),
    });

    const deals = state.deals.filter((d) => d.funnelId === funnel.id && d.lifecycle === "ativo");
    for (const [i, deal] of deals.entries()) {
      const statusId = deal.situation === "ganho" ? `st_${listId}_ganho` : deal.situation === "perdido" ? `st_${listId}_perdido` : `st_${listId}_${deal.stageId}`;
      const task: Task = {
        id: `tsk_${listId}_${deal.id}`,
        workspaceId,
        createdBy: deal.createdBy,
        createdAt: deal.createdAt,
        lifecycle: "ativo",
        listId,
        siblingOrder: i,
        readableId: `NEG-${String(readable).padStart(3, "0")}`,
        title: deal.title,
        description: deal.object,
        statusId,
        taskTypeId: "tt_tarefa_com",
        priority: "normal",
        ...(deal.expectedCloseDate ? { dueDate: { form: "civilDay", value: deal.expectedCloseDate } } : {}),
        ...(deal.closedAt ? { completedAt: deal.closedAt } : {}),
        assignees: [member(deal.ownerMemberId)],
        observerMemberIds: [],
        tagIds: [],
        fieldValues: [],
        checklists: [],
        timeEntries: [],
        dependencies: [],
        attachments: [],
        comments: [],
        provenance: { kind: "deal", sourceId: deal.id, sourceName: deal.title, at: deal.createdAt },
        updatedAt: deal.createdAt,
      };
      readable += 1;
      state.tasks.push(task);
      state.links.push({ id: `lnk_${task.id}`, fromType: "task", fromId: task.id, toType: "deal", toId: deal.id, role: "espelho do Negócio", createdBy: deal.createdBy, createdAt: deal.createdAt });
    }
  }
}
