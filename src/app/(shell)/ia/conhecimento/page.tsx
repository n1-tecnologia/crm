"use client";

import { useData } from "@/data/store";
import { RecordList } from "@/features/shell/record-list";
import { CorpoDeTela, PageHeader, StateSeal } from "@/features/shell/ui";

export default function ConhecimentoPage() {
  const state = useData((data) => data);
  const items = state.collections.filter((c) => c.lifecycle !== "naLixeira");

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Conhecimento" meta={`${items.length} ${items.length === 1 ? "Coleção" : "Coleções"}`} />
      <CorpoDeTela semRespiro>
        <RecordList
          items={items}
          hrefOf={(item) => `/ia/conhecimento/${item.id}`}
          emptyTitle="Nenhuma Coleção."
          emptyHint="Conhecimento é conteúdo curado que Agentes consultam — Tarefas, Contatos e Negócios não são Conhecimento."
          columns={[
            { key: "nome", label: "Nome", render: (item) => item.name },
            { key: "proprietario", label: "Proprietário", render: (item) => state.members.find((m) => m.id === item.ownerMemberId)?.displayName ?? "—" },
            { key: "privada", label: "Privada", render: (item) => item.isPrivate ? "sim" : "não" },
            { key: "documentos", label: "Documentos", render: (item) => state.documents.filter((d) => d.collectionId === item.id && d.lifecycle !== "naLixeira").length },
            { key: "fontes", label: "Fontes", render: (item) => item.sources.length },
            { key: "estado", label: "Estado", render: (item) => <StateSeal state={item.lifecycle} /> },
          ]}
        />
      </CorpoDeTela>
    </div>
  );
}
