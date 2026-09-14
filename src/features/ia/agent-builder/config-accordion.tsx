"use client";

/**
 * Um card expansível do painel de configuração. Só um fica aberto por vez —
 * quem controla isso é o painel; aqui o card só sabe se está aberto.
 */

import { ChevronDown, Plus } from "lucide-react";
import type { ReactNode } from "react";

export function ConfigAccordion({
  id,
  title,
  icon,
  open,
  onToggle,
  onAdd,
  addLabel,
  summary,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly icon: ReactNode;
  readonly open: boolean;
  readonly onToggle: () => void;
  /** Presente só quando o card aceita vários itens: é o "+" antes do chevron. */
  readonly onAdd?: () => void;
  readonly addLabel?: string;
  /** O que está configurado, dito em poucas palavras ao lado do título. */
  readonly summary?: string;
  readonly children: ReactNode;
}) {
  const bodyId = `${id}-conteudo`;
  return (
    <section className="rounded-[9px] border border-[var(--ab-borda)] bg-[var(--ab-card)]">
      <div className="flex min-h-[52px] items-center gap-3 pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-[9px] px-4 text-left transition-colors hover:bg-[var(--ab-elevado)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)]"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-[var(--ab-elevado)] text-[var(--ab-texto-2)]">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-[var(--ab-texto)]">{title}</span>
            {summary ? (
              <span className="block truncate text-[12px] text-[var(--ab-texto-3)]">{summary}</span>
            ) : null}
          </span>
        </button>
        {onAdd ? (
          <button
            type="button"
            onClick={() => {
              if (!open) onToggle();
              onAdd();
            }}
            aria-label={addLabel ?? `Adicionar em ${title}`}
            title={addLabel ?? `Adicionar em ${title}`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--ab-texto-2)] transition-colors hover:bg-[var(--ab-elevado)] hover:text-[var(--ab-texto)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)]"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? `Recolher ${title}` : `Expandir ${title}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--ab-texto-2)] transition-colors hover:bg-[var(--ab-elevado)] hover:text-[var(--ab-texto)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)]"
        >
          <ChevronDown
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {open ? (
        <div id={bodyId} className="border-t border-[var(--ab-borda)] px-4 py-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
