"use client";

/**
 * A ABA GRUPOS: os Links de Captação no topo (a porta de entrada dos
 * Contatos) e a lista de Grupos abaixo, cada um com o Canal e o seu Papel,
 * a Ocupação, a Captação, o Link de convite, a Comunidade e a Sincronização.
 * Os marcadores de condição (sem privilégio, Canal ausente, link inválido,
 * esgotado) ficam ao lado do nome — são os alertas do documento 24, 18. O
 * Grupo abre no popup por `?grupo=`.
 */

import { useData } from "@/data/store";
import { cliquesContabilizados, marcadoresDoGrupo, ocupacao } from "@/data/derive-ferramentas";
import type { Grupo } from "@/data/types";
import type { Report } from "@/features/shell/ficha";
import { useFormat } from "@/features/shell/use-format";
import { RecordList } from "@/features/shell/record-list";
import { BarraDeFiltros, ConditionMarker, CorpoDeTela, Pilula, ReguaDeSecao, Select, StateSeal } from "@/features/shell/ui";
import { CriarGrupoDialog } from "./criar-grupo-dialog";
import { GrupoPopup } from "./grupo-popup";
import { ImportarGruposDialog } from "./importar-grupos-dialog";
import { CriarLinkDialog, SecaoDeLinksDeCaptacao } from "./links-de-captacao";
import {
  FAIXA_DE_OCUPACAO_LABEL,
  FAIXA_DE_OCUPACAO_TOM,
  MARCADOR_DO_GRUPO_LABEL,
  MARCADOR_DO_GRUPO_TOM,
  PAPEL_DO_CANAL_LABEL,
  PAPEL_DO_CANAL_TOM,
  PAPEL_NA_COMUNIDADE_LABEL,
  SINCRONIZACAO_LABEL,
  SINCRONIZACAO_TOM,
  ocupacaoTexto,
} from "./rotulos";
import { useParametros } from "./url";

export function AbaGrupos({ report }: { readonly report: Report }) {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { get, set, hrefCom } = useParametros();
  // Um id que não está entre as opções (URL antiga, Canal arquivado) não filtra em silêncio: vale como "todos".
  const canais = state.channels.filter((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo");
  const comunidades = state.comunidades.filter((c) => c.lifecycle !== "naLixeira");
  const canalFiltro = canais.some((c) => c.id === get("canal")) ? (get("canal") ?? "") : "";
  const comunidadeFiltro = comunidades.some((c) => c.id === get("com")) ? (get("com") ?? "") : "";
  const marca = get("marca") ?? "";
  const arquivados = get("arquivados") === "1";
  const aberto = get("grupo");
  const criar = get("criar");

  const itens = state.grupos
    .filter((g) => g.lifecycle !== "naLixeira")
    .filter((g) => (arquivados ? true : g.lifecycle === "ativo"))
    .filter((g) => (canalFiltro ? g.canalId === canalFiltro : true))
    .filter((g) => (comunidadeFiltro ? g.comunidadeId === comunidadeFiltro : true))
    .filter((g) => {
      if (!marca) return true;
      const marcas = marcadoresDoGrupo(state, g);
      if (marca === "semPrivilegio") return marcas.includes("semPrivilegio");
      if (marca === "cheios") return marcas.includes("cheio");
      if (marca === "problemas") return marcas.some((m) => m === "orfao" || m === "canalAusente" || m === "linkInvalido");
      if (marca === "pedidos") return g.pedidosDeEntrada.some((p) => p.estado === "pendente");
      return true;
    })
    .sort((a, b) => (a.papelNaComunidade === "avisos" ? 1 : 0) - (b.papelNaComunidade === "avisos" ? 1 : 0) || a.nome.localeCompare(b.nome, "pt-BR"));

  const canalDe = (g: Grupo) => state.channels.find((c) => c.id === g.canalId);

  return (
    <>
      <BarraDeFiltros>
        <div className="w-44">
          <Select
            size="sm"
            value={canalFiltro}
            onChange={(v) => set({ canal: v || null })}
            placeholder="Todos os Canais"
            options={[{ value: "", label: "Todos os Canais" }, ...canais.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <div className="w-48">
          <Select
            size="sm"
            value={comunidadeFiltro}
            onChange={(v) => set({ com: v || null })}
            placeholder="Todas as Comunidades"
            options={[{ value: "", label: "Todas as Comunidades" }, ...comunidades.map((c) => ({ value: c.id, label: c.nome }))]}
          />
        </div>
        <div className="w-44">
          <Select
            size="sm"
            value={marca}
            onChange={(v) => set({ marca: v || null })}
            placeholder="Todos"
            options={[
              { value: "", label: "Todos" },
              { value: "semPrivilegio", label: "Sem privilégio" },
              { value: "cheios", label: "Cheios" },
              { value: "problemas", label: "Com problema" },
              { value: "pedidos", label: "Com Pedidos pendentes" },
            ]}
          />
        </div>
        <label className="app-sm flex items-center gap-2" style={{ color: "var(--texto-3)" }}>
          <input type="checkbox" className="accent-[var(--acento)]" checked={arquivados} onChange={(e) => set({ arquivados: e.target.checked ? "1" : null })} />
          Mostrar arquivados
        </label>
        <span className="app-meta ml-auto app-numero">{itens.length} de {state.grupos.filter((g) => g.lifecycle !== "naLixeira").length}</span>
      </BarraDeFiltros>

      <CorpoDeTela>
        <SecaoDeLinksDeCaptacao report={report} />

        <div className="mt-6">
          <ReguaDeSecao rotulo="Grupos" contagem={itens.length} />
          <div className="@container">
            <RecordList
              items={itens}
              hrefOf={(g) => hrefCom({ grupo: g.id })}
              emptyTitle="Nenhum Grupo aqui."
              emptyHint={canalFiltro || comunidadeFiltro || marca ? "Nenhum Grupo passa por estes filtros." : "Crie um Grupo pelo Canal, ou importe os grupos de que o Canal já participa."}
              columns={[
                // Uma linha por Grupo, sempre: o nome trunca (o inteiro fica no title) e os marcadores ficam ao lado.
                {
                  key: "nome",
                  label: "Nome",
                  className: "max-w-[28ch] whitespace-nowrap",
                  render: (g) => (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate" title={g.nome}>
                        {g.nome}
                      </span>
                      <StateSeal state={g.lifecycle} />
                      {g.papelNaComunidade === "avisos" ? <Pilula tom="info">avisos</Pilula> : null}
                      {marcadoresDoGrupo(state, g)
                        .filter((m) => m !== "cheio")
                        .map((m) => (
                          <ConditionMarker key={m} tone={MARCADOR_DO_GRUPO_TOM[m]}>
                            {MARCADOR_DO_GRUPO_LABEL[m]}
                          </ConditionMarker>
                        ))}
                      {g.pedidosDeEntrada.some((p) => p.estado === "pendente") ? (
                        <ConditionMarker tone="warning">{g.pedidosDeEntrada.filter((p) => p.estado === "pendente").length} Pedido(s)</ConditionMarker>
                      ) : null}
                    </span>
                  ),
                },
                {
                  key: "canal",
                  label: "Canal",
                  className: "whitespace-nowrap",
                  render: (g) => {
                    const canal = canalDe(g);
                    return (
                      <span className="flex items-center gap-1.5">
                        <span className="max-w-[14ch] truncate" title={canal?.name}>
                          {canal?.name ?? "—"}
                        </span>
                        <Pilula tom={PAPEL_DO_CANAL_TOM[g.sincronizacao.papelDoCanal]}>{PAPEL_DO_CANAL_LABEL[g.sincronizacao.papelDoCanal]}</Pilula>
                      </span>
                    );
                  },
                },
                {
                  key: "ocupacao",
                  label: "Ocupação",
                  className: "whitespace-nowrap",
                  render: (g) => {
                    const o = ocupacao(g);
                    return (
                      <span className="flex items-center gap-1.5">
                        <span className="app-numero whitespace-nowrap">{ocupacaoTexto(o.vigentes, o.teto, fmt.number)}</span>
                        <Pilula tom={FAIXA_DE_OCUPACAO_TOM[o.faixa]}>{FAIXA_DE_OCUPACAO_LABEL[o.faixa]}</Pilula>
                      </span>
                    );
                  },
                },
                {
                  key: "captacao",
                  label: "Captação",
                  className: "hidden whitespace-nowrap @3xl:table-cell",
                  render: (g) => (
                    <span className="flex items-center gap-1.5">
                      <Pilula tom={g.captacao.estado === "ativa" ? "sucesso" : "neutro"}>{g.captacao.estado}</Pilula>
                      <span className="app-meta app-numero whitespace-nowrap">
                        {cliquesContabilizados(state, g)}
                        {g.captacao.limiteDeCliques !== undefined ? ` / ${g.captacao.limiteDeCliques}` : ""} cliques
                      </span>
                    </span>
                  ),
                },
                {
                  key: "convite",
                  label: "Link de convite",
                  // A coluna de menor valor é a primeira a sair quando a largura aperta: a linha nunca quebra.
                  className: "hidden whitespace-nowrap @7xl:table-cell",
                  render: (g) => (g.linkDeConvite ? <Pilula tom={g.linkDeConvite.estado === "valido" ? "sucesso" : g.linkDeConvite.estado === "invalido" ? "erro" : "neutro"}>{g.linkDeConvite.estado === "valido" ? "válido" : g.linkDeConvite.estado === "invalido" ? "inválido" : "desconhecido"}</Pilula> : <span className="app-meta">ausente</span>),
                },
                {
                  key: "comunidade",
                  label: "Comunidade",
                  className: "hidden whitespace-nowrap @4xl:table-cell",
                  render: (g) => {
                    const c = state.comunidades.find((x) => x.id === g.comunidadeId);
                    return c ? (
                      <span className="flex items-center gap-1.5">
                        <span className="max-w-[16ch] truncate" title={c.nome}>
                          {c.nome}
                        </span>
                        {g.papelNaComunidade ? <span className="app-meta shrink-0">· {PAPEL_NA_COMUNIDADE_LABEL[g.papelNaComunidade]}</span> : null}
                      </span>
                    ) : (
                      <span className="app-meta">—</span>
                    );
                  },
                },
                {
                  key: "sinc",
                  label: "Sincronização",
                  className: "hidden whitespace-nowrap @6xl:table-cell",
                  // Só a caixa; o "quando" vai para o title — a coluna inteira cabe sem quebrar a linha.
                  render: (g) => (
                    <Pilula tom={SINCRONIZACAO_TOM[g.sincronizacao.estado]} title={g.sincronizacao.conferidoEm ? `Conferido ${fmt.relative(g.sincronizacao.conferidoEm)}` : "Nunca conferido"}>
                      {SINCRONIZACAO_LABEL[g.sincronizacao.estado]}
                    </Pilula>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </CorpoDeTela>

      {/* O popup tem os próprios avisos: um Toast da página ficaria atrás do véu. */}
      <GrupoPopup grupoId={aberto} onClose={() => set({ grupo: null })} />
      <CriarGrupoDialog open={criar === "grupo"} onClose={() => set({ criar: null })} onCreated={(id) => set({ criar: null, grupo: id })} />
      <ImportarGruposDialog open={criar === "importar"} onClose={() => set({ criar: null })} report={report} />
      <CriarLinkDialog open={criar === "link"} onClose={() => set({ criar: null })} report={report} />
    </>
  );
}
