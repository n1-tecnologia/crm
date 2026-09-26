/**
 * Vocabulário de exibição que o próprio domínio precisa para se descrever.
 *
 * Mora aqui, e não na camada de interface, porque `derive.ts` nomeia o Ator de
 * um Registro de Atividade ao recompor o histórico — uma leitura derivada, não
 * uma decisão de tela — e as operações de IA os usam em mensagens de recusa.
 * A interface reexporta daqui (`features/shell/format`),
 * de modo que existe uma única fonte para estes rótulos.
 */

import { EVENTOS } from "./operations/ia/automacoes-catalogo";
import type { KnowledgeDocument } from "./types";

/** B36 — os cinco tipos de Ator que podem assinar um Registro. */
export const ACTOR_KIND_LABEL: Record<string, string> = {
  member: "Membro",
  agent: "Agente",
  automation: "Automação",
  integration: "Integração",
  system: "Sistema",
};

/** B41 — the eight Automation scopes, and the Resource types a screen names. */
export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  workspace: "Espaço de Trabalho",
  space: "Espaço",
  folder: "Pasta",
  subfolder: "Subpasta",
  list: "Lista",
  funnel: "Funil",
  queue: "Fila",
  inbox: "Caixa de Entrada",
  channel: "Canal",
  task: "Tarefa",
  deal: "Negócio",
  contact: "Contato",
  company: "Empresa",
  conversation: "Conversa",
  message: "Mensagem",
  collection: "Coleção",
  document: "Documento",
  panel: "Painel",
  agent: "Agente",
  skill: "Habilidade",
  automation: "Automação",
  team: "Equipe",
  member: "Membro",
  // O Catálogo tem Ferramenta sobre Grupo (`grupo.removerParticipante`): sem
  // o rótulo, o cartão de Plugins mostrava o identificador cru.
  grupo: "Grupo",
  comunidade: "Comunidade",
  flow: "Flow",
};

/** The object families the Activity Log and the Audit name. */
export const OBJECT_TYPE_LABEL: Record<string, string> = {
  ...RESOURCE_TYPE_LABEL,
  agentExecution: "Execução de Agente",
  automationExecution: "Execução de Automação",
  approval: "Solicitação de Aprovação",
  role: "Papel",
  contactIdentifier: "Identificador de Contato",
  stage: "Etapa",
  status: "Status",
  grupo: "Grupo",
  comunidade: "Comunidade",
  flow: "Flow",
  linkDeCaptacao: "Link de Captação",
  participacao: "Participação",
};

/**
 * B44 — the Events an Automation Trigger listens to. Uma só verdade: o
 * catálogo do editor (`EVENTOS`) diz o id, a família e o rótulo; aqui só a
 * projeção id → rótulo que as telas leem.
 */
export const TRIGGER_EVENT_LABEL: Record<string, string> = Object.fromEntries(EVENTOS.map((e) => [e.id, e.rotulo]));

/** 6.3 — o tipo de conteúdo do Documento. */
export const CONTENT_TYPE_LABEL: Record<KnowledgeDocument["contentType"], string> = {
  texto: "texto",
  imagem: "imagem",
  audio: "áudio",
  video: "vídeo",
  pdf: "PDF",
  arquivoEstruturado: "arquivo estruturado",
  paginaWeb: "página web",
};
