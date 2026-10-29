"use client";

/**
 * O ESPAÇO — o ponto mais alto da Estrutura, no mesmo formato da página da
 * Pasta (2.1.9, D-17): o que ele CONTÉM, em réguas — as Listas diretas (com os
 * atalhos da Caixa de Entrada) e depois as Pastas. Uma coluna só: os atributos
 * que moravam num painel ao lado agora são o selo «Privado» no título e a aba
 * Geral das Configurações.
 *
 * Cada grupo vem de `irmaosOrdenados`, a mesma ordenação da árvore, para o
 * arrastar de lá aparecer aqui. Criar Lista e Pasta usa o MESMO diálogo da
 * árvore: ele vive na casca e abre por parâmetro de URL, então aqui basta pedir.
 */

import { use } from "react";
import Link from "next/link";
import { ExternalLink, Folder, LayoutDashboard, List, Lock, Plus, Settings } from "lucide-react";
import { useData, useSession } from "@/dados/store";
import {
  effectiveLifecycleOfList,
  irmaosOrdenados,
  isTerminalCategory,
  memberReachesContainer,
  statusCategory,
} from "@n1/dominio/derive";
import type { Folder as Pasta, List as Lista } from "@n1/dominio/types";
import { useFormat } from "@/features/shell/use-format";
import {
  ActionMenu,
  CabecalhoDePainel,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  Painel,
  Pilula,
  ReguaDeSecao,
  StateSeal,
} from "@/features/shell/ui";
import { shortcutHref } from "@/features/estrutura/shortcuts";
import { useCreateContainerDialog } from "@/features/estrutura/create-container-dialog";

export default function EspacoPage({ params }: { params: Promise<{ espaco: string }> }) {
  const { espaco } = use(params);
  const state = useData((data) => data);
  const { memberId } = useSession();
  const fmt = useFormat();
  const { openCreate } = useCreateContainerDialog();
  const record = state.spaces.find((s) => s.id === espaco);

  // B38 — privado sem concessão: não existe para quem não alcança, nem o nome.
  if (!record || !memberReachesContainer(state, memberId, "space", record.id)) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Espaço não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const ativo = record.lifecycle === "ativo";
  const pai = { type: "space", id: record.id } as const;
  const listas = irmaosOrdenados(state, "list", pai).filter((l) => memberReachesContainer(state, memberId, "list", l.id)) as Lista[];
  const pastas = irmaosOrdenados(state, "folder", pai).filter((f) => memberReachesContainer(state, memberId, "folder", f.id)) as Pasta[];
  const atalhos = record.shortcuts ?? [];
  const paineis = state.panels.filter((p) => p.anchor?.id === record.id);

  const abertasEm = (listId: string) =>
    state.tasks.filter(
      (t) => t.listId === listId && !t.parentTaskId && t.lifecycle === "ativo" && !isTerminalCategory(statusCategory(state, t)),
    ).length;

  const contagem = `${listas.length} ${listas.length === 1 ? "Lista" : "Listas"} · ${pastas.length} ${pastas.length === 1 ? "Pasta" : "Pastas"}`;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={record.name}
        seal={
          <>
            <StateSeal state={record.lifecycle} />
            {record.isPrivate ? (
              <Pilula tom="neutro">
                <Icone de={Lock} tamanho="xs" />
                Privado
              </Pilula>
            ) : null}
          </>
        }
        meta={contagem}
        actions={
          <>
            <Link href={`/estrutura/espacos/${record.id}/configuracoes`} className="btn btn-fantasma btn-sm">
              <Icone de={Settings} tamanho="xs" />
              Configurações
            </Link>
            {ativo ? (
              <ActionMenu
                label="Criar neste Espaço"
                trigger={
                  <span className="btn btn-solido btn-sm">
                    <Icone de={Plus} tamanho="xs" />
                    Criar
                  </span>
                }
                items={[
                  { label: "Lista", onSelect: () => openCreate("lista", "space", record.id) },
                  { label: "Pasta", onSelect: () => openCreate("pasta", "space", record.id) },
                ]}
              />
            ) : null}
          </>
        }
      />

      <CorpoDeTela>
        <div className="grid min-w-0 content-start gap-6">
          {/* ------------------------------------------------------ listas
              As Listas diretas e, depois delas, os atalhos: contam juntos. */}
          <section>
            <ReguaDeSecao rotulo="Listas" contagem={listas.length + atalhos.length} />
            {listas.length + atalhos.length === 0 ? (
              <p className="app-meta px-1">Nenhuma Lista.</p>
            ) : (
              <ul className="pilha-solta">
                {listas.map((list) => {
                  const abertas = abertasEm(list.id);
                  const efetivo = effectiveLifecycleOfList(state, list.id);
                  const periodo = list.plannedPeriod?.start
                    ? `${fmt.civilDate(list.plannedPeriod.start)}${list.plannedPeriod.end ? ` a ${fmt.civilDate(list.plannedPeriod.end)}` : ""}`
                    : null;
                  return (
                    <li key={list.id}>
                      <Link
                        href={`/estrutura/listas/${list.id}`}
                        className="item-solto"
                        data-atenuado={efetivo !== "ativo" ? "true" : undefined}
                      >
                        <Icone de={List} tamanho="sm" style={{ color: "var(--texto-4)" }} />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="app-md min-w-0 truncate" title={list.name} style={{ color: "var(--texto)" }}>
                              {list.name}
                            </span>
                            {/* C35 — o modelo é da Lista, não do Espaço. */}
                            {list.modeloDeTarefa === "conversacional" ? <Pilula tom="acento">Conversacional</Pilula> : null}
                          </span>
                          {periodo ? <span className="app-meta app-numero block">{periodo}</span> : null}
                        </span>
                        {efetivo !== "ativo" ? <StateSeal state={efetivo} /> : null}
                        <span className="app-sm app-numero shrink-0" style={{ color: abertas > 0 ? "var(--texto-1)" : "var(--texto-4)" }}>
                          {abertas} {abertas === 1 ? "aberta" : "abertas"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
                {atalhos.map((shortcut) => (
                  <li key={shortcut.id}>
                    <Link href={shortcutHref(shortcut)} className="item-solto flex-wrap">
                      <Icone de={ExternalLink} tamanho="sm" style={{ color: "var(--texto-4)" }} />
                      <span className="app-md min-w-0 flex-1 truncate" title={shortcut.name} style={{ color: "var(--texto)" }}>
                        {shortcut.name}
                      </span>
                      <span className="app-meta shrink-0">
                        Caixa de Entrada do CRM{shortcut.scope === "minhas" ? ", só as suas Conversas" : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ------------------------------------------------------ pastas */}
          <section>
            <ReguaDeSecao rotulo="Pastas" contagem={pastas.length} />
            {pastas.length === 0 ? (
              <p className="app-meta px-1">Nenhuma Pasta.</p>
            ) : (
              <ul className="pilha-solta">
                {pastas.map((folder) => {
                  const listasDela = state.lists.filter((l) => l.parentId === folder.id).length;
                  return (
                    <li key={folder.id}>
                      <Link
                        href={`/estrutura/pastas/${folder.id}`}
                        className="item-solto"
                        data-atenuado={folder.lifecycle !== "ativo" ? "true" : undefined}
                      >
                        <Icone de={Folder} tamanho="sm" style={{ color: "var(--texto-4)" }} />
                        <span className="app-md min-w-0 flex-1 truncate" title={folder.name} style={{ color: "var(--texto)" }}>
                          {folder.name}
                        </span>
                        {folder.lifecycle !== "ativo" ? <StateSeal state={folder.lifecycle} /> : null}
                        <span className="app-sm app-numero shrink-0" style={{ color: "var(--texto-4)" }}>
                          {listasDela} {listasDela === 1 ? "Lista" : "Listas"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ------------------------------------------------------ painéis */}
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
      </CorpoDeTela>
    </div>
  );
}
