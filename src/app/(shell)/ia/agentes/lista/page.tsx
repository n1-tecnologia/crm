"use client";

import { useData } from "@/data/store";
import { RecordList } from "@/features/shell/record-list";
import { CorpoDeTela, PageHeader, StateSeal } from "@/features/shell/ui";

export default function AgentesPage() {
  const state = useData((data) => data);
  const items = state.agents.filter((a) => a.lifecycle !== "naLixeira");

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Agentes" meta={`${items.length} ${items.length === 1 ? "Agente" : "Agentes"}`} />
      <CorpoDeTela semRespiro>
        <RecordList
          items={items}
          hrefOf={(item) => `/ia/agentes/${item.id}`}
          emptyTitle="Nenhum Agente."
          emptyHint="Para criar um, use o Construtor em Agentes."
          columns={[
            { key: "nome", label: "Nome", render: (item) => item.name },
            { key: "descricao", label: "Descrição", render: (item) => item.description },
            { key: "autonomia", label: "Nível de autonomia", render: (item) => item.versions.at(-1)?.autonomy ?? "—" },
            { key: "proprietario", label: "Proprietário", render: (item) => state.members.find((m) => m.id === item.ownerMemberId)?.displayName ?? "—" },
            { key: "versao", label: "Versão corrente", render: (item) => item.versions.at(-1)?.number ?? 1 },
            { key: "estado", label: "Estado", render: (item) => <StateSeal state={item.lifecycle} /> },
          ]}
        />
      </CorpoDeTela>
    </div>
  );
}
