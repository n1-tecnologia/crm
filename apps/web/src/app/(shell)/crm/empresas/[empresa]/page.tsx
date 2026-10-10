"use client";

/**
 * T15 — Empresa (a ficha nova, D-04).
 *
 * Lê `GET /empresas/:id` por `useEmpresa` e desenha `FichaDeEmpresa`. Em Next
 * 16 `params` é uma Promise: Client Component a lê com `use(params)`.
 *
 * Recuo (D-15): a api responde 404 para um id que ela não conhece. Se esse id
 * existe no modelo antigo (`state.companies`), a ficha antiga abre intacta —
 * Busca, Lixeira antiga e Tarefas ainda produzem esses ids. 404 sem registro
 * antigo é "não encontrada".
 */

import { use } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useEmpresa } from "@/dados/crm/empresas";
import { useData } from "@/dados/store";
import { FichaDeEmpresa } from "@/features/crm/ficha-de-empresa";
import { FichaDeEmpresaLegado } from "@/features/crm/legado/ficha-de-empresa-legado";
import { CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader } from "@/features/shell/ui";

export default function EmpresaPage({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = use(params);
  const { data, error } = useEmpresa(empresa);
  const noModeloAntigo = useData((estado) => estado.companies.some((c) => c.id === empresa));

  // 404 antes de tudo: uma Empresa excluída de vez em outro lugar não pode seguir aparecendo com o dado velho do cache.
  if (error instanceof ErroDeApi && error.status === 404) {
    if (noModeloAntigo) return <FichaDeEmpresaLegado empresaId={empresa} />;
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
