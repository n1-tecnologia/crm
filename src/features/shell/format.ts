/**
 * Formatting in pt-BR. Every date, number and currency goes through `Intl`
 * with the workspace Locale; nothing is hand-concatenated (ui-ptbr.md).
 *
 * A "dia civil" is rendered WITHOUT a timezone, an "instante" is rendered in
 * the Locale timezone (documento 06, 6.2).
 *
 * The Locale is a PARAMETER, not a constant. It used to be `America/Sao_Paulo`
 * hardcoded here, which happened to match the seeded workspace and would have
 * become a defect the moment a workspace had another timezone — the kind of bug
 * that only shows up in someone else's afternoon.
 */

import type { Locale, Money, TaskDate } from "@/data/types";

export interface Formatters {
  readonly money: (value: Money) => string;
  readonly number: (value: number) => string;
  /** An instant in time, rendered in the workspace timezone. */
  readonly instant: (iso: string) => string;
  /** A civil day carries no timezone: parsed and rendered as a plain date. */
  readonly civilDate: (value: string) => string;
  readonly taskDate: (date: TaskDate) => string;
  /** "há 4 minutos", "há 3 dias" — activity feeds and message lists. */
  readonly relative: (iso: string, now?: number) => string;
}

export function makeFormatters(locale: Locale): Formatters {
  const tag = locale.language;
  const money = new Intl.NumberFormat(tag, { style: "currency", currency: locale.currency });
  const decimal = new Intl.NumberFormat(tag);
  const instant = new Intl.DateTimeFormat(tag, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: locale.timezone,
  });
  const civil = new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "numeric" });
  const relative = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });

  const formatCivil = (value: string): string => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return civil.format(new Date(year, month - 1, day));
  };

  return {
    money: (value) =>
      value.currency === locale.currency
        ? money.format(value.amount)
        : new Intl.NumberFormat(tag, { style: "currency", currency: value.currency }).format(value.amount),
    number: (value) => decimal.format(value),
    instant: (iso) => instant.format(new Date(iso)),
    civilDate: formatCivil,
    taskDate: (date) => (date.form === "civilDay" ? formatCivil(date.value) : instant.format(new Date(date.value))),
    relative: (iso, now = Date.now()) => {
      const diffMs = new Date(iso).getTime() - now;
      const units: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
        ["year", 31_536_000_000],
        ["month", 2_592_000_000],
        ["day", 86_400_000],
        ["hour", 3_600_000],
        ["minute", 60_000],
      ];
      for (const [unit, ms] of units) {
        if (Math.abs(diffMs) >= ms) return relative.format(Math.round(diffMs / ms), unit);
      }
      return "agora";
    },
  };
}

/** Ontology state codes are invariant in gender; only the label around varies. */
export const LIFECYCLE_LABEL: Record<string, string> = {
  ativo: "ativo",
  arquivado: "arquivado",
  naLixeira: "na lixeira",
  mesclado: "mesclado",
  rascunho: "rascunho",
  pausado: "pausado",
  suspenso: "suspenso",
  encerrado: "encerrado",
  pendente: "pendente",
  removido: "removido",
  comErro: "com erro",
  desatualizado: "desatualizado",
};

export const STATUS_CATEGORY_LABEL: Record<string, string> = {
  naoIniciado: "não iniciado",
  emAndamento: "em andamento",
  concluido: "concluído",
  fechado: "fechado",
};

export const CONVERSATION_STATE_LABEL: Record<string, string> = {
  aberta: "aberta",
  pendente: "pendente",
  resolvida: "resolvida",
};

export const DEAL_SITUATION_LABEL: Record<string, string> = {
  aberto: "aberto",
  ganho: "ganho",
  perdido: "perdido",
};

export const DEAL_CONTACT_ROLE_LABEL: Record<string, string> = {
  decisor: "Decisor",
  influenciador: "Influenciador",
  tecnico: "Técnico",
  outro: "Outro",
};

export const PRIORITY_LABEL: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
  semPrioridade: "Sem prioridade",
};

export const EFFECT_CLASS_LABEL: Record<string, string> = {
  leitura: "leitura",
  escritaReversivel: "escrita reversível",
  escritaIrreversivel: "escrita irreversível",
  externa: "externa",
};

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
};

/** B77 — why the Execution stopped to ask. */
export const APPROVAL_REASON_LABEL: Record<string, string> = {
  autonomia: "o nível de autonomia do Agente",
  permissao: "o Agente não tem a permissão sozinho",
  limite: "o Limite de operações da Execução",
  acaoExplicita: "a Ação exige aprovação explícita",
};

export const IDENTIFIER_TYPE_LABEL: Record<string, string> = {
  telefone: "Telefone",
  email: "E-mail",
  identidadeDeWhatsApp: "Identidade de WhatsApp",
  usuarioDeInstagram: "Usuário de Instagram",
  identificadorDeChatDoSite: "Identificador de chat do site",
  perfilDeLinkedIn: "Perfil de LinkedIn",
  perfilDeTikTok: "Perfil de TikTok",
};

export const CHANNEL_TYPE_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  email: "E-mail",
  chatDoSite: "Chat do site",
};

/** RN-CON-16 — consent is a decision with a date, never a silent default. */
export const CONSENT_DECISION_LABEL: Record<string, string> = {
  concedido: "concedido",
  revogado: "revogado",
};

/** B18 — Execution states, shared by the Execution screen and the Agent record. */
export const EXECUTION_STATE_LABEL: Record<string, string> = {
  pendente: "pendente",
  executando: "executando",
  aguardandoAprovacao: "aguardando aprovação",
  concluida: "concluída",
  falhou: "falhou",
  cancelada: "cancelada",
};

export const EXECUTION_STEP_KIND_LABEL: Record<string, string> = {
  ferramenta: "Ferramenta",
  habilidade: "Habilidade",
  aprovacao: "Aprovação",
  raciocinio: "Raciocínio",
  memorizacao: "Memorização",
};

/** A9.3 — where the invocation came from. */
export const EXECUTION_ORIGIN_LABEL: Record<string, string> = {
  sessaoDeChat: "Sessão de Chat",
  acaoDireta: "ação direta",
  automacao: "Automação",
  agente: "outro Agente",
  caixaDeEntrada: "Caixa de Entrada",
};

/** A9.1 — where a permission comes from. */
export const PERMISSION_ORIGIN_LABEL: Record<string, string> = {
  papel: "Papel",
  concessaoDireta: "concessão direta",
  heranca: "herança",
  compartilhamento: "compartilhamento",
  propriedade: "propriedade",
  elegibilidadeDeFila: "elegibilidade de Fila",
};

/** Connection state of a Channel or Integration. */
export const CONNECTION_LABEL: Record<string, string> = {
  conectada: "conectada",
  desconectada: "desconectada",
  comErro: "com erro",
};

/** RN-CNH-19 — how a Source feeds a Collection. */
export const SOURCE_KIND_LABEL: Record<string, string> = {
  envioManual: "envio manual",
  url: "endereço web",
  integracao: "Integração",
};

/** A5.2 — the shape of a Field Definition. */
export const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "texto",
  longText: "texto longo",
  number: "número",
  currency: "moeda",
  percent: "porcentagem",
  date: "data",
  dateTime: "data e hora",
  singleSelect: "seleção única",
  multiSelect: "seleção múltipla",
  checkbox: "sim ou não",
  person: "pessoa",
  phone: "telefone",
  email: "e-mail",
  url: "endereço web",
  file: "arquivo",
  rating: "avaliação",
  relation: "relação",
  formula: "fórmula",
};

/** Documents that identify a Company (documento 11). */
export const COMPANY_IDENTIFIER_LABEL: Record<string, string> = {
  dominio: "Domínio",
  documentoFiscal: "Documento fiscal",
  telefone: "Telefone",
};

/** B44 — the Events an Automation Trigger listens to. */
export const TRIGGER_EVENT_LABEL: Record<string, string> = {
  tarefaCriada: "Tarefa criada",
  tarefaAtualizada: "Tarefa atualizada",
  negocioEntrouEmEtapa: "Negócio entrou em Etapa",
  negocioEncerrado: "Negócio encerrado",
  conversaCriada: "Conversa criada",
  conversaResolvida: "Conversa resolvida",
  mensagemRecebida: "Mensagem recebida",
  mensagemEnviada: "Mensagem enviada",
  contatoCriado: "Contato criado",
};

/** B44 — como o Gatilho dispara, antes de qual Evento ele escuta. */
export const TRIGGER_KIND_LABEL: Record<string, string> = {
  evento: "por Evento",
  agendamento: "por agendamento",
  manual: "manual",
  condicaoTemporal: "por condição de tempo",
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
};

/** B97 — how far a Document Version got through processing. */
export const PROCESSING_LABEL: Record<string, string> = {
  pendente: "pendente",
  processado: "processado",
  comErro: "com erro",
};

/** DO-CXE-14 — a Disponibilidade de atendimento do Membro. */
export const AVAILABILITY_LABEL: Record<string, string> = {
  disponivel: "disponível",
  ausente: "ausente",
  indisponivel: "indisponível",
};
