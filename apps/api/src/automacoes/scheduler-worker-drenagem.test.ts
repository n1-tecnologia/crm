/**
 * 10-REVIEW MEDIUM-05 — uma rejeição dentro da drenagem do agendador não pode
 * derrubar o processo da API. Sem banco: `pool()` é trocado por um falso cuja
 * consulta falha (o "blip" do Postgres), e o caso prova que a volta registra a
 * falha em log, libera `emVoo` e segue viva para a próxima volta — nenhuma
 * promessa sai sem tratamento.
 *
 * Também prova a outra metade do achado: `semear()` só marca o dia como
 * semeado depois que o catálogo respondeu. Antes, uma semeadura que falhava
 * não era tentada de novo até o dia civil seguinte.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { relogioFixo } from "../testes/relogio";

/** O que a consulta falsa faz: `falhar` decide, por SQL, se ela rejeita. */
const consulta = vi.hoisted(() => ({
  falhar: (_sql: string): boolean => true,
  chamadas: [] as string[],
}));

vi.mock("../persistencia/conexao", async (importOriginal) => {
  const original = await importOriginal<typeof import("../persistencia/conexao")>();
  const poolFalso = {
    query: async (sql: string) => {
      consulta.chamadas.push(sql);
      if (consulta.falhar(sql)) throw new Error("Connection terminated unexpectedly");
      return { rows: [], rowCount: 0 };
    },
    connect: async () => {
      throw new Error("Connection terminated unexpectedly");
    },
  };
  return { ...original, pool: () => poolFalso };
});

const { criarSchedulerWorker } = await import("./scheduler-worker");

type Registro = { readonly nivel: "info" | "warn"; readonly mensagem: string; readonly dados?: Record<string, string | number> };

describe("10-REVIEW MEDIUM-05 — a drenagem nunca deixa rejeição sem tratamento", () => {
  const rejeicoes: unknown[] = [];
  const aoRejeitar = (motivo: unknown): void => {
    rejeicoes.push(motivo);
  };

  beforeEach(() => {
    consulta.chamadas.length = 0;
    consulta.falhar = () => true;
    rejeicoes.length = 0;
    process.on("unhandledRejection", aoRejeitar);
  });

  afterEach(() => {
    process.off("unhandledRejection", aoRejeitar);
  });

  it("o banco cai no meio da volta: a falha vai para o log, nenhuma rejeição escapa e a volta seguinte roda", async () => {
    const registros: Registro[] = [];
    const worker = criarSchedulerWorker({
      workerId: "w_drenagem",
      workspaceId: "ws_drenagem",
      relogio: relogioFixo(new Date(2026, 7, 31, 12)),
      intervaloMs: 20,
      registrar: (nivel, mensagem, dados) => {
        registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) });
      },
    });

    worker.iniciar();
    try {
      // Duas voltas falhadas: a segunda só acontece se `emVoo` foi liberado na primeira.
      await vi.waitFor(() => expect(registros.filter((r) => r.mensagem === "Volta do relógio falhou.").length).toBeGreaterThanOrEqual(2), {
        timeout: 2_000,
        interval: 10,
      });
    } finally {
      await worker.parar();
    }
    // Dá ao laço de eventos a chance de entregar uma rejeição pendente.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(rejeicoes).toEqual([]);
    const falha = registros.find((r) => r.mensagem === "Volta do relógio falhou.");
    expect(falha?.nivel).toBe("warn");
    expect(String(falha?.dados?.causa ?? "")).toContain("Connection terminated");
  });

  it("parar() resolve mesmo quando a volta em voo rejeita", async () => {
    const worker = criarSchedulerWorker({ workerId: "w_parar", workspaceId: "ws_drenagem", relogio: relogioFixo(new Date(2026, 7, 31, 12)), intervaloMs: 10 });
    worker.iniciar();
    await vi.waitFor(() => expect(consulta.chamadas.length).toBeGreaterThan(0), { timeout: 2_000, interval: 5 });
    await expect(worker.parar()).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(rejeicoes).toEqual([]);
  });

  it("semear() que falha no catálogo é tentada de novo no mesmo dia civil", async () => {
    const CATALOGO = "colecao = 'automations'";
    let falhasDoCatalogo = 1;
    consulta.falhar = (sql) => {
      if (sql.includes(CATALOGO) && falhasDoCatalogo > 0) {
        falhasDoCatalogo -= 1;
        return true;
      }
      return false;
    };
    const worker = criarSchedulerWorker({ workerId: "w_semear", workspaceId: "ws_drenagem", relogio: relogioFixo(new Date(2026, 7, 31, 12)) });

    await expect(worker.processarUm()).rejects.toThrow("Connection terminated");
    // O catálogo voltou: a próxima volta semeia de novo, em vez de achar que o dia já foi semeado.
    expect(await worker.processarUm()).toBe(false);
    expect(consulta.chamadas.filter((sql) => sql.includes(CATALOGO))).toHaveLength(2);
  });
});
