/**
 * 12.4.3 — conceder e revogar acesso a um Espaço, Pasta ou Lista.
 *
 * Quem concede ou revoga precisa administrar o contêiner
 * (`containerAdminRefusal`): Administrador ou Proprietário que o alcança, ou
 * uma concessão `administrar` nele ou acima. A Concessão nasce com escopo
 * subárvore e origem `concessaoDireta`, e vale para um Membro, para os Membros
 * de uma Equipe ou para os titulares de um Papel (`concessaoValeParaMembro`).
 *
 * B38a: um contêiner privado sem concessão não existe para ninguém. Por isso
 * revogar recusa tirar a última concessão `administrar` que alcança um
 * contêiner privado: ele ficaria sem ninguém que o administre.
 */

import { containerAdminRefusal, containerPath, type PathNode } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Grant, Id } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";

export type AcaoDeAcesso = "ver" | "comentar" | "editar" | "administrar";
export const ACOES_DE_ACESSO: readonly AcaoDeAcesso[] = ["ver", "comentar", "editar", "administrar"];

export type SujeitoDeAcesso = "member" | "team" | "role";

export interface PedidoDeAcesso {
  readonly subjectKind: SujeitoDeAcesso;
  readonly subjectId: Id;
  readonly action: AcaoDeAcesso;
  readonly resourceType: PathNode["type"];
  readonly resourceId: Id;
}

const ROTULO_DA_ACAO: Readonly<Record<AcaoDeAcesso, string>> = {
  ver: "ver",
  comentar: "comentar",
  editar: "editar",
  administrar: "administrar",
};

const TIPOS_DE_CONTEINER: ReadonlySet<string> = new Set(["space", "folder", "list"]);

export function concederAcesso(state: DataState, actingMemberId: Id, input: PedidoDeAcesso): OperationResult<Grant> {
  if (!TIPOS_DE_CONTEINER.has(input.resourceType)) return fail("Acesso se concede a um Espaço, Pasta ou Lista.");
  const conteiner = containerPath(state, input.resourceType, input.resourceId).at(-1);
  if (!conteiner || conteiner.id !== input.resourceId) return fail("Contêiner não encontrado.");
  const recusa = containerAdminRefusal(state, actingMemberId, input.resourceType, input.resourceId);
  if (recusa) return fail(recusa);
  if (!ACOES_DE_ACESSO.includes(input.action)) return fail("Escolha o que o acesso permite.", "acao");

  const sujeito = nomeDoSujeito(state, input.subjectKind, input.subjectId);
  if (!sujeito.ok) return sujeito;

  const existente = state.grants.find(
    (g) =>
      g.subjectKind === input.subjectKind &&
      g.subjectId === input.subjectId &&
      g.resourceId === input.resourceId &&
      g.action === input.action,
  );
  if (existente) return ok(existente, existente.id);

  const concessao: Grant = {
    id: nextId("grn"),
    workspaceId: state.workspace.id,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    scope: "subarvore",
    origin: "concessaoDireta",
    grantedBy: actingMemberId,
    grantedAt: new Date().toISOString(),
  };
  state.grants.push(concessao);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Acesso concedido",
    objectType: input.resourceType,
    objectId: input.resourceId,
    objectName: conteiner.name,
    after: `${sujeito.value} · ${ROTULO_DA_ACAO[input.action]}`,
  });
  return ok(concessao, concessao.id);
}

export function revogarAcesso(state: DataState, actingMemberId: Id, grantId: Id): OperationResult<void> {
  const indice = state.grants.findIndex((g) => g.id === grantId);
  const concessao = state.grants[indice];
  if (!concessao || !TIPOS_DE_CONTEINER.has(concessao.resourceType)) return fail("Concessão não encontrada.");
  const tipo = concessao.resourceType as PathNode["type"];
  const caminho = containerPath(state, tipo, concessao.resourceId);
  const conteiner = caminho.at(-1);
  if (!conteiner) return fail("Contêiner não encontrado.");
  const recusa = containerAdminRefusal(state, actingMemberId, tipo, concessao.resourceId);
  if (recusa) return fail(recusa);

  if (concessao.action === "administrar" && caminhoTemPrivado(state, caminho)) {
    const nosDoCaminho = new Set(caminho.map((n) => n.id));
    const outra = state.grants.some(
      (g) =>
        g.id !== concessao.id &&
        g.action === "administrar" &&
        nosDoCaminho.has(g.resourceId) &&
        nomeDoSujeito(state, g.subjectKind, g.subjectId).ok,
    );
    if (!outra) {
      return fail(
        "Esta é a última concessão de administrar deste contêiner privado: sem ela, ninguém mais o alcança. Conceda administrar a outra pessoa antes.",
      );
    }
  }

  const sujeito = nomeDoSujeito(state, concessao.subjectKind, concessao.subjectId);
  state.grants.splice(indice, 1);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Acesso revogado",
    objectType: tipo,
    objectId: concessao.resourceId,
    objectName: conteiner.name,
    before: `${sujeito.ok ? sujeito.value : concessao.subjectId} · ${concessao.action}`,
  });
  return ok(undefined);
}

function caminhoTemPrivado(state: DataState, caminho: readonly PathNode[]): boolean {
  return caminho.some((n) =>
    n.type === "space"
      ? state.spaces.find((s) => s.id === n.id)?.isPrivate
      : n.type === "folder"
        ? state.folders.find((f) => f.id === n.id)?.isPrivate
        : state.lists.find((l) => l.id === n.id)?.isPrivate,
  );
}

/** O nome do sujeito, por extenso. Falha quando o sujeito não existe (ou o Membro foi removido). */
function nomeDoSujeito(state: DataState, tipo: Grant["subjectKind"], id: Id): OperationResult<string> {
  if (tipo === "member") {
    const membro = state.members.find((m) => m.id === id);
    if (!membro || membro.state === "removido") return fail("Membro não encontrado.", "sujeito");
    return ok(membro.displayName);
  }
  if (tipo === "team") {
    const equipe = state.teams.find((t) => t.id === id);
    if (!equipe) return fail("Equipe não encontrada.", "sujeito");
    return ok(`Equipe ${equipe.name}`);
  }
  if (tipo === "role") {
    const papel = state.roles.find((r) => r.id === id);
    if (!papel) return fail("Papel não encontrado.", "sujeito");
    return ok(`Papel ${papel.name}`);
  }
  return fail("Acesso se concede a um Membro, a uma Equipe ou a um Papel.", "sujeito");
}
