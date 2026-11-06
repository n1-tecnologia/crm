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
import { guardarCrmAntigo } from "./migrar-crm-antigo";

interface LinhaDaFixture {
  readonly colecao: string;
  readonly id: string;
  readonly dados: Record<string, unknown>;
  readonly ordem: number;
}

const FIXTURE = JSON.parse(
  readFileSync(new URL("./fixtures/registros-antigos-minimos.json", import.meta.url), "utf8"),
) as { readonly linhas: readonly LinhaDaFixture[] };

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
