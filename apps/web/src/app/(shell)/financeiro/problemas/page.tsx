/**
 * `/financeiro/problemas` (UI-SPEC §7). `searchParams` é uma Promise no
 * Next 16.
 */

import { BotaoAtualizar } from "@/features/financeiro/componentes/botao-atualizar";
import { MolduraDeLeitura } from "@/features/financeiro/componentes/moldura-de-leitura";
import { TabelaDeProblemas } from "@/features/financeiro/componentes/tabela-de-problemas";
import { lerProblemas } from "@/features/financeiro/dados/problemas";
import { CorpoDeTela, PageHeader } from "@/features/shell/ui";

export default async function ProblemasPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly empresa?: string }>;
}) {
  const { empresa } = await searchParams;
  const leitura = await lerProblemas(empresa);

  return (
    <div className="flex h-full flex-col">
      <MolduraDeLeitura leitura={leitura}>
        {(dados, lidoEm) => (
          <>
            <PageHeader
              title="Problemas"
              meta={dados.linhas.length}
              actions={<BotaoAtualizar lidoEm={lidoEm} />}
            />
            <CorpoDeTela>
              <TabelaDeProblemas linhas={dados.linhas} />
            </CorpoDeTela>
          </>
        )}
      </MolduraDeLeitura>
    </div>
  );
}
