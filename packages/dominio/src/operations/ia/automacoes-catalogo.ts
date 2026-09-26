/**
 * O catálogo do editor de Automação (19): os Eventos que um Gatilho escuta,
 * com família e escopos EXPLÍCITOS — não por prefixo do identificador, que
 * classificava "contatoEntrouNoGrupo" como Contato e recusava publicá-lo num
 * Grupo —, os controles que uma Ação admite e o que os dois motores do
 * protótipo (`runListAutomations`/`runScheduledAutomations` em
 * `automations.ts` e `emitirEventoDeFerramentas` em
 * `ferramentas/automacoes.ts`) executam de verdade. O editor oferece tudo
 * que o tipo admite e marca o que roda (D5).
 *
 * Domínio puro, sem React: as telas leem daqui os rótulos e as marcas.
 */

import type { DataState } from "../../state";
import type { AutomationAction, AutomationScopeType, AutomationTrigger, Id } from "../../types";

/** A família do objeto sobre o qual o Evento ocorre — é ela que o escopo delimita (B41). */
export type Familia = "task" | "deal" | "contact" | "company" | "conversation" | "message" | "execution" | "document" | "grupo" | "flow";

export interface EventoDeGatilho {
  readonly id: string;
  readonly rotulo: string;
  readonly familia: Familia;
  /** Um motor do protótipo dispara por ele. */
  readonly executa: boolean;
  /** O Evento pede um subtipo: `status` = o nome do Status de entrada. */
  readonly subtipo?: "status";
}

/** B44 — os Eventos que um Gatilho por Evento escuta. Os ids são os que os seeds e os motores usam. */
export const EVENTOS: readonly EventoDeGatilho[] = [
  { id: "tarefaCriada", rotulo: "Tarefa criada", familia: "task", executa: true },
  { id: "tarefaEntrouEmStatus", rotulo: "Tarefa entrou em Status", familia: "task", executa: true, subtipo: "status" },
  { id: "tarefaAtualizada", rotulo: "Tarefa atualizada", familia: "task", executa: false },
  { id: "tarefaVencida", rotulo: "Tarefa vencida", familia: "task", executa: false },
  { id: "negocioEntrouEmEtapa", rotulo: "Negócio entrou em Etapa", familia: "deal", executa: false },
  { id: "negocioEncerrado", rotulo: "Negócio encerrado", familia: "deal", executa: false },
  { id: "contatoCriado", rotulo: "Contato criado", familia: "contact", executa: false },
  { id: "qualificacaoAlterada", rotulo: "Qualificação alterada", familia: "contact", executa: false },
  { id: "conversaCriada", rotulo: "Conversa criada", familia: "conversation", executa: false },
  // RN-CXE-06 — a Caixa de Entrada cria Contato, Identificador, Conversa e
  // Mensagem no mesmo ato quando chega Mensagem de quem ela não conhece, e
  // emite este Evento (caixa-de-entrada 18: "Contato criado automaticamente
  // por Mensagem"). É Evento DA CAIXA, com a Conversa como objeto — por isso
  // ocorre em Caixa de Entrada e Fila —, distinto de "Contato criado", que é
  // Evento de Contato e só ocorre no Espaço de Trabalho (RN-AUT-07).
  { id: "contatoCriadoPorMensagem", rotulo: "Contato criado por Mensagem", familia: "conversation", executa: false },
  { id: "conversaResolvida", rotulo: "Conversa resolvida", familia: "conversation", executa: false },
  { id: "mensagemRecebida", rotulo: "Mensagem recebida", familia: "message", executa: false },
  { id: "mensagemEnviada", rotulo: "Mensagem enviada", familia: "message", executa: false },
  { id: "execucaoConcluida", rotulo: "Execução concluída", familia: "execution", executa: false },
  { id: "execucaoFalhou", rotulo: "Execução falhou", familia: "execution", executa: false },
  { id: "documentoProcessado", rotulo: "Documento processado", familia: "document", executa: false },
  { id: "contatoEntrouNoGrupo", rotulo: "Contato entrou no Grupo", familia: "grupo", executa: true },
  { id: "contatoSaiuDoGrupo", rotulo: "Contato saiu do Grupo", familia: "grupo", executa: true },
  { id: "pedidoDeEntradaRecebido", rotulo: "Pedido de Entrada recebido", familia: "grupo", executa: true },
  { id: "respostaDeFlowRecebida", rotulo: "Resposta de Flow recebida", familia: "flow", executa: true },
];

export const eventoDoCatalogo = (eventType: string | undefined): EventoDeGatilho | undefined =>
  eventType === undefined ? undefined : EVENTOS.find((e) => e.id === eventType);

const TODAS_AS_FAMILIAS: readonly Familia[] = ["task", "deal", "contact", "company", "conversation", "message", "execution", "document", "grupo", "flow"];

/** B41 — o escopo delimita o Gatilho, nunca a Ação: as famílias de Evento que cada tipo de escopo alcança. */
export const FAMILIAS_DO_ESCOPO: Record<AutomationScopeType, readonly Familia[]> = {
  workspace: TODAS_AS_FAMILIAS,
  space: ["task"],
  folder: ["task"],
  list: ["task"],
  funnel: ["deal"],
  inbox: ["conversation", "message"],
  queue: ["conversation", "message"],
  grupo: ["grupo"],
  comunidade: ["grupo"],
  flow: ["flow"],
};

/** RN-AUT-07 — o Evento ocorre no escopo? Um Evento fora do catálogo não é compatível com nada. */
export function eventoCompativel(scopeType: AutomationScopeType, eventType: string | undefined): boolean {
  const evento = eventoDoCatalogo(eventType);
  if (!evento) return false;
  return FAMILIAS_DO_ESCOPO[scopeType].includes(evento.familia);
}

/** Os Eventos que o editor oferece para um escopo, na ordem do catálogo. */
export const eventosDoEscopo = (scopeType: AutomationScopeType): EventoDeGatilho[] =>
  EVENTOS.filter((e) => FAMILIAS_DO_ESCOPO[scopeType].includes(e.familia));

export type ControleDeAcao = Exclude<NonNullable<AutomationAction["controlKind"]>, "ramificar">;

/** B91 — os controles que uma Ação admite. Ramificar não entra neste protótipo. */
export const CONTROLES: ReadonlyArray<{ readonly id: ControleDeAcao; readonly rotulo: string; readonly executa: boolean }> = [
  { id: "invocarAgente", rotulo: "Invocar Agente", executa: true },
  { id: "solicitarAprovacao", rotulo: "Solicitar aprovação", executa: false },
  { id: "aguardar", rotulo: "Aguardar", executa: false },
  { id: "notificar", rotulo: "Notificar", executa: false },
  { id: "encerrar", rotulo: "Encerrar", executa: false },
];

/** As Ferramentas de escrita que os dois motores executam; as demais ficam registradas como `falhou` na disparada. */
export const FERRAMENTAS_QUE_EXECUTAM: ReadonlySet<string> = new Set([
  "tarefa.definirResponsavel",
  "tarefa.removerResponsavel",
  "tarefa.adicionarObservadores",
  "tarefa.alterarStatus",
  "tarefa.comentar",
  "tarefa.definirCampo",
  "contato.adicionarTag",
  "contato.definirCampo",
  "grupo.removerParticipante",
  "mensagem.enviarAoContato",
]);

const EVENTOS_DE_TAREFA: ReadonlySet<string> = new Set(["tarefaCriada", "tarefaEntrouEmStatus"]);
const EVENTOS_DE_GRUPO: ReadonlySet<string> = new Set(["contatoEntrouNoGrupo", "contatoSaiuDoGrupo", "pedidoDeEntradaRecebido"]);

/**
 * O par (escopo, Gatilho) dispara neste protótipo? Só o que os motores
 * alcançam: Lista por Tarefa criada, entrada em Status e distância do
 * vencimento; Grupo, Comunidade e Espaço de Trabalho pelos Eventos de Grupo;
 * Flow e Espaço de Trabalho pela Resposta de Flow.
 */
export function escopoExecutaNoPrototipo(scopeType: AutomationScopeType, trigger: AutomationTrigger | undefined): boolean {
  if (!trigger) return false;
  if (scopeType === "list") {
    if (trigger.kind === "condicaoTemporal") return true;
    return trigger.kind === "evento" && trigger.eventType !== undefined && EVENTOS_DE_TAREFA.has(trigger.eventType);
  }
  if (trigger.kind !== "evento" || trigger.eventType === undefined) return false;
  if (scopeType === "grupo" || scopeType === "comunidade") return EVENTOS_DE_GRUPO.has(trigger.eventType);
  if (scopeType === "flow") return trigger.eventType === "respostaDeFlowRecebida";
  if (scopeType === "workspace") return EVENTOS_DE_GRUPO.has(trigger.eventType) || trigger.eventType === "respostaDeFlowRecebida";
  return false;
}

/** O escopo referenciado existe? O Espaço de Trabalho é o próprio; o resto, por coleção. */
export function escopoExiste(state: DataState, scopeType: AutomationScopeType, scopeId: Id): boolean {
  switch (scopeType) {
    case "workspace":
      return state.workspace.id === scopeId;
    case "space":
      return state.spaces.some((s) => s.id === scopeId);
    case "folder":
      return state.folders.some((f) => f.id === scopeId);
    case "list":
      return state.lists.some((l) => l.id === scopeId);
    case "funnel":
      return state.funnels.some((f) => f.id === scopeId);
    case "inbox":
      return state.inbox.id === scopeId;
    case "queue":
      return state.queues.some((q) => q.id === scopeId);
    case "grupo":
      return state.grupos.some((g) => g.id === scopeId);
    case "comunidade":
      return state.comunidades.some((c) => c.id === scopeId);
    case "flow":
      return state.flows.some((f) => f.id === scopeId);
  }
}
