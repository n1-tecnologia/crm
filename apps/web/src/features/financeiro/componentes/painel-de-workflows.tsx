"use client";

/**
 * UI-SPEC §"6 · Workflows" — duas seções: o catálogo (`SYSTEM_WORKFLOWS`,
 * fixo) e o histórico das últimas execuções. O vocabulário de cor é sempre o
 * de Execução (`--cor-exe-*`), nunca `tom="acento"` — severidade/execução é
 * vocabulário semântico, não decoração.
 *
 * T-4-24 fecha aqui: o botão "Executar agora" (só quando
 * `executavelManualmente`) chama `executarWorkflow(key)` atrás do
 * `ConfirmDialog` cuja cópia ficou reservada no SUMMARY do plano anterior —
 * nunca um diálogo morto atrás de um botão que nunca abria. A corrida é
 * assíncrona (o `apps/api` responde 202): o resultado é o `Toast` neutro com
 * "Atualizar agora", nunca um relatório fingindo saber o desfecho na hora.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Column, RecordList } from "@/features/shell/record-list";
import { Button, ConfirmDialog, Painel, Pilula, Section, Toast } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";
import { executarWorkflow } from "../dados/acoes";
import type { ExecucaoDeWorkflow, WorkflowDoCatalogo } from "../dados/workflows";

/**
 * Tokens literais, não interpolados: `verificar-tokens.mjs` só reconhece um
 * `var(--x)` que aparece por extenso no código-fonte — um `var(--cor-exe-${status})`
 * construído por template string acusaria "token fantasma" (a sentinela não
 * resolve interpolação). Status desconhecido nunca fica sem cor — cai no
 * neutro da própria escala de Execução.
 */
const COR_NEUTRA_DE_EXECUCAO = "var(--cor-exe-pendente)";

const COR_DE_EXECUCAO: Readonly<Record<string, string>> = {
  pendente: COR_NEUTRA_DE_EXECUCAO,
  executando: "var(--cor-exe-executando)",
  aguardando: "var(--cor-exe-aguardando)",
  concluida: "var(--cor-exe-concluida)",
  falhou: "var(--cor-exe-falhou)",
  cancelada: "var(--cor-exe-cancelada)",
};

/**
 * O neutro sai de uma constante, não de `COR_DE_EXECUCAO.pendente`: com
 * `noUncheckedIndexedAccess` (tsconfig.base.json) todo acesso indexado a um
 * `Record<string, string>` devolve `string | undefined`, inclusive o do próprio
 * fallback — então `?? COR_DE_EXECUCAO.pendente` não estreita nada e o retorno
 * continua opcional. A constante é `string` de verdade.
 */
function corDeExecucao(status: string): string {
  return COR_DE_EXECUCAO[status] ?? COR_NEUTRA_DE_EXECUCAO;
}

export function PainelDeWorkflows({
  catalogo,
  historico,
}: {
  readonly catalogo: ReadonlyArray<WorkflowDoCatalogo>;
  readonly historico: ReadonlyArray<ExecucaoDeWorkflow>;
}) {
  const fmt = useFormat();
  const router = useRouter();
  const [executando, setExecutando] = useState<WorkflowDoCatalogo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<{ readonly tone: "neutral" | "error"; readonly texto: string } | null>(null);

  async function confirmarExecucao(): Promise<void> {
    if (!executando) return;
    setEnviando(true);
    const resultado = await executarWorkflow(executando.key);
    setEnviando(false);
    setExecutando(null);
    if (resultado.ok) {
      setToast({ tone: "neutral", texto: "Execução iniciada. Isto pode levar alguns instantes." });
    } else {
      setToast({ tone: "error", texto: resultado.erro });
    }
  }

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
      {toast ? (
        <Toast
          tone={toast.tone}
          onDismiss={() => setToast(null)}
          {...(toast.tone === "neutral"
            ? {
                acao: (
                  <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
                    Atualizar agora
                  </Button>
                ),
              }
            : {})}
        >
          {toast.texto}
        </Toast>
      ) : null}

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
                    <Button variant="primary" size="sm" onClick={() => setExecutando(workflow)}>
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

      <ConfirmDialog
        open={executando !== null}
        title={`Executar ${executando?.nome ?? ""} agora`}
        description="Roda a mesma rotina que executa sozinha na agenda. Não interrompe nem duplica uma execução já em andamento."
        confirmLabel="Executar"
        destructive={false}
        {...(enviando ? { confirmDisabledReason: "Executando…" } : {})}
        onConfirm={() => void confirmarExecucao()}
        onCancel={() => setExecutando(null)}
      />
    </div>
  );
}
