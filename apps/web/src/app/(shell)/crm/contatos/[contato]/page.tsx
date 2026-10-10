"use client";

/**
 * T14 — Contato (a ficha nova, D-04).
 *
 * Lê `GET /contatos/:id` por `useContato` e desenha `FichaDeContato`. Em Next
 * 16 `params` é uma Promise: Client Component a lê com `use(params)`.
 *
 * Recuo (D-15): a api responde 404 para um id que ela não conhece. Se esse id
 * existe no modelo antigo (`state.contacts`), a tela antiga abre intacta —
 * Busca, Lixeira antiga, Caixa de Entrada e Reuniões ainda produzem esses ids.
 * 404 sem registro antigo é "não encontrado".
 */

import { use } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useContato } from "@/dados/crm/contatos";
import { useData } from "@/dados/store";
import { FichaDeContato } from "@/features/crm/ficha-de-contato";
import { FichaDeContatoLegado } from "@/features/crm/legado/ficha-de-contato-legado";
import { CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader } from "@/features/shell/ui";

export default function ContatoPage({ params }: { params: Promise<{ contato: string }> }) {
  const { contato } = use(params);
  const { data, error } = useContato(contato);
  const noModeloAntigo = useData((estado) => estado.contacts.some((c) => c.id === contato));

  // 404 antes de tudo: um Contato excluído de vez em outro lugar não pode seguir aparecendo com o dado velho do cache.
  if (error instanceof ErroDeApi && error.status === 404) {
    if (noModeloAntigo) return <FichaDeContatoLegado contatoId={contato} />;
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Contato" />
        <CorpoDeTela>
          <EmptyState title="Contato não encontrado." hint="Ele pode ter sido excluído permanentemente." />
        </CorpoDeTela>
      </div>
    );
  }

  if (data) return <FichaDeContato contatoId={contato} detalhado={data} />;

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Contato" />
        <CorpoDeTela>
          <EmptyState
            title="Não foi possível abrir o Contato."
            hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."}
          />
        </CorpoDeTela>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Contato" />
      <CorpoDeTela>
        <EsqueletoDeLinhas quantidade={8} />
      </CorpoDeTela>
    </div>
  );
}
