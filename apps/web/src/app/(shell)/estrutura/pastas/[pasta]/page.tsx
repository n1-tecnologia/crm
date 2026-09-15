"use client";

/**
 * A PASTA — um agrupamento de Listas dentro de um Espaço (A3.4: uma Subpasta
 * contém só Listas; a profundidade abaixo de Espaço é de dois níveis).
 *
 * A tela é o que a Pasta CONTÉM, em primeiro lugar: as Listas, como peças com
 * o que interessa de cada uma (quantas Tarefas abertas, o período planejado).
 * Subpastas vêm depois, como régua — uma seção com zero itens custa uma linha,
 * não uma caixa. Sprints é um modo da Pasta, então mora na coluna lateral, com
 * o formulário empilhado. Tipo e nível são a contagem do cabeçalho.
 *
 * Criar Lista e Subpasta usa o MESMO diálogo da árvore de navegação: ele vive
 * na casca e é aberto por um parâmetro de URL, então aqui basta pedir.
 */

import { use } from "react";
import Link from "next/link";
import { Folder, List, Plus, Settings } from "lucide-react";
import { useData } from "@/dados/store";
import { effectiveLifecycleOfList, isTerminalCategory, statusCategory } from "@n1/dominio/derive";
import { useFormat } from "@/features/shell/use-format";
import {
  ActionMenu,
  Button,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  ReguaDeSecao,
  StateSeal,
} from "@/features/shell/ui";
import { useCreateContainerDialog } from "@/features/estrutura/create-container-dialog";
import { SprintPanel } from "@/features/estrutura/sprint-panel";

export default function PastaPage({ params }: { params: Promise<{ pasta: string }> }) {
  const { pasta } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();
  const { openCreate } = useCreateContainerDialog();
  const record = state.folders.find((f) => f.id === pasta);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Pasta não encontrada." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const ehPasta = record.parentType === "space";
  const ativa = record.lifecycle === "ativo";
  const subpastas = state.folders.filter((f) => f.parentId === record.id);
  const listas = state.lists.filter((l) => l.parentId === record.id);
  const abertasEm = (listId: string) =>
    state.tasks.filter(
      (t) => t.listId === listId && !t.parentTaskId && t.lifecycle === "ativo" && !isTerminalCategory(statusCategory(state, t)),
    ).length;

  const tipo = ehPasta ? "Pasta" : "Subpasta";
  const contagem = `${tipo} de nível ${ehPasta ? 1 : 2} · ${listas.length} ${listas.length === 1 ? "Lista" : "Listas"}`;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={record.name}
        seal={<StateSeal state={record.lifecycle} />}
        meta={contagem}
        actions={
          <>
            <Link href={`/estrutura/pastas/${record.id}/configuracoes`} className="btn btn-fantasma btn-sm">
              <Icone de={Settings} tamanho="xs" />
              Configurações
            </Link>
            {ativa ? (
              ehPasta ? (
                // A Pasta cria Lista ou Subpasta; a Subpasta só cria Lista (A3.4).
                <ActionMenu
                  label="Criar nesta Pasta"
                  trigger={
                    <span className="btn btn-solido btn-sm">
                      <Icone de={Plus} tamanho="xs" />
                      Criar
                    </span>
                  }
                  items={[
                    { label: "Lista", onSelect: () => openCreate("lista", "folder", record.id) },
                    { label: "Subpasta", onSelect: () => openCreate("pasta", "folder", record.id) },
                  ]}
                />
              ) : (
                <Button size="sm" variant="primary" icon={<Icone de={Plus} tamanho="xs" />} onClick={() => openCreate("lista", "folder", record.id)}>
                  Nova Lista
                </Button>
              )
            ) : null}
          </>
        }
      />

      <CorpoDeTela>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="grid min-w-0 content-start gap-6">
            {/* ------------------------------------------------------ listas */}
            <section>
              <ReguaDeSecao rotulo="Listas" contagem={listas.length} />
              {listas.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Icone de={List} tamanho="lg" />}
                  title={ehPasta ? "Esta Pasta está vazia." : "Esta Subpasta está vazia."}
                  hint={ehPasta ? "Crie uma Lista ou uma Subpasta pelo botão Criar." : "Crie uma Lista pelo botão Nova Lista."}
                  action={
                    ativa ? (
                      <Button size="sm" variant="primary" icon={<Icone de={Plus} tamanho="xs" />} onClick={() => openCreate("lista", "folder", record.id)}>
                        Nova Lista
                      </Button>
                    ) : undefined
                  }
                />
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
                            <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                              {list.name}
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
                </ul>
              )}
            </section>

            {/* --------------------------------------------------- subpastas
                Só a Pasta de nível 1 tem Subpastas (A3.4). Zero itens custa uma
                régua e uma linha — não uma caixa vazia. */}
            {ehPasta ? (
              <section>
                <ReguaDeSecao rotulo="Subpastas" contagem={subpastas.length} />
                {subpastas.length === 0 ? (
                  <p className="app-meta px-1">Nenhuma Subpasta.</p>
                ) : (
                  <ul className="pilha-solta">
                    {subpastas.map((folder) => {
                      const listasDela = state.lists.filter((l) => l.parentId === folder.id).length;
                      return (
                        <li key={folder.id}>
                          <Link
                            href={`/estrutura/pastas/${folder.id}`}
                            className="item-solto"
                            data-atenuado={folder.lifecycle !== "ativo" ? "true" : undefined}
                          >
                            <Icone de={Folder} tamanho="sm" style={{ color: "var(--texto-4)" }} />
                            <span className="app-md min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
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
            ) : null}
          </div>

          {/* Sprints é um MODO da Pasta, não conteúdo dela: mora ao lado. */}
          <div className="grid content-start gap-3">
            <SprintPanel folder={record} />
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
