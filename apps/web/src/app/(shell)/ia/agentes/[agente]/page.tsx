"use client";

import Link from "next/link";
import { use } from "react";
import { useData } from "@/dados/store";
import {
  EFFECT_CLASS_LABEL,
  EXECUTION_ORIGIN_LABEL,
  EXECUTION_STATE_LABEL,
} from "@/features/shell/format";
import {
  CabecalhoDePainel,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Painel,
  RecordPanel,
  RecordRow,
  StateSeal,
} from "@/features/shell/ui";

export default function AgentePage({ params }: { params: Promise<{ agente: string }> }) {
  const { agente } = use(params);
  const state = useData((data) => data);
  const record = state.agents.find((a) => a.id === agente);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Agente não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const concessoes = state.skillGrants.filter((g) => g.agentId === record.id);
  const ferramentas = record.versions.at(-1)?.allowedToolIds ?? [];
  const execucoes = state.agentExecutions.filter((e) => e.agentId === record.id);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={record.name}
        seal={<StateSeal state={record.lifecycle} />}
        actions={
          record.lifecycle !== "naLixeira" ? (
            <Link href={`/ia/personalizar/agente?editar=${record.id}`} className="btn btn-contorno btn-sm">
              Editar no Construtor
            </Link>
          ) : null
        }
      />
      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ------------------------------------------------ coluna principal */}
          <div className="grid content-start gap-3">
            <Painel>
              <CabecalhoDePainel titulo="Habilidades concedidas" contagem={concessoes.length} />
              <div className="p-3">
                {concessoes.length === 0 ? (
                  <EmptyState
                    compact
                    title="Nenhuma Habilidade concedida."
                    hint="O Agente age apenas com as instruções, as Ferramentas permitidas e o Conhecimento a que tem acesso."
                  />
                ) : (
                  <ul className="pilha-solta">
                    {concessoes.map((grant) => (
                      <li key={grant.id} className="item-solto" data-estatico="true">
                        <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                          {state.skills.find((s) => s.id === grant.skillId)?.name}
                        </span>
                        <span className="app-meta shrink-0">
                          {grant.pinnedVersion ? `versão fixada ${grant.pinnedVersion}` : "segue a versão corrente"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Ferramentas permitidas" contagem={ferramentas.length} />
              <div className="p-3">
                {ferramentas.length === 0 ? (
                  <EmptyState
                    compact
                    title="Nenhuma Ferramenta permitida."
                    hint="O Agente é puramente conversacional: responde, mas não lê nem altera registro algum."
                  />
                ) : (
                  <ul className="pilha-solta">
                    {ferramentas.map((toolId) => {
                      const tool = state.tools.find((t) => t.id === toolId);
                      return (
                        <li key={toolId} className="item-solto" data-estatico="true">
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {tool?.name ?? toolId}
                          </span>
                          <span className="app-meta shrink-0">
                            {tool ? (EFFECT_CLASS_LABEL[tool.effectClass] ?? tool.effectClass) : "não está no Catálogo"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Execuções" contagem={execucoes.length} />
              <div className="p-3">
                {execucoes.length === 0 ? (
                  <EmptyState compact title="Nenhuma Execução ainda." />
                ) : (
                  <ul className="pilha-solta">
                    {execucoes.map((execution) => (
                      <li key={execution.id}>
                        <Link href={`/ia/execucoes/${execution.id}`} className="item-solto">
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {EXECUTION_STATE_LABEL[execution.state] ?? execution.state} · origem:{" "}
                            {EXECUTION_ORIGIN_LABEL[execution.origin] ?? execution.origin}
                            {execution.rehearsal ? " · ensaio" : ""}
                          </span>
                          <span className="app-meta app-numero shrink-0">{execution.steps.length} passo(s)</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Memória do Agente" contagem={record.memory.length} />
              <div className="p-3">
                {record.memory.length === 0 ? (
                  <EmptyState compact title="Nenhum fato memorizado." />
                ) : (
                  <ul className="pilha-solta">
                    {record.memory.map((item) => (
                      <li key={item.id} className="item-solto" data-bloco="true" data-estatico="true">
                        <p className="app-base" style={{ color: "var(--texto)" }}>
                          {item.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>
          </div>

          {/* ------------------------------------------------ coluna lateral */}
          <div className="grid content-start gap-3">
            <RecordPanel title="Configuração">
              <dl>
                <RecordRow label="Proprietário">{state.members.find((m) => m.id === record.ownerMemberId)?.displayName ?? "—"}</RecordRow>
                <RecordRow label="Papel">{state.roles.find((r) => r.id === record.roleId)?.name ?? "—"}</RecordRow>
                <RecordRow label="Versão corrente">{record.versions.at(-1)?.number ?? 1}</RecordRow>
                <RecordRow label="Nível de autonomia">{record.versions.at(-1)?.autonomy}</RecordRow>
                <RecordRow label="Modelo">
                  {(() => {
                    const modelId = record.versions.at(-1)?.modelId;
                    if (!modelId) return "não definido";
                    if (modelId === "padraoDaPlataforma") return "o padrão da plataforma";
                    return state.models.find((model) => model.id === modelId)?.name ?? modelId;
                  })()}
                </RecordRow>
                <RecordRow label="Política de aprovação">{record.versions.at(-1)?.approvalPolicy.timeoutHours} h</RecordRow>
                {/* O objetivo é frase inteira: numa linha rótulo→valor ele seria cortado. */}
                <div className="pt-2">
                  <dt className="app-meta">Objetivo</dt>
                  <dd className="app-base" style={{ color: "var(--texto)" }}>
                    {record.versions.at(-1)?.objective}
                  </dd>
                </div>
              </dl>
            </RecordPanel>

            {(() => {
              const v = record.versions.at(-1);
              if (!v || (!v.icebreakers?.length && !v.knowledgeSources?.length && !v.responseFormat && !v.accessPoints?.length)) return null;
              const FORMATO: Record<string, string> = { texto: "Texto livre", markdown: "Markdown", json: "JSON", estruturado: "Formato estruturado" };
              const ACESSO: Record<string, string> = { chat: "Chat da plataforma", whatsapp: "WhatsApp", api: "API", webhook: "Webhook" };
              return (
                <RecordPanel title="Configuração do Construtor">
                  <dl className="grid gap-2">
                    {v.icebreakers?.length ? (
                      <div>
                        <dt className="app-meta">Quebra-gelos</dt>
                        <dd className="app-base" style={{ color: "var(--texto)" }}>
                          {v.icebreakers.join(" · ")}
                        </dd>
                      </div>
                    ) : null}
                    {v.knowledgeSources?.length ? (
                      <div>
                        <dt className="app-meta">Conhecimento</dt>
                        <dd className="app-base" style={{ color: "var(--texto)" }}>
                          {v.knowledgeSources.map((k) => k.label).join(" · ")}
                        </dd>
                      </div>
                    ) : null}
                    {v.responseFormat ? (
                      <div>
                        <dt className="app-meta">Formato de resposta</dt>
                        <dd className="app-base" style={{ color: "var(--texto)" }}>
                          {FORMATO[v.responseFormat] ?? v.responseFormat}
                        </dd>
                      </div>
                    ) : null}
                    {v.accessPoints?.length ? (
                      <div>
                        <dt className="app-meta">Pontos de acesso</dt>
                        <dd className="app-base" style={{ color: "var(--texto)" }}>
                          {v.accessPoints.map((a) => ACESSO[a] ?? a).join(", ")}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </RecordPanel>
              );
            })()}
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
