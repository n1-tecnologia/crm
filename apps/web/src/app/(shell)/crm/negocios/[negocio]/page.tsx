"use client";

/**
 * T18 — Negócio (a ficha nova, D-04).
 *
 * Lê `GET /negocios/:id` por `useNegocio` e desenha `FichaDeNegocio`. Em Next
 * 16 `params` é uma Promise: Client Component a lê com `use(params)`.
 *
 * Recuo (D-15): a api responde 404 para um id que ela não conhece. Se esse id
 * existe no modelo antigo (`state.deals`), a tela antiga (`DealScreen`) abre
 * intacta — Busca, Lixeira antiga, Caixa de Entrada e Reuniões ainda produzem
 * esses ids, e a Lista conversacional segue usando a `DealScreen` embutida.
 * 404 sem registro antigo é "não encontrado".
 */

import { use } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useNegocio } from "@/dados/crm/negocios";
import { useData } from "@/dados/store";
import { DealScreen } from "@/features/crm/deal-screen";
import { FichaDeNegocio } from "@/features/crm/ficha-de-negocio";
import { CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader } from "@/features/shell/ui";

export default function NegocioPage({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = use(params);
  const { data, error } = useNegocio(negocio);
  const noModeloAntigo = useData((estado) => estado.deals.some((d) => d.id === negocio));

  // 404 antes de tudo: um Negócio excluído de vez em outro lugar não pode seguir aparecendo com o dado velho do cache.
  if (error instanceof ErroDeApi && error.status === 404) {
    if (noModeloAntigo) return <DealScreen dealId={negocio} />;
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Negócio" />
        <CorpoDeTela>
          <EmptyState title="Negócio não encontrado." hint="Ele pode ter sido excluído permanentemente." />
        </CorpoDeTela>
      </div>
    );
  }

  if (data) return <FichaDeNegocio negocioId={negocio} detalhado={data} />;

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Negócio" />
        <CorpoDeTela>
          <EmptyState title="Não foi possível abrir o Negócio." hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."} />
        </CorpoDeTela>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Negócio" />
      <CorpoDeTela>
        <EsqueletoDeLinhas quantidade={8} />
      </CorpoDeTela>
    </div>
  );
}
