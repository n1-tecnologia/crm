"use client";

import { useRouter } from "next/navigation";
import { useData } from "@/dados/store";
import { CreateRecordDialog, useCreateRecordDialog } from "@/features/crm/create-record-dialog";
import { Button, CorpoDeTela, PageHeader } from "@/features/shell/ui";
import { RecordList } from "@/features/shell/record-list";
import { StateSeal } from "@/features/shell/ui";

export default function EmpresasPage() {
  const state = useData((data) => data);
  const items = state.companies.filter((c) => c.lifecycle !== "naLixeira" && c.lifecycle !== "mesclado");
  const { creating, openCreate, closeCreate } = useCreateRecordDialog("empresa");
  const router = useRouter();

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
          hrefOf={(item) => `/crm/empresas/${item.id}`}
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
    </div>
  );
}
