"use client";

/**
 * A grade de cartões das seções de Personalizar. Um cartão por registro:
 * ícone, nome, descrição, uma linha de fatos (pílulas) e a ação. Com busca na
 * barra de filtros, porque uma grade de trinta cartões sem filtro é uma tabela
 * pior.
 *
 * É o corpo de uma seção da casca de Personalizar, e traz o esqueleto de tela:
 * cabeçalho de 44px com a contagem, barra de filtros com a busca, e o corpo —
 * o único bloco que rola — com as peças em grade.
 */

import Link from "next/link";
import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  BarraDeFiltros,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  Pilula,
  type TomPilula,
} from "@/features/shell/ui";

export interface CatalogFact {
  readonly label: string;
  readonly tone?: "neutro" | "ok" | "atencao" | "perigo" | "acento";
}

export interface CatalogItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly icon: ReactNode;
  readonly facts: readonly CatalogFact[];
  /** Selo no canto: o estado que muda como o cartão deve ser lido. */
  readonly badge?: CatalogFact;
  readonly actionLabel?: string;
}

/** O tom do fato é vocabulário do catálogo; a pílula fala o do sistema. */
const TOM: Record<NonNullable<CatalogFact["tone"]>, TomPilula> = {
  neutro: "neutro",
  ok: "sucesso",
  atencao: "aviso",
  perigo: "erro",
  acento: "acento",
};

export function CatalogGrid({
  title,
  items,
  action,
  emptyTitle,
  emptyHint,
}: {
  readonly title: string;
  readonly items: readonly CatalogItem[];
  /** A ação principal da seção (criar, conectar…), à direita do título. */
  readonly action?: ReactNode;
  readonly emptyTitle: string;
  readonly emptyHint?: string;
}) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = termo
    ? items.filter(
        (item) =>
          item.title.toLocaleLowerCase("pt-BR").includes(termo) ||
          item.description.toLocaleLowerCase("pt-BR").includes(termo) ||
          item.facts.some((f) => f.label.toLocaleLowerCase("pt-BR").includes(termo)),
      )
    : items;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <PageHeader title={title} meta={termo ? `${visiveis.length} de ${items.length}` : String(items.length)} actions={action} />

      <BarraDeFiltros>
        <label className="relative block">
          <span className="sr-only">Buscar em {title}</span>
          <Icone
            de={Search}
            tamanho="xs"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--texto-4)" }}
          />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar"
            className="campo w-56 pl-9"
            style={{ height: "var(--controle-h-sm)" }}
          />
        </label>
      </BarraDeFiltros>

      <CorpoDeTela>
        {visiveis.length === 0 ? (
          <EmptyState
            title={termo ? `Nada em ${title} para “${busca.trim()}”.` : emptyTitle}
            {...(termo ? { hint: "Tente outro termo." } : emptyHint ? { hint: emptyHint } : {})}
          />
        ) : (
          <ul className="grade-solta sm:grid-cols-2 xl:grid-cols-3">
            {visiveis.map((item) => (
              <li key={item.id} className="min-w-0">
                {/* `flex` por cima do `display: block` da peça de bloco: o rodapé
                    de fatos precisa descer ao fundo para os cartões alinharem. */}
                <Link href={item.href} className="group item-solto flex h-full flex-col gap-3" data-bloco="true">
                  <span className="flex items-start gap-3">
                    <span
                      className="grid shrink-0 place-items-center rounded-[var(--r-controle)]"
                      style={{ width: "var(--controle-h)", height: "var(--controle-h)", background: "var(--superficie-3)", color: "var(--acento)" }}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                        {item.title}
                      </span>
                      <span className="app-sm mt-0.5 line-clamp-2 block" style={{ color: "var(--texto-3)" }}>
                        {item.description || "Sem descrição."}
                      </span>
                    </span>
                    {item.badge ? (
                      <Pilula tom={TOM[item.badge.tone ?? "neutro"]} className="shrink-0">
                        {item.badge.label}
                      </Pilula>
                    ) : null}
                  </span>
                  <span className="mt-auto flex flex-wrap items-center gap-1.5">
                    {item.facts.map((fact) => (
                      <Pilula key={fact.label} tom={TOM[fact.tone ?? "neutro"]}>
                        {fact.label}
                      </Pilula>
                    ))}
                    <span className="app-sm ml-auto text-[var(--texto-3)] transition-colors group-hover:text-[var(--acento)]">
                      {item.actionLabel ?? "Abrir"} →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CorpoDeTela>
    </div>
  );
}
