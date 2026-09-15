"use client";

import { useData } from "@/dados/store";
import { RESOURCE_TYPE_LABEL } from "@/features/shell/format";
import { RecordList } from "@/features/shell/record-list";
import { CorpoDeTela, PageHeader, StateSeal } from "@/features/shell/ui";

export default function AutomacoesPage() {
  const state = useData((data) => data);
  const items = state.automations.filter((a) => a.lifecycle !== "naLixeira");

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Automações" meta={`${items.length} ${items.length === 1 ? "Automação" : "Automações"}`} />
      <CorpoDeTela semRespiro>
        <RecordList
          items={items}
          hrefOf={(item) => `/ia/automacoes/${item.id}`}
          emptyTitle="Nenhuma Automação."
          emptyHint="Uma Automação reage a um Gatilho, avalia Condições e executa Ações."
          columns={[
            { key: "nome", label: "Nome", render: (item) => item.name },
            { key: "escopo", label: "Escopo", render: (item) => RESOURCE_TYPE_LABEL[item.scopeType] ?? item.scopeType },
            { key: "natureza", label: "Natureza", render: (item) => item.versions.some((v) => v.conditions.some((c) => c.kind === "hibrida")) ? "híbrida" : "determinística" },
            { key: "proprietario", label: "Proprietário", render: (item) => state.members.find((m) => m.id === item.ownerMemberId)?.displayName ?? "—" },
            { key: "estado", label: "Estado", render: (item) => <StateSeal state={item.lifecycle} /> },
          ]}
        />
      </CorpoDeTela>
    </div>
  );
}
