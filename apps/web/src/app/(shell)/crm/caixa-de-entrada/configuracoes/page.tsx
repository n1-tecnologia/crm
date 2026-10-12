"use client";

/**
 * T22 — Configurações da Caixa de Entrada.
 *
 * B11 — there is exactly one Inbox per workspace. This screen configures IT,
 * plus the Channels and Queues that feed it; it never creates a second inbox.
 * Canais e Filas são recortes da Caixa, não caixas separadas — por isso os
 * dois grupos vivem nesta tela, abaixo dela.
 */

import Link from "next/link";
import { useData } from "@/dados/store";
import { CHANNEL_CAPABILITIES } from "@n1/dominio/operations";
import { PROVEDORES, provedorDoCanal } from "@n1/dominio/provedores-de-canal";
import { MarcaDeConexaoSimulada, SeloDeOrigem, SeloDoProvedor } from "@/features/crm/selo-do-provedor";
import { CHANNEL_TYPE_LABEL } from "@/features/shell/format";
import { CorpoDeTela, EmptyState, PageHeader, Painel, Section, StateSeal } from "@/features/shell/ui";

const DISTRIBUTION_LABEL: Record<string, string> = {
  herdarDaCaixa: "herda da Caixa",
  manual: "manual",
  rodizio: "rodízio",
  menorCarga: "menor carga",
};

const CONNECTION_LABEL: Record<string, string> = {
  conectada: "conectada",
  desconectada: "desconectada",
  comErro: "com erro",
};

const WEEK_DAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default function ConfiguracoesDaCaixaPage() {
  const state = useData((data) => data);
  const { inbox, channels, queues } = state;
  const owner = state.members.find((m) => m.id === inbox.defaultContactOwnerMemberId);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/crm/caixa-de-entrada" className="hover:underline">
            Caixa de Entrada
          </Link>
        }
        title="Configurações da Caixa de Entrada"
        meta={`${channels.length} Canal(is) · ${queues.length} Fila(s)`}
      />

      <CorpoDeTela>
        <Section title="Caixa">
          <Painel className="p-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Row label="Prazo de reabertura">
                {inbox.reopenWindowHours}h — uma Mensagem recebida dentro dela reabre a mesma Conversa; fora,
                cria uma nova.
              </Row>
              <Row label="Distribuição padrão">{DISTRIBUTION_LABEL[inbox.defaultDistribution]}</Row>
              <Row label="Proprietário padrão de Contato">{owner?.displayName ?? "não definido"}</Row>
              <Row label="Horário de atendimento">
                {inbox.businessHours ? formatHours(inbox.businessHours.days) : "sem horário definido"}
              </Row>
            </dl>
          </Painel>
        </Section>

        <Section title="Canais" count={channels.length}>
          {channels.length === 0 ? (
            <EmptyState
              title="Nenhum Canal configurado."
              hint="Sem Canal não há Conversa: é por ele que a Mensagem entra e sai."
            />
          ) : (
            <ul className="grade-solta sm:grid-cols-2">
              {channels.map((channel) => {
                const capabilities = CHANNEL_CAPABILITIES[channel.channelType];
                const queue = queues.find((q) => q.id === channel.defaultQueueId);
                const approved = channel.messageTemplates.filter((t) => t.approval === "aprovado").length;
                const provedor = provedorDoCanal(channel);
                return (
                  <li key={channel.id}>
                    <Link
                      href={`/crm/caixa-de-entrada/configuracoes/canais/${channel.id}`}
                      className="item-solto h-full"
                      data-bloco="true"
                    >
                      <p className="flex items-start justify-between gap-2">
                        <span className="app-md" style={{ color: "var(--texto)" }}>
                          {channel.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <SeloDoProvedor canal={channel} />
                          <SeloDeOrigem canal={channel} />
                          <MarcaDeConexaoSimulada canal={channel} />
                          <StateSeal state={channel.lifecycle} />
                        </span>
                      </p>
                      <p className="app-meta mt-1">
                        {provedor ? PROVEDORES[provedor].rotulo : (CHANNEL_TYPE_LABEL[channel.channelType] ?? channel.channelType)} ·{" "}
                        <span style={channel.connection === "conectada" ? undefined : { color: "var(--aviso)" }}>
                          {CONNECTION_LABEL[channel.connection]}
                        </span>
                      </p>
                      <p className="app-meta mt-2">
                        janela de{" "}
                        {capabilities.responseWindowHours === undefined
                          ? "resposta: nenhuma"
                          : `${capabilities.responseWindowHours}h`}{" "}
                        · {approved} modelo(s) aprovado(s) · fila {queue?.name ?? "nenhuma"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Filas" count={queues.length}>
          {queues.length === 0 ? (
            <EmptyState
              title="Nenhuma Fila."
              hint="A Fila é a única origem de permissão por referência operacional: sem ela, o acesso vem só do Papel."
            />
          ) : (
            <ul className="grade-solta sm:grid-cols-2">
              {queues.map((queue) => {
                const eligible = queue.eligibleMemberIds.length;
                const teams = queue.eligibleTeamIds.length;
                const load = state.conversations.filter(
                  (conversation) => conversation.queueId === queue.id && conversation.lifecycle === "ativo",
                ).length;
                return (
                  <li key={queue.id}>
                    <Link
                      href={`/crm/caixa-de-entrada/configuracoes/filas/${queue.id}`}
                      className="item-solto h-full"
                      data-bloco="true"
                    >
                      <p className="flex items-start justify-between gap-2">
                        <span className="app-md" style={{ color: "var(--texto)" }}>
                          {queue.name}
                        </span>
                        <StateSeal state={queue.lifecycle} />
                      </p>
                      {queue.description ? <p className="app-meta mt-1">{queue.description}</p> : null}
                      <p className="app-meta mt-2">
                        distribuição {DISTRIBUTION_LABEL[queue.distribution]} · {eligible} Membro(s) e {teams}{" "}
                        Equipe(s) elegíveis · {load} Conversa(s)
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </CorpoDeTela>
    </div>
  );
}

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div>
      <dt className="app-meta">{label}</dt>
      <dd className="app-base mt-0.5" style={{ color: "var(--texto)" }}>
        {children}
      </dd>
    </div>
  );
}

function formatHours(
  days: ReadonlyArray<{ readonly weekDay: number; readonly from: string; readonly to: string }>,
): string {
  if (days.length === 0) return "sem horário definido";
  return days.map((day) => `${WEEK_DAYS[day.weekDay]} ${day.from}–${day.to}`).join(", ");
}
