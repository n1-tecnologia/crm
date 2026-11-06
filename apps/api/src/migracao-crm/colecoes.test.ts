/**
 * 15-44 Task 2 (H-02) — o critério de "a Conversa fica em registros", em TypeScript e em SQL.
 *
 * O script conta e apaga por SQL (`guardar.ts`) e o mapeador decide em TypeScript (`mapeador.ts`): os dois
 * têm de dar a MESMA resposta, para cada forma de Conversa. A tabela de casos roda nos dois.
 *
 * O trecho de banco só roda em Postgres local descartável (`describeComBanco`); nenhum dado de produção.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import { ehConversaDeGrupo, ehConversaDoCrmAntigo, SQL_E_CONVERSA_DO_CRM_ANTIGO } from "./colecoes";

interface Caso {
  readonly nome: string;
  readonly dados: Record<string, unknown>;
  /** Verdadeiro: é Conversa do CRM antigo (sai de `registros`); falso: fica. */
  readonly antiga: boolean;
}

/** Os Contatos antigos do Espaço da tabela de casos. */
const CONTATOS_ANTIGOS = ["cnt_antigo"];

const CASOS: readonly Caso[] = [
  { nome: "Grupo, com Contato antigo", dados: { contactId: "cnt_antigo", groupIdentifier: { externalId: "g", name: "Turma" } }, antiga: false },
  { nome: "Grupo, sem Contato", dados: { groupIdentifier: { externalId: "g", name: "Turma" } }, antiga: false },
  { nome: "1:1 antiga (Contato na coleção contacts)", dados: { contactId: "cnt_antigo", channelId: "ch" }, antiga: true },
  { nome: "1:1 de Flow (Contato só em plataforma.contatos)", dados: { contactId: "ctt_so_na_tabela", channelId: "ch" }, antiga: false },
  { nome: "contactId ausente", dados: { channelId: "ch" }, antiga: false },
  { nome: "contactId nulo", dados: { contactId: null, channelId: "ch" }, antiga: false },
  { nome: "contactId vazio", dados: { contactId: "", channelId: "ch" }, antiga: false },
  { nome: "contactId que não é texto", dados: { contactId: 7, channelId: "ch" }, antiga: false },
  { nome: "groupIdentifier em array, Contato antigo", dados: { contactId: "cnt_antigo", groupIdentifier: [{ externalId: "g" }] }, antiga: true },
  { nome: "groupIdentifier em texto, Contato antigo", dados: { contactId: "cnt_antigo", groupIdentifier: "g" }, antiga: true },
  { nome: "groupIdentifier nulo, Contato antigo", dados: { contactId: "cnt_antigo", groupIdentifier: null }, antiga: true },
  { nome: "groupIdentifier em array, Contato fora", dados: { contactId: "ctt_so_na_tabela", groupIdentifier: [{ externalId: "g" }] }, antiga: false },
  { nome: "contactId é de Contato de OUTRO Espaço", dados: { contactId: "cnt_do_outro_espaco", channelId: "ch" }, antiga: false },
];

describe("ehConversaDoCrmAntigo (15-44, H-02)", () => {
  const ids = new Set(CONTATOS_ANTIGOS);
  for (const caso of CASOS) {
    it(caso.nome, () => {
      expect(ehConversaDoCrmAntigo(caso.dados, ids)).toBe(caso.antiga);
    });
  }

  it("dados que não são objeto ficam em registros (nunca se apaga o que não se sabe classificar)", () => {
    expect(ehConversaDoCrmAntigo(null, ids)).toBe(false);
    expect(ehConversaDoCrmAntigo("texto", ids)).toBe(false);
    expect(ehConversaDoCrmAntigo([], ids)).toBe(false);
  });

  it("a Conversa de Grupo nunca é antiga, mesmo com o Contato na coleção contacts", () => {
    expect(ehConversaDeGrupo({ groupIdentifier: { externalId: "g" } })).toBe(true);
    expect(ehConversaDoCrmAntigo({ contactId: "cnt_antigo", groupIdentifier: { externalId: "g" } }, ids)).toBe(false);
  });
});

describeComBanco("o critério em SQL concorda com o de TypeScript (15-44, H-02)", () => {
  const criados: string[] = [];
  beforeAll(async () => {
    await prepararBancoCrm();
  });
  afterEach(async () => {
    for (const ws of criados.splice(0)) await limparEspaco(ws);
  });
  afterAll(async () => {
    await encerrar();
  });

  async function semear(rotulo: string): Promise<string> {
    const ws = novoEspacoDeTeste(rotulo);
    criados.push(ws);
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
    for (const id of CONTATOS_ANTIGOS) {
      await pool().query("insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'contacts', $2, $3::jsonb)", [ws, id, JSON.stringify({ id })]);
    }
    for (const [indice, caso] of CASOS.entries()) {
      await pool().query("insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'conversations', $2, $3::jsonb)", [
        ws,
        `cnv_${indice}`,
        JSON.stringify({ id: `cnv_${indice}`, ...caso.dados }),
      ]);
    }
    return ws;
  }

  it("a tabela de casos dá o mesmo conjunto nos dois", async () => {
    const ws = await semear("critsql");
    // Um Contato com o mesmo id em OUTRO Espaço não pode contar para este.
    const outro = novoEspacoDeTeste("critoutro");
    criados.push(outro);
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [outro]);
    await pool().query("insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'contacts', 'cnt_do_outro_espaco', '{}'::jsonb)", [outro]);

    const antigasSql = await pool().query<{ id: string }>(
      `select r.id from plataforma.registros r where r.workspace_id = $1 and r.colecao = 'conversations' and ${SQL_E_CONVERSA_DO_CRM_ANTIGO} order by r.id`,
      [ws],
    );
    const ids = new Set(CONTATOS_ANTIGOS);
    const antigasTs = CASOS.flatMap((caso, indice) => (ehConversaDoCrmAntigo(caso.dados, ids) ? [`cnv_${indice}`] : [])).sort();

    expect(antigasSql.rows.map((l) => l.id).sort()).toEqual(antigasTs);
    expect(antigasTs).toEqual(CASOS.flatMap((caso, indice) => (caso.antiga ? [`cnv_${indice}`] : [])).sort());
  });
});
