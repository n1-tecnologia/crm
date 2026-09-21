"use client";

/**
 * D-12 — o Fluxo Manual é a ÚNICA exceção ao bloqueio por divergência de
 * documento/anexo, e só existe como ação explícita do Financeiro: motivo
 * obrigatório, Registro de Atividade, nunca uma tolerância silenciosa do
 * Agente e nunca um checkbox no formulário público.
 *
 * Sem operação de domínio dedicada nesta fase (fora do escopo deste plano,
 * que é só `apps/web`): a marcação compõe duas operações genéricas já
 * existentes — `setTaskFieldValue` grava `Integração manual` (Registro de
 * Atividade automático, "Integração manual alterado") e `addTaskComment`
 * publica o motivo na timeline com um prefixo fixo, que `painel-aprovacao.tsx`
 * lê de volta para mostrar "Fluxo manual por <nome>".
 */

import { useState } from "react";
import { useRun } from "@/dados/store";
import { addTaskComment, setTaskFieldValue } from "@n1/dominio/operations";
import { containerAdminRefusal } from "@n1/dominio/derive";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "@n1/dominio";
import type { DataState, OperationResult } from "@n1/dominio/state";
import type { Id, Task } from "@n1/dominio/types";
import { ConfirmDialog, Field, TextArea } from "@/features/shell/ui";

/** Prefixo fixo do comentário que registra o motivo — a copy nunca trata isto como pular validação (D-12). */
export const PREFIXO_MOTIVO_FLUXO_MANUAL = "Fluxo manual: ";

/** Resolvido por rótulo, nunca id hardcoded solto — mesmo padrão de `painel-aprovacao.tsx`. */
const CAMPO_INTEGRACAO_MANUAL = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find(
  (c) => c.rotulo === "Integração manual",
)?.id;

/**
 * Quem pode usar o Fluxo Manual é o Financeiro (Papel `rol_sp_financeiro` do
 * catálogo, `packages/dominio/src/solicitacao-de-pagamento.ts`). Esse Papel
 * ainda não vira Concessão real de Membro nesta fase (o evolver que
 * materializa a Lista — 02-08 — está fora do escopo deste plano, só
 * `apps/web`); até lá, o sinal mais próximo já existente no domínio é
 * administrar a Lista da Tarefa, o mesmo usado por "Salvar como modelo" na
 * página da Tarefa.
 */
export function fluxoManualRecusado(state: DataState, memberId: Id, task: Task): string | undefined {
  return containerAdminRefusal(state, memberId, "list", task.listId);
}

export function DialogoFluxoManual({
  task,
  open,
  onClose,
  report,
}: {
  readonly task: Task;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly report: (result: OperationResult<unknown>, message: string) => void;
}) {
  const run = useRun();
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const confirmar = () => {
    const campoIntegracaoManual = CAMPO_INTEGRACAO_MANUAL;
    if (!campoIntegracaoManual) return;
    setEnviando(true);
    const gravado = run((data, memberId) =>
      setTaskFieldValue(data, memberId, task.id, campoIntegracaoManual, "Manual"),
    );
    if (!gravado.ok) {
      setEnviando(false);
      report(gravado, "");
      return;
    }
    const comentado = run((data, memberId) =>
      addTaskComment(data, memberId, task.id, { content: `${PREFIXO_MOTIVO_FLUXO_MANUAL}${motivo.trim()}` }),
    );
    setEnviando(false);
    if (comentado.ok) {
      setMotivo("");
      onClose();
      report(comentado, "Fluxo manual confirmado.");
    } else {
      report(comentado, "");
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Usar fluxo manual?"
      description="O lançamento pula a automação do pipeline e passa a depender de conferência manual do Financeiro. A decisão fica registrada na timeline."
      confirmLabel={enviando ? "Confirmando…" : "Confirmar fluxo manual"}
      cancelLabel="Voltar"
      {...(enviando
        ? { confirmDisabledReason: "Confirmando…" }
        : motivo.trim() === ""
          ? { confirmDisabledReason: "Escreva o motivo do fluxo manual." }
          : {})}
      onConfirm={confirmar}
      onCancel={enviando ? () => {} : onClose}
    >
      <Field label="Motivo do fluxo manual" required hint="Fica registrado na timeline da Tarefa.">
        {(id) => <TextArea id={id} value={motivo} onChange={setMotivo} rows={3} disabled={enviando} />}
      </Field>
    </ConfirmDialog>
  );
}

/** O que o card mostra depois do sucesso: quem confirmou e o motivo, lidos do Comentário. */
export function fluxoManualDe(
  state: DataState,
  task: Task,
): { readonly nome: string; readonly motivo: string; readonly at: string } | undefined {
  const comentario = [...task.comments]
    .filter((c) => !c.deletedAt && c.content.startsWith(PREFIXO_MOTIVO_FLUXO_MANUAL))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!comentario) return undefined;
  const nome =
    comentario.author.kind === "member"
      ? (state.members.find((m) => m.id === comentario.author.id)?.displayName ?? "Membro removido")
      : "Sistema";
  return { nome, motivo: comentario.content.slice(PREFIXO_MOTIVO_FLUXO_MANUAL.length), at: comentario.createdAt };
}
