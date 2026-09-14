"use client";

import { use } from "react";
import Link from "next/link";
import { ExternalLink, Folder, LayoutDashboard, List, Settings } from "lucide-react";
import { useData } from "@/data/store";
import {
  CabecalhoDePainel,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  Painel,
  RecordPanel,
  RecordRow,
  StateSeal,
} from "@/features/shell/ui";
import { shortcutHref } from "@/features/estrutura/shortcuts";

export default function EspacoPage({ params }: { params: Promise<{ espaco: string }> }) {
  const { espaco } = use(params);
  const state = useData((data) => data);
  const record = state.spaces.find((s) => s.id === espaco);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Espaço não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const listas = state.lists.filter((l) => l.parentId === record.id);
  const atalhos = record.shortcuts ?? [];
  const pastas = state.folders.filter((f) => f.parentId === record.id);
  const paineis = state.panels.filter((p) => p.anchor?.id === record.id);
  const criador = state.members.find((m) => m.id === record.createdBy.id)?.displayName ?? "Sistema";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={record.name}
        seal={<StateSeal state={record.lifecycle} />}
        actions={
          <Link href={`/estrutura/espacos/${record.id}/configuracoes`} className="btn btn-contorno btn-sm">
            <Icone de={Settings} tamanho="xs" />
            Configurações
          </Link>
        }
      />
      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="grid content-start gap-3">
            <Painel>
              <CabecalhoDePainel titulo={atalhos.length ? "Listas diretas e atalhos" : "Listas diretas"} contagem={listas.length + atalhos.length} />
              <div className="p-3">
                {listas.length + atalhos.length === 0 ? (
                  <EmptyState compact title="Nenhuma Lista direta neste Espaço." />
                ) : (
                  <ul className="pilha-solta">
                    {listas.map((list) => (
                      <li key={list.id}>
                        <Link href={`/estrutura/listas/${list.id}`} className="item-solto">
                          <Icone de={List} tamanho="xs" style={{ color: "var(--texto-4)" }} />
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {list.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {atalhos.map((shortcut) => (
                      <li key={shortcut.id}>
                        <Link href={shortcutHref(shortcut)} className="item-solto flex-wrap">
                          <Icone de={ExternalLink} tamanho="xs" style={{ color: "var(--texto-4)" }} />
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {shortcut.name}
                          </span>
                          <span className="app-meta shrink-0">
                            atalho · Caixa de Entrada do CRM{shortcut.scope === "minhas" ? ", só as suas Conversas" : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Pastas" contagem={pastas.length} />
              <div className="p-3">
                {pastas.length === 0 ? (
                  <EmptyState compact title="Nenhuma Pasta neste Espaço." />
                ) : (
                  <ul className="pilha-solta">
                    {pastas.map((folder) => (
                      <li key={folder.id}>
                        <Link href={`/estrutura/pastas/${folder.id}`} className="item-solto">
                          <Icone de={Folder} tamanho="xs" style={{ color: "var(--texto-4)" }} />
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {folder.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Painéis" contagem={paineis.length} />
              <div className="p-3">
                {paineis.length === 0 ? (
                  <EmptyState
                    compact
                    title="Nenhum Painel de contexto ancorado aqui."
                    hint="Um Painel é criado em Painéis e ancorado neste registro."
                  />
                ) : (
                  <ul className="pilha-solta">
                    {paineis.map((panel) => (
                      <li key={panel.id}>
                        <Link href={`/paineis/${panel.id}`} className="item-solto">
                          <Icone de={LayoutDashboard} tamanho="xs" style={{ color: "var(--texto-4)" }} />
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {panel.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>
          </div>

          {/* Os atributos que antes moravam na prosa do cabeçalho. */}
          <div className="grid content-start gap-3">
            <RecordPanel title="Atributos">
              <dl>
                <RecordRow label="Criado por">{criador}</RecordRow>
                <RecordRow label="Privado">{record.isPrivate ? "sim" : "não"}</RecordRow>
              </dl>
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
