"use client";

/**
 * A CASCA EM DUAS ETAPAS, como o ClickUp — e como o CRM-COMPLETO.
 *
 * Trilho estreito (56px) = ASSUNTO. Painel (232px) = as telas daquele assunto.
 * O assunto segue a rota: entrar em /crm/contatos acende "CRM" sozinho, e por
 * isso navegar por link ou por busca nunca deixa o trilho mentindo.
 *
 * HÁ UMA BARRA GLOBAL de 40px no topo da coluna da tela (`barra-global.tsx`).
 * A barra de topo saiu em 2026-09-14 por carregar marca, busca e conta com um
 * vão enorme no meio; voltou em 2026-09-17 mais baixa e com outro conteúdo —
 * não a marca (que é do trilho) nem o Espaço de Trabalho (do painel), mas o
 * que é da PESSOA: busca, minhas Tarefas, Notificações, conta. Esses itens são
 * "o que espera por mim" e ficam à vista em qualquer assunto; e o painel do
 * Trabalho deixa de misturar "minhas coisas" com a estrutura.
 *
 * O ÚNICO ELEMENTO QUE ROLA é o `<main>`. O cabeçalho de cada tela é `sticky`
 * no topo dele, com o fundo da página: o título fica parado enquanto a lista
 * corre por baixo.
 *
 * A árvore reproduz EXATAMENTE a cadeia de contenção aprovada (A3.1): Espaço →
 * Pasta → Subpasta → Lista. Tarefas nunca aparecem nela (A3.2). CRM, IA, Ferramentas e
 * Painéis são pares de ESTRUTURA, nunca aninhados sob ela (A2.2) — por isso
 * cada um é um assunto do trilho.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  Contact,
  Folder as FolderIcon,
  Handshake,
  Home,
  Inbox as InboxIcon,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  ListTodo,
  MessageSquare,
  Plus,
  Settings,
  SlidersHorizontal,
  Split,
  Target,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Toast } from "@/design/components";
import { Icone } from "@/design/icone";
import { CarregadorDeIcones } from "@/design/carregador";
import { EsqueletoDeTela } from "@/design/esqueletos";
import { ASSUNTO_FINANCEIRO, vePastaFinanceiro } from "@/features/financeiro/navegacao-financeiro";
import { ehConvidado, veAssuntoIa } from "@/features/shell/assuntos-do-trilho";
import { GuiaDoFinanceiro } from "@/features/financeiro/guia/guia-do-financeiro-dialogo";
import { BarraDeRota } from "./barra-de-rota";
import { CascataDeNavegacao, Chegada } from "./chegada";
import { limpar, marcarSeMuda, useAlvo, useNavegando, useNavegar } from "./navegacao";
import { PendenciaDoLink } from "./pendencia-do-link";
import { BarraGlobal } from "./barra-global";
import { useHidratado } from "./hidratado";
import { RoboFlutuante } from "./robo-flutuante";
import { chaveDeChegada, formaDe } from "./rotas";
import type { ContainerKind } from "@/features/estrutura/create-container-dialog";
import { shortcutHref } from "@/features/estrutura/shortcuts";
import { BrandMark } from "./brand";
import { TreeRow } from "./linha-da-arvore";
import { useArrastarNaArvore, type NoDaArvore, type PropsDeArrasto } from "./arrastar-na-arvore";

import { useData, useRun, useRunConfirmado, useSession } from "@/dados/store";
import { MEUS_NEGOCIOS_ID } from "@n1/dominio/seed-comercial";
import { moveChatSessionToFolder, recusaDeReordenar, reorderContainers, type PaiDeConteiner } from "@n1/dominio/operations";
import { useChatFolderDialogs } from "@/features/ia/chat-folder-dialogs";
import {
  containerAdminRefusal,
  containerPath,
  irmaosOrdenados,
  memberReachesContainer,
  memberSeesResource,
  notificacoesDoMembro,
} from "@n1/dominio/derive";
import { useSidebarCollapsed } from "./use-sidebar";
import { TarefasCompartilhadas } from "./compartilhadas-comigo";
import {
  CreateContainerDialog,
  useCreateContainerDialog,
} from "@/features/estrutura/create-container-dialog";
import { MoverConteinerDialog, useMoverConteinerDialog } from "@/features/estrutura/mover-conteiner-dialog";
import type { DataState, OperationResult } from "@n1/dominio/state";
import type { Folder, Id, List, Space, SpaceShortcut } from "@n1/dominio/types";

// Mantido aqui pelos chamadores antigos (app/f, app/p); vive em ./hidratado.
export { useHidratado } from "./hidratado";

/* ─────────────────────────────────────────────────────── os assuntos */

type Tela = {
  readonly href: string;
  readonly rotulo: string;
  readonly icone: LucideIcon;
  /** Casa também os descendentes: /crm/contatos/123 acende "Contatos". */
  readonly prefixo?: boolean;
};

type Assunto = {
  readonly chave: "trabalho" | "crm" | "ia" | "ferramentas" | "paineis" | "financeiro";
  readonly rotulo: string;
  readonly icone: LucideIcon;
  /** O assunto "Trabalho" desenha a árvore de Espaços abaixo das telas. */
  readonly comArvore?: boolean;
  /** O assunto "IA" desenha as Sessões de Chat abaixo das telas. */
  readonly comChat?: boolean;
  /** O assunto "CRM" desenha as Listas de "Meus negócios" (uma por Funil) abaixo das telas. */
  readonly comMeusNegocios?: boolean;
  /** Para onde o botão do trilho leva quando não é a primeira tela do painel. */
  readonly raiz?: string;
  readonly telas: ReadonlyArray<Tela>;
};

const ASSUNTOS: ReadonlyArray<Assunto> = [
  {
    chave: "trabalho",
    rotulo: "Trabalho",
    icone: Home,
    comArvore: true,
    /*
      O menu do Trabalho lista as telas da pessoa — Início, Notificações, Visão
      geral e Minhas Tarefas — e os Espaços abaixo. A barra global repete as
      duas pendências para quem está noutro assunto; aqui elas seguem onde
      sempre estiveram (Metas saiu do produto em 2026-09-17).
    */
    raiz: "/",
    telas: [
      { href: "/", rotulo: "Início", icone: Home },
      { href: "/notificacoes", rotulo: "Notificações", icone: Bell },
      { href: "/estrutura", rotulo: "Visão geral", icone: LayoutGrid },
      { href: "/estrutura/tarefas", rotulo: "Minhas Tarefas", icone: ListTodo, prefixo: true },
    ],
  },
  {
    chave: "crm",
    rotulo: "CRM",
    icone: Contact,
    comMeusNegocios: true,
    telas: [
      { href: "/crm/caixa-de-entrada", rotulo: "Caixa de Entrada", icone: InboxIcon, prefixo: true },
      { href: "/crm/contatos", rotulo: "Contatos", icone: Contact, prefixo: true },
      { href: "/crm/empresas", rotulo: "Empresas", icone: Building2, prefixo: true },
      { href: "/crm/negocios", rotulo: "Negócios", icone: Handshake, prefixo: true },
      { href: "/crm/funis", rotulo: "Funis", icone: Split, prefixo: true },
    ],
  },
  {
    chave: "ia",
    rotulo: "IA",
    icone: MessageSquare,
    comChat: true,
    telas: [
      { href: "/ia/chat", rotulo: "Chat", icone: MessageSquare },
      /*
        Tudo que configura a IA mora em Personalizar, com o próprio submenu:
        Agentes, Habilidades, Automação, Conhecimento, Integrações, Plugins.
        Aprovações continua alcançável pelas Notificações, na barra global.
      */
      { href: "/ia/personalizar/agente", rotulo: "Personalizar", icone: SlidersHorizontal, prefixo: true },
    ],
  },
  {
    // Os Ativos de Canal (docs 23–25): um assunto próprio, abaixo de IA, com uma tela por gerenciador.
    chave: "ferramentas",
    rotulo: "Ferramentas",
    icone: Wrench,
    telas: [
      { href: "/ferramentas/grupos", rotulo: "Grupos", icone: Users, prefixo: true },
      { href: "/ferramentas/comunidades", rotulo: "Comunidades", icone: Layers, prefixo: true },
      { href: "/ferramentas/flows", rotulo: "Flows", icone: Workflow, prefixo: true },
    ],
  },
  {
    chave: "paineis",
    rotulo: "Painéis",
    icone: LayoutDashboard,
    telas: [{ href: "/paineis", rotulo: "Painéis", icone: LayoutDashboard, prefixo: true }],
  },
  ASSUNTO_FINANCEIRO,
];

/** O quadrado do trilho que uma rota acende: um assunto, ou o de Configurações. */
function chaveDoTrilho(pathname: string): string {
  return pathname.startsWith("/configuracoes") ? "configuracoes" : assuntoDe(pathname).chave;
}

/** A rota manda no trilho, nunca o clique: chegar por link acende o certo. */
function assuntoDe(pathname: string): Assunto {
  if (pathname.startsWith("/crm")) return ASSUNTOS[1]!;
  if (pathname.startsWith("/ia")) return ASSUNTOS[2]!;
  if (pathname.startsWith("/ferramentas")) return ASSUNTOS[3]!;
  if (pathname.startsWith("/paineis")) return ASSUNTOS[4]!;
  if (pathname.startsWith("/financeiro")) return ASSUNTOS[5]!;
  return ASSUNTOS[0]!;
}

const IA_PERSONALIZAR = ["/ia/agentes", "/ia/habilidades", "/ia/automacoes", "/ia/conhecimento", "/ia/aprovacoes"];

function telaAtiva(pathname: string, tela: Tela): boolean {
  if (tela.href === "/ia/personalizar/agente") {
    return pathname.startsWith("/ia/personalizar") || IA_PERSONALIZAR.some((p) => pathname.startsWith(p));
  }
  if (tela.prefixo) return pathname === tela.href || pathname.startsWith(tela.href + "/");
  return pathname === tela.href;
}

/* ─────────────────────────────────────────────────────────── a casca */

export function AppShell({ children }: { readonly children: React.ReactNode }) {
  const hidratado = useHidratado();
  const { collapsed, toggle } = useSidebarCollapsed();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navegando = useNavegando();
  // O endereço mudou: a navegação chegou. Também no voltar/avançar do navegador.
  useEffect(() => {
    limpar();
  }, [pathname, searchParams]);
  useEffect(() => {
    window.addEventListener("popstate", limpar);
    return () => window.removeEventListener("popstate", limpar);
  }, []);
  return (
    <div className="relative flex h-screen overflow-hidden" style={{ zIndex: "var(--z-conteudo)" }}>
      {/* Recolher esconde só a 2ª etapa (o painel do assunto); o trilho de
          assuntos fica sempre à esquerda. */}
      <Navegacao recolhido={collapsed} onRecolher={toggle} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Irmã de <main>, nunca dentro dele: dentro, rolaria com o conteúdo. */}
        <BarraDeRota />
        <BarraGlobal />
        {/*
          O conteúdo só entra depois da hidratação. O seed é construído em cada
          processo a partir de "hoje", e o servidor de desenvolvimento fica de
          pé por dias: passada a meia-noite UTC, o HTML dele descreve ontem e o
          navegador descreve hoje — cada data da página diverge e o React
          descarta a árvore com erro. Sem servidor nem SEO, o HTML do servidor
          não tinha valor nenhum para estas telas; a casca fica, o miolo espera.
        */}
        {/* Chapado como o trilho e o painel: o degradê do body faria o cabeçalho
            fixo de cada tabela (que pinta --page) aparecer como uma faixa escura. */}
        {/*
          Antes da hidratação, o esqueleto na forma da família da rota (só o
          pathname alimenta isto). Depois, a tela dentro do invólucro de
          chegada, chaveado por rota: a cascata É a transição.
        */}
        <main aria-busy={navegando || undefined} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto" style={{ background: "var(--page)" }}>
          {hidratado ? <Chegada key={chaveDeChegada(pathname)}>{children}</Chegada> : <EsqueletoDeTela forma={formaDe(pathname)} />}
        </main>
        {/* Navegação que passa da carência: os ícones no centro, sobre a tela velha (que continua inteira e responsiva). Irmã de <main>: não rola. */}
        {navegando ? <CarregadorDeIcones tardio /> : null}
      </div>
      {/* Fora do Início, o robô vira um círculo no canto inferior direito que
          volta ao Início. Irmão da coluna: fica montado entre as telas. */}
      <RoboFlutuante />
      {/* O Guia do Financeiro abre na entrada (até 3 vezes) e segue montado entre as telas: "Ir para lá" não o perde. */}
      {hidratado ? <GuiaDoFinanceiro /> : null}
    </div>
  );
}

/**
 * O RÓTULO DE GRUPO do painel: uma faixa baixa, em caixa, que divide um grupo
 * de itens do próximo ("Trabalho", "Espaços", "Sessões") — como a etiqueta de
 * um separador, não um título gritado. A ação do grupo (o "+" de Espaços)
 * mora dentro dela.
 */
function RotuloDeGrupo({ children, acao }: { readonly children: React.ReactNode; readonly acao?: React.ReactNode }) {
  return (
    <div
      className="mb-1 flex items-center gap-1 rounded-[var(--r-controle)] pl-3 pr-1"
      style={{ height: "var(--controle-h-sm)", background: "var(--superficie-2)", border: "1px solid var(--linha)" }}
    >
      <span className="ed-secao min-w-0 flex-1 truncate">{children}</span>
      {acao}
    </div>
  );
}

/**
 * A Pasta "Meus negócios" no painel do CRM — a MESMA árvore da Estrutura
 * (a pasta que abre e fecha, o "+" que cria Lista e Subpasta, Mostrar
 * arquivados, cadeado, selo de arquivado), só que os nós apontam para o lado
 * do CRM: /crm/meus-negocios e /crm/meus-negocios/<lista>. O "+" de uma Lista
 * aqui cria um Negócio, que nasce em Negócios.
 */
function MeusNegociosNoPainel({
  openCreate,
}: {
  readonly openCreate: (kind: ContainerKind, parentType?: "space" | "folder", parentId?: string) => void;
}) {
  const { memberId } = useSession();
  const data = useData((current) => current);
  const [showArchived, setShowArchived] = useState(false);
  const pasta = data.folders.find((f) => f.id === MEUS_NEGOCIOS_ID);
  if (!pasta || pasta.lifecycle === "naLixeira" || !memberSeesResource(data, memberId, pasta.id)) {
    return <p className="app-meta px-3 py-1">Nenhum Funil visível para você.</p>;
  }
  const listsUnder = (parentId: Id) =>
    data.lists
      .filter((l) => l.parentId === parentId)
      .filter((l) => l.lifecycle !== "naLixeira")
      .filter((l) => l.lifecycle !== "arquivado" || showArchived)
      .filter((l) => memberSeesResource(data, memberId, l.id));
  const foldersUnder = (parentId: Id): Folder[] =>
    data.folders
      .filter((f) => f.parentId === parentId)
      .filter((f) => f.lifecycle !== "naLixeira")
      .filter((f) => f.lifecycle !== "arquivado" || showArchived);
  const enderecos: EnderecosDaArvore = {
    pasta: (folder) => (folder.id === MEUS_NEGOCIOS_ID ? "/crm/meus-negocios" : `/crm/meus-negocios?pasta=${folder.id}`),
    lista: (list) => `/crm/meus-negocios/${list.id}`,
    novoNaLista: { rotulo: "Negócio", href: () => "/crm/negocios" },
  };
  return (
    <>
      <ul>
        <TreeFolder
          folder={pasta}
          depth={0}
          inert={false}
          foldersUnder={foldersUnder}
          listsUnder={listsUnder}
          openCreate={openCreate}
          enderecos={enderecos}
        />
      </ul>
      <button
        type="button"
        onClick={() => setShowArchived((value) => !value)}
        className="app-meta mt-1 w-full rounded-[var(--r-controle)] px-3 py-1 text-left transition-colors hover:bg-[var(--superficie-hover)]"
      >
        {showArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
      </button>
    </>
  );
}

function Navegacao({ recolhido, onRecolher }: { readonly recolhido: boolean; readonly onRecolher: () => void }) {
  const pathname = usePathname();
  const [navegar] = useNavegar();
  const alvo = useAlvo();
  const trilho = useRef<HTMLElement>(null);
  const luz = useRef<HTMLSpanElement>(null);
  const pendingApprovals = useData((data) => data.approvals.filter((a) => a.decision === undefined).length);
  /*
    A contagem do sino no painel é a MESMA da barra global e da tela: o derivado
    filtrado por Membro. Só entra depois da hidratação, porque depende de "hoje"
    (o que venceu) e o HTML do servidor não pode trazer número nenhum.
  */
  const estado = useData((data) => data);
  const { memberId } = useSession();
  const hidratado = useHidratado();
  const [agora] = useState(() => new Date());
  const notificacoes = hidratado ? notificacoesDoMembro(estado, memberId, agora).total : 0;
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // O aviso de recusa da árvore: não expira (WCAG 2.2.1), a pessoa dispensa.
  const [noticeErro, setNoticeErro] = useState<string | null>(null);
  const { creating, openCreate, closeCreate } = useCreateContainerDialog();
  const { openMover } = useMoverConteinerDialog();
  const workspace = useData((data) => data.workspace.name);
  const data = useData((current) => current);
  // As condicionais do trilho (D4-14): o item some, nunca aparece desativado.
  // Quem decide o alcance de verdade é o 403 do `apps/api`. Fase 9, D-03: o
  // assunto IA também some para o Convidado — o servidor já não manda as
  // coleções de IA (D-02); aqui é só a consequência visual.
  const assuntosVisiveis = ASSUNTOS.filter(
    (a) => (a.chave !== "financeiro" || vePastaFinanceiro(data, memberId)) && (a.chave !== "ia" || veAssuntoIa(data, memberId)),
  );

  const assunto = assuntoDe(pathname);

  /*
    A luz do trilho: UMA folha de 2px na borda esquerda, que desliza até o
    quadrado do assunto ativo — ou do alvo pendente, otimista, desde o clique.
    Medida por `offsetTop` e escrita direto no estilo, fora do render. Se a
    navegação não chegar, `limpar()` a devolve ao assunto real.
  */
  const alvoCaminho = alvo?.split("?")[0] ?? null;
  const chaveDaLuz = chaveDoTrilho(alvoCaminho ?? pathname);
  useLayoutEffect(() => {
    const botao = trilho.current?.querySelector<HTMLElement>(`[data-trilho="${chaveDaLuz}"]`);
    const el = luz.current;
    if (!botao || !el) return;
    el.style.top = `${botao.offsetTop + (botao.offsetHeight - el.offsetHeight) / 2}px`;
    el.style.opacity = "1";
  }, [chaveDaLuz]);

  return (
    <div className="flex h-full shrink-0">
      {/* ── Etapa 1: o trilho de assuntos ── */}
      <nav
        ref={trilho}
        aria-label="Assuntos"
        className="relative flex shrink-0 flex-col items-center gap-1 py-2"
        style={{ width: "var(--trilha-w)", borderRight: "1px solid var(--linha)", background: "var(--page)" }}
      >
        <span ref={luz} className="trilho-luz" aria-hidden="true" style={{ opacity: 0, top: 0 }} />
        <Link
          href="/"
          aria-label="N1 Digital — início"
          className="mb-1 flex items-center justify-center rounded-[var(--r-painel)]"
          style={{ width: "var(--item-trilha)", height: "var(--item-trilha)" }}
        >
          <BrandMark size={22} />
        </Link>

        <span className="mb-1 h-px w-7" style={{ background: "var(--linha)" }} aria-hidden />

        {assuntosVisiveis.map((a) => {
          const ativo = a.chave === assunto.chave;
          const contador = a.chave === "ia" ? pendingApprovals : 0;
          // O botão clicado pulsa (com a carência de 150ms) até a rota chegar.
          const pendenteAqui = !ativo && alvoCaminho !== null && chaveDoTrilho(alvoCaminho) === a.chave;
          return (
            <button
              key={a.chave}
              type="button"
              data-trilho={a.chave}
              onClick={() => navegar(a.raiz ?? a.telas[0]!.href)}
              aria-label={a.rotulo}
              aria-current={ativo ? "page" : undefined}
              aria-busy={pendenteAqui || undefined}
              title={a.rotulo}
              className="flutua relative flex items-center justify-center rounded-[var(--r-painel)]"
              style={{
                width: "var(--item-trilha)",
                height: "var(--item-trilha)",
                background: ativo ? "var(--acento-lavado)" : "transparent",
                color: ativo ? "var(--acento)" : "var(--texto-3)",
                border: `1px solid ${ativo ? "var(--linha-acento)" : "transparent"}`,
              }}
            >
              <Icone de={a.icone} className={pendenteAqui ? "pulso" : undefined} style={pendenteAqui ? { animationDelay: "var(--dur-1)" } : undefined} />
              {contador > 0 ? (
                <span
                  className="app-xs app-numero absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1"
                  style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
                >
                  {contador}
                </span>
              ) : null}
            </button>
          );
        })}

        <span className="flex-1" />

        <Link
          href="/configuracoes"
          data-trilho="configuracoes"
          onNavigate={() => marcarSeMuda("/configuracoes")}
          aria-label="Configurações"
          title="Configurações"
          className="flutua flex items-center justify-center rounded-[var(--r-painel)]"
          style={{
            width: "var(--item-trilha)",
            height: "var(--item-trilha)",
            background: pathname.startsWith("/configuracoes") ? "var(--acento-lavado)" : "transparent",
            color: pathname.startsWith("/configuracoes") ? "var(--acento)" : "var(--texto-3)",
            border: `1px solid ${pathname.startsWith("/configuracoes") ? "var(--linha-acento)" : "transparent"}`,
          }}
        >
          <Icone de={Settings} />
        </Link>
      </nav>

      {/* ── Etapa 2: o painel do assunto — some quando recolhido ── */}
      {recolhido ? (
        <div className="flex shrink-0 flex-col items-center py-2" style={{ borderRight: "1px solid var(--linha)", background: "var(--page)" }}>
          <button type="button" onClick={onRecolher} aria-label="Abrir o menu" title="Abrir o menu" className="btn-icone btn-icone-nu">
            <Icone de={ChevronRight} tamanho="xs" />
          </button>
        </div>
      ) : (
      <aside
        aria-label="Navegação"
        className="flex flex-col"
        style={{ width: "var(--painel-nav-w)", borderRight: "1px solid var(--linha)", background: "var(--page)" }}
      >
        <div className="flex items-center gap-1 px-2 py-2">
          <span className="app-md min-w-0 flex-1 truncate px-2" style={{ color: "var(--texto)" }}>
            {workspace}
          </span>
          <button type="button" onClick={onRecolher} aria-label="Recolher o menu" title="Recolher o menu" className="btn-icone btn-icone-nu">
            <Icone de={ChevronLeft} tamanho="xs" />
          </button>
        </div>

        {/* Chaveado pelo assunto: o painel esmaece e as telas caem em cascata na troca. */}
        <CascataDeNavegacao key={assunto.chave} className="sem-barra min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <RotuloDeGrupo>{assunto.rotulo}</RotuloDeGrupo>
          {assunto.telas.map((t) => {
            const ativo = telaAtiva(pathname, t);
            const contador = t.href === "/notificacoes" ? notificacoes : 0;
            return (
              <Link
                key={t.href}
                href={t.href}
                onNavigate={() => marcarSeMuda(t.href)}
                aria-current={ativo ? "page" : undefined}
                {...(contador > 0 ? { title: `${t.rotulo} — ${contador} item(ns)` } : {})}
                className="app-base flex items-center gap-2 rounded-[var(--r-controle)] px-3 transition-colors hover:bg-[var(--superficie-hover)]"
                style={{
                  height: "var(--item-nav-h)",
                  background: ativo ? "var(--acento-lavado)" : undefined,
                  color: ativo ? "var(--texto)" : "var(--texto-2)",
                  fontWeight: ativo ? 500 : 400,
                }}
              >
                <Icone de={t.icone} tamanho="xs" style={{ color: ativo ? "var(--acento)" : "var(--texto-3)" }} />
                <PendenciaDoLink className="min-w-0 flex-1 truncate">{t.rotulo}</PendenciaDoLink>
                {contador > 0 ? (
                  <>
                    <span key={contador} className="app-xs app-numero surgir-rapido rounded-full px-1.5" style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}>
                      {contador}
                    </span>
                    <span className="sr-only"> — {contador} item(ns)</span>
                  </>
                ) : null}
              </Link>
            );
          })}

          {assunto.comArvore ? (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--linha-sutil)" }}>
              <RotuloDeGrupo
                acao={
                  <button
                    type="button"
                    onClick={() => openCreate("espaco")}
                    aria-label="Novo Espaço"
                    title="Novo Espaço"
                    className="grid size-6 place-items-center rounded-[var(--r-controle)] transition-colors hover:bg-[var(--superficie-hover)]"
                    style={{ color: "var(--texto-4)" }}
                  >
                    <Icone de={Plus} tamanho="xs" />
                  </button>
                }
              >
                Espaços
              </RotuloDeGrupo>
              <StructureTree showArchived={showArchived} openCreate={openCreate} openMover={openMover} onErro={setNoticeErro} onAviso={setNotice} />
              <button
                type="button"
                onClick={() => setShowArchived((value) => !value)}
                className="app-meta mt-1 w-full rounded-[var(--r-controle)] px-3 py-1 text-left transition-colors hover:bg-[var(--superficie-hover)]"
              >
                {showArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
              </button>
              <TarefasCompartilhadas />
            </div>
          ) : null}

          {assunto.comMeusNegocios ? (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--linha-sutil)" }}>
              <RotuloDeGrupo>Pastas de Negócios</RotuloDeGrupo>
              <MeusNegociosNoPainel openCreate={openCreate} />
            </div>
          ) : null}

          {assunto.comMeusNegocios ? (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--linha-sutil)" }}>
              <RotuloDeGrupo>Pastas de Negócios</RotuloDeGrupo>
              <MeusNegociosNoPainel openCreate={openCreate} />
            </div>
          ) : null}

          {assunto.comChat ? (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--linha-sutil)" }}>
              <RotuloDeGrupo>Sessões</RotuloDeGrupo>
              <ChatTree pathname={pathname} onNotice={setNotice} />
            </div>
          ) : null}
        </CascataDeNavegacao>

        <CreateContainerDialog
          target={creating}
          onClose={closeCreate}
          onDone={(message, href) => {
            setNotice(message);
            navegar(href);
          }}
        />
        {noticeErro ? (
          <div className="px-2 pb-2">
            <Toast tone="error" onDismiss={() => setNoticeErro(null)}>
              {noticeErro}
            </Toast>
          </div>
        ) : null}
        {notice ? (
          <div className="px-2 pb-2">
            <Toast tone="success" onDismiss={() => setNotice(null)}>
              {notice}
            </Toast>
          </div>
        ) : null}
      </aside>
      )}
      {/* Fora da barra lateral de propósito: "Mover para…" também abre da página da Lista, com o painel recolhido. */}
      <MoverConteinerDialog
        onDone={(message) => {
          setNoticeErro(null);
          setNotice(message);
        }}
      />
    </div>
  );
}

/**
 * The tree respects privacy: a private container only appears for whoever has a
 * direct grant or a share (B38a). A descendant shared with someone who cannot
 * see the ancestors shows ONLY the ancestor names, inert, for navigation
 * (B38e) — marked with `aria-disabled` and a neutral hint (PADROES §11).
 */
function StructureTree({
  showArchived,
  openCreate,
  openMover,
  onErro,
  onAviso,
}: {
  readonly showArchived: boolean;
  readonly openCreate: (kind: ContainerKind, parentType?: "space" | "folder", parentId?: string) => void;
  readonly openMover: (id: Id, destinoId?: Id) => void;
  /** A recusa do domínio ou do servidor ao mover e reordenar vai ao Toast de erro da barra lateral; `null` limpa o aviso anterior. */
  readonly onErro: (frase: string | null) => void;
  /** O sucesso de mover (reordenar não avisa), dito só depois da resposta do servidor. */
  readonly onAviso: (frase: string) => void;
}) {
  const { memberId } = useSession();
  const runConfirmado = useRunConfirmado();
  const data = useData((current) => current);
  const { spaces } = data;
  // A3/A4: enquanto uma reordenação grava, a árvore fica ocupada e nenhum segundo comando de ordem sai.
  const [gravando, setGravando] = useState(false);

  const visibleList = (list: List): boolean => {
    if (list.lifecycle === "naLixeira") return false;
    if (list.lifecycle === "arquivado" && !showArchived) return false;
    // A MESMA leitura que os Painéis usam: a barra e o número não podem
    // discordar sobre o que este Membro alcança.
    return memberSeesResource(data, memberId, list.id);
  };

  // F2: cada grupo sai na ordem gravada (`order`, desempate estável), nunca na ordem do array.
  const paiDe = (parentId: Id): PaiDeConteiner => ({ type: spaces.some((s) => s.id === parentId) ? "space" : "folder", id: parentId });

  const listsUnder = (parentId: Id): List[] => (irmaosOrdenados(data, "list", paiDe(parentId)) as readonly List[]).filter(visibleList);

  const foldersUnder = (parentId: Id): Folder[] =>
    (irmaosOrdenados(data, "folder", paiDe(parentId)) as readonly Folder[])
      .filter((f) => f.lifecycle !== "naLixeira")
      .filter((f) => f.lifecycle !== "arquivado" || showArchived);

  const spaceHasVisibleContent = (space: Space): boolean => {
    if (listsUnder(space.id).length > 0) return true;
    return foldersUnder(space.id).some(
      (folder) => listsUnder(folder.id).length > 0 || foldersUnder(folder.id).some((sub) => listsUnder(sub.id).length > 0),
    );
  };

  const isGuest = ehConvidado(data, memberId);

  const visibleSpaces = (irmaosOrdenados(data, "space", null) as readonly Space[])
    .filter((s) => s.lifecycle !== "naLixeira")
    .filter((s) => s.lifecycle !== "arquivado" || showArchived)
    // B38a vive em memberSeesResource: o contêiner privado sem concessão não
    // existe aqui, e o Convidado só chega ao que lhe foi concedido.
    .filter((s) => memberSeesResource(data, memberId, s.id))
    .filter((s) => !isGuest || spaceHasVisibleContent(s));

  /**
   * Os irmãos que o menu de ordem conhece: os que a árvore mostra E que o Membro
   * alcança (10-04). Um Espaço privado pode aparecer só porque o caminho de uma
   * Tarefa visível passa por ele; mandá-lo faria o domínio recusar o pedido
   * inteiro. Os escondidos (arquivados, na lixeira, privados) ficam de fora e o
   * domínio os deixa na vaga deles.
   */
  const irmaos = (tipo: TipoDoGrupo, pai: PaiDeConteiner): readonly Id[] => {
    const grupo: ReadonlyArray<Space | Folder | List> =
      tipo === "space" ? visibleSpaces : tipo === "folder" ? foldersUnder(pai?.id ?? "") : listsUnder(pai?.id ?? "");
    return grupo.filter((c) => memberReachesContainer(data, memberId, tipo, c.id)).map((c) => c.id);
  };

  // A4: grava por `runConfirmado`; a recusa local e a do servidor vão ao Toast de erro, e `aoGravar` só roda depois da resposta.
  const gravar = (comando: (estado: DataState, quem: Id) => OperationResult<unknown>, aoGravar?: () => void) => {
    if (gravando) return;
    const { local, confirmado } = runConfirmado(comando);
    if (!local.ok) {
      onErro(local.error);
      return;
    }
    onErro(null);
    setGravando(true);
    void confirmado.then((resposta) => {
      setGravando(false);
      if (!resposta.ok) onErro(resposta.error);
      else aoGravar?.();
    });
  };

  // Sem Toast no sucesso: a linha mudar de lugar é o aviso. Só a falha fala.
  const reordenar = (tipo: TipoDoGrupo, pai: PaiDeConteiner, id: Id, passo: -1 | 1) => {
    const ids = [...irmaos(tipo, pai)];
    const de = ids.indexOf(id);
    const para = de + passo;
    if (de < 0 || para < 0 || para >= ids.length) return;
    [ids[de], ids[para]] = [ids[para]!, ids[de]!];
    gravar((estado, quem) => reorderContainers(estado, quem, tipo, pai, ids));
  };

  // D-10: o gesto de arrastar mora no hook; a árvore só dá o que ele precisa.
  const arrasto = useArrastarNaArvore({ data, memberId, gravando, irmaos, gravar, openMover, onErro, onAviso });

  if (visibleSpaces.length === 0) {
    return <p className="app-meta px-3 py-1">Nenhum Espaço visível para você.</p>;
  }

  return (
    <OrdemDaArvoreContext.Provider value={{ ocupado: gravando, irmaos, reordenar, arrastar: arrasto.propsDaLinha }}>
      <ul aria-busy={gravando || undefined} {...arrasto.propsDaArvore}>
        {visibleSpaces.map((space) => (
          <TreeSpace
            key={space.id}
            space={space}
            inert={isGuest}
            foldersUnder={foldersUnder}
            listsUnder={listsUnder}
            openCreate={openCreate}
            openMover={openMover}
          />
        ))}
      </ul>
    </OrdemDaArvoreContext.Provider>
  );
}

type TipoDoGrupo = "space" | "folder" | "list";

/**
 * O que a árvore da Estrutura sabe e as linhas precisam para «Subir»/«Descer»:
 * os irmãos que ela mostra, o comando que grava e se há gravação em curso. Só a
 * `StructureTree` fornece; a árvore de «Meus negócios» fica sem (A9), e então
 * nenhuma linha dela ganha item de ordem.
 */
interface OrdemDaArvore {
  readonly ocupado: boolean;
  readonly irmaos: (tipo: TipoDoGrupo, pai: PaiDeConteiner) => readonly Id[];
  readonly reordenar: (tipo: TipoDoGrupo, pai: PaiDeConteiner, id: Id, passo: -1 | 1) => void;
  /** O gesto de arrastar da linha (10-13); `undefined` onde a linha não participa. */
  readonly arrastar: (no: NoDaArvore) => PropsDeArrasto | undefined;
}
const OrdemDaArvoreContext = createContext<OrdemDaArvore | null>(null);

/** O motivo dos itens de comando enquanto uma reordenação grava (T-10-51). */
const MOTIVO_GRAVANDO = "Gravando a ordem…";

type ItemDeLinha = { readonly label: string; readonly onSelect: () => void; readonly disabledReason?: string };

/**
 * «Subir» e «Descer» da linha (D-08, D-09, A6): trocam o item com o vizinho
 * VISÍVEL do mesmo grupo por `reorderContainers`. São o caminho por teclado e
 * leitor de tela da reordenação. Desligados pelo topo/fim, pela frase de
 * `recusaDeReordenar` e durante uma gravação. Vazio para o Convidado (árvore
 * inerte), para a árvore sem `StructureTree` e para a Pasta «Meus negócios» e o
 * que mora nela (A9).
 */
function useMenuDeOrdem(tipo: TipoDoGrupo, id: Id, pai: PaiDeConteiner, inert: boolean): ReadonlyArray<ItemDeLinha> {
  const ordem = useContext(OrdemDaArvoreContext);
  const { memberId } = useSession();
  const data = useData((current) => current);
  if (!ordem || inert) return [];
  if (tipo !== "space" && containerPath(data, tipo, id).some((node) => node.id === MEUS_NEGOCIOS_ID)) return [];
  const irmaos = ordem.irmaos(tipo, pai);
  const posicao = irmaos.indexOf(id);
  if (posicao < 0) return [];
  const recusa = recusaDeReordenar(data, memberId, tipo, pai);
  const motivo = (limite: string | undefined): string | undefined => recusa ?? limite ?? (ordem.ocupado ? MOTIVO_GRAVANDO : undefined);
  const subir = motivo(posicao === 0 ? "Já está no topo." : undefined);
  const descer = motivo(posicao === irmaos.length - 1 ? "Já está no fim." : undefined);
  return [
    { label: "Subir", onSelect: () => ordem.reordenar(tipo, pai, id, -1), ...(subir ? { disabledReason: subir } : {}) },
    { label: "Descer", onSelect: () => ordem.reordenar(tipo, pai, id, 1), ...(descer ? { disabledReason: descer } : {}) },
  ];
}

/**
 * O menu "⋯" de uma Pasta, Subpasta ou Lista da Estrutura: só "Mover para…"
 * (D-10). Vazio, e então sem "⋯", para o Convidado (árvore inerte, D-09), para
 * a árvore que não passa `openMover` e para a Pasta "Meus negócios" e tudo
 * dentro dela (A9). Sem permissão, o item vem desligado com a frase do domínio.
 */
function useMenuDeMover(
  tipo: "folder" | "list",
  id: Id,
  openMover: ((id: Id) => void) | undefined,
): ReadonlyArray<{ readonly label: string; readonly onSelect: () => void; readonly disabledReason?: string }> {
  const ordem = useContext(OrdemDaArvoreContext);
  const { memberId } = useSession();
  const data = useData((current) => current);
  if (!openMover) return [];
  if (containerPath(data, tipo, id).some((node) => node.id === MEUS_NEGOCIOS_ID)) return [];
  const recusa = containerAdminRefusal(data, memberId, tipo, id) ?? (ordem?.ocupado ? MOTIVO_GRAVANDO : undefined);
  return [{ label: "Mover para…", onSelect: () => openMover(id), ...(recusa ? { disabledReason: recusa } : {}) }];
}

/** As props de arrastar de uma linha da Estrutura: nenhuma fora da `StructureTree` e nenhuma para o Convidado (D-09). */
function useArrastoDaLinha(no: NoDaArvore, inert: boolean): PropsDeArrasto | undefined {
  const ordem = useContext(OrdemDaArvoreContext);
  return ordem && !inert ? ordem.arrastar(no) : undefined;
}

function TreeSpace({
  space,
  inert,
  foldersUnder,
  listsUnder,
  openCreate,
  openMover,
}: {
  readonly space: Space;
  readonly inert: boolean;
  readonly foldersUnder: (parentId: Id) => Folder[];
  readonly listsUnder: (parentId: Id) => List[];
  readonly openCreate: (kind: ContainerKind, parentType?: "space" | "folder", parentId?: string) => void;
  readonly openMover: (id: Id) => void;
}) {
  const [open, setOpen] = useState(true);
  const childFolders = foldersUnder(space.id);
  const directLists = listsUnder(space.id);
  const menu = useMenuDeOrdem("space", space.id, null, inert);
  const temFilhos = childFolders.length + directLists.length > 0;
  const arrastar = useArrastoDaLinha({ tipo: "space", id: space.id, aberto: open, temFilhosVisiveis: temFilhos, abrir: () => setOpen(true) }, inert);

  return (
    <li>
      <TreeRow
        depth={0}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        hasChildren={temFilhos}
        href={inert ? undefined : `/estrutura/espacos/${space.id}`}
        no={space.id}
        label={space.name}
        icon={<span className="size-2 rounded-sm" style={{ backgroundColor: space.color ?? "var(--cor-dom-estrutura)" }} />}
        privateContainer={space.isPrivate}
        archived={space.lifecycle === "arquivado"}
        creatable={
          inert
            ? []
            : [
                { label: "Lista", onSelect: () => openCreate("lista", "space", space.id) },
                { label: "Pasta", onSelect: () => openCreate("pasta", "space", space.id) },
              ]
        }
        menu={menu}
        {...(arrastar ? { arrastar } : {})}
      />
      {open ? (
        <ul className="surgir-rapido">
          {/* O atalho abre o Espaço: a Caixa de entrada é o que se olha primeiro. */}
          {(space.shortcuts ?? []).map((shortcut) => (
            <TreeShortcut key={shortcut.id} shortcut={shortcut} depth={1} />
          ))}
          {childFolders.map((folder) => (
            <TreeFolder
              key={folder.id}
              folder={folder}
              depth={1}
              inert={inert}
              foldersUnder={foldersUnder}
              listsUnder={listsUnder}
              openCreate={openCreate}
              openMover={openMover}
            />
          ))}
          {directLists.map((list) => (
            <TreeList key={list.id} list={list} depth={1} inert={inert} openMover={openMover} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeShortcut({ shortcut, depth }: { readonly shortcut: SpaceShortcut; readonly depth: number }) {
  const pathname = usePathname();
  const href = shortcutHref(shortcut);
  const active = pathname.startsWith("/crm/caixa-de-entrada");
  return (
    <li>
      <TreeRow
        depth={depth}
        hasChildren={false}
        href={href}
        label={shortcut.name}
        icon={<InboxIcon className="size-3.5 text-[var(--cor-tinta-fraca)]" aria-hidden="true" />}
        active={active}
      />
    </li>
  );
}

/**
 * Onde cada nó da árvore leva. A Estrutura é o padrão; o lado do CRM
 * ("Meus negócios") aponta os mesmos nós para /crm/meus-negocios/….
 */
type EnderecosDaArvore = {
  readonly pasta: (folder: Folder) => string;
  readonly lista: (list: List) => string;
  /** O "+" de uma Lista: por padrão, a nova Tarefa na própria Lista. */
  readonly novoNaLista?: { readonly rotulo: string; readonly href: (list: List) => string };
};
const ENDERECOS_DA_ESTRUTURA: EnderecosDaArvore = {
  pasta: (folder) => `/estrutura/pastas/${folder.id}`,
  lista: (list) => `/estrutura/listas/${list.id}`,
};

function TreeFolder({
  folder,
  depth,
  inert,
  foldersUnder,
  listsUnder,
  openCreate,
  openMover,
  enderecos = ENDERECOS_DA_ESTRUTURA,
}: {
  readonly folder: Folder;
  readonly depth: number;
  readonly inert: boolean;
  readonly foldersUnder: (parentId: Id) => Folder[];
  readonly listsUnder: (parentId: Id) => List[];
  readonly openCreate: (kind: ContainerKind, parentType?: "space" | "folder", parentId?: string) => void;
  /** Só a árvore da Estrutura passa: a de "Meus negócios" não tem o gesto (A9). */
  readonly openMover?: (id: Id) => void;
  readonly enderecos?: EnderecosDaArvore;
}) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  const menu = [
    ...useMenuDeMover("folder", folder.id, inert ? undefined : openMover),
    ...useMenuDeOrdem("folder", folder.id, { type: folder.parentType, id: folder.parentId }, inert),
  ];
  // A3.4 — a Subfolder never expands into another Subfolder.
  const subfolders = folder.parentType === "space" ? foldersUnder(folder.id) : [];
  const childLists = listsUnder(folder.id);
  const temFilhos = subfolders.length + childLists.length > 0;
  const arrastar = useArrastoDaLinha(
    { tipo: "folder", id: folder.id, paiTipo: folder.parentType, paiId: folder.parentId, aberto: open, temFilhosVisiveis: temFilhos, abrir: () => setOpen(true) },
    inert,
  );

  return (
    <li>
      <TreeRow
        depth={depth}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        hasChildren={temFilhos}
        href={inert ? undefined : enderecos.pasta(folder)}
        no={folder.id}
        active={pathname === enderecos.pasta(folder)}
        label={folder.name}
        icon={<FolderIcon className="size-3.5 text-[var(--cor-tinta-fraca)]" aria-hidden="true" />}
        privateContainer={folder.isPrivate}
        archived={folder.lifecycle === "arquivado"}
        creatable={
          inert
            ? []
            : [
                { label: "Lista", onSelect: () => openCreate("lista", "folder", folder.id) },
                // A3.4 — Subpasta não contém Pasta, então aqui não se oferece.
                ...(folder.parentType === "space"
                  ? [
                      {
                        label: "Subpasta",
                        onSelect: () => openCreate("pasta", "folder", folder.id),
                      },
                    ]
                  : []),
              ]
        }
        menu={menu}
        {...(arrastar ? { arrastar } : {})}
      />
      {open ? (
        <ul className="surgir-rapido">
          {subfolders.map((sub) => (
            <TreeFolder
              key={sub.id}
              folder={sub}
              depth={depth + 1}
              inert={inert}
              foldersUnder={foldersUnder}
              listsUnder={listsUnder}
              openCreate={openCreate}
              openMover={openMover}
              enderecos={enderecos}
            />
          ))}
          {childLists.map((list) => (
            <TreeList key={list.id} list={list} depth={depth + 1} inert={inert} openMover={openMover} enderecos={enderecos} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeList({
  list,
  depth,
  inert = false,
  openMover,
  enderecos = ENDERECOS_DA_ESTRUTURA,
}: {
  readonly list: List;
  readonly depth: number;
  readonly inert?: boolean;
  /** Só a árvore da Estrutura passa: a de "Meus negócios" não tem o gesto (A9). */
  readonly openMover?: (id: Id) => void;
  readonly enderecos?: EnderecosDaArvore;
}) {
  const pathname = usePathname();
  const [navegar] = useNavegar();
  const menu = [
    ...useMenuDeMover("list", list.id, inert ? undefined : openMover),
    ...useMenuDeOrdem("list", list.id, { type: list.parentType, id: list.parentId }, inert),
  ];
  const arrastar = useArrastoDaLinha({ tipo: "list", id: list.id, paiTipo: list.parentType, paiId: list.parentId, aberto: true, temFilhosVisiveis: false }, inert);
  const href = enderecos.lista(list);
  const novo = enderecos.novoNaLista ?? {
    // Dentro de uma Lista o que se cria é Tarefa, e o campo dela já vive na
    // tela da Lista: o "+" leva até ele em vez de abrir um segundo.
    rotulo: "Tarefa",
    href: (l: List) => `/estrutura/listas/${l.id}?nova-tarefa=1`,
  };
  return (
    <li>
      <TreeRow
        depth={depth}
        hasChildren={false}
        href={href}
        no={list.id}
        label={list.name}
        // C35 — a Lista conversacional se lê na árvore: o balão no lugar da lista de tarefas.
        icon={
          list.modeloDeTarefa === "conversacional" ? (
            <MessageSquare className="size-3.5 text-[var(--cor-tinta-fraca)]" aria-hidden="true" />
          ) : (
            <ListTodo className="size-3.5 text-[var(--cor-tinta-fraca)]" aria-hidden="true" />
          )
        }
        privateContainer={list.isPrivate}
        archived={list.lifecycle === "arquivado"}
        active={pathname === href}
        creatable={
          list.lifecycle === "ativo"
            ? [{ label: novo.rotulo, onSelect: () => navegar(novo.href(list)) }]
            : []
        }
        menu={menu}
        {...(arrastar ? { arrastar } : {})}
      />
    </li>
  );
}

/**
 * As Sessões de Chat como submenu: pasta → Sessões, e as soltas direto sob
 * "Chat". É a mesma árvore da Estrutura, com a mesma linha, para o menu não
 * ter duas gramáticas. Só as MINHAS: pasta e Sessão são do Membro (DO-CHT-09).
 *
 * Dois GRUPOS com título (2026-09-28: "preciso que haja uma separação entre
 * as pastas e os chats sem pastas"): "Pastas", com o "Nova pasta" no fim (é
 * dele que a pasta nasce), e "Chats", as Sessões soltas, depois de um
 * hairline (o nome pedido em seguida: "troque por chats, coloque um ícone de
 * + para começar um novo chat"). O "+" do título leva à home do Chat, onde a
 * Sessão nasce da primeira mensagem; já estando lá, põe o cursor no campo.
 * O grupo "Chats" aparece sempre, mesmo vazio, por causa do "+"; sem pasta,
 * o primeiro fica só com o "Nova pasta".
 */
function ChatTree({
  pathname,
  onNotice,
}: {
  readonly pathname: string;
  readonly onNotice: (message: string) => void;
}) {
  const { memberId } = useSession();
  const run = useRun();
  const { dialogs, openCreate, openRename, openDelete } = useChatFolderDialogs(onNotice);
  const idDasPastas = useId();
  const idDasSoltas = useId();
  // O seletor devolve o estado inteiro: um seletor que filtra cria um array
  // novo a cada leitura, e o instantâneo do servidor precisa ser estável.
  const state = useData((data) => data);
  const folders = state.chatFolders
    .filter((folder) => folder.ownerMemberId === memberId)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const sessions = state.chatSessions.filter(
    (s) => s.ownerMemberId === memberId && s.lifecycle !== "naLixeira",
  );
  const activeId = pathname.startsWith("/ia/chat/") ? pathname.slice("/ia/chat/".length) : null;
  const activeFolder = sessions.find((s) => s.id === activeId)?.folderId ?? null;
  // Sem escolha explícita, só a pasta da Sessão em que estou fica aberta.
  const [escolhas, setEscolhas] = useState<Readonly<Record<Id, boolean>>>({});
  const aberta = (id: Id) => escolhas[id] ?? id === activeFolder;
  const toggle = (id: Id) => setEscolhas((atual) => ({ ...atual, [id]: !aberta(id) }));

  const loose = sessions.filter((s) => !s.folderId || !folders.some((f) => f.id === s.folderId));

  const mover = (sessionId: Id, folderId: Id | null, message: string) => {
    const result = run((data, id) => moveChatSessionToFolder(data, id, sessionId, folderId));
    onNotice(result.ok ? message : result.error);
  };

  /*
    Todos os títulos na mesma coluna: pasta, Sessão dentro dela, Sessão solta e
    "Nova pasta". A Sessão não tem ícone, mas ocupa o lugar dele em branco, e
    a de dentro da pasta fica no mesmo nível — o que a separa é estar sob a
    pasta aberta, não um recuo a mais.
  */
  const sessionRow = (session: (typeof sessions)[number]) => (
    <TreeRow
      key={session.id}
      depth={1}
      label={session.title}
      icon={<span className="size-3.5 shrink-0" aria-hidden="true" />}
      href={`/ia/chat/${session.id}`}
      hasChildren={false}
      active={session.id === activeId}
      menu={[
        ...folders
          .filter((folder) => folder.id !== session.folderId)
          .map((folder) => ({
            label: `Mover para ${folder.name}`,
            onSelect: () => mover(session.id, folder.id, `Guardada em ${folder.name}.`),
          })),
        ...(session.folderId
          ? [{ label: "Tirar da pasta", onSelect: () => mover(session.id, null, "Sessão fora de pasta.") }]
          : []),
      ]}
    />
  );

  return (
    <div className="mb-1">
      {dialogs}
      <div role="group" aria-labelledby={idDasPastas}>
        <p id={idDasPastas} className="app-coluna chat-arvore-grupo">
          Pastas
        </p>
        {folders.map((folder) => {
          const inside = sessions.filter((s) => s.folderId === folder.id);
          return (
            <div key={folder.id}>
              <TreeRow
                depth={1}
                label={folder.name}
                icon={<FolderIcon className="size-3.5 shrink-0 text-[var(--cor-tinta-fraca)]" aria-hidden="true" />}
                open={aberta(folder.id)}
                onToggle={() => toggle(folder.id)}
                hasChildren
                menu={[
                  { label: "Renomear", onSelect: () => openRename(folder) },
                  { label: "Excluir pasta", destructive: true, onSelect: () => openDelete(folder) },
                ]}
              />
              {aberta(folder.id)
                ? inside.length > 0
                  ? inside.map((session) => sessionRow(session))
                  : (
                      <p
                        className="app-meta truncate py-1"
                        style={{ paddingLeft: `${12 + 24 + 6 + 14 + 6}px` }}
                      >
                        Pasta vazia
                      </p>
                    )
                : null}
            </div>
          );
        })}
        {/* Como o "Novo projeto" do ChatGPT: a pasta nasce onde ela vai morar. */}
        <div className="flex items-center">
          <span className="w-6 shrink-0" style={{ marginLeft: "12px" }} />
          <button
            type="button"
            onClick={openCreate}
            className="app-base flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-controle)] px-2 text-[var(--texto-3)] transition-colors hover:bg-[var(--superficie-hover)] hover:text-[var(--texto)]"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Nova pasta</span>
          </button>
        </div>
      </div>
      <div role="group" aria-labelledby={idDasSoltas} className="chat-arvore-soltas">
        <div className="chat-arvore-grupo chat-arvore-grupo-com-acao">
          <span id={idDasSoltas} className="app-coluna">
            Chats
          </span>
          <Link
            href="/ia/chat"
            aria-label="Novo chat"
            title="Novo chat"
            className="chat-arvore-novo"
            onNavigate={() => marcarSeMuda("/ia/chat")}
            onClick={() => {
              // Já na home do Chat, não há para onde ir: o "+" põe o cursor no campo.
              if (pathname === "/ia/chat") document.getElementById("comeco-do-chat")?.focus();
            }}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        {loose.map((session) => sessionRow(session))}
      </div>
    </div>
  );
}

/** Reserva para quando o navegador não guarda nada: a escolha vale nesta visita. */
