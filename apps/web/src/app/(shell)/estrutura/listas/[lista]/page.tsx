"use client";

/**
 * T10 — Lista. Four Visualizações over the same collection of Tasks.
 *
 * The Quadro columns ARE the definitions of the effective Status Set, in order,
 * coloured by category (RN-LIS-05, A4.3). Dragging changes the status through
 * the same operation the panel uses, so the List functionalities are enforced.
 */

import Link from "next/link";
import { Briefcase, MessageSquare } from "lucide-react";
import { use, useState, type ReactNode } from "react";
import { useData, useRun, useRunConfirmado, useSession } from "@/dados/store";
import {
  checklistProgress,
  containerAdminRefusal,
  effectiveLifecycleOfList,
  memberReachesContainer,
  effectiveListConfig,
  effectiveLifecycleOfTask,
  isBlocked,
  isOverdue,
  isTerminalCategory,
  statusCategory,
  statusDefinition,
  subtaskProgress,
} from "@n1/dominio/derive";
import {
  applyView,
  changeTaskStatus,
  createTask,
  listWriteRefusal,
  TAREFA_SEM_CONTATO,
} from "@n1/dominio/operations";
import { canaisDaLista, contatoDaTarefa, listaSemCanais } from "@n1/dominio/derive-conversacional";
import { LISTA_SEM_CANAIS } from "@n1/dominio/operations/canais";
import { CHANNEL_ICON } from "@/features/crm/conversation-thread";
import { PRIORITY_LABEL, STATUS_CATEGORY_LABEL, CHANNEL_TYPE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TASK_PANEL_PARAM, TaskPanel, useTaskPanel } from "@/features/estrutura/task-panel";
import { NovaTarefaConversacionalDialog } from "@/features/estrutura/nova-tarefa-conversacional-dialog";
import {
  MoveTaskDialog,
  useMoveTaskDialog,
} from "@/features/estrutura/move-task-dialog";
import {
  CargaDeTrabalho,
  LinhaDoTempo,
} from "@/features/estrutura/planning-views";
import {
  NewTaskFromTemplateDialog,
  SaveTemplateDialog,
} from "@/features/estrutura/template-dialogs";
import { FILTRO_VAZIO, ViewBar } from "@/features/estrutura/view-bar";
import { BotaoDeMais, CompositorNoGrupo } from "@/features/estrutura/novo-no-grupo";
import { SeletorDeTipoDeTarefa } from "@/features/estrutura/seletor-de-tipo";
import { useRecente } from "@/features/shell/recente";
import { TabelaDeTarefas } from "@/features/estrutura/tabela-de-tarefas";
import { IniciarConversaDialog } from "@/features/crm/iniciar-conversa-dialog";
import {
  BulkStatusBar,
  RunScheduledButton,
} from "@/features/estrutura/bulk-status-bar";
import { RelatorioDeLotePainel } from "@/features/estrutura/relatorio-de-lote";
import {
  applyFinanceFilters,
  FILTROS_INICIAIS,
  FinanceCards,
  FinanceIndicators,
  financeProfileOf,
  FinanceTable,
  FinanceToolbar,
  type FinanceFilters,
} from "@/features/estrutura/financeiro/contas-view";
import { SerieDeParcelasDialog } from "@/features/estrutura/financeiro/serie-dialog";
import { dealOfTask, QuadroNegocios } from "@/features/estrutura/quadro-negocios";
import { CartaoDeTarefa } from "@/features/estrutura/cartao-de-tarefa";
import { valorDaConta, type FinanceProfile } from "@/features/estrutura/financeiro/lens";
import { ColunaDeQuadro, VazioDaColuna } from "@/features/shell/quadro";
import { DealScreen } from "@/features/crm/deal-screen";
import { ContaDrawer } from "@/features/estrutura/financeiro/conta-drawer";
import { MEUS_NEGOCIOS_ID } from "@n1/dominio/seed-comercial";
import {
  Abas,
  ActionMenu,
  BarraDeFiltros,
  Button,
  CategoryDot,
  CorpoDeTela,
  Icone,
  ConditionMarker,
  EmptyState,
  PageHeader,
  Pilula,
  ReguaDeSecao,
  RolagemNoTopo,
  SidePanel,
  StateSeal,
} from "@/features/shell/ui";
import type { DataState } from "@n1/dominio/state";
import type { OperationResult } from "@n1/dominio";
import type { Task, View, ViewFilters } from "@n1/dominio/types";
import type { RelatorioDeLote } from "@n1/dominio/operations/lote";

type ViewKind =
  "lista" | "quadro" | "calendario" | "tabela" | "linha" | "carga";
const VIEW_LABEL: Record<ViewKind, string> = {
  lista: "Lista",
  quadro: "Quadro",
  calendario: "Calendário",
  tabela: "Tabela",
  linha: "Linha do tempo",
  carga: "Carga",
};

export default function ListaPage({
  params,
}: {
  params: Promise<{ lista: string }>;
}) {
  const { lista } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();
  const runConfirmado = useRunConfirmado();
  // A Visualização padrão da Lista abre aplicada; o resto parte do vazio.
  const padrao = state.views.find(
    (v) => v.listId === lista && v.ownerKind === "container" && v.isDefault,
  );
  const [view, setView] = useState<ViewKind>(() =>
    padrao?.kind === "linhaDoTempo"
      ? "linha"
      : padrao?.kind === "quadro" ||
          padrao?.kind === "calendario" ||
          padrao?.kind === "tabela" ||
          padrao?.kind === "carga"
        ? padrao.kind
        : "lista",
  );
  const [newTitle, setNewTitle] = useState("");
  /* O Tipo da Tarefa que a BARRA DO TOPO vai criar. Nasce indefinido e o
     seletor o reconduz ao padrão da Lista — o mesmo que o domínio usaria se
     ninguém escolhesse. Cada compositor de grupo guarda o dele: uma escolha
     feita aqui não governa o "+" de um grupo, nem o contrário. */
  const [novoTipo, setNovoTipo] = useState<string | undefined>(undefined);
  const [criandoConta, setCriandoConta] = useState(false);
  // "Iniciar conversa" (lado do CRM de Meus negócios): a Etapa vem do "+" do grupo.
  const [iniciandoConversa, setIniciandoConversa] = useState<{ readonly stageId?: string } | null>(null);
  // "Nova Tarefa" da Lista conversacional (C35): o Status vem do "+" do grupo.
  const [novaConversacional, setNovaConversacional] = useState<{ readonly statusId?: string } | null>(null);
  const [criandoSerie, setCriandoSerie] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [financeFilters, setFinanceFilters] =
    useState<FinanceFilters>(FILTROS_INICIAIS);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [criandoDeModelo, setCriandoDeModelo] = useState(false);
  const [filters, setFilters] = useState<ViewFilters>(
    padrao?.filters ?? FILTRO_VAZIO,
  );
  const [sortBy, setSortBy] = useState<View["sortBy"] | undefined>(
    padrao?.sortBy,
  );
  const [activeViewId, setActiveViewId] = useState<string | null>(
    padrao?.id ?? null,
  );
  const [selecao, setSelecionadas] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [selecionando, setSelecionando] = useState(false);
  const { memberId } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    taskId?: string;
  } | null>(null);
  /*
   * O relatório de um lote (Plan 03-13) NÃO pode morar dentro de
   * `BulkStatusBar`: na lente financeira aquela barra só é montada enquanto
   * `selecionando && selecionadas.size > 0` — um lote 100% bem-sucedido
   * esvazia a seleção, desmonta a barra, e o relatório sumiria no mesmo
   * instante em que passa a ser a única prova do que aconteceu. Pior no caso
   * `parcial`: as contas parciais mudaram de Status e podem sair do filtro
   * corrente, saindo também de `selecionadas` (a seleção só vale para o que
   * está na tela) — o relato mais importante seria o mais fácil de perder.
   * Por isso a página guarda o relatório à parte, fora de qualquer
   * condicional de seleção.
   */
  const [relatorioDeLote, setRelatorioDeLote] = useState<{
    readonly relatorio: RelatorioDeLote;
    readonly nomeDoStatus: string;
  } | null>(null);
  const { openTaskId, openTask, closeTask } = useTaskPanel();
  const query = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // O popup da Tarefa abre o diálogo de mover pela URL; a Lista só o hospeda.
  const { movingTaskId, closeMove } = useMoveTaskDialog();

  // B38a — a Lista que o Membro não alcança não existe para ele.
  const list = state.lists.find(
    (l) =>
      l.id === lista && memberReachesContainer(state, memberId, "list", l.id),
  );
  const config = list ? effectiveListConfig(state, list.id) : null;

  if (!list || !config) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Lista não encontrada" />
        <CorpoDeTela>
          <EmptyState
            title="Lista não encontrada."
            hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la."
          />
        </CorpoDeTela>
      </div>
    );
  }

  const effective = effectiveLifecycleOfList(state, list.id);
  const restrictedBy =
    effective !== list.lifecycle ? config.path.at(-2) : undefined;
  const administra = containerAdminRefusal(state, memberId, "list", list.id);
  // Quem não cria Tarefa aqui (Convidado) vê o porquê antes do clique.
  // No lado do CRM da Pasta "Meus negócios" não nasce Tarefa: o Negócio nasce em Negócios.
  const criacaoRecusada =
    pathname.startsWith("/crm/") && config.path.some((node) => node.type === "folder" && node.id === MEUS_NEGOCIOS_ID)
      ? "Um Negócio nasce em Negócios; esta é a cópia do Funil."
      : listaSemCanais(state, list.id)
        ? LISTA_SEM_CANAIS
        : listWriteRefusal(state, memberId, list.id);
  const reportar = (
    result: { ok: boolean; error?: string },
    message: string,
  ) => {
    if (result.ok) {
      setError(null);
      setNotice({ text: message });
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };

  // As Listas do Financeiro (Contas a pagar, Contas a receber) têm a lente
  // financeira: pelo id da Lista, não pelo nome de um Tipo.
  const lente = financeProfileOf(list.id);
  const financeira = lente !== undefined;
  // Lista da Pasta "Meus negócios": cópia do Funil, não sincronizada. Ela tem
  // dois lados. No CRM (/crm/meus-negocios/…) mostra os NEGÓCIOS espelhados —
  // o que abre a conversa, o contato, o roteiro. Na Estrutura mostra só as
  // TAREFAS (a call, o que se faz), como qualquer outra Lista.
  const pastaDeNegocios = config.path.some(
    (node) => node.type === "folder" && node.id === MEUS_NEGOCIOS_ID,
  );
  const noCrm = pathname.startsWith("/crm/");
  // O Status da Lista espelhada guarda a Etapa: st_<lista>_<etapa>. Ganho e
  // Perdido não são Etapa — um lead não começa ganho.
  const etapaDoStatus = (statusId: string): string | undefined => {
    const etapa = statusId.replace(`st_${list.id}_`, "");
    return etapa === "ganho" || etapa === "perdido" ? undefined : etapa;
  };
  const espelhoComercial = pastaDeNegocios && noCrm;
  // C35 — a Lista conversacional: cada Tarefa nasce de um Contato. A
  // precedência das lentes é financeira > espelhoComercial > conversacional:
  // o espelho é o caso particular (conversacional COM Negócio obrigatório) e
  // guarda a barra "Iniciar conversa"; o que segue vale para a conversacional
  // pura (Pós-venda) e para o lado da Estrutura das Listas de "Meus negócios".
  const conversacional = list.modeloDeTarefa === "conversacional";
  const conversacionalPura = conversacional && !espelhoComercial;
  const pedidaPelaUrl = query.get("nova-tarefa") !== null;
  const todas = state.tasks
    .filter(
      (task) => task.listId === list.id && task.parentTaskId === undefined,
    )
    .filter((task) => effectiveLifecycleOfTask(state, task.id) !== "naLixeira")
    .filter((task) => !pastaDeNegocios || (task.provenance?.kind === "deal") === noCrm);
  const tarefaAberta = openTaskId ? todas.find((t) => t.id === openTaskId) : undefined;
  const negocioAberto =
    espelhoComercial && tarefaAberta?.provenance?.kind === "deal" ? dealOfTask(state, tarefaAberta) : undefined;
  // No Quadro do Funil, uma Reunião é a call: abre a tela dela, não um painel.
  const abrirNoQuadro = (taskId: string) => {
    const t = todas.find((x) => x.id === taskId);
    if (t && state.taskTypes.find((x) => x.id === t.taskTypeId)?.name === "Reunião") router.push(`/crm/reunioes/${t.id}`);
    else openTask(taskId);
  };
  // A Visualização filtra o que este Membro já alcança — nunca amplia.
  const filtradas = applyView(state, todas, {
    filters,
    ...(sortBy ? { sortBy } : {}),
  });
  const tasks = financeira
    ? applyFinanceFilters(state, filtradas, financeFilters, new Date())
    : filtradas;
  const filtrando = tasks.length !== todas.length;
  // Quando a tabela é a primeira coisa do corpo, o cabeçalho fixo dela encosta
  // na barra de cima — sem respiro. O que aparecer antes dela traz o seu.
  const tabelaColada = view === "tabela" || (financeira && view === "lista");
  const respiroAntes = tabelaColada ? "pt-3 " : "";
  // A seleção só vale para o que está na tela: mudar um filtro com linhas
  // marcadas não deixa ids invisíveis na barra em lote.
  const selecionadas: ReadonlySet<string> = new Set(
    [...selecao].filter((id) => tasks.some((t) => t.id === id)),
  );
  const filtrosAvancados =
    Object.values(filters).filter(
      (v) => v !== undefined && v !== "" && v !== false,
    ).length + (sortBy ? 1 : 0);

  const definitions = [...config.statusSet.definitions].sort(
    (a, b) => a.order - b.order,
  );
  // O relatório carrega só o `statusId`; o nome é resolvido aqui, uma vez,
  // para `RelatorioDeLotePainel` (que não recebe Tarefa nem Status — T-3-55).
  const aoReceberRelatorio = (relatorio: RelatorioDeLote) => {
    const nomeDoStatus =
      definitions.find((d) => d.id === relatorio.statusId)?.name ?? relatorio.statusId;
    setRelatorioDeLote({ relatorio, nomeDoStatus });
  };

  /* O aviso nomeia o que NASCEU, não a lente da tela: numa Lista do Financeiro
     quem escolhe "Tarefa" no seletor não criou uma "Conta". */
  const nomeDoTipo = (taskTypeId: string) =>
    state.taskTypes.find((t) => t.id === taskTypeId)?.name ?? (financeira ? "Conta" : "Tarefa");

  /* O aviso e o popup usam o id que o SERVIDOR deu (checklist E1): o da cópia
     local é de outro registro quando a ponte gravou no mesmo instante. */
  const aoConfirmarCriacao = (confirmado: OperationResult<Task>) => {
    if (!confirmado.ok) {
      setNotice(null);
      setError(confirmado.error);
      return;
    }
    setNotice({
      text: `${nomeDoTipo(confirmado.value.taskTypeId)} criada: ${confirmado.value.title}.`,
      taskId: confirmado.value.id,
    });
    if (financeira) openTask(confirmado.value.id);
  };

  const create = () => {
    if (!newTitle.trim()) return;
    const { local: result, confirmado } = runConfirmado((data, memberId) =>
      createTask(data, memberId, {
        listId: list.id,
        title: newTitle.trim(),
        ...(novoTipo ? { taskTypeId: novoTipo } : {}),
      }),
    );
    if (result.ok) {
      setNewTitle("");
      setError(null);
      setCriandoConta(false);
      // A Tarefa nova pode nascer fora da Visualização em uso (o Calendário só
      // desenha Tarefas com data): o aviso nomeia e dá o caminho para abri-la.
      // Uma conta nasce só com o nome; Valor, Vencimento e Forma se editam no
      // popup (que é a Tarefa completa), sem sair da Lista.
      void confirmado.then(aoConfirmarCriacao);
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  // A barra de criação de conta abre por dois caminhos — o botão "Nova conta"
  // (estado) e o "+" da árvore (`?nova-tarefa=1`). Cancelar desfaz os dois:
  // só o estado, e a URL segurava a barra aberta.
  const fecharCriacao = () => {
    setCriandoConta(false);
    setNewTitle("");
    // Desistir apaga a escolha junto com o título: uma escolha viva e sem
    // campo à vista voltaria a valer na próxima criação, sem ninguém pedir.
    setNovoTipo(undefined);
    if (pedidaPelaUrl) {
      const next = new URLSearchParams(query.toString());
      next.delete("nova-tarefa");
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  };

  // Na Lista conversacional o "+" da árvore (`?nova-tarefa=1`) abre o diálogo,
  // não um campo de título: o pedido da URL vale como o clique no botão.
  const dialogoConversacional = conversacionalPura && effective === "ativo" && (novaConversacional !== null || pedidaPelaUrl);
  const fecharNovaConversacional = () => {
    setNovaConversacional(null);
    if (pedidaPelaUrl) fecharCriacao();
  };
  // A Tarefa nasceu: o popup dela abre no lugar do diálogo. Uma só troca de
  // URL, porque `openTask` preservaria o `nova-tarefa` e o diálogo voltaria.
  const abrirTarefaCriada = (taskId: string) => {
    const next = new URLSearchParams(query.toString());
    next.delete("nova-tarefa");
    next.set(TASK_PANEL_PARAM, taskId);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  // O "+" de um grupo: a Tarefa nasce já naquele Status. A conta do Financeiro
  // nasce só com o nome e abre no popup, onde Valor, Vencimento e Forma se editam.
  const criarNoGrupo = (title: string, statusId?: string, taskTypeId?: string): boolean => {
    const { local: result, confirmado } = runConfirmado((data, memberId) =>
      createTask(data, memberId, {
        listId: list.id,
        title,
        ...(statusId ? { statusId } : {}),
        ...(taskTypeId ? { taskTypeId } : {}),
      }),
    );
    if (result.ok) {
      setError(null);
      void confirmado.then(aoConfirmarCriacao);
      return true;
    }
    setNotice(null);
    setError(result.error);
    return false;
  };
  /* O seletor do Tipo, quando a Lista enxerga mais de um: a mesma peça na
     barra do topo e no compositor de cada grupo. Ele se apaga sozinho (devolve
     `null`) onde não há escolha — numa Lista com um Tipo só, a barra fica como
     sempre foi. */
  const seletorDeTipo = (valor: string | undefined, aoEscolher: (taskTypeId: string) => void) => (
    <SeletorDeTipoDeTarefa state={state} listId={list.id} value={valor} onChange={aoEscolher} />
  );
  // Numa Lista conversacional NUNCA há compositor por título: o "+" abre o
  // diálogo com o Status daquele grupo (`onMais`), e a Tarefa nasce do Contato.
  const criaNoGrupo = effective === "ativo" && !conversacional ? criarNoGrupo : undefined;
  const maisConversacional =
    conversacionalPura && effective === "ativo" ? { onMais: (statusId: string) => setNovaConversacional({ statusId }) } : {};

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          espelhoComercial ? (
            <>
              <Link href="/crm/negocios" className="hover:underline">
                Negócios
              </Link>
              {" › "}
              <Link href="/crm/meus-negocios" className="hover:underline">
                Meus negócios
              </Link>
              {" › "}
              {list.name}
            </>
          ) : (
            config.path.map((node, index) => (
              <span key={node.id}>
                {index > 0 ? " › " : ""}
                {node.type === "list" ? (
                  node.name
                ) : (
                  <Link
                    href={
                      node.type === "space"
                        ? `/estrutura/espacos/${node.id}`
                        : `/estrutura/pastas/${node.id}`
                    }
                    className="hover:underline"
                  >
                    {node.name}
                  </Link>
                )}
              </span>
            ))
          )
        }
        title={list.name}
        {...(espelhoComercial || conversacionalPura
          ? {
              // O espelho leva a maleta do Negócio; a conversacional, o balão da conversa.
              icon: (
                <span
                  aria-hidden="true"
                  className="grid place-items-center rounded-[var(--r-controle)]"
                  style={{ width: "var(--controle-h-sm)", height: "var(--controle-h-sm)", background: "var(--acento-lavado)", color: "var(--acento)" }}
                >
                  <Icone de={espelhoComercial ? Briefcase : MessageSquare} tamanho="sm" />
                </span>
              ),
            }
          : {})}
        seal={<StateSeal state={effective} />}
        meta={
          lente
            ? `${todas.length} ${todas.length === 1 ? "conta" : "contas"}`
            : espelhoComercial
              ? (() => {
                  const abertas = todas.filter((t) => !isTerminalCategory(statusCategory(state, t)));
                  const valor = fmt.money({
                    amount: abertas.reduce((sum, t) => sum + (dealOfTask(state, t)?.value?.amount ?? 0), 0),
                    currency: "BRL",
                  });
                  return `${abertas.length} ${abertas.length === 1 ? "aberto" : "abertos"} · ${valor} em valor declarado`;
                })()
              : conversacionalPura
                ? (() => {
                    // Quantas pessoas, não quantos Vínculos: duas Tarefas do mesmo Contato contam um.
                    const contatos = new Set(todas.map((t) => contatoDaTarefa(state, t)?.id).filter(Boolean)).size;
                    return `${todas.length} ${todas.length === 1 ? "Tarefa" : "Tarefas"} · ${contatos} ${contatos === 1 ? "Contato" : "Contatos"}`;
                  })()
                : `${todas.length} ${todas.length === 1 ? "Tarefa" : "Tarefas"}`
        }
        {...(espelhoComercial || conversacional || list.plannedPeriod?.start
          ? {
              details: (
                <span className="app-meta flex flex-wrap items-center gap-3">
                  {conversacional ? (
                    // C36 — por onde esta Lista atende: o tipo e a conta, na ordem marcada.
                    canaisDaLista(state, list.id).length > 0 ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span>Atende por</span>
                        {canaisDaLista(state, list.id).map((ch) => {
                          const IconeDoCanal = CHANNEL_ICON[ch.channelType];
                          return (
                            <Pilula key={ch.id} tom="neutro" className="gap-1.5" title={`${CHANNEL_TYPE_LABEL[ch.channelType]} · ${ch.externalId}`}>
                              <IconeDoCanal className="size-[var(--icone-xs)] shrink-0" aria-hidden="true" />
                              {ch.name}
                            </Pilula>
                          );
                        })}
                      </span>
                    ) : (
                      <span role="status" style={{ color: "var(--aviso)" }}>
                        {LISTA_SEM_CANAIS.replace(" configure-os nas Configurações da Lista.", "")}{" "}
                        <Link href={`/estrutura/listas/${list.id}/configuracoes`} className="underline">
                          Configurar os canais
                        </Link>
                        .
                      </span>
                    )
                  ) : null}
                  {espelhoComercial ? (
                    <span>
                      Cópia do Funil “{list.name}”: mover aqui não move o Negócio em{" "}
                      <Link href="/crm/negocios" className="underline">
                        Negócios
                      </Link>
                      .
                    </span>
                  ) : null}
                  {list.plannedPeriod?.start ? (
                    <span>
                      Período planejado:{" "}
                      {fmt.taskDate({
                        form: "civilDay",
                        value: list.plannedPeriod.start,
                      })}
                      {list.plannedPeriod.end
                        ? ` a ${fmt.taskDate({ form: "civilDay", value: list.plannedPeriod.end })}`
                        : ""}
                    </span>
                  ) : null}
                </span>
              ),
            }
          : {})}
        actions={
          <>
            <Link
              href={`/estrutura/listas/${list.id}/configuracoes`}
              className="btn btn-contorno btn-sm"
            >
              Configurações
            </Link>
            {lente?.kind === "receber" && effective === "ativo" ? (
              <Button
                size="sm"
                onClick={() => setCriandoSerie(true)}
                disabled={criacaoRecusada !== undefined}
                disabledReason={criacaoRecusada ?? ""}
              >
                Nova série de parcelas
              </Button>
            ) : null}
            {lente && effective === "ativo" ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setCriandoConta(true)}
                disabled={criacaoRecusada !== undefined}
                disabledReason={criacaoRecusada ?? ""}
              >
                {lente.labels.nova}
              </Button>
            ) : null}
            <ActionMenu
              items={[
                {
                  label: "Salvar como modelo",
                  onSelect: () => setSalvandoModelo(true),
                  ...(administra ? { disabledReason: administra } : {}),
                },
              ]}
            />
          </>
        }
      />
      <SaveTemplateDialog
        kind="lista"
        sourceId={list.id}
        open={salvandoModelo}
        onClose={() => setSalvandoModelo(false)}
        report={reportar}
      />
      <NewTaskFromTemplateDialog
        listId={list.id}
        open={criandoDeModelo}
        onClose={() => setCriandoDeModelo(false)}
        onCreated={(taskId, title) =>
          setNotice({ text: `Tarefa criada: ${title}.`, taskId })
        }
        report={reportar}
      />

      {restrictedBy ? (
        <p
          className="app-base shrink-0 px-4 py-2"
          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}
        >
          {effective === "arquivado" ? "Arquivada" : "Na lixeira"} porque{" "}
          {restrictedBy.type === "space" ? "o Espaço" : "a Pasta"}{" "}
          <em>{restrictedBy.name}</em> está{" "}
          {effective === "arquivado" ? "arquivado" : "na lixeira"}.
        </p>
      ) : null}

      {lente ? (
        <div className="shrink-0 px-4 pb-2 pt-3">
          <FinanceIndicators
            state={state}
            profile={lente}
            tasks={todas}
            active={financeFilters.grupo}
            onPick={(grupo) => setFinanceFilters({ ...financeFilters, grupo })}
          />
        </div>
      ) : null}

      <Abas
        rotulo="Visualizações"
        abas={(["lista", "quadro", "calendario", "tabela", "linha", "carga"] as const)
          // A Carga é da gestão de projetos; a Lista financeira mostra as cinco do mockup.
          .filter((kind) => !financeira || kind !== "carga")
          // Carga e Linha do tempo são da gestão de projetos: a Lista conversacional não planeja esforço.
          .filter((kind) => !conversacional || (kind !== "carga" && kind !== "linha"))
          .map((kind) => ({ chave: kind, rotulo: VIEW_LABEL[kind] }))}
        ativa={view}
        aoTrocar={(chave) => setView(chave as ViewKind)}
      />

      {effective === "ativo" && espelhoComercial ? (
        <BarraDeFiltros>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIniciandoConversa({})}
            icon={<Icone de={MessageSquare} tamanho="xs" />}
            disabled={criacaoRecusada !== undefined}
            disabledReason={criacaoRecusada ?? ""}
          >
            Iniciar conversa
          </Button>
          <span className="app-meta">Escolha o Contato, a Etapa em que o lead está e o Canal — e o chat abre.</span>
        </BarraDeFiltros>
      ) : null}

      {effective === "ativo" && conversacionalPura ? (
        // C35 — sem campo de título: a Tarefa nasce do Contato, no diálogo.
        <BarraDeFiltros>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setNovaConversacional({})}
            icon={<Icone de={MessageSquare} tamanho="xs" />}
            disabled={criacaoRecusada !== undefined}
            disabledReason={criacaoRecusada ?? ""}
          >
            Nova Tarefa
          </Button>
          <span className="app-meta">Escolha o Contato e o Canal — a Tarefa nasce com a conversa dele.</span>
          <Button size="sm" disabled disabledReason={TAREFA_SEM_CONTATO}>
            De modelo
          </Button>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelecionando((v) => !v);
              setSelecionadas(new Set());
              if (view !== "lista") setView("lista");
            }}
            aria-pressed={selecionando}
            disabled={criacaoRecusada !== undefined}
            disabledReason={criacaoRecusada ?? ""}
          >
            {selecionando ? "Sair da seleção" : "Selecionar várias"}
          </Button>
          <RunScheduledButton listId={list.id} report={reportar} />
        </BarraDeFiltros>
      ) : null}

      {effective === "ativo" &&
      !espelhoComercial &&
      !conversacional &&
      (!financeira || criandoConta || pedidaPelaUrl) ? (
        <BarraDeFiltros>
          <label className="sr-only" htmlFor="nova-tarefa">
            {financeira ? "Nome da nova conta" : "Título da nova Tarefa"}
          </label>
          <SeletorDeTipoDeTarefa state={state} listId={list.id} value={novoTipo} onChange={setNovoTipo} />
          <input
            id="nova-tarefa"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") create();
              if (event.key === "Escape" && financeira) fecharCriacao();
            }}
            placeholder={lente ? lente.labels.novaPlaceholder : "Nova Tarefa"}
            // O "+" da árvore chega aqui com `?nova-tarefa=1`: o campo já
            // recebe o foco, senão o atalho para no meio do caminho.
            autoFocus={query.get("nova-tarefa") !== null || criandoConta}
            className="campo min-w-48 flex-1"
            style={{ height: "var(--controle-h-sm)", maxWidth: "28rem" }}
          />
          <Button
            size="sm"
            variant="primary"
            onClick={create}
            disabled={!newTitle.trim() || criacaoRecusada !== undefined}
            disabledReason={
              criacaoRecusada ?? "Escreva o título da Tarefa."
            }
          >
            Criar
          </Button>
          <Button
            size="sm"
            onClick={() => setCriandoDeModelo(true)}
            disabled={criacaoRecusada !== undefined}
            disabledReason={criacaoRecusada ?? ""}
          >
            De modelo
          </Button>
          {financeira ? (
            <Button size="sm" variant="ghost" onClick={fecharCriacao}>
              Cancelar
            </Button>
          ) : (
            <>
              <span className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelecionando((v) => !v);
                  setSelecionadas(new Set());
                  if (view !== "lista") setView("lista");
                }}
                aria-pressed={selecionando}
                disabled={criacaoRecusada !== undefined}
                disabledReason={criacaoRecusada ?? ""}
              >
                {selecionando ? "Sair da seleção" : "Selecionar várias"}
              </Button>
              <RunScheduledButton listId={list.id} report={reportar} />
            </>
          )}
        </BarraDeFiltros>
      ) : null}

      {financeira && effective === "ativo" ? (
        <BarraDeFiltros>
          {selecionando && selecionadas.size > 0 ? (
            <>
              <span className="flex-1">
                <BulkStatusBar
                  tasks={tasks}
                  definitions={definitions}
                  selected={selecionadas}
                  onSelect={setSelecionadas}
                  onClear={() => setSelecionadas(new Set())}
                  onRelatorio={aoReceberRelatorio}
                  report={reportar}
                />
              </span>
              <Button
                size="sm"
                onClick={() => {
                  setSelecionando(false);
                  setSelecionadas(new Set());
                }}
              >
                Sair da seleção
              </Button>
            </>
          ) : (
            <FinanceToolbar
              listId={list.id}
              profile={lente}
              filters={financeFilters}
              onFilters={setFinanceFilters}
              onOpenFilters={() => setFiltrosAbertos((v) => !v)}
              filtrosAvancados={filtrosAvancados}
              selecionando={selecionando}
              onToggleSelecionar={() => {
                setSelecionando((v) => !v);
                setSelecionadas(new Set());
                if (view !== "lista") setView("lista");
              }}
              report={reportar}
            />
          )}
        </BarraDeFiltros>
      ) : null}

      <CorpoDeTela semRespiro={tabelaColada}>
        {relatorioDeLote ? (
          <div className={`${respiroAntes}mb-4`}>
            <RelatorioDeLotePainel
              relatorio={relatorioDeLote.relatorio}
              nomeDoStatus={relatorioDeLote.nomeDoStatus}
              onFechar={() => setRelatorioDeLote(null)}
              onAbrirConta={openTask}
            />
          </div>
        ) : null}

        {selecionando && !financeira ? (
          <div className={`${respiroAntes}mb-4`}>
            <BulkStatusBar
              tasks={tasks}
              definitions={definitions}
              selected={selecionadas}
              onSelect={setSelecionadas}
              onClear={() => setSelecionadas(new Set())}
              onRelatorio={aoReceberRelatorio}
              report={reportar}
            />
          </div>
        ) : null}

        <div
          className={
            financeira && !filtrosAbertos && filtrosAvancados === 0
              ? "hidden"
              : `${respiroAntes}mb-4`
          }
        >
          <ViewBar
            listId={list.id}
            filters={filters}
            sortBy={sortBy}
            onFilters={(next) => {
              setFilters(next);
              setActiveViewId(null);
            }}
            onSort={(next) => {
              setSortBy(next);
              setActiveViewId(null);
            }}
            activeViewId={activeViewId}
            onOpenView={(view) => {
              setActiveViewId(view?.id ?? null);
              setFilters(view?.filters ?? FILTRO_VAZIO);
              setSortBy(view?.sortBy);
            }}
            report={reportar}
            {...(financeira ? { panelOpen: filtrosAbertos } : {})}
          />
          {filtrando ? (
            <p className="app-meta mt-2">
              Mostrando {tasks.length} de {todas.length} Tarefa(s) — o filtro
              vale em todas as Visualizações.
            </p>
          ) : null}
        </div>

        {notice ? (
          <p
            role="status"
            className={`${respiroAntes}app-base mb-4 rounded-[var(--r-controle)] px-3 py-2`}
            style={{ background: "var(--sucesso-lavado)", color: "var(--sucesso)" }}
          >
            {notice.text}
            {notice.taskId ? (
              <>
                {" "}
                <Link
                  href={`/estrutura/tarefas/${notice.taskId}`}
                  className="underline"
                >
                  Abrir
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className={`${respiroAntes}app-base mb-4 rounded-[var(--r-controle)] px-3 py-2`}
            style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}
          >
            {error}
          </p>
        ) : null}

        <div key={view} className="aparecer">
        {tasks.length === 0 && (!financeira || todas.length === 0) ? (
          filtrando ? (
            <EmptyState
              title="Nenhuma Tarefa passa por este filtro."
              hint={`${todas.length} Tarefa(s) nesta Lista ficam fora dele. Limpe o filtro para vê-las.`}
            />
          ) : lente ? (
            <EmptyState
              title={lente.labels.semContas}
              hint={`Use “${lente.labels.nova}” para lançar a primeira.`}
            />
          ) : (
            <EmptyState title="Nenhuma Tarefa nesta Lista ainda." />
          )
        ) : view === "quadro" && conversacional ? (
          // O quadro de cartões com rosto: o de Negócio no espelho, o
          // conversacional na Lista pura. Só o espelho soma dinheiro na coluna.
          <QuadroNegocios
            state={state}
            tasks={tasks}
            definitions={definitions}
            onError={setError}
            openTask={abrirNoQuadro}
            comValor={espelhoComercial}
            {...(criacaoRecusada ? { criacaoRecusada } : {})}
            {...(espelhoComercial && effective === "ativo" ? { onMais: (statusId: string) => setIniciandoConversa({ stageId: etapaDoStatus(statusId) }) } : {})}
            {...maisConversacional}
          />
        ) : view === "quadro" ? (
          <Quadro
            state={state}
            tasks={tasks}
            definitions={definitions}
            onError={setError}
            openTask={openTask}
            {...(lente ? { financeiro: lente } : {})}
            {...(criaNoGrupo ? { onCreateInGroup: criaNoGrupo, seletorDeTipo } : {})}
            {...(criacaoRecusada ? { criacaoRecusada } : {})}
          />
        ) : view === "calendario" ? (
          <Calendario state={state} tasks={tasks} openTask={openTask} />
        ) : view === "tabela" ? (
          <Tabela state={state} tasks={tasks} />
        ) : view === "linha" ? (
          <LinhaDoTempo
            state={state}
            tasks={tasks}
            openTask={openTask}
            editavel={effective === "ativo" && criacaoRecusada === undefined}
            report={(result, message) => {
              if (result.ok) {
                setError(null);
                setNotice({ text: message });
              } else {
                setNotice(null);
                setError(
                  result.error ?? "Não foi possível concluir a operação.",
                );
              }
            }}
          />
        ) : view === "carga" ? (
          <CargaDeTrabalho state={state} tasks={tasks} openTask={openTask} />
        ) : lente ? (
          <>
            <div className="hidden sm:block">
              <FinanceTable
                state={state}
                profile={lente}
                tasks={tasks}
                grupoFiltrado={financeFilters.grupo}
                {...(criaNoGrupo ? { onCreateInGroup: criaNoGrupo, seletorDeTipo } : {})}
                {...(criacaoRecusada ? { criacaoRecusada } : {})}
                definitions={definitions}
                selected={selecionadas}
                selecionando={selecionando}
                onToggle={(id) =>
                  setSelecionadas((atual) => {
                    const next = new Set(atual);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onToggleMany={(ids, on) =>
                  setSelecionadas((atual) => {
                    const next = new Set(atual);
                    for (const id of ids)
                      if (on) next.add(id);
                      else next.delete(id);
                    return next;
                  })
                }
                openTask={openTask}
                report={reportar}
              />
            </div>
            <div className="sm:hidden">
              <FinanceCards state={state} profile={lente} tasks={tasks} openTask={openTask} />
            </div>
          </>
        ) : (
          // A Lista de Tarefas é a mesma tabela do Financeiro: grupos por Status,
          // colunas, ações rápidas no hover e o menu de mover — só mudam as palavras.
          <TabelaDeTarefas
            state={state}
            tasks={tasks}
            definitions={definitions}
            openTask={openTask}
            filters={filters}
            report={reportar}
            selecionando={selecionando}
            rotulo={espelhoComercial ? "Negócio" : "Tarefa"}
            conversacional={conversacional}
            {...(espelhoComercial && effective === "ativo" ? { onMais: (statusId: string) => setIniciandoConversa({ stageId: etapaDoStatus(statusId) }) } : {})}
            {...maisConversacional}
            {...(criaNoGrupo ? { onCreateInGroup: criaNoGrupo, seletorDeTipo } : {})}
            {...(criacaoRecusada ? { criacaoRecusada } : {})}
            {...(selecionando
              ? {
                  selected: selecionadas,
                  onToggle: (id: string) =>
                    setSelecionadas((atual) => {
                      const next = new Set(atual);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    }),
                  onToggleMany: (ids: readonly string[], on: boolean) =>
                    setSelecionadas((atual) => {
                      const next = new Set(atual);
                      for (const id of ids) if (on) next.add(id); else next.delete(id);
                      return next;
                    }),
                }
              : {})}
          />
        )}
        </div>
      </CorpoDeTela>

      {lente?.kind === "receber" ? (
        <SerieDeParcelasDialog
          open={criandoSerie}
          onClose={() => setCriandoSerie(false)}
          onCreated={(tasks, cliente) => {
            // As novas nascem "para receber": um filtro de cartão as esconderia.
            setFinanceFilters(FILTROS_INICIAIS);
            setError(null);
            setNotice({
              text: `${tasks.length} conta(s) a receber criada(s) para ${cliente}, em “A receber”.`,
              ...(tasks[0] ? { taskId: tasks[0].id } : {}),
            });
          }}
        />
      ) : null}
      {espelhoComercial && iniciandoConversa ? (
        <IniciarConversaDialog
          listId={list.id}
          open
          {...(iniciandoConversa?.stageId ? { stageId: iniciandoConversa.stageId } : {})}
          onClose={() => setIniciandoConversa(null)}
          onDone={(text) => {
            setIniciandoConversa(null);
            setNotice({ text });
          }}
        />
      ) : null}
      {/* Renderizado sempre e controlado por `open`, como na Caixa de Entrada e
          na ficha do Contato: a saída de `--dur-1` anima (COMPONENTES.md). A
          `key` é a Lista — o diálogo parte dos props a cada abertura, então o
          Status do "+" do grupo vale sem remontar (remontar ao fechar perderia a saída). */}
      {conversacionalPura ? (
        <NovaTarefaConversacionalDialog
          key={list.id}
          listId={list.id}
          open={dialogoConversacional}
          {...(novaConversacional?.statusId ? { statusId: novaConversacional.statusId } : {})}
          onClose={fecharNovaConversacional}
          onDone={(text, taskId) => {
            // A Tarefa nasceu com a conversa: o popup dela abre no lugar do diálogo.
            setNovaConversacional(null);
            setError(null);
            setNotice({ text, taskId });
            abrirTarefaCriada(taskId);
          }}
        />
      ) : null}
      {financeira ? (
        <ContaDrawer
          key={openTaskId ?? "fechado"}
          taskId={openTaskId}
          onClose={closeTask}
          report={reportar}
        />
      ) : negocioAberto ? (
        // O card do Funil abre o Negócio (contato, conversa, roteiro), não a
        // Tarefa que o espelha: é o dado do lead que o Comercial veio ver.
        <SidePanel title={negocioAberto.title} open onClose={closeTask} wide bare>
          <DealScreen
            dealId={negocioAberto.id}
            embedded={{
              path: (
                <>
                  {config.path.map((node, index) => (
                    <span key={node.id}>
                      {index > 0 ? " › " : ""}
                      {node.name}
                    </span>
                  ))}
                </>
              ),
              onClose: closeTask,
            }}
          />
        </SidePanel>
      ) : (
        <TaskPanel taskId={openTaskId} onClose={closeTask} />
      )}
      <MoveTaskDialog
        taskId={movingTaskId}
        onClose={closeMove}
        onDone={(text) => {
          // A Tarefa foi para outra Lista: o popup dela fecha, e o aviso fica à vista.
          closeTask();
          setNotice({ text });
        }}
      />
    </div>
  );
}

type Definition = NonNullable<
  ReturnType<typeof effectiveListConfig>
>["statusSet"]["definitions"][number];

function TaskRow({
  state,
  task,
  onOpen,
  recente = false,
}: {
  readonly state: DataState;
  readonly task: Task;
  readonly onOpen: (taskId: string) => void;
  /** É a peça do último resultado: acende por --dur-realce (`data-recente`). */
  readonly recente?: boolean;
}) {
  const fmt = useFormat();
  const checklist = checklistProgress(task);
  const subtasks = subtaskProgress(state, task.id);
  const overdue = isOverdue(state, task, new Date());
  const blocked = isBlocked(state, task);
  const own = task.lifecycle;

  // A3 — opens the side panel over the List instead of leaving the collection;
  // the panel itself offers "abrir em página cheia" for the addressable record.
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className="item-solto w-full text-left"
      data-alinhamento="topo"
      data-recente={recente ? "true" : undefined}
      style={{ paddingBlock: "var(--e-2)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="app-base truncate" style={{ color: "var(--texto)" }}>
          {task.title}
        </p>
        <p className="app-meta mt-0.5 flex flex-wrap items-center gap-2">
          {task.readableId ? (
            <span className="identificador">{task.readableId}</span>
          ) : null}
          {task.dueDate ? (
            <span>vence {fmt.taskDate(task.dueDate)}</span>
          ) : null}
          {task.priority !== "semPrioridade" ? (
            <span>{PRIORITY_LABEL[task.priority]}</span>
          ) : null}
          {task.tagIds.map((id) => {
            const tag = state.tags.find((t) => t.id === id);
            return tag ? (
              <Pilula key={id} cor={tag.color}>
                {tag.name}
              </Pilula>
            ) : null;
          })}
          {checklist ? (
            <span>
              checklist {checklist.done}/{checklist.total}
            </span>
          ) : null}
          {subtasks ? (
            <span>
              subtarefas {subtasks.done}/{subtasks.total}
            </span>
          ) : null}
          {overdue ? (
            <ConditionMarker tone="danger">Vencida</ConditionMarker>
          ) : null}
          {blocked ? (
            <ConditionMarker tone="warning">Bloqueada</ConditionMarker>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {own !== "ativo" ? <StateSeal state={own} /> : null}
        <span className="app-meta">
          {task.assignees.length > 0
            ? `${task.assignees.length} responsável(is)`
            : "sem Responsável"}
        </span>
      </div>
    </button>
  );
}

/**
 * O Quadro das Listas operacionais — e das Contas (Financeiro) — no quadro
 * padrão (`features/shell/quadro.tsx`): a mesma coluna e a mesma anatomia de
 * cartão do quadro de Negócios (fim de 2026-09-23: "tudo que for quadro, a
 * visualização deve ser igual à da segunda imagem"). Numa Lista financeira a
 * coluna soma o valor das Contas e o cartão destaca o valor.
 */
function Quadro({
  state,
  tasks,
  definitions,
  onError,
  openTask,
  financeiro,
  onCreateInGroup,
  seletorDeTipo,
  criacaoRecusada,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly definitions: readonly Definition[];
  readonly onError: (message: string | null) => void;
  readonly openTask: (taskId: string) => void;
  /** A lente financeira da Lista: a coluna soma e o cartão destaca o valor. */
  readonly financeiro?: FinanceProfile;
  /** O "+" da coluna: a Tarefa nasce naquele Status. */
  readonly onCreateInGroup?: (title: string, statusId: string, taskTypeId?: string) => boolean;
  readonly seletorDeTipo?: (valor: string | undefined, aoEscolher: (taskTypeId: string) => void) => ReactNode;
  readonly criacaoRecusada?: string;
}) {
  const run = useRun();
  const fmt = useFormat();
  const [dragging, setDragging] = useState<string | null>(null);
  const recente = useRecente();
  const [criandoEm, setCriandoEm] = useState<string | null>(null);
  const motivoDoMais = onCreateInGroup ? criacaoRecusada : (criacaoRecusada ?? "Esta Lista não recebe Tarefas novas.");

  const drop = (statusId: string) => {
    if (!dragging) return;
    const result = run((data, memberId) =>
      changeTaskStatus(data, memberId, dragging, statusId),
    );
    onError(result.ok ? null : result.error);
    setDragging(null);
  };

  return (
    <RolagemNoTopo>
      <div className="flex gap-4">
        {definitions.map((definition) => {
          const group = tasks.filter((task) => task.statusId === definition.id);
          const soma = financeiro ? group.reduce((total, task) => total + valorDaConta(task), 0) : 0;
          return (
            <ColunaDeQuadro
              key={definition.id}
              contagem={group.length}
              nome={definition.name}
              cor={definition.color}
              onDrop={() => drop(definition.id)}
              mais={
                <BotaoDeMais
                  rotulo={definition.name}
                  aberto={criandoEm === definition.id}
                  onClick={() => setCriandoEm((atual) => (atual === definition.id ? null : definition.id))}
                  {...(motivoDoMais ? { motivo: motivoDoMais } : {})}
                />
              }
              subtitulo={`${STATUS_CATEGORY_LABEL[definition.category] ?? definition.category}${financeiro ? ` · ${fmt.money({ amount: soma, currency: "BRL" })}` : ""}`}
            >
              {criandoEm === definition.id && onCreateInGroup ? (
                <CompositorNoGrupo
                  placeholder={`Nova em ${definition.name}`}
                  onCreate={(title, taskTypeId) => onCreateInGroup(title, definition.id, taskTypeId)}
                  seletor={seletorDeTipo}
                  onCancel={() => setCriandoEm(null)}
                />
              ) : null}
              {group.length === 0 ? (
                <VazioDaColuna
                  texto={`Nenhuma Tarefa em “${definition.name}”.`}
                  {...(onCreateInGroup && !motivoDoMais ? { onCriar: () => setCriandoEm(definition.id) } : {})}
                />
              ) : (
                group.map((task) => (
                  <CartaoDeTarefa
                    key={task.id}
                    state={state}
                    task={task}
                    {...(financeiro ? { financeiro } : {})}
                    onOpen={() => openTask(task.id)}
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => setDragging(null)}
                    recente={task.id === recente}
                  />
                ))
              )}
            </ColunaDeQuadro>
          );
        })}
      </div>
      <p className="app-meta mt-3">
        Arrastar altera o Status. As validações da Lista continuam valendo: a
        coluna recusa a Tarefa quando a Funcionalidade exige Subtarefas ou
        Checklists concluídos.
      </p>
    </RolagemNoTopo>
  );
}

function Calendario({
  state,
  tasks,
  openTask,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly openTask: (taskId: string) => void;
}) {
  const fmt = useFormat();
  const recente = useRecente();
  const withDates = tasks.filter((task) => task.dueDate);
  const without = tasks.length - withDates.length;

  if (withDates.length === 0) {
    return (
      <EmptyState
        title="Nenhuma Tarefa com data nesta Lista."
        hint="O Calendário posiciona Tarefas por Data; um dia civil não recebe fuso."
      />
    );
  }

  const byDate = new Map<string, Task[]>();
  for (const task of withDates) {
    const key = task.dueDate?.value.slice(0, 10) ?? "";
    byDate.set(key, [...(byDate.get(key) ?? []), task]);
  }

  return (
    <div>
      {[...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, group]) => (
          <section key={date}>
            <ReguaDeSecao rotulo={fmt.taskDate({ form: "civilDay", value: date })} contagem={group.length} />
            <ul className="cascata pilha-solta">
              {group.map((task) => (
                <li key={task.id}>
                  <TaskRow state={state} task={task} onOpen={openTask} recente={task.id === recente} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      {without > 0 ? (
        <p className="app-meta mt-3">
          {without} Tarefa(s) sem data não aparecem no Calendário.
        </p>
      ) : null}
    </div>
  );
}

function Tabela({
  state,
  tasks,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
}) {
  const fmt = useFormat();
  const recente = useRecente();
  return (
    <div>
      <table className="tabela">
        <thead>
          <tr>
            {[
              "Título",
              "Status",
              "Categoria",
              "Prioridade",
              "Vencimento",
              "Responsáveis",
            ].map((label) => (
              <th key={label} className="app-coluna">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="cascata">
          {tasks.map((task) => {
            const definition = statusDefinition(
              state,
              task.listId,
              task.statusId,
            );
            const category = statusCategory(state, task);
            return (
              <tr key={task.id} data-recente={task.id === recente ? "true" : undefined}>
                <td>
                  <Link
                    href={`/estrutura/tarefas/${task.id}`}
                    className="app-md hover:underline"
                    style={{ color: "var(--texto)" }}
                  >
                    {task.title}
                  </Link>
                </td>
                <td>
                  {definition ? (
                    <CategoryDot
                      color={definition.color}
                      label={definition.name}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ color: "var(--texto-3)" }}>
                  {category ? STATUS_CATEGORY_LABEL[category] : "—"}
                  {isTerminalCategory(category) ? "" : ""}
                </td>
                <td style={{ color: "var(--texto-3)" }}>
                  {PRIORITY_LABEL[task.priority]}
                </td>
                <td style={{ color: "var(--texto-3)" }}>
                  {task.dueDate ? fmt.taskDate(task.dueDate) : "—"}
                </td>
                <td style={{ color: "var(--texto-3)" }}>
                  {task.assignees.length === 0
                    ? "—"
                    : task.assignees
                        .map((assignee) =>
                          assignee.kind === "member"
                            ? state.members.find((m) => m.id === assignee.id)
                                ?.displayName
                            : state.agents.find((a) => a.id === assignee.id)
                                ?.name,
                        )
                        .filter(Boolean)
                        .join(", ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
