import type { CSSProperties, ReactNode } from "react";
import { CarregadorDeIcones } from "./carregador";
import { cn } from "./cn";

/**
 * ESQUELETOS — o que aparece enquanto a tela não existe.
 *
 * Nunca uma ampulheta, nunca um atraso fabricado: a forma EXATA do que vem,
 * por família de rota, com as alturas dos mesmos tokens que o conteúdo real
 * usa — para que cabeçalho, barra e primeiras linhas caiam nos mesmos lugares
 * quando a tela hidrata. O esqueleto fica FORA do invólucro de chegada: ao
 * hidratar ele desmonta seco e a tela real entra em cascata — a cascata É a
 * transição, sem crossfade.
 *
 * Sem hooks, sem store, sem URL: `EsqueletoDaCasca` é o fallback da
 * `<Suspense>` do layout (servidor), e `EsqueletoDeTela` recebe a forma de
 * quem já leu o pathname. A onda de pulso desce por `--i` (até 24 linhas).
 * No centro, sobre a silhueta, o carregador de ícones (`design/carregador.tsx`)
 * é quem diz "está carregando" — a silhueta só diz a forma.
 */

export type Forma = "inicio" | "caixa" | "lista" | "quadro" | "painel" | "registro" | "formulario" | "tabela";

function Peca({
  w,
  h,
  i = 0,
  redondo = false,
  className,
}: {
  readonly w: string;
  readonly h: string;
  readonly i?: number;
  readonly redondo?: boolean;
  readonly className?: string;
}) {
  return (
    <span
      className={cn("esqueleto shrink-0", className)}
      data-redondo={redondo ? "" : undefined}
      style={{ width: w, height: h, "--i": Math.min(i, 24) } as CSSProperties}
    />
  );
}

/** A barra de título da tela: título, uma pílula de contagem e uma ação à direita. */
function Cabecalho({ i = 0 }: { readonly i?: number }) {
  return (
    <div
      className="flex shrink-0 items-center gap-3 px-4"
      style={{ minHeight: "var(--cabecalho-tela-h)", borderBottom: "1px solid var(--linha)" }}
    >
      <Peca w="40%" h="1rem" i={i} />
      <Peca w="12%" h="1.25rem" i={i + 1} redondo />
      <span className="flex-1" />
      <Peca w="12%" h="var(--controle-h-sm)" i={i + 2} />
    </div>
  );
}

/** A faixa de filtros: três chips. */
function Barra({ i = 3 }: { readonly i?: number }) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 px-4"
      style={{ minHeight: "var(--barra-filtros-h)", borderBottom: "1px solid var(--linha-sutil)" }}
    >
      {[0, 1, 2].map((k) => (
        <Peca key={k} w="6rem" h="var(--controle-h-sm)" i={i + k} redondo />
      ))}
    </div>
  );
}

/** Uma linha de tabela: a moldura de `.tabela tbody tr` com cinco células. */
function Linha({ i, altura = "var(--linha-altura)" }: { readonly i: number; readonly altura?: string }) {
  return (
    <div
      className="flex items-center gap-4"
      style={{
        height: altura,
        paddingInline: "var(--celula-x)",
        border: "1px solid var(--linha)",
        borderRadius: "var(--r-painel)",
        background: "var(--superficie-1)",
      }}
    >
      {[18, 28, 14, 12, 10].map((largura, k) => (
        <Peca key={k} w={`${largura}%`} h="0.75rem" i={i} />
      ))}
    </div>
  );
}

/** A faixa de grupo de uma lista agrupada (rótulo, não peça). */
function Faixa({ i }: { readonly i: number }) {
  return (
    <div className="flex items-center gap-3 px-2" style={{ height: "var(--linha-altura-compacta)" }}>
      <Peca w="8rem" h="0.75rem" i={i} />
      <Peca w="1.5rem" h="0.75rem" i={i} />
    </div>
  );
}

function Linhas({ de, quantidade, altura }: { readonly de: number; readonly quantidade: number; readonly altura?: string }) {
  return (
    <>
      {Array.from({ length: quantidade }, (_, k) => (
        <Linha key={k} i={de + k} {...(altura ? { altura } : {})} />
      ))}
    </>
  );
}

const FORMAS: Record<Forma, ReactNode> = {
  tabela: (
    <>
      <Cabecalho />
      <Barra />
      <div className="corpo-de-tela flex flex-col" style={{ gap: "var(--gap-solto)" }}>
        <Linhas de={6} quantidade={8} />
      </div>
    </>
  ),
  lista: (
    <>
      <Cabecalho />
      <Barra />
      <div className="corpo-de-tela flex flex-col" style={{ gap: "var(--gap-solto)" }}>
        <Faixa i={6} />
        <Linhas de={7} quantidade={4} />
        <Faixa i={11} />
        <Linhas de={12} quantidade={4} />
      </div>
    </>
  ),
  quadro: (
    <>
      <Cabecalho />
      <Barra />
      <div className="corpo-de-tela flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((coluna) => (
          <div key={coluna} className="flex w-[17.5rem] shrink-0 flex-col gap-2">
            <div className="flex items-center gap-2 px-1 pb-1">
              <Peca w="50%" h="0.75rem" i={6 + coluna} />
              <Peca w="1.5rem" h="0.75rem" i={6 + coluna} />
            </div>
            {[0, 1, 2].map((cartao) => (
              <Peca key={cartao} w="100%" h="4.5rem" i={7 + coluna + cartao * 4} className="rounded-[var(--r-painel)]" />
            ))}
          </div>
        ))}
      </div>
    </>
  ),
  painel: (
    <>
      <Cabecalho />
      <div className="corpo-de-tela">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((k) => (
            <Peca key={k} w="100%" h="6rem" i={3 + k} className="rounded-[var(--r-painel)]" />
          ))}
        </div>
        <div className="mt-6 grid gap-3 xl:grid-cols-2">
          {[0, 1].map((k) => (
            <Peca key={k} w="100%" h="15rem" i={7 + k} className="rounded-[var(--r-painel)]" />
          ))}
        </div>
      </div>
    </>
  ),
  registro: (
    <>
      <Cabecalho />
      <div className="corpo-de-tela flex gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {[0, 1, 2].map((k) => (
            <Peca key={k} w="100%" h="8rem" i={3 + k} className="rounded-[var(--r-painel)]" />
          ))}
        </div>
        <div className="hidden w-[26rem] shrink-0 flex-col gap-3 xl:flex">
          {[62, 80, 48, 72, 55, 68].map((largura, k) => (
            <Peca key={k} w={`${largura}%`} h="1rem" i={6 + k} />
          ))}
        </div>
      </div>
    </>
  ),
  caixa: (
    <div className="flex h-full min-h-0">
      <div className="flex w-96 shrink-0 flex-col gap-2 p-2" style={{ borderRight: "1px solid var(--linha)" }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
          <div key={k} className="flex items-center gap-3 px-2" style={{ height: "var(--linha-altura)" }}>
            <Peca w="var(--avatar-md)" h="var(--avatar-md)" i={k} redondo />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Peca w="70%" h="0.75rem" i={k} />
              <Peca w="45%" h="0.625rem" i={k} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Cabecalho i={8} />
        <div className="flex flex-col gap-3 p-4">
          {[0, 1, 2, 3].map((k) => (
            <Peca key={k} w={k % 2 === 0 ? "60%" : "45%"} h="3rem" i={11 + k} className={cn("rounded-[var(--r-painel)]", k % 2 === 1 && "self-end")} />
          ))}
        </div>
      </div>
    </div>
  ),
  // O Início: só o palco preto de borda a borda — o robô chega com a cena.
  inicio: (
    <div className="corpo-de-tela inicio-corpo flex flex-col">
      <div className="flex-1" style={{ minHeight: "var(--capa-h)", background: "var(--palco-inicio)" }} />
    </div>
  ),
  formulario: (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="painel-solido w-full max-w-lg p-6">
        <Peca w="14rem" h="1.25rem" i={0} />
        <div className="mt-6 flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((k) => (
            <div key={k} className="flex flex-col gap-1.5">
              <Peca w="30%" h="0.75rem" i={1 + k} />
              <Peca w="100%" h="var(--controle-h-sm)" i={1 + k} />
            </div>
          ))}
          <Peca w="8rem" h="var(--controle-h)" i={6} />
        </div>
      </div>
    </div>
  ),
};

/** O esqueleto de UMA tela, na forma da família da rota. Fica no lugar do miolo até o armazém hidratar. */
export function EsqueletoDeTela({ forma = "tabela" }: { readonly forma?: Forma }) {
  return (
    <div className="relative h-full">
      <div aria-hidden="true" className="flex h-full flex-col">
        {FORMAS[forma]}
      </div>
      <CarregadorDeIcones rotulo="Carregando a tela…" />
    </div>
  );
}

/** A barra global em silhueta: a mesma classe garante a mesma geometria quando a casca hidrata. */
function BarraGlobalEmSilhueta() {
  return (
    <div className="barra-global" aria-hidden="true">
      <span />
      <div className="barra-global-busca">
        <Peca w="100%" h="var(--controle-h-sm)" i={0} redondo />
      </div>
      <div className="barra-global-pessoa">
        <Peca w="7rem" h="var(--controle-h-sm)" i={1} />
        <Peca w="var(--controle-h-sm)" h="var(--controle-h-sm)" i={1} />
        <Peca w="var(--avatar-md)" h="var(--avatar-md)" i={2} redondo />
      </div>
    </div>
  );
}

/**
 * A casca inteira em silhueta: trilho, painel do assunto e um miolo na forma
 * `tabela` (não sabe a rota). É o único HTML que o servidor entrega para as
 * rotas da casca, no carregamento duro, enquanto a `<Suspense>` do layout
 * espera. Mesma geometria de `AppShell`, mesmos tokens.
 */
export function EsqueletoDaCasca() {
  return (
    <div className="relative flex h-screen overflow-hidden" style={{ zIndex: "var(--z-conteudo)" }}>
      <div aria-hidden="true" className="flex h-full shrink-0">
        <div
          className="flex shrink-0 flex-col items-center gap-1 py-2"
          style={{ width: "var(--trilha-w)", borderRight: "1px solid var(--linha)", background: "var(--page)" }}
        >
          <Peca w="var(--item-trilha)" h="var(--item-trilha)" i={0} className="mb-1 rounded-[var(--r-painel)]" />
          <span className="mb-1 h-px w-7" style={{ background: "var(--linha)" }} />
          {[0, 1, 2, 3, 4].map((k) => (
            <Peca key={k} w="var(--item-trilha)" h="var(--item-trilha)" i={1 + k} className="rounded-[var(--r-painel)]" />
          ))}
        </div>
        <div
          className="flex flex-col"
          style={{ width: "var(--painel-nav-w)", borderRight: "1px solid var(--linha)", background: "var(--page)" }}
        >
          <div className="flex items-center gap-1 px-2 py-2" style={{ minHeight: "var(--controle-h)" }}>
            <Peca w="55%" h="1rem" i={0} className="mx-2" />
            <span className="flex-1" />
            <Peca w="var(--controle-h-sm)" h="var(--controle-h-sm)" i={0} />
          </div>
          <div className="flex flex-col gap-1 px-2 pb-3">
            <div className="flex items-center px-2 py-2">
              <Peca w="40%" h="0.625rem" i={2} />
            </div>
            {Array.from({ length: 8 }, (_, k) => (
              <div key={k} className="flex items-center px-3" style={{ height: "var(--item-nav-h)" }}>
                <Peca w={`${60 + ((k * 13) % 35)}%`} h="0.75rem" i={3 + k} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraGlobalEmSilhueta />
        <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto" style={{ background: "var(--page)" }}>
          <div aria-hidden="true" className="flex h-full flex-col">
            {FORMAS.tabela}
          </div>
          <CarregadorDeIcones rotulo="Carregando a tela…" />
        </div>
      </div>
    </div>
  );
}
