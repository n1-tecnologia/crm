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
import { DialogoFluxoManual, fluxoManualRecusado } from "@/features/tarefa/fluxo-manual-dialog";
import { DialogoLancamentoNoOmie, lancamentoNoOmieRecusado } from "@/features/tarefa/lancamento-no-omie-dialog";
import { PainelDeDecisaoDaTarefa, PilulaDaConferencia } from "@/features/tarefa/painel-conferencia-do-resumo";
import { Timeline } from "@/features/tarefa/timeline";
import { CabecalhoDaAtividade, FeedDeAtividade, type FiltroDaAtividade } from "@/features/tarefa/feed-de-atividade";
import { PainelDeAnexos } from "@/features/tarefa/anexos";
import { useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Flag,
  Hash,
  Hourglass,
  Link2,
  ListChecks,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  Radio,
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
import { SeletorDeTipoDeTarefa } from "@/features/estrutura/seletor-de-tipo";
import { financeProfileOf, valorDaConta } from "@/features/estrutura/financeiro/lens";
import { CHANNEL_ICON, ConversationThread } from "@/features/crm/conversation-thread";
import { ContactAvatar } from "@/features/crm/contact-card";
import { marcarSeMuda, useNavegar } from "@/features/shell/navegacao";
import { useData, useRun, useSession } from "@/dados/store";
import {
  actorLabel,
  checklistProgress,
  contactDisplayName,
  containerAdminRefusal,
  effectiveListConfig,
  effectiveLifecycleOfTask,
  isBlocked,
  isOverdue,
  memberReachesContainer,
  memberSeesTask,
  principalCompanyId,
  spawnedOccurrenceOf,
  statusDefinition,
  subtaskProgress,
  terminalStatusBlockReason,
  taskLevel,
  taskCommentRefusal,
  taskWriteRefusal,
} from "@n1/dominio/derive";
import {
  canalDaTarefa,
  contatoDaTarefa,
  conversaDaTarefa,
  listaConversacional,
  negocioDaTarefa,
  canaisDaListaQueAlcancam,
} from "@n1/dominio/derive-conversacional";
import {
  CHANNEL_CAPABILITIES,
  addChecklist,
  addChecklistItem,
  assignTask,
  changeTaskStatus,
  convertChecklistItem,
  createTask,
  criarNegocioDaTarefa,
  setChecklistItemDone,
  trashTask,
  trocarCanalDaTarefa,
  unassignTask,
  updateTask,
  vincularNegocioATarefa,
  contaSemCliente,
  contaSemResumo,
  guestFieldWriter,
  lancamentoHumanoDe,
  parcelaDuplicada,
  statusOptionRefusal,
  CP,
} from "@n1/dominio/operations";
import {
  ACTOR_KIND_LABEL,
  CHANNEL_TYPE_LABEL,
  CONVERSATION_STATE_LABEL,
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
  cn,
} from "@/features/shell/ui";
import type { DataState } from "@n1/dominio/state";
import type { ActorRef, ChannelType } from "@n1/dominio/types";


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
  const [fluxoManualAberto, setFluxoManualAberto] = useState(false);
  const [lancamentoNoOmieAberto, setLancamentoNoOmieAberto] = useState(false);
  const [buscaDaAtividade, setBuscaDaAtividade] = useState("");
  const [filtroDaAtividade, setFiltroDaAtividade] = useState<FiltroDaAtividade>("tudo");
  const [newChecklist, setNewChecklist] = useState("");
  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const [newSubtask, setNewSubtask] = useState("");
  /* O Tipo da próxima Subtarefa. Vazio até o seletor recondu­zi-lo ao padrão da
     Lista — o mesmo com que a Subtarefa nascia quando não havia escolha. */
  const [tipoDaSubtarefa, setTipoDaSubtarefa] = useState<string | undefined>(undefined);
  const { movingTaskId, openMove, closeMove } = useMoveTaskDialog();
  /*
   * C35 — a ficha conversacional. A aba do fio é livre depois de abrir no
   * Canal da Tarefa (`null` = segue a Tarefa); a Atividade nasce recolhida
   * abaixo do fio e só se abre por inteiro na terceira coluna; o Negócio
   * troca por um editor que a própria linha abre e fecha.
   */
  const [canalDoFio, setCanalDoFio] = useState<ChannelType | null>(null);
  const [atividadeAberta, setAtividadeAberta] = useState(false);
  // O toggle "Atividade N" do cabeçalho da Conversa: empilhada, recolher a
  // Atividade pelo chevron do aside esconde o aside inteiro (e o chevron com
  // ele) — o foco de teclado volta para este botão, que continua no DOM.
  // Nas colunas ele é display:none e o focus() é inócuo.
  const botaoAtividade = useRef<HTMLButtonElement>(null);
  // O aside da Atividade, para o botão que a abre (no cabeçalho da Conversa, empilhada) apontar para ele.
  const idDaAtividade = useId();
  const [editandoNegocio, setEditandoNegocio] = useState(false);
  const [criandoNegocio, setCriandoNegocio] = useState(false);
  const [funilDoNegocio, setFunilDoNegocio] = useState("");
  const [tituloDoNegocio, setTituloDoNegocio] = useState("");
  const [valorDoNegocio, setValorDoNegocio] = useState("");
  const [erroDoNegocio, setErroDoNegocio] = useState<string | null>(null);
  const [navegar] = useNavegar();
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
  // SOL-04 — a Timeline única e o download assinado do anexo só substituem os
  // painéis desta Lista; outras Listas continuam com os dois painéis atuais
  // (02-UI-SPEC.md proíbe redesenho geral da página da Tarefa).
  const ehSolicitacaoDePagamento = task.listId === CP.listId;
  const checklist = checklistProgress(task);
  const subtasks = subtaskProgress(state, task.id);
  const level = taskLevel(state, task);

  /*
   * C35 — o que a Tarefa conversacional lê do CRM, tudo por Vínculo: o
   * Contato, a Conversa (e por ela o Canal) e o Negócio, se houver. Uma
   * Tarefa conversacional SEM Contato cai no layout de sempre com um aviso —
   * o fio não tem com quem ser.
   */
  const conversacional = listaConversacional(state, task.listId);
  const contato = conversacional ? contatoDaTarefa(state, task) : undefined;
  const conversa = contato ? conversaDaTarefa(state, task) : undefined;
  const canal = contato ? canalDaTarefa(state, task) : undefined;
  const negocio = contato ? negocioDaTarefa(state, task) : undefined;
  const fichaConversacional = contato !== undefined;

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
  // A contagem do cabeçalho "Atividade" — e do botão que a abre na ficha empilhada.
  const contagemDaAtividade = task.comments.filter((c) => !c.deletedAt).length + activity.length;

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
        // C35 — os atos do CRM só existem numa Lista conversacional.
        ...(conversacional
          ? [
              {
                label: "Abrir na Caixa de Entrada",
                onSelect: () => {
                  if (conversa) navegar(`/crm/caixa-de-entrada/${conversa.id}`);
                },
                ...(conversa ? {} : { disabledReason: "Esta Tarefa ainda não tem Conversa." }),
              },
              {
                label: "Criar Negócio a partir desta Tarefa",
                onSelect: () => {
                  setFunilDoNegocio("");
                  setTituloDoNegocio(task.title);
                  setValorDoNegocio("");
                  setErroDoNegocio(null);
                  setCriandoNegocio(true);
                },
                ...(somenteLeitura
                  ? { disabledReason: somenteLeitura }
                  : !contato
                    ? { disabledReason: "Esta Tarefa não tem Contato vinculado." }
                    : negocio
                      ? { disabledReason: "Esta Tarefa já tem Negócio vinculado." }
                      : {}),
              },
            ]
          : []),
        {
          label: "Usar fluxo manual",
          onSelect: () => setFluxoManualAberto(true),
          ...(fluxoManualRecusado(state, memberId, task)
            ? { disabledReason: fluxoManualRecusado(state, memberId, task) }
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
      <DialogoFluxoManual
        task={task}
        open={fluxoManualAberto}
        onClose={() => setFluxoManualAberto(false)}
        report={report}
      />
      {task.listId === CP.listId ? (
        <DialogoLancamentoNoOmie
          task={task}
          open={lancamentoNoOmieAberto}
          onClose={() => setLancamentoNoOmieAberto(false)}
          report={report}
        />
      ) : null}
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
      {/* C35 — o Negócio nasce do Contato da Tarefa, na 1ª Etapa do Funil, já vinculado a ela. */}
      {contato ? (
        <ConfirmDialog
          open={criandoNegocio}
          title="Criar Negócio a partir desta Tarefa"
          description={`O Negócio nasce com ${contactDisplayName(contato)} na primeira Etapa do Funil escolhido e fica vinculado a esta Tarefa.`}
          confirmLabel="Criar Negócio"
          wide
          {...(funilDoNegocio === "" ? { confirmDisabledReason: "Escolha o Funil." } : {})}
          onConfirm={() => {
            const result = run((data, me) =>
              criarNegocioDaTarefa(data, me, task.id, {
                funnelId: funilDoNegocio,
                ...(tituloDoNegocio.trim() ? { title: tituloDoNegocio.trim() } : {}),
                ...(valorDoNegocio.trim() ? { value: { amount: Number(valorDoNegocio), currency: "BRL" } } : {}),
              }),
            );
            if (!result.ok) {
              setErroDoNegocio(result.error);
              return;
            }
            setCriandoNegocio(false);
            report(result, `Negócio criado: ${result.value.deal.title}.`);
          }}
          onCancel={() => setCriandoNegocio(false)}
        >
          <div className="grid gap-4">
            {(() => {
              const funis = state.funnels.filter((f) => f.lifecycle === "ativo");
              const funil = funis.find((f) => f.id === funilDoNegocio);
              const primeiraEtapa = funil ? [...funil.stages].sort((a, b) => a.order - b.order)[0] : undefined;
              return (
                <Field
                  label="Funil"
                  required
                  {...(primeiraEtapa ? { hint: `O Negócio nasce na Etapa ${primeiraEtapa.name}.` } : {})}
                >
                  {(id) => (
                    <Select
                      id={id}
                      value={funilDoNegocio}
                      onChange={setFunilDoNegocio}
                      placeholder="Escolha o Funil"
                      options={funis.map((f) => ({ value: f.id, label: f.name }))}
                    />
                  )}
                </Field>
              );
            })()}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título" hint="Vazio, fica o título da Tarefa.">
                {(id) => <TextInput id={id} value={tituloDoNegocio} onChange={setTituloDoNegocio} placeholder={task.title} />}
              </Field>
              <Field label="Valor em reais" hint="Opcional.">
                {(id) => <TextInput id={id} value={valorDoNegocio} onChange={setValorDoNegocio} type="number" />}
              </Field>
            </div>
            {erroDoNegocio ? (
              <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
                {erroDoNegocio}
              </p>
            ) : null}
          </div>
        </ConfirmDialog>
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
          a Atividade fica embaixo, com altura própria. O contêiner tem nome
          (`ficha`) porque o ConversationThread lê a largura dele para saber
          que está empilhado sob a ficha. */}
      <div className="@container/ficha flex min-h-0 flex-1">
      {/*
        Na ficha conversacional empilhada a coluna é quem rola COMO UM TODO
        quando ficha e Conversa não cabem juntas (a Conversa exige o seu
        mínimo; a ficha, o dela): melhor a coluna rolar do que a ficha virar
        uma fresta ou o compositor sumir atrás da Atividade. Nas colunas
        (@4xl) a coluna não rola: cada região rola por si, como sempre.
      */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col @4xl:flex-row",
          fichaConversacional && "overflow-y-auto @4xl:overflow-visible",
        )}
      >
      {/*
        Empilhada, a ficha fica com o que sobra do trilho — mas nunca menos
        que três quartos do mínimo do fio (o Tipo, o título e a descrição):
        abaixo disso é a coluna inteira que rola, não a ficha que some.
      */}
      <CorpoDeTela
        {...(fichaConversacional
          ? { className: "@max-4xl:min-h-[calc(var(--conversa-empilhada-min)*0.75)]" }
          : {})}
      >
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
                  <span className="inline-flex flex-wrap items-center gap-2">
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
                  {/* Fase 6 — o estado da Conferência do Resumo, lido do domínio (só em conta a pagar). */}
                  <PilulaDaConferencia task={task} />
                  </span>
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

          {/* ───────────────────────── o CRM: com quem, por onde, sobre o quê ── */}
          {contato ? (
            <section className="mt-5">
              <ReguaDeSecao rotulo="CRM" />
              <div className="grid gap-x-8 gap-y-0.5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid min-w-0 content-start gap-0.5">
                  <LinhaDeProp
                    icone={UserRound}
                    rotulo="Contato"
                    controle={(() => {
                      // O Identificador que o Canal da Tarefa resolve; sem Canal, o principal.
                      const tipos = canal ? CHANNEL_CAPABILITIES[canal.channelType].resolvesIdentifierTypes : undefined;
                      const candidatos = tipos ? contato.identifiers.filter((i) => tipos.includes(i.type)) : contato.identifiers;
                      const identificador = (candidatos.find((i) => i.principal) ?? candidatos[0])?.displayValue;
                      const qualificacao = state.catalog.find((c) => c.id === contato.qualificationId);
                      const temperatura = state.catalog.find((c) => c.id === contato.temperatureId);
                      const href = `/crm/contatos/${contato.id}`;
                      return (
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <Link
                            href={href}
                            onNavigate={() => marcarSeMuda(href)}
                            className="app-base flex min-w-0 items-center gap-2 hover:underline"
                            style={{ color: "var(--texto)" }}
                          >
                            <ContactAvatar contact={contato} />
                            <span className="truncate">{contactDisplayName(contato)}</span>
                            {identificador ? <span className="app-meta truncate">{identificador}</span> : null}
                          </Link>
                          {qualificacao ? <Pilula tom="neutro">{qualificacao.name}</Pilula> : null}
                          {temperatura ? (
                            <Pilula {...(temperatura.color ? { cor: temperatura.color } : { tom: "neutro" })}>
                              {temperatura.name}
                            </Pilula>
                          ) : null}
                        </span>
                      );
                    })()}
                  />
                  <LinhaDeProp
                    icone={Radio}
                    rotulo="Canal"
                    valor={
                      canal
                        ? (() => {
                            const IconeDoCanal = CHANNEL_ICON[canal.channelType];
                            return (
                              <span className="flex items-center gap-2">
                                <Pilula tom="neutro" className="shrink-0 gap-1.5">
                                  <IconeDoCanal className="size-[var(--icone-xs)] shrink-0" aria-hidden="true" />
                                  {CHANNEL_TYPE_LABEL[canal.channelType]}
                                </Pilula>
                                <span className="truncate">{canal.name}</span>
                              </span>
                            );
                          })()
                        : "Vazio"
                    }
                    editavel={editavel}
                    motivo={somenteLeitura}
                    editor={
                      <span className="block w-64">
                        <Select
                          id="canal-da-tarefa"
                          value={canal?.id ?? ""}
                          onChange={(channelId) => {
                            const result = run((data, me) => trocarCanalDaTarefa(data, me, task.id, channelId));
                            report(result, "Canal alterado.");
                            // O fio segue o novo Canal em vez de ficar na aba anterior.
                            if (result.ok) setCanalDoFio(null);
                          }}
                          placeholder="Escolher o Canal"
                          options={(() => {
                            // C36 — os canais de atendimento da Lista; o atual, se a Lista
                            // deixou de atender por ele, fica à vista mas não se escolhe.
                            const daLista = canaisDaListaQueAlcancam(state, task.listId, contato);
                            const atualFora = canal && !daLista.some((ch) => ch.id === canal.id) ? [canal] : [];
                            return [...atualFora, ...daLista].map((ch) => ({
                              value: ch.id,
                              label: ch.name,
                              detail: CHANNEL_TYPE_LABEL[ch.channelType] ?? ch.channelType,
                              ...(atualFora.includes(ch)
                                ? { disabledReason: "Esta Lista não atende mais por este Canal." }
                                : ch.connection === "desconectada"
                                  ? { disabledReason: `O Canal ${ch.name} está desconectado: escolha outro Canal ou reconecte-o.` }
                                  : {}),
                            }));
                          })()}
                        />
                      </span>
                    }
                  />
                  <LinhaDeProp
                    icone={MessageSquare}
                    rotulo="Conversa"
                    {...(conversa
                      ? {
                          controle: (() => {
                            const href = `/crm/caixa-de-entrada/${conversa.id}`;
                            return (
                              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                <Pilula
                                  tom={conversa.state === "aberta" ? "sucesso" : conversa.state === "pendente" ? "aviso" : "neutro"}
                                  comPonto={conversa.state === "aberta"}
                                >
                                  {CONVERSATION_STATE_LABEL[conversa.state] ?? conversa.state}
                                </Pilula>
                                <span className="app-base truncate" style={{ color: "var(--texto)" }}>
                                  {conversa.assignee ? `atribuída a ${actorLabel(state, conversa.assignee)}` : "sem Atribuído"}
                                </span>
                                <Link
                                  href={href}
                                  onNavigate={() => marcarSeMuda(href)}
                                  className="app-sm shrink-0 underline"
                                  style={{ color: "var(--texto-1)" }}
                                >
                                  Abrir na Caixa de Entrada
                                </Link>
                              </span>
                            );
                          })(),
                        }
                      : { valor: "sem Conversa" })}
                  />
                </div>

                <div className="grid min-w-0 content-start gap-0.5">
                  {(() => {
                    const empresaId = principalCompanyId(state, contato.id);
                    const empresa = state.companies.find((c) => c.id === empresaId);
                    const href = `/crm/empresas/${empresa?.id ?? ""}`;
                    return (
                      <LinhaDeProp
                        icone={Building2}
                        rotulo="Empresa"
                        {...(empresa
                          ? {
                              controle: (
                                <Link
                                  href={href}
                                  onNavigate={() => marcarSeMuda(href)}
                                  className="app-base min-w-0 truncate hover:underline"
                                  style={{ color: "var(--texto)" }}
                                >
                                  {empresa.tradeName}
                                </Link>
                              ),
                            }
                          : { valor: "—" })}
                      />
                    );
                  })()}
                  {(() => {
                    const funilDe = (funnelId: string, stageId: string) => {
                      const funil = state.funnels.find((f) => f.id === funnelId);
                      const etapa = funil?.stages.find((s) => s.id === stageId);
                      return `${funil?.name ?? "—"} › ${etapa?.name ?? "—"}`;
                    };
                    // Os Negócios abertos do Contato — e o vinculado, mesmo já fechado, para a opção não sumir.
                    const abertos = state.deals.filter(
                      (d) => d.lifecycle === "ativo" && d.situation === "aberto" && d.contactLinks.some((l) => l.contactId === contato.id),
                    );
                    const opcoes = [
                      { value: "", label: "Sem Negócio" },
                      ...(negocio && !abertos.some((d) => d.id === negocio.id) ? [negocio] : []).concat(abertos).map((d) => ({
                        value: d.id,
                        label: d.title,
                        detail: funilDe(d.funnelId, d.stageId),
                      })),
                    ];
                    const seletor = (
                      <Select
                        id="negocio-da-tarefa"
                        value={negocio?.id ?? ""}
                        onChange={(dealId) => {
                          report(
                            run((data, me) => vincularNegocioATarefa(data, me, task.id, dealId || null)),
                            dealId ? "Negócio vinculado." : "Negócio desvinculado.",
                          );
                          setEditandoNegocio(false);
                        }}
                        placeholder="Sem Negócio"
                        options={opcoes}
                      />
                    );
                    if (!negocio) {
                      return (
                        <LinhaDeProp
                          icone={Briefcase}
                          rotulo="Negócio"
                          valor="Vazio"
                          editavel={editavel}
                          motivo={somenteLeitura}
                          editor={<span className="block w-72">{seletor}</span>}
                        />
                      );
                    }
                    const href = `/crm/negocios/${negocio.id}`;
                    return (
                      <LinhaDeProp
                        icone={Briefcase}
                        rotulo="Negócio"
                        {...(somenteLeitura ? { motivo: somenteLeitura } : {})}
                        controle={
                          editandoNegocio ? (
                            <>
                              <span className="min-w-0 flex-1">{seletor}</span>
                              <button
                                type="button"
                                onClick={() => setEditandoNegocio(false)}
                                className="btn-icone btn-icone-nu shrink-0"
                                aria-label="Pronto"
                                title="Pronto"
                              >
                                <Icone de={Check} tamanho="xs" style={{ color: "var(--sucesso)" }} />
                              </button>
                            </>
                          ) : (
                            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                              <Link
                                href={href}
                                onNavigate={() => marcarSeMuda(href)}
                                className="app-base min-w-0 truncate hover:underline"
                                style={{ color: "var(--texto)" }}
                              >
                                {negocio.title}
                              </Link>
                              <span className="app-meta truncate">{funilDe(negocio.funnelId, negocio.stageId)}</span>
                              <span className="ml-auto shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditandoNegocio(true)}
                                  disabled={!editavel}
                                  disabledReason={somenteLeitura ?? "Esta Tarefa não está ativa."}
                                >
                                  Trocar
                                </Button>
                              </span>
                            </span>
                          )
                        }
                      />
                    );
                  })()}
                </div>
              </div>
            </section>
          ) : null}

          {/* Os avisos de regra que acompanham o Status. */}
          <div className="mt-2 grid gap-2">
                {conversacional && !contato ? (
                  <p
                    role="status"
                    className="app-base mt-2 rounded-[var(--r-controle)] px-3 py-2"
                    style={AVISO_EM_CAIXA}
                  >
                    Tarefa conversacional sem Contato: vincule um Contato ou mova
                    para uma Lista operacional.
                  </p>
                ) : null}
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
                    (INV-CP-01): peça ao Agente de lançamento, registre o lançamento
                    que você fez no Omie, ou marque a Integração manual.
                    {task.listId === CP.listId && lancamentoHumanoDe(state, task) === undefined
                      ? (() => {
                          const recusado = lancamentoNoOmieRecusado(state, memberId, task);
                          return (
                            <>
                              {" "}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLancamentoNoOmieAberto(true)}
                                {...(recusado ? { disabled: true, disabledReason: recusado } : {})}
                              >
                                Registrar o lançamento que você fez no Omie
                              </Button>
                            </>
                          );
                        })()
                      : null}
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

          {/* Conta a pagar: a Conferência do Resumo (Fase 6); qualquer outra Tarefa: a Aprovação de processo. */}
          <PainelDeDecisaoDaTarefa task={task} fmt={fmt} report={report} />

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
                      className="mt-3 flex flex-wrap items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const result = run((data, memberId) =>
                          createTask(data, memberId, {
                            listId: task.listId,
                            title: newSubtask,
                            parentTaskId: task.id,
                            ...(tipoDaSubtarefa ? { taskTypeId: tipoDaSubtarefa } : {}),
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
                      {/* O Tipo da Subtarefa, quando a Lista enxerga mais de um. */}
                      <SeletorDeTipoDeTarefa
                        id="tipo-da-nova-subtarefa"
                        state={state}
                        listId={task.listId}
                        value={tipoDaSubtarefa}
                        onChange={setTipoDaSubtarefa}
                      />
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
              {ehSolicitacaoDePagamento ? (
                <PainelDeAnexos task={task} report={report} readOnly={!editavel} />
              ) : (
                <TaskAttachments
                  task={task}
                  report={report}
                  readOnly={!editavel}
                />
              )}
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

        {/* ───────────────────────── à direita: a conversa e a Atividade ──── */}
        {/*
          Na ficha conversacional o trilho leva as DUAS regiões: abaixo de @4xl
          elas empilham sob a ficha — o trilho tem a altura do seu conteúdo
          (o fio de Mensagens com `--conversa-empilhada-min`, o Rascunho da IA
          recolhido numa linha, o compositor inteiro) e a ficha fica com o
          resto; a Atividade nasce recolhida e, recolhida, nem ocupa faixa: o
          botão que a abre mora no cabeçalho da Conversa. De @4xl o trilho é a
          segunda coluna, conversa em cima e Atividade recolhida embaixo; de
          @6xl (ou o popup em tela cheia) o trilho se dissolve (`contents`) e
          cada região é uma coluna. Na ficha operacional o trilho não existe:
          a Atividade continua sendo o aside de sempre.
        */}
        <div
          className={cn(
            fichaConversacional
              ? "flex w-full shrink-0 flex-col @4xl:min-h-0 @4xl:w-[28rem] @6xl:contents"
              : "contents",
          )}
        >
        {fichaConversacional && contato ? (
          <section
            aria-label="Conversa"
            className="flex min-h-0 w-full flex-1 flex-col border-[var(--linha)] border-t @4xl:border-t-0 @4xl:border-l @6xl:w-[24rem] @6xl:flex-none"
            style={{ background: "var(--superficie-1)" }}
          >
            <CabecalhoDePainel
              titulo="Conversa"
              className="shrink-0"
              acao={
                // Empilhada, a Atividade recolhida é só este botão; aberta, ela
                // aparece abaixo da Conversa com o cabeçalho e o botão dela.
                <button
                  ref={botaoAtividade}
                  type="button"
                  onClick={() => setAtividadeAberta((aberta) => !aberta)}
                  aria-expanded={atividadeAberta}
                  aria-controls={idDaAtividade}
                  className="app-sm inline-flex items-center gap-1.5 rounded-[var(--r-controle)] px-1.5 py-0.5 transition-colors hover:bg-[var(--superficie-hover)] @4xl:hidden"
                  style={{ color: "var(--texto-2)" }}
                >
                  Atividade
                  <span className="app-meta app-numero">{contagemDaAtividade}</span>
                  <Icone de={atividadeAberta ? ChevronUp : ChevronDown} tamanho="xs" />
                </button>
              }
            />
            {/* Nas colunas, rola só se as partes fixas do fio (abas, Rascunho, compositor) não couberem; empilhada, nada aqui rola — só o fio. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto @max-4xl:overflow-visible">
              <ConversationThread
                contact={contato}
                canalSelecionado={canalDoFio ?? canal?.channelType ?? null}
                onCanalChange={setCanalDoFio}
                flush
              />
            </div>
          </section>
        ) : null}
        <aside
          id={idDaAtividade}
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-[var(--linha)]",
            fichaConversacional
              ? cn(
                  "border-t max-h-[var(--conversa-empilhada-h)] @4xl:max-h-[50%] @4xl:border-l @6xl:w-[20rem] @6xl:max-h-none @6xl:border-t-0",
                  // Empilhada e recolhida, some por inteiro (o botão está no cabeçalho da Conversa).
                  atividadeAberta ? "flex" : "hidden @4xl:flex",
                )
              : "flex border-l max-h-[var(--conversa-empilhada-h)] @4xl:w-[26rem] @4xl:max-h-none",
          )}
          style={{ background: "var(--superficie-rebaixada)" }}
        >
          {ehSolicitacaoDePagamento ? (
            <Timeline task={task} fmt={fmt} readOnly={!comenta} />
          ) : (
          <>
          <CabecalhoDaAtividade
            observadores={task.observerMemberIds?.length ?? 0}
            busca={buscaDaAtividade}
            onBusca={setBuscaDaAtividade}
            filtro={filtroDaAtividade}
            onFiltro={setFiltroDaAtividade}
            {...(fichaConversacional
              ? {
                  acao: (
                    // Recolhida por padrão sob a conversa; na terceira coluna ela é inteira e o botão some.
                    <button
                      type="button"
                      onClick={() => {
                        setAtividadeAberta((aberta) => !aberta);
                        // Empilhada, este botão some com o aside: o foco vai ao toggle do cabeçalho.
                        botaoAtividade.current?.focus();
                      }}
                      aria-expanded={atividadeAberta}
                      aria-label={atividadeAberta ? "Recolher a Atividade" : "Abrir a Atividade"}
                      title={atividadeAberta ? "Recolher a Atividade" : "Abrir a Atividade"}
                      className="btn-icone btn-icone-nu @6xl:hidden"
                    >
                      <Icone de={atividadeAberta ? ChevronUp : ChevronDown} tamanho="xs" />
                    </button>
                  ),
                }
              : {})}
          />
          <div className={cn("flex min-h-0 flex-1 flex-col", fichaConversacional && !atividadeAberta && "hidden @6xl:flex")}>
          <TaskComments
            task={task}
            report={report}
            authorLabel={(actor) => authorLabel(state, actor)}
            readOnly={!comenta}
            busca={buscaDaAtividade}
            ocultarComentarios={filtroDaAtividade === "atividade"}
            antes={
              filtroDaAtividade === "comentarios" ? undefined : (
                <FeedDeAtividade
                  registros={activity}
                  authorLabel={(actor) => authorLabel(state, actor)}
                  timeZone={state.workspace.locale.timezone}
                  busca={buscaDaAtividade}
                />
              )
            }
          />
          </div>
          </>
          )}
        </aside>
        </div>
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
  // Campo de arquivo guarda ids (checklist 7.3): mostra o nome de cada arquivo.
  if (tipo === "file") {
    const brutos = Array.isArray(valor) ? valor.map(String) : [String(valor)];
    return brutos.map((v) => state.files.find((f) => f.id === v)?.name ?? v).join(", ");
  }
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
