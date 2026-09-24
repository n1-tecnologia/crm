/**
 * Plano de contas (D4-10) — a tela mais importante das oito:
 * `conciliador_contas`, a MESMA tabela que o Agente consulta para
 * classificar a próxima conta a pagar. A rota do `apps/api` filtra por
 * `?empresa=&tipo=` (D4-09); sem uma Empresa escolhida esta página nunca
 * chama a leitura com `empresa` vazio nem inventa `"tria"` como padrão
 * silencioso — mostra a tela com o filtro já visível e um `EmptyState`
 * pedindo a escolha, decisão que `TabelaDoPlanoDeContas` sabe renderizar
 * quando `linhas` chega `null`.
 */

import { MolduraDeLeitura } from "@/features/financeiro/componentes/moldura-de-leitura";
import { TabelaDoPlanoDeContas } from "@/features/financeiro/componentes/tabela-do-plano-de-contas";
import { lerPlanoDeContas } from "@/features/financeiro/dados/plano-contas";

export default async function PlanoContasPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly empresa?: string; readonly tipo?: string }>;
}) {
  const { empresa, tipo } = await searchParams;

  if (!empresa) {
    return (
      <div className="flex h-full flex-col">
        <TabelaDoPlanoDeContas linhas={null} lidoEm={null} />
      </div>
    );
  }

  const leitura = await lerPlanoDeContas(empresa, tipo ?? "");

  return (
    <div className="flex h-full flex-col">
      <MolduraDeLeitura leitura={leitura}>
        {(linhas, lidoEm) => <TabelaDoPlanoDeContas linhas={linhas} lidoEm={lidoEm} />}
      </MolduraDeLeitura>
    </div>
  );
}
