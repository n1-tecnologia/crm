"use client";

/**
 * Os gráficos do Painel. Cada tipo de vista tem o SEU desenho — o funil
 * afunila, a pizza é uma rosca, as barras alinham pelo mesmo eixo — porque um
 * Painel em que tudo vira a mesma lista de barras não responde nada de
 * relance, e "de relance" é o motivo de um Painel existir.
 *
 * Nenhuma cor crua: as séries vêm de `--serie-1…6` (tokens.css) e o trilho
 * atrás da barra é `--superficie-3`. A cor nunca é o único sinal — toda fatia
 * e todo degrau carregam rótulo e valor ao lado.
 *
 * Movimento (componentes.css, "Gráficos"): a FOLHA `.preenchimento` cresce na
 * chegada da tela e muda por width; a fatia `.rosca-fatia` se desenha. O
 * `--i` inline escalona por linha/fatia — o texto fica sempre fora da folha.
 */

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  ChartBar,
  ChartLine,
  ChartPie,
  Folder,
  Funnel,
  Hash,
  Inbox,
  LayoutGrid,
  ListTodo,
  Rows3,
  Split,
  Table,
  Type,
} from "lucide-react";
import type { DataViewType, PanelAnchor } from "@n1/dominio/types";

export const ICONE_DE_VISTA: Record<DataViewType, LucideIcon> = {
  numero: Hash,
  barras: ChartBar,
  linhas: ChartLine,
  pizza: ChartPie,
  funil: Funnel,
  tabela: Table,
  listaDeRegistros: Rows3,
  calendario: CalendarDays,
  texto: Type,
};

export const ROTULO_DE_VISTA: Record<DataViewType, string> = {
  numero: "Número",
  barras: "Barras",
  linhas: "Linhas",
  pizza: "Pizza",
  funil: "Funil",
  tabela: "Tabela",
  listaDeRegistros: "Lista de registros",
  calendario: "Calendário",
  texto: "Texto",
};

/** O ícone do que ancora o Painel: os mesmos da casca, para se reconhecer. */
export const ICONE_DE_ANCORA: Record<PanelAnchor["type"] | "workspace", LucideIcon> = {
  space: LayoutGrid,
  folder: Folder,
  list: ListTodo,
  funnel: Split,
  queue: Inbox,
  workspace: Building2,
};

export interface Linha {
  readonly label: string;
  readonly value: number;
}

type Formata = (value: number) => string;
/** A cor de uma linha: recebe o rótulo e a posição, devolve um token. */
export type CorDe = (label: string, i: number) => string;

// Nomes inteiros, não montados: a sentinela de tokens lê cada `var(--…)` literal.
const SERIES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)", "var(--serie-5)", "var(--serie-6)"] as const;
export const corDaSerie: CorDe = (_label, i) => SERIES[i % SERIES.length] ?? SERIES[0];

const TEMPLATE_LINHA = "grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-x-3";

/** Barras horizontais: rótulo, barra e valor em três colunas que se alinham entre as linhas. */
export function Barras({
  rows,
  formata,
  corDe,
}: {
  readonly rows: readonly Linha[];
  readonly formata: Formata;
  /** Sem `corDe`, uma série só: todas as barras na primeira cor. */
  readonly corDe?: CorDe;
}) {
  const maior = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <li key={row.label} className={TEMPLATE_LINHA}>
          <span className="app-sm truncate" style={{ color: "var(--texto-1)" }} title={row.label}>
            {row.label}
          </span>
          <span
            aria-hidden="true"
            className="barra-h block overflow-hidden rounded-full"
            style={{ height: "var(--barra-viz-h)", background: "var(--superficie-3)", "--i": i } as CSSProperties}
          >
            <span
              className="preenchimento block h-full rounded-full"
              style={{ width: `${Math.max(1.5, (row.value / maior) * 100)}%`, background: corDe ? corDe(row.label, i) : "var(--serie-1)" }}
            />
          </span>
          <span className="app-sm app-numero text-right" style={{ color: "var(--texto)" }}>
            {formata(row.value)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * O funil: cada degrau é uma barra centrada cuja largura é a fração do maior,
 * e o valor traz a conversão em relação ao degrau anterior — é essa a pergunta
 * que se faz a um funil ("quanto passou daqui para ali?").
 */
export function Funil({ rows, formata }: { readonly rows: readonly Linha[]; readonly formata: Formata }) {
  const maior = Math.max(...rows.map((row) => row.value), 1);
  const passos = Math.max(rows.length - 1, 1);
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((row, i) => {
        const anterior = i > 0 ? rows[i - 1]?.value ?? 0 : 0;
        const conversao = i > 0 && anterior > 0 ? Math.round((row.value / anterior) * 100) : null;
        // O degrau de baixo é mais pálido: a forma afunila também na cor.
        const forca = 100 - Math.round((i / passos) * 55);
        return (
          <li key={row.label} className={TEMPLATE_LINHA}>
            <span className="app-sm truncate" style={{ color: "var(--texto-1)" }} title={row.label}>
              {row.label}
            </span>
            <span className="barra-c flex justify-center" aria-hidden="true" style={{ "--i": i } as CSSProperties}>
              <span
                className="preenchimento block rounded-[var(--r-etiqueta)]"
                style={{
                  width: `${Math.max(6, (row.value / maior) * 100)}%`,
                  height: "calc(var(--barra-viz-h) * 2.5)",
                  background: `color-mix(in srgb, var(--serie-1) ${forca}%, var(--superficie-3))`,
                }}
              />
            </span>
            <span className="app-sm app-numero whitespace-nowrap text-right" style={{ color: "var(--texto)" }}>
              {formata(row.value)}
              {conversao !== null ? (
                <span className="app-meta" title="Em relação ao degrau anterior">
                  {" "}
                  · {conversao}%
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A rosca: um anel por fatia, desenhado com `stroke-dasharray` sobre um
 * `pathLength` de 100 (cada fatia é a sua porcentagem, sem trigonometria). O
 * total fica no centro, em HTML sobreposto — texto dentro do SVG herdaria o
 * tamanho de fonte da página em unidades do viewBox.
 */
export function Rosca({
  rows,
  formata,
  total,
  corDe = corDaSerie,
}: {
  readonly rows: readonly Linha[];
  readonly formata: Formata;
  /** O número do centro — normalmente a soma das fatias, formatada. */
  readonly total: string;
  readonly corDe?: CorDe;
}) {
  const soma = rows.reduce((acumulado, row) => acumulado + row.value, 0) || 1;
  // Cada fatia começa onde a anterior acabou. O anel começa às 3h; deslocar 25
  // leva o início às 12h. Calculado antes do JSX: o render não muta variável.
  const fatias = rows.reduce<ReadonlyArray<{ readonly fatia: number; readonly deslocamento: number }>>((acumulado, row) => {
    const percorrido = acumulado.reduce((total, item) => total + item.fatia, 0);
    return [...acumulado, { fatia: (row.value / soma) * 100, deslocamento: 25 - percorrido }];
  }, []);
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: "var(--rosca-tam)", height: "var(--rosca-tam)" }}>
        <svg viewBox="0 0 42 42" className="size-full" role="img" aria-label={`Rosca com ${rows.length} fatias`}>
          <circle cx="21" cy="21" r="15.915" fill="none" strokeWidth="5" style={{ stroke: "var(--superficie-3)" }} />
          {rows.map((row, i) => {
            const { fatia, deslocamento } = fatias[i] ?? { fatia: 0, deslocamento: 25 };
            return (
              <circle
                key={row.label}
                className="rosca-fatia"
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                strokeWidth="5"
                pathLength={100}
                strokeDasharray={`${fatia} ${100 - fatia}`}
                strokeDashoffset={deslocamento}
                style={{ stroke: corDe(row.label, i), "--i": i } as CSSProperties}
              />
            );
          })}
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          <span className="ed-subtitulo app-numero" style={{ color: "var(--texto)" }}>
            {total}
          </span>
        </span>
      </div>
      <ol className="flex min-w-0 flex-1 flex-col gap-1.5">
        {rows.map((row, i) => (
          <li key={row.label} className="app-sm flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-xs" style={{ background: corDe(row.label, i) }} />
            <span className="min-w-0 flex-1 truncate" style={{ color: "var(--texto-1)" }} title={row.label}>
              {row.label}
            </span>
            <span className="app-numero" style={{ color: "var(--texto)" }}>
              {formata(row.value)}
            </span>
            <span className="app-meta app-numero w-9 text-right">{Math.round((row.value / soma) * 100)}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
