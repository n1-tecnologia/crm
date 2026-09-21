/**
 * V02-07A/T-02-13/T-02-14/T-02-17 (02-VALIDATION.md) — a Fault-Injection
 * Matrix do worker de entrega (Plan 02-10, Task 2): classificação de
 * resposta (2xx/permanente/transitório), lease sem duplicação, backoff com
 * jitter e `sanitizarErro`.
 *
 * `backoff`/`sanitizarErro` são funções puras — rodam sempre, sem
 * `DATABASE_URL`. As demais precisam de Postgres real com a migração `003`
 * aplicada e pulam sem ele (D-DEC-09), como os outros testes de
 * `persistencia/`. Nenhum destes dois arquivos usa `vi.mock` sobre `fetch`:
 * `criarServidorFalso` é um servidor `node:http` real (ver
 * `apps/api/src/testes/CONTEXT.md`).
 */

import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { carregarEnv, encerrar, pool } from "./conexao";
import { backoff, criarOutboxWorker, sanitizarErro } from "./outbox-worker";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { relogioFixo } from "../testes/relogio";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

/* ── (m)/(n) — puras, sem banco, rodam sempre ────────────────────────────── */

describe("backoff (RESEARCH.md — escada com jitter, sem banco)", () => {
  const ESCADA_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000];

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("(n) backoff(%i) fica dentro de ±20%% do degrau esperado da escada", (tentativa) => {
    const indice = Math.min(tentativa - 1, ESCADA_MS.length - 1);
    const base = ESCADA_MS[indice]!;
    const valor = backoff(tentativa);
    expect(valor).toBeGreaterThanOrEqual(Math.round(base * 0.8));
    expect(valor).toBeLessThanOrEqual(Math.round(base * 1.2));
  });
});

describe("sanitizarErro (D-20/T-02-14, sem banco)", () => {
  it("(m) remove Bearer, CNPJ e URL com query string do resumo", () => {
    const mensagem =
      'Falha ao entregar: Authorization: Bearer abc.def.ghi123; CNPJ 12.345.678/0001-99; ' +
      "callback https://financeiro-tria.example.com/hook?token=segredo123&outro=1";
    const { summary } = sanitizarErro(new Error(mensagem), "HTTP_500");

    expect(summary.toLowerCase()).not.toMatch(/bearer\s+\S+/);
    expect(summary).not.toContain("12.345.678/0001-99");
    expect(summary).not.toMatch(/\?token=/);
    expect(summary).not.toContain("segredo123");
    expect(summary.length).toBeLessThanOrEqual(200);
  });
});

/* ── (g)–(l) — precisam de Postgres real ─────────────────────────────────── */

const RUN = `outbox_worker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;

async function inserirLinhaPendente(
  overrides: {
    readonly eventType?: string;
    readonly payload?: unknown;
    readonly attempts?: number;
    readonly availableAt?: Date;
  } = {},
): Promise<string> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ id: string }>(
      `insert into plataforma.integration_outbox
         (workspace_id, aggregate_type, aggregate_id, event_type, payload, status, attempts, available_at)
       values ($1, 'task', $2, $3, $4::jsonb, 'pending', $5, $6)
       returning id`,
      [
        WORKSPACE,
        `agg_${randomUUID()}`,
        overrides.eventType ?? "solicitacao.criada.v1",
        JSON.stringify(overrides.payload ?? { taskId: "tar_1", readableId: "tar_1", listId: "lst_1", origin: "plataforma" }),
        overrides.attempts ?? 0,
        (overrides.availableAt ?? new Date()).toISOString(),
      ],
    );
    return r.rows[0]!.id;
  } finally {
    cliente.release();
  }
}

interface LinhaLida {
  readonly id: string;
  readonly status: string;
  readonly attempts: number;
  readonly available_at: string;
  readonly last_error_code: string | null;
  readonly last_error_summary: string | null;
  readonly delivered_at: string | null;
}

async function buscarLinha(id: string): Promise<LinhaLida> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<LinhaLida>("select * from plataforma.integration_outbox where id = $1", [id]);
    if (!r.rows[0]) throw new Error(`linha ${id} não encontrada`);
    return r.rows[0];
  } finally {
    cliente.release();
  }
}

async function marcarDisponivelAgora(id: string): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("update plataforma.integration_outbox set available_at = now() where id = $1", [id]);
  } finally {
    cliente.release();
  }
}

d("worker de entrega (Postgres real)", () => {
  let servidor: ServidorFalso;

  beforeEach(async () => {
    servidor = await criarServidorFalso();
  });

  afterEach(async () => {
    await servidor.fechar();
    // Um `for update skip locked` global reivindica a linha mais antiga da
    // TABELA INTEIRA, não só a deste `WORKSPACE` (é assim que a produção
    // precisa se comportar). Sem isto, o caso (h) — que termina 'pending'
    // de propósito, para provar backoff — sobrevive para o caso seguinte
    // dentro da MESMA execução, e uma execução que falhe no meio deixa
    // resíduo 'pending' que uma execução seguinte (outro processo, outro
    // `WORKSPACE`) pode reivindicar depois que o `available_at` passar.
    // Cada caso limpa a própria fatia aqui — não só em `afterAll` — para
    // que uma corrida nunca envenene a próxima, dentro ou fora deste run.
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  it("(g) 202 vira 'delivered' e o Idempotency-Key recebido é o id do evento", async () => {
    const id = await inserirLinhaPendente();
    servidor.enfileirar({ kind: "ok", status: 202, corpo: { ok: true } });

    const worker = criarOutboxWorker({ destinoUrl: servidor.url, token: "tok_teste", workerId: "worker_g", workspaceId: WORKSPACE, relogio: relogioFixo(new Date()) });
    const processou = await worker.processarUm();

    expect(processou).toBe(true);
    const linha = await buscarLinha(id);
    expect(linha.status).toBe("delivered");
    expect(linha.delivered_at).not.toBeNull();
    expect(servidor.recebidas).toHaveLength(1);
    expect(servidor.recebidas[0]!.cabecalhos["idempotency-key"]).toBe(id);
  });

  it("(h) 503 volta para 'pending' com available_at no futuro; attempts incrementa", async () => {
    const id = await inserirLinhaPendente();
    servidor.enfileirar({ kind: "ok", status: 503, corpo: { error: { code: "INDISPONIVEL" } } });
    const antes = Date.now();

    const worker = criarOutboxWorker({ destinoUrl: servidor.url, token: "tok_teste", workerId: "worker_h", workspaceId: WORKSPACE, relogio: relogioFixo(new Date(antes)) });
    await worker.processarUm();

    const linha = await buscarLinha(id);
    expect(linha.status).toBe("pending");
    expect(linha.attempts).toBe(1);
    expect(new Date(linha.available_at).getTime()).toBeGreaterThan(antes);
    expect(linha.last_error_code).toBe("HTTP_503");
  });

  it("(i) resposta perdida: volta a 'pending' e a segunda tentativa reenvia a MESMA Idempotency-Key", async () => {
    const id = await inserirLinhaPendente();
    servidor.enfileirar({ kind: "respostaPerdida" });

    const worker = criarOutboxWorker({ destinoUrl: servidor.url, token: "tok_teste", workerId: "worker_i", workspaceId: WORKSPACE, relogio: relogioFixo(new Date()) });
    await worker.processarUm();

    let linha = await buscarLinha(id);
    expect(linha.status).toBe("pending");
    expect(linha.attempts).toBe(1);

    // Simula "tempo suficiente passou" sem esperar o backoff real (o `available_at`
    // gravado usa o relógio injetado; o `reivindicar()` compara contra o `now()`
    // do banco — os dois não precisam coincidir para este teste provar o que
    // importa: a MESMA Idempotency-Key na segunda tentativa).
    await marcarDisponivelAgora(id);
    servidor.enfileirar({ kind: "ok", status: 202 });
    await worker.processarUm();

    linha = await buscarLinha(id);
    expect(linha.status).toBe("delivered");
    expect(servidor.recebidas).toHaveLength(2);
    expect(servidor.recebidas[0]!.cabecalhos["idempotency-key"]).toBe(id);
    expect(servidor.recebidas[1]!.cabecalhos["idempotency-key"]).toBe(id);
  });

  it("(j) 422 vira 'failed' imediato, sem nova tentativa", async () => {
    const id = await inserirLinhaPendente();
    servidor.enfileirar({ kind: "ok", status: 422, corpo: { error: { code: "REGRA_DE_DOMINIO" } } });

    const worker = criarOutboxWorker({ destinoUrl: servidor.url, token: "tok_teste", workerId: "worker_j", workspaceId: WORKSPACE, relogio: relogioFixo(new Date()) });
    await worker.processarUm();

    const linha = await buscarLinha(id);
    expect(linha.status).toBe("failed");
    expect(linha.last_error_code).toBe("HTTP_422");
  });

  it("(k) attempts atingindo maxTentativas vira 'failed' mesmo com status retryable", async () => {
    const id = await inserirLinhaPendente();
    servidor.enfileirar({ kind: "ok", status: 503 });

    // maxTentativas: 1 — a primeira (e única) tentativa já esgota a cota.
    const worker = criarOutboxWorker({
      destinoUrl: servidor.url,
      token: "tok_teste",
      workerId: "worker_k",
      workspaceId: WORKSPACE,
      relogio: relogioFixo(new Date()),
      maxTentativas: 1,
    });
    await worker.processarUm();

    const linha = await buscarLinha(id);
    expect(linha.status).toBe("failed");
    expect(linha.attempts).toBe(1);
  });

  it("(l) duas instâncias reivindicando a mesma linha: só uma entrega acontece", async () => {
    await inserirLinhaPendente();
    // Fila com UMA única resposta: se as duas instâncias chamassem `fetch`,
    // a segunda cairia no 500 SEM_RESPOSTA_PROGRAMADA — a asserção abaixo
    // conta `recebidas`, não o status, então o teste falha de qualquer jeito
    // que a duplicação aconteça.
    servidor.enfileirar({ kind: "ok", status: 202 });

    const relogio = relogioFixo(new Date());
    const workerA = criarOutboxWorker({ destinoUrl: servidor.url, token: "tok_teste", workerId: "worker_l_a", workspaceId: WORKSPACE, relogio });
    const workerB = criarOutboxWorker({ destinoUrl: servidor.url, token: "tok_teste", workerId: "worker_l_b", workspaceId: WORKSPACE, relogio });

    const [a, b] = await Promise.all([workerA.processarUm(), workerB.processarUm()]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(servidor.recebidas).toHaveLength(1);
  });
});
