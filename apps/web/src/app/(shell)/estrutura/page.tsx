"use client";

import { useData, useSession } from "@/dados/store";
import { memberReachesContainer } from "@n1/dominio/derive";
import { CorpoDeTela, PageHeader, StateSeal } from "@/features/shell/ui";
import { RecordList } from "@/features/shell/record-list";

export default function EspacosPage() {
  const state = useData((data) => data);
  const { memberId } = useSession();
  // B38 — um Espaço privado sem concessão não existe para quem não o alcança.
  const items = state.spaces
    .filter((s) => s.lifecycle !== "naLixeira" && memberReachesContainer(state, memberId, "space", s.id))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Espaços" meta={`${items.length} ${items.length === 1 ? "Espaço" : "Espaços"}`} />
      <CorpoDeTela semRespiro>
        <RecordList
          items={items}
          hrefOf={(item) => `/estrutura/espacos/${item.id}`}
          emptyTitle="Nenhum Espaço ainda."
          emptyHint="Um Espaço delimita uma área de trabalho com status, campos e permissões próprios."
          columns={[
            { key: "name", label: "Nome", render: (item) => item.name },
            { key: "descricao", label: "Descrição", render: (item) => item.description ?? "—" },
            { key: "pastas", label: "Pastas", render: (item) => state.folders.filter((f) => f.parentId === item.id && f.lifecycle === "ativo").length },
            { key: "listas", label: "Listas diretas", render: (item) => state.lists.filter((l) => l.parentId === item.id && l.lifecycle === "ativo").length },
            { key: "privado", label: "Privado", render: (item) => item.isPrivate ? "sim" : "não" },
            { key: "estado", label: "Estado", render: (item) => <StateSeal state={item.lifecycle} /> },
          ]}
        />
      </CorpoDeTela>
    </div>
  );
}
