"use client";

/**
 * T14 — Contato (a ficha nova, D-04).
 *
 * Lê `GET /contatos/:id` por `useContato` e desenha `FichaDeContato`. Em Next
 * 16 `params` é uma Promise: Client Component a lê com `use(params)`.
 *
 * Sem recuo (UCR-06): a api responde 404 para um id que ela não conhece e isso é
 * "não encontrado", mesmo que o id exista no modelo antigo. Não há ponte de id
 * antigo para id novo; a migração preserva os ids, então depois dela o mesmo
 * endereço abre a ficha nova.
 *
 * Contato `mesclado` (RN-CON-14, 011): o absorvido é terminal e somente leitura. A
 * ficha dele não existe; quem chega por um link velho vai para o sobrevivente.
 */

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useContato } from "@/dados/crm/contatos";
import { FichaDeContato } from "@/features/crm/ficha-de-contato";
import { CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader } from "@/features/shell/ui";

export default function ContatoPage({ params }: { params: Promise<{ contato: string }> }) {
  const { contato } = use(params);
  const { data, error } = useContato(contato);
  const router = useRouter();
  const sobrevivente = data?.contato.estado === "mesclado" ? data.contato.mescladoEmId : null;

  useEffect(() => {
    if (sobrevivente) router.replace(`/crm/contatos/${sobrevivente}`);
  }, [sobrevivente, router]);

  // 404 antes de tudo: um Contato excluído de vez em outro lugar não pode seguir aparecendo com o dado velho do cache.
  if (error instanceof ErroDeApi && error.status === 404) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Contato" />
        <CorpoDeTela>
          <EmptyState title="Contato não encontrado." hint="Ele pode ter sido excluído permanentemente." />
        </CorpoDeTela>
      </div>
    );
  }

  if (sobrevivente) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Contato" />
        <CorpoDeTela>
          <EsqueletoDeLinhas quantidade={8} />
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
