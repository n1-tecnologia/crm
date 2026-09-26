"use client";

/**
 * A BARRA GLOBAL — o que é da PESSOA, à vista em qualquer assunto.
 *
 * Uma faixa de 40px no topo da coluna da tela: a busca no centro (atalho "/"),
 * e à direita o que espera por mim — Minhas Tarefas (vencidas), Notificações
 * (o mesmo total da tela T51) — e a conta. A barra de topo tinha saído em
 * 2026-09-14 por carregar marca, busca e conta com um vão no meio; voltou em
 * 2026-09-17 mais baixa e com outro conteúdo: a marca fica no trilho, o
 * Espaço de Trabalho no painel, e aqui só o que é meu. Assim o painel do
 * Trabalho deixa de misturar "minhas coisas" com a estrutura.
 *
 * É casca: fica fora do invólucro de chegada, nunca remonta na troca de rota
 * e não anima — só o número que mudou surge (150ms). As contagens dependem de
 * "hoje" (`isOverdue`) e do seed do processo, por isso só entram depois da
 * hidratação — o badge, o `title` e o texto do leitor de tela, todos: a barra
 * vai no HTML do servidor, e um servidor de desenvolvimento que atravessa a
 * meia-noite UTC descreveria ontem ali, contra o hoje do navegador (erro de
 * hidratação em toda tela, porque a barra é casca).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ListTodo, Search, type LucideIcon } from "lucide-react";
import { useData, useSession } from "@/dados/store";
import { isOverdue, notificacoesDoMembro, tarefasAbertasDoMembro } from "@n1/dominio/derive";
import { ActionMenu, ActorAvatar } from "@/design/components";
import { Icone } from "@/design/icone";
import { useHidratado } from "./hidratado";
import { marcarSeMuda, useNavegar } from "./navegacao";
import { PendenciaDoLink } from "./pendencia-do-link";
import { sair } from "./sair";

/** Um campo de texto, um seletor ou algo editável: o "/" ali é texto, não atalho. */
function alvoEditavel(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  if (alvo.isContentEditable) return true;
  const tag = alvo.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function BarraGlobal() {
  const pathname = usePathname();
  const hidratado = useHidratado();
  const [navegar] = useNavegar();
  const state = useData((data) => data);
  const { memberId } = useSession();
  const member = state.members.find((m) => m.id === memberId);
  // "Hoje" é fixado na montagem: as contagens não mudam sozinhas à meia-noite (nem precisam).
  const [now] = useState(() => new Date());

  const abertas = tarefasAbertasDoMembro(state, memberId);
  const vencidas = abertas.filter((task) => isOverdue(state, task, now));
  const notificacoes = notificacoesDoMembro(state, memberId, now);

  /*
    O atalho "/": abre a busca de qualquer tela, como no painel antigo prometia
    com um caractere desenhado. Não dispara com modificador, dentro de um campo
    ou com um diálogo aberto; em /buscar, só devolve o foco ao campo.
  */
  useEffect(() => {
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (alvoEditavel(event.target) || document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      if (pathname === "/buscar") {
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
        return;
      }
      navegar("/buscar");
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [navegar, pathname]);

  return (
    <header className="barra-global" aria-label="Busca, pendências e conta">
      {/* A primeira coluna fica vazia de propósito: é o contrapeso que centra a busca. */}
      <div className="barra-global-busca">
        <Link
          href="/buscar"
          onNavigate={() => marcarSeMuda("/buscar")}
          className="barra-global-pilula flutua"
          aria-keyshortcuts="/"
          aria-current={pathname === "/buscar" ? "page" : undefined}
          title="Buscar em tudo (atalho: /)"
        >
          <Icone de={Search} tamanho="xs" />
          <PendenciaDoLink className="app-sm hidden min-w-0 flex-1 truncate md:block">Buscar</PendenciaDoLink>
          <kbd className="barra-global-tecla app-xs hidden lg:inline-flex" aria-hidden="true">
            /
          </kbd>
        </Link>
      </div>

      <nav className="barra-global-pessoa" aria-label="Minhas pendências">
        {/* Antes da hidratação, nada derivado de "hoje": só o rótulo, sem número em lugar nenhum. */}
        <ItemDaBarra
          href="/estrutura/tarefas"
          prefixo
          icone={ListTodo}
          rotulo="Minhas Tarefas"
          contagem={hidratado ? vencidas.length : 0}
          {...(hidratado ? { detalhe: `${abertas.length} atribuídas, ${vencidas.length} vencidas` } : {})}
          {...(hidratado && vencidas.length > 0 ? { tom: "erro" as const } : {})}
        />
        <ItemDaBarra
          href="/notificacoes"
          icone={Bell}
          rotulo="Notificações"
          soIcone
          contagem={hidratado ? notificacoes.total : 0}
          {...(hidratado ? { detalhe: `${notificacoes.total} item(ns)` } : {})}
        />
        {/* Avatar e nome, e nada mais: o Papel e a Disponibilidade vivem em /minha-conta. */}
        <ActionMenu
          label={member?.displayName ?? "Escolher Membro"}
          trigger={
            <span className="grid place-items-center" style={{ width: "var(--controle-h-sm)", height: "var(--controle-h-sm)" }}>
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
            { label: "Sair", onSelect: () => sair() },
          ]}
        />
      </nav>
    </header>
  );
}

/**
 * Um item da barra: ícone, rótulo, e a contagem — que só existe quando é
 * maior que zero e surge quando muda de número (o `key` remonta a peça).
 *
 * O rótulo está SEMPRE na árvore de acessibilidade: visível em `lg+`, e
 * abaixo disso num `sr-only` gêmeo (um `display: none` sairia do nome do
 * link, que ficaria só com o detalhe). Quando o rótulo está escondido a peça
 * vira só-ícone também na geometria: `data-so-icone="abaixo-lg"` é o mesmo
 * ajuste de `"true"`, só que sob a largura (estilos/controles.css).
 */
function ItemDaBarra({
  href,
  icone,
  rotulo,
  contagem,
  detalhe,
  prefixo = false,
  soIcone = false,
  tom,
}: {
  readonly href: string;
  readonly icone: LucideIcon;
  readonly rotulo: string;
  readonly contagem: number;
  /** O que a contagem quer dizer: vai no `title` e no texto do leitor de tela. Só depois da hidratação. */
  readonly detalhe?: string;
  readonly prefixo?: boolean;
  readonly soIcone?: boolean;
  readonly tom?: "erro";
}) {
  const pathname = usePathname();
  const ativo = pathname === href || (prefixo && pathname.startsWith(href + "/"));
  return (
    <Link
      href={href}
      onNavigate={() => marcarSeMuda(href)}
      className="barra-global-item alvo-toque"
      data-so-icone={soIcone ? "true" : "abaixo-lg"}
      aria-current={ativo ? "page" : undefined}
      title={detalhe ? `${rotulo} — ${detalhe}` : rotulo}
    >
      <Icone de={icone} tamanho="xs" />
      <PendenciaDoLink className={soIcone ? "sr-only" : "app-sm hidden whitespace-nowrap lg:inline"}>{rotulo}</PendenciaDoLink>
      {soIcone ? null : <span className="sr-only lg:hidden">{rotulo}</span>}
      {contagem > 0 ? (
        <span key={contagem} className="barra-global-contagem surgir-rapido app-xs app-numero" data-tom={tom}>
          {contagem}
        </span>
      ) : null}
      {/* O detalhe segue o rótulo no nome do link — sem vírgula inicial: o nome nunca começa por pontuação. */}
      {detalhe ? <span className="sr-only">{` — ${detalhe}`}</span> : null}
    </Link>
  );
}
