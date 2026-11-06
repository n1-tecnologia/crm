/**
 * Fase 15 (3.5.3, UCR-11, D-15-13): `buildSeed()` nasce SEM o CRM antigo.
 *
 * A demonstração do CRM passou a ser o `bootstrap:crm-demo` (15-29), que carrega nas tabelas novas,
 * com os ids antigos, o que o seed construía em `state.contacts`, `state.deals` e afins. Enquanto o
 * seed criar essas coleções, a 3.5.4 não consegue tirá-las do `DataState`.
 *
 * O que continua no seed, de propósito:
 *  - as REFERÊNCIAS a ids do CRM que o seed guarda em `registros` (Vínculos de Tarefa, `provenance`,
 *    cliente de Contas a receber, Participações e Canal de Grupo, âncoras): com os ids preservados, elas
 *    apontam para o que o demo carrega nas tabelas;
 *  - o Grupo, a Comunidade, o Link de Captação, o Flow e as Conversas de Grupo (F14-D-05).
 *
 * As oito coleções são lidas pela CHAVE do objeto (`Record<string, unknown>`), não pelo tipo
 * `DataState`: desde o 15-43 elas nem existem no tipo, e o construtor que as montava
 * (`seed-crm-antigo.ts`) foi apagado.
 */

import { describe, expect, it } from "vitest";
import { COLECOES } from "./colecoes";
import { buildSeed } from "./seed";

const COLECOES_DO_CRM_ANTIGO = [
  "contacts",
  "companies",
  "deals",
  "funnels",
  "contactCompanyLinks",
  "companyCompanyLinks",
  "distinctFromLinks",
  "channels",
] as const;

/** A coleção pela chave: ausente conta como vazia. */
const colecao = (estado: object, chave: string): readonly Record<string, unknown>[] =>
  ((estado as Record<string, unknown>)[chave] as readonly Record<string, unknown>[] | undefined) ?? [];

describe("buildSeed() sem o CRM antigo (15-31, UCR-11)", () => {
  it("as oito coleções do CRM antigo nascem vazias", () => {
    const seed = buildSeed();
    for (const chave of COLECOES_DO_CRM_ANTIGO) expect(colecao(seed, chave), chave).toHaveLength(0);
  });

  it("15-43: as oito coleções já não são coleções do DataState; `conversations` fica, só com Grupo (F14-D-05)", () => {
    const chaves: readonly string[] = COLECOES;
    for (const chave of COLECOES_DO_CRM_ANTIGO) expect(chaves, chave).not.toContain(chave);
    expect(chaves).toContain("conversations");
    expect(Object.keys(buildSeed())).not.toEqual(expect.arrayContaining(["contacts"]));
  });

  it("só sobram as Conversas de Grupo (F14-D-05), e nenhuma delas tem Contato", () => {
    const conversas = colecao(buildSeed(), "conversations");
    expect(conversas.map((c) => c.id).sort()).toEqual(["cnv_grp_avisos", "cnv_grp_turma_02"]);
    for (const conversa of conversas) {
      expect(conversa.groupIdentifier, String(conversa.id)).toBeDefined();
      expect(conversa.contactId, String(conversa.id)).toBeUndefined();
    }
  });

  it("a Pasta Meus negócios e as Listas espelho saem; o atalho Caixa de entrada do Comercial fica", () => {
    const seed = buildSeed();
    expect(seed.folders.some((f) => f.id === "fld_meus_negocios")).toBe(false);
    expect(seed.lists.filter((l) => /^lst_funil_/.test(l.id))).toEqual([]);
    expect(seed.tasks.filter((t) => t.provenance?.kind === "deal" && /^tsk_lst_funil_/.test(t.id))).toEqual([]);
    expect(seed.views.filter((v) => /^viw_lst_funil_/.test(v.id))).toEqual([]);
    expect(seed.spaces.find((s) => s.id === "spc_com")?.shortcuts).toEqual([
      { id: "atl_com_caixa", name: "Caixa de entrada", target: "caixaDeEntrada", scope: "minhas" },
    ]);
  });

  it("os Vínculos de Tarefa para Contato, Negócio e Conversa continuam no estado, apontando para ids do demo", () => {
    const seed = buildSeed();
    const doTipo = (tipo: string) => seed.links.filter((l) => l.toType === tipo || l.fromType === tipo);
    expect(seed.links.map((l) => l.id)).toEqual(expect.arrayContaining(["lnk_1", "lnk_2", "lnk_3", "lnk_call"]));
    expect(doTipo("contact").length).toBeGreaterThan(0);
    expect(doTipo("deal").length).toBeGreaterThan(0);
    expect(doTipo("conversation").length).toBeGreaterThan(0);

    // Pós-venda: as cinco Tarefas nascem com Proveniência de Contato (com o nome) e Vínculos a Contato e Conversa.
    const posVenda = seed.tasks.filter((t) => t.listId === "lst_pos_venda");
    expect(posVenda).toHaveLength(5);
    for (const tarefa of posVenda) {
      expect(tarefa.provenance?.kind, tarefa.id).toBe("contact");
      expect(tarefa.provenance?.sourceName?.trim().length, tarefa.id).toBeGreaterThan(0);
      expect(seed.links.some((l) => l.fromId === tarefa.id && l.toType === "contact"), tarefa.id).toBe(true);
      expect(seed.links.some((l) => l.fromId === tarefa.id && l.toType === "conversation"), tarefa.id).toBe(true);
    }
    expect(seed.links.filter((l) => /^lnk_tsk_pv_\d+_negocio$/.test(l.id)).map((l) => l.toId)).toEqual(["deal_sdr_1"]);

    // Contas a receber: o cliente de cada conta é um Vínculo por id; o Contato mora no demo.
    const clientes = seed.links.filter((l) => l.id.startsWith("lnk_cr_") && l.toType === "contact");
    expect(clientes).toHaveLength(13);
    expect(new Set(clientes.map((l) => l.toId))).toEqual(
      new Set(["cnt_cr_helena", "cnt_cr_ricardo", "cnt_cr_camila", "cnt_cr_otavio"]),
    );
  });

  it("o Grupo, a Comunidade, o Link de Captação e o Flow ficam, com as Participações dos Contatos por id", () => {
    const seed = buildSeed();
    expect(seed.grupos).toHaveLength(5);
    expect(seed.comunidades).toHaveLength(1);
    expect(seed.linksDeCaptacao).toHaveLength(1);
    expect(seed.flows).toHaveLength(1);
    const turma1 = seed.grupos.find((g) => g.id === "grp_turma_01");
    const deContatos = turma1?.participacoes.filter((p) => p.contactId !== undefined) ?? [];
    expect(deContatos.length).toBeGreaterThanOrEqual(7);
    for (const p of deContatos) {
      expect(p.identificadorExternoDoParticipante, p.id).toMatch(/^5511\d{9}$/);
    }
    // O Canal participante é o de WhatsApp do demo (`chn_wpp`), com o identificador externo do Canal.
    const doCanal = turma1?.participacoes.find((p) => p.canalParticipanteId === "chn_wpp");
    expect(doCanal?.identificadorExternoDoParticipante).toBe("+5511987654321");
  });

  it("borda UCR-11 (idempotência): duas chamadas devolvem estados iguais, sem CRM nos dois", () => {
    const a = buildSeed();
    const b = buildSeed();
    expect(b).toEqual(a);
    for (const chave of COLECOES_DO_CRM_ANTIGO) {
      expect(colecao(a, chave), chave).toHaveLength(0);
      expect(colecao(b, chave), chave).toHaveLength(0);
    }
  });
});
