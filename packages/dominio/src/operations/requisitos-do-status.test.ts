/**
 * RELO-04 — requisitos de ENTRADA e "só vindo de" editados por `updateStatus`,
 * e aplicados por `changeTaskStatus`. Antes só o seed do Financeiro os
 * definia; a tela mostrava e não editava.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { containerAdminRefusal } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { createFieldDefinition, updateStatus } from "./configuration";
import { CP } from "./financeiro";
import { changeTaskStatus, setTaskFieldValue } from "./tasks";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const configurador = () => {
  const id = state.members.find((m) => m.state === "ativo" && !containerAdminRefusal(state, m.id, "list", CP.listId))?.id;
  if (!id) throw new Error("seed sem quem configure Contas a pagar");
  return id;
};
const pago = () => state.lists.find((l) => l.id === CP.listId)?.statusSet?.definitions.find((d) => d.id === CP.status.pago);
const contaAprovada = () => {
  const conta = state.tasks.find((t) => t.listId === CP.listId && t.lifecycle === "ativo");
  if (!conta) throw new Error("seed sem conta a pagar");
  conta.statusId = CP.status.aprovado;
  return conta;
};

describe("updateStatus — requisitos de entrada e só vindo de", () => {
  it("grava os requisitos de entrada, nomeia a mudança e `[]` apaga", () => {
    const quem = configurador();
    // Abre "pago" para quem configura, para o teste olhar só os requisitos.
    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryAllowedMemberIds: [] }).ok).toBe(true);
    const campo = createFieldDefinition(state, quem, { name: "Comprovante de teste", type: "text", definedAtType: "list", definedAtId: CP.listId });
    if (!campo.ok) throw new Error(campo.error);
    const r = updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryRequirements: [{ definitionId: campo.value.id }, { attribute: "dueDate" }] });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(pago()?.entryRequirements).toEqual([{ definitionId: campo.value.id }, { attribute: "dueDate" }]);
    expect(state.activity[0]?.detail).toContain("requisitos de entrada");

    // A regra vale na hora de mover: a conta sem o Campo não entra em "pago".
    const conta = contaAprovada();
    conta.fieldValues = conta.fieldValues.filter((v) => v.definitionId !== campo.value.id);
    // Sai de "aprovado" sem exigência de saída que atrapalhe (o seed exige dados para sair de "para pagar", não daqui).
    const bloqueada = changeTaskStatus(state, quem, conta.id, CP.status.pago);
    expect(bloqueada.ok).toBe(false);
    if (!bloqueada.ok) expect(bloqueada.error).toContain("Para entrar em “pago” falta: Comprovante de teste");
    expect(setTaskFieldValue(state, quem, conta.id, campo.value.id, "ok").ok).toBe(true);
    const ainda = changeTaskStatus(state, quem, conta.id, CP.status.pago);
    // Pode faltar a data de vencimento; o que importa é que o Campo já não falta.
    if (!ainda.ok) expect(ainda.error).not.toContain("Comprovante de teste");

    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryRequirements: [] }).ok).toBe(true);
    expect(pago()?.entryRequirements).toBeUndefined();
  });

  it("recusa requisito malformado ou com Campo inexistente, sem gravar", () => {
    const quem = configurador();
    const antes = JSON.stringify(pago()?.entryRequirements);
    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryRequirements: [{}] }).ok).toBe(false);
    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryRequirements: [{ definitionId: "fd_nao_existe" }] }).ok).toBe(false);
    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryRequirements: [{ attribute: "dueDate", whenDefinitionId: "fd_x" }] }).ok).toBe(false);
    expect(JSON.stringify(pago()?.entryRequirements)).toBe(antes);
  });

  it("“só vindo de” exige Status do Conjunto, não o próprio, e é aplicado ao mover", () => {
    const quem = configurador();
    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryAllowedMemberIds: [], exitRequirements: [], entryRequirements: [] }).ok).toBe(true);
    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryFromStatusIds: [CP.status.pago] }).ok).toBe(false);
    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryFromStatusIds: ["st_de_outro_conjunto"] }).ok).toBe(false);
    const r = updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryFromStatusIds: [CP.status.paraPagar, CP.status.paraPagar] });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(pago()?.entryFromStatusIds).toEqual([CP.status.paraPagar]);
    expect(state.activity[0]?.detail).toContain("só vindo de");

    const conta = contaAprovada();
    const bloqueada = changeTaskStatus(state, quem, conta.id, CP.status.pago);
    expect(bloqueada.ok).toBe(false);
    if (!bloqueada.ok) expect(bloqueada.error).toContain("só recebe Tarefas vindas de");

    expect(updateStatus(state, quem, "list", CP.listId, CP.status.pago, { entryFromStatusIds: [] }).ok).toBe(true);
    expect(pago()?.entryFromStatusIds).toBeUndefined();
  });

  it("exige quem configura o contêiner", () => {
    const outro = state.members.find((m) => m.state === "ativo" && containerAdminRefusal(state, m.id, "list", CP.listId) !== undefined);
    if (!outro) throw new Error("seed sem Membro que não configure");
    expect(updateStatus(state, outro.id, "list", CP.listId, CP.status.pago, { entryRequirements: [] }).ok).toBe(false);
  });
});
