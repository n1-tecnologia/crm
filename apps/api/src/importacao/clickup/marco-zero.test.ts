/**
 * Prova contra Postgres real dos casos (a)-(d) do Plan 03-10, Task 3 —
 * `MARCO_ZERO` idempotente (no mesmo dia civil e entre dias civis
 * diferentes), sanitização do resumo, e o efeito sobre
 * `diasCiveisPendentes` (03-08). Pula sem `DATABASE_URL` (DEC-09).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { diasCiveisPendentes } from "../../automacoes/scheduler-worker";
import { carregarEnv, encerrar, pool } from "../../persistencia/conexao";
import { relogioFixo } from "../../testes/relogio";
import { diaCivilDeHoje, marcarMarcoZero } from "./marco-zero";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const RUN = `teste_marco_zero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;
const LIST_ID = `lst_teste_${RUN}`;

async function contarLinhas(): Promise<number> {
  const r = await pool().query<{ n: string }>(
    "select count(*)::text as n from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2",
    [WORKSPACE, LIST_ID],
  );
  return Number(r.rows[0]?.n ?? "0");
}

d("marcarMarcoZero (Postgres real)", () => {
  beforeAll(async () => {
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [WORKSPACE]);
  });

  afterEach(async () => {
    await pool().query("delete from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2", [WORKSPACE, LIST_ID]);
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.workspaces where workspace_id = $1", [WORKSPACE]);
    await encerrar();
  });

  it("(a) insere uma linha 'concluido' com last_error_code MARCO_ZERO e devolve true", async () => {
    const cliente = await pool().connect();
    try {
      const gravou = await marcarMarcoZero(cliente, { workspaceId: WORKSPACE, listId: LIST_ID, diaCivil: "2026-09-17" });
      expect(gravou).toBe(true);

      const linha = await pool().query<{ estado: string; last_error_code: string }>(
        "select estado, last_error_code from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2",
        [WORKSPACE, LIST_ID],
      );
      expect(linha.rows[0]?.estado).toBe("concluido");
      expect(linha.rows[0]?.last_error_code).toBe("MARCO_ZERO");
    } finally {
      cliente.release();
    }
  });

  it("(b) chamar duas vezes no MESMO dia civil não duplica: a segunda devolve false, count continua 1", async () => {
    const cliente = await pool().connect();
    try {
      const primeira = await marcarMarcoZero(cliente, { workspaceId: WORKSPACE, listId: LIST_ID, diaCivil: "2026-09-17" });
      const segunda = await marcarMarcoZero(cliente, { workspaceId: WORKSPACE, listId: LIST_ID, diaCivil: "2026-09-17" });
      expect(primeira).toBe(true);
      expect(segunda).toBe(false);
      expect(await contarLinhas()).toBe(1);
    } finally {
      cliente.release();
    }
  });

  it("(b2) chamar de novo num dia civil DIFERENTE também não cria uma segunda linha", async () => {
    const cliente = await pool().connect();
    try {
      const primeira = await marcarMarcoZero(cliente, { workspaceId: WORKSPACE, listId: LIST_ID, diaCivil: "2026-09-17" });
      const segunda = await marcarMarcoZero(cliente, { workspaceId: WORKSPACE, listId: LIST_ID, diaCivil: "2026-09-20" });
      expect(primeira).toBe(true);
      expect(segunda).toBe(false);
      expect(await contarLinhas()).toBe(1);
    } finally {
      cliente.release();
    }
  });

  it("(c) last_error_summary passa por sanitizarErro; nenhuma coluna carrega dado sensível", async () => {
    const cliente = await pool().connect();
    try {
      await marcarMarcoZero(cliente, { workspaceId: WORKSPACE, listId: LIST_ID, diaCivil: "2026-09-17" });
      const linha = await pool().query<{ last_error_summary: string }>(
        "select last_error_summary from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2",
        [WORKSPACE, LIST_ID],
      );
      const resumo = linha.rows[0]?.last_error_summary ?? "";
      expect(resumo).toContain("automacoes:liberar");
      expect(resumo.length).toBeLessThanOrEqual(200);
      expect(resumo).not.toMatch(/[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}/); // sem CPF
      expect(resumo).not.toMatch(/[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2}/); // sem CNPJ
    } finally {
      cliente.release();
    }
  });

  it("(d) depois de marcarMarcoZero, diasCiveisPendentes(dia da marca, o mesmo dia, 7) devolve []", async () => {
    const cliente = await pool().connect();
    try {
      await marcarMarcoZero(cliente, { workspaceId: WORKSPACE, listId: LIST_ID, diaCivil: "2026-09-17" });
      const hoje = new Date(2026, 8, 17);
      expect(diasCiveisPendentes("2026-09-17", hoje, 7)).toEqual([]);
    } finally {
      cliente.release();
    }
  });
});

describe("diaCivilDeHoje — pura, com Relogio injetado", () => {
  it("devolve o dia civil em America/Sao_Paulo, nunca new Date() direto", () => {
    const relogio = relogioFixo("2026-09-17T02:40:00.000Z"); // 2026-09-16 23:40 em São Paulo (UTC-3)
    expect(diaCivilDeHoje(relogio)).toBe("2026-09-16");

    const relogioDoDia = relogioFixo("2026-09-17T15:00:00.000Z"); // 2026-09-17 12:00 em São Paulo
    expect(diaCivilDeHoje(relogioDoDia)).toBe("2026-09-17");
  });

  it("nunca lança sem argumento (usa o relógio do sistema)", () => {
    expect(() => diaCivilDeHoje()).not.toThrow();
    expect(diaCivilDeHoje()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
