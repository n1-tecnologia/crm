/**
 * `esquemas/tarefas-conversacionais.ts` — testes puros, sem banco: só a
 * FORMA dos argumentos. (a) cobertura, (b) as formas LITERAIS de `apps/web`
 * passam, (c) formas hostis caem.
 *
 * Só no deploy da Fase 15 (D-01): as quatro operações antigas da Tarefa
 * conversacional saíram do registro; a Tarefa nasce e muda pelas rotas
 * `/tarefas-conversacionais`.
 */

import { describe, expect, it } from "vitest";
import { TAREFAS_CONVERSACIONAIS } from "./tarefas-conversacionais";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/tarefas-conversacionais — a forma dos args de tarefas-conversacionais.ts", () => {
  it("(a) cobertura — as 2 chaves de tarefas-conversacionais.ts em registro.ts (as quatro da Tarefa saíram em 14-17)", () => {
    const esperadas = ["alterarModeloDaLista", "definirCanaisDaLista"].sort();
    expect(Object.keys(TAREFAS_CONVERSACIONAIS).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const T = TAREFAS_CONVERSACIONAIS;
    // container-settings.tsx
    expect(T.alterarModeloDaLista.safeParse(viaJson(["lst_1", "conversacional"])).success).toBe(true);
    expect(T.definirCanaisDaLista.safeParse(viaJson(["lst_1", ["ch1", "ch2"]])).success).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    const T = TAREFAS_CONVERSACIONAIS;
    expect(T.alterarModeloDaLista.safeParse(["lst_1", "hibrido"]).success).toBe(false);
    expect(T.definirCanaisDaLista.safeParse(["lst_1"]).success).toBe(false);
  });

  it("(d) 3.3.7 — definirCanaisDaLista aceita o Canal[] opcional da execução local, limitado em tamanho", () => {
    const T = TAREFAS_CONVERSACIONAIS;
    const canal = { id: "can_1", nome: "WhatsApp", tipo: "whatsapp", estado: "ativo" };
    expect(T.definirCanaisDaLista.safeParse(viaJson(["lst_1", ["can_1"], [canal]])).success).toBe(true);
    expect(T.definirCanaisDaLista.safeParse(viaJson(["lst_1", ["can_1"], []])).success).toBe(true);
    // Sem o terceiro argumento, a forma de antes segue valendo.
    expect(T.definirCanaisDaLista.safeParse(viaJson(["lst_1", ["can_1"]])).success).toBe(true);
    // Mais de 100 itens, um quarto elemento e um item sem id caem.
    const cem = Array.from({ length: 100 }, (_, i) => ({ id: `can_${i}` }));
    expect(T.definirCanaisDaLista.safeParse(viaJson(["lst_1", ["can_1"], cem])).success).toBe(true);
    expect(T.definirCanaisDaLista.safeParse(viaJson(["lst_1", ["can_1"], [...cem, { id: "can_x" }]])).success).toBe(false);
    expect(T.definirCanaisDaLista.safeParse(viaJson(["lst_1", ["can_1"], [canal], "extra"])).success).toBe(false);
    expect(T.definirCanaisDaLista.safeParse(viaJson(["lst_1", ["can_1"], [{ nome: "sem id" }]])).success).toBe(false);
  });
});
