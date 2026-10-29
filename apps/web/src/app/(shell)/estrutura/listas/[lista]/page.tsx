"use client";

/**
 * T10 — Lista. Four Visualizações over the same collection of Tasks.
 *
 * The Quadro columns ARE the definitions of the effective Status Set, in order,
 * coloured by category (RN-LIS-05, A4.3). Dragging changes the status through
 * the same operation the panel uses, so the List functionalities are enforced.
 */

import Link from "next/link";
import { BookOpen, Briefcase, Link2, MessageSquare } from "lucide-react";
import { use, useState } from "react";
import { useData, useRunConfirmado, useSession } from "@/dados/store";
import {
  containerAdminRefusal,
  effectiveLifecycleOfList,
  memberReachesContainer,
  effectiveListConfig,
  effectiveLifecycleOfTask,
  isTerminalCategory,
  statusCategory,
} from "@n1/dominio/derive";
import {
  applyView,
  createTask,
  listWriteRefusal,
} from "@n1/dominio/operations";
import { contatoDaTarefa, listaSemCanais } from "@n1/dominio/derive-conversacional";
import { LISTA_SEM_CANAIS } from "@n1/dominio/operations/canais";
import { CP } from "@n1/dominio/operations/financeiro";
import { abrirGuiaDoFinanceiro } from "@/features/financeiro/guia/guia-do-financeiro-dialogo";
import { DetalhesDaLista } from "@/features/estrutura/detalhes-da-lista";
import { useFormat } from "@/features/shell/use-format";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TASK_PANEL_PARAM, useTaskPanel } from "@/features/estrutura/task-panel";
import { useMoveTaskDialog } from "@/features/estrutura/move-task-dialog";
import { useMoverConteinerDialog } from "@/features/estrutura/mover-conteiner-dialog";
import { DialogosDaLista } from "@/features/estrutura/dialogos-da-lista";
import { LinhaDoTempo } from "@/features/estrutura/planning-views";
import {
  NewTaskFromTemplateDialog,
  SaveTemplateDialog,
} from "@/features/estrutura/template-dialogs";
import { FILTRO_VAZIO, ViewBar } from "@/features/estrutura/view-bar";
import { SeletorDeTipoDeTarefa } from "@/features/estrutura/seletor-de-tipo";
import { QuadroDeTarefas } from "@/features/estrutura/quadro-de-tarefas";
import { TabelaPlana } from "@/features/estrutura/tabela-plana";
import { TabelaDeTarefas } from "@/features/estrutura/tabela-de-tarefas";
import { CalendarioMensal } from "@/features/estrutura/calendario-mensal";
import {
  abaDaView,
  abaInicialDaLista,
  abasDaLista,
  kindDaAba,
  ROTULO_DA_ABA,
  type LenteDaLista,
  type TipoDeAba,
} from "@/features/estrutura/tipo-de-visualizacao";
import { RunScheduledButton } from "@/features/estrutura/bulk-status-bar";
import { BotaoDeSelecao, SelecaoEmLote } from "@/features/estrutura/selecao-em-lote";
import { BarraDeCriacao, type LenteDaBarra } from "@/features/estrutura/barra-de-criacao";
import { ContagemFiltrada } from "@/features/estrutura/contagem-filtrada";
import { RelatorioDeLotePainel } from "@/features/estrutura/relatorio-de-lote";
import {
  applyFinanceFilters,
  FILTROS_INICIAIS,
  FinanceCards,
  FinanceIndicators,
  financeProfileOf,
  FinanceTable,
  type FinanceFilters,
} from "@/features/estrutura/financeiro/contas-view";
import { dealOfTask, QuadroNegocios } from "@/features/estrutura/quadro-negocios";
import { linkVisivel, SEM_LINK_PARA_QUEM_NAO_ADMINISTRA } from "@/features/estrutura/link-publico";
import { MEUS_NEGOCIOS_ID } from "@n1/dominio/seed-comercial";
import {
  Abas,
  ActionMenu,
  Button,
  CorpoDeTela,
  Icone,
  EmptyState,
  PageHeader,
  StateSeal,
} from "@/features/shell/ui";
import type { OperationResult } from "@n1/dominio";
import type { Task, View, ViewFilters } from "@n1/dominio/types";
import type { RelatorioDeLote } from "@n1/dominio/operations/lote";

type ViewKind = TipoDeAba;
const VIEW_LABEL = ROTULO_DA_ABA;

/**
 * A lente de tipos de Visualização: as Listas do Financeiro não têm restrição;
 * a conversacional não planeja esforço (sem Linha do tempo). O espelho comercial
 * é conversacional, e herda a restrição.
 */
function lenteDaLista(list: { readonly id: string; readonly modeloDeTarefa?: string }): LenteDaLista {
  if (financeProfileOf(list.id) !== undefined) return "financeira";
  return list.modeloDeTarefa === "conversacional" ? "conversacional" : "comum";
}

export default function ListaPage({
  params,
}: {
  params: Promise<{ lista: string }>;
}) {
  const { lista } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();
  const runConfirmado = useRunConfirmado();
  const { memberId } = useSession();
  // B38a — a Lista que o Membro não alcança não existe para ele.
  const list = state.lists.find(
    (l) =>
      l.id === lista && memberReachesContainer(state, memberId, "list", l.id),
  );
  const config = list ? effectiveListConfig(state, list.id) : null;
  // 2.6.2, D-07 — as abas vêm da configuração efetiva (o Espaço e a Pasta
  // definem), filtradas pela lente; a Lista abre na padrão salva dela quando o
  // tipo está entre as abas, senão na inicial da configuração (D-06).
  const abas: readonly TipoDeAba[] = list && config ? abasDaLista(config.views.disponiveis, lenteDaLista(list)) : ["lista"];
  const padraoSalva = state.views.find(
    (v) => v.listId === lista && v.ownerKind === "container" && v.isDefault,
  );
  const abaInicial: TipoDeAba = config ? abaInicialDaLista(abas, padraoSalva, config.views.inicial) : "lista";
  // A Visualização padrão da Lista abre aplicada; o resto parte do vazio. Uma
  // padrão de tipo que a Lista não mostra fica guardada e não abre (D-06).
  const padrao = padraoSalva && abas.includes(abaDaView(padraoSalva.kind)) ? padraoSalva : undefined;
  const [abaEscolhida, setView] = useState<ViewKind>(abaInicial);
  // Se outro Membro tira o tipo da aba aberta, a Lista volta à inicial: a aba
  // mostrada nunca é uma que a configuração efetiva não oferece.
  const view: ViewKind = abas.includes(abaEscolhida) ? abaEscolhida : abaInicial;
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    taskId?: string;
  } | null>(null);
  /*
   * O relatório de um lote (Plan 03-13) NÃO pode morar dentro do painel do
   * lote (`SelecaoEmLote`): um lote 100% bem-sucedido esvazia a seleção, e o
   * painel desmonta junto — o relatório sumiria no mesmo instante em que passa
   * a ser a única prova do que aconteceu. Pior no caso `parcial`: as contas
   * parciais mudaram de Status e podem sair do filtro corrente, saindo também
   * de `selecionadas` (a seleção só vale para o que está na tela) — o relato
   * mais importante seria o mais fácil de perder. Por isso a página guarda o
   * relatório à parte, fora de qualquer condicional de seleção.
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
  const { openMover } = useMoverConteinerDialog();

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
  // O Formulário da Lista à mão no topo: abrir a página pública e copiar o link
  // para mandar a quem pede (o editor continua em Configurações › Formulários).
  const formulariosAtivos = state.forms.filter((f) => f.listId === list.id && f.lifecycle === "ativo" && f.enabled);
  const copiarLinkDoFormulario = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/f/${secret}`);
      reportar({ ok: true }, "Link do formulário copiado.");
    } catch {
      reportar({ ok: false, error: "Não foi possível copiar: abra o formulário e copie o endereço do navegador." }, "");
    }
  };
  const daPastaFinanceiro = config.path.some((node) => node.type === "folder" && node.id === CP.folderId);

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
  // Precedência das lentes da barra principal: financeira > espelho > conversacional.
  const lenteDaBarra: LenteDaBarra = financeira
    ? "financeira"
    : espelhoComercial
      ? "espelhoComercial"
      : conversacional
        ? "conversacional"
        : "comum";
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
  // O único gesto de seleção (2.1.4): liga/desliga, limpa as marcadas e, como a
  // seleção só existe na Visualização Lista, leva a pessoa para lá.
  const alternarSelecao = () => {
    setSelecionando((v) => !v);
    setSelecionadas(new Set());
    if (view !== "lista" && abas.includes("lista")) setView("lista");
  };
  const marcarUma = (id: string) =>
    setSelecionadas((atual) => {
      const next = new Set(atual);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const marcarVarias = (ids: readonly string[], on: boolean) =>
    setSelecionadas((atual) => {
      const next = new Set(atual);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  // A seleção em lote só existe na aba Lista (A19): sem ela entre as abas, o botão não liga.
  const motivoDaSelecao = selecionando
    ? undefined
    : !abas.includes("lista")
      ? "A seleção em lote só existe na Visualização Lista."
      : criacaoRecusada;
  const botaoDeSelecao = (
    <BotaoDeSelecao
      selecionando={selecionando}
      aoAlternar={alternarSelecao}
      {...(motivoDaSelecao !== undefined ? { desligadoPor: motivoDaSelecao } : {})}
    />
  );

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
                <DetalhesDaLista list={list} conversacional={conversacional} espelhoComercial={espelhoComercial} />
              ),
            }
          : {})}
        actions={
          <>
            {formulariosAtivos[0] && linkVisivel(formulariosAtivos[0].secret) ? (
              <a
                href={`/f/${formulariosAtivos[0].secret}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-contorno btn-sm"
              >
                Abrir formulário
              </a>
            ) : null}
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
                ...formulariosAtivos.map((form) => ({
                  label: "Copiar link do formulário",
                  icone: Link2,
                  ...(formulariosAtivos.length > 1 ? { detalhe: form.name } : {}),
                  onSelect: () => void copiarLinkDoFormulario(form.secret),
                  // Fase 9, 1.1.3: sem o segredo (quem não administra a Lista) não há link a copiar.
                  ...(linkVisivel(form.secret) ? {} : { disabledReason: SEM_LINK_PARA_QUEM_NAO_ADMINISTRA }),
                })),
                ...(daPastaFinanceiro
                  ? [{ label: "Guia do Financeiro", icone: BookOpen, onSelect: abrirGuiaDoFinanceiro }]
                  : []),
                {
                  label: "Salvar como modelo",
                  onSelect: () => setSalvandoModelo(true),
                  ...(administra ? { disabledReason: administra } : {}),
                },
                // D-10 — por último; a Lista de Meus negócios é o espelho do Funil e não se move (A9).
                ...(pastaDeNegocios
                  ? []
                  : [
                      {
                        label: "Mover para…",
                        onSelect: () => openMover(list.id),
                        ...(administra ? { disabledReason: administra } : {}),
                      },
                    ]),
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

      {/* Uma única aba não deixa nada a escolher: a barra não é desenhada (A18). */}
      {abas.length > 1 ? (
        <Abas
          rotulo="Visualizações"
          abas={abas.map((kind) => ({ chave: kind, rotulo: VIEW_LABEL[kind] }))}
          ativa={view}
          aoTrocar={(chave) => setView(chave as ViewKind)}
        />
      ) : null}

      {effective === "ativo" ? (
        <BarraDeCriacao
          lente={lenteDaBarra}
          listId={list.id}
          {...(criacaoRecusada ? { criacaoRecusada } : {})}
          fim={
            financeira ? (
              botaoDeSelecao
            ) : (
              <>
                {botaoDeSelecao}
                <RunScheduledButton listId={list.id} report={reportar} />
              </>
            )
          }
          aoIniciarConversa={() => setIniciandoConversa({})}
          aoNovaConversacional={() => setNovaConversacional({})}
          campo={{
            aberto: criandoConta || pedidaPelaUrl,
            titulo: newTitle,
            aoMudarTitulo: setNewTitle,
            tipo: novoTipo,
            aoMudarTipo: setNovoTipo,
            aoCriar: create,
            aoCriarDeModelo: () => setCriandoDeModelo(true),
            aoCancelar: fecharCriacao,
            autoFocar: pedidaPelaUrl || criandoConta,
          }}
          {...(lente
            ? {
                financeiro: {
                  perfil: lente,
                  filtros: financeFilters,
                  aoFiltrar: setFinanceFilters,
                  aoAbrirFiltros: () => setFiltrosAbertos((v) => !v),
                  filtrosAvancados,
                },
              }
            : {})}
          report={reportar}
        />
      ) : null}

      <SelecaoEmLote
        tasks={tasks}
        definitions={definitions}
        selecionadas={selecionadas}
        onSelecionar={setSelecionadas}
        onRelatorio={aoReceberRelatorio}
        report={reportar}
        selecionando={selecionando}
      />

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
            kind={kindDaAba(view)}
            abas={abas}
            onOpenView={(aberta) => {
              setActiveViewId(aberta?.id ?? null);
              setFilters(aberta?.filters ?? FILTRO_VAZIO);
              setSortBy(aberta?.sortBy);
              // RELO-05 — a Visualização lembra o tipo em que foi salva: abrir troca a aba.
              if (aberta) setView(abaDaView(aberta.kind));
            }}
            report={reportar}
            {...(financeira ? { panelOpen: filtrosAbertos } : {})}
          />
          {filtrando ? (
            <ContagemFiltrada x={tasks.length} y={todas.length} financeira={financeira} />
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
          <QuadroDeTarefas
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
          <CalendarioMensal state={state} tasks={tasks} openTask={openTask} editavel={effective === "ativo"} report={reportar} />
        ) : view === "tabela" ? (
          <TabelaPlana state={state} tasks={tasks} editavel={effective === "ativo"} report={reportar} openTask={openTask} />
        ) : view === "linha" ? (
          <LinhaDoTempo
            state={state}
            tasks={tasks}
            openTask={openTask}
            editavel={effective === "ativo" && criacaoRecusada === undefined}
            report={reportar}
          />
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
                onToggle={marcarUma}
                onToggleMany={marcarVarias}
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
              ? { selected: selecionadas, onToggle: marcarUma, onToggleMany: marcarVarias }
              : {})}
          />
        )}
        </div>
      </CorpoDeTela>

      <DialogosDaLista
        listId={list.id}
        financeira={financeira}
        espelhoComercial={espelhoComercial}
        conversacionalPura={conversacionalPura}
        {...(lente?.kind === "receber"
          ? {
              serie: {
                aberta: criandoSerie,
                aoFechar: () => setCriandoSerie(false),
                aoCriar: (novas: readonly Task[], cliente: string) => {
                  // As novas nascem "para receber": um filtro de cartão as esconderia.
                  setFinanceFilters(FILTROS_INICIAIS);
                  setError(null);
                  setNotice({
                    text: `${novas.length} conta(s) a receber criada(s) para ${cliente}, em “A receber”.`,
                    ...(novas[0] ? { taskId: novas[0].id } : {}),
                  });
                },
              },
            }
          : {})}
        iniciandoConversa={iniciandoConversa}
        aoFecharIniciarConversa={() => setIniciandoConversa(null)}
        aoIniciarConversa={(text) => {
          setIniciandoConversa(null);
          setNotice({ text });
        }}
        conversacionalAberto={dialogoConversacional}
        statusDaConversacional={novaConversacional?.statusId}
        aoFecharConversacional={fecharNovaConversacional}
        aoNovaConversacional={(text, taskId) => {
          // A Tarefa nasceu com a conversa: o popup dela abre no lugar do diálogo.
          setNovaConversacional(null);
          setError(null);
          setNotice({ text, taskId });
          abrirTarefaCriada(taskId);
        }}
        openTaskId={openTaskId}
        aoFecharTarefa={closeTask}
        negocioAberto={negocioAberto}
        caminho={config.path}
        movingTaskId={movingTaskId}
        aoFecharMover={closeMove}
        aoMoverTarefa={(text) => {
          // A Tarefa foi para outra Lista: o popup dela fecha, e o aviso fica à vista.
          closeTask();
          setNotice({ text });
        }}
        report={reportar}
      />
    </div>
  );
}
