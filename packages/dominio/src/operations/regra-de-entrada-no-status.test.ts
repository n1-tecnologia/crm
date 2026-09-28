/**
 * A regra de ENTRADA num Status (`entryAllowedMemberIds`): só quem está na
 * lista move a Tarefa para aquele Status. Achado da jornada real de
 * 2026-09-28: no Espaço de produção, "pago" (Contas a pagar) permitia só
 * `mem_marcos_paulo` e `mem_walter`, que não eram Membros — o Status ficava
 * travado para todo mundo e a frase só mostrava os ids. A frase agora diz
 * quando a regra aponta para quem não é Membro.
 */
import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
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
      `Só ${permitidos.join(", ")} move para “pago”. Nenhum deles é Membro deste Espaço de Trabalho — ajuste a regra do Status nas configurações da Lista.`,
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
