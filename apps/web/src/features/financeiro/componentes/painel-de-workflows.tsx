"use client";

/**
 * UI-SPEC §"6 · Workflows" — duas seções: o catálogo (`SYSTEM_WORKFLOWS`,
 * fixo) e o histórico das últimas execuções. O vocabulário de cor é sempre o
 * de Execução (`--cor-exe-*`), nunca `tom="acento"` — severidade/execução é
 * vocabulário semântico, não decoração.
 *
 * T-4-24: o botão "Executar agora" existe (`executavelManualmente` já chega
 * do catálogo), mas fica sempre desabilitado nesta fase — a rota que dispara
 * a execução ainda não existe (entra em 04-13). Um botão que parece
 * funcionar e não dispara nada é pior que um botão desligado que diz por
 * quê (regra §11 do sistema).
 */

import { type Column, RecordList } from "@/features/shell/record-list";
import { Button, Painel, Pilula, Section } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";
import type { ExecucaoDeWorkflow, WorkflowDoCatalogo } from "../dados/workflows";

/**
 * Tokens literais, não interpolados: `verificar-tokens.mjs` só reconhece um
 * `var(--x)` que aparece por extenso no código-fonte — um `var(--cor-exe-${status})`
 * construído por template string acusaria "token fantasma" (a sentinela não
 * resolve interpolação). Status desconhecido nunca fica sem cor — cai no
 * neutro da própria escala de Execução.
 */
const COR_DE_EXECUCAO: Readonly<Record<string, string>> = {
  pendente: "var(--cor-exe-pendente)",
  executando: "var(--cor-exe-executando)",
  aguardando: "var(--cor-exe-aguardando)",
  concluida: "var(--cor-exe-concluida)",
  falhou: "var(--cor-exe-falhou)",
  cancelada: "var(--cor-exe-cancelada)",
};

function corDeExecucao(status: string): string {
  return COR_DE_EXECUCAO[status] ?? COR_DE_EXECUCAO.pendente;
}

export function PainelDeWorkflows({
  catalogo,
  historico,
}: {
  readonly catalogo: ReadonlyArray<WorkflowDoCatalogo>;
  readonly historico: ReadonlyArray<ExecucaoDeWorkflow>;
}) {
  const fmt = useFormat();

  const columns: ReadonlyArray<Column<ExecucaoDeWorkflow>> = [
    { key: "workflow", label: "Workflow", render: (item) => item.workflowNome },
    { key: "inicio", label: "Início", render: (item) => fmt.instant(item.iniciadaEm) },
    { key: "fim", label: "Fim", render: (item) => (item.finalizadaEm ? fmt.instant(item.finalizadaEm) : "—") },
    {
      key: "status",
      label: "Status",
      render: (item) => <Pilula cor={corDeExecucao(item.status)}>{item.status}</Pilula>,
    },
  ];

  return (
    <div>
      <Section title="Catálogo">
        <div className="pilha-solta">
          {catalogo.map((workflow) => {
            const statusAtual = workflow.ultimaExecucao?.status ?? "pendente";
            return (
              <Painel key={workflow.key} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="app-md" style={{ color: "var(--texto)" }}>
                      {workflow.nome}
                    </p>
                    <p className="app-meta">{workflow.descricao}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Pilula tom="neutro">{workflow.tenant}</Pilula>
                    <Pilula cor={corDeExecucao(statusAtual)}>{statusAtual}</Pilula>
                  </div>
                </div>
                {workflow.executavelManualmente ? (
                  <div className="mt-3">
                    <Button variant="primary" size="sm" disabled disabledReason="A execução manual entra no plano 04-13.">
                      Executar agora
                    </Button>
                  </div>
                ) : null}
              </Painel>
            );
          })}
        </div>
      </Section>

      <Section title="Histórico de execuções" count={historico.length}>
        <RecordList
          items={historico}
          columns={columns}
          emptyTitle="Nenhuma execução registrada ainda."
          emptyHint="Execuções aparecem aqui quando a agenda roda ou alguém executa manualmente."
        />
      </Section>
    </div>
  );
}
