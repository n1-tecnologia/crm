/**
 * A SPEC DO FORMULÁRIO DE CADA BLOCO DA AUTOMAÇÃO (19, 7.2–7.5): que campos
 * um Gatilho, uma Condição ou uma Ação têm, com que controle se editam e para
 * onde cada valor vai — um atributo do tipo (`eventType`, `agentId`) ou uma
 * chave do JSON que os dois motores leem (`params`/`expression`/
 * `temporalPredicate`, no vocabulário de `automations.ts` e de
 * `ferramentas/automacoes.ts`). Um formulário genérico (`BlocoForm`) lê isto
 * e se monta, como `flow-spec.ts` faz com os Componentes de Flow.
 *
 * O editor oferece tudo que o tipo admite e marca o que o protótipo executa
 * (D5): a marca vem do catálogo do domínio, não é repetida aqui.
 */

import type { DataState } from "@n1/dominio/state";
import { CONTROLES, FERRAMENTAS_QUE_EXECUTAM, escopoExecutaNoPrototipo, eventoDoCatalogo, eventosDoEscopo, type ControleDeAcao } from "@n1/dominio/operations";
import type { AutomationAction, AutomationCondition, AutomationScopeType, AutomationTrigger, AutonomyLevel, FieldDefinition, Id, TriggerKind } from "@n1/dominio/types";
import { AUTONOMY_LABEL, EFFECT_CLASS_LABEL, TRIGGER_KIND_LABEL } from "@/features/shell/format";
import { EXECUTA_LABEL, NAO_EXECUTA_LABEL } from "../rotulos";

/** O valor plano que o formulário edita; a spec diz como ele vira o tipo real. */
export type ValorDoBloco = Record<string, unknown>;

/** O que o formulário sabe do mundo ao montar as opções de um campo. */
export interface ContextoDaSpec {
  readonly state: DataState;
  readonly scopeType: AutomationScopeType;
  readonly scopeId: Id;
  readonly valor: ValorDoBloco;
}

export interface OpcaoDaSpec {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
  readonly color?: string;
  readonly disabledReason?: string;
}

export type ControleDeCampo =
  | "escolha"
  | "escolhas"
  | "status"
  | "campo"
  | "membro"
  | "membros"
  | "agente"
  | "habilidade"
  | "texto"
  | "textoLongo"
  | "numero"
  | "booleano"
  | "json";

export interface CampoSpec {
  readonly chave: string;
  readonly rotulo: string;
  readonly controle: ControleDeCampo;
  readonly obrigatorio?: boolean;
  /** Fixas, ou montadas do estado (Tags, Canais, Eventos do escopo). */
  readonly opcoes?: readonly OpcaoDaSpec[] | ((ctx: ContextoDaSpec) => readonly OpcaoDaSpec[]);
  readonly ajuda?: string;
  readonly placeholder?: string;
  /** `campo`: as Definições de Campo deste alvo; sem ele, o alvo vem do escopo. */
  readonly alvo?: FieldDefinition["target"];
  /** O campo só aparece quando a função diz — o subtipo do Evento, o valor do operador. */
  readonly visivelSe?: (valor: ValorDoBloco) => boolean;
  /**
   * Para onde o valor vai: `raiz` é um atributo do próprio tipo (`agentId`,
   * `timeoutHours`, `params` cru); `json` é uma chave do JSON de
   * `params`/`expression`. O Gatilho tem os seus próprios destinos.
   */
  readonly destino?: "raiz" | "json";
}

export interface BlocoSpec {
  readonly rotulo: string;
  readonly descricao: string;
  readonly campos: readonly CampoSpec[];
  /** Ação com Ferramenta legada: o nome da equivalente que o motor executa (a pílula "legado" do formulário). */
  readonly legadoDe?: string;
}

// ── Ferramentas legadas (D5) ───────────────────────────────────────────────

/**
 * As Ferramentas antigas do Catálogo que ganharam uma equivalente que os
 * motores executam (`FERRAMENTAS_QUE_EXECUTAM`). Continuam no Catálogo — o
 * motor do Financeiro e as Execuções passadas as referenciam — e nas
 * Automações que já as usam (a Ação segue íntegra e editável), mas saem do
 * seletor de NOVA Ação: oferecer "Alterar Status de Tarefa" ao lado de
 * "Alterar Status da Tarefa" é convidar a publicar uma Automação que nunca
 * roda. `id antigo → id executável`.
 */
export const FERRAMENTAS_DEPRECIADAS: ReadonlyMap<string, string> = new Map([
  ["alterar_status", "tarefa.alterarStatus"],
  ["criar_comentario", "tarefa.comentar"],
  ["enviar_mensagem", "mensagem.enviarAoContato"],
]);

export const ferramentaDepreciada = (toolId: string | undefined): boolean => toolId !== undefined && FERRAMENTAS_DEPRECIADAS.has(toolId);

const rotuloDoEvento = (executa: boolean): string => (executa ? EXECUTA_LABEL : NAO_EXECUTA_LABEL);

// ── Gatilho (7.2) ──────────────────────────────────────────────────────────

type Frequencia = NonNullable<AutomationTrigger["schedule"]>["frequency"];

const FREQUENCIAS: readonly Frequencia[] = ["minutos", "horas", "dias", "semanas", "meses"];

const NIVEIS_DE_AUTONOMIA: readonly AutonomyLevel[] = ["assistido", "supervisionado", "autonomo"];

/** Os dias da semana no formato que `schedule.weekDays` guarda (0 = domingo). */
const DIAS_DA_SEMANA: readonly OpcaoDaSpec[] = [
  { value: "1", label: "segunda" },
  { value: "2", label: "terça" },
  { value: "3", label: "quarta" },
  { value: "4", label: "quinta" },
  { value: "5", label: "sexta" },
  { value: "6", label: "sábado" },
  { value: "0", label: "domingo" },
];

export const SPEC_DO_GATILHO: Record<TriggerKind, BlocoSpec> = {
  evento: {
    rotulo: TRIGGER_KIND_LABEL.evento ?? "por Evento",
    descricao: "Dispara quando o Evento acontece num objeto que o escopo alcança (B41).",
    campos: [
      {
        chave: "eventType",
        rotulo: "Evento",
        controle: "escolha",
        obrigatorio: true,
        opcoes: ({ scopeType }) => eventosDoEscopo(scopeType).map((e) => ({ value: e.id, label: e.rotulo, detail: rotuloDoEvento(e.executa) })),
        ajuda: "Só os Eventos que ocorrem no escopo desta Automação (RN-AUT-07).",
      },
      {
        chave: "eventSubtype",
        rotulo: "Status de entrada",
        controle: "status",
        obrigatorio: true,
        visivelSe: (valor) => eventoDoCatalogo(typeof valor.eventType === "string" ? valor.eventType : undefined)?.subtipo === "status",
        ajuda: "O Gatilho dispara quando a Tarefa entra neste Status.",
      },
    ],
  },
  agendamento: {
    rotulo: TRIGGER_KIND_LABEL.agendamento ?? "por agendamento",
    descricao: "Dispara pelo relógio, sem objeto: a cada intervalo, nos dias e no horário escolhidos.",
    campos: [
      {
        chave: "frequency",
        rotulo: "Frequência",
        controle: "escolha",
        obrigatorio: true,
        opcoes: FREQUENCIAS.map((f) => ({ value: f, label: f })),
      },
      { chave: "interval", rotulo: "Intervalo", controle: "numero", obrigatorio: true, ajuda: "Maior que zero: a cada quantas unidades da frequência." },
      { chave: "weekDays", rotulo: "Dias da semana", controle: "escolhas", opcoes: DIAS_DA_SEMANA, ajuda: "Vazio = todos os dias." },
      { chave: "time", rotulo: "Horário", controle: "texto", placeholder: "09:00", ajuda: "HH:MM, no fuso do Espaço de Trabalho." },
    ],
  },
  manual: {
    rotulo: TRIGGER_KIND_LABEL.manual ?? "manual",
    descricao: "Dispara quando um Membro aciona a Automação à mão sobre um objeto do escopo.",
    campos: [],
  },
  condicaoTemporal: {
    rotulo: TRIGGER_KIND_LABEL.condicaoTemporal ?? "por condição de tempo",
    descricao: "Dispara por distância do vencimento da Tarefa: antes (negativo) ou depois (positivo).",
    campos: [
      {
        chave: "dueDateOffsetDays",
        rotulo: "Dias em relação ao vencimento",
        controle: "numero",
        obrigatorio: true,
        ajuda: "−5 = cinco dias antes; 1 = um dia depois. Cada par (Automação, Tarefa) dispara uma vez.",
      },
    ],
  },
};

const numero = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const texto = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

function jsonOuNada(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** O valor plano de um Gatilho gravado, para o formulário abrir preenchido. */
export function valorDoGatilho(trigger: AutomationTrigger | undefined): ValorDoBloco {
  if (!trigger) return {};
  switch (trigger.kind) {
    case "evento":
      return { ...(trigger.eventType !== undefined ? { eventType: trigger.eventType } : {}), ...(trigger.eventSubtype !== undefined ? { eventSubtype: trigger.eventSubtype } : {}) };
    case "agendamento":
      return trigger.schedule
        ? {
            frequency: trigger.schedule.frequency,
            interval: trigger.schedule.interval,
            ...(trigger.schedule.weekDays ? { weekDays: trigger.schedule.weekDays.map(String) } : {}),
            ...(trigger.schedule.time !== undefined ? { time: trigger.schedule.time } : {}),
          }
        : {};
    case "manual":
      return {};
    case "condicaoTemporal": {
      const spec = jsonOuNada(trigger.temporalPredicate);
      const dias = numero(spec?.dueDateOffsetDays);
      return dias !== undefined ? { dueDateOffsetDays: dias } : {};
    }
  }
}

/** O Gatilho que o valor plano descreve, no formato que o motor lê. */
export function gatilhoDoValor(kind: TriggerKind, valor: ValorDoBloco): AutomationTrigger {
  switch (kind) {
    case "evento": {
      const eventType = texto(valor.eventType);
      const eventSubtype = texto(valor.eventSubtype);
      return { kind, ...(eventType !== undefined ? { eventType } : {}), ...(eventSubtype !== undefined ? { eventSubtype } : {}) };
    }
    case "agendamento": {
      const frequency = FREQUENCIAS.find((f) => f === valor.frequency);
      const interval = numero(valor.interval) ?? 0;
      const weekDays = Array.isArray(valor.weekDays) ? valor.weekDays.map(Number).filter((d) => Number.isInteger(d)) : [];
      const time = texto(valor.time);
      return {
        kind,
        schedule: {
          frequency: frequency ?? "dias",
          interval,
          ...(weekDays.length > 0 ? { weekDays } : {}),
          ...(time !== undefined ? { time } : {}),
        },
      };
    }
    case "manual":
      return { kind };
    case "condicaoTemporal": {
      const dias = numero(valor.dueDateOffsetDays);
      return { kind, ...(dias !== undefined ? { temporalPredicate: JSON.stringify({ dueDateOffsetDays: dias }) } : {}) };
    }
  }
}

/** Uma linha que diz o Gatilho: "Tarefa entrou em Status “pago”", "a cada 2 dias às 09:00". */
export function resumoDoGatilho(trigger: AutomationTrigger | undefined): string {
  if (!trigger) return "sem Gatilho";
  switch (trigger.kind) {
    case "evento": {
      const evento = eventoDoCatalogo(trigger.eventType);
      const nome = evento?.rotulo ?? trigger.eventType ?? "Evento a escolher";
      return trigger.eventSubtype ? `${nome} “${trigger.eventSubtype}”` : nome;
    }
    case "agendamento": {
      if (!trigger.schedule) return "agendamento a definir";
      const dias = trigger.schedule.weekDays?.length ? ` · ${trigger.schedule.weekDays.map((d) => DIAS_DA_SEMANA.find((o) => o.value === String(d))?.label ?? d).join(", ")}` : "";
      return `a cada ${trigger.schedule.interval} ${trigger.schedule.frequency}${trigger.schedule.time ? ` às ${trigger.schedule.time}` : ""}${dias}`;
    }
    case "manual":
      return "acionado à mão por um Membro";
    case "condicaoTemporal": {
      const dias = numero(jsonOuNada(trigger.temporalPredicate)?.dueDateOffsetDays);
      if (dias === undefined) return "condição de tempo a definir";
      if (dias === 0) return "no dia do vencimento";
      return dias < 0 ? `${-dias} dia${dias === -1 ? "" : "s"} antes do vencimento` : `${dias} dia${dias === 1 ? "" : "s"} depois do vencimento`;
    }
  }
}

// ── Condições (7.3) ────────────────────────────────────────────────────────

export type TipoDeCondicao = AutomationCondition["kind"];

export const TIPO_DE_CONDICAO_LABEL: Record<TipoDeCondicao, string> = {
  atributo: "atributo",
  valorDeCampo: "Valor de Campo",
  pertencimento: "pertencimento",
  temporal: "temporal",
  hibrida: "híbrida",
};

const OPERADORES_DE_CAMPO: readonly OpcaoDaSpec[] = [
  { value: "vazio", label: "está vazio" },
  { value: "preenchido", label: "está preenchido" },
  { value: "igual", label: "é igual a" },
];

export const SPEC_DA_CONDICAO: Record<TipoDeCondicao, BlocoSpec> = {
  atributo: {
    rotulo: TIPO_DE_CONDICAO_LABEL.atributo,
    descricao: "Um atributo do objeto no momento do Gatilho — neste protótipo, o Status da Tarefa.",
    campos: [{ chave: "status", rotulo: "Status", controle: "status", obrigatorio: true, ajuda: "A Tarefa precisa estar neste Status para as Ações rodarem." }],
  },
  valorDeCampo: {
    rotulo: TIPO_DE_CONDICAO_LABEL.valorDeCampo,
    descricao: "O Valor de um Campo do objeto: vazio, preenchido ou igual a um texto.",
    campos: [
      { chave: "definitionId", rotulo: "Campo", controle: "campo", obrigatorio: true, ajuda: "Uma Definição de Campo que exista (RN-AUT-21)." },
      { chave: "operador", rotulo: "Operador", controle: "escolha", obrigatorio: true, opcoes: OPERADORES_DE_CAMPO },
      { chave: "equals", rotulo: "Valor", controle: "texto", obrigatorio: true, visivelSe: (valor) => valor.operador === "igual" },
    ],
  },
  pertencimento: {
    rotulo: TIPO_DE_CONDICAO_LABEL.pertencimento,
    descricao: "O objeto pertence a um conjunto: uma Equipe, uma Tag, uma Etapa. Registrada; o motor deste protótipo não a avalia.",
    campos: [{ chave: "expression", rotulo: "Expressão", controle: "texto", obrigatorio: true, destino: "raiz", placeholder: "tag = cliente-vip" }],
  },
  temporal: {
    rotulo: TIPO_DE_CONDICAO_LABEL.temporal,
    descricao: "Uma janela de tempo: dia da semana, horário, distância de uma data. Registrada; o motor deste protótipo não a avalia.",
    campos: [{ chave: "expression", rotulo: "Expressão", controle: "texto", obrigatorio: true, destino: "raiz", placeholder: "dia útil, entre 9h e 18h" }],
  },
  hibrida: {
    rotulo: TIPO_DE_CONDICAO_LABEL.hibrida,
    descricao: "Um Agente classifica o objeto e responde sim ou não (B90). Gera uma Execução filha; o motor deste protótipo a considera satisfeita.",
    campos: [
      { chave: "agentId", rotulo: "Agente", controle: "agente", obrigatorio: true, destino: "raiz", ajuda: "Precisa estar ativo na publicação (RN-AUT-06)." },
      { chave: "skillId", rotulo: "Habilidade", controle: "habilidade", destino: "raiz", ajuda: "Uma Habilidade concedida ao Agente; vazio = o Agente decide." },
      { chave: "expression", rotulo: "O que classificar", controle: "textoLongo", obrigatorio: true, destino: "raiz", placeholder: "A mensagem demonstra intenção de compra?" },
      { chave: "defaultOnFailure", rotulo: "Resposta se o Agente falhar", controle: "texto", destino: "raiz", placeholder: "não" },
    ],
  },
};

/** O valor plano de uma Condição gravada. */
export function valorDaCondicao(condition: AutomationCondition): ValorDoBloco {
  const raiz: ValorDoBloco = {
    ...(condition.agentId !== undefined ? { agentId: condition.agentId } : {}),
    ...(condition.skillId !== undefined ? { skillId: condition.skillId } : {}),
    ...(condition.defaultOnFailure !== undefined ? { defaultOnFailure: condition.defaultOnFailure } : {}),
  };
  if (condition.kind === "atributo") {
    const spec = jsonOuNada(condition.expression);
    // Uma expressão livre dos seeds ("etapa = Proposta") aparece como está: o formulário a substitui ao gravar.
    return { ...raiz, status: texto(spec?.status) ?? condition.expression };
  }
  if (condition.kind === "valorDeCampo") {
    const spec = jsonOuNada(condition.expression) ?? {};
    const operador = spec.empty === true ? "vazio" : spec.empty === false ? "preenchido" : spec.equals !== undefined ? "igual" : undefined;
    return {
      ...raiz,
      ...(texto(spec.definitionId) !== undefined ? { definitionId: spec.definitionId } : {}),
      ...(operador ? { operador } : {}),
      ...(spec.equals !== undefined ? { equals: String(spec.equals) } : {}),
    };
  }
  return { ...raiz, expression: condition.expression };
}

/** A Condição que o valor plano descreve, no vocabulário de `conditionsHold`. */
export function condicaoDoValor(kind: TipoDeCondicao, valor: ValorDoBloco): AutomationCondition {
  const raiz = {
    ...(kind === "hibrida" && texto(valor.agentId) !== undefined ? { agentId: valor.agentId as Id } : {}),
    ...(kind === "hibrida" && texto(valor.skillId) !== undefined ? { skillId: valor.skillId as Id } : {}),
    ...(texto(valor.defaultOnFailure) !== undefined ? { defaultOnFailure: valor.defaultOnFailure as string } : {}),
  };
  if (kind === "atributo") return { kind, expression: JSON.stringify({ status: texto(valor.status) ?? "" }), ...raiz };
  if (kind === "valorDeCampo") {
    const operador = valor.operador;
    return {
      kind,
      expression: JSON.stringify({
        definitionId: texto(valor.definitionId) ?? "",
        ...(operador === "vazio" ? { empty: true } : operador === "preenchido" ? { empty: false } : operador === "igual" ? { equals: texto(valor.equals) ?? "" } : {}),
      }),
      ...raiz,
    };
  }
  return { kind, expression: texto(valor.expression) ?? "", ...raiz };
}

/** Uma linha que diz a Condição: "Status “para pagar”", "Anexo está vazio", "Agente SDR classifica". */
export function resumoDaCondicao(state: DataState, condition: AutomationCondition): string {
  const spec = jsonOuNada(condition.expression);
  // Seeds antigos guardam `{ status }` sob `valorDeCampo`; o motor lê a chave, não o tipo.
  if (condition.kind !== "hibrida" && texto(spec?.status) !== undefined) return `Status “${String(spec?.status)}”`;
  switch (condition.kind) {
    case "atributo":
      return texto(spec?.status) !== undefined ? `Status “${String(spec?.status)}”` : condition.expression;
    case "valorDeCampo": {
      const nome = state.fieldDefinitions.find((d) => d.id === spec?.definitionId)?.name ?? String(spec?.definitionId ?? "Campo");
      if (spec?.empty === true) return `${nome} está vazio`;
      if (spec?.empty === false) return `${nome} está preenchido`;
      if (spec?.equals !== undefined) return `${nome} = “${String(spec.equals)}”`;
      return nome;
    }
    case "hibrida": {
      const agente = state.agents.find((a) => a.id === condition.agentId)?.name ?? "Agente a escolher";
      const habilidade = condition.skillId ? state.skills.find((s) => s.id === condition.skillId)?.name : undefined;
      return `${agente}${habilidade ? ` · ${habilidade}` : ""}${condition.expression ? ` · ${condition.expression}` : ""}`;
    }
    default:
      return condition.expression || "expressão a definir";
  }
}

// ── Ações (7.4) ────────────────────────────────────────────────────────────

const AUTONOMIAS: readonly OpcaoDaSpec[] = NIVEIS_DE_AUTONOMIA.map((a) => ({ value: a, label: AUTONOMY_LABEL[a] ?? a }));

const TEMPLATE_DA_TAREFA = "Marcadores: {{titulo}}, {{vencimento}}, {{cliente}}, {{donoDoCliente}}, {{campo:<id da Definição>}}.";

const PARAMS_LIVRES: readonly CampoSpec[] = [
  { chave: "params", rotulo: "Parâmetros (JSON)", controle: "json", destino: "raiz", ajuda: "O motor deste protótipo não executa esta Ferramenta: os parâmetros ficam registrados." },
  { chave: "targetExpression", rotulo: "Alvo", controle: "texto", destino: "raiz", placeholder: "lst_funil_sdr", ajuda: "Expressão que aponta o objeto sobre o qual a Ferramenta age." },
];

/** A spec de cada Ferramenta que um motor executa; as demais recebem parâmetros livres. */
const SPEC_DA_FERRAMENTA: Record<string, readonly CampoSpec[]> = {
  "tarefa.definirResponsavel": [{ chave: "memberId", rotulo: "Responsável", controle: "membro", obrigatorio: true, ajuda: "Os demais Responsáveis saem." }],
  "tarefa.removerResponsavel": [{ chave: "memberId", rotulo: "Membro", controle: "membro", obrigatorio: true }],
  "tarefa.adicionarObservadores": [
    { chave: "memberIds", rotulo: "Observadores", controle: "membros" },
    { chave: "fromFieldDefinitionId", rotulo: "Também quem estiver no Campo", controle: "campo", alvo: "task", ajuda: "Um Campo de pessoa da Tarefa." },
  ],
  "tarefa.alterarStatus": [{ chave: "statusName", rotulo: "Status de destino", controle: "status", obrigatorio: true }],
  "tarefa.comentar": [
    { chave: "template", rotulo: "Texto do Comentário", controle: "textoLongo", obrigatorio: true, ajuda: TEMPLATE_DA_TAREFA, placeholder: "Bem-vindo, {{titulo}}" },
    { chave: "mentionMemberId", rotulo: "Mencionar", controle: "membro" },
    { chave: "mentionFieldDefinitionId", rotulo: "Mencionar quem estiver no Campo", controle: "campo", alvo: "task" },
    { chave: "mentionClientOwner", rotulo: "Mencionar o dono do cliente no CRM", controle: "booleano" },
  ],
  "tarefa.definirCampo": [
    { chave: "definitionId", rotulo: "Campo", controle: "campo", alvo: "task", obrigatorio: true },
    { chave: "value", rotulo: "Valor", controle: "texto", visivelSe: (valor) => valor.today !== true },
    { chave: "today", rotulo: "Gravar o dia de hoje", controle: "booleano" },
    { chave: "onlyIfEmpty", rotulo: "Só se o Campo estiver vazio", controle: "booleano" },
  ],
  "contato.adicionarTag": [
    {
      chave: "tagId",
      rotulo: "Tag",
      controle: "escolha",
      obrigatorio: true,
      opcoes: ({ state }) => state.tags.filter((t) => t.lifecycle === "ativo").map((t) => ({ value: t.id, label: t.name, color: t.color })),
    },
  ],
  "contato.definirCampo": [
    { chave: "definitionId", rotulo: "Campo", controle: "campo", alvo: "contact", obrigatorio: true },
    { chave: "value", rotulo: "Valor", controle: "texto", obrigatorio: true },
  ],
  "mensagem.enviarAoContato": [
    { chave: "template", rotulo: "Mensagem", controle: "textoLongo", obrigatorio: true, ajuda: "Marcadores: {{nome}} (o Contato) e {{grupo}}.", placeholder: "Olá, {{nome}}! Bem-vindo ao {{grupo}}." },
    {
      chave: "channelId",
      rotulo: "Canal",
      controle: "escolha",
      opcoes: ({ state }) => state.channels.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: c.id, label: c.name, detail: c.connection })),
      ajuda: "Vazio = o Canal do Grupo, ou o primeiro WhatsApp conectado.",
    },
  ],
};

const SPEC_DO_CONTROLE: Record<ControleDeAcao, readonly CampoSpec[]> = {
  invocarAgente: [
    { chave: "agentId", rotulo: "Agente", controle: "agente", obrigatorio: true, destino: "raiz" },
    { chave: "skillId", rotulo: "Habilidade", controle: "habilidade", destino: "raiz", ajuda: "Concedida ao Agente; vazio = o Agente decide." },
    { chave: "params", rotulo: "Instrução", controle: "textoLongo", destino: "raiz", placeholder: "Resumir o Negócio e propor o próximo passo." },
    { chave: "maxAutonomy", rotulo: "Autonomia máxima", controle: "escolha", destino: "raiz", opcoes: AUTONOMIAS, ajuda: "Teto sobre a autonomia do Agente (B77)." },
    { chave: "approverMemberId", rotulo: "Aprovador", controle: "membro", destino: "raiz" },
    { chave: "timeoutHours", rotulo: "Prazo da aprovação (horas)", controle: "numero", destino: "raiz", placeholder: "72" },
  ],
  solicitarAprovacao: [
    { chave: "approverMemberId", rotulo: "Aprovador", controle: "membro", obrigatorio: true, destino: "raiz" },
    { chave: "timeoutHours", rotulo: "Prazo (horas)", controle: "numero", destino: "raiz", placeholder: "72" },
    { chave: "motivo", rotulo: "Motivo", controle: "textoLongo" },
  ],
  aguardar: [{ chave: "horas", rotulo: "Horas", controle: "numero", obrigatorio: true }],
  notificar: [
    { chave: "memberIds", rotulo: "Membros", controle: "membros", obrigatorio: true },
    { chave: "template", rotulo: "Mensagem", controle: "textoLongo", obrigatorio: true },
  ],
  encerrar: [{ chave: "motivo", rotulo: "Motivo", controle: "texto" }],
};

/** O que identifica uma Ação no editor: a Ferramenta ou o controle. */
export type TipoDeAcao = { readonly kind: "escrita"; readonly toolId: string } | { readonly kind: "controle"; readonly controlKind: ControleDeAcao };

export function tipoDaAcao(action: Pick<AutomationAction, "kind" | "toolId" | "controlKind">): TipoDeAcao | undefined {
  if (action.kind === "escrita") return action.toolId ? { kind: "escrita", toolId: action.toolId } : undefined;
  if (action.controlKind && action.controlKind !== "ramificar") return { kind: "controle", controlKind: action.controlKind };
  return undefined;
}

export function specDaAcao(state: DataState, tipo: TipoDeAcao): BlocoSpec {
  if (tipo.kind === "controle") {
    const controle = CONTROLES.find((c) => c.id === tipo.controlKind);
    return { rotulo: controle?.rotulo ?? tipo.controlKind, descricao: "Ação de controle: nunca é uma Ferramenta (B91).", campos: SPEC_DO_CONTROLE[tipo.controlKind] };
  }
  const tool = state.tools.find((t) => t.id === tipo.toolId);
  const campos = SPEC_DA_FERRAMENTA[tipo.toolId] ?? PARAMS_LIVRES;
  const equivalente = FERRAMENTAS_DEPRECIADAS.get(tipo.toolId);
  const nomeDaEquivalente = equivalente ? (state.tools.find((t) => t.id === equivalente)?.name ?? equivalente) : undefined;
  return {
    rotulo: tool?.name ?? tipo.toolId,
    descricao: !tool
      ? "Ferramenta fora do Catálogo (RN-AUT-21)."
      : nomeDaEquivalente
        ? `Ferramenta legada: não roda no protótipo — a equivalente que o motor executa é “${nomeDaEquivalente}”. A Ação segue válida; para executar de verdade, troque a Ferramenta.`
        : `${tool.description} · ${EFFECT_CLASS_LABEL[tool.effectClass] ?? tool.effectClass}`,
    campos,
    ...(nomeDaEquivalente ? { legadoDe: nomeDaEquivalente } : {}),
  };
}

const CHAVES_DA_RAIZ = new Set(["params", "targetExpression", "agentId", "skillId", "maxAutonomy", "approverMemberId", "approverTeamId", "timeoutHours"]);

/** O valor plano de uma Ação gravada: os atributos do tipo e as chaves do JSON de `params`. */
export function valorDaAcao(state: DataState, action: AutomationAction): ValorDoBloco {
  const tipo = tipoDaAcao(action);
  const spec = tipo ? specDaAcao(state, tipo) : undefined;
  const paramsCru = spec?.campos.some((c) => c.chave === "params" && c.destino === "raiz") ?? true;
  const json = paramsCru ? {} : (jsonOuNada(action.params) ?? {});
  return {
    ...json,
    ...(paramsCru ? { params: action.params } : {}),
    ...(action.targetExpression !== undefined ? { targetExpression: action.targetExpression } : {}),
    ...(action.agentId !== undefined ? { agentId: action.agentId } : {}),
    ...(action.skillId !== undefined ? { skillId: action.skillId } : {}),
    ...(action.maxAutonomy !== undefined ? { maxAutonomy: action.maxAutonomy } : {}),
    ...(action.approverMemberId !== undefined ? { approverMemberId: action.approverMemberId } : {}),
    ...(action.timeoutHours !== undefined ? { timeoutHours: action.timeoutHours } : {}),
  };
}

/** A Ação que o valor plano descreve, no vocabulário de `runAction`. */
export function acaoDoValor(state: DataState, tipo: TipoDeAcao, valor: ValorDoBloco): Omit<AutomationAction, "order"> {
  const spec = specDaAcao(state, tipo);
  const paramsCru = spec.campos.some((c) => c.chave === "params" && c.destino === "raiz");
  const json: Record<string, unknown> = {};
  for (const campo of spec.campos) {
    if (campo.destino === "raiz" || CHAVES_DA_RAIZ.has(campo.chave)) continue;
    if (campo.visivelSe && !campo.visivelSe(valor)) continue;
    const v = valor[campo.chave];
    if (v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0)) continue;
    json[campo.chave] = v;
  }
  const params = paramsCru ? (typeof valor.params === "string" ? valor.params : "") : JSON.stringify(json);
  const maxAutonomy = NIVEIS_DE_AUTONOMIA.find((a) => a === valor.maxAutonomy);
  const timeoutHours = numero(valor.timeoutHours);
  return {
    kind: tipo.kind,
    ...(tipo.kind === "escrita" ? { toolId: tipo.toolId } : { controlKind: tipo.controlKind }),
    params,
    ...(texto(valor.targetExpression) !== undefined ? { targetExpression: valor.targetExpression as string } : {}),
    ...(tipo.kind === "controle" && texto(valor.agentId) !== undefined ? { agentId: valor.agentId as Id } : {}),
    ...(tipo.kind === "controle" && texto(valor.skillId) !== undefined ? { skillId: valor.skillId as Id } : {}),
    ...(maxAutonomy !== undefined ? { maxAutonomy } : {}),
    ...(tipo.kind === "controle" && texto(valor.approverMemberId) !== undefined ? { approverMemberId: valor.approverMemberId as Id } : {}),
    ...(timeoutHours !== undefined ? { timeoutHours } : {}),
  };
}

/** O nome da Ação na lista: a Ferramenta do Catálogo ou o controle. */
export function nomeDaAcao(state: DataState, action: Pick<AutomationAction, "kind" | "toolId" | "controlKind">): string {
  if (action.kind === "escrita") return state.tools.find((t) => t.id === action.toolId)?.name ?? action.toolId ?? "Ferramenta a escolher";
  return CONTROLES.find((c) => c.id === action.controlKind)?.rotulo ?? action.controlKind ?? "controle a escolher";
}

/** Uma linha que diz a Ação: quem, o quê, com que texto. */
export function resumoDaAcao(state: DataState, action: AutomationAction): string {
  const nomeDoMembro = (id: unknown): string => state.members.find((m) => m.id === id)?.displayName ?? String(id ?? "—");
  const nomeDoCampo = (id: unknown): string => state.fieldDefinitions.find((d) => d.id === id)?.name ?? String(id ?? "—");
  const spec = jsonOuNada(action.params) ?? {};
  if (action.kind === "controle") {
    if (action.controlKind === "invocarAgente") {
      const agente = state.agents.find((a) => a.id === action.agentId)?.name ?? "Agente a escolher";
      const habilidade = action.skillId ? state.skills.find((s) => s.id === action.skillId)?.name : undefined;
      return `${agente}${habilidade ? ` · ${habilidade}` : ""}${action.maxAutonomy ? ` · até ${AUTONOMY_LABEL[action.maxAutonomy] ?? action.maxAutonomy}` : ""}`;
    }
    if (action.controlKind === "solicitarAprovacao") return `aprovador: ${nomeDoMembro(action.approverMemberId)}`;
    if (action.controlKind === "aguardar") return spec.horas !== undefined ? `${String(spec.horas)} h` : action.params;
    if (action.controlKind === "notificar") return Array.isArray(spec.memberIds) ? spec.memberIds.map(nomeDoMembro).join(", ") : action.params;
    return typeof spec.motivo === "string" ? spec.motivo : action.params;
  }
  switch (action.toolId) {
    case "tarefa.definirResponsavel":
    case "tarefa.removerResponsavel":
      return nomeDoMembro(spec.memberId);
    case "tarefa.adicionarObservadores": {
      const nomes = Array.isArray(spec.memberIds) ? spec.memberIds.map(nomeDoMembro) : [];
      if (spec.fromFieldDefinitionId) nomes.push(`quem estiver em ${nomeDoCampo(spec.fromFieldDefinitionId)}`);
      return nomes.join(", ") || "ninguém";
    }
    case "tarefa.alterarStatus":
      return `→ “${String(spec.statusName ?? "")}”`;
    case "tarefa.comentar":
    case "mensagem.enviarAoContato":
      return typeof spec.template === "string" ? `“${spec.template}”` : action.params;
    case "tarefa.definirCampo":
      return `${nomeDoCampo(spec.definitionId)} = ${spec.today ? "hoje" : String(spec.value ?? "—")}${spec.onlyIfEmpty ? " (se vazio)" : ""}`;
    case "contato.adicionarTag":
      return state.tags.find((t) => t.id === spec.tagId)?.name ?? "Tag a escolher";
    case "contato.definirCampo":
      return `${nomeDoCampo(spec.definitionId)} = ${String(spec.value ?? "—")}`;
    default:
      return `${action.params}${action.targetExpression ? ` → ${action.targetExpression}` : ""}`;
  }
}

// ── O que o protótipo executa (D5) ─────────────────────────────────────────

export const executaGatilho = (scopeType: AutomationScopeType, trigger: AutomationTrigger | undefined): boolean => escopoExecutaNoPrototipo(scopeType, trigger);

/** `conditionsHold` só lê `atributo` (status) e `valorDeCampo`, e só no motor de Lista. */
export const executaCondicao = (scopeType: AutomationScopeType, condition: Pick<AutomationCondition, "kind">): boolean =>
  scopeType === "list" && (condition.kind === "atributo" || condition.kind === "valorDeCampo");

const ESCOPOS_DE_CANAL: ReadonlySet<AutomationScopeType> = new Set(["grupo", "comunidade", "flow", "workspace"]);

/** O motor de Lista executa `tarefa.*` e "Invocar Agente"; o de Ativos de Canal, o resto das dez. */
export function executaAcao(scopeType: AutomationScopeType, action: Pick<AutomationAction, "kind" | "toolId" | "controlKind">): boolean {
  if (action.kind === "controle") return action.controlKind === "invocarAgente" && scopeType === "list";
  if (!action.toolId || !FERRAMENTAS_QUE_EXECUTAM.has(action.toolId)) return false;
  const deTarefa = action.toolId.startsWith("tarefa.");
  return scopeType === "list" ? deTarefa : ESCOPOS_DE_CANAL.has(scopeType) && !deTarefa;
}

// ── Obrigatórios ───────────────────────────────────────────────────────────

const vazio = (v: unknown): boolean => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** Os campos obrigatórios visíveis que faltam — o motivo de [Gravar] ficar desligado. */
export function faltamNoBloco(spec: BlocoSpec, valor: ValorDoBloco): string[] {
  return spec.campos.filter((c) => c.obrigatorio && (!c.visivelSe || c.visivelSe(valor)) && vazio(valor[c.chave])).map((c) => c.rotulo);
}
