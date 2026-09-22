"use client";

/**
 * A ABA FLOWS (23): cada Flow com a Categoria, o Canal publicador, a Versão
 * publicada e o rascunho (Pílulas, não selos: são estados da Versão, não do
 * registro), o estado no provedor e as métricas derivadas. Abre no popup por
 * `?flow=`; "Novo Flow" cria e leva ao construtor.
 */

import { useData } from "@/dados/store";
import { metricasDoFlow, versaoCorrente, versaoPublicada } from "@n1/dominio/derive-ferramentas";
import { useFormat } from "@/features/shell/use-format";
import { RecordList } from "@/features/shell/record-list";
import { BarraDeFiltros, ConditionMarker, CorpoDeTela, Pilula, Select, StateSeal } from "@/features/shell/ui";
import { CriarFlowDialog } from "./criar-flow-dialog";
import { FlowPopup } from "./flow-popup";
import { CATEGORIA_DE_FLOW_LABEL, ESTADO_NO_PROVEDOR_LABEL, ESTADO_NO_PROVEDOR_TOM } from "./rotulos";
import { useParametros } from "./url";

export function AbaFlows({ onAbrirConstrutor }: { readonly onAbrirConstrutor: (flowId: string) => void }) {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { get, set, hrefCom } = useParametros();
  const canais = state.channels.filter((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo");
  const canalFiltro = canais.some((c) => c.id === get("canal")) ? (get("canal") ?? "") : "";
  const marca = get("marca") ?? "";
  const arquivados = get("arquivados") === "1";
  const aberto = get("flow");
  const criar = get("criar");

  const itens = state.flows
    .filter((f) => f.lifecycle !== "naLixeira")
    .filter((f) => (arquivados ? true : f.lifecycle === "ativo"))
    .filter((f) => (canalFiltro ? f.canalId === canalFiltro : true))
    .filter((f) => (marca === "publicados" ? versaoPublicada(f) !== undefined : marca === "semPublicar" ? versaoPublicada(f) === undefined : true))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <>
      <BarraDeFiltros>
        <div className="w-44">
          <Select size="sm" value={canalFiltro} onChange={(v) => set({ canal: v || null })} placeholder="Todos os Canais" options={[{ value: "", label: "Todos os Canais" }, ...canais.map((c) => ({ value: c.id, label: c.name }))]} />
        </div>
        <div className="w-40">
          <Select
            size="sm"
            value={marca}
            onChange={(v) => set({ marca: v || null })}
            placeholder="Todos"
            options={[
              { value: "", label: "Todos" },
              { value: "publicados", label: "Publicados" },
              { value: "semPublicar", label: "Sem Versão publicada" },
            ]}
          />
        </div>
        <label className="app-sm flex items-center gap-2" style={{ color: "var(--texto-3)" }}>
          <input type="checkbox" className="accent-[var(--acento)]" checked={arquivados} onChange={(e) => set({ arquivados: e.target.checked ? "1" : null })} />
          Mostrar arquivados
        </label>
        <span className="app-meta ml-auto app-numero">{itens.length} de {state.flows.filter((f) => f.lifecycle !== "naLixeira").length}</span>
      </BarraDeFiltros>

      <CorpoDeTela semRespiro>
        <div className="@container">
          <RecordList
            items={itens}
            hrefOf={(f) => hrefCom({ flow: f.id })}
            emptyTitle="Nenhum Flow ainda."
            emptyHint="Um Flow é um formulário que o Contato preenche dentro do WhatsApp. Crie um e monte as Telas no construtor."
            columns={[
              {
                key: "nome",
                label: "Nome",
                className: "max-w-[32ch] whitespace-nowrap",
                render: (f) => (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate" title={f.nome}>
                      {f.nome}
                    </span>
                    <StateSeal state={f.lifecycle} />
                    {f.canalId === undefined || !state.channels.some((c) => c.id === f.canalId && c.lifecycle === "ativo") ? <ConditionMarker tone="warning">sem Canal publicador</ConditionMarker> : null}
                  </span>
                ),
              },
              { key: "categoria", label: "Categoria", className: "whitespace-nowrap", render: (f) => CATEGORIA_DE_FLOW_LABEL[f.categoria] },
              {
                key: "canal",
                label: "Canal publicador",
                className: "whitespace-nowrap",
                render: (f) => {
                  const canal = state.channels.find((c) => c.id === f.canalId);
                  return canal ? (
                    <span className="block max-w-[16ch] truncate" title={canal.name}>
                      {canal.name}
                    </span>
                  ) : (
                    <span className="app-meta">—</span>
                  );
                },
              },
              {
                key: "publicada",
                label: "Publicada",
                render: (f) => {
                  const v = versaoPublicada(f);
                  return v ? <Pilula tom="sucesso">v{v.numero}</Pilula> : <span className="app-meta">—</span>;
                },
              },
              {
                key: "rascunho",
                label: "Rascunho",
                render: (f) => {
                  const v = versaoCorrente(f);
                  return v ? <Pilula tom="aviso">v{v.numero}</Pilula> : <span className="app-meta">—</span>;
                },
              },
              {
                key: "provedor",
                label: "No provedor",
                className: "hidden whitespace-nowrap @3xl:table-cell",
                render: (f) => (f.estadoNoProvedor ? <Pilula tom={ESTADO_NO_PROVEDOR_TOM[f.estadoNoProvedor]}>{ESTADO_NO_PROVEDOR_LABEL[f.estadoNoProvedor]}</Pilula> : <span className="app-meta">nunca publicado</span>),
              },
              {
                key: "metricas",
                label: "Envios · Respostas · Taxa",
                className: "hidden whitespace-nowrap @3xl:table-cell",
                render: (f) => {
                  const m = metricasDoFlow(state, f.id);
                  return (
                    <span className="app-numero">
                      {fmt.number(m.envios)} · {fmt.number(m.respostas)} · {m.taxa === null ? "—" : `${Math.round(m.taxa * 100)}%`}
                    </span>
                  );
                },
              },
            ]}
          />
        </div>
      </CorpoDeTela>

      {/* O popup tem os próprios avisos: um Toast da página ficaria atrás do véu. */}
      <FlowPopup flowId={aberto} onClose={() => set({ flow: null })} onAbrirConstrutor={onAbrirConstrutor} />
      <CriarFlowDialog open={criar === "flow"} onClose={() => set({ criar: null })} onCreated={onAbrirConstrutor} />
    </>
  );
}
