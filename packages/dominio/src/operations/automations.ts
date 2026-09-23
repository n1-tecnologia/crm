/**
 * Automações de Lista executadas de verdade — o que os processos do
 * Financeiro (contas a pagar e a receber) precisam: reagir a Tarefa criada e
 * a entrada em Status, e disparar por distância do vencimento (antes ou depois). Cada Automação é o registro da ontologia
 * (Automation + versão publicada); o gatilho, as condições e as ações são
 * lidos de `eventType`/`expression`/`params` num vocabulário pequeno e tipado.
 *
 * Toda execução vira `AutomationExecution`, com um passo por ação — é o que a
 * tela de Automações e a Auditoria leem. A Automação age em nome do seu dono
 * (DO-AUT: o delegante é o Proprietário da Automação).
 *
 * AUTO-01 — o vocabulário de controle é fechado: `invocarAgente`,
 * `notificar`, `solicitarAprovacao`, `aguardar` e `encerrar`. Só `ramificar`
 * segue fora de escopo, e é o único que ainda cai em "Controle não
 * suportado". Nenhuma Ação aqui nomeia Lista, Status, Campo ou Membro do
 * Financeiro: o alvo vem sempre de `params` e dos campos tipados de
 * `AutomationAction` — as únicas referências ao Financeiro no arquivo são as
 * do Agente de lançamento e do `{{cnpjEmpresa}}` do template, que já existiam.
 *
 * Achado registrado em prosa, sem mudar tipo nenhum: `ApprovalOrigin`
 * (`types/ai.ts`) tem dois ramos — `agentExecution` e `processTask` — e
 * nenhum deles é "Automação". O ramo `solicitarAprovacao` reusa `processTask`,
 * o que é honesto (é uma decisão de processo ancorada numa Tarefa, D-06) mas
 * herda duas consequências: o passo de processo fica sempre `"pagamento"` e a
 * Lista precisa ter o status `em aprovação`. Fechar isso direito pede um
 * terceiro ramo em `ApprovalOrigin`, o que arrasta `types/ai.ts` e os
 * consumidores de `apps/web` — fora da posse de arquivos deste plano.
 */

import { containerAdminRefusal, effectiveLifecycleOfTask, effectiveListConfig, memberSeesTask, statusDefinition } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Automation, AutomationAction, AutomationExecution, AutomationTrigger, AutomationVersion, Id, Task } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { CNPJ_POR_EMPRESA, CP, clienteDe, runLancamentoAgent } from "./financeiro";
import { contactDisplayName } from "../derive";
import { addTaskComment, assignTask, changeTaskStatus, setTaskFieldValue, unassignTask, watchTask } from "./tasks";
// Sem ciclo: `operations/ai.ts` importa `./tasks` e `../derive`, nunca `./automations`.
import { solicitarAprovacao as solicitarAprovacaoDeProcesso } from "./ai";

/**
 * O ÚNICO relógio do módulo. Sem argumento é o instante real — o que um
 * evento merece, porque ele acontece agora. Com argumento é o instante
 * injetado: `runScheduledAutomations` recebe `today` e a Execução que ele
 * produz é carimbada com ele, não com o relógio da máquina. Sem isto,
 * `jaRodou` comparava duas bases de tempo diferentes e "rodar duas vezes no
 * mesmo dia" deixava de ser verificável.
 */
const instante = (quando?: Date): string => (quando ?? new Date()).toISOString();

/** Mesmo ano, mês e dia em horário LOCAL — o dia civil é o do usuário, não o do UTC. */
function mesmoDiaCivil(a: string | Date, b: Date): boolean {
  const x = typeof a === "string" ? new Date(a) : a;
  return x.getFullYear() === b.getFullYear() && x.getMonth() === b.getMonth() && x.getDate() === b.getDate();
}

/** `YYYY-MM-DD` em horário local — a forma em que um dia civil é gravado e lido. */
const diaCivil = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type ListEvent =
  | { readonly kind: "tarefaCriada"; readonly taskId: Id }
  | { readonly kind: "tarefaEntrouEmStatus"; readonly taskId: Id; readonly statusId: Id; readonly previousStatusId?: Id };

/* ───────────────────────────── Vocabulário ───────────────────────────── */

interface ConditionSpec {
  readonly status?: string;
  readonly definitionId?: Id;
  readonly empty?: boolean;
  readonly equals?: string;
}

interface ActionSpec {
  readonly memberId?: Id;
  readonly memberIds?: readonly Id[];
  readonly fromFieldDefinitionId?: Id;
  readonly statusName?: string;
  readonly template?: string;
  readonly mentionMemberId?: Id;
  readonly mentionFieldDefinitionId?: Id;
  /** Menciona o dono (no CRM) do Contato vinculado à Tarefa — o Comercial do cliente. */
  readonly mentionClientOwner?: boolean;
  /** `tarefa.definirCampo`: o Campo e o valor; `today` grava o dia civil de hoje. */
  readonly definitionId?: Id;
  readonly value?: string | number;
  readonly today?: boolean;
  /** Só grava se o Campo estiver vazio (R3: o Financeiro pode ter preenchido antes). */
  readonly onlyIfEmpty?: boolean;
  /* ── Vocabulário de controle (AUTO-01) ── */
  /** `notificar`: Membros mencionados no aviso, somados a `memberId` e a `fromFieldDefinitionId`. */
  readonly mentionMemberIds?: readonly Id[];
  /** `encerrar` (e o motivo do roteamento em `solicitarAprovacao`). */
  readonly motivo?: string;
  /** `aguardar`: o prazo declarado. `action.timeoutHours` (campo tipado) vale como alternativa. */
  readonly aguardarDias?: number;
  readonly aguardarHoras?: number;
  /** `aguardar`: de onde o prazo conta — o vencimento da Tarefa (padrão) ou a criação dela. */
  readonly aguardarDesde?: "vencimento" | "criacaoDaTarefa";
  /** `solicitarAprovacao`: Campo do tipo pessoa que nomeia o Aprovador, quando não vem tipado na versão. */
  readonly approverFieldDefinitionId?: Id;
}

interface TemporalSpec {
  readonly dueDateOffsetDays: number;
}

function parseJson<T>(text: string | undefined): T | undefined {
  if (!text) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

function publishedVersion(automation: Automation): AutomationVersion | undefined {
  return [...automation.versions].reverse().find((v) => v.state === "publicada");
}

function fieldValueOf(task: Task, definitionId: Id): unknown {
  const value = task.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;
  return value ?? undefined;
}

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

function conditionsHold(state: DataState, task: Task, version: AutomationVersion): boolean {
  return version.conditions.every((condition) => {
    if (condition.kind === "hibrida" || condition.kind === "temporal") return true;
    const spec = parseJson<ConditionSpec>(condition.expression);
    if (!spec) return true;
    if (spec.status !== undefined) {
      const atual = statusDefinition(state, task.listId, task.statusId)?.name.trim().toLocaleLowerCase("pt-BR");
      if (atual !== spec.status.trim().toLocaleLowerCase("pt-BR")) return false;
    }
    if (spec.definitionId) {
      const valor = fieldValueOf(task, spec.definitionId);
      if (spec.empty === true && !isEmpty(valor)) return false;
      if (spec.empty === false && isEmpty(valor)) return false;
      if (spec.equals !== undefined && String(valor ?? "") !== spec.equals) return false;
    }
    return true;
  });
}

/**
 * Substitui `{{campo:<id>}}` (um Campo de pessoa vira o nome), `{{cnpjEmpresa}}`,
 * `{{titulo}}`, `{{vencimento}}`, `{{cliente}}` e `{{donoDoCliente}}` no
 * texto de um Comentário.
 */
function fillTemplate(state: DataState, task: Task, template: string): string {
  const cliente = clienteDe(state, task);
  return template
    .replace(/\{\{cliente\}\}/g, () => (cliente ? contactDisplayName(cliente) : "o cliente"))
    .replace(/\{\{donoDoCliente\}\}/g, () => (cliente ? (state.members.find((m) => m.id === cliente.ownerMemberId)?.displayName ?? "—") : "—"))
    .replace(/\{\{campo:([a-zA-Z0-9_]+)\}\}/g, (_, id: string) => {
      const valor = fieldValueOf(task, id);
      if (Array.isArray(valor)) return valor.join(", ");
      if (valor === undefined) return "—";
      const definition = state.fieldDefinitions.find((d) => d.id === id);
      if (definition?.type === "person") return state.members.find((m) => m.id === valor)?.displayName ?? String(valor);
      return String(valor);
    })
    .replace(/\{\{cnpjEmpresa\}\}/g, () => {
      const empresa = fieldValueOf(task, CP.fields.empresa);
      const cnpj = typeof empresa === "string" ? CNPJ_POR_EMPRESA[empresa] : undefined;
      return cnpj ? `${cnpj} (${String(empresa)})` : `da Empresa ${String(empresa ?? "—")}`;
    })
    .replace(/\{\{titulo\}\}/g, task.title)
    .replace(/\{\{vencimento\}\}/g, task.dueDate ? task.dueDate.value.slice(0, 10).split("-").reverse().join("/") : "—");
}

/* ───────────────────────────── Execução ───────────────────────────── */

/**
 * O que uma Ação sabe da rodada em que está — montado por `execute` e passado
 * a `runAction`. Interno ao módulo de propósito: nenhuma assinatura exportada
 * muda por causa dele.
 *
 * `quando` é a base de tempo ÚNICA da Execução (relógio real pelo evento, o
 * `today` injetado pela agenda); `trigger` e `indice` são o que `aguardar`
 * precisa para recusar o que não pode retomar.
 */
interface ContextoDeExecucao {
  readonly quando: Date;
  readonly trigger: AutomationTrigger | undefined;
  readonly indice: number;
}

/** O que uma Ação devolve. `halt` é interno ao módulo: nenhuma assinatura exportada o conhece. */
interface ResultadoDeAcao {
  readonly ok: boolean;
  readonly output: string;
  readonly halt?: "encerrar" | "aguardar";
}

/**
 * Os alvos de uma Ação de controle, sem repetição e sem inventar Membro: de
 * `memberId`, de `mentionMemberIds` e de um Campo do tipo pessoa da Tarefa —
 * a mesma forma de resolução de `tarefa.adicionarObservadores`, mas em helper
 * próprio, para que nenhum caminho antigo mude de resultado.
 */
function membrosMencionados(state: DataState, task: Task, spec: ActionSpec): Id[] {
  const ids = new Set<Id>();
  if (spec.memberId) ids.add(spec.memberId);
  for (const id of spec.mentionMemberIds ?? []) ids.add(id);
  if (spec.fromFieldDefinitionId) {
    const pessoa = fieldValueOf(task, spec.fromFieldDefinitionId);
    if (typeof pessoa === "string" && pessoa) ids.add(pessoa);
  }
  return [...ids].filter((id) => state.members.some((m) => m.id === id));
}

/**
 * `aguardar` — três recusas antes de qualquer cálculo, porque a retomada de
 * uma Execução pendente roda a Execução do COMEÇO:
 *
 * 1. sob gatilho de evento não há quem retome;
 * 2. depois da primeira Ação, retomar repetiria o que já aconteceu;
 * 3. sem prazo declarado não há o que esperar.
 *
 * Cumprido o prazo, a Execução segue; não cumprido, ela para em `pendente` e
 * o dia seguinte reavalia.
 */
function esperaCumprida(task: Task, spec: ActionSpec, action: AutomationAction, contexto: ContextoDeExecucao): ResultadoDeAcao {
  if (contexto.trigger?.kind !== "condicaoTemporal") {
    return { ok: false, output: "“aguardar” exige gatilho de agenda: uma Execução de evento não tem quem a retome." };
  }
  if (contexto.indice > 0) {
    return { ok: false, output: "“aguardar” precisa ser a primeira Ação: a retomada roda a Execução do começo, então nada pode ter acontecido antes dela." };
  }
  const dias = spec.aguardarDias;
  const horas = spec.aguardarHoras ?? action.timeoutHours;
  if (dias === undefined && horas === undefined) {
    return { ok: false, output: "“aguardar” sem prazo: declare aguardarDias, aguardarHoras ou timeoutHours." };
  }
  const desde = spec.aguardarDesde ?? "vencimento";
  let base: Date | undefined;
  if (desde === "criacaoDaTarefa") base = new Date(task.createdAt);
  else if (task.dueDate) {
    const [y, m, d] = task.dueDate.value.slice(0, 10).split("-").map(Number);
    base = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  }
  if (!base) return { ok: false, output: `“aguardar” conta a partir do ${desde === "vencimento" ? "vencimento" : "início"}, e esta Tarefa não o tem.` };
  const prazo = new Date(base.getTime() + (dias ?? 0) * 86_400_000 + (horas ?? 0) * 3_600_000);
  if (contexto.quando.getTime() >= prazo.getTime()) return { ok: true, output: `Espera cumprida em ${diaCivil(prazo)}` };
  return { ok: true, halt: "aguardar", output: `Aguardando até ${diaCivil(prazo)}` };
}

function runAction(
  state: DataState,
  automation: Automation,
  task: Task,
  action: AutomationAction,
  contexto: ContextoDeExecucao,
): ResultadoDeAcao {
  const owner = automation.ownerMemberId;
  const spec = parseJson<ActionSpec>(action.params) ?? {};
  if (action.kind === "controle") {
    switch (action.controlKind) {
      case "invocarAgente": {
        if (!action.agentId) break;
        const r = runLancamentoAgent(state, owner, action.agentId, task.id, automation.id);
        return r.ok ? { ok: true, output: r.value } : { ok: false, output: r.error };
      }
      case "notificar": {
        if (!spec.template) return { ok: false, output: "“notificar” sem texto: declare `template` nos parâmetros da Ação." };
        const alvos = membrosMencionados(state, task, spec);
        if (!alvos.length) return { ok: false, output: "“notificar” sem alvo: declare memberId, mentionMemberIds ou fromFieldDefinitionId." };
        // O aviso é in-app nesta fase: um Comentário com Menção, que `pendingMentions`
        // entrega a quem ENXERGA a Tarefa. Por Canal é Phase 5.
        const r = addTaskComment(state, owner, task.id, {
          content: fillTemplate(state, task, spec.template),
          mentions: alvos.map((id) => ({ type: "member", id })),
          actor: { kind: "automation", id: automation.id },
        });
        if (!r.ok) return { ok: false, output: r.error };
        return { ok: true, output: `Notificados: ${alvos.map((id) => state.members.find((m) => m.id === id)?.displayName ?? id).join(", ")}` };
      }
      case "solicitarAprovacao": {
        // T-3-07 — o Aprovador é NOMEADO: campo tipado da versão publicada ou
        // Campo do tipo pessoa da Tarefa. Nunca o dono da Automação por omissão.
        const doCampo = spec.approverFieldDefinitionId ? fieldValueOf(task, spec.approverFieldDefinitionId) : undefined;
        const aprovador = action.approverMemberId ?? (typeof doCampo === "string" && doCampo ? doCampo : undefined);
        if (!aprovador) return { ok: false, output: "“solicitarAprovacao” sem Aprovador: declare approverMemberId na versão ou approverFieldDefinitionId nos parâmetros." };
        if (!spec.template) return { ok: false, output: "“solicitarAprovacao” sem texto de roteamento: declare `template` nos parâmetros da Ação." };
        const comentario = addTaskComment(state, owner, task.id, {
          content: fillTemplate(state, task, spec.template),
          mentions: [{ type: "member", id: aprovador }],
          actor: { kind: "automation", id: automation.id },
        });
        if (!comentario.ok) return { ok: false, output: comentario.error };
        const r = solicitarAprovacaoDeProcesso(state, owner, {
          taskId: task.id,
          approverMemberId: aprovador,
          threadCommentId: comentario.value.id,
          ...(spec.motivo ? { reason: spec.motivo } : {}),
        });
        if (!r.ok) return { ok: false, output: r.error };
        return { ok: true, output: `Aprovação roteada a ${state.members.find((m) => m.id === r.value.approverMemberId)?.displayName ?? aprovador}` };
      }
      case "aguardar":
        return esperaCumprida(task, spec, action, contexto);
      case "encerrar":
        return { ok: true, halt: "encerrar", output: spec.motivo ?? "Encerrada pela própria Automação" };
      default:
        break;
    }
    // `ramificar` segue fora de escopo — e `invocarAgente` sem Agente cai aqui, como sempre caiu.
    return { ok: false, output: `Controle não suportado: ${action.controlKind ?? "?"}` };
  }
  switch (action.toolId) {
    case "tarefa.definirResponsavel": {
      if (!spec.memberId) return { ok: false, output: "Sem memberId." };
      for (const a of task.assignees.filter((x) => x.kind === "member" && x.id !== spec.memberId)) {
        const r = unassignTask(state, owner, task.id, a);
        if (!r.ok) return { ok: false, output: r.error };
      }
      const r = assignTask(state, owner, task.id, { kind: "member", id: spec.memberId });
      return r.ok ? { ok: true, output: `Responsável: ${state.members.find((m) => m.id === spec.memberId)?.displayName ?? spec.memberId}` } : { ok: false, output: r.error };
    }
    case "tarefa.removerResponsavel": {
      if (!spec.memberId) return { ok: false, output: "Sem memberId." };
      const atual = task.assignees.find((x) => x.kind === "member" && x.id === spec.memberId);
      if (!atual) return { ok: true, output: "Já não era Responsável" };
      const r = unassignTask(state, owner, task.id, atual);
      return r.ok ? { ok: true, output: `Saiu de Responsável: ${state.members.find((m) => m.id === spec.memberId)?.displayName ?? spec.memberId}` } : { ok: false, output: r.error };
    }
    case "tarefa.adicionarObservadores": {
      const ids = new Set<Id>(spec.memberIds ?? []);
      if (spec.fromFieldDefinitionId) {
        const pessoa = fieldValueOf(task, spec.fromFieldDefinitionId);
        if (typeof pessoa === "string" && pessoa) ids.add(pessoa);
      }
      const adicionados: string[] = [];
      for (const id of ids) {
        if (task.observerMemberIds.includes(id)) continue;
        const r = watchTask(state, owner, task.id, id, true);
        if (r.ok) adicionados.push(state.members.find((m) => m.id === id)?.displayName ?? id);
      }
      return { ok: true, output: adicionados.length ? `Observadores: ${adicionados.join(", ")}` : "Nenhum Observador novo" };
    }
    case "tarefa.alterarStatus": {
      const config = effectiveListConfig(state, task.listId);
      const alvo = config?.statusSet.definitions.find((d) => d.name.trim().toLocaleLowerCase("pt-BR") === (spec.statusName ?? "").trim().toLocaleLowerCase("pt-BR"));
      if (!alvo) return { ok: false, output: `Status “${spec.statusName ?? ""}” não existe nesta Lista.` };
      if (task.statusId === alvo.id) return { ok: true, output: `Já em “${alvo.name}”` };
      const r = changeTaskStatus(state, owner, task.id, alvo.id);
      if (r.ok) {
        // A Auditoria diz quem moveu de verdade: a Automação, em nome do dono.
        const registro = state.activity.find((a) => a.objectId === task.id && a.action === "Status alterado");
        if (registro) {
          const indice = state.activity.indexOf(registro);
          state.activity[indice] = { ...registro, actor: { kind: "automation", id: automation.id }, delegate: memberActor(owner) };
        }
      }
      return r.ok ? { ok: true, output: `Status: ${alvo.name}` } : { ok: false, output: r.error };
    }
    case "tarefa.comentar": {
      if (!spec.template) return { ok: false, output: "Sem texto." };
      const mentions: Array<{ type: string; id: Id }> = [];
      if (spec.mentionMemberId) mentions.push({ type: "member", id: spec.mentionMemberId });
      if (spec.mentionFieldDefinitionId) {
        const pessoa = fieldValueOf(task, spec.mentionFieldDefinitionId);
        if (typeof pessoa === "string" && pessoa) mentions.push({ type: "member", id: pessoa });
      }
      if (spec.mentionClientOwner) {
        const cliente = clienteDe(state, task);
        if (cliente) mentions.push({ type: "member", id: cliente.ownerMemberId });
      }
      // O autor é a Automação (em nome do dono): uma Menção ao próprio dono é lida como aviso, não como monólogo.
      const r = addTaskComment(state, owner, task.id, { content: fillTemplate(state, task, spec.template), mentions, actor: { kind: "automation", id: automation.id } });
      return r.ok ? { ok: true, output: "Comentário publicado" } : { ok: false, output: r.error };
    }
    case "tarefa.definirCampo": {
      if (!spec.definitionId) return { ok: false, output: "Sem definitionId." };
      const nome = state.fieldDefinitions.find((d) => d.id === spec.definitionId)?.name ?? spec.definitionId;
      if (spec.onlyIfEmpty && !isEmpty(fieldValueOf(task, spec.definitionId))) return { ok: true, output: `${nome} já preenchido` };
      // O dia civil de `today` é o da EXECUÇÃO — relógio real pelo evento, dia injetado pela agenda.
      const valor = spec.today ? diaCivil(contexto.quando) : spec.value;
      if (valor === undefined) return { ok: false, output: "Sem valor." };
      const r = setTaskFieldValue(state, owner, task.id, spec.definitionId, valor);
      return r.ok ? { ok: true, output: `${nome}: ${String(valor)}` } : { ok: false, output: r.error };
    }
    default:
      return { ok: false, output: `Ferramenta não suportada: ${action.toolId ?? "?"}` };
  }
}

function execute(state: DataState, automation: Automation, version: AutomationVersion, task: Task, quando?: Date): AutomationExecution {
  const base = new Date(instante(quando));
  const execution: AutomationExecution = {
    id: nextId("aex"),
    workspaceId: state.workspace.id,
    automationId: automation.id,
    automationVersion: version.number,
    state: "executando",
    triggerKind: version.trigger?.kind ?? "evento",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    invokedBy: { kind: "automation", id: automation.id },
    delegate: memberActor(automation.ownerMemberId),
    chain: { depth: 0, visitedAgentIds: [], visitedAutomationObjects: [{ automationId: automation.id, objectId: task.id }] },
    steps: [],
    childAgentExecutionIds: [],
    cost: { modelUnits: 0, toolCalls: 0, childExecutions: 0, durationMs: 0 },
    startedAt: instante(quando),
  };
  state.automationExecutions.push(execution);
  // `durationMs` é DURAÇÃO, não data civil: nenhum comportamento se ramifica
  // nela e nenhum teste pode ler o dia através dela. É a única leitura de
  // relógio que sobrevive neste arquivo fora de `instante`, e é deliberada.
  const inicio = Date.now();
  const acoes = [...version.actions].sort((a, b) => a.order - b.order);
  for (const [indice, action] of acoes.entries()) {
    const contexto: ContextoDeExecucao = { quando: base, trigger: version.trigger, indice };
    const result = runAction(state, automation, task, action, contexto);
    execution.steps.push({
      index: execution.steps.length,
      kind: action.kind === "controle" ? "raciocinio" : "ferramenta",
      ...(action.toolId ? { toolId: action.toolId } : {}),
      input: action.params,
      output: result.output,
      toolAllowed: true,
      resourcePermitted: result.ok,
      result: result.halt === "aguardar" ? "aguardando" : result.ok ? "concluido" : "falhou",
      at: instante(quando),
    });
    if (action.kind === "controle" && action.agentId) execution.childAgentExecutionIds.push(...state.agentExecutions.filter((e) => e.invokedBy.kind === "automation" && e.invokedBy.id === automation.id && e.anchor?.id === task.id).map((e) => e.id).slice(-1));
    if (result.halt) {
      // Parou por desenho da própria Automação: o que vinha depois não
      // aconteceu, e a Execução diz isso passo a passo em vez de sumir com eles.
      for (const restante of acoes.slice(indice + 1)) {
        execution.steps.push({
          index: execution.steps.length,
          kind: restante.kind === "controle" ? "raciocinio" : "ferramenta",
          ...(restante.toolId ? { toolId: restante.toolId } : {}),
          input: restante.params,
          output: result.halt === "encerrar" ? "Pulado: a Automação encerrou antes." : "Pulado: a Automação está aguardando.",
          toolAllowed: true,
          resourcePermitted: true,
          result: "pulado",
          at: instante(quando),
        });
      }
      execution.state = result.halt === "encerrar" ? "concluida" : "pendente";
      execution.terminationReason = result.output;
      break;
    }
    if (!result.ok) {
      execution.state = "falhou";
      execution.terminationReason = result.output;
      break;
    }
  }
  if (execution.state === "executando") execution.state = "concluida";
  execution.endedAt = instante(quando);
  execution.cost = { ...execution.cost, toolCalls: execution.steps.length, durationMs: Date.now() - inicio };
  recordActivity(state, {
    actor: { kind: "automation", id: automation.id },
    action: execution.state === "falhou" ? "Automação falhou" : execution.state === "pendente" ? "Automação aguardando" : "Automação executada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: automation.name,
    ...(execution.terminationReason ? { after: execution.terminationReason } : {}),
  });
  return execution;
}

function listAutomationsFor(state: DataState, task: Task): Array<{ automation: Automation; version: AutomationVersion }> {
  return state.automations
    .filter((a) => a.lifecycle === "ativo" && a.scopeType === "list" && a.scopeId === task.listId)
    .map((automation) => ({ automation, version: publishedVersion(automation) }))
    .filter((x): x is { automation: Automation; version: AutomationVersion } => x.version !== undefined);
}

/**
 * Reage a um evento de Tarefa. Chamada pelas operações que geram o evento
 * (`createTask`, `changeTaskStatus`) — nunca pela tela. Uma Automação não
 * reage aos próprios eventos (DO-AUT-11): a corrente é cortada pela pilha.
 */
let profundidade = 0;
export function runListAutomations(state: DataState, event: ListEvent): AutomationExecution[] {
  if (profundidade > 3) return [];
  const task = state.tasks.find((t) => t.id === event.taskId);
  if (!task) return [];
  const executions: AutomationExecution[] = [];
  profundidade += 1;
  try {
    for (const { automation, version } of listAutomationsFor(state, task)) {
      const trigger = version.trigger;
      if (!trigger || trigger.kind !== "evento" || trigger.eventType !== event.kind) continue;
      if (event.kind === "tarefaEntrouEmStatus") {
        const nome = statusDefinition(state, task.listId, event.statusId)?.name.trim().toLocaleLowerCase("pt-BR");
        if ((trigger.eventSubtype ?? "").trim().toLocaleLowerCase("pt-BR") !== nome) continue;
      }
      if (!conditionsHold(state, task, version)) continue;
      executions.push(execute(state, automation, version, task));
    }
  } finally {
    profundidade -= 1;
  }
  return executions;
}

/**
 * Gatilhos por proximidade do vencimento — o relógio do protótipo é a
 * chamada explícita com "hoje". Cada par (Automação, Tarefa) dispara uma vez.
 */
export function runScheduledAutomations(
  state: DataState,
  actingMemberId: Id,
  listId: Id,
  today: Date,
): OperationResult<{ readonly executed: number; readonly failed: number; readonly skipped: number; readonly failures: ReadonlyArray<{ readonly taskId: Id; readonly title: string; readonly reason: string }> }> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return fail("Só um Membro ativo roda as Automações.");
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return fail("Lista não encontrada.");
  // Rodar o relógio da Lista é administrá-la: as Automações agem em nome dos donos.
  const admin = containerAdminRefusal(state, actingMemberId, "list", listId);
  if (admin) return fail(admin);
  const hoje = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  let executed = 0;
  let failed = 0;
  let skipped = 0;
  const failures: Array<{ taskId: Id; title: string; reason: string }> = [];
  for (const task of state.tasks.filter((t) => t.listId === listId && !t.parentTaskId && effectiveLifecycleOfTask(state, t.id) === "ativo")) {
    if (!memberSeesTask(state, actingMemberId, task.id)) continue;
    for (const { automation, version } of listAutomationsFor(state, task)) {
      const trigger = version.trigger;
      if (!trigger || trigger.kind !== "condicaoTemporal") continue;
      const spec = parseJson<TemporalSpec>(trigger.temporalPredicate);
      if (!spec || !task.dueDate) continue;
      const [y, m, d] = task.dueDate.value.slice(0, 10).split("-").map(Number);
      const disparo = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + spec.dueDateOffsetDays).getTime();
      if (hoje < disparo) continue;
      // Concluída: nunca repete. Falhou ou ficou pendente: reavalia só em
      // outro dia — senão cada clique em "rodar" gera outro Comentário de
      // "falta X", ou empilha uma segunda espera que ainda não venceu.
      const jaRodou = state.automationExecutions.some(
        (e) =>
          e.automationId === automation.id &&
          e.objectId === task.id &&
          (e.state === "concluida" || ((e.state === "falhou" || e.state === "pendente") && mesmoDiaCivil(e.startedAt, today))),
      );
      if (jaRodou) {
        skipped += 1;
        continue;
      }
      if (!conditionsHold(state, task, version)) {
        skipped += 1;
        continue;
      }
      // A linha que amarra o relógio injetado à Execução que ele produz.
      const execution = execute(state, automation, version, task, today);
      if (execution.state === "concluida") executed += 1;
      else {
        failed += 1;
        failures.push({ taskId: task.id, title: task.title, reason: execution.terminationReason ?? automation.name });
      }
    }
  }
  return ok({ executed, failed, skipped, failures });
}

