"use client";

/**
 * As cinco seções de Personalizar que são catálogo: cada uma mapeia os
 * registros do Espaço de Trabalho para cartões. As fichas continuam nas rotas
 * de sempre — o cartão só é a porta.
 */

import { FileStack, Plug, Sparkles, Workflow, Wrench } from "lucide-react";
import { useData } from "@/dados/store";
import { EFFECT_CLASS_LABEL, RESOURCE_TYPE_LABEL, TRIGGER_KIND_LABEL } from "@/features/shell/format";
import { Icone } from "@/features/shell/ui";
import { CatalogGrid, type CatalogFact } from "./catalog-grid";

function estado(lifecycle: string): CatalogFact {
  switch (lifecycle) {
    case "ativo":
      return { label: "ativa", tone: "ok" };
    case "rascunho":
      return { label: "rascunho", tone: "atencao" };
    case "pausado":
      return { label: "pausada", tone: "atencao" };
    case "arquivado":
      return { label: "arquivada", tone: "neutro" };
    default:
      return { label: lifecycle, tone: "neutro" };
  }
}

export function HabilidadesCatalogo() {
  const state = useData((data) => data);
  const itens = state.skills
    .filter((s) => s.lifecycle !== "naLixeira")
    .map((skill) => {
      const publicada = [...skill.versions].reverse().find((v) => v.state === "publicada");
      const concessoes = state.skillGrants.filter((g) => g.skillId === skill.id).length;
      return {
        id: skill.id,
        title: skill.name,
        description: skill.description,
        href: `/ia/habilidades/${skill.id}`,
        icon: <Icone de={Sparkles} tamanho="md" />,
        badge: publicada ? { label: `v${publicada.number}`, tone: "acento" as const } : { label: "sem versão publicada", tone: "atencao" as const },
        facts: [
          { label: skill.ownership === "plataforma" ? "da plataforma" : "do Espaço de Trabalho" },
          { label: concessoes === 1 ? "1 Agente" : `${concessoes} Agentes`, tone: concessoes > 0 ? ("ok" as const) : ("neutro" as const) },
          estado(skill.lifecycle),
        ],
      };
    });
  return (
    <CatalogGrid
      title="Habilidades"
      items={itens}
      emptyTitle="Nenhuma Habilidade."
      emptyHint="As da plataforma nascem com o Espaço de Trabalho; as suas são criadas a partir de uma Execução aprovada."
    />
  );
}

export function AutomacoesCatalogo() {
  const state = useData((data) => data);
  const itens = state.automations
    .filter((a) => a.lifecycle !== "naLixeira")
    .map((automacao) => {
      const corrente = [...automacao.versions].reverse().find((v) => v.state === "publicada") ?? automacao.versions.at(-1);
      const gatilho = corrente?.trigger?.kind;
      const hibrida = automacao.versions.some((v) => v.conditions.some((c) => c.kind === "hibrida"));
      const execucoes = state.automationExecutions.filter((e) => e.automationId === automacao.id).length;
      return {
        id: automacao.id,
        title: automacao.name,
        description: automacao.description,
        href: `/ia/automacoes/${automacao.id}`,
        icon: <Icone de={Workflow} tamanho="md" />,
        badge: estado(automacao.lifecycle),
        facts: [
          ...(gatilho ? [{ label: TRIGGER_KIND_LABEL[gatilho] ?? gatilho, tone: "acento" as const }] : []),
          { label: `escopo: ${RESOURCE_TYPE_LABEL[automacao.scopeType] ?? automacao.scopeType}` },
          { label: hibrida ? "híbrida" : "determinística" },
          { label: execucoes === 1 ? "1 execução" : `${execucoes} execuções` },
        ],
      };
    });
  return (
    <CatalogGrid
      title="Automação"
      items={itens}
      emptyTitle="Nenhuma Automação."
      emptyHint="Uma Automação nasce dentro de um escopo: uma Lista, um Funil ou uma Fila."
    />
  );
}

export function ConhecimentoCatalogo() {
  const state = useData((data) => data);
  const itens = state.collections
    .filter((c) => c.lifecycle !== "naLixeira")
    .map((colecao) => {
      const documentos = state.documents.filter((d) => d.collectionId === colecao.id && d.lifecycle !== "naLixeira").length;
      const dono = state.members.find((m) => m.id === colecao.ownerMemberId)?.displayName ?? "—";
      return {
        id: colecao.id,
        title: colecao.name,
        description: colecao.description,
        href: `/ia/conhecimento/${colecao.id}`,
        icon: <Icone de={FileStack} tamanho="md" />,
        ...(colecao.isPrivate ? { badge: { label: "privada", tone: "atencao" as const } } : {}),
        facts: [
          { label: documentos === 1 ? "1 documento" : `${documentos} documentos`, tone: documentos > 0 ? ("ok" as const) : ("neutro" as const) },
          { label: colecao.sources.length === 1 ? "1 fonte" : `${colecao.sources.length} fontes` },
          { label: dono },
        ],
      };
    });
  return (
    <CatalogGrid
      title="Conhecimento"
      items={itens}
      emptyTitle="Nenhuma Coleção."
      emptyHint="Crie uma Coleção e adicione documentos, URLs ou uma Integração como fonte."
    />
  );
}

export function ConectoresCatalogo() {
  const state = useData((data) => data);
  const itens = state.integrations.map((integracao) => {
    // A Integração declara o que expõe; a Ferramenta nem sempre aponta de volta.
    const ferramentas = new Set([
      ...integracao.exposedTools,
      ...state.tools.filter((t) => t.integrationId === integracao.id).map((t) => t.id),
    ]).size;
    const configurou = state.members.find((m) => m.id === integracao.configuredBy)?.displayName ?? "—";
    return {
      id: integracao.id,
      title: integracao.name,
      description: `Sistema ${integracao.systemType.toUpperCase()}, configurado por ${configurou}.`,
      href: "/configuracoes/integracoes",
      icon: <Icone de={Plug} tamanho="md" />,
      badge:
        integracao.state === "conectada"
          ? { label: "conectada", tone: "ok" as const }
          : integracao.state === "comErro"
            ? { label: "com erro", tone: "perigo" as const }
            : { label: "desconectada", tone: "atencao" as const },
      facts: [{ label: ferramentas === 1 ? "expõe 1 Ferramenta" : `expõe ${ferramentas} Ferramentas`, tone: "acento" as const }],
      actionLabel: "Ver detalhes",
    };
  });
  return (
    <CatalogGrid
      title="Conectores"
      items={itens}
      emptyTitle="Nenhuma Integração conectada."
      emptyHint="Conecte um sistema em Configurações → Integrações."
    />
  );
}

export function PluginsCatalogo() {
  const state = useData((data) => data);
  const itens = state.tools.map((tool) => {
    const integracao =
      state.integrations.find((i) => i.id === tool.integrationId || i.exposedTools.includes(tool.id));
    const agentes = state.agents.filter(
      (a) => a.lifecycle === "ativo" && (a.versions.at(-1)?.allowedToolIds ?? []).includes(tool.id),
    ).length;
    const efeito = EFFECT_CLASS_LABEL[tool.effectClass] ?? tool.effectClass;
    return {
      id: tool.id,
      title: tool.name,
      description: tool.description,
      href: integracao ? "/ia/personalizar/conectores" : "/ia/personalizar/agente",
      icon: <Icone de={Wrench} tamanho="md" />,
      badge: { label: efeito, tone: tool.effectClass === "leitura" ? ("ok" as const) : ("atencao" as const) },
      facts: [
        { label: integracao ? integracao.name : "da plataforma" },
        { label: RESOURCE_TYPE_LABEL[tool.targetResourceType] ?? tool.targetResourceType },
        { label: agentes === 1 ? "1 Agente" : `${agentes} Agentes`, tone: agentes > 0 ? ("ok" as const) : ("neutro" as const) },
      ],
      actionLabel: integracao ? "Ver Conector" : "Dar a um Agente",
    };
  });
  return (
    <CatalogGrid
      title="Plugins"
      items={itens}
      emptyTitle="Nenhuma Ferramenta no Catálogo."
      emptyHint="As da plataforma nascem com o Espaço de Trabalho; as demais chegam pelas Integrações."
    />
  );
}
