"use client";

import { useData } from "@/dados/store";
import { CorpoDeTela, PageHeader, StateSeal } from "@/features/shell/ui";
import { RecordList } from "@/features/shell/record-list";

export default function PaineisPage() {
  const state = useData((data) => data);
  const items = state.panels.filter((p) => p.lifecycle !== "naLixeira");

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Painéis" meta={`${items.length} ${items.length === 1 ? "Painel" : "Painéis"}`} />
      <CorpoDeTela semRespiro>
        <RecordList
          items={items}
          hrefOf={(item) => `/paineis/${item.id}`}
          emptyTitle="Nenhum Painel ainda."
          emptyHint="Um Painel lê as entidades com as permissões de quem o consulta e nunca guarda dados."
          columns={[
            { key: "nome", label: "Nome", render: (item) => item.name },
            { key: "ancora", label: "Âncora", render: (item) => item.anchor ? item.anchor.nameAtTheTime : "Painel do Espaço de Trabalho" },
            { key: "widgets", label: "Widgets", render: (item) => item.widgets.length },
            { key: "proprietario", label: "Proprietário", render: (item) => state.members.find((m) => m.id === item.ownerMemberId)?.displayName ?? "—" },
            { key: "estado", label: "Estado", render: (item) => <StateSeal state={item.lifecycle} /> },
          ]}
        />
      </CorpoDeTela>
    </div>
  );
}
