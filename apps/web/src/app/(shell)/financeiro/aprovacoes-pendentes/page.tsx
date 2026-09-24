/**
 * `/financeiro/aprovacoes-pendentes` — a vista legada (D4-11, UI-SPEC §8).
 * `searchParams` é uma Promise no Next 16.
 */

import Link from "next/link";
import { BotaoAtualizar } from "@/features/financeiro/componentes/botao-atualizar";
import { MolduraDeLeitura } from "@/features/financeiro/componentes/moldura-de-leitura";
import { TabelaDeAprovacoes } from "@/features/financeiro/componentes/tabela-de-aprovacoes";
import { lerAprovacoesPendentes } from "@/features/financeiro/dados/aprovacoes-pendentes";
import { CorpoDeTela, PageHeader, Pilula } from "@/features/shell/ui";

export default async function AprovacoesPendentesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly empresa?: string }>;
}) {
  const { empresa } = await searchParams;
  const leitura = await lerAprovacoesPendentes(empresa);

  return (
    <div className="flex h-full flex-col">
      <MolduraDeLeitura leitura={leitura}>
        {(dados, lidoEm) => (
          <>
            <PageHeader
              title="Aprovações pendentes"
              meta={dados.linhas.length}
              seal={
                <Pilula tom="neutro" contorno>
                  Vista legada
                </Pilula>
              }
              details={
                <span className="app-meta">
                  Lista somente leitura: reflete o campo Aprovado da base antiga. Quem decide
                  aprovações hoje é a fila viva —{" "}
                  <Link href="/ia/aprovacoes" className="underline" style={{ color: "var(--acento)" }}>
                    Ir para Aprovações
                  </Link>
                  .
                </span>
              }
              actions={<BotaoAtualizar lidoEm={lidoEm} />}
            />
            <CorpoDeTela>
              <TabelaDeAprovacoes linhas={dados.linhas} />
            </CorpoDeTela>
          </>
        )}
      </MolduraDeLeitura>
    </div>
  );
}
