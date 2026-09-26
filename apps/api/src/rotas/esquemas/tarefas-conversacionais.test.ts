/**
 * `esquemas/tarefas-conversacionais.ts` — testes puros, sem banco: só a
 * FORMA dos argumentos. (a) cobertura, (b) as formas LITERAIS de `apps/web`
 * passam, (c) formas hostis caem.
 */

import { describe, expect, it } from "vitest";
import { TAREFAS_CONVERSACIONAIS } from "./tarefas-conversacionais";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/tarefas-conversacionais — a forma dos args de tarefas-conversacionais.ts", () => {
  it("(a) cobertura — as 6 chaves de tarefas-conversacionais.ts em registro.ts", () => {
    const esperadas = [
      "alterarModeloDaLista",
      "definirCanaisDaLista",
      "criarTarefaConversacional",
      "trocarCanalDaTarefa",
      "vincularNegocioATarefa",
      "criarNegocioDaTarefa",
    ].sort();
    expect(Object.keys(TAREFAS_CONVERSACIONAIS).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const T = TAREFAS_CONVERSACIONAIS;
    // container-settings.tsx
    expect(T.alterarModeloDaLista.safeParse(viaJson(["lst_1", "conversacional"])).success).toBe(true);
    expect(T.definirCanaisDaLista.safeParse(viaJson(["lst_1", ["ch1", "ch2"]])).success).toBe(true);
    // conversation-thread.tsx
    expect(
      T.criarTarefaConversacional.safeParse(
        viaJson([
          {
            listId: "lst_1",
            contactId: "c1",
            channelId: "ch1",
            title: "Atender",
            assignees: [{ kind: "member", id: "m1" }],
            taskTypeId: "tt1",
          },
        ]),
      ).success,
    ).toBe(true);
    // nova-tarefa-conversacional-dialog.tsx
    expect(
      T.criarTarefaConversacional.safeParse(
        viaJson([{ listId: "lst_1", contactId: "c1", channelId: "ch1", statusId: "s1", dealId: "d1" }]),
      ).success,
    ).toBe(true);
    // tarefa-completa.tsx
    expect(T.trocarCanalDaTarefa.safeParse(viaJson(["tsk_1", "ch2"])).success).toBe(true);
    expect(T.vincularNegocioATarefa.safeParse(viaJson(["tsk_1", null])).success).toBe(true);
    expect(T.vincularNegocioATarefa.safeParse(viaJson(["tsk_1", "d1"])).success).toBe(true);
    expect(
      T.criarNegocioDaTarefa.safeParse(
        viaJson(["tsk_1", { funnelId: "f1", title: "N", value: { amount: 100, currency: "BRL" } }]),
      ).success,
    ).toBe(true);
    expect(T.criarNegocioDaTarefa.safeParse(viaJson(["tsk_1", { funnelId: "f1" }])).success).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    const T = TAREFAS_CONVERSACIONAIS;
    expect(T.alterarModeloDaLista.safeParse(["lst_1", "hibrido"]).success).toBe(false);
    expect(T.criarTarefaConversacional.safeParse([{ listId: "l", contactId: "c" }]).success).toBe(false);
    expect(T.criarTarefaConversacional.safeParse([{ listId: "l", contactId: "c", channelId: "ch", x: 1 }]).success).toBe(false);
    expect(T.vincularNegocioATarefa.safeParse(["tsk_1"]).success).toBe(false);
  });
});
