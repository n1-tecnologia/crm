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
import { backoff, criarOutboxWorker, sanitizarErro, type DesfechoDaEntrega, type LinhaOutbox } from "./outbox-worker";
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

  it("(o) remove a apikey do provedor, em texto corrido, com `=` e em JSON (16-05, T-16-17)", () => {
    expect(sanitizarErro("apikey: abc123 falhou").summary).not.toContain("abc123");
    expect(sanitizarErro("chamada com apikey=abc123&x=1").summary).not.toContain("abc123");
    expect(sanitizarErro('corpo {"apikey":"abc123","instancia":"i"}').summary).not.toContain("abc123");
    expect(sanitizarErro(new Error("APIKEY: abc123")).summary).not.toContain("abc123");
    // O resto da frase sobrevive: só o valor sai.
    expect(sanitizarErro("apikey: abc123 falhou").summary).toContain("falhou");
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
        // 2 s no passado: o relógio do Postgres de Docker pode estar alguns ms atrás do deste processo, e uma linha
        // `available_at = agora` ainda não seria elegível (os casos (h) a (k) falhavam de vez em quando por isso).
        (overrides.availableAt ?? new Date(Date.now() - 2_000)).toISOString(),
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

  describe("convivência com a fila da mensageria (16-04, Pitfall 1)", () => {
    const PAYLOAD_DA_MENSAGEM = { mensagemId: "msg_1", conversaId: "cnv_1", canalId: "can_1" };
    const haSegundos = (s: number) => new Date(Date.now() - s * 1000);

    it("sem tiposDeEvento o worker nunca reivindica mensagem.%: a da Mensagem, mais antiga, continua pending com attempts 0", async () => {
      const daMensagem = await inserirLinhaPendente({ eventType: "mensagem.enviar.v1", payload: PAYLOAD_DA_MENSAGEM, availableAt: haSegundos(10) });
      const daSolicitacao = await inserirLinhaPendente({ availableAt: haSegundos(5) });
      servidor.enfileirar({ kind: "ok", status: 202, corpo: { ok: true } });

      const worker = criarOutboxWorker({ destinoUrl: servidor.url, token: "tok_teste", workerId: "worker_pitfall1", workspaceId: WORKSPACE, relogio: relogioFixo(new Date()) });
      expect(await worker.processarUm()).toBe(true);
      expect(await worker.processarUm()).toBe(false);

      expect((await buscarLinha(daSolicitacao)).status).toBe("delivered");
      const intacta = await buscarLinha(daMensagem);
      expect(intacta).toMatchObject({ status: "pending", attempts: 0, last_error_code: null });
      expect(servidor.recebidas).toHaveLength(1);
    });

    it("com tiposDeEvento: [mensagem.enviar.v1] o worker reivindica só a da Mensagem", async () => {
      const daMensagem = await inserirLinhaPendente({ eventType: "mensagem.enviar.v1", payload: PAYLOAD_DA_MENSAGEM, availableAt: haSegundos(5) });
      const daSolicitacao = await inserirLinhaPendente({ availableAt: haSegundos(10) });
      // 503: a linha volta a `pending`, mas `attempts` já conta quem a reivindicou.
      servidor.enfileirar({ kind: "ok", status: 503, corpo: { error: { code: "INDISPONIVEL" } } });

      const worker = criarOutboxWorker({
        destinoUrl: servidor.url,
        token: "tok_teste",
        workerId: "worker_so_mensagem",
        workspaceId: WORKSPACE,
        relogio: relogioFixo(new Date()),
        tiposDeEvento: ["mensagem.enviar.v1"],
      });
      expect(await worker.processarUm()).toBe(true);

      expect((await buscarLinha(daMensagem)).attempts).toBe(1);
      expect(await buscarLinha(daSolicitacao)).toMatchObject({ status: "pending", attempts: 0 });
    });
  });
});

d("worker com entregador próprio (16-05, Postgres real)", () => {
  const PAYLOAD = { mensagemId: "msg_1", conversaId: "cnv_1", canalId: "can_1" };
  const haSegundos = (n: number) => new Date(Date.now() - n * 1000);

  afterEach(async () => {
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
  });

  const criar = (entregador: (l: LinhaOutbox, c: { ultimaTentativa: boolean }) => Promise<DesfechoDaEntrega>, extras: { maxTentativas?: number; recuperarTravasVencidasMs?: number } = {}) =>
    criarOutboxWorker({
      workerId: "worker_entregador",
      workspaceId: WORKSPACE,
      tiposDeEvento: ["mensagem.enviar.v1"],
      entregador,
      relogio: relogioFixo(new Date()),
      ...extras,
    });

  // `available_at` com o relógio do processo de teste: sem folga, um Postgres de Docker com o relógio alguns ms atrás
  // ainda não a enxerga como disponível. Por isso o padrão é 5 s no passado.
  const linhaDaMensagem = (opcoes: { availableAt?: Date } = {}) =>
    inserirLinhaPendente({ eventType: "mensagem.enviar.v1", payload: PAYLOAD, availableAt: opcoes.availableAt ?? haSegundos(5) });

  async function travar(id: string, segundosAtras: number, attempts: number): Promise<void> {
    await pool().query(
      "update plataforma.integration_outbox set status = 'delivering', locked_at = now() - make_interval(secs => $2), locked_by = 'caiu', attempts = $3 where id = $1",
      [id, segundosAtras, attempts],
    );
  }

  it("(p) aplica o desfecho do entregador à linha: entregue, tentar de novo (pending com espera) e desistir (failed)", async () => {
    const entregue = await linhaDaMensagem({ availableAt: haSegundos(30) });
    const adiada = await linhaDaMensagem({ availableAt: haSegundos(20) });
    const desistida = await linhaDaMensagem({ availableAt: haSegundos(10) });
    const resultados: DesfechoDaEntrega[] = [
      { desfecho: "entregue" },
      { desfecho: "tentar_de_novo", erro: { code: "HTTP_503", summary: "fora do ar" } },
      { desfecho: "desistir", erro: { code: "CANAL_DESCONECTADO", summary: "caiu" } },
    ];
    const worker = criar(async () => resultados.shift()!);

    expect(await worker.processarUm()).toBe(true);
    expect(await worker.processarUm()).toBe(true);
    expect(await worker.processarUm()).toBe(true);
    expect(await worker.processarUm()).toBe(false);

    expect((await buscarLinha(entregue)).status).toBe("delivered");
    const pendente = await buscarLinha(adiada);
    expect(pendente).toMatchObject({ status: "pending", attempts: 1, last_error_code: "HTTP_503" });
    expect(new Date(pendente.available_at).getTime()).toBeGreaterThan(Date.now());
    expect(await buscarLinha(desistida)).toMatchObject({ status: "failed", last_error_code: "CANAL_DESCONECTADO" });
  });

  it("(q) exceção do entregador vale tentar de novo com o erro sanitizado; na última tentativa vira failed", async () => {
    const id = await linhaDaMensagem();
    const worker = criar(async () => {
      throw new Error("falha com apikey: segredo-do-provedor");
    }, { maxTentativas: 2 });

    expect(await worker.processarUm()).toBe(true);
    const primeira = await buscarLinha(id);
    expect(primeira).toMatchObject({ status: "pending", attempts: 1, last_error_code: "ERRO_DO_ENTREGADOR" });
    expect(primeira.last_error_summary).not.toContain("segredo-do-provedor");

    await marcarDisponivelAgora(id);
    expect(await worker.processarUm()).toBe(true);
    expect(await buscarLinha(id)).toMatchObject({ status: "failed", attempts: 2 });
  });

  it("(r) o entregador sabe quando é a última tentativa", async () => {
    const id = await linhaDaMensagem();
    const vistas: boolean[] = [];
    const worker = criar(async (_l, { ultimaTentativa }) => {
      vistas.push(ultimaTentativa);
      return { desfecho: "tentar_de_novo", erro: { code: "X", summary: "x" } };
    }, { maxTentativas: 2 });

    await worker.processarUm();
    await marcarDisponivelAgora(id);
    await worker.processarUm();

    expect(vistas).toEqual([false, true]);
  });

  it("(s) recuperação de trava: delivering com mais de 2 min volta a pending e é entregue; com 30 s fica como está", async () => {
    const velha = await linhaDaMensagem();
    const recente = await linhaDaMensagem();
    await travar(velha, 180, 1);
    await travar(recente, 30, 1);
    const entregues: string[] = [];
    const worker = criar(async (l) => {
      entregues.push(l.id);
      return { desfecho: "entregue" };
    }, { recuperarTravasVencidasMs: 120_000 });

    expect(await worker.processarUm()).toBe(true);
    expect(await worker.processarUm()).toBe(false);

    expect(entregues).toEqual([velha]);
    expect((await buscarLinha(velha)).status).toBe("delivered");
    expect((await buscarLinha(recente)).status).toBe("delivering");
  });

  it("(t) trava vencida de linha que já gastou as tentativas vira failed/TRAVA_VENCIDA, sem nova entrega", async () => {
    const id = await linhaDaMensagem();
    await travar(id, 300, 5);
    let chamadas = 0;
    const worker = criar(async () => {
      chamadas += 1;
      return { desfecho: "entregue" };
    }, { recuperarTravasVencidasMs: 120_000, maxTentativas: 5 });

    expect(await worker.processarUm()).toBe(false);

    expect(chamadas).toBe(0);
    expect(await buscarLinha(id)).toMatchObject({ status: "failed", last_error_code: "TRAVA_VENCIDA" });
  });

  it("(u) a recuperação só toca os tipos do worker: a trava vencida de outro tipo de evento não é mexida", async () => {
    const daSolicitacao = await inserirLinhaPendente({ availableAt: haSegundos(5) });
    await travar(daSolicitacao, 600, 1);
    const worker = criar(async () => ({ desfecho: "entregue" }), { recuperarTravasVencidasMs: 120_000 });

    expect(await worker.processarUm()).toBe(false);

    expect((await buscarLinha(daSolicitacao)).status).toBe("delivering");
  });
});
