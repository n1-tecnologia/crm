/**
 * O seed do produto é o seed completo sem os Espaços de demonstração: nada
 * do que sobra pode apontar para o que saiu.
 *
 * Desde o 15-31 (D-15-13) o seed não traz o CRM antigo (Contatos, Negócios, Canais, Conversas) nem a Pasta
 * "Meus negócios" com as Listas espelho: o CRM de demonstração é o `bootstrap:crm-demo`. O que fica no seed são as
 * REFERÊNCIAS por id (Vínculos, Proveniência), provadas em `seed-sem-crm-antigo.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { TIPOS_DE_ATENDIMENTO } from "./operations/canais";
import { buildSeed } from "./seed";
import { buildProductSeed } from "./seed-produto";
import { colecaoPelaChave } from "./testes/crm-de-teste";

const idsOf = (state: object): Set<string> => {
  const ids = new Set<string>();
  for (const value of Object.values(state)) {
    if (!Array.isArray(value)) continue;
    for (const record of value) if (record && typeof record.id === "string") ids.add(record.id);
  }
  return ids;
};

describe("seed do produto", () => {
  it("só Comercial (atalho Caixa de entrada e Pós-venda) e Gestão (Financeiro › Contas a pagar e a receber)", () => {
    const state = buildProductSeed();
    expect(state.spaces.map((s) => s.name)).toEqual(["Comercial", "Gestão"]);
    expect(state.folders.map((f) => f.name).sort()).toEqual(["Financeiro"]);
    expect(state.lists.map((l) => l.name).sort()).toEqual(["Contas a pagar", "Contas a receber", "Pós-venda"]);
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
    // O CRM antigo não está no seed (15-31): o Comercial se apoia nas tabelas do CRM novo.
    expect(colecaoPelaChave(state, "deals")).toHaveLength(0);
    // As Ferramentas do CRM também: Comunidade + 3 Turmas + avisos + importado, o Link e o Flow.
    expect(state.grupos.length).toBe(5);
    expect(state.comunidades.length).toBe(1);
    expect(state.linksDeCaptacao.length).toBe(1);
    expect(state.flows.length).toBe(1);
    expect(state.conversations.length).toBeGreaterThan(0);
    // As Automações de Funil que criam Tarefas apontam para as Listas do espelho (que saíram do seed: linha aberta em WINDOWS).
    for (const a of state.automations.filter((x) => x.scopeType === "funnel")) {
      for (const v of a.versions) for (const act of v.actions) if (act.kind === "escrita" && act.toolId === "criar_tarefa") expect(act.targetExpression).toMatch(/^lst_funil_/);
    }
  });

  // C35 — o modelo de Tarefa é atributo nativo da Lista: toda Lista declara o seu.
  it("C36 — toda Lista conversacional declara ao menos um canal de atendimento de tipo permitido, nos dois seeds", () => {
    // O seed não cria mais Canal (15-31): a Lista guarda os ids dos Canais do demo (`chn_wpp`, `chn_mail`, `chn_linkedin`),
    // e `seed-sem-crm-antigo.test.ts` prova que cada id existe, está ativo e é de tipo permitido.
    const CANAIS_DO_DEMO = ["chn_wpp", "chn_mail", "chn_linkedin"];
    for (const state of [buildSeed(), buildProductSeed()]) {
      for (const lista of state.lists.filter((l) => l.modeloDeTarefa === "conversacional")) {
        expect(lista.canaisDeAtendimento?.length ?? 0, lista.name).toBeGreaterThan(0);
        for (const canalId of lista.canaisDeAtendimento ?? []) expect(CANAIS_DO_DEMO, `${lista.name} · ${canalId}`).toContain(canalId);
      }
      // A operacional não tem o que dizer.
      for (const lista of state.lists.filter((l) => l.modeloDeTarefa === "operacional")) {
        expect(lista.canaisDeAtendimento, lista.name).toBeUndefined();
      }
    }
    expect(TIPOS_DE_ATENDIMENTO.length).toBeGreaterThan(0);
  });

  it("C36 — Pós-venda: a Lista atende por WhatsApp e e-mail, e cada Tarefa traz o Vínculo da Conversa", () => {
    const state = buildSeed();
    const lista = state.lists.find((l) => l.id === "lst_pos_venda");
    expect(lista?.canaisDeAtendimento).toEqual(["chn_wpp", "chn_mail"]);
    const tarefas = state.tasks.filter((t) => t.listId === "lst_pos_venda");
    expect(tarefas.length).toBe(5);
    for (const tarefa of tarefas) {
      expect(state.links.some((l) => l.fromId === tarefa.id && l.toType === "conversation"), tarefa.title).toBe(true);
    }
  });

  it("toda Lista tem modelo de Tarefa, nos dois seeds", () => {
    for (const s of [buildSeed(), buildProductSeed()]) {
      for (const l of s.lists) expect(["operacional", "conversacional"], l.id).toContain(l.modeloDeTarefa);
    }
  });

  it("Pós-venda: Lista conversacional sem Funil, 5 Tarefas, todas com Contato e Conversa", () => {
    const state = buildProductSeed();
    const lista = state.lists.find((l) => l.id === "lst_pos_venda");
    expect(lista?.parentId).toBe("spc_com");
    expect(lista?.modeloDeTarefa).toBe("conversacional");
    const tarefas = state.tasks.filter((t) => t.listId === "lst_pos_venda");
    expect(tarefas).toHaveLength(5);
    for (const t of tarefas) {
      // O Contato e a Conversa moram no demo: a Tarefa os guarda por Vínculo, e a Proveniência guarda o nome.
      expect(state.links.some((l) => l.fromType === "task" && l.fromId === t.id && l.toType === "contact"), t.id).toBe(true);
      expect(state.links.some((l) => l.fromType === "task" && l.fromId === t.id && l.toType === "conversation"), t.id).toBe(true);
      expect(t.provenance?.kind).toBe("contact");
    }
    // Só a de Iallas tem Negócio; a poda não a levou.
    expect(state.links.filter((l) => l.fromType === "task" && /^tsk_pv_/.test(l.fromId) && l.toType === "deal").map((l) => l.toId)).toEqual(["deal_sdr_1"]);
    expect(state.views.some((v) => v.listId === "lst_pos_venda" && v.isDefault && v.kind === "quadro")).toBe(true);
  });
});
