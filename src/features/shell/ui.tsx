"use client";

/**
 * O BARRIL DAS PRIMITIVAS.
 *
 * As telas importam SÓ daqui. Se um componente de tela precisa alcançar um
 * arquivo de `design/` diretamente, ou ele deveria estar exportado aqui, ou não
 * deveria ser usado lá fora.
 *
 * Aqui também moram as peças de TELA — cabeçalho, seção, cartão — que compõem
 * as 61 telas com o mesmo esqueleto do CRM-COMPLETO:
 *
 *   <div className="flex h-full flex-col">
 *     <PageHeader … />          a barra de 44px, parada
 *     <CorpoDeTela>…</>         o único bloco que rola
 *   </div>
 */

import type { ReactNode } from "react";
import { Painel, Pilula, ReguaDeSecao } from "@/design/basicos";
import { CabecalhoDeTela } from "@/design/tela";

export {
  ActionMenu,
  ActivityTimeline,
  ActorAvatar,
  Button,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  Chip,
  ConditionMarker,
  ConfirmDialog,
  EmptyState,
  Field,
  MultiSelect,
  NoAccessState,
  RecordPanel,
  RecordRow,
  RichText,
  Select,
  SettingRow,
  SidePanel,
  StateSeal,
  StatusPicker,
  TextArea,
  TextInput,
  Toast,
  Toggle,
} from "@/design/components";

export type {
  ActivityEntry,
  ActorKind,
  ButtonVariant,
  Option,
  StatusCategory,
  ToastTone,
} from "@/design/components";

export { Icone, type TamanhoIcone } from "@/design/icone";
export {
  Abas,
  CabecalhoDePainel,
  Divisor,
  Esqueleto,
  EsqueletoDeLinhas,
  Painel,
  Pilula,
  ReguaDeSecao,
  RotuloDeSecao,
  Trilha,
  type Aba,
  type TomPilula,
} from "@/design/basicos";
export { BarraDeFiltros, CabecalhoDeTela, CorpoDeTela, RolagemNoTopo } from "@/design/tela";
export { CampoDeLanterna } from "@/design/lanterna";
export { GloboDePontos } from "@/design/globo";
export { cn } from "@/design/cn";

/**
 * O CABEÇALHO DE TELA das 50 telas que o usam.
 *
 * Virou a barra de 44px do sistema: título, selo, contagem e ações numa linha,
 * a trilha (`path`) miúda antes do título, e `details` numa faixa abaixo. É
 * `sticky` no topo do que rola, com o fundo da página: a tela pode continuar
 * sendo um bloco que rola inteiro, e ainda assim o título fica parado.
 *
 * O `meta` era um parágrafo explicativo. Passa a ser a contagem ao lado do
 * título quando é curto, e some quando é prosa — a tela se explica pelo
 * conteúdo.
 */
export function PageHeader({
  path,
  title,
  icon,
  seal,
  meta,
  actions,
  details,
}: {
  readonly path?: ReactNode;
  readonly title: string;
  /** Selo à esquerda do título, para a tela se reconhecer de longe. */
  readonly icon?: ReactNode;
  readonly seal?: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  /** Faixa de atributos abaixo do título, na largura toda do cabeçalho. */
  readonly details?: ReactNode;
}) {
  return (
    <div className="sticky top-0 shrink-0" style={{ zIndex: "var(--z-cabecalho)", background: "var(--page)" }}>
      <CabecalhoDeTela
        antes={
          path || icon ? (
            <span className="flex min-w-0 shrink items-center gap-2">
              {icon ? (
                <span className="shrink-0" style={{ color: "var(--texto-3)" }}>
                  {icon}
                </span>
              ) : null}
              {path ? (
                <span className="app-meta hidden max-w-64 truncate md:block" style={{ color: "var(--texto-4)" }}>
                  {path}
                </span>
              ) : null}
            </span>
          ) : undefined
        }
        titulo={title}
        selo={seal}
        contagem={typeof meta === "string" || typeof meta === "number" ? meta : undefined}
        acoes={actions}
      />
      {meta !== undefined && typeof meta !== "string" && typeof meta !== "number" ? (
        <div className="app-meta flex items-center gap-2 px-4 py-1.5" style={{ borderBottom: "1px solid var(--linha-sutil)" }}>
          {meta}
        </div>
      ) : null}
      {details ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--linha-sutil)" }}>
          {details}
        </div>
      ) : null}
    </div>
  );
}

/**
 * SEÇÃO — a régua com rótulo em caixa-alta, a contagem e o hairline. Seção é
 * régua, não caixa: com uma ou duas peças por grupo, o cartão vira quase só
 * moldura e a página abre buracos.
 */
export function Section({
  title,
  count,
  children,
  action,
}: {
  readonly title: string;
  readonly count?: number;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <section className="mb-6">
      <ReguaDeSecao rotulo={title} contagem={count} acao={action} />
      {children}
    </section>
  );
}

/** O cartão do sistema: contorno, raio, elevação de repouso. */
export function Card({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <Painel className={className ?? "p-4"}>{children}</Painel>;
}

/** A category always carries a label besides the colour (ui-ptbr.md). */
/** O nome de um Status na cor dele — uma caixa colorida, não um ponto. */
export function CategoryDot({ color, label }: { readonly color: string; readonly label: string }) {
  return <Pilula cor={color}>{label}</Pilula>;
}
