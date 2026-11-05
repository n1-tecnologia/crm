/**
 * 12.4.1 e 12.5.3 — `createRole` e `updateRole`: cria, edita nome e módulos,
 * e recusa nome repetido, base Proprietário e edição de Papel de sistema. Cada
 * ato grava Atividade com quem, quando, antes e depois.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Member } from "../types";
import { createRole, updateRole } from "./papeis";

let state: DataState;
let dono: string;
const base = (m: Member) => state.roles.find((r) => r.id === m.roleId)?.base;
const comum = () => state.members.find((m) => m.state === "ativo" && base(m) === "membro")!;
const admin = () => state.members.find((m) => m.state === "ativo" && base(m) === "administrador")!;
const ultimaAtividade = () => state.activity[0]!;

beforeEach(() => {
  state = buildSeed();
  dono = state.workspace.ownerMemberId;
});

describe("createRole", () => {
  it("cria o Papel com base e módulos, sem lista de permissões, e grava a Atividade", () => {
    const antes = state.activity.length;
    const r = createRole(state, dono, { nome: "  Comercial  ", base: "membro", modulos: ["crm", "trabalho"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ name: "Comercial", base: "membro", system: false, permissions: [], modulos: ["trabalho", "crm"] });
    expect(state.roles).toContain(r.value);
    expect(state.activity.length).toBe(antes + 1);
    const a = ultimaAtividade();
    expect(a).toMatchObject({ action: "Papel personalizado criado", objectType: "role", objectId: r.value.id, actor: { kind: "member", id: dono } });
    expect(a.after).toBe("Comercial · Base: Membro · Módulos: Trabalho, CRM");
    expect(a.at).toBeTruthy();
  });

  it("um Administrador ativo também cria", () => {
    expect(createRole(state, admin().id, { nome: "Financeiro", base: "convidado", modulos: ["financeiro"] }).ok).toBe(true);
  });

  it("recusa nome repetido, inclusive o de um Papel de sistema e com outra caixa", () => {
    createRole(state, dono, { nome: "Comercial", base: "membro", modulos: ["crm"] });
    const repetido = createRole(state, dono, { nome: "comercial", base: "membro", modulos: ["crm"] });
    expect(repetido).toMatchObject({ ok: false, field: "nome" });
    expect(createRole(state, dono, { nome: "Administrador", base: "membro", modulos: ["crm"] })).toMatchObject({ ok: false, field: "nome" });
  });

  it("recusa base Proprietário", () => {
    const r = createRole(state, dono, { nome: "Dono 2", base: "proprietario", modulos: ["trabalho"] });
    expect(r).toMatchObject({ ok: false, field: "base" });
  });

  it("recusa nome vazio e Papel sem nenhum módulo", () => {
    expect(createRole(state, dono, { nome: "   ", base: "membro", modulos: ["crm"] })).toMatchObject({ ok: false, field: "nome" });
    expect(createRole(state, dono, { nome: "Vazio", base: "membro", modulos: [] })).toMatchObject({ ok: false, field: "modulos" });
  });

  it("recusa quem não é Administrador nem Proprietário, e o Administrador suspenso", () => {
    const antes = state.roles.length;
    expect(createRole(state, comum().id, { nome: "X", base: "membro", modulos: ["crm"] }).ok).toBe(false);
    const adm = admin();
    adm.state = "suspenso";
    expect(createRole(state, adm.id, { nome: "Y", base: "membro", modulos: ["crm"] }).ok).toBe(false);
    expect(state.roles.length).toBe(antes);
  });
});

describe("updateRole", () => {
  it("edita nome e módulos; a base não muda; a Atividade guarda antes e depois", () => {
    const criado = createRole(state, dono, { nome: "Comercial", base: "membro", modulos: ["crm"] });
    if (!criado.ok) throw new Error(criado.error);
    const r = updateRole(state, dono, criado.value.id, { nome: "Vendas B2B", modulos: ["trabalho", "crm", "paineis"] });
    expect(r.ok).toBe(true);
    const papel = state.roles.find((x) => x.id === criado.value.id)!;
    expect(papel).toMatchObject({ name: "Vendas B2B", base: "membro", modulos: ["trabalho", "crm", "paineis"] });
    const a = ultimaAtividade();
    expect(a).toMatchObject({ action: "Papel personalizado alterado", objectId: papel.id, actor: { kind: "member", id: dono } });
    expect(a.before).toBe("Comercial · Base: Membro · Módulos: CRM");
    expect(a.after).toBe("Vendas B2B · Base: Membro · Módulos: Trabalho, CRM, Painéis");
  });

  it("o Papel personalizado de antes da Sessão 12 (sem módulos) ganha módulos na edição", () => {
    const vendas = state.roles.find((r) => !r.system && r.modulos === undefined)!;
    expect(updateRole(state, dono, vendas.id, { modulos: ["crm"] }).ok).toBe(true);
    expect(state.roles.find((r) => r.id === vendas.id)!.modulos).toEqual(["crm"]);
  });

  it("recusa editar Papel de sistema", () => {
    const sistema = state.roles.find((r) => r.system && r.base === "membro")!;
    expect(updateRole(state, dono, sistema.id, { nome: "Outro nome" })).toMatchObject({ ok: false });
    expect(state.roles.find((r) => r.id === sistema.id)!.name).toBe(sistema.name);
  });

  it("recusa renomear para o nome de outro Papel, mas aceita manter o próprio", () => {
    const criado = createRole(state, dono, { nome: "Comercial", base: "membro", modulos: ["crm"] });
    if (!criado.ok) throw new Error(criado.error);
    expect(updateRole(state, dono, criado.value.id, { nome: "Membro" })).toMatchObject({ ok: false, field: "nome" });
    expect(updateRole(state, dono, criado.value.id, { nome: "COMERCIAL" }).ok).toBe(true);
  });

  it("sem mudança, nada é registrado", () => {
    const criado = createRole(state, dono, { nome: "Comercial", base: "membro", modulos: ["crm"] });
    if (!criado.ok) throw new Error(criado.error);
    const antes = state.activity.length;
    expect(updateRole(state, dono, criado.value.id, { nome: "Comercial", modulos: ["crm"] }).ok).toBe(true);
    expect(state.activity.length).toBe(antes);
  });

  it("recusa quem não governa", () => {
    const criado = createRole(state, dono, { nome: "Comercial", base: "membro", modulos: ["crm"] });
    if (!criado.ok) throw new Error(criado.error);
    expect(updateRole(state, comum().id, criado.value.id, { nome: "Outro" }).ok).toBe(false);
  });
});
