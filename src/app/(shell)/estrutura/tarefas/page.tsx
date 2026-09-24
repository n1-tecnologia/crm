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
 * da URL — `?recorte=minhas|vencidas|hoje|semana|todas` — para a porta da
 * Início cair direto no recorte que a fez existir.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData, useSession } from "@/data/store";
import {
  effectiveLifecycleOfTask,
  isOverdue,
  isTerminalCategory,
  statusCategory,
  statusDefinition,
} from "@/data/derive";
import { PRIORITY_LABEL, STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { RecordList } from "@/features/shell/record-list";
import { Abas, CorpoDeTela, PageHeader, StateSeal } from "@/features/shell/ui";
import type { Task } from "@/data/types";

type Recorte = "minhas" | "vencidas" | "hoje" | "semana" | "todas";

const RECORTES: ReadonlyArray<{ readonly value: Recorte; readonly label: string }> = [
  { value: "minhas", label: "Atribuídas a mim" },
  { value: "vencidas", label: "Vencidas" },
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Esta semana" },
  { value: "todas", label: "Todas do Espaço de Trabalho" },
];

/** O nome do parâmetro que a Início e a barra global usam para abrir num recorte. */
const PARAMETRO_DO_RECORTE = "recorte";

/**
 * O dia civil (AAAA-MM-DD) de um instante no fuso do Espaço de Trabalho —
 * `getDate()` responderia no fuso do navegador, e "hoje" seria o de quem olha,
 * não o do Espaço de Trabalho.
 */
function diaCivilNoFuso(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** O dia civil em que a Tarefa vence: o próprio, se é dia civil; o do instante no fuso, se tem hora. */
function diaDoVencimento(task: Task, timezone: string): string | undefined {
  if (!task.dueDate) return undefined;
  return task.dueDate.form === "civilDay" ? task.dueDate.value : diaCivilNoFuso(new Date(task.dueDate.value), timezone);
}

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
  const timezone = state.workspace.locale.timezone;

  const ativas = state.tasks.filter(
    (task) => effectiveLifecycleOfTask(state, task.id) === "ativo",
  );
  const minhas = ativas.filter((task) =>
    task.assignees.some((a) => a.kind === "member" && a.id === memberId),
  );
  const vencidas = minhas.filter((task) => isOverdue(state, task, now));

  // A agenda e a semana são do que ainda está aberto: uma Tarefa concluída
  // não é compromisso. O vencido tem aba própria e não se repete na semana.
  const abertas = minhas.filter((task) => !isTerminalCategory(statusCategory(state, task)));
  const hojeDia = diaCivilNoFuso(now, timezone);
  const limiteDaSemana = diaCivilNoFuso(new Date(now.getTime() + 7 * 86_400_000), timezone);
  const hoje = abertas
    .filter((task) => task.dueDate?.form === "instant" && diaDoVencimento(task, timezone) === hojeDia)
    .sort((a, b) => String(a.dueDate?.value).localeCompare(String(b.dueDate?.value)));
  const semana = abertas.filter((task) => {
    const dia = diaDoVencimento(task, timezone);
    return dia !== undefined && dia <= limiteDaSemana && !isOverdue(state, task, now);
  });

  const contagem: Record<Recorte, number> = {
    minhas: minhas.length,
    vencidas: vencidas.length,
    hoje: hoje.length,
    semana: semana.length,
    todas: ativas.length,
  };
  const items =
    recorte === "minhas" ? minhas : recorte === "vencidas" ? vencidas : recorte === "hoje" ? hoje : recorte === "semana" ? semana : ativas;

  // Vencida primeiro, depois pelo vencimento mais próximo; sem data vai ao fim.
  // Na agenda de hoje isso é a ordem do relógio.
  const ordenadas = [...items].sort((a, b) => {
    const chave = (task: Task) => String(task.dueDate?.value ?? "9999");
    return chave(a).localeCompare(chave(b));
  });

  const vazio: Record<Recorte, { readonly titulo: string; readonly dica: string }> = {
    minhas: { titulo: "Nada atribuído a você.", dica: "Uma Tarefa aparece aqui quando alguém a atribui a você." },
    vencidas: { titulo: "Nenhuma Tarefa sua está vencida.", dica: "Uma Tarefa aparece aqui quando alguém a atribui a você." },
    hoje: { titulo: "Nenhum horário marcado para hoje.", dica: "Uma reunião é uma Tarefa de Tipo Reunião com data e hora, atribuída a você." },
    semana: { titulo: "Nada seu vence nos próximos 7 dias.", dica: "Uma Tarefa aparece aqui quando alguém a atribui a você com data de vencimento." },
    todas: { titulo: "Nenhuma Tarefa ativa.", dica: "Uma Tarefa nasce dentro de uma Lista: abra uma Lista na Estrutura para criar." },
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Tarefas" meta={`${ordenadas.length} de ${ativas.length} Tarefas ativas`} />

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
