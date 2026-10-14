"use client";

/**
 * Fase 4 — filtros, ordenação e Visualizações salvas de uma Lista. O filtro
 * vive no estado da tela; salvar grava uma Visualização (pessoal ou da Lista)
 * que quem abre lê pelas próprias permissões — a Lista já veio filtrada pelo
 * que este Membro alcança antes de chegar aqui.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import {
  deleteView,
  saveView,
  setDefaultView,
  viewsFor,
} from "@n1/dominio/operations";
import { containerAdminRefusal, effectiveListConfig } from "@n1/dominio/derive";
import { PRIORITY_LABEL, STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import {
  ActionMenu,
  Button,
  ConfirmDialog,
  Field,
  Painel,
  Select,
  TextInput,
  Toggle,
} from "@/features/shell/ui";
import type { Priority, StatusCategory, View, ViewFilters } from "@n1/dominio/types";
import { abaDaView, ROTULO_DA_ABA } from "./tipo-de-visualizacao";

type Report = (
  result: { ok: boolean; error?: string },
  message: string,
) => void;

export const FILTRO_VAZIO: ViewFilters = {};

export function ViewBar({
  listId,
  filters,
  sortBy,
  kind,
  onFilters,
  onSort,
  activeViewId,
  onOpenView,
  report,
  panelOpen,
}: {
  readonly listId: string;
  readonly filters: ViewFilters;
  readonly sortBy: View["sortBy"] | undefined;
  /** RELO-05 — o tipo da aba aberta agora: a Visualização salva o lembra. */
  readonly kind: View["kind"];
  readonly onFilters: (next: ViewFilters) => void;
  readonly onSort: (next: View["sortBy"] | undefined) => void;
  readonly activeViewId: string | null;
  readonly onOpenView: (view: View | null) => void;
  readonly report: Report;
  /** Quando a tela controla o painel de filtros por fora (barra financeira), o botão próprio some. */
  readonly panelOpen?: boolean;
}) {
  const run = useRun();
  const state = useData((data) => data);
  const { memberId } = useSession();
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [compartilhada, setCompartilhada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [abertoLocal, setAbertoLocal] = useState(false);
  const aberto = panelOpen ?? abertoLocal;
  const setAberto = (v: boolean | ((prev: boolean) => boolean)) =>
    setAbertoLocal(v);

  const views = viewsFor(state, memberId, listId);
  const administra = containerAdminRefusal(state, memberId, "list", listId);
  const membros = state.members.filter((m) => m.state === "ativo");
  const statusOptions = [
    ...(effectiveListConfig(state, listId)?.statusSet.definitions ?? []),
  ]
    .sort((a, b) => a.order - b.order)
    .map((d) => ({ value: d.id, label: d.name }));
  const tags = state.tags.filter((t) => t.lifecycle === "ativo");
  const ativos = Object.entries(filters).filter(
    ([, v]) => v !== undefined && v !== "" && v !== false,
  ).length;
  const aExcluir = views.find((v) => v.id === excluindo);
  const set = (patch: Partial<ViewFilters>) =>
    onFilters({ ...filters, ...patch });

  return (
    <div className="grid gap-2">
      <ConfirmDialog
        open={salvando}
        title="Salvar Visualização"
        description={`Guarda ${ROTULO_DA_ABA[abaDaView(kind)]}, o filtro e a ordenação atuais com um nome. Compartilhada, aparece para quem abre esta Lista — cada pessoa vê só o que alcança.`}
        confirmLabel="Salvar"
        {...(nome.trim() === ""
          ? { confirmDisabledReason: "Dê um nome à Visualização." }
          : {})}
        onConfirm={() => {
          const result = run((data, me) =>
            saveView(data, me, {
              listId,
              name: nome,
              kind,
              filters,
              ...(sortBy ? { sortBy } : {}),
              shared: compartilhada,
            }),
          );
          if (result.ok) {
            report(result, `Visualização “${nome.trim()}” salva.`);
            onOpenView(result.value);
            setSalvando(false);
            setNome("");
            setErro(null);
          } else {
            setErro(result.error);
          }
        }}
        onCancel={() => {
          setSalvando(false);
          setErro(null);
        }}
      >
        <div className="grid gap-2">
          {erro ? (
            <p
              role="alert"
              className="app-base rounded-[var(--r-controle)] px-3 py-2"
              style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}
            >
              {erro}
            </p>
          ) : null}
          <Field label="Nome">
            {(id) => (
              <TextInput
                id={id}
                value={nome}
                onChange={setNome}
                placeholder="Ex.: Minhas vencidas"
              />
            )}
          </Field>
          <span className="app-base flex items-center gap-2" style={{ color: "var(--texto)" }}>
            <Toggle
              checked={compartilhada}
              onChange={setCompartilhada}
              labelledBy="visualizacao-compartilhada"
              disabled={administra !== undefined}
            />
            <span id="visualizacao-compartilhada" title={administra ?? ""}>
              Compartilhada com quem abre a Lista
              {administra ? ` (${administra})` : ""}
            </span>
          </span>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={excluindo !== null}
        title={`Excluir a Visualização “${aExcluir?.name ?? ""}”?`}
        description={
          aExcluir?.ownerKind === "container"
            ? "Ela some para todos que abrem esta Lista. As Tarefas não mudam."
            : "Ela é só sua. As Tarefas não mudam."
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (excluindo) {
            report(
              run((data, me) => deleteView(data, me, excluindo)),
              "Visualização excluída.",
            );
            if (activeViewId === excluindo) onOpenView(null);
          }
          setExcluindo(null);
        }}
        onCancel={() => setExcluindo(null)}
      />

      <div className="flex flex-wrap items-center gap-2">
        {views.map((view) => {
          const podeEditar =
            view.ownerKind === "member"
              ? view.ownerId === memberId
              : administra === undefined;
          const ativa = activeViewId === view.id;
          return (
            // A Visualização é um chip de duas partes: o nome (aplica/desaplica) e o menu de ações.
            <span
              key={view.id}
              className="inline-flex items-center rounded-[var(--r-pilula)] pr-0.5"
              style={{
                height: "var(--controle-h-sm)",
                border: `1px solid ${ativa ? "var(--linha-acento)" : "var(--linha-forte)"}`,
                background: ativa ? "var(--acento-lavado)" : undefined,
              }}
            >
              <button
                type="button"
                aria-pressed={ativa}
                onClick={() => onOpenView(ativa ? null : view)}
                className="app-sm flex h-full items-center gap-1 rounded-l-[var(--r-pilula)] pl-3 pr-1 transition-colors hover:bg-[var(--superficie-hover)]"
                style={{ color: "var(--texto)" }}
              >
                {view.name}
                <span className="app-meta">
                  {`· ${ROTULO_DA_ABA[abaDaView(view.kind)]}`}
                  {view.ownerKind === "container"
                    ? view.isDefault
                      ? " · padrão"
                      : " · da Lista"
                    : " · minha"}
                </span>
              </button>
              <ActionMenu
                label={`Ações de ${view.name}`}
                items={[
                  ...(view.ownerKind === "container"
                    ? [
                        {
                          label: view.isDefault
                            ? "Deixar de ser padrão"
                            : "Tornar padrão da Lista",
                          onSelect: () => {
                            // A operação muda o objeto no lugar: a frase é decidida antes de rodar.
                            const eraPadrao = view.isDefault;
                            report(
                              run((data, me) =>
                                setDefaultView(data, me, view.id, !eraPadrao),
                              ),
                              eraPadrao
                                ? "Deixou de ser a padrão."
                                : "Agora é a padrão da Lista: abre aplicada para quem entrar nela.",
                            );
                          },
                          ...(podeEditar
                            ? {}
                            : { disabledReason: administra ?? "" }),
                        },
                      ]
                    : []),
                  {
                    label: "Excluir",
                    destructive: true,
                    onSelect: () => setExcluindo(view.id),
                    ...(podeEditar
                      ? {}
                      : {
                          disabledReason:
                            view.ownerKind === "member"
                              ? "Esta Visualização é de outro Membro."
                              : (administra ?? ""),
                        }),
                  },
                ]}
              />
            </span>
          );
        })}
        {panelOpen === undefined ? (
          <Button onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
            {aberto
              ? "Ocultar filtros"
              : `Filtros${ativos > 0 ? ` (${ativos})` : ""}`}
          </Button>
        ) : null}
        <Button onClick={() => setSalvando(true)}>Salvar Visualização</Button>
        {ativos > 0 || sortBy ? (
          <Button
            variant="ghost"
            onClick={() => {
              onFilters(FILTRO_VAZIO);
              onSort(undefined);
              onOpenView(null);
            }}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      {aberto ? (
        <Painel className="grid gap-2 p-3 sm:grid-cols-3 lg:grid-cols-7">
          <Field label="Buscar">
            {(id) => (
              <TextInput
                id={id}
                value={filters.text ?? ""}
                onChange={(text) => set({ text: text || undefined })}
                placeholder="no título"
              />
            )}
          </Field>
          <Field label="Categoria">
            {(id) => (
              <Select
                id={id}
                value={filters.statusCategory ?? ""}
                onChange={(v) =>
                  set({
                    statusCategory: (v || undefined) as
                      StatusCategory | undefined,
                  })
                }
                placeholder="todas"
                options={(
                  [
                    "naoIniciado",
                    "emAndamento",
                    "concluido",
                    "fechado",
                  ] as const
                ).map((c) => ({
                  value: c,
                  label: STATUS_CATEGORY_LABEL[c] ?? c,
                }))}
              />
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select
                id={id}
                value={filters.statusId ?? ""}
                onChange={(v) => set({ statusId: v || undefined })}
                placeholder="qualquer"
                options={statusOptions}
              />
            )}
          </Field>
          <Field label="Responsável">
            {(id) => (
              <Select
                id={id}
                value={filters.assigneeMemberId ?? ""}
                onChange={(v) => set({ assigneeMemberId: v || undefined })}
                placeholder="qualquer"
                searchable
                options={membros.map((m) => ({
                  value: m.id,
                  label: m.displayName,
                }))}
              />
            )}
          </Field>
          <Field label="Prioridade">
            {(id) => (
              <Select
                id={id}
                value={filters.priority ?? ""}
                onChange={(v) =>
                  set({ priority: (v || undefined) as Priority | undefined })
                }
                placeholder="qualquer"
                options={(Object.keys(PRIORITY_LABEL) as Priority[]).map(
                  (p) => ({ value: p, label: PRIORITY_LABEL[p] ?? p }),
                )}
              />
            )}
          </Field>
          <Field label="Tag">
            {(id) => (
              <Select
                id={id}
                value={filters.tagId ?? ""}
                onChange={(v) => set({ tagId: v || undefined })}
                placeholder="qualquer"
                options={tags.map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
          </Field>
          <Field label="Ordenar por">
            {(id) => (
              <Select
                id={id}
                value={sortBy ? `${sortBy.by}:${sortBy.direction}` : ""}
                onChange={(v) => {
                  if (!v) return onSort(undefined);
                  const [by, direction] = v.split(":") as [
                    NonNullable<View["sortBy"]>["by"],
                    "asc" | "desc",
                  ];
                  onSort({ by, direction });
                }}
                placeholder="ordem da Lista"
                options={[
                  { value: "dueDate:asc", label: "Vencimento (mais cedo)" },
                  { value: "dueDate:desc", label: "Vencimento (mais tarde)" },
                  {
                    value: "priority:asc",
                    label: "Prioridade (urgente primeiro)",
                  },
                  { value: "title:asc", label: "Título (A–Z)" },
                  { value: "createdAt:desc", label: "Criação (mais recente)" },
                ]}
              />
            )}
          </Field>
          <label className="app-base flex items-center gap-2 sm:col-span-3 lg:col-span-7" style={{ color: "var(--texto)" }}>
            <input
              type="checkbox"
              checked={filters.overdue ?? false}
              onChange={(event) =>
                set({ overdue: event.target.checked || undefined })
              }
              className="size-4 accent-[var(--acento)]"
            />
            Só vencidas
          </label>
        </Painel>
      ) : null}
    </div>
  );
}
