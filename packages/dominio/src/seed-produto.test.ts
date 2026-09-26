/**
 * O seed do produto é o seed completo sem os Espaços de demonstração: nada
 * do que sobra pode apontar para o que saiu.
 */

import { describe, expect, it } from "vitest";
import { canaisDaLista, contatoDaTarefa, conversaDaTarefa } from "./derive-conversacional";
import { TIPOS_DE_ATENDIMENTO } from "./operations/canais";
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
    expect(state.lists.map((l) => l.name).sort()).toEqual(["Closer", "Contas a pagar", "Contas a receber", "Pós-venda", "SDR", "Validação Full Face Avançado", "Venda direta"]);
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
    // As Ferramentas do CRM também: Comunidade + 3 Turmas + avisos + importado, o Link e o Flow.
    expect(state.grupos.length).toBe(5);
    expect(state.comunidades.length).toBe(1);
    expect(state.linksDeCaptacao.length).toBe(1);
    expect(state.flows.length).toBe(1);
    expect(state.conversations.length).toBeGreaterThan(0);
    // As Automações de Funil que criam Tarefas apontam para as Listas do espelho.
    for (const a of state.automations.filter((x) => x.scopeType === "funnel")) {
      for (const v of a.versions) for (const act of v.actions) if (act.kind === "escrita" && act.toolId === "criar_tarefa") expect(act.targetExpression).toMatch(/^lst_funil_/);
    }
  });

  // C35 — o modelo de Tarefa é atributo nativo da Lista: toda Lista declara o seu.
  it("C36 — toda Lista conversacional tem ao menos um canal de atendimento ativo, de tipo permitido, nos dois seeds", () => {
    for (const state of [buildSeed(), buildProductSeed()]) {
      for (const lista of state.lists.filter((l) => l.modeloDeTarefa === "conversacional")) {
        const canais = canaisDaLista(state, lista.id);
        expect(canais.length, lista.name).toBeGreaterThan(0);
        for (const canal of canais) {
          expect(canal.lifecycle).toBe("ativo");
          expect((TIPOS_DE_ATENDIMENTO as readonly string[]).includes(canal.channelType), `${lista.name} · ${canal.name}`).toBe(true);
        }
      }
      // A operacional não tem o que dizer.
      for (const lista of state.lists.filter((l) => l.modeloDeTarefa === "operacional")) {
        expect(lista.canaisDeAtendimento, lista.name).toBeUndefined();
      }
    }
  });

  it("C36 — Pós-venda: a Conversa de cada Tarefa está num canal de atendimento da Lista", () => {
    const state = buildSeed();
    const lista = state.lists.find((l) => l.id === "lst_pos_venda");
    expect(lista?.canaisDeAtendimento).toEqual(["chn_wpp", "chn_mail"]);
    const tarefas = state.tasks.filter((t) => t.listId === "lst_pos_venda");
    expect(tarefas.length).toBe(5);
    for (const tarefa of tarefas) {
      const conversa = conversaDaTarefa(state, tarefa);
      expect(conversa, tarefa.title).toBeDefined();
      expect(lista?.canaisDeAtendimento, tarefa.title).toContain(conversa?.channelId);
    }
  });

  it("toda Lista tem modelo de Tarefa, nos dois seeds", () => {
    for (const s of [buildSeed(), buildProductSeed()]) {
      for (const l of s.lists) expect(["operacional", "conversacional"], l.id).toContain(l.modeloDeTarefa);
    }
  });

  it("as Listas do espelho comercial são conversacionais e cada Tarefa-espelho tem Vínculo a Contato", () => {
    const state = buildProductSeed();
    const funis = state.lists.filter((l) => /^lst_funil_/.test(l.id));
    expect(funis.length).toBe(4);
    for (const lista of funis) {
      expect(lista.modeloDeTarefa, lista.id).toBe("conversacional");
      for (const t of state.tasks.filter((x) => x.listId === lista.id && x.provenance?.kind === "deal")) {
        const vinculo = state.links.find((l) => l.fromType === "task" && l.fromId === t.id && l.toType === "contact");
        expect(vinculo, t.id).toBeDefined();
        // RN-TAR-15 — um Contato na lixeira suspende a exibição do Vínculo: a leitura devolve nada, e o Vínculo fica.
        const naLixeira = state.contacts.find((c) => c.id === vinculo?.toId)?.lifecycle === "naLixeira";
        if (naLixeira) expect(contatoDaTarefa(state, t), t.id).toBeUndefined();
        else expect(contatoDaTarefa(state, t), t.id).toBeDefined();
      }
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
      expect(contatoDaTarefa(state, t), t.id).toBeDefined();
      expect(state.links.some((l) => l.fromType === "task" && l.fromId === t.id && l.toType === "conversation"), t.id).toBe(true);
      expect(t.provenance?.kind).toBe("contact");
    }
    // Só a de Iallas tem Negócio; a poda não a levou.
    expect(state.links.filter((l) => l.fromType === "task" && /^tsk_pv_/.test(l.fromId) && l.toType === "deal").map((l) => l.toId)).toEqual(["deal_sdr_1"]);
    expect(state.views.some((v) => v.listId === "lst_pos_venda" && v.isDefault && v.kind === "quadro")).toBe(true);
  });
});
