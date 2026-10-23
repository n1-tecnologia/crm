/**
 * Esqueleto da fase RED (TDD, plano 09-13): a forma dos exports, sem o
 * comportamento. A implementação entra no commit seguinte.
 */

import type { Breadcrumb, ErrorEvent, NodeOptions } from "@sentry/node";

export function limparEvento<T extends object>(evento: T): T {
  return evento;
}

export function limparMigalha<T extends object>(migalha: T): T {
  return migalha;
}

export function opcoesDoSentry(_env: NodeJS.ProcessEnv = process.env): NodeOptions & {
  beforeSend: (evento: ErrorEvent) => ErrorEvent;
  beforeBreadcrumb: (migalha: Breadcrumb) => Breadcrumb;
} {
  return { beforeSend: limparEvento, beforeBreadcrumb: limparMigalha };
}

export function iniciarSentry(_env: NodeJS.ProcessEnv = process.env): boolean {
  return true;
}

export function capturarErroNoSentry(_erro: unknown): void {}

export async function fecharSentry(): Promise<void> {}
