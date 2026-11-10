"use client";

/**
 * T18 — Negócio (a ficha nova, D-04).
 *
 * Lê `GET /negocios/:id` por `useNegocio` e desenha `FichaDeNegocio`. Em Next
 * 16 `params` é uma Promise: Client Component a lê com `use(params)`.
 *
 * Sem recuo (UCR-06): a api responde 404 para um id que ela não conhece e isso é
 * "não encontrado", mesmo que o id exista no modelo antigo. Não há ponte de id
 * antigo para id novo; a migração preserva os ids, então depois dela o mesmo
 * endereço abre a ficha nova.
 */

import { use } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useNegocio } from "@/dados/crm/negocios";
import { FichaDeNegocio } from "@/features/crm/ficha-de-negocio";
import { CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader } from "@/features/shell/ui";

export default function NegocioPage({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = use(params);
  const { data, error } = useNegocio(negocio);

  // 404 antes de tudo: um Negócio excluído de vez em outro lugar não pode seguir aparecendo com o dado velho do cache.
  if (error instanceof ErroDeApi && error.status === 404) {
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
