"use client";

import { use } from "react";
import { useData } from "@/dados/store";
import { PROCESSING_LABEL, SOURCE_KIND_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
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

export default function DocumentoPage({ params }: { params: Promise<{ documento: string }> }) {
  const { documento } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();
  const record = state.documents.find((d) => d.id === documento);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Documento não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const corrente = record.versions.find((v) => v.number === record.currentVersion);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={record.title} seal={<StateSeal state={record.lifecycle} />} />
      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ------------------------------------------------ coluna principal */}
          <div className="grid content-start gap-3">
            <Painel>
              <CabecalhoDePainel titulo="Conteúdo da Versão corrente" />
              <div className="p-4">
                <p className="app-base" style={{ color: "var(--texto)" }}>
                  {corrente?.content.text ?? "—"}
                </p>
                <p className="app-meta mt-2">
                  Estado de processamento: {corrente?.processing ? (PROCESSING_LABEL[corrente.processing] ?? corrente.processing) : "—"}
                </p>
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Versões" contagem={record.versions.length} />
              <div className="p-3">
                <ul className="pilha-solta">
                  {record.versions.map((version) => (
                    <li
                      key={version.number}
                      className="item-solto"
                      data-estatico="true"
                      data-destacado={version.number === record.currentVersion ? "true" : undefined}
                    >
                      <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                        Versão {version.number} · origem: {SOURCE_KIND_LABEL[version.origin.kind] ?? version.origin.kind}
                      </span>
                      {version.number === record.currentVersion ? <span className="app-meta shrink-0">corrente</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Comentários" contagem={record.comments.length} />
              <div className="p-3">
                {record.comments.length === 0 ? (
                  <EmptyState compact title="Nenhum Comentário neste Documento." />
                ) : (
                  <ul className="pilha-solta">
                    {record.comments.map((comment) => (
                      <li key={comment.id} className="item-solto" data-bloco="true" data-estatico="true">
                        <p className="app-meta app-numero">{fmt.instant(comment.createdAt)}</p>
                        <p className="app-base mt-1" style={{ color: "var(--texto)" }}>
                          {comment.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>
          </div>

          {/* ------------------------------------------------ coluna lateral */}
          <div className="grid content-start gap-3">
            <RecordPanel title="Proveniência">
              <dl>
                <RecordRow label="Coleção">{state.collections.find((c) => c.id === record.collectionId)?.name ?? "—"}</RecordRow>
              </dl>
              <p className="app-base mt-2" style={{ color: "var(--texto)" }}>
                {record.provenance.sourceName} · {record.provenance.specificOrigin}
              </p>
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
