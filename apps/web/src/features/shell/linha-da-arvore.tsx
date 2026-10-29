"use client";

/**
 * Uma linha da árvore do painel (Estrutura, Meus negócios e Sessões de Chat):
 * seta, link, «+» e «⋯». Saiu de `app-shell.tsx` em 10-13, quando a linha ganhou
 * o arrastar e a casca passou do tamanho que o arquivo aguenta.
 *
 * O arrastar é só props: quem decide o gesto é `useArrastarNaArvore`
 * (`arrastar-na-arvore.ts`); a linha aplica os eventos, o cursor, a origem a 60%
 * e o realce da zona (UI-SPEC S1, A1, A10-bis).
 */

import Link from "next/link";
import { ChevronRight, Lock, Plus } from "lucide-react";
import { ActionMenu } from "@/design/components";
import type { Id } from "@n1/dominio/types";
import { marcarSeMuda } from "./navegacao";
import type { PropsDeArrasto } from "./arrastar-na-arvore";

export function TreeRow({
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
  no,
  arrastar,
}: {
  readonly depth: number;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly href?: string;
  /** O id do contêiner da linha: o link ganha `arvore-no-{id}`, onde o foco volta depois de mover. */
  readonly no?: Id;
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
    /** Desligado, com o motivo embaixo do rótulo (o `ActionMenu` desenha). */
    readonly disabledReason?: string;
  }>;
  /** O gesto de arrastar (só as linhas da Estrutura; Convidado e Meus negócios não recebem). */
  readonly arrastar?: PropsDeArrasto;
}) {
  const content = (
    <>
      {icon}
      <span className="truncate">{label}</span>
      {privateContainer ? <Lock className="size-3 text-[var(--cor-tinta-fraca)]" aria-label="Contêiner privado" /> : null}
      {archived ? <span className="app-meta" style={{ color: "var(--aviso)" }}>arquivado</span> : null}
    </>
  );

  const zona = arrastar?.zona ?? null;
  const arrastavel = arrastar?.arrastavel === true;

  return (
    <div
      className="group/linha relative flex items-center"
      {...(arrastar
        ? {
            onDragOver: arrastar.onDragOver,
            onDrop: arrastar.onDrop,
            onDragEnd: arrastar.onDragEnd,
            ...(arrastavel ? { draggable: true, onDragStart: arrastar.onDragStart } : {}),
            "data-soltura": zona ?? undefined,
          }
        : {})}
      style={{
        // Origem a 60%; o alvo «dentro» ganha fundo e contorno interno (UI-SPEC S1, A1).
        opacity: arrastar?.origem ? 0.6 : undefined,
        cursor: arrastavel ? (arrastar?.origem ? "grabbing" : "grab") : undefined,
        ...(zona === "dentro"
          ? { background: "var(--acento-lavado)", boxShadow: "inset 0 0 0 1px var(--linha-acento)", borderRadius: "var(--r-controle)" }
          : {}),
      }}
    >
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
          {...(no ? { id: `arvore-no-${no}` } : {})}
          // A10-bis — a âncora não se arrasta: o navegador arrastaria a URL em vez da linha.
          draggable={false}
          onNavigate={() => marcarSeMuda(href)}
          className={`app-base flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-controle)] px-2 transition-colors ${arrastavel ? "cursor-grab" : ""} ${
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
        // o ponteiro é um controle que o teclado não tem. Em aparelho sem hover
        // (toque) fica sempre à vista, senão o menu é inalcançável (A7).
        <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/linha:opacity-100 [@media(hover:none)]:opacity-100">
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
        <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/linha:opacity-100 [@media(hover:none)]:opacity-100">
          <ActionMenu label={`Ações de ${label}`} items={menu} />
        </span>
      ) : null}
      {/* A linha de inserção «antes/depois»: 2px do recuo do rótulo à borda direita, sem pegar o ponteiro (UI-SPEC S1, A1). */}
      {zona === "antes" || zona === "depois" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: `${depth * 12 + 24}px`,
            right: 0,
            height: "2px",
            background: "var(--acento)",
            ...(zona === "antes" ? { top: 0 } : { bottom: 0 }),
          }}
        />
      ) : null}
    </div>
  );
}
