/**
 * O seed do produto é o seed completo sem os Espaços de demonstração: nada
 * do que sobra pode apontar para o que saiu.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { buildProductSeed } from "./seed-produto";

const idsOf = (state: object): Set<string> => {
  const ids = new Set<string>();
  for (const value of Object.values(state)) {
    if (!Array.isArray(value)) continue;
    for (const record of value) if (record && typeof record.id === "string") ids.add(record.id);
  }
  return ids;
};

describe("seed do produto", () => {
  it("só Comercial (Meus negócios + atalho Caixa de entrada) e Gestão (Financeiro › Contas a pagar e a receber)", () => {
    const state = buildProductSeed();
    expect(state.spaces.map((s) => s.name)).toEqual(["Comercial", "Gestão"]);
    expect(state.folders.map((f) => f.name).sort()).toEqual(["Financeiro", "Meus negócios"]);
    expect(state.lists.map((l) => l.name).sort()).toEqual(["Closer", "Contas a pagar", "Contas a receber", "SDR", "Validação Full Face Avançado", "Venda direta"]);
    expect(state.spaces.find((s) => s.id === "spc_com")?.shortcuts).toEqual([
      { id: "atl_com_caixa", name: "Caixa de entrada", target: "caixaDeEntrada", scope: "minhas" },
    ]);
  });

  it("nenhuma referência pendurada: todo id citado que existia no seed completo ainda existe", () => {
    const full = idsOf(buildSeed());
    const state = buildProductSeed();
    const alive = idsOf(state);
    const dangling: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (typeof value === "string") {
        if (full.has(value) && !alive.has(value)) dangling.push(`${path}=${value}`);
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`));
      } else if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
      }
    };
    walk(state, "state");
    expect(dangling).toEqual([]);
    // O CRM inteiro fica: o Comercial se apoia nele.
    expect(state.deals.length).toBeGreaterThan(0);
    expect(state.conversations.length).toBeGreaterThan(0);
    // As Automações de Funil que criam Tarefas apontam para as Listas do espelho.
    for (const a of state.automations.filter((x) => x.scopeType === "funnel")) {
      for (const v of a.versions) for (const act of v.actions) if (act.kind === "escrita" && act.toolId === "criar_tarefa") expect(act.targetExpression).toMatch(/^lst_funil_/);
    }
  });
});
