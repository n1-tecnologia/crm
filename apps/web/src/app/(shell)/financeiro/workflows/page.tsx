/**
 * `/financeiro/workflows` — catálogo e histórico de execuções (UI-SPEC §6).
 */

import { BotaoAtualizar } from "@/features/financeiro/componentes/botao-atualizar";
import { MolduraDeLeitura } from "@/features/financeiro/componentes/moldura-de-leitura";
import { PainelDeWorkflows } from "@/features/financeiro/componentes/painel-de-workflows";
import { lerWorkflows } from "@/features/financeiro/dados/workflows";
import { CorpoDeTela, PageHeader } from "@/features/shell/ui";

export default async function WorkflowsPage() {
  const leitura = await lerWorkflows();

  return (
    <div className="flex h-full flex-col">
      <MolduraDeLeitura leitura={leitura}>
        {(dados, lidoEm) => (
          <>
            <PageHeader
              title="Workflows"
              meta={dados.catalogo.length}
              actions={<BotaoAtualizar lidoEm={lidoEm} />}
            />
            <CorpoDeTela>
              <PainelDeWorkflows catalogo={dados.catalogo} historico={dados.historico} />
            </CorpoDeTela>
          </>
        )}
      </MolduraDeLeitura>
    </div>
  );
}
