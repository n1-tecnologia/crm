/**
 * A Tarefa conversacional do espelho do Funil SDR, montada à mão para os testes da ficha (15-31, D-15-13).
 *
 * Até o 15-30 o seed trazia a Pasta "Meus negócios", uma Lista por Funil e uma Tarefa por Negócio
 * (`tsk_lst_funil_sdr_deal_sdr_2`, Vínculos para `cnt_35` e `deal_sdr_2`). O seed não os cria mais: a ficha lê o resumo
 * da api e os Vínculos por id, então estes testes só precisam da Lista conversacional, da Tarefa e dos dois Vínculos.
 */

import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";

export const LISTA_DO_ESPELHO = "lst_funil_sdr";
export const TAREFA_DO_ESPELHO = "tsk_lst_funil_sdr_deal_sdr_2";

export function montarTarefaConversacional(state: DataState): void {
  const origem = { kind: "member", id: "mem_julia" } as const;
  const criadaEm = "2026-10-01T09:00:00.000Z";
  // Os Status da Lista são os do Espaço Comercial, com ids próprios: a cor de um Status é dado, e não mora neste arquivo.
  const doEspaco = state.spaces.find((e) => e.id === "spc_com")?.statusSet?.definitions ?? [];
  const definitions = doEspaco.map((d) => ({ ...d, id: `st_${LISTA_DO_ESPELHO}_${d.id}` }));
  state.lists.push({
    id: LISTA_DO_ESPELHO,
    workspaceId: state.workspace.id,
    createdBy: origem,
    createdAt: criadaEm,
    lifecycle: "ativo",
    name: "SDR",
    order: 0,
    isPrivate: false,
    modeloDeTarefa: "conversacional",
    canaisDeAtendimento: ["chn_wpp"],
    modes: { statusSet: "sobrescrito" },
    statusSet: { id: "sts_lst_funil_sdr", definitions },
    features: { subtarefas: false, checklists: false },
    parentType: "space",
    parentId: "spc_com",
  });
  const tarefa: Task = {
    id: TAREFA_DO_ESPELHO,
    workspaceId: state.workspace.id,
    createdBy: origem,
    createdAt: criadaEm,
    lifecycle: "ativo",
    listId: LISTA_DO_ESPELHO,
    siblingOrder: 0,
    readableId: "NEG-002",
    title: "Módulo prático para Iallas",
    description: "Full Face Avançado",
    statusId: `st_${LISTA_DO_ESPELHO}_st_com_exec`,
    taskTypeId: "tt_tarefa_com",
    priority: "normal",
    assignees: [{ kind: "member", id: "mem_marcos" }],
    observerMemberIds: [],
    tagIds: [],
    fieldValues: [],
    checklists: [],
    timeEntries: [],
    dependencies: [],
    attachments: [],
    comments: [],
    provenance: { kind: "deal", sourceId: "deal_sdr_2", sourceName: "Módulo prático para Iallas", at: criadaEm },
    updatedAt: criadaEm,
  };
  state.tasks.push(tarefa);
  state.links.push(
    { id: `lnk_${tarefa.id}`, fromType: "task", fromId: tarefa.id, toType: "deal", toId: "deal_sdr_2", role: "espelho do Negócio", createdBy: origem, createdAt: criadaEm },
    { id: `lnk_${tarefa.id}_contato`, fromType: "task", fromId: tarefa.id, toType: "contact", toId: "cnt_35", role: "contato da Tarefa", createdBy: origem, createdAt: criadaEm },
  );
}
