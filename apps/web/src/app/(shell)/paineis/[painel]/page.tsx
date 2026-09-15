"use client";

/**
 * T46 — Painel.
 *
 * RN-PAI-15 — o Widget lê SEMPRE pelas permissões de quem olha, e a Âncora não
 * concede acesso (INV-PAI-09). Por isso o mesmo Painel mostra números
 * diferentes para Membros diferentes, e um Widget cuja Fonte o visualizador não
 * alcança diz "Fonte sem acesso" em vez de mostrar zero: zero e sem acesso são
 * respostas diferentes.
 *
 * RN-PAI-13 — nada é convertido entre moedas: uma linha por moeda, rotulada.
 */

import { use, useState } from "react";
import { useData, useSession } from "@/dados/store";
import { goalProgress, widgetReading, type WidgetReading } from "@n1/dominio/derive";
import Link from "next/link";
import { RESOURCE_TYPE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { CorpoDeTela, Divisor, EmptyState, NoAccessState, PageHeader, Section, StateSeal } from "@/features/shell/ui";

const VIEW_TYPE_LABEL: Record<string, string> = {
  numero: "número",
  barras: "barras",
  linhas: "linhas",
  pizza: "pizza",
  funil: "funil",
  tabela: "tabela",
  listaDeRegistros: "lista de registros",
  calendario: "calendário",
  texto: "texto",
};

export default function PainelPage({ params }: { params: Promise<{ painel: string }> }) {
  const { painel } = use(params);
  const state = useData((data) => data);
  const { memberId } = useSession();
  const fmt = useFormat();
  const [now] = useState(() => new Date());
  const record = state.panels.find((p) => p.id === painel);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState
            title="Painel não encontrado."
            hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo."
          />
        </CorpoDeTela>
      </div>
    );
  }

  // Fase 4 — as Metas ancoradas no mesmo contêiner do Painel, lidas pelas permissões de quem olha.
  const anchor = record.anchor;
  const metas = anchor && (anchor.type === "space" || anchor.type === "folder" || anchor.type === "list")
    ? state.goals.filter((g) => g.lifecycle === "ativo" && g.anchor.type === anchor.type && g.anchor.id === anchor.id)
    : [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={record.name}
        seal={<StateSeal state={record.lifecycle} />}
        details={
          <>
            <span className="app-meta">
              {record.anchor ? `Ancorado em ${record.anchor.nameAtTheTime}` : "Painel do Espaço de Trabalho"}
            </span>
            <Divisor vertical />
            <span className="app-meta">
              Proprietário: {state.members.find((m) => m.id === record.ownerMemberId)?.displayName ?? "—"}
            </span>
            <Divisor vertical />
            {/* RN-PAI-15 — a regra vira título do dado, não parágrafo sob o cabeçalho. */}
            <span
              className="app-meta app-numero"
              title="Os valores refletem as SUAS permissões: outro Membro abre este mesmo Painel e vê números diferentes."
            >
              Momento de referência dos dados: {fmt.instant(now.toISOString())}
            </span>
          </>
        }
      />

      <CorpoDeTela>
        {metas.length > 0 ? (
          <Section title="Metas deste contêiner" count={metas.length}>
            <ul className="grade-solta sm:grid-cols-2">
              {metas.map((goal) => {
                const progresso = goalProgress(state, goal, memberId, now);
                return (
                  <li key={goal.id} className="item-solto" data-bloco="true" data-estatico="true">
                    <Link href="/estrutura/metas" className="app-md text-[var(--texto)] hover:underline">
                      {goal.name}
                    </Link>
                    {"kind" in progresso ? (
                      <p className="app-sm text-[var(--texto-3)]">sem acesso ao recorte</p>
                    ) : (
                      <>
                        <div
                          className="mt-2 overflow-hidden rounded-full"
                          style={{ height: "var(--barra-viz-h)", background: "var(--superficie-3)" }}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(progresso.ratio * 100)}
                          aria-label={`Progresso de ${goal.name}`}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.round(progresso.ratio * 100)}%`, background: "var(--acento)" }}
                          />
                        </div>
                        <p className="app-sm app-numero mt-1 text-[var(--texto)]">
                          {progresso.label} · {Math.round(progresso.ratio * 100)}%
                        </p>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}

        <Section title="Widgets" count={record.widgets.length}>
          {record.widgets.length === 0 ? (
            <EmptyState
              title="Este Painel está vazio."
              hint="Um Painel sem Widget não tem o que ler."
            />
          ) : (
            <ul className="grade-solta sm:grid-cols-2">
              {record.widgets.map((widget) => {
                const reading = widgetReading(state, widget, memberId, now);
                return (
                  <li key={widget.id} className="painel p-4">
                    <p className="app-md text-[var(--texto)]">
                      {widget.title}
                    </p>
                    <p className="app-sm mt-0.5 text-[var(--texto-3)]">
                      {VIEW_TYPE_LABEL[widget.viewType] ?? widget.viewType}
                      {widget.dataSource
                        ? ` · ${RESOURCE_TYPE_LABEL[widget.dataSource.target] ?? widget.dataSource.target}`
                        : ""}
                      {widget.dimensions[0] ? ` · por ${widget.dimensions[0].label}` : ""}
                    </p>

                    <div className="mt-3">
                      <WidgetBody reading={reading} formatMoney={fmt.money} />
                    </div>

                    {widget.fixedFilters.length > 0 ? (
                      <p className="app-sm mt-2 text-[var(--texto-3)]">
                        Filtro fixo: {widget.fixedFilters.map((filter) => filter.label).join(" · ")}
                      </p>
                    ) : null}
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

function WidgetBody({
  reading,
  formatMoney,
}: {
  readonly reading: WidgetReading;
  readonly formatMoney: (value: { readonly amount: number; readonly currency: string }) => string;
}) {
  if (reading.kind === "semAcesso") {
    return <NoAccessState what="Fonte deste Widget" />;
  }

  if (reading.kind === "texto") {
    return (
      <p className="app-base text-[var(--texto)]">{reading.content}</p>
    );
  }

  if (reading.kind === "numero") {
    return (
      <p>
        <span className="ed-titulo app-numero">
          {new Intl.NumberFormat("pt-BR").format(reading.value)}
        </span>{" "}
        <span className="app-sm text-[var(--texto-3)]">
          {reading.label}
        </span>
      </p>
    );
  }

  if (reading.kind === "moeda") {
    if (reading.byCurrency.length === 0) {
      return (
        <p className="app-base text-[var(--texto-3)]">
          Nenhum registro com valor.
        </p>
      );
    }
    return (
      <ul className="space-y-0.5">
        {reading.byCurrency.map((entry) => (
          <li key={entry.currency}>
            <span className="ed-titulo app-numero">
              {formatMoney({ amount: entry.amount, currency: entry.currency })}
            </span>{" "}
            <span className="app-sm text-[var(--texto-3)]">
              {reading.label}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (reading.rows.length === 0) {
    return (
      <p className="app-base text-[var(--texto-3)]">
        Nenhum registro no recorte deste Widget.
      </p>
    );
  }

  const largest = Math.max(...reading.rows.map((row) => row.value), 1);
  return (
    <>
      <ul className="space-y-1">
        {reading.rows.map((row) => (
          <li key={row.label} className="app-sm">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[var(--texto)]">{row.label}</span>
              <span className="app-numero shrink-0 text-[var(--texto-3)]">
                {reading.currency
                  ? formatMoney({ amount: row.value, currency: reading.currency })
                  : new Intl.NumberFormat("pt-BR").format(row.value)}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="mt-0.5 block rounded-full"
              style={{ height: "var(--barra-viz-h)", background: "var(--acento)", width: `${Math.max(2, (row.value / largest) * 100)}%` }}
            />
          </li>
        ))}
      </ul>
      {reading.total > reading.shown ? (
        <p className="app-meta app-numero mt-2">
          Mostrando {reading.shown} de {reading.total}.
        </p>
      ) : null}
    </>
  );
}
