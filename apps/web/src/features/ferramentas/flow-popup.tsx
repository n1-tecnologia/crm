"use client";

/**
 * O POPUP DO FLOW — a ficha no formato da Tarefa (23): as propriedades, as
 * Versões (com criar rascunho a partir de qualquer uma, descartar, abrir no
 * construtor), os Envios recentes e a Atividade. Editar Telas e Componentes
 * é no construtor (página cheia); enviar a um Contato é aqui.
 */

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Fingerprint, Hash, KeyRound, Radio, RefreshCw, Send, Tag, Type, Workflow } from "lucide-react";
import { useData, useRun, useSession } from "@/dados/store";
import {
  adicionarNotaNoAtivo,
  arquivarFlow,
  capacidadesDoCanal,
  copiarFlow,
  criarRascunhoAPartirDe,
  definirPontoDeTrocaDeDados,
  descartarRascunho,
  despublicarFlow,
  editarFlow,
  enviarFlow,
  enviarFlowALixeira,
  recusaDeAdministracao,
  recusaDeEnvioDeFlow,
  regenerarChavesDoPonto,
  removerPontoDeTrocaDeDados,
  restaurarFlow,
  restaurarFlowDaLixeira,
  sincronizarFlow,
} from "@n1/dominio/operations";
import { contactDisplayName, responseWindowOpenUntil } from "@n1/dominio/derive";
import { enviosDoFlow, metricasDoFlow, telasOrdenadas, versaoCorrente, versaoPublicada } from "@n1/dominio/derive-ferramentas";
import type { CategoriaDeFlow, Flow } from "@n1/dominio/types";
import { LinhaDeProp } from "@/features/estrutura/linha-de-propriedade";
import { AsideDeAtividade, EditorDeTexto, useAvisos, useNomeDoAtor, type Report } from "@/features/shell/ficha";
import { useFormat } from "@/features/shell/use-format";
import { ActionMenu, Button, ConditionMarker, ConfirmDialog, CorpoDeTela, EmptyState, Field, Icone, Pilula, ReguaDeSecao, Select, SidePanel, StateSeal, TextArea, TextInput } from "@/features/shell/ui";
import { CATEGORIA_DE_FLOW_LABEL, ESTADO_NO_PROVEDOR_LABEL, ESTADO_NO_PROVEDOR_TOM, SINCRONIZACAO_LABEL, SINCRONIZACAO_TOM, VERSAO_LABEL, VERSAO_TOM } from "./rotulos";

export function FlowPopup({ flowId, onClose, onAbrirConstrutor }: { readonly flowId: string | null; readonly onClose: () => void; readonly onAbrirConstrutor: (flowId: string) => void }) {
  if (flowId === null) return null;
  return (
    <SidePanel
      title="Flow"
      open
      onClose={onClose}
      semRespiro
      footer={
        <span className="flex flex-1 items-center justify-end gap-2">
          <Link href={`/ferramentas/flows/${flowId}`} className="btn btn-solido btn-sm">
            Abrir no construtor
          </Link>
        </span>
      }
    >
      <FlowCompleto flowId={flowId} onClose={onClose} onAbrirConstrutor={onAbrirConstrutor} />
    </SidePanel>
  );
}

export function FlowCompleto({ flowId, onClose, onAbrirConstrutor }: { readonly flowId: string; readonly onClose?: () => void; readonly onAbrirConstrutor: (flowId: string) => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const authorLabel = useNomeDoAtor();
  const [confirmando, setConfirmando] = useState<"lixeira" | "arquivar" | "despublicar" | "chaves" | "descartar" | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ponto, setPonto] = useState<string | null>(null);

  const flow = state.flows.find((f) => f.id === flowId);
  if (!flow) {
    return (
      <div className="p-6">
        <EmptyState title="Flow não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
      </div>
    );
  }

  const canal = state.channels.find((c) => c.id === flow.canalId);
  const publicada = versaoPublicada(flow);
  const rascunho = versaoCorrente(flow);
  const naLixeira = flow.lifecycle === "naLixeira";
  const somenteLeitura = naLixeira ? "Um Flow na lixeira é somente leitura." : undefined;
  const adm = recusaDeAdministracao(state, memberId);
  const recusaEnvio = recusaDeEnvioDeFlow(state, flow);
  const metricas = metricasDoFlow(state, flow.id);
  const envios = enviosDoFlow(state, flow.id).slice(0, 8);
  const activity = state.activity.filter((a) => a.objectId === flow.id);
  const versoes = [...flow.versoes].sort((a, b) => b.numero - a.numero);

  const gravar = (patch: Parameters<typeof editarFlow>[3], mensagem: string) => report(run((data, me) => editarFlow(data, me, flow.id, patch)), mensagem);

  const menu = [
    { label: "Abrir no construtor", onSelect: () => onAbrirConstrutor(flow.id) },
    { label: "Enviar a um Contato", onSelect: () => setEnviando(true), ...(recusaEnvio ? { disabledReason: recusaEnvio } : {}) },
    { label: "Sincronizar", onSelect: () => report(run((data, me) => sincronizarFlow(data, me, flow.id)), "Flow sincronizado."), ...(naLixeira ? { disabledReason: "Na lixeira." } : {}) },
    { label: "Copiar", onSelect: () => report(run((data, me) => copiarFlow(data, me, flow.id)), "Flow copiado, com Proveniência.") },
    { label: "Despublicar", destructive: true, onSelect: () => setConfirmando("despublicar"), ...(adm ? { disabledReason: adm } : !publicada ? { disabledReason: "Não há Versão publicada." } : {}) },
    flow.lifecycle === "ativo"
      ? { label: "Arquivar", onSelect: () => setConfirmando("arquivar") }
      : flow.lifecycle === "arquivado"
        ? { label: "Restaurar", onSelect: () => report(run((data, me) => restaurarFlow(data, me, flow.id)), "Flow restaurado.") }
        : { label: "Restaurar da lixeira", onSelect: () => report(run((data, me) => restaurarFlowDaLixeira(data, me, flow.id)), "Flow restaurado.") },
    { label: "Enviar à lixeira", destructive: true, onSelect: () => setConfirmando("lixeira"), ...(naLixeira ? { disabledReason: "Já está na lixeira." } : {}) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConfirmDialog
        open={confirmando === "lixeira"}
        title={`Enviar “${flow.nome}” à lixeira?`}
        description="As Mensagens mantêm o valor; o objeto no provedor não é tocado (INV-ATV-05)."
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          const r = run((data, me) => enviarFlowALixeira(data, me, flow.id));
          setConfirmando(null);
          report(r, "Flow enviado à lixeira.");
          if (r.ok) onClose?.();
        }}
        onCancel={() => setConfirmando(null)}
      />
      <ConfirmDialog
        open={confirmando === "arquivar"}
        title={`Arquivar “${flow.nome}”?`}
        description={publicada ? "Arquivado, o Flow não é enviável; a Versão publicada continua no provedor até você despublicar (12.5). Despublicar é outro ato." : "Arquivado, o Flow não é enviável; o rascunho fica preservado."}
        confirmLabel="Arquivar"
        onConfirm={() => {
          setConfirmando(null);
          report(run((data, me) => arquivarFlow(data, me, flow.id)), "Flow arquivado.");
        }}
        onCancel={() => setConfirmando(null)}
        {...(publicada && !adm ? { footerStart: <Button variant="danger" size="sm" onClick={() => { setConfirmando(null); const d = run((data, me) => despublicarFlow(data, me, flow.id)); if (d.ok) report(run((data, me) => arquivarFlow(data, me, flow.id)), "Despublicado e arquivado."); else report(d, ""); }}>Despublicar e arquivar</Button> } : {})}
      />
      <ConfirmDialog
        open={confirmando === "despublicar"}
        title={`Despublicar v${publicada?.numero ?? ""}?`}
        description="A publicada vira obsoleta sem publicar outra: o Flow deixa de ser enviável. Respostas de quem já abriu continuam a chegar."
        confirmLabel="Despublicar"
        destructive
        onConfirm={() => {
          setConfirmando(null);
          report(run((data, me) => despublicarFlow(data, me, flow.id)), "Versão despublicada.");
        }}
        onCancel={() => setConfirmando(null)}
      />
      <ConfirmDialog
        open={confirmando === "chaves"}
        title="Regenerar as chaves do Ponto de troca de dados?"
        description="O par anterior deixa de valer e a Versão publicada precisa ser republicada (RN-FLW-10). A chave privada nunca é exibida (INV-FLW-09)."
        confirmLabel="Regenerar"
        destructive
        onConfirm={() => {
          setConfirmando(null);
          report(run((data, me) => regenerarChavesDoPonto(data, me, flow.id)), "Chaves regeneradas: republique a Versão.");
        }}
        onCancel={() => setConfirmando(null)}
      />
      <ConfirmDialog
        open={confirmando === "descartar"}
        title={`Descartar o rascunho v${rascunho?.numero ?? ""}?`}
        description="O que foi editado desde a última publicação se perde. Para voltar a editar, crie um rascunho a partir de uma Versão (RN-FLW-05)."
        confirmLabel="Descartar"
        destructive
        onConfirm={() => {
          setConfirmando(null);
          report(run((data, me) => descartarRascunho(data, me, flow.id)), "Rascunho descartado.");
        }}
        onCancel={() => setConfirmando(null)}
      />
      {enviando ? <EnviarFlowDialog flow={flow} onClose={() => setEnviando(false)} report={report} /> : null}
      <ConfirmDialog
        open={ponto !== null}
        title="Ponto de troca de dados"
        description="O endereço externo que responde às Ações “troca de dados”. A plataforma gera o par de chaves e grava só a pública."
        confirmLabel="Gravar"
        {...(ponto !== null && !/^https:\/\/\S+$/.test(ponto.trim()) ? { confirmDisabledReason: "O endereço começa por https://." } : {})}
        onConfirm={() => {
          if (ponto === null) return;
          report(run((data, me) => definirPontoDeTrocaDeDados(data, me, flow.id, ponto)), "Ponto de troca de dados gravado.");
          setPonto(null);
        }}
        onCancel={() => setPonto(null)}
      >
        <Field label="Endereço" required>
          {(id) => <TextInput id={id} value={ponto ?? ""} onChange={setPonto} placeholder="https://…" />}
        </Field>
      </ConfirmDialog>

      <div className="@container flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col @4xl:flex-row">
          <CorpoDeTela>
            {avisos}
            <div className="@container mx-auto w-full max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <Pilula cor="var(--info)" className="gap-1.5">
                  <Icone de={Workflow} tamanho="xs" />
                  Flow
                </Pilula>
                <StateSeal state={flow.lifecycle} />
                {publicada ? <Pilula tom="sucesso">v{publicada.numero} publicada</Pilula> : <ConditionMarker tone="neutral">sem Versão publicada</ConditionMarker>}
                {rascunho ? <Pilula tom="aviso">v{rascunho.numero} em rascunho</Pilula> : null}
                {!canal ? <ConditionMarker tone="warning">sem Canal publicador</ConditionMarker> : null}
                <span className="ml-auto">
                  <ActionMenu items={menu} />
                </span>
              </div>

              <h1 className="ed-display mt-3 px-2 py-1">{flow.nome}</h1>
              <LinhaDeProp icone={Type} rotulo="Descrição" valor={flow.descricao || "Adicionar descrição…"} editavel={!naLixeira} motivo={somenteLeitura} editor={<EditorDeTexto valor={flow.descricao} onSave={(v) => gravar({ descricao: v }, "Descrição alterada.")} placeholder="Uso interno" />} />

              <div className="mt-4 grid gap-x-8 gap-y-0.5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid min-w-0 content-start gap-0.5">
                  <LinhaDeProp icone={Workflow} rotulo="Nome" valor={flow.nome} editavel={!naLixeira} motivo={somenteLeitura} editor={<EditorDeTexto valor={flow.nome} onSave={(v) => gravar({ nome: v }, "Nome alterado.")} />} />
                  <LinhaDeProp
                    icone={Tag}
                    rotulo="Categoria"
                    valor={CATEGORIA_DE_FLOW_LABEL[flow.categoria]}
                    editavel={!naLixeira}
                    motivo={somenteLeitura}
                    editor={
                      <span className="block w-56">
                        <Select value={flow.categoria} onChange={(v) => gravar({ categoria: v as CategoriaDeFlow }, "Categoria alterada.")} options={(Object.keys(CATEGORIA_DE_FLOW_LABEL) as CategoriaDeFlow[]).map((c) => ({ value: c, label: CATEGORIA_DE_FLOW_LABEL[c] }))} />
                      </span>
                    }
                  />
                  <LinhaDeProp
                    icone={Radio}
                    rotulo="Canal publicador"
                    valor={canal ? canal.name : "Nenhum"}
                    editavel={!naLixeira}
                    motivo={somenteLeitura ?? (publicada ? "Trocar com Versão publicada exige administrar e torna a publicada obsoleta (RN-FLW-09)." : undefined)}
                    editor={
                      <span className="block w-64">
                        <Select
                          value={flow.canalId ?? ""}
                          onChange={(v) => gravar({ canalId: v || null }, v ? "Canal publicador alterado." : "Canal publicador removido.")}
                          placeholder="Nenhum"
                          options={[{ value: "", label: "Nenhum" }, ...state.channels.filter((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo").map((c) => ({ value: c.id, label: c.name, detail: c.connection }))]}
                        />
                      </span>
                    }
                  />
                  <LinhaDeProp icone={Fingerprint} rotulo="Identificador externo" valor={flow.identificadorExterno ? <span className="identificador">{flow.identificadorExterno}</span> : "Ainda não publicado"} motivo="Preenchido na primeira publicação (INV-FLW-08)." />
                  <LinhaDeProp icone={RefreshCw} rotulo="No provedor" valor={flow.estadoNoProvedor ? <Pilula tom={ESTADO_NO_PROVEDOR_TOM[flow.estadoNoProvedor]}>{ESTADO_NO_PROVEDOR_LABEL[flow.estadoNoProvedor]}</Pilula> : "—"} motivo="Espelhado pela Sincronização." />
                  <LinhaDeProp
                    icone={RefreshCw}
                    rotulo="Sincronização"
                    valor={
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Pilula tom={SINCRONIZACAO_TOM[flow.sincronizacao.estado]}>{SINCRONIZACAO_LABEL[flow.sincronizacao.estado]}</Pilula>
                        {flow.sincronizacao.detalhe ? <span className="app-meta">· {flow.sincronizacao.detalhe}</span> : null}
                      </span>
                    }
                    motivo="Muda por “Sincronizar”."
                  />
                </div>
                <div className="grid min-w-0 content-start gap-0.5">
                  <LinhaDeProp icone={Hash} rotulo="Versão publicada" valor={publicada ? `v${publicada.numero} · ${publicada.publicadaEm ? fmt.relative(publicada.publicadaEm) : ""}` : "Nenhuma"} motivo="Muda por “Publicar”, no construtor." />
                  <LinhaDeProp
                    icone={Hash}
                    rotulo="Rascunho"
                    controle={
                      rascunho ? (
                        <span className="app-base flex items-center gap-1.5" style={{ color: "var(--texto)" }}>
                          v{rascunho.numero}
                          <Button size="sm" variant="ghost" onClick={() => onAbrirConstrutor(flow.id)}>
                            Editar
                          </Button>
                        </span>
                      ) : (
                        <span className="app-base" style={{ color: "var(--texto)" }}>
                          Nenhum — crie a partir de uma Versão
                        </span>
                      )
                    }
                  />
                  <LinhaDeProp
                    icone={KeyRound}
                    rotulo="Ponto de troca de dados"
                    controle={
                      flow.pontoDeTrocaDeDados ? (
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="identificador min-w-0 break-all">{flow.pontoDeTrocaDeDados.endereco}</span>
                          <span className="app-meta">chaves de {fmt.relative(flow.pontoDeTrocaDeDados.chavesGeradasEm)}</span>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmando("chaves")} disabled={adm !== undefined} {...(adm ? { disabledReason: adm } : {})}>
                            Regenerar chaves
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => report(run((data, me) => removerPontoDeTrocaDeDados(data, me, flow.id)), "Ponto removido.")} disabled={!rascunho} disabledReason="Só com rascunho aberto.">
                            Remover
                          </Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setPonto("")} disabled={!rascunho || naLixeira} disabledReason={naLixeira ? "Na lixeira." : "Só com rascunho aberto."}>
                          Definir
                        </Button>
                      )
                    }
                  />
                  <LinhaDeProp icone={Send} rotulo="Envios · Respostas · Taxa" valor={<span className="app-numero">{fmt.number(metricas.envios)} · {fmt.number(metricas.respostas)} · {metricas.taxa === null ? "—" : `${Math.round(metricas.taxa * 100)}%`}</span>} motivo="Derivados das Mensagens; nunca gravados. Abandono não existe (7.6)." />
                  <LinhaDeProp icone={ChevronRight} rotulo="Estado" valor={flow.lifecycle === "ativo" ? "Ativo" : <StateSeal state={flow.lifecycle} />} motivo="O estado muda por um ato." />
                </div>
              </div>

              <hr className="my-6 border-0" style={{ borderTop: "1px solid var(--linha)" }} />

              <div className="grid gap-6">
                <section>
                  <ReguaDeSecao rotulo="Versões" contagem={versoes.length} />
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th className="app-coluna">Versão</th>
                        <th className="app-coluna">Estado</th>
                        <th className="app-coluna">Telas</th>
                        <th className="app-coluna">Publicada</th>
                        <th className="app-coluna">Notas</th>
                        <th className="app-coluna" data-vazia="true" aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {versoes.map((v) => (
                        <tr key={v.id}>
                          <td className="whitespace-nowrap">
                            <span className="app-md" style={{ color: "var(--texto)" }}>
                              v{v.numero}
                            </span>
                            {v.proveniencia ? <span className="app-meta"> · de v{v.proveniencia.numero}</span> : null}
                          </td>
                          <td className="whitespace-nowrap">
                            <Pilula tom={VERSAO_TOM[v.estado]}>{VERSAO_LABEL[v.estado]}</Pilula>
                          </td>
                          <td className="max-w-[24ch] whitespace-nowrap">
                            {(() => {
                              const telas = telasOrdenadas(v)
                                .map((t) => t.identificador)
                                .join(" → ");
                              return (
                                <span className="app-sm block truncate" style={{ color: "var(--texto-2)" }} title={telas}>
                                  {telas}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="app-sm" style={{ color: "var(--texto-2)" }}>
                              {v.publicadaEm ? `${fmt.instant(v.publicadaEm)}${v.publicadaPor ? ` · ${authorLabel(v.publicadaPor)}` : ""}` : "—"}
                            </span>
                          </td>
                          <td className="max-w-[20ch] whitespace-nowrap">
                            <span className="app-sm block truncate" style={{ color: "var(--texto-2)" }} title={v.notas}>
                              {v.notas ?? "—"}
                            </span>
                          </td>
                          <td>
                            <ActionMenu
                              items={[
                                { label: v.estado === "rascunho" ? "Abrir no construtor" : "Ver no construtor", onSelect: () => onAbrirConstrutor(flow.id) },
                                { label: "Criar rascunho a partir desta", onSelect: () => report(run((data, me) => criarRascunhoAPartirDe(data, me, flow.id, v.id)), `Rascunho criado a partir da v${v.numero}.`), ...(rascunho ? { disabledReason: "Já há um rascunho: descarte-o antes (RN-FLW-02)." } : naLixeira ? { disabledReason: "Na lixeira." } : {}) },
                                ...(v.estado === "rascunho" ? [{ label: "Descartar rascunho", destructive: true, onSelect: () => setConfirmando("descartar"), ...(flow.versoes.length === 1 ? { disabledReason: "É a única Versão do Flow (RN-FLW-03)." } : {}) }] : []),
                              ]}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section>
                  <ReguaDeSecao
                    rotulo="Envios"
                    contagem={metricas.envios}
                    acao={
                      <Button size="sm" onClick={() => setEnviando(true)} disabled={recusaEnvio !== undefined} {...(recusaEnvio ? { disabledReason: recusaEnvio } : {})}>
                        Enviar a um Contato
                      </Button>
                    }
                  />
                  {envios.length === 0 ? (
                    <EmptyState compact title="Nenhum envio ainda." hint="Só a Versão publicada é enviável (RN-FLW-01)." />
                  ) : (
                    <ul className="pilha-solta">
                      {envios.map(({ conversa, mensagem }) => {
                        const contato = state.contacts.find((c) => c.id === conversa.contactId);
                        const respondeu = conversa.messages.some((m) => m.respostaDeFlow?.mensagemDeOrigemId === mensagem.id);
                        return (
                          <li key={mensagem.id}>
                            <Link href={`/crm/caixa-de-entrada/${conversa.id}`} className="item-solto">
                              <span className="min-w-0 flex-1">
                                <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                                  {contato ? contactDisplayName(contato) : conversa.title}
                                </span>
                                <span className="app-meta block truncate">
                                  v{mensagem.flow?.numeroDaVersao} · {fmt.relative(mensagem.createdAt)} · {mensagem.deliveryStatus ?? ""}
                                </span>
                              </span>
                              <Pilula tom={respondeu ? "sucesso" : "neutro"}>{respondeu ? "respondido" : "sem resposta"}</Pilula>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </CorpoDeTela>

          <AsideDeAtividade
            comments={flow.comments}
            activity={activity}
            onAddNote={(texto) => run((data, me) => adicionarNotaNoAtivo(data, me, "flow", flow.id, texto))}
            editavel={!naLixeira}
            authorLabel={authorLabel}
            report={report}
            vazioDoRegistro="Nenhum Registro de Atividade neste Flow."
          />
        </div>
      </div>
    </div>
  );
}

/** Enviar a Versão publicada a um Contato: escolhe a Conversa do Canal publicador, o corpo e o rótulo do botão. */
export function EnviarFlowDialog({ flow, onClose, report }: { readonly flow: Flow; readonly onClose: () => void; readonly report: Report }) {
  const state = useData((data) => data);
  const run = useRun();
  const publicada = versaoPublicada(flow);
  const [conversationId, setConversationId] = useState("");
  const [corpo, setCorpo] = useState("Antes de falarmos, me conta em 30 segundos sobre você? É só tocar em Abrir.");
  const [rotulo, setRotulo] = useState("Abrir");
  const [telaInicial, setTelaInicial] = useState(publicada ? (telasOrdenadas(publicada)[0]?.identificador ?? "") : "");
  const [erro, setErro] = useState<string | null>(null);
  // O instante de abertura: a Janela de resposta não muda enquanto o diálogo está aberto.
  const [agora] = useState(() => Date.now());

  const conversas = state.conversations
    .filter((c) => c.lifecycle === "ativo" && c.channelId === flow.canalId && !c.groupIdentifier && c.contactId)
    .map((c) => {
      const contato = state.contacts.find((x) => x.id === c.contactId);
      const janela = responseWindowOpenUntil(state, c, capacidadesDoCanal);
      const fora = janela !== null && janela.getTime() < agora;
      return { value: c.id, label: contato ? contactDisplayName(contato) : c.title, detail: `${c.state}${fora ? " · fora da janela de resposta" : ""}`, ...(fora ? { disabledReason: "Fora da Janela de resposta: só Mensagem de modelo (RN-CXE-19)." } : {}) };
    });

  return (
    <ConfirmDialog
      open
      title={`Enviar “${flow.nome}”`}
      description={publicada ? `A Mensagem leva a v${publicada.numero} (a publicada). O Contato abre o Flow pelo botão e a Resposta volta como Mensagem recebida (7.6).` : "O Flow não tem Versão publicada."}
      confirmLabel="Enviar"
      wide
      {...(!publicada ? { confirmDisabledReason: "Publique antes de enviar (RN-FLW-01)." } : !conversationId ? { confirmDisabledReason: "Escolha a Conversa." } : !corpo.trim() ? { confirmDisabledReason: "Escreva o corpo da Mensagem." } : {})}
      onConfirm={() => {
        const r = run((data, me) => enviarFlow(data, me, { flowId: flow.id, conversationId, corpo, rotuloDoBotao: rotulo, telaInicial }));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        report(r, `Flow enviado na Conversa ${r.value.conversa.title}.`);
        onClose();
      }}
      onCancel={onClose}
    >
      <div className="grid gap-4">
        <Field label="Conversa" required hint="Uma Conversa 1:1 do Canal publicador, dentro da Janela de resposta.">
          {(id) => <Select id={id} value={conversationId} onChange={setConversationId} searchable placeholder="Escolher o Contato" options={conversas} />}
        </Field>
        <Field label="Corpo da Mensagem" required>
          {(id) => <TextArea id={id} value={corpo} onChange={setCorpo} rows={2} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rótulo do botão" hint="O que o Contato toca para abrir.">
            {(id) => <TextInput id={id} value={rotulo} onChange={setRotulo} placeholder="Abrir" />}
          </Field>
          <Field label="Tela inicial" hint="Padrão: a primeira da ordem.">
            {(id) => <Select id={id} value={telaInicial} onChange={setTelaInicial} options={publicada ? telasOrdenadas(publicada).map((t) => ({ value: t.identificador, label: t.titulo, detail: t.identificador })) : []} />}
          </Field>
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
