/**
 * `configurarEmpresas()` contra o Postgres real: `--dry-run` não grava nada,
 * `--apply` cria a opção "Marcos Paulo" nos DOIS Campos `Empresa` (D5-19,
 * fechamento de lacunas 05-20) + as 6 Integrações, e a segunda execução é
 * no-op — a prova de TEN-01/D5-03 contra o banco de verdade.
 *
 * `evoluirConfiguracaoPorEmpresa` agora exige que a Lista de Solicitações
 * (com `fld_sp_c_empresa`) já exista — `bootstrapGestao` sozinho não a
 * configura, então o setup deste arquivo roda `configurarSolicitacoes`
 * logo depois, no mesmo Espaço.
 *
 * Precisa de `DATABASE_URL` (`apps/api/.env` ou variável de ambiente); sem
 * ele, pula em vez de falhar (D-DEC-09, mesmo padrão de `gestao.test.ts` e
 * `solicitacoes.test.ts`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { bootstrapGestao } from "./gestao";
import { configurarEmpresas } from "./configuracao-por-empresa";
import { configurarSolicitacoes } from "./solicitacoes";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const WS = "ws_config_empresa_teste";
const AGORA = "2026-09-24T12:00:00.000Z";

async function contarLinhas(colecao?: string): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = colecao
      ? await cliente.query<{ n: string }>(
          "select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = $2",
          [WS, colecao],
        )
      : await cliente.query<{ n: string }>("select count(*)::text as n from plataforma.registros where workspace_id = $1", [WS]);
    return Number(r.rows[0]!.n);
  } finally {
    cliente.release();
  }
}

async function revisaoAtual(): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ revisao: string }>(
      "select revisao::text as revisao from plataforma.workspaces where workspace_id = $1",
      [WS],
    );
    return Number(r.rows[0]!.revisao);
  } finally {
    cliente.release();
  }
}

d("configurarEmpresas — o evolver de configuração por Empresa contra o Postgres real", () => {
  beforeAll(async () => {
    const limpeza = await pool().connect();
    try {
      await limpeza.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await limpeza.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      limpeza.release();
    }

    // O evolver exige o bootstrap da Fase 1 já aplicado (Espaço "Gestão" ›
    // Pasta "Financeiro" › Campo "Empresa") — não é este arquivo que recria
    // essa base.
    const bootstrap = await pool().connect();
    try {
      const resultado = await bootstrapGestao(bootstrap, { workspaceId: WS, agora: AGORA });
      expect(resultado.criado).toBe(true);
    } finally {
      bootstrap.release();
    }

    // D5-19: o evolver por Empresa agora também exige `fld_sp_c_empresa`
    // (Campo "Empresa" da Lista de Solicitações) — sem ele, recusaria
    // apontando para `solicitacoes:configurar`, que é exatamente o que este
    // setup roda aqui, no mesmo Espaço, antes de qualquer teste (i)-(iii).
    const solicitacoes = await configurarSolicitacoes({ workspaceId: WS, actingMemberId: "mem_maryane", dryRun: false });
    expect(solicitacoes.ok, solicitacoes.ok ? "" : solicitacoes.error).toBe(true);
  });

  afterAll(async () => {
    const limpeza = await pool().connect();
    try {
      await limpeza.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await limpeza.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      limpeza.release();
    }
    await encerrar();
  });

  it("(i) --dry-run não grava nada — revisão e contagem de linhas idênticas antes e depois", async () => {
    const linhasAntes = await contarLinhas();
    const revisaoAntes = await revisaoAtual();

    const resultado = await configurarEmpresas({ workspaceId: WS, actingMemberId: "mem_maryane", dryRun: true });
    expect(resultado.ok, resultado.ok ? "" : resultado.error).toBe(true);
    if (!resultado.ok) throw new Error("unreachable");
    expect(resultado.dryRun).toBe(true);
    expect(resultado.diff.criados.length).toBeGreaterThan(0);

    expect(await contarLinhas()).toBe(linhasAntes);
    expect(await revisaoAtual()).toBe(revisaoAntes);
  });

  it("(ii) --apply cria a opção + as 6 Integrações; a segunda execução é no-op com diff vazio", async () => {
    const primeiro = await configurarEmpresas({ workspaceId: WS, actingMemberId: "mem_maryane", dryRun: false });
    expect(primeiro.ok, primeiro.ok ? "" : primeiro.error).toBe(true);
    if (!primeiro.ok) throw new Error("unreachable");
    expect(primeiro.dryRun).toBe(false);
    expect(primeiro.diff.criados.length).toBeGreaterThan(0);

    const segundo = await configurarEmpresas({ workspaceId: WS, actingMemberId: "mem_maryane", dryRun: false });
    expect(segundo.ok, segundo.ok ? "" : segundo.error).toBe(true);
    if (!segundo.ok) throw new Error("unreachable");
    expect(segundo.diff.criados).toEqual([]);
    expect(segundo.diff.divergentes).toEqual([]);
  });

  it("(iii) depois do apply, hidratar() devolve as 6 Integrações e 'Marcos Paulo' entre as opções de Empresa", async () => {
    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const idsEsperados = [
        "int_omie_tria",
        "int_omie_konq",
        "int_omie_marcos_paulo",
        "int_omie_exo_loteamento",
        "int_omie_exo_participacoes",
        "int_omie_oliveira_participacoes",
      ];
      for (const id of idsEsperados) {
        expect(state.integrations.some((i) => i.id === id)).toBe(true);
      }
      const campoEmpresa = state.fieldDefinitions.find((f) => f.id === "fd_cp_empresa");
      expect(campoEmpresa?.options).toContain("Marcos Paulo");
    } finally {
      cliente.release();
    }
  });
});
