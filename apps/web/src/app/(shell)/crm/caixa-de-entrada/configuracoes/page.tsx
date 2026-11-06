"use client";

/**
 * T22 — Configurações da Caixa de Entrada.
 *
 * B11 — there is exactly one Inbox per workspace. This screen configures IT,
 * plus the Channels and Queues that feed it; it never creates a second inbox.
 * Canais e Filas são recortes da Caixa, não caixas separadas — por isso os
 * dois grupos vivem nesta tela, abaixo dela.
 *
 * Os Canais vêm de `plataforma.canais` (`useCanais`, ativos e arquivados) e a
 * quantidade de Conversas de cada Fila é o `total` de `GET /conversas?filaId=`.
 * A Caixa e as Filas em si são configuração do Espaço e seguem no store.
 */

import Link from "next/link";
import { useCanais } from "@/dados/crm/canais";
import { useConversas } from "@/dados/crm/conversas";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { useData } from "@/dados/store";
import type { Canal } from "@n1/dominio/crm/canais";
import { capacidadesDoCanal } from "@n1/dominio/crm/capacidades";
import { PROVEDORES } from "@n1/dominio/provedores-de-canal";
import { MarcaDeConexaoSimulada, SeloDeOrigem, SeloDoProvedor } from "@/features/crm/selo-do-provedor";
import { CHANNEL_TYPE_LABEL } from "@/features/shell/format";
import { Button, CorpoDeTela, EmptyState, PageHeader, Painel, Section, StateSeal } from "@/features/shell/ui";

const DISTRIBUTION_LABEL: Record<string, string> = {
  herdarDaCaixa: "herda da Caixa",
  manual: "manual",
  rodizio: "rodízio",
  menorCarga: "menor carga",
};

const CONNECTION_LABEL: Record<string, string> = {
  conectada: "conectada",
  desconectada: "desconectada",
  com_erro: "com erro",
};

const WEEK_DAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default function ConfiguracoesDaCaixaPage() {
  const state = useData((data) => data);
  const { inbox, queues } = state;
  // Ativos e arquivados: o arquivado continua visível (e abre a ficha) como no modelo antigo.
  const ativos = useCanais({ estado: "ativo", limite: 100 });
  const arquivados = useCanais({ estado: "arquivado", limite: 100 });
  const channels: readonly Canal[] = [...(ativos.data?.itens ?? []), ...(arquivados.data?.itens ?? [])];
  const canaisProntos = ativos.data !== undefined && arquivados.data !== undefined;
  const falhaDosCanais = ativos.error ?? arquivados.error;
  const owner = state.members.find((m) => m.id === inbox.defaultContactOwnerMemberId);
  const permissaoParaConectar = usePodeNoCrm("criar", "canal");
  const botaoConectar =
    permissaoParaConectar === undefined ? (
      <Link href="/crm/caixa-de-entrada/configuracoes/canais/conectar" className="btn btn-solido btn-sm alvo-toque">
        Conectar Canal
      </Link>
    ) : (
      <Button variant="primary" size="sm" disabled disabledReason={permissaoParaConectar}>
        Conectar Canal
      </Button>
    );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/crm/caixa-de-entrada" className="hover:underline">
            Caixa de Entrada
          </Link>
        }
        title="Configurações da Caixa de Entrada"
        meta={`${canaisProntos ? channels.length : "—"} Canal(is) · ${queues.length} Fila(s)`}
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

        <Section title="Canais" {...(canaisProntos ? { count: channels.length } : {})} action={botaoConectar}>
          {!canaisProntos ? (
            falhaDosCanais ? (
              <EmptyState title="Não foi possível carregar os Canais." hint={falhaDosCanais.message} />
            ) : (
              <p role="status" className="app-meta px-1">
                Carregando os Canais…
              </p>
            )
          ) : channels.length === 0 ? (
            <EmptyState
              title="Nenhum Canal configurado."
              hint="Sem Canal não há Conversa: é por ele que a Mensagem entra e sai."
              action={botaoConectar}
            />
          ) : (
            <ul className="grade-solta sm:grid-cols-2">
              {channels.map((channel) => {
                const capabilities = capacidadesDoCanal({ channelType: channel.tipo, provider: channel.provedor });
                const queue = queues.find((q) => q.id === channel.filaPadraoId);
                return (
                  <li key={channel.id}>
                    <Link
                      href={`/crm/caixa-de-entrada/configuracoes/canais/${channel.id}`}
                      className="item-solto h-full"
                      data-bloco="true"
                    >
                      <p className="flex items-start justify-between gap-2">
                        <span className="app-md" style={{ color: "var(--texto)" }}>
                          {channel.nome}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <SeloDoProvedor canal={channel} />
                          <SeloDeOrigem canal={channel} />
                          <MarcaDeConexaoSimulada canal={channel} />
                          <StateSeal state={channel.estado} />
                        </span>
                      </p>
                      <p className="app-meta mt-1">
                        {PROVEDORES[channel.provedor]?.rotulo ?? CHANNEL_TYPE_LABEL[channel.tipo] ?? channel.tipo} ·{" "}
                        <span style={channel.conexao === "conectada" ? undefined : { color: "var(--aviso)" }}>
                          {CONNECTION_LABEL[channel.conexao]}
                        </span>
                      </p>
                      <p className="app-meta mt-2">
                        janela de{" "}
                        {capabilities.responseWindowHours === undefined
                          ? "resposta: nenhuma"
                          : `${capabilities.responseWindowHours}h`}{" "}
                        · fila {queue?.name ?? "nenhuma"}
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
                        Equipe(s) elegíveis · <CargaDaFila filaId={queue.id} /> Conversa(s)
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

/** As Conversas ativas da Fila: o `total` da api (uma linha pedida basta), não o tamanho de uma página. */
function CargaDaFila({ filaId }: { readonly filaId: string }) {
  const conversas = useConversas({ filaId, limite: 1 });
  return <>{conversas.data?.total ?? "—"}</>;
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
