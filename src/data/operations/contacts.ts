/**
 * Contact and Company operations.
 * Ontology: documentos 10 and 11, B8, B13, B14, RN-CON-*, RN-EMP-*.
 */

import { contactDisplayName } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type {
  Address,
  Company,
  CompanyIdentifier,
  ContactCompanyLink,
  ConsentRecord,
  Contact,
  ContactIdentifierType,
  Conversation,
  FieldValue,
  Id,
} from "../types";
import { memberActor, nextId, recordActivity } from "./activity";

const now = (): string => new Date().toISOString();

/** Canonical form: the uniqueness key is (type, canonical value) — B13. */
export function canonicalIdentifier(type: ContactIdentifierType, value: string): string {
  const trimmed = value.trim();
  if (type === "email") return trimmed.toLowerCase();
  if (type === "telefone" || type === "identidadeDeWhatsApp") return trimmed.replace(/\D/g, "");
  return trimmed;
}

/**
 * RN-CON-11 — creating or editing an identifier whose (type, value) already
 * belongs to another non-merged Contact — INCLUDING archived and trashed ones —
 * is REJECTED, naming the holder. The way out is to merge or to transfer.
 */
export function addContactIdentifier(
  state: DataState,
  actingMemberId: Id,
  contactId: Id,
  type: ContactIdentifierType,
  value: string,
): OperationResult<Contact> {
  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return fail("Contato não encontrado.");
  const canonical = canonicalIdentifier(type, value);
  if (!canonical) return fail("Informe o valor do Identificador.", "valor");

  const holder = state.contacts.find(
    (c) =>
      c.lifecycle !== "mesclado" &&
      c.id !== contactId &&
      c.identifiers.some((i) => i.type === type && i.value === canonical),
  );
  if (holder) {
    return fail(
      `Este identificador já pertence a ${contactDisplayName(holder)}. Você pode mesclar os Contatos ou transferir o Identificador.`,
      "valor",
    );
  }
  if (contact.identifiers.some((i) => i.type === type && i.value === canonical)) {
    return ok(contact);
  }

  // INV-CON-03 — the first identifier of each type is born principal.
  const hasPrincipal = contact.identifiers.some((i) => i.type === type && i.principal);
  contact.identifiers.push({
    id: nextId("cid"),
    type,
    value: canonical,
    displayValue: value.trim(),
    verified: false,
    principal: !hasPrincipal,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Identificador acrescentado",
    objectType: "contact",
    objectId: contact.id,
    objectName: contactDisplayName(contact),
    after: `${type}: ${value.trim()}`,
  });
  return ok(contact);
}

/**
 * DO-CON-12 — transferring an identifier moves ONLY the future resolution.
 * Past conversations and messages stay with the origin contact.
 */
export function transferContactIdentifier(
  state: DataState,
  actingMemberId: Id,
  fromContactId: Id,
  identifierId: Id,
  toContactId: Id,
): OperationResult<Contact> {
  const from = state.contacts.find((c) => c.id === fromContactId);
  const to = state.contacts.find((c) => c.id === toContactId);
  if (!from || !to) return fail("Contato não encontrado.");
  if (to.lifecycle === "mesclado") return fail("O Contato de destino foi mesclado.");
  const index = from.identifiers.findIndex((i) => i.id === identifierId);
  const identifier = from.identifiers[index];
  if (index < 0 || !identifier) return fail("Identificador não encontrado.");

  from.identifiers.splice(index, 1);
  to.identifiers.push({
    ...identifier,
    principal: !to.identifiers.some((i) => i.type === identifier.type && i.principal),
  });

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Identificador transferido",
    objectType: "contact",
    objectId: from.id,
    objectName: contactDisplayName(from),
    before: identifier.displayValue,
    detail: "Só a resolução futura muda; Conversas e Mensagens passadas permanecem.",
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Identificador recebido por transferência",
    objectType: "contact",
    objectId: to.id,
    objectName: contactDisplayName(to),
    after: identifier.displayValue,
  });
  return ok(to);
}

/**
 * B14 — a single rule for Contact and Company: an atomic operation between two
 * `ativo` or `arquivado` records (never `naLixeira` nor `mesclado`). The
 * survivor ends `ativo` if either was; the absorbed one keeps a pre-merge state
 * and becomes `mesclado`, terminal. IRREVERSIBLE.
 *
 * External references (conversations, deals, links, anchors) are repointed in
 * the act by REPLACING the value object, never by mutating its interior.
 */
export function mergeContacts(
  state: DataState,
  actingMemberId: Id,
  survivorId: Id,
  absorbedId: Id,
): OperationResult<Contact> {
  if (survivorId === absorbedId) return fail("Escolha dois Contatos diferentes.");
  const survivor = state.contacts.find((c) => c.id === survivorId);
  const absorbed = state.contacts.find((c) => c.id === absorbedId);
  if (!survivor || !absorbed) return fail("Contato não encontrado.");

  for (const record of [survivor, absorbed]) {
    if (record.lifecycle === "naLixeira" || record.lifecycle === "mesclado") {
      return fail("Só é possível mesclar Contatos ativos ou arquivados.");
    }
  }

  absorbed.preMergeState = {
    at: now(),
    snapshot: JSON.stringify({
      firstName: absorbed.firstName,
      lastName: absorbed.lastName,
      identifiers: absorbed.identifiers,
      consents: absorbed.consents,
      addresses: absorbed.addresses,
      tagIds: absorbed.tagIds,
      fieldValues: absorbed.fieldValues,
    }),
  };

  for (const identifier of absorbed.identifiers) {
    const clash = survivor.identifiers.some(
      (i) => i.type === identifier.type && i.value === identifier.value,
    );
    if (!clash) {
      survivor.identifiers.push({
        ...identifier,
        principal: !survivor.identifiers.some((i) => i.type === identifier.type && i.principal),
      });
    }
  }
  survivor.consents.push(...absorbed.consents);
  survivor.addresses.push(...absorbed.addresses.map((a) => ({ ...a, principal: false })));
  for (const tagId of absorbed.tagIds) if (!survivor.tagIds.includes(tagId)) survivor.tagIds.push(tagId);
  survivor.comments.push(...absorbed.comments);

  // References repointed by replacing the value object (B14).
  state.contactCompanyLinks = state.contactCompanyLinks.map((link) =>
    link.contactId === absorbedId ? { ...link, contactId: survivorId } : link,
  );
  for (const deal of state.deals) {
    const repointed = deal.contactLinks.map((link) =>
      link.contactId === absorbedId ? { ...link, contactId: survivorId } : link,
    );
    // RN-NEG-07 — at most one link per (contact, deal) pair after repointing.
    const seen = new Set<Id>();
    deal.contactLinks = repointed.filter((link) => {
      if (seen.has(link.contactId)) return false;
      seen.add(link.contactId);
      return true;
    });
  }
  for (const conversation of state.conversations) {
    if (conversation.contactId === absorbedId) conversation.contactId = survivorId;
  }
  for (const session of state.chatSessions) {
    if (session.anchor?.type === "contact" && session.anchor.id === absorbedId) {
      session.anchor = { ...session.anchor, id: survivorId };
    }
  }
  // B14 — previous `mesclado` records repoint to the new survivor; no chains.
  for (const contact of state.contacts) {
    if (contact.mergedIntoId === absorbedId) contact.mergedIntoId = survivorId;
  }

  resolveDuplicateConversations(state, actingMemberId, survivorId);

  if (survivor.lifecycle !== "ativo" && absorbed.lifecycle === "ativo") survivor.lifecycle = "ativo";
  absorbed.lifecycle = "mesclado";
  absorbed.mergedIntoId = survivorId;
  absorbed.mergedAt = now();

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato sobrevivente da mesclagem",
    objectType: "contact",
    objectId: survivor.id,
    objectName: contactDisplayName(survivor),
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato mesclado",
    objectType: "contact",
    objectId: absorbed.id,
    objectName: contactDisplayName(absorbed),
    after: contactDisplayName(survivor),
  });
  return ok(survivor);
}

/**
 * RN-CXE-10 — if the survivor ends with two unresolved conversations on the
 * same channel, the one with the most recent message stays and the other is
 * resolved with cause "mesclagem", WITHOUT moving messages.
 */
function resolveDuplicateConversations(state: DataState, actingMemberId: Id, contactId: Id): void {
  const byChannel = new Map<Id, Conversation[]>();
  for (const conversation of state.conversations) {
    if (conversation.contactId !== contactId) continue;
    if (conversation.lifecycle !== "ativo" || conversation.state === "resolvida") continue;
    const bucket = byChannel.get(conversation.channelId) ?? [];
    bucket.push(conversation);
    byChannel.set(conversation.channelId, bucket);
  }
  const lastMessageAt = (c: Conversation): string => c.messages.at(-1)?.createdAt ?? c.createdAt;
  for (const bucket of byChannel.values()) {
    if (bucket.length < 2) continue;
    bucket.sort((a, b) => lastMessageAt(b).localeCompare(lastMessageAt(a)));
    for (const conversation of bucket.slice(1)) {
      conversation.state = "resolvida";
      conversation.resolvedAt = now();
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Conversa resolvida por mesclagem",
        objectType: "conversation",
        objectId: conversation.id,
        objectName: conversation.title,
        detail: "mesclagem",
      });
    }
  }
}

/**
 * B8 — leaving an organization CLOSES the link (fills `end`) and never deletes
 * it. Closing removes both principal indicators (RN-CON-06).
 */
export function endContactCompanyLink(
  state: DataState,
  actingMemberId: Id,
  linkId: Id,
  endDate: string,
): OperationResult<void> {
  const link = state.contactCompanyLinks.find((l) => l.id === linkId);
  if (!link) return fail("Vínculo não encontrado.");
  if (link.end) return fail("Este Vínculo já está encerrado.");
  link.end = endDate;
  link.principalForContact = false;
  link.principalForCompany = false;
  const contact = state.contacts.find((c) => c.id === link.contactId);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Vínculo com Empresa encerrado",
    objectType: "contact",
    objectId: link.contactId,
    objectName: contact ? contactDisplayName(contact) : link.contactId,
    after: endDate,
  });
  return ok(undefined);
}

/** RN-CON-13 / B43 — the trash records the previous state; restore gives it back. */
export function trashContact(state: DataState, actingMemberId: Id, contactId: Id): OperationResult<Contact> {
  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return fail("Contato não encontrado.");
  if (contact.lifecycle === "mesclado") return fail("Um Contato mesclado não vai para a lixeira.");
  // B43 — a second call must not overwrite the state the restore will give back.
  if (contact.lifecycle === "naLixeira") return ok(contact);
  contact.lifecycleBeforeTrash = contact.lifecycle === "arquivado" ? "arquivado" : "ativo";
  contact.lifecycle = "naLixeira";
  contact.trashedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato enviado à lixeira",
    objectType: "contact",
    objectId: contact.id,
    objectName: contactDisplayName(contact),
  });
  return ok(contact);
}

/**
 * RN-EMP-09 — sending a Company to the trash is rejected while an `aberto` Deal
 * (in any state other than `naLixeira`) references it, or while it has an
 * `ativo`/`arquivado` subsidiary.
 */
export function trashCompany(state: DataState, actingMemberId: Id, companyId: Id): OperationResult<void> {
  const company = state.companies.find((c) => c.id === companyId);
  if (!company) return fail("Empresa não encontrada.");
  // B43 — a second call must not overwrite the state the restore will give back.
  if (company.lifecycle === "naLixeira") return ok(undefined);
  const openDeals = state.deals.filter(
    (d) => d.companyId === companyId && d.situation === "aberto" && d.lifecycle !== "naLixeira",
  );
  if (openDeals.length > 0) {
    return fail(
      `${openDeals.length} ${openDeals.length === 1 ? "Negócio aberto referencia" : "Negócios abertos referenciam"} esta Empresa. Feche, mova ou exclua antes.`,
    );
  }
  const subsidiaries = state.companies.filter(
    (c) => c.parentCompanyId === companyId && (c.lifecycle === "ativo" || c.lifecycle === "arquivado"),
  );
  if (subsidiaries.length > 0) {
    return fail(
      `Esta Empresa tem ${subsidiaries.length} ${subsidiaries.length === 1 ? "filial" : "filiais"}. Reatribua ou envie as filiais à lixeira antes.`,
    );
  }
  company.lifecycleBeforeTrash = company.lifecycle === "arquivado" ? "arquivado" : "ativo";
  company.lifecycle = "naLixeira";
  company.trashedAt = now();
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Empresa enviada à lixeira",
    objectType: "company",
    objectId: company.id,
    objectName: company.tradeName || company.legalName,
  });
  return ok(undefined);
}

/**
 * RN-CON-15 / B14 — restauração de cópia: a única saída da mesclagem, e ela
 * NÃO desfaz nada. Cria um Contato NOVO a partir do Estado pré-mesclagem, com
 * Proveniência apontando para o absorvido — que permanece `mesclado`, terminal,
 * apontando para o sobrevivente.
 *
 * O que NÃO volta: Conversas, Negócios, Tarefas e âncoras continuam apontando
 * para o sobrevivente. Só os atributos guardados no instante da mesclagem são
 * copiados, e nenhum Identificador vem junto — devolver um Identificador ao
 * novo registro quebraria INV-CON-02, que exige um Identificador em um só
 * Contato.
 */
export function restoreMergedCopy(
  state: DataState,
  actingMemberId: Id,
  mergedContactId: Id,
): OperationResult<Contact> {
  const merged = state.contacts.find((c) => c.id === mergedContactId);
  if (!merged) return fail("Contato não encontrado.");
  if (merged.lifecycle !== "mesclado") {
    return fail("A restauração de cópia só existe para um Contato mesclado.");
  }
  if (!merged.preMergeState) {
    return fail("Este Contato não guarda um Estado pré-mesclagem.");
  }

  let snapshot: {
    firstName?: string;
    lastName?: string;
    consents?: ConsentRecord[];
    addresses?: Address[];
    tagIds?: Id[];
    fieldValues?: FieldValue[];
  };
  try {
    snapshot = JSON.parse(merged.preMergeState.snapshot) as typeof snapshot;
  } catch (error) {
    return fail(
      `O Estado pré-mesclagem deste Contato não pôde ser lido: ${error instanceof Error ? error.message : "formato inválido"}.`,
    );
  }

  const copy: Contact = {
    id: nextId("cnt"),
    workspaceId: merged.workspaceId,
    lifecycle: "ativo",
    firstName: snapshot.firstName ?? merged.firstName,
    lastName: snapshot.lastName ?? merged.lastName,
    ownerMemberId: actingMemberId,
    creationMode: "manual",
    description: merged.description,
    // INV-CON-02 — um Identificador pertence a um só Contato, e os do absorvido
    // já migraram para o sobrevivente. A cópia nasce sem nenhum.
    identifiers: [],
    consents: snapshot.consents ?? [],
    addresses: snapshot.addresses ?? [],
    tagIds: snapshot.tagIds ?? [],
    fieldValues: snapshot.fieldValues ?? [],
    comments: [],
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    provenance: {
      kind: "copy",
      sourceId: merged.id,
      sourceName: contactDisplayName(merged),
      at: now(),
    },
  };
  state.contacts.push(copy);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Cópia restaurada de Contato mesclado",
    objectType: "contact",
    objectId: copy.id,
    objectName: contactDisplayName(copy),
    detail: `A partir do Estado pré-mesclagem de ${contactDisplayName(merged)}, que permanece mesclado`,
  });
  return ok(copy);
}

/** One parsed row of the import, already mapped to attributes. */
export interface ImportRow {
  readonly firstName: string;
  readonly lastName?: string;
  readonly identifierType?: ContactIdentifierType;
  readonly identifierValue?: string;
}

export interface ImportOutcome {
  readonly created: number;
  readonly updated: number;
  /** Every rejection carries its reason: a silent drop is a lost Contact. */
  readonly rejected: ReadonlyArray<{ readonly line: number; readonly value: string; readonly reason: string }>;
  /** True when the workspace Contact limit stopped the import mid-way. */
  readonly stoppedAtLimit: boolean;
}

/**
 * Documento 10, 12.1 — importação: cada linha é um Contato, e uma linha cujo
 * Identificador colide com um Contato existente é REJEITADA ou tratada como
 * atualização, conforme escolha explícita do ator. Nunca cria duplicata.
 *
 * RN-CON-20 / RN-ET-23 — a importação conta para o Limite imposto de Contatos,
 * verificado no ato: atingido o limite, ela PARA com o balanço parcial em vez
 * de estourar em silêncio.
 *
 * O Modo de criação dos Contatos criados é `importacao`, imutável.
 */
export function importContacts(
  state: DataState,
  actingMemberId: Id,
  rows: readonly ImportRow[],
  options: {
    readonly onCollision: "rejeitar" | "atualizar";
    readonly ownerMemberId?: Id;
    readonly originId?: Id;
  },
): OperationResult<ImportOutcome> {
  const owner = state.members.find((m) => m.id === (options.ownerMemberId ?? actingMemberId));
  if (!owner || (owner.state !== "ativo" && owner.state !== "suspenso")) {
    return fail("O Proprietário dos Contatos importados precisa ser um Membro ativo.", "proprietario");
  }
  if (rows.length === 0) return fail("Nenhuma linha para importar.", "arquivo");

  const rejected: Array<{ line: number; value: string; reason: string }> = [];
  let created = 0;
  let updated = 0;
  let stoppedAtLimit = false;

  for (const [index, row] of rows.entries()) {
    const line = index + 1;
    const label = row.identifierValue ?? `${row.firstName} ${row.lastName ?? ""}`.trim();

    if (!row.firstName.trim()) {
      rejected.push({ line, value: label, reason: "Linha sem nome." });
      continue;
    }

    // INV-CON-02 — um Identificador vive num só Contato. O `mesclado` fica de
    // fora: os Identificadores dele já migraram para o sobrevivente, e atualizar
    // um registro terminal é uma edição que o usuário nunca veria (ele nem
    // aparece na listagem).
    const existing =
      row.identifierType && row.identifierValue
        ? state.contacts.find(
            (contact) =>
              contact.lifecycle !== "mesclado" &&
              contact.identifiers.some(
                (identifier) =>
                  identifier.type === row.identifierType &&
                  canonicalIdentifier(
                    row.identifierType as ContactIdentifierType,
                    row.identifierValue as string,
                  ) === identifier.value,
              ),
          )
        : undefined;

    if (existing) {
      if (options.onCollision === "rejeitar") {
        rejected.push({
          line,
          value: label,
          reason: `Identificador já pertence a ${existing.firstName} ${existing.lastName}`.trim(),
        });
        continue;
      }
      existing.firstName = row.firstName.trim();
      if (row.lastName !== undefined) existing.lastName = row.lastName.trim();
      if (options.originId) existing.originId = options.originId;
      updated += 1;
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Contato atualizado por importação",
        objectType: "contact",
        objectId: existing.id,
        objectName: contactDisplayName(existing),
        detail: `Linha ${line}`,
      });
      continue;
    }

    // RN-CON-20 / RN-ET-23 — the limit is checked at the moment it would be
    // consumed, and the import stops with the partial balance.
    const activeContacts = state.contacts.filter((contact) => contact.lifecycle !== "mesclado").length;
    if (activeContacts >= state.workspace.limits.contacts) {
      stoppedAtLimit = true;
      rejected.push({
        line,
        value: label,
        reason: `Limite de ${state.workspace.limits.contacts} Contatos do Espaço de Trabalho atingido.`,
      });
      break;
    }

    const contact: Contact = {
      id: nextId("cnt"),
      workspaceId: state.workspace.id,
      lifecycle: "ativo",
      firstName: row.firstName.trim(),
      lastName: (row.lastName ?? "").trim(),
      ownerMemberId: owner.id,
      creationMode: "importacao",
      ...(options.originId ? { originId: options.originId } : {}),
      description: "",
      identifiers:
        row.identifierType && row.identifierValue
          ? [
              {
                id: nextId("cid"),
                type: row.identifierType,
                value: canonicalIdentifier(row.identifierType, row.identifierValue),
                displayValue: row.identifierValue,
                principal: true,
                verified: false,
                createdBy: memberActor(actingMemberId),
                createdAt: now(),
              },
            ]
          : [],
      consents: [],
      addresses: [],
      tagIds: [],
      fieldValues: [],
      comments: [],
      createdBy: memberActor(actingMemberId),
      createdAt: now(),
    };
    state.contacts.push(contact);
    created += 1;
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contatos importados",
    objectType: "workspace",
    objectId: state.workspace.id,
    objectName: state.workspace.name,
    after: `${created} criados · ${updated} atualizados · ${rejected.length} rejeitados`,
    ...(stoppedAtLimit ? { detail: "Interrompida: Limite imposto de Contatos atingido" } : {}),
  });

  return ok({ created, updated, rejected, stoppedAtLimit });
}

/**
 * B43 — restaurar devolve o estado que o registro tinha antes da lixeira, não
 * `ativo` por decreto: um Contato arquivado volta arquivado.
 */
export function restoreContact(
  state: DataState,
  actingMemberId: Id,
  contactId: Id,
): OperationResult<Contact> {
  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return fail("Contato não encontrado.");
  if (contact.lifecycle !== "naLixeira") return ok(contact);

  contact.lifecycle = contact.lifecycleBeforeTrash ?? "ativo";
  delete contact.lifecycleBeforeTrash;
  delete contact.trashedAt;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato restaurado",
    objectType: "contact",
    objectId: contact.id,
    objectName: contactDisplayName(contact),
    after: contact.lifecycle,
  });
  return ok(contact);
}

/**
 * RN-EMP-09 impede enviar à lixeira uma Empresa com filial ativa; restaurar não
 * tem simétrico — a Empresa volta sozinha, e os Vínculos com Contatos, que
 * nunca foram desfeitos, voltam a ser visíveis com ela.
 */
export function restoreCompany(
  state: DataState,
  actingMemberId: Id,
  companyId: Id,
): OperationResult<Company> {
  const company = state.companies.find((c) => c.id === companyId);
  if (!company) return fail("Empresa não encontrada.");
  if (company.lifecycle !== "naLixeira") return ok(company);

  // A matriz precisa existir fora da lixeira, senão a filial volta órfã.
  if (company.parentCompanyId) {
    const parent = state.companies.find((c) => c.id === company.parentCompanyId);
    if (!parent || parent.lifecycle === "naLixeira") {
      delete company.parentCompanyId;
      recordActivity(state, {
        actor: memberActor(actingMemberId),
        action: "Matriz removida",
        objectType: "company",
        objectId: company.id,
        objectName: company.legalName,
        detail: "restauração: a matriz está na lixeira",
      });
    }
  }

  company.lifecycle = company.lifecycleBeforeTrash ?? "ativo";
  delete company.lifecycleBeforeTrash;
  delete company.trashedAt;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Empresa restaurada",
    objectType: "company",
    objectId: company.id,
    objectName: company.legalName,
    after: company.lifecycle,
  });
  return ok(company);
}

/**
 * DO-CON-14 — "não são a mesma pessoa" é a única decisão que se persiste em
 * torno de uma Suspeita de Duplicidade. O Vínculo é simétrico e sem papel: ele
 * não diz qual é qual, só que o par foi avaliado.
 */
export function markContactsAsDistinct(
  state: DataState,
  actingMemberId: Id,
  contactAId: Id,
  contactBId: Id,
): OperationResult<void> {
  if (contactAId === contactBId) return fail("Um Contato não é distinto de si mesmo.");
  const a = state.contacts.find((c) => c.id === contactAId);
  const b = state.contacts.find((c) => c.id === contactBId);
  if (!a || !b) return fail("Contato não encontrado.");

  const already = state.distinctFromLinks.some(
    (link) =>
      (link.contactAId === contactAId && link.contactBId === contactBId) ||
      (link.contactAId === contactBId && link.contactBId === contactAId),
  );
  if (already) return ok(undefined);

  state.distinctFromLinks.push({
    id: nextId("dfl"),
    contactAId,
    contactBId,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
  });
  // O Registro fica nos DOIS Contatos: quem abrir qualquer um dos dois vê a
  // decisão que suprimiu a suspeita, e por quem.
  for (const [subject, other] of [
    [a, b],
    [b, a],
  ] as const) {
    recordActivity(state, {
      actor: memberActor(actingMemberId),
      action: "Marcado como distinto de outro Contato",
      objectType: "contact",
      objectId: subject.id,
      objectName: contactDisplayName(subject),
      detail: contactDisplayName(other),
    });
  }
  return ok(undefined);
}

/**
 * Nota interna no Contato. É Comentário (A8), não Mensagem: ela NÃO sai da
 * plataforma, não tem Canal e não consome janela de resposta. A distinção é o
 * que separa "anotei isso sobre a pessoa" de "falei isso para a pessoa".
 */
export function addContactNote(
  state: DataState,
  actingMemberId: Id,
  contactId: Id,
  content: string,
): OperationResult<Contact> {
  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return fail("Contato não encontrado.");
  if (contact.lifecycle === "mesclado") return fail("Um Contato mesclado é somente leitura.");
  if (contact.lifecycle === "naLixeira") return fail("Este Contato está na lixeira.");
  if (!content.trim()) return fail("Escreva a nota antes de salvar.", "nota");

  contact.comments.push({
    id: nextId("cmt"),
    author: memberActor(actingMemberId),
    content: content.trim(),
    attachments: [],
    mentions: [],
    createdAt: now(),
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Nota registrada no Contato",
    objectType: "contact",
    objectId: contact.id,
    objectName: contactDisplayName(contact),
  });
  return ok(contact);
}

/**
 * RN-CON-01 — criar Contato exige nome OU um Identificador. Um Contato sem
 * nenhum dos dois não é ninguém: não dá para chamá-lo nem para encontrá-lo.
 *
 * O Identificador passa pelo mesmo teste de colisão de `addContactIdentifier`
 * (RN-CON-11): a checagem mora aqui e não na tela porque a importação e a
 * Mensagem recebida criam Contato pelos mesmos caminhos.
 */
export function createContact(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly firstName: string;
    readonly lastName: string;
    readonly identifierType?: ContactIdentifierType;
    readonly identifierValue?: string;
    readonly companyId?: Id;
    readonly role?: string;
    readonly ownerMemberId?: Id;
  },
): OperationResult<Contact> {
  const refusal = mayCreateCrmRecord(state, actingMemberId);
  if (refusal) return fail(refusal);

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const rawIdentifier = input.identifierValue?.trim() ?? "";
  if (!firstName && !lastName && !rawIdentifier) {
    return fail("Dê um nome ao Contato ou informe um Identificador.", "nome");
  }

  let identifier: { type: ContactIdentifierType; canonical: string; display: string } | undefined;
  if (rawIdentifier) {
    const type = input.identifierType ?? "email";
    const canonical = canonicalIdentifier(type, rawIdentifier);
    if (!canonical) return fail("Informe o valor do Identificador.", "identificador");
    const holder = state.contacts.find(
      (c) =>
        c.lifecycle !== "mesclado" &&
        c.identifiers.some((i) => i.type === type && i.value === canonical),
    );
    if (holder) {
      return fail(
        `Este identificador já pertence a ${contactDisplayName(holder)}. Abra o Contato existente em vez de criar outro.`,
        "identificador",
      );
    }
    identifier = { type, canonical, display: rawIdentifier };
  }

  // RN-CON-20 / RN-ET-23 — o mesmo Limite que interrompe a importação vale
  // aqui: se só a importação o respeitasse, este formulário seria a porta dos
  // fundos e o cabeçalho passaria a ler "5004 de 5000".
  const contagem = state.contacts.filter((c) => c.lifecycle !== "mesclado").length;
  if (contagem >= state.workspace.limits.contacts) {
    return fail(
      `O Limite de ${state.workspace.limits.contacts} Contatos do Espaço de Trabalho foi atingido.`,
    );
  }

  const owner = input.ownerMemberId ?? actingMemberId;
  if (!state.members.some((m) => m.id === owner && m.state === "ativo")) {
    return fail("O Proprietário precisa ser um Membro ativo.", "proprietario");
  }

  if (input.companyId && !state.companies.some((c) => c.id === input.companyId && c.lifecycle === "ativo")) {
    return fail("A Empresa escolhida não está ativa.", "empresa");
  }

  const contact: Contact = {
    id: nextId("cnt"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    firstName,
    lastName,
    ownerMemberId: owner,
    creationMode: "manual",
    description: "",
    identifiers: identifier
      ? [
          {
            id: nextId("cid"),
            type: identifier.type,
            value: identifier.canonical,
            displayValue: identifier.display,
            principal: true,
            verified: false,
            createdBy: memberActor(actingMemberId),
            createdAt: now(),
          },
        ]
      : [],
    consents: [],
    addresses: [],
    tagIds: [],
    fieldValues: [],
    comments: [],
  };
  state.contacts.push(contact);

  if (input.companyId) {
    state.contactCompanyLinks.push({
      id: nextId("ccl"),
      contactId: contact.id,
      companyId: input.companyId,
      role: input.role?.trim() || "Contato",
      principalForContact: true,
      principalForCompany: false,
      start: now().slice(0, 10),
      createdBy: memberActor(actingMemberId),
      createdAt: now(),
    });
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato criado",
    objectType: "contact",
    objectId: contact.id,
    objectName: contactDisplayName(contact),
  });
  return ok(contact);
}

/** INV-EMP-01 — a Empresa precisa de nome fantasia OU razão social. */
export function createCompany(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly tradeName: string;
    readonly legalName: string;
    readonly parentCompanyId?: Id;
    readonly ownerMemberId?: Id;
  },
): OperationResult<Company> {
  const refusal = mayCreateCrmRecord(state, actingMemberId);
  if (refusal) return fail(refusal);

  const tradeName = input.tradeName.trim();
  const legalName = input.legalName.trim();
  if (!tradeName && !legalName) {
    return fail("Informe o nome fantasia ou a razão social.", "nome");
  }

  const owner = input.ownerMemberId ?? actingMemberId;
  if (!state.members.some((m) => m.id === owner && m.state === "ativo")) {
    return fail("O Proprietário precisa ser um Membro ativo.", "proprietario");
  }

  if (
    input.parentCompanyId &&
    !state.companies.some((c) => c.id === input.parentCompanyId && c.lifecycle === "ativo")
  ) {
    return fail("A matriz escolhida não está ativa.", "matriz");
  }

  const company: Company = {
    id: nextId("cmp"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    tradeName: tradeName || legalName,
    legalName: legalName || tradeName,
    ownerMemberId: owner,
    description: "",
    ...(input.parentCompanyId ? { parentCompanyId: input.parentCompanyId } : {}),
    identifiers: [],
    addresses: [],
    tagIds: [],
    fieldValues: [],
    attachments: [],
    comments: [],
  };
  state.companies.push(company);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Empresa criada",
    objectType: "company",
    objectId: company.id,
    objectName: company.tradeName,
  });
  return ok(company);
}

function mayCreateCrmRecord(state: DataState, actingMemberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo cria registro de CRM.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return "Um Convidado não cria registro: ele alcança só o que foi compartilhado com ele.";
  }
  return undefined;
}

/**
 * Vincular um Contato existente a uma Empresa.
 *
 * O Vínculo só nascia dentro de `createContact`, então uma Empresa criada
 * depois dos seus Contatos ficava sem ninguém — e a própria ficha mandava
 * "vincule um Contato" sem oferecer como.
 *
 * INV-CON-04 / INV-EMP-04 — no máximo um principal de cada lado: marcar um
 * novo principal rebaixa o anterior em vez de criar dois.
 */
export function linkContactToCompany(
  state: DataState,
  actingMemberId: Id,
  input: {
    readonly contactId: Id;
    readonly companyId: Id;
    readonly role: string;
    readonly principalForCompany?: boolean;
  },
): OperationResult<ContactCompanyLink> {
  const refusal = mayCreateCrmRecord(state, actingMemberId);
  if (refusal) return fail(refusal);

  const company = state.companies.find((c) => c.id === input.companyId);
  if (!company) return fail("Empresa não encontrada.");
  if (company.lifecycle !== "ativo") return fail("Esta Empresa não está ativa.");
  const contact = state.contacts.find((c) => c.id === input.contactId);
  if (!contact) return fail("Contato não encontrado.", "contato");
  if (contact.lifecycle !== "ativo") return fail("Este Contato não está ativo.", "contato");

  const aberto = state.contactCompanyLinks.find(
    (l) => l.contactId === input.contactId && l.companyId === input.companyId && l.end === undefined,
  );
  if (aberto) return fail("Este Contato já está vinculado a esta Empresa.", "contato");

  const role = input.role.trim();
  if (!role) return fail("Informe o cargo — ele é do Vínculo, nunca do Contato.", "cargo");

  const principalForCompany =
    input.principalForCompany ??
    !state.contactCompanyLinks.some((l) => l.companyId === input.companyId && l.principalForCompany);
  if (principalForCompany) {
    for (const l of state.contactCompanyLinks) {
      if (l.companyId === input.companyId) l.principalForCompany = false;
    }
  }
  const principalForContact = !state.contactCompanyLinks.some(
    (l) => l.contactId === input.contactId && l.principalForContact && l.end === undefined,
  );

  const link: ContactCompanyLink = {
    id: nextId("ccl"),
    contactId: input.contactId,
    companyId: input.companyId,
    role,
    principalForContact,
    principalForCompany,
    start: now().slice(0, 10),
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
  };
  state.contactCompanyLinks.push(link);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato vinculado à Empresa",
    objectType: "company",
    objectId: company.id,
    objectName: company.tradeName || company.legalName,
    after: contactDisplayName(contact),
  });
  return ok(link);
}

/** INV-EMP-02 — o domínio e o documento fiscal identificam a Empresa; repetir um deles é dizer que são a mesma. */
export function addCompanyIdentifier(
  state: DataState,
  actingMemberId: Id,
  companyId: Id,
  type: CompanyIdentifier["type"],
  value: string,
): OperationResult<Company> {
  const refusal = mayCreateCrmRecord(state, actingMemberId);
  if (refusal) return fail(refusal);

  const company = state.companies.find((c) => c.id === companyId);
  if (!company) return fail("Empresa não encontrada.");
  if (company.lifecycle !== "ativo") return fail("Esta Empresa não está ativa.");

  const canonical = value.trim().toLocaleLowerCase("pt-BR").replace(/^https?:\/\//, "");
  if (!canonical) return fail("Informe o valor do identificador.", "valor");

  const holder = state.companies.find(
    (c) =>
      c.id !== companyId &&
      c.lifecycle !== "mesclado" &&
      c.identifiers.some((i) => i.type === type && i.value === canonical),
  );
  if (holder) {
    return fail(
      `Este identificador já pertence a ${holder.tradeName || holder.legalName}.`,
      "valor",
    );
  }
  if (company.identifiers.some((i) => i.type === type && i.value === canonical)) {
    return ok(company);
  }

  company.identifiers.push({
    id: nextId("cmi"),
    type,
    value: canonical,
    verified: false,
    principal: !company.identifiers.some((i) => i.type === type),
    createdAt: now(),
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Identificador acrescentado à Empresa",
    objectType: "company",
    objectId: company.id,
    objectName: company.tradeName || company.legalName,
    after: canonical,
  });
  return ok(company);
}

/**
 * Qualificação e Temperatura são leituras do time sobre a pessoa, não cálculos:
 * ambas vêm do Catálogo do Espaço de Trabalho e mudam com um clique na ficha.
 *
 * A Qualificação diz O QUE a pessoa é para a organização; a Temperatura, quão
 * perto do fechamento ela está. São eixos diferentes — um Cliente pode estar
 * frio, e um Lead, quente.
 */
export function setContactCatalogValue(
  state: DataState,
  actingMemberId: Id,
  contactId: Id,
  kind: "qualificacao" | "temperatura",
  catalogItemId: Id | undefined,
): OperationResult<Contact> {
  const refusal = mayCreateCrmRecord(state, actingMemberId);
  if (refusal) return fail(refusal);

  const contact = state.contacts.find((c) => c.id === contactId);
  if (!contact) return fail("Contato não encontrado.");
  if (contact.lifecycle !== "ativo") return fail("Este Contato é somente leitura.");

  const rotulo = kind === "qualificacao" ? "Qualificação" : "Temperatura";
  let nome: string | undefined;
  if (catalogItemId !== undefined) {
    const item = state.catalog.find((c) => c.id === catalogItemId && c.kind === kind);
    if (!item) return fail(`Esta ${rotulo} não existe no Catálogo.`);
    if (item.lifecycle !== "ativo") return fail(`Esta ${rotulo} está arquivada.`);
    nome = item.name;
  }

  const anteriorId = kind === "qualificacao" ? contact.qualificationId : contact.temperatureId;
  const anterior = state.catalog.find((c) => c.id === anteriorId)?.name;
  if (kind === "qualificacao") {
    if (catalogItemId === undefined) delete contact.qualificationId;
    else contact.qualificationId = catalogItemId;
  } else {
    if (catalogItemId === undefined) delete contact.temperatureId;
    else contact.temperatureId = catalogItemId;
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: `${rotulo} do Contato alterada`,
    objectType: "contact",
    objectId: contact.id,
    objectName: contactDisplayName(contact),
    ...(anterior ? { before: anterior } : {}),
    ...(nome ? { after: nome } : {}),
  });
  return ok(contact);
}
