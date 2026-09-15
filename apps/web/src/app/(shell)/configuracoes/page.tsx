"use client";

/**
 * T39 — Configurações do Espaço de Trabalho.
 *
 * A4.1 — the workspace is the root exception: it uses `ativo`, `suspenso` and
 * `encerrado`, never `arquivado` or `naLixeira`. The imposed limits come from
 * outside and are read-only here: the organization is subject to them.
 */

import Link from "next/link";
import { useData } from "@/dados/store";
import { useFormat } from "@/features/shell/use-format";
import { CorpoDeTela, PageHeader, RecordPanel, RecordRow, Section, StateSeal } from "@/features/shell/ui";

const SECTIONS: ReadonlyArray<{
  readonly href: string;
  readonly title: string;
  readonly description: string;
}> = [
  { href: "/configuracoes/membros", title: "Membros", description: "Quem participa, com que Papel e em que estado." },
  { href: "/configuracoes/equipes", title: "Equipes", description: "Agrupam Membros para conceder permissão de uma vez." },
  { href: "/configuracoes/papeis", title: "Papéis", description: "Os quatro Papéis de sistema e os personalizados, com o teto de cada um." },
  { href: "/configuracoes/tags", title: "Tags", description: "Vocabulário transversal do Espaço de Trabalho." },
  { href: "/configuracoes/campos", title: "Campos", description: "Definições de Campo e onde cada uma se aplica." },
  { href: "/configuracoes/catalogos", title: "Catálogos", description: "Origens, qualificações, finalidades de consentimento e motivos." },
  { href: "/configuracoes/templates", title: "Templates", description: "Estruturas reutilizáveis; instanciar não cria vínculo vivo." },
  { href: "/configuracoes/integracoes", title: "Integrações", description: "Conexões com sistemas externos e as Ferramentas que expõem." },
  { href: "/configuracoes/lixeira", title: "Lixeira", description: "O que foi enviado à lixeira e quanto tempo resta." },
  { href: "/configuracoes/auditoria", title: "Auditoria", description: "Todo Registro de Atividade do Espaço de Trabalho." },
];

export default function ConfiguracoesPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { workspace } = state;
  const owner = state.members.find((m) => m.id === workspace.ownerMemberId);
  const activeMembers = state.members.filter((m) => m.state === "ativo" || m.state === "suspenso").length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={workspace.name} seal={<StateSeal state={workspace.state} />} />

      {/* A faixa de aviso fica entre o cabeçalho e o corpo: o Espaço suspenso é
          somente leitura, e isso se lê antes de qualquer área. */}
      {workspace.suspensions.length > 0 ? (
        <div
          className="app-base shrink-0 px-4 py-2"
          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}
        >
          <p className="font-medium">
            Espaço de Trabalho suspenso por {workspace.suspensions.length} origem(ns).
          </p>
          <ul className="mt-1 space-y-0.5">
            {workspace.suspensions.map((suspension) => (
              <li key={`${suspension.origin}-${suspension.at}`}>
                {suspension.origin === "plataforma" ? "Pela plataforma" : "Pelo Proprietário"}:{" "}
                {suspension.reason} · {fmt.instant(suspension.at)}
              </li>
            ))}
          </ul>
          <p className="app-sm mt-1">
            Cada suspensão só é levantada por quem a impôs. Enquanto durar, o Espaço é somente leitura.
          </p>
        </div>
      ) : null}

      <CorpoDeTela>
        <Section title="Áreas">
          <ul className="grade-solta sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <Link href={section.href} className="item-solto h-full" data-bloco="true">
                  <span className="app-md block" style={{ color: "var(--texto)" }}>
                    {section.title}
                  </span>
                  <span className="app-base mt-1 block" style={{ color: "var(--texto-3)" }}>
                    {section.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          <RecordPanel title="Configuração da organização">
            <dl>
              <RecordRow label="Proprietário">{owner?.displayName ?? "não encontrado"}</RecordRow>
              <RecordRow label="Criado em">{fmt.instant(workspace.createdAt)}</RecordRow>
              <RecordRow label="Fuso horário">{workspace.locale.timezone}</RecordRow>
              <RecordRow label="Moeda">{workspace.locale.currency}</RecordRow>
              <RecordRow label="Idioma">{workspace.locale.language}</RecordRow>
              <RecordRow label="Retenção na lixeira">{workspace.trashPolicy.retentionDays} dias</RecordRow>
              <RecordRow label="Profundidade de Subtarefas">
                {workspace.maxSubtaskDepth} de no máximo {workspace.limits.subtaskDepthCeiling}
              </RecordRow>
              <RecordRow label="Identificador de Tarefa">
                {workspace.taskReadableId.enabled
                  ? `${workspace.taskReadableId.prefix}-${workspace.taskReadableId.next}`
                  : "desativado"}
              </RecordRow>
              <RecordRow label="Identificador de Negócio">
                {workspace.dealReadableId.enabled
                  ? `${workspace.dealReadableId.prefix}-${workspace.dealReadableId.next}`
                  : "desativado"}
              </RecordRow>
              <RecordRow label="Funil padrão">
                {state.funnels.find((f) => f.id === workspace.defaultFunnelId)?.name ?? "—"}
              </RecordRow>
              <RecordRow label="Agente padrão">
                {state.agents.find((a) => a.id === workspace.defaultAgentId)?.name ?? "—"}
              </RecordRow>
            </dl>
          </RecordPanel>

          <RecordPanel title="Limites impostos">
            <p className="app-meta mb-2">
              Vêm de fora e não se editam aqui: o Espaço de Trabalho está sujeito a eles.
            </p>
            <dl>
              <RecordRow label="Membros">
                {fmt.number(activeMembers)} de {fmt.number(workspace.limits.members)}
              </RecordRow>
              <RecordRow label="Espaços">
                {fmt.number(state.spaces.filter((s) => s.lifecycle === "ativo").length)} de{" "}
                {fmt.number(workspace.limits.spaces)}
              </RecordRow>
              <RecordRow label="Contatos">
                {fmt.number(state.contacts.filter((c) => c.lifecycle === "ativo").length)} de{" "}
                {fmt.number(workspace.limits.contacts)}
              </RecordRow>
              <RecordRow label="Agentes">
                {fmt.number(state.agents.filter((a) => a.lifecycle === "ativo").length)} de{" "}
                {fmt.number(workspace.limits.agents)}
              </RecordRow>
              <RecordRow label="Tarefas por Lista">{fmt.number(workspace.limits.tasksPerList)}</RecordRow>
              <RecordRow label="Profundidade de cadeia de Execução">
                {workspace.limits.executionChainDepth}
              </RecordRow>
              <RecordRow label="Profundidade Agente a Agente">{workspace.limits.agentToAgentDepth}</RecordRow>
              <RecordRow label="Operações por Execução">
                {fmt.number(workspace.limits.operationsPerExecution)}
              </RecordRow>
              <RecordRow label="Teto de prazo de aprovação">
                {workspace.limits.approvalTimeoutHoursCeiling}h
              </RecordRow>
              <RecordRow label="Widgets por Painel">{workspace.limits.widgetsPerPanel}</RecordRow>
            </dl>
          </RecordPanel>
        </div>
      </CorpoDeTela>
    </div>
  );
}
