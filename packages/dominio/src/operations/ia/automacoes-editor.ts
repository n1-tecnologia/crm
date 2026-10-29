/**
 * O editor de Automação (19, 12.1–12.3): criar, editar os atributos, abrir e
 * descartar rascunho, compor o rascunho — Gatilho, Condições, Ações e Política
 * de erro —, duplicar e o ciclo de vida (pausar, retomar, arquivar, lixeira).
 * Publicar continua em `publishAutomation` (`../ai.ts`), que valida pelo
 * `validarAutomacao` que o editor também lê. Só o rascunho é editável: as
 * Versões `publicada` e `obsoleta` são imutáveis (INV-AUT-02).
 *
 * Sufixo `DaAutomacao` onde o nome colidiria com o editor de Flow
 * (`criarRascunhoAPartirDe` e `descartarRascunho` são do Flow).
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type {
  ActorRef,
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationScopeType,
  AutomationTrigger,
  AutomationVersion,
  AutonomyLevel,
  ExecutionState,
  Id,
} from "../../types";
import { rascunhoDaAutomacao, versaoVigenteDaAutomacao } from "../../derive-ia";
import { OBJECT_TYPE_LABEL } from "../../rotulos";
import { memberActor, nextId, recordActivity } from "../activity";
import { blockedAbove } from "../configuration";
import { CONTROLES, escopoExiste, eventoDoCatalogo } from "./automacoes-catalogo";
import { recusaDoEvento } from "./automacoes-validacao";
import { recusaDeAdministrarAutomacao, recusaDeConvidado, recusaDeMembroAtivo } from "./permissoes-ia";

const now = (): string => new Date().toISOString();

const automacaoPorId = (state: DataState, id: Id): Automation | undefined => state.automations.find((a) => a.id === id);

function registrarNaAutomacao(
  state: DataState,
  automation: Automation,
  input: { readonly actor: ActorRef; readonly action: string; readonly result?: "ok" | "denied" | "failed"; readonly before?: string; readonly after?: string; readonly detail?: string },
): void {
  recordActivity(state, { ...input, objectType: "automation", objectId: automation.id, objectName: automation.name });
}

const rotuloDoEscopo = (scopeType: AutomationScopeType): string => OBJECT_TYPE_LABEL[scopeType] ?? scopeType;

// ── Nome (RN-AUT-03) ───────────────────────────────────────────────────────

const chaveDoNome = (name: string): string => name.trim().toLocaleLowerCase("pt-BR");

/**
 * RN-AUT-03 — outra Automação não `na lixeira`, no mesmo escopo, com o mesmo
 * nome (sem caixa nem espaços nas pontas). Criar, renomear e restaurar com
 * colisão são rejeitados até renomear; a restauração (`ai.ts`) pergunta aqui.
 */
export function nomeDeAutomacaoColide(state: DataState, scopeType: AutomationScopeType, scopeId: Id, name: string, exceto?: Id): boolean {
  const chave = chaveDoNome(name);
  return state.automations.some(
    (a) => a.id !== exceto && a.lifecycle !== "naLixeira" && a.scopeType === scopeType && a.scopeId === scopeId && chaveDoNome(a.name) === chave,
  );
}

const recusaDeNomeRepetido = (name: string): string => `Já existe uma Automação chamada “${name}” neste escopo (RN-AUT-03).`;

// ── Cópias (as Versões publicadas são imutáveis; copiar é a única forma de "editar" uma) ──

/**
 * As cópias são explícitas, chave a chave: `exactOptionalPropertyTypes`
 * distingue ausente de `undefined`, e uma Versão copiada não carrega chaves
 * vazias. B90 — só a Condição híbrida invoca um Agente; B91 — a escrita não
 * carrega controle e o controle não carrega Ferramenta.
 */
function copiarCondicao(c: AutomationCondition): AutomationCondition {
  return {
    kind: c.kind,
    expression: c.expression,
    ...(c.kind === "hibrida" && c.agentId !== undefined ? { agentId: c.agentId } : {}),
    ...(c.kind === "hibrida" && c.skillId !== undefined ? { skillId: c.skillId } : {}),
    ...(c.defaultOnFailure !== undefined ? { defaultOnFailure: c.defaultOnFailure } : {}),
  };
}

function copiarAcao(a: AutomationAction): AutomationAction {
  return {
    order: a.order,
    kind: a.kind,
    ...(a.kind === "escrita" && a.toolId !== undefined ? { toolId: a.toolId } : {}),
    ...(a.kind === "controle" && a.controlKind !== undefined ? { controlKind: a.controlKind } : {}),
    params: a.params,
    ...(a.targetExpression !== undefined ? { targetExpression: a.targetExpression } : {}),
    ...(a.agentId !== undefined ? { agentId: a.agentId } : {}),
    ...(a.skillId !== undefined ? { skillId: a.skillId } : {}),
    ...(a.maxAutonomy !== undefined ? { maxAutonomy: a.maxAutonomy } : {}),
    ...(a.approverMemberId !== undefined ? { approverMemberId: a.approverMemberId } : {}),
    ...(a.approverTeamId !== undefined ? { approverTeamId: a.approverTeamId } : {}),
    ...(a.timeoutHours !== undefined ? { timeoutHours: a.timeoutHours } : {}),
  };
}

const copiarGatilho = (t: AutomationTrigger): AutomationTrigger => ({
  kind: t.kind,
  ...(t.eventType !== undefined ? { eventType: t.eventType } : {}),
  ...(t.eventSubtype !== undefined ? { eventSubtype: t.eventSubtype } : {}),
  ...(t.schedule
    ? {
        schedule: {
          frequency: t.schedule.frequency,
          interval: t.schedule.interval,
          ...(t.schedule.weekDays ? { weekDays: [...t.schedule.weekDays] } : {}),
          ...(t.schedule.time !== undefined ? { time: t.schedule.time } : {}),
        },
      }
    : {}),
  ...(t.temporalPredicate !== undefined ? { temporalPredicate: t.temporalPredicate } : {}),
});

function copiarVersao(origem: AutomationVersion, numero: number): AutomationVersion {
  return {
    number: numero,
    state: "rascunho",
    ...(origem.trigger ? { trigger: copiarGatilho(origem.trigger) } : {}),
    conditions: origem.conditions.map(copiarCondicao),
    actions: origem.actions.map(copiarAcao),
    errorPolicy: { ...origem.errorPolicy },
    ...(origem.maxAutonomy !== undefined ? { maxAutonomy: origem.maxAutonomy } : {}),
    createdAt: now(),
  };
}

/** A Versão com que toda Automação nasce: sem Gatilho, sem Condição, sem Ação, Política "interromper". */
const versaoVazia = (numero: number): AutomationVersion => ({
  number: numero,
  state: "rascunho",
  conditions: [],
  actions: [],
  errorPolicy: { onActionFailure: "interromper", retries: 0 },
  createdAt: now(),
});

/** A Versão de que um rascunho ou uma cópia parte: a vigente; sem ela, a de maior número. */
function versaoDePartida(automation: Automation): AutomationVersion | undefined {
  const vigente = versaoVigenteDaAutomacao(automation);
  if (vigente) return vigente;
  let ultima: AutomationVersion | undefined;
  for (const v of automation.versions) if (!ultima || v.number > ultima.number) ultima = v;
  return ultima;
}

const proximoNumero = (automation: Automation): number => Math.max(0, ...automation.versions.map((v) => v.number)) + 1;

// ── Rótulos dos blocos, para o Registro de Atividade ───────────────────────

const ROTULO_DA_CONDICAO: Record<AutomationCondition["kind"], string> = {
  atributo: "atributo",
  valorDeCampo: "Valor de Campo",
  pertencimento: "pertencimento",
  temporal: "temporal",
  hibrida: "híbrida",
};

function rotuloDoGatilho(trigger: AutomationTrigger): string {
  switch (trigger.kind) {
    case "evento": {
      const evento = trigger.eventType === undefined ? undefined : eventoDoCatalogo(trigger.eventType);
      const nome = evento?.rotulo ?? trigger.eventType ?? "Evento a escolher";
      return trigger.eventSubtype ? `${nome} “${trigger.eventSubtype}”` : nome;
    }
    case "agendamento":
      return trigger.schedule ? `a cada ${trigger.schedule.interval} ${trigger.schedule.frequency}` : "agendamento a definir";
    case "manual":
      return "manual";
    case "condicaoTemporal":
      return "condição de tempo";
  }
}

function rotuloDaAcao(state: DataState, action: Pick<AutomationAction, "kind" | "toolId" | "controlKind">): string {
  if (action.kind === "escrita") return state.tools.find((t) => t.id === action.toolId)?.name ?? action.toolId ?? "Ferramenta a escolher";
  return CONTROLES.find((c) => c.id === action.controlKind)?.rotulo ?? action.controlKind ?? "controle a escolher";
}

// ── Criar, editar, duplicar ────────────────────────────────────────────────

export interface CriarAutomacaoInput {
  readonly name: string;
  readonly description?: string;
  readonly scopeType: AutomationScopeType;
  readonly scopeId: Id;
  /** O Gatilho inicial; sem ele, a Versão 1 nasce sem Gatilho e a validação pede um. */
  readonly trigger?: AutomationTrigger;
}

/** 19, 12.1 — nasce `rascunho`, Versão 1 `rascunho`, Criador e Proprietário = o Membro, escopo fixado (RN-AUT-02). Um Convidado nunca cria. */
export function criarAutomacao(state: DataState, actingMemberId: Id, input: CriarAutomacaoInput): OperationResult<Automation> {
  const convidado = recusaDeConvidado(state, actingMemberId, "cria Automação");
  if (convidado) return fail(convidado);
  const name = input.name.trim();
  if (!name) return fail("Dê um nome à Automação.", "nome");
  if (!escopoExiste(state, input.scopeType, input.scopeId)) return fail("O escopo indicado não existe.", "escopo");
  // D-16, 2.6.5 item 4 — um Espaço ou Pasta acima pode ter bloqueado as Automações abaixo dele.
  if (input.scopeType === "folder" || input.scopeType === "list") {
    const bloqueio = blockedAbove(state, input.scopeType, input.scopeId, "automations");
    if (bloqueio) return fail(bloqueio, "escopo");
  }
  if (nomeDeAutomacaoColide(state, input.scopeType, input.scopeId, name)) return fail(recusaDeNomeRepetido(name), "nome");
  if (input.trigger?.kind === "evento" && input.trigger.eventType !== undefined) {
    const recusa = recusaDoEvento(input.scopeType, input.trigger.eventType);
    if (recusa) return fail(recusa, "gatilho");
  }
  const momento = now();
  const ator = memberActor(actingMemberId);
  const automation: Automation = {
    id: nextId("aut"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: momento,
    lifecycle: "rascunho",
    name,
    description: input.description?.trim() ?? "",
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    ownerMemberId: actingMemberId,
    reactsToAutomationEvents: false,
    versions: [{ ...versaoVazia(1), ...(input.trigger ? { trigger: copiarGatilho(input.trigger) } : {}) }],
  };
  state.automations.push(automation);
  registrarNaAutomacao(state, automation, { actor: ator, action: "Automação criada", detail: `Versão 1 em rascunho · escopo ${rotuloDoEscopo(input.scopeType)}` });
  return ok(automation, automation.id);
}

export interface EditarAutomacaoInput {
  readonly name?: string;
  readonly description?: string;
  readonly reactsToAutomationEvents?: boolean;
}

/** 12.3 — renomear, descrever e alternar "Reage a Eventos de Automações" são atos sobre a Automação, sem Versão nova. */
export function editarAutomacao(state: DataState, actingMemberId: Id, automationId: Id, input: EditarAutomacaoInput): OperationResult<Automation> {
  const editavel = automacaoEditavel(state, actingMemberId, automationId);
  if (!editavel.ok) return editavel;
  const automation = editavel.value;
  const ator = memberActor(actingMemberId);
  if (input.name !== undefined && input.name.trim() !== automation.name) {
    const name = input.name.trim();
    if (!name) return fail("Dê um nome à Automação.", "nome");
    if (nomeDeAutomacaoColide(state, automation.scopeType, automation.scopeId, name, automation.id)) return fail(recusaDeNomeRepetido(name), "nome");
    const antes = automation.name;
    automation.name = name;
    registrarNaAutomacao(state, automation, { actor: ator, action: "Automação renomeada", before: antes, after: name });
  }
  if (input.description !== undefined && input.description.trim() !== automation.description) {
    automation.description = input.description.trim();
    registrarNaAutomacao(state, automation, { actor: ator, action: "Descrição da Automação alterada" });
  }
  if (input.reactsToAutomationEvents !== undefined && input.reactsToAutomationEvents !== automation.reactsToAutomationEvents) {
    automation.reactsToAutomationEvents = input.reactsToAutomationEvents;
    registrarNaAutomacao(state, automation, {
      actor: ator,
      action: "Reação a Eventos de Automações alterada",
      after: input.reactsToAutomationEvents ? "reage" : "não reage",
      detail: "Nunca aos próprios Eventos (INV-AUT-08).",
    });
  }
  return ok(automation, automation.id);
}

/** 12.1 — por duplicação: `rascunho`, Proveniência, Versão 1 copiada da vigente; o nome ganha “(cópia)” até ser único no escopo. */
export function duplicarAutomacao(state: DataState, actingMemberId: Id, automationId: Id): OperationResult<Automation> {
  const convidado = recusaDeConvidado(state, actingMemberId, "cria Automação");
  if (convidado) return fail(convidado);
  const origem = automacaoPorId(state, automationId);
  if (!origem) return fail("Automação não encontrada.");
  const base = versaoDePartida(origem);
  if (!base) return fail("A Automação de origem não tem Versão.");
  let name = `${origem.name} (cópia)`;
  let n = 2;
  while (nomeDeAutomacaoColide(state, origem.scopeType, origem.scopeId, name)) name = `${origem.name} (cópia ${n++})`;
  const momento = now();
  const ator = memberActor(actingMemberId);
  const copia: Automation = {
    id: nextId("aut"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: momento,
    lifecycle: "rascunho",
    name,
    description: origem.description,
    scopeType: origem.scopeType,
    scopeId: origem.scopeId,
    ownerMemberId: actingMemberId,
    ...(origem.roleId !== undefined ? { roleId: origem.roleId } : {}),
    reactsToAutomationEvents: origem.reactsToAutomationEvents,
    versions: [copiarVersao(base, 1)],
    provenance: { kind: "copy", sourceId: origem.id, sourceName: origem.name, at: momento },
  };
  state.automations.push(copia);
  registrarNaAutomacao(state, copia, { actor: ator, action: "Automação duplicada", detail: `de “${origem.name}” (v${base.number})` });
  return ok(copia, copia.id);
}

// ── Rascunho (12.2) ────────────────────────────────────────────────────────

/**
 * A Automação que o Membro pode editar (`editar` = administrar, 12.2), ou por
 * que não: arquivada e na lixeira não se editam (11.1). Toda edição, de
 * atributo ou de rascunho, passa por aqui.
 */
function automacaoEditavel(state: DataState, actingMemberId: Id, automationId: Id): OperationResult<Automation> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const automation = automacaoPorId(state, automationId);
  if (!automation) return fail("Automação não encontrada.");
  if (automation.lifecycle === "arquivado" || automation.lifecycle === "naLixeira") return fail("Restaure a Automação antes de editar.");
  const recusa = recusaDeAdministrarAutomacao(state, actingMemberId, automation, "editar");
  if (recusa) return fail(recusa);
  return ok(automation);
}

/** O rascunho editável, ou por que não há. Toda edição de bloco passa por aqui. */
function rascunhoEditavel(state: DataState, actingMemberId: Id, automationId: Id): OperationResult<{ readonly automation: Automation; readonly rascunho: AutomationVersion }> {
  const editavel = automacaoEditavel(state, actingMemberId, automationId);
  if (!editavel.ok) return editavel;
  const automation = editavel.value;
  const rascunho = rascunhoDaAutomacao(automation);
  if (!rascunho) return fail("Não há rascunho: crie um a partir da Versão vigente.");
  return ok({ automation, rascunho });
}

/** 12.2 — editar sem rascunho é criar um a partir da vigente, com o número seguinte. Um rascunho por vez (INV-AUT-02). */
export function criarRascunhoDaAutomacao(state: DataState, actingMemberId: Id, automationId: Id): OperationResult<AutomationVersion> {
  const editavel = automacaoEditavel(state, actingMemberId, automationId);
  if (!editavel.ok) return editavel;
  const automation = editavel.value;
  if (rascunhoDaAutomacao(automation)) return fail("A Automação já tem um rascunho (INV-AUT-02).");
  const base = versaoDePartida(automation);
  const numero = proximoNumero(automation);
  const rascunho = base ? copiarVersao(base, numero) : versaoVazia(numero);
  automation.versions.push(rascunho);
  registrarNaAutomacao(state, automation, {
    actor: memberActor(actingMemberId),
    action: "Rascunho de Automação criado",
    after: `v${numero}`,
    ...(base ? { detail: `a partir da v${base.number} (${base.state})` } : {}),
  });
  return ok(rascunho, automation.id);
}

/** 12.2 — descartar o rascunho; o único não, porque a Automação ficaria sem Versão (INV-AUT-02). */
export function descartarRascunhoDaAutomacao(state: DataState, actingMemberId: Id, automationId: Id): OperationResult<Automation> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  if (automation.versions.length === 1) return fail("Este é a única Versão da Automação: descartá-la a deixaria vazia (INV-AUT-02).");
  automation.versions = automation.versions.filter((v) => v !== rascunho);
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Rascunho de Automação descartado", before: `v${rascunho.number}` });
  return ok(automation, automation.id);
}

// ── Gatilho (7.2; exatamente um — INV-AUT-03) ──────────────────────────────

/** Define ou remove o Gatilho do rascunho. Um Evento que o escopo não alcança é recusado no ato (RN-AUT-07). */
export function definirGatilho(state: DataState, actingMemberId: Id, automationId: Id, trigger: AutomationTrigger | null): OperationResult<AutomationVersion> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  const ator = memberActor(actingMemberId);
  if (trigger === null) {
    if (!rascunho.trigger) return ok(rascunho, automation.id);
    delete rascunho.trigger;
    registrarNaAutomacao(state, automation, { actor: ator, action: "Gatilho removido", detail: `v${rascunho.number}` });
    return ok(rascunho, automation.id);
  }
  if (trigger.kind === "evento" && trigger.eventType !== undefined && trigger.eventType !== "") {
    const recusa = recusaDoEvento(automation.scopeType, trigger.eventType);
    if (recusa) return fail(recusa, "gatilho");
  }
  rascunho.trigger = copiarGatilho(trigger);
  registrarNaAutomacao(state, automation, { actor: ator, action: "Gatilho definido", detail: `v${rascunho.number} · ${rotuloDoGatilho(rascunho.trigger)}` });
  return ok(rascunho, automation.id);
}

// ── Condições (7.3) ────────────────────────────────────────────────────────

/** RN-AUT-06 — a híbrida invoca um Agente; sem ele não classifica nada. */
const recusaDaCondicao = (condicao: AutomationCondition): string | undefined =>
  condicao.kind === "hibrida" && !condicao.agentId ? "Uma Condição híbrida indica o Agente que classifica (RN-AUT-06)." : undefined;

export function adicionarCondicao(state: DataState, actingMemberId: Id, automationId: Id, condicao: AutomationCondition): OperationResult<AutomationVersion> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  const nova = copiarCondicao(condicao);
  const recusa = recusaDaCondicao(nova);
  if (recusa) return fail(recusa, "condicoes");
  rascunho.conditions.push(nova);
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Condição adicionada", detail: `v${rascunho.number} · ${ROTULO_DA_CONDICAO[nova.kind]}` });
  return ok(rascunho, automation.id);
}

export function editarCondicao(state: DataState, actingMemberId: Id, automationId: Id, indice: number, patch: Partial<AutomationCondition>): OperationResult<AutomationVersion> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  const atual = rascunho.conditions[indice];
  if (!atual) return fail("Condição não encontrada.");
  const proxima = copiarCondicao({ ...atual, ...patch });
  const recusa = recusaDaCondicao(proxima);
  if (recusa) return fail(recusa, "condicoes");
  rascunho.conditions[indice] = proxima;
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Condição alterada", detail: `v${rascunho.number} · ${indice + 1}ª · ${ROTULO_DA_CONDICAO[proxima.kind]}` });
  return ok(rascunho, automation.id);
}

export function removerCondicao(state: DataState, actingMemberId: Id, automationId: Id, indice: number): OperationResult<AutomationVersion> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  const atual = rascunho.conditions[indice];
  if (!atual) return fail("Condição não encontrada.");
  rascunho.conditions.splice(indice, 1);
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Condição removida", detail: `v${rascunho.number} · ${ROTULO_DA_CONDICAO[atual.kind]}` });
  return ok(rascunho, automation.id);
}

// ── Ações (7.4; lista ordenada) ────────────────────────────────────────────

/** B91 — a escrita é sempre Ferramenta; o controle nunca é. Ramificar fica fora deste protótipo. */
function recusaDaAcao(acao: Omit<AutomationAction, "order">): string | undefined {
  if (acao.kind === "escrita" && !acao.toolId) return "Uma Ação de escrita é sempre uma Ferramenta do Catálogo (INV-AUT-05).";
  if (acao.kind === "controle") {
    if (!acao.controlKind) return "Uma Ação de controle indica qual controle executa (B91).";
    if (acao.controlKind === "ramificar") return "Ramificação não entra neste protótipo.";
  }
  return undefined;
}

/** `order` é 0..n-1 na ordem atual; `order` é imutável na Ação, então a lista é refeita. */
function renumerar(rascunho: AutomationVersion): void {
  rascunho.actions = [...rascunho.actions].sort((a, b) => a.order - b.order).map((a, order) => ({ ...a, order }));
}

export function adicionarAcao(state: DataState, actingMemberId: Id, automationId: Id, acao: Omit<AutomationAction, "order">): OperationResult<AutomationVersion> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  const recusa = recusaDaAcao(acao);
  if (recusa) return fail(recusa, "acoes");
  renumerar(rascunho);
  const nova = copiarAcao({ ...acao, order: rascunho.actions.length });
  rascunho.actions.push(nova);
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Ação adicionada", detail: `v${rascunho.number} · ${nova.order + 1}ª · ${rotuloDaAcao(state, nova)}` });
  return ok(rascunho, automation.id);
}

export function editarAcao(state: DataState, actingMemberId: Id, automationId: Id, order: number, patch: Partial<Omit<AutomationAction, "order">>): OperationResult<AutomationVersion> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  const indice = rascunho.actions.findIndex((a) => a.order === order);
  const atual = rascunho.actions[indice];
  if (!atual) return fail("Ação não encontrada.");
  const proxima = copiarAcao({ ...atual, ...patch, order: atual.order });
  const recusa = recusaDaAcao(proxima);
  if (recusa) return fail(recusa, "acoes");
  rascunho.actions[indice] = proxima;
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Ação alterada", detail: `v${rascunho.number} · ${order + 1}ª · ${rotuloDaAcao(state, proxima)}` });
  return ok(rascunho, automation.id);
}

export function moverAcao(state: DataState, actingMemberId: Id, automationId: Id, order: number, direcao: "subir" | "descer"): OperationResult<AutomationVersion> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  renumerar(rascunho);
  const indice = rascunho.actions.findIndex((a) => a.order === order);
  const acao = rascunho.actions[indice];
  if (!acao) return fail("Ação não encontrada.");
  const destino = direcao === "subir" ? indice - 1 : indice + 1;
  const outra = rascunho.actions[destino];
  if (!outra) return ok(rascunho, automation.id);
  rascunho.actions[indice] = { ...outra, order: acao.order };
  rascunho.actions[destino] = { ...acao, order: outra.order };
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Ação movida", detail: `v${rascunho.number} · ${rotuloDaAcao(state, acao)} ${direcao === "subir" ? "↑" : "↓"}` });
  return ok(rascunho, automation.id);
}

export function removerAcao(state: DataState, actingMemberId: Id, automationId: Id, order: number): OperationResult<AutomationVersion> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  const acao = rascunho.actions.find((a) => a.order === order);
  if (!acao) return fail("Ação não encontrada.");
  rascunho.actions = rascunho.actions.filter((a) => a !== acao);
  renumerar(rascunho);
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Ação removida", detail: `v${rascunho.number} · ${rotuloDaAcao(state, acao)}` });
  return ok(rascunho, automation.id);
}

// ── Política de erro (7.5) ─────────────────────────────────────────────────

export interface PoliticaDeErroInput {
  readonly onActionFailure: AutomationVersion["errorPolicy"]["onActionFailure"];
  /** RN-AUT-14 — retentativas só de Ferramenta de Integração, em número limitado: 0 a 3. */
  readonly retries: number;
  /** RN-AUT-25 — a autonomia máxima imposta aos Agentes invocados; `null` retira o teto. */
  readonly maxAutonomy?: AutonomyLevel | null;
}

export function definirPoliticaDeErro(state: DataState, actingMemberId: Id, automationId: Id, input: PoliticaDeErroInput): OperationResult<AutomationVersion> {
  const r = rascunhoEditavel(state, actingMemberId, automationId);
  if (!r.ok) return r;
  const { automation, rascunho } = r.value;
  if (!Number.isInteger(input.retries) || input.retries < 0 || input.retries > 3) return fail("As retentativas vão de 0 a 3 (RN-AUT-14).", "politica");
  rascunho.errorPolicy = { onActionFailure: input.onActionFailure, retries: input.retries };
  if (input.maxAutonomy === null) delete rascunho.maxAutonomy;
  else if (input.maxAutonomy !== undefined) rascunho.maxAutonomy = input.maxAutonomy;
  registrarNaAutomacao(state, automation, {
    actor: memberActor(actingMemberId),
    action: "Política de erro definida",
    detail: `v${rascunho.number} · ${input.onActionFailure} · ${input.retries} retentativa${input.retries === 1 ? "" : "s"}${rascunho.maxAutonomy ? ` · autonomia máxima ${rascunho.maxAutonomy}` : ""}`,
  });
  return ok(rascunho, automation.id);
}

// ── Ciclo de vida (11.1, 12.3) ─────────────────────────────────────────────

const TERMINAL: ReadonlySet<ExecutionState> = new Set(["concluida", "falhou", "cancelada"]);

/**
 * Arquivar e excluir cancelam as Execuções não terminais no ato, com as
 * Execuções de Agente filhas e as Solicitações pendentes delas (INV-AUT-09).
 * Devolve quantas Execuções de Automação foram canceladas.
 */
function cancelarExecucoes(state: DataState, automation: Automation, motivo: string): number {
  const momento = now();
  let canceladas = 0;
  for (const execution of state.automationExecutions) {
    if (execution.automationId !== automation.id || TERMINAL.has(execution.state)) continue;
    execution.state = "cancelada";
    execution.terminationReason = motivo;
    execution.endedAt = momento;
    canceladas += 1;
    for (const filha of state.agentExecutions) {
      if (!execution.childAgentExecutionIds.includes(filha.id) || TERMINAL.has(filha.state)) continue;
      filha.state = "cancelada";
      filha.terminationReason = motivo;
      filha.endedAt = momento;
      for (const approval of state.approvals) {
        if (approval.origin.kind === "agentExecution" && approval.origin.executionId === filha.id && !approval.decision) {
          approval.decision = "cancelada";
          approval.decidedAt = momento;
        }
      }
    }
  }
  return canceladas;
}

const contagemDeExecucoes = (n: number): string => (n === 1 ? "1 Execução cancelada" : `${n} Execuções canceladas`);

/** ativo → pausado: só impede novas disparadas; Execuções em curso terminam e Eventos do período não são repostos. */
export function pausarAutomacao(state: DataState, actingMemberId: Id, automationId: Id): OperationResult<Automation> {
  const automation = automacaoPorId(state, automationId);
  if (!automation) return fail("Automação não encontrada.");
  const recusa = recusaDeAdministrarAutomacao(state, actingMemberId, automation, "pausar");
  if (recusa) return fail(recusa);
  if (automation.lifecycle !== "ativo") return fail("Só uma Automação ativa é pausada.");
  automation.lifecycle = "pausado";
  registrarNaAutomacao(state, automation, {
    actor: memberActor(actingMemberId),
    action: "Automação pausada",
    before: "ativo",
    after: "pausado",
    detail: "Execuções em curso terminam; Eventos do período não são repostos ao retomar (12.3).",
  });
  return ok(automation, automation.id);
}

/** pausado → ativo: passa a escutar Gatilhos a partir do momento; nada retroativo. */
export function retomarAutomacao(state: DataState, actingMemberId: Id, automationId: Id): OperationResult<Automation> {
  const automation = automacaoPorId(state, automationId);
  if (!automation) return fail("Automação não encontrada.");
  const recusa = recusaDeAdministrarAutomacao(state, actingMemberId, automation, "pausar");
  if (recusa) return fail(recusa);
  if (automation.lifecycle !== "pausado") return fail("Só uma Automação pausada é retomada.");
  automation.lifecycle = "ativo";
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Automação retomada", before: "pausado", after: "ativo" });
  return ok(automation, automation.id);
}

/** rascunho | ativo | pausado → arquivado; Execuções não terminais → `cancelada`. Restaurar devolve a `pausado` (RN-AUT-05), pelo estado gravado. */
export function arquivarAutomacao(state: DataState, actingMemberId: Id, automationId: Id): OperationResult<Automation> {
  const automation = automacaoPorId(state, automationId);
  if (!automation) return fail("Automação não encontrada.");
  const recusa = recusaDeAdministrarAutomacao(state, actingMemberId, automation, "arquivar");
  if (recusa) return fail(recusa);
  if (automation.lifecycle !== "rascunho" && automation.lifecycle !== "ativo" && automation.lifecycle !== "pausado") {
    return fail("Só uma Automação em rascunho, ativa ou pausada é arquivada.");
  }
  const antes = automation.lifecycle;
  const canceladas = cancelarExecucoes(state, automation, "Automação arquivada");
  automation.lifecycleBeforeTrashAi = antes;
  automation.lifecycle = "arquivado";
  automation.archivedAt = now();
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Automação arquivada", before: antes, after: "arquivado", detail: contagemDeExecucoes(canceladas) });
  return ok(automation, automation.id);
}

/** qualquer → na lixeira: como arquivar, gravando o estado anterior para a restauração (B43, RN-AUT-05). */
export function enviarAutomacaoALixeira(state: DataState, actingMemberId: Id, automationId: Id): OperationResult<Automation> {
  const automation = automacaoPorId(state, automationId);
  if (!automation) return fail("Automação não encontrada.");
  const recusa = recusaDeAdministrarAutomacao(state, actingMemberId, automation, "arquivar");
  if (recusa) return fail(recusa);
  if (automation.lifecycle === "naLixeira") return fail("A Automação já está na lixeira.");
  const antes = automation.lifecycle;
  const canceladas = cancelarExecucoes(state, automation, "Automação enviada à lixeira");
  automation.lifecycleBeforeTrashAi = antes;
  automation.lifecycle = "naLixeira";
  automation.trashedAt = now();
  registrarNaAutomacao(state, automation, { actor: memberActor(actingMemberId), action: "Automação enviada à lixeira", before: antes, after: "naLixeira", detail: contagemDeExecucoes(canceladas) });
  return ok(automation, automation.id);
}
