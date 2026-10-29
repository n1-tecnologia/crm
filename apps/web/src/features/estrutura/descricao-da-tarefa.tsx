/**
 * A descrição da Tarefa aberta, com o `@Nome` mencionado destacado.
 *
 * D-06 — o destaque lê a lista de menções da Tarefa (`descriptionMentions`),
 * como o Comentário: cada Membro de `membrosMencionadosNaDescricao` vira um
 * `<span data-mencao>` com as mesmas variáveis de `.rico .mencao`.
 *
 * D-09 — só o que a lista efetiva confirma destaca: texto sem a lista, ou nome
 * fora dela, fica como texto comum. A leitura é a do domínio, a mesma que as
 * Notificações usam.
 *
 * Nunca monta HTML: `segmentosComMencoes` devolve texto, e aqui só saem nós de
 * texto e `<span>` (T-11-17). Devolve só conteúdo inline, para caber no
 * `<button>` editável e no `<p>` só leitura da Tarefa.
 */

import { membrosMencionadosNaDescricao, segmentosComMencoes } from "@n1/dominio/descricao-da-tarefa";
import type { Task } from "@n1/dominio/types";
import { useData } from "@/dados/store";

const DESTAQUE_DA_MENCAO = {
  color: "var(--acento)",
  background: "var(--acento-lavado)",
  borderRadius: "var(--r-pilula)",
  padding: "0.05em 0.4em",
  fontWeight: 500,
} as const;

export function DescricaoDaTarefa({ task }: { readonly task: Task }) {
  const state = useData((data) => data);
  const nomes = membrosMencionadosNaDescricao(state, task).flatMap((id) => {
    const membro = state.members.find((m) => m.id === id);
    return membro ? [membro.displayName] : [];
  });
  return (
    <>
      {segmentosComMencoes(task.description, nomes).map((segmento, indice) =>
        segmento.mencao ? (
          <span key={indice} data-mencao="" style={DESTAQUE_DA_MENCAO}>
            {segmento.texto}
          </span>
        ) : (
          segmento.texto
        ),
      )}
    </>
  );
}
