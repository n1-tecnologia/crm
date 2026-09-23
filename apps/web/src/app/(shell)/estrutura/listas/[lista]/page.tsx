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
import { use, useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
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
} from "@n1/dominio/operations";
import { PRIORITY_LABEL, STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TaskPanel, useTaskPanel } from "@/features/estrutura/task-panel";
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
  const run = useRun();
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
  const [criandoConta, setCriandoConta] = useState(false);
  // "Iniciar conversa" (lado do CRM de Meus negócios): a Etapa vem do "+" do grupo.
  const [iniciandoConversa, setIniciandoConversa] = useState<{ readonly stageId?: string } | null>(null);
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

  const create = () => {
    if (!newTitle.trim()) return;
    const result = run((data, memberId) =>
      createTask(data, memberId, { listId: list.id, title: newTitle.trim() }),
    );
    if (result.ok) {
      setNewTitle("");
      setError(null);
      setCriandoConta(false);
      // A Tarefa nova pode nascer fora da Visualização em uso (o Calendário só
      // desenha Tarefas com data): o aviso nomeia e dá o caminho para abri-la.
      setNotice({
        text: `${financeira ? "Conta" : "Tarefa"} criada: ${result.value.title}.`,
        taskId: result.value.id,
      });
      // Uma conta nasce só com o nome; Valor, Vencimento e Forma se editam no
      // popup (que é a Tarefa completa), sem sair da Lista.
      if (financeira) openTask(result.value.id);
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
    if (query.get("nova-tarefa") !== null) {
      const next = new URLSearchParams(query.toString());
      next.delete("nova-tarefa");
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  };

  // O "+" de um grupo: a Tarefa nasce já naquele Status. A conta do Financeiro
  // nasce só com o nome e abre no popup, onde Valor, Vencimento e Forma se editam.
  const criarNoGrupo = (title: string, statusId?: string): boolean => {
    const result = run((data, memberId) =>
      createTask(data, memberId, {
        listId: list.id,
        title,
        ...(statusId ? { statusId } : {}),
      }),
    );
    if (result.ok) {
      setError(null);
      setNotice({
        text: `${financeira ? "Conta" : "Tarefa"} criada: ${result.value.title}.`,
        taskId: result.value.id,
      });
      if (financeira) openTask(result.value.id);
      return true;
    }
    setNotice(null);
    setError(result.error);
    return false;
  };
  const criaNoGrupo = effective === "ativo" ? criarNoGrupo : undefined;

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
        {...(espelhoComercial
          ? {
              icon: (
                <span
                  aria-hidden="true"
                  className="grid place-items-center rounded-[var(--r-controle)]"
                  style={{ width: "var(--controle-h-sm)", height: "var(--controle-h-sm)", background: "var(--acento-lavado)", color: "var(--acento)" }}
                >
                  <Icone de={Briefcase} tamanho="sm" />
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
              : `${todas.length} ${todas.length === 1 ? "Tarefa" : "Tarefas"}`
        }
        {...(espelhoComercial || list.plannedPeriod?.start
          ? {
              details: (
                <span className="app-meta flex flex-wrap items-center gap-3">
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
          .map((kind) => ({ chave: kind, rotulo: VIEW_LABEL[kind] }))}
        ativa={view}
        aoTrocar={(chave) => setView(chave as ViewKind)}
      />

      {effective === "ativo" && espelhoComercial ? (
        <BarraDeFiltros>
          <Button size="sm" variant="primary" onClick={() => setIniciandoConversa({})} icon={<Icone de={MessageSquare} tamanho="xs" />}>
            Iniciar conversa
          </Button>
          <span className="app-meta">Escolha o Contato, a Etapa em que o lead está e o Canal — e o chat abre.</span>
        </BarraDeFiltros>
      ) : null}

      {effective === "ativo" &&
      !espelhoComercial &&
      (!financeira || criandoConta || query.get("nova-tarefa") !== null) ? (
        <BarraDeFiltros>
          <label className="sr-only" htmlFor="nova-tarefa">
            {financeira ? "Nome da nova conta" : "Título da nova Tarefa"}
          </label>
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
        ) : view === "quadro" && espelhoComercial ? (
          <QuadroNegocios
            state={state}
            tasks={tasks}
            definitions={definitions}
            onError={setError}
            openTask={abrirNoQuadro}
            {...(criaNoGrupo ? { onCreateInGroup: criaNoGrupo } : {})}
            {...(criacaoRecusada ? { criacaoRecusada } : {})}
            {...(espelhoComercial && effective === "ativo" ? { onMais: (statusId: string) => setIniciandoConversa({ stageId: etapaDoStatus(statusId) }) } : {})}
          />
        ) : view === "quadro" ? (
          <Quadro
            state={state}
            tasks={tasks}
            definitions={definitions}
            listId={list.id}
            onError={setError}
            openTask={openTask}
            {...(criaNoGrupo ? { onCreateInGroup: criaNoGrupo } : {})}
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
                {...(criaNoGrupo ? { onCreateInGroup: criaNoGrupo } : {})}
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
            {...(espelhoComercial && effective === "ativo" ? { onMais: (statusId: string) => setIniciandoConversa({ stageId: etapaDoStatus(statusId) }) } : {})}
            {...(criaNoGrupo ? { onCreateInGroup: criaNoGrupo } : {})}
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
  arrastavel = false,
  recente = false,
}: {
  readonly state: DataState;
  readonly task: Task;
  readonly onOpen: (taskId: string) => void;
  /** No Quadro a peça é arrastada: lift e arraste brigam, então ela não sobe. */
  readonly arrastavel?: boolean;
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
      className={
        arrastavel
          ? "card-negocio flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
          : "item-solto w-full text-left"
      }
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

function Quadro({
  state,
  tasks,
  definitions,
  listId,
  onError,
  openTask,
  onCreateInGroup,
  criacaoRecusada,
}: {
  readonly state: DataState;
  readonly tasks: readonly Task[];
  readonly definitions: readonly Definition[];
  readonly listId: string;
  readonly onError: (message: string | null) => void;
  readonly openTask: (taskId: string) => void;
  /** O "+" da coluna: a Tarefa nasce naquele Status. */
  readonly onCreateInGroup?: (title: string, statusId: string) => boolean;
  readonly criacaoRecusada?: string;
}) {
  const run = useRun();
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
      <div className="flex items-start gap-3">
        {definitions.map((definition) => {
          const group = tasks.filter((task) => task.statusId === definition.id);
          return (
            <div
              key={definition.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => drop(definition.id)}
              className="trilho flex w-72 shrink-0 flex-col p-2"
            >
              <h2 className="mb-1 flex items-center gap-2 px-1 pt-1">
                <CategoryDot color={definition.color} label={definition.name} />
                <span className="app-meta app-numero flex-1">{group.length}</span>
                <BotaoDeMais
                  rotulo={definition.name}
                  aberto={criandoEm === definition.id}
                  onClick={() => setCriandoEm((atual) => (atual === definition.id ? null : definition.id))}
                  {...(motivoDoMais ? { motivo: motivoDoMais } : {})}
                />
              </h2>
              <p className="app-coluna mb-2 px-1">
                {STATUS_CATEGORY_LABEL[definition.category]}
              </p>
              {criandoEm === definition.id && onCreateInGroup ? (
                <CompositorNoGrupo
                  className="mb-2"
                  placeholder={`Nova em ${definition.name}`}
                  onCreate={(title) => onCreateInGroup(title, definition.id)}
                  onCancel={() => setCriandoEm(null)}
                />
              ) : null}
              {group.length === 0 ? (
                <p
                  className="app-meta rounded-[var(--r-painel)] border border-dashed px-2 py-4 text-center"
                  style={{ borderColor: "var(--linha-forte)" }}
                >
                  Nenhuma Tarefa em <em>{definition.name}</em>
                </p>
              ) : (
                <ul className="cascata pilha-solta">
                  {group.map((task) => (
                    <li
                      key={task.id}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                    >
                      <TaskRow state={state} task={task} onOpen={openTask} arrastavel recente={task.id === recente} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p className="app-meta mt-3">
        Arrastar altera o Status. As validações da Lista continuam valendo: a
        coluna recusa a Tarefa quando a Funcionalidade exige Subtarefas ou
        Checklists concluídos. Lista {listId}.
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
