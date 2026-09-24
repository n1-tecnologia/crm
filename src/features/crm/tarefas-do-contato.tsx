"use client";

/**
 * As Tarefas conversacionais de um Contato (C35), num painel de ficha. A
 * Caixa de Entrada e a ficha do Contato mostram as mesmas Tarefas — as que
 * nasceram dele numa Lista conversacional — e o mesmo botão de criar. O
 * painel só lê: o diálogo de criação é de quem o hospeda, porque cada tela
 * sabe (ou não) o Canal em que a conversa acontece.
 */

import Link from "next/link";
import { ListTodo } from "lucide-react";
import { useData } from "@/data/store";
import { statusDefinition } from "@/data/derive";
import { tarefasConversacionaisDoContato } from "@/data/derive-conversacional";
import { marcarSeMuda } from "@/features/shell/navegacao";
import { useRecente } from "@/features/shell/recente";
import { Button, EmptyState, Icone, Pilula, RecordPanel } from "@/features/shell/ui";

export function TarefasDoContato({
  contactId,
  onCriar,
  rotuloDoBotao = "Nova Tarefa conversacional",
  limite = 5,
}: {
  readonly contactId: string;
  /** Abre o diálogo de criação de quem hospeda; ausente, o painel só lista. */
  readonly onCriar?: () => void;
  readonly rotuloDoBotao?: string;
  /** §15 — a fatia diz o corte; o resto está na Lista de cada Tarefa. */
  readonly limite?: number;
}) {
  const state = useData((data) => data);
  // A Tarefa recém-criada surge; as outras já estão.
  const recente = useRecente();
  const tarefas = tarefasConversacionaisDoContato(state, contactId);
  const mostradas = tarefas.slice(0, limite);

  return (
    <RecordPanel title="Tarefas" icon={<Icone de={ListTodo} tamanho="sm" />} count={tarefas.length}>
      {tarefas.length === 0 ? (
        <EmptyState compact title="Nenhuma Tarefa conversacional com este Contato." />
      ) : (
        <ul className="cascata pilha-solta">
          {mostradas.map((tarefa) => {
            const situacao = statusDefinition(state, tarefa.listId, tarefa.statusId);
            const lista = state.lists.find((l) => l.id === tarefa.listId);
            const href = `/estrutura/tarefas/${tarefa.id}`;
            const nova = tarefa.id === recente;
            return (
              <li key={tarefa.id} className={nova ? "surgir" : undefined} data-recente={nova ? "true" : undefined}>
                {/* Duas linhas: o título inteiro em cima; embaixo o Status e a Lista — o painel vive em colunas estreitas. */}
                <Link href={href} onNavigate={() => marcarSeMuda(href)} className="item-solto" data-bloco="true">
                  <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                    {tarefa.title}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-2">
                    {situacao ? (
                      <Pilula cor={situacao.color} className="shrink-0">
                        {situacao.name}
                      </Pilula>
                    ) : null}
                    <span className="app-meta min-w-0 truncate">{lista?.name ?? "Lista não encontrada"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {tarefas.length > limite ? (
        <p className="app-meta app-numero mt-2">
          Mostrando {limite} de {tarefas.length}.
        </p>
      ) : null}
      {onCriar ? (
        <div className="mt-3">
          <Button size="sm" onClick={onCriar}>
            {rotuloDoBotao}
          </Button>
        </div>
      ) : null}
    </RecordPanel>
  );
}
