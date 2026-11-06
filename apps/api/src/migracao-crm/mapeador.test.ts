/**
 * O mapeador de entidades (15-28, UCR-09) é puro: sem banco, sem Docker. A entrada é a fixture congelada
 * do `buildSeed()` (dados sintéticos, nenhum dado de produção); o contrato de cada teste é o que o banco
 * novo exige (constraints da 007/008/011) e o que o dono precisa ver no relatório de não migrados.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RegistroAntigo } from "./formatos-antigos";
import { chaveDeIdentificadorDeContato, CRM_NOVO_VAZIO, type CrmNovoDoEspaco, planejarMigracao } from "./mapeador";

interface Fixture {
  readonly linhas: readonly RegistroAntigo[];
}

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/crm-antigo-do-seed.json", import.meta.url), "utf8")) as Fixture;

const doSeed = (colecao: string): RegistroAntigo[] => FIXTURE.linhas.filter((l) => l.colecao === colecao);
const dadosDe = (colecao: string, id: string): Record<string, unknown> =>
  FIXTURE.linhas.find((l) => l.colecao === colecao && l.id === id)!.dados as Record<string, unknown>;

/** Ids determinísticos: o mapeador gera um por Identificador e por vínculo. */
function contador(): () => string {
  let n = 0;
  return () => `novo_${++n}`;
}

const linha = (colecao: string, id: string, dados: Record<string, unknown>, ordem = 0): RegistroAntigo => ({ colecao, id, ordem, dados: { id, ...dados } });

function plano(linhas: readonly RegistroAntigo[], crmNovo: CrmNovoDoEspaco = CRM_NOVO_VAZIO) {
  return planejarMigracao(linhas, crmNovo, { gerarId: contador() });
}

describe("a fixture congelada do seed (15-28 Task 1)", () => {
  it("tem as nove coleções do CRM antigo com a contagem do ensaio da Fase 14, e os links do seed", () => {
    const contagem = (colecao: string) => doSeed(colecao).length;
    expect({
      contacts: contagem("contacts"),
      companies: contagem("companies"),
      contactCompanyLinks: contagem("contactCompanyLinks"),
      companyCompanyLinks: contagem("companyCompanyLinks"),
      distinctFromLinks: contagem("distinctFromLinks"),
      funnels: contagem("funnels"),
      deals: contagem("deals"),
      channels: contagem("channels"),
      conversations: contagem("conversations"),
    }).toEqual({
      contacts: 39,
      companies: 12,
      contactCompanyLinks: 30,
      companyCompanyLinks: 1,
      distinctFromLinks: 1,
      funnels: 4,
      deals: 19,
      channels: 5,
      conversations: 23,
    });
    expect(contagem("links")).toBeGreaterThan(0);
  });
});

describe("Contatos e Identificadores (15-28 Task 1)", () => {
  it("o Contato entra com o mesmo id, o nome, o modo de criação e o estado das constraints novas", () => {
    const { linhasPorTabela } = plano(doSeed("contacts"));
    const ana = linhasPorTabela.contatos.find((c) => c.id === "cnt_1")!;

    expect(ana).toMatchObject({
      id: "cnt_1",
      nome: "Ana",
      sobrenome: "Ribeiro",
      modo_criacao: "automatico_mensagem", // automaticoPorMensagem
      estado: "ativo",
      proprietario_id: "mem_julia",
      criado_por: "mem_julia",
      qualificacao: "cat_qual_cli", // o id do Catálogo vai na qualificação (15-05)
      origem: "cat_org_site",
      mesclado_em_id: null,
      mesclado_em: null,
    });
    expect(linhasPorTabela.contatos).toHaveLength(39);
  });

  it("os modos de criação sem par na 007 caem no mais próximo, e a lixeira vira na_lixeira", () => {
    const base = { firstName: "A", lastName: "B", ownerMemberId: "mem_x", createdBy: { kind: "member", id: "mem_x" }, createdAt: "2026-01-01T00:00:00.000Z" };
    const { linhasPorTabela } = plano([
      linha("contacts", "c_grupo", { ...base, lifecycle: "ativo", creationMode: "automaticoPorGrupo" }, 0),
      linha("contacts", "c_auto", { ...base, lifecycle: "ativo", creationMode: "automaticoPorAutomacaoOuAgente" }, 1),
      linha("contacts", "c_imp", { ...base, lifecycle: "arquivado", creationMode: "importacao" }, 2),
      linha("contacts", "c_desd", { ...base, lifecycle: "naLixeira", creationMode: "desdobradoDeMesclagem" }, 3),
    ]);
    const por = Object.fromEntries(linhasPorTabela.contatos.map((c) => [c.id, [c.modo_criacao, c.estado]]));
    expect(por).toEqual({
      c_grupo: ["automatico_automacao", "ativo"],
      c_auto: ["automatico_automacao", "ativo"],
      c_imp: ["importacao", "arquivado"],
      c_desd: ["manual", "na_lixeira"],
    });
  });

  it("o Contato mesclado aponta o sobrevivente e entra DEPOIS dele (a FK não é adiável)", () => {
    const { linhasPorTabela } = plano(doSeed("contacts"));
    const ids = linhasPorTabela.contatos.map((c) => c.id);
    const absorvido = linhasPorTabela.contatos.find((c) => c.id === "cnt_32")!;

    expect(absorvido.estado).toBe("mesclado");
    expect(absorvido.mesclado_em_id).toBe("cnt_2");
    expect(absorvido.mesclado_em).not.toBeNull();
    expect(ids.indexOf("cnt_2")).toBeLessThan(ids.indexOf("cnt_32"));
  });

  it("o Identificador ganha id novo, o tipo da 007 e o valor na forma canônica; o de LinkedIn vai para o relatório", () => {
    const { linhasPorTabela, naoMigrados } = plano(doSeed("contacts"));
    const deAna = linhasPorTabela.contato_identificadores.filter((i) => i.contato_id === "cnt_1");

    expect(deAna.map((i) => i.tipo).sort()).toEqual(["email", "whatsapp"]);
    const zap = deAna.find((i) => i.tipo === "whatsapp")!;
    expect(zap.valor).toBe("+5511970000000"); // a forma canônica do CRM novo tem o +
    expect(zap.valor_exibido).toBe("+55 11 97000-1000");
    expect(zap.principal).toBe(true);
    expect(zap.verificado).toBe(true);
    expect(zap.id).toMatch(/^novo_\d+$/);
    expect(deAna.map((i) => i.id)).not.toContain("cid_1a");

    expect(naoMigrados).toContainEqual({ categoria: "identificador-sem-destino", colecao: "contacts", id: "cnt_1" });
    // Nenhum tipo antigo sobrou nas linhas novas.
    const tipos = new Set(linhasPorTabela.contato_identificadores.map((i) => i.tipo));
    expect([...tipos].every((t) => ["telefone", "email", "whatsapp", "instagram"].includes(t))).toBe(true);
  });

  it("uma linha de de-para por Contato e por Identificador migrados, com o id antigo e o novo", () => {
    const { linhasPorTabela, deParas } = plano(doSeed("contacts"));

    expect(deParas.filter((d) => d.colecao_antiga === "contacts")).toHaveLength(linhasPorTabela.contatos.length);
    expect(deParas).toContainEqual({ colecao_antiga: "contacts", id_antigo: "cnt_1", tabela_nova: "contatos", id_novo: "cnt_1" });
    const deIdentificadores = deParas.filter((d) => d.colecao_antiga === "contacts/identifiers");
    expect(deIdentificadores).toHaveLength(linhasPorTabela.contato_identificadores.length);
    const zap = linhasPorTabela.contato_identificadores.find((i) => i.contato_id === "cnt_1" && i.tipo === "whatsapp")!;
    expect(deParas).toContainEqual({ colecao_antiga: "contacts/identifiers", id_antigo: "cnt_1/cid_1b", tabela_nova: "contato_identificadores", id_novo: zap.id });
  });

  it("todo Identificador do seed está migrado ou no relatório: nada some sem aviso", () => {
    const { linhasPorTabela, naoMigrados } = plano(doSeed("contacts"));
    const total = doSeed("contacts").reduce((soma, c) => soma + ((c.dados as { identifiers?: unknown[] }).identifiers?.length ?? 0), 0);
    const semDestino = doSeed("contacts").reduce(
      (soma, c) =>
        soma +
        ((c.dados as { identifiers?: Array<{ type: string }> }).identifiers ?? []).filter((i) =>
          ["perfilDeLinkedIn", "perfilDeTikTok", "identificadorDeChatDoSite"].includes(i.type),
        ).length,
      0,
    );
    const repetidos = naoMigrados.filter((n) => n.categoria === "identificador-repetido").length;

    expect(linhasPorTabela.contato_identificadores.length + semDestino + repetidos).toBe(total);
  });

  it("Identificador que o CRM novo já tem, ou repetido entre dois Contatos antigos, fica no relatório e não entra duas vezes", () => {
    const base = { firstName: "A", lastName: "B", ownerMemberId: "mem_x", createdBy: { kind: "member", id: "mem_x" }, lifecycle: "ativo", creationMode: "manual" };
    const comEmail = (id: string, value: string) => ({
      ...base,
      identifiers: [{ id: `cid_${id}`, type: "email", value, displayValue: value, verified: false, principal: true }],
    });
    const antigas = [linha("contacts", "c1", comEmail("c1", "mesmo@exemplo.test"), 0), linha("contacts", "c2", comEmail("c2", "mesmo@exemplo.test"), 1), linha("contacts", "c3", comEmail("c3", "ja-existe@exemplo.test"), 2)];
    const crmNovo: CrmNovoDoEspaco = { ...CRM_NOVO_VAZIO, identificadoresDeContato: new Set([chaveDeIdentificadorDeContato("email", "ja-existe@exemplo.test")]) };

    const { linhasPorTabela, naoMigrados } = plano(antigas, crmNovo);

    expect(linhasPorTabela.contatos.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(linhasPorTabela.contato_identificadores.map((i) => i.contato_id)).toEqual(["c1"]);
    expect(naoMigrados.filter((n) => n.categoria === "identificador-repetido").map((n) => n.id).sort()).toEqual(["c2", "c3"]);
  });

  it("Contato cujo id já existe no CRM novo não migra e não leva os Identificadores", () => {
    const base = { firstName: "A", lastName: "B", ownerMemberId: "mem_x", createdBy: { kind: "member", id: "mem_x" }, lifecycle: "ativo", creationMode: "manual" };
    const antigas = [linha("contacts", "c1", { ...base, identifiers: [{ id: "i1", type: "email", value: "a@exemplo.test", displayValue: "a@exemplo.test", verified: false, principal: true }] })];

    const { linhasPorTabela, naoMigrados, deParas } = plano(antigas, { ...CRM_NOVO_VAZIO, idsDeContato: new Set(["c1"]) });

    expect(linhasPorTabela.contatos).toEqual([]);
    expect(linhasPorTabela.contato_identificadores).toEqual([]);
    expect(deParas).toEqual([]);
    expect(naoMigrados).toContainEqual({ categoria: "id-ja-existe", colecao: "contacts", id: "c1" });
  });

  it("dois principais do mesmo tipo no mesmo Contato: só o primeiro fica principal (índice único parcial da 007)", () => {
    const base = { firstName: "A", lastName: "B", ownerMemberId: "mem_x", createdBy: { kind: "member", id: "mem_x" }, lifecycle: "ativo", creationMode: "manual" };
    const antigas = [
      linha("contacts", "c1", {
        ...base,
        identifiers: [
          { id: "i1", type: "email", value: "um@exemplo.test", displayValue: "um@exemplo.test", verified: false, principal: true },
          { id: "i2", type: "email", value: "dois@exemplo.test", displayValue: "dois@exemplo.test", verified: false, principal: true },
        ],
      }),
    ];

    const { linhasPorTabela } = plano(antigas);

    expect(linhasPorTabela.contato_identificadores.map((i) => [i.valor, i.principal])).toEqual([
      ["um@exemplo.test", true],
      ["dois@exemplo.test", false],
    ]);
  });

  it("o relatório de não migrados só carrega coleção e id (T-15-67), nunca nome nem valor", () => {
    const { naoMigrados } = plano(doSeed("contacts"));
    for (const item of naoMigrados) expect(Object.keys(item).sort()).toEqual(["categoria", "colecao", "id"]);
    const ana = dadosDe("contacts", "cnt_1");
    expect(JSON.stringify(naoMigrados)).not.toContain(String(ana.firstName));
  });
});
