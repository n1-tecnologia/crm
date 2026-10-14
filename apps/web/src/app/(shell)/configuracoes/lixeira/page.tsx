"use client";

/**
 * T49 — Lixeira.
 *
 * A4.2 — `naLixeira` is a state of the record, not a place it moved to: what is
 * here still belongs to its container, and restoring returns it to the state it
 * had before (`lifecycleBeforeTrash`), not always to `ativo`.
 *
 * The retention countdown is the only thing that makes this screen urgent, so
 * it is computed per record and shown as days remaining, not as a raw date.
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { contactDisplayName } from "@n1/dominio/derive";
import {
  restoreAgent,
  restoreAutomation,
  restoreCompany,
  restoreContact,
  restoreContainer,
  restoreConversation,
  restoreDeal,
  restoreList,
  restoreTask,
  purgeTask,
} from "@n1/dominio/operations";
import type { DataState, OperationResult } from "@n1/dominio/state";
import { useFormat } from "@/features/shell/use-format";
import { Button, ConfirmDialog, CorpoDeTela, EmptyState, PageHeader, Section, Toast } from "@/features/shell/ui";

interface TrashedRow {
  readonly id: string;
  readonly family: string;
  readonly name: string;
  readonly href?: string;
  readonly trashedAt?: string;
  readonly restorable: boolean;
  readonly restoreHint: string;
}

export default function LixeiraPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const run = useRun();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  // PARD-10 — "eliminar agora": só Tarefa, por enquanto; definitivo, por isso confirma.
  const [eliminando, setEliminando] = useState<TrashedRow | null>(null);

  const retentionDays = state.workspace.trashPolicy.retentionDays;

  const rows: readonly TrashedRow[] = [
    ...state.tasks
      .filter((task) => task.lifecycle === "naLixeira")
      .map((task) => ({
        id: task.id,
        family: "Tarefa",
        name: task.title,
        href: `/estrutura/tarefas/${task.id}`,
        trashedAt: task.trashedAt,
        restorable: true,
        restoreHint: "Volta ao estado que tinha antes de ir à lixeira.",
      })),
    ...state.spaces
      .filter((space) => space.lifecycle === "naLixeira")
      .map((space) => ({
        id: space.id,
        family: "Espaço",
        name: space.name,
        href: `/estrutura/espacos/${space.id}`,
        trashedAt: space.trashedAt,
        restorable: true,
        restoreHint: "Volta com as Pastas, Listas e Tarefas que foram à lixeira junto com ele.",
      })),
    ...state.folders
      .filter((folder) => folder.lifecycle === "naLixeira")
      .map((folder) => ({
        id: folder.id,
        family: "Pasta",
        name: folder.name,
        href: `/estrutura/pastas/${folder.id}`,
        trashedAt: folder.trashedAt,
        restorable: true,
        restoreHint: "Volta com as Listas e Tarefas que foram à lixeira junto com ela; o Espaço acima precisa estar fora da lixeira.",
      })),
    ...state.lists
      .filter((list) => list.lifecycle === "naLixeira")
      .map((list) => ({
        id: list.id,
        family: "Lista",
        name: list.name,
        href: `/estrutura/listas/${list.id}`,
        trashedAt: list.trashedAt,
        restorable: true,
        restoreHint: "Volta com as Tarefas que foram à lixeira junto com ela; as que já estavam lá antes continuam lá.",
      })),
    ...state.contacts
      .filter((contact) => contact.lifecycle === "naLixeira")
      .map((contact) => ({
        id: contact.id,
        family: "Contato",
        name: contactDisplayName(contact),
        href: `/crm/contatos/${contact.id}`,
        trashedAt: contact.trashedAt,
        restorable: true,
        restoreHint: "Volta ao estado que tinha antes. Uma Mensagem recebida também o traz de volta automaticamente.",
      })),
    ...state.companies
      .filter((company) => company.lifecycle === "naLixeira")
      .map((company) => ({
        id: company.id,
        family: "Empresa",
        name: company.legalName,
        href: `/crm/empresas/${company.id}`,
        trashedAt: company.trashedAt,
        restorable: true,
        restoreHint: "Os Vínculos com Contatos nunca foram desfeitos e voltam visíveis com ela.",
      })),
    ...state.deals
      .filter((deal) => deal.lifecycle === "naLixeira")
      .map((deal) => ({
        id: deal.id,
        family: "Negócio",
        name: deal.title,
        href: `/crm/negocios/${deal.id}`,
        trashedAt: deal.trashedAt,
        restorable: true,
        restoreHint: "Volta ao Funil e à Etapa que ocupava; se a Etapa foi removida, volta à primeira e o Registro diz de onde veio.",
      })),
    ...state.conversations
      .filter((conversation) => conversation.lifecycle === "naLixeira")
      .map((conversation) => ({
        id: conversation.id,
        family: "Conversa",
        name: conversation.title,
        href: `/crm/caixa-de-entrada/${conversation.id}`,
        trashedAt: conversation.trashedAt,
        restorable: true,
        restoreHint: "Volta resolvida, com as Mensagens que nunca saíram.",
      })),
    ...state.agents
      .filter((agent) => agent.lifecycle === "naLixeira")
      .map((agent) => ({
        id: agent.id,
        family: "Agente",
        name: agent.name,
        href: `/ia/agentes/${agent.id}`,
        trashedAt: agent.trashedAt,
        restorable: true,
        restoreHint: "As Concessões de Habilidade voltam com ele.",
      })),
    ...state.automations
      .filter((automation) => automation.lifecycle === "naLixeira")
      .map((automation) => ({
        id: automation.id,
        family: "Automação",
        name: automation.name,
        href: `/ia/automacoes/${automation.id}`,
        trashedAt: automation.trashedAt,
        restorable: true,
        restoreHint: "Volta pausada: reativar é um ato separado.",
      })),
  ];

  const sorted = [...rows].sort((a, b) => (b.trashedAt ?? "").localeCompare(a.trashedAt ?? ""));

  const daysLeft = (trashedAt?: string): number | null => {
    if (!trashedAt) return null;
    const elapsed = (now - Date.parse(trashedAt)) / 86_400_000;
    return Math.max(0, Math.ceil(retentionDays - elapsed));
  };

  const restore = (row: TrashedRow) => {
    const restoreOf: Record<
      string,
      (data: DataState, memberId: string) => OperationResult<unknown>
    > = {
      Tarefa: (data, memberId) => restoreTask(data, memberId, row.id),
      Espaço: (data, memberId) => restoreContainer(data, memberId, "space", row.id),
      Pasta: (data, memberId) => restoreContainer(data, memberId, "folder", row.id),
      Lista: (data, memberId) => restoreList(data, memberId, row.id),
      Contato: (data, memberId) => restoreContact(data, memberId, row.id),
      Empresa: (data, memberId) => restoreCompany(data, memberId, row.id),
      Negócio: (data, memberId) => restoreDeal(data, memberId, row.id),
      Conversa: (data, memberId) => restoreConversation(data, memberId, row.id),
      Agente: (data, memberId) => restoreAgent(data, memberId, row.id),
      Automação: (data, memberId) => restoreAutomation(data, memberId, row.id),
    };
    const operation = restoreOf[row.family];
    if (!operation) {
      setNotice(null);
      setError(`Não sei restaurar um registro da família ${row.family}.`);
      return;
    }
    const result = run(operation);
    if (result.ok) {
      setError(null);
      setNotice(`${row.family} ${row.family === "Espaço" || row.family === "Negócio" || row.family === "Contato" || row.family === "Agente" ? "restaurado" : "restaurada"}: ${row.name}.`);
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  const subtarefasDe = (taskId: string): number => {
    let total = 0;
    const desce = (id: string) => {
      for (const filha of state.tasks.filter((t) => t.parentTaskId === id)) {
        total += 1;
        desce(filha.id);
      }
    };
    desce(taskId);
    return total;
  };

  return (
    <div className="flex h-full flex-col">
      {eliminando ? (
        <ConfirmDialog
          open
          title={`Eliminar “${eliminando.name}” agora?`}
          description={`Não tem volta: a Tarefa sai do Espaço de Trabalho com Comentários, Checklists e Registros de Tempo${
            subtarefasDe(eliminando.id) > 0 ? `, e ${subtarefasDe(eliminando.id)} Subtarefa(s) vão junto` : ""
          }. Vínculos e Dependências são desfeitos; os Arquivos e o Registro de Atividade ficam.`}
          confirmLabel="Eliminar agora"
          destructive
          onConfirm={() => {
            const alvo = eliminando;
            setEliminando(null);
            const result = run((data, memberId) => purgeTask(data, memberId, alvo.id));
            if (result.ok) {
              setError(null);
              setNotice(`Tarefa eliminada: ${alvo.name}.`);
            } else {
              setNotice(null);
              setError(result.error);
            }
          }}
          onCancel={() => setEliminando(null)}
        />
      ) : null}
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Lixeira"
        meta={`${sorted.length} na lixeira · retenção de ${retentionDays} dias`}
      />

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

        <Section title="Na lixeira" count={sorted.length}>
          {sorted.length === 0 ? (
            <EmptyState
              title="A lixeira está vazia."
              hint="Nada foi enviado à lixeira neste Espaço de Trabalho."
            />
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th className="app-coluna">Registro</th>
                  <th className="app-coluna">Família</th>
                  <th className="app-coluna">Enviado em</th>
                  <th className="app-coluna">Restam</th>
                  <th className="app-coluna" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const remaining = daysLeft(row.trashedAt);
                  return (
                    <tr key={`${row.family}-${row.id}`}>
                      <td>
                        {row.href ? (
                          <Link href={row.href} className="app-md hover:underline" style={{ color: "var(--texto)" }}>
                            {row.name}
                          </Link>
                        ) : (
                          <span className="app-md" style={{ color: "var(--texto)" }}>
                            {row.name}
                          </span>
                        )}
                        <span className="app-meta block">{row.restoreHint}</span>
                      </td>
                      <td>{row.family}</td>
                      <td className="whitespace-nowrap">
                        <span className="app-meta app-numero">{row.trashedAt ? fmt.instant(row.trashedAt) : "—"}</span>
                      </td>
                      <td>
                        {remaining === null ? (
                          <span style={{ color: "var(--texto-4)" }}>—</span>
                        ) : (
                          <span
                            className="app-numero"
                            style={remaining <= 3 ? { color: "var(--erro)", fontWeight: 500 } : { color: "var(--texto)" }}
                          >
                            {remaining} dia(s)
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => restore(row)}
                            disabled={!row.restorable}
                            disabledReason="A restauração desta família ainda não está implementada neste protótipo."
                          >
                            Restaurar
                          </Button>
                          {row.family === "Tarefa" ? (
                            <Button size="sm" variant="danger" onClick={() => setEliminando(row)}>
                              Eliminar agora
                            </Button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="app-meta mt-2">
            Restaurar devolve o registro ao estado que ele tinha antes de ir à lixeira — que nem sempre é
            ativo: o que estava arquivado volta arquivado. Passado o prazo, a agenda da Lista elimina a
            Tarefa de vez, com as Subtarefas; “Eliminar agora” faz o mesmo sem esperar.
          </p>
        </Section>
      </CorpoDeTela>
    </div>
  );
}
