"use client";

/**
 * T24 — Fila.
 *
 * B70 — being eligible for a Queue is the only origin of permission by
 * operational reference: it grants `ver` over the Conversations that pass
 * through it, and over nothing else. The screen states that in words, because
 * a list of names does not say what the names can do.
 */

import Link from "next/link";
import { use } from "react";
import { useData } from "@/data/store";
import { contactDisplayName } from "@/data/derive";
import { AVAILABILITY_LABEL, CHANNEL_TYPE_LABEL, CONVERSATION_STATE_LABEL } from "@/features/shell/format";
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

const DISTRIBUTION_LABEL: Record<string, string> = {
  herdarDaCaixa: "herda da Caixa de Entrada",
  manual: "manual",
  rodizio: "rodízio",
  menorCarga: "menor carga",
};

const WEEK_DAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];


export default function FilaPage({ params }: { params: Promise<{ fila: string }> }) {
  const { fila } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();
  const queue = state.queues.find((q) => q.id === fila);

  if (!queue) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Fila não encontrada" />
        <CorpoDeTela>
          <EmptyState title="Fila não encontrada." hint="Ela pode ter sido removida do Espaço de Trabalho." />
        </CorpoDeTela>
      </div>
    );
  }

  const conversations = state.conversations.filter(
    (conversation) => conversation.queueId === queue.id && conversation.lifecycle === "ativo",
  );
  const teamMemberIds = new Set(
    queue.eligibleTeamIds.flatMap(
      (teamId) => state.teams.find((team) => team.id === teamId)?.memberIds ?? [],
    ),
  );
  const eligibleMemberIds = new Set([...queue.eligibleMemberIds, ...teamMemberIds]);
  const channels = state.channels.filter((channel) => channel.defaultQueueId === queue.id);
  const owner = state.members.find((m) => m.id === queue.defaultContactOwnerMemberId);

  const loadOf = (memberId: string): number =>
    conversations.filter(
      (conversation) => conversation.assignee?.kind === "member" && conversation.assignee.id === memberId,
    ).length;

  const businessHours = queue.businessHours
    ? queue.businessHours.days.map((day) => `${WEEK_DAYS[day.weekDay]} ${day.from}–${day.to}`).join(", ")
    : "herda da Caixa de Entrada";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <>
            <Link href="/crm/caixa-de-entrada" className="hover:underline">
              Caixa de Entrada
            </Link>
            {" › "}
            <Link href="/crm/caixa-de-entrada/configuracoes" className="hover:underline">
              Configurações
            </Link>
          </>
        }
        title={queue.name}
        seal={<StateSeal state={queue.lifecycle} />}
        meta={`${conversations.length} Conversa(s) ativa(s)`}
      />

      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="grid min-w-0 content-start gap-3">
            {queue.description ? (
              <p className="app-base px-1" style={{ color: "var(--texto-3)" }}>
                {queue.description}
              </p>
            ) : null}

            <Painel>
              <CabecalhoDePainel titulo="Elegíveis" contagem={eligibleMemberIds.size} />
              <div className="p-3">
                <p className="app-meta mb-2 px-1">
                  Ser elegível concede ver as Conversas que passam por esta Fila — e nada além disso.
                </p>
                {eligibleMemberIds.size === 0 ? (
                  <EmptyState
                    compact
                    title="Nenhum Membro elegível."
                    hint="Sem elegíveis, esta Fila não distribui: as Conversas ficam sem Atribuído."
                  />
                ) : (
                  <ul className="pilha-solta">
                    {[...eligibleMemberIds].map((memberId) => {
                      const member = state.members.find((m) => m.id === memberId);
                      if (!member) return null;
                      const viaTeam = teamMemberIds.has(memberId);
                      const direct = queue.eligibleMemberIds.includes(memberId);
                      return (
                        <li
                          key={memberId}
                          className="item-solto"
                          data-estatico="true"
                          style={{ paddingBlock: "var(--e-2)" }}
                        >
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/configuracoes/membros/${member.id}`}
                              className="app-md hover:underline"
                              style={{ color: "var(--texto)" }}
                            >
                              {member.displayName}
                            </Link>
                            <p className="app-meta">
                              {direct ? "elegível diretamente" : ""}
                              {direct && viaTeam ? " · " : ""}
                              {viaTeam ? "elegível por Equipe" : ""}
                            </p>
                          </div>
                          <div className="app-meta shrink-0 text-right">
                            <p>{AVAILABILITY_LABEL[member.availability.value] ?? member.availability.value}</p>
                            <p className="app-numero">
                              {loadOf(memberId)}
                              {queue.maxConversationsPerAttendant !== undefined
                                ? ` de ${queue.maxConversationsPerAttendant}`
                                : ""}{" "}
                              Conversa(s)
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Conversas na Fila" contagem={conversations.length} />
              <div className="p-3">
                {conversations.length === 0 ? (
                  <EmptyState compact title="Nenhuma Conversa ativa nesta Fila." />
                ) : (
                  <ul className="pilha-solta">
                    {conversations.slice(0, 20).map((conversation) => {
                      const contact = conversation.contactId
                        ? state.contacts.find((c) => c.id === conversation.contactId)
                        : undefined;
                      const assignee =
                        conversation.assignee?.kind === "member"
                          ? state.members.find((m) => m.id === conversation.assignee?.id)?.displayName
                          : conversation.assignee?.kind === "agent"
                            ? state.agents.find((a) => a.id === conversation.assignee?.id)?.name
                            : undefined;
                      const last = [...conversation.messages]
                        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                        .at(-1);
                      return (
                        <li key={conversation.id}>
                          <Link
                            href={`/crm/caixa-de-entrada/${conversation.id}`}
                            className="item-solto"
                            style={{ paddingBlock: "var(--e-2)" }}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                                {contact ? contactDisplayName(contact) : "Contato não resolvido"}
                              </span>
                              <span className="app-meta block truncate">{conversation.title}</span>
                            </span>
                            <span className="app-meta shrink-0 text-right">
                              <span className="block">{CONVERSATION_STATE_LABEL[conversation.state]}</span>
                              <span className="block">{assignee ?? "sem Atribuído"}</span>
                              {last ? <span className="app-numero block">{fmt.relative(last.createdAt)}</span> : null}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {conversations.length > 20 ? (
                  <p className="app-meta app-numero px-1 pt-2">
                    Mostrando 20 de {conversations.length}. Use os filtros da Caixa de Entrada para ver todas.
                  </p>
                ) : null}
              </div>
            </Painel>
          </div>

          <aside className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Configuração">
              <dl>
                <RecordRow label="Distribuição">{DISTRIBUTION_LABEL[queue.distribution]}</RecordRow>
                <RecordRow label="Limite por atendente">
                  {queue.maxConversationsPerAttendant ?? "sem limite"}
                </RecordRow>
                <RecordRow label="Proprietário padrão de Contato">{owner?.displayName ?? "não definido"}</RecordRow>
                <RecordRow label="Horário de atendimento">
                  <span title={businessHours}>{businessHours}</span>
                </RecordRow>
              </dl>
            </RecordPanel>

            <RecordPanel title="Canais que entram aqui" count={channels.length}>
              {channels.length === 0 ? (
                <EmptyState compact title="Nenhum Canal usa esta Fila como padrão." />
              ) : (
                <ul className="pilha-solta">
                  {channels.map((channel) => (
                    <li key={channel.id}>
                      <Link href={`/crm/caixa-de-entrada/configuracoes/canais/${channel.id}`} className="item-solto">
                        <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                          {channel.name}
                        </span>
                        <span className="app-meta shrink-0">
                          ({CHANNEL_TYPE_LABEL[channel.channelType] ?? channel.channelType})
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>
          </aside>
        </div>
      </CorpoDeTela>
    </div>
  );
}
