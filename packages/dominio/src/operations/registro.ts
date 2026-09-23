/**
 * O registro explícito de operações — a allowlist que `POST /operacoes/:nome`
 * usa para despachar. Mesma disciplina de `../colecoes.ts`: uma operação sem
 * entrada aqui não fica alcançável por HTTP (T-1-04). Não há fallback por
 * `in`/reflexão — `Object.hasOwn` é a única porta de entrada.
 *
 * Regra de inclusão: entra se e somente se os dois primeiros parâmetros são
 * `(state: DataState, actingMemberId: Id, ...)` e o retorno é
 * `OperationResult<...>` — um caso de uso de um Membro, não um helper
 * (`nextId`, `recordActivity`), não uma leitura (`roleHolders`,
 * `memberCapacityMinutes`), não uma recusa pré-calculada (`listWriteRefusal`,
 * `statusOptionRefusal`) e não `submitForm` (quem responde a um Formulário
 * não é Membro — OQ-PF-01, Phase 2).
 *
 * O gravador de chamadas (`gravarChamadas`/`instrumentar`) resolve a Open
 * Question #2 do RESEARCH.md sem tocar nos ~140 pontos de chamada de
 * `apps/web`: a interface continua chamando `operacao(data, memberId,
 * ...args)` como sempre fez — o closure não viaja pela rede, então `run()`
 * roda o MESMO closure numa cópia do estado com o gravador ligado e descobre
 * nome + argumentos por observação, sem que nenhum componente mude. É a
 * mesma natureza de `resetIdSequence` — um botão de módulo, sem I/O.
 */

import type { DataState, OperationResult } from "../state";
import type { Id } from "../types";

// ── tasks.ts ────────────────────────────────────────────────────────────
import {
  addChecklist,
  addChecklistItem,
  addTaskComment,
  assignTask,
  changeTaskStatus,
  convertChecklistItem,
  createTask,
  endMeeting,
  moveTask,
  resolveTaskComment,
  restoreList,
  restoreTask,
  setChecklistItemDone,
  setTaskFieldValue,
  setTaskTags,
  startMeeting,
  trashTask,
  unassignTask,
  updateTask,
  watchTask,
} from "./tasks";

// ── deals.ts ────────────────────────────────────────────────────────────
import {
  createDeal,
  linkContactToDeal,
  loseDeal,
  migrateDealsToFunnel,
  moveDealToFunnel,
  moveDealToStage,
  removeStage,
  reopenDeal,
  restoreDeal,
  setDealFieldValue,
  unlinkContactFromDeal,
  winDeal,
} from "./deals";

// ── conversations.ts ────────────────────────────────────────────────────
import {
  assignConversation,
  discardDraft,
  markConversationRead,
  moveConversationToContact,
  reopenConversation,
  resolveConversation,
  restoreConversation,
  sendMessage,
  startConversation,
  toggleConversationStar,
  trashConversation,
} from "./conversations";

// ── contacts.ts ─────────────────────────────────────────────────────────
import {
  addCompanyIdentifier,
  addContactIdentifier,
  addContactNote,
  createCompany,
  createContact,
  endContactCompanyLink,
  importContacts,
  linkContactToCompany,
  markContactsAsDistinct,
  mergeContacts,
  restoreCompany,
  restoreContact,
  restoreMergedCopy,
  setContactCatalogValue,
  trashCompany,
  trashContact,
  transferContactIdentifier,
} from "./contacts";

// ── ai.ts ───────────────────────────────────────────────────────────────
import {
  configureChatSession,
  createChatSession,
  decideApproval,
  decideProcessApproval,
  publishAutomation,
  restoreAgent,
  restoreAutomation,
  sendChatMessage,
  solicitarAprovacao,
} from "./ai";

// ── chat-folders.ts ─────────────────────────────────────────────────────
import { createChatFolder, deleteChatFolder, moveChatSessionToFolder, renameChatFolder } from "./chat-folders";

// ── agent-builder.ts ────────────────────────────────────────────────────
import { createAgent, publishAgentVersion } from "./agent-builder";

// ── configuration.ts ────────────────────────────────────────────────────
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
  setContainerFeature,
  updateFieldDefinition,
  updateStatus,
  updateTaskType,
} from "./configuration";

// ── collaboration.ts ────────────────────────────────────────────────────
import {
  addDependency,
  addTimeEntry,
  attachFile,
  removeAttachment,
  removeDependency,
  setRecurrence,
  spawnNextOccurrence,
  startTimer,
  stopTimer,
} from "./collaboration";

// ── planning.ts ─────────────────────────────────────────────────────────
import {
  closeSprint,
  createNextSprint,
  disableSprints,
  enableSprints,
  instantiateListTemplate,
  instantiateTaskTemplate,
  renameTemplate,
  saveListAsTemplate,
  saveTaskAsTemplate,
  setMemberCapacity,
  setTemplateArchived,
} from "./planning";

// ── scale.ts ────────────────────────────────────────────────────────────
import {
  archiveForm,
  archiveGoal,
  createForm,
  createGoal,
  deleteView,
  linkTaskToGoal,
  revokePublicShare,
  rotateFormSecret,
  saveView,
  setDefaultView,
  setGoalArchived,
  shareTaskPublicly,
  updateForm,
  updateGoal,
} from "./scale";

// ── automations.ts ──────────────────────────────────────────────────────
import { runScheduledAutomations } from "./automations";

// ── financeiro.ts ───────────────────────────────────────────────────────
import { createReceivableSeries, runLancamentoAgent } from "./financeiro";

// ── conversao-de-solicitacao.ts ─────────────────────────────────────────
// `contaAPagarDeSolicitacao` NÃO entra: é leitura derivada, e a regra de
// inclusão do cabeçalho é explícita sobre isso.
import { converterSolicitacaoEmContaAPagar } from "./conversao-de-solicitacao";

// ── members.ts ──────────────────────────────────────────────────────────
import { deleteRole, grantGovernanceAccess, inviteMember, removeMember, transferWorkspaceOwnership } from "./members";

// ── structure.ts ────────────────────────────────────────────────────────
import { createFolder, createList, createSpace } from "./structure";

// ── iniciar-conversa.ts ─────────────────────────────────────────────────
import { iniciarConversa } from "./iniciar-conversa";

// ── ferramentas/notas.ts ───────────────────────────────────────────────
import { adicionarNotaNoAtivo } from "./ferramentas/notas";

// ── ferramentas/captacao.ts ─────────────────────────────────────────────
// registrarClique e simularEntradaPorClique ficam de fora: são Eventos do
// provedor/do clique público, sem actingMemberId (mesmo critério que exclui
// receberPedidoDeEntrada e registrarEntradaNoGrupo, ver ferramentas/grupos.ts).
import { criarLinkDeCaptacao, editarLinkDeCaptacao, enviarLinkALixeira, restaurarLinkDaLixeira } from "./ferramentas/captacao";

// ── ferramentas/grupos.ts ───────────────────────────────────────────────
// receberPedidoDeEntrada, registrarEntradaNoGrupo e registrarSaidaDoGrupo
// ficam de fora — Eventos do provedor, sem actingMemberId.
// conversaDoGrupoOuCriar fica de fora — o 2º parâmetro é ActorRef, não
// Id (não é um caso de uso de Membro: é chamada por outras operações com
// o Ator já resolvido, inclusive `systemActor`).
import {
  adicionarParticipantes,
  aprovarPedidoDeEntrada,
  arquivarGrupo,
  ativarCaptacao,
  criarGrupo,
  definirCanalDoGrupo,
  editarCaptacaoDoGrupo,
  editarGrupo,
  enviarGrupoALixeira,
  enviarMensagemAoGrupo,
  importarGruposDoCanal,
  inativarCaptacao,
  promoverParticipante,
  rebaixarParticipante,
  recusarPedidoDeEntrada,
  regenerarLinkDeConvite,
  removerParticipante,
  restaurarGrupo,
  restaurarGrupoDaLixeira,
  sairDoGrupo,
  sincronizarGrupo,
  zerarCliques,
} from "./ferramentas/grupos";

// ── ferramentas/flows.ts ────────────────────────────────────────────────
// validarVersaoDoFlow fica de fora — o 2º parâmetro é `flowId`, não
// `actingMemberId` (é leitura: valida sem exigir Membro). receberRespostaDeFlow
// fica de fora — Evento do provedor, sem actingMemberId.
import {
  adicionarComponente,
  adicionarTela,
  arquivarFlow,
  copiarFlow,
  criarFlow,
  criarRascunhoAPartirDe,
  definirPontoDeTrocaDeDados,
  descartarRascunho,
  despublicarFlow,
  duplicarComponente,
  duplicarTela,
  editarComponente,
  editarFlow,
  editarTela,
  enviarFlow,
  enviarFlowALixeira,
  moverComponente,
  publicarVersao,
  regenerarChavesDoPonto,
  removerComponente,
  removerPontoDeTrocaDeDados,
  removerTela,
  reordenarTela,
  restaurarFlow,
  restaurarFlowDaLixeira,
  sincronizarFlow,
} from "./ferramentas/flows";

// ── ferramentas/comunidades.ts ──────────────────────────────────────────
// recusaDeVinculo (recusa pré-calculada) e resumoDaComunidade (leitura) ficam
// de fora — mesmo critério do cabeçalho.
import {
  alterarConfiguracoesDaComunidade,
  arquivarComunidade,
  criarComunidade,
  desvincularGrupoDaComunidade,
  enviarComunidadeALixeira,
  enviarMensagemAComunidade,
  editarComunidade,
  restaurarComunidade,
  restaurarComunidadeDaLixeira,
  sairDaComunidade,
  sincronizarComunidade,
  vincularGrupoAComunidade,
} from "./ferramentas/comunidades";

/**
 * Toda operação alcançável por HTTP. Assinatura comum:
 * `(state, actingMemberId, ...args) => OperationResult`.
 *
 * `satisfies` (não uma anotação de tipo) preserva o tipo literal de cada
 * função — `OPERACOES.createTask` continua tipado com `CreateTaskInput`, não
 * com `any[]` — e ainda barra, em tempo de compilação, uma entrada cuja
 * função não bata com a forma comum. O `any[]` existe só para essa checagem;
 * não é necessário um `eslint-disable` porque `packages/dominio` não roda
 * eslint.
 */
export const OPERACOES = {
  // tasks.ts
  createTask,
  changeTaskStatus,
  assignTask,
  unassignTask,
  moveTask,
  convertChecklistItem,
  trashTask,
  restoreTask,
  restoreList,
  addChecklist,
  addChecklistItem,
  setChecklistItemDone,
  startMeeting,
  endMeeting,
  updateTask,
  setTaskFieldValue,
  addTaskComment,
  resolveTaskComment,
  setTaskTags,
  watchTask,
  // deals.ts
  moveDealToStage,
  winDeal,
  loseDeal,
  reopenDeal,
  linkContactToDeal,
  removeStage,
  migrateDealsToFunnel,
  restoreDeal,
  moveDealToFunnel,
  createDeal,
  unlinkContactFromDeal,
  setDealFieldValue,
  // conversations.ts
  sendMessage,
  resolveConversation,
  reopenConversation,
  assignConversation,
  trashConversation,
  moveConversationToContact,
  discardDraft,
  restoreConversation,
  startConversation,
  toggleConversationStar,
  markConversationRead,
  // contacts.ts
  addContactIdentifier,
  transferContactIdentifier,
  mergeContacts,
  endContactCompanyLink,
  trashContact,
  trashCompany,
  restoreMergedCopy,
  importContacts,
  restoreContact,
  restoreCompany,
  markContactsAsDistinct,
  addContactNote,
  createContact,
  createCompany,
  linkContactToCompany,
  addCompanyIdentifier,
  setContactCatalogValue,
  // ai.ts
  decideApproval,
  decideProcessApproval,
  solicitarAprovacao,
  publishAutomation,
  restoreAgent,
  restoreAutomation,
  createChatSession,
  configureChatSession,
  sendChatMessage,
  // chat-folders.ts
  createChatFolder,
  renameChatFolder,
  deleteChatFolder,
  moveChatSessionToFolder,
  // agent-builder.ts
  createAgent,
  publishAgentVersion,
  // configuration.ts
  createFieldDefinition,
  updateFieldDefinition,
  archiveFieldDefinition,
  restoreFieldDefinition,
  addStatus,
  updateStatus,
  reorderStatuses,
  removeStatus,
  overrideStatusSet,
  inheritStatusSet,
  createTaskType,
  updateTaskType,
  removeTaskType,
  setContainerFeature,
  // collaboration.ts
  addDependency,
  removeDependency,
  addTimeEntry,
  startTimer,
  stopTimer,
  attachFile,
  removeAttachment,
  setRecurrence,
  spawnNextOccurrence,
  // planning.ts
  setMemberCapacity,
  enableSprints,
  disableSprints,
  createNextSprint,
  closeSprint,
  saveListAsTemplate,
  saveTaskAsTemplate,
  instantiateTaskTemplate,
  instantiateListTemplate,
  renameTemplate,
  setTemplateArchived,
  // scale.ts
  saveView,
  deleteView,
  setDefaultView,
  createGoal,
  updateGoal,
  archiveGoal,
  setGoalArchived,
  linkTaskToGoal,
  createForm,
  updateForm,
  archiveForm,
  rotateFormSecret,
  shareTaskPublicly,
  revokePublicShare,
  // automations.ts
  runScheduledAutomations,
  // financeiro.ts
  runLancamentoAgent,
  createReceivableSeries,
  // conversao-de-solicitacao.ts
  converterSolicitacaoEmContaAPagar,
  // members.ts
  removeMember,
  transferWorkspaceOwnership,
  inviteMember,
  deleteRole,
  grantGovernanceAccess,
  // structure.ts
  createSpace,
  createFolder,
  createList,
  // iniciar-conversa.ts
  iniciarConversa,
  // ferramentas/notas.ts
  adicionarNotaNoAtivo,
  // ferramentas/captacao.ts
  criarLinkDeCaptacao,
  editarLinkDeCaptacao,
  enviarLinkALixeira,
  restaurarLinkDaLixeira,
  // ferramentas/grupos.ts
  criarGrupo,
  importarGruposDoCanal,
  sincronizarGrupo,
  editarGrupo,
  definirCanalDoGrupo,
  editarCaptacaoDoGrupo,
  ativarCaptacao,
  inativarCaptacao,
  zerarCliques,
  regenerarLinkDeConvite,
  adicionarParticipantes,
  removerParticipante,
  promoverParticipante,
  rebaixarParticipante,
  sairDoGrupo,
  arquivarGrupo,
  restaurarGrupo,
  enviarGrupoALixeira,
  restaurarGrupoDaLixeira,
  aprovarPedidoDeEntrada,
  recusarPedidoDeEntrada,
  enviarMensagemAoGrupo,
  // ferramentas/flows.ts
  criarFlow,
  editarFlow,
  definirPontoDeTrocaDeDados,
  regenerarChavesDoPonto,
  removerPontoDeTrocaDeDados,
  adicionarTela,
  editarTela,
  reordenarTela,
  duplicarTela,
  removerTela,
  adicionarComponente,
  editarComponente,
  moverComponente,
  duplicarComponente,
  removerComponente,
  publicarVersao,
  despublicarFlow,
  descartarRascunho,
  criarRascunhoAPartirDe,
  copiarFlow,
  arquivarFlow,
  restaurarFlow,
  enviarFlowALixeira,
  restaurarFlowDaLixeira,
  sincronizarFlow,
  enviarFlow,
  // ferramentas/comunidades.ts
  criarComunidade,
  sincronizarComunidade,
  editarComunidade,
  alterarConfiguracoesDaComunidade,
  vincularGrupoAComunidade,
  desvincularGrupoDaComunidade,
  enviarMensagemAComunidade,
  sairDaComunidade,
  arquivarComunidade,
  restaurarComunidade,
  enviarComunidadeALixeira,
  restaurarComunidadeDaLixeira,
} as const satisfies Record<string, (state: DataState, actingMemberId: Id, ...args: any[]) => OperationResult<unknown>>;

export type NomeDeOperacao = keyof typeof OPERACOES;

/**
 * `Object.hasOwn`, nunca `nome in OPERACOES`: `"constructor"` e `"__proto__"`
 * existem na cadeia de protótipo de qualquer objeto e passariam num `in`
 * (T-1-04).
 */
export function ehNomeDeOperacao(nome: string): nome is NomeDeOperacao {
  return Object.hasOwn(OPERACOES, nome);
}

/** O que viaja: o nome e os argumentos DEPOIS de `(state, actingMemberId)`. */
export interface ChamadaDeOperacao {
  readonly nome: NomeDeOperacao;
  readonly args: readonly unknown[];
}

/**
 * Gravador de módulo: `null` quando ninguém está observando. `instrumentar`
 * só registra uma chamada quando existe um gravador ativo — fora de
 * `gravarChamadas`, as exportações instrumentadas se comportam como as cruas.
 */
let gravador: ChamadaDeOperacao[] | null = null;

/**
 * Roda `corpo` com o gravador ligado e devolve o que foi chamado através das
 * exportações instrumentadas (`operations/index.ts`), nunca das versões cruas
 * dos módulos (`./tasks`, `./deals`…) — é por isso que os testes de domínio
 * existentes, que importam dos módulos, não enxergam o gravador.
 *
 * `try/finally` restaura o gravador anterior mesmo se `corpo` lançar, e
 * também no caso de `gravarChamadas` aninhado: o de fora não vê as chamadas
 * do de dentro.
 */
export function gravarChamadas<T>(corpo: () => T): { readonly resultado: T; readonly chamadas: readonly ChamadaDeOperacao[] } {
  const anterior = gravador;
  const atual: ChamadaDeOperacao[] = [];
  gravador = atual;
  try {
    const resultado = corpo();
    return { resultado, chamadas: atual };
  } finally {
    gravador = anterior;
  }
}

/**
 * A operação `nome` embrulhada: registra a chamada quando há gravador ativo
 * (os `args` gravados são os DEPOIS de `(state, actingMemberId)` — o servidor
 * injeta o Membro da sessão, nunca o do cliente, T-1-02), senão só delega.
 * Mesmo tipo da função original — `operations/index.ts` sombreia o `export *`
 * de cada módulo com uma linha `export const <nome> = instrumentar("<nome>")`.
 */
export function instrumentar<N extends NomeDeOperacao>(nome: N): (typeof OPERACOES)[N] {
  const original = OPERACOES[nome];
  const instrumentada = (state: DataState, actingMemberId: Id, ...args: unknown[]): unknown => {
    if (gravador) gravador.push({ nome, args });
    return (original as (state: DataState, actingMemberId: Id, ...args: unknown[]) => unknown)(state, actingMemberId, ...args);
  };
  return instrumentada as (typeof OPERACOES)[N];
}

/** A forma exata de `{ $tipo: "Date", iso }` — o único marcador que sobrevive à volta. */
interface MarcadorDeData {
  readonly $tipo: "Date";
  readonly iso: string;
}

function ehMarcadorDeData(valor: unknown): valor is MarcadorDeData {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return false;
  const chaves = Object.keys(valor);
  if (chaves.length !== 2) return false;
  const registro = valor as Record<string, unknown>;
  return registro.$tipo === "Date" && typeof registro.iso === "string";
}

function serializar(valor: unknown): unknown {
  if (valor instanceof Date) {
    const marcador: MarcadorDeData = { $tipo: "Date", iso: valor.toISOString() };
    return marcador;
  }
  if (Array.isArray(valor)) return valor.map(serializar);
  if (valor !== null && typeof valor === "object") {
    const resultado: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor)) resultado[chave] = serializar(v);
    return resultado;
  }
  return valor;
}

/**
 * JSON não tem `Date`: `runScheduledAutomations` recebe `today: Date` e é o
 * único argumento do registro que precisa disso. Recursivo sobre arrays e
 * objetos simples; qualquer outro valor (string, número, `null`…) passa
 * intocado.
 */
export function serializarArgumentos(args: readonly unknown[]): unknown[] {
  return args.map(serializar);
}

function reviver(valor: unknown): unknown {
  if (ehMarcadorDeData(valor)) return new Date(valor.iso);
  if (Array.isArray(valor)) return valor.map(reviver);
  if (valor !== null && typeof valor === "object") {
    const resultado: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor)) resultado[chave] = reviver(v);
    return resultado;
  }
  return valor;
}

export function reviverArgumentos(args: readonly unknown[]): unknown[] {
  return args.map(reviver);
}
