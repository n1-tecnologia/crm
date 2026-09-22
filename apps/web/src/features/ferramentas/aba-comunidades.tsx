"use client";

/**
 * A ABA COMUNIDADES (25): cada Comunidade com o Canal e o seu Papel, os
 * Grupos vinculados sobre o limite do provedor, os Membros (derivados —
 * um Contato conta uma vez, RN-COM-06), o Grupo de avisos e a Sincronização.
 * Abre no popup por `?comunidade=`.
 */

import { useData } from "@/dados/store";
import { grupoDeAvisos, gruposDaComunidade, marcadoresDaComunidade, membrosDaComunidade } from "@n1/dominio/derive-ferramentas";
import { useFormat } from "@/features/shell/use-format";
import { RecordList } from "@/features/shell/record-list";
import { BarraDeFiltros, ConditionMarker, CorpoDeTela, Pilula, Select, StateSeal } from "@/features/shell/ui";
import { ComunidadePopup } from "./comunidade-popup";
import { CriarComunidadeDialog } from "./criar-comunidade-dialog";
import { MARCADOR_DA_COMUNIDADE_LABEL, MARCADOR_DA_COMUNIDADE_TOM, PAPEL_DO_CANAL_LABEL, PAPEL_DO_CANAL_TOM, SINCRONIZACAO_LABEL, SINCRONIZACAO_TOM } from "./rotulos";
import { useParametros } from "./url";

export function AbaComunidades() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { get, set, hrefCom } = useParametros();
  const canais = state.channels.filter((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo");
  const canalFiltro = canais.some((c) => c.id === get("canal")) ? (get("canal") ?? "") : "";
  const arquivados = get("arquivados") === "1";
  const aberta = get("comunidade");
  const criar = get("criar");

  const itens = state.comunidades
    .filter((c) => c.lifecycle !== "naLixeira")
    .filter((c) => (arquivados ? true : c.lifecycle === "ativo"))
    .filter((c) => (canalFiltro ? c.canalId === canalFiltro : true))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <>
      <BarraDeFiltros>
        <div className="w-44">
          <Select size="sm" value={canalFiltro} onChange={(v) => set({ canal: v || null })} placeholder="Todos os Canais" options={[{ value: "", label: "Todos os Canais" }, ...canais.map((c) => ({ value: c.id, label: c.name }))]} />
        </div>
        <label className="app-sm flex items-center gap-2" style={{ color: "var(--texto-3)" }}>
          <input type="checkbox" className="accent-[var(--acento)]" checked={arquivados} onChange={(e) => set({ arquivados: e.target.checked ? "1" : null })} />
          Mostrar arquivadas
        </label>
        <span className="app-meta ml-auto app-numero">{itens.length} de {state.comunidades.filter((c) => c.lifecycle !== "naLixeira").length}</span>
      </BarraDeFiltros>

      <CorpoDeTela semRespiro>
        <div className="@container">
          <RecordList
            items={itens}
            hrefOf={(c) => hrefCom({ comunidade: c.id })}
            emptyTitle="Nenhuma Comunidade ainda."
            emptyHint="Crie uma pelo Canal: o provedor cria a comunidade e o Grupo de avisos juntos."
            columns={[
              {
                key: "nome",
                label: "Nome",
                className: "max-w-[32ch] whitespace-nowrap",
                render: (c) => (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate" title={c.nome}>
                      {c.nome}
                    </span>
                    <StateSeal state={c.lifecycle} />
                    {marcadoresDaComunidade(state, c).map((m) => (
                      <ConditionMarker key={m} tone={MARCADOR_DA_COMUNIDADE_TOM[m]}>
                        {MARCADOR_DA_COMUNIDADE_LABEL[m]}
                      </ConditionMarker>
                    ))}
                  </span>
                ),
              },
              {
                key: "canal",
                label: "Canal",
                className: "whitespace-nowrap",
                render: (c) => (
                  <span className="flex items-center gap-1.5">
                    <span className="max-w-[14ch] truncate" title={state.channels.find((x) => x.id === c.canalId)?.name}>
                      {state.channels.find((x) => x.id === c.canalId)?.name ?? "—"}
                    </span>
                    <Pilula tom={PAPEL_DO_CANAL_TOM[c.sincronizacao.papelDoCanal]}>{PAPEL_DO_CANAL_LABEL[c.sincronizacao.papelDoCanal]}</Pilula>
                  </span>
                ),
              },
              {
                key: "grupos",
                label: "Grupos vinculados",
                className: "whitespace-nowrap",
                render: (c) => <span className="app-numero">{fmt.number(gruposDaComunidade(state, c.id).length)} / {fmt.number(c.limiteDeGruposDoProvedor)}</span>,
              },
              {
                key: "membros",
                label: "Membros",
                render: (c) => (
                  <span className="app-numero" title="União das Participações vigentes dos Grupos comuns; um Contato conta uma vez (RN-COM-06).">
                    {fmt.number(membrosDaComunidade(state, c.id).length)}
                  </span>
                ),
              },
              {
                key: "avisos",
                label: "Grupo de avisos",
                className: "hidden whitespace-nowrap @3xl:table-cell",
                render: (c) => {
                  const avisos = grupoDeAvisos(state, c.id);
                  return avisos ? (
                    <span className="block max-w-[24ch] truncate" title={avisos.nome}>
                      {avisos.nome}
                    </span>
                  ) : (
                    <ConditionMarker tone="danger">ausente</ConditionMarker>
                  );
                },
              },
              {
                key: "sinc",
                label: "Sincronização",
                className: "hidden whitespace-nowrap @4xl:table-cell",
                render: (c) => (
                  <Pilula tom={SINCRONIZACAO_TOM[c.sincronizacao.estado]} title={c.sincronizacao.conferidoEm ? `Conferido ${fmt.relative(c.sincronizacao.conferidoEm)}` : "Nunca conferida"}>
                    {SINCRONIZACAO_LABEL[c.sincronizacao.estado]}
                  </Pilula>
                ),
              },
            ]}
          />
        </div>
      </CorpoDeTela>

      {/* O popup tem os próprios avisos: um Toast da página ficaria atrás do véu. */}
      <ComunidadePopup comunidadeId={aberta} onClose={() => set({ comunidade: null })} />
      <CriarComunidadeDialog open={criar === "comunidade"} onClose={() => set({ criar: null })} onCreated={(id) => set({ criar: null, comunidade: id })} />
    </>
  );
}
