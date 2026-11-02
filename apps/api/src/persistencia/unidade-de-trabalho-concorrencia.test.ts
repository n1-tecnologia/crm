/**
 * GRV-03 (Fase 12, 12-04, D-09/D-10) — duas `executar()` simultâneas no mesmo
 * Espaço de Trabalho, contra um Postgres de verdade.
 *
 * O que se prova aqui não cabe num pool falso: a trava é do banco. No regime
 * `travado` (o padrão) a segunda gravação ESPERA a vez no `select … for update`
 * do começo e só então hidrata — enxerga o que a primeira confirmou, grava com
 * uma tentativa só, e `hidratar` roda 2 vezes no total. No regime `otimista`
 * (as importações longas) a mesma corrida custa uma hidratação a mais: a
 * segunda lê, a primeira confirma, o `update … revisao` da segunda não confere
 * e ela refaz tudo — `hidratar` roda 3 vezes.
 *
 * Arquivo próprio, separado de `unidade-de-trabalho-trava.test.ts`, porque
 * aquele mocka `./conexao` e `./repositorio` no módulo inteiro (pool falso, sem
 * trava real) e não há como misturar com banco no mesmo arquivo (RESEARCH,
 * Pitfall 6). Aqui só `hidratar` é embrulhado, para contar as chamadas.
 *
 * SÓ Postgres local descartável (`describeComBanco` pula fora de
 * localhost/127.0.0.1). Um teste de banco que sai "skipped" NÃO prova GRV-03.
 *
 *   docker run -d --rm --name crm-n1-pg-1204 -e POSTGRES_PASSWORD=x -p 55624:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55624/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55624/postgres \
 *     npx vitest run src/persistencia/unidade-de-trabalho-concorrencia.test.ts
 *   docker rm -f crm-n1-pg-1204
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataState } from "@n1/dominio";
import { createList } from "@n1/dominio/operations";
import { buildSeed } from "@n1/dominio/seed";
import { encerrar, pool } from "./conexao";
import { executar, type MedicaoDaExecucao } from "./unidade-de-trabalho";
import { hidratar, semear } from "./repositorio";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";

// Só `hidratar` é embrulhado (e continua o de verdade): é ele que o regime travado deve chamar uma vez por gravação.
vi.mock("./repositorio", async (importOriginal) => {
  const real = await importOriginal<typeof import("./repositorio")>();
  return { ...real, hidratar: vi.fn(real.hidratar) };
});

const PROPRIETARIO = "mem_thiago";
const ESPACO_DO_SEED = "spc_com";
const SQL_DA_TRAVA = "select revisao from plataforma.workspaces where workspace_id = $1 for update";

const pausa = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

const operacaoCriarLista = (nome: string, listasVistas?: string[]) => (state: DataState) => {
  listasVistas?.push(...state.lists.map((l) => l.name));
  return createList(state, PROPRIETARIO, { name: nome, parentType: "space", parentId: ESPACO_DO_SEED });
};

describeComBanco("duas executar() simultâneas no mesmo Espaço (GRV-03, D-09/D-10)", () => {
  const ws = novoEspacoDeTeste("conc");
  const hidratacoes = () => vi.mocked(hidratar).mock.calls.length;

  async function revisaoDoEspaco(): Promise<number> {
    const r = await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [ws]);
    return Number(r.rows[0]!.revisao);
  }

  async function registrosDoEspaco(): Promise<number> {
    const r = await pool().query<{ n: string }>("select count(*) as n from plataforma.registros where workspace_id = $1", [ws]);
    return Number(r.rows[0]!.n);
  }

  /**
   * A primeira gravação segura a trava (dentro de `aoConfirmar`, depois de ter
   * garantido a revisão e antes do commit) até a segunda já estar esperando; o
   * teste a solta ~300 ms depois de disparar a segunda.
   */
  async function primeiraSeguraASegundaEspera(regime: "travado" | "otimista") {
    const medA: MedicaoDaExecucao[] = [];
    const medB: MedicaoDaExecucao[] = [];
    const vistasPorB: string[] = [];
    let avisarQueSegura!: () => void;
    const segurando = new Promise<void>((resolver) => (avisarQueSegura = resolver));
    let soltar!: () => void;
    const soltou = new Promise<void>((resolver) => (soltar = resolver));
    const regimeDaOpcao = regime === "otimista" ? ({ regime: "otimista" } as const) : ({} as const);

    const a = executar(ws, operacaoCriarLista(`Lista A (${regime})`), {
      ...regimeDaOpcao,
      aoMedir: (m) => void medA.push(m),
      aoConfirmar: async () => {
        avisarQueSegura();
        await soltou;
      },
    });
    await segurando;
    const antesDeDispararB = performance.now();
    const b = executar(ws, operacaoCriarLista(`Lista B (${regime})`, vistasPorB), {
      ...regimeDaOpcao,
      aoMedir: (m) => void medB.push(m),
    });
    await pausa(300);
    soltar();
    const [ra, rb] = await Promise.all([a, b]);
    return { ra, rb, medA: medA[0]!, medB: medB[0]!, vistasPorB, esperouMs: performance.now() - antesDeDispararB };
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    const cliente = await pool().connect();
    try {
      await semear(cliente, ws, buildSeed());
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await encerrar();
  });

  beforeEach(() => {
    vi.mocked(hidratar).mockClear();
  });

  it("travado: a segunda espera a vez e grava; as duas com uma tentativa, hidratar 2 vezes, revisões n+1 e n+2, e a segunda enxerga o que a primeira gravou", async () => {
    const n = await revisaoDoEspaco();
    const { ra, rb, medA, medB, vistasPorB, esperouMs } = await primeiraSeguraASegundaEspera("travado");

    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
    if (!ra.ok || !rb.ok || "conflito" in ra || "conflito" in rb) throw new Error("as duas gravações deviam confirmar");
    expect(ra.revisao).toBe(n + 1);
    expect(rb.revisao).toBe(n + 2);
    // A hidratação da segunda veio DEPOIS do commit da primeira: parte da revisão que a primeira deixou.
    expect(rb.revisaoAnterior).toBe(n + 1);
    expect(vistasPorB).toContain("Lista A (travado)");

    expect(hidratacoes()).toBe(2);
    expect(medA).toMatchObject({ regime: "travado", tentativas: 1, desfecho: "gravou" });
    expect(medB).toMatchObject({ regime: "travado", tentativas: 1, desfecho: "gravou" });
    // A espera pela vez aparece em travaMs, não em hidratarMs: a segunda ficou parada no select … for update.
    expect(medB.travaMs).toBeGreaterThan(200);
    expect(esperouMs).toBeGreaterThanOrEqual(300);
    expect(await revisaoDoEspaco()).toBe(n + 2);
  });

  it("otimista (contraste): o mesmo roteiro hidrata 3 vezes — a repetição que o travado elimina", async () => {
    const n = await revisaoDoEspaco();
    const { ra, rb, medA, medB } = await primeiraSeguraASegundaEspera("otimista");

    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
    expect(hidratacoes()).toBe(3);
    expect(medA).toMatchObject({ regime: "otimista", tentativas: 1 });
    expect(medB).toMatchObject({ regime: "otimista", tentativas: 2, desfecho: "gravou" });
    expect(await revisaoDoEspaco()).toBe(n + 2);
  });

  it("a mesma entrada duas vezes ao mesmo tempo grava uma vez: a segunda hidrata depois da primeira e o domínio a recusa (nome em uso), sem repetir", async () => {
    const n = await revisaoDoEspaco();
    const nome = "Lista em dobro";
    const [x, y] = await Promise.all([executar(ws, operacaoCriarLista(nome)), executar(ws, operacaoCriarLista(nome))]);

    const gravadas = [x, y].filter((r) => r.ok);
    const recusadas = [x, y].filter((r) => !r.ok);
    expect(gravadas).toHaveLength(1);
    expect(recusadas).toHaveLength(1);
    expect(recusadas[0]).not.toHaveProperty("conflito");
    expect(recusadas[0]).toMatchObject({ ok: false });
    expect(JSON.stringify(recusadas[0])).toContain("Já existe uma Lista chamada");
    expect(hidratacoes()).toBe(2);
    expect(await revisaoDoEspaco()).toBe(n + 1);
  });

  it("trava esgotada (outra transação segura a linha além do lock_timeout): conflito em cerca de meio segundo, sem hidratar e sem gravar nada", async () => {
    const externo = await pool().connect();
    vi.stubEnv("DATABASE_QUERY_TIMEOUT_MS", "1500"); // lock_timeout = 500 ms, statement_timeout = 1200 ms
    try {
      await externo.query("begin");
      await externo.query(SQL_DA_TRAVA, [ws]);
      const revisaoAntes = await revisaoDoEspaco();
      const registrosAntes = await registrosDoEspaco();
      const medicoes: MedicaoDaExecucao[] = [];

      const inicio = performance.now();
      const r = await executar(ws, operacaoCriarLista("Lista que não chega a existir"), { aoMedir: (m) => void medicoes.push(m) });
      const gasto = performance.now() - inicio;

      expect(r).toEqual({ ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." });
      expect(gasto).toBeGreaterThanOrEqual(400);
      expect(gasto).toBeLessThan(3_000);
      expect(hidratacoes()).toBe(0);
      expect(medicoes[0]).toMatchObject({ regime: "travado", tentativas: 1, desfecho: "conflito" });
      expect(await revisaoDoEspaco()).toBe(revisaoAntes);
      expect(await registrosDoEspaco()).toBe(registrosAntes);
    } finally {
      vi.unstubAllEnvs();
      await externo.query("rollback").catch(() => undefined);
      externo.release();
    }
  });

  it("uma exceção no meio desfaz a transação inteira e solta a trava: a gravação seguinte passa", async () => {
    const n = await revisaoDoEspaco();
    const registrosAntes = await registrosDoEspaco();
    await expect(
      executar(ws, operacaoCriarLista("Lista que a exceção desfaz"), {
        aoConfirmar: async () => {
          throw new Error("falha de teste no meio da transação");
        },
      }),
    ).rejects.toThrow("falha de teste no meio da transação");
    expect(await revisaoDoEspaco()).toBe(n);
    expect(await registrosDoEspaco()).toBe(registrosAntes);

    const seguinte = await executar(ws, operacaoCriarLista("Lista depois da exceção"));
    expect(seguinte.ok).toBe(true);
    expect(await revisaoDoEspaco()).toBe(n + 1);
  });
});
