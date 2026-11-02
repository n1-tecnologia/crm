/**
 * 06-13 (Task 1, F6) — os prazos do lado do servidor e a trava esgotada; Fase 12
 * (12-04, D-09/D-10) — a trava no começo da transação e os dois regimes.
 *
 * O `query_timeout` do pool (30 s) é um temporizador DO CLIENTE: ao estourar,
 * o `pg` devolve o erro e não cancela a instrução no servidor. Atrás do pooler,
 * um `update plataforma.workspaces … revisao` que esperava a trava pode seguir
 * vivo e pegar a revisão do Espaço depois que o cliente já desistiu (06-PROVAS,
 * H4). Por isso a transação abre com `statement_timeout` e `lock_timeout`
 * ABAIXO do `query_timeout`: o servidor desiste antes do cliente. E a trava
 * esgotada (SQLSTATE 55P03) é conflito, não exceção: a conexão está sã.
 *
 * Desde 12-04 há dois regimes. No `travado` (o padrão) a trava é o
 * `select … for update` do começo e o conflito NÃO repete (uma tentativa só);
 * no `otimista` (as importações longas) a trava segue sendo o `update … revisao`
 * do fim, com até 3 tentativas — os casos (l) abaixo.
 *
 * Arquivo novo (CON-05), no molde de `unidade-de-trabalho.test.ts`: pool,
 * repositório e outbox são falsos. Sem banco.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@n1/dominio/state";
import { executar, inicioDaTransacao, inicioDaTransacaoTravada, TRAVA_DE_RESERVA_MS, type MedicaoDaExecucao } from "./unidade-de-trabalho";

const MARCA_DE_HIDRATAR = vi.hoisted(() => "<hidratar>");

const falso = vi.hoisted(() => ({
  consultas: [] as string[],
  erroEm: (_sql: string): Error | undefined => undefined,
  release: [] as unknown[],
  /** Quantas linhas o `select … for update` do regime travado devolve: 0 simula o Espaço que não existe. */
  linhasDaTrava: 1,
}));

vi.mock("./conexao", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./conexao")>()),
  pool: () => ({
    connect: async () => ({
      query: async (sql: string) => {
        falso.consultas.push(sql);
        const erro = falso.erroEm(sql);
        if (erro) throw erro;
        if (sql.startsWith("select revisao from plataforma.workspaces")) return { rowCount: falso.linhasDaTrava, rows: falso.linhasDaTrava ? [{ revisao: "7" }] : [] };
        if (sql.startsWith("update plataforma.workspaces")) return { rowCount: 1, rows: [{ revisao: "8" }] };
        return { rowCount: 0, rows: [] };
      },
      release: (descartar?: unknown) => falso.release.push(descartar),
    }),
  }),
}));
vi.mock("./repositorio", () => ({
  // O marcador entra na mesma lista das consultas: prova a ORDEM (a trava vem antes de hidratar).
  hidratar: async () => {
    falso.consultas.push(MARCA_DE_HIDRATAR);
    return { state: { automationExecutions: [] }, revisao: 7 };
  },
  gravar: async () => ({}),
}));
vi.mock("./outbox", () => ({ gravarEventos: async () => undefined }));
vi.mock("./eventos-de-canal", () => ({ execucoesNovas: () => [], eventosDeNotificacaoPorCanal: () => [] }));

beforeEach(() => {
  falso.consultas.length = 0;
  falso.release.length = 0;
  falso.erroEm = () => undefined;
  falso.linhasDaTrava = 1;
});

/** Um erro do `pg` com SQLSTATE, como o driver entrega (`erro.code`). */
function erroDoBanco(code: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { code });
}

describe("(k) o begin leva os três prazos do servidor, abaixo do query_timeout", () => {
  it("padrão (30 s): statement_timeout = 80 %, lock_timeout = 1/3", () => {
    expect(inicioDaTransacao({})).toBe(
      "begin; set local idle_in_transaction_session_timeout = 30000; set local statement_timeout = 24000; set local lock_timeout = 10000",
    );
  });

  it("DATABASE_QUERY_TIMEOUT_MS=5000: os prazos acompanham", () => {
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "5000" })).toBe(
      "begin; set local idle_in_transaction_session_timeout = 5000; set local statement_timeout = 4000; set local lock_timeout = 1666",
    );
  });

  it("com o query_timeout desligado (0), o begin puro", () => {
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "0" })).toBe("begin");
  });

  it("regime travado: igual ao otimista com o query_timeout padrão", () => {
    expect(inicioDaTransacaoTravada({})).toBe(inicioDaTransacao({}));
    expect(inicioDaTransacaoTravada({ DATABASE_QUERY_TIMEOUT_MS: "5000" })).toBe(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "5000" }));
  });

  it("regime travado com o query_timeout desligado (0): nunca espera sem prazo — set local lock_timeout de reserva (T-12-10)", () => {
    expect(TRAVA_DE_RESERVA_MS).toBe(10_000);
    expect(inicioDaTransacaoTravada({ DATABASE_QUERY_TIMEOUT_MS: "0" })).toBe("begin; set local lock_timeout = 10000");
  });

  it("nunca 0 com a consulta ligada: o mínimo é 1 (0 no Postgres DESLIGA o prazo)", () => {
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "1" })).toBe(
      "begin; set local idle_in_transaction_session_timeout = 1; set local statement_timeout = 1; set local lock_timeout = 1",
    );
    expect(inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: "2" })).toBe(
      "begin; set local idle_in_transaction_session_timeout = 2; set local statement_timeout = 1; set local lock_timeout = 1",
    );
  });

  it("os dois prazos ficam SEMPRE abaixo (ou no mínimo) do query_timeout", () => {
    for (const q of [3, 10, 999, 30_000, 120_000]) {
      const sql = inicioDaTransacao({ DATABASE_QUERY_TIMEOUT_MS: String(q) });
      const statement = Number(/statement_timeout = (\d+)/.exec(sql)?.[1]);
      const trava = Number(/lock_timeout = (\d+)/.exec(sql)?.[1]);
      expect(statement).toBeGreaterThanOrEqual(1);
      expect(trava).toBeGreaterThanOrEqual(1);
      expect(statement).toBeLessThan(q);
      expect(trava).toBeLessThan(q);
    }
  });
});

const NA_TRAVA = (sql: string) => sql.startsWith("select revisao from plataforma.workspaces");
const NA_REVISAO = (sql: string) => sql.startsWith("update plataforma.workspaces");
const SQL_DA_TRAVA = "select revisao from plataforma.workspaces where workspace_id = $1 for update";
const CONFLITO = { ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." };

describe("(l) a trava esgotada no regime otimista (as importações longas, D-10): o update da revisão é a trava", () => {
  it("55P03 no update da revisão: conflito depois das 3 tentativas, um rollback por tentativa, e a conexão volta ao pool", async () => {
    falso.erroEm = (sql) => (NA_REVISAO(sql) ? erroDoBanco("55P03", "canceling statement due to lock timeout") : undefined);
    const r = await executar("ws_x", () => ok("feito"), { regime: "otimista" });
    expect(r).toMatchObject({ ok: false, conflito: true });
    expect(falso.consultas.filter((sql) => sql === "rollback")).toHaveLength(3);
    expect(falso.consultas).not.toContain("commit");
    expect(falso.release).toEqual([false, false, false]);
  });

  it("55P03 uma vez e depois a trava sai: a segunda tentativa confirma", async () => {
    let vezes = 0;
    falso.erroEm = (sql) => (NA_REVISAO(sql) && (vezes += 1) === 1 ? erroDoBanco("55P03", "canceling statement due to lock timeout") : undefined);
    const r = await executar("ws_x", () => ok("feito"), { regime: "otimista" });
    expect(r.ok).toBe(true);
    expect(falso.consultas.at(-1)).toBe("commit");
    expect(falso.release).toEqual([false, false]);
  });

  it("não toma a trava no começo: abre com o begin de sempre e o update continua conferindo a revisão", async () => {
    const r = await executar("ws_x", () => ok("feito"), { regime: "otimista" });
    expect(r.ok).toBe(true);
    expect(falso.consultas[0]).toBe(inicioDaTransacao());
    expect(falso.consultas.some(NA_TRAVA)).toBe(false);
    expect(falso.consultas.find(NA_REVISAO)).toContain("and revisao = $2");
  });

  it("57014 (instrução cancelada pelo statement_timeout): a exceção sobe e a conexão sai do pool", async () => {
    falso.erroEm = (sql) => (NA_REVISAO(sql) ? erroDoBanco("57014", "canceling statement due to statement timeout") : undefined);
    await expect(executar("ws_x", () => ok("feito"), { regime: "otimista" })).rejects.toThrow("statement timeout");
    expect(falso.release).toEqual([true]);
  });

  it("55P03 FORA da revisão (no commit) não vira conflito: sobe como antes", async () => {
    falso.erroEm = (sql) => (sql === "commit" ? erroDoBanco("55P03", "lock timeout") : undefined);
    await expect(executar("ws_x", () => ok("feito"), { regime: "otimista" })).rejects.toThrow("lock timeout");
    expect(falso.release).toEqual([true]);
  });

  it("aoMedir traz regime otimista", async () => {
    const medicoes: MedicaoDaExecucao[] = [];
    await executar("ws_x", () => ok("feito"), { regime: "otimista", aoMedir: (m) => void medicoes.push(m) });
    expect(medicoes[0]).toMatchObject({ regime: "otimista", tentativas: 1, desfecho: "gravou" });
  });
});

describe("(m) o regime travado (o padrão, D-09): a trava no começo, uma tentativa só", () => {
  it("depois do begin vem o select … for update como instrução própria, e só então hidratar; o update não confere a revisão", async () => {
    const r = await executar("ws_x", () => ok("feito"));
    expect(r.ok).toBe(true);
    expect(falso.consultas[0]).toBe(inicioDaTransacaoTravada());
    expect(falso.consultas[1]).toBe(SQL_DA_TRAVA);
    expect(falso.consultas.indexOf(MARCA_DE_HIDRATAR)).toBe(2);
    const update = falso.consultas.find(NA_REVISAO);
    expect(update).toBeDefined();
    expect(update).not.toContain("and revisao");
    expect(falso.consultas.at(-1)).toBe("commit");
    expect(falso.release).toEqual([false]);
  });

  it("55P03 na trava: conflito com a mensagem de sempre, UM rollback, a conexão volta ao pool, sem commit e sem hidratar", async () => {
    falso.erroEm = (sql) => (NA_TRAVA(sql) ? erroDoBanco("55P03", "canceling statement due to lock timeout") : undefined);
    const r = await executar("ws_x", () => ok("feito"));
    expect(r).toEqual(CONFLITO);
    expect(falso.consultas.filter((sql) => sql === "rollback")).toHaveLength(1);
    expect(falso.consultas).not.toContain("commit");
    expect(falso.consultas).not.toContain(MARCA_DE_HIDRATAR);
    expect(falso.release).toEqual([false]);
  });

  it("o select … for update com rowCount 0: o Espaço não existe — lança, e a conexão sai do pool", async () => {
    falso.linhasDaTrava = 0;
    await expect(executar("ws_x", () => ok("feito"))).rejects.toThrow('Espaço de Trabalho "ws_x" não existe.');
    expect(falso.release).toEqual([true]);
  });

  it("erro que não é 55P03 na trava sobe, e a conexão sai do pool", async () => {
    falso.erroEm = (sql) => (NA_TRAVA(sql) ? erroDoBanco("57014", "canceling statement due to statement timeout") : undefined);
    await expect(executar("ws_x", () => ok("feito"))).rejects.toThrow("statement timeout");
    expect(falso.release).toEqual([true]);
    expect(falso.consultas).not.toContain(MARCA_DE_HIDRATAR);
  });

  it("55P03 FORA da trava (no commit) sobe como exceção, também no travado", async () => {
    falso.erroEm = (sql) => (sql === "commit" ? erroDoBanco("55P03", "lock timeout") : undefined);
    await expect(executar("ws_x", () => ok("feito"))).rejects.toThrow("lock timeout");
    expect(falso.release).toEqual([true]);
  });

  it("aoMedir traz regime travado e tentativas 1; no conflito da trava, desfecho conflito, tentativas 1 e travaMs contado", async () => {
    const medicoes: MedicaoDaExecucao[] = [];
    await executar("ws_x", () => ok("feito"), { aoMedir: (m) => void medicoes.push(m) });
    expect(medicoes[0]).toMatchObject({ regime: "travado", tentativas: 1, desfecho: "gravou" });
    expect(medicoes[0]!.travaMs).toBeGreaterThanOrEqual(medicoes[0]!.atualizaMs);

    falso.erroEm = (sql) => (NA_TRAVA(sql) ? erroDoBanco("55P03", "canceling statement due to lock timeout") : undefined);
    await executar("ws_x", () => ok("feito"), { aoMedir: (m) => void medicoes.push(m) });
    expect(medicoes[1]).toMatchObject({ regime: "travado", tentativas: 1, desfecho: "conflito", atualizaMs: 0 });
  });

  it("tentativas não existe no regime travado: o tipo recusa, e em execução a gravação continua sendo uma só", async () => {
    // O que o compilador impede (`tsc --noEmit` roda sobre este arquivo): quem não declara
    // `regime: "otimista"` não pode passar `tentativas`.
    const semRegime = () =>
      executar("ws_x", () => ok("feito"), {
        // @ts-expect-error — `tentativas` só existe no regime otimista
        tentativas: 2,
      });
    falso.erroEm = (sql) => (NA_TRAVA(sql) ? erroDoBanco("55P03", "canceling statement due to lock timeout") : undefined);
    await semRegime();
    expect(falso.consultas.filter((sql) => sql === "rollback")).toHaveLength(1);
  });
});
