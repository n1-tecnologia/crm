/**
 * 09-21 — quem pode remover um Membro. `removeMember` não olhava quem chama
 * (LACUNA do 09-09): qualquer Membro, Convidado incluído, removia outro e
 * escolhia o Sucessor que herda os registros dele. Agora só um Administrador ou
 * o Proprietário ATIVO remove — a mesma recusa de `inviteMember`,
 * `alterarPapelDoMembro`, `deleteRole` e `grantGovernanceAccess` (Papel base
 * `administrador` ou `proprietario`), mais o estado `ativo` de quem chama —, e
 * o Proprietário continua sem poder ser removido.
 *
 * Seed: mem_thiago é o Proprietário, mem_rafael é Administrador, mem_julia e
 * mem_marcos têm o Papel `role_vendas` (base membro), mem_beatriz é Convidada.
 * O alvo é sempre mem_marcos, que tem registros para passar ao Sucessor.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { removeMember } from "./members";

const PROPRIETARIO = "mem_thiago";
const ADMINISTRADOR = "mem_rafael";
const COMUM = "mem_julia";
const CONVIDADO = "mem_beatriz";
const ALVO = "mem_marcos";
const SUCESSOR = "mem_rafael";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const membro = (id: string) => {
  const m = state.members.find((x) => x.id === id);
  if (!m) throw new Error(`o seed precisa do Membro ${id}`);
  return m;
};

/** A operação recusada não grava nada: nem o Membro, nem os registros que passariam ao Sucessor, nem Atividade. */
function recusaSemGravar(quem: string, alvo = ALVO, sucessor = SUCESSOR): string {
  const antes = structuredClone(state);
  const r = removeMember(state, quem, alvo, sucessor);
  expect(r.ok, `${quem} removendo ${alvo}`).toBe(false);
  if (r.ok) throw new Error("deveria recusar");
  expect(state).toEqual(antes);
  return r.error;
}

describe("removeMember — quem chama (09-21)", () => {
  it("o Convidado não remove outro Membro, nem escolhendo a si mesmo ou outro como Sucessor", () => {
    expect(recusaSemGravar(CONVIDADO)).toContain("Só um Administrador ou o Proprietário");
    expect(recusaSemGravar(CONVIDADO, ALVO, COMUM)).toContain("Só um Administrador ou o Proprietário");
    expect(membro(ALVO).state).toBe("ativo");
  });

  it("o Membro comum não remove outro Membro", () => {
    expect(recusaSemGravar(COMUM)).toContain("Só um Administrador ou o Proprietário");
    expect(recusaSemGravar(COMUM, ALVO, COMUM)).toContain("Só um Administrador ou o Proprietário");
    expect(membro(ALVO).state).toBe("ativo");
  });

  it("o Membro suspenso não remove — nem o comum, nem o Administrador suspenso", () => {
    membro(COMUM).state = "suspenso";
    expect(recusaSemGravar(COMUM)).toContain("Só um Administrador ou o Proprietário");
    membro(ADMINISTRADOR).state = "suspenso";
    expect(recusaSemGravar(ADMINISTRADOR, ALVO, PROPRIETARIO)).toContain("ativo");
    membro(PROPRIETARIO).state = "suspenso";
    expect(recusaSemGravar(PROPRIETARIO, ALVO, COMUM)).toContain("ativo");
    expect(membro(ALVO).state).toBe("ativo");
  });

  it("quem chama precisa existir no Espaço de Trabalho", () => {
    expect(recusaSemGravar("mem_que_nao_existe")).toContain("Só um Administrador ou o Proprietário");
    expect(membro(ALVO).state).toBe("ativo");
  });

  it("o Administrador remove, e os registros do removido passam ao Sucessor", () => {
    const ownedBefore = state.automations.filter((a) => a.ownerMemberId === ALVO).length;
    expect(ownedBefore).toBeGreaterThan(0);
    const r = removeMember(state, ADMINISTRADOR, ALVO, PROPRIETARIO);
    expect(r.ok).toBe(true);
    expect(membro(ALVO).state).toBe("removido");
    expect(membro(ALVO).successorId).toBe(PROPRIETARIO);
    expect(state.automations.filter((a) => a.ownerMemberId === ALVO)).toHaveLength(0);
    expect(state.automations.filter((a) => a.ownerMemberId === PROPRIETARIO).length).toBeGreaterThanOrEqual(ownedBefore);
    // A autoria da Atividade é de quem agiu.
    expect(state.activity.some((a) => a.actor.id === ADMINISTRADOR)).toBe(true);
  });

  it("o Proprietário remove", () => {
    const r = removeMember(state, PROPRIETARIO, ALVO, SUCESSOR);
    expect(r.ok).toBe(true);
    expect(membro(ALVO).state).toBe("removido");
    expect(membro(ALVO).successorId).toBe(SUCESSOR);
  });

  it("ninguém remove o Proprietário: nem o Administrador, nem ele mesmo", () => {
    expect(state.workspace.ownerMemberId).toBe(PROPRIETARIO);
    expect(recusaSemGravar(ADMINISTRADOR, PROPRIETARIO, COMUM)).toContain("Transfira a propriedade");
    expect(recusaSemGravar(PROPRIETARIO, PROPRIETARIO, ADMINISTRADOR)).toContain("Transfira a propriedade");
    expect(recusaSemGravar(COMUM, PROPRIETARIO, COMUM)).toContain("Só um Administrador ou o Proprietário");
    expect(recusaSemGravar(CONVIDADO, PROPRIETARIO, CONVIDADO)).toContain("Só um Administrador ou o Proprietário");
    expect(membro(PROPRIETARIO).state).toBe("ativo");
  });

  it("as recusas anteriores seguem valendo para quem pode: Sucessor Convidado ou inexistente continua recusado", () => {
    expect(removeMember(state, ADMINISTRADOR, ALVO, CONVIDADO)).toMatchObject({ ok: false, field: "sucessor" });
    expect(removeMember(state, ADMINISTRADOR, ALVO, "mem_que_nao_existe")).toMatchObject({ ok: false, field: "sucessor" });
    expect(membro(ALVO).state).toBe("ativo");
  });
});
