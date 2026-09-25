"use client";

/**
 * Minhas Tarefas — o destino dos atalhos da Início e da barra global.
 *
 * A lista inteira, com o recorte explícito em abas: o que está atribuído a
 * quem olha (a aba inicial, porque foi daí que a pessoa veio), o vencido, a
 * agenda de HOJE (Tarefa com data E HORA no dia, no fuso do Espaço de
 * Trabalho, em ordem de relógio), o que vence nesta SEMANA (7 dias) e o
 * Espaço de Trabalho inteiro. O total de cada recorte fica sempre à vista,
 * para ninguém achar que a lista é menor do que é. A aba inicial também vem
 * da URL — `?recorte=minhas|abertas|vencidas|hoje|semana|todas` — para a porta da
 * Início cair direto no recorte que a fez existir. "Abertas" (2026-09-24) é
 * o recorte do atalho "Tarefas abertas" do Início: as atribuídas a mim fora de
 * categoria terminal — a mesma conta da barra global (`tarefasAbertasDoMembro`).
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData, useSession } from "@/data/store";
import { effectiveLifecycleOfTask, isOverdue, statusCategory, statusDefinition } from "@/data/derive";
import { recortesDeTarefas } from "@/features/estrutura/recortes-de-tarefas";
import { PRIORITY_LABEL, STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { RecordList } from "@/features/shell/record-list";
import { Abas, CorpoDeTela, PageHeader, StateSeal } from "@/features/shell/ui";

type Recorte = "minhas" | "abertas" | "vencidas" | "hoje" | "semana" | "todas";

const RECORTES: ReadonlyArray<{ readonly value: Recorte; readonly label: string }> = [
  { value: "minhas", label: "Atribuídas a mim" },
  { value: "abertas", label: "Abertas" },
  { value: "vencidas", label: "Vencidas" },
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Esta semana" },
  { value: "todas", label: "Todas do Espaço de Trabalho" },
];

/** O nome do parâmetro que a Início e a barra global usam para abrir num recorte. */
const PARAMETRO_DO_RECORTE = "recorte";

export default function TarefasPage() {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const fmt = useFormat();
  const query = useSearchParams();
  const [recorte, setRecorte] = useState<Recorte>(() => {
    const pedido = query.get(PARAMETRO_DO_RECORTE);
    return RECORTES.find((r) => r.value === pedido)?.value ?? "minhas";
  });
  const [now] = useState(() => new Date());

  // A conta dos recortes (e a ordem de cada um) mora em `recortesDeTarefas`,
  // para o Início ler os mesmos números que estas abas mostram.
  const recortes = recortesDeTarefas(state, memberId, now);

  const contagem: Record<Recorte, number> = {
    minhas: recortes.minhas.length,
    abertas: recortes.abertas.length,
    vencidas: recortes.vencidas.length,
    hoje: recortes.hoje.length,
    semana: recortes.semana.length,
    todas: recortes.todas.length,
  };
  // Cada recorte já vem na ordem da tela: vencida primeiro, depois pelo
  // vencimento mais próximo, sem data ao fim; na agenda de hoje, a do relógio.
  const ordenadas = recortes[recorte];

  const vazio: Record<Recorte, { readonly titulo: string; readonly dica: string }> = {
    minhas: { titulo: "Nada atribuído a você.", dica: "Uma Tarefa aparece aqui quando alguém a atribui a você." },
    abertas: { titulo: "Nenhuma Tarefa aberta com você.", dica: "Uma Tarefa fica aqui enquanto está atribuída a você e não foi concluída nem fechada." },
    vencidas: { titulo: "Nenhuma Tarefa sua está vencida.", dica: "Uma Tarefa aparece aqui quando alguém a atribui a você." },
    hoje: { titulo: "Nenhum horário marcado para hoje.", dica: "Uma reunião é uma Tarefa de Tipo Reunião com data e hora, atribuída a você." },
    semana: { titulo: "Nada seu vence nos próximos 7 dias.", dica: "Uma Tarefa aparece aqui quando alguém a atribui a você com data de vencimento." },
    todas: { titulo: "Nenhuma Tarefa ativa.", dica: "Uma Tarefa nasce dentro de uma Lista: abra uma Lista na Estrutura para criar." },
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Tarefas" meta={`${ordenadas.length} de ${recortes.todas.length} Tarefas ativas`} />

      {/* O recorte é aba, não botão de cabeçalho: o total de cada um fica no contador. */}
      <Abas
        rotulo="Recorte das Tarefas"
        abas={RECORTES.map((opcao) => ({ chave: opcao.value, rotulo: opcao.label, contador: contagem[opcao.value] }))}
        ativa={recorte}
        aoTrocar={(chave) => setRecorte(chave as Recorte)}
      />

      <CorpoDeTela semRespiro>
        <RecordList
          items={ordenadas}
          hrefOf={(task) => `/estrutura/tarefas/${task.id}`}
          emptyTitle={vazio[recorte].titulo}
          emptyHint={vazio[recorte].dica}
          columns={[
            { key: "titulo", label: "Título", render: (task) => task.title },
            {
              key: "lista",
              label: "Lista",
              render: (task) => state.lists.find((l) => l.id === task.listId)?.name ?? "—",
            },
            {
              key: "status",
              label: "Status",
              render: (task) => statusDefinition(state, task.listId, task.statusId)?.name ?? "—",
            },
            {
              key: "categoria",
              label: "Categoria",
              render: (task) => {
                const categoria = statusCategory(state, task);
                return categoria ? (STATUS_CATEGORY_LABEL[categoria] ?? categoria) : "—";
              },
            },
            {
              key: "prioridade",
              label: "Prioridade",
              render: (task) =>
                task.priority ? (PRIORITY_LABEL[task.priority] ?? task.priority) : "—",
            },
            {
              key: "vencimento",
              label: "Vencimento",
              render: (task) =>
                task.dueDate ? (
                  <span
                    className="app-numero"
                    style={isOverdue(state, task, now) ? { color: "var(--erro)" } : undefined}
                  >
                    {fmt.taskDate(task.dueDate)}
                    {isOverdue(state, task, now) ? " · vencida" : ""}
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "estado",
              label: "Estado",
              render: (task) => <StateSeal state={effectiveLifecycleOfTask(state, task.id)} />,
            },
          ]}
        />
      </CorpoDeTela>
    </div>
  );
}
