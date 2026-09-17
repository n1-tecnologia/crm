"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
      className={cn("cabecalho-de-tela flex shrink-0 items-center gap-3 px-4", className)}
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

      {acoes ? <div className="acoes-de-tela flex shrink-0 items-center gap-1">{acoes}</div> : null}
    </header>
  );
}

/** Barra secundária: filtros, chips, seletores. 40px, abaixo do cabeçalho. */
export function BarraDeFiltros({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <div
      className={cn("barra-de-filtros flex shrink-0 flex-wrap items-center gap-2 px-4", className)}
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

/**
 * UM BLOCO QUE ROLA DE LADO COM A BARRA EM CIMA.
 *
 * Um Quadro é mais alto que a tela: a barra de rolagem nativa, no pé do bloco,
 * fica abaixo da dobra e ninguém a encontra. Aqui a barra visível é uma faixa
 * fina ACIMA do conteúdo (um rolo vazio da mesma largura), sincronizada nos
 * dois sentidos com o corpo — que continua rolando por roda, arraste e
 * teclado, só sem mostrar a sua própria barra. Uma barra só, e onde se vê.
 */
export function RolagemNoTopo({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  const topo = useRef<HTMLDivElement>(null);
  const corpo = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [transborda, setTransborda] = useState(false);

  useEffect(() => {
    const el = corpo.current;
    if (!el) return;
    const medir = () => {
      setLargura(el.scrollWidth);
      setTransborda(el.scrollWidth > el.clientWidth + 1);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    for (const filho of Array.from(el.children)) observador.observe(filho);
    return () => observador.disconnect();
  }, [children]);

  // Cada lado copia o deslocamento do outro; a guarda evita o eco.
  const seguir = (de: HTMLDivElement | null, para: HTMLDivElement | null) => {
    if (de && para && Math.abs(para.scrollLeft - de.scrollLeft) > 0.5) para.scrollLeft = de.scrollLeft;
  };

  return (
    <div className={cn("rolagem-no-topo", className)}>
      <div
        ref={topo}
        className="rolagem-no-topo-barra"
        hidden={!transborda}
        onScroll={() => seguir(topo.current, corpo.current)}
        aria-hidden="true"
      >
        <div style={{ width: largura, height: 1 }} />
      </div>
      <div ref={corpo} className="rolagem-no-topo-corpo sem-barra" onScroll={() => seguir(corpo.current, topo.current)}>
        {children}
      </div>
    </div>
  );
}
