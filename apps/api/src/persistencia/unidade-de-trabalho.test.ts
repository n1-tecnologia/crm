/**
 * A Unidade de Trabalho diante de uma conexão que o pooler derruba no meio
 * (2026-09-29: escritas no `ws_n1` paradas por 16 e 10 minutos): o `begin`
 * leva o prazo do lado do servidor, e a conexão que falhou sai do pool em vez
 * de servir à próxima requisição. Sem banco: pool, repositório e outbox são
 * falsos — o que se prova é o protocolo com a conexão, não o SQL de negócio.
 *
 * Desde a Fase 13 o regime travado fala com o banco em duas MENSAGENS de várias
 * instruções (a entrada: begin, trava e leitura; a saída: update da revisão e
 * commit), então o pool falso devolve um resultado por instrução.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail, ok } from "@n1/dominio/state";
import { executar, inicioDaTransacao, type MedicaoDaExecucao } from "./unidade-de-trabalho";

const falso = vi.hoisted(() => ({
  consultas: [] as string[],
  erroEm: (_sql: string): Error | undefined => undefined,
  release: [] as unknown[],
  /** Quantas linhas o `update plataforma.workspaces` devolve: 0 simula a revisão que mudou (conflito). */
  linhasDoUpdate: 1,
  /** Quantas linhas a trava do lote de entrada devolve: 0 simula o Espaço que não existe. */
  linhasDaTrava: 1,
  /** A guarda da tabela de Canais já confirmou neste processo: os Canais vão dentro do lote de entrada. */
  canaisConfirmados: false,
}));

vi.mock("./conexao", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./conexao")>()),
  pool: () => ({
    connect: async () => ({
      query: async (sql: string) => {
        falso.consultas.push(sql);
        const erro = falso.erroEm(sql);
        if (erro) throw erro;
        // Fase 13 — o lote de entrada do travado (begin, prazos, trava, leitura e, com a guarda confirmada, Canais):
        // um resultado por instrução, e a trava, a leitura e os Canais são sempre os últimos.
        if (sql.startsWith("begin") && sql.includes("for update")) {
          const vazio = { rowCount: null, rows: [] };
          const trava = { rowCount: falso.linhasDaTrava, rows: falso.linhasDaTrava ? [{ revisao: "7" }] : [] };
          return [vazio, vazio, vazio, vazio, trava, { rowCount: 0, rows: [] }, ...(sql.includes("from plataforma.canais") ? [{ rowCount: 0, rows: [] }] : [])];
        }
        // O lote de saída: o update da revisão, as escritas e o commit na mesma mensagem.
        if (sql.startsWith("update plataforma.workspaces") && sql.endsWith("commit")) {
          return [{ rowCount: 1, rows: [{ revisao: "8" }] }, { rowCount: null, rows: [] }];
        }
        if (sql.startsWith("update plataforma.workspaces")) {
          return falso.linhasDoUpdate === 0 ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ revisao: "8" }] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: (descartar?: unknown) => falso.release.push(descartar),
    }),
  }),
}));
vi.mock("./repositorio", () => ({
  hidratar: async () => ({ state: { automationExecutions: [] }, revisao: 7 }),
  sqlDeHidratar: (espaco: string) => `<sql de hidratar ${espaco}>`,
  estadoDasLinhas: () => ({ state: { automationExecutions: [] }, revisao: 7 }),
  gravar: async () => ({}),
  planejarGravacao: () => ({ upserts: [], removidos: [], diferenca: { gravados: [], removidos: [] } }),
  sqlsDoPlano: () => [],
}));
vi.mock("./canais-projetados", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./canais-projetados")>()),
  tabelaDeCanaisConfirmada: () => falso.canaisConfirmados,
}));
vi.mock("./outbox", () => ({ gravarEventos: async () => undefined }));
vi.mock("./eventos-de-canal", () => ({ execucoesNovas: () => [], eventosDeNotificacaoPorCanal: () => [] }));

beforeEach(() => {
  falso.consultas.length = 0;
  falso.release.length = 0;
  falso.erroEm = () => undefined;
  falso.linhasDoUpdate = 1;
  falso.linhasDaTrava = 1;
  falso.canaisConfirmados = false;
});

describe("Unidade de Trabalho — conexão que cai no meio", () => {
  it("o begin leva o prazo do servidor igual ao query_timeout do pool (e some quando ele é desligado)", () => {
    expect(inicioDaTransacao({})).toBe("begin; set local idle_in_transaction_session_timeout = 30000; set local statement_timeout = 24000; set local lock_timeout = 10000");
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "5000" })).toBe("begin; set local idle_in_transaction_session_timeout = 5000; set local statement_timeout = 4000; set local lock_timeout = 1666");
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "0" })).toBe("begin");
  });

  it("sucesso: abre com o prazo, confirma, e a conexão volta ao pool", async () => {
    const r = await executar("ws_x", () => ok("feito"));
    expect(r.ok).toBe(true);
    // A mensagem de entrada ABRE com o begin e os prazos de sempre; a de saída FECHA com o commit.
    expect(falso.consultas[0]!.startsWith(inicioDaTransacao())).toBe(true);
    expect(falso.consultas.at(-1)!.endsWith("commit")).toBe(true);
    expect(falso.release).toEqual([false]);
  });

  it("recusa do domínio: desfaz, e a conexão volta ao pool (ela está sã)", async () => {
    const r = await executar("ws_x", () => fail("recusado"));
    expect(r.ok).toBe(false);
    expect(falso.consultas).toContain("rollback");
    expect(falso.release).toEqual([false]);
  });

  it("consulta que estoura o tempo no meio da transação: o erro sobe e a conexão sai do pool", async () => {
    falso.erroEm = (sql) => (sql.startsWith("update plataforma.workspaces") ? new Error("Query read timeout") : undefined);
    await expect(executar("ws_x", () => ok("feito"))).rejects.toThrow("Query read timeout");
    expect(falso.release).toEqual([true]);
  });

  it("conexão que cai já no begin: o erro sobe e a conexão sai do pool", async () => {
    falso.erroEm = (sql) => (sql.startsWith("begin") ? new Error("Connection terminated unexpectedly") : undefined);
    await expect(executar("ws_x", () => ok("feito"))).rejects.toThrow("Connection terminated unexpectedly");
    expect(falso.release).toEqual([true]);
  });
});

describe("medição por etapa (D-02)", () => {
  const CAMPOS_EM_MS = [
    "conexaoMs",
    "inicioMs",
    "travaMs",
    "hidratarMs",
    "canaisMs",
    "operacaoMs",
    "atualizaMs",
    "gravarMs",
    "eventosMs",
    "commitMs",
  ] as const;

  function coletor() {
    const medicoes: MedicaoDaExecucao[] = [];
    return { medicoes, aoMedir: (m: MedicaoDaExecucao) => void medicoes.push(m) };
  }

  it("gravação: aoMedir chamado uma vez, com todas as etapas em ms, tentativas 1 e desfecho gravou", async () => {
    const { medicoes, aoMedir } = coletor();
    const r = await executar("ws_x", () => ok("feito"), { aoMedir });
    expect(r.ok).toBe(true);
    expect(medicoes).toHaveLength(1);
    const m = medicoes[0]!;
    expect(m.tentativas).toBe(1);
    expect(m.desfecho).toBe("gravou");
    for (const campo of CAMPOS_EM_MS) {
      expect(typeof m[campo]).toBe("number");
      expect(m[campo]).toBeGreaterThanOrEqual(0);
    }
    // As fakes não têm `original` e `gravar` devolve `{}`: a contagem tem padrão 0.
    expect(m.linhasLidas).toBe(0);
    expect(m.linhasGravadas).toBe(0);
    // Entrada, a guarda dos Canais (ainda não confirmada neste processo) e saída.
    expect(m.idasEVoltas).toBe(3);
  });

  it("com a guarda dos Canais já confirmada, os Canais vão dentro do lote de entrada: duas idas ao banco", async () => {
    falso.canaisConfirmados = true;
    const { medicoes, aoMedir } = coletor();
    await executar("ws_x", () => ok("feito"), { aoMedir });
    expect(medicoes[0]!.idasEVoltas).toBe(2);
    expect(falso.consultas).toHaveLength(2);
    expect(falso.consultas[0]).toContain("from plataforma.canais");
    expect(falso.consultas.some((sql) => sql.includes("to_regclass"))).toBe(false);
  });

  it("com aoConfirmar o fim volta a ser instrução por instrução: update, commit, e uma ida a mais", async () => {
    falso.canaisConfirmados = true;
    const { medicoes, aoMedir } = coletor();
    await executar("ws_x", () => ok("feito"), { aoMedir, aoConfirmar: async () => undefined });
    expect(medicoes[0]!.idasEVoltas).toBe(3);
    expect(falso.consultas.at(-1)).toBe("commit");
    expect(falso.consultas.at(-2)!.startsWith("update plataforma.workspaces")).toBe(true);
  });

  it("recusa do domínio: desfecho recusou, e nem o update nem o gravar rodaram", async () => {
    const { medicoes, aoMedir } = coletor();
    const r = await executar("ws_x", () => fail("recusado"), { aoMedir });
    expect(r.ok).toBe(false);
    expect(medicoes).toHaveLength(1);
    expect(medicoes[0]!.desfecho).toBe("recusou");
    expect(medicoes[0]!.atualizaMs).toBe(0);
    expect(medicoes[0]!.gravarMs).toBe(0);
  });

  it("regime otimista, conflito: a revisão mudou nas três tentativas, e a medição soma as três", async () => {
    falso.linhasDoUpdate = 0;
    const { medicoes, aoMedir } = coletor();
    const r = await executar("ws_x", () => ok("feito"), { aoMedir, regime: "otimista" });
    expect(r.ok).toBe(false);
    expect("conflito" in r && r.conflito).toBe(true);
    expect(medicoes).toHaveLength(1);
    expect(medicoes[0]!.tentativas).toBe(3);
    expect(medicoes[0]!.regime).toBe("otimista");
    expect(medicoes[0]!.desfecho).toBe("conflito");
  });

  it("regime travado, conflito: o 55P03 na trava dá UMA tentativa, desfecho conflito, sem repetir", async () => {
    // A trava agora vai dentro da mensagem de entrada: é ela que o servidor recusa com 55P03.
    falso.erroEm = (sql) =>
      sql.startsWith("begin") && sql.includes("for update")
        ? Object.assign(new Error("canceling statement due to lock timeout"), { code: "55P03" })
        : undefined;
    const { medicoes, aoMedir } = coletor();
    const r = await executar("ws_x", () => ok("feito"), { aoMedir });
    expect(r.ok).toBe(false);
    expect("conflito" in r && r.conflito).toBe(true);
    expect(medicoes).toHaveLength(1);
    expect(medicoes[0]!.tentativas).toBe(1);
    expect(medicoes[0]!.regime).toBe("travado");
    expect(medicoes[0]!.desfecho).toBe("conflito");
  });

  it("gravação no padrão: o regime é travado", async () => {
    const { medicoes, aoMedir } = coletor();
    await executar("ws_x", () => ok("feito"), { aoMedir });
    expect(medicoes[0]!.regime).toBe("travado");
  });

  it("exceção no begin: o erro continua subindo, a conexão sai do pool, e aoMedir recebeu excecao", async () => {
    falso.erroEm = (sql) => (sql.startsWith("begin") ? new Error("Connection terminated unexpectedly") : undefined);
    const { medicoes, aoMedir } = coletor();
    await expect(executar("ws_x", () => ok("feito"), { aoMedir })).rejects.toThrow("Connection terminated unexpectedly");
    expect(falso.release).toEqual([true]);
    expect(medicoes).toHaveLength(1);
    expect(medicoes[0]!.desfecho).toBe("excecao");
  });

  it("um aoMedir que lança nunca muda o resultado da gravação", async () => {
    const r = await executar("ws_x", () => ok("feito"), {
      aoMedir: () => {
        throw new Error("o medidor quebrou");
      },
    });
    expect(r.ok).toBe(true);
    expect(falso.consultas.at(-1)!.endsWith("commit")).toBe(true);
  });
});
