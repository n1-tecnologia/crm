/**
 * Member governance: removal as succession.
 * Ontology: documento 01, A6.4, B26, B27, B28, B38, B87, RN-ET-*.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Id, Member, PermissionAction, Role } from "../types";
import { memberActor, nextId, recordActivity, systemActor } from "./activity";

const now = (): string => new Date().toISOString();

/** What the removal will transfer and what it will release — shown before the act. */
export interface SuccessionPreview {
  readonly transfers: ReadonlyArray<{ readonly type: string; readonly id: Id; readonly name: string }>;
  readonly releases: ReadonlyArray<{ readonly type: string; readonly id: Id; readonly name: string }>;
  readonly pendingApprovals: number;
  readonly privateContainerGrants: number;
  readonly chatSessions: number;
}

/** B28 — the dialog anticipates the succession; nothing happens silently. */
export function previewSuccession(state: DataState, memberId: Id): SuccessionPreview {
  const transfers: Array<{ type: string; id: Id; name: string }> = [];
  const releases: Array<{ type: string; id: Id; name: string }> = [];

  for (const contact of state.contacts) {
    if (contact.ownerMemberId === memberId) {
      transfers.push({ type: "contact", id: contact.id, name: `${contact.firstName} ${contact.lastName}`.trim() });
    }
  }
  for (const company of state.companies) {
    if (company.ownerMemberId === memberId) {
      transfers.push({ type: "company", id: company.id, name: company.tradeName || company.legalName });
    }
  }
  for (const deal of state.deals) {
    if (deal.ownerMemberId === memberId) transfers.push({ type: "deal", id: deal.id, name: deal.title });
  }
  for (const agent of state.agents) {
    if (agent.ownerMemberId === memberId) transfers.push({ type: "agent", id: agent.id, name: agent.name });
  }
  for (const automation of state.automations) {
    if (automation.ownerMemberId === memberId) {
      transfers.push({ type: "automation", id: automation.id, name: automation.name });
    }
  }
  for (const panel of state.panels) {
    if (panel.ownerMemberId === memberId) transfers.push({ type: "panel", id: panel.id, name: panel.name });
  }
  for (const collection of state.collections) {
    if (collection.ownerMemberId === memberId) {
      transfers.push({ type: "collection", id: collection.id, name: collection.name });
    }
  }

  for (const task of state.tasks) {
    if (task.assignees.some((a) => a.kind === "member" && a.id === memberId)) {
      releases.push({ type: "task", id: task.id, name: task.title });
    }
    for (const checklist of task.checklists) {
      for (const item of checklist.items) {
        if (item.assigneeMemberId === memberId) {
          releases.push({ type: "checklistItem", id: item.id, name: item.text });
        }
      }
    }
  }
  for (const conversation of state.conversations) {
    if (conversation.assignee?.kind === "member" && conversation.assignee.id === memberId) {
      releases.push({ type: "conversation", id: conversation.id, name: conversation.title });
    }
  }

  const pendingApprovals = state.approvals.filter(
    (a) => a.approverMemberId === memberId && a.decision === undefined,
  ).length;

  // B38(d) — a private container that would be left without any `ativo` member
  // holding `administrar` passes the grant to the successor.
  const privateContainerGrants = state.grants.filter(
    (g) =>
      g.subjectKind === "member" &&
      g.subjectId === memberId &&
      g.action === "administrar" &&
      isPrivateContainer(state, g.resourceType, g.resourceId),
  ).length;

  const chatSessions = state.chatSessions.filter((s) => s.ownerMemberId === memberId).length;

  return { transfers, releases, pendingApprovals, privateContainerGrants, chatSessions };
}

function isPrivateContainer(state: DataState, resourceType: string, resourceId: Id): boolean {
  if (resourceType === "space") return state.spaces.find((s) => s.id === resourceId)?.isPrivate ?? false;
  if (resourceType === "folder") return state.folders.find((f) => f.id === resourceId)?.isPrivate ?? false;
  if (resourceType === "list") return state.lists.find((l) => l.id === resourceId)?.isPrivate ?? false;
  return false;
}

/**
 * B28 / RN-ET-09 — removing a Member is a SUCCESSION in the same act:
 * (a) every record it owns passes to the successor;
 * (b) tasks, checklist items and conversations it executes are released;
 * (c) pending approvals pass to the successor;
 * (d) authorship and activity records stay with the `removido` member (A6.4);
 * (e) chat sessions and user memory are NOT succeeded — they go to the trash
 *     and are eliminated at the end of the trash policy (B87);
 * (f) direct grants are revoked, EXCEPT `administrar` over a private container
 *     that would be left without any active member holding it (B38d).
 *
 * RN-ET-05 — the workspace owner cannot be removed without transferring first.
 */
export function removeMember(
  state: DataState,
  actingMemberId: Id,
  memberId: Id,
  successorId: Id,
): OperationResult<Member> {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return fail("Membro não encontrado.");
  if (member.state === "removido") return ok(member);
  if (state.workspace.ownerMemberId === memberId) {
    return fail("Transfira a propriedade antes de remover este Membro.");
  }

  const successor = state.members.find((m) => m.id === successorId);
  if (!successor || successor.state !== "ativo") {
    return fail("O Sucessor precisa ser um Membro ativo.", "sucessor");
  }
  const successorRole = state.roles.find((r) => r.id === successor.roleId);
  if (successorRole?.base === "convidado") {
    return fail("O Sucessor não pode ter Papel de base Convidado.", "sucessor");
  }

  const preview = previewSuccession(state, memberId);

  // (a) ownership passes to the successor.
  for (const contact of state.contacts) if (contact.ownerMemberId === memberId) contact.ownerMemberId = successorId;
  for (const company of state.companies) if (company.ownerMemberId === memberId) company.ownerMemberId = successorId;
  for (const deal of state.deals) if (deal.ownerMemberId === memberId) deal.ownerMemberId = successorId;
  for (const agent of state.agents) if (agent.ownerMemberId === memberId) agent.ownerMemberId = successorId;
  for (const panel of state.panels) if (panel.ownerMemberId === memberId) panel.ownerMemberId = successorId;
  for (const collection of state.collections) {
    if (collection.ownerMemberId === memberId) collection.ownerMemberId = successorId;
  }
  // DO-AUT-14 — the automation passes to the successor and STAYS `ativo` under
  // the new ceiling, with a notification.
  for (const automation of state.automations) {
    if (automation.ownerMemberId !== memberId) continue;
    automation.ownerMemberId = successorId;
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Proprietário da Automação alterado por sucessão",
      objectType: "automation",
      objectId: automation.id,
      objectName: automation.name,
      after: successor.displayName,
      detail: "Verifique se as Ações continuam dentro do teto de permissões do novo Proprietário.",
    });
  }

  // (b) execution responsibilities are released.
  for (const task of state.tasks) {
    const before = task.assignees.length;
    task.assignees = task.assignees.filter((a) => !(a.kind === "member" && a.id === memberId));
    if (task.assignees.length !== before) {
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Responsável removido",
        objectType: "task",
        objectId: task.id,
        objectName: task.title,
      });
    }
    task.observerMemberIds = task.observerMemberIds.filter((id) => id !== memberId);
    for (const checklist of task.checklists) {
      for (const item of checklist.items) {
        if (item.assigneeMemberId === memberId) delete item.assigneeMemberId;
      }
    }
  }
  for (const conversation of state.conversations) {
    if (conversation.assignee?.kind === "member" && conversation.assignee.id === memberId) {
      delete conversation.assignee;
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Conversa liberada",
        objectType: "conversation",
        objectId: conversation.id,
        objectName: conversation.title,
      });
    }
  }
  // RN-CXE-24 — removed from the eligible list of every queue.
  for (const queue of state.queues) {
    queue.eligibleMemberIds = queue.eligibleMemberIds.filter((id) => id !== memberId);
  }
  // RN-ET-12 — removal takes the member out of every team.
  for (const team of state.teams) {
    team.memberIds = team.memberIds.filter((id) => id !== memberId);
  }

  // (c) pending approvals pass to the successor.
  for (const approval of state.approvals) {
    if (approval.approverMemberId === memberId && approval.decision === undefined) {
      approval.approverMemberId = successorId;
    }
  }

  // (f) direct grants are revoked, except the private-container exception.
  state.grants = state.grants.filter((grant) => {
    if (grant.subjectKind !== "member" || grant.subjectId !== memberId) return true;
    const isProtected =
      grant.action === "administrar" && isPrivateContainer(state, grant.resourceType, grant.resourceId);
    if (isProtected) {
      state.grants.push({ ...grant, subjectId: successorId, grantedAt: now() });
    }
    return false;
  });

  // (e) chat sessions and user memory go to the trash; never succeeded (B87).
  for (const session of state.chatSessions) {
    if (session.ownerMemberId !== memberId) continue;
    session.lifecycleBeforeTrash = session.lifecycle === "arquivado" ? "arquivado" : "ativo";
    session.lifecycle = "naLixeira";
    session.trashedAt = now();
    recordActivity(state, {
      actor: systemActor,
      action: "Sessão de Chat enviada à lixeira",
      objectType: "chatSession",
      objectId: session.id,
      objectName: session.title,
      detail: "Sessões e Memória do Usuário não são sucedidas (B87).",
    });
  }
  member.userMemory.enabled = false;

  member.state = "removido";
  member.removedAt = now();
  member.successorId = successorId;

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Membro removido",
    objectType: "member",
    objectId: member.id,
    objectName: member.displayName,
    after: successor.displayName,
    detail: `${preview.transfers.length} registro(s) transferido(s); ${preview.releases.length} responsabilidade(s) liberada(s).`,
  });
  return ok(member);
}

/** B26 — a single atomic act; no administrator transfers or self-promotes. */
export function transferWorkspaceOwnership(
  state: DataState,
  actingMemberId: Id,
  toMemberId: Id,
  previousOwnerRoleId?: Id,
): OperationResult<void> {
  if (state.workspace.ownerMemberId !== actingMemberId) {
    return fail("Só o Proprietário do Espaço de Trabalho transfere a propriedade.");
  }
  const target = state.members.find((m) => m.id === toMemberId);
  if (!target || target.state !== "ativo") return fail("O destinatário precisa ser um Membro ativo.");

  const ownerRole = state.roles.find((r) => r.base === "proprietario" && r.system);
  const adminRole = state.roles.find((r) => r.base === "administrador" && r.system);
  if (!ownerRole || !adminRole) return fail("Papéis de sistema não encontrados.");

  const previous = state.members.find((m) => m.id === actingMemberId);
  if (previous) previous.roleId = previousOwnerRoleId ?? adminRole.id;
  target.roleId = ownerRole.id;
  state.workspace.ownerMemberId = toMemberId;

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Propriedade do Espaço de Trabalho transferida",
    objectType: "workspace",
    objectId: state.workspace.id,
    objectName: state.workspace.name,
    before: previous?.displayName,
    after: target.displayName,
  });
  return ok(undefined);
}

/**
 * RN-ET-24 — inviting is governance: it comes only from the Proprietário or
 * Administrador role (or a custom role with Administrador as base), never from
 * a direct grant.
 *
 * RN-ET-11 — there is at most one Member per (Usuário, Espaço de Trabalho), so
 * re-inviting a `removido` Member REACTIVATES the same record. Teams, grants
 * and transferred properties do NOT come back (B27).
 *
 * RN-ET-23 — a `pendente` Member counts towards the workspace member limit.
 */
export function inviteMember(
  state: DataState,
  actingMemberId: Id,
  input: { readonly email: string; readonly roleId: Id },
): OperationResult<Member> {
  const acting = state.members.find((m) => m.id === actingMemberId);
  const actingRole = state.roles.find((r) => r.id === acting?.roleId);
  if (actingRole?.base !== "administrador" && actingRole?.base !== "proprietario") {
    return fail("Só um Administrador ou o Proprietário convida um Membro.");
  }

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("Informe um e-mail válido para o convite.", "email");
  }

  const role = state.roles.find((r) => r.id === input.roleId);
  if (!role) return fail("Escolha um Papel para o convite.", "papel");
  // RN-ET-06 — o Papel Proprietário tem exatamente um titular, e a única via de
  // promoção é `transferWorkspaceOwnership`. Esconder a opção na tela não é
  // garantia: a regra vive aqui.
  if (role.base === "proprietario") {
    return fail(
      "O Papel de Proprietário não se concede por convite: ele muda por transferência de propriedade.",
      "papel",
    );
  }

  const existing = state.members.find(
    (member) => member.invitedIdentity?.value.toLowerCase() === email,
  );
  if (existing && existing.state !== "removido") {
    return fail(
      existing.state === "pendente"
        ? "Já existe um convite pendente para este e-mail."
        : "Este e-mail já pertence a um Membro deste Espaço de Trabalho.",
      "email",
    );
  }

  // RN-ET-23 — Membros `pendente` contam para o limite, e reconvidar um
  // `removido` o traz de volta para a contagem: verificar só na criação deixava
  // o reconvite estourar o teto.
  const counted = state.members.filter((member) => member.state !== "removido").length;
  if (counted >= state.workspace.limits.members) {
    return fail(
      `O limite de ${state.workspace.limits.members} Membros do Espaço de Trabalho foi atingido.`,
    );
  }

  // RN-ET-11 — a re-invitation reactivates the same Member.
  if (existing) {
    existing.state = "pendente";
    existing.roleId = input.roleId;
    existing.invitedBy = actingMemberId;
    delete existing.removedAt;
    delete existing.successorId;
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Membro reconvidado",
      objectType: "member",
      objectId: existing.id,
      objectName: existing.displayName,
      before: "removido",
      after: "pendente",
    });
    return ok(existing);
  }

  const member: Member = {
    id: nextId("mem"),
    workspaceId: state.workspace.id,
    invitedIdentity: { type: "email", value: email },
    displayName: email,
    state: "pendente",
    roleId: input.roleId,
    invitedBy: actingMemberId,
    availability: { value: "indisponivel", at: now(), origin: "membro" },
    userMemory: { enabled: true, items: [] },
  };
  state.members.push(member);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Membro convidado",
    objectType: "member",
    objectId: member.id,
    objectName: member.displayName,
    after: role.name,
  });
  return ok(member);
}

/** Who currently holds a Role — Members and Agents are counted apart. */
export interface RoleHolders {
  readonly members: ReadonlyArray<{ readonly id: Id; readonly name: string }>;
  readonly agents: ReadonlyArray<{ readonly id: Id; readonly name: string }>;
  readonly automations: ReadonlyArray<{ readonly id: Id; readonly name: string }>;
}

export function roleHolders(state: DataState, roleId: Id): RoleHolders {
  return {
    members: state.members
      .filter((member) => member.roleId === roleId && member.state !== "removido")
      .map((member) => ({ id: member.id, name: member.displayName })),
    agents: state.agents
      .filter((agent) => agent.roleId === roleId)
      .map((agent) => ({ id: agent.id, name: agent.name })),
    automations: state.automations
      .filter((automation) => automation.roleId === roleId)
      .map((automation) => ({ id: automation.id, name: automation.name })),
  };
}

/**
 * RN-ET-06 — um Papel de sistema nunca é excluído.
 *
 * Documento 01, 18 — a remoção EXIGE o Papel de destino dos titulares, e é
 * aplicada no mesmo ato: um Papel excluído sem destino deixaria Membros e
 * Agentes apontando para nada, que é pior do que não excluir.
 *
 * INV-ET-13 — o destino de um Agente nunca é Proprietário nem Administrador,
 * nem Papel personalizado com base num deles.
 */
export function deleteRole(
  state: DataState,
  actingMemberId: Id,
  roleId: Id,
  destination: { readonly memberRoleId?: Id; readonly agentRoleId?: Id },
): OperationResult<void> {
  const acting = state.members.find((m) => m.id === actingMemberId);
  const actingRole = state.roles.find((r) => r.id === acting?.roleId);
  if (actingRole?.base !== "administrador" && actingRole?.base !== "proprietario") {
    return fail("Só um Administrador ou o Proprietário exclui um Papel.");
  }

  const role = state.roles.find((r) => r.id === roleId);
  if (!role) return fail("Papel não encontrado.");
  if (role.system) return fail("Um Papel de sistema não pode ser excluído.");

  const holders = roleHolders(state, roleId);
  const nonHuman = [...holders.agents, ...holders.automations];

  let memberDestination: Role | undefined;
  if (holders.members.length > 0) {
    memberDestination = state.roles.find((r) => r.id === destination.memberRoleId);
    if (!memberDestination || memberDestination.id === roleId) {
      return fail(
        `${holders.members.length} Membro(s) têm este Papel e precisam de um Papel de destino.`,
        "destinoMembro",
      );
    }
    // RN-ET-06 — exatamente um titular do Papel Proprietário. Dar Proprietário
    // em lote produziria dois, com o Espaço de Trabalho ainda apontando para o
    // primeiro; a promoção passa por `transferWorkspaceOwnership`.
    if (memberDestination.base === "proprietario") {
      return fail(
        "O Papel de Proprietário tem exatamente um titular: ele muda por transferência de propriedade, não por exclusão de Papel.",
        "destinoMembro",
      );
    }
    // C32, alternativa (b) — quem passa a ter base Convidado não pode ser
    // Proprietário de nada, e a transferência tem de acontecer no mesmo ato.
    if (memberDestination.base === "convidado") {
      const owning = holders.members.filter(
        (holder) => previewSuccession(state, holder.id).transfers.length > 0,
      );
      if (owning.length > 0) {
        return fail(
          `${owning.length} titular(es) são Proprietários de registros e não podem passar a um Papel de base Convidado sem transferir antes.`,
          "destinoMembro",
        );
      }
    }
  }

  let agentDestination: Role | undefined;
  if (nonHuman.length > 0) {
    agentDestination = state.roles.find((r) => r.id === destination.agentRoleId);
    if (!agentDestination || agentDestination.id === roleId) {
      return fail(
        `${nonHuman.length} Agente(s) ou Automação(ões) têm este Papel e precisam de um Papel de destino.`,
        "destinoAgente",
      );
    }
    if (agentDestination.base === "proprietario" || agentDestination.base === "administrador") {
      return fail(
        "Um Agente nunca é titular de Proprietário nem de Administrador, nem de Papel com base neles.",
        "destinoAgente",
      );
    }
  }

  // Nothing is written until every holder has a valid destination.
  if (memberDestination) {
    for (const member of state.members) {
      if (member.roleId !== roleId) continue;
      // A6.4 — o Membro removido não some, e o Papel some: sem reatribuir, a
      // ficha histórica passaria a exibir "Papel não encontrado".
      if (member.state === "removido") {
        member.roleId = memberDestination.id;
        continue;
      }
      member.roleId = memberDestination.id;
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Papel do Membro alterado por exclusão de Papel",
        objectType: "member",
        objectId: member.id,
        objectName: member.displayName,
        before: role.name,
        after: memberDestination.name,
      });
    }
  }
  if (agentDestination) {
    for (const agent of state.agents) {
      if (agent.roleId !== roleId) continue;
      agent.roleId = agentDestination.id;
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Papel do Agente alterado por exclusão de Papel",
        objectType: "agent",
        objectId: agent.id,
        objectName: agent.name,
        before: role.name,
        after: agentDestination.name,
      });
    }
    for (const automation of state.automations) {
      if (automation.roleId !== roleId) continue;
      automation.roleId = agentDestination.id;
      // A6.2 — Registro por titular; a Automação é titular como os demais.
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Papel da Automação alterado por exclusão de Papel",
        objectType: "automation",
        objectId: automation.id,
        objectName: automation.name,
        before: role.name,
        after: agentDestination.name,
      });
    }
  }

  const index = state.roles.findIndex((r) => r.id === roleId);
  if (index >= 0) state.roles.splice(index, 1);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Papel personalizado excluído",
    objectType: "role",
    objectId: role.id,
    objectName: role.name,
    detail: `${holders.members.length} Membro(s) e ${nonHuman.length} Agente(s)/Automação(ões) receberam novo Papel`,
  });
  return ok(undefined);
}

/**
 * B38b — o ato de governança: a ÚNICA via de entrada num Recurso privado sem
 * concessão prévia.
 *
 * B38a esconde o contêiner privado inclusive do Proprietário do Espaço de
 * Trabalho e dos Administradores. Sem esta via, um contêiner privado cujo único
 * administrador saiu ficaria inacessível para sempre.
 *
 * O que a torna aceitável é ela nunca ser silenciosa: exige motivo, gera
 * Registro de Atividade com esse motivo, e o registro é visível a quem tem
 * acesso ao Recurso — inclusive a quem foi "invadido".
 *
 * DO-CHT-09 — não se aplica a Sessão de Chat: nenhum Papel dá `ver` sobre a
 * Sessão de outro Membro, e o ato de governança não abre exceção.
 */
export function grantGovernanceAccess(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly subjectKind: "member" | "team";
    readonly subjectId: Id;
    readonly resourceType: string;
    readonly resourceId: Id;
    readonly actions: readonly PermissionAction[];
    readonly reason: string;
  },
): OperationResult<number> {
  const acting = state.members.find((m) => m.id === actingMemberId);
  const actingRole = state.roles.find((r) => r.id === acting?.roleId);
  if (actingRole?.base !== "administrador" && actingRole?.base !== "proprietario") {
    return fail("Só um Administrador ou o Proprietário executa um ato de governança.");
  }
  if (input.resourceType === "chatSession") {
    return fail(
      "Uma Sessão de Chat é pessoal: nenhum Papel dá acesso à Sessão de outro Membro, nem por ato de governança.",
    );
  }
  if (!input.reason.trim()) {
    return fail("O motivo é obrigatório: um ato de governança nunca é silencioso.", "motivo");
  }
  if (input.actions.length === 0) {
    return fail("Escolha ao menos uma Ação a conceder.", "acoes");
  }

  const subjectName =
    input.subjectKind === "member"
      ? (state.members.find((m) => m.id === input.subjectId)?.displayName ?? "Membro")
      : (state.teams.find((t) => t.id === input.subjectId)?.name ?? "Equipe");

  let created = 0;
  for (const action of input.actions) {
    const already = state.grants.some(
      (grant) =>
        grant.subjectKind === input.subjectKind &&
        grant.subjectId === input.subjectId &&
        grant.resourceType === input.resourceType &&
        grant.resourceId === input.resourceId &&
        grant.action === action,
    );
    if (already) continue;
    state.grants.push({
      id: nextId("grn"),
      workspaceId: state.workspace.id,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: actingMemberId,
      grantedAt: now(),
    });
    created += 1;
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Ato de governança: acesso concedido a Recurso privado",
    objectType: input.resourceType,
    objectId: input.resourceId,
    objectName: resourceName(state, input.resourceType, input.resourceId),
    after: `${subjectName} · ${input.actions.join(", ")}`,
    detail: input.reason.trim(),
  });
  return ok(created);
}

/** The name is recorded at the time, so the record survives the resource. */
function resourceName(state: DataState, resourceType: string, resourceId: Id): string {
  const lookup: Record<string, () => string | undefined> = {
    space: () => state.spaces.find((s) => s.id === resourceId)?.name,
    folder: () => state.folders.find((f) => f.id === resourceId)?.name,
    list: () => state.lists.find((l) => l.id === resourceId)?.name,
    funnel: () => state.funnels.find((f) => f.id === resourceId)?.name,
    collection: () => state.collections.find((c) => c.id === resourceId)?.name,
  };
  return lookup[resourceType]?.() ?? resourceId;
}
