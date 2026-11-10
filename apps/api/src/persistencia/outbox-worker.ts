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

/**
 * O caminho do webhook que cada tipo de evento dispara no `automation/` (contrato v1 §8).
 * `mensagem.enviar.v1` não tem caminho: é da mensageria, não do `automation/`.
 */
const CAMINHO_POR_EVENTO: Record<Exclude<NomeDeEvento, "mensagem.enviar.v1">, string> = {
  "solicitacao.criada.v1": "/webhooks/plataforma/solicitacao-criada",
  "solicitacao.comentario-criado.v1": "/webhooks/plataforma/comentario-criado",
  "solicitacao.aprovacao-decidida.v1": "/webhooks/plataforma/aprovacao-decidida",
  "automacao.notificar-canal.v1": "/webhooks/plataforma/notificar-canal",
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
  // `apikey: <valor>` / `apikey=<valor>`: a chave do provedor (Evolution) nunca pode ir a `last_error_summary` nem a `motivo_falha` (16-05, T-16-17).
  /apikey["']?\s*[:=]\s*["']?[^\s"',}]+/gi,
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

/**
 * O que o worker grava em `last_error_code` quando devolve uma trava vencida a `pending` (ou a esgota): o processo
 * que a reivindicou caiu sem dizer o que aconteceu. Quem entrega decide o que fazer com a linha marcada (16-20, WR-01).
 */
export const CODIGO_DA_TRAVA_VENCIDA = "TRAVA_VENCIDA";

/** O que o worker grava quando uma exceção escapa do entregador: não se sabe até onde ele chegou (16-20, WR-01). */
export const CODIGO_DO_ERRO_DO_ENTREGADOR = "ERRO_DO_ENTREGADOR";

/** O que o entregador de um worker decide sobre UMA linha (16-05): o worker só aplica o desfecho à linha do outbox. */
export type DesfechoDaEntrega =
  | { readonly desfecho: "entregue" }
  | { readonly desfecho: "tentar_de_novo"; readonly erro: { readonly code: string; readonly summary: string } }
  | { readonly desfecho: "desistir"; readonly erro: { readonly code: string; readonly summary: string } };

/** `ultimaTentativa`: esta é a última que a linha terá (`attempts >= maxTentativas`); quem entrega decide o que gravar no Agregado. */
export type EntregadorDoOutbox = (linha: LinhaOutbox, contexto: { readonly ultimaTentativa: boolean }) => Promise<DesfechoDaEntrega>;

interface OpcoesComunsDoOutboxWorker {
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
  /** Intervalo entre ciclos de `iniciar()`, em ms. Padrão 5 s. */
  readonly intervaloMs?: number;
  /**
   * Os tipos de evento que este worker reivindica (filtro inclusivo). Ausente, o worker pega tudo MENOS os
   * eventos da mensageria (`mensagem.%`): a fila de saída da mensageria tem entregador próprio, e com
   * `OUTBOX_WORKER_ATIVO=true` este worker marcaria a Mensagem do cliente como `failed` por um 404 do
   * `automation/` (16-04, Pitfall 1). O padrão é "exclui `mensagem.%`" e não uma lista dos quatro eventos de
   * hoje: um evento novo do `automation/` continua saindo sem editar este filtro.
   */
  readonly tiposDeEvento?: readonly NomeDeEvento[];
  /**
   * Uma linha `delivering` cujo `locked_at` passou deste prazo (ms) é de um worker que caiu: volta a `pending`
   * antes de cada reivindicação (ou vira `failed/TRAVA_VENCIDA` se já gastou as tentativas). A linha devolvida volta
   * MARCADA (`last_error_code = 'TRAVA_VENCIDA'`): o worker não sabe se a entrega chegou a sair, e quem entrega decide
   * o que fazer com ela (a saída da mensageria a fecha como ambígua em vez de reenviar, 16-20). Ausente, não há
   * recuperação (o worker do `automation/` nunca teve). Só olha os `tiposDeEvento` deste worker.
   */
  readonly recuperarTravasVencidasMs?: number;
  /** Só código e id: nunca o corpo, o texto nem o erro cru. Sem ele, um erro do ciclo sobe como sempre subiu. */
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
}

/** O worker do `automation/`: entrega por HTTP ao `destinoUrl`. */
export interface OpcoesDoOutboxWorkerHttp extends OpcoesComunsDoOutboxWorker {
  /** Origem do `automation/`, sem barra final — cada evento acrescenta o caminho do webhook correspondente. */
  readonly destinoUrl: string;
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
  /** Tempo máximo de espera por uma entrega antes de tratar como falha de rede. Padrão 10 s. */
  readonly timeoutMs?: number;
  readonly entregador?: undefined;
}

/** Um worker com entregador próprio (a saída da mensageria): nada de HTTP ao `automation/`. */
export interface OpcoesDoOutboxWorkerComEntregador extends OpcoesComunsDoOutboxWorker {
  readonly entregador: EntregadorDoOutbox;
  readonly destinoUrl?: undefined;
  readonly token?: undefined;
}

export type OpcoesOutboxWorker = OpcoesDoOutboxWorkerHttp | OpcoesDoOutboxWorkerComEntregador;

export interface OutboxWorker {
  /** Começa o laço de `intervaloMs` em `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  /**
   * Para o laço; a entrega em voo (se houver) termina sozinha, e a promessa
   * resolve quando ela terminar — é o que a recarga do `vite-node --watch`
   * (`../index.ts`) espera antes de fechar o pool.
   */
  parar(): Promise<void>;
  /**
   * Reivindica e entrega UMA linha, sem esperar o intervalo — o que o teste
   * usa para exercitar cada caso da Fault-Injection Matrix de forma
   * determinística. Devolve `false` quando não havia linha `pending`
   * disponível.
   */
  processarUm(): Promise<boolean>;
  /**
   * Dispara uma volta agora, sem esperar o intervalo (quem acorda é quem acabou de gravar a linha, 16-05).
   * Sem volta em voo, inicia uma; com uma em voo, só pede mais uma ao terminar: nunca duas ao mesmo tempo.
   */
  acordar(): void;
}

async function reivindicar(
  cliente: PoolClient,
  workerId: string,
  workspaceId?: string,
  tipos?: readonly NomeDeEvento[],
): Promise<LinhaOutbox | undefined> {
  const parametros: unknown[] = [workerId];
  let filtroWorkspace = "";
  if (workspaceId !== undefined) {
    parametros.push(workspaceId);
    filtroWorkspace = `and workspace_id = $${parametros.length}`;
  }
  // Com `tipos`, só eles; sem, tudo menos `mensagem.%` (ver `OpcoesOutboxWorker.tiposDeEvento`).
  let filtroDeTipo = "and event_type not like 'mensagem.%'";
  if (tipos !== undefined) {
    parametros.push([...tipos]);
    filtroDeTipo = `and event_type = any($${parametros.length}::text[])`;
  }
  const r = await cliente.query<LinhaOutbox>(
    `update plataforma.integration_outbox
        set status = 'delivering', locked_at = now(), locked_by = $1, attempts = attempts + 1
      where id = (
        select id from plataforma.integration_outbox
         where status = 'pending' and available_at <= now() ${filtroWorkspace} ${filtroDeTipo}
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
  const fetchImpl = (opcoes.entregador ? undefined : opcoes.fetchImpl) ?? fetch;
  const intervaloMs = opcoes.intervaloMs ?? 5_000;
  const timeoutMs = (opcoes.entregador ? undefined : opcoes.timeoutMs) ?? 10_000;

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

  /** O caminho HTTP ao `automation/` (o worker sem `entregador`). */
  async function entregarPorHttp(linha: LinhaOutbox, destinoUrl: string, token: string): Promise<void> {
    const caminho = CAMINHO_POR_EVENTO[linha.event_type as keyof typeof CAMINHO_POR_EVENTO] ?? "/webhooks/plataforma/desconhecido";
    let resposta: Response | undefined;
    let erroDeRede: unknown;
    try {
      resposta = await fetchImpl(`${destinoUrl}${caminho}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
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
      erroDeRede ?? new Error(`HTTP ${status ?? "sem resposta"} de ${destinoUrl}${caminho}`),
      status !== undefined ? `HTTP_${status}` : "ERRO_DE_REDE",
    );

    if (permanente || linha.attempts >= maxTentativas) {
      await marcarFalha(linha.id, erroClassificado);
      return;
    }
    await marcarPendente(linha.id, linha.attempts, erroClassificado);
  }

  /** Um entregador próprio decide o desfecho; o worker só o aplica à linha (16-05). */
  async function entregarPeloEntregador(linha: LinhaOutbox, entregador: EntregadorDoOutbox): Promise<void> {
    const ultimaTentativa = linha.attempts >= maxTentativas;
    let resultado: DesfechoDaEntrega;
    try {
      resultado = await entregador(linha, { ultimaTentativa });
    } catch (erro) {
      resultado = { desfecho: "tentar_de_novo", erro: sanitizarErro(erro, CODIGO_DO_ERRO_DO_ENTREGADOR) };
    }
    if (resultado.desfecho === "entregue") {
      await marcarEntregue(linha.id);
    } else if (resultado.desfecho === "desistir" || ultimaTentativa) {
      await marcarFalha(linha.id, resultado.erro);
    } else {
      await marcarPendente(linha.id, linha.attempts, resultado.erro);
    }
  }

  /**
   * Trava vencida: o worker que reivindicou a linha caiu antes de marcá-la. Antes de cada reivindicação, volta a
   * `pending` com `last_error_code = 'TRAVA_VENCIDA'` (ou, se já gastou as tentativas, `failed/TRAVA_VENCIDA`: uma
   * linha que derruba o processo não volta para sempre). Só toca os `tiposDeEvento` deste worker e, com `workspaceId`, só o Espaço dele.
   */
  async function recuperarTravasVencidas(): Promise<void> {
    if (opcoes.recuperarTravasVencidasMs === undefined) return;
    const parametros: unknown[] = [opcoes.recuperarTravasVencidasMs / 1000, maxTentativas];
    let filtros = "";
    if (opcoes.workspaceId !== undefined) {
      parametros.push(opcoes.workspaceId);
      filtros += ` and workspace_id = $${parametros.length}`;
    }
    if (opcoes.tiposDeEvento !== undefined) {
      parametros.push([...opcoes.tiposDeEvento]);
      filtros += ` and event_type = any($${parametros.length}::text[])`;
    } else {
      filtros += " and event_type not like 'mensagem.%'";
    }
    const vencida = `status = 'delivering' and locked_at < now() - make_interval(secs => $1)${filtros}`;
    parametros.push(CODIGO_DA_TRAVA_VENCIDA);
    const codigo = `$${parametros.length}`;
    await pool().query(
      `update plataforma.integration_outbox
          set status = 'failed', locked_at = null, locked_by = null, last_error_code = ${codigo},
              last_error_summary = 'O worker caiu no meio da entrega e a linha já tinha gastado as tentativas.'
        where ${vencida} and attempts >= $2::int`,
      parametros,
    );
    await pool().query(
      `update plataforma.integration_outbox
          set status = 'pending', locked_at = null, locked_by = null, last_error_code = ${codigo},
              last_error_summary = 'O worker caiu no meio da entrega; a linha voltou à fila.'
        where ${vencida} and attempts < $2::int`,
      parametros,
    );
  }

  async function processarUm(): Promise<boolean> {
    await recuperarTravasVencidas();
    const cliente = await pool().connect();
    let linha: LinhaOutbox | undefined;
    try {
      linha = await reivindicar(cliente, opcoes.workerId, opcoes.workspaceId, opcoes.tiposDeEvento);
    } finally {
      cliente.release();
    }
    if (!linha) return false;
    if (opcoes.entregador) await entregarPeloEntregador(linha, opcoes.entregador);
    else await entregarPorHttp(linha, opcoes.destinoUrl, opcoes.token);
    return true;
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  // A volta em voo: `parar()` a espera, e `acordar()` durante ela só pede mais uma (nunca duas juntas).
  // Uma volta esvazia a fila (o que estiver disponível agora): uma linha que falha volta com `available_at`
  // no futuro, então o laço termina. Um erro vai a `registrar`; sem `registrar` sobe como sempre subiu
  // (a promessa da volta segue sem `catch`).
  let emVoo: Promise<void> | undefined;
  let pedirOutraVolta = false;
  let parado = false;

  async function rodarVolta(): Promise<void> {
    try {
      do {
        pedirOutraVolta = false;
        while (!parado && (await processarUm())) {
          // até a fila esvaziar
        }
      } while (pedirOutraVolta && !parado);
    } catch (erro) {
      if (!opcoes.registrar) throw erro;
      opcoes.registrar("error", "volta do worker do outbox falhou", { erro: erro instanceof Error ? erro.name : "erro" });
    }
  }

  function dispararVolta(): void {
    if (parado) return;
    if (emVoo) {
      pedirOutraVolta = true;
      return;
    }
    let terminou!: () => void;
    emVoo = new Promise<void>((resolve) => {
      terminou = resolve;
    });
    void rodarVolta().finally(() => {
      emVoo = undefined;
      terminou();
    });
  }

  return {
    iniciar() {
      if (temporizador) return;
      parado = false;
      temporizador = setInterval(dispararVolta, intervaloMs);
    },
    async parar() {
      parado = true;
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
      await emVoo;
    },
    processarUm,
    acordar: dispararVolta,
  };
}
