"use client";

/**
 * Execução de Agente — a superfície que os fluxos 7 e 8 apontam.
 *
 * Ela não estava numerada no inventário da Fase 2, e a ausência aparecia como
 * dois passos de fluxo sem destino. Registrada em PENDENCIAS-FRONTEND.
 *
 * O que ela precisa provar, e por isso ocupa a tela inteira:
 *   B79 — a Cadeia completa, da raiz até esta Execução: uma Automação que
 *         invoca um Agente que invoca outro é rastreável de ponta a ponta.
 *   A9.3 — a permissão efetiva é a interseção, e SÓ o delegante Membro entra
 *         nela; um Agente delegante não amplia nada.
 *   DO-HAB-14 — cada Passo grava as DUAS verificações independentes: a
 *         Ferramenta é permitida ao Agente, e o Recurso-alvo é permitido.
 *   B98 — toda saída baseada em Conhecimento carrega as Referências, e elas
 *         nunca são apagadas.
 *   B82 — um ensaio simula as escritas: sem efeito e sem memória.
 */

import Link from "next/link";
import { use } from "react";
import { useData } from "@/data/store";
import { executionChainOf } from "@/data/derive";
import { ACTOR_KIND_LABEL, EFFECT_CLASS_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  ActorAvatar,
  CabecalhoDePainel,
  ConditionMarker,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Painel,
  Pilula,
  RecordPanel,
  RecordRow,
} from "@/features/shell/ui";
import type { DataState } from "@/data/state";
import type { ActorKind } from "@/design/components";
import type { ActorRef, ExecutionStep } from "@/data/types";

const STATE_LABEL: Record<string, string> = {
  pendente: "pendente",
  executando: "executando",
  aguardandoAprovacao: "aguardando aprovação",
  concluida: "concluída",
  falhou: "falhou",
  cancelada: "cancelada",
};

const STATE_COLOR: Record<string, string> = {
  pendente: "var(--cor-exe-pendente)",
  executando: "var(--cor-exe-executando)",
  aguardandoAprovacao: "var(--cor-exe-aguardando)",
  concluida: "var(--cor-exe-concluida)",
  falhou: "var(--cor-exe-falhou)",
  cancelada: "var(--cor-exe-cancelada)",
};

const STEP_KIND_LABEL: Record<string, string> = {
  ferramenta: "Ferramenta",
  habilidade: "Habilidade",
  aprovacao: "Aprovação",
  raciocinio: "Raciocínio",
  memorizacao: "Memorização",
};

const ORIGIN_LABEL: Record<string, string> = {
  sessaoDeChat: "Sessão de Chat",
  acaoDireta: "ação direta",
  automacao: "Automação",
  agente: "outro Agente",
  caixaDeEntrada: "Caixa de Entrada",
};

/** O bloco de texto imutável — entrada, saída, objeto de um Passo. */
function Bruto({ children, compacto = false }: { readonly children: React.ReactNode; readonly compacto?: boolean }) {
  return (
    <pre
      className={`app-sm overflow-x-auto rounded-[var(--r-controle)] ${compacto ? "p-2" : "p-3"}`}
      style={{ background: "var(--superficie-2)", border: "1px solid var(--linha)", color: "var(--texto)" }}
    >
      {children}
    </pre>
  );
}

export default function ExecucaoPage({ params }: { params: Promise<{ execucao: string }> }) {
  const { execucao } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();

  const record = state.agentExecutions.find((e) => e.id === execucao);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Execução não encontrada" />
        <CorpoDeTela>
          <EmptyState
            title="Execução não encontrada."
            hint="Ela é eliminada junto com o Agente a que pertence; os Registros de Atividade e os efeitos permanecem."
          />
        </CorpoDeTela>
      </div>
    );
  }

  const agent = state.agents.find((a) => a.id === record.agentId);
  const chain = executionChainOf(state, record.id);
  const approvals = state.approvals.filter((approval) => approval.executionId === record.id);
  const isTerminal = ["concluida", "falhou", "cancelada"].includes(record.state);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <>
            <Link href="/ia/agentes" className="hover:underline">
              Agentes
            </Link>
            {agent ? (
              <>
                {" › "}
                <Link href={`/ia/agentes/${agent.id}`} className="hover:underline">
                  {agent.name}
                </Link>
              </>
            ) : null}
          </>
        }
        title="Execução"
        seal={
          <Pilula cor={STATE_COLOR[record.state]} comPonto>
            {STATE_LABEL[record.state] ?? record.state}
          </Pilula>
        }
        details={
          <>
            <span className="app-meta">origem: {ORIGIN_LABEL[record.origin] ?? record.origin}</span>
            <span className="app-meta">autonomia efetiva: {record.effectiveAutonomy}</span>
            <span className="app-meta">iniciada {fmt.relative(record.startedAt)}</span>
            {record.rehearsal ? (
              <ConditionMarker tone="warning" title="B82 — escritas simuladas, sem efeito e sem memória.">
                ensaio
              </ConditionMarker>
            ) : null}
          </>
        }
      />

      {isTerminal ? (
        <p
          className="app-base shrink-0 px-4 py-2"
          style={{ background: "var(--superficie-2)", color: "var(--texto-3)", borderBottom: "1px solid var(--linha)" }}
        >
          Estado terminal, imutável. “Tentar de novo” é uma Execução nova, não a continuação desta.
          {record.terminationReason ? ` Motivo: ${record.terminationReason}.` : ""}
        </p>
      ) : null}

      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 content-start gap-3">
            <Painel>
              <CabecalhoDePainel titulo="Cadeia de Execuções" contagem={chain.length} />
              <div className="p-3">
                {chain.length <= 1 ? (
                  <p className="app-base" style={{ color: "var(--texto-3)" }}>
                    Execução raiz: ninguém a invocou a partir de outra.
                  </p>
                ) : (
                  <ol className="flex flex-wrap items-center gap-2">
                    {chain.map((link, index) => (
                      <li key={link.id} className="flex items-center gap-2">
                        {index > 0 ? (
                          <span aria-hidden="true" style={{ color: "var(--texto-4)" }}>
                            →
                          </span>
                        ) : null}
                        <Pilula tom={link.id === record.id ? "acento" : "neutro"}>
                          {link.name}
                          <span className="app-xs opacity-70">{link.kind}</span>
                        </Pilula>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="app-meta mt-2">Cancelar uma Execução de Automação mãe cancela as filhas.</p>
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Entrada" />
              <div className="p-3">
                <Bruto>{record.input}</Bruto>
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Passos" contagem={record.steps.length} />
              <div className="p-3">
                {record.steps.length === 0 ? (
                  <EmptyState compact title="Nenhum Passo registrado ainda." />
                ) : (
                  <ol className="pilha-solta">
                    {[...record.steps]
                      .sort((a, b) => a.index - b.index)
                      .map((step) => (
                        <li key={step.index} className="item-solto" data-bloco="true" data-estatico="true">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <span className="app-md" style={{ color: "var(--texto)" }}>
                              {step.index + 1}. {STEP_KIND_LABEL[step.kind] ?? step.kind}
                              {step.toolId
                                ? ` · ${state.tools.find((t) => t.id === step.toolId)?.name ?? step.toolId}`
                                : ""}
                              {step.skillId
                                ? ` · ${state.skills.find((s) => s.id === step.skillId)?.name ?? step.skillId}${
                                    step.skillVersion ? ` v${step.skillVersion}` : ""
                                  }`
                                : ""}
                            </span>
                            <span className="app-meta flex items-center gap-2">
                              {step.effectClass ? (
                                <span>{EFFECT_CLASS_LABEL[step.effectClass] ?? step.effectClass}</span>
                              ) : null}
                              <span className="app-numero">{fmt.instant(step.at)}</span>
                              <StepResult result={step.result} />
                            </span>
                          </div>

                          {step.input ? (
                            <div className="mt-2">
                              <Bruto compacto>{step.input}</Bruto>
                            </div>
                          ) : null}

                          <PermissionChecks step={step} />

                          {step.approvalRequestId ? (
                            <p className="app-sm mt-2">
                              <Link href="/ia/aprovacoes" className="underline" style={{ color: "var(--texto-3)" }}>
                                Solicitação de Aprovação que liberou este Passo
                              </Link>
                            </p>
                          ) : null}
                        </li>
                      ))}
                  </ol>
                )}
              </div>
            </Painel>

            {record.output ? (
              <Painel>
                <CabecalhoDePainel titulo="Saída" />
                <div className="p-3">
                  <Bruto>{record.output}</Bruto>
                </div>
              </Painel>
            ) : null}

            <Painel>
              <CabecalhoDePainel titulo="Referências de Conhecimento" contagem={record.knowledgeReferences.length} />
              <div className="p-3">
                {record.knowledgeReferences.length === 0 ? (
                  <EmptyState
                    compact
                    title="Esta saída não se baseou em Conhecimento."
                    hint="Quando se baseia, a referência é obrigatória e nunca é apagada."
                  />
                ) : (
                  <ul className="pilha-solta">
                    {record.knowledgeReferences.map((reference) => (
                      <li key={`${reference.documentId}-${reference.version}`}>
                        <Link href={`/ia/conhecimento/documentos/${reference.documentId}`} className="item-solto">
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {reference.documentTitle}
                          </span>
                          <span className="app-meta shrink-0">
                            v{reference.version} · {reference.fragmentIds.length} Fragmento(s) ·{" "}
                            {reference.collectionName}
                          </span>
                          {reference.marker ? (
                            <ConditionMarker tone="warning">{String(reference.marker)}</ConditionMarker>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>
          </div>

          <aside className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Quem agiu">
              <div className="grid gap-2">
                <ActorLine label="Invocador" actor={record.invokedBy} state={state} />
                {record.delegate ? (
                  <ActorLine label="Em nome de" actor={record.delegate} state={state} />
                ) : null}
                <p className="app-meta">
                  {record.delegate?.kind === "member"
                    ? "A permissão efetiva é a interseção entre o Agente e este Membro."
                    : "Sem delegante Membro: o Agente age só com as próprias permissões."}
                </p>
              </div>
            </RecordPanel>

            <RecordPanel title="Configuração fixa da Execução">
              <dl>
                <RecordRow label="Agente">
                  {agent ? (
                    <Link href={`/ia/agentes/${agent.id}`} className="hover:underline">
                      {agent.name}
                    </Link>
                  ) : (
                    "eliminado"
                  )}
                </RecordRow>
                <RecordRow label="Versão">v{record.agentVersion}</RecordRow>
                <RecordRow label="Modelo">
                  {state.models.find((m) => m.id === record.modelId)?.name ?? record.modelId}
                </RecordRow>
                <RecordRow label="Autonomia efetiva">{record.effectiveAutonomy}</RecordRow>
              </dl>
              <p className="app-meta mt-2">A versão e o Modelo são fixados no início e não mudam no meio.</p>
            </RecordPanel>

            <RecordPanel title="Composição do Contexto">
              <dl>
                <RecordRow label="Âncora">{record.contextComposition.anchor?.name ?? "nenhuma"}</RecordRow>
                <RecordRow label="Registros lidos">{record.contextComposition.readRecordIds.length}</RecordRow>
                <RecordRow label="Fragmentos">{record.contextComposition.fragmentRefs.length}</RecordRow>
                <RecordRow label="Itens de memória">{record.contextComposition.memoryItemIds.length}</RecordRow>
                <RecordRow label="Mensagens de Chat">{record.contextComposition.chatMessageIds.length}</RecordRow>
              </dl>
              <p className="app-meta mt-2">Só as referências: o Contexto é efêmero e nunca é guardado em conteúdo.</p>
            </RecordPanel>

            <RecordPanel title="Custo">
              <dl>
                <RecordRow label="Unidades de Modelo">{fmt.number(record.cost.modelUnits)}</RecordRow>
                <RecordRow label="Chamadas de Ferramenta">{record.cost.toolCalls}</RecordRow>
                <RecordRow label="Execuções filhas">{record.cost.childExecutions}</RecordRow>
                <RecordRow label="Duração">{fmt.number(Math.round(record.cost.durationMs / 100) / 10)} s</RecordRow>
              </dl>
              <p className="app-meta mt-2">O Custo é da Execução, nunca do Agente.</p>
            </RecordPanel>

            <RecordPanel title="Solicitações de Aprovação" count={approvals.length}>
              {approvals.length === 0 ? (
                <EmptyState compact title="Nenhuma Solicitação nesta Execução." />
              ) : (
                <ul className="pilha-solta">
                  {approvals.map((approval) => (
                    <li key={approval.id}>
                      <Link href="/ia/aprovacoes" className="item-solto">
                        <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                          {state.tools.find((t) => t.id === approval.object.toolId)?.name ??
                            approval.object.toolId}
                        </span>
                        <span className="app-meta shrink-0">{approval.decision ?? "pendente"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>
          </aside>
        </div>
      </CorpoDeTela>
    </div>
  );
}

/**
 * DO-HAB-14 — as duas verificações são independentes e ficam gravadas por
 * invocação: mostrar só uma esconderia metade da razão de um Passo ter sido
 * negado.
 */
function PermissionChecks({ step }: { readonly step: ExecutionStep }) {
  if (step.toolAllowed === undefined && step.resourcePermitted === undefined) return null;
  return (
    <p className="app-sm mt-2 flex flex-wrap gap-3">
      {step.toolAllowed !== undefined ? (
        <span style={{ color: step.toolAllowed ? "var(--sucesso)" : "var(--erro)" }}>
          Ferramenta {step.toolAllowed ? "permitida" : "não permitida"} ao Agente
        </span>
      ) : null}
      {step.resourcePermitted !== undefined ? (
        <span style={{ color: step.resourcePermitted ? "var(--sucesso)" : "var(--erro)" }}>
          Recurso-alvo {step.resourcePermitted ? "permitido" : "não permitido"}
        </span>
      ) : null}
    </p>
  );
}

function StepResult({ result }: { readonly result: ExecutionStep["result"] }) {
  const color =
    result === "concluido"
      ? "var(--sucesso)"
      : result === "falhou" || result === "negada"
        ? "var(--erro)"
        : result === "aguardando"
          ? "var(--cor-exe-aguardando)"
          : "var(--texto-3)";
  return (
    <Pilula cor={color} comPonto>
      {result}
    </Pilula>
  );
}

function ActorLine({
  label,
  actor,
  state,
}: {
  readonly label: string;
  readonly actor: ActorRef;
  readonly state: DataState;
}) {
  const name =
    actor.kind === "member"
      ? (state.members.find((m) => m.id === actor.id)?.displayName ?? "Membro removido")
      : actor.kind === "agent"
        ? (state.agents.find((a) => a.id === actor.id)?.name ?? "Agente")
        : actor.kind === "automation"
          ? (state.automations.find((a) => a.id === actor.id)?.name ?? "Automação")
          : (ACTOR_KIND_LABEL[actor.kind] ?? actor.kind);
  return (
    <div className="flex items-center gap-2">
      <ActorAvatar kind={actor.kind as ActorKind} name={name} />
      <span className="min-w-0">
        <span className="app-meta block">{label}</span>
        <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
          {name}
        </span>
      </span>
    </div>
  );
}
