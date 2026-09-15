/**
 * Pastas de Sessões de Chat.
 *
 * A pasta é do Membro, como a Sessão (DO-CHT-09): quem não é o dono não vê,
 * não renomeia e não move nada para dentro dela. Uma Sessão pode estar numa
 * pasta ou solta — solta é o estado normal, e apagar a pasta devolve as
 * Sessões a esse estado em vez de levá-las junto: pasta é organização, não
 * contêiner de vida.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type { ChatFolder, ChatSession, Id } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";

const now = (): string => new Date().toISOString();

const activeMember = (state: DataState, memberId: Id) => {
  const member = state.members.find((m) => m.id === memberId);
  return member && member.state === "ativo" ? member : undefined;
};

/** Nome único entre as pastas do mesmo dono, sem diferenciar maiúsculas. */
const nameTaken = (state: DataState, ownerMemberId: Id, name: string, exceptId?: Id): boolean =>
  state.chatFolders.some(
    (folder) =>
      folder.id !== exceptId &&
      folder.ownerMemberId === ownerMemberId &&
      folder.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
  );

export function createChatFolder(
  state: DataState,
  actingMemberId: Id,
  input: { readonly name: string },
): OperationResult<ChatFolder> {
  if (!activeMember(state, actingMemberId)) return fail("Só um Membro ativo cria uma pasta.");
  const name = input.name.trim();
  if (!name) return fail("Dê um nome à pasta.", "nome");
  if (nameTaken(state, actingMemberId, name)) {
    return fail(`Você já tem uma pasta chamada “${name}”.`, "nome");
  }

  const folder: ChatFolder = {
    id: nextId("cfd"),
    workspaceId: state.workspace.id,
    ownerMemberId: actingMemberId,
    name,
    createdAt: now(),
  };
  state.chatFolders.push(folder);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Pasta de Chat criada",
    objectType: "chatFolder",
    objectId: folder.id,
    objectName: folder.name,
  });
  return ok(folder);
}

export function renameChatFolder(
  state: DataState,
  actingMemberId: Id,
  folderId: Id,
  name: string,
): OperationResult<ChatFolder> {
  const folder = state.chatFolders.find((f) => f.id === folderId);
  if (!folder) return fail("Pasta não encontrada.");
  if (folder.ownerMemberId !== actingMemberId) return fail("Esta pasta é de outro Membro.");
  const next = name.trim();
  if (!next) return fail("Dê um nome à pasta.", "nome");
  if (nameTaken(state, actingMemberId, next, folder.id)) {
    return fail(`Você já tem uma pasta chamada “${next}”.`, "nome");
  }
  const before = folder.name;
  folder.name = next;
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Pasta de Chat renomeada",
    objectType: "chatFolder",
    objectId: folder.id,
    objectName: folder.name,
    before,
    after: next,
  });
  return ok(folder);
}

/** As Sessões de dentro voltam a ficar soltas — nada é eliminado. */
export function deleteChatFolder(
  state: DataState,
  actingMemberId: Id,
  folderId: Id,
): OperationResult<{ readonly released: number }> {
  const folder = state.chatFolders.find((f) => f.id === folderId);
  if (!folder) return fail("Pasta não encontrada.");
  if (folder.ownerMemberId !== actingMemberId) return fail("Esta pasta é de outro Membro.");

  let released = 0;
  for (const session of state.chatSessions) {
    if (session.folderId === folder.id) {
      delete session.folderId;
      released += 1;
    }
  }
  state.chatFolders = state.chatFolders.filter((f) => f.id !== folder.id);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Pasta de Chat excluída",
    objectType: "chatFolder",
    objectId: folder.id,
    objectName: folder.name,
    ...(released > 0 ? { detail: `${released} Sessão(ões) voltaram a ficar soltas` } : {}),
  });
  return ok({ released });
}

/** `folderId` nulo tira a Sessão da pasta. */
export function moveChatSessionToFolder(
  state: DataState,
  actingMemberId: Id,
  sessionId: Id,
  folderId: Id | null,
): OperationResult<ChatSession> {
  const session = state.chatSessions.find((s) => s.id === sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.ownerMemberId !== actingMemberId) {
    return fail("Só o dono organiza a própria Sessão.");
  }
  if (session.lifecycle === "naLixeira") return fail("Esta Sessão está na lixeira.");

  const target = folderId ? state.chatFolders.find((f) => f.id === folderId) : undefined;
  if (folderId && !target) return fail("Pasta não encontrada.");
  if (target && target.ownerMemberId !== actingMemberId) {
    return fail("Esta pasta é de outro Membro.");
  }
  const from = state.chatFolders.find((f) => f.id === session.folderId);
  if ((session.folderId ?? null) === folderId) return ok(session);

  if (target) session.folderId = target.id;
  else delete session.folderId;

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: target ? "Sessão de Chat guardada em pasta" : "Sessão de Chat tirada da pasta",
    objectType: "chatSession",
    objectId: session.id,
    objectName: session.title,
    before: from?.name ?? "solta",
    after: target?.name ?? "solta",
  });
  return ok(session);
}
