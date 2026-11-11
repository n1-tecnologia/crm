/**
 * 12.4.3 e 12.5.3 — `concederAcesso` e `revogarAcesso`. O "Pronto quando" do
 * plano: conceder `ver` de uma Lista privada a uma Equipe faz
 * `memberReachesContainer` verdadeiro para os Membros dela; revogar volta a
 * falso. Também a Concessão a um Papel e a recusa de tirar a última
 * concessão `administrar` de um contêiner privado.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { containerPath, memberReachesContainer } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Grant, List, Member, Team } from "../types";
import { concederAcesso, revogarAcesso } from "./acessos";
import { addMemberToTeam, createTeam } from "./equipes";
import { createRole } from "./papeis";

let state: DataState;
let dono: string;
let lista: List;
let equipe: Team;
let julia: Member;
let marcos: Member;
const ultimaAtividade = () => state.activity[0]!;

/** Uma Lista privada sem concessão no caminho, menos o `administrar` do Proprietário. */
function prepararListaPrivada(): List {
  const alvo = state.lists.find((l) => l.lifecycle === "ativo")!;
  alvo.isPrivate = true;
  const nos = new Set(containerPath(state, "list", alvo.id).map((n) => n.id));
  state.grants = state.grants.filter((g) => !nos.has(g.resourceId));
  state.grants.push(grant("grn_adm_dono", "member", dono, "administrar", alvo.id));
  return alvo;
}

function grant(id: string, subjectKind: Grant["subjectKind"], subjectId: string, action: Grant["action"], resourceId: string): Grant {
  return {
    id,
    workspaceId: state.workspace.id,
    subjectKind,
    subjectId,
    action,
    resourceType: "list",
    resourceId,
    scope: "subarvore",
    origin: "concessaoDireta",
    grantedBy: dono,
    grantedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  state = buildSeed();
  dono = state.workspace.ownerMemberId;
  lista = prepararListaPrivada();
  julia = state.members.find((m) => m.id === "mem_julia")!;
  marcos = state.members.find((m) => m.id === "mem_marcos")!;
  const criada = createTeam(state, dono, { nome: "Suporte" });
  if (!criada.ok) throw new Error(criada.error);
  equipe = criada.value;
  addMemberToTeam(state, dono, equipe.id, julia.id);
  addMemberToTeam(state, dono, equipe.id, marcos.id);
});

describe("concederAcesso e revogarAcesso", () => {
  it("ver de uma Lista privada a uma Equipe: os Membros dela passam a alcançá-la; revogar volta a falso", () => {
    expect(memberReachesContainer(state, julia.id, "list", lista.id)).toBe(false);
    expect(memberReachesContainer(state, marcos.id, "list", lista.id)).toBe(false);

    const r = concederAcesso(state, dono, { subjectKind: "team", subjectId: equipe.id, action: "ver", resourceType: "list", resourceId: lista.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ scope: "subarvore", origin: "concessaoDireta", grantedBy: dono });
    expect(memberReachesContainer(state, julia.id, "list", lista.id)).toBe(true);
    expect(memberReachesContainer(state, marcos.id, "list", lista.id)).toBe(true);
    expect(ultimaAtividade()).toMatchObject({
      action: "Acesso concedido",
      objectType: "list",
      objectId: lista.id,
      objectName: lista.name,
      actor: { kind: "member", id: dono },
      after: "Equipe Suporte · ver",
    });

    expect(revogarAcesso(state, dono, r.value.id).ok).toBe(true);
    expect(memberReachesContainer(state, julia.id, "list", lista.id)).toBe(false);
    expect(memberReachesContainer(state, marcos.id, "list", lista.id)).toBe(false);
    expect(ultimaAtividade()).toMatchObject({ action: "Acesso revogado", objectId: lista.id, before: "Equipe Suporte · ver" });
  });

  it("a Concessão a um Papel alcança os titulares dele", () => {
    const papel = createRole(state, dono, { nome: "Suporte", base: "membro", modulos: ["trabalho"] });
    if (!papel.ok) throw new Error(papel.error);
    julia.roleId = papel.value.id;
    const r = concederAcesso(state, dono, { subjectKind: "role", subjectId: papel.value.id, action: "ver", resourceType: "list", resourceId: lista.id });
    expect(r.ok).toBe(true);
    // Fora da Equipe, para provar que é o Papel que abre.
    state.teams.find((t) => t.id === equipe.id)!.memberIds = [];
    expect(memberReachesContainer(state, julia.id, "list", lista.id)).toBe(true);
    expect(memberReachesContainer(state, marcos.id, "list", lista.id)).toBe(false);
  });

  it("conceder o que já existe devolve a mesma Concessão e não registra de novo", () => {
    const pedido = { subjectKind: "member", subjectId: julia.id, action: "editar", resourceType: "list", resourceId: lista.id } as const;
    const a = concederAcesso(state, dono, pedido);
    const antes = state.activity.length;
    const b = concederAcesso(state, dono, pedido);
    expect(a.ok && b.ok && a.value.id === b.value.id).toBe(true);
    expect(state.activity.length).toBe(antes);
  });

  it("recusa quem não administra o contêiner, mesmo Administrador sem alcance", () => {
    const pedido = { subjectKind: "member", subjectId: julia.id, action: "ver", resourceType: "list", resourceId: lista.id } as const;
    expect(concederAcesso(state, julia.id, pedido).ok).toBe(false);
    const admin = state.members.find((m) => m.id === "mem_rafael")!;
    expect(concederAcesso(state, admin.id, pedido).ok).toBe(false);
  });

  it("recusa sujeito que não existe e Membro removido", () => {
    const removido = state.members.find((m) => m.state === "removido")!;
    expect(concederAcesso(state, dono, { subjectKind: "member", subjectId: removido.id, action: "ver", resourceType: "list", resourceId: lista.id })).toMatchObject({ ok: false, field: "sujeito" });
    expect(concederAcesso(state, dono, { subjectKind: "team", subjectId: "team_nao_existe", action: "ver", resourceType: "list", resourceId: lista.id })).toMatchObject({ ok: false, field: "sujeito" });
  });

  it("recusa tirar a última concessão administrar de um contêiner privado; com outra, deixa", () => {
    const r = revogarAcesso(state, dono, "grn_adm_dono");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("última concessão de administrar");
    expect(state.grants.some((g) => g.id === "grn_adm_dono")).toBe(true);

    const outra = concederAcesso(state, dono, { subjectKind: "member", subjectId: julia.id, action: "administrar", resourceType: "list", resourceId: lista.id });
    expect(outra.ok).toBe(true);
    expect(revogarAcesso(state, dono, "grn_adm_dono").ok).toBe(true);
  });

  it("revogar uma Concessão que não é de contêiner é recusado", () => {
    state.grants.push({ ...grant("grn_tarefa", "member", julia.id, "comentar", state.tasks[0]!.id), resourceType: "task" });
    expect(revogarAcesso(state, dono, "grn_tarefa").ok).toBe(false);
  });
});
