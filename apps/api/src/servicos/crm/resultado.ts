/**
 * O desfecho de um serviço do CRM. Recusa de regra é valor, não exceção: o
 * serviço devolve `{ ok: false, status, ... }` e a rota o traduz em HTTP.
 *
 * 400 = forma (zod, `setErrorHandler`), 403 = Papel, 404 = não existe NESTE
 * Espaço, 409 = regra ou integridade, 422 = o pedido é bem formado mas o arquivo
 * anexado não serve (tipo, tamanho, Conversa ou Canal — 16-09).
 */

import type { BloqueiosCrm } from "@n1/dominio/crm/comum";
import type { ModeloNaLista } from "@n1/dominio/crm/modelos";

export interface Recusa {
  /** 502 e 503: o provedor de um Canal (Sessão 8) recusou ou não está configurado neste ambiente. */
  readonly status: 400 | 403 | 404 | 409 | 422 | 502 | 503;
  readonly error: string;
  readonly codigo?: string;
  readonly campo?: string;
  readonly bloqueios?: BloqueiosCrm;
  /** Sessão 7: na recusa `JANELA_EXPIRADA`, os modelos aprovados do Canal que o atendente pode escolher no lugar do texto livre. */
  readonly modelos?: readonly ModeloNaLista[];
}

export type ResultadoCrm<T> = { readonly ok: true; readonly valor: T } | ({ readonly ok: false } & Recusa);

export function sucesso<T>(valor: T): ResultadoCrm<T> {
  return { ok: true, valor };
}

export function recusa<T = never>(
  status: Recusa["status"],
  error: string,
  extra: Partial<Pick<Recusa, "codigo" | "campo" | "bloqueios" | "modelos">> = {},
): ResultadoCrm<T> {
  return { ok: false, status, error, ...extra };
}
