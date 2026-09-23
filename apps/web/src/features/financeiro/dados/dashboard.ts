import "server-only";

/**
 * Os tipos que o `apps/api` devolve para o Dashboard do Financeiro,
 * declarados AQUI — não importados de `automation/` (repositório diferente,
 * D4-04: `apps/api` não lê o schema `public`, nunca). A fonte da forma é o
 * contrato escrito em 04-07 (`GET /financeiro/dashboard`), não uma suposição
 * deste plano.
 *
 * Nenhum destes tipos ou `lerDashboard` toca os hooks do store zustand: a
 * leitura do Financeiro não entra no `DataState` (D4-15).
 */

import { lerDoFinanceiro, type Leitura } from "./leitura";

export type MetricaDoDashboard = {
  readonly chave: string;
  readonly rotulo: string;
  readonly valor: string;
  readonly auxiliar?: string;
  readonly tom?: string;
  readonly dica?: string;
};

export type ItemDeAtencao = {
  readonly id: string;
  readonly titulo: string;
  readonly severidade: "alta" | "media" | "baixa";
  readonly idade: string;
};

export type LinhaDeProblema = {
  readonly id: string;
  readonly titulo: string;
  readonly severidade: "alta" | "media" | "baixa";
  readonly idade: string;
};

export type DashboardFinanceiro = {
  readonly metricas: ReadonlyArray<MetricaDoDashboard>;
  readonly atencao: ReadonlyArray<ItemDeAtencao>;
  readonly problemas: ReadonlyArray<LinhaDeProblema>;
};

export function lerDashboard(empresa?: string): Promise<Leitura<DashboardFinanceiro>> {
  return lerDoFinanceiro<DashboardFinanceiro>("/financeiro/dashboard", { empresa });
}
