/**
 * Produtos — a segunda das duas telas que hoje o navegador lê direto do
 * Supabase com a chave `anon` (D4-04). 42 linhas, sem filtro; a única
 * escrita é a edição inline das duas alíquotas (D4-07).
 */

import { MolduraDeLeitura } from "@/features/financeiro/componentes/moldura-de-leitura";
import { TabelaDeProdutos } from "@/features/financeiro/componentes/tabela-de-produtos";
import { lerProdutos } from "@/features/financeiro/dados/produtos";

export default async function ProdutosPage() {
  const leitura = await lerProdutos();

  return (
    <div className="flex h-full flex-col">
      <MolduraDeLeitura leitura={leitura}>
        {(produtos, lidoEm) => <TabelaDeProdutos produtos={produtos} lidoEm={lidoEm} />}
      </MolduraDeLeitura>
    </div>
  );
}
