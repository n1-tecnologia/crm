/**
 * PAG-06 — a Pessoa da conta enxerga a Tarefa em que ela é o valor do Campo
 * Pessoa, e nenhuma outra. A visibilidade é DERIVADA do dado: ninguém escreve
 * uma Grant, logo não há Grant a revogar quando o fornecedor muda.
 *
 * O caso que decide o requisito é o NEGATIVO. Um arquivo que só provasse o
 * positivo (“o Pedro vê a conta do Pedro”) passaria igualzinho num sistema que
 * mostra tudo a todos — é a recusa (“o Lucas NÃO vê a conta do Pedro”) que
 * separa uma regra de permissão de um `return true`.
 *
 * A regra mora na Lista, como dado: `List.sharedWithDefinitionIds` declara
 * quais Campos nomeiam quem enxerga. `guestEditableDefinitionIds` já dizia o
 * QUE o Convidado edita; esta diz QUEM ele é.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { memberNamedOnTask, memberReachesContainer, memberSeesTask } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { CP, CR } from "./financeiro";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const F = CP.fields;

/** Pedro Alencar e Lucas Ferraz: dois Convidados, duas contas, um Campo Pessoa. */
const PEDRO = "mem_thiago_pereira";
const LUCAS = "mem_joao_konq";

const conta = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};
const lista = () => {
  const l = state.lists.find((x) => x.id === CP.listId);
  if (!l) throw new Error("sem Lista de Contas a pagar");
  return l;
};
const grantsSobre = (taskId: string) => state.grants.filter((g) => g.resourceId === taskId);
const campo = (t: Task, definitionId: string) =>
  t.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;

describe("PAG-06 — a Pessoa da conta enxerga a própria conta por ser a Pessoa da conta", () => {
  it("a Lista declara o Campo Pessoa, e o seed não escreve nenhuma Grant de Pessoa à mão", () => {
    expect(lista().sharedWithDefinitionIds).toEqual([F.pessoa]);
    expect(state.grants.some((g) => g.id.startsWith("gr_cp_pessoa"))).toBe(false);
  });

  it("positivo, e por dentro do mecanismo certo: o Pedro vê a conta dele SEM nenhuma Grant sobre a Tarefa", () => {
    const minha = conta("tsk_cp_thiago_out");
    expect(campo(minha, F.pessoa)).toBe(PEDRO);
    // Não é “vê porque alguém concedeu”: não há concessão nenhuma nesta Tarefa.
    expect(grantsSobre(minha.id).length).toBe(0);
    expect(memberSeesTask(state, PEDRO, minha.id)).toBe(true);
    expect(memberNamedOnTask(state, PEDRO, minha)).toBe(true);
  });

  it("NEGATIVO nos dois sentidos — é este caso que decide o requisito (T-3-01)", () => {
    const doPedro = conta("tsk_cp_thiago_out");
    const doLucas = conta("tsk_cp_konq");
    expect(campo(doLucas, F.pessoa)).toBe(LUCAS);
    // E a recusa é pelo VALOR do Campo, não por falta de linha em state.grants:
    // nenhuma das duas Tarefas tem Grant alguma, e ainda assim cada um vê só a sua.
    expect(grantsSobre(doLucas.id).length).toBe(0);
    expect(memberSeesTask(state, LUCAS, doPedro.id)).toBe(false);
    expect(memberNamedOnTask(state, LUCAS, doPedro)).toBe(false);
    expect(memberSeesTask(state, PEDRO, doLucas.id)).toBe(false);
    expect(memberNamedOnTask(state, PEDRO, doLucas)).toBe(false);
    // E cada um continua vendo a sua.
    expect(memberSeesTask(state, PEDRO, doPedro.id)).toBe(true);
    expect(memberSeesTask(state, LUCAS, doLucas.id)).toBe(true);
  });

  it("NEGATIVO estrutural: derivar por Campo abre UMA Tarefa a UM Membro nomeado — não abre a Lista a ninguém", () => {
    // Rafael é Administrador, o Papel mais forte sem concessão no caminho; a
    // Lista de Contas a pagar continua invisível para ele, e a Tarefa também.
    expect(memberReachesContainer(state, "mem_rafael", "list", CP.listId)).toBe(false);
    expect(memberSeesTask(state, "mem_rafael", "tsk_cp_thiago_out")).toBe(false);
    // Júlia é Membro: mesmo resultado.
    expect(memberReachesContainer(state, "mem_julia", "list", CP.listId)).toBe(false);
    expect(memberSeesTask(state, "mem_julia", "tsk_cp_thiago_out")).toBe(false);
    // E quem administra a Lista continua alcançando-a como antes.
    expect(memberReachesContainer(state, CP.financeiroId, "list", CP.listId)).toBe(true);
  });

  it("guarda de tipo (T-3-11): só Campo `person` abre Tarefa — um texto igual a um id de Membro não abre nada", () => {
    const outra = conta("tsk_cp_aluguel_out");
    expect(memberSeesTask(state, PEDRO, outra.id)).toBe(false);
    // Um Campo de texto declarado como porta de entrada, com o id do Pedro
    // digitado dentro: a tentativa de elevação de privilégio, montada à mão.
    lista().sharedWithDefinitionIds = [F.pessoa, F.nomeFornecedor];
    const texto = outra.fieldValues.find((v) => v.definitionId === F.nomeFornecedor && v.state === "ativo");
    if (!texto) throw new Error("sem Nome do fornecedor");
    texto.value = PEDRO;
    expect(state.fieldDefinitions.find((d) => d.id === F.nomeFornecedor)?.type).toBe("text");
    expect(memberNamedOnTask(state, PEDRO, outra)).toBe(false);
    expect(memberSeesTask(state, PEDRO, outra.id)).toBe(false);
  });

  it("Lista que não declara nada se comporta exatamente como antes (Contas a receber)", () => {
    const cr = state.lists.find((l) => l.id === CR.listId);
    expect(cr?.sharedWithDefinitionIds).toBeUndefined();
    // Os mesmos valores de contas-a-receber.test.ts: a Comercial vê a conta do
    // cliente dela por Grant, e não a do cliente do Rafael.
    expect(memberSeesTask(state, CR.comercialId, "tsk_cr_gab_2")).toBe(true);
    expect(memberSeesTask(state, CR.comercialId, "tsk_cr_dai_1")).toBe(false);
  });
});

