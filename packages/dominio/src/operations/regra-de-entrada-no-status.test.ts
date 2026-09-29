/**
 * A regra de ENTRADA num Status (`entryAllowedMemberIds`): só quem está na
 * lista move a Tarefa para aquele Status. Achado da jornada real de
 * 2026-09-28: no Espaço de produção, "pago" (Contas a pagar) permitia só
 * `mem_marcos_paulo` e `mem_walter`, que não eram Membros — o Status ficava
 * travado para todo mundo e a frase só mostrava os ids. A frase agora diz
 * quando a regra aponta para quem não é Membro.
 */
import { describe, expect, it } from "vitest";
import { containerAdminRefusal } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { updateStatus } from "./configuration";
import { CP } from "./financeiro";
import { statusOptionRefusal } from "./tasks";

function contaAprovada(state: DataState) {
  const conta = state.tasks.find((t) => t.listId === CP.listId);
  if (!conta) throw new Error("seed sem conta a pagar");
  conta.statusId = CP.status.aprovado;
  return conta;
}

function regraDoPago(state: DataState): readonly string[] {
  const lista = state.lists.find((l) => l.id === CP.listId);
  const pago = lista?.statusSet?.definitions.find((d) => d.id === CP.status.pago);
  return pago?.entryAllowedMemberIds ?? [];
}

describe("regra de entrada no Status — quem pode mover", () => {
  it("com os Membros da regra no Espaço: nomeia quem pode, sem aviso", () => {
    const state = buildSeed();
    const conta = contaAprovada(state);
    const permitidos = regraDoPago(state);
    expect(permitidos.length).toBeGreaterThan(0);
    const nomes = permitidos.map((id) => state.members.find((m) => m.id === id)?.displayName);
    const frase = statusOptionRefusal(state, CP.financeiroId, conta, CP.status.pago);
    expect(frase).toBe(`Só ${nomes.join(", ")} move para “pago”.`);
  });

  it("nenhum Membro da regra existe no Espaço: diz que a regra trava o Status para todo mundo", () => {
    const state = buildSeed();
    const conta = contaAprovada(state);
    const permitidos = regraDoPago(state);
    state.members = state.members.filter((m) => !permitidos.includes(m.id));
    const frase = statusOptionRefusal(state, CP.financeiroId, conta, CP.status.pago);
    expect(frase).toBe(
      `Só ${permitidos.join(", ")} move para “pago”. Nenhum deles é Membro deste Espaço de Trabalho — ajuste em Configurações da Lista → Status → “Quem pode mover para cá”.`,
    );
  });

  it("parte da regra não existe: nomeia quem existe e aponta quem falta", () => {
    const state = buildSeed();
    const conta = contaAprovada(state);
    const permitidos = regraDoPago(state);
    expect(permitidos.length).toBeGreaterThan(1);
    const [fica, ...saem] = permitidos;
    state.members = state.members.filter((m) => !saem.includes(m.id));
    const nomeDoQueFica = state.members.find((m) => m.id === fica)?.displayName;
    const frase = statusOptionRefusal(state, CP.financeiroId, conta, CP.status.pago);
    expect(frase).toBe(
      `Só ${[nomeDoQueFica, ...saem].join(", ")} move para “pago”. (${saem.join(", ")} não ${saem.length === 1 ? "é Membro" : "são Membros"} deste Espaço de Trabalho.)`,
    );
  });
});

/**
 * Quem pode mover para o Status, editado pela tela ("Quem pode mover para
 * cá", `updateStatus`): antes só o seed escrevia a regra, e o dono do `ws_n1`
 * pediu em 2026-09-29 que todo mundo pudesse mudar os Status.
 */
describe("regra de entrada no Status — quem configura a Lista a muda", () => {
  const configurador = (state: DataState) => {
    const id = state.members.find((m) => m.state === "ativo" && !containerAdminRefusal(state, m.id, "list", CP.listId))?.id;
    if (!id) throw new Error("seed sem quem configure Contas a pagar");
    return id;
  };
  const alteracoesDaLista = (state: DataState) =>
    state.activity.filter((a) => a.objectId === CP.listId && a.action === "Status alterado na configuração");

  it("`[]` abre o Status: a regra some e qualquer pessoa move, com o antes e o depois no Registro", () => {
    const state = buildSeed();
    const conta = contaAprovada(state);
    const antes = regraDoPago(state);
    expect(statusOptionRefusal(state, CP.financeiroId, conta, CP.status.pago)).toBeDefined();
    const r = updateStatus(state, configurador(state), "list", CP.listId, CP.status.pago, { entryAllowedMemberIds: [] });
    expect(r.ok).toBe(true);
    expect(regraDoPago(state)).toEqual([]);
    expect(statusOptionRefusal(state, CP.financeiroId, conta, CP.status.pago)).toBeUndefined();
    const nomes = antes.map((id) => state.members.find((m) => m.id === id)?.displayName ?? id).join(", ");
    expect(alteracoesDaLista(state)[0]?.detail).toBe(`quem move para “pago”: ${nomes} → qualquer pessoa`);
  });

  it("restringe a quem é Membro: só a pessoa escolhida move", () => {
    const state = buildSeed();
    const conta = contaAprovada(state);
    const r = updateStatus(state, configurador(state), "list", CP.listId, CP.status.pago, { entryAllowedMemberIds: [CP.financeiroId, CP.financeiroId] });
    expect(r.ok).toBe(true);
    expect(regraDoPago(state)).toEqual([CP.financeiroId]);
    expect(statusOptionRefusal(state, CP.financeiroId, conta, CP.status.pago)).toBeUndefined();
    const outro = state.members.find((m) => m.id !== CP.financeiroId && m.state === "ativo");
    expect(outro).toBeDefined();
    expect(statusOptionRefusal(state, outro!.id, conta, CP.status.pago)).toMatch(/^Só .* move para “pago”\.$/);
  });

  it("recusa quem não é Membro (ou foi removido) e não grava nada", () => {
    const state = buildSeed();
    const antes = regraDoPago(state);
    const quem = configurador(state);
    const inexistente = updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryAllowedMemberIds: ["mem_ninguem"] });
    expect(inexistente.ok).toBe(false);
    if (!inexistente.ok) expect(inexistente.error).toBe("Só Membros deste Espaço de Trabalho entram na regra — mem_ninguem não é.");
    const removido = state.members.find((m) => m.id !== quem && m.state === "ativo");
    removido!.state = "removido";
    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryAllowedMemberIds: [removido!.id] }).ok).toBe(false);
    expect(regraDoPago(state)).toEqual(antes);
    expect(alteracoesDaLista(state)).toHaveLength(0);
  });

  it("só quem configura a Lista muda a regra", () => {
    const state = buildSeed();
    const semPermissao = state.members.find((m) => m.state === "ativo" && containerAdminRefusal(state, m.id, "list", CP.listId));
    expect(semPermissao).toBeDefined();
    const r = updateStatus(state, semPermissao!.id, "list", CP.listId, CP.status.pago, { entryAllowedMemberIds: [] });
    expect(r.ok).toBe(false);
    expect(regraDoPago(state).length).toBeGreaterThan(0);
  });

  it("a mesma regra de novo não grava Registro", () => {
    const state = buildSeed();
    const r = updateStatus(state, configurador(state), "list", CP.listId, CP.status.pago, { entryAllowedMemberIds: [...regraDoPago(state)] });
    expect(r.ok).toBe(true);
    expect(alteracoesDaLista(state)).toHaveLength(0);
  });
});
