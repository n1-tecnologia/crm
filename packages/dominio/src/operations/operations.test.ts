/**
 * Behaviour of the critical rules the PRD lists as the phase-3 done criteria:
 * mandatory status mapping, stage requirement, winning without a value,
 * subfolder inside subfolder, maximum depth, merge and succession.
 *
 * Every test asserts the RESULT of the operation and the state it left behind,
 * never that a function was called.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import {
  checklistProgress,
  duplicateSuspicions,
  effectiveLifecycleOfTask,
  containerAdminRefusal,
  effectiveContainerConfig,
  effectiveListConfig,
  memberReachesContainer,
  memberSeesResource,
  memberSeesTask,
  weekStartOf,
  workload,
  goalProgress,
  widgetReading,
} from "../derive";
import type { DataState } from "../state";
import {
  changeTaskStatus,
  convertChecklistItem,
  createTask,
  moveTask,
  restoreTask,
  trashTask,
} from "./tasks";
import {
  loseDeal,
  migrateDealsToFunnel,
  moveDealToFunnel,
  moveDealToStage,
  removeStage,
  reopenDeal,
  winDeal,
} from "./deals";
import { discardDraft, moveConversationToContact, receiveMessage, resolveConversation, sendMessage } from "./conversations";
import {
  addContactIdentifier,
  importContacts,
  markContactsAsDistinct,
  mergeContacts,
  restoreMergedCopy,
} from "./contacts";
import { deleteRole, grantGovernanceAccess, inviteMember, previewSuccession, removeMember, roleHolders } from "./members";
import { configureChatSession, decideApproval, publishAutomation, restoreAgent, sendChatMessage } from "./ai";
import {
  createChatFolder,
  deleteChatFolder,
  moveChatSessionToFolder,
  renameChatFolder,
} from "./chat-folders";
import { createFolder, createList, createSpace } from "./structure";
import { addTaskComment, assignTask, resolveTaskComment, setTaskFieldValue, setTaskTags, startMeeting, updateTask, watchTask } from "./tasks";
import {
  addDependency,
  addTimeEntry,
  attachFile,
  removeAttachment,
  removeDependency,
  runningTimer,
  setRecurrence,
  startTimer,
  stopTimer,
} from "./collaboration";
import {
  closeSprint,
  createNextSprint,
  enableSprints,
  instantiateListTemplate,
  instantiateTaskTemplate,
  saveListAsTemplate,
  saveTaskAsTemplate,
  setMemberCapacity,
  sprintsOf,
} from "./planning";
import { CP, contaSemResumo } from "./financeiro";
import { runScheduledAutomations } from "./automations";
import {
  applyView,
  archiveForm,
  archiveGoal,
  createForm,
  createGoal,
  deleteView,
  formBySecret,
  linkTaskToGoal,
  revokePublicShare,
  rotateFormSecret,
  saveView,
  setDefaultView,
  setGoalArchived,
  updateGoal,
  shareTaskPublicly,
  submitForm,
  taskByPublicSecret,
  updateForm,
  viewsFor,
} from "./scale";
import {
  addStatus,
  archiveFieldDefinition,
  createFieldDefinition,
  createTaskType,
  inheritStatusSet,
  overrideStatusSet,
  removeStatus,
  removeTaskType,
  reorderStatuses,
  restoreFieldDefinition,
  updateFieldDefinition,
  updateStatus,
  updateTaskType,
} from "./configuration";
import { createAgent, publishAgentVersion } from "./agent-builder";
import {
  addCompanyIdentifier,
  createCompany,
  createContact,
  linkContactToCompany,
  setContactCatalogValue,
} from "./contacts";
import {
  createDeal,
  linkContactToDeal,
  setDealFieldValue,
  unlinkContactFromDeal,
} from "./deals";
import { startConversation } from "./conversations";

const THIAGO = "mem_thiago";
const RAFAEL = "mem_rafael";
const JULIA = "mem_julia";


/**
 * O Negócio aberto do Funil, posto na Etapa que o teste vai exercitar.
 *
 * Pescar do seed um Negócio que por acaso está numa Etapa amarra o teste ao
 * conteúdo fictício: muda o seed, quebra o teste por um motivo que nada tem a
 * ver com a regra sob teste. Aqui o estado é montado, e o que se afirma é a
 * regra.
 */
function negocioEm(state: DataState, funnelId: string, stageId: string) {
  const deal = state.deals.find((d) => d.funnelId === funnelId && d.situation === "aberto");
  if (!deal) throw new Error(`seed sem Negócio aberto em ${funnelId}`);
  const funil = state.funnels.find((f) => f.id === funnelId);
  const etapa = funil?.stages.find((s) => s.id === stageId);
  if (!etapa) throw new Error(`Funil ${funnelId} sem a Etapa ${stageId}`);
  deal.stageId = stageId;
  return deal;
}

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

describe("Mapeamento de status (RN-LIS-06, B40)", () => {
  it("rejeita mover para Lista com outro Conjunto sem mapear, nomeando o status em uso", () => {
    const task = state.tasks.find((t) => t.id === "tsk_seed_1");
    expect(task?.listId).toBe("lst_revisoes");

    const result = moveTask(state, THIAGO, "tsk_seed_1", "lst_ativacao");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("mapeamento");
    expect(result.error).toContain("Em andamento");
    // Nada foi gravado.
    expect(state.tasks.find((t) => t.id === "tsk_seed_1")?.listId).toBe("lst_revisoes");
  });

  it("move e remapeia quando o mapeamento é completo, registrando a atividade", () => {
    const result = moveTask(state, THIAGO, "tsk_seed_1", "lst_ativacao", [
      { fromStatusId: "st_ops_and", toStatusId: "st_atv_exec" },
    ]);

    expect(result.ok).toBe(true);
    const task = state.tasks.find((t) => t.id === "tsk_seed_1");
    expect(task?.listId).toBe("lst_ativacao");
    expect(task?.statusId).toBe("st_atv_exec");
    expect(state.activity.some((a) => a.action === "Status alterado por remapeamento")).toBe(true);
    expect(state.activity.some((a) => a.action === "Tarefa movida")).toBe(true);
  });

  it("arquiva no agregado o Valor de Campo que deixa de se aplicar, sem descartá-lo (B37)", () => {
    const before = state.tasks.find((t) => t.id === "tsk_seed_1")?.fieldValues.find((v) => v.definitionId === "fd_turma");
    expect(before?.state).toBe("ativo");

    moveTask(state, THIAGO, "tsk_seed_1", "lst_ativacao", [
      { fromStatusId: "st_ops_and", toStatusId: "st_atv_exec" },
    ]);

    const after = state.tasks.find((t) => t.id === "tsk_seed_1")?.fieldValues.find((v) => v.definitionId === "fd_turma");
    expect(after).toBeDefined();
    expect(after?.state).toBe("arquivado");
    expect(after?.value).toBe("Turma de outubro");
  });
});

describe("Funcionalidade exigir Checklists concluídos (RN-CHK-09)", () => {
  it("impede concluir com Item aberto e diz quantos faltam", () => {
    const config = effectiveListConfig(state, "lst_revisoes");
    expect(config?.features.exigirChecklistsConcluidos).toBe(true);

    const result = changeTaskStatus(state, THIAGO, "tsk_seed_1", "st_ops_conc");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("2 itens de checklist abertos");
    expect(state.tasks.find((t) => t.id === "tsk_seed_1")?.statusId).toBe("st_ops_and");
  });

  it("conclui quando os Itens contáveis estão concluídos e grava o Momento de conclusão", () => {
    const task = state.tasks.find((t) => t.id === "tsk_seed_1");
    for (const item of task?.checklists[0]?.items ?? []) item.done = true;

    const result = changeTaskStatus(state, THIAGO, "tsk_seed_1", "st_ops_conc");

    expect(result.ok).toBe(true);
    expect(task?.completedAt).toBeDefined();
    expect(state.activity[0]?.action).toBe("Status alterado");
  });
});

describe("Profundidade máxima de Subtarefas (RN-STA-04)", () => {
  it("rejeita criar Subtarefa além do limite do Espaço de Trabalho", () => {
    // tsk_seed_8 já está no nível 3, que é o máximo do seed.
    const result = createTask(state, THIAGO, {
      listId: "lst_ativacao",
      title: "Nível quatro",
      parentTaskId: "tsk_seed_8",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Limite de 3 níveis");
    expect(state.tasks.some((t) => t.title === "Nível quatro")).toBe(false);
  });

  it("rejeita a conversão de Item que criaria um nível além do máximo, sem efeito parcial", () => {
    const before = state.tasks.length;
    const task = state.tasks.find((t) => t.id === "tsk_seed_8");
    task?.checklists.push({
      id: "chk_x",
      name: "Passos",
      order: 0,
      items: [{ id: "cki_x", text: "Passo profundo", order: 0, done: false }],
      createdBy: { kind: "member", id: THIAGO },
      createdAt: new Date().toISOString(),
    });

    const result = convertChecklistItem(state, THIAGO, "tsk_seed_8", "chk_x", "cki_x");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("nível 4");
    expect(state.tasks.length).toBe(before);
    // O Item continua aberto: a rejeição é anterior a qualquer efeito.
    expect(task?.checklists.find((c) => c.id === "chk_x")?.items[0]?.converted).toBeUndefined();
  });
});

describe("Conversão de Item de Checklist (B48)", () => {
  it("tira o Item convertido do numerador e do denominador do progresso", () => {
    const task = state.tasks.find((t) => t.id === "tsk_seed_1");
    expect(checklistProgress(task!)).toEqual({ done: 1, total: 3 });

    const result = convertChecklistItem(state, THIAGO, "tsk_seed_1", "chk_seed_1", "cki_2");

    expect(result.ok).toBe(true);
    expect(checklistProgress(task!)).toEqual({ done: 1, total: 2 });
    const item = task?.checklists[0]?.items.find((i) => i.id === "cki_2");
    expect(item?.converted?.taskId).toBe(result.ok ? result.value.id : "");
  });
});

describe("Requisito de Etapa (B59, RN-FUN-07)", () => {
  /** O Negócio do SDR que está em Qualificado e ainda não tem Contato. */
  const semContato = () => {
    const deal = negocioEm(state, "fnl_sdr", "sdr_qualificado");
    // A precondição é o Negócio SEM Contato, mas COM o que a Etapa de saída
    // exige: senão o teste tropeça na regra anterior e nunca chega à de entrada.
    deal.contactLinks = [];
    deal.fieldValues = [
      ...deal.fieldValues.filter((v) => v.definitionId !== "fd_data_reuniao"),
      { definitionId: "fd_data_reuniao", value: new Date().toISOString(), state: "ativo" },
    ];
    return deal;
  };

  it("impede entrar em Agendamento sem Contato vinculado e nomeia o Requisito", () => {
    const deal = semContato();
    expect(deal.contactLinks).toHaveLength(0);

    const result = moveDealToStage(state, JULIA, deal.id, "sdr_agendamento");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("exige ao menos um Contato vinculado");
    expect(deal.stageId).toBe("sdr_qualificado");
  });

  it("permite entrar depois de vincular o Contato e registra a transição com a Ordem à época", () => {
    const deal = semContato();
    deal.contactLinks.push({
      id: "dcl_x",
      contactId: "cnt_1",
      role: "decisor",
      principal: true,
      createdBy: { kind: "member", id: JULIA },
      createdAt: new Date().toISOString(),
    });

    const result = moveDealToStage(state, JULIA, deal.id, "sdr_agendamento");

    expect(result.ok).toBe(true);
    expect(deal.stageId).toBe("sdr_agendamento");
    const last = deal.stageHistory.at(-1);
    expect(last?.toStageName).toBe("Agendamento");
    expect(last?.toStageOrder).toBe(5);
    expect(last?.entryOrigin).toBe("avanco");
  });

  it("respeita Transições permitidas quando a Etapa as declara", () => {
    // De Agendamento, dentro do SDR, só se volta para Qualificado: avançar dali
    // significa mudar de Funil, não mudar de Etapa.
    const deal = negocioEm(state, "fnl_sdr", "sdr_agendamento");
    if (!deal) throw new Error("seed sem Negócio em Agendamento");

    const result = moveDealToStage(state, JULIA, deal.id, "sdr_conexao");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Qualificado");
  });
});

describe("Regras de encerramento do Funil (RN-NEG-09)", () => {
  /** Um Negócio aberto no Closer, que é o Funil onde `ganho` é a Venda. */
  const noCloser = () => {
    const deal = state.deals.find(
      (d) => d.funnelId === "fnl_closer" && d.situation === "aberto" && d.lifecycle === "ativo",
    );
    if (!deal) throw new Error("seed sem Negócio aberto no Closer");
    return deal;
  };

  it("pede valor ao ganhar quando o Funil exige", () => {
    const deal = noCloser();
    delete deal.value;

    const result = winDeal(state, RAFAEL, deal.id, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("valor");
    expect(deal.situation).toBe("aberto");
  });

  it("ganha com valor e preserva a Etapa como última Etapa (B9)", () => {
    const deal = noCloser();
    const before = deal.stageId;

    const result = winDeal(state, RAFAEL, deal.id, { value: { amount: 148_000, currency: "BRL" } });

    expect(result.ok).toBe(true);
    expect(deal.situation).toBe("ganho");
    expect(deal.stageId).toBe(before);
    expect(deal.closedAt).toBeDefined();
  });

  it("pede Motivo de Perda quando o Funil exige", () => {
    const result = loseDeal(state, RAFAEL, noCloser().id, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("motivo");
  });
});

describe("Reabertura de Negócio (B9, RN-NEG-10, RN-NEG-11)", () => {
  it("recusa reabrir um Negócio ganho para quem não é Administrador", () => {
    const won = state.deals.find((d) => d.situation === "ganho");
    if (!won) throw new Error("seed sem Negócio ganho");

    const result = reopenDeal(state, JULIA, won.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Administradores");
    expect(state.deals.find((d) => d.id === won.id)?.situation).toBe("ganho");
  });

  it("reabre para Administrador e limpa Motivo e Nota como atributos correntes", () => {
    const won = state.deals.find((d) => d.situation === "ganho");
    if (!won) throw new Error("seed sem Negócio ganho");
    won.closingNote = "fechado no preço cheio";
    // O Motivo DESTE Negócio, guardado antes: procurar um nome solto no Registro
    // casa com qualquer coisa que tenha a mesma palavra, e o teste passa sozinho.
    const motivoDoGanho = state.catalog.find((c) => c.id === won.winReasonId)?.name;
    expect(motivoDoGanho).toBeTruthy();

    const result = reopenDeal(state, RAFAEL, won.id);

    if (!result.ok) throw new Error(result.error);
    expect(won.situation).toBe("aberto");
    expect(won.winReasonId).toBeUndefined();
    expect(won.closingNote).toBeUndefined();

    // RN-NEG-11 — limpo como atributo corrente, PRESERVADO no Registro: a
    // asserção precisa citar o valor, não só a existência de um registro.
    const reopening = state.activity.find(
      (a) => a.action === "Negócio reaberto" && a.objectId === won.id,
    );
    expect(reopening?.detail).toContain("fechado no preço cheio");
    expect(reopening?.detail).toContain(motivoDoGanho ?? "");
  });

  it("recusa reabrir um Negócio arquivado ou na lixeira", () => {
    const won = state.deals.find((d) => d.situation === "ganho");
    if (!won) throw new Error("seed sem Negócio ganho");
    won.lifecycle = "arquivado";

    const result = reopenDeal(state, RAFAEL, won.id);

    expect(result.ok).toBe(false);
    expect(won.situation).toBe("ganho");
  });
});

describe("Remoção de Etapa com remapeamento (RN-FUN-10)", () => {
  it("exige Etapa de destino", () => {
    const result = removeStage(state, JULIA, "fnl_sdr", "sdr_conexao", "sdr_conexao");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("destino");
  });

  it("remapeia todos os Negócios da Etapa e registra a origem `remapeamento`", () => {
    const affected = state.deals.filter((d) => d.stageId === "sdr_conexao").map((d) => d.id);
    expect(affected.length).toBeGreaterThan(0);

    const result = removeStage(state, JULIA, "fnl_sdr", "sdr_conexao", "sdr_contato");

    expect(result.ok).toBe(true);
    for (const id of affected) {
      const deal = state.deals.find((d) => d.id === id);
      expect(deal?.stageId).toBe("sdr_contato");
      expect(deal?.stageHistory.at(-1)?.entryOrigin).toBe("remapeamento");
    }
    expect(state.funnels.find((f) => f.id === "fnl_sdr")?.stages.some((s) => s.id === "sdr_conexao")).toBe(false);
  });
});

describe("Mensageria (RN-CXE-09, RN-CXE-19, RN-CXE-33, B66)", () => {
  it("envia, esvazia o Rascunho do autor e mantém a autoria de quem enviou", () => {
    const conversation = state.conversations.find((c) => c.id === "cnv_1");
    expect(conversation?.drafts).toHaveLength(1);

    const result = sendMessage(state, THIAGO, { conversationId: "cnv_1", content: "Segue o cronograma." });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.actor).toEqual({ kind: "member", id: THIAGO });
    // A Membro escreveu o seu próprio texto: o Rascunho do Agente segue à espera.
    expect(conversation?.drafts).toHaveLength(1);
    expect(conversation?.messages.at(-1)?.content).toBe("Segue o cronograma.");
  });

  it("grava a Mensagem como pendente quando o Canal está desconectado, sem descarte silencioso", () => {
    const conversation = state.conversations.find((c) => c.channelId === "chn_insta");
    if (!conversation) throw new Error("seed sem Conversa no Canal desconectado");

    const result = sendMessage(state, THIAGO, { conversationId: conversation.id, content: "Oi!" });

    expect(result.ok).toBe(true);
    expect(conversation.messages.at(-1)?.deliveryStatus).toBe("pendente");
    expect(state.activity[0]?.detail).toContain("Canal desconectado");
  });

  it("reabre a MESMA Conversa quando a Mensagem chega dentro do Prazo de reabertura", () => {
    // Resolvida E fora da lixeira: RN-CXE-33 não reabre o que está na lixeira.
    const conversation = state.conversations.find(
      (c) => c.state === "resolvida" && c.lifecycle === "ativo",
    );
    if (!conversation?.contactId) throw new Error("seed sem Conversa resolvida ativa");
    conversation.resolvedAt = new Date().toISOString();
    const before = state.conversations.length;
    const reopensBefore = conversation.reopenCount;

    const result = receiveMessage(state, conversation.channelId, conversation.contactId, "Voltei!");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(conversation.id);
    expect(result.value.state).toBe("aberta");
    // A regra é o incremento, não um valor absoluto: a Conversa pode já ter
    // sido reaberta antes, e o contador conta as reaberturas dela.
    expect(result.value.reopenCount).toBe(reopensBefore + 1);
    expect(state.conversations.length).toBe(before);
  });

  it("cria uma Conversa NOVA quando a Mensagem chega fora do prazo", () => {
    // Resolvida E fora da lixeira: RN-CXE-33 não reabre o que está na lixeira.
    const conversation = state.conversations.find(
      (c) => c.state === "resolvida" && c.lifecycle === "ativo",
    );
    if (!conversation?.contactId) throw new Error("seed sem Conversa resolvida ativa");
    conversation.resolvedAt = new Date(Date.now() - 100 * 3_600_000).toISOString();
    const before = state.conversations.length;

    const result = receiveMessage(state, conversation.channelId, conversation.contactId, "Muito tempo depois");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).not.toBe(conversation.id);
    expect(state.conversations.length).toBe(before + 1);
  });

  it("restaura o Contato arquivado ao receber Mensagem (RN-CON-13)", () => {
    const contact = state.contacts.find((c) => c.id === "cnt_20");
    if (!contact) throw new Error("seed sem Contato");
    contact.lifecycle = "arquivado";

    receiveMessage(state, "chn_wpp", contact.id, "Oi, voltei a precisar do serviço.");

    expect(contact.lifecycle).toBe("ativo");
    expect(state.activity.some((a) => a.action === "Contato restaurado por Mensagem recebida")).toBe(true);
  });
});

describe("Adoção de Rascunho de IA no envio (documento 14, 7.10)", () => {
  it("adotar e enviar esvazia o Rascunho do Agente e registra a adoção", () => {
    const conversation = state.conversations.find((c) => c.id === "cnv_1");
    const rascunho = conversation?.drafts[0];
    if (!conversation || !rascunho) throw new Error("seed sem Rascunho em cnv_1");
    const agente = state.agents.find((a) => a.id === rascunho.actor.id);

    const result = sendMessage(state, THIAGO, {
      conversationId: "cnv_1",
      content: rascunho.content,
      adoptedDraftOf: rascunho.actor,
    });

    expect(result.ok).toBe(true);
    expect(conversation.drafts).toHaveLength(0);
    const record = state.activity.find((entry) => entry.action === "Mensagem enviada");
    expect(record?.detail).toContain(`Rascunho de ${agente?.name} adotado`);
  });

  it("o mesmo Rascunho não vai duas vezes ao Contato", () => {
    const conversation = state.conversations.find((c) => c.id === "cnv_1");
    const rascunho = conversation?.drafts[0];
    if (!conversation || !rascunho) throw new Error("seed sem Rascunho em cnv_1");

    sendMessage(state, THIAGO, {
      conversationId: "cnv_1",
      content: rascunho.content,
      adoptedDraftOf: rascunho.actor,
    });
    // Não há mais Rascunho para o próximo Atendente adotar.
    expect(conversation.drafts).toHaveLength(0);
    expect(
      conversation.messages.filter(
        (m) => m.direction === "enviada" && m.content === rascunho.content,
      ),
    ).toHaveLength(1);
  });

  it("a nota interna não consome o Rascunho: ela não sai da plataforma", () => {
    const conversation = state.conversations.find((c) => c.id === "cnv_1");
    if (!conversation) throw new Error("seed sem cnv_1");

    sendMessage(state, THIAGO, {
      conversationId: "cnv_1",
      content: "Confere isto antes de eu responder.",
      internal: true,
    });

    expect(conversation.drafts).toHaveLength(1);
  });
});

describe("Descarte de Rascunho de IA (B66)", () => {
  const conversaComRascunho = () => {
    const conversation = state.conversations.find((c) => c.drafts.length > 0);
    if (!conversation) throw new Error("seed sem Conversa com Rascunho");
    return conversation;
  };

  it("remove o Rascunho do Agente e registra quem o descartou e de quem era", () => {
    const conversation = conversaComRascunho();
    const draft = conversation.drafts[0];
    if (!draft) throw new Error("Rascunho ausente");
    const agent = state.agents.find((a) => a.id === draft.actor.id);

    const result = discardDraft(state, THIAGO, conversation.id, draft.actor);

    expect(result.ok).toBe(true);
    expect(conversation.drafts).toHaveLength(0);
    const record = state.activity.find((entry) => entry.action === "Rascunho de IA descartado");
    expect(record?.actor).toEqual({ kind: "member", id: THIAGO });
    expect(record?.detail).toBe(agent?.name);
  });

  it("recusa descartar duas vezes: o segundo ato não tem objeto", () => {
    const conversation = conversaComRascunho();
    const draft = conversation.drafts[0];
    if (!draft) throw new Error("Rascunho ausente");

    expect(discardDraft(state, THIAGO, conversation.id, draft.actor).ok).toBe(true);
    const segundo = discardDraft(state, THIAGO, conversation.id, draft.actor);

    expect(segundo.ok).toBe(false);
    if (segundo.ok) throw new Error("deveria recusar");
    expect(segundo.error).toContain("já não existe");
    expect(state.activity.filter((e) => e.action === "Rascunho de IA descartado")).toHaveLength(1);
  });

  it("não descarta o Rascunho de outro Ator interno", () => {
    const conversation = conversaComRascunho();

    const result = discardDraft(state, THIAGO, conversation.id, { kind: "member", id: RAFAEL });

    expect(result.ok).toBe(false);
    expect(conversation.drafts).toHaveLength(1);
  });
});

describe("Identificador de Contato (RN-CON-11)", () => {
  it("rejeita duplicata nomeando o detentor e oferecendo as duas saídas", () => {
    const existing = state.contacts.find((c) => c.id === "cnt_2");
    const email = existing?.identifiers.find((i) => i.type === "email")?.displayValue;
    if (!email) throw new Error("seed sem e-mail");

    const result = addContactIdentifier(state, THIAGO, "cnt_3", "email", email);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Marina Alves");
    expect(result.error).toContain("mesclar");
    expect(result.error).toContain("transferir");
  });
});

describe("Suspeita de Duplicidade (RN-CON-10, DO-CON-14)", () => {
  it("acusa o par com Nome idêntico e mesmo número em Tipos distintos, nomeando cada motivo", () => {
    const suspeitas = duplicateSuspicions(state);

    expect(suspeitas.length).toBeGreaterThan(0);
    const primeira = suspeitas[0];
    if (!primeira) throw new Error("sem suspeita");
    expect(primeira.reasons).toContain("Nome de exibição idêntico");
    expect(primeira.reasons.some((r) => r.startsWith("Mesmo número em Tipos distintos"))).toBe(true);
    // INV-CON-02 — nunca é o MESMO Identificador: os Tipos diferem.
    const tiposA = primeira.a.identifiers.map((i) => i.type);
    const tiposB = primeira.b.identifiers.map((i) => i.type);
    expect(tiposA.some((t) => tiposB.includes(t) === false)).toBe(true);
  });

  it("o Vínculo `distinto de` suprime o par, e o Registro fica nos dois Contatos", () => {
    const antes = duplicateSuspicions(state);
    const par = antes[0];
    if (!par) throw new Error("sem suspeita");

    const result = markContactsAsDistinct(state, THIAGO, par.a.id, par.b.id);

    expect(result.ok).toBe(true);
    const depois = duplicateSuspicions(state);
    expect(depois.some((p) => p.a.id === par.a.id && p.b.id === par.b.id)).toBe(false);
    expect(depois).toHaveLength(antes.length - 1);
    const registros = state.activity.filter(
      (entry) => entry.action === "Marcado como distinto de outro Contato",
    );
    expect(registros.map((r) => r.objectId).sort()).toEqual([par.a.id, par.b.id].sort());
  });

  it("marcar duas vezes não duplica o Vínculo nem o Registro", () => {
    const par = duplicateSuspicions(state)[0];
    if (!par) throw new Error("sem suspeita");

    markContactsAsDistinct(state, THIAGO, par.a.id, par.b.id);
    markContactsAsDistinct(state, THIAGO, par.b.id, par.a.id);

    expect(
      state.distinctFromLinks.filter(
        (link) =>
          (link.contactAId === par.a.id && link.contactBId === par.b.id) ||
          (link.contactAId === par.b.id && link.contactBId === par.a.id),
      ),
    ).toHaveLength(1);
    expect(
      state.activity.filter((e) => e.action === "Marcado como distinto de outro Contato"),
    ).toHaveLength(2);
  });

  it("um Contato mesclado sai do cálculo: ele já não é uma pessoa candidata", () => {
    const mesclado = state.contacts.find((c) => c.lifecycle === "mesclado");
    if (!mesclado) throw new Error("seed sem Contato mesclado");

    const suspeitas = duplicateSuspicions(state);

    expect(suspeitas.some((p) => p.a.id === mesclado.id || p.b.id === mesclado.id)).toBe(false);
  });
});

describe("Mesclagem de Contatos (B14)", () => {
  it("recusa mesclar um Contato já mesclado", () => {
    const result = mergeContacts(state, THIAGO, "cnt_2", "cnt_32");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("ativos ou arquivados");
  });

  it("migra Identificadores, reaponta referências e deixa o absorvido `mesclado`", () => {
    const absorbed = state.contacts.find((c) => c.id === "cnt_4");
    const survivor = state.contacts.find((c) => c.id === "cnt_3");
    if (!absorbed || !survivor) throw new Error("seed sem Contatos");
    const absorbedIdentifiers = absorbed.identifiers.length;
    const survivorIdentifiers = survivor.identifiers.length;
    const dealsOfAbsorbed = state.deals.filter((d) => d.contactLinks.some((l) => l.contactId === "cnt_4")).map((d) => d.id);

    const result = mergeContacts(state, THIAGO, "cnt_3", "cnt_4");

    expect(result.ok).toBe(true);
    expect(absorbed.lifecycle).toBe("mesclado");
    expect(absorbed.mergedIntoId).toBe("cnt_3");
    expect(absorbed.preMergeState).toBeDefined();
    expect(survivor.identifiers.length).toBe(survivorIdentifiers + absorbedIdentifiers);
    for (const dealId of dealsOfAbsorbed) {
      const deal = state.deals.find((d) => d.id === dealId);
      expect(deal?.contactLinks.some((l) => l.contactId === "cnt_4")).toBe(false);
      expect(deal?.contactLinks.some((l) => l.contactId === "cnt_3")).toBe(true);
    }
  });

  it("resolve a Conversa mais antiga quando sobram duas não resolvidas no mesmo Canal (RN-CXE-10)", () => {
    // Duas Conversas abertas no MESMO Canal, uma de cada Contato. O Canal da
    // Conversa é imutável (INV-CXE-04), então o par vem do seed já assim.
    const a = state.conversations[0];
    const b = state.conversations[4];
    if (!a || !b) throw new Error("seed sem Conversas");
    expect(a.channelId).toBe(b.channelId);
    a.contactId = "cnt_3";
    b.contactId = "cnt_4";
    a.state = "aberta";
    b.state = "aberta";

    mergeContacts(state, THIAGO, "cnt_3", "cnt_4");

    const unresolved = state.conversations.filter(
      (c) => c.contactId === "cnt_3" && c.channelId === "chn_wpp" && c.state !== "resolvida",
    );
    expect(unresolved).toHaveLength(1);
    expect(state.activity.some((r) => r.action === "Conversa resolvida por mesclagem")).toBe(true);
  });
});

describe("Lixeira e restauração (B43, RN-TAR-28)", () => {
  it("devolve o Estado próprio anterior à exclusão, nunca forçando `ativo`", () => {
    const task = state.tasks.find((t) => t.id === "tsk_seed_10");
    expect(task?.lifecycle).toBe("arquivado");

    trashTask(state, THIAGO, "tsk_seed_10");
    expect(task?.lifecycle).toBe("naLixeira");
    expect(task?.lifecycleBeforeTrash).toBe("arquivado");

    restoreTask(state, THIAGO, "tsk_seed_10");
    expect(task?.lifecycle).toBe("arquivado");
    expect(task?.lifecycleBeforeTrash).toBeUndefined();
  });

  it("restaura como Tarefa raiz a Subtarefa cujo pai continua na lixeira", () => {
    trashTask(state, THIAGO, "tsk_seed_6");
    trashTask(state, THIAGO, "tsk_seed_3");

    restoreTask(state, THIAGO, "tsk_seed_6");

    const subtask = state.tasks.find((t) => t.id === "tsk_seed_6");
    expect(subtask?.parentTaskId).toBeUndefined();
    expect(subtask?.listId).toBe("lst_ativacao");
    expect(state.activity.some((a) => a.action === "Pai alterado" && a.detail === "restauração")).toBe(true);
  });

  it("encerra o Registro de Tempo em andamento quando a Tarefa deixa de ser efetivamente ativa (B36)", () => {
    const task = state.tasks.find((t) => t.id === "tsk_seed_1");
    task?.timeEntries.push({ id: "tme_open", memberId: THIAGO, start: new Date().toISOString(), createdBy: { kind: "member", id: THIAGO } });

    trashTask(state, THIAGO, "tsk_seed_1");

    expect(task?.timeEntries.find((e) => e.id === "tme_open")?.end).toBeDefined();
  });

  it("deriva o estado efetivo do ancestral sem reescrever o estado próprio", () => {
    const list = state.lists.find((l) => l.id === "lst_ativacao");
    if (list) list.lifecycle = "arquivado";

    expect(effectiveLifecycleOfTask(state, "tsk_seed_3")).toBe("arquivado");
    expect(state.tasks.find((t) => t.id === "tsk_seed_3")?.lifecycle).toBe("ativo");
  });
});

describe("Conversa na lixeira (RN-CXE-33)", () => {
  it("só aceita Conversa resolvida", async () => {
    const { trashConversation } = await import("./conversations");
    const open = state.conversations.find((c) => c.state === "aberta");
    if (!open) throw new Error("seed sem Conversa aberta");

    const result = trashConversation(state, THIAGO, open.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("resolvida");

    resolveConversation(state, THIAGO, open.id);
    expect(trashConversation(state, THIAGO, open.id).ok).toBe(true);
  });
});

describe("Sucessão na remoção de Membro (B28, B87)", () => {
  it("antecipa o que será transferido e o que será liberado", () => {
    const preview = previewSuccession(state, "mem_marcos");

    expect(preview.transfers.length).toBeGreaterThan(0);
    expect(preview.releases.length).toBeGreaterThan(0);
    expect(preview.chatSessions).toBeGreaterThan(0);
  });

  it("recusa remover o Proprietário do Espaço de Trabalho sem transferência prévia", () => {
    const result = removeMember(state, THIAGO, THIAGO, RAFAEL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Transfira a propriedade");
  });

  it("recusa Sucessor de base Convidado", () => {
    const result = removeMember(state, THIAGO, "mem_marcos", "mem_beatriz");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("sucessor");
  });

  it("transfere propriedades, libera responsabilidades e manda as Sessões à lixeira", () => {
    const ownedBefore = state.automations.filter((a) => a.ownerMemberId === "mem_marcos").length;
    expect(ownedBefore).toBeGreaterThan(0);

    const result = removeMember(state, THIAGO, "mem_marcos", RAFAEL);

    expect(result.ok).toBe(true);
    expect(state.members.find((m) => m.id === "mem_marcos")?.state).toBe("removido");
    expect(state.members.find((m) => m.id === "mem_marcos")?.successorId).toBe(RAFAEL);
    expect(state.automations.filter((a) => a.ownerMemberId === "mem_marcos")).toHaveLength(0);
    expect(state.automations.filter((a) => a.ownerMemberId === RAFAEL).length).toBeGreaterThanOrEqual(ownedBefore);
    // A Automação continua `ativo` sob o teto do Sucessor (DO-AUT-14).
    expect(state.automations.find((a) => a.id === "aut_revisao")?.lifecycle).toBe("pausado");
    // Nenhuma Tarefa continua com ele como Responsável.
    expect(state.tasks.some((t) => t.assignees.some((x) => x.id === "mem_marcos"))).toBe(false);
    // As Sessões foram para a lixeira, nunca sucedidas (B87).
    expect(state.chatSessions.filter((s) => s.ownerMemberId === "mem_marcos").every((s) => s.lifecycle === "naLixeira")).toBe(true);
    // A autoria histórica permanece (A6.4).
    expect(state.activity.some((a) => a.actor.id === "mem_marcos" || a.objectId === "mem_marcos")).toBe(true);
  });
});

describe("Aprovação (B80, RN-AGE-17)", () => {
  it("recusa quem não é o aprovador designado", () => {
    const result = decideApproval(state, JULIA, "apr_1", "aprovada");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("aprovador designado");
  });

  it("aprova o objeto fixo e conclui a Execução", () => {
    const result = decideApproval(state, THIAGO, "apr_1", "aprovada");

    expect(result.ok).toBe(true);
    expect(state.approvals.find((a) => a.id === "apr_1")?.decision).toBe("aprovada");
    expect(state.agentExecutions.find((e) => e.id === "exe_2")?.state).toBe("concluida");
  });

  it("expira e cancela a Execução quando o prazo venceu, com Registro de Atividade", () => {
    const approval = state.approvals.find((a) => a.id === "apr_1");
    if (approval) Object.assign(approval, { deadline: new Date(Date.now() - 1000).toISOString() });
    const before = state.activity.length;

    const result = decideApproval(state, THIAGO, "apr_1", "aprovada");

    expect(result.ok).toBe(false);
    expect(state.approvals.find((a) => a.id === "apr_1")?.decision).toBe("expirada");
    expect(state.agentExecutions.find((e) => e.id === "exe_2")?.state).toBe("cancelada");
    // A expiração produz efeito, logo produz Registro — e o ator é o Sistema.
    expect(state.activity.length).toBe(before + 1);
    expect(state.activity[0]?.action).toBe("Solicitação de Aprovação expirada");
    expect(state.activity[0]?.actor.kind).toBe("system");
  });

  it("não deixa quem não pode decidir cancelar a Execução pelo vencimento", () => {
    const approval = state.approvals.find((a) => a.id === "apr_1");
    if (approval) Object.assign(approval, { deadline: new Date(Date.now() - 1000).toISOString() });
    const executionBefore = state.agentExecutions.find((e) => e.id === "exe_2")?.state;

    // Beatriz é Convidada: não é a aprovadora, não é dona do Agente, não é Administradora.
    const result = decideApproval(state, "mem_beatriz", "apr_1", "aprovada");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("aprovador designado");
    // Nada foi gravado: a autorização vem antes do efeito.
    expect(state.approvals.find((a) => a.id === "apr_1")?.decision).toBeUndefined();
    expect(state.agentExecutions.find((e) => e.id === "exe_2")?.state).toBe(executionBefore);
  });
});

describe("Publicação de Automação (RN-AUT-07, DO-AUT-19)", () => {
  it("recusa publicar sem Ação e não produz efeito", () => {
    const automation = state.automations.find((a) => a.id === "aut_rascunho");
    const draft = automation?.versions.find((v) => v.state === "rascunho");
    if (draft) draft.actions = [];

    const result = publishAutomation(state, RAFAEL, "aut_rascunho");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("acoes");
    expect(draft?.state).toBe("rascunho");
  });

  it("recusa publicar com Habilidade não concedida ao Agente, nomeando as duas", () => {
    const automation = state.automations.find((a) => a.id === "aut_rascunho");
    const draft = automation?.versions.find((v) => v.state === "rascunho");
    if (draft) {
      draft.actions = [
        { order: 0, kind: "controle", controlKind: "invocarAgente", params: "resumir", agentId: "agt_redator", skillId: "skl_qualificar" },
      ];
    }

    const result = publishAutomation(state, RAFAEL, "aut_rascunho");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Qualificar lead");
    expect(result.error).toContain("Redator de propostas");
  });

  it("publica e torna a versão anterior obsoleta no mesmo ato", () => {
    const automation = state.automations.find((a) => a.id === "aut_boasvindas");
    if (!automation) throw new Error("seed sem Automação");
    automation.versions.push({
      number: 2,
      state: "rascunho",
      trigger: { kind: "evento", eventType: "conversaCriada" },
      conditions: [],
      actions: [{ order: 0, kind: "escrita", toolId: "criar_tarefa", params: "acompanhar" }],
      errorPolicy: { onActionFailure: "interromper", retries: 0 },
      createdAt: new Date().toISOString(),
    });

    const result = publishAutomation(state, JULIA, "aut_boasvindas");

    expect(result.ok).toBe(true);
    expect(automation.versions.find((v) => v.number === 1)?.state).toBe("obsoleta");
    expect(automation.versions.find((v) => v.number === 2)?.state).toBe("publicada");
  });
});

describe("Quem publica uma Versão de Automação (documento 12, 12.2)", () => {
  const comRascunho = () => {
    const automation = state.automations.find((a) => a.versions.some((v) => v.state === "rascunho"));
    if (!automation) throw new Error("seed sem Automação com rascunho");
    return automation;
  };

  it("recusa um Convidado, que não tem nada sobre Automação por Papel", () => {
    const automation = comRascunho();
    const convidado = state.members.find(
      (m) => state.roles.find((r) => r.id === m.roleId)?.base === "convidado" && m.state === "ativo",
    );
    if (!convidado) throw new Error("seed sem Membro de base Convidado");

    const result = publishAutomation(state, convidado.id, automation.id);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("administrar");
    expect(automation.versions.every((v) => v.state !== "publicada")).toBe(true);
  });

  it("recusa um Membro removido", () => {
    const automation = comRascunho();
    const removido = state.members.find((m) => m.state === "removido");
    if (!removido) throw new Error("seed sem Membro removido");

    const result = publishAutomation(state, removido.id, automation.id);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("Membro ativo");
  });

  it("aceita o Proprietário da Automação e leva o rascunho a publicada", () => {
    const automation = comRascunho();

    const result = publishAutomation(state, automation.ownerMemberId, automation.id);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.state).toBe("publicada");
    expect(automation.lifecycle).toBe("ativo");
  });

  it("recusa antes de olhar o rascunho: quem não pode publicar não descobre o que falta nele", () => {
    const automation = comRascunho();
    const rascunho = automation.versions.find((v) => v.state === "rascunho");
    if (!rascunho) throw new Error("sem rascunho");
    const semGatilho = { ...rascunho };
    delete (semGatilho as { trigger?: unknown }).trigger;
    automation.versions[automation.versions.indexOf(rascunho)] = semGatilho;
    const convidado = state.members.find(
      (m) => state.roles.find((r) => r.id === m.roleId)?.base === "convidado" && m.state === "ativo",
    );
    if (!convidado) throw new Error("seed sem Membro de base Convidado");

    const result = publishAutomation(state, convidado.id, automation.id);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("administrar");
    expect(result.error).not.toContain("Gatilho");
  });
});

describe("Restauração de Agente (B94)", () => {
  it("devolve `pausado`, nunca `ativo`", () => {
    const agent = state.agents.find((a) => a.id === "agt_sdr");
    if (!agent) throw new Error("seed sem Agente");
    agent.lifecycle = "naLixeira";
    agent.lifecycleBeforeTrashAi = "ativo";

    const result = restoreAgent(state, RAFAEL, "agt_sdr");

    expect(result.ok).toBe(true);
    expect(agent.lifecycle).toBe("pausado");
  });
});

describe("Leitura de Widget e permissões do visualizador (RN-PAI-15, RN-PAI-13, B38a)", () => {
  const CONVIDADA = "mem_beatriz";

  const widgetDe = (panelId: string, widgetId: string) => {
    const panel = state.panels.find((p) => p.id === panelId);
    const widget = panel?.widgets.find((w) => w.id === widgetId);
    if (!widget) throw new Error(`seed sem widget ${widgetId}`);
    return widget;
  };

  it("conta Negócios por Etapa e nomeia cada Etapa, não o identificador", () => {
    const reading = widgetReading(state, widgetDe("pnl_sdr", "wg_sdr_funil"), THIAGO, new Date());

    expect(reading.kind).toBe("serie");
    if (reading.kind !== "serie") throw new Error("esperava série");
    expect(reading.rows.length).toBeGreaterThan(0);
    const funil = state.funnels.find((f) => f.id === "fnl_sdr");
    for (const row of reading.rows) {
      expect(funil?.stages.some((stage) => stage.name === row.label)).toBe(true);
    }
    const somaDaSerie = reading.rows.reduce((total, row) => total + row.value, 0);
    const abertosNoFunil = state.deals.filter(
      (d) => d.funnelId === "fnl_sdr" && d.lifecycle === "ativo",
    );
    expect(somaDaSerie).toBe(abertosNoFunil.length);
  });

  it("soma dinheiro por moeda e nunca consolida (RN-PAI-13)", () => {
    const reading = widgetReading(state, widgetDe("pnl_closer", "wg_clo_valor"), THIAGO, new Date());

    expect(reading.kind).toBe("moeda");
    if (reading.kind !== "moeda") throw new Error("esperava moeda");
    expect(reading.byCurrency.length).toBeGreaterThan(0);
    for (const entry of reading.byCurrency) {
      expect(entry.currency).not.toBe("");
      const esperado = state.deals
        .filter((d) => d.funnelId === "fnl_closer" && d.lifecycle === "ativo")
        .filter((d) => d.value?.currency === entry.currency)
        .reduce((total, d) => total + (d.value?.amount ?? 0), 0);
      expect(entry.amount).toBe(esperado);
    }
  });

  it("devolve semAcesso, e não zero, quando o visualizador não alcança a Fonte", () => {
    const widget = widgetDe("pnl_ops", "wg_6");
    // A Convidada não tem concessão no Espaço de escopo deste Widget.
    expect(memberSeesResource(state, CONVIDADA, "spc_ops")).toBe(false);

    const reading = widgetReading(state, widget, CONVIDADA, new Date());

    expect(reading.kind).toBe("semAcesso");
    // E a mesma leitura, para quem alcança, traz número: zero seria mentira.
    const daProprietaria = widgetReading(state, widget, THIAGO, new Date());
    expect(daProprietaria.kind).toBe("serie");
  });

  it("B38a — um contêiner privado não existe nem para o Proprietário do Espaço de Trabalho", () => {
    const privado = state.spaces.find((space) => space.isPrivate);
    if (!privado) throw new Error("seed sem contêiner privado");
    const temConcessao = state.grants.some(
      (g) => g.resourceId === privado.id && g.subjectKind === "member" && g.subjectId === THIAGO,
    );

    expect(memberSeesResource(state, THIAGO, privado.id)).toBe(temConcessao);
  });
});

describe("Criação de contêiner (A3, A3.4, RN-ESP-03, B38a)", () => {
  const CONVIDADA = "mem_beatriz";

  it("cria Espaço com Conjunto de Status próprio, senão nada abaixo dele receberia Tarefa", () => {
    const result = createSpace(state, THIAGO, { name: "Novo Espaço" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.statusSet.definitions.some((d) => d.category === "naoIniciado")).toBe(true);
    expect(result.value.statusSet.definitions.some((d) => d.category === "fechado")).toBe(true);
    // E uma Lista criada nele já tem configuração efetiva.
    const lista = createList(state, THIAGO, {
      name: "Primeira",
      parentType: "space",
      parentId: result.value.id,
    });
    expect(lista.ok).toBe(true);
    if (!lista.ok) throw new Error(lista.error);
    expect(effectiveListConfig(state, lista.value.id)).not.toBeNull();
  });

  it("A3.4 — recusa Pasta dentro de Subpasta, mesmo que a tela ofereça", () => {
    const pai = state.folders.find((f) => f.parentType === "space");
    if (!pai) throw new Error("seed sem Pasta de primeiro nível");
    const sub = createFolder(state, THIAGO, {
      name: "Subpasta de teste",
      parentType: "folder",
      parentId: pai.id,
    });
    expect(sub.ok).toBe(true);
    if (!sub.ok) throw new Error(sub.error);

    const terceira = createFolder(state, THIAGO, {
      name: "Terceiro nível",
      parentType: "folder",
      parentId: sub.value.id,
    });

    expect(terceira.ok).toBe(false);
    if (terceira.ok) throw new Error("deveria recusar");
    expect(terceira.error).toContain("Subpasta");
    expect(state.folders.some((f) => f.name === "Terceiro nível")).toBe(false);
  });

  it("B38a — um Espaço privado nasce com concessão para quem o criou, senão nasce inalcançável", () => {
    const result = createSpace(state, THIAGO, { name: "Reservado", isPrivate: true });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(memberSeesResource(state, THIAGO, result.value.id)).toBe(true);
    // E continua invisível para quem não recebeu nada.
    expect(memberSeesResource(state, CONVIDADA, result.value.id)).toBe(false);
  });

  it("recusa um Convidado, que alcança só o que foi compartilhado com ele", () => {
    const result = createList(state, CONVIDADA, {
      name: "Tentativa",
      parentType: "space",
      parentId: "spc_com",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("Convidado");
  });

  it("recusa nome repetido entre irmãos, e o repetido não entra", () => {
    const existente = state.lists.find((l) => l.parentType === "space");
    if (!existente) throw new Error("seed sem Lista direta em Espaço");
    const antes = state.lists.length;

    const result = createList(state, THIAGO, {
      name: existente.name.toUpperCase(),
      parentType: existente.parentType,
      parentId: existente.parentId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.field).toBe("nome");
    expect(state.lists).toHaveLength(antes);
  });

  it("instanciar Template cria a estrutura declarada e deixa Proveniência em cada peça", () => {
    const template = state.templates.find((t) => t.kind === "espaco" && t.creates?.folders?.length);
    if (!template) throw new Error("seed sem Template de Espaço com Pastas");

    const result = createSpace(state, THIAGO, { name: "Cliente Novo", templateId: template.id });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.provenance?.kind).toBe("template");
    expect(result.value.provenance?.sourceName).toBe(template.name);

    const criadas = state.folders.filter((f) => f.parentId === result.value.id);
    expect(criadas.map((f) => f.name).sort()).toEqual([...(template.creates?.folders ?? [])].sort());
    for (const pasta of criadas) {
      expect(pasta.provenance?.sourceId).toBe(template.id);
    }
  });

  it("A Proveniência é VALOR: renomear o Template depois não reescreve o que já nasceu", () => {
    const template = state.templates.find((t) => t.kind === "lista");
    if (!template) throw new Error("seed sem Template de Lista");
    const nomeOriginal = template.name;

    const lista = createList(state, THIAGO, {
      name: "Da fôrma",
      parentType: "space",
      parentId: "spc_com",
      templateId: template.id,
    });
    expect(lista.ok).toBe(true);
    if (!lista.ok) throw new Error(lista.error);

    // O catálogo muda; o registro criado não.
    const noCatalogo = state.templates.find((t) => t.id === template.id) as { name: string };
    noCatalogo.name = "Outro nome";

    expect(lista.value.provenance?.sourceName).toBe(nomeOriginal);
  });

  it("B47 — Template de Pasta com Subpastas não se instancia dentro de outra Pasta", () => {
    const template = state.templates.find((t) => t.kind === "pasta");
    if (!template) throw new Error("seed sem Template de Pasta");
    (template as { containsSubfolders?: boolean }).containsSubfolders = true;
    const pai = state.folders.find((f) => f.parentType === "space");
    if (!pai) throw new Error("seed sem Pasta de primeiro nível");
    const antes = state.folders.length;

    const result = createFolder(state, THIAGO, {
      name: "Com subpastas",
      parentType: "folder",
      parentId: pai.id,
      templateId: template.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("Espaço");
    expect(state.folders).toHaveLength(antes);
  });

  it("recusa Template do tipo errado", () => {
    const deTarefa = state.templates.find((t) => t.kind === "tarefa");
    if (!deTarefa) throw new Error("seed sem Template de Tarefa");

    const result = createList(state, THIAGO, {
      name: "Errada",
      parentType: "space",
      parentId: "spc_com",
      templateId: deTarefa.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.field).toBe("template");
  });

  it("respeita o Limite imposto de Espaços", () => {
    const limite = state.workspace.limits.spaces;
    let criados = 0;
    for (let i = 0; i < limite + 2; i += 1) {
      if (createSpace(state, THIAGO, { name: `Espaço ${i}` }).ok) criados += 1;
    }

    expect(state.spaces.filter((s) => s.lifecycle !== "naLixeira")).toHaveLength(limite);
    expect(criados).toBeLessThan(limite + 2);
  });
});

describe("Funil SDR → Closer (DO-FUN-11, B59, A7)", () => {
  const noEstagio = (stageId: string) => negocioEm(state, "fnl_sdr", stageId);

  it("recusa sair de Conexão sem o fato da conexão gravado, nomeando o campo", () => {
    const deal = noEstagio("sdr_conexao");
    deal.fieldValues = deal.fieldValues.filter((v) => v.definitionId !== "fd_conexao_em");

    const result = moveDealToStage(state, JULIA, deal.id, "sdr_qualificacao");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("Conexão confirmada em");
    expect(deal.stageId).toBe("sdr_conexao");
  });

  it("recusa sair de Qualificação enquanto faltar QUALQUER campo do roteiro", () => {
    const deal = noEstagio("sdr_qualificacao");
    // Tem a conexão, mas o roteiro está vazio.
    const result = moveDealToStage(state, JULIA, deal.id, "sdr_qualificado");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("Critério");
    expect(deal.stageId).toBe("sdr_qualificacao");
  });

  it("a passagem ao Closer muda Funil, Etapa e Proprietário no MESMO ato", () => {
    const deal = noEstagio("sdr_agendamento");
    const antes = { funil: deal.funnelId, dono: deal.ownerMemberId, historico: deal.stageHistory.length };

    const result = moveDealToFunnel(state, JULIA, deal.id, "fnl_closer", "clo_agendamento", RAFAEL);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(deal.funnelId).toBe("fnl_closer");
    expect(deal.stageId).toBe("clo_agendamento");
    expect(deal.ownerMemberId).toBe(RAFAEL);
    expect(antes.dono).not.toBe(RAFAEL);
    expect(antes.funil).toBe("fnl_sdr");

    // O Negócio mantém identidade e histórico: é o MESMO registro.
    const transicao = deal.stageHistory.at(-1);
    expect(deal.stageHistory).toHaveLength(antes.historico + 1);
    expect(transicao?.entryOrigin).toBe("mudancaDeFunil");
    expect(transicao?.fromFunnelId).toBe("fnl_sdr");
    expect(transicao?.toFunnelId).toBe("fnl_closer");
    const registro = state.activity.find((e) => e.action === "Negócio mudou de Funil");
    expect(registro?.before).toContain("SDR");
    expect(registro?.after).toContain("Closer");
  });

  it("recusa entregar ao Closer um Negócio que a Etapa de destino não aceita", () => {
    const deal = noEstagio("sdr_qualificado");
    // Proposta exige valor na entrada, e este Negócio não tem.
    const result = moveDealToFunnel(state, JULIA, deal.id, "fnl_closer", "clo_proposta", RAFAEL);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("valor");
    expect(deal.funnelId).toBe("fnl_sdr");
  });

  it("recusa entregar a um Convidado: Convidado não é Proprietário de registro", () => {
    const deal = noEstagio("sdr_agendamento");
    const convidada = state.members.find(
      (m) => state.roles.find((r) => r.id === m.roleId)?.base === "convidado" && m.state === "ativo",
    );
    if (!convidada) throw new Error("seed sem Membro de base Convidado");

    const result = moveDealToFunnel(state, JULIA, deal.id, "fnl_closer", "clo_agendamento", convidada.id);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("Convidado");
    expect(deal.funnelId).toBe("fnl_sdr");
  });

  it("o SDR não tem `ganho`: a saída positiva é a mudança de Funil", () => {
    const sdr = state.funnels.find((f) => f.id === "fnl_sdr");
    const closer = state.funnels.find((f) => f.id === "fnl_closer");

    // O SDR não exige valor ao ganhar porque ganhar ali não é o desfecho.
    expect(sdr?.closingRules.requireValueOnWin).toBe(false);
    expect(sdr?.closingRules.requireLossReason).toBe(true);
    // No Closer, `ganho` é a Venda: exige valor.
    expect(closer?.closingRules.requireValueOnWin).toBe(true);
    // E nenhuma Etapa se chama "Venda" ou "Desqualificado": situação e Motivo
    // não são Etapa (A4.4).
    const nomes = [...(sdr?.stages ?? []), ...(closer?.stages ?? [])].map((e) => e.name);
    expect(nomes).not.toContain("Venda");
    expect(nomes).not.toContain("Desqualificado");
    expect(state.catalog.some((c) => c.kind === "motivoPerda" && c.name === "Desqualificado")).toBe(true);
  });

  it("as Automações do processo estão publicadas e no escopo certo", () => {
    const doProcesso = state.automations.filter((a) => a.id.startsWith("aut_sdr_") || a.id.startsWith("aut_closer_"));

    expect(doProcesso.length).toBeGreaterThanOrEqual(7);
    for (const automacao of doProcesso) {
      const vigente = automacao.versions.find((v) => v.state === "publicada");
      expect(vigente).toBeDefined();
      expect(vigente?.trigger).toBeDefined();
      expect(vigente?.actions.length).toBeGreaterThan(0);
      // B41 — escopo delimita o Gatilho; nenhuma delas é de Espaço de Trabalho.
      expect(["funnel", "inbox"]).toContain(automacao.scopeType);
    }
  });

  it("o Agente que fala com o lead é supervisionado; o que só lê é autônomo", () => {
    const qualificador = state.agents.find((a) => a.id === "agt_sdr");
    const enriquecedor = state.agents.find((a) => a.id === "agt_enriquecedor");

    expect(qualificador?.versions.at(-1)?.autonomy).toBe("supervisionado");
    expect(enriquecedor?.versions.at(-1)?.autonomy).toBe("autonomo");
  });
});

describe("Volumes do seed (PRD II.7)", () => {
  it("entrega os volumes mínimos que a fase 6 precisa exercitar", () => {
    expect(state.spaces).toHaveLength(4); // + Gestão (Financeiro)
    expect(state.folders).toHaveLength(8); // + Financeiro + Meus negócios (espelho comercial)
    expect(state.lists).toHaveLength(14); // 7 na estrutura + 1 na lixeira + Contas a pagar + Contas a receber + 4 Listas de Funil
    expect(state.tasks.length).toBeGreaterThanOrEqual(55);
    expect(state.contacts.length).toBeGreaterThanOrEqual(30);
    expect(state.companies).toHaveLength(12);
    expect(state.deals).toHaveLength(19); // 4 abertos do Iallas (um por Funil) + 6 desqualificados no SDR + 9 encerrados no Closer
    expect(state.funnels).toHaveLength(4); // SDR, Closer, Validação Full Face Avançado e Venda direta
    expect(state.channels).toHaveLength(5); // + LinkedIn
    expect(state.queues).toHaveLength(2);
    expect(state.conversations).toHaveLength(21); // + a conversa de WhatsApp do Negócio de referência
    expect(state.agents).toHaveLength(6); // + Enriquecedor, Classificador de conexão e Agente de lançamento
    expect(state.skills).toHaveLength(9); // + as três do processo SDR
    expect(state.automations).toHaveLength(26); // 3 herdadas + 7 do SDR + 3 do Closer + 7 de Contas a pagar (A2–A7, A9) + 6 de Contas a receber (R2, R2b, R3–R6)
    expect(state.collections).toHaveLength(4); // + De-para Omie
    expect(state.documents).toHaveLength(16); // + De-para ClickUp → Omie
    expect(state.chatSessions).toHaveLength(6); // + a Sessão solta do Thiago, fora de pasta
    expect(state.panels).toHaveLength(4);
    expect(state.activity.length).toBeGreaterThanOrEqual(200);
  });

  it("inclui os casos limítrofes que os fluxos exigem", () => {
    expect(state.contacts.some((c) => c.lifecycle === "mesclado")).toBe(true);
    expect(state.contacts.some((c) => !c.firstName && !c.lastName)).toBe(true);
    // 2 soltas + 3 na Lista da lixeira, e as 3 não são iguais entre si: duas
    // foram na cascata, uma já estava lá antes.
    const naLixeira = state.tasks.filter((t) => t.lifecycle === "naLixeira");
    expect(naLixeira).toHaveLength(5);
    const lista = state.lists.find((l) => l.id === "lst_piloto");
    expect(naLixeira.filter((t) => t.trashedAt === lista?.trashedAt)).toHaveLength(2);
    expect(state.tasks.some((t) => t.lifecycle === "arquivado")).toBe(true);
    expect(state.channels.some((c) => c.connection === "desconectada")).toBe(true);
    expect(state.deals.filter((d) => d.situation === "ganho").length).toBeGreaterThanOrEqual(4);
    const perdidos = state.deals.filter((d) => d.situation === "perdido");
    expect(perdidos.length).toBeGreaterThanOrEqual(4);
    // RN-NEG: perder exige Motivo; um Negócio perdido sem Motivo é perda de informação.
    expect(perdidos.every((d) => d.lossReasonId !== undefined)).toBe(true);
    expect(state.members.some((m) => m.state === "removido")).toBe(true);
    expect(state.agents.some((a) => a.lifecycle === "ativo" && a.createdBy.kind === "system")).toBe(true);
  });
});

describe("Restauração de cópia de Contato mesclado (RN-CON-15)", () => {
  it("cria um registro NOVO e não reativa o absorvido", () => {
    const [survivor, absorbed] = state.contacts.filter((c) => c.lifecycle === "ativo");
    if (!survivor || !absorbed) throw new Error("seed sem dois Contatos ativos");
    const merged = mergeContacts(state, THIAGO, survivor.id, absorbed.id);
    expect(merged.ok).toBe(true);
    const before = state.contacts.length;

    const result = restoreMergedCopy(state, THIAGO, absorbed.id);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("deveria restaurar");
    expect(state.contacts.length).toBe(before + 1);
    // O absorvido permanece mesclado: restaurar não desfaz.
    expect(absorbed.lifecycle).toBe("mesclado");
    expect(absorbed.mergedIntoId).toBe(survivor.id);
    // A cópia aponta de onde veio, senão é indistinguível de uma duplicata.
    expect(result.value.provenance?.kind).toBe("copy");
    expect(result.value.provenance?.sourceId).toBe(absorbed.id);
    // INV-CON-02 — os Identificadores já são do sobrevivente; a cópia nasce sem.
    expect(result.value.identifiers).toEqual([]);
  });

  it("recusa restaurar de um Contato que não foi mesclado", () => {
    const active = state.contacts.find((c) => c.lifecycle === "ativo");
    if (!active) throw new Error("seed sem Contato ativo");

    const result = restoreMergedCopy(state, THIAGO, active.id);

    expect(result.ok).toBe(false);
  });
});

describe("Mover Conversa para outro Contato (RN-CXE-11)", () => {
  it("recusa quando o destino já tem Conversa não resolvida no mesmo Canal", () => {
    const open = state.conversations.filter((c) => c.lifecycle === "ativo" && c.state !== "resolvida");
    const pair = open.find((a) =>
      open.some((b) => b.id !== a.id && b.channelId === a.channelId && b.contactId !== a.contactId),
    );
    const other = pair
      ? open.find((b) => b.id !== pair.id && b.channelId === pair.channelId && b.contactId !== pair.contactId)
      : undefined;
    if (!pair || !other?.contactId) throw new Error("seed sem duas Conversas abertas no mesmo Canal");
    const wasContact = pair.contactId;

    const result = moveConversationToContact(state, THIAGO, pair.id, other.contactId);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("não resolvida");
    // Rejeitado ANTES de qualquer efeito.
    expect(pair.contactId).toBe(wasContact);
    expect(other.state).not.toBe("resolvida");
  });

  it("move e resolve a existente quando o ato pede", () => {
    const open = state.conversations.filter((c) => c.lifecycle === "ativo" && c.state !== "resolvida");
    const pair = open.find((a) =>
      open.some((b) => b.id !== a.id && b.channelId === a.channelId && b.contactId !== a.contactId),
    );
    const other = pair
      ? open.find((b) => b.id !== pair.id && b.channelId === pair.channelId && b.contactId !== pair.contactId)
      : undefined;
    if (!pair || !other?.contactId) throw new Error("seed sem duas Conversas abertas no mesmo Canal");
    const destination = other.contactId;

    const result = moveConversationToContact(state, THIAGO, pair.id, destination, true);

    expect(result.ok).toBe(true);
    expect(pair.contactId).toBe(destination);
    expect(other.state).toBe("resolvida");
    // INV-CXE-04 — o Canal nunca muda ao mover.
    expect(pair.channelId).toBe(other.channelId);
  });
});

describe("Exclusão de Papel personalizado (RN-ET-06, INV-ET-13)", () => {
  it("o seed traz Papel personalizado com titulares humanos e não humanos, senão D14 é inalcançável", () => {
    const custom = state.roles.filter((role) => !role.system);
    expect(custom.length).toBeGreaterThan(0);

    const comMembros = custom.filter((role) => roleHolders(state, role.id).members.length > 0);
    const comAgentes = custom.filter((role) => roleHolders(state, role.id).agents.length > 0);
    expect(comMembros.length).toBeGreaterThan(0);
    expect(comAgentes.length).toBeGreaterThan(0);
    // INV-ET-13 — nenhum Agente é titular de Papel com base de Administrador.
    for (const role of comAgentes) {
      expect(role.base).not.toBe("administrador");
      expect(role.base).not.toBe("proprietario");
    }
  });

  it("recusa excluir um Papel de sistema", () => {
    const system = state.roles.find((role) => role.system);
    if (!system) throw new Error("seed sem Papel de sistema");

    const result = deleteRole(state, THIAGO, system.id, {});

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("sistema");
    expect(state.roles.some((r) => r.id === system.id)).toBe(true);
  });

  it("exige Papel de destino para cada titular, e nada é escrito sem ele", () => {
    const custom = { id: "role_temp", workspaceId: state.workspace.id, name: "Analista", system: false, base: "membro" as const, permissions: [] };
    state.roles.push(custom);
    // Nunca a Membro que age: perder o Papel de Proprietária a impediria de
    // excluir, e o teste mediria a permissão em vez da regra do destino.
    const member = state.members.find((m) => m.state === "ativo" && m.id !== THIAGO);
    if (!member) throw new Error("seed sem outro Membro ativo");
    const originalRole = member.roleId;
    member.roleId = custom.id;

    const semDestino = deleteRole(state, THIAGO, custom.id, {});

    expect(semDestino.ok).toBe(false);
    expect(member.roleId).toBe(custom.id);
    expect(state.roles.some((r) => r.id === custom.id)).toBe(true);

    const comDestino = deleteRole(state, THIAGO, custom.id, { memberRoleId: originalRole });

    expect(comDestino.ok).toBe(true);
    expect(member.roleId).toBe(originalRole);
    expect(state.roles.some((r) => r.id === custom.id)).toBe(false);
  });

  it("recusa dar Administrador a um Agente", () => {
    const custom = { id: "role_agente", workspaceId: state.workspace.id, name: "Agente SDR", system: false, base: "membro" as const, permissions: [] };
    state.roles.push(custom);
    const agent = state.agents[0];
    if (!agent) throw new Error("seed sem Agente");
    agent.roleId = custom.id;
    const adminRole = state.roles.find((r) => r.base === "administrador" && r.system);
    if (!adminRole) throw new Error("seed sem Papel de Administrador");

    const result = deleteRole(state, THIAGO, custom.id, { agentRoleId: adminRole.id });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("Administrador");
    expect(agent.roleId).toBe(custom.id);
  });

  it("separa os titulares por tipo e exclui o Membro removido", () => {
    const custom = { id: "role_conta", workspaceId: state.workspace.id, name: "Conta", system: false, base: "membro" as const, permissions: [] };
    state.roles.push(custom);
    const active = state.members.find((m) => m.state === "ativo" && m.id !== THIAGO);
    const removed = state.members.find((m) => m.state === "removido");
    const agent = state.agents[0];
    if (!active || !removed || !agent) throw new Error("seed sem Membro ativo, removido e Agente");
    active.roleId = custom.id;
    removed.roleId = custom.id;
    agent.roleId = custom.id;

    const holders = roleHolders(state, custom.id);

    expect(holders.members.map((h) => h.id)).toEqual([active.id]);
    expect(holders.agents.map((h) => h.id)).toEqual([agent.id]);
    // A6.4 — o Membro removido não recebe Papel novo por este caminho.
    expect(holders.members.map((h) => h.id)).not.toContain(removed.id);
  });
});

describe("Ato de governança sobre Recurso privado (B38b)", () => {
  const privateSpace = () => state.spaces.find((space) => space.isPrivate) ?? state.spaces[0];

  it("exige motivo: um ato de governança nunca é silencioso", () => {
    const space = privateSpace();
    if (!space) throw new Error("seed sem Espaço");
    const before = state.grants.length;

    const result = grantGovernanceAccess(state, THIAGO, {
      subjectKind: "member",
      subjectId: RAFAEL,
      resourceType: "space",
      resourceId: space.id,
      actions: ["ver"],
      reason: "   ",
    });

    expect(result.ok).toBe(false);
    expect(state.grants.length).toBe(before);
  });

  it("concede e deixa Registro de Atividade COM o motivo", () => {
    const space = privateSpace();
    if (!space) throw new Error("seed sem Espaço");

    const result = grantGovernanceAccess(state, THIAGO, {
      subjectKind: "member",
      subjectId: RAFAEL,
      resourceType: "space",
      resourceId: space.id,
      actions: ["ver", "administrar"],
      reason: "Único administrador saiu da organização",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("deveria conceder");
    expect(result.value).toBe(2);
    const record = state.activity.find((a) => a.action.startsWith("Ato de governança"));
    expect(record?.detail).toBe("Único administrador saiu da organização");
    expect(record?.objectId).toBe(space.id);
  });

  it("não abre exceção para Sessão de Chat (DO-CHT-09)", () => {
    const session = state.chatSessions[0];
    if (!session) throw new Error("seed sem Sessão de Chat");

    const result = grantGovernanceAccess(state, THIAGO, {
      subjectKind: "member",
      subjectId: RAFAEL,
      resourceType: "chatSession",
      resourceId: session.id,
      actions: ["ver"],
      reason: "auditoria",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("pessoal");
  });

  it("recusa quem não governa", () => {
    const space = privateSpace();
    if (!space) throw new Error("seed sem Espaço");

    const result = grantGovernanceAccess(state, JULIA, {
      subjectKind: "member",
      subjectId: JULIA,
      resourceType: "space",
      resourceId: space.id,
      actions: ["ver"],
      reason: "quero ver",
    });

    expect(result.ok).toBe(false);
  });
});

describe("Importação de Contatos (documento 10, 12.1; RN-CON-20)", () => {
  it("nunca cria duplicata: rejeita a colisão quando o ator escolheu rejeitar", () => {
    const existing = state.contacts.find((c) => c.identifiers.length > 0);
    const identifier = existing?.identifiers[0];
    if (!existing || !identifier) throw new Error("seed sem Contato com Identificador");
    const before = state.contacts.length;

    const result = importContacts(
      state,
      THIAGO,
      [{ firstName: "Outra", lastName: "Pessoa", identifierType: identifier.type, identifierValue: identifier.displayValue }],
      { onCollision: "rejeitar" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("deveria importar");
    expect(result.value.created).toBe(0);
    expect(result.value.rejected).toHaveLength(1);
    expect(result.value.rejected[0]?.reason).toContain(existing.firstName);
    expect(state.contacts.length).toBe(before);
  });

  it("trata a colisão como atualização quando o ator escolheu isso", () => {
    const existing = state.contacts.find((c) => c.identifiers.length > 0);
    const identifier = existing?.identifiers[0];
    if (!existing || !identifier) throw new Error("seed sem Contato com Identificador");
    const before = state.contacts.length;

    const result = importContacts(
      state,
      THIAGO,
      [{ firstName: "Nome Novo", lastName: "Sobrenome", identifierType: identifier.type, identifierValue: identifier.displayValue }],
      { onCollision: "atualizar" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("deveria importar");
    expect(result.value.updated).toBe(1);
    expect(existing.firstName).toBe("Nome Novo");
    expect(state.contacts.length).toBe(before);
  });

  it("cria com Modo de criação `importacao` e rejeita linha sem nome, com o motivo", () => {
    const result = importContacts(
      state,
      THIAGO,
      [
        { firstName: "Pessoa Importada", lastName: "Silva" },
        { firstName: "   " },
      ],
      { onCollision: "rejeitar" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("deveria importar");
    expect(result.value.created).toBe(1);
    expect(result.value.rejected).toHaveLength(1);
    expect(result.value.rejected[0]?.reason).toContain("sem nome");
    const created = state.contacts.find((c) => c.firstName === "Pessoa Importada");
    expect(created?.creationMode).toBe("importacao");
  });

  it("para no Limite imposto de Contatos, com o balanço parcial", () => {
    const room = state.workspace.limits.contacts - state.contacts.filter((c) => c.lifecycle !== "mesclado").length;
    const rows = Array.from({ length: room + 3 }, (_, i) => ({ firstName: `Importado ${i}` }));

    const result = importContacts(state, THIAGO, rows, { onCollision: "rejeitar" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("deveria importar");
    expect(result.value.stoppedAtLimit).toBe(true);
    expect(result.value.created).toBe(room);
    expect(result.value.rejected[0]?.reason).toContain("Limite");
  });
});

describe("Convite de Membro (RN-ET-06, RN-ET-11, RN-ET-23, RN-ET-24)", () => {
  it("recusa conceder o Papel de Proprietário por convite", () => {
    const owner = state.roles.find((r) => r.base === "proprietario" && r.system);
    if (!owner) throw new Error("seed sem Papel de Proprietário");
    const before = state.members.length;

    const result = inviteMember(state, THIAGO, { email: "novo@empresa.com.br", roleId: owner.id });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("transferência de propriedade");
    expect(state.members.length).toBe(before);
  });

  it("recusa quem não governa", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");

    const result = inviteMember(state, JULIA, { email: "outro@empresa.com.br", roleId: role.id });

    expect(result.ok).toBe(false);
  });

  it("recusa um segundo convite para o mesmo e-mail", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");
    const primeiro = inviteMember(state, THIAGO, { email: "dup@empresa.com.br", roleId: role.id });
    expect(primeiro.ok).toBe(true);
    const before = state.members.length;

    // INV-ET-04 — no máximo um Membro por par (Usuário, Espaço de Trabalho).
    const segundo = inviteMember(state, THIAGO, { email: "dup@empresa.com.br", roleId: role.id });

    expect(segundo.ok).toBe(false);
    if (segundo.ok) throw new Error("deveria recusar");
    expect(segundo.error).toContain("pendente");
    expect(state.members.length).toBe(before);
  });

  it("reconvidar um removido reativa o MESMO Membro (RN-ET-11)", () => {
    const role = state.roles.find((r) => r.base === "membro");
    const successor = state.members.find((m) => m.state === "ativo" && m.id !== THIAGO);
    if (!role || !successor) throw new Error("seed sem Papel e Sucessor");
    const convite = inviteMember(state, THIAGO, { email: "vaievolta@empresa.com.br", roleId: role.id });
    if (!convite.ok) throw new Error("convite inicial falhou");
    convite.value.state = "removido";
    const before = state.members.length;

    const reconvite = inviteMember(state, THIAGO, {
      email: "vaievolta@empresa.com.br",
      roleId: role.id,
    });

    expect(reconvite.ok).toBe(true);
    if (!reconvite.ok) throw new Error("deveria reconvidar");
    expect(reconvite.value.id).toBe(convite.value.id);
    expect(state.members.length).toBe(before);
    expect(convite.value.state).toBe("pendente");
  });

  it("respeita o limite imposto, inclusive no reconvite", () => {
    const role = state.roles.find((r) => r.base === "membro");
    if (!role) throw new Error("seed sem Papel de Membro");
    const convite = inviteMember(state, THIAGO, { email: "teto@empresa.com.br", roleId: role.id });
    if (!convite.ok) throw new Error("convite inicial falhou");
    convite.value.state = "removido";
    // RN-ET-23 — o teto conta os não removidos, e reconvidar traz um de volta.
    Object.assign(state.workspace.limits, {
      members: state.members.filter((m) => m.state !== "removido").length,
    });

    const novo = inviteMember(state, THIAGO, { email: "acima@empresa.com.br", roleId: role.id });
    const reconvite = inviteMember(state, THIAGO, { email: "teto@empresa.com.br", roleId: role.id });

    expect(novo.ok).toBe(false);
    expect(reconvite.ok).toBe(false);
    expect(convite.value.state).toBe("removido");
  });
});

describe("Migração de Negócios entre Funis (RN-FUN-12, RN-FUN-13, RN-FUN-15)", () => {
  const twoFunnels = () => {
    const from = state.funnels.find((f) => state.deals.some((d) => d.funnelId === f.id));
    const to = state.funnels.find((f) => f.id !== from?.id && f.lifecycle === "ativo");
    if (!from || !to) throw new Error("seed sem dois Funis");
    return { from, to };
  };

  it("recusa sem mapeamento completo, sem escrever nada", () => {
    const { from, to } = twoFunnels();
    const before = state.deals.filter((d) => d.funnelId === from.id).length;

    const result = migrateDealsToFunnel(state, THIAGO, from.id, to.id, []);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("deveria recusar");
    expect(result.error).toContain("Etapa de destino");
    expect(state.deals.filter((d) => d.funnelId === from.id).length).toBe(before);
  });

  it("`abertos` deixa os encerrados; `todos` leva inclusive os da lixeira", () => {
    const { from, to } = twoFunnels();
    const target = to.stages[0];
    if (!target) throw new Error("Funil de destino sem Etapa");
    const mapping = from.stages.map((stage) => ({ fromStatusId: stage.id, toStatusId: target.id }));
    const closedBefore = state.deals.filter((d) => d.funnelId === from.id && d.situation !== "aberto").length;

    const abertos = migrateDealsToFunnel(state, THIAGO, from.id, to.id, mapping, "abertos");

    expect(abertos.ok).toBe(true);
    expect(state.deals.filter((d) => d.funnelId === from.id).length).toBe(closedBefore);

    const todos = migrateDealsToFunnel(state, THIAGO, from.id, to.id, mapping, "todos");

    expect(todos.ok).toBe(true);
    expect(state.deals.filter((d) => d.funnelId === from.id).length).toBe(0);
  });

  it("preserva a probabilidade ajustada à mão e registra a transição", () => {
    const { from, to } = twoFunnels();
    const target = to.stages[0];
    const deal = state.deals.find((d) => d.funnelId === from.id);
    if (!target || !deal) throw new Error("seed sem Negócio no Funil de origem");
    deal.overriddenProbability = 42;
    const mapping = from.stages.map((stage) => ({ fromStatusId: stage.id, toStatusId: target.id }));

    const result = migrateDealsToFunnel(state, THIAGO, from.id, to.id, mapping);

    expect(result.ok).toBe(true);
    // RN-FUN-08 / DO-NEG-05 — só uma progressão descarta o ajuste manual.
    expect(deal.overriddenProbability).toBe(42);
    expect(deal.funnelId).toBe(to.id);
    const transition = deal.stageHistory.at(-1);
    expect(transition?.entryOrigin).toBe("mudancaDeFunil");
    expect(transition?.fromFunnelId).toBe(from.id);
  });
});

describe("Criação de registro de CRM", () => {
  const CONVIDADA = "mem_beatriz";

  it("recusa Contato sem nome e sem Identificador — ele não seria ninguém", () => {
    const antes = state.contacts.length;
    const result = createContact(state, THIAGO, { firstName: "  ", lastName: "" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.error).toContain("nome");
    expect(state.contacts).toHaveLength(antes);
  });

  it("cria Contato só com Identificador e o guarda na forma canônica", () => {
    const result = createContact(state, THIAGO, {
      firstName: "",
      lastName: "",
      identifierType: "email",
      identifierValue: "  Novo.Lead@Exemplo.com  ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const identificador = result.value.identifiers[0];
    expect(identificador?.value).toBe("novo.lead@exemplo.com");
    expect(identificador?.displayValue).toBe("Novo.Lead@Exemplo.com");
    expect(identificador?.principal).toBe(true);
    expect(result.value.creationMode).toBe("manual");
  });

  it("recusa um Identificador que já pertence a outro Contato, nomeando o dono", () => {
    const dono = state.contacts.find((c) => c.identifiers.length > 0 && c.lifecycle === "ativo");
    if (!dono) throw new Error("seed sem Contato com Identificador");
    const identificador = dono.identifiers[0];
    if (!identificador) throw new Error("seed sem Identificador");

    const antes = state.contacts.length;
    const result = createContact(state, THIAGO, {
      firstName: "Homônimo",
      lastName: "Teste",
      identifierType: identificador.type,
      identifierValue: identificador.displayValue,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.error).toContain(dono.firstName);
    expect(state.contacts).toHaveLength(antes);
  });

  it("recusa criação por Convidado, em qualquer das três famílias", () => {
    expect(createContact(state, CONVIDADA, { firstName: "Ana", lastName: "Teste" }).ok).toBe(false);
    expect(createCompany(state, CONVIDADA, { tradeName: "Teste", legalName: "" }).ok).toBe(false);
    expect(
      createDeal(state, CONVIDADA, { title: "Teste", funnelId: "fnl_sdr" }).ok,
    ).toBe(false);
  });

  it("recusa Empresa sem nome fantasia e sem razão social", () => {
    const result = createCompany(state, THIAGO, { tradeName: " ", legalName: "" });

    expect(result.ok).toBe(false);
  });

  it("preenche o nome que faltou na Empresa com o que foi informado (INV-EMP-01)", () => {
    const result = createCompany(state, THIAGO, { tradeName: "", legalName: "Só Razão S.A." });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.tradeName).toBe("Só Razão S.A.");
    expect(result.value.legalName).toBe("Só Razão S.A.");
  });

  it("nasce o Negócio na primeira Etapa do Funil, com a transição no histórico", () => {
    const result = createDeal(state, THIAGO, { title: "Novo lead", funnelId: "fnl_sdr" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.stageId).toBe("sdr_novo");
    expect(result.value.situation).toBe("aberto");
    expect(result.value.stageHistory).toHaveLength(1);
    expect(result.value.stageHistory[0]?.entryOrigin).toBe("criacao");
  });

  it("recusa o Negócio quando a primeira Etapa tem Requisito de entrada não cumprido (B59)", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_sdr");
    const primeira = funil?.stages.find((s) => s.id === "sdr_novo");
    if (!primeira) throw new Error("seed sem a Etapa Novo Lead");
    primeira.requirements = [{ moment: "entrada", kind: "contatoObrigatorio" }];

    const antes = state.deals.length;
    const result = createDeal(state, THIAGO, { title: "Sem Contato", funnelId: "fnl_sdr" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.error).toContain("Novo Lead");
    expect(state.deals).toHaveLength(antes);
  });

  it("aceita o mesmo Negócio quando o Contato exigido vem junto na criação", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_sdr");
    const primeira = funil?.stages.find((s) => s.id === "sdr_novo");
    if (!primeira) throw new Error("seed sem a Etapa Novo Lead");
    primeira.requirements = [{ moment: "entrada", kind: "contatoObrigatorio" }];
    const contato = state.contacts.find((c) => c.lifecycle === "ativo");
    if (!contato) throw new Error("seed sem Contato ativo");

    const result = createDeal(state, THIAGO, {
      title: "Com Contato",
      funnelId: "fnl_sdr",
      contactId: contato.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.contactLinks[0]?.contactId).toBe(contato.id);
  });
});

describe("Limites, autorização e valor na criação de CRM", () => {
  const CONVIDADA = "mem_beatriz";

  it("recusa o Contato que passaria do Limite imposto, como a importação recusa", () => {
    const vivos = state.contacts.filter((c) => c.lifecycle !== "mesclado").length;
    // O Limite é imposto e imutável no tipo; o teste o aperta para o momento em
    // que ele seria consumido, que é o que a operação precisa respeitar.
    (state.workspace as { limits: { contacts: number } }).limits = {
      ...state.workspace.limits,
      contacts: vivos,
    };

    const result = createContact(state, THIAGO, { firstName: "Excedente", lastName: "Teste" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.error).toContain("Limite");
    expect(state.contacts.filter((c) => c.lifecycle !== "mesclado")).toHaveLength(vivos);
  });

  it("recusa Negócio com valor negativo ou não numérico", () => {
    const negativo = createDeal(state, JULIA, {
      title: "Negativo",
      funnelId: "fnl_closer",
      value: { amount: -5000, currency: "BRL" },
    });
    const naoNumero = createDeal(state, JULIA, {
      title: "NaN",
      funnelId: "fnl_closer",
      value: { amount: Number("abc"), currency: "BRL" },
    });

    expect(negativo.ok).toBe(false);
    expect(naoNumero.ok).toBe(false);
    expect(state.deals.some((d) => d.title === "Negativo")).toBe(false);
  });

  it("recusa que um Convidado vincule Contato ao Negócio, e não só que crie", () => {
    const deal = state.deals.find((d) => d.situation === "aberto" && d.lifecycle === "ativo");
    const contato = state.contacts.find((c) => c.lifecycle === "ativo");
    if (!deal || !contato) throw new Error("seed sem Negócio aberto ou Contato ativo");
    const antes = deal.contactLinks.length;

    const result = linkContactToDeal(state, CONVIDADA, deal.id, contato.id, "decisor");

    expect(result.ok).toBe(false);
    expect(deal.contactLinks).toHaveLength(antes);
  });

  it("recusa vincular Contato a Negócio encerrado ou na lixeira", () => {
    const ganho = state.deals.find((d) => d.situation === "ganho" && d.lifecycle === "ativo");
    const naLixeira = state.deals.find((d) => d.lifecycle === "naLixeira");
    const contato = state.contacts.find((c) => c.lifecycle === "ativo");
    if (!ganho || !naLixeira || !contato) throw new Error("seed sem os casos");

    expect(linkContactToDeal(state, JULIA, ganho.id, contato.id, "decisor").ok).toBe(false);
    expect(linkContactToDeal(state, JULIA, naLixeira.id, contato.id, "decisor").ok).toBe(false);
  });

  it("desvincula e passa o principal adiante, mas não deixa a Etapa sem o Contato que ela exige", () => {
    const deal = negocioEm(state, "fnl_sdr", "sdr_agendamento");
    const outro = state.contacts.find(
      (c) => c.lifecycle === "ativo" && !deal?.contactLinks.some((l) => l.contactId === c.id),
    );
    if (!outro) throw new Error("seed sem outro Contato ativo");
    expect(deal.stageId).toBe("sdr_agendamento");

    const unico = deal.contactLinks[0];
    if (!unico) throw new Error("esperava um Contato vinculado");
    const recusa = unlinkContactFromDeal(state, JULIA, deal.id, unico.id);
    expect(recusa.ok).toBe(false);
    if (recusa.ok) throw new Error("esperava recusa");
    expect(recusa.error).toContain("Agendamento");

    expect(linkContactToDeal(state, JULIA, deal.id, outro.id, "tecnico").ok).toBe(true);
    expect(unlinkContactFromDeal(state, JULIA, deal.id, unico.id).ok).toBe(true);
    expect(deal.contactLinks).toHaveLength(1);
    expect(deal.contactLinks[0]?.principal).toBe(true);
  });
});

describe("Abrir atendimento e vincular à Empresa", () => {
  it("abre a Conversa que o Contato novo ainda não tinha, e devolve a mesma na segunda chamada", () => {
    const criado = createContact(state, JULIA, {
      firstName: "Carlos",
      lastName: "Fluxo",
      identifierType: "identidadeDeWhatsApp",
      identifierValue: "+55 21 99123-4567",
    });
    if (!criado.ok) throw new Error(criado.error);

    const primeira = startConversation(state, JULIA, "chn_wpp", criado.value.id);
    expect(primeira.ok).toBe(true);
    if (!primeira.ok) throw new Error(primeira.error);
    expect(primeira.value.state).toBe("aberta");

    const segunda = startConversation(state, JULIA, "chn_wpp", criado.value.id);
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) throw new Error(segunda.error);
    expect(segunda.value.id).toBe(primeira.value.id);
  });

  it("recusa abrir atendimento num Canal que não alcança nenhum Identificador do Contato", () => {
    const criado = createContact(state, JULIA, { firstName: "Sem", lastName: "Instagram" });
    if (!criado.ok) throw new Error(criado.error);

    const result = startConversation(state, JULIA, "chn_insta", criado.value.id);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.error).toContain("Identificador");
  });

  it("vincula Contato à Empresa e mantém um só principal por Empresa (INV-EMP-04)", () => {
    const empresa = state.companies.find((c) => c.lifecycle === "ativo");
    const livre = state.contacts.find(
      (c) =>
        c.lifecycle === "ativo" &&
        !state.contactCompanyLinks.some((l) => l.contactId === c.id && l.companyId === empresa?.id),
    );
    if (!empresa || !livre) throw new Error("seed sem Empresa e Contato livres");

    const result = linkContactToCompany(state, JULIA, {
      contactId: livre.id,
      companyId: empresa.id,
      role: "Gerente de Marketing",
      principalForCompany: true,
    });

    expect(result.ok).toBe(true);
    const principais = state.contactCompanyLinks.filter(
      (l) => l.companyId === empresa.id && l.principalForCompany,
    );
    expect(principais).toHaveLength(1);
  });

  it("recusa o identificador de Empresa que já pertence a outra, nomeando a dona", () => {
    const dona = state.companies.find((c) => c.identifiers.some((i) => i.type === "dominio"));
    const outra = state.companies.find((c) => c.id !== dona?.id && c.lifecycle === "ativo");
    const dominio = dona?.identifiers.find((i) => i.type === "dominio");
    if (!dona || !outra || !dominio) throw new Error("seed sem os dois casos");

    const result = addCompanyIdentifier(state, JULIA, outra.id, "dominio", dominio.value);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.error).toContain(dona.tradeName || dona.legalName);
  });
});

describe("Leitura de Widget: dimensões comerciais, moeda e Filtro fixo", () => {
  const ler = (widget: Parameters<typeof widgetReading>[1]) =>
    widgetReading(state, widget, THIAGO, new Date());

  const fonte = {
    target: "deal",
    scopeType: "funnel",
    scopeIds: ["fnl_closer"],
  } as const;

  it("nomeia o Motivo de Perda e a Origem, nunca o identificador", () => {
    const porMotivo = ler({
      viewType: "barras",
      dataSource: fonte,
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Negócios" }],
      dimensions: [{ attribute: "lossReasonId", label: "Motivo" }],
    });

    expect(porMotivo.kind).toBe("serie");
    if (porMotivo.kind !== "serie") throw new Error("esperava série");
    for (const row of porMotivo.rows) {
      expect(state.catalog.some((c) => c.name === row.label)).toBe(true);
      expect(row.label).not.toMatch(/^cat_/);
    }
  });

  it("capitaliza a Situação em vez de mostrar o valor interno", () => {
    const reading = ler({
      viewType: "pizza",
      dataSource: fonte,
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Negócios" }],
      dimensions: [{ attribute: "situation", label: "Situação" }],
    });

    if (reading.kind !== "serie") throw new Error("esperava série");
    expect(reading.rows.map((r) => r.label).sort()).toEqual(["Aberto", "Ganho", "Perdido"]);
  });

  it("carrega a moeda na série de dinheiro, para o valor não sair como número puro", () => {
    const reading = ler({
      viewType: "barras",
      dataSource: fonte,
      metrics: [{ aggregation: "soma", attribute: "value", label: "Valor ganho" }],
      dimensions: [{ attribute: "closedAt", label: "Mês", timeGranularity: "mes" }],
    });

    if (reading.kind !== "serie") throw new Error("esperava série");
    expect(reading.currency).toBe("BRL");
  });

  it("recusa a série quando o recorte tem mais de uma moeda (RN-PAI-13)", () => {
    const emDolar = state.deals.find((d) => d.funnelId === "fnl_closer" && d.value);
    if (!emDolar) throw new Error("seed sem Negócio com valor no Closer");
    emDolar.value = { amount: 1_000, currency: "USD" };

    const reading = ler({
      viewType: "barras",
      dataSource: fonte,
      metrics: [{ aggregation: "soma", attribute: "value", label: "Valor" }],
      dimensions: [{ attribute: "closedAt", label: "Mês", timeGranularity: "mes" }],
    });

    expect(reading.kind).toBe("texto");
    if (reading.kind !== "texto") throw new Error("esperava recusa em texto");
    expect(reading.content).toContain("moedas");
  });

  it("aplica o Filtro fixo: o Widget rotulado 'em prospecção' não conta o que foi perdido", () => {
    const abertos = state.deals.filter(
      (d) => d.funnelId === "fnl_sdr" && d.lifecycle === "ativo" && d.situation === "aberto",
    ).length;

    const comFiltro = ler({
      viewType: "numero",
      dataSource: { target: "deal", scopeType: "funnel", scopeIds: ["fnl_sdr"] },
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Negócios" }],
      dimensions: [],
      fixedFilters: [
        { attribute: "situation", operator: "igualA", value: "Aberto", label: "Situação: aberto" },
      ],
    });
    const semFiltro = ler({
      viewType: "numero",
      dataSource: { target: "deal", scopeType: "funnel", scopeIds: ["fnl_sdr"] },
      metrics: [{ aggregation: "contagem", attribute: "id", label: "Negócios" }],
      dimensions: [],
    });

    if (comFiltro.kind !== "numero" || semFiltro.kind !== "numero") throw new Error("esperava número");
    expect(comFiltro.value).toBe(abertos);
    expect(semFiltro.value).toBeGreaterThan(comFiltro.value);
  });
});

describe("Qualificação e Temperatura do Contato", () => {
  const contatoAtivo = () => {
    const contato = state.contacts.find((c) => c.lifecycle === "ativo");
    if (!contato) throw new Error("seed sem Contato ativo");
    return contato;
  };

  it("grava a Temperatura do Catálogo e registra a mudança com o antes e o depois", () => {
    const contato = contatoAtivo();
    const anterior = state.catalog.find((c) => c.id === contato.temperatureId)?.name;

    const result = setContactCatalogValue(state, JULIA, contato.id, "temperatura", "cat_temp_frio");

    expect(result.ok).toBe(true);
    expect(contato.temperatureId).toBe("cat_temp_frio");
    const registro = state.activity[0];
    expect(registro?.action).toContain("Temperatura");
    expect(registro?.after).toBe("Frio");
    if (anterior) expect(registro?.before).toBe(anterior);
  });

  it("limpa o valor quando nenhum item é escolhido", () => {
    const contato = contatoAtivo();
    setContactCatalogValue(state, JULIA, contato.id, "qualificacao", undefined);
    expect(contato.qualificationId).toBeUndefined();
  });

  it("recusa um item que não é daquele tipo de Catálogo", () => {
    const contato = contatoAtivo();

    // `cat_temp_quente` é Temperatura: não serve como Qualificação.
    const result = setContactCatalogValue(
      state,
      JULIA,
      contato.id,
      "qualificacao",
      "cat_temp_quente",
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.error).toContain("Qualificação");
  });

  it("recusa um Convidado e um Contato que não está ativo", () => {
    const contato = contatoAtivo();
    expect(
      setContactCatalogValue(state, "mem_beatriz", contato.id, "temperatura", "cat_temp_frio").ok,
    ).toBe(false);

    const naLixeira = state.contacts.find((c) => c.lifecycle === "naLixeira");
    if (!naLixeira) throw new Error("seed sem Contato na lixeira");
    expect(
      setContactCatalogValue(state, JULIA, naLixeira.id, "temperatura", "cat_temp_frio").ok,
    ).toBe(false);
  });

  it("o Negócio e o seu Contato principal apontam para a mesma Empresa", () => {
    for (const deal of state.deals.filter((d) => d.funnelId === "fnl_sdr" && d.companyId)) {
      const vinculo = deal.contactLinks.find((l) => l.principal);
      if (!vinculo) continue;
      const empresaDoContato = state.contactCompanyLinks.find(
        (l) => l.contactId === vinculo.contactId && l.principalForContact && l.end === undefined,
      )?.companyId;
      expect(empresaDoContato).toBe(deal.companyId);
    }
  });
});

describe("Valor de Campo do Negócio (A5.1, B37)", () => {
  const aberto = () => {
    const deal = state.deals.find(
      (d) => d.funnelId === "fnl_sdr" && d.situation === "aberto" && d.lifecycle === "ativo",
    );
    if (!deal) throw new Error("seed sem Negócio aberto no SDR");
    return deal;
  };

  it("grava a opção escolhida e registra a mudança com o nome do Campo", () => {
    const deal = aberto();

    const result = setDealFieldValue(state, JULIA, deal.id, "fd_result_qual", "Qualificado");

    expect(result.ok).toBe(true);
    expect(deal.fieldValues.find((v) => v.definitionId === "fd_result_qual")?.value).toBe(
      "Qualificado",
    );
    expect(state.activity[0]?.action).toContain("Resultado da qualificação");
    expect(state.activity[0]?.after).toBe("Qualificado");
  });

  it("recusa valor fora das opções da Definição — a tela não inventa opção", () => {
    const deal = aberto();

    const result = setDealFieldValue(state, JULIA, deal.id, "fd_result_qual", "Talvez");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.error).toContain("Resultado da qualificação");
    expect(deal.fieldValues.some((v) => v.value === "Talvez")).toBe(false);
  });

  it("recusa Campo que não é de Negócio", () => {
    const deal = aberto();

    // `fd_resumo_perfil` é Campo de Contato.
    const result = setDealFieldValue(state, JULIA, deal.id, "fd_resumo_perfil", "texto");

    expect(result.ok).toBe(false);
  });

  it("recusa Convidado, Negócio encerrado e Valor arquivado (B37)", () => {
    const deal = aberto();
    expect(
      setDealFieldValue(state, "mem_beatriz", deal.id, "fd_result_qual", "Qualificado").ok,
    ).toBe(false);

    const ganho = state.deals.find((d) => d.situation === "ganho" && d.lifecycle === "ativo");
    if (!ganho) throw new Error("seed sem Negócio ganho");
    expect(setDealFieldValue(state, JULIA, ganho.id, "fd_result_qual", "Qualificado").ok).toBe(
      false,
    );

    deal.fieldValues.push({ definitionId: "fd_criterio", value: "antigo", state: "arquivado" });
    const arquivado = setDealFieldValue(state, JULIA, deal.id, "fd_criterio", "novo");
    expect(arquivado.ok).toBe(false);
    expect(deal.fieldValues.find((v) => v.definitionId === "fd_criterio")?.value).toBe("antigo");
  });

  it("limpa o Valor quando a escolha é esvaziada", () => {
    const deal = aberto();
    setDealFieldValue(state, JULIA, deal.id, "fd_result_qual", "Qualificado");

    const result = setDealFieldValue(state, JULIA, deal.id, "fd_result_qual", null);

    expect(result.ok).toBe(true);
    expect(deal.fieldValues.find((v) => v.definitionId === "fd_result_qual")?.value).toBeNull();
  });
});

describe("Roteiro de qualificação: os dois Critérios (documento do funil, seção 4)", () => {
  const ETAPA = "sdr_qualificacao";

  it("exige os SEIS campos na saída, e os dois Critérios estão entre eles", () => {
    const etapa = state.funnels
      .find((f) => f.id === "fnl_sdr")
      ?.stages.find((s) => s.id === ETAPA);
    if (!etapa) throw new Error("seed sem a Etapa Qualificação");

    const exigidos = etapa.requirements
      .filter((r) => r.moment === "saida" && r.kind === "campoPreenchido")
      .map((r) => r.fieldDefinitionId);

    expect(exigidos).toHaveLength(6);
    expect(exigidos).toContain("fd_criterio_fit");
    expect(exigidos).toContain("fd_criterio");
  });

  it("são dois Campos distintos, cada um com a sua pergunta escrita", () => {
    const fit = state.fieldDefinitions.find((d) => d.id === "fd_criterio_fit");
    const decisao = state.fieldDefinitions.find((d) => d.id === "fd_criterio");

    expect(fit?.name).toBe("Critério de fit");
    expect(decisao?.name).toBe("Critério de decisão");
    // Sem a pergunta escrita, cada pessoa preenche uma coisa no mesmo campo.
    expect(fit?.description).toBeTruthy();
    expect(decisao?.description).toBeTruthy();
    expect(fit?.description).not.toBe(decisao?.description);
  });

  it("não deixa sair da Qualificação faltando o Critério de fit, e nomeia o Campo", () => {
    const deal = state.deals.find((d) => d.stageId === ETAPA && d.situation === "aberto");
    if (!deal) throw new Error("seed sem Negócio em Qualificação");
    for (const definitionId of ["fd_criterio", "fd_dor", "fd_decisor"]) {
      const escrito = setDealFieldValue(state, JULIA, deal.id, definitionId, "preenchido");
      expect(escrito.ok).toBe(true);
    }
    // `fd_prazo` é seleção única: só aceita opção da Definição.
    expect(setDealFieldValue(state, JULIA, deal.id, "fd_prazo", "Até 30 dias").ok).toBe(true);
    expect(setDealFieldValue(state, JULIA, deal.id, "fd_orcamento", 10_000).ok).toBe(true);

    const semFit = moveDealToStage(state, JULIA, deal.id, "sdr_qualificado");
    expect(semFit.ok).toBe(false);
    if (semFit.ok) throw new Error("esperava recusa");
    expect(semFit.error).toContain("Critério de fit");

    setDealFieldValue(state, JULIA, deal.id, "fd_criterio_fit", "Indústria média, já anuncia");
    const comFit = moveDealToStage(state, JULIA, deal.id, "sdr_qualificado");
    if (!comFit.ok) throw new Error(comFit.error);
    expect(deal.stageId).toBe("sdr_qualificado");
  });
});

describe("Processo do Closer", () => {
  const ETAPAS = ["clo_agendamento", "clo_call", "clo_proposta", "clo_negociacao", "clo_fechamento"];

  it("tem cinco Etapas, e cada uma cobra o que só existe depois da anterior", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_closer");
    if (!funil) throw new Error("seed sem o Funil Closer");

    expect([...funil.stages].sort((a, b) => a.order - b.order).map((s) => s.id)).toEqual(ETAPAS);
    const exigido = (id: string, momento: "entrada" | "saida") =>
      funil.stages
        .find((s) => s.id === id)
        ?.requirements.filter((r) => r.moment === momento)
        .map((r) => r.fieldDefinitionId ?? r.kind);

    expect(exigido("clo_agendamento", "saida")).toContain("fd_data_reuniao");
    expect(exigido("clo_call", "saida")).toContain("fd_diagnostico");
    expect(exigido("clo_proposta", "entrada")).toContain("valorObrigatorio");
    expect(exigido("clo_proposta", "saida")).toContain("fd_plano");
    expect(exigido("clo_negociacao", "saida")).toContain("fd_objecao");
    expect(exigido("clo_fechamento", "entrada")).toContain("fd_pagamento");
  });

  /*
   * Um Negócio parado numa Etapa precisa ter cumprido o caminho até ela. Sem
   * esta garantia o seed nasce num estado impossível, e a primeira operação que
   * revalida a Etapa recusa por um motivo que ninguém provocou.
   */
  it("todo Negócio do Closer cumpre os Requisitos de entrada da Etapa onde está", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_closer");
    if (!funil) throw new Error("seed sem o Funil Closer");

    for (const deal of state.deals.filter((d) => d.funnelId === "fnl_closer")) {
      const etapa = funil.stages.find((s) => s.id === deal.stageId);
      if (!etapa) throw new Error(`Negócio ${deal.id} numa Etapa que não existe`);
      for (const requisito of etapa.requirements.filter((r) => r.moment === "entrada")) {
        if (requisito.kind === "valorObrigatorio") {
          expect(`${deal.id}: valor`).toBe(`${deal.id}: ${deal.value && deal.value.amount > 0 ? "valor" : "sem valor"}`);
        }
        if (requisito.kind === "contatoObrigatorio") {
          expect(`${deal.id}: ${deal.contactLinks.length > 0}`).toBe(`${deal.id}: true`);
        }
        if (requisito.kind === "campoPreenchido") {
          const valor = deal.fieldValues.find((v) => v.definitionId === requisito.fieldDefinitionId)?.value;
          expect(`${deal.id}/${requisito.fieldDefinitionId}: ${valor !== undefined && valor !== null && valor !== ""}`).toBe(
            `${deal.id}/${requisito.fieldDefinitionId}: true`,
          );
        }
      }
    }
  });

  it("cada Campo do Closer tem a pergunta escrita, e as opções que o produto usa", () => {
    const plano = state.fieldDefinitions.find((d) => d.id === "fd_plano");
    const pagamento = state.fieldDefinitions.find((d) => d.id === "fd_pagamento");
    const objecao = state.fieldDefinitions.find((d) => d.id === "fd_objecao");

    expect(plano?.options).toEqual(["Classic", "Pro", "Elite"]);
    expect(objecao?.options).toContain("Parcelamento");
    expect(pagamento?.options).toContain("Cartão em 12x");
    for (const definicao of [plano, pagamento, objecao]) {
      expect(definicao?.description).toBeTruthy();
    }
  });
  it("o Registro de transição diz a Etapa, e a passagem de Funil diz o Funil", () => {
    const daPassagem = state.activity.filter(
      (registro) => registro.action === "Negócio mudou de Funil",
    );
    expect(daPassagem.length).toBeGreaterThan(0);
    for (const registro of daPassagem) {
      // Os dois Funis têm uma Etapa "Agendamento": sem o prefixo do Funil a
      // linha leria "Agendamento → Agendamento".
      expect(registro.before).toMatch(/ · /);
      expect(registro.after).toMatch(/ · /);
      expect(registro.before).not.toEqual(registro.after);
    }

    // O nome do evento é UM só: a Auditoria busca por `action` em texto livre,
    // e dois nomes para o mesmo fato escondem metade dos registros.
    expect(
      state.activity.some((r) => r.action === "Negócio passou de Funil"),
    ).toBe(false);

    const deEtapa = state.activity.filter(
      (registro) => registro.action === "Negócio entrou em Etapa",
    );
    expect(deEtapa.length).toBeGreaterThan(0);
    for (const registro of deEtapa) {
      expect(registro.after).toBeTruthy();
    }
  });
  it("nenhuma coleção do seed tem id repetido", () => {
    const colecoes: ReadonlyArray<readonly [string, ReadonlyArray<{ readonly id: string }>]> = [
      ["tasks", state.tasks],
      ["deals", state.deals],
      ["contacts", state.contacts],
      ["companies", state.companies],
      ["conversations", state.conversations],
      ["activity", state.activity],
      ["members", state.members],
      ["lists", state.lists],
    ];
    for (const [nome, itens] of colecoes) {
      const repetidos = itens
        .map((item) => item.id)
        .filter((id, indice, todos) => todos.indexOf(id) !== indice);
      expect(repetidos, nome).toEqual([]);
    }
  });
  it("o Funil de Validação vai do sinal à venda, e cada Requisito aponta para um Campo que existe", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_validacao");
    expect(funil?.stages.map((etapa) => etapa.name)).toEqual([
      "Sinal pago",
      "Aguardando agendamento",
      "Call agendada",
      "Call realizada",
      "Em análise",
      "Aprovado",
      "Venda",
    ]);
    // Ganho é situação e reprovação é perda com Motivo — não são Etapas.
    expect(funil?.closingRules).toEqual({ requireLossReason: true, requireValueOnWin: true });
    expect(state.catalog.some((c) => c.kind === "motivoPerda" && c.name === "Não aprovado")).toBe(true);

    const campos = new Set(state.fieldDefinitions.map((d) => d.id));
    for (const f of state.funnels) {
      for (const etapa of f.stages) {
        for (const requisito of etapa.requirements) {
          if (requisito.fieldDefinitionId) {
            expect(campos.has(requisito.fieldDefinitionId), `${f.id}/${etapa.id}`).toBe(true);
          }
        }
      }
    }
  });
  it("a Venda direta vai do lead à negociação, e o Iallas está em Oferta apresentada com valor", () => {
    const funil = state.funnels.find((f) => f.id === "fnl_venda_direta");
    expect(funil?.stages.map((etapa) => etapa.name)).toEqual([
      "Novo lead",
      "Primeiro contato",
      "Em qualificação",
      "Oferta apresentada",
      "Em negociação",
    ]);
    const negocio = state.deals.find((d) => d.id === "deal_vd_1");
    expect(negocio?.stageId).toBe("vd_oferta");
    // Oferta apresentada exige valor na entrada: o seed não pode violar a própria Etapa.
    expect(negocio?.value?.amount).toBeGreaterThan(0);
  });
});

describe("Pastas de Chat", () => {
  it("a Sessão pode estar numa pasta ou solta, e só o dono organiza", () => {
    const pasta = createChatFolder(state, "mem_thiago", { name: "Clientes" });
    expect(pasta.ok).toBe(true);
    if (!pasta.ok) return;

    const guardada = moveChatSessionToFolder(state, "mem_thiago", "cht_6", pasta.value.id);
    expect(guardada.ok).toBe(true);
    expect(state.chatSessions.find((s) => s.id === "cht_6")?.folderId).toBe(pasta.value.id);

    const solta = moveChatSessionToFolder(state, "mem_thiago", "cht_6", null);
    expect(solta.ok).toBe(true);
    expect(state.chatSessions.find((s) => s.id === "cht_6")?.folderId).toBeUndefined();

    // DO-CHT-09 — nem o Proprietário mexe na Sessão ou na pasta de outro.
    const alheia = moveChatSessionToFolder(state, "mem_rafael", "cht_6", pasta.value.id);
    expect(alheia.ok).toBe(false);
    const naPastaAlheia = moveChatSessionToFolder(state, "mem_rafael", "cht_3", pasta.value.id);
    expect(naPastaAlheia.ok).toBe(false);
    expect(renameChatFolder(state, "mem_rafael", pasta.value.id, "Outra").ok).toBe(false);
  });

  it("nome repetido é recusado, e excluir a pasta solta as Sessões em vez de levá-las", () => {
    expect(createChatFolder(state, "mem_thiago", { name: "propostas" }).ok).toBe(false);
    expect(createChatFolder(state, "mem_thiago", { name: "   " }).ok).toBe(false);

    const dentro = state.chatSessions.filter((s) => s.folderId === "cfd_propostas").map((s) => s.id);
    expect(dentro.length).toBeGreaterThan(0);
    const excluida = deleteChatFolder(state, "mem_thiago", "cfd_propostas");
    expect(excluida.ok && excluida.value.released).toBe(dentro.length);
    expect(state.chatFolders.some((f) => f.id === "cfd_propostas")).toBe(false);
    for (const id of dentro) {
      const sessao = state.chatSessions.find((s) => s.id === id);
      expect(sessao?.lifecycle).toBe("ativo");
      expect(sessao?.folderId).toBeUndefined();
    }
  });
});

describe("Ajustes da Sessão de Chat", () => {
  it("pasta, plugin e Modelo mudam a qualquer hora; a Âncora só antes da primeira Mensagem", () => {
    const vazia = configureChatSession(state, "mem_thiago", "cht_6", {
      folderId: "cfd_propostas",
      skillId: "skl_qualificar",
      chosenModelId: "mdl_rapido",
      anchor: { type: "knowledgeDocument", id: "doc_11" },
    });
    expect(vazia.ok, vazia.ok ? "" : vazia.error).toBe(true);
    const sessao = state.chatSessions.find((s) => s.id === "cht_6");
    expect(sessao?.folderId).toBe("cfd_propostas");
    expect(sessao?.skillId).toBe("skl_qualificar");
    expect(sessao?.chosenModelId).toBe("mdl_rapido");
    expect(sessao?.anchor?.id).toBe("doc_11");

    // Modelo descontinuado e Habilidade de outro estado são recusados.
    expect(configureChatSession(state, "mem_thiago", "cht_6", { chosenModelId: "mdl_legado" }).ok).toBe(false);
    // Só o dono.
    expect(configureChatSession(state, "mem_rafael", "cht_6", { folderId: null }).ok).toBe(false);

    // B83 — com Mensagem, a Âncora fecha; o resto continua livre.
    expect(sendChatMessage(state, "mem_thiago", "cht_6", "Oi").ok).toBe(true);
    expect(configureChatSession(state, "mem_thiago", "cht_6", { anchor: null }).ok).toBe(false);
    expect(configureChatSession(state, "mem_thiago", "cht_6", { folderId: null }).ok).toBe(true);
    expect(sessao?.folderId).toBeUndefined();
  });
});

describe("Construtor de Agentes", () => {
  const rascunho = {
    name: "Assistente de Vendas",
    description: "Ajuda o time comercial",
    instructions: "Responda em português, sem inventar dados.",
    modelId: "" as const,
    allowedToolIds: ["ler_negocio"],
    icebreakers: ["Como posso ajudar?"],
    knowledgeSources: [{ kind: "url" as const, label: "https://exemplo.com/faq" }],
    responseFormat: "markdown" as const,
    accessPoints: ["chat" as const, "whatsapp" as const],
  };

  it("publica um Agente com a Versão 1, Papel Convidado e Modelo padrão", () => {
    const antes = state.agents.length;
    const result = createAgent(state, "mem_thiago", rascunho);
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(state.agents).toHaveLength(antes + 1);
    expect(result.value.lifecycle).toBe("ativo");
    expect(result.value.roleId).toBe("role_conv"); // B76
    expect(result.value.versions[0]?.number).toBe(1);
    expect(result.value.versions[0]?.modelId).toBe("padraoDaPlataforma");
    expect(result.value.versions[0]?.allowedToolIds).toEqual(["ler_negocio"]);
    // O que a tela configura chega à Versão — nada é descartado em silêncio.
    expect(result.value.versions[0]?.icebreakers).toEqual(["Como posso ajudar?"]);
    expect(result.value.versions[0]?.knowledgeSources).toEqual([{ kind: "url", label: "https://exemplo.com/faq" }]);
    expect(result.value.versions[0]?.responseFormat).toBe("markdown");
    expect(result.value.versions[0]?.accessPoints).toEqual(["chat", "whatsapp"]);
    expect(createAgent(state, "mem_thiago", { ...rascunho, name: "Outro", accessPoints: [] }).ok).toBe(false);
  });

  it("recusa sem nome, sem instruções, com Modelo descontinuado, Ferramenta inexistente ou nome repetido", () => {
    expect(createAgent(state, "mem_thiago", { ...rascunho, name: " " }).ok).toBe(false);
    expect(createAgent(state, "mem_thiago", { ...rascunho, instructions: "" }).ok).toBe(false);
    expect(createAgent(state, "mem_thiago", { ...rascunho, modelId: "mdl_legado" }).ok).toBe(false);
    expect(createAgent(state, "mem_thiago", { ...rascunho, allowedToolIds: ["nao_existe"] }).ok).toBe(false);
    expect(createAgent(state, "mem_thiago", { ...rascunho, name: "qualificador sdr" }).ok).toBe(false);
  });

  it("publicar de novo acrescenta a Versão 2 e mantém a 1 no histórico; só o dono publica", () => {
    const criado = createAgent(state, "mem_thiago", rascunho);
    if (!criado.ok) throw new Error(criado.error);
    const segunda = publishAgentVersion(state, "mem_thiago", criado.value.id, {
      ...rascunho,
      instructions: "Nova instrução.",
      modelId: "mdl_rapido",
    });
    expect(segunda.ok).toBe(true);
    const agente = state.agents.find((a) => a.id === criado.value.id);
    expect(agente?.versions.map((v) => v.number)).toEqual([1, 2]);
    expect(agente?.versions[0]?.instructions).toBe(rascunho.instructions);
    expect(agente?.versions[1]?.modelId).toBe("mdl_rapido");
    // Rafael administra o Espaço (17.2): pode publicar Versão de Agente alheio.
    const rafael = state.roles.find((r) => r.id === state.members.find((m) => m.id === "mem_rafael")?.roleId)?.base;
    expect(publishAgentVersion(state, "mem_rafael", criado.value.id, rascunho).ok).toBe(
      rafael === "administrador" || rafael === "proprietario",
    );
  });

  it("Convidado não publica Agente, e fonte de conhecimento sem nome ou base inexistente são recusadas", () => {
    expect(createAgent(state, "mem_beatriz", rascunho).ok).toBe(false);
    expect(createAgent(state, "mem_thiago", { ...rascunho, knowledgeSources: [{ kind: "url", label: " " }] }).ok).toBe(false);
    expect(createAgent(state, "mem_thiago", { ...rascunho, knowledgeSources: [{ kind: "base", label: "Não existe" }] }).ok).toBe(false);
  });
});

describe("Fase 0 — Tarefa editável", () => {
  const tarefaDe = (listId: string) => {
    const t = state.tasks.find((x) => x.listId === listId && x.lifecycle === "ativo" && !x.parentTaskId);
    if (!t) throw new Error(`sem tarefa ativa em ${listId}`);
    return t;
  };

  it("edita título, prioridade, datas e estimativa, um Registro por campo mudado", () => {
    const t = tarefaDe("lst_propostas");
    const antes = state.activity.length;
    const r = updateTask(state, "mem_thiago", t.id, {
      title: "  Proposta revisada  ",
      priority: "alta",
      startDate: { form: "civilDay", value: "2026-09-10" },
      dueDate: { form: "civilDay", value: "2026-09-20" },
      estimate: 90,
    });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(t.title).toBe("Proposta revisada");
    expect(t.priority).toBe("alta");
    expect(t.estimate).toBe(90);
    const novos = state.activity.slice(0, state.activity.length - antes).map((a) => a.action);
    expect(novos).toEqual(expect.arrayContaining(["Título alterado", "Prioridade alterada", "Início alterado", "Vencimento alterado", "Estimativa alterada"]));
    // Nada mudou → nenhum Registro novo.
    const depois = state.activity.length;
    expect(updateTask(state, "mem_thiago", t.id, { priority: "alta" }).ok).toBe(true);
    expect(state.activity.length).toBe(depois);
  });

  it("recusa título vazio, início depois do vencimento, estimativa negativa, Convidado e Tarefa na lixeira", () => {
    const t = tarefaDe("lst_propostas");
    expect(updateTask(state, "mem_thiago", t.id, { title: "   " }).ok).toBe(false);
    expect(updateTask(state, "mem_thiago", t.id, { startDate: { form: "civilDay", value: "2026-09-30" }, dueDate: { form: "civilDay", value: "2026-09-01" } }).ok).toBe(false);
    expect(updateTask(state, "mem_thiago", t.id, { estimate: -5 }).ok).toBe(false);
    expect(updateTask(state, "mem_beatriz", t.id, { title: "x" }).ok).toBe(false);
    const lixeira = state.tasks.find((x) => x.lifecycle === "naLixeira");
    expect(lixeira).toBeDefined();
    expect(updateTask(state, "mem_thiago", lixeira?.id ?? "", { title: "x" }).ok).toBe(false);
  });

  it("Valor de Campo: só Definições herdadas pela Lista; opções e números validados", () => {
    const t = tarefaDe("lst_propostas"); // em spc_com: herda fd_cliente e fd_centro
    expect(setTaskFieldValue(state, "mem_thiago", t.id, "fd_cliente", "Clínica Renovar").ok).toBe(true);
    expect(t.fieldValues.find((v) => v.definitionId === "fd_cliente")?.value).toBe("Clínica Renovar");
    expect(setTaskFieldValue(state, "mem_thiago", t.id, "fd_centro", "Jurídico").ok).toBe(false);
    expect(setTaskFieldValue(state, "mem_thiago", t.id, "fd_centro", "Comercial").ok).toBe(true);
    // fd_turma é da Lista de Revisões: não se aplica aqui, mesmo existindo.
    expect(setTaskFieldValue(state, "mem_thiago", t.id, "fd_turma", "2026.2").ok).toBe(false);
    // fd_horas é da Pasta Ativação: número.
    const ativacao = tarefaDe("lst_ativacao");
    expect(setTaskFieldValue(state, "mem_thiago", ativacao.id, "fd_horas", "muitas").ok).toBe(false);
    expect(setTaskFieldValue(state, "mem_thiago", ativacao.id, "fd_horas", 12).ok).toBe(true);
    // Campo de Negócio numa Tarefa é recusado.
    expect(setTaskFieldValue(state, "mem_thiago", t.id, "fd_plano", "Elite").ok).toBe(false);
  });

  it("Comentário: fio de um nível, Agente em nome de Membro, resolver só pela raiz", () => {
    const t = tarefaDe("lst_propostas");
    const raiz = addTaskComment(state, "mem_thiago", t.id, { content: "Falta o preço.", mentions: [{ type: "member", id: "mem_rafael" }] });
    expect(raiz.ok).toBe(true);
    if (!raiz.ok) return;
    const resposta = addTaskComment(state, "mem_rafael", t.id, { content: "Coloquei.", parentCommentId: raiz.value.id });
    expect(resposta.ok && resposta.value.parentCommentId).toBe(raiz.value.id);
    if (!resposta.ok) return;
    // Responder à resposta pendura no mesmo fio.
    const neta = addTaskComment(state, "mem_thiago", t.id, { content: "Valeu.", parentCommentId: resposta.value.id });
    expect(neta.ok && neta.value.parentCommentId).toBe(raiz.value.id);
    // Agente em nome do Membro.
    const doAgente = addTaskComment(state, "mem_thiago", t.id, { content: "Resumo pronto.", actor: { kind: "agent", id: "agt_redator" } });
    expect(doAgente.ok && doAgente.value.authorDelegate?.id).toBe("mem_thiago");
    expect(addTaskComment(state, "mem_thiago", t.id, { content: "  " }).ok).toBe(false);
    expect(addTaskComment(state, "mem_thiago", t.id, { content: "x", mentions: [{ type: "member", id: "mem_nao_existe" }] }).ok).toBe(false);
    expect(resolveTaskComment(state, "mem_thiago", t.id, resposta.value.id, true).ok).toBe(false);
    expect(resolveTaskComment(state, "mem_thiago", t.id, raiz.value.id, true).ok).toBe(true);
    expect(t.comments.find((c) => c.id === raiz.value.id)?.resolved?.by).toBe("mem_thiago");
  });

  it("Tags do Catálogo e Observadores", () => {
    const t = tarefaDe("lst_propostas");
    expect(setTaskTags(state, "mem_thiago", t.id, ["tag_urgente", "tag_urgente", "tag_renovacao"]).ok).toBe(true);
    expect(t.tagIds).toEqual(["tag_urgente", "tag_renovacao"]);
    expect(setTaskTags(state, "mem_thiago", t.id, ["tag_inexistente"]).ok).toBe(false);
    // Observar a si mesmo exige VER a Tarefa: Beatriz (Convidada) só alcança lst_conteudo.
    expect(watchTask(state, "mem_beatriz", t.id, "mem_beatriz", true).ok).toBe(false);
    expect(watchTask(state, "mem_julia", t.id, "mem_julia", true).ok).toBe(true);
    expect(t.observerMemberIds).toContain("mem_julia");
    // Pôr outro exige escrever; e o outro precisa ver a Tarefa.
    expect(watchTask(state, "mem_beatriz", t.id, "mem_rafael", true).ok).toBe(false);
    expect(watchTask(state, "mem_thiago", t.id, "mem_beatriz", true).ok).toBe(false);
    expect(watchTask(state, "mem_thiago", t.id, "mem_julia", false).ok).toBe(true);
    expect(t.observerMemberIds).not.toContain("mem_julia");
    // Resolver o fio de outro: só Administrador.
    const fio = addTaskComment(state, "mem_julia", t.id, { content: "Dúvida." });
    if (!fio.ok) throw new Error(fio.error);
    expect(resolveTaskComment(state, "mem_marcos", t.id, fio.value.id, true).ok).toBe(false);
    expect(resolveTaskComment(state, "mem_rafael", t.id, fio.value.id, true).ok).toBe(true);
    // multiSelect grava lista sem repetição; comentar como outro Membro é recusado.
    expect(addTaskComment(state, "mem_thiago", t.id, { content: "x", actor: { kind: "member", id: "mem_rafael" } }).ok).toBe(false);
  });
});

describe("Fase 1 — Campos e Status configuráveis", () => {
  it("Definição de Campo: criada no Espaço chega às Listas de baixo; nome repetido no caminho e opções repetidas são recusados", () => {
    expect(createFieldDefinition(state, "mem_thiago", { name: "Sprint", type: "singleSelect", options: ["S1", "S1"], definedAtType: "space", definedAtId: "spc_com" }).ok).toBe(false);
    const r = createFieldDefinition(state, "mem_thiago", { name: "Sprint", type: "singleSelect", options: ["S1", "S2"], definedAtType: "space", definedAtId: "spc_com" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(effectiveListConfig(state, "lst_propostas")?.fieldDefinitionIds).toContain(r.value.id);
    // "Cliente" já existe em spc_com: colide numa Lista de baixo também.
    expect(createFieldDefinition(state, "mem_thiago", { name: "cliente", type: "text", definedAtType: "list", definedAtId: "lst_propostas" }).ok).toBe(false);
    // Membro comum e Convidado não configuram.
    expect(createFieldDefinition(state, "mem_julia", { name: "X", type: "text", definedAtType: "space", definedAtId: "spc_com" }).ok).toBe(false);
    expect(createFieldDefinition(state, "mem_beatriz", { name: "X", type: "text", definedAtType: "space", definedAtId: "spc_com" }).ok).toBe(false);
  });

  it("Definição de Campo: opção em uso não sai; arquivar preserva o valor e tira da Lista", () => {
    const tarefa = state.tasks.find((t) => t.listId === "lst_propostas" && t.lifecycle === "ativo" && !t.parentTaskId);
    if (!tarefa) throw new Error("sem tarefa");
    expect(setTaskFieldValue(state, "mem_thiago", tarefa.id, "fd_centro", "Comercial").ok).toBe(true);
    expect(updateFieldDefinition(state, "mem_thiago", "fd_centro", { options: ["Operações", "Marketing"] }).ok).toBe(false);
    expect(updateFieldDefinition(state, "mem_thiago", "fd_centro", { options: ["Comercial", "Operações", "Marketing", "Jurídico"] }).ok).toBe(true);
    expect(archiveFieldDefinition(state, "mem_thiago", "fd_centro").ok).toBe(true);
    expect(effectiveListConfig(state, "lst_propostas")?.fieldDefinitionIds).not.toContain("fd_centro");
    expect(tarefa.fieldValues.find((v) => v.definitionId === "fd_centro")?.value).toBe("Comercial");
    expect(setTaskFieldValue(state, "mem_thiago", tarefa.id, "fd_centro", "Marketing").ok).toBe(false);
  });

  it("Status: adicionar, renomear, reordenar; remover exige destino e respeita o mínimo por categoria", () => {
    const novo = addStatus(state, "mem_thiago", "space", "spc_com", { name: "Aguardando cliente", color: "#f59e0b", category: "emAndamento" });
    expect(novo.ok, novo.ok ? "" : novo.error).toBe(true);
    if (!novo.ok) return;
    expect(addStatus(state, "mem_thiago", "space", "spc_com", { name: "aguardando cliente", color: "#000000", category: "emAndamento" }).ok).toBe(false);
    expect(updateStatus(state, "mem_thiago", "space", "spc_com", novo.value.id, { name: "Cliente" }).ok).toBe(true);
    const conjunto = state.spaces.find((s) => s.id === "spc_com")?.statusSet;
    if (!conjunto) throw new Error("sem conjunto");
    const ids = conjunto.definitions.map((d) => d.id);
    const invertido = [...ids].reverse();
    expect(reorderStatuses(state, "mem_thiago", "space", "spc_com", invertido).ok).toBe(true);
    expect(conjunto.definitions.map((d) => d.id)).toEqual(invertido);
    expect(reorderStatuses(state, "mem_thiago", "space", "spc_com", invertido.slice(1)).ok).toBe(false);

    // Remover um Status com Tarefas sem destino é recusado; com destino, move e registra.
    const emUso = conjunto.definitions.find((d) => state.tasks.some((t) => t.statusId === d.id));
    if (!emUso) throw new Error("sem status em uso");
    const quantas = state.tasks.filter((t) => t.statusId === emUso.id).length;
    const destino = conjunto.definitions.find((d) => d.id !== emUso.id && d.category === emUso.category) ?? conjunto.definitions.find((d) => d.id !== emUso.id);
    if (!destino) throw new Error("sem destino");
    expect(removeStatus(state, "mem_thiago", "space", "spc_com", emUso.id).ok).toBe(false);
    const removido = removeStatus(state, "mem_thiago", "space", "spc_com", emUso.id, destino.id);
    expect(removido.ok && removido.value.moved).toBe(quantas);
    expect(state.tasks.some((t) => t.statusId === emUso.id)).toBe(false);

    // O último “fechado” não sai.
    const fechados = conjunto.definitions.filter((d) => d.category === "fechado");
    for (const f of fechados.slice(1)) removeStatus(state, "mem_thiago", "space", "spc_com", f.id, fechados[0]?.id);
    expect(removeStatus(state, "mem_thiago", "space", "spc_com", fechados[0]?.id ?? "", conjunto.definitions[0]?.id).ok).toBe(false);
  });

  it("sobrescrever o Conjunto numa Lista copia o efetivo sem mudar o Status das Tarefas; Lista que herda não edita", () => {
    expect(addStatus(state, "mem_thiago", "list", "lst_propostas", { name: "X", color: "#000000", category: "emAndamento" }).ok).toBe(false);
    const antes = state.tasks.filter((t) => t.listId === "lst_propostas").map((t) => t.statusId);
    const r = overrideStatusSet(state, "mem_thiago", "list", "lst_propostas");
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(state.tasks.filter((t) => t.listId === "lst_propostas").map((t) => t.statusId)).toEqual(antes);
    expect(effectiveListConfig(state, "lst_propostas")?.statusSetDefinedAt.id).toBe("lst_propostas");
    expect(addStatus(state, "mem_thiago", "list", "lst_propostas", { name: "Só aqui", color: "#111111", category: "emAndamento" }).ok).toBe(true);
    expect(overrideStatusSet(state, "mem_thiago", "list", "lst_propostas").ok).toBe(false);
  });

  it("Tipo de Tarefa criado numa Pasta chega às Listas dela", () => {
    const r = createTaskType(state, "mem_rafael", { name: "Bug", icon: "bug", definedAtType: "space", definedAtId: "spc_com" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(effectiveListConfig(state, "lst_propostas")?.taskTypeIds).toContain(r.value.id);
    expect(createTaskType(state, "mem_rafael", { name: "bug", icon: "bug", definedAtType: "space", definedAtId: "spc_com" }).ok).toBe(false);
  });
});

describe("Fase 1 — revisão: alcance, bloqueio e caminho", () => {
  const tarefaAtiva = (listId: string) => {
    const t = state.tasks.find((x) => x.listId === listId && x.lifecycle === "ativo" && !x.parentTaskId);
    if (!t) throw new Error(`sem tarefa ativa em ${listId}`);
    return t;
  };

  it("Espaço privado: o Administrador sem concessão não configura nem escreve; a Convidada com `ver` na Lista alcança a Tarefa", () => {
    // spc_mkt é privado; Rafael (Administrador) não tem concessão; Thiago tem `administrar` direto.
    expect(memberReachesContainer(state, "mem_rafael", "list", "lst_conteudo")).toBe(false);
    expect(createFieldDefinition(state, "mem_rafael", { name: "Invasor", type: "text", definedAtType: "space", definedAtId: "spc_mkt" }).ok).toBe(false);
    expect(addStatus(state, "mem_rafael", "space", "spc_mkt", { name: "X", color: "#000000", category: "emAndamento" }).ok).toBe(false);
    const t = tarefaAtiva("lst_conteudo");
    expect(updateTask(state, "mem_julia", t.id, { title: "invadido" }).ok).toBe(false);
    expect(changeTaskStatus(state, "mem_julia", t.id, t.statusId).ok).toBe(false);
    expect(trashTask(state, "mem_julia", t.id).ok).toBe(false);
    // Beatriz (Convidada) tem `ver` em lst_conteudo: vê a Tarefa, pode observar; Thiago pode incluí-la.
    expect(memberSeesTask(state, "mem_beatriz", t.id)).toBe(true);
    expect(watchTask(state, "mem_beatriz", t.id, "mem_beatriz", true).ok).toBe(true);
    expect(watchTask(state, "mem_thiago", t.id, "mem_beatriz", true).ok).toBe(true);
    // Mas não escreve: Convidado não altera Tarefa.
    expect(changeTaskStatus(state, "mem_beatriz", t.id, t.statusId).ok).toBe(false);
    // Membro removido também não.
    expect(changeTaskStatus(state, "mem_tiago", tarefaAtiva("lst_propostas").id, tarefaAtiva("lst_propostas").statusId).ok).toBe(false);
  });

  it("concessão direta de `administrar` a um Membro comum permite configurar aquele contêiner", () => {
    expect(createFieldDefinition(state, "mem_julia", { name: "Da Júlia", type: "text", definedAtType: "space", definedAtId: "spc_com" }).ok).toBe(false);
    state.grants.push({ id: "gr_teste", workspaceId: state.workspace.id, subjectKind: "member", subjectId: "mem_julia", action: "administrar", resourceType: "space", resourceId: "spc_com", scope: "subarvore", origin: "concessaoDireta", grantedBy: "mem_thiago", grantedAt: new Date().toISOString() });
    expect(createFieldDefinition(state, "mem_julia", { name: "Da Júlia", type: "text", definedAtType: "space", definedAtId: "spc_com" }).ok).toBe(true);
    expect(createFieldDefinition(state, "mem_julia", { name: "Fora", type: "text", definedAtType: "space", definedAtId: "spc_ops" }).ok).toBe(false);
  });

  it("um aspecto bloqueado acima recusa definição abaixo (B25)", () => {
    // spc_mkt bloqueia fieldDefinitions no seed.
    expect(state.spaces.find((s) => s.id === "spc_mkt")?.blocks.fieldDefinitions).toBe(true);
    const r = createFieldDefinition(state, "mem_thiago", { name: "Bloqueado?", type: "text", definedAtType: "list", definedAtId: "lst_conteudo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/bloqueia/);
    // No próprio Espaço que bloqueia ainda se define.
    expect(createFieldDefinition(state, "mem_thiago", { name: "No Espaço", type: "text", definedAtType: "space", definedAtId: "spc_mkt" }).ok).toBe(true);
  });

  it("sobrescrever numa Pasta copia o que a PASTA herda, não o de uma Lista qualquer abaixo; voltar a herdar só cabe se toda Tarefa couber", () => {
    const antes = state.tasks.filter((t) => t.listId === "lst_renovacao").map((t) => t.statusId);
    const r = overrideStatusSet(state, "mem_thiago", "folder", "fld_clientes");
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const cfg = effectiveListConfig(state, "lst_renovacao");
    expect(cfg?.statusSetDefinedAt.id).toBe("fld_clientes");
    for (const id of antes) expect(cfg?.statusSet.definitions.some((d) => d.id === id)).toBe(true);
    // A subpasta Ativação continua com o próprio Conjunto.
    expect(effectiveListConfig(state, "lst_ativacao")?.statusSetDefinedAt.id).toBe("fld_ativacao");
    // O Espaço lê a si mesmo, não a primeira Lista abaixo.
    expect(effectiveContainerConfig(state, "space", "spc_com")?.statusSetDefinedAt.id).toBe("spc_com");
    expect(effectiveContainerConfig(state, "folder", "fld_renovacao")?.statusSetDefinedAt.id).toBe("fld_clientes");
    // Volta a herdar enquanto os ids coincidem; depois de um Status só daqui com Tarefa, não.
    expect(inheritStatusSet(state, "mem_thiago", "folder", "fld_clientes").ok).toBe(true);
    expect(effectiveListConfig(state, "lst_renovacao")?.statusSetDefinedAt.id).toBe("spc_com");
    expect(overrideStatusSet(state, "mem_thiago", "folder", "fld_clientes").ok).toBe(true);
    const novo = addStatus(state, "mem_thiago", "folder", "fld_clientes", { name: "Só aqui", color: "#111111", category: "emAndamento" });
    if (!novo.ok) throw new Error(novo.error);
    const t = state.tasks.find((x) => x.listId === "lst_renovacao" && x.lifecycle === "ativo");
    if (!t) throw new Error("sem tarefa");
    expect(changeTaskStatus(state, "mem_thiago", t.id, novo.value.id).ok).toBe(true);
    expect(inheritStatusSet(state, "mem_thiago", "folder", "fld_clientes").ok).toBe(false);
  });

  it("Tipo de Tarefa: nome único no caminho, não no Espaço de Trabalho; renomear e remover (só sem uso e nunca o padrão)", () => {
    // "Reunião" já existe em spc_com e spc_ops: em spc_mkt é outro caminho, então cabe.
    const reuniao = createTaskType(state, "mem_thiago", { name: "Reunião", icon: "users", definedAtType: "space", definedAtId: "spc_mkt" });
    expect(reuniao.ok, reuniao.ok ? "" : reuniao.error).toBe(true);
    // A Reunião é reconhecida pela plataforma: não se renomeia nem se remove.
    expect(updateTaskType(state, "mem_thiago", "tt_reuniao_com", { name: "Call" }).ok).toBe(false);
    expect(removeTaskType(state, "mem_thiago", "tt_reuniao_com").ok).toBe(false);
    const r = createTaskType(state, "mem_thiago", { name: "Chamado", icon: "phone", definedAtType: "space", definedAtId: "spc_mkt" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(createTaskType(state, "mem_thiago", { name: "chamado", icon: "phone", definedAtType: "list", definedAtId: "lst_conteudo" }).ok).toBe(false);
    expect(updateTaskType(state, "mem_thiago", r.value.id, { name: "Tarefa" }).ok).toBe(false);
    expect(updateTaskType(state, "mem_thiago", r.value.id, { name: "Encontro" }).ok).toBe(true);
    const t = tarefaAtiva("lst_conteudo");
    expect(updateTask(state, "mem_thiago", t.id, { taskTypeId: r.value.id }).ok).toBe(true);
    expect(updateTask(state, "mem_thiago", t.id, { taskTypeId: "tt_tarefa_com" }).ok).toBe(false);
    expect(removeTaskType(state, "mem_thiago", r.value.id).ok).toBe(false);
    expect(updateTask(state, "mem_thiago", t.id, { taskTypeId: "tt_tarefa_mkt" }).ok).toBe(true);
    expect(removeTaskType(state, "mem_thiago", r.value.id).ok).toBe(true);
    expect(removeTaskType(state, "mem_thiago", "tt_tarefa_mkt").ok).toBe(false);
  });

  it("renomear Campo colide como criar; arquivado se restaura", () => {
    expect(updateFieldDefinition(state, "mem_thiago", "fd_centro", { name: "Cliente" }).ok).toBe(false);
    expect(archiveFieldDefinition(state, "mem_thiago", "fd_centro").ok).toBe(true);
    expect(restoreFieldDefinition(state, "mem_thiago", "fd_centro").ok).toBe(true);
    expect(effectiveListConfig(state, "lst_propostas")?.fieldDefinitionIds).toContain("fd_centro");
    expect(restoreFieldDefinition(state, "mem_thiago", "fd_centro").ok).toBe(false);
  });

  it("datas: instante à noite no fuso local não cai no dia seguinte; datas contidas valem nos dois sentidos", () => {
    const t = tarefaAtiva("lst_propostas");
    const noite = new Date(2026, 8, 20, 23, 0).toISOString();
    expect(updateTask(state, "mem_thiago", t.id, { startDate: { form: "instant", value: noite }, dueDate: { form: "civilDay", value: "2026-09-20" } }).ok).toBe(true);
    const lista = state.lists.find((l) => l.id === "lst_propostas");
    if (!lista) throw new Error("sem lista");
    lista.features = { datasDeSubtarefasContidas: true };
    const filha = createTask(state, "mem_thiago", { listId: "lst_propostas", title: "Filha", parentTaskId: t.id, dueDate: { form: "civilDay", value: "2026-09-15" } });
    if (!filha.ok) throw new Error(filha.error);
    expect(updateTask(state, "mem_thiago", filha.value.id, { dueDate: { form: "civilDay", value: "2026-09-25" } }).ok).toBe(false);
    expect(updateTask(state, "mem_thiago", t.id, { dueDate: { form: "civilDay", value: "2026-09-10" } }).ok).toBe(false);
    expect(updateTask(state, "mem_thiago", t.id, { dueDate: { form: "civilDay", value: "2026-09-30" } }).ok).toBe(true);
  });

  it("mover exige alcançar a Lista de destino; criar Pasta/Lista exige alcançar o pai", () => {
    const t = tarefaAtiva("lst_propostas");
    expect(moveTask(state, "mem_julia", t.id, "lst_conteudo").ok).toBe(false);
    expect(createList(state, "mem_julia", { name: "Invasora", parentType: "space", parentId: "spc_mkt" }).ok).toBe(false);
    expect(createFolder(state, "mem_julia", { name: "Invasora", parentType: "space", parentId: "spc_mkt" }).ok).toBe(false);
    expect(createList(state, "mem_thiago", { name: "Nova em Marketing", parentType: "space", parentId: "spc_mkt" }).ok).toBe(true);
  });

  it("um aspecto bloqueado é visível à tela; Tipo criado numa Pasta vazia colide com o Espaço", () => {
    const pasta = createFolder(state, "mem_thiago", { name: "Vazia", parentType: "space", parentId: "spc_ops" });
    if (!pasta.ok) throw new Error(pasta.error);
    expect(createTaskType(state, "mem_thiago", { name: "Solo", icon: "circle", definedAtType: "folder", definedAtId: pasta.value.id }).ok).toBe(true);
    expect(createTaskType(state, "mem_thiago", { name: "Solo", icon: "circle", definedAtType: "space", definedAtId: "spc_ops" }).ok).toBe(false);
  });

  it("atribuir exige que o Membro veja a Tarefa (RN-TAR-06)", () => {
    const t = tarefaAtiva("lst_conteudo");
    expect(assignTask(state, "mem_thiago", t.id, { kind: "member", id: "mem_julia" }).ok).toBe(false);
    expect(assignTask(state, "mem_thiago", t.id, { kind: "member", id: "mem_beatriz" }).ok).toBe(true);
  });
});

describe("Fase 2 — colaboração na Tarefa", () => {
  const ativas = (listId: string) => state.tasks.filter((x) => x.listId === listId && x.lifecycle === "ativo" && !x.parentTaskId);

  it("Dependência: grava nas duas pontas, recusa ciclo por qualquer caminho e remove a inversa junto", () => {
    const [a, b, c] = ativas("lst_propostas");
    if (!a || !b || !c) throw new Error("precisa de 3 tarefas");
    expect(addDependency(state, "mem_thiago", a.id, "bloqueia", a.id).ok).toBe(false);
    const ab = addDependency(state, "mem_thiago", a.id, "bloqueia", b.id);
    expect(ab.ok, ab.ok ? "" : ab.error).toBe(true);
    expect(b.dependencies.some((d) => d.kind === "eBloqueadaPor" && d.taskId === a.id)).toBe(true);
    expect(addDependency(state, "mem_thiago", b.id, "bloqueia", c.id).ok).toBe(true);
    // C bloquear A fecharia A→B→C→A.
    const ciclo = addDependency(state, "mem_thiago", c.id, "bloqueia", a.id);
    expect(ciclo.ok).toBe(false);
    if (!ciclo.ok) expect(ciclo.error).toMatch(/ciclo/);
    // Escrito do outro lado também: A "é bloqueada por" C é o mesmo ciclo.
    expect(addDependency(state, "mem_thiago", a.id, "eBloqueadaPor", c.id).ok).toBe(false);
    // `aguarda` não bloqueia, então não fecha ciclo.
    expect(addDependency(state, "mem_thiago", c.id, "aguarda", a.id).ok).toBe(true);
    expect(addDependency(state, "mem_thiago", a.id, "bloqueia", b.id).ok).toBe(false);
    if (!ab.ok) return;
    expect(removeDependency(state, "mem_thiago", a.id, ab.value.id).ok).toBe(true);
    expect(b.dependencies.some((d) => d.taskId === a.id)).toBe(false);
    expect(addDependency(state, "mem_beatriz", a.id, "bloqueia", b.id).ok).toBe(false);
  });

  it("Dependência: nunca com a outra ponta invisível, nem entre mãe e filha; espelho de um lado só ainda conta no ciclo; a Lista da outra também precisa da funcionalidade", () => {
    const publica = ativas("lst_propostas")[0];
    const privada = state.tasks.find((t) => t.listId === "lst_conteudo" && t.lifecycle === "ativo" && !t.parentTaskId);
    if (!publica || !privada) throw new Error("sem tarefas");
    expect(addDependency(state, "mem_julia", publica.id, "eBloqueadaPor", privada.id).ok).toBe(false);
    expect(privada.dependencies.some((d) => d.taskId === publica.id)).toBe(false);
    // Mãe e filha (seed: tsk_seed_6 é filha de tsk_seed_3; tsk_seed_8 é neta).
    expect(addDependency(state, "mem_thiago", "tsk_seed_3", "eBloqueadaPor", "tsk_seed_6").ok).toBe(false);
    expect(addDependency(state, "mem_thiago", "tsk_seed_3", "bloqueia", "tsk_seed_8").ok).toBe(false);
    // dep_1: seed_4 é bloqueada por seed_3. O inverso fecharia ciclo de dois.
    expect(addDependency(state, "mem_thiago", "tsk_seed_3", "eBloqueadaPor", "tsk_seed_4").ok).toBe(false);
    // Funcionalidade desligada na Lista da OUTRA Tarefa.
    const lista = state.lists.find((l) => l.id === "lst_prospeccao");
    if (!lista) throw new Error("sem lista");
    lista.features = { dependencias: false };
    const outra = state.tasks.find((t) => t.listId === "lst_prospeccao" && t.lifecycle === "ativo" && !t.parentTaskId);
    if (!outra) throw new Error("sem tarefa");
    expect(addDependency(state, "mem_thiago", publica.id, "bloqueia", outra.id).ok).toBe(false);
  });

  it("Reunião: não abre com cronômetro aberto; em andamento, só encerrar a Reunião fecha o tempo", () => {
    const a = ativas("lst_propostas")[0];
    if (!a) throw new Error("sem tarefa");
    // Thiago tem a Reunião tsk_call_ref em andamento no seed: parar por fora é recusado.
    const aberto = runningTimer(state, "mem_thiago");
    if (!aberto) throw new Error("seed sem reunião aberta");
    expect(stopTimer(state, "mem_thiago", aberto.task.id).ok).toBe(false);
    // Rafael abre cronômetro numa Tarefa e não consegue abrir uma Reunião.
    expect(startTimer(state, "mem_rafael", a.id).ok).toBe(true);
    expect(startMeeting(state, "mem_rafael", "tsk_reuniao_2").ok).toBe(false);
    expect(stopTimer(state, "mem_rafael", a.id).ok).toBe(true);
    expect(startMeeting(state, "mem_rafael", "tsk_reuniao_2").ok).toBe(true);
  });

  it("Recorrência: a regra é transferida à próxima; mensal do dia 31 não estoura; minutos são inteiros", () => {
    const a = ativas("lst_propostas")[1];
    if (!a) throw new Error("sem tarefa");
    expect(addTimeEntry(state, "mem_thiago", a.id, { durationMinutes: 0.4 }).ok).toBe(false);
    expect(updateTask(state, "mem_thiago", a.id, { startDate: null, dueDate: { form: "civilDay", value: "2026-01-31" } }).ok).toBe(true);
    const regra = { frequency: "mensal" as const, interval: 1, triggerMode: "aoConcluir" as const, copies: { checklists: false, subtasks: false, assignees: false, fieldValues: false } };
    expect(setRecurrence(state, "mem_thiago", a.id, regra).ok).toBe(true);
    const cfg = effectiveListConfig(state, "lst_propostas");
    const fechado = cfg?.statusSet.definitions.find((d) => d.category === "concluido" || d.category === "fechado");
    const aberto = cfg?.statusSet.definitions.find((d) => d.category === "naoIniciado");
    if (!fechado || !aberto) throw new Error("sem status");
    const antes = state.tasks.length;
    expect(changeTaskStatus(state, "mem_thiago", a.id, fechado.id).ok).toBe(true);
    const proxima = state.tasks.at(-1);
    expect(proxima?.dueDate).toEqual({ form: "civilDay", value: "2026-02-28" });
    expect(a.recurrence).toBeUndefined();
    expect(proxima?.recurrence).toEqual(regra);
    // Reabrir e concluir de novo não gera outra: a regra já não é desta.
    expect(changeTaskStatus(state, "mem_thiago", a.id, aberto.id).ok).toBe(true);
    expect(changeTaskStatus(state, "mem_thiago", a.id, fechado.id).ok).toBe(true);
    expect(state.tasks.length).toBe(antes + 1);
  });

  it("Tempo: lançamento manual válido, um cronômetro por Membro, parar fecha com duração", () => {
    const [a, b] = ativas("lst_propostas");
    if (!a || !b) throw new Error("precisa de 2 tarefas");
    expect(addTimeEntry(state, "mem_thiago", a.id, { durationMinutes: 0 }).ok).toBe(false);
    expect(addTimeEntry(state, "mem_thiago", a.id, { durationMinutes: 30, on: "2999-01-01T00:00:00Z" }).ok).toBe(false);
    const lanc = addTimeEntry(state, "mem_thiago", a.id, { durationMinutes: 45, description: "Revisão" });
    expect(lanc.ok, lanc.ok ? "" : lanc.error).toBe(true);
    if (lanc.ok) expect(lanc.value.durationMinutes).toBe(45);
    // Thiago já tem uma Reunião em andamento no seed (cronômetro aberto): Rafael cronometra.
    expect(runningTimer(state, "mem_thiago")).toBeDefined();
    expect(startTimer(state, "mem_thiago", a.id).ok).toBe(false);
    const t1 = startTimer(state, "mem_rafael", a.id);
    expect(t1.ok, t1.ok ? "" : t1.error).toBe(true);
    expect(runningTimer(state, "mem_rafael")?.task.id).toBe(a.id);
    expect(startTimer(state, "mem_rafael", b.id).ok).toBe(false);
    expect(stopTimer(state, "mem_rafael", b.id).ok).toBe(false);
    const parado = stopTimer(state, "mem_rafael", a.id, "Ajustes");
    expect(parado.ok).toBe(true);
    if (parado.ok) {
      expect(parado.value.end).toBeDefined();
      expect(parado.value.durationMinutes).toBeGreaterThanOrEqual(1);
    }
    expect(runningTimer(state, "mem_rafael")).toBeUndefined();
    expect(startTimer(state, "mem_beatriz", a.id).ok).toBe(false);
  });

  it("Anexo: cria o Arquivo do Espaço de Trabalho e aponta para ele; remover o anexo não apaga o Arquivo (A8)", () => {
    const [a] = ativas("lst_propostas");
    if (!a) throw new Error("sem tarefa");
    expect(attachFile(state, "mem_thiago", a.id, { name: "  ", mediaType: "document", sizeBytes: 10 }).ok).toBe(false);
    expect(attachFile(state, "mem_thiago", a.id, { name: "grande.pdf", mediaType: "document", sizeBytes: 30 * 1024 * 1024 }).ok).toBe(false);
    const r = attachFile(state, "mem_thiago", a.id, { name: "proposta.pdf", mediaType: "document", sizeBytes: 1024 });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(state.files.some((f) => f.id === r.value.fileId)).toBe(true);
    expect(a.attachments.some((x) => x.fileId === r.value.fileId)).toBe(true);
    expect(removeAttachment(state, "mem_thiago", a.id, r.value.fileId).ok).toBe(true);
    expect(a.attachments.some((x) => x.fileId === r.value.fileId)).toBe(false);
    expect(state.files.some((f) => f.id === r.value.fileId)).toBe(true);
  });

  it("Recorrência: exige vencimento; concluir gera a próxima ocorrência com datas deslocadas, proveniência e Checklist zerado; o fim por contagem é respeitado", () => {
    const [a] = ativas("lst_propostas");
    if (!a) throw new Error("sem tarefa");
    const regra = { frequency: "semanal" as const, interval: 1, triggerMode: "aoConcluir" as const, endsAfter: 2, copies: { checklists: true, subtasks: false, assignees: true, fieldValues: false } };
    delete a.dueDate;
    expect(setRecurrence(state, "mem_thiago", a.id, regra).ok).toBe(false);
    expect(updateTask(state, "mem_thiago", a.id, { startDate: null, dueDate: { form: "civilDay", value: "2026-09-20" } }).ok).toBe(true);
    expect(setRecurrence(state, "mem_thiago", a.id, { ...regra, interval: 0 }).ok).toBe(false);
    expect(setRecurrence(state, "mem_thiago", a.id, regra).ok).toBe(true);
    if (a.checklists.length === 0) {
      a.checklists.push({ id: "chk_t", name: "Passos", order: 0, items: [{ id: "cki_t", text: "Um", order: 0, done: true }], createdBy: { kind: "member", id: "mem_thiago" }, createdAt: new Date().toISOString() });
    }
    const cfg = effectiveListConfig(state, "lst_propostas");
    const fechado = cfg?.statusSet.definitions.find((d) => d.category === "concluido" || d.category === "fechado");
    if (!fechado) throw new Error("sem status terminal");
    const antes = state.tasks.length;
    const r = changeTaskStatus(state, "mem_thiago", a.id, fechado.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(state.tasks.length).toBe(antes + 1);
    const proxima = state.tasks.at(-1);
    expect(proxima?.provenance?.kind).toBe("recurrence");
    expect(proxima?.provenance?.sourceId).toBe(a.id);
    expect(proxima?.dueDate).toEqual({ form: "civilDay", value: "2026-09-27" });
    expect(proxima?.assignees).toEqual(a.assignees);
    expect(proxima?.checklists.every((c) => c.items.every((i) => !i.done))).toBe(true);
    expect(proxima?.recurrence).toEqual(regra);
    // endsAfter: 2 — a segunda ocorrência é a última; concluí-la não gera a terceira.
    if (!proxima) return;
    const antes2 = state.tasks.length;
    expect(changeTaskStatus(state, "mem_thiago", proxima.id, fechado.id).ok).toBe(true);
    expect(state.tasks.length).toBe(antes2);
  });
});

describe("Fase 3 — planejamento", () => {
  it("Carga: estimativa cai na semana do vencimento, dividida entre Membros Responsáveis; Agente fica fora; sem vencimento vai para semData", () => {
    const t = state.tasks.find((x) => x.listId === "lst_propostas" && x.lifecycle === "ativo" && !x.parentTaskId);
    if (!t) throw new Error("sem tarefa");
    t.assignees = [{ kind: "member", id: "mem_julia" }, { kind: "member", id: "mem_marcos" }, { kind: "agent", id: "agt_sdr" }];
    expect(updateTask(state, "mem_thiago", t.id, { estimate: 120, startDate: null, dueDate: { form: "civilDay", value: "2026-09-16" } }).ok).toBe(true);
    const cells = workload(state, [t]);
    expect(cells).toHaveLength(2);
    expect(cells.every((c) => c.minutes === 60 && c.week === "2026-09-14")).toBe(true);
    expect(weekStartOf("2026-09-13")).toBe("2026-09-07");
    expect(updateTask(state, "mem_thiago", t.id, { dueDate: null }).ok).toBe(true);
    expect(workload(state, [t]).every((c) => c.week === "semData")).toBe(true);
    // Capacidade: o próprio ou Administrador; Membro comum não define a de outro.
    expect(setMemberCapacity(state, "mem_julia", "mem_marcos", 1200).ok).toBe(false);
    expect(setMemberCapacity(state, "mem_julia", "mem_julia", 1200).ok).toBe(true);
    expect(setMemberCapacity(state, "mem_rafael", "mem_marcos", 99999).ok).toBe(false);
    expect(setMemberCapacity(state, "mem_rafael", "mem_marcos", 1800).ok).toBe(true);
  });

  it("Sprints: Pasta com papel; próxima sprint nasce datada em sequência; fechar move o aberto para a próxima e arquiva", () => {
    expect(createNextSprint(state, "mem_thiago", "fld_renovacao").ok).toBe(false);
    expect(enableSprints(state, "mem_julia", "fld_renovacao", 14).ok).toBe(false);
    expect(enableSprints(state, "mem_thiago", "fld_renovacao", 14).ok).toBe(true);
    // lst_renovacao já existe na Pasta sem período: vira a "sprint" corrente.
    const s2 = createNextSprint(state, "mem_thiago", "fld_renovacao");
    expect(s2.ok, s2.ok ? "" : s2.error).toBe(true);
    if (!s2.ok) return;
    expect(s2.value.name).toBe("Sprint 1");
    expect(s2.value.plannedPeriod?.start).toBeDefined();
    const s3 = createNextSprint(state, "mem_thiago", "fld_renovacao");
    if (!s3.ok) throw new Error(s3.error);
    expect(s3.value.plannedPeriod?.start).toBe(
      (() => { const [y, m, d] = (s2.value.plannedPeriod?.end ?? "").split("-").map(Number); const n = new Date(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; })(),
    );
    const abertas = state.tasks.filter((t) => t.listId === s2.value.id).length;
    expect(abertas).toBe(0);
    // Mover uma Tarefa aberta e uma concluída para a Sprint 2 e fechar.
    const [a, b] = state.tasks.filter((t) => t.listId === "lst_renovacao" && !t.parentTaskId && t.lifecycle === "ativo");
    if (!a || !b) throw new Error("precisa de 2 tarefas");
    expect(moveTask(state, "mem_thiago", a.id, s2.value.id).ok).toBe(true);
    expect(moveTask(state, "mem_thiago", b.id, s2.value.id).ok).toBe(true);
    const cfg = effectiveListConfig(state, s2.value.id);
    const fechado = cfg?.statusSet.definitions.find((d) => d.category === "fechado" || d.category === "concluido");
    if (!fechado) throw new Error("sem terminal");
    expect(changeTaskStatus(state, "mem_thiago", b.id, fechado.id).ok).toBe(true);
    const r = closeSprint(state, "mem_thiago", s2.value.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.moved).toBe(1);
    expect(r.value.nextListId).toBe(s3.value.id);
    expect(a.listId).toBe(s3.value.id);
    expect(b.listId).toBe(s2.value.id);
    expect(state.lists.find((l) => l.id === s2.value.id)?.lifecycle).toBe("arquivado");
    expect(closeSprint(state, "mem_thiago", s2.value.id).ok).toBe(false);
    // Fechar a última cria a seguinte.
    const r3 = closeSprint(state, "mem_thiago", s3.value.id);
    expect(r3.ok).toBe(true);
    if (r3.ok) expect(sprintsOf(state, "fld_renovacao").some((l) => l.id === r3.value.nextListId && l.name === "Sprint 3")).toBe(true);
  });

  it("revisão: Lista privada nasce alcançável pelo criador; sprint numera pelo primeiro nome livre; fechar mapeia Status por nome e não cria sprint se recusar; sprint privada não fecha por fora", () => {
    const privada = createList(state, "mem_thiago", { name: "Só minha", parentType: "space", parentId: "spc_com", isPrivate: true });
    expect(privada.ok, privada.ok ? "" : privada.error).toBe(true);
    if (!privada.ok) return;
    expect(memberReachesContainer(state, "mem_thiago", "list", privada.value.id)).toBe(true);
    expect(memberReachesContainer(state, "mem_rafael", "list", privada.value.id)).toBe(false);
    expect(createTask(state, "mem_thiago", { listId: privada.value.id, title: "Cabe" }).ok).toBe(true);

    expect(enableSprints(state, "mem_thiago", "fld_renovacao", 14).ok).toBe(true);
    const s2 = createNextSprint(state, "mem_thiago", "fld_renovacao");
    if (!s2.ok) throw new Error(s2.error);
    expect(s2.value.name).toBe("Sprint 1");
    const lixo = state.lists.find((l) => l.id === "lst_renovacao");
    if (lixo) lixo.lifecycle = "naLixeira";
    const s3 = createNextSprint(state, "mem_thiago", "fld_renovacao");
    expect(s3.ok, s3.ok ? "" : s3.error).toBe(true);
    if (lixo) lixo.lifecycle = "ativo";

    // Sprint 2 sobrescreve o Conjunto e renomeia um Status: fechar mapeia por nome/categoria.
    expect(overrideStatusSet(state, "mem_thiago", "list", s2.value.id).ok).toBe(true);
    const cfg2 = effectiveListConfig(state, s2.value.id);
    const novo = cfg2?.statusSet.definitions.find((d) => d.category === "naoIniciado");
    if (!novo) throw new Error("sem status");
    expect(updateStatus(state, "mem_thiago", "list", s2.value.id, novo.id, { name: "Backlog da sprint" }).ok).toBe(true);
    const aberta = createTask(state, "mem_thiago", { listId: s2.value.id, title: "Aberta" });
    if (!aberta.ok) throw new Error(aberta.error);
    const r = closeSprint(state, "mem_thiago", s2.value.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(aberta.value.listId).toBe(r.value.nextListId);

    // Um Status sem equivalente (categoria inédita) recusa ANTES de criar sprint nova.
    const s4 = createNextSprint(state, "mem_thiago", "fld_renovacao");
    if (!s4.ok) throw new Error(s4.error);
    expect(overrideStatusSet(state, "mem_thiago", "list", s4.value.id).ok).toBe(true);
    const cfg4 = effectiveListConfig(state, s4.value.id);
    for (const d of cfg4?.statusSet.definitions.filter((x) => x.category === "emAndamento") ?? []) {
      removeStatus(state, "mem_thiago", "list", s4.value.id, d.id, cfg4?.statusSet.definitions.find((x) => x.category === "naoIniciado")?.id);
    }
    const inedito = addStatus(state, "mem_thiago", "list", s4.value.id, { name: "Em QA", color: "#111111", category: "emAndamento" });
    if (!inedito.ok) throw new Error(inedito.error);
    const t4 = createTask(state, "mem_thiago", { listId: s4.value.id, title: "Em QA", statusId: inedito.value.id });
    if (!t4.ok) throw new Error(t4.error);
    // O Conjunto herdado da Pasta tem "emAndamento"? Sim (Comercial) — então mapeia por categoria e fecha.
    const antesListas = state.lists.length;
    const r4 = closeSprint(state, "mem_thiago", s4.value.id);
    expect(r4.ok).toBe(true);
    expect(state.lists.length).toBe(antesListas + 1);

    // Sprint privada de outro Membro: não aparece nem fecha.
    const sp = createList(state, "mem_julia", { name: "Sprint privada", parentType: "folder", parentId: "fld_renovacao", isPrivate: true });
    if (!sp.ok) throw new Error(sp.error);
    sp.value.plannedPeriod = { start: "2030-01-01", end: "2030-01-14" };
    expect(closeSprint(state, "mem_thiago", sp.value.id).ok).toBe(false);
  });

  it("revisão: Template de Lista exige administrar o destino e respeita bloqueio; falha desfaz a Lista; Template de Tarefa desfaz a raiz se a Subtarefa não cabe; salvar Tarefa como modelo exige administrar", () => {
    const tl = saveListAsTemplate(state, "mem_thiago", "lst_propostas", { name: "Propostas" });
    if (!tl.ok) throw new Error(tl.error);
    expect(instantiateListTemplate(state, "mem_julia", tl.value.id, { name: "Da Júlia", parentType: "space", parentId: "spc_com" }).ok).toBe(false);
    expect(state.lists.some((l) => l.name === "Da Júlia")).toBe(false);
    const espaco = state.spaces.find((sp) => sp.id === "spc_com");
    if (espaco) espaco.blocks = { ...espaco.blocks, statusSet: true };
    expect(instantiateListTemplate(state, "mem_thiago", tl.value.id, { name: "Bloqueada", parentType: "space", parentId: "spc_com" }).ok).toBe(false);
    expect(state.lists.some((l) => l.name === "Bloqueada")).toBe(false);
    if (espaco) espaco.blocks = {};
    // Campo de mesmo nome e tipo diferente já herdado: recusa e desfaz.
    expect(createFieldDefinition(state, "mem_thiago", { name: "Prazo X", type: "date", definedAtType: "list", definedAtId: "lst_propostas" }).ok).toBe(true);
    const tl2 = saveListAsTemplate(state, "mem_thiago", "lst_propostas", { name: "Com prazo" });
    if (!tl2.ok) throw new Error(tl2.error);
    expect(createFieldDefinition(state, "mem_thiago", { name: "Prazo X", type: "text", definedAtType: "space", definedAtId: "spc_ops" }).ok).toBe(true);
    const antes = state.lists.length;
    expect(instantiateListTemplate(state, "mem_thiago", tl2.value.id, { name: "Conflito", parentType: "space", parentId: "spc_ops" }).ok).toBe(false);
    expect(state.lists.length).toBe(antes);

    const mae = createTask(state, "mem_thiago", { listId: "lst_propostas", title: "Com filha" });
    if (!mae.ok) throw new Error(mae.error);
    expect(createTask(state, "mem_thiago", { listId: "lst_propostas", title: "Filha", parentTaskId: mae.value.id }).ok).toBe(true);
    expect(saveTaskAsTemplate(state, "mem_julia", mae.value.id, { name: "Da Júlia" }).ok).toBe(false);
    const tt = saveTaskAsTemplate(state, "mem_thiago", mae.value.id, { name: "Com filha" });
    if (!tt.ok) throw new Error(tt.error);
    state.workspace.maxSubtaskDepth = 0;
    const antesT = state.tasks.length;
    expect(instantiateTaskTemplate(state, "mem_thiago", tt.value.id, "lst_prospeccao").ok).toBe(false);
    expect(state.tasks.length).toBe(antesT);
  });

  it("Templates: Lista salva Status/Campos/Tipos e instancia com ids novos; Tarefa salva Checklists e Subtarefas e instancia sem copiar ids", () => {
    expect(createFieldDefinition(state, "mem_thiago", { name: "Sprint", type: "singleSelect", options: ["S1", "S2"], definedAtType: "list", definedAtId: "lst_propostas" }).ok).toBe(true);
    expect(createTaskType(state, "mem_thiago", { name: "Bug", icon: "bug", definedAtType: "list", definedAtId: "lst_propostas" }).ok).toBe(true);
    const tl = saveListAsTemplate(state, "mem_thiago", "lst_propostas", { name: "Lista de propostas" });
    expect(tl.ok, tl.ok ? "" : tl.error).toBe(true);
    if (!tl.ok) return;
    expect(saveListAsTemplate(state, "mem_thiago", "lst_propostas", { name: "lista de propostas" }).ok).toBe(false);
    const origem = effectiveListConfig(state, "lst_propostas");
    const nova = instantiateListTemplate(state, "mem_thiago", tl.value.id, { name: "Propostas Q4", parentType: "space", parentId: "spc_ops" });
    expect(nova.ok, nova.ok ? "" : nova.error).toBe(true);
    if (!nova.ok) return;
    const cfg = effectiveListConfig(state, nova.value.id);
    expect(cfg?.statusSetDefinedAt.id).toBe(nova.value.id);
    expect(cfg?.statusSet.id).not.toBe(origem?.statusSet.id);
    expect(cfg?.statusSet.definitions.map((d) => d.name)).toEqual(origem?.statusSet.definitions.map((d) => d.name));
    expect(new Set(cfg?.statusSet.definitions.map((d) => d.id)).size).toBe(cfg?.statusSet.definitions.length);
    expect(cfg?.statusSet.definitions.some((d) => origem?.statusSet.definitions.some((o) => o.id === d.id))).toBe(false);
    expect(state.fieldDefinitions.some((d) => d.definedAtId === nova.value.id && d.name === "Sprint")).toBe(true);
    expect(state.taskTypes.some((t) => t.definedAtId === nova.value.id && t.name === "Bug")).toBe(true);
    expect(nova.value.provenance?.kind).toBe("template");

    // Tarefa
    const mae = createTask(state, "mem_thiago", { listId: "lst_propostas", title: "Onboarding padrão" });
    if (!mae.ok) throw new Error(mae.error);
    mae.value.checklists.push({ id: "chk_m", name: "Documentos", order: 0, items: [{ id: "cki_m1", text: "Contrato", order: 0, done: true }, { id: "cki_m2", text: "NF", order: 1, done: false }], createdBy: { kind: "member", id: "mem_thiago" }, createdAt: new Date().toISOString() });
    expect(createTask(state, "mem_thiago", { listId: "lst_propostas", title: "Kickoff", parentTaskId: mae.value.id }).ok).toBe(true);
    const tt = saveTaskAsTemplate(state, "mem_thiago", mae.value.id, { name: "Onboarding" });
    expect(tt.ok, tt.ok ? "" : tt.error).toBe(true);
    if (!tt.ok) return;
    expect(saveTaskAsTemplate(state, "mem_beatriz", mae.value.id, { name: "X" }).ok).toBe(false);
    const inst = instantiateTaskTemplate(state, "mem_thiago", tt.value.id, "lst_prospeccao", "Onboarding Clínica Sul");
    expect(inst.ok, inst.ok ? "" : inst.error).toBe(true);
    if (!inst.ok) return;
    expect(inst.value.title).toBe("Onboarding Clínica Sul");
    expect(inst.value.checklists[0]?.items.map((i) => [i.text, i.done])).toEqual([["Contrato", false], ["NF", false]]);
    expect(inst.value.checklists[0]?.id).not.toBe("chk_m");
    expect(state.tasks.filter((t) => t.parentTaskId === inst.value.id).map((t) => t.title)).toEqual(["Kickoff"]);
    expect(inst.value.provenance?.sourceId).toBe(tt.value.id);
    expect(instantiateTaskTemplate(state, "mem_beatriz", tt.value.id, "lst_prospeccao").ok).toBe(false);
  });
});

describe("Fase 4 — escala", () => {
  it("Visualização: pessoal é de quem vê; compartilhada exige administrar; aplica filtro e ordenação; só o dono apaga a pessoal", () => {
    const pessoal = saveView(state, "mem_julia", { listId: "lst_propostas", name: "Minhas", kind: "lista", filters: { assigneeMemberId: "mem_julia" }, shared: false });
    expect(pessoal.ok, pessoal.ok ? "" : pessoal.error).toBe(true);
    expect(saveView(state, "mem_julia", { listId: "lst_propostas", name: "Todas", kind: "lista", filters: {}, shared: true }).ok).toBe(false);
    const compartilhada = saveView(state, "mem_thiago", { listId: "lst_propostas", name: "Vencidas", kind: "lista", filters: { overdue: true }, sortBy: { by: "dueDate", direction: "asc" }, shared: true });
    expect(compartilhada.ok, compartilhada.ok ? "" : compartilhada.error).toBe(true);
    if (!pessoal.ok || !compartilhada.ok) return;
    expect(viewsFor(state, "mem_julia", "lst_propostas").map((v) => v.name).sort()).toEqual(["Minhas", "Vencidas"]);
    expect(viewsFor(state, "mem_marcos", "lst_propostas").map((v) => v.name)).toEqual(["Vencidas"]);
    // Convidada não alcança lst_propostas? Alcança (não é privada), mas Beatriz não escreve: a pessoal é dela mesmo assim.
    expect(saveView(state, "mem_beatriz", { listId: "lst_conteudo", name: "Minha", kind: "lista", filters: {}, shared: false }).ok).toBe(true);
    expect(saveView(state, "mem_julia", { listId: "lst_conteudo", name: "X", kind: "lista", filters: {}, shared: false }).ok).toBe(false);
    const tarefas = state.tasks.filter((t) => t.listId === "lst_propostas" && !t.parentTaskId);
    const minhas = applyView(state, tarefas, pessoal.value);
    expect(minhas.every((t) => t.assignees.some((a) => a.id === "mem_julia"))).toBe(true);
    const vencidas = applyView(state, tarefas, compartilhada.value, new Date("2030-01-01"));
    expect(vencidas.length).toBeGreaterThan(0);
    // Dia civil e instante se misturam: comparar em milissegundos, como a ordenação faz.
    const ms = (t: (typeof vencidas)[number] | undefined) => (t?.dueDate ? Date.parse(t.dueDate.form === "civilDay" ? `${t.dueDate.value}T23:59:59` : t.dueDate.value) : Infinity);
    for (let i = 1; i < vencidas.length; i += 1) {
      expect(ms(vencidas[i - 1]) <= ms(vencidas[i])).toBe(true);
    }
    expect(setDefaultView(state, "mem_thiago", compartilhada.value.id, true).ok).toBe(true);
    expect(setDefaultView(state, "mem_julia", pessoal.value.id, true).ok).toBe(false);
    expect(deleteView(state, "mem_marcos", pessoal.value.id).ok).toBe(false);
    expect(deleteView(state, "mem_julia", pessoal.value.id).ok).toBe(true);
    expect(deleteView(state, "mem_julia", compartilhada.value.id).ok).toBe(false);
    expect(deleteView(state, "mem_thiago", compartilhada.value.id).ok).toBe(true);
  });

  it("Meta: progresso derivado por Tarefas concluídas e por métrica; alvo inválido recusado; só dono ou admin altera", () => {
    const meta = createGoal(state, "mem_julia", { name: "Fechar 2 propostas", anchor: { type: "list", id: "lst_propostas" }, kind: "tarefasConcluidas", target: 2 });
    expect(meta.ok, meta.ok ? "" : meta.error).toBe(true);
    if (!meta.ok) return;
    expect(createGoal(state, "mem_julia", { name: "Zero", anchor: { type: "list", id: "lst_propostas" }, kind: "tarefasConcluidas", target: 0 }).ok).toBe(false);
    expect(createGoal(state, "mem_beatriz", { name: "X", anchor: { type: "list", id: "lst_conteudo" }, kind: "tarefasConcluidas", target: 1 }).ok).toBe(false);
    const [a, b] = state.tasks.filter((t) => t.listId === "lst_propostas" && t.lifecycle === "ativo" && !t.parentTaskId);
    if (!a || !b) throw new Error("sem tarefas");
    expect(linkTaskToGoal(state, "mem_julia", meta.value.id, a.id, true).ok).toBe(true);
    expect(linkTaskToGoal(state, "mem_julia", meta.value.id, b.id, true).ok).toBe(true);
    expect(linkTaskToGoal(state, "mem_marcos", meta.value.id, b.id, false).ok).toBe(false);
    const cfg = effectiveListConfig(state, "lst_propostas");
    const fechado = cfg?.statusSet.definitions.find((d) => d.category === "concluido" || d.category === "fechado");
    if (!fechado) throw new Error("sem terminal");
    let p = goalProgress(state, meta.value, "mem_julia", new Date());
    expect("ratio" in p && p.ratio).toBe(0);
    expect(changeTaskStatus(state, "mem_thiago", a.id, fechado.id).ok).toBe(true);
    p = goalProgress(state, meta.value, "mem_julia", new Date());
    expect("ratio" in p && p.ratio).toBe(0.5);
    // Métrica: contagem de Tarefas em spc_ops; a Convidada sem acesso lê "sem acesso".
    const metrica = createGoal(state, "mem_thiago", { name: "10 Tarefas em Entrega", anchor: { type: "space", id: "spc_ops" }, kind: "metrica", target: 10, measure: { target: "task", scopeType: "space", scopeIds: ["spc_ops"], aggregation: "contagem", attribute: "id" } });
    expect(metrica.ok, metrica.ok ? "" : metrica.error).toBe(true);
    if (!metrica.ok) return;
    const pm = goalProgress(state, metrica.value, "mem_thiago", new Date());
    expect("current" in pm && pm.current).toBeGreaterThan(0);
    expect("kind" in goalProgress(state, metrica.value, "mem_beatriz", new Date())).toBe(true);
    expect(archiveGoal(state, "mem_rafael", meta.value.id).ok).toBe(true);
    expect(linkTaskToGoal(state, "mem_julia", meta.value.id, b.id, false).ok).toBe(false);
    expect(setGoalArchived(state, "mem_marcos", meta.value.id, false).ok).toBe(false);
    expect(setGoalArchived(state, "mem_julia", meta.value.id, false).ok).toBe(true);
    expect(updateGoal(state, "mem_julia", meta.value.id, { name: "Fechar 3", target: 3 }).ok).toBe(true);
    expect(meta.value.target).toBe(3);
  });

  it("Formulário: perguntas validadas contra a Lista (título único obrigatório, Campo obrigatório coberto); envio cria Tarefa com proveniência; renovar o segredo invalida o link", () => {
    expect(createFieldDefinition(state, "mem_thiago", { name: "Origem do pedido", type: "singleSelect", options: ["Site", "Indicação"], required: true, definedAtType: "list", definedAtId: "lst_prospeccao" }).ok).toBe(true);
    const def = state.fieldDefinitions.find((d) => d.name === "Origem do pedido");
    if (!def) throw new Error("sem campo");
    expect(createForm(state, "mem_thiago", "lst_prospeccao", { name: "Pedido", questions: [{ label: "Descrição", required: false, target: { kind: "description" } }] }).ok).toBe(false);
    expect(createForm(state, "mem_thiago", "lst_prospeccao", { name: "Pedido", questions: [{ label: "Assunto", required: true, target: { kind: "title" } }] }).ok).toBe(false);
    const form = createForm(state, "mem_thiago", "lst_prospeccao", {
      name: "Pedido",
      questions: [
        { label: "Assunto", required: true, target: { kind: "title" } },
        { label: "Detalhes", required: false, target: { kind: "description" } },
        { label: "Como chegou", required: true, target: { kind: "field", definitionId: def.id } },
      ],
    });
    expect(form.ok, form.ok ? "" : form.error).toBe(true);
    if (!form.ok) return;
    expect(createForm(state, "mem_julia", "lst_prospeccao", { name: "Outro", questions: form.value.questions }).ok).toBe(false);
    const [q1, q2, q3] = form.value.questions;
    if (!q1 || !q2 || !q3) throw new Error("sem perguntas");
    expect(submitForm(state, form.value.secret, { [q1.id]: "Orçamento", [q3.id]: "" }).ok).toBe(false);
    expect(submitForm(state, form.value.secret, { [q1.id]: "Orçamento", [q3.id]: "Telefone" }).ok).toBe(false);
    const antes = state.tasks.length;
    const envio = submitForm(state, form.value.secret, { [q1.id]: "Orçamento full face", [q2.id]: "Quer saber valores", [q3.id]: "Site" });
    expect(envio.ok, envio.ok ? "" : envio.error).toBe(true);
    if (!envio.ok) return;
    expect(state.tasks.length).toBe(antes + 1);
    expect(envio.value.provenance?.kind).toBe("form");
    expect(envio.value.description).toBe("Quer saber valores");
    expect(envio.value.fieldValues.find((v) => v.definitionId === def.id)?.value).toBe("Site");
    expect(state.forms.find((f) => f.id === form.value.id)?.submissions).toBe(1);
    expect(updateForm(state, "mem_thiago", form.value.id, { enabled: false }).ok).toBe(true);
    expect(submitForm(state, form.value.secret, { [q1.id]: "X", [q3.id]: "Site" }).ok).toBe(false);
    expect(updateForm(state, "mem_thiago", form.value.id, { enabled: true }).ok).toBe(true);
    const antigo = form.value.secret;
    expect(rotateFormSecret(state, "mem_thiago", form.value.id).ok).toBe(true);
    expect(submitForm(state, antigo, { [q1.id]: "X", [q3.id]: "Site" }).ok).toBe(false);
  });

  it("Compartilhamento público: exige a funcionalidade e escrita; o link abre só enquanto ativo; revogar invalida", () => {
    const t = state.tasks.find((x) => x.listId === "lst_propostas" && x.lifecycle === "ativo" && !x.parentTaskId);
    if (!t) throw new Error("sem tarefa");
    expect(shareTaskPublicly(state, "mem_beatriz", t.id, { showsComments: false, showsAttachments: false }).ok).toBe(false);
    const share = shareTaskPublicly(state, "mem_thiago", t.id, { showsComments: false, showsAttachments: true });
    expect(share.ok, share.ok ? "" : share.error).toBe(true);
    if (!share.ok) return;
    expect(shareTaskPublicly(state, "mem_thiago", t.id, { showsComments: false, showsAttachments: true }).ok).toBe(false);
    expect(taskByPublicSecret(state, share.value.secret)?.id).toBe(t.id);
    expect(revokePublicShare(state, "mem_thiago", t.id).ok).toBe(true);
    expect(taskByPublicSecret(state, share.value.secret)).toBeUndefined();
    // Membro comum não compartilha para fora (administrar); desligar a Funcionalidade fecha o link aberto.
    const outra = shareTaskPublicly(state, "mem_thiago", t.id, { showsComments: false, showsAttachments: false });
    if (!outra.ok) throw new Error(outra.error);
    expect(taskByPublicSecret(state, outra.value.secret)?.id).toBe(t.id);
    const lista = state.lists.find((l) => l.id === "lst_propostas");
    if (lista) lista.features = { compartilhamentoPublico: false };
    expect(taskByPublicSecret(state, outra.value.secret)).toBeUndefined();
    if (lista) lista.features = {};
    expect(shareTaskPublicly(state, "mem_julia", state.tasks.find((x) => x.listId === "lst_propostas" && x.lifecycle === "ativo" && !x.parentTaskId && !x.publicShare)?.id ?? "", { showsComments: false, showsAttachments: false }).ok).toBe(false);
    // Mover para uma Lista sem a Funcionalidade revoga.
    const destino = state.lists.find((l) => l.id === "lst_prospeccao");
    if (destino) destino.features = { compartilhamentoPublico: false };
    expect(moveTask(state, "mem_thiago", t.id, "lst_prospeccao").ok).toBe(true);
    expect(t.publicShare?.active).toBe(false);
  });

  it("Formulário: Lista arquivada ou Campo obrigatório novo fecham o link; resposta recusada não deixa Tarefa, Registro nem identificador consumido", () => {
    const form = state.forms.find((f) => f.id === "frm_demo");
    if (!form) throw new Error("sem form");
    const q1 = form.questions[0];
    if (!q1) throw new Error("sem pergunta");
    expect(createFieldDefinition(state, "mem_thiago", { name: "Quantidade", type: "number", definedAtType: "list", definedAtId: "lst_prospeccao" }).ok).toBe(true);
    const def = state.fieldDefinitions.find((d) => d.name === "Quantidade");
    if (!def) throw new Error("sem campo");
    expect(updateForm(state, "mem_thiago", form.id, { questions: [{ id: q1.id, label: q1.label, required: true, target: { kind: "title" } }, { label: "Quantas", required: false, target: { kind: "field", definitionId: def.id } }] }).ok).toBe(true);
    const q2 = form.questions[1];
    if (!q2) throw new Error("sem pergunta 2");
    const antes = { tasks: state.tasks.length, activity: state.activity.length, readable: state.workspace.taskReadableId.next };
    expect(submitForm(state, "demo-formulario", { [q1.id]: "Pedido", [q2.id]: "abc" }).ok).toBe(false);
    expect(state.tasks.length).toBe(antes.tasks);
    expect(state.activity.length).toBe(antes.activity);
    expect(state.workspace.taskReadableId.next).toBe(antes.readable);
    expect(submitForm(state, "demo-formulario", { [q1.id]: "Pedido", [q2.id]: "1,5" }).ok).toBe(true);
    // Campo obrigatório criado depois: o link recusa até o Formulário ser revisto.
    expect(createFieldDefinition(state, "mem_thiago", { name: "Origem X", type: "text", required: true, definedAtType: "list", definedAtId: "lst_prospeccao" }).ok).toBe(true);
    expect(submitForm(state, "demo-formulario", { [q1.id]: "Pedido" }).ok).toBe(false);
    expect(archiveForm(state, "mem_julia", form.id).ok).toBe(false);
    expect(archiveForm(state, "mem_thiago", form.id).ok).toBe(true);
    expect(formBySecret(state, "demo-formulario")).toBeUndefined();
    const lista = state.lists.find((l) => l.id === "lst_prospeccao");
    if (lista) lista.lifecycle = "arquivado";
    expect(formBySecret(state, "demo-formulario")).toBeUndefined();
  });

  it("Meta não soma dinheiro entre moedas; progresso ignora Tarefa cuja Lista foi à lixeira", () => {
    expect(createGoal(state, "mem_thiago", { name: "R$", anchor: { type: "space", id: "spc_com" }, kind: "metrica", target: 1, measure: { target: "deal", scopeType: "workspace", scopeIds: [state.workspace.id], aggregation: "soma", attribute: "value" } }).ok).toBe(false);
    const meta = createGoal(state, "mem_thiago", { name: "Duas", anchor: { type: "list", id: "lst_propostas" }, kind: "tarefasConcluidas", target: 2 });
    if (!meta.ok) throw new Error(meta.error);
    const t = state.tasks.find((x) => x.listId === "lst_propostas" && x.lifecycle === "ativo" && !x.parentTaskId);
    if (!t) throw new Error("sem tarefa");
    expect(linkTaskToGoal(state, "mem_thiago", meta.value.id, t.id, true).ok).toBe(true);
    const fechado = effectiveListConfig(state, "lst_propostas")?.statusSet.definitions.find((d) => d.category === "concluido" || d.category === "fechado");
    if (!fechado) throw new Error("sem terminal");
    expect(changeTaskStatus(state, "mem_thiago", t.id, fechado.id).ok).toBe(true);
    let p = goalProgress(state, meta.value, "mem_thiago", new Date());
    expect("current" in p && p.current).toBe(1);
    const lista = state.lists.find((l) => l.id === "lst_propostas");
    if (lista) lista.lifecycle = "naLixeira";
    p = goalProgress(state, meta.value, "mem_thiago", new Date());
    expect("current" in p && p.current).toBe(0);
  });
});

describe("Processo Contas a pagar (docs/07-processos/contas-a-pagar.md)", () => {
  const F = CP.fields;
  const S = CP.status;
  const conta = (id: string) => {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) throw new Error(`sem ${id}`);
    return t;
  };

  it("estrutura: Espaço privado, Lista com 8 Status e 21 Campos, Tipo Conta, 8 Tags, Agente e Automações", () => {
    const cfg = effectiveListConfig(state, CP.listId);
    expect(cfg?.statusSet.definitions.map((d) => d.name)).toEqual(["para pagar", "em lançamento omie", "lançado omie", "em remessa bancária", "em autorização bancária", "aprovado", "negado", "pago"]);
    expect(cfg?.fieldDefinitionIds).toHaveLength(22); // 21 do processo + Produto (do Espaço, para Contas a receber)
    expect(cfg?.taskTypeIds).toContain(CP.taskTypeId);
    expect(cfg?.features.subtarefas).toBe(false);
    expect(state.tags.filter((t) => t.name.startsWith("conta ")).map((t) => t.name)).toHaveLength(8);
    expect(state.automations.filter((a) => a.scopeId === CP.listId)).toHaveLength(7); // A2–A7 e A9; A1 é a Recorrência
    // Privacidade (seção 10): Membros comuns não alcançam; Financeiro administra; Convidada não vê.
    expect(memberReachesContainer(state, "mem_julia", "list", CP.listId)).toBe(false);
    expect(memberReachesContainer(state, "mem_beatriz", "list", CP.listId)).toBe(false);
    expect(containerAdminRefusal(state, CP.financeiroId, "list", CP.listId)).toBeUndefined();
    expect(memberReachesContainer(state, CP.aprovadorId, "list", CP.listId)).toBe(true);
  });

  it("RN-CP-02/03: sair de “para pagar” exige o dado de pagamento coerente com a forma", () => {
    const t = conta("tsk_cp_ferramenta"); // sem Forma de pagamento
    const r = changeTaskStatus(state, CP.financeiroId, t.id, S.lancado);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Forma de pagamento/);
    expect(setTaskFieldValue(state, CP.financeiroId, t.id, F.forma, "Boleto").ok).toBe(true);
    const r2 = changeTaskStatus(state, CP.financeiroId, t.id, S.lancado);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/Código de barras/);
    expect(setTaskFieldValue(state, CP.financeiroId, t.id, F.codigoBarras, "23793.38128 60000.000003").ok).toBe(true);
    expect(setTaskFieldValue(state, CP.financeiroId, t.id, F.boleto, "boleto.pdf").ok).toBe(true);
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.lancado).ok).toBe(true);
  });

  it("RN-CP-04 + A3: entrar em autorização troca o Responsável para o Aprovador; só o Aprovador paga; A2 tira o Financeiro", () => {
    const t = conta("tsk_cp_aluguel_out");
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.emRemessa).ok).toBe(true);
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.emAutorizacao).ok).toBe(true);
    expect(t.assignees.map((a) => a.id)).toEqual([CP.aprovadorId]);
    const negadoPeloFinanceiro = changeTaskStatus(state, CP.financeiroId, t.id, S.pago);
    expect(negadoPeloFinanceiro.ok).toBe(false);
    if (!negadoPeloFinanceiro.ok) expect(negadoPeloFinanceiro.error).toMatch(/Marcos Paulo/);
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.pago).ok).toBe(true);
    expect(t.completedAt).toBeDefined();
    expect(t.assignees.map((a) => a.id)).toEqual([CP.aprovadorId]);
    // Walter paga a conta Konq: continua Responsável (A2 só tira o Financeiro).
    const konq = conta("tsk_cp_konq");
    expect(changeTaskStatus(state, CP.aprovadorKonqId, konq.id, S.pago).ok).toBe(true);
    expect(konq.assignees.map((a) => a.id)).toEqual([CP.aprovadorKonqId]);
  });

  it("seção 7 + A1/A9: pagar cria a conta do mês seguinte no dia útil anterior, sem Anexo/Data de Emissão, com o Financeiro e Observadores", () => {
    const t = conta("tsk_cp_thiago_out");
    expect(t.recurrence?.businessDays).toBe("anterior");
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.emAutorizacao).ok).toBe(true);
    const antes = state.tasks.length;
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.pago).ok).toBe(true);
    expect(state.tasks.length).toBe(antes + 1);
    const proxima = state.tasks[state.tasks.length - 1];
    if (!proxima) throw new Error("sem próxima");
    expect(proxima.provenance?.kind).toBe("recurrence");
    expect(proxima.statusId).toBe(S.paraPagar);
    expect(proxima.assignees.map((a) => a.id)).toEqual([CP.financeiroId]);
    expect(proxima.fieldValues.some((v) => v.definitionId === F.anexo || v.definitionId === F.dataEmissao)).toBe(false);
    expect(proxima.fieldValues.find((v) => v.definitionId === F.valor)?.value).toBe(12000);
    expect(proxima.observerMemberIds).toEqual(expect.arrayContaining([CP.financeiroId, CP.aprovadorId, "mem_thiago_pereira"]));
    // Dia útil: nunca sábado ou domingo.
    const [y, m, d] = (proxima.dueDate?.value ?? "").split("-").map(Number);
    const dow = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getDay();
    expect(dow).not.toBe(0);
    expect(dow).not.toBe(6);
    expect(t.recurrence).toBeUndefined();
    // RN-CP-06 — reabrir e pagar de novo não duplica.
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.lancado).ok).toBe(true);
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.pago).ok).toBe(true);
    expect(state.tasks.length).toBe(antes + 1);
  });

  it("A4: negado devolve ao Financeiro com Menção; voltar a lançado omie é permitido", () => {
    const t = conta("tsk_cp_konq");
    expect(changeTaskStatus(state, CP.aprovadorKonqId, t.id, S.negado).ok).toBe(true);
    expect(t.assignees.map((a) => a.id)).toEqual([CP.financeiroId]);
    expect(t.comments.at(-1)?.mentions.some((m) => m.id === CP.financeiroId)).toBe(true);
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.lancado).ok).toBe(true);
  });

  it("A5/A6/A7: gatilhos por vencimento — cobrança à Pessoa, e o Agente publica o Resumo e move para lançado omie; sem dado, comenta o que falta e não move", () => {
    const hoje = new Date();
    const em = (dias: number) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const comPessoa = conta("tsk_cp_thiago_out");
    expect(updateTask(state, CP.financeiroId, comPessoa.id, { dueDate: { form: "civilDay", value: em(4) } }).ok).toBe(true);
    const vespera = conta("tsk_cp_das");
    expect(updateTask(state, CP.financeiroId, vespera.id, { dueDate: { form: "civilDay", value: em(1) } }).ok).toBe(true);
    const incompleta = conta("tsk_cp_ferramenta");
    expect(updateTask(state, CP.financeiroId, incompleta.id, { dueDate: { form: "civilDay", value: em(1) } }).ok).toBe(true);
    const r = runScheduledAutomations(state, CP.financeiroId, CP.listId, hoje);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    // A5 cobrou a Pessoa pelo nome, com o CNPJ da Empresa.
    const cobranca = comPessoa.comments.find((c) => c.content.includes("emitir sua nota"));
    expect(cobranca?.content.startsWith("Pedro Alencar por favor emitir sua nota para o CNPJ 11.222.333/0001-81")).toBe(true);
    expect(cobranca?.mentions.some((m) => m.id === "mem_thiago_pereira")).toBe(true);
    // Só quem administra a Lista roda o relógio.
    expect(runScheduledAutomations(state, "mem_thiago_pereira", CP.listId, hoje).ok).toBe(false);
    // A7: DAS completo → Resumo resolvido + lançado omie.
    expect(vespera.statusId).toBe(S.lancado);
    const resumo = vespera.comments.find((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"));
    expect(resumo?.author).toEqual({ kind: "agent", id: CP.agentId });
    expect(resumo?.resolved).toBeDefined();
    expect(resumo?.content).toContain("Conta pagamento: TRIA");
    expect(resumo?.content).toContain("Código:         2.06.01");
    expect(contaSemResumo(state, vespera)).toBe(false);
    // A7: ferramenta sem forma → comentário do que falta, aberto, e continua em para pagar.
    expect(incompleta.statusId).toBe(S.paraPagar);
    const falta = incompleta.comments.find((c) => c.content.startsWith("Não consegui lançar"));
    expect(falta?.resolved).toBeUndefined();
    expect(falta?.content).toMatch(/Forma de pagamento/);
    // DAS e Tráfego pago (véspera, completos) lançados; Ferramenta (sem forma) falhou.
    expect(state.agentExecutions.filter((e) => e.agentId === CP.agentId).map((e) => e.state).sort()).toEqual(["concluida", "concluida", "falhou"]);
    // Rodar de novo não repete o que já rodou.
    const r2 = runScheduledAutomations(state, CP.financeiroId, CP.listId, hoje);
    expect(r2.ok && r2.value.executed).toBe(0);
    expect(vespera.comments.filter((c) => c.content.startsWith("📋 RESUMO")).length).toBe(1);
    // Sem o Boleto (requisito de saída), o Agente NEM lança: pede o que falta, dia após dia sem duplicar Resumo.
    const trafego = conta("tsk_cp_trafego");
    trafego.fieldValues = trafego.fieldValues.filter((v) => v.definitionId !== F.boleto);
    trafego.comments = [];
    trafego.statusId = S.paraPagar;
    state.agentExecutions = state.agentExecutions.filter((e) => e.anchor?.id !== trafego.id);
    state.automationExecutions = state.automationExecutions.filter((e) => e.objectId !== trafego.id);
    for (const dias of [0, 1, 2]) {
      const quando = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
      expect(runScheduledAutomations(state, CP.financeiroId, CP.listId, quando).ok).toBe(true);
    }
    expect(trafego.statusId).toBe(S.paraPagar);
    expect(trafego.comments.filter((c) => c.content.startsWith("📋 RESUMO")).length).toBe(0);
    expect(trafego.comments.every((c) => c.content.includes("Boleto"))).toBe(true);
    expect(state.agentExecutions.filter((e) => e.anchor?.id === trafego.id).every((e) => !e.steps.some((st) => st.toolId === "omie_lancar_conta_a_pagar"))).toBe(true);
    // A Auditoria atribui a mudança de Status à Automação, em nome do Financeiro.
    const movimento = state.activity.find((a) => a.objectId === vespera.id && a.action === "Status alterado");
    expect(movimento?.actor.kind).toBe("automation");
    expect(movimento?.delegate?.id).toBe(CP.financeiroId);
  });

  it("seção 10: a Pessoa da conta vê só as próprias contas, anexa a nota e a data de emissão, e nada mais", () => {
    const minha = conta("tsk_cp_thiago_out");
    const outra = conta("tsk_cp_aluguel_out");
    expect(memberSeesTask(state, "mem_thiago_pereira", minha.id)).toBe(true);
    expect(memberSeesTask(state, "mem_thiago_pereira", outra.id)).toBe(false);
    expect(setTaskFieldValue(state, "mem_thiago_pereira", minha.id, F.anexo, "NFS-e_23.pdf").ok).toBe(true);
    expect(setTaskFieldValue(state, "mem_thiago_pereira", minha.id, F.dataEmissao, "2026-09-10").ok).toBe(true);
    expect(addTaskComment(state, "mem_thiago_pereira", minha.id, { content: "feito" }).ok).toBe(true);
    const valor = setTaskFieldValue(state, "mem_thiago_pereira", minha.id, F.valor, 1);
    expect(valor.ok).toBe(false);
    if (!valor.ok) expect(valor.error).toMatch(/Anexo e Data de Emissão/);
    expect(changeTaskStatus(state, "mem_thiago_pereira", minha.id, S.lancado).ok).toBe(false);
    expect(updateTask(state, "mem_thiago_pereira", minha.id, { title: "x" }).ok).toBe(false);
    expect(setTaskFieldValue(state, "mem_thiago_pereira", outra.id, F.anexo, "x.pdf").ok).toBe(false);
  });

  it("INV-CP-01: conta lançada sem Resumo e sem Integração manual é apontada", () => {
    const negada = conta("tsk_cp_negada");
    expect(contaSemResumo(state, negada)).toBe(true);
    const manual = conta("tsk_cp_aluguel_out");
    expect(contaSemResumo(state, manual)).toBe(false);
  });
});

describe("Espelho comercial na Estrutura (Comercial › Meus negócios › Funil)", () => {
  it("uma Lista por Funil ativo, Etapas como Status, um cartão por Negócio, Quadro por padrão e Vínculo com o Negócio", () => {
    const pasta = state.folders.find((f) => f.id === "fld_meus_negocios");
    expect(pasta?.parentId).toBe("spc_com");
    const funis = state.funnels.filter((f) => f.lifecycle === "ativo");
    for (const funil of funis) {
      const lista = state.lists.find((l) => l.parentId === "fld_meus_negocios" && l.name === funil.name);
      expect(lista, funil.name).toBeDefined();
      if (!lista) continue;
      const cfg = effectiveListConfig(state, lista.id);
      const etapas = [...funil.stages].sort((a, b) => a.order - b.order).map((s) => s.name);
      expect(cfg?.statusSet.definitions.slice(0, etapas.length).map((d) => d.name)).toEqual(etapas);
      expect(cfg?.statusSet.definitions.slice(-2).map((d) => d.name)).toEqual(["Ganho", "Perdido"]);
      const negocios = state.deals.filter((d) => d.funnelId === funil.id && d.lifecycle === "ativo");
      const cartoes = state.tasks.filter((t) => t.listId === lista.id);
      expect(cartoes).toHaveLength(negocios.length);
      expect(cartoes.every((t) => t.provenance?.kind === "deal" && state.links.some((l) => l.fromId === t.id && l.toType === "deal" && l.toId === t.provenance?.sourceId))).toBe(true);
      expect(state.views.some((v) => v.listId === lista.id && v.isDefault && v.kind === "quadro")).toBe(true);
    }
  });
});
