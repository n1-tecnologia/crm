"use client";

/**
 * A grade de cartões das seções de Personalizar. Um cartão por registro:
 * ícone, nome, descrição, uma linha de fatos (pílulas), a ação e o menu. Com
 * busca na barra de filtros, porque uma grade de trinta cartões sem filtro é
 * uma tabela pior.
 *
 * É o corpo de uma seção da casca de Personalizar, e traz o esqueleto de tela:
 * cabeçalho de 44px com a contagem, barra de filtros com a busca, e o corpo —
 * o único bloco que rola — com as peças em grade.
 *
 * O cartão NÃO é um link inteiro: o `Link` cobre só ícone, título e descrição,
 * e a ação (`Button`) e o menu (`ActionMenu`) são irmãos dele — um interativo
 * dentro de outro é inválido e rouba o clique. A seção é o inventário da
 * entidade (D2): o que o cartão faz sozinho, faz por aqui.
 */

import Link from "next/link";
import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { marcarSeMuda } from "@/features/shell/navegacao";
import {
  ActionMenu,
  BarraDeFiltros,
  Button,
  ConditionMarker,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  Pilula,
  type TomPilula,
} from "@/features/shell/ui";

export interface CatalogFact {
  readonly label: string;
  /** O vocabulário do catálogo (ok, atenção, perigo) ou o tom da Pilula direto. */
  readonly tone?: "neutro" | "ok" | "atencao" | "perigo" | "acento" | TomPilula;
}

/** §2 — uma condição do registro (inoperante, Integração desconectada): marcador, não pílula. */
export interface CatalogCondition {
  readonly label: string;
  readonly tone?: "neutral" | "warning" | "danger";
  readonly title?: string;
}

export interface CatalogMenuItem {
  readonly label: string;
  readonly onSelect: () => void;
  readonly destructive?: boolean;
  readonly disabledReason?: string;
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
  /** Condições vivas do registro, antes dos fatos. */
  readonly condicoes?: readonly CatalogCondition[];
  /** A ação principal do cartão, como botão sutil; desligada, diz por quê (§11). */
  readonly onAction?: {
    readonly label: string;
    readonly onSelect: () => void;
    readonly disabledReason?: string;
  };
  /** O menu "⋯" do cartão. */
  readonly menu?: readonly CatalogMenuItem[];
  /** O registro que acabou de mudar (`useRecente`): acende e apaga. */
  readonly recente?: boolean;
}

/** O tom do fato é vocabulário do catálogo; a pílula fala o do sistema. */
const TOM: Record<NonNullable<CatalogFact["tone"]>, TomPilula> = {
  neutro: "neutro",
  ok: "sucesso",
  atencao: "aviso",
  perigo: "erro",
  acento: "acento",
  sucesso: "sucesso",
  info: "info",
  aviso: "aviso",
  erro: "erro",
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
  /** A ação principal da seção (criar, copiar…), à direita do título; aceita um fragmento com dois botões. */
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
          <ul className="grade-solta cascata sm:grid-cols-2 xl:grid-cols-3">
            {visiveis.map((item) => (
              /* `flex` por cima do `display: block` da peça de bloco: os fatos e
                 as ações precisam descer ao fundo para os cartões alinharem.
                 `items-stretch` desfaz o `align-items: center` da peça, que em
                 coluna centraria a linha de ações. */
              <li
                key={item.id}
                className="item-solto flex h-full min-w-0 flex-col items-stretch gap-3"
                data-bloco="true"
                data-recente={item.recente ? "true" : undefined}
              >
                <Link
                  href={item.href}
                  onNavigate={() => marcarSeMuda(item.href)}
                  className="group -m-1 flex items-start gap-3 rounded-[var(--r-controle)] p-1"
                >
                  <span
                    className="grid shrink-0 place-items-center rounded-[var(--r-controle)]"
                    style={{ width: "var(--controle-h)", height: "var(--controle-h)", background: "var(--superficie-3)", color: "var(--acento)" }}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="app-md block truncate text-[var(--texto)] transition-colors group-hover:text-[var(--acento)]">
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
                </Link>

                <span className="mt-auto flex flex-wrap items-center gap-1.5">
                  {(item.condicoes ?? []).map((condicao) => (
                    <ConditionMarker key={condicao.label} tone={condicao.tone ?? "neutral"} {...(condicao.title ? { title: condicao.title } : {})}>
                      {condicao.label}
                    </ConditionMarker>
                  ))}
                  {item.facts.map((fact) => (
                    <Pilula key={fact.label} tom={TOM[fact.tone ?? "neutro"]}>
                      {fact.label}
                    </Pilula>
                  ))}
                </span>

                {item.onAction || item.menu ? (
                  <span className="-mb-1 -mr-1 flex items-center justify-end gap-1">
                    {item.onAction ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={item.onAction.onSelect}
                        disabled={item.onAction.disabledReason !== undefined}
                        {...(item.onAction.disabledReason ? { disabledReason: item.onAction.disabledReason } : {})}
                      >
                        {item.onAction.label}
                      </Button>
                    ) : null}
                    {item.menu ? <ActionMenu label={`Ações de ${item.title}`} items={item.menu} /> : null}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CorpoDeTela>
    </div>
  );
}
