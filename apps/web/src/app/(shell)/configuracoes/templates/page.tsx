"use client";

/**
 * T47 — Templates.
 *
 * A8 — a Template is a reusable structure of another entity, and instantiating
 * it creates NO live link: changing the template later does not change what was
 * already created. That is the single most misleading thing about templates, so
 * the screen says it in plain words rather than assuming it is obvious.
 *
 * B47 — a Folder template that contains Subfolders is only instantiable inside a
 * Space, never inside another Folder.
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { renameTemplate, setTemplateArchived } from "@n1/dominio/operations";
import { useFormat } from "@/features/shell/use-format";
import {
  ActionMenu,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Field,
  PageHeader,
  Pilula,
  Section,
  StateSeal,
  TextInput,
  Toast,
} from "@/features/shell/ui";
import type { Template } from "@n1/dominio/types";

const KINDS: ReadonlyArray<{ readonly kind: Template["kind"]; readonly title: string }> = [
  { kind: "espaco", title: "Espaços" },
  { kind: "pasta", title: "Pastas" },
  { kind: "lista", title: "Listas" },
  { kind: "tarefa", title: "Tarefas" },
  { kind: "checklist", title: "Checklists" },
  { kind: "agente", title: "Agentes" },
];

export default function TemplatesPage() {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const defaultSpaceTemplateId = state.workspace.defaultSpaceTemplateId;
  const base = state.roles.find((r) => r.id === state.members.find((m) => m.id === memberId)?.roleId)?.base;
  const cuida = base === "proprietario" || base === "administrador" ? undefined : "Só um Administrador ou o Proprietário altera o catálogo de Templates.";
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<Template | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erroDialogo, setErroDialogo] = useState<string | null>(null);
  const [arquivando, setArquivando] = useState<Template | null>(null);
  const report = (result: { ok: boolean; error?: string }, message: string) => {
    if (result.ok) {
      setError(null);
      setNotice(message);
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Templates"
        meta={`${state.templates.length} Template(s)`}
      />

      <CorpoDeTela>
        {notice ? <Toast tone="success" onDismiss={() => setNotice(null)}>{notice}</Toast> : null}
        {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}
        <ConfirmDialog
          open={renomeando !== null}
          title="Renomear Template"
          description="O nome é o que aparece nas escolhas de “De modelo” e ao criar contêineres."
          confirmLabel="Salvar"
          {...(nome.trim() === "" ? { confirmDisabledReason: "Dê um nome ao Template." } : {})}
          onConfirm={() => {
            if (!renomeando) return;
            const result = run((data, me) => renameTemplate(data, me, renomeando.id, { name: nome, description: descricao }));
            if (result.ok) {
              report(result, "Template renomeado.");
              setRenomeando(null);
              setErroDialogo(null);
            } else {
              setErroDialogo(result.error);
            }
          }}
          onCancel={() => {
            setRenomeando(null);
            setErroDialogo(null);
          }}
        >
          <div className="grid gap-2">
            {erroDialogo ? (
              <p
                role="alert"
                className="app-base rounded-[var(--r-controle)] px-3 py-2"
                style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}
              >
                {erroDialogo}
              </p>
            ) : null}
            <Field label="Nome">{(id) => <TextInput id={id} value={nome} onChange={setNome} />}</Field>
            <Field label="Descrição">{(id) => <TextInput id={id} value={descricao} onChange={setDescricao} placeholder="Opcional" />}</Field>
          </div>
        </ConfirmDialog>
        <ConfirmDialog
          open={arquivando !== null}
          title={`Arquivar o Template “${arquivando?.name ?? ""}”?`}
          description="Ele sai das escolhas de criação. O que já foi instanciado não muda. Dá para restaurar depois."
          confirmLabel="Arquivar"
          destructive
          onConfirm={() => {
            if (arquivando) report(run((data, me) => setTemplateArchived(data, me, arquivando.id, true)), "Template arquivado.");
            setArquivando(null);
          }}
          onCancel={() => setArquivando(null)}
        />
        {state.templates.length === 0 ? (
          <EmptyState
            title="Nenhum Template."
            hint="Um Template nasce de uma estrutura que já existe e que se quer repetir."
          />
        ) : (
          KINDS.map((group) => {
            const templates = state.templates.filter((template) => template.kind === group.kind);
            if (templates.length === 0) return null;
            return (
              <Section key={group.kind} title={`Templates de ${group.title}`} count={templates.length}>
                <ul className="grade-solta sm:grid-cols-2">
                  {templates.map((template) => (
                    // A peça é estática: o que clica nela é o menu de ações, não o cartão.
                    <li
                      key={template.id}
                      className="item-solto"
                      data-bloco="true"
                      data-estatico="true"
                      data-atenuado={template.lifecycle === "ativo" ? undefined : "true"}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="app-md flex flex-wrap items-center gap-2" style={{ color: "var(--texto)" }}>
                            {template.name}
                            {template.id === defaultSpaceTemplateId ? (
                              <Pilula tom="info">padrão para novos Espaços</Pilula>
                            ) : null}
                          </p>
                          {template.description ? (
                            <p className="app-base mt-0.5" style={{ color: "var(--texto-3)" }}>
                              {template.description}
                            </p>
                          ) : null}
                        </div>
                        <span className="flex shrink-0 items-center gap-2">
                          <StateSeal state={template.lifecycle} />
                          <ActionMenu
                            label={`Ações de ${template.name}`}
                            items={[
                              {
                                label: "Renomear",
                                onSelect: () => {
                                  setRenomeando(template);
                                  setNome(template.name);
                                  setDescricao(template.description ?? "");
                                  setErroDialogo(null);
                                },
                                ...(cuida ? { disabledReason: cuida } : {}),
                              },
                              template.lifecycle === "ativo"
                                ? {
                                    label: "Arquivar",
                                    destructive: true,
                                    onSelect: () => setArquivando(template),
                                    ...(cuida ? { disabledReason: cuida } : template.id === defaultSpaceTemplateId ? { disabledReason: "É o padrão para novos Espaços: troque o padrão antes." } : {}),
                                  }
                                : {
                                    label: "Restaurar",
                                    onSelect: () => report(run((data, me) => setTemplateArchived(data, me, template.id, false)), "Template restaurado."),
                                    ...(cuida ? { disabledReason: cuida } : {}),
                                  },
                            ]}
                          />
                        </span>
                      </div>

                      <p className="app-sm mt-2" style={{ color: "var(--texto-3)" }}>
                        {template.body}
                      </p>

                      {template.containsSubfolders ? (
                        <p
                          className="app-sm mt-2 rounded-[var(--r-controle)] px-2 py-1"
                          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}
                        >
                          Contém Subpastas: só é instanciável dentro de um Espaço, nunca dentro de outra
                          Pasta.
                        </p>
                      ) : null}

                      <p className="app-meta mt-2">criado em {fmt.instant(template.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          })
        )}
      </CorpoDeTela>
    </div>
  );
}
