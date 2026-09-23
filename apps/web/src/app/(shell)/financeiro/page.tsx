/**
 * O Dashboard do Financeiro — raiz de `/financeiro` (D4-08). `searchParams`
 * é uma Promise no Next 16; `empresa` é o único filtro desta tela (D4-09, um
 * parâmetro de consulta, não um trocador de tenant).
 */

import { BotaoAtualizar } from "@/features/financeiro/componentes/botao-atualizar";
import { MolduraDeLeitura } from "@/features/financeiro/componentes/moldura-de-leitura";
import { PainelDoDashboard } from "@/features/financeiro/componentes/painel-do-dashboard";
import { lerDashboard } from "@/features/financeiro/dados/dashboard";
import { CorpoDeTela, PageHeader } from "@/features/shell/ui";

export default async function FinanceiroDashboardPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly empresa?: string }>;
}) {
  const { empresa } = await searchParams;
  const leitura = await lerDashboard(empresa);

  return (
    <div className="flex h-full flex-col">
      <MolduraDeLeitura leitura={leitura}>
        {(dashboard, lidoEm) => (
          <>
            <PageHeader title="Financeiro" actions={<BotaoAtualizar lidoEm={lidoEm} />} />
            <CorpoDeTela>
              <PainelDoDashboard dashboard={dashboard} />
            </CorpoDeTela>
          </>
        )}
      </MolduraDeLeitura>
    </div>
  );
}
