/**
 * TAR-05 no domínio (11-04, D-07, D-08, D-09): a menção na descrição avisa a
 * pessoa em Notificações, derivada do dado. `pendingMentions` devolve uma lista
 * única com as menções de Comentário e as da descrição.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { memberSeesTask, notificacoesDoMembro, pendingMentions } from "../derive";
import type { MencaoPendente } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { updateTask } from "./tasks";

const THIAGO = "mem_thiago";
const JULIA = "mem_julia";
const TAREFA = "tsk_seed_1";
const MENCAO_JULIA = { type: "member", id: JULIA } as const;
const MENCAO_THIAGO = { type: "member", id: THIAGO } as const;

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const tarefa = () => state.tasks.find((t) => t.id === TAREFA)!;
const daDescricao = (lista: MencaoPendente[], taskId = TAREFA) =>
  lista.filter((m): m is Extract<MencaoPendente, { tipo: "descricao" }> => m.tipo === "descricao" && m.task.id === taskId);

describe("menção na descrição — o caso positivo (11-04, TAR-05)", () => {
  it("a Tarefa que a Júlia vê, com @Júlia Prado na descrição, entra em pendingMentions e no total", () => {
    expect(memberSeesTask(state, JULIA, TAREFA)).toBe(true);
    const antes = notificacoesDoMembro(state, JULIA, new Date());

    const r = updateTask(state, THIAGO, TAREFA, { description: "Pedir a @Júlia Prado a revisão", descriptionMentions: [MENCAO_JULIA] });
    expect(r.ok).toBe(true);

    const entradas = daDescricao(pendingMentions(state, JULIA));
    expect(entradas).toHaveLength(1);
    expect(entradas[0]?.trecho).toContain("@Júlia Prado");

    const depois = notificacoesDoMembro(state, JULIA, new Date());
    expect(daDescricao(depois.mencoes)).toHaveLength(1);
    expect(depois.total).toBe(antes.total + 1);
  });
});
