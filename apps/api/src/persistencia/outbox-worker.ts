/**
 * O worker de entrega do outbox: reivindica uma linha `pending` de
 * `plataforma.integration_outbox` por vez, entrega por HTTP e classifica o
 * resultado. Não conhece o servidor HTTP do backend nem como ele é montado —
 * sobe/desce sozinho, dentro do mesmo processo `apps/api` (`index.ts` decide
 * QUANDO, este arquivo só decide COMO).
 *
 * Lease sem duplicação (T-02-13): `reivindicar()` usa
 * `for update skip locked` sobre a fila `pending` — duas instâncias do
 * worker (duas conexões, dois processos) nunca reivindicam a mesma linha; a
 * que perde a corrida simplesmente não encontra nenhuma linha `pending`
 * disponível naquele instante. `workspaceId` (opcional) estreita a fila a um
 * Espaço de Trabalho só — sem ele, a reivindicação é global (o padrão de
 * produção); com ele, um worker por tenant, ou um teste, nunca vê a fila de
 * outro escopo.
 *
 * Backoff com jitter (RESEARCH.md "Outbox transacional"): tentativa
 * imediata (a primeira entrega acontece assim que a linha é reivindicada,
 * sem espera); depois 5 s, 30 s, 2 min, 10 min, 30 min — e 30 min para toda
 * tentativa além da quinta, até `maxTentativas` (padrão 10). `backoff()` é
 * pura e exportada para o teste exercitar a escada sem esperar tempo real.
 *
 * Classificação de erro (contrato v1 §3): rede, timeout, 408, 429 e 5xx são
 * transitórios — a linha volta a `pending` com `available_at` no futuro. 400,
 * 401, 403, 404 e 422 são permanentes — `failed` imediato, sem nova
 * tentativa. Um 2xx encerra (`delivered`); o `Idempotency-Key` enviado é o
 * `id` da linha e nunca muda entre tentativas — é o que permite ao receptor
 * deduplicar quando a MESMA entrega é tentada de novo (D-19, T-02-17).
 *
 * `sanitizarErro()` é o único caminho para popular `last_error_summary` e
 * para o `request.log.warn` do worker: nunca o corpo cru da resposta, nunca
 * o erro de rede sem passar por ela — D-20/T-02-14 proíbem Bearer, CPF/CNPJ,
 * chave Pix e URL com query string no log.
 */

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./conexao";
import type { NomeDeEvento } from "./outbox";
import { type Relogio, relogioDoSistema } from "../testes/relogio";

/** Uma linha de `plataforma.integration_outbox`, como `select *`/`returning *` devolve. */
export interface LinhaOutbox {
  readonly id: string;
  readonly workspace_id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly payload: unknown;
  readonly status: "pending" | "delivering" | "delivered" | "failed";
  readonly attempts: number;
  readonly available_at: string;
  readonly locked_at: string | null;
  readonly locked_by: string | null;
  readonly last_error_code: string | null;
  readonly last_error_summary: string | null;
  readonly created_at: string;
  readonly delivered_at: string | null;
}

/** O caminho do webhook que cada tipo de evento dispara no `automation/` (contrato v1 §8). */
const CAMINHO_POR_EVENTO: Record<NomeDeEvento, string> = {
  "solicitacao.criada.v1": "/webhooks/plataforma/solicitacao-criada",
  "solicitacao.comentario-criado.v1": "/webhooks/plataforma/comentario-criado",
  "solicitacao.aprovacao-decidida.v1": "/webhooks/plataforma/aprovacao-decidida",
};

/**
 * Delay (ms) ATÉ a próxima tentativa, indexado pelo número da tentativa que
 * acabou de falhar (1 = a primeira, que já rodou sem espera prévia). Índices
 * além do fim da escada reusam o último valor (30 min), como a política de
 * RESEARCH.md pede.
 */
const ESCADA_MS: readonly number[] = [5_000, 30_000, 120_000, 600_000, 1_800_000];

/**
 * Delay em ms até a próxima tentativa, com jitter de até ±20% — o mesmo
 * princípio de `reordenar()` em `repositorio.ts`: pura, testável sem relógio
 * nem I/O. Quem soma ao instante atual é quem chama (`marcarPendente`
 * abaixo), usando o `Relogio` injetado.
 */
export function backoff(tentativa: number): number {
  const indice = Math.min(Math.max(tentativa, 1) - 1, ESCADA_MS.length - 1);
  const base = ESCADA_MS[indice]!;
  const jitter = base * (Math.random() * 0.4 - 0.2); // uniforme em [-20%, +20%]
  return Math.max(0, Math.round(base + jitter));
}

/** Padrões de dado sensível que nunca podem sobreviver a `sanitizarErro` (D-20/T-02-14). */
const PADROES_SENSIVEIS: readonly RegExp[] = [
  /bearer\s+\S+/gi,
  /token=[^\s&"']+/gi,
  // CNPJ (com a barra — é o que distingue de um CPF de 11 dígitos).
  /\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}/g,
  // CPF.
  /\d{3}\.?\d{3}\.?\d{3}-\d{2}/g,
  // URL com query string — pode carregar token/assinatura.
  /https?:\/\/\S+\?\S+/gi,
];

/**
 * Devolve `{ code, summary }` seguro para `last_error_summary`/log: nunca o
 * corpo cru da resposta, nunca a mensagem de erro sem passar pelos padrões
 * de redação acima. `summary` tem no máximo 200 caracteres.
 */
export function sanitizarErro(erro: unknown, code = "ERRO_DESCONHECIDO"): { readonly code: string; readonly summary: string } {
  const bruto = erro instanceof Error ? erro.message : typeof erro === "string" ? erro : JSON.stringify(erro);
  let limpo = bruto;
  for (const padrao of PADROES_SENSIVEIS) limpo = limpo.replace(padrao, "[removido]");
  const summary = limpo.length > 200 ? `${limpo.slice(0, 197)}...` : limpo;
  return { code, summary };
}

export interface OpcoesOutboxWorker {
  /** Origem do `automation/`, sem barra final — cada evento acrescenta o caminho do webhook correspondente. */
  readonly destinoUrl: string;
  readonly token: string;
  /** Identifica esta instância em `locked_by` — dois processos precisam de valores distintos. */
  readonly workerId: string;
  /**
   * Quando definido, `reivindicar()` só considera linhas deste Espaço de
   * Trabalho — um worker por tenant, ou (no teste) uma fatia isolada de uma
   * tabela compartilhada. Ausente (padrão), reivindica globalmente, como a
   * produção sempre fez.
   */
  readonly workspaceId?: string;
  readonly relogio?: Relogio;
  /** Padrão 10 (RESEARCH.md). */
  readonly maxTentativas?: number;
  readonly fetchImpl?: typeof fetch;
  /** Intervalo entre ciclos de `iniciar()`, em ms. Padrão 5 s. */
  readonly intervaloMs?: number;
  /** Tempo máximo de espera por uma entrega antes de tratar como falha de rede. Padrão 10 s. */
  readonly timeoutMs?: number;
}

export interface OutboxWorker {
  /** Começa o laço de `intervaloMs` em `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Para o laço; entregas em voo terminam sozinhas. */
  parar(): void;
  /**
   * Reivindica e entrega UMA linha, sem esperar o intervalo — o que o teste
   * usa para exercitar cada caso da Fault-Injection Matrix de forma
   * determinística. Devolve `false` quando não havia linha `pending`
   * disponível.
   */
  processarUm(): Promise<boolean>;
}

async function reivindicar(cliente: PoolClient, workerId: string, workspaceId?: string): Promise<LinhaOutbox | undefined> {
  const parametros: unknown[] = [workerId];
  let filtroWorkspace = "";
  if (workspaceId !== undefined) {
    parametros.push(workspaceId);
    filtroWorkspace = `and workspace_id = $${parametros.length}`;
  }
  const r = await cliente.query<LinhaOutbox>(
    `update plataforma.integration_outbox
        set status = 'delivering', locked_at = now(), locked_by = $1, attempts = attempts + 1
      where id = (
        select id from plataforma.integration_outbox
         where status = 'pending' and available_at <= now() ${filtroWorkspace}
         order by available_at, id
         limit 1
           for update skip locked
      )
      returning *`,
    parametros,
  );
  return r.rows[0];
}

export function criarOutboxWorker(opcoes: OpcoesOutboxWorker): OutboxWorker {
  const relogio = opcoes.relogio ?? relogioDoSistema;
  const maxTentativas = opcoes.maxTentativas ?? 10;
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const intervaloMs = opcoes.intervaloMs ?? 5_000;
  const timeoutMs = opcoes.timeoutMs ?? 10_000;

  async function marcarEntregue(id: string): Promise<void> {
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `update plataforma.integration_outbox set status = 'delivered', delivered_at = now() where id = $1`,
        [id],
      );
    } finally {
      cliente.release();
    }
  }

  async function marcarPendente(
    id: string,
    tentativa: number,
    erro: { readonly code: string; readonly summary: string },
  ): Promise<void> {
    const disponivelEm = new Date(relogio.agora().getTime() + backoff(tentativa));
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `update plataforma.integration_outbox
            set status = 'pending', available_at = $2, last_error_code = $3, last_error_summary = $4
          where id = $1`,
        [id, disponivelEm.toISOString(), erro.code, erro.summary],
      );
    } finally {
      cliente.release();
    }
  }

  async function marcarFalha(id: string, erro: { readonly code: string; readonly summary: string }): Promise<void> {
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `update plataforma.integration_outbox set status = 'failed', last_error_code = $2, last_error_summary = $3 where id = $1`,
        [id, erro.code, erro.summary],
      );
    } finally {
      cliente.release();
    }
  }

  async function entregar(linha: LinhaOutbox): Promise<void> {
    const caminho = CAMINHO_POR_EVENTO[linha.event_type as NomeDeEvento] ?? "/webhooks/plataforma/desconhecido";
    let resposta: Response | undefined;
    let erroDeRede: unknown;
    try {
      resposta = await fetchImpl(`${opcoes.destinoUrl}${caminho}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opcoes.token}`,
          "idempotency-key": linha.id,
          "x-request-id": randomUUID(),
        },
        body: JSON.stringify({ eventId: linha.id, occurredAt: linha.created_at, ...(linha.payload as Record<string, unknown>) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (erro) {
      erroDeRede = erro;
    }

    if (resposta && resposta.ok) {
      await marcarEntregue(linha.id);
      return;
    }

    const status = resposta?.status;
    const permanente = status !== undefined && [400, 401, 403, 404, 422].includes(status);
    const erroClassificado = sanitizarErro(
      erroDeRede ?? new Error(`HTTP ${status ?? "sem resposta"} de ${opcoes.destinoUrl}${caminho}`),
      status !== undefined ? `HTTP_${status}` : "ERRO_DE_REDE",
    );

    if (permanente || linha.attempts >= maxTentativas) {
      await marcarFalha(linha.id, erroClassificado);
      return;
    }
    await marcarPendente(linha.id, linha.attempts, erroClassificado);
  }

  async function processarUm(): Promise<boolean> {
    const cliente = await pool().connect();
    let linha: LinhaOutbox | undefined;
    try {
      linha = await reivindicar(cliente, opcoes.workerId, opcoes.workspaceId);
    } finally {
      cliente.release();
    }
    if (!linha) return false;
    await entregar(linha);
    return true;
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  let emAndamento = false;

  return {
    iniciar() {
      if (temporizador) return;
      temporizador = setInterval(() => {
        if (emAndamento) return;
        emAndamento = true;
        void processarUm().finally(() => {
          emAndamento = false;
        });
      }, intervaloMs);
    },
    parar() {
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
    },
    processarUm,
  };
}
