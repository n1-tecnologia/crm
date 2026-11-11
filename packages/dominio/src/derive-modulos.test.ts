/**
 * 12.2.1 — `membroAcessaModulo`: o Papel libera o módulo (ausente = todos) e,
 * no Financeiro, o alcance à Pasta continua valendo por cima do Papel.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { memberReachesContainer } from "./derive";
import { MODULOS, membroAcessaModulo, modulosDoPapel } from "./derive-modulos";
import { CP } from "./operations/financeiro-base";
import { buildSeed } from "./seed";
import type { DataState } from "./state";
import type { Member, Modulo, Role } from "./types";

let state: DataState;

beforeEach(() => {
  state = buildSeed();
});

/** Troca o Papel do Membro por um Papel personalizado novo com estes módulos. */
function comPapel(membro: Member, modulos: readonly Modulo[] | undefined): void {
  const papel: Role = {
    id: `role_teste_${state.roles.length}`,
    workspaceId: state.workspace.id,
    name: `Teste ${state.roles.length}`,
    system: false,
    base: "membro",
    permissions: [],
    ...(modulos ? { modulos } : {}),
  };
  state.roles.push(papel);
  membro.roleId = papel.id;
}

const ativoQueAlcancaAPasta = (): Member =>
  state.members.find((m) => m.state === "ativo" && memberReachesContainer(state, m.id, "folder", CP.folderId))!;

const ativoQueNaoAlcancaAPasta = (): Member =>
  state.members.find((m) => m.state === "ativo" && !memberReachesContainer(state, m.id, "folder", CP.folderId))!;

describe("membroAcessaModulo", () => {
  it("Papel com modulos [trabalho] não acessa o CRM, e acessa Trabalho", () => {
    const membro = ativoQueAlcancaAPasta();
    comPapel(membro, ["trabalho"]);
    expect(membroAcessaModulo(state, membro.id, "crm")).toBe(false);
    expect(membroAcessaModulo(state, membro.id, "trabalho")).toBe(true);
  });

  it("Papel sem modulos acessa os seis (quem alcança a Pasta, inclusive o Financeiro)", () => {
    const membro = ativoQueAlcancaAPasta();
    comPapel(membro, undefined);
    for (const modulo of MODULOS) expect(membroAcessaModulo(state, membro.id, modulo)).toBe(true);
  });

  it("Papel com financeiro, sem alcance à Pasta, não acessa o Financeiro", () => {
    const membro = ativoQueNaoAlcancaAPasta();
    comPapel(membro, ["trabalho", "financeiro"]);
    expect(membroAcessaModulo(state, membro.id, "financeiro")).toBe(false);
    expect(membroAcessaModulo(state, membro.id, "trabalho")).toBe(true);
  });

  it("alcance à Pasta não basta: Papel sem financeiro não acessa o Financeiro", () => {
    const membro = ativoQueAlcancaAPasta();
    comPapel(membro, ["trabalho", "crm"]);
    expect(membroAcessaModulo(state, membro.id, "financeiro")).toBe(false);
  });

  it("Membro ou Papel que não existe: nada", () => {
    expect(membroAcessaModulo(state, "mem_nao_existe", "trabalho")).toBe(false);
    const membro = ativoQueAlcancaAPasta();
    membro.roleId = "role_nao_existe";
    expect(membroAcessaModulo(state, membro.id, "trabalho")).toBe(false);
  });

  it("modulosDoPapel devolve na ordem do trilho, qualquer que seja a ordem gravada", () => {
    expect(modulosDoPapel({ modulos: ["financeiro", "trabalho", "crm"] })).toEqual(["trabalho", "crm", "financeiro"]);
    expect(modulosDoPapel({})).toEqual(MODULOS);
  });
});
