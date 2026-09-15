"use client";

import { use } from "react";
import { useData } from "@/dados/store";
import { LIFECYCLE_LABEL, SOURCE_KIND_LABEL } from "@/features/shell/format";
import {
  CabecalhoDePainel,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Painel,
  RecordPanel,
  RecordRow,
  StateSeal,
} from "@/features/shell/ui";
import Link from "next/link";

export default function ColecaoPage({ params }: { params: Promise<{ colecao: string }> }) {
  const { colecao } = use(params);
  const state = useData((data) => data);
  const record = state.collections.find((c) => c.id === colecao);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Coleção não encontrada." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const documentos = state.documents.filter((d) => d.collectionId === record.id);
  const concessoes = state.collectionGrants.filter((g) => g.collectionId === record.id);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={record.name} seal={<StateSeal state={record.lifecycle} />} />
      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ------------------------------------------------ coluna principal */}
          <div className="grid content-start gap-3">
            <Painel>
              <CabecalhoDePainel titulo="Documentos" contagem={documentos.length} />
              <div className="p-3">
                {documentos.length === 0 ? (
                  <EmptyState compact title="Nenhum Documento." hint="Envie um arquivo ou configure uma Fonte." />
                ) : (
                  <ul className="pilha-solta">
                    {documentos.map((document) => (
                      <li key={document.id}>
                        <Link href={`/ia/conhecimento/documentos/${document.id}`} className="item-solto">
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {document.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Fontes" contagem={record.sources.length} />
              <div className="p-3">
                <ul className="pilha-solta">
                  {record.sources.map((source) => (
                    <li key={source.id} className="item-solto" data-estatico="true">
                      <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                        {source.name}
                      </span>
                      <span className="app-meta shrink-0">
                        {SOURCE_KIND_LABEL[source.kind] ?? source.kind} · {LIFECYCLE_LABEL[source.state] ?? source.state}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Painel>
          </div>

          {/* ------------------------------------------------ coluna lateral */}
          <div className="grid content-start gap-3">
            <RecordPanel title="Acesso" count={concessoes.length}>
              <dl>
                <RecordRow label="Proprietário">{state.members.find((m) => m.id === record.ownerMemberId)?.displayName ?? "—"}</RecordRow>
                <RecordRow label="Privada">{record.isPrivate ? "sim" : "não"}</RecordRow>
              </dl>
              <p className="app-meta mt-2">
                A Coleção é o único Recurso de permissão do Conhecimento: Documento, Versão e Fragmento
                herdam e nunca têm permissão própria.
              </p>
              {concessoes.length === 0 ? (
                <EmptyState
                  compact
                  title="Nenhum Agente tem acesso a esta Coleção."
                  hint="Sem Concessão, nenhum Agente consulta os Documentos daqui."
                />
              ) : (
                <ul className="pilha-solta mt-3">
                  {concessoes.map((grant) => (
                    <li key={grant.id} className="item-solto" data-estatico="true">
                      <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                        {state.agents.find((a) => a.id === grant.agentId)?.name}
                      </span>
                      <span className="app-meta shrink-0">{grant.actions.join(", ")}</span>
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
