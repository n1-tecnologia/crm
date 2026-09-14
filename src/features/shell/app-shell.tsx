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
 * Pasta → Subpasta → Lista. Tarefas nunca aparecem nela (A3.2). CRM, IA e
 * Painéis são pares de ESTRUTURA, nunca aninhados sob ela (A2.2) — por isso
 * cada um é um assunto do trilho.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Contact,
  Folder as FolderIcon,
  Handshake,
  Home,
  Inbox as InboxIcon,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Split,
  Target,
  type LucideIcon,
} from "lucide-react";
import { ActionMenu, ActorAvatar, Toast } from "@/design/components";
import { Icone } from "@/design/icone";
import type { ContainerKind } from "@/features/estrutura/create-container-dialog";
import { shortcutHref } from "@/features/estrutura/shortcuts";
import { BrandMark } from "./brand";

import { useData, useRun, useSession } from "@/data/store";
import { moveChatSessionToFolder } from "@/data/operations";
import { useChatFolderDialogs } from "@/features/ia/chat-folder-dialogs";
import { memberReachesContainer, memberSeesResource } from "@/data/derive";
import { useSidebarCollapsed } from "./use-sidebar";
import {
  CreateContainerDialog,
  useCreateContainerDialog,
} from "@/features/estrutura/create-container-dialog";
import type { Folder, Id, List, Space, SpaceShortcut } from "@/data/types";

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
  readonly chave: "trabalho" | "crm" | "ia" | "paineis";
  readonly rotulo: string;
  readonly icone: LucideIcon;
  /** O assunto "Trabalho" desenha a árvore de Espaços abaixo das telas. */
  readonly comArvore?: boolean;
  /** O assunto "IA" desenha as Sessões de Chat abaixo das telas. */
  readonly comChat?: boolean;
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
    chave: "paineis",
    rotulo: "Painéis",
    icone: LayoutDashboard,
    telas: [{ href: "/paineis", rotulo: "Painéis", icone: LayoutDashboard, prefixo: true }],
  },
];

/** A rota manda no trilho, nunca o clique: chegar por link acende o certo. */
function assuntoDe(pathname: string): Assunto {
  if (pathname.startsWith("/crm")) return ASSUNTOS[1]!;
  if (pathname.startsWith("/ia")) return ASSUNTOS[2]!;
  if (pathname.startsWith("/paineis")) return ASSUNTOS[3]!;
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
  return (
    <div className="relative flex h-screen overflow-hidden" style={{ zIndex: "var(--z-conteudo)" }}>
      {collapsed ? null : <Navegacao onRecolher={toggle} />}
      <div className="flex min-w-0 flex-1 flex-col">
        {collapsed ? (
          <div className="shrink-0 px-2 py-2">
            <button type="button" onClick={toggle} aria-label="Abrir o menu" title="Abrir o menu" className="btn-icone btn-icone-nu">
              <Icone de={ChevronRight} tamanho="xs" />
            </button>
          </div>
        ) : null}
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
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto" style={{ background: "var(--page)" }}>
          {hidratado ? children : null}
        </main>
      </div>
    </div>
  );
}

function Navegacao({ onRecolher }: { readonly onRecolher: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const pendingApprovals = useData((data) => data.approvals.filter((a) => a.decision === undefined).length);
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { creating, openCreate, closeCreate } = useCreateContainerDialog();
  const session = useSession();
  const member = useData((data) => data.members.find((m) => m.id === session.memberId));
  const workspace = useData((data) => data.workspace.name);

  const assunto = assuntoDe(pathname);

  return (
    <div className="flex h-full shrink-0">
      {/* ── Etapa 1: o trilho de assuntos ── */}
      <nav
        aria-label="Assuntos"
        className="flex shrink-0 flex-col items-center gap-1 py-2"
        style={{ width: "var(--trilha-w)", borderRight: "1px solid var(--linha)", background: "var(--page)" }}
      >
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
          return (
            <button
              key={a.chave}
              type="button"
              onClick={() => router.push(a.telas[0]!.href)}
              aria-label={a.rotulo}
              aria-current={ativo ? "page" : undefined}
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
              <Icone de={a.icone} />
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
          e vivem em `/minha-conta`. O menu continua ancorado aqui — sem ele,
          "Trocar de Membro" não teria como ser alcançado de tela nenhuma.
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
            { label: "Minha conta", onSelect: () => router.push("/minha-conta") },
            { label: "Notificações", onSelect: () => router.push("/notificacoes") },
            { label: "Trocar de Membro", onSelect: () => router.push("/entrar") },
          ]}
        />
      </nav>

      {/* ── Etapa 2: o painel do assunto ── */}
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

        <p className="ed-secao px-3 pb-1 pt-1">{assunto.rotulo}</p>

        <nav className="sem-barra min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {assunto.telas.map((t) => {
            const ativo = telaAtiva(pathname, t);
            const contador = t.href === "/notificacoes" ? pendingApprovals : 0;
            return (
              <Link
                key={t.href}
                href={t.href}
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
                <span className="min-w-0 flex-1 truncate">{t.rotulo}</span>
                {contador > 0 ? (
                  <span className="app-xs app-numero rounded-full px-1.5" style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}>
                    {contador}
                  </span>
                ) : null}
              </Link>
            );
          })}

          {assunto.comArvore ? (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-1 pb-1 pl-3 pr-1">
                <span className="ed-secao">Espaços</span>
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
              </div>
              <StructureTree showArchived={showArchived} openCreate={openCreate} />
              <button
                type="button"
                onClick={() => setShowArchived((value) => !value)}
                className="app-meta mt-1 w-full rounded-[var(--r-controle)] px-3 py-1 text-left transition-colors hover:bg-[var(--superficie-hover)]"
              >
                {showArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
              </button>
              <SharedTasks />
            </div>
          ) : null}

          {assunto.comChat ? (
            <div className="mt-3">
              <p className="ed-secao pb-1 pl-3">Sessões</p>
              <ChatTree pathname={pathname} onNotice={setNotice} />
            </div>
          ) : null}
        </nav>

        <CreateContainerDialog
          target={creating}
          onClose={closeCreate}
          onDone={(message, href) => {
            setNotice(message);
            router.push(href);
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
        <ul>
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

function TreeFolder({
  folder,
  depth,
  inert,
  foldersUnder,
  listsUnder,
  openCreate,
}: {
  readonly folder: Folder;
  readonly depth: number;
  readonly inert: boolean;
  readonly foldersUnder: (parentId: Id) => Folder[];
  readonly listsUnder: (parentId: Id) => List[];
  readonly openCreate: (kind: ContainerKind, parentType?: "space" | "folder", parentId?: string) => void;
}) {
  const [open, setOpen] = useState(true);
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
        href={inert ? undefined : `/estrutura/pastas/${folder.id}`}
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
        <ul>
          {subfolders.map((sub) => (
            <TreeFolder
              key={sub.id}
              folder={sub}
              depth={depth + 1}
              inert={inert}
              foldersUnder={foldersUnder}
              listsUnder={listsUnder}
              openCreate={openCreate}
            />
          ))}
          {childLists.map((list) => (
            <TreeList key={list.id} list={list} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeList({ list, depth }: { readonly list: List; readonly depth: number }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <li>
      <TreeRow
        depth={depth}
        hasChildren={false}
        href={`/estrutura/listas/${list.id}`}
        label={list.name}
        icon={<ListTodo className="size-3.5 text-[var(--cor-tinta-fraca)]" aria-hidden="true" />}
        privateContainer={list.isPrivate}
        archived={list.lifecycle === "arquivado"}
        active={pathname === `/estrutura/listas/${list.id}`}
        creatable={
          // Dentro de uma Lista o que se cria é Tarefa, e o campo dela já vive
          // na tela da Lista: o "+" leva até ele em vez de abrir um segundo.
          list.lifecycle === "ativo"
            ? [
                {
                  label: "Tarefa",
                  onSelect: () => router.push(`/estrutura/listas/${list.id}?nova-tarefa=1`),
                },
              ]
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
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ) : (
        <span className="w-6 shrink-0" style={{ marginLeft: `${depth * 12}px` }} />
      )}
      {href ? (
        <Link
          href={href}
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



/**
 * Tarefas compartilhadas diretamente com este Membro (concessão na própria
 * Tarefa) cuja Lista ele não alcança pela árvore — a Pessoa da conta a pagar,
 * por exemplo. Sem isto, o único caminho até elas seria a URL.
 */
function SharedTasks() {
  const { memberId } = useSession();
  const tasks = useData((data) =>
    data.grants
      .filter((g) => g.resourceType === "task" && g.subjectKind === "member" && g.subjectId === memberId)
      .map((g) => data.tasks.find((t) => t.id === g.resourceId))
      .filter((t): t is NonNullable<typeof t> => t !== undefined && t.lifecycle === "ativo")
      .filter((t) => !memberReachesContainer(data, memberId, "list", t.listId)),
  );
  const pathname = usePathname();
  if (tasks.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="app-meta px-3 py-1">Compartilhadas comigo</p>
      <ul>
        {tasks.map((t) => (
          <li key={t.id}>
            <Link
              href={`/estrutura/tarefas/${t.id}`}
              className={`app-base block truncate rounded-[var(--r-controle)] px-3 py-1 transition-colors hover:bg-[var(--superficie-hover)] ${pathname === `/estrutura/tarefas/${t.id}` ? "bg-[var(--acento-lavado)] text-[var(--texto)]" : "text-[var(--texto-2)]"}`}
            >
              {t.title}
              {t.dueDate ? <span className="text-[var(--texto-4)]"> · vence {t.dueDate.value.slice(0, 10).split("-").reverse().slice(0, 2).join("/")}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
