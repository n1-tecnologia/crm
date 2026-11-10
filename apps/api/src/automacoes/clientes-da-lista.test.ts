/**
 * 15-42, WINDOWS #35 — a agenda recebe o nome e o dono dos clientes das contas, lidos de `plataforma.contatos`
 * na transação da volta. Sem banco: o cliente do pool é uma falsa que devolve as linhas da tabela, e a leitura
 * é conferida pelo que ela pede (Espaço, ids) e pelo que devolve.
 */

import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CR } from "@n1/dominio/operations/financeiro";
import { idsDosClientesDaLista, lerClientesDaLista } from "./clientes-da-lista";

const WORKSPACE = "ws_n1";

/** Um cliente do pool que registra as consultas e devolve as linhas dadas à de Contatos. */
function clienteFalso(linhas: ReadonlyArray<Record<string, unknown>>): { readonly cliente: PoolClient; readonly consultas: Array<{ sql: string; valores: unknown[] }> } {
  const consultas: Array<{ sql: string; valores: unknown[] }> = [];
  const cliente = {
    query: async (sql: string, valores: unknown[] = []) => {
      consultas.push({ sql, valores });
      return { rows: linhas, rowCount: linhas.length };
    },
  } as unknown as PoolClient;
  return { cliente, consultas };
}

describe("os clientes das contas da Lista (15-42)", () => {
  it("idsDosClientesDaLista traz os Contatos citados por Vínculo cliente nas Tarefas da Lista, sem repetir", () => {
    const state = buildSeed();
    const ids = idsDosClientesDaLista(state, CR.listId);
    expect(ids).toEqual(expect.arrayContaining(["cnt_cr_helena", "cnt_cr_ricardo", "cnt_cr_camila", "cnt_cr_otavio"]));
    expect(new Set(ids).size).toBe(ids.length);
    // Outra Lista não cita cliente nenhum.
    expect(idsDosClientesDaLista(state, "lst_nao_existe")).toEqual([]);
  });

  it("lerClientesDaLista lê só dos Contatos citados, no Espaço da volta, e devolve nome e dono", async () => {
    const state = buildSeed();
    const { cliente, consultas } = clienteFalso([
      { id: "cnt_cr_helena", nome: "Helena", sobrenome: "Vasconcelos", estado: "ativo", proprietario_id: "mem_julia", whatsapp: null },
    ]);

    const lidos = await lerClientesDaLista(cliente, WORKSPACE, state, CR.listId);

    expect(lidos.contatos).toEqual([{ id: "cnt_cr_helena", nome: "Helena Vasconcelos", estado: "ativo", proprietarioId: "mem_julia" }]);
    expect(lidos.empresas).toEqual([]);
    expect(consultas).toHaveLength(1);
    expect(consultas[0]?.valores[0]).toBe(WORKSPACE);
    expect(consultas[0]?.valores[1]).toEqual(expect.arrayContaining(["cnt_cr_helena", "cnt_cr_camila"]));
  });

  it("sem cliente na Lista não consulta a tabela", async () => {
    const { cliente, consultas } = clienteFalso([]);
    const lidos = await lerClientesDaLista(cliente, WORKSPACE, buildSeed(), "lst_nao_existe");
    expect(lidos).toEqual({ contatos: [], empresas: [] });
    expect(consultas).toHaveLength(0);
  });
});
