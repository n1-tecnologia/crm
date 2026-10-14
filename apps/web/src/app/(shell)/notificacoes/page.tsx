"use client";

/**
 * T51 — Notificações.
 *
 * There is no Notificação entity in the ontology: what the Member has to answer
 * is derived from records that already exist — Approvals addressed to them,
 * Conversations assigned to them, overdue Tasks, blocked Tasks. Registered in
 * PENDENCIAS-FRONTEND as an interface concept without an ontological base.
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useSession } from "@/dados/store";
import { contactDisplayName, notificacoesDoMembro } from "@n1/dominio/derive";
import { useFormat } from "@/features/shell/use-format";
import { ConditionMarker, CorpoDeTela, EmptyState, PageHeader, Section } from "@/features/shell/ui";
import { ICONE_DE_OBJETO, Selo, SeloDaTarefa } from "@/features/estrutura/icone-de-tipo";

export default function NotificacoesPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { memberId } = useSession();
  const [now] = useState(() => new Date());

  // O mesmo derive que alimenta o sino da barra global: os números nunca discordam.
  const {
    aprovacoes: approvals,
    mencoes: mentions,
    observadas: watched,
    conversas: conversations,
    vencidas: overdue,
    bloqueadas: blocked,
    execucoesFalhas: failedExecutions,
    total,
  } = notificacoesDoMembro(state, memberId, now);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Notificações" meta={total > 0 ? `${total} item(ns)` : undefined} />

      <CorpoDeTela>
        {total === 0 ? (
          <EmptyState
            title="Nada aguarda você."
            hint="Aparecem aqui Aprovações para você decidir, menções a você em Comentários, Comentários em Tarefas que você acompanha, Conversas atribuídas, Tarefas vencidas ou bloqueadas e Execuções que falharam."
          />
        ) : null}

        {approvals.length > 0 ? (
          <Section title="Aprovações para decidir" count={approvals.length}>
            <ul className="cascata pilha-solta" data-chegada="foco">
              {approvals.map((approval) => (
                <li key={approval.id}>
                  <Link href="/ia/aprovacoes" className="item-solto py-3">
                    <Selo icone={ICONE_DE_OBJETO.aprovacao} cor="var(--aviso)" lavado="var(--aviso-lavado)" />
                    <span className="min-w-0 flex-1">
                      <span className="app-base block truncate text-[var(--texto)]">
                        {state.tools.find((t) => t.id === approval.object.toolId)?.name ??
                          approval.object.toolId}
                      </span>
                      <span className="app-sm block truncate text-[var(--texto-3)]">
                        motivo {approval.reason}
                        {approval.origin.kind === "agentExecution"
                          ? ` · vence ${fmt.relative(approval.origin.deadline, now.getTime())}`
                          : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {mentions.length > 0 ? (
          <Section title="Menções a você" count={mentions.length}>
            <ul className="cascata pilha-solta" data-chegada="foco">
              {mentions.map(({ task, comment }) => {
                const author =
                  comment.author.kind === "member"
                    ? state.members.find((m) => m.id === comment.author.id)?.displayName
                    : state.agents.find((a) => a.id === comment.author.id)?.name;
                return (
                  <li key={comment.id}>
                    <Link href={`/estrutura/tarefas/${task.id}#comentario-${comment.id}`} className="item-solto py-3">
                      {/* A menção é sobre uma Tarefa: o selo é o do Tipo dela. */}
                      <SeloDaTarefa state={state} task={task} />
                      <span className="min-w-0 flex-1">
                        <span className="app-base block truncate text-[var(--texto)]">
                          {author ?? "Alguém"} mencionou você em “{task.title}”
                        </span>
                        <span className="app-sm block truncate text-[var(--texto-3)]">
                          {fmt.relative(comment.createdAt)} · {comment.content}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="app-meta px-1 pt-2">
              Uma menção sai daqui quando a conversa em que ela está é resolvida.
            </p>
          </Section>
        ) : null}

        {watched.length > 0 ? (
          <Section title="Em Tarefas que você acompanha" count={watched.length}>
            <ul className="cascata pilha-solta" data-chegada="foco">
              {watched.map(({ task, comment }) => {
                const author =
                  comment.author.kind === "member"
                    ? state.members.find((m) => m.id === comment.author.id)?.displayName
                    : state.agents.find((a) => a.id === comment.author.id)?.name;
                return (
                  <li key={comment.id}>
                    <Link href={`/estrutura/tarefas/${task.id}#comentario-${comment.id}`} className="item-solto py-3">
                      <SeloDaTarefa state={state} task={task} />
                      <span className="min-w-0 flex-1">
                        <span className="app-base block truncate text-[var(--texto)]">
                          {author ?? "Alguém"} comentou em “{task.title}”
                        </span>
                        <span className="app-sm block truncate text-[var(--texto-3)]">
                          {fmt.relative(comment.createdAt)} · {comment.content}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="app-meta px-1 pt-2">
              Você acompanha estas Tarefas como observador. O aviso sai quando a conversa é resolvida, ou quando você deixa de acompanhar.
            </p>
          </Section>
        ) : null}

        {conversations.length > 0 ? (
          <Section title="Conversas atribuídas a você" count={conversations.length}>
            <ul className="cascata pilha-solta" data-chegada="foco">
              {conversations.map((conversation) => {
                const contact = conversation.contactId
                  ? state.contacts.find((c) => c.id === conversation.contactId)
                  : undefined;
                return (
                  <li key={conversation.id}>
                    <Link href={`/crm/caixa-de-entrada/${conversation.id}`} className="item-solto py-3">
                      <Selo icone={ICONE_DE_OBJETO.conversa} cor="var(--info)" lavado="var(--info-lavado)" />
                      <span className="min-w-0 flex-1">
                        <span className="app-base block truncate text-[var(--texto)]">
                          {contact ? contactDisplayName(contact) : "Contato não resolvido"}
                        </span>
                        <span className="app-sm block truncate text-[var(--texto-3)]">
                          {conversation.state} · {conversation.title}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}

        {overdue.length > 0 ? (
          <Section title="Tarefas vencidas" count={overdue.length}>
            <ul className="cascata pilha-solta" data-chegada="foco">
              {overdue.map((task) => (
                <li key={task.id}>
                  <Link href={`/estrutura/tarefas/${task.id}`} className="item-solto py-3">
                    <SeloDaTarefa state={state} task={task} tom="erro" />
                    <span className="min-w-0 flex-1">
                      <span className="app-base block truncate text-[var(--texto)]">{task.title}</span>
                      <span className="app-sm block truncate text-[var(--texto-3)]">
                        {state.taskTypes.find((t) => t.id === task.taskTypeId)?.name ?? "Tarefa"}
                        {task.readableId ? ` · ${task.readableId}` : ""}
                        {task.dueDate ? ` · vence ${fmt.taskDate(task.dueDate)}` : ""}
                      </span>
                    </span>
                    <ConditionMarker tone="danger">Vencida</ConditionMarker>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {blocked.length > 0 ? (
          <Section title="Tarefas bloqueadas" count={blocked.length}>
            <ul className="cascata pilha-solta" data-chegada="foco">
              {blocked.map((task) => (
                <li key={task.id}>
                  <Link href={`/estrutura/tarefas/${task.id}`} className="item-solto py-3">
                    <SeloDaTarefa state={state} task={task} tom="aviso" />
                    <span className="min-w-0 flex-1">
                      <span className="app-base block truncate text-[var(--texto)]">{task.title}</span>
                      <span className="app-sm block truncate text-[var(--texto-3)]">
                        {state.taskTypes.find((t) => t.id === task.taskTypeId)?.name ?? "Tarefa"}
                        {task.readableId ? ` · ${task.readableId}` : ""}
                      </span>
                    </span>
                    <ConditionMarker tone="warning">Bloqueada por Dependência</ConditionMarker>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {failedExecutions.length > 0 ? (
          <Section title="Execuções que falharam" count={failedExecutions.length}>
            <ul className="cascata pilha-solta" data-chegada="foco">
              {failedExecutions.map((execution) => (
                <li key={execution.id}>
                  <Link href={`/ia/execucoes/${execution.id}`} className="item-solto py-3">
                    <Selo icone={ICONE_DE_OBJETO.execucao} cor="var(--erro)" lavado="var(--erro-lavado)" />
                    <span className="min-w-0 flex-1">
                      <span className="app-base block truncate text-[var(--texto)]">
                        {state.agents.find((a) => a.id === execution.agentId)?.name ?? "Agente"}
                      </span>
                      <span className="app-sm block truncate text-[var(--texto-3)]">
                        {execution.terminationReason ?? "sem motivo registrado"} ·{" "}
                        {fmt.relative(execution.startedAt, now.getTime())}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </CorpoDeTela>
    </div>
  );
}
