"use client";

/**
 * T48 — Integrações.
 *
 * A8 — an Integration is a configured connection with an external system, and
 * the Tools it exposes are what an Agent may end up calling. B35 — who
 * configured it is traceability, never governance: the Integration has no
 * Proprietário, so nobody "owns" the connection.
 */

import Link from "next/link";
import { useData } from "@/data/store";
import { useIntegracoesMenu } from "@/features/ia/integracoes/integracao-menu";
import { EFFECT_CLASS_LABEL } from "@/features/shell/format";
import { useRecente } from "@/features/shell/recente";
import { useFormat } from "@/features/shell/use-format";
import { ActionMenu, ConditionMarker, CorpoDeTela, EmptyState, PageHeader, Pilula, Section } from "@/features/shell/ui";

const STATE_LABEL: Record<string, string> = {
  conectada: "conectada",
  desconectada: "desconectada",
  comErro: "com erro",
};

export default function IntegracoesPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const recente = useRecente();
  // O mesmo menu da seção Integrações de Personalizar: conectar e desconectar dizem o mesmo nos dois lugares.
  const { itensDe, dialogo } = useIntegracoesMenu();
  const integrations = state.integrations;
  const broken = integrations.filter((integration) => integration.state !== "conectada");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Integrações"
        meta={`${integrations.length} Integração(ões)`}
      />

      {broken.length > 0 ? (
        <p
          className="app-base shrink-0 px-4 py-2"
          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}
        >
          {broken.length} Integração(ões) fora do ar. Toda Ferramenta que dependa delas falha na Execução,
          e a falha fica registrada no passo — nada é descartado em silêncio.
        </p>
      ) : null}

      <CorpoDeTela>
        {integrations.length === 0 ? (
          <EmptyState
            title="Nenhuma Integração configurada."
            hint="Sem Integração, um Agente só alcança as Ferramentas internas do Espaço de Trabalho."
          />
        ) : (
          <Section title="Integrações" count={integrations.length}>
            <ul className="grade-solta cascata lg:grid-cols-2">
              {integrations.map((integration) => {
                const configuredBy = state.members.find((m) => m.id === integration.configuredBy);
                const tools = state.tools.filter((tool) =>
                  integration.exposedTools.includes(tool.id),
                );
                const usedBySkills = state.skills.filter((skill) =>
                  skill.versions.some((version) =>
                    version.toolRequirements.some((requirement) =>
                      integration.exposedTools.includes(requirement.toolId),
                    ),
                  ),
                );
                return (
                  <li
                    key={integration.id}
                    className="item-solto"
                    data-bloco="true"
                    data-estatico="true"
                    data-recente={integration.id === recente ? "true" : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="app-md" style={{ color: "var(--texto)" }}>
                          {integration.name}
                        </p>
                        <p className="app-meta mt-0.5">{integration.systemType}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {integration.state === "conectada" ? (
                          <Pilula tom="sucesso" className="shrink-0">
                            conectada
                          </Pilula>
                        ) : (
                          <ConditionMarker tone={integration.state === "comErro" ? "danger" : "warning"}>
                            {STATE_LABEL[integration.state]}
                          </ConditionMarker>
                        )}
                        <ActionMenu label={`Ações de ${integration.name}`} items={itensDe(integration)} />
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="app-coluna">
                        Ferramentas expostas ({integration.exposedTools.length})
                      </p>
                      {integration.exposedTools.length === 0 ? (
                        <p className="app-base mt-1" style={{ color: "var(--texto-3)" }}>
                          Nenhuma.
                        </p>
                      ) : (
                        <ul className="app-base mt-1 space-y-0.5" style={{ color: "var(--texto-1)" }}>
                          {integration.exposedTools.map((toolId) => {
                            const tool = tools.find((t) => t.id === toolId);
                            return (
                              <li key={toolId}>
                                {tool?.name ?? toolId}
                                {tool ? (
                                  <span className="app-meta">
                                    {" "}
                                    · classe de efeito {EFFECT_CLASS_LABEL[tool.effectClass] ?? tool.effectClass}
                                  </span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <p className="app-meta mt-3">
                      configurada por {configuredBy?.displayName ?? "Membro não encontrado"} em{" "}
                      {fmt.instant(integration.createdAt)} · sem Proprietário: configurar é
                      rastreabilidade, não governança
                    </p>
                    {usedBySkills.length > 0 ? (
                      <p className="app-meta mt-1">
                        Usada por {usedBySkills.length} Habilidade(s):{" "}
                        {usedBySkills.map((skill) => skill.name).join(", ")}.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}
      </CorpoDeTela>
      {dialogo}
    </div>
  );
}
