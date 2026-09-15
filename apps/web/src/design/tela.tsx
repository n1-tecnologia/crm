"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * O ESQUELETO DE UMA TELA, no molde do CRM-COMPLETO (e do ClickUp).
 *
 *   <div className="flex h-full flex-col">
 *     <CabecalhoDeTela … />      44px · título, contagem, ações — fica parado
 *     <BarraDeFiltros>…</>       40px · busca, chips, seletores — opcional
 *     <CorpoDeTela>…</>          o ÚNICO bloco que rola
 *   </div>
 *
 * Sem parágrafo explicativo no cabeçalho: a tela se explica pelo conteúdo, e
 * duas linhas de texto em cada uma das 61 telas comem a dobra sem informar
 * nada a quem já usa o produto.
 */

export function CabecalhoDeTela({
  antes,
  titulo,
  contagem,
  selo,
  abas,
  acoes,
  className,
}: {
  /** O que vem antes do título: um ícone de tela, uma trilha curta. */
  readonly antes?: ReactNode;
  readonly titulo: string;
  /** O número que interessa: contatos, faturas, tarefas. Discreto, ao lado. */
  readonly contagem?: string | number;
  /** O selo de ciclo de vida (arquivado, na lixeira), colado ao título. */
  readonly selo?: ReactNode;
  readonly abas?: ReactNode;
  readonly acoes?: ReactNode;
  readonly className?: string;
}) {
  return (
    <header
      className={cn("flex shrink-0 items-center gap-3 px-4", className)}
      style={{
        minHeight: "var(--cabecalho-tela-h)",
        borderBottom: "1px solid var(--linha)",
      }}
    >
      {antes}

      <h1 className="app-md flex min-w-0 shrink items-center gap-2" style={{ color: "var(--texto)", fontWeight: 600 }}>
        <span className="truncate">{titulo}</span>
        {selo}
      </h1>

      {contagem !== undefined && contagem !== "" ? (
        <span className="app-meta app-numero shrink-0">{contagem}</span>
      ) : null}

      {abas}

      <span className="flex-1" />

      {acoes ? <div className="flex shrink-0 items-center gap-1">{acoes}</div> : null}
    </header>
  );
}

/** Barra secundária: filtros, chips, seletores. 40px, abaixo do cabeçalho. */
export function BarraDeFiltros({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 flex-wrap items-center gap-2 px-4", className)}
      style={{
        minHeight: "var(--barra-filtros-h)",
        borderBottom: "1px solid var(--linha-sutil)",
      }}
    >
      {children}
    </div>
  );
}

/** O corpo de uma tela: rolagem própria e respiro padrão. */
export function CorpoDeTela({
  children,
  className,
  semRespiro = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  /** Lista que encosta nas bordas: cabeçalho e barra já dão o respiro. */
  readonly semRespiro?: boolean;
}) {
  return <div className={cn("corpo-de-tela", semRespiro && "sem-respiro", className)}>{children}</div>;
}
