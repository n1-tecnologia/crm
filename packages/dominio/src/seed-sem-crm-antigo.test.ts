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
 * `DataState`, para o teste continuar valendo quando o 15-43 as tirar do tipo.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { semearCrmAntigo } from "./seed-crm-antigo";

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

/**
 * Caso temporário: `semearCrmAntigo` existe só para os testes de código que um plano seguinte apaga
 * (15-32, 15-33, 15-42). Este caso sai no 15-43, junto com o construtor e este arquivo.
 */
describe("semearCrmAntigo(buildSeed()) — o CRM antigo de demonstração como era (15-31, só para testes de código que sai)", () => {
  it("reconstrói as coleções com as contagens da fixture do 15-28", () => {
    const estado = buildSeed();
    semearCrmAntigo(estado);
    expect(colecao(estado, "contacts")).toHaveLength(39);
    expect(colecao(estado, "companies")).toHaveLength(12);
    expect(colecao(estado, "contactCompanyLinks")).toHaveLength(30);
    expect(colecao(estado, "companyCompanyLinks")).toHaveLength(1);
    expect(colecao(estado, "distinctFromLinks")).toHaveLength(1);
    expect(colecao(estado, "funnels")).toHaveLength(4);
    expect(colecao(estado, "deals")).toHaveLength(19);
    expect(colecao(estado, "channels")).toHaveLength(5);
    expect(colecao(estado, "conversations")).toHaveLength(23);
    expect(estado.links).toHaveLength(64);
  });

  it("devolve a Pasta Meus negócios com as quatro Listas espelho e uma Tarefa por Negócio", () => {
    const estado = buildSeed();
    semearCrmAntigo(estado);
    expect(estado.folders.some((f) => f.id === "fld_meus_negocios")).toBe(true);
    expect(estado.lists.filter((l) => /^lst_funil_/.test(l.id)).map((l) => l.id).sort()).toEqual([
      "lst_funil_closer",
      "lst_funil_sdr",
      "lst_funil_validacao",
      "lst_funil_venda_direta",
    ]);
    const espelho = estado.tasks.filter((t) => /^tsk_lst_funil_/.test(t.id));
    expect(espelho).toHaveLength(colecao(estado, "deals").filter((d) => d.lifecycle === "ativo").length);
  });

  it("a Conversa de cada Tarefa de Pós-venda é do Contato dela, e todo id do CRM citado pelo seed novo existe", () => {
    const estado = buildSeed();
    semearCrmAntigo(estado);
    const ids = (chave: string) => new Set(colecao(estado, chave).map((r) => String(r.id)));
    const contatos = ids("contacts");
    const conversas = ids("conversations");
    const negocios = ids("deals");
    const existe = (tipo: string, id: string): boolean =>
      tipo === "contact" ? contatos.has(id) : tipo === "conversation" ? conversas.has(id) : tipo === "deal" ? negocios.has(id) : true;
    for (const l of estado.links) {
      expect(existe(l.toType, l.toId), `${l.id} → ${l.toType} ${l.toId}`).toBe(true);
      expect(existe(l.fromType, l.fromId), `${l.id} ← ${l.fromType} ${l.fromId}`).toBe(true);
    }
    for (const tarefa of estado.tasks.filter((t) => t.listId === "lst_pos_venda")) {
      const contato = estado.links.find((l) => l.fromId === tarefa.id && l.toType === "contact")?.toId;
      const conversa = estado.links.find((l) => l.fromId === tarefa.id && l.toType === "conversation")?.toId;
      const dona = colecao(estado, "conversations").find((c) => c.id === conversa);
      expect(dona?.contactId, tarefa.id).toBe(contato);
      expect(tarefa.provenance?.sourceId, tarefa.id).toBe(contato);
    }
    for (const grupo of estado.grupos) {
      for (const p of grupo.participacoes) if (p.contactId !== undefined) expect(contatos.has(p.contactId), `${grupo.id} · ${p.id}`).toBe(true);
    }
  });
});
