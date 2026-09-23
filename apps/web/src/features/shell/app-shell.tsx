"use client";

/**
 * A CASCA EM DUAS ETAPAS, como o ClickUp — e como o CRM-COMPLETO.
 *
 * Trilho estreito (56px) = ASSUNTO. Painel (232px) = as telas daquele assunto.
 * O assunto segue a rota: entrar em /crm/contatos acende "CRM" sozinho, e por
 * isso navegar por link ou por busca nunca deixa o trilho mentindo.
 *
 * NÃO HÁ BARRA DE TOPO. Ela carregava marca, busca e conta e gastava uma faixa
 * inteira da altura para isso, com um vão enorme no meio. As três desceram para
 * o trilho e para o painel, onde já há coluna. O que sobra em cima é a tela.
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
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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
  Lock,
  MessageSquare,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Split,
  Target,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ActionMenu, ActorAvatar, Toast } from "@/design/components";
import { Icone } from "@/design/icone";
import { CarregadorDeIcones } from "@/design/carregador";
import { EsqueletoDeTela } from "@/design/esqueletos";
import { BarraDeRota } from "./barra-de-rota";
import { CascataDeNavegacao, Chegada } from "./chegada";
import { limpar, marcarSeMuda, useAlvo, useNavegando, useNavegar } from "./navegacao";
import { PendenciaDoLink } from "./pendencia-do-link";
import { chaveDeChegada, formaDe } from "./rotas";
import type { ContainerKind } from "@/features/estrutura/create-container-dialog";
import { shortcutHref } from "@/features/estrutura/shortcuts";
import { BrandMark } from "./brand";

import { useData, useRun, useSession } from "@/dados/store";
import { MEUS_NEGOCIOS_ID } from "@n1/dominio/seed-comercial";
import { moveChatSessionToFolder } from "@n1/dominio/operations";
import { useChatFolderDialogs } from "@/features/ia/chat-folder-dialogs";
import { memberSeesResource } from "@n1/dominio/derive";
import { useSidebarCollapsed } from "./use-sidebar";
import { TarefasCompartilhadas } from "./compartilhadas-comigo";
import {
  CreateContainerDialog,
  useCreateContainerDialog,
} from "@/features/estrutura/create-container-dialog";
import type { Folder, Id, List, Space, SpaceShortcut } from "@n1/dominio/types";

/**
 * `true` só depois de o React assumir a página no navegador. No servidor e na
 * primeira renderização do cliente devolve `false`, sempre — é esse "sempre"
 * que faz o HTML dos dois lados bater.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/* ─────────────────────────────────────────────────────── os assuntos */

type Tela = {
  readonly href: string;
  readonly rotulo: string;
  readonly icone: LucideIcon;
  /** Casa também os descendentes: /crm/contatos/123 acende "Contatos". */
  readonly prefixo?: boolean;
};

type Assunto = {
  readonly chave: "trabalho" | "crm" | "ia" | "ferramentas" | "paineis";
  readonly rotulo: string;
  readonly icone: LucideIcon;
  /** O assunto "Trabalho" desenha a árvore de Espaços abaixo das telas. */
  readonly comArvore?: boolean;
  /** O assunto "IA" desenha as Sessões de Chat abaixo das telas. */
  readonly comChat?: boolean;
  /** O assunto "CRM" desenha as Listas de "Meus negócios" (uma por Funil) abaixo das telas. */
  readonly comMeusNegocios?: boolean;
  readonly telas: ReadonlyArray<Tela>;
};

const ASSUNTOS: ReadonlyArray<Assunto> = [
  {
    chave: "trabalho",
    rotulo: "Trabalho",
    icone: Home,
    comArvore: true,
    telas: [
      { href: "/", rotulo: "Início", icone: Home },
      { href: "/notificacoes", rotulo: "Notificações", icone: Bell },
      { href: "/estrutura", rotulo: "Visão geral", icone: LayoutGrid },
      { href: "/estrutura/tarefas", rotulo: "Minhas Tarefas", icone: ListTodo, prefixo: true },
      { href: "/estrutura/metas", rotulo: "Metas", icone: Target, prefixo: true },
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
        Agente, Habilidades, Automação, Conhecimento, Conectores, Plugins.
        Aprovações continua alcançável pela Início e pelas Notificações.
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

/** Encerra a sessão. É POST porque encerrar sessão muda estado; a rota redireciona para `/entrar`. */
function sair(): void {
  const form = document.createElement("form");
  form.method = "post";
  form.action = "/sair";
  document.body.appendChild(form);
  form.submit();
}

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
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { creating, openCreate, closeCreate } = useCreateContainerDialog();
  const session = useSession();
  const member = useData((data) => data.members.find((m) => m.id === session.memberId));
  const workspace = useData((data) => data.workspace.name);

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

        {ASSUNTOS.map((a) => {
          const ativo = a.chave === assunto.chave;
          const contador = a.chave === "ia" ? pendingApprovals : 0;
          // O botão clicado pulsa (com a carência de 150ms) até a rota chegar.
          const pendenteAqui = !ativo && alvoCaminho !== null && chaveDoTrilho(alvoCaminho) === a.chave;
          return (
            <button
              key={a.chave}
              type="button"
              data-trilho={a.chave}
              onClick={() => navegar(a.telas[0]!.href)}
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

        {/*
          Avatar e nome, e nada mais. O Papel e a Disponibilidade são do Membro
          e vivem em `/minha-conta`. "Sair" mora aqui porque é a única ação de
          Usuário (não de Membro) que a casca oferece.
        */}
        <ActionMenu
          label={member?.displayName ?? "Escolher Membro"}
          trigger={
            <span className="mt-1 grid place-items-center" style={{ width: "var(--item-trilha)", height: "var(--item-trilha)" }}>
              <ActorAvatar
                kind="member"
                name={member?.displayName ?? "?"}
                size="grande"
                {...(member?.photoFileId ? { photoFileId: member.photoFileId } : {})}
              />
            </span>
          }
          items={[
            { label: "Minha conta", onSelect: () => navegar("/minha-conta") },
            { label: "Notificações", onSelect: () => navegar("/notificacoes") },
            { label: "Sair", onSelect: () => sair() },
          ]}
        />
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

        <div className="px-2 pb-2">
          <Link
            href="/buscar"
            className="flutua flex w-full items-center gap-2 px-3 text-left"
            style={{
              height: "var(--controle-h-sm)",
              borderRadius: "var(--r-pilula)",
              background: "var(--superficie-2)",
              border: "1px solid var(--linha)",
              color: "var(--texto-4)",
            }}
          >
            <Icone de={Search} tamanho="xs" />
            <span className="app-sm flex-1">Buscar</span>
            <span className="app-xs">/</span>
          </Link>
        </div>

        {/* Chaveado pelo assunto: o painel esmaece e as telas caem em cascata na troca. */}
        <CascataDeNavegacao key={assunto.chave} className="sem-barra min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <RotuloDeGrupo>{assunto.rotulo}</RotuloDeGrupo>
          {assunto.telas.map((t) => {
            const ativo = telaAtiva(pathname, t);
            const contador = t.href === "/notificacoes" ? pendingApprovals : 0;
            return (
              <Link
                key={t.href}
                href={t.href}
                onNavigate={() => marcarSeMuda(t.href)}
                aria-current={ativo ? "page" : undefined}
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
                  <span className="app-xs app-numero rounded-full px-1.5" style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}>
                    {contador}
                  </span>
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
              <StructureTree showArchived={showArchived} openCreate={openCreate} />
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
        {notice ? (
          <div className="px-2 pb-2">
            <Toast tone="success" onDismiss={() => setNotice(null)}>
              {notice}
            </Toast>
          </div>
        ) : null}
      </aside>
      )}
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
}: {
  readonly showArchived: boolean;
  readonly openCreate: (kind: ContainerKind, parentType?: "space" | "folder", parentId?: string) => void;
}) {
  const { memberId } = useSession();
  const data = useData((current) => current);
  const { spaces, folders, lists } = data;

  const visibleList = (list: List): boolean => {
    if (list.lifecycle === "naLixeira") return false;
    if (list.lifecycle === "arquivado" && !showArchived) return false;
    // A MESMA leitura que os Painéis usam: a barra e o número não podem
    // discordar sobre o que este Membro alcança.
    return memberSeesResource(data, memberId, list.id);
  };

  const listsUnder = (parentId: Id) => lists.filter((l) => l.parentId === parentId).filter(visibleList);

  const foldersUnder = (parentId: Id): Folder[] =>
    folders
      .filter((f) => f.parentId === parentId)
      .filter((f) => f.lifecycle !== "naLixeira")
      .filter((f) => f.lifecycle !== "arquivado" || showArchived);

  const spaceHasVisibleContent = (space: Space): boolean => {
    if (listsUnder(space.id).length > 0) return true;
    return foldersUnder(space.id).some(
      (folder) => listsUnder(folder.id).length > 0 || foldersUnder(folder.id).some((sub) => listsUnder(sub.id).length > 0),
    );
  };

  const isGuest =
    data.roles.find((r) => r.id === data.members.find((m) => m.id === memberId)?.roleId)?.base ===
    "convidado";

  const visibleSpaces = spaces
    .filter((s) => s.lifecycle !== "naLixeira")
    .filter((s) => s.lifecycle !== "arquivado" || showArchived)
    // B38a vive em memberSeesResource: o contêiner privado sem concessão não
    // existe aqui, e o Convidado só chega ao que lhe foi concedido.
    .filter((s) => memberSeesResource(data, memberId, s.id))
    .filter((s) => !isGuest || spaceHasVisibleContent(s))
    .sort((a, b) => a.order - b.order);

  if (visibleSpaces.length === 0) {
    return <p className="app-meta px-3 py-1">Nenhum Espaço visível para você.</p>;
  }

  return (
    <ul>
      {visibleSpaces.map((space) => (
        <TreeSpace
          key={space.id}
          space={space}
          inert={isGuest}
          foldersUnder={foldersUnder}
          listsUnder={listsUnder}
          openCreate={openCreate}
        />
      ))}
    </ul>
  );
}

function TreeSpace({
  space,
  inert,
  foldersUnder,
  listsUnder,
  openCreate,
}: {
  readonly space: Space;
  readonly inert: boolean;
  readonly foldersUnder: (parentId: Id) => Folder[];
  readonly listsUnder: (parentId: Id) => List[];
  readonly openCreate: (kind: ContainerKind, parentType?: "space" | "folder", parentId?: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const childFolders = foldersUnder(space.id);
  const directLists = listsUnder(space.id);

  return (
    <li>
      <TreeRow
        depth={0}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        hasChildren={childFolders.length + directLists.length > 0}
        href={inert ? undefined : `/estrutura/espacos/${space.id}`}
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
            />
          ))}
          {directLists.map((list) => (
            <TreeList key={list.id} list={list} depth={1} />
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
  enderecos = ENDERECOS_DA_ESTRUTURA,
}: {
  readonly folder: Folder;
  readonly depth: number;
  readonly inert: boolean;
  readonly foldersUnder: (parentId: Id) => Folder[];
  readonly listsUnder: (parentId: Id) => List[];
  readonly openCreate: (kind: ContainerKind, parentType?: "space" | "folder", parentId?: string) => void;
  readonly enderecos?: EnderecosDaArvore;
}) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  // A3.4 — a Subfolder never expands into another Subfolder.
  const subfolders = folder.parentType === "space" ? foldersUnder(folder.id) : [];
  const childLists = listsUnder(folder.id);

  return (
    <li>
      <TreeRow
        depth={depth}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        hasChildren={subfolders.length + childLists.length > 0}
        href={inert ? undefined : enderecos.pasta(folder)}
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
              enderecos={enderecos}
            />
          ))}
          {childLists.map((list) => (
            <TreeList key={list.id} list={list} depth={depth + 1} enderecos={enderecos} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeList({
  list,
  depth,
  enderecos = ENDERECOS_DA_ESTRUTURA,
}: {
  readonly list: List;
  readonly depth: number;
  readonly enderecos?: EnderecosDaArvore;
}) {
  const pathname = usePathname();
  const [navegar] = useNavegar();
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
        label={list.name}
        icon={<ListTodo className="size-3.5 text-[var(--cor-tinta-fraca)]" aria-hidden="true" />}
        privateContainer={list.isPrivate}
        archived={list.lifecycle === "arquivado"}
        active={pathname === href}
        creatable={
          list.lifecycle === "ativo"
            ? [{ label: novo.rotulo, onSelect: () => navegar(novo.href(list)) }]
            : []
        }
      />
    </li>
  );
}

/**
 * As Sessões de Chat como submenu: pasta → Sessões, e as soltas direto sob
 * "Chat". É a mesma árvore da Estrutura, com a mesma linha, para o menu não
 * ter duas gramáticas. Só as MINHAS: pasta e Sessão são do Membro (DO-CHT-09).
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
      {loose.map((session) => sessionRow(session))}
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
  );
}

function TreeRow({
  depth,
  label,
  icon,
  href,
  open,
  onToggle,
  hasChildren,
  privateContainer,
  archived,
  active,
  creatable,
  menu,
}: {
  readonly depth: number;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly href?: string;
  readonly open?: boolean;
  readonly onToggle?: () => void;
  readonly hasChildren: boolean;
  readonly privateContainer?: boolean;
  readonly archived?: boolean;
  readonly active?: boolean;
  /** O que este contêiner aceita dentro dele (A3). Vazio esconde o "+". */
  readonly creatable?: ReadonlyArray<{ readonly label: string; readonly onSelect: () => void }>;
  /** Ações sobre a própria linha. Vazio esconde o "⋯". */
  readonly menu?: ReadonlyArray<{
    readonly label: string;
    readonly onSelect: () => void;
    readonly destructive?: boolean;
  }>;
}) {
  const content = (
    <>
      {icon}
      <span className="truncate">{label}</span>
      {privateContainer ? <Lock className="size-3 text-[var(--cor-tinta-fraca)]" aria-label="Contêiner privado" /> : null}
      {archived ? <span className="app-meta" style={{ color: "var(--aviso)" }}>arquivado</span> : null}
    </>
  );

  return (
    <div className="group/linha flex items-center">
      {hasChildren && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? `Recolher ${label}` : `Expandir ${label}`}
          aria-expanded={open}
          // Alvo de 24px: a seta desenhada tem 14px, e mirar nela erra para o
          // link ao lado, que navega em vez de recolher.
          className="grid size-6 shrink-0 place-items-center rounded-[var(--r-controle)] text-[var(--texto-4)] transition-colors hover:bg-[var(--superficie-hover)] hover:text-[var(--texto)]"
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <ChevronRight className="seta-recolhe size-3.5" data-aberto={open ? "true" : "false"} />
        </button>
      ) : (
        <span className="w-6 shrink-0" style={{ marginLeft: `${depth * 12}px` }} />
      )}
      {href ? (
        <Link
          href={href}
          onNavigate={() => marcarSeMuda(href)}
          className={`app-base flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-controle)] px-2 transition-colors ${
            active ? "bg-[var(--acento-lavado)] font-medium text-[var(--texto)]" : "text-[var(--texto-2)] hover:bg-[var(--superficie-hover)] hover:text-[var(--texto)]"
          }`}
        >
          {content}
        </Link>
      ) : (
        // B38e — the ancestor name exists ONLY for navigation: inert, never a
        // clickable element that does nothing (PADROES §11).
        // O recuo já veio do espaçador ao lado: repeti-lo aqui empurrava o
        // nome inerte 14px para a direita dos irmãos com link.
        <span
          aria-disabled="true"
          title="Nome exibido apenas para navegação."
          className="app-base flex min-w-0 flex-1 cursor-default items-center gap-2 px-2 text-[var(--texto-4)]"
        >
          {content}
        </span>
      )}
      {creatable && creatable.length > 0 ? (
        // Aparece no hover e no foco do teclado: um controle que só existe sob
        // o ponteiro é um controle que o teclado não tem.
        <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/linha:opacity-100">
          <ActionMenu
            label={`Criar dentro de ${label}`}
            trigger={
              <span className="grid size-6 place-items-center rounded-[var(--r-controle)] text-[var(--texto-4)] transition-colors hover:bg-[var(--superficie-hover)] hover:text-[var(--texto)]">
                <Plus className="size-3.5" aria-hidden="true" />
              </span>
            }
            items={creatable.map((item) => ({ label: item.label, onSelect: item.onSelect }))}
          />
        </span>
      ) : null}
      {menu && menu.length > 0 ? (
        <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/linha:opacity-100">
          <ActionMenu label={`Ações de ${label}`} items={menu} />
        </span>
      ) : null}
    </div>
  );
}

/** Reserva para quando o navegador não guarda nada: a escolha vale nesta visita. */
