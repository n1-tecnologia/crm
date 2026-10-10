/**
 * O desfecho de um serviço do CRM. Recusa de regra é valor, não exceção: o
 * serviço devolve `{ ok: false, status, ... }` e a rota o traduz em HTTP.
 *
 * 400 = forma (zod, `setErrorHandler`), 403 = Papel, 404 = não existe NESTE
 * Espaço, 409 = regra ou integridade.
 */

import type { BloqueiosCrm } from "@n1/dominio/crm/comum";

export interface Recusa {
  readonly status: 400 | 403 | 404 | 409;
  readonly error: string;
  readonly codigo?: string;
  readonly campo?: string;
  readonly bloqueios?: BloqueiosCrm;
}

export type ResultadoCrm<T> = { readonly ok: true; readonly valor: T } | ({ readonly ok: false } & Recusa);

export function sucesso<T>(valor: T): ResultadoCrm<T> {
  return { ok: true, valor };
}

export function recusa<T = never>(
  status: Recusa["status"],
  error: string,
  extra: Partial<Pick<Recusa, "codigo" | "campo" | "bloqueios">> = {},
): ResultadoCrm<T> {
  return { ok: false, status, error, ...extra };
}
