"use client";

/**
 * T17 — Negócios. The board is the default reading: one column per Stage of the
 * chosen Funnel, in `order`.
 *
 * B58 — every stage is a progression stage, so `ganho` and `perdido` are NOT
 * columns: they are a situation the Deal carries while staying in its last
 * stage. Closed deals appear in their own column-independent strip.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/data/store";
import { weightedValue } from "@/data/derive";
import { DealCard, dealCardData } from "@/features/crm/deal-card";
import { moveDealToStage } from "@/data/operations";
import { DEAL_SITUATION_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { Briefcase, Plus } from "lucide-react";
import {
  Button,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  Pilula,
  Section,
  Select,
  Toast,
} from "@/features/shell/ui";
import {
  CreateRecordDialog,
  useCreateRecordDialog,
} from "@/features/crm/create-record-dialog";

/** A situação do Negócio encerrado no vocabulário de cor do sistema: `perdido` não é vermelho. */
const SITUACAO_COR: Record<string, string> = {
  ganho: "var(--cor-neg-ganho)",
  perdido: "var(--cor-neg-perdido)",
};

export default function NegociosPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const run = useRun();
  const funnels = state.funnels.filter(
    (funnel) => funnel.lifecycle === "ativo",
  );
  const [funnelId, setFunnelId] = useState(funnels[0]?.id ?? "");
  const [showClosed, setShowClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const { creating, openCreate, closeCreate } =
    useCreateRecordDialog("negocio");
  const router = useRouter();

  const funnel = funnels.find((f) => f.id === funnelId) ?? funnels[0];

  if (!funnel) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Negócios" />
        <CorpoDeTela>
          <EmptyState
            title="Nenhum Funil ativo."
            hint="Um Negócio existe sempre dentro de um Funil e de uma Etapa: crie um Funil primeiro."
            action={
              <Link href="/crm/funis" className="btn btn-contorno btn-sm">
                Ir para Funis
              </Link>
            }
          />
        </CorpoDeTela>
      </div>
    );
  }

  const deals = state.deals.filter(
    (deal) => deal.funnelId === funnel.id && deal.lifecycle === "ativo",
  );
  const open = deals.filter((deal) => deal.situation === "aberto");
  const closed = deals.filter((deal) => deal.situation !== "aberto");
  const stages = [...funnel.stages].sort((a, b) => a.order - b.order);

  const drop = (stageId: string) => {
    if (!dragging) return;
    const result = run((data, memberId) =>
      moveDealToStage(data, memberId, dragging, stageId),
    );
    setError(result.ok ? null : result.error);
    setDragging(null);
  };

  const totalOpen = open.reduce(
    (sum, deal) => sum + (deal.value?.amount ?? 0),
    0,
  );
  const totalWeighted = open.reduce(
    (sum, deal) => sum + (weightedValue(state, deal) ?? 0),
    0,
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Negócios"
        icon={<Icone de={Briefcase} tamanho="sm" />}
        meta={`${open.length} ${open.length === 1 ? "aberto" : "abertos"}`}
        details={
          <>
            <span className="app-meta app-numero">
              {fmt.money({ amount: totalOpen, currency: "BRL" })} em valor
              declarado
            </span>
            <span className="app-meta app-numero">
              {fmt.money({ amount: totalWeighted, currency: "BRL" })} ponderado
              pela probabilidade
            </span>
          </>
        }
        actions={
          <>
            <span className="flex items-center gap-2">
              <label
                htmlFor="funil-do-quadro"
                className="app-sm shrink-0"
                style={{ color: "var(--texto-3)" }}
              >
                Funil
              </label>
              <span className="w-48">
                <Select
                  id="funil-do-quadro"
                  value={funnel.id}
                  onChange={setFunnelId}
                  options={funnels.map((option) => ({
                    value: option.id,
                    label: option.name,
                  }))}
                />
              </span>
            </span>
            <Button onClick={openCreate}>Novo Negócio</Button>
          </>
        }
      />

      <CreateRecordDialog
        family="negocio"
        open={creating}
        onClose={closeCreate}
        onCreated={(rota) => router.push(rota)}
      />

      <CorpoDeTela>
        {error ? <Toast tone="error">{error}</Toast> : null}

        {/*
          As Etapas aparecem mesmo sem Negócio: um Funil recém-criado é feito
          das colunas, e escondê-las faria ele parecer vazio de configuração,
          não só de Negócios. Cada coluna já diz "Nenhum Negócio nesta Etapa"
          e oferece o "+".
        */}
        {stages.length === 0 ? (
          <EmptyState
            title={`${funnel.name} não tem Etapa.`}
            hint="Um Negócio só existe dentro de uma Etapa: configure o Funil antes de criar."
          />
        ) : (
          <div className="palco-quadro flex gap-4 overflow-x-auto pb-2">
            {stages.map((stage) => {
              const column = open.filter((deal) => deal.stageId === stage.id);
              const columnValue = column.reduce(
                (sum, deal) => sum + (deal.value?.amount ?? 0),
                0,
              );
              return (
                <div
                  key={stage.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => drop(stage.id)}
                  className="trilho flex w-[19.2rem] shrink-0 flex-col p-3"
                >
                  <div className="mb-3 flex items-start gap-2.5">
                    {/* A contagem em selo: é o que se lê primeiro ao varrer o quadro. */}
                    <span
                      aria-hidden="true"
                      className="app-base app-numero grid shrink-0 place-items-center rounded-[var(--r-controle)]"
                      style={{
                        width: "var(--controle-h-sm)",
                        height: "var(--controle-h-sm)",
                        background: "var(--acento-lavado)",
                        color: "var(--acento)",
                        fontWeight: 600,
                      }}
                    >
                      {column.length}
                    </span>
                    <span className="min-w-0 flex-1">
                      <h2
                        className="app-md flex items-center gap-1.5 truncate"
                        style={{ color: "var(--texto)" }}
                      >
                        {stage.color ? (
                          <span
                            aria-hidden="true"
                            className="pilula-ponto"
                            style={{ backgroundColor: stage.color }}
                          />
                        ) : null}
                        {stage.name}
                      </h2>
                      <span className="app-meta app-numero block truncate">
                        {stage.defaultProbability}% padrão ·{" "}
                        {fmt.money({ amount: columnValue, currency: "BRL" })}
                      </span>
                    </span>
                  </div>

                  <div className="pilha-solta">
                    {column.length === 0 ? (
                      <button
                        type="button"
                        onClick={openCreate}
                        className="app-sm grid place-items-center gap-2 rounded-[var(--r-painel)] border border-dashed border-[var(--linha-forte)] px-2 py-6 text-[var(--texto-3)] transition-colors hover:border-[var(--acento)] hover:text-[var(--texto)]"
                      >
                        <span
                          aria-hidden="true"
                          className="grid place-items-center rounded-full border border-[var(--linha-forte)]"
                          style={{
                            width: "var(--controle-h-sm)",
                            height: "var(--controle-h-sm)",
                          }}
                        >
                          <Icone de={Plus} tamanho="sm" />
                        </span>
                        Nenhum Negócio nesta Etapa.
                      </button>
                    ) : (
                      column.map((deal) => (
                        <DealCard
                          key={deal.id}
                          data={dealCardData(state, deal)}
                          href={`/crm/negocios/${deal.id}`}
                          onDragStart={() => setDragging(deal.id)}
                          onDragEnd={() => setDragging(null)}
                        />
                      ))
                    )}
                  </div>

                  {stage.requirements.length > 0 ? (
                    <p className="app-meta mt-2 px-1">
                      {stage.requirements.length} exigência(s) para entrar ou
                      sair desta Etapa.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6">
          <Section
            title="Negócios encerrados"
            count={closed.length}
            action={
              closed.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClosed((value) => !value)}
                >
                  {showClosed ? "Ocultar" : "Mostrar"}
                </Button>
              ) : null
            }
          >
            {closed.length === 0 ? (
              <EmptyState compact title="Nenhum Negócio ganho ou perdido neste Funil." />
            ) : showClosed ? (
              <ul className="grade-solta sm:grid-cols-2 lg:grid-cols-3">
                {closed.map((deal) => {
                  const stage = funnel.stages.find(
                    (s) => s.id === deal.stageId,
                  );
                  return (
                    <li key={deal.id}>
                      {/* Encerrado é peça atenuada: continua peça, só não disputa atenção com o que está aberto. */}
                      <Link
                        href={`/crm/negocios/${deal.id}`}
                        className="item-solto"
                        data-bloco="true"
                        data-atenuado="true"
                      >
                        <p className="flex items-start justify-between gap-2">
                          <span
                            className="app-md min-w-0 truncate"
                            style={{ color: "var(--texto)" }}
                          >
                            {deal.title}
                          </span>
                          <Pilula
                            cor={SITUACAO_COR[deal.situation] ?? "var(--texto-3)"}
                            comPonto
                            className="shrink-0"
                          >
                            {DEAL_SITUATION_LABEL[deal.situation]}
                          </Pilula>
                        </p>
                        <p className="app-meta mt-1">
                          Última Etapa: {stage?.name ?? "—"}
                          {deal.value ? ` · ${fmt.money(deal.value)}` : ""}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="app-meta">
                Preservam a última Etapa que ocuparam e não aparecem nas
                colunas.
              </p>
            )}
          </Section>
        </div>
      </CorpoDeTela>
    </div>
  );
}
