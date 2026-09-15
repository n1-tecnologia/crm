"use client";

import { useData } from "@/dados/store";
import { RecordList } from "@/features/shell/record-list";
import { CorpoDeTela, PageHeader, StateSeal } from "@/features/shell/ui";

export default function HabilidadesPage() {
  const state = useData((data) => data);
  const items = state.skills.filter((s) => s.lifecycle !== "naLixeira");

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Habilidades" meta={`${items.length} ${items.length === 1 ? "Habilidade" : "Habilidades"}`} />
      <CorpoDeTela semRespiro>
        <RecordList
          items={items}
          hrefOf={(item) => `/ia/habilidades/${item.id}`}
          emptyTitle="Nenhuma Habilidade."
          emptyHint="Agentes funcionam sem elas, apenas com instruções, Ferramentas e Conhecimento."
          columns={[
            { key: "nome", label: "Nome", render: (item) => item.name },
            { key: "pertencimento", label: "Pertencimento", render: (item) => item.ownership === "plataforma" ? "plataforma" : "Espaço de Trabalho" },
            { key: "versao", label: "Versão corrente", render: (item) => [...item.versions].reverse().find((v) => v.state === "publicada")?.number ?? "—" },
            { key: "agentes", label: "Agentes com Concessão", render: (item) => state.skillGrants.filter((g) => g.skillId === item.id).length },
            { key: "estado", label: "Estado", render: (item) => <StateSeal state={item.lifecycle} /> },
          ]}
        />
      </CorpoDeTela>
    </div>
  );
}
