"use client";

/**
 * Funil (a ficha, D-04).
 *
 * Lê `GET /funis/:id` por `useFunil` e desenha `FichaDeFunil`. Em Next 16
 * `params` é uma Promise: Client Component a lê com `use(params)`.
 *
 * Funis do cadastro anterior (modelo em memória) não têm recuo de ficha: só a
 * ficha antiga de Negócio e o editor de Automação apontam para esses ids, e o
 * 404 da api cai em "Funil não encontrado" com a explicação (D-15).
 */

import { use } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useFunil } from "@/dados/crm/funis";
import { FichaDeFunil } from "@/features/crm/ficha-de-funil";
import { CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader } from "@/features/shell/ui";

export default function FunilPage({ params }: { params: Promise<{ funil: string }> }) {
  const { funil } = use(params);
  const { data, error } = useFunil(funil);

  // 404 antes de tudo: um Funil excluído de vez em outro lugar não pode seguir aparecendo com o dado velho do cache.
  if (error instanceof ErroDeApi && error.status === 404) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Funil" />
        <CorpoDeTela>
          <EmptyState
            title="Funil não encontrado."
            hint="Pode ter sido excluído permanentemente, ou ser um Funil do cadastro anterior, que ainda não aparece aqui."
          />
        </CorpoDeTela>
      </div>
    );
  }

  if (data) return <FichaDeFunil funilId={funil} detalhado={data} />;

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Funil" />
        <CorpoDeTela>
          <EmptyState
            title="Não foi possível abrir o Funil."
            hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."}
          />
        </CorpoDeTela>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Funil" />
      <CorpoDeTela>
        <EsqueletoDeLinhas quantidade={8} />
      </CorpoDeTela>
    </div>
  );
}
