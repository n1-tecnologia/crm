"use client";

/**
 * A TABELA DE TAREFAS de uma Lista — o mesmo desenho da tabela do Financeiro,
 * porque é o mesmo sistema: só mudam as palavras. Grupos por Status com a
 * régua (chevron, a caixa do Status, a contagem, o "+"), as linhas com as
 * colunas que importam (Tarefa, Responsável, Vencimento, Prioridade, Tipo,
 * Status — e, na Lista conversacional, Contato e Canal), as ações rápidas que
 * aparecem no hover à esquerda do "…", e o menu com "Mover para…" cada
 * Status — com a mesma confirmação.
 *
 * Um grupo sem Tarefa não aparece, a não ser que o filtro o escolha ou que o
 * compositor esteja aberto nele. A linha inteira abre a Tarefa; um clique que
 * nasce num controle continua sendo dele.
 *
 * ARMADILHA (a mesma do Financeiro): sem wrapper com `overflow-x: auto` — ele
 * viraria contêiner de rolagem nos dois eixos e o `thead` fixo deixaria de
 * grudar. Quem rola é o corpo da tela; as colunas menos úteis somem por
 * degrau de largura do contêiner.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { useRun, useSession } from "@/dados/store";
import { useRecente } from "@/features/shell/recente";
import { changeTaskStatus, statusOptionRefusal } from "@n1/dominio/operations";
import {
  contactDisplayName,
  isBlocked,
  isOverdue,
  isTerminalCategory,
  statusCategory,
  taskWriteRefusal,
} from "@n1/dominio/derive";
import { canalDaTarefa, contatoDaTarefa } from "@n1/dominio/derive-conversacional";
import type { DataState } from "@n1/dominio/state";
import type { Priority, StatusDefinition, Task, ViewFilters } from "@n1/dominio/types";
import { ContactAvatar } from "@/features/crm/contact-card";
import { CHANNEL_TYPE_LABEL, PRIORITY_LABEL, STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  ActionMenu,
  ActorAvatar,
  ConditionMarker,
  ConfirmDialog,
  EmptyState,
  Icone,
  Pilula,
  StateSeal,
} from "@/features/shell/ui";
import { BotaoDeMais, CompositorNoGrupo } from "@/features/estrutura/novo-no-grupo";
import { iconeDeTipo } from "@/features/estrutura/icone-de-tipo";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

const PRIORITY_ICON: Record<Priority, { readonly icone: LucideIcon; readonly cor: string }> = {
  urgente: { icone: AlertTriangle, cor: "var(--erro)" },
  alta: { icone: ArrowUp, cor: "var(--aviso)" },
  normal: { icone: Minus, cor: "var(--texto-4)" },
  baixa: { icone: ArrowDown, cor: "var(--texto-4)" },
  semPrioridade: { icone: Minus, cor: "var(--texto-4)" },
};

export function TabelaDeTarefas({
  state,
  tasks,
  definitions,
  filters,
  openTask,
  report,
  onCreateInGroup,
  seletorDeTipo,
  criacaoRecusada,
  selected,
  onToggle,
  onToggleMany,
  selecionando = false,
  rotulo = "Tarefa",
  onMais,
  conversacional = false,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly definitions: readonly StatusDefinition[];
  /** Um grupo vazio só aparece quando o filtro pede por ele. */
  readonly filters: ViewFilters;
  readonly openTask: (taskId: string) => void;
  readonly report: Report;
  /** O "+" do grupo: a Tarefa nasce naquele Status. Ausente = a Lista não recebe Tarefa. */
  readonly onCreateInGroup?: (title: string, statusId: string, taskTypeId?: string) => boolean;
  /** O seletor de Tipo do compositor de grupo; `undefined` quando não há escolha. */
  readonly seletorDeTipo?: (valor: string | undefined, aoEscolher: (taskTypeId: string) => void) => ReactNode;
  readonly criacaoRecusada?: string;
  /** Modo de seleção em lote: presente, cada linha ganha uma caixa. */
  readonly selected?: ReadonlySet<string>;
  readonly onToggle?: (taskId: string) => void;
  readonly onToggleMany?: (ids: readonly string[], on: boolean) => void;
  readonly selecionando?: boolean;
  /** A palavra da coluna e dos vazios: "Tarefa", ou "Negócio" na cópia do Funil. */
  readonly rotulo?: string;
  /** O "+" do grupo faz OUTRA coisa (iniciar uma conversa naquela Etapa) em vez de abrir o compositor. */
  readonly onMais?: (statusId: string) => void;
  /** C35 — a Lista conversacional ganha as colunas Contato e Canal, lidas dos Vínculos da Tarefa. */
  readonly conversacional?: boolean;
}) {
  const fmt = useFormat();
  const run = useRun();
  const recente = useRecente();
  const router = useRouter();
  const { memberId } = useSession();
  const now = useMemo(() => new Date(), []);
  const [fechados, setFechados] = useState<ReadonlySet<string>>(new Set());
  const [criandoEm, setCriandoEm] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<{
    taskId: string;
    statusId: string;
    label: string;
  } | null>(null);

  const alternar = (grupo: string) =>
    setFechados((atual) => {
      const n = new Set(atual);
      if (n.has(grupo)) n.delete(grupo);
      else n.add(grupo);
      return n;
    });

  // Os grupos na ordem do Conjunto de Status.
  const grupos = [...definitions]
    .sort((a, b) => a.order - b.order)
    .map((definition) => ({
      definition,
      itens: tasks.filter((t) => t.statusId === definition.id),
    }))
    .filter(
      ({ definition, itens }) =>
        itens.length > 0 ||
        filters.statusId === definition.id ||
        (filters.statusId === undefined && filters.statusCategory === definition.category) ||
        criandoEm === definition.id,
    );

  // A ação rápida de concluir: o primeiro Status terminal do Conjunto.
  const terminal = [...definitions]
    .sort((a, b) => a.order - b.order)
    .find((d) => isTerminalCategory(d.category));
  const motivoDoMais = onMais ? undefined : onCreateInGroup ? criacaoRecusada : (criacaoRecusada ?? "Esta Lista não recebe Tarefas novas.");

  const mover = (task: Task, statusId: string, label: string) => {
    const r = run((data, me) => changeTaskStatus(data, me, task.id, statusId));
    report(r, `“${task.title}”: ${label}.`);
  };
  const aConfirmar = confirmando ? tasks.find((t) => t.id === confirmando.taskId) : undefined;
  const escondeControle = "button, a, input, select, textarea, [role=menu], [role=listbox]";
  // As faixas (régua do grupo, compositor, vazio) atravessam todas as colunas.
  const colunas = conversacional ? 10 : 8;

  return (
    <div className="@container">
      <ConfirmDialog
        open={confirmando !== null}
        title={`${confirmando?.label ?? ""}: “${aConfirmar?.title ?? ""}”?`}
        description={`${aConfirmar?.dueDate ? `Vence ${fmt.taskDate(aConfirmar.dueDate)}. ` : ""}A mudança de Status passa pelas regras da Lista e fica na Atividade.`}
        confirmLabel={confirmando?.label ?? "Confirmar"}
        onConfirm={() => {
          if (confirmando && aConfirmar) mover(aConfirmar, confirmando.statusId, confirmando.label.toLocaleLowerCase("pt-BR"));
          setConfirmando(null);
        }}
        onCancel={() => setConfirmando(null)}
      />
      <table className="tabela">
        <thead>
          <tr>
            <th className="app-coluna" data-vazia="true" style={{ width: "2rem", paddingInline: "var(--e-2)" }}>
              {selecionando ? <span className="sr-only">Selecionar</span> : null}
            </th>
            <th className="app-coluna">{rotulo}</th>
            {conversacional ? (
              <>
                <th className="app-coluna">Contato</th>
                <th className="app-coluna hidden @4xl:table-cell">Canal</th>
              </>
            ) : null}
            <th className="app-coluna hidden @3xl:table-cell">Responsável</th>
            <th className="app-coluna">Vencimento</th>
            <th className="app-coluna hidden @5xl:table-cell">Prioridade</th>
            <th className="app-coluna hidden @6xl:table-cell">Tipo</th>
            <th className="app-coluna">Status</th>
            <th className="app-coluna" data-vazia="true" style={{ width: "1%" }}>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        {grupos.map(({ definition, itens }) => {
          const fechado = fechados.has(definition.id);
          const todos = itens.length > 0 && itens.every((t) => selected?.has(t.id));
          return (
            <tbody key={definition.id} className="cascata">
              <tr data-faixa="true">
                <td colSpan={colunas}>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => alternar(definition.id)}
                      aria-expanded={!fechado}
                      className="app-md inline-flex items-center gap-1.5 rounded-[var(--r-controle)] px-1 py-0.5 transition-colors hover:bg-[var(--superficie-2)]"
                      style={{ color: "var(--texto)" }}
                    >
                      <Icone de={fechado ? ChevronRight : ChevronDown} tamanho="xs" style={{ color: "var(--texto-3)" }} />
                      <Pilula cor={definition.color}>{definition.name}</Pilula>
                    </button>
                    <span className="app-meta app-numero">{itens.length}</span>
                    <BotaoDeMais
                      rotulo={definition.name}
                      aberto={criandoEm === definition.id}
                      onClick={() => (onMais ? onMais(definition.id) : setCriandoEm((atual) => (atual === definition.id ? null : definition.id)))}
                      {...(motivoDoMais ? { motivo: motivoDoMais } : {})}
                    />
                    <span className="app-meta">{STATUS_CATEGORY_LABEL[definition.category]}</span>
                    <span className="flex-1" />
                    {selecionando && onToggleMany && itens.length > 0 ? (
                      <label className="app-meta flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={todos}
                          onChange={(e) => onToggleMany(itens.map((t) => t.id), e.target.checked)}
                          className="accent-[var(--acento)]"
                          style={{ width: "var(--caixa-tam)", height: "var(--caixa-tam)" }}
                        />
                        todas do grupo
                      </label>
                    ) : null}
                    <ActionMenu
                      label={`Ações do grupo ${definition.name}`}
                      items={[
                        { label: fechado ? "Expandir" : "Recolher", onSelect: () => alternar(definition.id) },
                        {
                          label: "Selecionar todas do grupo",
                          onSelect: () => onToggleMany?.(itens.map((t) => t.id), true),
                          ...(selecionando && onToggleMany ? {} : { disabledReason: "Entre em “Selecionar várias” primeiro." }),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
              {criandoEm === definition.id && onCreateInGroup ? (
                <tr data-faixa="true">
                  <td colSpan={colunas}>
                    <CompositorNoGrupo
                      placeholder={`Nova em ${definition.name}`}
                      onCreate={(title, taskTypeId) => onCreateInGroup(title, definition.id, taskTypeId)}
                      seletor={seletorDeTipo}
                      onCancel={() => setCriandoEm(null)}
                    />
                  </td>
                </tr>
              ) : null}
              {fechado ? null : itens.length === 0 ? (
                <tr data-faixa="true">
                  <td colSpan={colunas} className="app-meta">
                    {rotulo === "Tarefa" ? "Nenhuma Tarefa" : `Nenhum ${rotulo}`} em {definition.name}.
                  </td>
                </tr>
              ) : (
                itens.map((task) => {
                  const vencida = isOverdue(state, task, now);
                  const proxima =
                    !vencida &&
                    task.dueDate !== undefined &&
                    !isTerminalCategory(statusCategory(state, task)) &&
                    Date.parse(task.dueDate.form === "civilDay" ? `${task.dueDate.value}T23:59:59` : task.dueDate.value) - now.getTime() <
                      3 * 86_400_000;
                  const responsavel = task.assignees.find((a) => a.kind === "member");
                  const membro = responsavel ? state.members.find((m) => m.id === responsavel.id) : undefined;
                  const agente = !membro && task.assignees[0]?.kind === "agent" ? state.agents.find((a) => a.id === task.assignees[0]?.id) : undefined;
                  const tipo = state.taskTypes.find((t) => t.id === task.taskTypeId);
                  // C35 — o Contato e o Canal vêm dos Vínculos; a Tarefa não os guarda.
                  const contato = conversacional ? contatoDaTarefa(state, task) : undefined;
                  const canal = conversacional ? canalDaTarefa(state, task) : undefined;
                  const escreve = taskWriteRefusal(state, memberId, task.id) === undefined;
                  const motivoDe = (statusId: string | undefined) =>
                    statusId === undefined
                      ? "Este Conjunto de Status não tem um Status de conclusão."
                      : !escreve
                        ? "Você não altera esta Tarefa."
                        : task.statusId === statusId
                          ? "Já está neste Status."
                          : statusOptionRefusal(state, memberId, task, statusId);
                  const podeConcluir = motivoDe(terminal?.id);
                  const selecionada = selected?.has(task.id) ?? false;
                  const prioridade = PRIORITY_ICON[task.priority];
                  return (
                    <tr
                      key={task.id}
                      data-recente={task.id === recente ? "true" : undefined}
                      className="group cursor-pointer"
                      data-selecionada={selecionada ? "true" : undefined}
                      // A linha inteira abre a Tarefa; um clique que nasce num
                      // controle (caixa, ação rápida, menu) é dele.
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest(escondeControle)) return;
                        openTask(task.id);
                      }}
                    >
                      <td style={{ paddingInline: "var(--e-2)" }}>
                        {selecionando && onToggle ? (
                          <input
                            type="checkbox"
                            checked={selecionada}
                            onChange={() => onToggle(task.id)}
                            aria-label={`Selecionar ${task.title}`}
                            className="accent-[var(--acento)]"
                            style={{ width: "var(--caixa-tam)", height: "var(--caixa-tam)" }}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="block h-5 w-0.5 rounded-full"
                            style={{ background: definition.color }}
                          />
                        )}
                      </td>
                      <td className="max-w-[28ch]" style={{ paddingBlock: "var(--e-1)" }}>
                        <span className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openTask(task.id)}
                            className="app-md block min-w-0 truncate text-left hover:underline"
                            style={{ color: "var(--texto)" }}
                            title={task.readableId ? `${task.readableId} · ${task.title}` : task.title}
                          >
                            {task.title}
                          </button>
                          {task.lifecycle !== "ativo" ? <StateSeal state={task.lifecycle} /> : null}
                          {isBlocked(state, task) ? <ConditionMarker tone="warning">Bloqueada</ConditionMarker> : null}
                        </span>
                      </td>
                      {conversacional ? (
                        <>
                          <td>
                            {contato ? (
                              <span className="inline-flex items-center gap-1.5" style={{ color: "var(--texto)" }}>
                                <ContactAvatar contact={contato} />
                                <span className="max-w-[14ch] truncate">{contactDisplayName(contato)}</span>
                              </span>
                            ) : (
                              <span style={{ color: "var(--texto-4)" }}>—</span>
                            )}
                          </td>
                          <td className="hidden @4xl:table-cell">
                            {canal ? (
                              <Pilula tom="neutro" className="whitespace-nowrap">
                                {CHANNEL_TYPE_LABEL[canal.channelType] ?? canal.name}
                              </Pilula>
                            ) : (
                              <span style={{ color: "var(--texto-4)" }}>—</span>
                            )}
                          </td>
                        </>
                      ) : null}
                      <td className="hidden @3xl:table-cell">
                        {membro ? (
                          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--texto)" }}>
                            <ActorAvatar kind="member" name={membro.displayName} {...(membro.photoFileId ? { photoFileId: membro.photoFileId } : {})} />
                            <span className="max-w-[12ch] truncate">{membro.displayName}</span>
                            {task.assignees.length > 1 ? <span className="app-meta app-numero">+{task.assignees.length - 1}</span> : null}
                          </span>
                        ) : agente ? (
                          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--texto)" }}>
                            <ActorAvatar kind="agent" name={agente.name} />
                            <span className="max-w-[12ch] truncate">{agente.name}</span>
                          </span>
                        ) : (
                          <span style={{ color: "var(--texto-4)" }}>—</span>
                        )}
                      </td>
                      <td
                        className="app-numero whitespace-nowrap"
                        style={{
                          color: vencida ? "var(--erro)" : proxima ? "var(--aviso)" : task.dueDate ? "var(--texto)" : "var(--texto-4)",
                          fontWeight: vencida ? 500 : undefined,
                        }}
                      >
                        {task.dueDate ? fmt.taskDate(task.dueDate) : "—"}
                        {vencida ? (
                          <>
                            {" "}
                            <ConditionMarker tone="danger">Vencida</ConditionMarker>
                          </>
                        ) : null}
                      </td>
                      <td className="hidden @5xl:table-cell">
                        <span className="app-sm inline-flex items-center gap-1" style={{ color: "var(--texto-3)" }} title={PRIORITY_LABEL[task.priority]}>
                          <Icone de={prioridade.icone} tamanho="xs" style={{ color: prioridade.cor }} />
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                      </td>
                      <td className="hidden @6xl:table-cell">
                        <span className="app-sm inline-flex items-center gap-1" style={{ color: "var(--texto-3)" }}>
                          <Icone de={iconeDeTipo(tipo?.icon)} tamanho="xs" />
                          {tipo?.name ?? "—"}
                        </span>
                      </td>
                      <td>
                        <Pilula cor={definition.color} className="whitespace-nowrap">
                          {definition.name}
                        </Pilula>
                      </td>
                      <td style={{ paddingInline: "var(--e-1)" }}>
                        <span className="flex items-center justify-end gap-0.5">
                          {/* As ações rápidas têm o seu lugar na linha (à esquerda do "…") e só se
                              mostram no hover/foco — nunca por cima do Status. Onde a largura não
                              cabe (abaixo de @5xl), ficam só no menu. */}
                          <span className="invisible hidden items-center gap-0.5 group-focus-within:visible group-hover:visible @5xl:flex">
                            <QuickAction label="Abrir detalhes" onClick={() => openTask(task.id)} icone={ExternalLink} />
                            <QuickAction
                              label={terminal ? `Mover para “${terminal.name}”` : "Concluir"}
                              onClick={() => terminal && setConfirmando({ taskId: task.id, statusId: terminal.id, label: `Mover para “${terminal.name}”` })}
                              icone={CheckCircle2}
                              {...(podeConcluir ? { disabledReason: podeConcluir } : {})}
                            />
                          </span>
                          <ActionMenu
                            label={`Mais opções de ${task.title}`}
                            items={[
                              { label: "Abrir detalhes", onSelect: () => openTask(task.id) },
                              { label: "Abrir em página cheia", onSelect: () => router.push(`/estrutura/tarefas/${task.id}`) },
                              ...definitions
                                .filter((d) => d.id !== task.statusId)
                                .sort((a, b) => a.order - b.order)
                                .map((d) => {
                                  const motivo = escreve ? statusOptionRefusal(state, memberId, task, d.id) : "Você não altera esta Tarefa.";
                                  return {
                                    label: `Mover para “${d.name}”`,
                                    onSelect: () => setConfirmando({ taskId: task.id, statusId: d.id, label: `Mover para “${d.name}”` }),
                                    ...(motivo ? { disabledReason: motivo } : {}),
                                  };
                                }),
                            ]}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          );
        })}
      </table>
      {tasks.length === 0 ? <EmptyState compact title={`${rotulo === "Tarefa" ? "Nenhuma Tarefa" : `Nenhum ${rotulo}`} passa por este filtro.`} /> : null}
    </div>
  );
}

function QuickAction({
  label,
  onClick,
  icone,
  disabledReason,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly icone: LucideIcon;
  readonly disabledReason?: string;
}) {
  const off = disabledReason !== undefined;
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      aria-disabled={off}
      aria-label={label}
      title={off ? disabledReason : label}
      className="btn-icone btn-icone-nu"
      style={{
        width: "1.75rem",
        height: "1.75rem",
        ...(off ? { cursor: "not-allowed", color: "var(--texto-4)", opacity: 0.6 } : {}),
      }}
    >
      <Icone de={icone} tamanho="xs" />
    </button>
  );
}
