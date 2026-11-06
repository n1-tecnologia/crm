/**
 * 15-27 (UCR-09) — `migrar:crm-antigo`, contra Postgres de Docker.
 *
 * SÓ Postgres local descartável (`describeComBanco` pula fora de localhost): este arquivo
 * grava e APAGA linhas de `plataforma.registros`, então nunca pode rodar contra o banco do `.env`.
 *
 *   docker run -d --rm --name crm-n1-pg-1527 -e POSTGRES_PASSWORD=x -p 55727:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55727/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55727/postgres \
 *     npx vitest run src/migracao-crm/
 *   docker rm -f crm-n1-pg-1527
 */

import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import { emTransacaoSoLeitura, guardarCrmAntigo, migrarCrmAntigo, relatorioSeco } from "./migrar-crm-antigo";

interface LinhaDaFixture {
  readonly colecao: string;
  readonly id: string;
  readonly dados: Record<string, unknown>;
  readonly ordem: number;
}

const FIXTURE = JSON.parse(
  readFileSync(new URL("./fixtures/registros-antigos-minimos.json", import.meta.url), "utf8"),
) as {
  readonly linhas: readonly LinhaDaFixture[];
  readonly pasta: readonly LinhaDaFixture[];
  readonly tarefaEspelho: readonly LinhaDaFixture[];
};

/** O Membro e o Funil: o Espaço do `ws_n1` real (um Funil, nada mais do CRM). */
const SO_O_FUNIL = FIXTURE.linhas.filter((l) => l.colecao === "members" || l.colecao === "funnels");

/** Escritas por este teste, para a limpeza: o Espaço de cada caso. */
const criados: string[] = [];

/** Cria o Espaço e grava as linhas direto no SQL (a fixture é do CRM antigo, que o domínio já não escreve). */
async function semearEspaco(rotulo: string, linhas: readonly LinhaDaFixture[] = FIXTURE.linhas): Promise<string> {
  const ws = novoEspacoDeTeste(rotulo);
  criados.push(ws);
  await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
  for (const linha of linhas) {
    await pool().query(
      "insert into plataforma.registros (workspace_id, colecao, id, dados, ordem) values ($1, $2, $3, $4::jsonb, $5)",
      [ws, linha.colecao, linha.id, JSON.stringify({ ...linha.dados, workspaceId: ws }), linha.ordem],
    );
  }
  return ws;
}

async function contagemPorColecao(tabela: "registros" | "registros_crm_antigo", ws: string): Promise<Record<string, number>> {
  const r = await pool().query<{ colecao: string; n: string }>(
    `select colecao, count(*) as n from plataforma.${tabela} where workspace_id = $1 group by colecao order by colecao`,
    [ws],
  );
  return Object.fromEntries(r.rows.map((linha) => [linha.colecao, Number(linha.n)]));
}

async function revisaoDoEspaco(ws: string): Promise<number> {
  const r = await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [ws]);
  return Number(r.rows[0]!.revisao);
}

/** O retrato dos quatro lugares onde o script escreve: o que "ficou como antes" compara. */
async function retratoDoEspaco(ws: string) {
  const contar = async (tabela: string) =>
    Number((await pool().query<{ n: string }>(`select count(*) as n from plataforma.${tabela} where workspace_id = $1`, [ws])).rows[0]!.n);
  return {
    registros: (await pool().query<{ colecao: string; id: string; dados: unknown }>(
      "select colecao, id, dados from plataforma.registros where workspace_id = $1 order by colecao, id",
      [ws],
    )).rows,
    copia: await contar("registros_crm_antigo"),
    deParaFeito: await contar("crm_de_para"),
    funis: await contar("funis"),
    etapas: await contar("etapas"),
    contatos: await contar("contatos"),
    revisao: await revisaoDoEspaco(ws),
  };
}

const OITO_COLECOES = ["companies", "contactCompanyLinks", "contacts", "channels", "companyCompanyLinks", "deals", "distinctFromLinks", "funnels"];

describeComBanco("guardar o CRM antigo de um Espaço (15-27 Task 1, D-15-01)", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("copia as nove coleções, apaga as oito e a Conversa sem Grupo, deixa a Conversa de Grupo e sobe a revisão em 1", async () => {
    const ws = await semearEspaco("guardar");
    const antes = await revisaoDoEspaco(ws);

    const resultado = await guardarCrmAntigo(ws);

    // A cópia tem as 9 linhas do CRM antigo (nenhum Membro): uma Conversa de Grupo entra nela também.
    expect(await contagemPorColecao("registros_crm_antigo", ws)).toEqual({
      companies: 1,
      contactCompanyLinks: 1,
      contacts: 2,
      channels: 1,
      conversations: 2,
      deals: 1,
      funnels: 1,
    });
    // `registros` perde as oito coleções e a Conversa sem Grupo; fica o Membro e a Conversa de Grupo.
    expect(await contagemPorColecao("registros", ws)).toEqual({ conversations: 1, members: 1 });
    const restante = await pool().query<{ id: string }>(
      "select id from plataforma.registros where workspace_id = $1 and colecao = 'conversations'",
      [ws],
    );
    expect(restante.rows.map((l) => l.id)).toEqual(["cnv_sint_grupo"]);
    for (const colecao of OITO_COLECOES) {
      const sobrou = await pool().query("select 1 from plataforma.registros where workspace_id = $1 and colecao = $2", [ws, colecao]);
      expect(sobrou.rowCount, colecao).toBe(0);
    }
    expect(await revisaoDoEspaco(ws)).toBe(antes + 1);
    expect(resultado.nadaAFazer).toBe(false);
    expect(resultado.conversasDeGrupoQueFicaram).toBe(1);
    // Nenhuma linha no CRM novo: guardar não migra (D-15-01).
    for (const tabela of ["contatos", "empresas", "negocios", "funis", "canais", "conversas", "crm_de_para"]) {
      const n = await pool().query(`select 1 from plataforma.${tabela} where workspace_id = $1`, [ws]);
      expect(n.rowCount, tabela).toBe(0);
    }
  });

  it("copia byte a byte: o JSON guardado é igual ao que estava em registros", async () => {
    const ws = await semearEspaco("bytes");
    const antes = await pool().query<{ colecao: string; id: string; dados: unknown; ordem: number }>(
      "select colecao, id, dados, ordem from plataforma.registros where workspace_id = $1 and colecao <> 'members' order by colecao, id",
      [ws],
    );
    await guardarCrmAntigo(ws);
    const copia = await pool().query<{ colecao: string; id: string; dados: unknown; ordem: number }>(
      "select colecao, id, dados, ordem from plataforma.registros_crm_antigo where workspace_id = $1 order by colecao, id",
      [ws],
    );
    expect(copia.rows).toEqual(antes.rows);
  });

  it("repetir não copia, não apaga e não sobe a revisão, e diz que não há nada a fazer", async () => {
    const ws = await semearEspaco("repetir");
    await guardarCrmAntigo(ws);
    const depoisDaPrimeira = await retratoDoEspaco(ws);

    const segunda = await guardarCrmAntigo(ws);

    expect(segunda.nadaAFazer).toBe(true);
    expect(segunda.copiadas).toBe(0);
    expect(segunda.mensagem).toMatch(/nada a fazer/i);
    expect(await retratoDoEspaco(ws)).toEqual(depoisDaPrimeira);
  });

  it("contagem forçada a divergir: lança, e registros, cópia, de-para e tabelas novas ficam como antes", async () => {
    const ws = await semearEspaco("divergir");
    const antes = await retratoDoEspaco(ws);

    await expect(
      guardarCrmAntigo(ws, {
        ganchosDeTeste: {
          // Apaga uma linha da cópia depois de copiar e antes de conferir.
          antesDeConferir: async (cliente) => {
            await cliente.query("delete from plataforma.registros_crm_antigo where workspace_id = $1 and colecao = 'contacts' and id = 'cnt_sint_2'", [ws]);
          },
        },
      }),
    ).rejects.toThrow(/cópia/i);

    expect(await retratoDoEspaco(ws)).toEqual(antes);
  });

  it("só mexe no Espaço nomeado: o outro Espaço com as mesmas linhas fica intacto", async () => {
    const alvo = await semearEspaco("alvo");
    const outro = await semearEspaco("outro");
    const outroAntes = await retratoDoEspaco(outro);

    await guardarCrmAntigo(alvo);

    expect(await retratoDoEspaco(outro)).toEqual(outroAntes);
  });

  it("recusa um Espaço que não existe, sem criar nada", async () => {
    await expect(guardarCrmAntigo("ws_nao_existe_1527")).rejects.toThrow(/Espaço não encontrado/);
    const criou = await pool().query("select 1 from plataforma.workspaces where workspace_id = 'ws_nao_existe_1527'");
    expect(criou.rowCount).toBe(0);
  });

  it("um Espaço sem CRM antigo não tem nada a fazer", async () => {
    const ws = await semearEspaco("vazio", FIXTURE.linhas.filter((l) => l.colecao === "members"));
    const antes = await retratoDoEspaco(ws);

    const resultado = await guardarCrmAntigo(ws);

    expect(resultado.nadaAFazer).toBe(true);
    expect(await retratoDoEspaco(ws)).toEqual(antes);
  });
});

describeComBanco("--seco: o relatório só lê (15-27 Task 2, D-15-04, D-15-14)", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("a sessão do --seco é `begin read only`: o Postgres recusa qualquer escrita (25006)", async () => {
    await expect(
      emTransacaoSoLeitura((cliente) => cliente.query("insert into plataforma.workspaces (workspace_id) values ('ws_seco_1527')")),
    ).rejects.toMatchObject({ code: "25006" });
    const criou = await pool().query("select 1 from plataforma.workspaces where workspace_id = 'ws_seco_1527'");
    expect(criou.rowCount).toBe(0);
  });

  it("lista contagens, o Funil com as Etapas, a Pasta e o plano, sem escrever e sem dado pessoal", async () => {
    const ws = await semearEspaco("seco", [...FIXTURE.linhas, ...FIXTURE.pasta]);
    const antes = await retratoDoEspaco(ws);

    const texto = await relatorioSeco(ws);

    expect(await retratoDoEspaco(ws)).toEqual(antes);
    expect(texto).toContain(ws);
    expect(texto).toMatch(/nada foi escrito/i);
    expect(texto).toMatch(/contacts\s+2/);
    expect(texto).toContain("fnl_sint_1");
    expect(texto).toContain("Vendas Sinteticas");
    expect(texto).toContain("Proposta");
    expect(texto).toContain("Meus negócios");
    expect(texto).toContain("Lista Sintetica A");
    expect(texto).toMatch(/1 .*Grupo/);
    for (const proibido of ["Pessoa", "Sintetica Um", "+550000000001", "exemplo.invalid", "Texto sintetico", "Grupo Sintetico", "120363000000000000"]) {
      expect(texto, proibido).not.toContain(proibido);
    }
  });

  it("recusa um Espaço que não existe", async () => {
    await expect(relatorioSeco("ws_nao_existe_1527")).rejects.toThrow(/Espaço não encontrado/);
  });
});

describeComBanco("o Funil: --migrar --funil=migrar|guardar (15-27 Task 2, D-15-04)", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("--funil=migrar num Espaço sem Funil novo: o Funil entra com o id antigo e padrão, as Etapas com id novo e o de-para", async () => {
    const ws = await semearEspaco("funil", SO_O_FUNIL);

    const resultado = await migrarCrmAntigo(ws, { funil: "migrar" });

    expect(resultado.nadaAFazer).toBe(false);
    const funis = await pool().query<{ id: string; nome: string; padrao: boolean; estado: string; exige_motivo_perda: boolean; exige_valor_ganho: boolean }>(
      "select id, nome, padrao, estado, exige_motivo_perda, exige_valor_ganho from plataforma.funis where workspace_id = $1",
      [ws],
    );
    expect(funis.rows).toEqual([
      { id: "fnl_sint_1", nome: "Vendas Sinteticas", padrao: true, estado: "ativo", exige_motivo_perda: true, exige_valor_ganho: false },
    ]);
    const etapas = await pool().query<{ id: string; nome: string; ordem: number; probabilidade_padrao: number; cor: string | null }>(
      "select id, nome, ordem, probabilidade_padrao, cor from plataforma.etapas where workspace_id = $1 and funil_id = 'fnl_sint_1' order by ordem",
      [ws],
    );
    expect(etapas.rows.map((e) => [e.nome, e.ordem, e.probabilidade_padrao, e.cor])).toEqual([
      ["Novo", 1, 10, null],
      ["Proposta", 2, 60, "#60a5fa"],
    ]);
    // O id da Etapa é novo: não é o id antigo (a chave antiga só é única dentro do Funil).
    expect(etapas.rows.map((e) => e.id)).not.toContain("stg_sint_novo");
    expect(etapas.rows.map((e) => e.id)).not.toContain("stg_sint_proposta");
    const dePara = await pool().query<{ colecao_antiga: string; id_antigo: string; tabela_nova: string; id_novo: string }>(
      "select colecao_antiga, id_antigo, tabela_nova, id_novo from plataforma.crm_de_para where workspace_id = $1 order by colecao_antiga, id_antigo",
      [ws],
    );
    expect(dePara.rows.filter((l) => l.tabela_nova === "funis")).toEqual([
      { colecao_antiga: "funnels", id_antigo: "fnl_sint_1", tabela_nova: "funis", id_novo: "fnl_sint_1" },
    ]);
    const deEtapas = dePara.rows.filter((l) => l.tabela_nova === "etapas");
    expect(deEtapas.map((l) => l.id_antigo).sort()).toEqual(["fnl_sint_1/stg_sint_novo", "fnl_sint_1/stg_sint_proposta"]);
    expect(deEtapas.map((l) => l.id_novo).sort()).toEqual(etapas.rows.map((e) => e.id).sort());
    // O Funil também foi guardado e saiu de registros.
    expect(await contagemPorColecao("registros_crm_antigo", ws)).toEqual({ funnels: 1 });
    expect(await contagemPorColecao("registros", ws)).toEqual({ members: 1 });
  });

  it("--funil=migrar num Espaço que já tem Funil padrão: migra sem padrão", async () => {
    const ws = await semearEspaco("funilpadrao", SO_O_FUNIL);
    await pool().query("insert into plataforma.funis (id, workspace_id, nome, padrao, criado_por) values ('fnl_ja_existia', $1, 'Ja Existia', true, 'mem_sint')", [ws]);

    await migrarCrmAntigo(ws, { funil: "migrar" });

    const padroes = await pool().query<{ id: string; padrao: boolean }>("select id, padrao from plataforma.funis where workspace_id = $1 order by id", [ws]);
    expect(padroes.rows).toEqual([
      { id: "fnl_ja_existia", padrao: true },
      { id: "fnl_sint_1", padrao: false },
    ]);
  });

  it("nome repetido com um Funil existente: não migra, o resultado diz 'nome em uso' e o Funil ainda é guardado", async () => {
    const ws = await semearEspaco("funilnome", SO_O_FUNIL);
    await pool().query("insert into plataforma.funis (id, workspace_id, nome, criado_por) values ('fnl_x', $1, 'vendas sinteticas ', 'mem_sint')", [ws]);

    const resultado = await migrarCrmAntigo(ws, { funil: "migrar" });

    expect(resultado.mensagem).toContain("nome em uso");
    const ids = await pool().query<{ id: string }>("select id from plataforma.funis where workspace_id = $1", [ws]);
    expect(ids.rows.map((l) => l.id)).toEqual(["fnl_x"]);
    expect(await contagemPorColecao("registros_crm_antigo", ws)).toEqual({ funnels: 1 });
  });

  it("--funil=guardar: nenhuma linha em funis; a cópia guarda o Funil e o Espaço fica sem Funil", async () => {
    const ws = await semearEspaco("funilguardar", SO_O_FUNIL);

    await migrarCrmAntigo(ws, { funil: "guardar" });

    expect((await pool().query("select 1 from plataforma.funis where workspace_id = $1", [ws])).rowCount).toBe(0);
    expect((await pool().query("select 1 from plataforma.crm_de_para where workspace_id = $1", [ws])).rowCount).toBe(0);
    expect(await contagemPorColecao("registros_crm_antigo", ws)).toEqual({ funnels: 1 });
    expect(await contagemPorColecao("registros", ws)).toEqual({ members: 1 });
  });

  it("--migrar sem --funil num Espaço com Funil antigo: recusa antes de escrever", async () => {
    const ws = await semearEspaco("semfunil", SO_O_FUNIL);
    const antes = await retratoDoEspaco(ws);

    await expect(migrarCrmAntigo(ws)).rejects.toThrow(/--funil=migrar/);

    expect(await retratoDoEspaco(ws)).toEqual(antes);
  });

  it("--migrar num Espaço com Contatos, Negócios ou Conversas além do Funil: recusa e manda usar --guardar", async () => {
    const ws = await semearEspaco("alemdofunil");
    const antes = await retratoDoEspaco(ws);

    await expect(migrarCrmAntigo(ws, { funil: "guardar" })).rejects.toThrow(/além do Funil; use --guardar/);

    expect(await retratoDoEspaco(ws)).toEqual(antes);
  });

  it("repetir o --migrar diz que não há nada a fazer e não insere de novo", async () => {
    const ws = await semearEspaco("funilrepetir", SO_O_FUNIL);
    await migrarCrmAntigo(ws, { funil: "migrar" });
    const depois = await retratoDoEspaco(ws);

    const segunda = await migrarCrmAntigo(ws, { funil: "migrar" });

    expect(segunda.nadaAFazer).toBe(true);
    expect(segunda.mensagem).toMatch(/nada a fazer/i);
    expect(await retratoDoEspaco(ws)).toEqual(depois);
  });

  it("interrupção: uma exceção no aoConfirmar logo depois de inserir o Funil desfaz o Espaço inteiro", async () => {
    const ws = await semearEspaco("funilfalha", SO_O_FUNIL);
    const antes = await retratoDoEspaco(ws);
    expect(antes.funis).toBe(0);

    await expect(
      migrarCrmAntigo(ws, {
        funil: "migrar",
        ganchosDeTeste: {
          depoisDeInserirFunis: async (cliente) => {
            // O Funil e as Etapas já estão na transação: o gancho prova isso antes de lançar.
            const dentro = await cliente.query("select 1 from plataforma.funis where workspace_id = $1", [ws]);
            expect(dentro.rowCount).toBe(1);
            throw new Error("falha injetada depois de inserirFunis");
          },
        },
      }),
    ).rejects.toThrow(/falha injetada/);

    expect(await retratoDoEspaco(ws)).toEqual(antes);
  });
});

describeComBanco('a Pasta "Meus negócios" (15-27 Task 2, D-15-14)', () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  const doEspaco = (ws: string, tabela: "registros" | "registros_crm_antigo", colecao: string) =>
    pool()
      .query<{ id: string }>(`select id from plataforma.${tabela} where workspace_id = $1 and colecao = $2 order by id`, [ws, colecao])
      .then((r) => r.rows.map((l) => l.id));

  it("com as duas Listas vazias: a Pasta, as Listas e as Visualizações vão para a cópia e saem de registros", async () => {
    const ws = await semearEspaco("pastavazia", FIXTURE.pasta);

    const resultado = await guardarCrmAntigo(ws);

    expect(resultado.nadaAFazer).toBe(false);
    expect(await doEspaco(ws, "registros_crm_antigo", "folders")).toEqual(["fld_meus_negocios"]);
    expect(await doEspaco(ws, "registros_crm_antigo", "lists")).toEqual(["lst_funil_a", "lst_funil_b"]);
    expect(await doEspaco(ws, "registros_crm_antigo", "views")).toEqual(["viw_lst_funil_a_quadro", "viw_lst_funil_b_quadro"]);
    expect(await contagemPorColecao("registros", ws)).toEqual({});
    expect(resultado.mensagem).toContain("Meus negócios");
  });

  it("com uma Lista com Tarefa: nada da Pasta sai, e o resultado lista a Lista e a contagem", async () => {
    const ws = await semearEspaco("pastacomtarefa", [...FIXTURE.pasta, ...FIXTURE.tarefaEspelho]);
    const antes = await retratoDoEspaco(ws);

    const resultado = await guardarCrmAntigo(ws);

    expect(resultado.nadaAFazer).toBe(true);
    expect(await retratoDoEspaco(ws)).toEqual(antes);
    expect(resultado.mensagem).toContain("Lista Sintetica A");
    expect(resultado.mensagem).toMatch(/Lista Sintetica A[^\n]*1/);
    expect(resultado.mensagem).toMatch(/nada da Pasta/i);
  });

  it("a Pasta de outro Espaço não é tocada", async () => {
    const alvo = await semearEspaco("pastaalvo", FIXTURE.pasta);
    const outro = await semearEspaco("pastaoutro", FIXTURE.pasta);
    const outroAntes = await retratoDoEspaco(outro);

    await guardarCrmAntigo(alvo);

    expect(await retratoDoEspaco(outro)).toEqual(outroAntes);
  });
});
