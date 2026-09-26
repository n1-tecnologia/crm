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
import { useData, useRun } from "@/dados/store";
import { weightedValue } from "@n1/dominio/derive";
import { DealCard, dealCardData } from "@/features/crm/deal-card";
import { useRecente } from "@/features/shell/recente";
import { ColunaDeQuadro, VazioDaColuna } from "@/features/shell/quadro";
import { moveDealToStage } from "@n1/dominio/operations";
import { DEAL_SITUATION_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { Briefcase } from "lucide-react";
import {
  Button,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  Pilula,
  RolagemNoTopo,
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
  const recente = useRecente();
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
          <RolagemNoTopo>
          <div className="flex gap-4">
            {stages.map((stage) => {
              const column = open.filter((deal) => deal.stageId === stage.id);
              const columnValue = column.reduce(
                (sum, deal) => sum + (deal.value?.amount ?? 0),
                0,
              );
              return (
                <ColunaDeQuadro
                  key={stage.id}
                  contagem={column.length}
                  nome={stage.name}
                  {...(stage.color ? { cor: stage.color } : {})}
                  onDrop={() => drop(stage.id)}
                  subtitulo={`${stage.defaultProbability}% padrão · ${fmt.money({ amount: columnValue, currency: "BRL" })}`}
                  {...(stage.requirements.length > 0
                    ? { rodape: `${stage.requirements.length} exigência(s) para entrar ou sair desta Etapa.` }
                    : {})}
                >
                    {column.length === 0 ? (
                      <VazioDaColuna texto="Nenhum Negócio nesta Etapa." onCriar={openCreate} />
                    ) : (
                      column.map((deal) => (
                        <DealCard
                          key={deal.id}
                          recente={deal.id === recente}
                          data={dealCardData(state, deal)}
                          href={`/crm/negocios/${deal.id}`}
                          onDragStart={() => setDragging(deal.id)}
                          onDragEnd={() => setDragging(null)}
                        />
                      ))
                    )}
                </ColunaDeQuadro>
              );
            })}
          </div>
          </RolagemNoTopo>
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
