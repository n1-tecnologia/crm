import "server-only";

/**
 * A leitura de `/financeiro/workflows` — o catálogo de Workflows do
 * `automation/` e o histórico das últimas execuções. Sem filtro de Empresa
 * (a rota do `apps/api` não aceita `?empresa=` aqui — Workflows não é uma
 * leitura por empresa).
 */

import { lerDoFinanceiro, type Leitura } from "./leitura";

export type WorkflowDoCatalogo = {
  readonly key: string;
  readonly nome: string;
  readonly descricao: string;
  readonly tenant: string;
  readonly gatilho: { readonly tipo: string; readonly detalhe?: string };
  readonly caminhoDeWebhook?: string;
  readonly passos: readonly string[];
  readonly executavelManualmente: boolean;
  readonly ultimaExecucao: { readonly status: string; readonly iniciadaEm: string; readonly finalizadaEm: string | null } | null;
};

export type ExecucaoDeWorkflow = {
  readonly id: string;
  readonly workflowKey: string;
  readonly workflowNome: string;
  readonly status: string;
  readonly iniciadaEm: string;
  readonly finalizadaEm: string | null;
};

export type WorkflowsFinanceiro = {
  readonly catalogo: ReadonlyArray<WorkflowDoCatalogo>;
  readonly historico: ReadonlyArray<ExecucaoDeWorkflow>;
};

export function lerWorkflows(): Promise<Leitura<WorkflowsFinanceiro>> {
  return lerDoFinanceiro<WorkflowsFinanceiro>("/financeiro/workflows");
}
