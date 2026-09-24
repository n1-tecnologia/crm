/**
 * Notas fiscais — a tabela mais sensível da migração (~1.987 linhas, D4-04):
 * hoje o navegador lê `transacoes` direto do Supabase com a chave `anon`;
 * esta rota lê só o que `apps/api` já projeta (04-05).
 */

import { MolduraDeLeitura } from "@/features/financeiro/componentes/moldura-de-leitura";
import { TabelaDeNotasFiscais } from "@/features/financeiro/componentes/tabela-de-notas-fiscais";
import { lerNotasFiscais } from "@/features/financeiro/dados/notas-fiscais";

export default async function NotasFiscaisPage() {
  const leitura = await lerNotasFiscais();

  return (
    <div className="flex h-full flex-col">
      <MolduraDeLeitura leitura={leitura}>
        {(notas, lidoEm) => <TabelaDeNotasFiscais notas={notas} lidoEm={lidoEm} />}
      </MolduraDeLeitura>
    </div>
  );
}
