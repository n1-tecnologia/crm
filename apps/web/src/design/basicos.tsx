"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icone } from "./icone";

/**
 * Os componentes pequenos que não pedem arquivo próprio:
 * Painel · Esqueleto · Trilha · Divisor · RotuloDeSecao · Pilula · Abas.
 *
 * O estilo mora em `estilos/`; aqui só se compõem as classes.
 */

// ─── Painel ──────────────────────────────────────────────────────────────────

export function Painel({
  solido = false,
  className,
  children,
  ...resto
}: React.HTMLAttributes<HTMLDivElement> & { readonly solido?: boolean }) {
  return (
    <div className={cn(solido ? "painel-solido" : "painel", className)} {...resto}>
      {children}
    </div>
  );
}

export function CabecalhoDePainel({
  titulo,
  contagem,
  acao,
  className,
}: {
  readonly titulo: string;
  readonly contagem?: number | string;
  readonly acao?: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 px-4 py-3", className)}
      style={{ borderBottom: "1px solid var(--linha)" }}
    >
      <h2 className="app-md flex items-center gap-2" style={{ color: "var(--texto)" }}>
        {titulo}
        {contagem !== undefined ? <span className="app-meta app-numero">{contagem}</span> : null}
      </h2>
      {acao}
    </div>
  );
}

// ─── Esqueleto ───────────────────────────────────────────────────────────────

/** O que aparece enquanto o armazém não hidratou. A forma é a do conteúdo real. */
export function Esqueleto({
  largura = "100%",
  altura = "1rem",
  redondo = false,
  className,
}: {
  readonly largura?: string | number;
  readonly altura?: string | number;
  readonly redondo?: boolean;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("pulso block", className)}
      style={{
        width: largura,
        height: altura,
        background: "var(--superficie-3)",
        borderRadius: redondo ? "var(--r-pilula)" : "var(--r-controle)",
      }}
    />
  );
}

export function EsqueletoDeLinhas({
  quantidade = 5,
  altura = "var(--linha-altura)",
  className,
}: {
  readonly quantidade?: number;
  readonly altura?: string;
  readonly className?: string;
}) {
  return (
    <div className={cn("pilha-solta", className)}>
      {Array.from({ length: quantidade }, (_, i) => (
        <Esqueleto key={i} altura={altura} />
      ))}
    </div>
  );
}

// ─── Trilha ──────────────────────────────────────────────────────────────────

export function Trilha({
  itens,
  className,
}: {
  readonly itens: ReadonlyArray<{ readonly rotulo: string; readonly href?: string; readonly icone?: ReactNode }>;
  readonly className?: string;
}) {
  return (
    <nav
      aria-label="Trilha de navegação"
      className={cn("app-sm flex min-w-0 items-center gap-1.5", className)}
      style={{ color: "var(--texto-3)" }}
    >
      {itens.map((item, i) => (
        <span key={item.rotulo + i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 ? (
            <span aria-hidden style={{ color: "var(--texto-4)" }}>
              /
            </span>
          ) : null}
          {item.icone}
          {item.href ? (
            <a href={item.href} className="max-w-40 truncate transition-colors hover:text-[var(--texto)]">
              {item.rotulo}
            </a>
          ) : (
            <span className="max-w-40 truncate">{item.rotulo}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Miudezas ────────────────────────────────────────────────────────────────

export function Divisor({ vertical = false, className }: { readonly vertical?: boolean; readonly className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(vertical ? "h-4 w-px" : "h-px w-full", className)}
      style={{ background: "var(--linha)" }}
    />
  );
}

export function RotuloDeSecao({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <p className={cn("ed-secao", className)}>{children}</p>;
}

/**
 * RÉGUA DE SEÇÃO — o rótulo de um grupo numa lista longa: caixa-alta, a
 * contagem e um hairline que corre até o fim. Seção aqui é régua, não caixa: com
 * uma ou duas peças por grupo, o cartão vira quase só moldura.
 */
export function ReguaDeSecao({
  rotulo,
  contagem,
  cor,
  acao,
  className,
}: {
  readonly rotulo: string;
  readonly contagem?: number;
  readonly cor?: string;
  readonly acao?: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 pb-2 pt-5 first:pt-0", className)}>
      <span className="app-coluna" style={cor ? { color: cor } : undefined}>
        {rotulo}
      </span>
      {contagem !== undefined ? <span className="app-meta app-numero">{contagem}</span> : null}
      <span className="h-px flex-1" style={{ background: "var(--linha-sutil)" }} />
      {acao}
    </div>
  );
}

// ─── Pílula ──────────────────────────────────────────────────────────────────

/**
 * PÍLULA — chip de situação, prioridade, canal ou etiqueta.
 * A cor NUNCA é passada como hex pelo chamador — só o nome do token, ou a cor
 * que veio do DADO (a cor de um Status é escolha do usuário, não estilo).
 */
export type TomPilula = "neutro" | "acento" | "sucesso" | "info" | "aviso" | "erro";

const TOM: Record<TomPilula, { readonly cor: string; readonly fundo: string }> = {
  neutro: { cor: "var(--texto-3)", fundo: "var(--neutro-lavado)" },
  acento: { cor: "var(--acento)", fundo: "var(--acento-lavado)" },
  sucesso: { cor: "var(--sucesso)", fundo: "var(--sucesso-lavado)" },
  info: { cor: "var(--info)", fundo: "var(--info-lavado)" },
  aviso: { cor: "var(--aviso)", fundo: "var(--aviso-lavado)" },
  erro: { cor: "var(--erro)", fundo: "var(--erro-lavado)" },
};

export function Pilula({
  tom = "neutro",
  cor,
  comPonto = false,
  contorno = false,
  className,
  children,
  ...resto
}: React.HTMLAttributes<HTMLSpanElement> & {
  readonly tom?: TomPilula;
  /** Sobrescreve o tom com uma cor de dado (a cor do Status) ou um token. */
  readonly cor?: string;
  readonly comPonto?: boolean;
  readonly contorno?: boolean;
}) {
  const paleta = TOM[tom];
  const corFinal = cor ?? paleta.cor;

  return (
    <span
      className={cn("pilula", className)}
      style={{
        color: corFinal,
        background: contorno ? "transparent" : cor ? `color-mix(in srgb, ${cor} 14%, transparent)` : paleta.fundo,
        borderColor: contorno ? corFinal : undefined,
      }}
      {...resto}
    >
      {comPonto ? <span className="pilula-ponto" style={{ background: corFinal }} aria-hidden /> : null}
      {children}
    </span>
  );
}

// ─── Abas ────────────────────────────────────────────────────────────────────

export type Aba = {
  readonly chave: string;
  readonly rotulo: string;
  readonly icone?: LucideIcon;
  readonly contador?: number;
};

/**
 * A aba usa o sublinhado do sistema: régua de 1px em `--acento` que cresce da
 * esquerda em 300ms. O estado NÃO mora aqui — quem chama passa `ativa`, porque
 * em quase toda tela a aba ativa vai para a URL.
 */
export function Abas({
  abas,
  ativa,
  aoTrocar,
  className,
  acao,
  rotulo = "Abas",
}: {
  readonly abas: ReadonlyArray<Aba>;
  readonly ativa: string;
  readonly aoTrocar: (chave: string) => void;
  readonly className?: string;
  readonly acao?: ReactNode;
  readonly rotulo?: string;
}) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-between gap-2 px-4", className)}
      style={{ borderBottom: "1px solid var(--linha)" }}
    >
      <div role="tablist" aria-label={rotulo} className="sem-barra flex items-center overflow-x-auto">
        {abas.map((a) => {
          const selecionada = a.chave === ativa;
          return (
            <button
              key={a.chave}
              type="button"
              role="tab"
              aria-selected={selecionada}
              onClick={() => aoTrocar(a.chave)}
              data-ativo={selecionada}
              className="sublinhado app-base flex items-center gap-1.5 whitespace-nowrap px-3 py-2 transition-colors"
              style={{
                color: selecionada ? "var(--texto)" : "var(--texto-3)",
                fontWeight: selecionada ? 500 : 400,
              }}
            >
              {a.icone ? <Icone de={a.icone} tamanho="xs" /> : null}
              {a.rotulo}
              {a.contador !== undefined ? (
                <span
                  className="app-xs app-numero rounded-full px-1.5"
                  style={{ background: "var(--superficie-3)", color: "var(--texto-3)" }}
                >
                  {a.contador}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {acao}
    </div>
  );
}
