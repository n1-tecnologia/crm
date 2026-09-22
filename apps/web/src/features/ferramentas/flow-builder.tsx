"use client";

/**
 * O CONSTRUTOR DE FLOW — a única tela de três colunas do sistema: as Telas
 * à esquerda (ordem = navegação padrão, 7.2), a Tela selecionada com os seus
 * Componentes no centro (clicar num Componente abre o formulário dele), e à
 * direita a Validação ao vivo (7.5), o Publicar, as Versões e a
 * pré-visualização. Sem arrastar-e-soltar: subir/descer e "mover para
 * dentro de". A Tela selecionada vive na URL (`?tela=`).
 *
 * Só o rascunho é editável (RN-FLW-04): sem rascunho, a tela mostra a
 * publicada em leitura e oferece "criar rascunho a partir dela".
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Box, MousePointerClick, Plus, TextCursorInput, Type, Workflow, type LucideIcon } from "lucide-react";
import { useData, useRun, useSession } from "@/dados/store";
import { CATALOGO_DE_COMPONENTES, GRUPO_DO_CATALOGO_LABEL, TIPOS_DO_CATALOGO, type GrupoDoCatalogo } from "@n1/dominio/operations/ferramentas/flows-catalogo";
import { adicionarComponente, adicionarTela, criarRascunhoAPartirDe, descartarRascunho, duplicarComponente, duplicarTela, editarTela, moverComponente, publicarVersao, removerComponente, removerTela, reordenarTela } from "@n1/dominio/operations/ferramentas/flows";
import { recusaDeAdministracao, recusaDePublicacao } from "@n1/dominio/operations/ferramentas/permissoes";
import { validarVersao } from "@n1/dominio/operations/ferramentas/flows-validacao";
import { componentesDaTela, telasOrdenadas, versaoCorrente, versaoPublicada } from "@n1/dominio/derive-ferramentas";
import type { ComponenteDeFlow, DadoDeTela, Flow, TelaDeFlow, TipoDeComponente, TipoDeDadoDeTela, VersaoDeFlow } from "@n1/dominio/types/ferramentas";
import { LinhaDeProp } from "@/features/estrutura/linha-de-propriedade";
import { Selo } from "@/features/estrutura/icone-de-tipo";
import { EditorDeTexto, useAvisos, type Report } from "@/features/shell/ficha";
import { useFormat } from "@/features/shell/use-format";
import { ActionMenu, Button, ConditionMarker, ConfirmDialog, CorpoDeTela, EmptyState, Field, Icone, PageHeader, Painel, Pilula, RecordPanel, ReguaDeSecao, Select, TextInput, Toggle, cn } from "@/features/shell/ui";
import { EnviarFlowDialog } from "./flow-popup";
import { PreviaDoFlow } from "./flow-previa";
import { FormularioDeComponente } from "./flow-componente-form";
import { resumoDoComponente } from "./flow-spec";
import { TIPO_DE_ACAO_LABEL, TIPO_DE_DADO_LABEL, VERSAO_LABEL, VERSAO_TOM } from "./rotulos";
import { useParametros } from "./url";

const COR_DO_GRUPO: Record<GrupoDoCatalogo, { readonly cor: string; readonly lavado: string; readonly icone: LucideIcon }> = {
  textoEMidia: { cor: "var(--texto-2)", lavado: "var(--superficie-2)", icone: Type },
  entrada: { cor: "var(--acento)", lavado: "var(--acento-lavado)", icone: TextCursorInput },
  conteiner: { cor: "var(--info)", lavado: "var(--info-lavado)", icone: Box },
  acao: { cor: "var(--sucesso)", lavado: "var(--sucesso-lavado)", icone: MousePointerClick },
};

export function FlowBuilder({ flowId }: { readonly flowId: string }) {
  const state = useData((data) => data);
  const run = useRun();
  const router = useRouter();
  const fmt = useFormat();
  const { memberId } = useSession();
  const { get, set } = useParametros();
  const { avisos, report } = useAvisos();
  const [componenteId, setComponenteId] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<"tela" | "componente" | "publicar" | "descartar" | "enviar" | null>(null);

  const flow = state.flows.find((f) => f.id === flowId);
  if (!flow) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader path={<TrilhaDeFlows />} icon={<Icone de={Workflow} tamanho="sm" />} title="Flow" />
        <CorpoDeTela>
          <EmptyState title="Flow não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const rascunho = versaoCorrente(flow);
  const publicada = versaoPublicada(flow);
  const versao: VersaoDeFlow | undefined = rascunho ?? publicada ?? [...flow.versoes].sort((a, b) => b.numero - a.numero)[0];
  if (!versao) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader path={<TrilhaDeFlows />} icon={<Icone de={Workflow} tamanho="sm" />} title={flow.nome} />
        <CorpoDeTela>
          <EmptyState title="O Flow não tem Versão." />
        </CorpoDeTela>
      </div>
    );
  }
  const editavel = rascunho !== undefined && flow.lifecycle === "ativo";
  const motivoLeitura = flow.lifecycle !== "ativo" ? "Restaure o Flow antes de editar." : !rascunho ? "Sem rascunho: só a Versão em rascunho é editável (RN-FLW-04)." : undefined;
  const telas = telasOrdenadas(versao);
  const telaSelecionada = telas.find((t) => t.id === get("tela")) ?? telas[0];
  const problemas = validarVersao(flow, versao, state.files);
  const canal = state.channels.find((c) => c.id === flow.canalId);
  const adm = recusaDeAdministracao(state, memberId);
  const recusaPublicar = !rascunho ? "Não há rascunho para publicar." : (recusaDePublicacao(state, flow) ?? adm ?? (problemas.length > 0 ? `${problemas.length} problema${problemas.length > 1 ? "s" : ""} de validação (7.5).` : undefined));
  const selecionarTela = (id: string) => {
    setComponenteId(null);
    set({ tela: id });
  };

  const componenteSelecionado = telaSelecionada ? componentesDaTela(telaSelecionada).find((c) => c.componente.id === componenteId)?.componente : undefined;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={<TrilhaDeFlows />}
        icon={<Icone de={Workflow} tamanho="sm" />}
        title={flow.nome}
        seal={
          <Pilula tom={VERSAO_TOM[versao.estado]}>
            v{versao.numero} · {VERSAO_LABEL[versao.estado]}
          </Pilula>
        }
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setDialogo("publicar")} disabled={recusaPublicar !== undefined} {...(recusaPublicar ? { disabledReason: recusaPublicar } : {})}>
              Publicar v{rascunho?.numero ?? versao.numero}
            </Button>
            <ActionMenu
              items={[
                { label: "Ver a ficha do Flow", onSelect: () => router.push(`/ferramentas/flows?flow=${flow.id}`) },
                { label: "Enviar a um Contato", onSelect: () => setDialogo("enviar"), ...(publicada ? {} : { disabledReason: "Sem Versão publicada (RN-FLW-01)." }) },
                ...(rascunho
                  ? [{ label: "Descartar rascunho", destructive: true, onSelect: () => setDialogo("descartar"), ...(flow.versoes.length === 1 ? { disabledReason: "É a única Versão (RN-FLW-03)." } : {}) }]
                  : [{ label: `Criar rascunho a partir da v${versao.numero}`, onSelect: () => report(run((data, me) => criarRascunhoAPartirDe(data, me, flow.id, versao.id)), `Rascunho criado a partir da v${versao.numero}.`) }]),
              ]}
            />
          </>
        }
        details={
          <>
            <span className="app-meta">Esquema {versao.versaoDeEsquema}</span>
            <span className="app-meta">· Canal publicador: {canal ? `${canal.name} (${canal.connection})` : "nenhum"}</span>
            {publicada ? <span className="app-meta">· publicada v{publicada.numero}</span> : <span className="app-meta">· nunca publicado</span>}
            <span className="app-meta">· {telas.length} Tela{telas.length === 1 ? "" : "s"}</span>
          </>
        }
      />

      {motivoLeitura ? (
        <p className="app-base shrink-0 px-4 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}>
          {motivoLeitura}
        </p>
      ) : !canal ? (
        <p className="app-base shrink-0 px-4 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}>
          Sem Canal publicador: dá para editar e validar, mas publicar exige um Canal de WhatsApp conectado (RN-FLW-06). Escolha-o na ficha do Flow.
        </p>
      ) : canal.connection !== "conectada" ? (
        <p className="app-base shrink-0 px-4 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}>
          O Canal {canal.name} está desconectado: publicar espera a conexão voltar.
        </p>
      ) : null}

      <div className="px-4 pt-2">{avisos}</div>

      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[16rem_minmax(0,1fr)_22rem] xl:items-start">
          {/* ── Telas ── */}
          <Painel className="min-w-0">
            <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--linha)" }}>
              <span className="app-md" style={{ color: "var(--texto)" }}>
                Telas <span className="app-meta app-numero">{telas.length}</span>
              </span>
              <Button size="sm" variant="ghost" icon={<Icone de={Plus} tamanho="xs" />} onClick={() => setDialogo("tela")} disabled={!editavel} {...(motivoLeitura ? { disabledReason: motivoLeitura } : {})}>
                Tela
              </Button>
            </div>
            <ol className="grid gap-1.5 p-2">
              {telas.map((t, i) => {
                const problemasDaTela = problemas.filter((p) => p.telaId === t.id).length;
                return (
                  <li key={t.id} className="item-solto min-w-0" data-destacado={t.id === telaSelecionada?.id ? "true" : undefined} style={{ paddingInline: "var(--e-2)" }}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => selecionarTela(t.id)}>
                      <span className="app-meta app-numero w-4 shrink-0">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                          {t.titulo}
                        </span>
                        <span className="app-meta block truncate">
                          <span className="identificador">{t.identificador}</span>
                          {t.terminal ? " · terminal" : ""}
                        </span>
                      </span>
                      {problemasDaTela > 0 ? <ConditionMarker tone="danger">{problemasDaTela}</ConditionMarker> : null}
                    </button>
                    {editavel ? (
                      <span className="flex shrink-0 items-center">
                        <ActionMenu
                          items={[
                            { label: "Subir", onSelect: () => report(run((data, me) => reordenarTela(data, me, flow.id, t.id, "subir")), "Telas reordenadas."), ...(i === 0 ? { disabledReason: "Já é a primeira." } : {}) },
                            { label: "Descer", onSelect: () => report(run((data, me) => reordenarTela(data, me, flow.id, t.id, "descer")), "Telas reordenadas."), ...(i === telas.length - 1 ? { disabledReason: "Já é a última." } : {}) },
                            { label: "Duplicar", onSelect: () => report(run((data, me) => duplicarTela(data, me, flow.id, t.id)), "Tela duplicada.") },
                            { label: "Remover", destructive: true, onSelect: () => report(run((data, me) => removerTela(data, me, flow.id, t.id)), "Tela removida."), ...(telas.length === 1 ? { disabledReason: "A Versão precisa de ao menos uma Tela." } : {}) },
                          ]}
                        />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </Painel>

          {/* ── Tela selecionada ── */}
          <div className="grid min-w-0 content-start gap-3">
            {telaSelecionada ? (
              <TelaSelecionada
                flow={flow}
                versao={versao}
                tela={telaSelecionada}
                editavel={editavel}
                motivoLeitura={motivoLeitura}
                problemas={problemas}
                componenteId={componenteId}
                onSelecionarComponente={setComponenteId}
                onAdicionarComponente={() => setDialogo("componente")}
                report={report}
              />
            ) : (
              <EmptyState title="Nenhuma Tela." hint="Adicione a primeira Tela." />
            )}
            {telaSelecionada && componenteSelecionado && editavel ? (
              <FormularioDeComponente
                key={componenteSelecionado.id}
                flowId={flow.id}
                tela={telaSelecionada}
                versao={versao}
                componente={componenteSelecionado}
                problemas={problemas.filter((p) => p.componenteId === componenteSelecionado.id)}
                onClose={() => setComponenteId(null)}
                report={report}
              />
            ) : null}
          </div>

          {/* ── Validação, publicar, versões, prévia ── */}
          <div className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Validação" count={problemas.length}>
              {problemas.length === 0 ? (
                <p className="app-sm" style={{ color: "var(--sucesso)" }}>
                  Nenhum problema. A Versão pode ser publicada.
                </p>
              ) : (
                <ol className="grid gap-2">
                  {problemas.map((p, i) => (
                    <li key={i} className="app-sm flex items-start gap-2" style={{ color: "var(--texto-2)" }}>
                      <ConditionMarker tone="danger">{p.regra}</ConditionMarker>
                      <span className="min-w-0 flex-1">{p.mensagem}</span>
                      {p.telaId ? (
                        <button
                          type="button"
                          className="app-sm shrink-0 underline"
                          style={{ color: "var(--acento)" }}
                          onClick={() => {
                            set({ tela: p.telaId ?? null });
                            setComponenteId(p.componenteId ?? null);
                          }}
                        >
                          ir
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-3">
                <Button variant="primary" full onClick={() => setDialogo("publicar")} disabled={recusaPublicar !== undefined} {...(recusaPublicar ? { disabledReason: recusaPublicar } : {})}>
                  Publicar v{rascunho?.numero ?? versao.numero}
                </Button>
              </div>
            </RecordPanel>

            <RecordPanel title="Versões" count={flow.versoes.length} defaultOpen={false}>
              <ul className="grid gap-1.5">
                {[...flow.versoes]
                  .sort((a, b) => b.numero - a.numero)
                  .map((v) => (
                    <li key={v.id} className="app-sm flex items-center gap-2" style={{ color: "var(--texto-2)" }}>
                      <Pilula tom={VERSAO_TOM[v.estado]}>v{v.numero}</Pilula>
                      <span>{VERSAO_LABEL[v.estado]}</span>
                      {v.publicadaEm ? <span className="app-meta">· {fmt.relative(v.publicadaEm)}</span> : null}
                      {v.proveniencia ? <span className="app-meta">· de v{v.proveniencia.numero}</span> : null}
                    </li>
                  ))}
              </ul>
            </RecordPanel>

            <RecordPanel title="Pré-visualização">
              <PreviaDoFlow versao={versao} telaId={telaSelecionada?.id ?? null} problemas={problemas} onNavegar={selecionarTela} />
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>

      {dialogo === "tela" ? <NovaTelaDialog flow={flow} versao={versao} onClose={() => setDialogo(null)} onCreated={(id) => { setDialogo(null); selecionarTela(id); }} /> : null}
      {dialogo === "componente" && telaSelecionada ? (
        <CatalogoDialog
          flow={flow}
          tela={telaSelecionada}
          onClose={() => setDialogo(null)}
          onCreated={(id) => {
            setDialogo(null);
            setComponenteId(id);
          }}
          report={report}
        />
      ) : null}
      {dialogo === "publicar" && rascunho ? <PublicarDialog flow={flow} rascunho={rascunho} publicada={publicada} onClose={() => setDialogo(null)} report={report} /> : null}
      {dialogo === "enviar" ? <EnviarFlowDialog flow={flow} onClose={() => setDialogo(null)} report={report} /> : null}
      <ConfirmDialog
        open={dialogo === "descartar"}
        title={`Descartar o rascunho v${rascunho?.numero ?? ""}?`}
        description="O que foi editado desde a última publicação se perde. Para editar de novo, crie um rascunho a partir de uma Versão (RN-FLW-05)."
        confirmLabel="Descartar"
        destructive
        onConfirm={() => {
          setDialogo(null);
          report(run((data, me) => descartarRascunho(data, me, flow.id)), "Rascunho descartado.");
        }}
        onCancel={() => setDialogo(null)}
      />
    </div>
  );
}

function TelaSelecionada({
  flow,
  versao,
  tela,
  editavel,
  motivoLeitura,
  problemas,
  componenteId,
  onSelecionarComponente,
  onAdicionarComponente,
  report,
}: {
  readonly flow: Flow;
  readonly versao: VersaoDeFlow;
  readonly tela: TelaDeFlow;
  readonly editavel: boolean;
  readonly motivoLeitura: string | undefined;
  readonly problemas: ReadonlyArray<{ readonly telaId?: string; readonly componenteId?: string; readonly mensagem: string }>;
  readonly componenteId: string | null;
  readonly onSelecionarComponente: (id: string | null) => void;
  readonly onAdicionarComponente: () => void;
  readonly report: Report;
}) {
  const run = useRun();
  const [dadosAbertos, setDadosAbertos] = useState(false);
  const lista = componentesDaTela(tela);
  const gravarTela = (patch: Parameters<typeof editarTela>[4], mensagem: string) => report(run((data, me) => editarTela(data, me, flow.id, tela.id, patch)), mensagem);
  const irmaos = (c: ComponenteDeFlow, paiId: string | undefined): ComponenteDeFlow[] => (paiId ? (lista.find((x) => x.componente.id === paiId)?.componente.filhos ?? []) : tela.componentes);
  const conteineres = lista.filter((x) => CATALOGO_DE_COMPONENTES[x.componente.tipo].aceitaFilhos);

  return (
    <Painel className="min-w-0">
      <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--linha)" }}>
        <div className="flex items-center gap-2">
          <span className="app-md" style={{ color: "var(--texto)" }}>
            Tela
          </span>
          <span className="identificador">{tela.identificador}</span>
          {tela.terminal ? <Pilula tom="sucesso">terminal</Pilula> : null}
          <span className="app-meta ml-auto app-numero">{versao.telas.findIndex((t) => t.id === tela.id) >= 0 ? `${telasOrdenadas(versao).indexOf(tela) + 1} de ${versao.telas.length}` : ""}</span>
        </div>
      </div>
      <div className="grid gap-0.5 px-2 py-2">
        <LinhaDeProp icone={Workflow} rotulo="Título" valor={tela.titulo} editavel={editavel} motivo={motivoLeitura} editor={<EditorDeTexto valor={tela.titulo} onSave={(v) => gravarTela({ titulo: v }, "Título da Tela alterado.")} />} />
        <LinhaDeProp
          icone={Workflow}
          rotulo="Identificador"
          valor={<span className="identificador">{tela.identificador}</span>}
          editavel={editavel}
          motivo={motivoLeitura ?? "Renomear reescreve toda Ação que aponta para esta Tela (RN-FLW-08)."}
          editor={<EditorDeTexto valor={tela.identificador} onSave={(v) => gravarTela({ identificador: v }, "Identificador renomeado; as Ações que o citavam foram reescritas (RN-FLW-08).")} placeholder="letras_minusculas" />}
        />
        <LinhaDeProp
          icone={Workflow}
          rotulo="Terminal"
          controle={
            <ToggleTerminal ligado={tela.terminal} onChange={(v) => gravarTela({ terminal: v }, v ? "Tela marcada como terminal." : "Tela deixou de ser terminal.")} motivo={motivoLeitura} />
          }
        />
        <LinhaDeProp
          icone={Workflow}
          rotulo="Dados de Tela"
          controle={
            <span className="app-base flex min-w-0 flex-wrap items-center gap-1.5" style={{ color: "var(--texto)" }}>
              <span className="min-w-0">{tela.dados.length === 0 ? "Nenhum" : tela.dados.map((d) => `${d.nome} (${TIPO_DE_DADO_LABEL[d.tipo]})`).join(", ")}</span>
              <Button size="sm" variant="ghost" onClick={() => setDadosAbertos(true)} disabled={!editavel} {...(motivoLeitura ? { disabledReason: motivoLeitura } : {})}>
                Editar
              </Button>
            </span>
          }
        />
      </div>

      <div className="px-3 pb-3">
        <ReguaDeSecao
          rotulo="Componentes"
          contagem={lista.length}
          acao={
            <Button size="sm" icon={<Icone de={Plus} tamanho="xs" />} onClick={onAdicionarComponente} disabled={!editavel} {...(motivoLeitura ? { disabledReason: motivoLeitura } : {})}>
              Componente
            </Button>
          }
        />
        {lista.length === 0 ? (
          <EmptyState compact title="Tela vazia." hint="Adicione um Título, as entradas e um Rodapé com a Ação." />
        ) : (
          <ol className="grid gap-1.5">
            {lista.map(({ componente: c, paiId, nivel }) => {
              const def = CATALOGO_DE_COMPONENTES[c.tipo];
              const cor = COR_DO_GRUPO[def.grupo];
              const n = problemas.filter((p) => p.componenteId === c.id).length;
              const lugar = irmaos(c, paiId);
              const indice = lugar.findIndex((x) => x.id === c.id);
              return (
                <li key={c.id} className="item-solto min-w-0" data-destacado={c.id === componenteId ? "true" : undefined} style={{ marginLeft: nivel > 0 ? `calc(${nivel} * var(--e-5))` : undefined, paddingInline: "var(--e-2)" }}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelecionarComponente(c.id === componenteId ? null : c.id)} disabled={!editavel} title={motivoLeitura}>
                    <Selo icone={cor.icone} cor={cor.cor} lavado={cor.lavado} />
                    <span className="min-w-0 flex-1">
                      <span className="app-base flex items-center gap-1.5 truncate" style={{ color: "var(--texto)" }}>
                        {def.rotulo}
                        {c.nome ? <span className="identificador">{c.nome}</span> : null}
                        {c.propriedades.obrigatorio ? <Pilula tom="neutro">obrigatório</Pilula> : null}
                        {n > 0 ? <ConditionMarker tone="danger">{n}</ConditionMarker> : null}
                      </span>
                      <span className="app-meta block truncate">
                        {resumoDoComponente(c.tipo, c.propriedades, c.nome)}
                        {c.acao ? ` · ${TIPO_DE_ACAO_LABEL[c.acao.tipo]}${c.acao.telaDeDestino ? ` → ${c.acao.telaDeDestino}` : ""}` : ""}
                      </span>
                    </span>
                  </button>
                  {editavel ? (
                    <span className="flex shrink-0 items-center">
                      <SetaDeOrdem
                        direcao="subir"
                        motivo={c.tipo === "rodape" ? "O Rodapé é sempre o último Componente da Tela (7.5.6)." : indice <= 0 ? "Já é o primeiro." : undefined}
                        onClick={() => report(run((data, me) => moverComponente(data, me, flow.id, tela.id, c.id, { direcao: "subir" })), "Componente movido.")}
                      />
                      <SetaDeOrdem
                        direcao="descer"
                        motivo={c.tipo === "rodape" ? "O Rodapé é sempre o último Componente da Tela (7.5.6)." : indice >= lugar.length - 1 ? "Já é o último." : lugar[indice + 1]?.tipo === "rodape" ? "O Rodapé fica por último; nada desce abaixo dele (7.5.6)." : undefined}
                        onClick={() => report(run((data, me) => moverComponente(data, me, flow.id, tela.id, c.id, { direcao: "descer" })), "Componente movido.")}
                      />
                      <ActionMenu
                        items={[
                          { label: "Duplicar", onSelect: () => report(run((data, me) => duplicarComponente(data, me, flow.id, tela.id, c.id)), "Componente duplicado."), ...(c.tipo === "rodape" ? { disabledReason: "A Tela só tem um Rodapé (7.5.6)." } : {}) },
                          ...conteineres
                            .filter((x) => x.componente.id !== c.id && x.componente.id !== paiId && !(c.filhos && componentesDaTela({ ...tela, componentes: c.filhos }).some((y) => y.componente.id === x.componente.id)))
                            // Dois Formulários na mesma Tela precisam de nomes distintos no menu: o ordinal entre os contêineres desempata.
                            .map((x) => ({ label: `Mover para dentro de ${CATALOGO_DE_COMPONENTES[x.componente.tipo].rotulo} ${conteineres.indexOf(x) + 1}${x.componente.nome ? ` (${x.componente.nome})` : ""}`, onSelect: () => report(run((data, me) => moverComponente(data, me, flow.id, tela.id, c.id, { paraDentroDe: x.componente.id })), "Componente movido."), ...(c.tipo === "rodape" ? { disabledReason: "O Rodapé fica no nível raiz." } : {}) })),
                          ...(paiId ? [{ label: "Mover para o nível raiz", onSelect: () => report(run((data, me) => moverComponente(data, me, flow.id, tela.id, c.id, { paraDentroDe: null })), "Componente movido.") }] : []),
                          { label: "Remover", destructive: true, onSelect: () => report(run((data, me) => removerComponente(data, me, flow.id, tela.id, c.id)), "Componente removido.") },
                        ]}
                      />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {dadosAbertos ? <DadosDeTelaDialog flow={flow} tela={tela} onClose={() => setDadosAbertos(false)} report={report} /> : null}
    </Painel>
  );
}

/** A migalha do construtor: "Flows" é a lista-mãe e leva a ela; "Ferramentas" não tem página própria. */
function TrilhaDeFlows() {
  return (
    <span>
      Ferramentas ›{" "}
      <Link href="/ferramentas/flows" className="hover:underline">
        Flows
      </Link>
    </span>
  );
}

/** Uma seta de reordenação que, desligada, diz por quê — sem `disabled` nativo, que não recebe foco nem anuncia. */
function SetaDeOrdem({ direcao, motivo, onClick }: { readonly direcao: "subir" | "descer"; readonly motivo: string | undefined; readonly onClick: () => void }) {
  const rotulo = direcao === "subir" ? "Subir" : "Descer";
  return (
    <button
      type="button"
      className="btn-icone"
      aria-label={rotulo}
      aria-disabled={motivo !== undefined}
      title={motivo ?? rotulo}
      style={motivo ? { opacity: 0.4 } : undefined}
      onClick={motivo ? undefined : onClick}
    >
      <Icone de={direcao === "subir" ? ArrowUp : ArrowDown} tamanho="xs" />
    </button>
  );
}

function ToggleTerminal({ ligado, onChange, motivo }: { readonly ligado: boolean; readonly onChange: (v: boolean) => void; readonly motivo?: string }) {
  return (
    <span className="flex items-center gap-2" title={motivo}>
      <span id="tela-terminal" hidden>
        Terminal
      </span>
      <Toggle checked={ligado} onChange={onChange} labelledBy="tela-terminal" disabled={motivo !== undefined} />
      <span className="app-sm" style={{ color: "var(--texto-3)" }}>
        {ligado ? "o preenchimento pode concluir aqui" : "segue para outra Tela"}
      </span>
    </span>
  );
}

function NovaTelaDialog({ flow, versao, onClose, onCreated }: { readonly flow: Flow; readonly versao: VersaoDeFlow; readonly onClose: () => void; readonly onCreated: (telaId: string) => void }) {
  const run = useRun();
  const [identificador, setIdentificador] = useState("");
  const [titulo, setTitulo] = useState("");
  const [terminal, setTerminal] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const invalido = identificador !== "" && !/^[a-z_]+$/.test(identificador);
  const repetido = versao.telas.some((t) => t.identificador === identificador);
  const motivo = !identificador ? "Dê um Identificador à Tela." : invalido ? "Só letras minúsculas e sublinhado." : repetido ? "Já existe uma Tela com este Identificador nesta Versão." : !titulo.trim() ? "Dê um título à Tela." : undefined;
  return (
    <ConfirmDialog
      open
      title="Nova Tela"
      description="Entra no fim da ordem — a navegação padrão segue a ordem (7.2). A última Tela precisa ser terminal para publicar."
      confirmLabel="Adicionar Tela"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        const r = run((data, me) => adicionarTela(data, me, flow.id, { identificador, titulo, terminal }));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        onCreated(r.value.id);
      }}
      onCancel={onClose}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Identificador" required hint="[a-z_]+ — o alvo das Ações “navegar”." {...(invalido ? { error: "Só letras minúsculas e sublinhado." } : repetido ? { error: "Já existe nesta Versão." } : {})}>
            {(id) => <TextInput id={id} value={identificador} onChange={(v) => setIdentificador(v.toLowerCase())} placeholder="dados_pessoais" invalid={invalido || repetido} />}
          </Field>
          <Field label="Título" required hint="No cabeçalho da Tela no aparelho.">
            {(id) => <TextInput id={id} value={titulo} onChange={setTitulo} placeholder="Seus dados" />}
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={terminal} onChange={setTerminal} labelledBy="nova-tela-terminal" />
          <span id="nova-tela-terminal" className="app-base" style={{ color: "var(--texto)" }}>
            Terminal — o preenchimento pode concluir aqui
          </span>
        </div>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

function DadosDeTelaDialog({ flow, tela, onClose, report }: { readonly flow: Flow; readonly tela: TelaDeFlow; readonly onClose: () => void; readonly report: Report }) {
  const run = useRun();
  const [dados, setDados] = useState<DadoDeTela[]>(tela.dados.map((d) => ({ ...d })));
  const [erro, setErro] = useState<string | null>(null);
  const mudar = (i: number, patch: Partial<DadoDeTela>) => setDados(dados.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <ConfirmDialog
      open
      title={`Dados da Tela “${tela.titulo}”`}
      description="Declarações {nome, tipo, exemplo} do que a Tela recebe da anterior (carga útil de navegar) ou do Ponto de troca de dados. Uma {dados.x} usada aqui precisa estar declarada (7.5.4)."
      confirmLabel="Gravar"
      wide
      onConfirm={() => {
        const r = run((data, me) => editarTela(data, me, flow.id, tela.id, { dados }));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        report(r, "Dados de Tela gravados.");
        onClose();
      }}
      onCancel={onClose}
    >
      <div className="grid gap-2">
        {dados.map((d, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_auto] items-center gap-2">
            <TextInput value={d.nome} onChange={(v) => mudar(i, { nome: v.replace(/[^a-z0-9_]/g, "_") })} placeholder="nome" size="sm" />
            <Select size="sm" value={d.tipo} onChange={(v) => mudar(i, { tipo: v as TipoDeDadoDeTela })} options={(Object.keys(TIPO_DE_DADO_LABEL) as TipoDeDadoDeTela[]).map((t) => ({ value: t, label: TIPO_DE_DADO_LABEL[t] }))} />
            <TextInput value={d.exemplo ?? ""} onChange={(v) => mudar(i, { exemplo: v })} placeholder="exemplo" size="sm" />
            <Button size="sm" variant="ghost" onClick={() => setDados(dados.filter((_, j) => j !== i))}>
              Remover
            </Button>
          </div>
        ))}
        <span>
          <Button size="sm" variant="ghost" onClick={() => setDados([...dados, { nome: `dado_${dados.length + 1}`, tipo: "texto" }])}>
            Adicionar Dado
          </Button>
        </span>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

function CatalogoDialog({ flow, tela, onClose, onCreated, report }: { readonly flow: Flow; readonly tela: TelaDeFlow; readonly onClose: () => void; readonly onCreated: (componenteId: string) => void; readonly report: Report }) {
  const run = useRun();
  const [tipo, setTipo] = useState<TipoDeComponente | null>(null);
  const [paiId, setPaiId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const conteineres = componentesDaTela(tela).filter((x) => CATALOGO_DE_COMPONENTES[x.componente.tipo].aceitaFilhos);
  const temRodape = tela.componentes.some((c) => c.tipo === "rodape");
  const grupos = (Object.keys(GRUPO_DO_CATALOGO_LABEL) as GrupoDoCatalogo[]).map((g) => ({ grupo: g, tipos: TIPOS_DO_CATALOGO.filter((t) => CATALOGO_DE_COMPONENTES[t].grupo === g) }));
  return (
    <ConfirmDialog
      open
      title="Adicionar Componente"
      description={`Catálogo do esquema 7.3 (23, 7.4). Entra na Tela “${tela.titulo}”, antes do Rodapé.`}
      confirmLabel="Adicionar"
      wide
      {...(tipo ? {} : { confirmDisabledReason: "Escolha um Tipo." })}
      onConfirm={() => {
        if (!tipo) return;
        const r = run((data, me) => adicionarComponente(data, me, flow.id, tela.id, { tipo, ...(paiId ? { paiId } : {}) }));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        report(r, `${CATALOGO_DE_COMPONENTES[tipo].rotulo} adicionado.`);
        onCreated(r.value.id);
      }}
      onCancel={onClose}
    >
      <div className="grid gap-4">
        {grupos.map(({ grupo, tipos }) => (
          <div key={grupo}>
            <ReguaDeSecao rotulo={GRUPO_DO_CATALOGO_LABEL[grupo]} contagem={tipos.length} />
            <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label={GRUPO_DO_CATALOGO_LABEL[grupo]}>
              {tipos.map((t) => {
                const def = CATALOGO_DE_COMPONENTES[t];
                const cor = COR_DO_GRUPO[def.grupo];
                const bloqueado = t === "rodape" && temRodape ? "A Tela já tem um Rodapé (7.5.6)." : undefined;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tipo === t}
                    className={cn("item-solto text-left")}
                    data-destacado={tipo === t ? "true" : undefined}
                    onClick={() => (bloqueado ? undefined : setTipo(t))}
                    aria-disabled={bloqueado !== undefined}
                    title={bloqueado}
                    style={bloqueado ? { opacity: 0.5 } : undefined}
                  >
                    <Selo icone={cor.icone} cor={cor.cor} lavado={cor.lavado} />
                    <span className="min-w-0 flex-1">
                      <span className="app-base block" style={{ color: "var(--texto)" }}>
                        {def.rotulo}
                        {def.entrada ? <span className="app-meta"> · entrada</span> : null}
                      </span>
                      <span className="app-meta block">{def.descricao}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {conteineres.length > 0 && tipo !== "rodape" ? (
          <Field label="Inserir em" hint="Dentro de um Formulário ou Condicional, ou no nível raiz.">
            {(id) => <Select id={id} value={paiId} onChange={setPaiId} placeholder="Nível raiz" options={[{ value: "", label: "Nível raiz" }, ...conteineres.map((x, i) => ({ value: x.componente.id, label: `${CATALOGO_DE_COMPONENTES[x.componente.tipo].rotulo} ${i + 1}${x.componente.nome ? ` (${x.componente.nome})` : ""}` }))]} />}
          </Field>
        ) : null}
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

function PublicarDialog({ flow, rascunho, publicada, onClose, report }: { readonly flow: Flow; readonly rascunho: VersaoDeFlow; readonly publicada: VersaoDeFlow | undefined; readonly onClose: () => void; readonly report: Report }) {
  const run = useRun();
  const [notas, setNotas] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      title={`Publicar v${rascunho.numero}?`}
      description={`A Definição publicável vai ao provedor pelo Canal publicador. ${publicada ? `A v${publicada.numero} vira obsoleta; ` : ""}a v${rascunho.numero} vira publicada e um rascunho novo (v${rascunho.numero + 1}) abre a partir dela — editar nunca parte do vazio (DO-FLW-03).`}
      confirmLabel="Publicar"
      onConfirm={() => {
        const r = run((data, me) => publicarVersao(data, me, flow.id, { notas }));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        report(r, `v${r.value.publicada.numero} publicada; v${r.value.rascunho.numero} aberta em rascunho.`);
        onClose();
      }}
      onCancel={onClose}
    >
      <div className="grid gap-3">
        <Field label="Notas da versão" hint="Opcional. O que mudou.">
          {(id) => <TextInput id={id} value={notas} onChange={setNotas} placeholder="Por exemplo: pergunta o WhatsApp da clínica" />}
        </Field>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
