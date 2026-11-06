/**
 * 15-43 (UCR-12, D-15-02) — `hidratar()` com uma linha do CRM antigo ainda em `plataforma.registros`.
 *
 * O `DataState` já não conhece as oito coleções do CRM antigo (`contacts`, `companies`, `deals`,
 * `funnels`, `contactCompanyLinks`, `companyCompanyLinks`, `distinctFromLinks`, `channels`), mas
 * `hidratar()` carrega TODA coleção que encontra em `registros` (Pitfall 3 da pesquisa). Um banco
 * que não rodou `migrar:crm-antigo` ainda tem essas linhas, e o que se promete é isto:
 *
 *  1. com a linha antiga, `hidratar()` não lança e não estraga as coleções tipadas (Grupo, Tarefas,
 *     Listas), mas CARREGA a coleção desconhecida — `contacts` aparece no objeto devolvido. É por
 *     isso que o corte apaga essas linhas antes de publicar;
 *  2. depois de `apagarDoRegistros` (o apagar do script, 15-27), a chave some: o objeto devolvido já
 *     não tem `contacts`, e a Conversa de Grupo continua.
 *
 * SÓ Postgres local descartável (`describeComBanco` pula fora de localhost). A conexão vem de
 * `process.env.DATABASE_URL`; nenhuma porta é escrita aqui.
 *
 *   docker run -d --rm --name crm-n1-pg-1543 -e POSTGRES_PASSWORD=x -p 55743:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55743/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55743/postgres \
 *     npx vitest run src/persistencia/hidratar-crm-antigo.test.ts
 *   docker rm -f crm-n1-pg-1543
 */

import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { apagarDoRegistros } from "../migracao-crm/guardar";
import { COLECOES_SEM_GRUPO } from "../migracao-crm/colecoes";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import { encerrar, pool } from "./conexao";
import { hidratar, semear } from "./repositorio";

const criados: string[] = [];

/** A coleção pela CHAVE do objeto, não pelo tipo `DataState`: o teste vale com o tipo sem as oito. */
const pelaChave = (estado: object): Record<string, unknown> => estado as Record<string, unknown>;

/** Um Espaço com o seed novo (Grupo, Tarefas, Listas) e UMA linha antiga em `registros`. */
async function espacoComLinhaAntiga(rotulo: string): Promise<string> {
  const ws = novoEspacoDeTeste(rotulo);
  criados.push(ws);
  const cliente = await pool().connect();
  try {
    await semear(cliente, ws, buildSeed());
    const dados = { id: "cnt_antigo_x", workspaceId: ws, firstName: "Contato", lastName: "Antigo", lifecycle: "ativo" };
    await cliente.query(
      "insert into plataforma.registros (workspace_id, colecao, id, dados, ordem) values ($1, 'contacts', $2, $3::jsonb, 0)",
      [ws, dados.id, JSON.stringify(dados)],
    );
  } finally {
    cliente.release();
  }
  return ws;
}

describeComBanco("hidratar() com uma linha do CRM antigo em registros (15-43, UCR-12, D-15-02)", () => {
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  it("não lança, não estraga as coleções tipadas e carrega a coleção desconhecida", async () => {
    const semente = buildSeed();
    const ws = await espacoComLinhaAntiga("hidratar_antigo");
    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, ws);
      const estado = pelaChave(state);

      // As coleções tipadas ficam como o seed as gravou.
      expect((estado.conversations as { id: string }[]).map((c) => c.id).sort()).toEqual(["cnv_grp_avisos", "cnv_grp_turma_02"]);
      expect(state.tasks).toHaveLength(semente.tasks.length);
      expect(state.lists).toHaveLength(semente.lists.length);
      expect(state.grupos).toHaveLength(semente.grupos.length);

      // A linha antiga volta pela chave desconhecida: é o comportamento conhecido (D-15-02).
      expect(Object.keys(estado)).toContain("contacts");
      expect((estado.contacts as { id: string }[]).map((c) => c.id)).toEqual(["cnt_antigo_x"]);
    } finally {
      cliente.release();
    }
  });

  it("depois de apagarDoRegistros a chave some, e a Conversa de Grupo continua", async () => {
    const semente = buildSeed();
    const ws = await espacoComLinhaAntiga("apagar_antigo");
    const cliente = await pool().connect();
    try {
      const apagadas = await apagarDoRegistros(cliente, ws, { colecoes: COLECOES_SEM_GRUPO, conversasSemGrupo: true, extras: [] });
      expect(apagadas).toEqual({ contacts: 1 });

      const { state } = await hidratar(cliente, ws);
      const estado = pelaChave(state);
      expect(Object.keys(estado)).not.toContain("contacts");
      expect((estado.conversations as { id: string }[]).map((c) => c.id).sort()).toEqual(["cnv_grp_avisos", "cnv_grp_turma_02"]);
      expect(state.tasks).toHaveLength(semente.tasks.length);
    } finally {
      cliente.release();
    }
  });
});
