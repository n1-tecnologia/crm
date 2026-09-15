"use client";

/**
 * T45 — Campos.
 *
 * A5.2 — the point of definition differs by family: a Task field is defined in a
 * container (Space, Folder or List) and reaches the subtree below it; a CRM
 * field is defined in the workspace and reaches every record of its family.
 *
 * B37 — a value whose definition stopped applying is archived inside the record,
 * never discarded. The count of archived values is shown because it is the only
 * evidence that data survived a move.
 */

import Link from "next/link";
import { useId, useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { restoreFieldDefinition } from "@n1/dominio/operations";
import { containerAdminRefusal } from "@n1/dominio/derive";
import { FIELD_TYPE_LABEL } from "@/features/shell/format";
import {
  BarraDeFiltros,
  Button,
  CorpoDeTela,
  EmptyState,
  Field,
  PageHeader,
  Section,
  Select,
  StateSeal,
  Toast,
} from "@/features/shell/ui";
import { FieldDefinitionsEditor } from "@/features/estrutura/configuration-editors";
import type { FieldDefinition } from "@n1/dominio/types";


const TARGET_LABEL: Record<string, string> = {
  task: "Tarefa",
  contact: "Contato",
  company: "Empresa",
  deal: "Negócio",
  conversation: "Conversa",
};

export default function CamposPage() {
  /*
    Criar um Campo de Tarefa é escolher ONDE ele vale (B25): o contêiner é a
    primeira decisão, e o editor é o mesmo da configuração do contêiner.
  */
  const [contexto, setContexto] = useState("");
  const run = useRun();
  const { memberId } = useSession();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = (result: { ok: boolean; error?: string }, message: string) => {
    if (result.ok) {
      setError(null);
      setNotice(message);
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };
  const state = useData((data) => data);
  const [target, setTarget] = useState<"todos" | FieldDefinition["target"]>("todos");
  const idFamilia = useId();

  const definitions = state.fieldDefinitions.filter(
    (definition) => target === "todos" || definition.target === target,
  );
  const taskDefinitions = definitions.filter((definition) => definition.target === "task");
  const crmDefinitions = definitions.filter((definition) => definition.target !== "task");

  const containerName = (definition: FieldDefinition): string => {
    if (definition.definedAtType === "space") {
      return state.spaces.find((s) => s.id === definition.definedAtId)?.name ?? "Espaço não encontrado";
    }
    if (definition.definedAtType === "folder") {
      return state.folders.find((f) => f.id === definition.definedAtId)?.name ?? "Pasta não encontrada";
    }
    return state.lists.find((l) => l.id === definition.definedAtId)?.name ?? "Lista não encontrada";
  };

  // Aponta para as configurações, onde o Campo se edita — não para a ficha do contêiner.
  const containerHref = (definition: FieldDefinition): string => {
    if (definition.definedAtType === "space") return `/estrutura/espacos/${definition.definedAtId}/configuracoes`;
    if (definition.definedAtType === "folder") return `/estrutura/pastas/${definition.definedAtId}/configuracoes`;
    return `/estrutura/listas/${definition.definedAtId}/configuracoes`;
  };

  /** Restaurar é ação de quem administra o contêiner que define o Campo. */
  const restauroRecusado = (definition: FieldDefinition): string | undefined =>
    definition.definedAtType && definition.definedAtId
      ? containerAdminRefusal(state, memberId, definition.definedAtType, definition.definedAtId)
      : "Este Campo não é definido em um contêiner.";

  const usageOf = (definition: FieldDefinition): { filled: number; archived: number } => {
    const records =
      definition.target === "task"
        ? state.tasks
        : definition.target === "contact"
          ? state.contacts
          : definition.target === "company"
            ? state.companies
            : definition.target === "deal"
              ? state.deals
              : state.conversations;
    let filled = 0;
    let archived = 0;
    for (const record of records) {
      const value = record.fieldValues.find((v) => v.definitionId === definition.id);
      if (!value) continue;
      if (value.state === "arquivado") archived += 1;
      else filled += 1;
    }
    return { filled, archived };
  };

  const renderTable = (rows: readonly FieldDefinition[], showContainer: boolean) => (
    <table className="tabela">
      <thead>
        <tr>
          <th className="app-coluna">Campo</th>
          <th className="app-coluna">Tipo</th>
          {showContainer ? (
            <th className="app-coluna">Ponto de definição</th>
          ) : (
            <th className="app-coluna">Família</th>
          )}
          <th className="app-coluna">Preenchido</th>
          <th className="app-coluna">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((definition) => {
          const usage = usageOf(definition);
          return (
            <tr key={definition.id}>
              <td>
                <span className="app-md" style={{ color: "var(--texto)" }}>
                  {definition.name}
                </span>
                {definition.required ? <span className="app-meta ml-2">obrigatório</span> : null}
                {definition.options ? (
                  <span className="app-meta block">{definition.options.join(" · ")}</span>
                ) : null}
              </td>
              <td>{FIELD_TYPE_LABEL[definition.type] ?? definition.type}</td>
              <td>
                {showContainer ? (
                  <Link href={containerHref(definition)} className="hover:underline" style={{ color: "var(--texto)" }}>
                    {containerName(definition)}
                  </Link>
                ) : (
                  TARGET_LABEL[definition.target] ?? definition.target
                )}
                {showContainer ? (
                  <span className="app-meta block">alcança a subárvore abaixo deste contêiner</span>
                ) : null}
              </td>
              <td>
                <span className="app-numero">{usage.filled} registro(s)</span>
                {usage.archived > 0 ? (
                  <span className="app-meta app-numero block" style={{ color: "var(--aviso)" }}>
                    {usage.archived} valor(es) arquivado(s) fora do alcance
                  </span>
                ) : null}
              </td>
              <td>
                {definition.lifecycle === "ativo" ? (
                  <span className="app-meta">ativo</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <StateSeal state={definition.lifecycle} />
                    {showContainer ? (
                      <Button
                        size="sm"
                        onClick={() => report(run((data, me) => restoreFieldDefinition(data, me, definition.id)), "Campo restaurado.")}
                        disabled={restauroRecusado(definition) !== undefined}
                        disabledReason={restauroRecusado(definition) ?? ""}
                      >
                        Restaurar
                      </Button>
                    ) : null}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Campos"
        meta={
          target === "todos"
            ? `${state.fieldDefinitions.length} Definição(ões) de Campo`
            : `${definitions.length} de ${state.fieldDefinitions.length} Definição(ões) de Campo`
        }
      />

      <BarraDeFiltros>
        <div className="flex items-center gap-2">
          <label htmlFor={idFamilia} className="app-meta">
            Família
          </label>
          <div className="w-40">
            <Select
              size="sm"
              id={idFamilia}
              value={target}
              onChange={(value) => setTarget(value as "todos" | FieldDefinition["target"])}
              options={[
                { value: "todos", label: "Todas" },
                { value: "task", label: "Tarefa" },
                { value: "contact", label: "Contato" },
                { value: "company", label: "Empresa" },
                { value: "deal", label: "Negócio" },
                { value: "conversation", label: "Conversa" },
              ]}
            />
          </div>
        </div>
      </BarraDeFiltros>

      <CorpoDeTela>
        {notice ? (
          <Toast tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Toast>
        ) : null}
        {error ? (
          <Toast tone="error" onDismiss={() => setError(null)}>
            {error}
          </Toast>
        ) : null}

        <Section title="Campos de Tarefa por contêiner">
          <div className="grid gap-3">
            <Field label="Contêiner" hint="Escolha onde o Campo vale: ele alcança tudo abaixo. Os já definidos ali aparecem para editar ou arquivar.">
              {(id) => (
                <Select
                  id={id}
                  value={contexto}
                  onChange={setContexto}
                  searchable
                  placeholder="Escolher Espaço, Pasta ou Lista"
                  options={[
                    ...state.spaces.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: `space:${c.id}`, label: c.name, detail: "Espaço" })),
                    ...state.folders.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: `folder:${c.id}`, label: c.name, detail: "Pasta" })),
                    ...state.lists.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: `list:${c.id}`, label: c.name, detail: "Lista" })),
                  ]}
                />
              )}
            </Field>
            {contexto ? (
              <FieldDefinitionsEditor
                containerType={contexto.split(":")[0] as "space" | "folder" | "list"}
                containerId={contexto.split(":")[1] ?? ""}
                report={report}
              />
            ) : null}
          </div>
        </Section>

        <Section title="Definidos em contêineres (Tarefa)" count={taskDefinitions.length}>
          {taskDefinitions.length === 0 ? (
            <EmptyState
              title="Nenhuma Definição de Campo de Tarefa."
              hint="Uma Definição de Tarefa nasce em um Espaço, Pasta ou Lista e alcança tudo abaixo dele."
            />
          ) : (
            renderTable(taskDefinitions, true)
          )}
        </Section>

        <Section title="Definidos no Espaço de Trabalho (CRM)" count={crmDefinitions.length}>
          {crmDefinitions.length === 0 ? (
            <EmptyState
              title="Nenhuma Definição de Campo de CRM."
              hint="Uma Definição de CRM vale para toda a família no Espaço de Trabalho, sem contêiner."
            />
          ) : (
            renderTable(crmDefinitions, false)
          )}
        </Section>
      </CorpoDeTela>
    </div>
  );
}
