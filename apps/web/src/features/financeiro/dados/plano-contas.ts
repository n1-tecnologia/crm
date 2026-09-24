import "server-only";

/**
 * O tipo que o `apps/api` devolve para Plano de contas (D4-04/D4-10),
 * espelhando `LinhaDoPlanoDeContasDto` de
 * `financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts` (04-01):
 * `{ id, conteudo }` — a projeção de `conciliador_contas`, que já seleciona
 * só `id, content` na rota legada. Sem edição nem criação avulsa (decisão do
 * produto): plano só entra por upload, e nas linhas só dá pra apagar.
 *
 * A rota do `apps/api` filtra por `?empresa=&tipo=` (D4-09), que vira
 * `metadata @> {empresa, tipo}` do lado do `automation/`. Sem uma Empresa
 * escolhida a tela não tem o que pedir: esta função nunca é chamada com
 * `empresa` vazio (a decisão é do `page.tsx`, que mostra um `EmptyState`
 * pedindo a escolha em vez de inventar `"tria"` como padrão silencioso).
 */

import { lerDoFinanceiro, type Leitura } from "./leitura";

export type LinhaDoPlanoDeContas = {
  readonly id: string;
  readonly conteudo: string;
};

export function lerPlanoDeContas(empresa: string, tipo: string): Promise<Leitura<readonly LinhaDoPlanoDeContas[]>> {
  return lerDoFinanceiro<readonly LinhaDoPlanoDeContas[]>("/financeiro/plano-contas", { empresa, tipo });
}
