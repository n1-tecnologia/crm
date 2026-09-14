"use client";

import { use } from "react";
import { useData } from "@/data/store";
import {
  CabecalhoDePainel,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Painel,
  RecordPanel,
  StateSeal,
} from "@/features/shell/ui";

export default function HabilidadePage({ params }: { params: Promise<{ habilidade: string }> }) {
  const { habilidade } = use(params);
  const state = useData((data) => data);
  const record = state.skills.find((s) => s.id === habilidade);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Habilidade não encontrada." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const concessoes = state.skillGrants.filter((g) => g.skillId === record.id);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={record.name} seal={<StateSeal state={record.lifecycle} />} />
      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ------------------------------------------------ coluna principal */}
          <div className="grid content-start gap-3">
            <Painel>
              <CabecalhoDePainel titulo="Versões" contagem={record.versions.length} />
              <div className="p-3">
                <ul className="pilha-solta">
                  {record.versions.map((version) => (
                    <li key={version.number} className="item-solto" data-bloco="true" data-estatico="true">
                      <div className="flex items-center justify-between gap-2">
                        <span className="app-md" style={{ color: "var(--texto)" }}>
                          Versão {version.number}
                        </span>
                        <span className="app-meta">{version.state}</span>
                      </div>
                      <p className="app-base mt-1" style={{ color: "var(--texto-1)" }}>
                        {version.instructions}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </Painel>
          </div>

          {/* ------------------------------------------------ coluna lateral */}
          <div className="grid content-start gap-3">
            <RecordPanel title="Agentes com Concessão" count={concessoes.length}>
              {concessoes.length === 0 ? (
                <EmptyState compact title="Nenhum Agente tem esta Habilidade concedida." />
              ) : (
                <ul className="pilha-solta">
                  {concessoes.map((grant) => (
                    <li key={grant.id} className="item-solto" data-estatico="true">
                      <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                        {state.agents.find((a) => a.id === grant.agentId)?.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
