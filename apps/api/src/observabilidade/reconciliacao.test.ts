/**
 * Plan 02-27, Task 2 — casos (a)-(e): reconciliação diária por origem
 * (T-02-23, "zero interseção de `codigo_lancamento_integracao`") e as
 * métricas mínimas sanitizadas (T-02-14, "nenhum alerta contém dado
 * financeiro"). Nenhum caso aqui precisa de Postgres real — `reconciliarDia`
 * e `montarMetricas` são exercitados com `amostra`/entrada pura; os dois
 * casos que envolvem o CLI (`b`, `c`) spawnam `reconciliacao.cli.ts` com
 * `--resumo=<json>`, que nunca abre o pool (ver `reconciliacao.cli.ts`).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { reconciliarDia, type AmostraDaReconciliacao, type EntradaPorOrigem } from "./reconciliacao";
import { montarMetricas, type AmostraDeMetricas } from "./metricas";

/* ── fixture: nenhum campo aqui é dado real — nomes, documentos e valores
 * abaixo existem só para o caso (d) provar que o relatório não os repete ── */

const NOME_PROIBIDO = "Fulano da Silva Sauro";
const DOCUMENTO_PROIBIDO = "123.456.789-09";
const VALOR_PROIBIDO = "R$ 12.345,67";

function entradaPorOrigem(overrides: Partial<EntradaPorOrigem> = {}): EntradaPorOrigem {
  return {
    entradas: 1,
    aprovacoes: 1,
    resumosPublicados: 1,
    tentativasOmie: 1,
    resultadosOmie: { sucesso: 1, falha: 0 },
    codigosDeIntegracao: [],
    ...overrides,
  };
}

/* ═══════════════════════════ reconciliarDia ═══════════════════════════ */

describe("reconciliarDia", () => {
  it("(a) duas coortes sem interseção — codigosDuplicados vazio", async () => {
    const amostra: AmostraDaReconciliacao = {
      outbox: [],
      porOrigem: {
        plataforma: entradaPorOrigem({ codigosDeIntegracao: ["tria:payment-request:plataforma:tsk_1", "tria:payment-request:plataforma:tsk_2"] }),
        clickup: entradaPorOrigem({ codigosDeIntegracao: ["clickup-tsk_9", "clickup-tsk_10"] }),
      },
      comandosDoAdapterFalhos: 0,
    };

    const resultado = await reconciliarDia({ dia: "2026-10-01", amostra });

    expect(resultado.codigosDuplicados).toEqual([]);
    expect(resultado.falhasNaoTratadas).toBe(0);
    expect(resultado.dia).toBe("2026-10-01");
  });

  it("(b) um código presente nas duas origens — aparece em codigosDuplicados", async () => {
    const codigoDuplicado = "tria:payment-request:plataforma:tsk_colisao";
    const amostra: AmostraDaReconciliacao = {
      outbox: [],
      porOrigem: {
        plataforma: entradaPorOrigem({ codigosDeIntegracao: [codigoDuplicado] }),
        // Mesmo código aparecendo do lado clickup — nunca deveria acontecer
        // (D-27); é exatamente o que este caso prova que o CLI pega.
        clickup: entradaPorOrigem({ codigosDeIntegracao: [codigoDuplicado] }),
      },
      comandosDoAdapterFalhos: 0,
    };

    const resultado = await reconciliarDia({ dia: "2026-10-02", amostra });

    expect(resultado.codigosDuplicados).toEqual([codigoDuplicado]);
  });

  it("(c) um evento failed no outbox e um comando failed no adapter — falhasNaoTratadas = 2", async () => {
    const amostra: AmostraDaReconciliacao = {
      outbox: [{ status: "failed" }, { status: "delivered" }, { status: "pending" }],
      porOrigem: {
        plataforma: entradaPorOrigem(),
        clickup: entradaPorOrigem(),
      },
      comandosDoAdapterFalhos: 1,
    };

    const resultado = await reconciliarDia({ dia: "2026-10-03", amostra });

    expect(resultado.falhasNaoTratadas).toBe(2);
  });
});

/* ═══════════════════════════ o CLI — exit code ═══════════════════════════ */

describe("reconciliacao.cli.ts — sai 1 com duplicidade ou falha não tratada (sem banco: sempre com --resumo)", () => {
  const viteNode = fileURLToPath(new URL("../../../../node_modules/.bin/vite-node", import.meta.url));
  const cli = fileURLToPath(new URL("./reconciliacao.cli.ts", import.meta.url));
  const pasta = mkdtempSync(path.join(tmpdir(), "reconciliacao-cli-"));

  function rodarCli(resumo: unknown, dia = "2026-10-04"): { readonly codigo: number; readonly saida: string } {
    const caminhoDoResumo = path.join(pasta, `${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(caminhoDoResumo, JSON.stringify(resumo), "utf8");
    try {
      const saida = execFileSync(
        viteNode,
        [cli, `--dia=${dia}`, `--resumo=${caminhoDoResumo}`, "--workspace=ws_reconciliacao_cli_teste"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      return { codigo: 0, saida };
    } catch (erro) {
      const falha = erro as { readonly status?: number; readonly stderr?: string; readonly stdout?: string };
      return { codigo: falha.status ?? 1, saida: `${falha.stdout ?? ""}${falha.stderr ?? ""}` };
    }
  }

  it("(b) sai 1 com código duplicado injetado", () => {
    const codigoDuplicado = "tria:payment-request:plataforma:tsk_cli_colisao";
    const { codigo, saida } = rodarCli({
      porOrigem: {
        plataforma: entradaPorOrigem({ codigosDeIntegracao: [codigoDuplicado] }),
        clickup: entradaPorOrigem({ codigosDeIntegracao: [codigoDuplicado] }),
      },
      comandosDoAdapterFalhos: 0,
    });

    expect(codigo).toBe(1);
    expect(saida).toContain(codigoDuplicado);
  }, 20_000);

  it("(c) sai 1 com uma falha não tratada (comando failed do adapter)", () => {
    const { codigo, saida } = rodarCli({
      porOrigem: {
        plataforma: entradaPorOrigem({ codigosDeIntegracao: ["tria:payment-request:plataforma:tsk_falha"] }),
        clickup: entradaPorOrigem({ codigosDeIntegracao: ["clickup-tsk_falha"] }),
      },
      comandosDoAdapterFalhos: 1,
    });

    expect(codigo).toBe(1);
    expect(saida).toContain("falhas não tratadas: 1");
  }, 20_000);

  it("(bonus) sai 0 num dia saudável (sem duplicidade, sem falha)", () => {
    const { codigo, saida } = rodarCli({
      porOrigem: {
        plataforma: entradaPorOrigem({ codigosDeIntegracao: ["tria:payment-request:plataforma:tsk_ok"] }),
        clickup: entradaPorOrigem({ codigosDeIntegracao: ["clickup-tsk_ok"] }),
      },
      comandosDoAdapterFalhos: 0,
    });

    expect(codigo).toBe(0);
    expect(saida).toContain("nenhum");
  }, 20_000);

  it("(d) a saída do relatório não contém valor monetário, nome ou documento da fixture", () => {
    const { saida } = rodarCli({
      porOrigem: {
        plataforma: entradaPorOrigem(),
        clickup: entradaPorOrigem(),
      },
      comandosDoAdapterFalhos: 0,
    });

    expect(saida).not.toContain(NOME_PROIBIDO);
    expect(saida).not.toContain(DOCUMENTO_PROIBIDO);
    expect(saida).not.toContain(VALOR_PROIBIDO);
  }, 20_000);

  afterAll(() => {
    rmSync(pasta, { recursive: true, force: true });
  });
});

/* ═══════════════════════════ coletarMetricas / montarMetricas ═══════════════════════════ */

describe("montarMetricas", () => {
  it("(e) sobre uma amostra devolve as chaves esperadas e nenhuma chave de payload", () => {
    const amostra: AmostraDeMetricas = {
      outbox: [
        { status: "pending", attempts: 0, createdAt: new Date(Date.now() - 60_000).toISOString() },
        { status: "failed", attempts: 3, createdAt: new Date().toISOString() },
        { status: "delivered", attempts: 1, createdAt: new Date().toISOString() },
      ],
      aprovacoes: [
        { decidedAt: "2026-10-04T10:00:00.000Z", decisionSource: "click" },
        { decidedAt: "2026-10-04T11:00:00.000Z", decisionSource: "comment" },
      ],
      ledger: [{ resultado: "importada" }, { resultado: "avisada" }, { resultado: "rejeitada" }],
      latenciaAmostraMs: [10, 12, 15, 9, 40],
    };

    const metricas = montarMetricas({ desde: "2026-10-04T00:00:00.000Z", ate: "2026-10-04T23:59:59.999Z" }, amostra);

    // As chaves mínimas do 02-RESEARCH.md, todas presentes.
    expect(Object.keys(metricas).sort()).toEqual(
      ["aprovacoes", "importacao", "latencia", "outbox", "periodo", "recebimento", "signedUrl"].sort(),
    );
    expect(metricas.outbox).toEqual({ pending: 1, oldestAgeSeconds: expect.any(Number), failed: 1, deliveryAttempts: 4 });
    expect(metricas.aprovacoes).toEqual({ porClique: 1, porComentario: 1, total: 2, razao: 0.5 });
    expect(metricas.importacao).toEqual({ lidos: 3, importados: 2, rejeitados: 1, avisados: 1 });
    expect(metricas.latencia.p50Ms).toBeGreaterThan(0);

    // Nenhuma chave de payload — só contagens, idades e uma razão.
    const chavesProibidas = ["payload", "valor", "documento", "cpf", "cnpj", "chavePix", "comentario", "titulo", "nome"];
    const textoDasChaves = JSON.stringify(Object.keys(metricas)).toLowerCase();
    for (const proibida of chavesProibidas) expect(textoDasChaves).not.toContain(proibida.toLowerCase());
  });

  it("(e bis) automation ausente não aparece como chave — nunca zeros disfarçados de medição real", () => {
    const metricas = montarMetricas(
      { desde: "2026-10-04T00:00:00.000Z", ate: "2026-10-04T23:59:59.999Z" },
      { outbox: [], aprovacoes: [], ledger: [] },
    );
    expect("automation" in metricas).toBe(false);
  });
});
