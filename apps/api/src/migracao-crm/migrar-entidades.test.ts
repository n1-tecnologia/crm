/**
 * 15-28 (UCR-09) — o `--migrar` leva o CRM antigo às tabelas novas, contra Postgres de Docker.
 *
 * SÓ Postgres local descartável (`describeComBanco` pula fora de localhost): este arquivo grava e APAGA
 * linhas de `plataforma.registros`, então nunca pode rodar contra o banco do `.env`. A fixture é o seed
 * sintético congelado; nenhum dado de produção.
 *
 *   docker run -d --rm --name crm-n1-pg-1528 -e POSTGRES_PASSWORD=x -p 55728:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55728/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55728/postgres \
 *     npx vitest run src/migracao-crm/
 *   docker rm -f crm-n1-pg-1528
 */

import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import type { RegistroAntigo } from "./formatos-antigos";
import { migrarCrmAntigo, relatorioSeco } from "./migrar-crm-antigo";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/crm-antigo-do-seed.json", import.meta.url), "utf8")) as {
  readonly linhas: readonly RegistroAntigo[];
};

const doSeed = (...colecoes: string[]): RegistroAntigo[] => FIXTURE.linhas.filter((l) => colecoes.includes(l.colecao));

/** Escritas por este teste, para a limpeza: o Espaço de cada caso. */
const criados: string[] = [];

/** Cria o Espaço e grava as linhas direto no SQL (a fixture é do CRM antigo, que o domínio já não escreve). */
async function semearEspaco(rotulo: string, linhas: readonly RegistroAntigo[]): Promise<string> {
  const ws = novoEspacoDeTeste(rotulo);
  criados.push(ws);
  await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
  for (const l of linhas) {
    await pool().query(
      "insert into plataforma.registros (workspace_id, colecao, id, dados, ordem) values ($1, $2, $3, $4::jsonb, $5)",
      [ws, l.colecao, l.id, JSON.stringify({ ...(l.dados as Record<string, unknown>), workspaceId: ws }), l.ordem],
    );
  }
  return ws;
}

async function idsDe(tabela: string, ws: string): Promise<string[]> {
  const r = await pool().query<{ id: string }>(`select id from plataforma.${tabela} where workspace_id = $1 order by id`, [ws]);
  return r.rows.map((l) => l.id);
}

describeComBanco("migrar os Contatos do CRM antigo (15-28 Task 1, traçador)", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("os Contatos da fixture chegam a plataforma.contatos com os ids antigos e o de-para tem uma linha por Contato e por Identificador", async () => {
    const contatos = doSeed("contacts");
    const ws = await semearEspaco("contatos", contatos);

    const resultado = await migrarCrmAntigo(ws);

    expect(resultado.nadaAFazer).toBe(false);
    expect(await idsDe("contatos", ws)).toEqual(contatos.map((c) => c.id).sort());
    const absorvido = await pool().query<{ estado: string; mesclado_em_id: string }>(
      "select estado, mesclado_em_id from plataforma.contatos where workspace_id = $1 and id = 'cnt_32'",
      [ws],
    );
    expect(absorvido.rows[0]).toEqual({ estado: "mesclado", mesclado_em_id: "cnt_2" });

    const identificadores = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.contato_identificadores where workspace_id = $1", [ws]);
    const dePara = await pool().query<{ colecao_antiga: string; n: string }>(
      "select colecao_antiga, count(*)::text as n from plataforma.crm_de_para where workspace_id = $1 group by colecao_antiga order by colecao_antiga",
      [ws],
    );
    expect(Object.fromEntries(dePara.rows.map((l) => [l.colecao_antiga, Number(l.n)]))).toEqual({
      contacts: contatos.length,
      "contacts/identifiers": Number(identificadores.rows[0]!.n),
    });
    // O Contato foi guardado e saiu de registros: o CRM antigo some, o novo fica.
    const restante = await pool().query("select 1 from plataforma.registros where workspace_id = $1 and colecao = 'contacts'", [ws]);
    expect(restante.rowCount).toBe(0);
  });
});

// --- 15-28 Task 3: a fixture inteira ---

/** A fixture sem `links`: o que o CRM antigo tem em `registros` e o script move. */
const CRM_ANTIGO = doSeed("contacts", "companies", "contactCompanyLinks", "companyCompanyLinks", "distinctFromLinks", "funnels", "deals", "channels", "conversations");
const LINKS = doSeed("links");

const TABELAS_NOVAS = ["contatos", "contato_identificadores", "empresas", "contato_empresa", "funis", "etapas", "negocios", "canais", "conversas", "mensagens"] as const;

const dadosDe = (l: RegistroAntigo) => l.dados as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** As Conversas sem Grupo dos Canais que o CRM novo tem (WhatsApp, Instagram, e-mail): o que o mapeador deve levar. */
const CONVERSAS_QUE_MIGRAM = CRM_ANTIGO.filter(
  (l) => l.colecao === "conversations" && !dadosDe(l).groupIdentifier && ["chn_wpp", "chn_insta", "chn_mail"].includes(dadosDe(l).channelId),
);

async function contagens(ws: string, tabelas: readonly string[]): Promise<Record<string, number>> {
  const r: Record<string, number> = {};
  for (const tabela of tabelas) {
    r[tabela] = Number((await pool().query<{ n: string }>(`select count(*)::text as n from plataforma.${tabela} where workspace_id = $1`, [ws])).rows[0]!.n);
  }
  return r;
}

/** O retrato dos quatro lugares onde o script escreve: o que "ficou como antes" compara. */
async function retrato(ws: string) {
  const registros = await pool().query<{ colecao: string; id: string; dados: unknown }>(
    "select colecao, id, dados from plataforma.registros where workspace_id = $1 order by colecao, id",
    [ws],
  );
  return {
    registros: registros.rows,
    ...(await contagens(ws, ["registros_crm_antigo", "crm_de_para", ...TABELAS_NOVAS, "contato_notas", "contato_consentimentos", "conversa_marcacoes", "empresa_identificadores"])),
  };
}

describeComBanco("a fixture inteira do seed (15-28 Task 3)", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("fixture inteira: migra sem erro de commit, as contagens são as da fixture menos os não migrados, e o CRM antigo sai de registros", async () => {
    const ws = await semearEspaco("inteira", [...CRM_ANTIGO, ...LINKS]);

    const resultado = await migrarCrmAntigo(ws, { funil: "migrar" });

    expect(resultado.nadaAFazer).toBe(false);
    const etapasDoSeed = doSeed("funnels").reduce((soma, f) => soma + dadosDe(f).stages.length, 0);
    const mensagensDoSeed = CONVERSAS_QUE_MIGRAM.reduce((soma, l) => soma + dadosDe(l).messages.length, 0);
    expect(await contagens(ws, TABELAS_NOVAS)).toMatchObject({
      contatos: 39,
      empresas: 12,
      contato_empresa: 30,
      funis: 4,
      etapas: etapasDoSeed,
      negocios: 19,
      canais: 3, // o chat do site e o LinkedIn não têm destino
      conversas: CONVERSAS_QUE_MIGRAM.length,
      mensagens: mensagensDoSeed,
    });
    // Nada do CRM antigo (fora a Conversa de Grupo) sobra em registros; os links ficam.
    const emRegistros = await pool().query<{ colecao: string; n: string }>(
      "select colecao, count(*)::text as n from plataforma.registros where workspace_id = $1 group by colecao order by colecao",
      [ws],
    );
    expect(Object.fromEntries(emRegistros.rows.map((l) => [l.colecao, Number(l.n)]))).toEqual({ conversations: 2, links: LINKS.length });
    // A cópia guarda as nove coleções inteiras (a Conversa de Grupo também).
    expect((await contagens(ws, ["registros_crm_antigo"])).registros_crm_antigo).toBe(CRM_ANTIGO.length);
    // Cada linha de de-para aponta para uma linha que existe.
    const orfas = await pool().query(
      `select 1 from plataforma.crm_de_para p
        where p.workspace_id = $1 and p.tabela_nova = 'negocios' and not exists (select 1 from plataforma.negocios n where n.workspace_id = p.workspace_id and n.id = p.id_novo)`,
      [ws],
    );
    expect(orfas.rowCount).toBe(0);
    // O resultado diz o que ficou de fora, com a categoria: a temperatura (D-15-06) e o chat do site entre elas.
    const categorias = new Set(resultado.naoMigrados.map((n) => n.categoria));
    expect(categorias).toContain("temperatura");
    expect(categorias).toContain("canal-sem-destino");
    expect(resultado.mensagem).toMatch(/Não migrados/);
    expect(resultado.entidadesMigradas.contatos).toBe(39);
  });

  it("fixture inteira: todo Vínculo de Tarefa do seed que aponta para Contato, Empresa, Negócio ou Conversa migrados acha o id nas tabelas novas", async () => {
    const ws = await semearEspaco("vinculos", [...CRM_ANTIGO, ...LINKS]);
    const resultado = await migrarCrmAntigo(ws, { funil: "migrar" });

    const tabelaDe: Record<string, string> = { contact: "contatos", company: "empresas", deal: "negocios", conversation: "conversas" };
    const colecaoDe: Record<string, string> = { contact: "contacts", company: "companies", deal: "deals", conversation: "conversations" };
    const foraDoRelatorio = new Set(resultado.naoMigrados.map((n) => `${n.colecao}:${n.id}`));
    const achados: Record<string, number> = {};
    let procurados = 0;

    for (const link of LINKS) {
      const l = dadosDe(link);
      for (const ponta of [{ tipo: l.fromType, id: l.fromId }, { tipo: l.toType, id: l.toId }]) {
        const tabela = tabelaDe[ponta.tipo];
        if (tabela === undefined) continue; // tarefa, grupo, flow...: não são do CRM antigo
        procurados += 1;
        const achou = await pool().query(`select 1 from plataforma.${tabela} where workspace_id = $1 and id = $2`, [ws, ponta.id]);
        if ((achou.rowCount ?? 0) > 0) achados[ponta.tipo] = (achados[ponta.tipo] ?? 0) + 1;
        // Não achar só é aceitável se o registro ficou no relatório de não migrados (a Conversa do chat do site, por exemplo).
        else expect(foraDoRelatorio.has(`${colecaoDe[ponta.tipo]}:${ponta.id}`) || ehConversaDeCanalSemDestino(ponta.id), `${ponta.tipo} ${ponta.id}`).toBe(true);
      }
    }

    expect(procurados).toBeGreaterThan(0);
    // Os três tipos que o seed liga a Tarefas têm vínculo que acha o id (Contato, Negócio e Conversa).
    expect(Object.keys(achados).sort()).toEqual(["contact", "conversation", "deal"]);
  });

  it("o Negócio aponta para a Etapa NOVA do mesmo nome; o Contato leva o id do Catálogo na qualificação; o Canal e a Conversa mantêm o id", async () => {
    const ws = await semearEspaco("traducao", CRM_ANTIGO);
    await migrarCrmAntigo(ws, { funil: "migrar" });

    const negocios = await pool().query<{ id: string; etapa: string; etapa_id: string }>(
      `select n.id, e.nome as etapa, n.etapa_id
         from plataforma.negocios n
         join plataforma.etapas e on e.workspace_id = n.workspace_id and e.funil_id = n.funil_id and e.id = n.etapa_id
        where n.workspace_id = $1`,
      [ws],
    );
    const nomeAntigo = (negocio: Record<string, any>) => dadosDe(doSeed("funnels").find((f) => f.id === negocio.funnelId)!).stages.find((s: { id: string }) => s.id === negocio.stageId).name;
    expect(negocios.rows).toHaveLength(19);
    for (const linha of negocios.rows) {
      const antigo = dadosDe(doSeed("deals").find((d) => d.id === linha.id)!);
      expect(linha.etapa, linha.id).toBe(nomeAntigo(antigo));
      expect(linha.etapa_id, linha.id).not.toBe(antigo.stageId); // o id da Etapa é novo
    }

    const ana = await pool().query<{ qualificacao: string; origem: string }>("select qualificacao, origem from plataforma.contatos where workspace_id = $1 and id = 'cnt_1'", [ws]);
    expect(ana.rows[0]).toEqual({ qualificacao: "cat_qual_cli", origem: "cat_org_site" });
    expect(await idsDe("canais", ws)).toEqual(["chn_insta", "chn_mail", "chn_wpp"]);
    const conversas = await idsDe("conversas", ws);
    expect(conversas).toEqual(CONVERSAS_QUE_MIGRAM.map((l) => l.id).sort());
    const canais = await pool().query<{ id: string; conexao: string; provedor: string }>("select id, conexao, provedor from plataforma.canais where workspace_id = $1 order by id", [ws]);
    expect(canais.rows).toEqual([
      { id: "chn_insta", conexao: "desconectada", provedor: "instagram-graph" },
      { id: "chn_mail", conexao: "desconectada", provedor: "email-imap-smtp" },
      { id: "chn_wpp", conexao: "desconectada", provedor: "whatsapp-cloud" },
    ]);
  });

  it("a Mensagem recebida ganha migrado:<id> sem perder o id, e a ordem da seq é a de criado_em", async () => {
    const ws = await semearEspaco("mensagens", CRM_ANTIGO);
    await migrarCrmAntigo(ws, { funil: "migrar" });

    const recebidas = await pool().query<{ id: string; id_externo: string; ator_tipo: string }>(
      "select id, id_externo, ator_tipo from plataforma.mensagens where workspace_id = $1 and direcao = 'recebida' and id_externo like 'migrado:%'",
      [ws],
    );
    expect(recebidas.rowCount).toBeGreaterThan(0);
    for (const m of recebidas.rows) {
      expect(m.id_externo).toBe(`migrado:${m.id}`);
      expect(m.ator_tipo).toBe("integration");
    }
    const desordem = await pool().query(
      `select 1 from plataforma.mensagens a join plataforma.mensagens b
         on a.workspace_id = b.workspace_id and a.seq < b.seq and a.criado_em > b.criado_em
        where a.workspace_id = $1 limit 1`,
      [ws],
    );
    expect(desordem.rowCount).toBe(0);
  });

  it("--funil=guardar: nenhum Negócio migra (não há Funil), mas Contatos, Empresas e Conversas migram e o relatório diz", async () => {
    const ws = await semearEspaco("guardarfunil", CRM_ANTIGO);

    const resultado = await migrarCrmAntigo(ws, { funil: "guardar" });

    expect(await contagens(ws, ["funis", "negocios", "contatos", "empresas"])).toEqual({ funis: 0, negocios: 0, contatos: 39, empresas: 12 });
    expect(resultado.naoMigrados.filter((n) => n.categoria === "negocio-sem-funil-migrado")).toHaveLength(19);
  });

  it("repetir: rodar o --migrar duas vezes deixa as mesmas contagens nas tabelas novas e em crm_de_para", async () => {
    const ws = await semearEspaco("repetirtudo", [...CRM_ANTIGO, ...LINKS]);
    await migrarCrmAntigo(ws, { funil: "migrar" });
    const depois = await retrato(ws);

    const segunda = await migrarCrmAntigo(ws, { funil: "migrar" });

    expect(segunda.nadaAFazer).toBe(true);
    expect(await retrato(ws)).toEqual(depois);
  });

  it("interrupção: uma exceção depois de inserirPlano desfaz o Espaço inteiro (registros, cópia, de-para e as tabelas novas)", async () => {
    const ws = await semearEspaco("interrupcao", [...CRM_ANTIGO, ...LINKS]);
    const antes = await retrato(ws);
    expect((await contagens(ws, ["contatos"])).contatos).toBe(0);

    await expect(
      migrarCrmAntigo(ws, {
        funil: "migrar",
        ganchosDeTeste: {
          depoisDeInserirPlano: async (cliente) => {
            // Contatos, Empresas e Negócios já estão na transação: o gancho prova isso antes de lançar.
            const dentro = await cliente.query<{ contatos: string; empresas: string; negocios: string }>(
              `select (select count(*) from plataforma.contatos where workspace_id = $1)::text as contatos,
                      (select count(*) from plataforma.empresas where workspace_id = $1)::text as empresas,
                      (select count(*) from plataforma.negocios where workspace_id = $1)::text as negocios`,
              [ws],
            );
            expect(Number(dentro.rows[0]!.contatos)).toBeGreaterThan(0);
            expect(Number(dentro.rows[0]!.empresas)).toBeGreaterThan(0);
            expect(Number(dentro.rows[0]!.negocios)).toBeGreaterThan(0);
            throw new Error("falha injetada depois de inserirPlano");
          },
        },
      }),
    ).rejects.toThrow(/falha injetada/);

    expect(await retrato(ws)).toEqual(antes);
  });

  it("uma Empresa sem admin e um Identificador repetido no CRM novo não derrubam o Espaço: vão para o relatório", async () => {
    const orfa = { colecao: "companies", id: "cmp_orfa", ordem: 99, dados: { id: "cmp_orfa", tradeName: "Sem Admin Sintetica", createdBy: { kind: "member", id: "mem_x" }, lifecycle: "ativo", identifiers: [] } };
    const ws = await semearEspaco("semadmin", [...doSeed("contacts"), ...doSeed("companies"), ...doSeed("contactCompanyLinks"), orfa]);
    // O CRM novo já tem o e-mail da Ana: o Identificador antigo colide e fica no relatório.
    await pool().query("insert into plataforma.contatos (id, workspace_id, nome, proprietario_id, criado_por) values ('ctt_novo', $1, 'Novo', 'mem_x', 'mem_x')", [ws]);
    await pool().query("insert into plataforma.contato_identificadores (id, workspace_id, contato_id, tipo, valor) values ('i_novo', $1, 'ctt_novo', 'email', 'ana.ribeiro@sorrisovivo.com.br')", [ws]);

    const resultado = await migrarCrmAntigo(ws);

    expect(await idsDe("empresas", ws)).not.toContain("cmp_orfa");
    expect(resultado.naoMigrados).toContainEqual({ categoria: "empresa-sem-admin", colecao: "companies", id: "cmp_orfa" });
    expect(resultado.naoMigrados).toContainEqual({ categoria: "identificador-repetido", colecao: "contacts", id: "cnt_1" });
    expect((await contagens(ws, ["contatos"])).contatos).toBe(40);
  });

  it("--seco mostra o que o --migrar leva e o que fica de fora, sem recusar e sem escrever", async () => {
    const ws = await semearEspaco("secotudo", [...CRM_ANTIGO, ...LINKS]);
    const antes = await retrato(ws);

    const texto = await relatorioSeco(ws);

    expect(texto).toMatch(/Linhas nas tabelas novas/);
    expect(texto).toMatch(/contatos\s+39/);
    expect(texto).toMatch(/Não migrados/);
    expect(texto).toMatch(/Temperatura/);
    expect(texto).not.toMatch(/recusa/i);
    expect(texto).not.toContain("Ribeiro");
    expect(await retrato(ws)).toEqual(antes);
  });
});

/** As Conversas do chat do site e do LinkedIn ficam sem destino (o Canal não migra): o relatório as lista. */
function ehConversaDeCanalSemDestino(id: string): boolean {
  const conversa = CRM_ANTIGO.find((l) => l.colecao === "conversations" && l.id === id);
  return conversa !== undefined && ["chn_site", "chn_linkedin"].includes(dadosDe(conversa).channelId);
}
