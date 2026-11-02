/**
 * Converter um Item de Checklist em Subtarefa pela Tarefa aberta (TAR-02).
 *
 * D-05 — o botão sai da MESMA derivada que a operação consulta primeiro
 * (`conversaoDeItemRecusada`): some em Lista sem Subtarefas, em Tarefa no
 * último nível e para quem não escreve, na cor normal (sem cor de erro).
 *
 * D-01 — a confirmação é de um clique: avisa que a conversão não tem volta,
 * mas não pede para digitar o nome do Item. O custo do gesto cai porque o erro
 * deixou de ser fácil de cometer (o botão só aparece onde dá).
 *
 * D-05 — o aviso e o link "Abrir" usam o id que o SERVIDOR devolveu em
 * `confirmado`; o id da cópia local só bate com o dele se ninguém gravou desde
 * a última hidratação (T-11-19).
 *
 * D13 — a conversão vive no endereço (`?converter-item=`): quem abre e fecha o
 * diálogo é `tarefa-completa.tsx`, que passa `onFechar`.
 *
 * O diálogo não some calado: se o Item deixa de existir ou já está convertido
 * (hidratação com o diálogo aberto, endereço antigo), ele limpa o endereço por
 * `onFechar` e, no segundo caso, diz o motivo por `onErro`. E o segundo clique em
 * "Converter" é engolido enquanto o primeiro ainda está a caminho.
 */

import { useEffect, useRef, useState } from "react";
import { conversaoDeItemRecusada } from "@n1/dominio/derive";
import { convertChecklistItem } from "@n1/dominio/operations";
import type { Task } from "@n1/dominio/types";
import { useData, useRunConfirmado, useSession } from "@/dados/store";
import { ConfirmDialog } from "@/features/shell/ui";

export function BotaoDeConversao({
  task,
  onConverter,
}: {
  readonly task: Task;
  readonly onConverter: () => void;
}) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  if (conversaoDeItemRecusada(state, memberId, task.id) !== undefined) return null;
  return (
    <button type="button" className="btn btn-sutil btn-sm ml-auto shrink-0" onClick={onConverter}>
      Converter em Subtarefa
    </button>
  );
}

export function DialogoDeConversao({
  task,
  checklistId,
  itemId,
  onFechar,
  onConvertida,
  onErro,
}: {
  readonly task: Task;
  readonly checklistId: string;
  readonly itemId: string;
  readonly onFechar: () => void;
  readonly onConvertida: (subtarefa: { readonly id: string; readonly title: string }) => void;
  readonly onErro: (mensagem: string) => void;
}) {
  const runConfirmado = useRunConfirmado();
  const item = task.checklists
    .find((group) => group.id === checklistId)
    ?.items.find((candidato) => candidato.id === itemId);
  const indisponivel = !item || item.converted !== undefined;
  const jaConvertido = item !== undefined && item.converted !== undefined;
  // `enviou` é o guarda síncrono (dois cliques no mesmo tick); `enviando` só pinta o botão.
  const enviou = useRef(false);
  const avisou = useRef(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Quando é este diálogo que converte, o Item vira `converted` por causa dele: não é erro.
    if (!indisponivel || enviou.current || avisou.current) return;
    avisou.current = true;
    if (jaConvertido) onErro("Este Item já foi convertido.");
    onFechar();
  }, [indisponivel, jaConvertido, onErro, onFechar]);

  if (!item || indisponivel) return null;

  const converter = () => {
    if (enviou.current) return;
    enviou.current = true;
    setEnviando(true);
    const { local, confirmado } = runConfirmado((data, memberId) =>
      convertChecklistItem(data, memberId, task.id, checklistId, itemId),
    );
    if (!local.ok) {
      enviou.current = false;
      setEnviando(false);
      onErro(local.error);
      onFechar();
      return;
    }
    onFechar();
    void confirmado.then((resposta) =>
      resposta.ok ? onConvertida({ id: resposta.value.id, title: resposta.value.title }) : onErro(resposta.error),
    );
  };

  return (
    <ConfirmDialog
      open
      title={`Converter “${item.text}” em Subtarefa?`}
      description="A conversão não tem volta: o Item fica marcado como convertido, sai do progresso do Checklist e vira uma Subtarefa desta Tarefa."
      confirmLabel="Converter"
      confirmCarregando={enviando}
      {...(enviando ? { confirmDisabledReason: "Convertendo…" } : {})}
      onConfirm={converter}
      onCancel={onFechar}
    />
  );
}
