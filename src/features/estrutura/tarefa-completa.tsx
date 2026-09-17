"use client";

/**
 * T12 — Tarefa. The central document of the domain. Este componente é a Tarefa
 * inteira — a página `/estrutura/tarefas/[tarefa]` o embrulha, e o popup da
 * Lista (TaskPanel, ContaDrawer) o mostra tal qual: nada de "modo leitura".
 *
 * The status selector groups by CATEGORY (A4.3) and disables the terminal ones
 * when the List functionality already reproves the transition — the data is on
 * screen, so the control does not wait for the click to fail (PADROES §10).
 *
 * A composição é a da Tarefa do ClickUp: a barra de 44px com o caminho, o
 * selo e as ações; no centro a FICHA — o tipo, o título grande, a descrição e
 * as propriedades em duas colunas de linhas compactas (ícone · rótulo · valor),
 * cada uma abrindo o seu editor só ao clicar; os Campos numa lista da mesma
 * família; e, abaixo, Checklists, Subtarefas e o resto em seções. À direita,
 * a ATIVIDADE: os comentários como conversa e o registro recolhido.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MoveTaskDialog,
  useMoveTaskDialog,
} from "@/features/estrutura/move-task-dialog";
import {
  TaskAttributeEditors,
  TaskComments,
  TaskFieldValueEditor,
  TaskTagsEditor,
  TaskTitleDescriptionEditor,
  TaskWatchers,
} from "@/features/estrutura/task-editors";
import {
  TaskAttachments,
  TaskDependencies,
  TaskRecurrence,
  TaskTime,
} from "@/features/estrutura/collaboration-editors";
import { SaveTemplateDialog } from "@/features/estrutura/template-dialogs";
import { ShareTaskDialog } from "@/features/estrutura/share-task-dialog";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Flag,
  Hash,
  History,
  Hourglass,
  Link2,
  ListChecks,
  Mail,
  Paperclip,
  Phone,
  SquareCheck,
  Tag,
  Timer,
  Type,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { LinhaDeProp } from "@/features/estrutura/linha-de-propriedade";
import { corDeTipo, iconeDeTipo } from "@/features/estrutura/icone-de-tipo";
import { financeProfileOf, valorDaConta } from "@/features/estrutura/financeiro/lens";
import { useData, useRun, useSession } from "@/data/store";
import {
  checklistProgress,
  containerAdminRefusal,
  effectiveListConfig,
  effectiveLifecycleOfTask,
  isBlocked,
  isOverdue,
  memberReachesContainer,
  memberSeesTask,
  spawnedOccurrenceOf,
  statusDefinition,
  subtaskProgress,
  terminalStatusBlockReason,
  taskLevel,
  taskCommentRefusal,
  taskWriteRefusal,
} from "@/data/derive";
import {
  addChecklist,
  addChecklistItem,
  assignTask,
  changeTaskStatus,
  convertChecklistItem,
  createTask,
  setChecklistItemDone,
  trashTask,
  unassignTask,
  updateTask,
  contaSemCliente,
  contaSemResumo,
  guestFieldWriter,
  parcelaDuplicada,
  statusOptionRefusal,
} from "@/data/operations";
import {
  ACTOR_KIND_LABEL,
  OBJECT_TYPE_LABEL,
  PRIORITY_LABEL,
} from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import type { Formatters } from "@/features/shell/format";
import {
  ActionMenu,
  ActorAvatar,
  Button,
  CabecalhoDePainel,
  ConditionMarker,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Field,
  Icone,
  MultiSelect,
  PageHeader,
  Pilula,
  ReguaDeSecao,
  Select,
  SidePanel,
  StateSeal,
  StatusPicker,
  TextInput,
  Toast,
} from "@/features/shell/ui";
import type { DataState } from "@/data/state";
import type { ActorRef } from "@/data/types";

/** §15 — a slice that hides rows always states the cut and offers the rest. */
const ACTIVITY_PAGE_SIZE = 12;

/** A faixa de aviso entre o cabeçalho e o corpo: arquivada, na lixeira, somente leitura. */
const FAIXA_DE_AVISO = {
  background: "var(--aviso-lavado)",
  color: "var(--aviso)",
  borderBottom: "1px solid var(--linha)",
} as const;

/** O aviso de regra dentro de um Painel: a mesma família da faixa, em caixa. */
const AVISO_EM_CAIXA = {
  background: "var(--aviso-lavado)",
  color: "var(--aviso)",
} as const;

export function TarefaCompleta({
  taskId: tarefa,
  modo = "pagina",
}: {
  readonly taskId: string;
  /** Na página, com a barra de 44px; no popup, o mesmo conteúdo sob o título do popup. */
  readonly modo?: "pagina" | "popup";
}) {
  const state = useData((data) => data);
  const fmt = useFormat();
  const run = useRun();
  const { memberId } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proximaOcorrencia, setProximaOcorrencia] = useState<string | null>(
    null,
  );
  const router = useRouter();
  const query = useSearchParams();
  const pathname = usePathname();
  /**
   * D13 — a conversão vive no endereço (`?converter-item=<checklist>:<item>`).
   * É terminal, sem inversa, e exige digitar o nome do Item: o gesto precisa
   * custar tanto quanto a consequência.
   */
  const convertingRaw = query.get("converter-item");
  const converting = (() => {
    if (!convertingRaw) return null;
    const [checklistId, itemId] = convertingRaw.split(":");
    return checklistId && itemId ? { checklistId, itemId } : null;
  })();
  const [typedItem, setTypedItem] = useState("");
  const [confirmingTrash, setConfirmingTrash] = useState(false);
  // Numa conta do Financeiro, mudar o Status dispara Automações: pede confirmação
  // aqui como a linha da tabela e o rodapé do popup pedem.
  const [confirmandoStatus, setConfirmandoStatus] = useState<{ readonly id: string; readonly name: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [newChecklist, setNewChecklist] = useState("");
  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const [newSubtask, setNewSubtask] = useState("");
  const { movingTaskId, openMove, closeMove } = useMoveTaskDialog();
  // Os outros parâmetros ficam: no popup, `?tarefa=` é o que o mantém aberto.
  const openConversion = (checklistId: string, itemId: string) => {
    setTypedItem("");
    const next = new URLSearchParams(query.toString());
    next.set("converter-item", `${checklistId}:${itemId}`);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const closeConversion = () => {
    setTypedItem("");
    const next = new URLSearchParams(query.toString());
    next.delete("converter-item");
    router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  // B38a — o que o Membro não alcança não existe para ele: a mesma tela de "não encontrada".
  const task = state.tasks.find(
    (t) => t.id === tarefa && memberSeesTask(state, memberId, t.id),
  );
  const config = task ? effectiveListConfig(state, task.listId) : null;

  if (!task || !config) {
    if (modo === "popup") {
      return (
        <div className="p-6">
          <EmptyState
            title="Tarefa não encontrada."
            hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la."
          />
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Tarefa não encontrada" />
        <CorpoDeTela>
          <EmptyState
            title="Tarefa não encontrada."
            hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la."
          />
        </CorpoDeTela>
      </div>
    );
  }

  const effective = effectiveLifecycleOfTask(state, task.id);
  const escritaRecusada = taskWriteRefusal(state, memberId, task.id);
  // Edita quem pode escrever numa Tarefa ativa; o resto lê, com a razão dita.
  const editavel = effective === "ativo" && escritaRecusada === undefined;
  // A Pessoa da conta: Convidado que preenche só os Campos que a Lista libera e comenta.
  const camposDeConvidado =
    effective === "ativo"
      ? guestFieldWriter(state, memberId, task.id)
      : undefined;
  const comentaComoConvidado = camposDeConvidado !== undefined;
  // Quem chegou por concessão “comentar” (o Comercial nas contas dos seus clientes) comenta sem editar.
  const comenta =
    effective === "ativo" &&
    (comentaComoConvidado || taskCommentRefusal(state, memberId, task.id) === undefined);
  const definition = statusDefinition(state, task.listId, task.statusId);
  const tipoDaTarefa = state.taskTypes.find((t) => t.id === task.taskTypeId);
  const lenteFinanceira = financeProfileOf(task.listId);
  const checklist = checklistProgress(task);
  const subtasks = subtaskProgress(state, task.id);
  const level = taskLevel(state, task);

  const blockReason = terminalStatusBlockReason(state, task);
  // O que impede sair do Status atual, dito na tela e não só no hover dos chips.
  const motivoDeSaida = (() => {
    const outra = config.statusSet.definitions.find(
      (d) => d.id !== task.statusId,
    );
    const razao = outra
      ? statusOptionRefusal(state, memberId, task, outra.id)
      : undefined;
    return razao?.startsWith("Para sair") ? razao : undefined;
  })();
  const somenteLeituraBase =
    effective !== "ativo"
      ? "Uma Tarefa arquivada ou na lixeira é somente leitura."
      : escritaRecusada;
  const administraLista = containerAdminRefusal(
    state,
    memberId,
    "list",
    task.listId,
  );
  const revogarRecusado =
    (effective !== "ativo"
      ? "Uma Tarefa arquivada ou na lixeira é somente leitura."
      : undefined) ?? administraLista;
  const compartilharRecusado =
    revogarRecusado ??
    (!config.features.compartilhamentoPublico
      ? "Esta Lista não permite compartilhamento público."
      : undefined);
  // A frase que o menu mostra em vez de deixar o clique descobrir a recusa.
  const somenteLeitura = somenteLeituraBase;

  const report = (result: { ok: boolean; error?: string }, message: string) => {
    if (result.ok) {
      setError(null);
      setNotice(message);
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };

  const changeStatus = (statusId: string) => {
    const tinhaRecorrencia = task.recurrence !== undefined;
    const result = run((data, memberId) =>
      changeTaskStatus(data, memberId, task.id, statusId),
    );
    if (result.ok) {
      setError(null);
      // A Recorrência foi transferida? A próxima ocorrência é o que a pessoa procura em seguida.
      const proxima =
        tinhaRecorrencia && result.value.recurrence === undefined
          ? spawnedOccurrenceOf(state, task.id)
          : undefined;
      setNotice(
        proxima
          ? `Status alterado. Próxima ocorrência criada: ${proxima.title}.`
          : "Status alterado.",
      );
      setProximaOcorrencia(proxima?.id ?? null);
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  const convert = (checklistId: string, itemId: string) => {
    const result = run((data, memberId) =>
      convertChecklistItem(data, memberId, task.id, checklistId, itemId),
    );
    if (result.ok) {
      setError(null);
      setNotice(`Item convertido em Subtarefa: ${result.value.title}.`);
      closeConversion();
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  const activity = state.activity.filter(
    (record) => record.objectId === task.id,
  );

  const convertingChecklist = converting
    ? task.checklists.find((group) => group.id === converting.checklistId)
    : undefined;
  const convertingItem = convertingChecklist?.items.find(
    (item) => item.id === converting?.itemId,
  );
  const convertingSubitems = convertingChecklist
    ? subitemsOf(convertingChecklist.items, converting?.itemId ?? "")
    : 0;

  const assign = (ids: readonly string[]) => {
    const current = new Set(task.assignees.map((a) => a.id));
    const added = ids.filter((id) => !current.has(id));
    const removed = task.assignees.filter((a) => !ids.includes(a.id));
    for (const id of added) {
      const result = run((data, memberId) =>
        assignTask(data, memberId, task.id, {
          kind: data.agents.some((agent) => agent.id === id)
            ? "agent"
            : "member",
          id,
        }),
      );
      if (!result.ok) {
        report(result, "");
        return;
      }
    }
    for (const assignee of removed) {
      const result = run((data, memberId) =>
        unassignTask(data, memberId, task.id, assignee),
      );
      if (!result.ok) {
        report(result, "");
        return;
      }
    }
    if (added.length > 0 || removed.length > 0) {
      setError(null);
      setNotice(
        removed.length > 0 && added.length === 0
          ? "Responsável removido."
          : "Responsáveis atualizados.",
      );
    }
  };

  const confirmTrash = () => {
    const result = run((data, memberId) => trashTask(data, memberId, task.id));
    if (result.ok) {
      setError(null);
      setNotice(
        "Tarefa enviada à lixeira. Ela pode ser restaurada enquanto estiver lá.",
      );
    } else {
      setNotice(null);
      setError(result.error);
    }
    setConfirmingTrash(false);
  };

  const restrictedBy =
    effective !== task.lifecycle
      ? state.lists.find((l) => l.id === task.listId)?.name
      : undefined;

  const filhas = state.tasks.filter((t) => t.parentTaskId === task.id);
  const vinculos = state.links.filter(
    (l) => l.fromId === task.id || l.toId === task.id,
  );
  const camposArquivados = task.fieldValues.filter(
    (value) => value.state === "arquivado",
  );

  // O menu de ações da Tarefa: na barra da página, ou no alto da ficha no popup.
  const menuDeAcoes = (
    <ActionMenu
      items={[
        {
          label: "Editar título e descrição",
          onSelect: () => setEditing(true),
          ...(somenteLeitura ? { disabledReason: somenteLeitura } : {}),
        },
        {
          label: "Mover para outra Lista",
          onSelect: () => openMove(task.id),
          ...(somenteLeitura
            ? { disabledReason: somenteLeitura }
            : task.parentTaskId !== undefined
              ? {
                  disabledReason:
                    "Uma Subtarefa só muda de Lista depois de promovida a Tarefa raiz.",
                }
              : {}),
        },
        {
          label: "Salvar como modelo",
          onSelect: () => setSalvandoModelo(true),
          ...(administraLista ? { disabledReason: administraLista } : {}),
        },
        {
          label: task.publicShare?.active
            ? "Link público"
            : "Compartilhar por link",
          onSelect: () => setCompartilhando(true),
          ...(task.publicShare?.active
            ? {}
            : compartilharRecusado
              ? { disabledReason: compartilharRecusado }
              : {}),
        },
        {
          label: "Enviar à lixeira",
          onSelect: () => setConfirmingTrash(true),
          destructive: true,
          ...(effective === "naLixeira"
            ? { disabledReason: "Já está na lixeira." }
            : escritaRecusada
              ? { disabledReason: escritaRecusada }
              : {}),
        },
      ]}
    />
  );

  return (
    <div className={modo === "popup" ? "flex min-h-0 flex-1 flex-col" : "flex h-full flex-col"}>
      {modo === "pagina" ? (
      <PageHeader
        path={config.path.map((node, index) => (
          <span key={node.id}>
            {index > 0 ? " › " : ""}
            {memberReachesContainer(state, memberId, node.type, node.id) ? (
              <Link
                href={
                  node.type === "space"
                    ? `/estrutura/espacos/${node.id}`
                    : node.type === "folder"
                      ? `/estrutura/pastas/${node.id}`
                      : `/estrutura/listas/${node.id}`
                }
                className="hover:underline"
              >
                {node.name}
              </Link>
            ) : (
              // A Pessoa da conta chega à Tarefa por concessão direta: o caminho é só rótulo.
              <span>{node.name}</span>
            )}
          </span>
        ))}
        title={task.title}
        seal={<StateSeal state={effective} />}
        actions={menuDeAcoes}
      />
      ) : null}

      {restrictedBy ? (
        <p className="app-base shrink-0 px-4 py-2" style={FAIXA_DE_AVISO}>
          {effective === "arquivado" ? "Arquivada" : "Na lixeira"} porque a
          Lista <em>{restrictedBy}</em> está{" "}
          {effective === "arquivado" ? "arquivada" : "na lixeira"}.{" "}
          {effective === "naLixeira" ? (
            <Link href="/configuracoes/lixeira" className="underline">
              Restaurar na Lixeira
            </Link>
          ) : null}
        </p>
      ) : null}

      {escritaRecusada && effective === "ativo" ? (
        <p className="app-base shrink-0 px-4 py-2" style={FAIXA_DE_AVISO}>
          Somente leitura: {escritaRecusada}
          {camposDeConvidado
            ? ` Você pode preencher ${camposDeConvidado.map((id) => state.fieldDefinitions.find((d) => d.id === id)?.name ?? id).join(" e ")} e comentar.`
            : comenta
              ? " Você pode comentar."
              : ""}
        </p>
      ) : null}

      {modo === "pagina" ? (
        <MoveTaskDialog
          taskId={movingTaskId}
          onClose={closeMove}
          onDone={(text) => {
            setError(null);
            setNotice(text);
          }}
        />
      ) : null}

      <SidePanel
        title="Editar Tarefa"
        open={editing}
        onClose={() => setEditing(false)}
      >
        <p className="app-meta mb-3">
          Cada campo alterado vira um Registro de Atividade com o valor
          anterior.
        </p>
        {editing ? (
          <TaskTitleDescriptionEditor
            task={task}
            report={report}
            onClose={() => setEditing(false)}
          />
        ) : null}
      </SidePanel>

      <SaveTemplateDialog
        kind="tarefa"
        sourceId={task.id}
        open={salvandoModelo}
        onClose={() => setSalvandoModelo(false)}
        report={report}
      />
      <ShareTaskDialog
        task={task}
        open={compartilhando}
        onClose={() => setCompartilhando(false)}
        report={report}
        permitido={compartilharRecusado}
        revogarRecusado={revogarRecusado}
      />
      {lenteFinanceira ? (
        <ConfirmDialog
          open={confirmandoStatus !== null}
          title={`Mover para “${confirmandoStatus?.name ?? ""}”: “${task.title}”?`}
          description={`${fmt.money({ amount: valorDaConta(task), currency: "BRL" })} · vence ${task.dueDate ? fmt.taskDate(task.dueDate) : "—"}. Passa pelas regras da Lista e fica na Atividade.`}
          confirmLabel="Mover"
          onConfirm={() => {
            if (confirmandoStatus) changeStatus(confirmandoStatus.id);
            setConfirmandoStatus(null);
          }}
          onCancel={() => setConfirmandoStatus(null)}
        />
      ) : null}
      <ConfirmDialog
        open={confirmingTrash}
        title={`Enviar “${task.title}” à lixeira?`}
        description={`A Tarefa sai das Visualizações e pode ser restaurada por ${state.workspace.trashPolicy.retentionDays} dias, voltando ao estado que tinha antes. As Subtarefas vão junto.`}
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={confirmTrash}
        onCancel={() => setConfirmingTrash(false)}
      />

      {convertingItem ? (
        <ConfirmDialog
          open
          title={`Converter “${convertingItem.text}” em Subtarefa?`}
          description={`Sem conversão inversa. O Item fica marcado como convertido e sai do progresso do Checklist.${
            convertingSubitems > 0
              ? ` Os ${convertingSubitems} subitens migram como Checklist da nova Subtarefa e saem deste.`
              : ""
          }`}
          confirmLabel="Converter"
          destructive
          {...(typedItem.trim() !== convertingItem.text
            ? {
                confirmDisabledReason: `Digite “${convertingItem.text}” para confirmar.`,
              }
            : {})}
          onConfirm={() =>
            converting && convert(converting.checklistId, converting.itemId)
          }
          onCancel={closeConversion}
        >
          <Field label={`Digite “${convertingItem.text}” para confirmar`}>
            {(id) => (
              <TextInput
                id={id}
                value={typedItem}
                onChange={setTypedItem}
                invalid={
                  typedItem !== "" && typedItem.trim() !== convertingItem.text
                }
                placeholder={convertingItem.text}
              />
            )}
          </Field>
        </ConfirmDialog>
      ) : null}

      {/* A ficha no centro, a Atividade à direita — como no ClickUp. Abaixo de xl
          a Atividade fica embaixo, com altura própria. */}
      <div className="@container flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col @4xl:flex-row">
      <CorpoDeTela>
        {notice ? (
          <Toast
            tone="success"
            onDismiss={() => {
              setNotice(null);
              setProximaOcorrencia(null);
            }}
          >
            {notice}
            {proximaOcorrencia ? (
              <>
                {" "}
                <Link
                  href={`/estrutura/tarefas/${proximaOcorrencia}`}
                  className="underline"
                >
                  Abrir
                </Link>
              </>
            ) : null}
          </Toast>
        ) : null}
        {error ? (
          <Toast tone="error" onDismiss={() => setError(null)}>
            {error}
          </Toast>
        ) : null}

        <div className="@container mx-auto w-full max-w-4xl">
          {/* ───────────────────────── o tipo, o identificador, os anexos ─── */}
          <div className="flex flex-wrap items-center gap-2">
            <Pilula cor={corDeTipo(tipoDaTarefa?.icon)} className="gap-1.5">
              <Icone de={iconeDeTipo(tipoDaTarefa?.icon)} tamanho="xs" />
              {tipoDaTarefa?.name ?? "Tarefa"}
            </Pilula>
            {task.readableId ? <span className="identificador">{task.readableId}</span> : null}
            {isOverdue(state, task, new Date()) ? (
              <ConditionMarker tone="danger">Vencida</ConditionMarker>
            ) : null}
            {isBlocked(state, task) ? (
              <ConditionMarker tone="warning">Bloqueada</ConditionMarker>
            ) : null}
            {task.attachments.length > 0 ? (
              <span className="app-meta flex items-center gap-1">
                <Icone de={Paperclip} tamanho="xs" />
                {task.attachments.length}
              </span>
            ) : null}
            {modo === "popup" ? (
              <span className="ml-auto flex items-center gap-2">
                <StateSeal state={effective} />
                {menuDeAcoes}
              </span>
            ) : null}
          </div>

          {/* ───────────────────────── o título e a descrição ─────────────── */}
          {editavel ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-3 block w-full rounded-[var(--r-controle)] text-left transition-colors hover:bg-[var(--superficie-hover)]"
              title="Editar título e descrição"
            >
              <h1 className="ed-display px-2 py-1">{task.title}</h1>
            </button>
          ) : (
            <h1 className="ed-display mt-3 px-2 py-1">{task.title}</h1>
          )}
          {task.description ? (
            editavel ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="app-base mt-1 block w-full whitespace-pre-wrap rounded-[var(--r-controle)] px-2 py-1 text-left transition-colors hover:bg-[var(--superficie-hover)]"
                style={{ color: "var(--texto-1)" }}
                title="Editar título e descrição"
              >
                {task.description}
              </button>
            ) : (
              <p className="app-base mt-1 whitespace-pre-wrap px-2 py-1" style={{ color: "var(--texto-1)" }}>
                {task.description}
              </p>
            )
          ) : editavel ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="app-base mt-1 block rounded-[var(--r-controle)] px-2 py-1 text-left transition-colors hover:bg-[var(--superficie-hover)]"
              style={{ color: "var(--texto-4)" }}
            >
              Adicionar descrição…
            </button>
          ) : null}
          <p className="app-meta mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-2">
            <span>
              Criada por {authorLabel(state, task.createdBy)} {fmt.relative(task.createdAt)}
            </span>
            {level > 0 ? <span>Subtarefa · nível {level}</span> : null}
          </p>

          {/* ───────────────────────── as propriedades, em duas colunas ────── */}
          <div className="mt-5 grid gap-x-8 gap-y-0.5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid min-w-0 content-start gap-0.5">
              <LinhaDeProp
                icone={CircleDot}
                rotulo="Status"
                cor={definition?.color}
                controle={
                  <StatusPicker
                    options={[...config.statusSet.definitions]
                      .sort((a, b) => a.order - b.order)
                      .map((option) => ({
                        id: option.id,
                        name: option.name,
                        category: option.category,
                        color: option.color,
                      }))}
                    value={task.statusId}
                    onChange={(statusId) => {
                      const alvo = config.statusSet.definitions.find((d) => d.id === statusId);
                      if (lenteFinanceira && alvo) setConfirmandoStatus({ id: alvo.id, name: alvo.name });
                      else changeStatus(statusId);
                    }}
                    {...(blockReason ? { terminalBlockReason: blockReason } : {})}
                    optionBlockReason={(optionId) =>
                      statusOptionRefusal(state, memberId, task, optionId)
                    }
                    readOnly={!editavel}
                    readOnlyReason={
                      effective !== "ativo"
                        ? `Esta Tarefa está ${effective === "arquivado" ? "arquivada" : "na lixeira"} e é somente leitura.`
                        : (escritaRecusada ?? "")
                    }
                  />
                }
              />
              <LinhaDeProp
                icone={CalendarDays}
                rotulo="Datas"
                valor={
                  task.startDate || task.dueDate ? (
                    <span className="flex items-center gap-2">
                      <span>{task.startDate ? fmt.taskDate(task.startDate) : "Início"}</span>
                      <Icone de={ArrowRight} tamanho="xs" style={{ color: "var(--texto-4)" }} />
                      <span style={{ color: isOverdue(state, task, new Date()) ? "var(--erro)" : undefined }}>
                        {task.dueDate ? fmt.taskDate(task.dueDate) : "Vencimento"}
                      </span>
                    </span>
                  ) : (
                    "Vazio"
                  )
                }
                editavel={editavel}
                motivo={somenteLeitura}
                editor={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="w-44">
                      <TaskAttributeEditors task={task} report={report} features={config.features} apenas="inicio" />
                    </span>
                    <Icone de={ArrowRight} tamanho="xs" style={{ color: "var(--texto-4)" }} />
                    <span className="w-44">
                      <TaskAttributeEditors task={task} report={report} features={config.features} apenas="vencimento" />
                    </span>
                  </span>
                }
              />
              {config.features.estimativa ? (
                <LinhaDeProp
                  icone={Hourglass}
                  rotulo="Estimativa de tempo"
                  valor={task.estimate !== undefined ? `${task.estimate} min` : "Vazio"}
                  editavel={editavel}
                  motivo={somenteLeitura}
                  editor={
                    <span className="block w-40">
                      <TaskAttributeEditors task={task} report={report} features={config.features} apenas="estimativa" />
                    </span>
                  }
                />
              ) : null}
              <LinhaDeProp
                icone={Tag}
                rotulo="Etiquetas"
                valor={
                  task.tagIds.length === 0 ? (
                    "Vazio"
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {task.tagIds.map((id) => {
                        const tag = state.tags.find((t) => t.id === id);
                        return (
                          <Pilula key={id} cor={tag?.color}>
                            {tag?.name ?? id}
                          </Pilula>
                        );
                      })}
                    </span>
                  )
                }
                editavel={editavel}
                motivo={somenteLeitura}
                editor={<TaskTagsEditor task={task} report={report} id="tags-da-tarefa" />}
              />
            </div>

            <div className="grid min-w-0 content-start gap-0.5">
              <LinhaDeProp
                icone={Users}
                rotulo="Responsáveis"
                valor={
                  task.assignees.length === 0 ? (
                    "Vazio"
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      {task.assignees.map((assignee) => (
                        <span key={assignee.id} className="flex items-center gap-1.5">
                          <ActorAvatar kind={assignee.kind} name={authorLabel(state, assignee)} />
                          {authorLabel(state, assignee)}
                        </span>
                      ))}
                    </span>
                  )
                }
                editavel={editavel}
                motivo={somenteLeitura}
                editor={
                  <MultiSelect
                    id="responsaveis-da-tarefa"
                    values={task.assignees.map((assignee) => assignee.id)}
                    onChange={assign}
                    placeholder="sem Responsável"
                    options={[
                      ...state.members
                        .filter((member) => member.state === "ativo")
                        .map((member) => ({
                          value: member.id,
                          label: member.displayName,
                          detail: "Membro",
                        })),
                      ...state.agents
                        .filter((agent) => agent.lifecycle === "ativo")
                        .map((agent) => ({
                          value: agent.id,
                          label: agent.name,
                          detail: "Agente",
                        })),
                    ]}
                  />
                }
              />
              {config.features.prioridade ? (
                <LinhaDeProp
                  icone={Flag}
                  rotulo="Prioridade"
                  valor={PRIORITY_LABEL[task.priority]}
                  editavel={editavel}
                  motivo={somenteLeitura}
                  editor={
                    <span className="block w-44">
                      <TaskAttributeEditors task={task} report={report} features={config.features} apenas="prioridade" />
                    </span>
                  }
                />
              ) : null}
              <LinhaDeProp
                icone={iconeDeTipo(tipoDaTarefa?.icon)}
                rotulo="Tipo de Tarefa"
                valor={tipoDaTarefa?.name ?? "—"}
                editavel={editavel}
                motivo={somenteLeitura}
                editor={
                  <span className="block w-52">
                    <Select
                      id="tipo-da-tarefa"
                      value={task.taskTypeId}
                      onChange={(taskTypeId) =>
                        report(
                          run((data, me) =>
                            updateTask(data, me, task.id, { taskTypeId }),
                          ),
                          "Tipo alterado.",
                        )
                      }
                      options={config.taskTypeIds.map((id) => ({
                        value: id,
                        label:
                          state.taskTypes.find((t) => t.id === id)?.name ?? id,
                      }))}
                    />
                  </span>
                }
              />
              {config.features.registroDeTempo ? (
                <LinhaDeProp
                  icone={Timer}
                  rotulo="Rastrear tempo"
                  valor={
                    task.timeEntries.length === 0
                      ? "Iniciar"
                      : `${task.timeEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0)} min · ${task.timeEntries.length} registro${task.timeEntries.length === 1 ? "" : "s"}`
                  }
                  // Abre sempre: a lista de lançamentos mora aqui, e uma Tarefa
                  // arquivada ainda tem o que mostrar (o TaskTime cuida do só-leitura).
                  editavel
                  editor={<TaskTime task={task} report={report} readOnly={!editavel} />}
                />
              ) : null}
              {config.features.checklists || config.features.subtarefas ? (
                <LinhaDeProp
                  icone={ListChecks}
                  rotulo="Progresso"
                  valor={[
                    config.features.checklists ? `Checklists ${checklist ? `${checklist.done} de ${checklist.total}` : "—"}` : null,
                    config.features.subtarefas ? `Subtarefas ${subtasks ? `${subtasks.done} de ${subtasks.total}` : "—"}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ) : null}
            </div>
          </div>

          {/* Os avisos de regra que acompanham o Status. */}
          <div className="mt-2 grid gap-2">
                {motivoDeSaida ? (
                  <p className="app-base mt-2" style={{ color: "var(--texto-3)" }}>
                    {motivoDeSaida}
                  </p>
                ) : null}
                {contaSemResumo(state, task) ? (
                  <p
                    role="status"
                    className="app-base mt-2 rounded-[var(--r-controle)] px-3 py-2"
                    style={AVISO_EM_CAIXA}
                  >
                    Conta lançada sem “Resumo de pagamento” e sem Integração manual
                    (INV-CP-01): peça ao Agente de lançamento ou marque a Integração
                    manual.
                  </p>
                ) : null}
                {contaSemCliente(state, task) ? (
                  <p
                    role="status"
                    className="app-base mt-2 rounded-[var(--r-controle)] px-3 py-2"
                    style={AVISO_EM_CAIXA}
                  >
                    Entrada ou parcela sem cliente vinculado (RN-CR-02): a soma por
                    cliente não a conta. Crie a série por “Nova série de parcelas”
                    para nascer com o Vínculo.
                  </p>
                ) : null}
                {(() => {
                  const outra = parcelaDuplicada(state, task);
                  return outra ? (
                    <p
                      role="status"
                      className="app-base mt-2 rounded-[var(--r-controle)] px-3 py-2"
                      style={AVISO_EM_CAIXA}
                    >
                      Parcela duplicada (RN-CR-07): já existe{" "}
                      <Link href={`/estrutura/tarefas/${outra.id}`} className="underline">
                        {outra.readableId ?? outra.title}
                      </Link>{" "}
                      para o mesmo cliente e número. Descarte uma das duas.
                    </p>
                  ) : null;
                })()}
                {blockReason ? (
                  <p className="app-base mt-2" style={{ color: "var(--texto-3)" }}>
                    Concluir está indisponível: {blockReason}{" "}
                    <Link
                      href={`/estrutura/listas/${task.listId}/configuracoes`}
                      className="underline"
                    >
                      Ver a exigência nas configurações da Lista
                    </Link>
                    .
                  </p>
                ) : null}
          </div>

          <hr className="my-6 border-0" style={{ borderTop: "1px solid var(--linha)" }} />

          {/* ───────────────────────── os Campos, em lista compacta ────────── */}
          <details open className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2">
              <Icone de={ChevronRight} tamanho="xs" className="rotacao group-open:rotate-90" style={{ color: "var(--texto-4)" }} />
              <span className="app-md" style={{ color: "var(--texto)" }}>
                Campos
              </span>
              <span className="app-meta app-numero">{config.fieldDefinitionIds.length}</span>
            </summary>
            <div className="mt-2 pl-6">
              <p className="app-meta mb-1">
                Campos de <span className="app-sm" style={{ color: "var(--texto-1)" }}>{tipoDaTarefa?.name ?? "Tarefa"}</span> e desta Lista
              </p>
              {config.fieldDefinitionIds.length === 0 ? (
                <p className="app-meta px-2 py-1">Nenhum campo personalizado se aplica a esta Lista.</p>
              ) : (
                <div className="grid gap-0.5">
                  {config.fieldDefinitionIds.map((definitionId) => {
                    const fieldDefinition = state.fieldDefinitions.find(
                      (d) => d.id === definitionId,
                    );
                    const value = task.fieldValues.find(
                      (v) => v.definitionId === definitionId,
                    );
                    if (!fieldDefinition) return null;
                    const edita =
                      fieldDefinition.lifecycle === "ativo" &&
                      (editavel || (camposDeConvidado?.includes(definitionId) ?? false));
                    const bruto = value && value.state === "ativo" ? value.value : undefined;
                    return (
                      <LinhaDeProp
                        key={definitionId}
                        icone={iconeDeCampo(fieldDefinition.type)}
                        rotulo={fieldDefinition.name}
                        obrigatorio={fieldDefinition.required === true}
                        valor={valorDeCampo(state, fmt, fieldDefinition.type, bruto)}
                        editavel={edita}
                        motivo={edita ? undefined : (somenteLeitura ?? "Este Campo não é editável por você.")}
                        editor={
                          <span className="block max-w-sm">
                            <TaskFieldValueEditor
                              key={`${definitionId}-${String(bruto ?? "")}`}
                              task={task}
                              definition={fieldDefinition}
                              report={report}
                              soControle
                            />
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              )}
              {camposArquivados.length > 0 ? (
                <details className="painel mt-3 px-3 py-2">
                  <summary className="app-meta cursor-pointer">
                    Campos não aplicáveis neste caminho (
                    {camposArquivados.length}
                    )
                  </summary>
                  <dl className="mt-2">
                    {camposArquivados.map((value) => (
                      <Attribute
                        key={value.definitionId}
                        label={
                          state.fieldDefinitions.find(
                            (d) => d.id === value.definitionId,
                          )?.name ?? value.definitionId
                        }
                      >
                        <span style={{ color: "var(--texto-3)" }}>
                          {String(value.value ?? "—")}
                        </span>
                      </Attribute>
                    ))}
                  </dl>
                  <p className="app-meta mt-2">
                    Preservados e reativados se a Tarefa voltar a um caminho em
                    que a Definição se aplica.
                  </p>
                </details>
              ) : null}
            </div>
          </details>

          <div className="mt-6 grid gap-6">
            {config.features.checklists ? (
              <section>
                <ReguaDeSecao rotulo="Checklists" contagem={task.checklists.length} />
                <div>
                  {task.checklists.length === 0 ? (
                    <EmptyState compact title="Nenhum Checklist." />
                  ) : (
                    <div className="grid gap-4">
                      {task.checklists.map((group) => {
                        const countable = group.items.filter(
                          (item) =>
                            item.parentItemId === undefined &&
                            item.converted === undefined,
                        );
                        const done = countable.filter((item) => item.done).length;
                        return (
                          <section key={group.id}>
                            <ReguaDeSecao
                              rotulo={group.name}
                              acao={
                                <span className="app-meta app-numero shrink-0">
                                  {countable.length === 0
                                    ? "sem item contável"
                                    : `${done} de ${countable.length}`}
                                </span>
                              }
                            />
                            <ul className="pilha-solta">
                              {group.items
                                .filter((item) => item.parentItemId === undefined)
                                .map((item) => (
                                  <li
                                    key={item.id}
                                    className="item-solto"
                                    data-estatico="true"
                                    data-atenuado={
                                      item.done || item.converted ? "true" : undefined
                                    }
                                  >
                                    {item.converted ? (
                                      <>
                                        <span
                                          className="app-base line-through"
                                          style={{ color: "var(--texto-3)" }}
                                        >
                                          {item.text}
                                        </span>
                                        <Pilula tom="neutro">convertido</Pilula>
                                        <Link
                                          href={`/estrutura/tarefas/${item.converted.taskId}`}
                                          className="app-sm underline"
                                          style={{ color: "var(--texto)" }}
                                        >
                                          abrir Subtarefa
                                        </Link>
                                      </>
                                    ) : (
                                      <>
                                        <input
                                          type="checkbox"
                                          disabled={!editavel}
                                          id={`item-${item.id}`}
                                          checked={item.done}
                                          onChange={(event) =>
                                            report(
                                              run((data, memberId) =>
                                                setChecklistItemDone(
                                                  data,
                                                  memberId,
                                                  task.id,
                                                  group.id,
                                                  item.id,
                                                  event.target.checked,
                                                ),
                                              ),
                                              event.target.checked
                                                ? "Item concluído."
                                                : "Item reaberto.",
                                            )
                                          }
                                          className="size-4 accent-[var(--acento)]"
                                        />
                                        <label
                                          htmlFor={`item-${item.id}`}
                                          className={
                                            item.done
                                              ? "app-base line-through"
                                              : "app-base"
                                          }
                                          style={{
                                            color: item.done
                                              ? "var(--texto-3)"
                                              : "var(--texto)",
                                          }}
                                        >
                                          {item.text}
                                        </label>
                                        {item.assigneeMemberId ? (
                                          <span className="app-meta">
                                            {
                                              state.members.find(
                                                (m) =>
                                                  m.id === item.assigneeMemberId,
                                              )?.displayName
                                            }
                                          </span>
                                        ) : null}
                                        {editavel ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openConversion(group.id, item.id)
                                            }
                                            className="btn btn-sutil btn-sm ml-auto shrink-0"
                                            style={{ color: "var(--erro)" }}
                                          >
                                            Converter em Subtarefa
                                          </button>
                                        ) : null}
                                      </>
                                    )}
                                  </li>
                                ))}
                            </ul>

                            <form
                              className="mt-2 flex gap-2"
                              onSubmit={(event) => {
                                event.preventDefault();
                                const text = newItem[group.id] ?? "";
                                report(
                                  run((data, memberId) =>
                                    addChecklistItem(
                                      data,
                                      memberId,
                                      task.id,
                                      group.id,
                                      text,
                                    ),
                                  ),
                                  "Item acrescentado.",
                                );
                                setNewItem((current) => ({
                                  ...current,
                                  [group.id]: "",
                                }));
                              }}
                            >
                              <label
                                className="sr-only"
                                htmlFor={`novo-item-${group.id}`}
                              >
                                Novo Item em {group.name}
                              </label>
                              <input
                                id={`novo-item-${group.id}`}
                                value={newItem[group.id] ?? ""}
                                onChange={(event) =>
                                  setNewItem((current) => ({
                                    ...current,
                                    [group.id]: event.target.value,
                                  }))
                                }
                                placeholder="Acrescentar Item"
                                className="campo flex-1"
                              />
                              <Button
                                variant="secondary"
                                type="submit"
                                disabled={
                                  (newItem[group.id] ?? "").trim() === "" ||
                                  !editavel
                                }
                                disabledReason={
                                  !editavel
                                    ? (escritaRecusada ??
                                      "Esta Tarefa não está ativa.")
                                    : "Escreva o Item antes de acrescentar."
                                }
                              >
                                Acrescentar
                              </Button>
                            </form>
                          </section>
                        );
                      })}
                    </div>
                  )}

                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      report(
                        run((data, memberId) =>
                          addChecklist(data, memberId, task.id, newChecklist),
                        ),
                        "Checklist acrescentado.",
                      );
                      setNewChecklist("");
                    }}
                  >
                    <label className="sr-only" htmlFor="novo-checklist">
                      Novo Checklist
                    </label>
                    <input
                      id="novo-checklist"
                      value={newChecklist}
                      onChange={(event) => setNewChecklist(event.target.value)}
                      placeholder="Nome do novo Checklist"
                      className="campo flex-1"
                    />
                    <Button
                      variant="secondary"
                      type="submit"
                      disabled={newChecklist.trim() === "" || !editavel}
                      disabledReason={
                        !editavel
                          ? (escritaRecusada ?? "Esta Tarefa não está ativa.")
                          : "Dê um nome ao Checklist."
                      }
                    >
                      Novo Checklist
                    </Button>
                  </form>
                </div>
              </section>
            ) : null}
            {config.features.subtarefas ? (
              <section>
                <ReguaDeSecao rotulo="Subtarefas" contagem={filhas.length} />
                <div>
                  {filhas.length === 0 ? (
                    <EmptyState compact title="Nenhuma Subtarefa." />
                  ) : (
                    <ul className="pilha-solta">
                      {filhas.map((child) => {
                        const situacao = statusDefinition(
                          state,
                          child.listId,
                          child.statusId,
                        );
                        return (
                          <li key={child.id}>
                            <Link
                              href={`/estrutura/tarefas/${child.id}`}
                              className="item-solto"
                            >
                              <span
                                className="app-base min-w-0 flex-1 truncate"
                                style={{ color: "var(--texto)" }}
                              >
                                {child.title}
                              </span>
                              {situacao ? (
                                <Pilula cor={situacao.color} className="shrink-0">
                                  {situacao.name}
                                </Pilula>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {level >= state.workspace.maxSubtaskDepth ? (
                    <p className="app-meta mt-2">
                      Limite de {state.workspace.maxSubtaskDepth} níveis de
                      Subtarefa, definido no Espaço de Trabalho.
                    </p>
                  ) : (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const result = run((data, memberId) =>
                          createTask(data, memberId, {
                            listId: task.listId,
                            title: newSubtask,
                            parentTaskId: task.id,
                          }),
                        );
                        if (result.ok) {
                          setError(null);
                          setNotice(`Subtarefa criada: ${result.value.title}.`);
                          setNewSubtask("");
                        } else {
                          setNotice(null);
                          setError(result.error);
                        }
                      }}
                    >
                      <label className="sr-only" htmlFor="nova-subtarefa">
                        Nova Subtarefa
                      </label>
                      <input
                        id="nova-subtarefa"
                        value={newSubtask}
                        onChange={(event) => setNewSubtask(event.target.value)}
                        placeholder="Título da nova Subtarefa"
                        className="campo flex-1"
                      />
                      <Button
                        variant="secondary"
                        type="submit"
                        disabled={newSubtask.trim() === "" || !editavel}
                        disabledReason={
                          !editavel
                            ? (escritaRecusada ?? "Esta Tarefa não está ativa.")
                            : "Escreva o título antes de criar."
                        }
                      >
                        Nova Subtarefa
                      </Button>
                    </form>
                  )}
                </div>
              </section>
            ) : null}

            <section>
              <ReguaDeSecao rotulo="Dependências" contagem={task.dependencies.length} />
              {config.features.dependencias ? (
                <TaskDependencies
                  task={task}
                  report={report}
                  readOnly={!editavel}
                />
              ) : (
                <p className="app-meta px-1">Esta Lista não usa Dependências.</p>
              )}
            </section>

            <section>
              <ReguaDeSecao rotulo="Recorrência" />
              {config.features.recorrencia ? (
                <TaskRecurrence
                  key={
                    task.recurrence ? JSON.stringify(task.recurrence) : "sem"
                  }
                  task={task}
                  report={report}
                  readOnly={!editavel}
                />
              ) : (
                <p className="app-meta px-1">Esta Lista não usa Recorrência.</p>
              )}
            </section>

            <section>
              <ReguaDeSecao rotulo="Vínculos" contagem={vinculos.length} />
              {vinculos.length === 0 ? (
                <EmptyState compact title="Nenhum Vínculo." />
              ) : (
                <ul className="pilha-solta">
                  {vinculos.map((link) => {
                    const otherType =
                      link.fromId === task.id ? link.toType : link.fromType;
                    const otherId =
                      link.fromId === task.id ? link.toId : link.fromId;
                    const label =
                      otherType === "deal"
                        ? state.deals.find((d) => d.id === otherId)?.title
                        : otherType === "contact"
                          ? state.contacts.find((c) => c.id === otherId)
                              ?.firstName
                          : otherType === "conversation"
                            ? state.conversations.find(
                                (c) => c.id === otherId,
                              )?.title
                            : undefined;
                    const href =
                      otherType === "deal"
                        ? `/crm/negocios/${otherId}`
                        : otherType === "contact"
                          ? `/crm/contatos/${otherId}`
                          : otherType === "conversation"
                            ? `/crm/caixa-de-entrada/${otherId}`
                            : undefined;
                    /*
                      O alvo pode ter sido eliminado: mostrar o identificador
                      interno no lugar do nome não diz nada a ninguém.
                    */
                    const conteudo = (
                      <span
                        className="app-base min-w-0 flex-1 truncate"
                        style={{ color: "var(--texto)" }}
                      >
                        <span style={{ color: "var(--texto-3)" }}>
                          {OBJECT_TYPE_LABEL[otherType] ?? otherType} ·{" "}
                        </span>
                        {label === undefined ? (
                          <span style={{ color: "var(--texto-3)" }}>
                            registro não encontrado
                          </span>
                        ) : (
                          label
                        )}
                      </span>
                    );
                    return (
                      <li key={link.id}>
                        {label !== undefined && href ? (
                          <Link href={href} className="item-solto">
                            {conteudo}
                          </Link>
                        ) : (
                          <span className="item-solto" data-estatico="true">
                            {conteudo}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <ReguaDeSecao rotulo="Anexos" contagem={task.attachments.length} />
              <TaskAttachments
                task={task}
                report={report}
                readOnly={!editavel}
              />
            </section>

            <section>
              <ReguaDeSecao rotulo="Observadores" contagem={task.observerMemberIds.length} />
                {editavel ? (
                  <TaskWatchers task={task} report={report} />
                ) : task.observerMemberIds.length === 0 ? (
                  <EmptyState compact title="Ninguém observa esta Tarefa." />
                ) : (
                  <p className="app-base" style={{ color: "var(--texto)" }}>
                    {task.observerMemberIds
                      .map(
                        (id) =>
                          state.members.find((m) => m.id === id)?.displayName ??
                          id,
                      )
                      .join(", ")}
                  </p>
                )}
            </section>
          </div>
        </div>
      </CorpoDeTela>

        {/* ───────────────────────── à direita: a Atividade ───────────────── */}
        <aside
          className="flex min-h-0 w-full shrink-0 flex-col max-h-[var(--conversa-empilhada-h)] @4xl:w-[26rem] @4xl:max-h-none"
          style={{ borderLeft: "1px solid var(--linha)", background: "var(--superficie-rebaixada)" }}
        >
          <CabecalhoDePainel
            titulo="Atividade"
            contagem={task.comments.filter((c) => !c.deletedAt).length + activity.length}
            className="shrink-0"
          />
          <TaskComments
            task={task}
            report={report}
            authorLabel={(actor) => authorLabel(state, actor)}
            readOnly={!comenta}
            antes={
              <details className="mb-3 rounded-[var(--r-painel)] px-3 py-2" style={{ background: "var(--superficie-1)", border: "1px solid var(--linha)" }}>
                <summary className="app-meta flex cursor-pointer items-center gap-2">
                  <Icone de={History} tamanho="xs" />
                  Registro de Atividade
                  <span className="app-numero">{activity.length}</span>
                </summary>
                <div className="mt-2">
                {activity.length === 0 ? (
                  <EmptyState compact title="Nenhum Registro de Atividade nesta Tarefa." />
                ) : (
                  <ul className="pilha-solta">
                    {activity.slice(0, ACTIVITY_PAGE_SIZE).map((record) => (
                      <li
                        key={record.id}
                        className="item-solto app-base"
                        data-bloco="true"
                        data-estatico="true"
                        style={{ color: "var(--texto)" }}
                      >
                        <span style={{ color: "var(--texto-3)" }}>
                          {fmt.relative(record.at)}
                        </span>{" "}
                        · {authorLabel(state, record.actor)}
                        {record.delegate
                          ? ` em nome de ${authorLabel(state, record.delegate)}`
                          : ""}{" "}
                        · {record.action}
                        {record.before || record.after ? (
                          <span style={{ color: "var(--texto-3)" }}>
                            {" "}
                            ({record.before ?? "—"} → {record.after ?? "—"})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {activity.length > ACTIVITY_PAGE_SIZE ? (
                  <p className="app-meta app-numero mt-2">
                    Mostrando {ACTIVITY_PAGE_SIZE} de {activity.length}.{" "}
                    <Link href="/configuracoes/auditoria" className="underline">
                      Ver tudo na Auditoria
                    </Link>
                    .
                  </p>
                ) : null}
                </div>
              </details>
            }
          />
        </aside>
      </div>
      </div>
    </div>
  );
}

/** O ícone de cada tipo de Campo, na lista compacta. */
function iconeDeCampo(tipo: string): LucideIcon {
  switch (tipo) {
    case "number":
    case "currency":
    case "percent":
      return Hash;
    case "date":
      return CalendarDays;
    case "checkbox":
      return SquareCheck;
    case "singleSelect":
    case "multiSelect":
      return ListChecks;
    case "person":
      return UserRound;
    case "file":
      return Paperclip;
    case "url":
      return Link2;
    case "email":
      return Mail;
    case "phone":
      return Phone;
    default:
      return Type;
  }
}

/** O valor de um Campo como se lê: moeda, porcentagem, data, nome da pessoa, sim/não, lista. */
function valorDeCampo(state: DataState, fmt: Formatters, tipo: string, valor: unknown): ReactNode {
  if (valor === undefined || valor === null || valor === "") return <span style={{ color: "var(--texto-4)" }}>—</span>;
  if (tipo === "checkbox") return valor === true ? "Sim" : "Não";
  if (tipo === "currency" && typeof valor === "number") return fmt.money({ amount: valor, currency: "BRL" });
  if (tipo === "number" && typeof valor === "number") return fmt.number(valor);
  if (tipo === "percent" && typeof valor === "number") return fmt.number(valor) + "%";
  if (tipo === "date" && typeof valor === "string") return fmt.civilDate(valor);
  if (tipo === "dateTime" && typeof valor === "string") return fmt.instant(valor);
  if (tipo === "person" && typeof valor === "string") {
    return state.members.find((m) => m.id === valor)?.displayName ?? state.agents.find((a) => a.id === valor)?.name ?? valor;
  }
  if (Array.isArray(valor)) return valor.map(String).join(", ");
  return String(valor);
}
/** B48 — the subitems migrate with the conversion and leave the origin checklist. */
function subitemsOf(
  items: readonly { readonly id: string; readonly parentItemId?: string }[],
  itemId: string,
): number {
  return items.filter((item) => item.parentItemId === itemId).length;
}

/**
 * A linha rótulo→valor da ficha no molde da `RecordRow`, para o que ela não
 * hospeda: rótulo que é `<label>`, editor com menu flutuante (o `truncate`
 * dela cortaria o menu) e valor que precisa quebrar linha.
 */
function Attribute({
  label,
  children,
}: {
  readonly label: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="app-meta shrink-0">{label}</dt>
      <dd className="app-base min-w-0 text-right" style={{ color: "var(--texto)" }}>
        {children}
      </dd>
    </div>
  );
}

/** A6.2 — every recorded action shows the actor and, when present, the delegate. */
function authorLabel(state: DataState, actor: ActorRef): string {
  if (actor.kind === "member") {
    return (
      state.members.find((m) => m.id === actor.id)?.displayName ??
      "Membro removido"
    );
  }
  if (actor.kind === "agent") {
    return `${state.agents.find((a) => a.id === actor.id)?.name ?? "Agente eliminado"} (Agente)`;
  }
  if (actor.kind === "automation") {
    return `${state.automations.find((a) => a.id === actor.id)?.name ?? "Automação"} (Automação)`;
  }
  return ACTOR_KIND_LABEL[actor.kind] ?? actor.kind;
}
