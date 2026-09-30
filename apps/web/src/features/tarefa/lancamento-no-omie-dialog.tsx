"use client";

/**
 * D3-03 — o lado humano da comparação do Ensaio: o Agente, em Ensaio,
 * calcula o que lançaria e NÃO escreve na Tarefa; a plataforma não tem como
 * saber o que o Financeiro digitou no Omie a menos que ele diga. Este
 * diálogo é onde ele diz.
 *
 * Os três campos são texto livre DE PROPÓSITO (T-3-67): oferecer uma lista
 * de categorias já resolvidas mostraria ao humano a resposta do Agente antes
 * de ele dar a sua, e contaminaria a medição por viés de assentimento — a
 * resposta viria na direção otimista, que é exatamente a direção em que este
 * relatório não pode errar. A fricção do texto livre é a defesa, não um
 * descuido de UX.
 *
 * Sem operação de domínio dedicada, como no Fluxo Manual
 * (`fluxo-manual-dialog.tsx`): a marcação compõe a operação genérica
 * `addTaskComment` com o conteúdo montado por `textoDoLancamentoHumano`, e
 * quem lê de volta é `lancamentoHumanoDe` (`@n1/dominio/operations`) — um
 * escritor, um leitor, nenhuma string repetida entre `apps/web` e `apps/api`.
 */

import { useState } from "react";
import { useRun } from "@/dados/store";
import { RECUSA_LANCAMENTO_EM_CURSO, addTaskComment, lancamentoEmCursoDe, textoDoLancamentoHumano } from "@n1/dominio/operations";
import { containerAdminRefusal } from "@n1/dominio/derive";
import type { DataState, OperationResult } from "@n1/dominio/state";
import type { Id, Task } from "@n1/dominio/types";
import { ConfirmDialog, Field, TextInput } from "@/features/shell/ui";

/**
 * O Papel `rol_sp_financeiro` ainda não vira Concessão real de Membro nesta
 * fase (mesma ressalva de `fluxoManualRecusado`): o sinal mais próximo já
 * existente no domínio é administrar a Lista da Tarefa.
 *
 * 06-19 (crm2:WR-01): enquanto o Agente lança a conta no Omie (a marca
 * `lancamentoEmCursoDe`), o registro à mão seria um segundo título — a mesma
 * recusa que `addTaskComment` aplica no domínio, dita antes do clique.
 */
export function lancamentoNoOmieRecusado(state: DataState, memberId: Id, task: Task): string | undefined {
  if (lancamentoEmCursoDe(state, task)) return RECUSA_LANCAMENTO_EM_CURSO;
  return containerAdminRefusal(state, memberId, "list", task.listId);
}

export function DialogoLancamentoNoOmie({
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
  const [conta, setConta] = useState("");
  const [categoria, setCategoria] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const faltando = [
    conta.trim() === "" ? "a Conta de pagamento" : null,
    categoria.trim() === "" ? "a Categoria" : null,
    codigo.trim() === "" ? "o Código" : null,
  ].filter((x): x is string => x !== null);

  const confirmar = () => {
    if (faltando.length > 0) return;
    setEnviando(true);
    const gravado = run((data, memberId) =>
      addTaskComment(data, memberId, task.id, {
        content: textoDoLancamentoHumano({ conta: conta.trim(), categoria: categoria.trim(), codigo: codigo.trim() }),
      }),
    );
    setEnviando(false);
    if (gravado.ok) {
      setConta("");
      setCategoria("");
      setCodigo("");
      onClose();
      report(gravado, "Lançamento registrado.");
    } else {
      report(gravado, "");
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Registrar o lançamento que você fez no Omie"
      description="O registro é o que permite medir o Ensaio do Agente antes de ele ganhar a caneta (D3-03) — fica na timeline da Tarefa."
      confirmLabel={enviando ? "Registrando…" : "Registrar lançamento"}
      cancelLabel="Voltar"
      {...(enviando
        ? { confirmDisabledReason: "Registrando…" }
        : faltando.length > 0
          ? { confirmDisabledReason: `Preencha ${faltando.join(", ")}.` }
          : {})}
      onConfirm={confirmar}
      onCancel={enviando ? () => {} : onClose}
    >
      <div className="grid gap-3">
        <Field label="Conta de pagamento" required hint="Como aparece no Omie — ex.: TRIA">
          {(id) => <TextInput id={id} value={conta} onChange={setConta} disabled={enviando} />}
        </Field>
        <Field label="Categoria" required hint="O nome da categoria escolhida no Omie">
          {(id) => <TextInput id={id} value={categoria} onChange={setCategoria} disabled={enviando} />}
        </Field>
        <Field label="Código" required hint="O código do plano de contas — ex.: 2.06.01">
          {(id) => <TextInput id={id} value={codigo} onChange={setCodigo} disabled={enviando} />}
        </Field>
      </div>
    </ConfirmDialog>
  );
}
