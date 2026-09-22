"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/dados/store";
import { CreateRecordDialog, useCreateRecordDialog } from "@/features/crm/create-record-dialog";
import { EmpresaPopup } from "@/features/crm/empresa-popup";
import { RecordList } from "@/features/shell/record-list";
import { Button, CorpoDeTela, PageHeader, StateSeal } from "@/features/shell/ui";

/** A Empresa escolhida abre no popup, por `?empresa=<id>` — a lista fica atrás. */
const EMPRESA_PARAM = "empresa";

export default function EmpresasPage() {
  const state = useData((data) => data);
  const items = state.companies.filter((c) => c.lifecycle !== "naLixeira" && c.lifecycle !== "mesclado");
  const { creating, openCreate, closeCreate } = useCreateRecordDialog("empresa");
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const aberta = query.get(EMPRESA_PARAM);
  const fechar = () => {
    const next = new URLSearchParams(query.toString());
    next.delete(EMPRESA_PARAM);
    router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Empresas"
        meta={`${items.length} Empresas`}
        actions={<Button onClick={openCreate}>Nova Empresa</Button>}
      />

      <CreateRecordDialog
        family="empresa"
        open={creating}
        onClose={closeCreate}
        onCreated={(rota) => router.push(rota)}
      />

      <CorpoDeTela semRespiro>
        <RecordList
          items={items}
          // A ficha no formato da Tarefa, num popup sobre a lista; a página
          // cheia continua a um clique no rodapé dele.
          hrefOf={(item) => `${pathname}?${EMPRESA_PARAM}=${item.id}`}
          emptyTitle="Nenhuma Empresa ainda."
          columns={[
            { key: "nome", label: "Nome de exibição", render: (item) => item.tradeName || item.legalName },
            { key: "dominio", label: "Domínio", render: (item) => item.identifiers.find((i) => i.type === "dominio")?.value ?? "—" },
            { key: "matriz", label: "Empresa matriz", render: (item) => state.companies.find((c) => c.id === item.parentCompanyId)?.tradeName ?? "—" },
            { key: "negocios", label: "Negócios", render: (item) => state.deals.filter((d) => d.companyId === item.id).length },
            { key: "proprietario", label: "Proprietário", render: (item) => state.members.find((m) => m.id === item.ownerMemberId)?.displayName ?? "—" },
            { key: "estado", label: "Estado", render: (item) => <StateSeal state={item.lifecycle} /> },
          ]}
        />
      </CorpoDeTela>

      <EmpresaPopup companyId={aberta} onClose={fechar} />
    </div>
  );
}
