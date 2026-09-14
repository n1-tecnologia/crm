"use client";

/**
 * O painel da esquerda: identidade, instruções, os seis cards e a barra de
 * publicar. Um card aberto por vez — abrir um fecha o outro.
 */

import {
  Box,
  FileText,
  LayoutDashboard,
  Link as LinkIcon,
  MessageCircle,
  ScrollText,
  SlidersHorizontal,
  Trash2,
  Wrench,
} from "lucide-react";
import { useId, useState } from "react";
import { useData } from "@/data/store";
import { Toggle } from "@/features/shell/ui";
import { AgentIdentity } from "./agent-identity";
import { AgentDashboard, AgentLogs } from "./agent-insights";
import { AgentInstructions } from "./agent-instructions";
import { ConfigAccordion } from "./config-accordion";
import { BuilderInlineInput, ChoiceRow, SmallAction } from "./fields";
import { PublishBar } from "./publish-bar";
import {
  ACCESS_POINT_LABEL,
  KNOWLEDGE_KIND_LABEL,
  RESPONSE_FORMAT_LABEL,
  type AccessPoint,
  type BuilderDraft,
  type KnowledgeKind,
  type ResponseFormat,
  type Section,
} from "./state";

let sequencia = 0;
const novoId = () => `ab_${(sequencia += 1)}`;

export function AgentConfigPanel({
  draft,
  onChange,
  dirty,
  publishing,
  published,
  onPublish,
  publishDisabledReason,
  error,
  publishedAgentId,
}: {
  readonly draft: BuilderDraft;
  readonly onChange: (patch: Partial<BuilderDraft>) => void;
  readonly dirty: boolean;
  readonly publishing: boolean;
  readonly published: string | null;
  readonly onPublish: () => void;
  readonly publishDisabledReason?: string;
  readonly error: string | null;
  readonly publishedAgentId: string | null;
}) {
  const execucoesDoAgente = useData((data) =>
    publishedAgentId ? data.agentExecutions.filter((e) => e.agentId === publishedAgentId).length : 0,
  );
  const state = useData((data) => data);
  const [open, setOpen] = useState<Section | null>(null);
  const [novoConhecimento, setNovoConhecimento] = useState<{ kind: KnowledgeKind; label: string } | null>(null);
  const toggle = (section: Section) => setOpen((atual) => (atual === section ? null : section));
  const ids = useId();

  const modelos = state.models.filter((model) => !model.discontinued);
  const ferramentas = state.tools;
  const bases = state.collections.filter((c) => c.lifecycle === "ativo");

  const [focoEm, setFocoEm] = useState<number | null>(null);
  const adicionarQuebraGelo = () => {
    setFocoEm(draft.icebreakers.length);
    onChange({ icebreakers: [...draft.icebreakers, ""] });
  };
  const editarQuebraGelo = (indice: number, texto: string) =>
    onChange({ icebreakers: draft.icebreakers.map((item, i) => (i === indice ? texto : item)) });
  const removerQuebraGelo = (indice: number) =>
    onChange({ icebreakers: draft.icebreakers.filter((_, i) => i !== indice) });

  const confirmarConhecimento = () => {
    if (!novoConhecimento || !novoConhecimento.label.trim()) return;
    onChange({
      knowledge: [
        ...draft.knowledge,
        { id: novoId(), kind: novoConhecimento.kind, label: novoConhecimento.label.trim() },
      ],
    });
    setNovoConhecimento(null);
  };

  const alternarFerramenta = (toolId: string) =>
    onChange({
      toolIds: draft.toolIds.includes(toolId)
        ? draft.toolIds.filter((id) => id !== toolId)
        : [...draft.toolIds, toolId],
    });

  const alternarAcesso = (ponto: AccessPoint) =>
    onChange({
      accessPoints: draft.accessPoints.includes(ponto)
        ? draft.accessPoints.filter((p) => p !== ponto)
        : [...draft.accessPoints, ponto],
    });

  const nomeDoModelo = draft.modelId
    ? (modelos.find((m) => m.id === draft.modelId)?.name ?? "—")
    : "Padrão da plataforma";

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[14px] border border-[var(--ab-borda)] bg-[var(--ab-painel)]">
      {/* A área que rola; a barra de publicar é `sticky` no fim dela. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
        <header className="mb-5">
          <h1 className="text-[24px] font-semibold leading-tight text-[var(--ab-texto)]">Configurar agente</h1>
          <p className="mt-1 text-[14px] text-[var(--ab-texto-2)]">
            Defina as informações e capacidades do seu agente.
          </p>
        </header>

        <AgentIdentity
          name={draft.name}
          description={draft.description}
          avatarUrl={draft.avatarUrl}
          onChange={(patch) => onChange(patch)}
        />

        <div className="mt-5">
          <AgentInstructions value={draft.instructions} onChange={(instructions) => onChange({ instructions })} />
        </div>

        {/* Recuo final generoso: o último card nunca fica atrás da barra fixa. */}
        <div className="mt-5 grid gap-[10px] pb-6">
          <ConfigAccordion
            id={`${ids}-quebra`}
            title="Quebra-gelos"
            icon={<MessageCircle className="size-4" aria-hidden="true" />}
            open={open === "quebraGelos"}
            onToggle={() => toggle("quebraGelos")}
            onAdd={adicionarQuebraGelo}
            addLabel="Adicionar quebra-gelo"
            summary={draft.icebreakers.length > 0 ? `${draft.icebreakers.length} sugestão(ões)` : "Sugestões iniciais de conversa"}
          >
            {draft.icebreakers.length === 0 ? (
              <p className="text-[13px] text-[var(--ab-texto-3)]">
                Nenhuma sugestão ainda. Use o “+” para cadastrar frases que abrem a conversa.
              </p>
            ) : (
              <ul className="grid gap-2">
                {draft.icebreakers.map((texto, indice) => (
                  <li key={indice} className="flex items-center gap-2">
                    <BuilderInlineInput
                      ariaLabel={`Quebra-gelo ${indice + 1}`}
                      value={texto}
                      onChange={(valor) => editarQuebraGelo(indice, valor)}
                      placeholder="Ex.: Como posso te ajudar hoje?"
                      autoFocus={focoEm === indice}
                    />
                    <SmallAction onClick={() => removerQuebraGelo(indice)} ariaLabel={`Remover quebra-gelo ${indice + 1}`} tone="perigo">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </SmallAction>
                  </li>
                ))}
              </ul>
            )}
          </ConfigAccordion>

          <ConfigAccordion
            id={`${ids}-conhecimento`}
            title="Conhecimento"
            icon={<FileText className="size-4" aria-hidden="true" />}
            open={open === "conhecimento"}
            onToggle={() => toggle("conhecimento")}
            onAdd={() => setNovoConhecimento({ kind: "url", label: "" })}
            addLabel="Adicionar conhecimento"
            summary={draft.knowledge.length > 0 ? `${draft.knowledge.length} fonte(s)` : "Arquivos, documentos, URLs ou bases"}
          >
            <div className="grid gap-2">
              {draft.knowledge.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 rounded-[8px] border border-[var(--ab-borda)] px-3 py-2">
                  <span className="rounded-[6px] bg-[var(--ab-elevado)] px-1.5 py-0.5 text-[11px] text-[var(--ab-texto-2)]">
                    {KNOWLEDGE_KIND_LABEL[entry.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--ab-texto)]">{entry.label}</span>
                  <SmallAction
                    onClick={() => onChange({ knowledge: draft.knowledge.filter((k) => k.id !== entry.id) })}
                    ariaLabel={`Remover ${entry.label}`}
                    tone="perigo"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </SmallAction>
                </div>
              ))}

              {novoConhecimento ? (
                <div className="grid gap-2 rounded-[8px] border border-dashed border-[var(--ab-borda-campo)] p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(KNOWLEDGE_KIND_LABEL) as KnowledgeKind[]).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setNovoConhecimento({ kind, label: "" })}
                        aria-pressed={novoConhecimento.kind === kind}
                        className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
                          novoConhecimento.kind === kind
                            ? "bg-[var(--ab-roxo-translucido)] text-[var(--ab-roxo)]"
                            : "text-[var(--ab-texto-2)] hover:bg-[var(--ab-elevado)]"
                        }`}
                      >
                        {KNOWLEDGE_KIND_LABEL[kind]}
                      </button>
                    ))}
                  </div>
                  {novoConhecimento.kind === "arquivo" ? (
                    <input
                      type="file"
                      aria-label="Escolher arquivo"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) setNovoConhecimento({ kind: "arquivo", label: file.name });
                      }}
                      className="text-[13px] text-[var(--ab-texto-2)] file:mr-3 file:rounded-[7px] file:border-0 file:bg-[var(--ab-elevado)] file:px-3 file:py-1.5 file:text-[13px] file:text-[var(--ab-texto)]"
                    />
                  ) : novoConhecimento.kind === "url" ? (
                    <BuilderInlineInput
                      ariaLabel="URL da fonte"
                      value={novoConhecimento.label}
                      onChange={(label) => setNovoConhecimento({ kind: "url", label })}
                      placeholder="https://…"
                      autoFocus
                    />
                  ) : (
                    <div className="grid gap-1.5">
                      {bases.length === 0 ? (
                        <p className="text-[13px] text-[var(--ab-texto-3)]">Nenhuma base de conhecimento ativa.</p>
                      ) : (
                        bases.map((base) => (
                          <ChoiceRow
                            key={base.id}
                            type="radio"
                            name="base-de-conhecimento"
                            checked={novoConhecimento.label === base.name}
                            onChange={() => setNovoConhecimento({ kind: "base", label: base.name })}
                            label={base.name}
                            hint={base.description}
                          />
                        ))
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <SmallAction onClick={() => setNovoConhecimento(null)}>Cancelar</SmallAction>
                    <SmallAction
                      onClick={confirmarConhecimento}
                      tone="roxo"
                      {...(novoConhecimento.label.trim() === ""
                        ? {
                            disabledReason:
                              novoConhecimento.kind === "arquivo"
                                ? "Escolha o arquivo."
                                : novoConhecimento.kind === "url"
                                  ? "Informe a URL."
                                  : bases.length === 0
                                    ? "Não há base de conhecimento ativa para escolher."
                                    : "Escolha a base.",
                          }
                        : {})}
                    >
                      Adicionar
                    </SmallAction>
                  </div>
                </div>
              ) : draft.knowledge.length === 0 ? (
                <p className="text-[13px] text-[var(--ab-texto-3)]">
                  Nenhuma fonte ainda. Use o “+” para adicionar um arquivo, uma URL ou uma base.
                </p>
              ) : null}
            </div>
          </ConfigAccordion>

          <ConfigAccordion
            id={`${ids}-modelo`}
            title="Modelo"
            icon={<Box className="size-4" aria-hidden="true" />}
            open={open === "modelo"}
            onToggle={() => toggle("modelo")}
            summary={nomeDoModelo}
          >
            <div className="grid gap-1.5">
              <ChoiceRow
                type="radio"
                name="modelo"
                checked={draft.modelId === ""}
                onChange={() => onChange({ modelId: "" })}
                label="Padrão da plataforma"
                hint="O Modelo que o Espaço de Trabalho define como padrão."
              />
              {modelos.map((model) => (
                <ChoiceRow
                  key={model.id}
                  type="radio"
                  name="modelo"
                  checked={draft.modelId === model.id}
                  onChange={() => onChange({ modelId: model.id })}
                  label={model.name}
                  hint={`Entradas: ${model.capabilities.inputs.join(", ")}`}
                />
              ))}
            </div>
          </ConfigAccordion>

          <ConfigAccordion
            id={`${ids}-ferramentas`}
            title="Ferramentas"
            icon={<Wrench className="size-4" aria-hidden="true" />}
            open={open === "ferramentas"}
            onToggle={() => toggle("ferramentas")}
            summary={draft.toolIds.length > 0 ? `${draft.toolIds.length} ativa(s)` : "Nenhuma ativa"}
          >
            {ferramentas.length === 0 ? (
              <p className="text-[13px] text-[var(--ab-texto-3)]">
                Nenhuma Ferramenta disponível neste Espaço de Trabalho.
              </p>
            ) : null}
            <ul className="grid gap-1.5">
              {ferramentas.map((tool) => {
                const labelId = `${ids}-tool-${tool.id}`;
                return (
                  <li key={tool.id} className="flex items-center gap-3 rounded-[8px] border border-[var(--ab-borda)] px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span id={labelId} className="block truncate text-[14px] text-[var(--ab-texto)]">{tool.name}</span>
                      <span className="block truncate text-[12px] text-[var(--ab-texto-3)]">{tool.description}</span>
                    </span>
                    <Toggle checked={draft.toolIds.includes(tool.id)} onChange={() => alternarFerramenta(tool.id)} labelledBy={labelId} />
                  </li>
                );
              })}
            </ul>
          </ConfigAccordion>

          <ConfigAccordion
            id={`${ids}-formato`}
            title="Formato de resposta"
            icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
            open={open === "formato"}
            onToggle={() => toggle("formato")}
            summary={RESPONSE_FORMAT_LABEL[draft.responseFormat]}
          >
            <div className="grid gap-1.5">
              {(Object.keys(RESPONSE_FORMAT_LABEL) as ResponseFormat[]).map((formato) => (
                <ChoiceRow
                  key={formato}
                  type="radio"
                  name="formato-de-resposta"
                  checked={draft.responseFormat === formato}
                  onChange={() => onChange({ responseFormat: formato })}
                  label={RESPONSE_FORMAT_LABEL[formato]}
                />
              ))}
            </div>
          </ConfigAccordion>

          <ConfigAccordion
            id={`${ids}-acesso`}
            title="Ponto de acesso"
            icon={<LinkIcon className="size-4" aria-hidden="true" />}
            open={open === "acesso"}
            onToggle={() => toggle("acesso")}
            summary={
              draft.accessPoints.length > 0
                ? draft.accessPoints.map((p) => ACCESS_POINT_LABEL[p]).join(", ")
                : "Nenhum ponto selecionado"
            }
          >
            <div className="grid gap-1.5">
              {(Object.keys(ACCESS_POINT_LABEL) as AccessPoint[]).map((ponto) => (
                <ChoiceRow
                  key={ponto}
                  type="checkbox"
                  name="ponto-de-acesso"
                  checked={draft.accessPoints.includes(ponto)}
                  onChange={() => alternarAcesso(ponto)}
                  label={ACCESS_POINT_LABEL[ponto]}
                />
              ))}
            </div>
          </ConfigAccordion>

          {/* Leitura do Agente publicado: histórico e números vêm das Execuções. */}
          <ConfigAccordion
            id={`${ids}-logs`}
            title="Logs"
            icon={<ScrollText className="size-4" aria-hidden="true" />}
            open={open === "logs"}
            onToggle={() => toggle("logs")}
            summary={publishedAgentId ? `${execucoesDoAgente} Execução(ões)` : "Disponível depois de publicar"}
          >
            <AgentLogs agentId={publishedAgentId} />
          </ConfigAccordion>

          <ConfigAccordion
            id={`${ids}-dashboard`}
            title="Dashboard"
            icon={<LayoutDashboard className="size-4" aria-hidden="true" />}
            open={open === "dashboard"}
            onToggle={() => toggle("dashboard")}
            summary={publishedAgentId ? "Execuções, resultados, Ferramentas e Sessões" : "Disponível depois de publicar"}
          >
            <AgentDashboard agentId={publishedAgentId} />
          </ConfigAccordion>

        </div>

        <PublishBar
          dirty={dirty}
          publishing={publishing}
          published={published}
          publishedAgentId={publishedAgentId}
          onPublish={onPublish}
          error={error}
          {...(publishDisabledReason ? { disabledReason: publishDisabledReason } : {})}
        />
      </div>
    </div>
  );
}
