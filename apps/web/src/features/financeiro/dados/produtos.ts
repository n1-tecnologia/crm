import "server-only";

/**
 * O tipo que o `apps/api` devolve para Produtos (D4-04), espelhando
 * `ProdutoDto` de `financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts`
 * (04-01) campo a campo — declarado AQUI, não importado do outro
 * repositório. Junto com Notas fiscais, é a segunda das duas telas que hoje
 * o navegador lê direto do Supabase com a chave `anon`; esta leitura nunca
 * toca esse caminho.
 */

import { lerDoFinanceiro, type Leitura } from "./leitura";

export type Produto = {
  readonly id: string;
  readonly idProduto: string;
  readonly nomeProduto: string | null;
  readonly porcentagemProduto: string | null;
  readonly porcentagemServico: string | null;
};

export function lerProdutos(): Promise<Leitura<readonly Produto[]>> {
  return lerDoFinanceiro<readonly Produto[]>("/financeiro/produtos");
}
