"use client";

/**
 * T24 — Fila.
 *
 * B70 — being eligible for a Queue is the only origin of permission by
 * operational reference: it grants `ver` over the Conversations that pass
 * through it, and over nothing else. The screen states that in words, because
 * a list of names does not say what the names can do.
 *
 * As Conversas da Fila e a carga de cada Membro vêm de `GET /conversas`
 * (`filaId`, `atribuidoId`), e os Canais que entram aqui de `GET /canais`
 * (`useCanais`, pela Fila padrão do Canal): o número mostrado é sempre o `total`
 * da api, não o tamanho da página. A Fila em si (elegíveis, distribuição, horário)
 * é configuração do Espaço e segue no store.
 */

import Link from "next/link";
import { use } from "react";
import { useCanais } from "@/dados/crm/canais";
import { useConversas } from "@/dados/crm/conversas";
import { useData } from "@/dados/store";
import type { Queue } from "@n1/dominio/types";
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
  const queue = useData((data) => data.queues.find((q) => q.id === fila));

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

  return <FichaDaFila queue={queue} />;
}

function FichaDaFila({ queue }: { readonly queue: Queue }) {
  const state = useData((data) => data);
  const fmt = useFormat();
  // Uma página de 20 para a lista; o número do cabeçalho e do rodapé é o `total` da api.
  const conversas = useConversas({ filaId: queue.id, limite: 20 });
  const conversations = conversas.data?.itens ?? [];
  const totalDeConversas = conversas.data?.total;
  const canaisDaTabela = useCanais({ estado: "ativo", limite: 100 });
  const teamMemberIds = new Set(
    queue.eligibleTeamIds.flatMap(
      (teamId) => state.teams.find((team) => team.id === teamId)?.memberIds ?? [],
    ),
  );
  const eligibleMemberIds = new Set([...queue.eligibleMemberIds, ...teamMemberIds]);
  const channels = (canaisDaTabela.data?.itens ?? []).filter((channel) => channel.filaPadraoId === queue.id);
  const owner = state.members.find((m) => m.id === queue.defaultContactOwnerMemberId);

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
        meta={`${totalDeConversas ?? "—"} Conversa(s) ativa(s)`}
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
                              <CargaDoMembro filaId={queue.id} membroId={memberId} />
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
              <CabecalhoDePainel titulo="Conversas na Fila" contagem={totalDeConversas ?? 0} />
              <div className="p-3">
                {conversas.data === undefined ? (
                  <p role="status" className="app-meta px-1">
                    Carregando as Conversas…
                  </p>
                ) : conversations.length === 0 ? (
                  <EmptyState compact title="Nenhuma Conversa ativa nesta Fila." />
                ) : (
                  <ul className="pilha-solta">
                    {conversations.map((conversation) => {
                      const assignee =
                        conversation.atribuido?.tipo === "membro"
                          ? state.members.find((m) => m.id === conversation.atribuido?.id)?.displayName
                          : conversation.atribuido?.tipo === "agente"
                            ? state.agents.find((a) => a.id === conversation.atribuido?.id)?.name
                            : undefined;
                      return (
                        <li key={conversation.id}>
                          <Link
                            href={`/crm/caixa-de-entrada/${conversation.id}`}
                            className="item-solto"
                            style={{ paddingBlock: "var(--e-2)" }}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                                {conversation.contatoNome ?? "Contato não resolvido"}
                              </span>
                              <span className="app-meta block truncate">{conversation.titulo}</span>
                            </span>
                            <span className="app-meta shrink-0 text-right">
                              <span className="block">{CONVERSATION_STATE_LABEL[conversation.situacao]}</span>
                              <span className="block">{assignee ?? "sem Atribuído"}</span>
                              <span className="app-numero block">{fmt.relative(conversation.atualizadoEm)}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {totalDeConversas !== undefined && totalDeConversas > conversations.length ? (
                  <p className="app-meta app-numero px-1 pt-2">
                    Mostrando {conversations.length} de {totalDeConversas}. Use os filtros da Caixa de Entrada para ver todas.
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
                          {channel.nome}
                        </span>
                        <span className="app-meta shrink-0">
                          ({CHANNEL_TYPE_LABEL[channel.tipo] ?? channel.tipo})
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

/** Quantas Conversas abertas o Membro tem nesta Fila: o `total` de uma consulta de uma linha. */
function CargaDoMembro({ filaId, membroId }: { readonly filaId: string; readonly membroId: string }) {
  const carga = useConversas({ filaId, atribuidoId: membroId, situacao: "aberta", limite: 1 });
  return <>{carga.data?.total ?? "—"}</>;
}
