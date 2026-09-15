"use client";

import { useData } from "@/dados/store";
import { CorpoDeTela, PageHeader } from "@/features/shell/ui";
import { RecordList } from "@/features/shell/record-list";
import { StateSeal } from "@/features/shell/ui";

export default function FunisPage() {
  const state = useData((data) => data);
  const items = state.funnels.filter((f) => f.lifecycle !== "naLixeira");

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Funis" meta={`${items.length} ${items.length === 1 ? "Funil" : "Funis"}`} />
      <CorpoDeTela semRespiro>
        <RecordList
          items={items}
          hrefOf={(item) => `/crm/funis/${item.id}`}
          emptyTitle="Nenhum Funil."
          emptyHint="Um Funil é o processo de progressão que os Negócios percorrem."
          columns={[
            { key: "nome", label: "Nome", render: (item) => item.name },
            { key: "etapas", label: "Etapas", render: (item) => item.stages.length },
            { key: "padrao", label: "É o Funil padrão", render: (item) => state.workspace.defaultFunnelId === item.id ? "sim" : "não" },
            { key: "privado", label: "Privado", render: (item) => item.isPrivate ? "sim" : "não" },
            { key: "abertos", label: "Negócios abertos", render: (item) => state.deals.filter((d) => d.funnelId === item.id && d.situation === "aberto").length },
            { key: "estado", label: "Estado", render: (item) => <StateSeal state={item.lifecycle} /> },
          ]}
        />
      </CorpoDeTela>
    </div>
  );
}
