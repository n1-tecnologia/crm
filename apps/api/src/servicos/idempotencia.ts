/**
 * Idempotência HTTP das rotas `/v1/integrations/payment-requests/*`
 * (Plan 02-13, §7 de `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`).
 *
 * Chave composta `(service_id, route_template, idempotency_key)` —
 * `plataforma.http_idempotency` (`apps/api/migracoes/003-integracao-e-importacao.sql`),
 * primary key composta na própria tabela. `comIdempotencia` nunca abre a
 * transação de `executar()` (`../persistencia/unidade-de-trabalho.ts`): a
 * linha de idempotência é gravada ANTES e DEPOIS da operação de domínio, em
 * consultas próprias sobre `pool()` — não dentro do mesmo `pg.Client`, porque
 * `executar()` já gerencia a transação da escrita de negócio sozinho.
 *
 * Protocolo (plano, Task 1):
 *   1. `insert ... on conflict do nothing` com `status='in_progress'`. Se
 *      inseriu, segue para `executar()`.
 *   2. Se não inseriu, uma linha já existe: `request_hash` diferente devolve
 *      `IDEMPOTENCY_KEY_REUSED`; `status='in_progress'` devolve
 *      `REQUEST_IN_PROGRESS` (`retryAfterSegundos`); `status='completed'`
 *      devolve a resposta gravada, sem repetir o efeito.
 *   3. `executar()` roda; grava `status='completed'` com a resposta. Se
 *      `executar()` lançar, apaga a linha `in_progress` (para não travar a
 *      chave para sempre) e propaga a exceção.
 *
 * `requestHash` é calculado pela ROTA (sha-256 do corpo canonicalizado, chaves
 * ordenadas) — este serviço só compara o hash recebido contra o gravado,
 * nunca calcula.
 */

import { pool } from "../persistencia/conexao";

export interface ArgumentosDeIdempotencia {
  readonly servicoId: string;
  readonly rota: string;
  readonly chave: string;
  readonly requestHash: string;
}

export interface RespostaExecutada<T> {
  readonly status: number;
  readonly corpo: T;
}

export type ResultadoDeIdempotencia<T> =
  | ({ readonly ok: true } & RespostaExecutada<T>)
  | { readonly ok: false; readonly motivo: "IDEMPOTENCY_KEY_REUSED" }
  | { readonly ok: false; readonly motivo: "REQUEST_IN_PROGRESS"; readonly retryAfterSegundos: number };

interface LinhaDeIdempotencia {
  readonly request_hash: string;
  readonly status: "in_progress" | "completed";
  readonly response_status: number | null;
  readonly response_body: unknown;
}

const RETRY_AFTER_SEGUNDOS_PADRAO = 2;

async function lerLinha(args: ArgumentosDeIdempotencia): Promise<LinhaDeIdempotencia | undefined> {
  const resultado = await pool().query<LinhaDeIdempotencia>(
    `select request_hash, status, response_status, response_body
       from plataforma.http_idempotency
      where service_id = $1 and route_template = $2 and idempotency_key = $3`,
    [args.servicoId, args.rota, args.chave],
  );
  return resultado.rows[0];
}

/**
 * Envolve `executar` com a semântica de replay do §7. `executar` só roda
 * quando esta chamada É a primeira tentativa da chave — chamadas
 * subsequentes (replay ou conflito) nunca chegam a chamar `executar`.
 */
export async function comIdempotencia<T>(
  args: ArgumentosDeIdempotencia,
  executar: () => Promise<RespostaExecutada<T>>,
): Promise<ResultadoDeIdempotencia<T>> {
  const inserida = await pool().query(
    `insert into plataforma.http_idempotency (service_id, route_template, idempotency_key, request_hash, status)
     values ($1, $2, $3, $4, 'in_progress')
     on conflict (service_id, route_template, idempotency_key) do nothing`,
    [args.servicoId, args.rota, args.chave, args.requestHash],
  );

  if (inserida.rowCount === 0) {
    // Já existe uma linha para esta chave — decide sem rodar `executar` de novo.
    const linha = await lerLinha(args);
    if (!linha) {
      // Corrida rara: a linha existia no `on conflict` e sumiu antes do select
      // (a tentativa original falhou e apagou a própria linha `in_progress`
      // entre as duas consultas). Trata como se não tivesse encontrado nada:
      // quem chama pode tentar de novo com a mesma chave.
      return { ok: false, motivo: "REQUEST_IN_PROGRESS", retryAfterSegundos: RETRY_AFTER_SEGUNDOS_PADRAO };
    }
    if (linha.request_hash !== args.requestHash) {
      return { ok: false, motivo: "IDEMPOTENCY_KEY_REUSED" };
    }
    if (linha.status === "in_progress") {
      return { ok: false, motivo: "REQUEST_IN_PROGRESS", retryAfterSegundos: RETRY_AFTER_SEGUNDOS_PADRAO };
    }
    return { ok: true, status: linha.response_status!, corpo: linha.response_body as T };
  }

  try {
    const resposta = await executar();
    await pool().query(
      `update plataforma.http_idempotency
          set status = 'completed', response_status = $4, response_body = $5::jsonb, completed_at = now()
        where service_id = $1 and route_template = $2 and idempotency_key = $3`,
      [args.servicoId, args.rota, args.chave, resposta.status, JSON.stringify(resposta.corpo)],
    );
    return { ok: true, status: resposta.status, corpo: resposta.corpo };
  } catch (erro) {
    // Nunca trava a chave por uma tentativa que falhou: apaga a linha
    // `in_progress` para uma próxima tentativa (mesma chave) poder rodar de
    // novo, em vez de ficar presa em `REQUEST_IN_PROGRESS` para sempre.
    await pool().query(
      `delete from plataforma.http_idempotency
        where service_id = $1 and route_template = $2 and idempotency_key = $3 and status = 'in_progress'`,
      [args.servicoId, args.rota, args.chave],
    );
    throw erro;
  }
}
