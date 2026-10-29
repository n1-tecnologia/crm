"use client";

/**
 * A seleção em lote da página da Lista, numa peça só (Fase 10, 2.1.4).
 *
 * Antes havia três botões "Selecionar várias" (barra comum, barra conversacional
 * e `FinanceToolbar`) e duas montagens da `BulkStatusBar`, uma que trocava a
 * barra do Financeiro e outra dentro do corpo. Agora:
 *
 * - `BotaoDeSelecao` é o único botão que alterna "Selecionar várias" e
 *   "Sair da seleção"; cada barra o recebe no encaixe `fim`;
 * - `SelecaoEmLote` é o painel do lote: com a seleção ligada, a `BulkStatusBar`
 *   inalterada abre em linha própria, largura total, logo abaixo da barra
 *   principal e antes da `ViewBar`; sem a seleção ligada não desenha nada.
 *
 * O relatório do lote NÃO mora aqui: o painel desmonta quando a seleção esvazia
 * e o relatório precisa sobreviver a isso (a página o guarda, ver `page.tsx`).
 * Quem decide o que cada Tarefa aceita continua sendo o domínio.
 */

import { BulkStatusBar } from "./bulk-status-bar";
import { Button } from "@/features/shell/ui";
import type { StatusDefinition, Task } from "@n1/dominio/types";
import type { RelatorioDeLote } from "@n1/dominio/operations/lote";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

/** O único botão "Selecionar várias" ↔ "Sair da seleção". */
export function BotaoDeSelecao({
  selecionando,
  aoAlternar,
  desligadoPor,
}: {
  readonly selecionando: boolean;
  readonly aoAlternar: () => void;
  /** O motivo, quando o botão não pode ser usado (a recusa de criar Tarefa aqui). */
  readonly desligadoPor?: string;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={aoAlternar}
      disabled={desligadoPor !== undefined}
      disabledReason={desligadoPor ?? ""}
    >
      {selecionando ? "Sair da seleção" : "Selecionar várias"}
    </Button>
  );
}

/**
 * O painel do lote. Só passa à `BulkStatusBar` as Tarefas marcadas
 * (`selecionadas`, já recortadas ao que está na tela); "Limpar seleção" e sair
 * da seleção esvaziam as marcadas.
 */
export function SelecaoEmLote({
  tasks,
  definitions,
  selecionadas,
  onSelecionar,
  onRelatorio,
  report,
  selecionando,
}: {
  readonly tasks: readonly Task[];
  readonly definitions: readonly StatusDefinition[];
  readonly selecionadas: ReadonlySet<string>;
  readonly onSelecionar: (ids: ReadonlySet<string>) => void;
  readonly onRelatorio: (relatorio: RelatorioDeLote) => void;
  readonly report: Report;
  readonly selecionando: boolean;
}) {
  if (!selecionando) return null;
  return (
    <div className="shrink-0 px-4 pb-2 pt-1" data-testid="selecao-em-lote">
      <BulkStatusBar
        tasks={tasks}
        definitions={definitions}
        selected={selecionadas}
        onSelect={onSelecionar}
        onClear={() => onSelecionar(new Set())}
        onRelatorio={onRelatorio}
        report={report}
      />
    </div>
  );
}
