// @vitest-environment jsdom
/**
 * Fase 12, D-15 (GRV-05) — "nunca leva a uma página de id que não existe", para
 * qualquer âncora de qualquer tela. A guarda de navegação cancela, na captura do
 * `document`, o clique numa âncora cujo endereço carrega um id que o servidor
 * ainda não confirmou, e a solta quando confirma. O "pendente" é derivado
 * (`data` menos `confirmado`), sem estado novo. O `StoreProvider` de verdade
 * sobre um transporte falso que o teste segura e solta; a prova com o `Link` do
 * Next é a que importa (ele navega no próprio `onClick`).
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import { createList } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider, useData, useRun } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { idNaoConfirmadoNoEndereco } from "./guarda-de-navegacao";

function ordensDeTodasAsColecoes(estado: DataState): Ordens {
  const resultado: Ordens = {};
  for (const [colecao, valor] of Object.entries(estado)) {
    if (!Array.isArray(valor)) continue;
    const porId: Record<string, number> = {};
    valor.forEach((registro, indice) => {
      if (registro && typeof registro === "object" && "id" in registro) {
        porId[(registro as { readonly id: string }).id] = indice;
      }
    });
    resultado[colecao] = porId;
  }
  return resultado;
}

interface Servidor {
  readonly transporte: Transporte;
  segurar: () => () => void;
}

/** O servidor falso: confirma pondo a cópia como estado; `segurar()` o faz esperar até a função devolvida ser chamada. */
function servidorFalso(): Servidor {
  let seguranca: Promise<void> | null = null;
  const gravar = vi.fn(async (pedido: { readonly copia: DataState; readonly revisao: number; readonly resultado: unknown }): Promise<RespostaDeGravacao> => {
    if (seguranca) await seguranca;
    return {
      tipo: "estado",
      resultado: pedido.resultado as never,
      estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: ordensDeTodasAsColecoes(pedido.copia), memberId: "" },
    };
  });
  return {
    transporte: {
      gravar: gravar as unknown as Transporte["gravar"],
      hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    },
    segurar: () => {
      let soltar: () => void = () => undefined;
      seguranca = new Promise<void>((resolver) => {
        soltar = resolver;
      });
      return () => {
        soltar();
        seguranca = null;
      };
    },
  };
}

const THIAGO = "mem_thiago";
const ESPACO = "spc_com";
const NOME = "Lista da guarda";

let state: DataState;
let servidor: Servidor;
/** O ouvinte de borbulha do teste: o que a navegação de verdade veria se ninguém tivesse cancelado. */
let recebidos: Event[];
/** Se o clique já chegava cancelado à borbulha (só a guarda poderia ter cancelado: o próprio ouvinte cancela depois de olhar). */
let chegouCancelado: boolean[];
let ouvinteDeBorbulha: (evento: Event) => void;

function Criador() {
  const run = useRun();
  return (
    <button type="button" onClick={() => run((estado, quem) => createList(estado, quem, { name: NOME, parentType: "space", parentId: ESPACO }))}>
      criar-agora
    </button>
  );
}

/** Uma âncora simples para a Lista recém-criada (a última com o nome do teste em `data`). */
function AncoraDaListaNova() {
  const id = useData((d) => d.lists.find((l) => l.name === NOME)?.id);
  if (id === undefined) return null;
  return <a href={`/estrutura/listas/${id}`}>ir-para-a-lista-nova</a>;
}

/** O mesmo endereço, pelo `Link` de verdade, com um roteador que registra quem tentou navegar. */
function LinkDaListaNova({ aoNavegar, aoClicar }: { readonly aoNavegar: () => void; readonly aoClicar: () => void }) {
  const id = useData((d) => d.lists.find((l) => l.name === NOME)?.id);
  if (id === undefined) return null;
  return (
    <Link
      href={`/estrutura/listas/${id}`}
      prefetch={false}
      onClick={aoClicar}
      onNavigate={(e) => {
        aoNavegar();
        e.preventDefault(); // o teste não navega de verdade
      }}
    >
      ir-pelo-link
    </Link>
  );
}

/**
 * O `Link` que o vitest resolve é `next/dist/client/link.js`; o do app em
 * produção é `app-dir/link.js` (o Next troca no build), que não carrega sob o
 * vitest (`react-server-dom-webpack`). Os dois navegam do mesmo jeito: dentro do
 * `onClick` do React, depois de `if (e.defaultPrevented) return`. Este roteador
 * dá ao `Link` onde navegar sem navegar de verdade (o `onNavigate` do teste cancela).
 */
function RoteadorFalso({ children }: { readonly children: ReactNode }) {
  const [roteador] = useState(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(async () => undefined) }) as unknown as NextRouter);
  return <RouterContext.Provider value={roteador}>{children}</RouterContext.Provider>;
}

function montar(ui: ReactNode) {
  return render(
    <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }} transporte={servidor.transporte}>
      <RoteadorFalso>{ui}</RoteadorFalso>
    </StoreProvider>,
  );
}

/** O clique no botão do teste também passa pela borbulha do `document`: zera o registro para só contar o clique na âncora. */
const criar = () => {
  fireEvent.click(screen.getByRole("button", { name: "criar-agora" }));
  recebidos.length = 0;
  chegouCancelado.length = 0;
};
const ancoraNova = () => screen.getByText("ir-para-a-lista-nova");

/** Um `click` ou `auxclick` que borbulha e pode ser cancelado, como o do navegador. */
const evento = (tipo: "click" | "auxclick", init: MouseEventInit = {}) => new MouseEvent(tipo, { bubbles: true, cancelable: true, ...init });

beforeEach(() => {
  state = buildSeed();
  servidor = servidorFalso();
  recebidos = [];
  chegouCancelado = [];
  ouvinteDeBorbulha = (e) => {
    recebidos.push(e);
    chegouCancelado.push(e.defaultPrevented);
    e.preventDefault(); // o jsdom não navega; o que prova "passou" é o ouvinte ter recebido
  };
  document.addEventListener("click", ouvinteDeBorbulha);
  document.addEventListener("auxclick", ouvinteDeBorbulha);
});

afterEach(() => {
  document.removeEventListener("click", ouvinteDeBorbulha);
  document.removeEventListener("auxclick", ouvinteDeBorbulha);
  cleanup();
});

describe("idNaoConfirmadoNoEndereco — igualdade inteira, só desta origem (D-15)", () => {
  it("acha o id no segmento do caminho, com ou sem parâmetros", () => {
    expect(idNaoConfirmadoNoEndereco("/estrutura/listas/lst_000900", new Set(["lst_000900"]))).toBe("lst_000900");
    expect(idNaoConfirmadoNoEndereco("/estrutura/tarefas/tsk_1?aba=x", new Set(["tsk_1"]))).toBe("tsk_1");
  });

  it("acha o id num valor de parâmetro", () => {
    expect(idNaoConfirmadoNoEndereco("/estrutura/listas/lst_1?view=vw_9", new Set(["vw_9"]))).toBe("vw_9");
  });

  it("não confunde prefixo com segmento: lst_1 não casa com lst_10", () => {
    expect(idNaoConfirmadoNoEndereco("/estrutura/listas/lst_10", new Set(["lst_1"]))).toBeUndefined();
    expect(idNaoConfirmadoNoEndereco("/estrutura/listas/lst_1?view=vw_90", new Set(["vw_9"]))).toBeUndefined();
  });

  it("endereço sem id pendente, ou de outra origem, nunca é tocado", () => {
    expect(idNaoConfirmadoNoEndereco("/estrutura/listas/lst_1", new Set(["lst_2"]))).toBeUndefined();
    expect(idNaoConfirmadoNoEndereco("/estrutura/listas/lst_1", new Set())).toBeUndefined();
    expect(idNaoConfirmadoNoEndereco("https://outro.exemplo/estrutura/listas/lst_1", new Set(["lst_1"]))).toBeUndefined();
    expect(idNaoConfirmadoNoEndereco("mailto:alguem@exemplo.com", new Set(["alguem@exemplo.com"]))).toBeUndefined();
  });

  it("endereço absoluto da própria origem vale como relativo", () => {
    expect(idNaoConfirmadoNoEndereco(`${window.location.origin}/estrutura/listas/lst_7`, new Set(["lst_7"]))).toBe("lst_7");
  });
});

describe("a guarda de navegação com o StoreProvider de verdade (D-15, GRV-05)", () => {
  it("segurando o servidor: o clique na âncora da Lista nova é cancelado, não propaga e a âncora fica aria-busy; confirmando, solta e o clique passa", async () => {
    const soltar = servidor.segurar();
    montar(
      <>
        <Criador />
        <AncoraDaListaNova />
      </>,
    );
    criar();
    const ancora = ancoraNova();

    const passou = fireEvent(ancora, evento("click"));
    expect(passou).toBe(false); // defaultPrevented
    expect(recebidos).toHaveLength(0); // nem propagou à borbulha
    expect(ancora.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      soltar();
    });
    await waitFor(() => expect(ancora.hasAttribute("aria-busy")).toBe(false));

    fireEvent(ancora, evento("click"));
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0]?.type).toBe("click");
    expect(chegouCancelado).toEqual([false]); // a guarda não o tocou
  });

  it("o clique do meio (auxclick) na âncora pendente também é cancelado", () => {
    servidor.segurar();
    montar(
      <>
        <Criador />
        <AncoraDaListaNova />
      </>,
    );
    criar();
    const passou = fireEvent(ancoraNova(), evento("auxclick", { button: 1 }));
    expect(passou).toBe(false);
    expect(recebidos).toHaveLength(0);
  });

  it("cmd/ctrl+clique (abriria uma aba nova na página que não existe) e o clique de teclado (detail 0) também são cancelados", () => {
    servidor.segurar();
    montar(
      <>
        <Criador />
        <AncoraDaListaNova />
      </>,
    );
    criar();
    expect(fireEvent(ancoraNova(), evento("click", { metaKey: true }))).toBe(false);
    expect(fireEvent(ancoraNova(), evento("click", { ctrlKey: true }))).toBe(false);
    expect(fireEvent(ancoraNova(), evento("click", { detail: 0 }))).toBe(false);
    expect(recebidos).toHaveLength(0);
  });

  it("cancela o clique num filho da âncora (o texto ou o ícone dentro dela)", () => {
    servidor.segurar();
    function ComFilho() {
      const id = useData((d) => d.lists.find((l) => l.name === NOME)?.id);
      if (id === undefined) return null;
      return (
        <a href={`/estrutura/listas/${id}`}>
          <span data-testid="filho">dentro</span>
        </a>
      );
    }
    montar(
      <>
        <Criador />
        <ComFilho />
      </>,
    );
    criar();
    expect(fireEvent(screen.getByTestId("filho"), evento("click"))).toBe(false);
    expect(recebidos).toHaveLength(0);
  });

  it("sem id pendente, o clique numa âncora qualquer não é tocado: chega à borbulha e não ganha aria-busy", () => {
    const outra = state.lists[0]?.id ?? "lst_seed";
    montar(
      <>
        <Criador />
        <a href={`/estrutura/listas/${outra}`}>ir-para-outra</a>
      </>,
    );
    const ancora = screen.getByText("ir-para-outra");
    fireEvent(ancora, evento("click"));
    expect(recebidos).toHaveLength(1);
    expect(chegouCancelado).toEqual([false]);
    expect(ancora.hasAttribute("aria-busy")).toBe(false);
  });

  it("com um id pendente, a âncora de OUTRO registro (confirmado) segue a navegação de sempre", () => {
    servidor.segurar();
    const outra = state.lists[0]?.id ?? "lst_seed";
    montar(
      <>
        <Criador />
        <a href={`/estrutura/listas/${outra}`}>ir-para-outra</a>
      </>,
    );
    criar();
    const ancora = screen.getByText("ir-para-outra");
    fireEvent(ancora, evento("click"));
    expect(recebidos).toHaveLength(1);
    expect(ancora.hasAttribute("aria-busy")).toBe(false);
  });

  it("uma âncora de outra origem nunca é tocada, mesmo com id pendente no caminho", () => {
    servidor.segurar();
    function Externa() {
      const id = useData((d) => d.lists.find((l) => l.name === NOME)?.id);
      if (id === undefined) return null;
      return <a href={`https://outro.exemplo/estrutura/listas/${id}`}>ir-para-fora</a>;
    }
    montar(
      <>
        <Criador />
        <Externa />
      </>,
    );
    criar();
    fireEvent(screen.getByText("ir-para-fora"), evento("click"));
    expect(recebidos).toHaveLength(1);
  });

  it("depois de desmontar o StoreProvider, a guarda sai: o clique numa âncora para o id que estava pendente não é tocado", () => {
    servidor.segurar();
    const { unmount } = montar(
      <>
        <Criador />
        <AncoraDaListaNova />
      </>,
    );
    criar();
    const href = ancoraNova().getAttribute("href") as string;
    unmount();

    const solta = document.createElement("a");
    solta.setAttribute("href", href);
    document.body.appendChild(solta);
    fireEvent(solta, evento("click"));
    solta.remove();
    expect(recebidos).toHaveLength(1);
  });

  it("com o Link de verdade: o onClick e o onNavigate do Link não rodam enquanto pendente, e rodam depois da confirmação", async () => {
    const soltar = servidor.segurar();
    const aoNavegar = vi.fn();
    const aoClicar = vi.fn();
    montar(
      <>
        <Criador />
        <LinkDaListaNova aoNavegar={aoNavegar} aoClicar={aoClicar} />
      </>,
    );
    criar();
    const link = screen.getByText("ir-pelo-link");

    fireEvent(link, evento("click"));
    expect(aoClicar).not.toHaveBeenCalled();
    expect(aoNavegar).not.toHaveBeenCalled();
    expect(link.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      soltar();
    });
    await waitFor(() => expect(link.hasAttribute("aria-busy")).toBe(false));

    fireEvent(link, evento("click"));
    expect(aoClicar).toHaveBeenCalledTimes(1);
    expect(aoNavegar).toHaveBeenCalledTimes(1);
  });
});
