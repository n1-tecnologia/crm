/**
 * Deal and Funnel operations.
 * Stage Requirements and allowed Transitions are synchronous, blocking and
 * valid for EVERY actor, without exception by role (B59, RN-FUN-07).
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type {
  Deal,
  FieldValue,
  DealContactRole,
  Funnel,
  Id,
  Member,
  Money,
  Stage,
  StageTransition,
} from "../types";
import { memberActor, nextId, recordActivity } from "./activity";

/** Origin → destination, explicit. Never by name, never by position. */
export interface StageMapping {
  readonly fromStatusId: Id;
  readonly toStatusId: Id;
}

const now = (): string => new Date().toISOString();

/**
 * Quem pode escrever num Negócio. Vale para criar e para vincular Contato: a
 * tela do Negócio oferece os dois, e uma regra que só a tela conhece não é
 * regra — é aparência.
 */
function mayWriteDeal(state: DataState, actingMemberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo altera Negócio.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return "Um Convidado não altera Negócio: ele alcança só o que foi compartilhado com ele.";
  }
  return undefined;
}

function funnelOf(state: DataState, deal: Deal): Funnel | undefined {
  return state.funnels.find((f) => f.id === deal.funnelId);
}

const REQUIREMENT_LABEL: Record<string, string> = {
  contatoObrigatorio: "exige ao menos um Contato vinculado",
  empresaObrigatoria: "exige uma Empresa vinculada",
  valorObrigatorio: "exige um valor maior que zero",
  campoPreenchido: "exige um campo personalizado preenchido",
  proprietarioObrigatorio: "exige um Proprietário",
};

/** B59 — a requirement is verifiable over the Deal itself and its links. */
function unmetRequirement(
  state: DataState,
  deal: Deal,
  stage: Stage,
  moment: "entrada" | "saida",
): string | null {
  for (const requirement of stage.requirements) {
    if (requirement.moment !== moment) continue;
    switch (requirement.kind) {
      case "contatoObrigatorio":
        if (deal.contactLinks.length === 0) return REQUIREMENT_LABEL[requirement.kind] ?? requirement.kind;
        break;
      case "empresaObrigatoria":
        if (!deal.companyId) return REQUIREMENT_LABEL[requirement.kind] ?? requirement.kind;
        break;
      case "valorObrigatorio":
        if (!deal.value || deal.value.amount <= 0) return REQUIREMENT_LABEL[requirement.kind] ?? requirement.kind;
        break;
      case "campoPreenchido": {
        const value = deal.fieldValues.find((v) => v.definitionId === requirement.fieldDefinitionId);
        const definition = state.fieldDefinitions.find((d) => d.id === requirement.fieldDefinitionId);
        const empty = value === undefined || value.value === null || value.value === "";
        if (empty) return `exige o campo “${definition?.name ?? "personalizado"}” preenchido`;
        break;
      }
      case "proprietarioObrigatorio":
        if (!deal.ownerMemberId) return REQUIREMENT_LABEL[requirement.kind] ?? requirement.kind;
        break;
      default:
        break;
    }
  }
  return null;
}

function pushTransition(
  state: DataState,
  deal: Deal,
  actingMemberId: Id,
  from: Stage | undefined,
  to: Stage,
  origin: StageTransition["entryOrigin"],
  discarded?: number,
): void {
  const transition: StageTransition = {
    id: nextId("trn"),
    at: now(),
    ...(from ? { fromStageId: from.id, fromStageName: from.name, fromStageOrder: from.order } : {}),
    toStageId: to.id,
    toStageName: to.name,
    toStageOrder: to.order,
    toFunnelId: deal.funnelId,
    entryOrigin: origin,
    ...(discarded !== undefined ? { discardedProbability: discarded } : {}),
    actor: memberActor(actingMemberId),
  };
  deal.stageHistory.push(transition);
  deal.enteredStageAt = transition.at;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: origin === "remapeamento" ? "Negócio remapeado" : "Negócio entrou em Etapa",
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
    before: from?.name,
    after: to.name,
    detail: origin,
  });
}

/**
 * RN-NEG-04 / RN-FUN-07 — while `aberto` and `ativo`, the stage changes under
 * allowed transitions and requirements, for every actor.
 */
export function moveDealToStage(
  state: DataState,
  actingMemberId: Id,
  dealId: Id,
  targetStageId: Id,
): OperationResult<Deal> {
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return fail("Negócio não encontrado.");
  if (deal.lifecycle !== "ativo") {
    return fail(
      deal.lifecycle === "arquivado"
        ? "Este Negócio está arquivado e é somente leitura."
        : "Este Negócio está na lixeira.",
    );
  }
  if (deal.situation !== "aberto") {
    return fail("Um Negócio ganho ou perdido preserva a sua última Etapa. Reabra-o para movê-lo.");
  }
  const funnel = funnelOf(state, deal);
  if (!funnel) return fail("Funil não encontrado.");
  const from = funnel.stages.find((s) => s.id === deal.stageId);
  const to = funnel.stages.find((s) => s.id === targetStageId);
  if (!to) return fail("Etapa de destino não pertence a este Funil.");
  if (to.id === deal.stageId) return ok(deal);

  // B59 — allowed transitions: empty means every stage is allowed.
  if (from && from.allowedTransitionStageIds.length > 0 && !from.allowedTransitionStageIds.includes(to.id)) {
    const names = from.allowedTransitionStageIds
      .map((id) => funnel.stages.find((s) => s.id === id)?.name)
      .filter((n): n is string => Boolean(n))
      .map((n) => `“${n}”`)
      .join(", ");
    return fail(`De “${from.name}” só é possível ir para ${names}.`);
  }

  if (from) {
    const exit = unmetRequirement(state, deal, from, "saida");
    if (exit) return fail(`Não é possível sair de “${from.name}”: ${exit}.`);
  }
  const entry = unmetRequirement(state, deal, to, "entrada");
  if (entry) return fail(`Não é possível entrar em “${to.name}”: ${entry}.`);

  // DO-NEG-05 — the overridden probability is discarded on every progression,
  // with the discarded value preserved in the record.
  const discarded = deal.overriddenProbability;
  delete deal.overriddenProbability;
  deal.stageId = to.id;
  pushTransition(state, deal, actingMemberId, from, to, entryOriginFor(from, to), discarded);
  return ok(deal);
}

/** B62 — advance and retreat are derived from the order at the time. */
function entryOriginFor(from: Stage | undefined, to: Stage): StageTransition["entryOrigin"] {
  if (!from) return "criacao";
  if (to.order === from.order + 1) return "avanco";
  if (to.order < from.order) return "retrocesso";
  return "salto";
}

/**
 * RN-NEG-09 — closing is synchronous, blocking and valid for every actor. It
 * does NOT evaluate exit requirements and does not change the stage (B9).
 */
export function winDeal(
  state: DataState,
  actingMemberId: Id,
  dealId: Id,
  input: { value?: Money; winReasonId?: Id; closingNote?: string },
): OperationResult<Deal> {
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return fail("Negócio não encontrado.");
  if (deal.lifecycle !== "ativo") return fail("Só um Negócio ativo pode ser encerrado.");
  if (deal.situation !== "aberto") return fail("Este Negócio já está encerrado.");
  const funnel = funnelOf(state, deal);
  if (!funnel) return fail("Funil não encontrado.");

  const value = input.value ?? deal.value;
  if (funnel.closingRules.requireValueOnWin && (!value || value.amount <= 0)) {
    return fail("Este Funil exige um valor maior que zero para marcar o Negócio como ganho.", "valor");
  }

  if (value) deal.value = value;
  deal.situation = "ganho";
  delete deal.overriddenProbability;
  if (input.winReasonId) deal.winReasonId = input.winReasonId;
  if (input.closingNote) deal.closingNote = input.closingNote;
  deal.closedAt = now();

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Negócio marcado como ganho",
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
    after: value ? `${value.amount} ${value.currency}` : undefined,
    // RN-NEG-11 — the reason must survive the reopening that clears it.
    ...(input.winReasonId
      ? {
          detail: `Motivo de Ganho: ${state.catalog.find((c) => c.id === input.winReasonId)?.name ?? input.winReasonId}`,
        }
      : {}),
  });
  return ok(deal);
}

export function loseDeal(
  state: DataState,
  actingMemberId: Id,
  dealId: Id,
  input: { lossReasonId?: Id; closingNote?: string },
): OperationResult<Deal> {
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return fail("Negócio não encontrado.");
  if (deal.lifecycle !== "ativo") return fail("Só um Negócio ativo pode ser encerrado.");
  if (deal.situation !== "aberto") return fail("Este Negócio já está encerrado.");
  const funnel = funnelOf(state, deal);
  if (!funnel) return fail("Funil não encontrado.");

  if (funnel.closingRules.requireLossReason && !input.lossReasonId) {
    return fail("Este Funil exige um Motivo de Perda para marcar o Negócio como perdido.", "motivo");
  }

  deal.situation = "perdido";
  delete deal.overriddenProbability;
  if (input.lossReasonId) deal.lossReasonId = input.lossReasonId;
  if (input.closingNote) deal.closingNote = input.closingNote;
  deal.closedAt = now();

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Negócio marcado como perdido",
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
    after: state.catalog.find((c) => c.id === input.lossReasonId)?.name,
  });
  return ok(deal);
}

/**
 * B9 / RN-NEG-10 — reopening a `perdido` deal requires `editar`; reopening a
 * `ganho` one requires an Administrator-level role and is NEVER done by an
 * Agent (RN-NEG-21). RN-NEG-11 — the reason and note are cleared as current
 * attributes and stay in the activity records.
 */
export function reopenDeal(state: DataState, actingMemberId: Id, dealId: Id): OperationResult<Deal> {
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return fail("Negócio não encontrado.");
  if (deal.situation === "aberto") return ok(deal);
  if (deal.lifecycle !== "ativo") {
    return fail(
      deal.lifecycle === "arquivado"
        ? "Este Negócio está arquivado e é somente leitura."
        : "Este Negócio está na lixeira.",
    );
  }

  if (deal.situation === "ganho") {
    const member = state.members.find((m) => m.id === actingMemberId);
    const role = state.roles.find((r) => r.id === member?.roleId);
    const isAdminLevel = role?.base === "administrador" || role?.base === "proprietario";
    if (!isAdminLevel) {
      return fail("Só Administradores reabrem um Negócio ganho.");
    }
  }

  const funnel = funnelOf(state, deal);
  if (!funnel) return fail("Funil não encontrado.");
  if (funnel.lifecycle !== "ativo") {
    return fail("O Funil deste Negócio está arquivado. Mova-o para um Funil ativo no mesmo ato.");
  }
  const stage = funnel.stages.find((s) => s.id === deal.stageId);
  if (!stage) return fail("Etapa não encontrada.");
  const entry = unmetRequirement(state, deal, stage, "entrada");
  if (entry) return fail(`Não é possível reabrir em “${stage.name}”: ${entry}.`);

  const previous = deal.situation;

  /**
   * RN-NEG-11 — the closing attributes are cleared as CURRENT values but must
   * remain in the Registros de Atividade. Reading them into the record before
   * deleting them is the only thing that keeps them anywhere.
   */
  const clearedReasonId = previous === "ganho" ? deal.winReasonId : deal.lossReasonId;
  const clearedReason = state.catalog.find((item) => item.id === clearedReasonId)?.name;
  const cleared = [
    clearedReason ? `${previous === "ganho" ? "Motivo de Ganho" : "Motivo de Perda"}: ${clearedReason}` : undefined,
    deal.closingNote ? `Nota de encerramento: ${deal.closingNote}` : undefined,
    deal.closedAt ? `Encerrado em ${deal.closedAt}` : undefined,
  ].filter((part) => part !== undefined);

  deal.situation = "aberto";
  delete deal.lossReasonId;
  delete deal.winReasonId;
  delete deal.closingNote;
  delete deal.closedAt;
  pushTransition(state, deal, actingMemberId, stage, stage, "reabertura");

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Negócio reaberto",
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
    before: previous,
    after: "aberto",
    ...(cleared.length > 0 ? { detail: `Limpos no encerramento anterior — ${cleared.join(" · ")}` } : {}),
  });
  return ok(deal);
}

/** RN-NEG-07 — at most one link per pair; the first one is born principal. */
export function linkContactToDeal(
  state: DataState,
  actingMemberId: Id,
  dealId: Id,
  contactId: Id,
  role: DealContactRole,
): OperationResult<Deal> {
  const refusal = mayWriteDeal(state, actingMemberId);
  if (refusal) return fail(refusal);
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return fail("Negócio não encontrado.");
  if (deal.lifecycle !== "ativo") {
    return fail("Um Negócio na lixeira ou arquivado é somente leitura: restaure antes de vincular.");
  }
  if (deal.situation !== "aberto") {
    return fail("Este Negócio está encerrado: reabra antes de vincular um Contato.");
  }
  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return fail("Contato não encontrado.");
  if (contact.lifecycle === "mesclado") {
    return fail("Este Contato foi mesclado. Vincule o Contato sobrevivente.");
  }
  if (contact.lifecycle !== "ativo") {
    return fail("Este Contato não está ativo.");
  }
  if (deal.contactLinks.some((l) => l.contactId === contactId)) {
    return fail("Este Contato já está vinculado a este Negócio.");
  }

  deal.contactLinks.push({
    id: nextId("dcl"),
    contactId,
    role,
    principal: deal.contactLinks.length === 0,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato vinculado ao Negócio",
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
    after: `${contact.firstName} ${contact.lastName}`.trim(),
  });
  return ok(deal);
}

/**
 * RN-FUN-10 — removing a stage requires remapping EVERY deal that references
 * it, in any situation and state, including `naLixeira` (RN-NEG-17). The
 * remapping does not evaluate entry requirements and preserves the overridden
 * probability (RN-FUN-08, DO-NEG-05).
 */
export function removeStage(
  state: DataState,
  actingMemberId: Id,
  funnelId: Id,
  stageId: Id,
  targetStageId: Id,
): OperationResult<Funnel> {
  const funnel = state.funnels.find((f) => f.id === funnelId);
  if (!funnel) return fail("Funil não encontrado.");
  if (funnel.stages.length <= 1) return fail("Um Funil precisa de ao menos uma Etapa.");
  const stage = funnel.stages.find((s) => s.id === stageId);
  const target = funnel.stages.find((s) => s.id === targetStageId);
  if (!stage) return fail("Etapa não encontrada.");
  if (!target || target.id === stage.id) {
    return fail("Escolha uma Etapa de destino para os Negócios desta Etapa.", "destino");
  }

  const affected = state.deals.filter((d) => d.funnelId === funnelId && d.stageId === stageId);
  for (const deal of affected) {
    deal.stageId = target.id;
    // The overridden probability is preserved: remapping is maintenance, not
    // progression (DO-NEG-05).
    pushTransition(state, deal, actingMemberId, stage, target, "remapeamento");
  }

  funnel.stages = funnel.stages.filter((s) => s.id !== stageId);
  for (const other of funnel.stages) {
    other.allowedTransitionStageIds = other.allowedTransitionStageIds.filter((id) => id !== stageId);
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Etapa removida",
    objectType: "funnel",
    objectId: funnel.id,
    objectName: funnel.name,
    before: stage.name,
    after: target.name,
    detail: `${affected.length} Negócio(s) remapeado(s)`,
  });
  return ok(funnel);
}

/**
 * RN-FUN-12 / RN-FUN-13 / RN-FUN-15 — migrar Negócios de um Funil para outro.
 *
 * Sem mapeamento por nome nem por posição: cada Etapa de origem escolhe uma
 * Etapa de destino explicitamente. Nomes iguais em Funis diferentes podem ter
 * probabilidades e exigências opostas, e adivinhar aqui é errar em silêncio.
 *
 * Arquivar um Funil exige migrar os `aberto`; enviar à lixeira exige migrar
 * TODOS, inclusive os que estão na lixeira — por isso `scope` existe: é o que
 * distingue as duas obrigações.
 */
export function migrateDealsToFunnel(
  state: DataState,
  actingMemberId: Id,
  fromFunnelId: Id,
  toFunnelId: Id,
  stageMapping: readonly StageMapping[],
  scope: "abertos" | "todos" = "todos",
): OperationResult<number> {
  const from = state.funnels.find((f) => f.id === fromFunnelId);
  const to = state.funnels.find((f) => f.id === toFunnelId);
  if (!from) return fail("Funil de origem não encontrado.");
  if (!to) return fail("Funil de destino não encontrado.");
  if (to.id === from.id) return fail("Escolha um Funil de destino diferente.", "destino");
  if (to.lifecycle !== "ativo") return fail("O Funil de destino precisa estar ativo.", "destino");

  const affected = state.deals.filter(
    (deal) => deal.funnelId === fromFunnelId && (scope === "todos" || deal.situation === "aberto"),
  );

  // Every Stage actually in use needs an explicit destination — validated
  // BEFORE any write, so a rejected migration leaves nothing half-moved.
  const stagesInUse = [...new Set(affected.map((deal) => deal.stageId))];
  for (const stageId of stagesInUse) {
    const mapped = stageMapping.find((entry) => entry.fromStatusId === stageId);
    const destination = mapped ? to.stages.find((s) => s.id === mapped.toStatusId) : undefined;
    if (!destination) {
      const stage = from.stages.find((s) => s.id === stageId);
      return fail(`A Etapa “${stage?.name ?? stageId}” precisa de uma Etapa de destino.`, "mapeamento");
    }
  }

  for (const deal of affected) {
    const mapped = stageMapping.find((entry) => entry.fromStatusId === deal.stageId);
    const destination = to.stages.find((s) => s.id === mapped?.toStatusId);
    if (!destination) continue;
    const previousFunnel = from.name;
    const previousStage = from.stages.find((s) => s.id === deal.stageId);

    deal.funnelId = to.id;
    deal.stageId = destination.id;
    deal.enteredStageAt = now();
    // RN-FUN-08 / DO-NEG-05 — o remapeamento preserva a probabilidade ajustada
    // à mão; ela só é descartada numa progressão.
    deal.stageHistory.push({
      id: nextId("stt"),
      at: now(),
      ...(previousStage ? { fromStageId: previousStage.id, fromStageName: previousStage.name, fromStageOrder: previousStage.order } : {}),
      toStageId: destination.id,
      toStageName: destination.name,
      toStageOrder: destination.order,
      fromFunnelId: from.id,
      toFunnelId: to.id,
      entryOrigin: "mudancaDeFunil",
      actor: memberActor(actingMemberId),
    });

    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Negócio migrado de Funil",
      objectType: "deal",
      objectId: deal.id,
      objectName: deal.title,
      before: `${previousFunnel} · ${previousStage?.name ?? "—"}`,
      after: `${to.name} · ${destination.name}`,
    });
  }

  return ok(affected.length);
}

/**
 * B43 — o Negócio volta ao Funil e à Etapa que ocupava. Se a Etapa foi removida
 * enquanto ele estava na lixeira, ele volta para a primeira Etapa do Funil e o
 * Registro diz de onde veio: um Negócio sem Etapa não existe (INV-NEG-03).
 */
export function restoreDeal(state: DataState, actingMemberId: Id, dealId: Id): OperationResult<Deal> {
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return fail("Negócio não encontrado.");
  if (deal.lifecycle !== "naLixeira") return ok(deal);

  const funnel = state.funnels.find((f) => f.id === deal.funnelId);
  if (!funnel || funnel.lifecycle === "naLixeira") {
    return fail("O Funil deste Negócio está na lixeira. Restaure o Funil antes.");
  }

  const stage = funnel.stages.find((s) => s.id === deal.stageId);
  if (!stage) {
    const first = [...funnel.stages].sort((a, b) => a.order - b.order)[0];
    if (!first) return fail("Este Funil não tem nenhuma Etapa para receber o Negócio.");
    const lostStageId = deal.stageId;
    deal.stageId = first.id;
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Etapa remapeada",
      objectType: "deal",
      objectId: deal.id,
      objectName: deal.title,
      before: lostStageId,
      after: first.name,
      detail: "A Etapa que ele ocupava foi removida enquanto estava na lixeira.",
    });
  }

  deal.lifecycle = deal.lifecycleBeforeTrash ?? "ativo";
  delete deal.lifecycleBeforeTrash;
  delete deal.trashedAt;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Negócio restaurado",
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
    after: deal.lifecycle,
  });
  return ok(deal);
}

/**
 * DO-FUN-11 — mover UM Negócio para outro Funil, com Etapa de destino
 * explícita. É a entrega do SDR ao Closer.
 *
 * Difere de `migrateDealsToFunnel`, que é migração em massa de um Funil que
 * está sendo desativado: aqui a passagem é do processo, acontece um Negócio por
 * vez e troca o Proprietário no mesmo ato — A7, o Negócio tem exatamente um.
 *
 * O Negócio mantém identidade, histórico e Vínculos. Só mudam Funil, Etapa e
 * Proprietário, e o Registro de transição guarda de onde ele veio.
 */
export function moveDealToFunnel(
  state: DataState,
  actingMemberId: Id,
  dealId: Id,
  toFunnelId: Id,
  toStageId: Id,
  newOwnerMemberId?: Id,
): OperationResult<Deal> {
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return fail("Negócio não encontrado.");
  if (deal.lifecycle !== "ativo") return fail("Este Negócio não está ativo.");
  if (deal.situation !== "aberto") {
    return fail("Um Negócio ganho ou perdido preserva o seu Funil. Reabra-o para movê-lo.");
  }

  const to = state.funnels.find((f) => f.id === toFunnelId);
  if (!to) return fail("Funil de destino não encontrado.", "destino");
  if (to.id === deal.funnelId) return fail("O Negócio já está neste Funil.", "destino");
  if (to.lifecycle !== "ativo") return fail("O Funil de destino precisa estar ativo.", "destino");

  const destination = to.stages.find((s) => s.id === toStageId);
  if (!destination) return fail("A Etapa de destino não pertence a este Funil.", "etapa");

  const from = state.funnels.find((f) => f.id === deal.funnelId);
  const previousStage = from?.stages.find((s) => s.id === deal.stageId);

  // O Requisito de ENTRADA da Etapa de destino vale aqui como vale em qualquer
  // entrada: entregar ao Closer um Negócio que não satisfaz a Etapa dele é
  // entregar o problema junto.
  const entry = unmetRequirement(state, deal, destination, "entrada");
  if (entry) return fail(`Não é possível entrar em “${destination.name}”: ${entry}.`);

  let owner: Member | undefined;
  if (newOwnerMemberId !== undefined) {
    owner = state.members.find((m) => m.id === newOwnerMemberId);
    if (!owner) return fail("Novo Proprietário não encontrado.", "proprietario");
    if (owner.state !== "ativo") return fail("O Proprietário precisa ser um Membro ativo.", "proprietario");
    const base = state.roles.find((r) => r.id === owner?.roleId)?.base;
    // RN-PAI-05 / B28 — um Convidado não é Proprietário de registro.
    if (base === "convidado") {
      return fail("Um Membro de base Convidado não pode ser Proprietário de um Negócio.", "proprietario");
    }
  }

  const previousOwner = state.members.find((m) => m.id === deal.ownerMemberId);

  deal.funnelId = to.id;
  deal.stageId = destination.id;
  deal.enteredStageAt = now();
  // DO-NEG-05 — a probabilidade ajustada à mão não sobrevive a uma mudança de
  // processo: ela foi estimada contra outra Etapa, de outro Funil.
  delete deal.overriddenProbability;
  if (owner) deal.ownerMemberId = owner.id;

  deal.stageHistory.push({
    id: nextId("stt"),
    at: now(),
    ...(previousStage
      ? { fromStageId: previousStage.id, fromStageName: previousStage.name, fromStageOrder: previousStage.order }
      : {}),
    toStageId: destination.id,
    toStageName: destination.name,
    toStageOrder: destination.order,
    ...(from ? { fromFunnelId: from.id } : {}),
    toFunnelId: to.id,
    entryOrigin: "mudancaDeFunil",
    actor: memberActor(actingMemberId),
  });

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Negócio mudou de Funil",
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
    before: `${from?.name ?? "—"} · ${previousStage?.name ?? "—"}`,
    after: `${to.name} · ${destination.name}`,
    ...(owner && owner.id !== previousOwner?.id
      ? { detail: `Proprietário: ${previousOwner?.displayName ?? "—"} → ${owner.displayName}` }
      : {}),
  });
  return ok(deal);
}

/**
 * O Negócio nasce na primeira Etapa do Funil, e os Requisitos de ENTRADA dessa
 * Etapa valem na criação como valem em qualquer movimento (B59): um Funil cuja
 * primeira Etapa exige Contato não pode ganhar um Negócio sem Contato só porque
 * ele acabou de ser criado.
 */
export function createDeal(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly title: string;
    readonly funnelId: Id;
    readonly companyId?: Id;
    readonly contactId?: Id;
    readonly value?: Money;
    readonly originId?: Id;
    readonly ownerMemberId?: Id;
  },
): OperationResult<Deal> {
  const refusal = mayWriteDeal(state, actingMemberId);
  if (refusal) return fail(refusal);

  const title = input.title.trim();
  if (!title) return fail("Dê um título ao Negócio.", "titulo");

  const funnel = state.funnels.find((f) => f.id === input.funnelId && f.lifecycle === "ativo");
  if (!funnel) return fail("Escolha um Funil ativo.", "funil");
  const stage = [...funnel.stages].sort((a, b) => a.order - b.order)[0];
  if (!stage) return fail("Este Funil não tem Etapa: não há onde o Negócio nascer.", "funil");

  if (input.companyId && !state.companies.some((c) => c.id === input.companyId && c.lifecycle === "ativo")) {
    return fail("A Empresa escolhida não está ativa.", "empresa");
  }
  if (input.contactId && !state.contacts.some((c) => c.id === input.contactId && c.lifecycle === "ativo")) {
    return fail("O Contato escolhido não está ativo.", "contato");
  }

  // Dinheiro não positivo é o mesmo que dinheiro ausente, e o resto do produto
  // já trata assim (o Requisito `valorObrigatorio` recusa `<= 0`). Gravar aqui
  // um negativo faria o Painel somar para baixo sem ninguém ter pedido.
  if (input.value && !(Number.isFinite(input.value.amount) && input.value.amount > 0)) {
    return fail("O valor do Negócio precisa ser um número maior que zero.", "valor");
  }

  const owner = input.ownerMemberId ?? actingMemberId;
  if (!state.members.some((m) => m.id === owner && m.state === "ativo")) {
    return fail("O Responsável precisa ser um Membro ativo.", "responsavel");
  }

  const deal: Deal = {
    id: nextId("deal"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    title,
    object: "",
    description: "",
    ...(input.companyId ? { companyId: input.companyId } : {}),
    ownerMemberId: owner,
    funnelId: funnel.id,
    stageId: stage.id,
    ...(input.value ? { value: input.value } : {}),
    situation: "aberto",
    ...(input.originId ? { originId: input.originId } : {}),
    enteredStageAt: now(),
    contactLinks: input.contactId
      ? [
          {
            id: nextId("dcl"),
            contactId: input.contactId,
            role: "decisor",
            principal: true,
            createdBy: memberActor(actingMemberId),
            createdAt: now(),
          },
        ]
      : [],
    tagIds: [],
    fieldValues: [],
    attachments: [],
    comments: [],
    stageHistory: [],
  };

  const unmet = unmetRequirement(state, deal, stage, "entrada");
  if (unmet) {
    return fail(`A Etapa ${stage.name} ${unmet}: o Negócio não pode nascer nela sem isso.`);
  }

  state.deals.push(deal);
  pushTransition(state, deal, actingMemberId, undefined, stage, "criacao");

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Negócio criado",
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
  });
  return ok(deal);
}

/**
 * Desfazer o Vínculo com o Contato. Vincular sem poder desvincular transforma
 * um clique errado em dado permanente — e o Vínculo com o Negócio, ao contrário
 * do Vínculo com a Empresa, não tem período: não há o que preservar encerrando.
 *
 * Quando o removido era o principal, o próximo assume: um Negócio com Contatos
 * e nenhum principal não diz com quem se fala.
 */
export function unlinkContactFromDeal(
  state: DataState,
  actingMemberId: Id,
  dealId: Id,
  linkId: Id,
): OperationResult<Deal> {
  const refusal = mayWriteDeal(state, actingMemberId);
  if (refusal) return fail(refusal);
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return fail("Negócio não encontrado.");
  if (deal.lifecycle !== "ativo") {
    return fail("Um Negócio na lixeira ou arquivado é somente leitura.");
  }
  if (deal.situation !== "aberto") {
    return fail("Este Negócio está encerrado: reabra antes de mexer nos Contatos.");
  }

  const link = deal.contactLinks.find((l) => l.id === linkId);
  if (!link) return fail("Vínculo não encontrado.");

  const stage = funnelOf(state, deal)?.stages.find((s) => s.id === deal.stageId);
  const ultimo = deal.contactLinks.length === 1;
  const exigeContato = stage?.requirements.some(
    (r) => r.kind === "contatoObrigatorio" && r.moment === "entrada",
  );
  if (ultimo && exigeContato) {
    return fail(
      `A Etapa ${stage?.name} exige ao menos um Contato: vincule outro antes de remover este.`,
    );
  }

  deal.contactLinks = deal.contactLinks.filter((l) => l.id !== linkId);
  const primeiro = deal.contactLinks[0];
  if (link.principal && primeiro) primeiro.principal = true;

  const contact = state.contacts.find((c) => c.id === link.contactId);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato desvinculado do Negócio",
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
    before: contact ? `${contact.firstName} ${contact.lastName}`.trim() : link.contactId,
  });
  return ok(deal);
}

/**
 * Grava um Valor de Campo do Negócio.
 *
 * A5.1 — o Valor mora no agregado, mas quem manda é a Definição: o tipo, as
 * opções e o alvo são dela. Aceitar aqui um texto livre num campo de seleção
 * única seria deixar a tela inventar opção que o Espaço de Trabalho não tem.
 *
 * B37 — um Valor `arquivado` é preservado e NÃO é editável: escrever por cima
 * apagaria o histórico que o arquivamento existe para guardar.
 */
export function setDealFieldValue(
  state: DataState,
  actingMemberId: Id,
  dealId: Id,
  definitionId: Id,
  value: FieldValue["value"],
): OperationResult<Deal> {
  const refusal = mayWriteDeal(state, actingMemberId);
  if (refusal) return fail(refusal);

  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return fail("Negócio não encontrado.");
  if (deal.lifecycle !== "ativo") return fail("Um Negócio na lixeira ou arquivado é somente leitura.");
  if (deal.situation !== "aberto") {
    return fail("Este Negócio está encerrado: reabra antes de alterar os Campos.");
  }

  const definition = state.fieldDefinitions.find((d) => d.id === definitionId);
  if (!definition) return fail("Campo não encontrado.");
  if (definition.target !== "deal") return fail("Este Campo não é de Negócio.");
  if (definition.lifecycle !== "ativo") return fail("Este Campo está arquivado.");

  const vazio = value === null || value === "";
  if (definition.required && vazio) return fail(`${definition.name} é obrigatório.`, definitionId);
  if (
    !vazio &&
    definition.type === "singleSelect" &&
    !(definition.options ?? []).includes(String(value))
  ) {
    return fail(`“${String(value)}” não é uma opção de ${definition.name}.`, definitionId);
  }

  const existente = deal.fieldValues.find((v) => v.definitionId === definitionId);
  if (existente?.state === "arquivado") {
    return fail("Este Valor está arquivado: ele é preservado, não editado.");
  }

  const antes = existente?.value;
  if (existente) existente.value = value;
  else deal.fieldValues.push({ definitionId, value, state: "ativo" });

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: `${definition.name} alterado`,
    objectType: "deal",
    objectId: deal.id,
    objectName: deal.title,
    ...(antes !== undefined && antes !== null ? { before: String(antes) } : {}),
    ...(vazio ? {} : { after: String(value) }),
  });
  return ok(deal);
}
