/**
 * O mapeador de entidades (15-28, UCR-09) é puro: sem banco, sem Docker. A entrada é a fixture congelada
 * do `buildSeed()` (dados sintéticos, nenhum dado de produção); o contrato de cada teste é o que o banco
 * novo exige (constraints da 007/008/011) e o que o dono precisa ver no relatório de não migrados.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RegistroAntigo } from "./formatos-antigos";
import { chaveDeIdentificadorDeContato, chaveDeParDeConversa, CRM_NOVO_VAZIO, type CrmNovoDoEspaco, planejarMigracao } from "./mapeador";

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

// --- 15-28 Task 2: Empresas, vínculos, Negócios, Canais, Conversas e Mensagens ---

const ATOR = { kind: "member", id: "mem_x" };
const EM = "2026-01-01T00:00:00.000Z";

const contatoMin = (id: string, extra: Record<string, unknown> = {}, ordem = 0) =>
  linha("contacts", id, { firstName: "A", lastName: id, ownerMemberId: "mem_x", createdBy: ATOR, createdAt: EM, lifecycle: "ativo", creationMode: "manual", identifiers: [], ...extra }, ordem);

const empresaMin = (id: string, extra: Record<string, unknown> = {}, ordem = 0) =>
  linha("companies", id, { tradeName: `Empresa ${id}`, legalName: "", ownerMemberId: "mem_x", createdBy: ATOR, createdAt: EM, lifecycle: "ativo", identifiers: [], ...extra }, ordem);

const vinculoMin = (id: string, contactId: string, companyId: string, extra: Record<string, unknown> = {}, ordem = 0) =>
  linha("contactCompanyLinks", id, { contactId, companyId, role: "Dona", principalForContact: false, principalForCompany: true, start: "2026-01-10", createdBy: ATOR, createdAt: EM, ...extra }, ordem);

const funilMin = (id: string, etapas: string[]) => linha("funnels", id, { name: id, stages: etapas.map((e, i) => ({ id: e, name: e, order: i, defaultProbability: 0 })) });

const negocioMin = (id: string, extra: Record<string, unknown> = {}, ordem = 0) =>
  linha("deals", id, { title: `Negócio ${id}`, object: "", description: "", ownerMemberId: "mem_x", createdBy: ATOR, createdAt: EM, lifecycle: "ativo", funnelId: "f1", stageId: "e1", situation: "aberto", contactLinks: [], ...extra }, ordem);

const canalMin = (id: string, extra: Record<string, unknown> = {}, ordem = 0) =>
  linha("channels", id, { name: `Canal ${id}`, channelType: "whatsapp", externalId: `+55119${id.padStart(8, "0")}`, createdBy: ATOR, createdAt: EM, lifecycle: "ativo", configuredByMemberId: "mem_x", ...extra }, ordem);

const conversaMin = (id: string, extra: Record<string, unknown> = {}, ordem = 0) =>
  linha("conversations", id, { channelId: "ch1", contactId: "c1", state: "aberta", lifecycle: "ativo", title: `Conversa ${id}`, createdBy: ATOR, createdAt: EM, messages: [], participants: [], starredBy: [], drafts: [], ...extra }, ordem);

const FUNIS_DO_SEED: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  doSeed("funnels").map((f) => [f.id, new Set(((f.dados as { stages: Array<{ id: string }> }).stages).map((e) => e.id))]),
);

function planoCom(linhas: readonly RegistroAntigo[], opcoes: { funis?: ReadonlyMap<string, ReadonlySet<string>>; crmNovo?: CrmNovoDoEspaco } = {}) {
  return planejarMigracao(linhas, opcoes.crmNovo ?? CRM_NOVO_VAZIO, { gerarId: contador(), funisMigrados: opcoes.funis ?? new Map([["f1", new Set(["e1", "e2"])]]) });
}

describe("Empresas e vínculos (15-28 Task 2)", () => {
  it("a Empresa do seed entra com o mesmo id, os nomes e o estado; a de lixeira vira na_lixeira", () => {
    const { linhasPorTabela, naoMigrados } = plano([...doSeed("contacts"), ...doSeed("companies"), ...doSeed("contactCompanyLinks")]);
    const por = Object.fromEntries(linhasPorTabela.empresas.map((e) => [e.id, e]));

    expect(naoMigrados.filter((n) => n.categoria === "empresa-sem-admin")).toEqual([]);
    expect(Object.keys(por)).toHaveLength(12);
    expect(por.cmp_1).toMatchObject({ id: "cmp_1", estado: "ativo", proprietario_id: expect.any(String) });
    expect(por.cmp_2!.estado).toBe("na_lixeira");
    expect(por.cmp_2!.matriz_id).toBe("cmp_1"); // a matriz migra, então a filial a aponta
  });

  it("Empresa sem vínculo admin vigente não migra (o banco derrubaria o commit) e os Negócios dela vão junto; o resto segue", () => {
    const antigas = [
      contatoMin("c1", {}, 0),
      empresaMin("e_ok", {}, 0),
      empresaMin("e_sem_vinculo", {}, 1),
      empresaMin("e_so_encerrado", {}, 2),
      empresaMin("e_sem_admin", {}, 3),
      vinculoMin("v1", "c1", "e_ok", {}, 0),
      vinculoMin("v2", "c1", "e_so_encerrado", { end: "2026-02-01" }, 1),
      vinculoMin("v3", "c1", "e_sem_admin", { principalForCompany: false }, 2),
      funilMin("f1", ["e1"]),
      negocioMin("n_ok", { companyId: "e_ok" }, 0),
      negocioMin("n_sem_admin", { companyId: "e_sem_vinculo" }, 1),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.empresas.map((e) => e.id)).toEqual(["e_ok"]);
    expect(linhasPorTabela.contato_empresa.map((v) => v.empresa_id)).toEqual(["e_ok"]);
    expect(naoMigrados.filter((n) => n.categoria === "empresa-sem-admin").map((n) => n.id).sort()).toEqual(["e_so_encerrado", "e_sem_admin", "e_sem_vinculo"].sort());
    expect(linhasPorTabela.negocios.map((n) => n.id)).toEqual(["n_ok"]);
    expect(naoMigrados).toContainEqual({ categoria: "negocio-sem-empresa-migrada", colecao: "deals", id: "n_sem_admin" });
  });

  it("Empresa na lixeira sem admin migra: a 007 só exige admin fora da lixeira", () => {
    const { linhasPorTabela } = planoCom([empresaMin("e_lixo", { lifecycle: "naLixeira" })]);

    expect(linhasPorTabela.empresas.map((e) => [e.id, e.estado])).toEqual([["e_lixo", "na_lixeira"]]);
  });

  it("matriz que não migrou: a filial entra sem matriz e o relatório diz; Empresa mesclada e sem nome não migram", () => {
    const antigas = [
      contatoMin("c1"),
      empresaMin("matriz", {}, 0),
      empresaMin("filial", { parentCompanyId: "matriz" }, 1),
      empresaMin("mesclada", { lifecycle: "mesclado", mergedIntoId: "filial" }, 2),
      empresaMin("sem_nome", { tradeName: "", legalName: " " }, 3),
      vinculoMin("v1", "c1", "filial", {}, 0),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.empresas.map((e) => [e.id, e.matriz_id])).toEqual([["filial", null]]);
    expect(naoMigrados).toContainEqual({ categoria: "empresa-matriz-perdida", colecao: "companies", id: "filial" });
    expect(naoMigrados).toContainEqual({ categoria: "empresa-mesclada", colecao: "companies", id: "mesclada" });
    expect(naoMigrados).toContainEqual({ categoria: "empresa-sem-nome", colecao: "companies", id: "sem_nome" });
  });

  it("o vínculo vira contato_empresa: role→cargo, principalForCompany→admin, id novo e de-para; principalForContact vai para o relatório", () => {
    const antigas = [contatoMin("c1"), empresaMin("e1"), vinculoMin("v1", "c1", "e1", { principalForContact: true, start: "2026-01-10" })];

    const { linhasPorTabela, deParas, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.contato_empresa).toEqual([
      expect.objectContaining({ id: "novo_1", contato_id: "c1", empresa_id: "e1", cargo: "Dona", admin: true, inicio: "2026-01-10", fim: null, criado_por: "mem_x" }),
    ]);
    expect(deParas).toContainEqual({ colecao_antiga: "contactCompanyLinks", id_antigo: "v1", tabela_nova: "contato_empresa", id_novo: "novo_1" });
    expect(naoMigrados).toContainEqual({ categoria: "vinculo-principal-do-contato", colecao: "contactCompanyLinks", id: "v1" });
  });

  it("vínculo para Contato ou Empresa que não migrou, ou repetido vigente, fica no relatório; datas impossíveis viram vazio", () => {
    const antigas = [
      contatoMin("c1"),
      empresaMin("e1"),
      vinculoMin("v_ok", "c1", "e1", { start: "2026-02-30" }, 0),
      vinculoMin("v_repetido", "c1", "e1", { principalForCompany: false }, 1),
      vinculoMin("v_sem_contato", "fantasma", "e1", { principalForCompany: false }, 2),
      vinculoMin("v_sem_empresa", "c1", "fantasma", {}, 3),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.contato_empresa.map((v) => [v.contato_id, v.empresa_id, v.inicio])).toEqual([["c1", "e1", null]]);
    expect(naoMigrados.filter((n) => n.categoria === "vinculo-repetido").map((n) => n.id)).toEqual(["v_repetido"]);
    expect(naoMigrados.filter((n) => n.categoria === "vinculo-sem-ponta").map((n) => n.id).sort()).toEqual(["v_sem_contato", "v_sem_empresa"]);
  });

  it("Identificador de Empresa: domínio, documento fiscal (só dígitos, exige país) e telefone; sem país vai para o relatório", () => {
    const antigas = [
      contatoMin("c1"),
      empresaMin("e1", {
        identifiers: [
          { id: "i1", type: "dominio", value: "Exemplo.com.br", verified: true, principal: true, createdAt: EM },
          { id: "i2", type: "documentoFiscal", value: "12.345.678/0001-90", country: "BR", verified: false, principal: true },
          { id: "i3", type: "documentoFiscal", value: "99", verified: false, principal: false },
        ],
      }),
      vinculoMin("v1", "c1", "e1"),
    ];

    const { linhasPorTabela, deParas, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.empresa_identificadores.map((i) => [i.tipo, i.valor, i.pais])).toEqual([
      ["dominio", "exemplo.com.br", null],
      ["documento_fiscal", "12345678000190", "BR"],
    ]);
    expect(linhasPorTabela.empresa_identificadores[0]!.id).toMatch(/^novo_/);
    expect(deParas.filter((d) => d.colecao_antiga === "companies/identifiers").map((d) => d.id_antigo)).toEqual(["e1/i1", "e1/i2"]);
    expect(naoMigrados).toContainEqual({ categoria: "identificador-de-empresa-sem-pais", colecao: "companies", id: "e1" });
  });

  it("vínculo Empresa-Empresa, \"distinto de\", anexos e comentários da Empresa só vão para o relatório, com os ids", () => {
    const antigas = [
      contatoMin("c1"),
      empresaMin("e1", { attachments: [{ fileId: "f" }], comments: [{ id: "cm", content: "x" }], tagIds: ["tag_a"] }),
      vinculoMin("v1", "c1", "e1"),
      linha("companyCompanyLinks", "ccl_1", { fromCompanyId: "e1", toCompanyId: "e1", kind: "parceira" }),
      linha("distinctFromLinks", "dfl_1", { contactAId: "c1", contactBId: "c1" }),
    ];

    const { naoMigrados } = planoCom(antigas);

    expect(naoMigrados).toContainEqual({ categoria: "vinculo-empresa-empresa", colecao: "companyCompanyLinks", id: "ccl_1" });
    expect(naoMigrados).toContainEqual({ categoria: "distinto-de", colecao: "distinctFromLinks", id: "dfl_1" });
    expect(naoMigrados).toContainEqual({ categoria: "anexos-e-comentarios", colecao: "companies", id: "e1" });
    expect(naoMigrados).toContainEqual({ categoria: "tags", colecao: "companies", id: "e1" });
  });
});

describe("Contato: o que o CRM novo não tem e o que ele guarda de outro jeito (15-28 Task 2)", () => {
  it("Contato com temperatura migra sem ela e o relatório tem a entrada \"temperatura\" com o id (D-15-06); sem temperatura não gera entrada", () => {
    const antigas = [contatoMin("c_quente", { temperatureId: "cat_temp_quente" }), contatoMin("c_sem_temperatura")];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.contatos.map((c) => c.id)).toEqual(["c_quente", "c_sem_temperatura"]);
    expect(naoMigrados.filter((n) => n.categoria === "temperatura")).toEqual([{ categoria: "temperatura", colecao: "contacts", id: "c_quente" }]);
  });

  it("Tags, foto, cópia pré-mesclagem e proveniência vão para o relatório; Catálogo vai na qualificação e na origem", () => {
    const antigas = [contatoMin("c1", { tagIds: ["tag_a"], photoFileId: "file_1", preMergeState: { at: EM, snapshot: "{}" }, provenance: { kind: "merge" }, qualificationId: "cat_qual_x", originId: "cat_org_y" })];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.contatos[0]).toMatchObject({ qualificacao: "cat_qual_x", origem: "cat_org_y" });
    expect(naoMigrados.map((n) => n.categoria).sort()).toEqual(["foto", "historico-de-mesclagem", "origem-da-copia", "tags"]);
  });

  it("endereços e campos personalizados entram; comentário vira Nota (o apagado fica de fora)", () => {
    const antigas = [
      contatoMin("c1", {
        addresses: [{ kind: "comercial", street: "Rua A", number: "10", city: "Campinas", region: "SP", country: "BR", postalCode: "13000-000", principal: true }],
        fieldValues: [
          { definitionId: "fd_signo", value: "leão", state: "ativo" },
          { definitionId: "fd_lista", value: ["a", "b"], state: "ativo" },
          { definitionId: "fd_velho", value: "x", state: "arquivado" },
        ],
        comments: [
          { id: "cm1", author: { kind: "member", id: "mem_a" }, content: "Ligou hoje.", createdAt: "2026-03-01T10:00:00.000Z" },
          { id: "cm2", author: ATOR, content: "Apagada", deletedAt: EM },
        ],
      }),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.contatos[0]!.enderecos).toEqual([
      { rotulo: "comercial", logradouro: "Rua A", numero: "10", cidade: "Campinas", estado: "SP", pais: "BR", codigoPostal: "13000-000", principal: true },
    ]);
    // Só valor simples e ativo cabe em campos_adicionais (texto, número, booleano).
    expect(linhasPorTabela.contatos[0]!.campos_adicionais).toEqual({ fd_signo: "leão" });
    expect(linhasPorTabela.contato_notas).toEqual([{ contato_id: "c1", conteudo: "Ligou hoje.", autor_id: "mem_a", criado_em: "2026-03-01T10:00:00.000Z" }]);
    expect(naoMigrados).toContainEqual({ categoria: "comentario-apagado", colecao: "contacts", id: "c1" });
  });

  it("consentimento vira linha com o canal da 011; o de LinkedIn ou chat do site não tem destino e vai para o relatório", () => {
    const consentimento = (channelType: string, extra: Record<string, unknown> = {}) => ({
      purposeId: "cat_fin_atend",
      channelType,
      decision: "concedido",
      at: "2026-02-01T09:00:00.000Z",
      origin: "mensagem",
      recordedBy: { kind: "system", id: "sistema" },
      recordedAt: "2026-02-01T09:00:00.000Z",
      ...extra,
    });
    const antigas = [contatoMin("c1", { consents: [consentimento("todos"), consentimento("whatsapp", { decision: "revogado", evidenceMessageId: "msg_1" }), consentimento("linkedin")] })];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.contato_consentimentos.map((c) => [c.tipo_de_canal, c.decisao, c.finalidade_id, c.registrado_por, c.evidencia_mensagem_id])).toEqual([
      ["todos", "concedido", "cat_fin_atend", "sistema", null],
      ["whatsapp", "revogado", "cat_fin_atend", "sistema", "msg_1"],
    ]);
    expect(naoMigrados).toContainEqual({ categoria: "consentimento-sem-destino", colecao: "contacts", id: "c1" });
  });
});

describe("Negócios (15-28 Task 2)", () => {
  const empresaComAdmin = [contatoMin("c1"), empresaMin("e1"), vinculoMin("v1", "c1", "e1"), funilMin("f1", ["e1", "e2"])];

  it("o Negócio com Empresa tem a Empresa como dono; sem Empresa, o Contato principal; sem nenhum dos dois não migra", () => {
    const antigas = [
      ...empresaComAdmin,
      negocioMin("n_empresa", { companyId: "e1", contactLinks: [{ contactId: "c1", principal: true }] }, 0),
      negocioMin("n_contato", { contactLinks: [{ contactId: "fantasma", principal: false }, { contactId: "c1", principal: true }] }, 1),
      negocioMin("n_primeiro", { contactLinks: [{ contactId: "c1", principal: false }] }, 2),
      negocioMin("n_sem_dono", { contactLinks: [] }, 3),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);
    const dono = Object.fromEntries(linhasPorTabela.negocios.map((n) => [n.id, [n.empresa_id, n.contato_id]]));

    expect(dono).toEqual({ n_empresa: ["e1", null], n_contato: [null, "c1"], n_primeiro: [null, "c1"] });
    expect(naoMigrados).toContainEqual({ categoria: "negocio-sem-dono", colecao: "deals", id: "n_sem_dono" });
    // Os demais Contatos do Negócio não têm onde morar: ficam no relatório.
    expect(naoMigrados).toContainEqual({ categoria: "negocio-detalhes", colecao: "deals", id: "n_empresa" });
  });

  it("o Funil e a Etapa precisam migrar: guarda o id antigo da Etapa para o inserir trocar pelo do crm_de_para", () => {
    const antigas = [
      ...empresaComAdmin,
      negocioMin("n_ok", { companyId: "e1", funnelId: "f1", stageId: "e2" }, 0),
      negocioMin("n_funil_fora", { companyId: "e1", funnelId: "f_fora", stageId: "e1" }, 1),
      negocioMin("n_etapa_fantasma", { companyId: "e1", funnelId: "f1", stageId: "nao_existe" }, 2),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.negocios.map((n) => [n.id, n.funil_id, n.etapa_id_antiga])).toEqual([["n_ok", "f1", "e2"]]);
    expect(naoMigrados.filter((n) => n.categoria === "negocio-sem-funil-migrado").map((n) => n.id).sort()).toEqual(["n_etapa_fantasma", "n_funil_fora"]);
  });

  it("sem nenhum Funil migrado (--funil=guardar) nenhum Negócio migra", () => {
    const { linhasPorTabela, naoMigrados } = planejarMigracao([...empresaComAdmin, negocioMin("n1", { companyId: "e1" })], CRM_NOVO_VAZIO, { gerarId: contador() });

    expect(linhasPorTabela.negocios).toEqual([]);
    expect(naoMigrados).toContainEqual({ categoria: "negocio-sem-funil-migrado", colecao: "deals", id: "n1" });
  });

  it("situação, motivos, encerramento, valor, probabilidade e lixeira seguem as constraints da 007", () => {
    const antigas = [
      ...empresaComAdmin,
      negocioMin("n_aberto", { companyId: "e1", closedAt: "2026-05-01T00:00:00.000Z", lossReasonId: "cat_x", value: { amount: 1500.5, currency: "brl" }, overriddenProbability: 140 }, 0),
      negocioMin("n_ganho", { companyId: "e1", situation: "ganho", closedAt: "2026-05-02T10:00:00.000Z", winReasonId: "cat_g", lossReasonId: "cat_x", closingNote: "ok" }, 1),
      negocioMin("n_perdido", { companyId: "e1", situation: "perdido", lossReasonId: "cat_p", winReasonId: "cat_g" }, 2),
      negocioMin("n_lixo", { companyId: "e1", lifecycle: "naLixeira", value: { amount: -5, currency: "BRL" }, expectedCloseDate: "2026-13-45" }, 3),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);
    const por = Object.fromEntries(linhasPorTabela.negocios.map((n) => [n.id, n]));

    expect(por.n_aberto).toMatchObject({ situacao: "aberto", encerrado_em: null, motivo_perda: null, motivo_ganho: null, valor: 1500.5, moeda: "BRL", probabilidade: 100 });
    expect(por.n_ganho).toMatchObject({ situacao: "ganho", encerrado_em: "2026-05-02T10:00:00.000Z", motivo_ganho: "cat_g", motivo_perda: null, nota_encerramento: "ok" });
    expect(por.n_perdido).toMatchObject({ situacao: "perdido", motivo_perda: "cat_p", motivo_ganho: null });
    // Encerrado sem data de encerramento ainda precisa de uma (`negocios_encerramento_ck`).
    expect(por.n_perdido!.encerrado_em).not.toBeNull();
    expect(por.n_lixo).toMatchObject({ estado: "na_lixeira", valor: null, data_prevista_fechamento: null });
    expect(naoMigrados).toContainEqual({ categoria: "valor-invalido", colecao: "deals", id: "n_lixo" });
  });

  it("código legível, campos personalizados, histórico de Etapas, Tags e anexos vão para o relatório", () => {
    const antigas = [
      ...empresaComAdmin,
      negocioMin("n1", { companyId: "e1", readableId: "NEG-1", fieldValues: [{ definitionId: "fd", value: "x", state: "ativo" }], stageHistory: [{ id: "t" }], tagIds: ["t"], attachments: [{ fileId: "f" }], comments: [{}] }),
    ];

    const { naoMigrados } = planoCom(antigas);

    expect(naoMigrados.filter((n) => n.colecao === "deals").map((n) => n.categoria).sort()).toEqual(["anexos-e-comentarios", "negocio-detalhes", "tags"]);
  });

  it("o seed inteiro: todo Negócio migra (todos têm Empresa com admin) e o Funil traz as Etapas que o Negócio usa", () => {
    const { linhasPorTabela, naoMigrados } = planoCom([...doSeed("contacts"), ...doSeed("companies"), ...doSeed("contactCompanyLinks"), ...doSeed("funnels"), ...doSeed("deals")], { funis: FUNIS_DO_SEED });

    expect(linhasPorTabela.negocios).toHaveLength(19);
    expect(naoMigrados.filter((n) => n.categoria.startsWith("negocio-s"))).toEqual([]);
    expect(linhasPorTabela.negocios.every((n) => (n.empresa_id === null) !== (n.contato_id === null))).toBe(true);
  });

  it("as regras de Etapa (requisitos e transições) de um Funil migrado vão para o relatório", () => {
    const antigas = [
      linha("funnels", "f1", { name: "f1", stages: [{ id: "e1", name: "Novo", order: 0, requirements: [{ kind: "valorObrigatorio" }], allowedTransitionStageIds: [] }, { id: "e2", name: "Fim", order: 1, requirements: [], allowedTransitionStageIds: ["e1"] }] }),
      linha("funnels", "f_fora", { name: "f_fora", stages: [{ id: "x", name: "X", order: 0, requirements: [{ kind: "valorObrigatorio" }] }] }),
    ];

    const { naoMigrados } = planoCom(antigas);

    expect(naoMigrados.filter((n) => n.categoria === "regras-da-etapa")).toEqual([{ categoria: "regras-da-etapa", colecao: "funnels", id: "f1" }]);
  });
});

describe("Canais (15-28 Task 2)", () => {
  it("o Canal entra com o id antigo, o provedor padrão do tipo e o resto da configuração; o de LinkedIn e o chat do site vão para o relatório", () => {
    const antigas = [
      canalMin("wpp", { channelType: "whatsapp", name: "Comercial", externalId: "+5511987654321", defaultQueueId: "fila_com", defaultContactOwnerMemberId: "mem_j", defaultOriginId: "cat_o", groupsEnabled: true }, 0),
      canalMin("insta", { channelType: "instagram", name: "@loja", externalId: "loja" }, 1),
      canalMin("mail", { channelType: "email", name: "Contato", externalId: "contato@exemplo.test" }, 2),
      canalMin("site", { channelType: "chatDoSite" }, 3),
      canalMin("lkd", { channelType: "linkedin" }, 4),
    ];

    const { linhasPorTabela, deParas, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.canais.map((c) => [c.id, c.tipo, c.provedor])).toEqual([
      ["wpp", "whatsapp", "whatsapp-cloud"],
      ["insta", "instagram", "instagram-graph"],
      ["mail", "email", "email-imap-smtp"],
    ]);
    expect(linhasPorTabela.canais[0]).toMatchObject({
      nome: "Comercial",
      identificador_externo: "+5511987654321",
      estado: "ativo",
      configurado_por: "mem_x",
      fila_padrao_id: "fila_com",
      proprietario_padrao_id: "mem_j",
      origem_padrao_id: "cat_o",
      grupos_habilitados: true,
    });
    expect(deParas).toContainEqual({ colecao_antiga: "channels", id_antigo: "wpp", tabela_nova: "canais", id_novo: "wpp" });
    expect(naoMigrados.filter((n) => n.categoria === "canal-sem-destino").map((n) => n.id).sort()).toEqual(["lkd", "site"]);
  });

  it("provedor explícito de outro tipo cai no padrão; Canal arquivado leva a data de arquivamento", () => {
    const antigas = [
      canalMin("a", { channelType: "email", provider: "whatsapp-cloud", externalId: "a@exemplo.test" }, 0),
      canalMin("b", { channelType: "whatsapp", provider: "whatsapp-nao-oficial", lifecycle: "arquivado", archivedAt: "2026-04-01T00:00:00.000Z" }, 1),
    ];

    const { linhasPorTabela } = planoCom(antigas);

    expect(linhasPorTabela.canais.map((c) => [c.id, c.provedor, c.estado, c.arquivado_em])).toEqual([
      ["a", "email-imap-smtp", "ativo", null],
      ["b", "whatsapp-nao-oficial", "arquivado", "2026-04-01T00:00:00.000Z"],
    ]);
  });

  it("nome ou conta repetidos entre Canais ativos (ou já no CRM novo) deixam o segundo no relatório; arquivado não conta", () => {
    const antigas = [
      canalMin("a", { name: "Comercial", externalId: "+551100000001" }, 0),
      canalMin("b", { name: " COMERCIAL ", externalId: "+551100000002" }, 1),
      canalMin("c", { name: "Outro", externalId: "+551100000001" }, 2),
      canalMin("d", { name: "Velho", externalId: "+551100000001", lifecycle: "arquivado", archivedAt: EM }, 3),
      canalMin("e", { name: "Existente", externalId: "+551100000009" }, 4),
      canalMin("f", { name: "Sem Id", externalId: " " }, 5),
    ];
    const crmNovo: CrmNovoDoEspaco = { ...CRM_NOVO_VAZIO, nomesDeCanalAtivo: new Set(["existente"]) };

    const { linhasPorTabela, naoMigrados } = planoCom(antigas, { crmNovo });

    expect(linhasPorTabela.canais.map((c) => c.id)).toEqual(["a", "d"]);
    expect(naoMigrados.filter((n) => n.categoria === "canal-repetido").map((n) => n.id).sort()).toEqual(["b", "c", "e"]);
    expect(naoMigrados).toContainEqual({ categoria: "canal-invalido", colecao: "channels", id: "f" });
  });
});

describe("Conversas e Mensagens (15-28 Task 2)", () => {
  const base = [contatoMin("c1"), canalMin("ch1", {}, 0)];
  const mensagem = (id: string, extra: Record<string, unknown> = {}) => ({ id, direction: "enviada", actor: ATOR, content: `Texto ${id}`, attachments: [], createdAt: EM, ...extra });

  it("Conversa na lixeira entra resolvida, na_lixeira e com na_lixeira_em; a aberta fica aberta e leva fila e atribuído", () => {
    const antigas = [
      ...base,
      conversaMin("cv_lixo", { lifecycle: "naLixeira", state: "resolvida", trashedAt: "2026-10-30T09:00:00.000Z", assignee: { kind: "member", id: "mem_a" } }, 0),
      conversaMin("cv_ok", { contactId: "c1", queueId: "fila_1", assignee: { kind: "member", id: "mem_a" } }, 1),
    ];

    const { linhasPorTabela } = planoCom(antigas);
    const por = Object.fromEntries(linhasPorTabela.conversas.map((c) => [c.id, c]));

    expect(por.cv_lixo).toMatchObject({ situacao: "resolvida", estado: "na_lixeira", na_lixeira_em: "2026-10-30T09:00:00.000Z" });
    expect(por.cv_ok).toMatchObject({ situacao: "aberta", estado: "ativo", na_lixeira_em: null, fila_id: "fila_1", atribuido_tipo: "membro", atribuido_id: "mem_a", criado_por_tipo: "member", criado_por_id: "mem_x" });
  });

  it("Conversa na lixeira sem data de lixeira ainda ganha uma; a pendente leva o adiamento e a resolvida não", () => {
    const antigas = [
      ...base,
      conversaMin("cv_lixo", { lifecycle: "naLixeira", state: "resolvida" }, 0),
      conversaMin("cv_pend", { state: "pendente", snooze: { until: "2026-11-08T14:00:00.000Z", reason: "retorno" } }, 1),
      conversaMin("cv_res", { state: "resolvida", snooze: { until: "2026-11-08T14:00:00.000Z" }, resolvedAt: "2026-05-05T00:00:00.000Z", reopenCount: 2 }, 2),
    ];

    const { linhasPorTabela } = planoCom(antigas);
    const por = Object.fromEntries(linhasPorTabela.conversas.map((c) => [c.id, c]));

    expect(por.cv_lixo!.na_lixeira_em).not.toBeNull();
    expect(por.cv_pend).toMatchObject({ situacao: "pendente", adiada_ate: "2026-11-08T14:00:00.000Z", adiamento_motivo: "retorno" });
    expect(por.cv_res).toMatchObject({ adiada_ate: null, adiamento_motivo: null, resolvida_em: "2026-05-05T00:00:00.000Z", reaberturas: 2 });
  });

  it("duas Conversas não resolvidas do mesmo Contato e Canal: a mais recente entra e a outra vai para o relatório", () => {
    const antigas = [
      ...base,
      conversaMin("velha", { createdAt: "2026-03-01T00:00:00.000Z" }, 0),
      conversaMin("nova", { createdAt: "2026-04-01T00:00:00.000Z", state: "pendente" }, 1),
      conversaMin("resolvida", { createdAt: "2026-01-01T00:00:00.000Z", state: "resolvida" }, 2),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.conversas.map((c) => c.id).sort()).toEqual(["nova", "resolvida"]);
    expect(naoMigrados).toContainEqual({ categoria: "conversa-repetida", colecao: "conversations", id: "velha" });
  });

  it("a Conversa que o CRM novo já tem aberta no mesmo par vence a antiga", () => {
    const crmNovo: CrmNovoDoEspaco = { ...CRM_NOVO_VAZIO, conversasNaoResolvidas: new Set([chaveDeParDeConversa("c1", "ch1")]) };

    const { linhasPorTabela, naoMigrados } = planoCom([...base, conversaMin("antiga")], { crmNovo });

    expect(linhasPorTabela.conversas).toEqual([]);
    expect(naoMigrados).toContainEqual({ categoria: "conversa-repetida", colecao: "conversations", id: "antiga" });
  });

  it("Conversa de Canal que não migrou vai para o relatório com as Mensagens; a de Grupo e a sem Contato do CRM antigo nem entram (ficam em registros)", () => {
    const antigas = [
      ...base,
      canalMin("site", { channelType: "chatDoSite" }, 1),
      // Sem `contactId` ou com um que não é da coleção `contacts` (Flow, Automação, convite de Grupo): não dá para
      // classificar como CRM antigo, então fica em `registros`, não migra e não vai para o relatório (15-44, H-02).
      conversaMin("sem_contato", { contactId: undefined, unresolvedIdentifier: { type: "perfilDeLinkedIn", value: "x" }, messages: [mensagem("m1")] }, 0),
      conversaMin("canal_fora", { channelId: "site", messages: [mensagem("m2")] }, 1),
      conversaMin("contato_fora_do_crm_antigo", { contactId: "fantasma" }, 2),
      conversaMin("grupo", { groupIdentifier: { externalId: "g", name: "Turma" }, messages: [mensagem("m3")] }, 3),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.conversas).toEqual([]);
    expect(linhasPorTabela.mensagens).toEqual([]);
    expect(naoMigrados.map((n) => [n.categoria, n.id]).sort()).toEqual(
      [
        ["canal-sem-destino", "site"],
        ["conversa-sem-canal-migrado", "canal_fora"],
      ].sort(),
    );
  });

  it("a Conversa 1:1 de Flow/Automação (Contato só em plataforma.contatos) fica em registros: não migra, mesmo com o Canal e o Contato existentes", () => {
    const antigas = [contatoMin("c1"), conversaMin("flow", { contactId: "ctt_so_na_tabela", channelId: "ch_tab", messages: [mensagem("m1")] }), conversaMin("antiga", { channelId: "ch_tab" }, 1)];
    const crmNovo: CrmNovoDoEspaco = { ...CRM_NOVO_VAZIO, canaisExistentes: new Map([["ch_tab", "whatsapp"]]), contatosExistentes: new Set(["ctt_so_na_tabela"]) };

    const { linhasPorTabela, naoMigrados } = planoCom(antigas, { crmNovo });

    expect(linhasPorTabela.conversas.map((c) => c.id)).toEqual(["antiga"]);
    expect(linhasPorTabela.mensagens).toEqual([]);
    expect(naoMigrados.filter((n) => n.id === "flow")).toEqual([]);
  });

  it("estrela vira marcação por Membro; rascunhos, Tags e campos da Conversa vão para o relatório; participantes trocam de vocabulário", () => {
    const antigas = [
      ...base,
      conversaMin("cv", {
        starredBy: ["mem_a", "mem_b", "mem_a"],
        drafts: [{ content: "..." }],
        tagIds: ["t"],
        participants: [
          { id: "p1", subject: { kind: "contact", id: "c1" }, role: "contato", principal: true, enteredAt: EM },
          { id: "p2", subject: { kind: "member", id: "mem_a" }, role: "atendente", enteredAt: EM, leftAt: "2026-02-01T00:00:00.000Z" },
          { id: "p3", subject: { kind: "automation", id: "aut" }, role: "observador", enteredAt: EM },
        ],
      }),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.conversa_marcacoes).toEqual([
      { conversa_id: "cv", membro_id: "mem_a", estrela: true },
      { conversa_id: "cv", membro_id: "mem_b", estrela: true },
    ]);
    expect(naoMigrados).toContainEqual({ categoria: "conversa-detalhes", colecao: "conversations", id: "cv" });
    expect(linhasPorTabela.conversas[0]!.participantes).toEqual([
      { id: "p1", sujeito: { tipo: "contato", id: "c1" }, papel: "contato", principal: true, entrouEm: EM, saiuEm: null },
      { id: "p2", sujeito: { tipo: "membro", id: "mem_a" }, papel: "atendente", principal: false, entrouEm: EM, saiuEm: "2026-02-01T00:00:00.000Z" },
    ]);
  });

  it("Mensagem recebida sem id externo ganha migrado:<id> e o ator integration do Canal; a enviada ganha status de entrega; a interna não tem nenhum dos dois", () => {
    const antigas = [
      ...base,
      conversaMin("cv", {
        messages: [
          mensagem("m_rec", { direction: "recebida", actor: { kind: "integration", id: "ch1" } }),
          mensagem("m_rec_ext", { direction: "recebida", externalId: "wamid.1" }),
          mensagem("m_env", { direction: "enviada", deliveryStatus: "lida" }),
          mensagem("m_env_sem", { direction: "enviada" }),
          mensagem("m_int", { direction: "interna", externalId: "nao-deveria", deliveryStatus: "lida" }),
        ],
      }),
    ];

    const { linhasPorTabela, deParas } = planoCom(antigas);
    const por = Object.fromEntries(linhasPorTabela.mensagens.map((m) => [m.id, m]));

    expect(por.m_rec).toMatchObject({ direcao: "recebida", id_externo: "migrado:m_rec", ator_tipo: "integration", ator_id: "ch1", status_entrega: null, conversa_id: "cv", canal_id: "ch1" });
    expect(por.m_rec_ext).toMatchObject({ id_externo: "wamid.1", ator_tipo: "integration", ator_id: "ch1" });
    expect(por.m_env).toMatchObject({ status_entrega: "lida", ator_tipo: "member", ator_id: "mem_x" });
    expect(por.m_env_sem!.status_entrega).toBe("enviada");
    expect(por.m_int).toMatchObject({ status_entrega: null, id_externo: null });
    expect(deParas).toContainEqual({ colecao_antiga: "conversations/messages", id_antigo: "cv/m_env", tabela_nova: "mensagens", id_novo: "m_env" });
  });

  it("as Mensagens saem em ordem de createdAt; a resposta só aponta para uma anterior da mesma Conversa; Mensagem vazia vai para o relatório", () => {
    const antigas = [
      ...base,
      conversaMin("cv", {
        messages: [
          mensagem("m_tarde", { createdAt: "2026-02-03T00:00:00.000Z", inReplyToMessageId: "m_cedo" }),
          mensagem("m_cedo", { createdAt: "2026-02-01T00:00:00.000Z", inReplyToMessageId: "m_tarde" }),
          mensagem("m_vazia", { createdAt: "2026-02-02T00:00:00.000Z", content: "  " }),
          mensagem("m_anexo", { createdAt: "2026-02-04T00:00:00.000Z", content: "", attachments: [{ fileId: "file_1", mediaType: "image", displayName: "foto.png" }] }),
        ],
      }),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.mensagens.map((m) => m.id)).toEqual(["m_cedo", "m_tarde", "m_anexo"]);
    const por = Object.fromEntries(linhasPorTabela.mensagens.map((m) => [m.id, m]));
    expect(por.m_cedo!.em_resposta_a_id).toBeNull(); // a "anterior" apontada vem DEPOIS
    expect(por.m_tarde!.em_resposta_a_id).toBe("m_cedo");
    expect(por.m_anexo!.anexos).toEqual([{ tipoDeMidia: "image", nome: "foto.png", referenciaExterna: "file_1" }]);
    expect(naoMigrados).toContainEqual({ categoria: "mensagem-vazia", colecao: "conversations", id: "cv" });
  });

  it("identificador de origem da Mensagem passa pelo de-para do Identificador; id externo repetido no Canal não colide", () => {
    const antigas = [
      contatoMin("c1", { identifiers: [{ id: "cid_zap", type: "identidadeDeWhatsApp", value: "5511900000000", displayValue: "+55", principal: true }] }),
      canalMin("ch1"),
      conversaMin("cv", {
        messages: [
          mensagem("m1", { direction: "recebida", viaIdentifierId: "cid_zap", externalId: "igual" }),
          mensagem("m2", { direction: "recebida", viaIdentifierId: "nao_existe", externalId: "igual", createdAt: "2026-01-02T00:00:00.000Z" }),
        ],
      }),
    ];

    const { linhasPorTabela } = planoCom(antigas);
    const identificador = linhasPorTabela.contato_identificadores[0]!;

    expect(linhasPorTabela.mensagens.map((m) => [m.id, m.identificador_id, m.id_externo])).toEqual([
      ["m1", identificador.id, "igual"],
      ["m2", null, "migrado:m2"],
    ]);
  });

  it("Mensagem de Flow migra sem o Flow e o relatório avisa", () => {
    const antigas = [...base, conversaMin("cv", { messages: [mensagem("m1", { flow: { id: "flw" } })] })];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.mensagens.map((m) => m.id)).toEqual(["m1"]);
    expect(naoMigrados).toContainEqual({ categoria: "mensagem-flow", colecao: "conversations", id: "cv" });
  });

  it("o seed inteiro: toda Conversa sem Grupo e de Canal que migra entra, e toda Mensagem dela", () => {
    const tudo = ["contacts", "companies", "contactCompanyLinks", "companyCompanyLinks", "distinctFromLinks", "funnels", "deals", "channels", "conversations"].flatMap(doSeed);

    const { linhasPorTabela, naoMigrados } = planoCom(tudo, { funis: FUNIS_DO_SEED });
    const conversasDoSeed = doSeed("conversations").filter((l) => !(l.dados as { groupIdentifier?: unknown }).groupIdentifier);
    const esperadas = conversasDoSeed.filter((l) => (l.dados as { channelId: string }).channelId !== "chn_site");

    expect(naoMigrados.filter((n) => n.categoria === "canal-sem-destino").map((n) => n.id).sort()).toEqual(["chn_linkedin", "chn_site"]);
    expect(linhasPorTabela.canais.map((c) => c.id).sort()).toEqual(["chn_insta", "chn_mail", "chn_wpp"]);
    expect(linhasPorTabela.conversas).toHaveLength(esperadas.length);
    const mensagensEsperadas = esperadas.reduce((soma, l) => soma + (l.dados as { messages: unknown[] }).messages.length, 0);
    expect(linhasPorTabela.mensagens).toHaveLength(mensagensEsperadas);
    // Cada de-para de Mensagem tem o prefixo da Conversa (o `--verificar` confere a origem pelo primeiro trecho).
    expect(plano(tudo).deParas.filter((d) => d.colecao_antiga === "conversations/messages").every((d) => d.id_antigo.includes("/"))).toBe(true);
  });
});

describe("destino que já está nas tabelas novas (15-44 Task 1, H-01)", () => {
  const mensagem = (id: string) => ({ id, direction: "enviada", actor: ATOR, content: `Texto ${id}`, attachments: [], createdAt: EM });
  const comCanalExistente = (id: string, tipo = "whatsapp"): Partial<CrmNovoDoEspaco> => ({ canaisExistentes: new Map([[id, tipo]]) });

  it("a Conversa de um Canal que só existe em plataforma.canais migra com as Mensagens, e o Canal não é reinserido", () => {
    // `ch_tab` não está na coleção `channels`: foi criado pelo CRM novo (a Fase 8) e o chat antigo o enxergava por projeção.
    const antigas = [contatoMin("c1"), conversaMin("cv", { channelId: "ch_tab", messages: [mensagem("m1"), mensagem("m2")] })];
    const crmNovo: CrmNovoDoEspaco = { ...CRM_NOVO_VAZIO, ...comCanalExistente("ch_tab") };

    const { linhasPorTabela, naoMigrados, deParas } = planoCom(antigas, { crmNovo });

    expect(linhasPorTabela.canais).toEqual([]);
    expect(linhasPorTabela.conversas.map((c) => [c.id, c.canal_id, c.contato_id])).toEqual([["cv", "ch_tab", "c1"]]);
    expect(linhasPorTabela.mensagens.map((m) => [m.id, m.canal_id])).toEqual([
      ["m1", "ch_tab"],
      ["m2", "ch_tab"],
    ]);
    expect(naoMigrados.filter((n) => n.categoria === "conversa-sem-canal-migrado")).toEqual([]);
    // O Canal não é do script: nenhuma linha de de-para para ele.
    expect(deParas.filter((d) => d.colecao_antiga === "channels")).toEqual([]);
  });

  it("o mesmo id no CRM antigo e no novo: o Canal vai para o relatório (id-ja-existe), não é reinserido, e a Conversa dele migra", () => {
    const antigas = [contatoMin("c1"), canalMin("ch1", {}, 0), conversaMin("cv", { messages: [mensagem("m1")] })];
    const crmNovo: CrmNovoDoEspaco = { ...CRM_NOVO_VAZIO, idsDeCanal: new Set(["ch1"]), ...comCanalExistente("ch1") };

    const { linhasPorTabela, naoMigrados } = planoCom(antigas, { crmNovo });

    expect(linhasPorTabela.canais).toEqual([]);
    expect(naoMigrados).toContainEqual({ categoria: "id-ja-existe", colecao: "channels", id: "ch1" });
    expect(linhasPorTabela.conversas.map((c) => c.id)).toEqual(["cv"]);
    expect(linhasPorTabela.mensagens.map((m) => m.id)).toEqual(["m1"]);
  });

  it("o Contato que já está em plataforma.contatos recebe a Conversa e o Negócio do CRM antigo, sem ser duplicado", () => {
    const antigas = [
      contatoMin("c_dup"),
      canalMin("ch1", {}, 0),
      conversaMin("cv", { contactId: "c_dup" }),
      negocioMin("n1", { contactLinks: [{ contactId: "c_dup", principal: true }] }),
    ];
    const crmNovo: CrmNovoDoEspaco = { ...CRM_NOVO_VAZIO, idsDeContato: new Set(["c_dup"]), contatosExistentes: new Set(["c_dup"]) };

    const { linhasPorTabela, naoMigrados } = planoCom(antigas, { crmNovo });

    expect(linhasPorTabela.contatos).toEqual([]);
    expect(naoMigrados).toContainEqual({ categoria: "id-ja-existe", colecao: "contacts", id: "c_dup" });
    expect(linhasPorTabela.conversas.map((c) => [c.id, c.contato_id])).toEqual([["cv", "c_dup"]]);
    expect(linhasPorTabela.negocios.map((n) => [n.id, n.contato_id])).toEqual([["n1", "c_dup"]]);
    expect(naoMigrados.filter((n) => n.categoria === "conversa-sem-contato" || n.categoria === "negocio-sem-dono")).toEqual([]);
  });

  it("Canal e Contato que não existem em lugar nenhum continuam indo para o relatório", () => {
    const antigas = [contatoMin("c1"), conversaMin("sem_canal", { channelId: "fantasma" })];
    const crmNovo: CrmNovoDoEspaco = { ...CRM_NOVO_VAZIO, ...comCanalExistente("outro_canal") };

    const { linhasPorTabela, naoMigrados } = planoCom(antigas, { crmNovo });

    expect(linhasPorTabela.conversas).toEqual([]);
    expect(naoMigrados).toContainEqual({ categoria: "conversa-sem-canal-migrado", colecao: "conversations", id: "sem_canal" });
  });

  it("a Conversa que cita um Canal existente respeita o par já ocupado no CRM novo (conversa-repetida)", () => {
    const antigas = [contatoMin("c1"), conversaMin("cv", { channelId: "ch_tab" })];
    const crmNovo: CrmNovoDoEspaco = { ...CRM_NOVO_VAZIO, ...comCanalExistente("ch_tab"), conversasNaoResolvidas: new Set([chaveDeParDeConversa("c1", "ch_tab")]) };

    const { linhasPorTabela, naoMigrados } = planoCom(antigas, { crmNovo });

    expect(linhasPorTabela.conversas).toEqual([]);
    expect(naoMigrados).toContainEqual({ categoria: "conversa-repetida", colecao: "conversations", id: "cv" });
  });
});

describe("dado sujo não derruba o Espaço (15-44 Task 3, M-04)", () => {
  const ator = ATOR;
  const msg = (extra: Record<string, unknown> = {}) => ({ direction: "enviada", actor: ator, content: "Texto", attachments: [], createdAt: EM, ...extra });

  it("a Mensagem sem id vai para mensagem-sem-id (coleção e id da Conversa) e as outras da Conversa migram", () => {
    const antigas = [
      contatoMin("c1"),
      canalMin("ch1", {}, 0),
      conversaMin("cv", { messages: [msg({ id: "m_ok" }), msg({ id: undefined }), msg({ id: "   " }), msg({ id: "m_ok2", createdAt: "2026-01-02T00:00:00.000Z" })] }),
    ];

    const { linhasPorTabela, naoMigrados } = planoCom(antigas);

    expect(linhasPorTabela.mensagens.map((m) => m.id)).toEqual(["m_ok", "m_ok2"]);
    expect(naoMigrados).toContainEqual({ categoria: "mensagem-sem-id", colecao: "conversations", id: "cv" });
    // Uma entrada por Conversa e categoria, só com ids (nunca texto).
    expect(naoMigrados.filter((n) => n.categoria === "mensagem-sem-id")).toHaveLength(1);
  });

  it("Identificadores de Contato sem id, ou com o mesmo id, ganham chaves de de-para que não colidem e todos migram", () => {
    const antigas = [
      contatoMin("c1", {
        identifiers: [
          { type: "email", value: "um@exemplo.test" },
          { type: "email", value: "dois@exemplo.test" },
          { id: "i_rep", type: "telefone", value: "+5511900000001" },
          { id: "i_rep", type: "telefone", value: "+5511900000002" },
        ],
      }),
    ];

    const { linhasPorTabela, deParas } = plano(antigas);

    expect(linhasPorTabela.contato_identificadores).toHaveLength(4);
    const chaves = deParas.filter((d) => d.colecao_antiga === "contacts/identifiers").map((d) => d.id_antigo);
    expect(chaves).toHaveLength(4);
    expect(new Set(chaves).size).toBe(4);
    // Todas levam o Contato no primeiro trecho, que é o que o --verificar usa para achar a origem.
    expect(chaves.every((c) => c.startsWith("c1/"))).toBe(true);
  });

  it("Identificadores de Empresa sem id ou repetidos também não colidem", () => {
    const antigas = [
      contatoMin("c1"),
      empresaMin("e1", { identifiers: [{ type: "dominio", value: "um.exemplo.test" }, { type: "dominio", value: "dois.exemplo.test" }, { id: "x", type: "telefone", value: "+5511911110000" }, { id: "x", type: "telefone", value: "+5511911110001" }] }),
      linha("contactCompanyLinks", "l1", { contactId: "c1", companyId: "e1", principalForCompany: true, start: "2026-01-01" }),
    ];

    const { linhasPorTabela, deParas } = plano(antigas);

    expect(linhasPorTabela.empresa_identificadores).toHaveLength(4);
    const chaves = deParas.filter((d) => d.colecao_antiga === "companies/identifiers").map((d) => d.id_antigo);
    expect(new Set(chaves).size).toBe(4);
  });

  it("a Mensagem de um Contato com Identificador sem id continua achando o Identificador pelo id que ela cita", () => {
    const antigas = [
      contatoMin("c1", { identifiers: [{ id: "i1", type: "email", value: "um@exemplo.test" }, { type: "email", value: "dois@exemplo.test" }] }),
      canalMin("ch1", {}, 0),
      conversaMin("cv", { messages: [msg({ id: "m1", viaIdentifierId: "i1" })] }),
    ];

    const { linhasPorTabela } = plano(antigas);

    expect(linhasPorTabela.mensagens[0]!.identificador_id).toBe(linhasPorTabela.contato_identificadores.find((i) => i.valor === "um@exemplo.test")!.id);
  });
});
