"use client";

/**
 * O Construtor de Agentes: dois painéis lado a lado, 38% e 62%, cada um com a
 * própria rolagem. Abaixo de 900px viram abas — a configuração nunca some.
 *
 * O rascunho vive aqui; publicar grava um Agente de verdade no Espaço de
 * Trabalho (Versão 1) e, nas vezes seguintes, uma Versão nova do mesmo.
 */

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useData, useRun } from "@/data/store";
import { createAgent, publishAgentVersion } from "@/data/operations";
import { AgentConfigPanel } from "./agent-config-panel";
import { AgentPreview, SegmentedControl, type PreviewMessage, type PreviewTab } from "./agent-preview";
import { acknowledgement, applyAnswer, isSkip, nextStep, questionFor } from "./build-assistant";
import { EMPTY_DRAFT, type BuilderDraft, type KnowledgeEntry } from "./state";

let sequencia = 0;
const novoId = () => `pv_${(sequencia += 1)}`;

/** O que a publicação leva — o avatar fica de fora, é prévia local. */
const publishable = (draft: BuilderDraft) => JSON.stringify({ ...draft, avatarUrl: null });

/** A última Versão de um Agente, de volta ao formato do rascunho. */
function draftFromAgent(agent: {
  readonly name: string;
  readonly description: string;
  readonly versions: ReadonlyArray<{
    readonly instructions: string;
    readonly modelId: string;
    readonly allowedToolIds: readonly string[];
    readonly icebreakers?: readonly string[];
    readonly knowledgeSources?: ReadonlyArray<{ readonly kind: KnowledgeEntry["kind"]; readonly label: string }>;
    readonly responseFormat?: BuilderDraft["responseFormat"];
    readonly accessPoints?: BuilderDraft["accessPoints"];
  }>;
}): BuilderDraft {
  const v = agent.versions.at(-1);
  return {
    ...EMPTY_DRAFT,
    name: agent.name,
    description: agent.description,
    instructions: v?.instructions ?? "",
    modelId: v && v.modelId !== "padraoDaPlataforma" ? v.modelId : "",
    toolIds: v?.allowedToolIds ?? [],
    icebreakers: v?.icebreakers ?? [],
    knowledge: (v?.knowledgeSources ?? []).map((k, i) => ({ id: `ab_carregado_${i}`, kind: k.kind, label: k.label })),
    responseFormat: v?.responseFormat ?? "texto",
    accessPoints: v?.accessPoints ?? ["chat"],
  };
}

export function AgentBuilder() {
  const run = useRun();
  const agents = useData((data) => data.agents);
  // `?editar=<id>` abre um Agente existente no Construtor, com a última Versão carregada.
  const editarId = useSearchParams().get("editar");
  const editando = editarId ? agents.find((a) => a.id === editarId && a.lifecycle !== "naLixeira") : undefined;
  const [draft, setDraft] = useState<BuilderDraft>(() => (editando ? draftFromAgent(editando) : EMPTY_DRAFT));
  // A referência do que está publicado; `dirty` é o rascunho ter se afastado dela.
  const [publicado, setPublicado] = useState<string | null>(() => (editando ? publishable(draftFromAgent(editando)) : null));
  const dirty = publicado === null || publishable(draft) !== publicado;
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(editando?.id ?? null);
  const [pulouQuebraGelo, setPulouQuebraGelo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PreviewTab>("previsualizar");
  const [messages, setMessages] = useState<readonly PreviewMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [buildMessages, setBuildMessages] = useState<readonly PreviewMessage[]>([]);
  const [building, setBuilding] = useState(false);

  const alterar = (patch: Partial<BuilderDraft>) => {
    setDraft((atual) => ({ ...atual, ...patch }));
    setError(null);
    if (!Object.keys(patch).every((k) => k === "avatarUrl")) setPublished(null);
  };

  // Recarregar ou fechar a aba com rascunho pendente pede confirmação do
  // navegador. A navegação interna pelo menu continua livre, como no resto do
  // protótipo — que não tem rascunho longo em tela nenhuma além desta.
  useEffect(() => {
    if (!dirty) return;
    const guarda = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", guarda);
    return () => window.removeEventListener("beforeunload", guarda);
  }, [dirty]);

  const motivoDeBloqueio =
    draft.name.trim() === ""
      ? "Dê um nome ao agente."
      : draft.instructions.trim() === ""
        ? "Escreva as instruções."
        : draft.accessPoints.length === 0
          ? "Escolha ao menos um ponto de acesso."
          : !dirty
            ? "Nada alterado desde a última publicação."
            : undefined;

  const publicar = () => {
    if (publishing || motivoDeBloqueio) return;
    setPublishing(true);
    setError(null);
    // O trabalho é síncrono; o pequeno atraso é o que dá tempo ao estado de
    // carregamento aparecer — sem ele o clique parece não ter feito nada.
    window.setTimeout(() => {
      const entrada = {
        name: draft.name,
        description: draft.description,
        instructions: draft.instructions,
        modelId: draft.modelId,
        allowedToolIds: draft.toolIds,
        icebreakers: draft.icebreakers,
        knowledgeSources: draft.knowledge.map((k) => ({ kind: k.kind, label: k.label })),
        responseFormat: draft.responseFormat,
        accessPoints: draft.accessPoints,
      };
      const result = run((data, id) =>
        agentId ? publishAgentVersion(data, id, agentId, entrada) : createAgent(data, id, entrada),
      );
      setPublishing(false);
      if (result.ok) {
        setAgentId(result.value.id);
        setPublicado(publishable(draft));
        setPublished(`${result.value.name} · versão ${result.value.versions.at(-1)?.number ?? 1}`);
      } else {
        setError(result.error);
      }
    }, 600);
  };

  const enviar = (texto: string) => {
    setMessages((atual) => [...atual, { id: novoId(), role: "usuario", text: texto }]);
    setLoading(true);
    window.setTimeout(() => {
      setMessages((atual) => [
        ...atual,
        {
          id: novoId(),
          role: "agente",
          text: `Recebi: “${texto}”. Nesta pré-visualização o agente ainda não executa Modelo — ele registra a sua mensagem para você ver o fluxo. ${
            draft.instructions.trim() ? "As instruções atuais valeriam para a resposta." : "Sem instruções, ele não teria como responder."
          }`,
        },
      ]);
      setLoading(false);
    }, 900);
  };

  /*
    O assistente de construção: cada resposta vai para o campo que faltava e
    a pergunta seguinte já reflete o rascunho novo. Abrir a aba pela primeira
    vez faz ele perguntar antes de a pessoa escrever.
  */
  const abrirAba = (proxima: PreviewTab) => {
    setTab(proxima);
    if (proxima === "construir" && buildMessages.length === 0) {
      setBuildMessages([{ id: novoId(), role: "agente", text: questionFor(nextStep(draft, pulouQuebraGelo)) }]);
    }
  };

  const construir = (texto: string) => {
    setBuildMessages((atual) => [...atual, { id: novoId(), role: "usuario", text: texto }]);
    setBuilding(true);
    const etapa = nextStep(draft, pulouQuebraGelo);
    const novo = applyAnswer(draft, etapa, texto);
    if (novo !== draft) alterar(novo);
    const pulou = pulouQuebraGelo || (etapa === "quebraGelos" && isSkip(texto));
    if (pulou !== pulouQuebraGelo) setPulouQuebraGelo(pulou);
    window.setTimeout(() => {
      const seguinte = nextStep(novo, pulou);
      const fala = [acknowledgement(etapa, novo), etapa === "pronto" ? "" : questionFor(seguinte)]
        .filter(Boolean)
        .join(" ");
      setBuildMessages((atual) => [...atual, { id: novoId(), role: "agente", text: fala }]);
      setBuilding(false);
    }, 500);
  };

  return (
    <div className="agent-builder flex h-full min-h-0 flex-col gap-2 bg-[var(--ab-fundo)] p-3 text-[var(--ab-texto)]">
      {/* Abaixo de 900px, o controle de abas mora aqui, acima dos dois painéis. */}
      <div className="shrink-0 min-[900px]:hidden">
        <SegmentedControl value={tab} onChange={abrirAba} />
      </div>

      <div className="grid min-h-0 flex-1 gap-2 min-[900px]:grid-cols-[38fr_62fr]">
        <div className={`min-h-0 ${tab === "configurar" ? "" : "hidden"} min-[900px]:block`}>
          <AgentConfigPanel
            draft={draft}
            onChange={alterar}
            dirty={dirty}
            publishing={publishing}
            published={published}
            onPublish={publicar}
            {...(motivoDeBloqueio ? { publishDisabledReason: motivoDeBloqueio } : {})}
            error={error}
            publishedAgentId={agentId}
          />
        </div>
        <div className={`min-h-0 ${tab === "configurar" ? "hidden" : ""} min-[900px]:block`}>
          <AgentPreview
            agentName={draft.name}
            messages={tab === "construir" ? buildMessages : messages}
            loading={tab === "construir" ? building : loading}
            onSend={tab === "construir" ? construir : enviar}
            tab={tab}
            onTab={abrirAba}
            showControl
            mode={tab === "construir" ? "construir" : "previsualizar"}
          />
        </div>
      </div>
    </div>
  );
}
