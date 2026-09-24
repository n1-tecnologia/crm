import "server-only";

/**
 * O tipo que o `apps/api` devolve para Notas fiscais (D4-04), espelhando
 * `NotaFiscalDto` de `financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts`
 * (04-01) campo a campo — declarado AQUI, não importado do outro repositório
 * (D4-04: `apps/api` não lê o schema `public`, e este repositório não
 * importa do `financeiro-tria`).
 *
 * É esta tela, junto com Produtos, que fecha D4-04 de verdade: hoje o
 * navegador lê `transacoes` (~1.987 linhas) direto do Supabase com a chave
 * `anon`, expondo `api_key`/`app_secret`/`cpf_cnpj`/`telefone`/endereço em
 * cada linha. Esta leitura nunca toca esse caminho — só o `apps/api`, que já
 * projeta a allowlist positiva (04-05).
 */

import { lerDoFinanceiro, type Leitura } from "./leitura";

export type NotaFiscal = {
  readonly id: string;
  readonly idPedido: string | null;
  readonly cliente: string | null;
  readonly produtos: string | null;
  readonly valorTotal: number | null;
  readonly formaPagamento: string | null;
  readonly statusPedido: string | null;
  readonly controleEmissao: boolean;
  readonly emissaoNotaProduto: boolean;
  readonly emissaoNotaServico: boolean;
  readonly notaCancelamento: boolean;
  readonly seteDias: boolean;
  readonly aprovadoEm: string | null;
};

export function lerNotasFiscais(): Promise<Leitura<readonly NotaFiscal[]>> {
  return lerDoFinanceiro<readonly NotaFiscal[]>("/financeiro/notas-fiscais");
}
