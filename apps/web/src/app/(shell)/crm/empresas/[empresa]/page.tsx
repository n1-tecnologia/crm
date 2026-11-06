"use client";

/**
 * T15 — Empresa (a ficha nova, D-04).
 *
 * Lê `GET /empresas/:id` por `useEmpresa` e desenha `FichaDeEmpresa`. Em Next
 * 16 `params` é uma Promise: Client Component a lê com `use(params)`.
 *
 * Sem recuo (UCR-06): a api responde 404 para um id que ela não conhece e isso é
 * "não encontrada", mesmo que o id exista no modelo antigo. Não há ponte de id
 * antigo para id novo; a migração preserva os ids, então depois dela o mesmo
 * endereço abre a ficha nova.
 */

import { use } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useEmpresa } from "@/dados/crm/empresas";
import { FichaDeEmpresa } from "@/features/crm/ficha-de-empresa";
import { CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader } from "@/features/shell/ui";

export default function EmpresaPage({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = use(params);
  const { data, error } = useEmpresa(empresa);

  // 404 antes de tudo: uma Empresa excluída de vez em outro lugar não pode seguir aparecendo com o dado velho do cache.
  if (error instanceof ErroDeApi && error.status === 404) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Empresa" />
        <CorpoDeTela>
          <EmptyState title="Empresa não encontrada." hint="Ela pode ter sido excluída permanentemente." />
        </CorpoDeTela>
      </div>
    );
  }

  if (data) return <FichaDeEmpresa empresaId={empresa} detalhado={data} modo="pagina" />;

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Empresa" />
        <CorpoDeTela>
          <EmptyState
            title="Não foi possível abrir a Empresa."
            hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."}
          />
        </CorpoDeTela>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Empresa" />
      <CorpoDeTela>
        <EsqueletoDeLinhas quantidade={8} />
      </CorpoDeTela>
    </div>
  );
}
