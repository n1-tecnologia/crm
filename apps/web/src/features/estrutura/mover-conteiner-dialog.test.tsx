// @vitest-environment jsdom
/**
 * Fase 10, 2.3.3 (D-10, D-11, EST-06) — "Mover para…" pelo menu. A casca de
 * verdade (`AppShell`, com a árvore e o diálogo) sobre o `StoreProvider` de
 * verdade e um transporte falso que confirma: o que a tela mostra depois de
 * mover é o que o servidor devolveu, nunca o que a cópia aceitou.
 *
 * Molde de `visibilidade-na-tela.test.tsx`. `next/navigation` guarda os
 * parâmetros de endereço num armazém reativo, para que `router.replace` abra e
 * feche o diálogo como o navegador faz.
 */

import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import { createFolder, createList } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { AppShell } from "@/features/shell/app-shell";

// O robô flutuante mede a tela com APIs que o jsdom não tem, e o Guia do Financeiro não é o assunto aqui.
vi.mock("@/features/shell/robo-flutuante", () => ({ RoboFlutuante: () => null }));
vi.mock("@/features/financeiro/guia/guia-do-financeiro-dialogo", () => ({
  GuiaDoFinanceiro: () => null,
  abrirGuiaDoFinanceiro: () => undefined,
}));

vi.mock("next/navigation", async () => {
  const React = await import("react");
  let atuais = new URLSearchParams();
  const ouvintes = new Set<() => void>();
  const definir = (proximos: URLSearchParams) => {
    atuais = proximos;
    for (const ouvinte of ouvintes) ouvinte();
  };
  const assinar = (ouvinte: () => void) => {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  };
  return {
    usePathname: () => "/estrutura/espacos/spc_com",
    useRouter: () => ({
      replace: (url: string) => definir(new URLSearchParams(url.split("?")[1] ?? "")),
      push: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => React.useSyncExternalStore(assinar, () => atuais, () => atuais),
    __params: () => atuais,
    __definir: definir,
  };
});

async function enderecoAtual(): Promise<URLSearchParams> {
  const nav = (await import("next/navigation")) as unknown as { __params: () => URLSearchParams };
  return nav.__params();
}

async function limparEndereco() {
  const nav = (await import("next/navigation")) as unknown as { __definir: (p: URLSearchParams) => void };
  nav.__definir(new URLSearchParams());
}

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

/** O que o servidor responde a cada gravação: confirma pondo a cópia como estado, ou recusa com a frase pedida. */
interface Servidor {
  readonly transporte: Transporte;
  readonly gravar: ReturnType<typeof vi.fn>;
  recusarCom: (frase: string | null) => void;
  segurar: () => () => void;
}

function servidorFalso(): Servidor {
  let recusa: string | null = null;
  let seguranca: Promise<void> | null = null;
  const gravar = vi.fn(async (pedido: { readonly copia: DataState; readonly revisao: number; readonly resultado: unknown }): Promise<RespostaDeGravacao> => {
    if (seguranca) await seguranca;
    if (recusa !== null) return { tipo: "falha", erro: recusa };
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
    gravar,
    recusarCom: (frase) => {
      recusa = frase;
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

let state: DataState;
let servidor: Servidor;

const THIAGO = "mem_thiago"; // Proprietário
const JULIA = "mem_julia"; // Papel de vendas: não administra
const BEATRIZ = "mem_beatriz"; // Convidada

function montar(ui: ReactElement, memberId = THIAGO) {
  return render(
    <StoreProvider
      sessao={{ memberId }}
      estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }}
      transporte={servidor.transporte}
    >
      {ui}
    </StoreProvider>,
  );
}

const pasta = (nome: string, parentId = "spc_com", parentType: "space" | "folder" = "space"): string => {
  const r = createFolder(state, THIAGO, { name: nome, parentType, parentId });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

const lista = (nome: string, parentId: string, parentType: "space" | "folder" = "folder"): string => {
  const r = createList(state, THIAGO, { name: nome, parentType, parentId });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

/** A linha da árvore pelo id do contêiner: o link `arvore-no-{id}` e a linha que o contém. */
function linha(id: string): HTMLElement {
  const link = document.getElementById(`arvore-no-${id}`);
  if (!link) throw new Error(`Sem linha da árvore para ${id}`);
  return link.parentElement as HTMLElement;
}

const temLinha = (id: string): boolean => document.getElementById(`arvore-no-${id}`) !== null;

function abrirMenuDaLinha(id: string) {
  fireEvent.click(within(linha(id)).getByRole("button", { name: /^Ações de / }));
}

function moverPeloMenu(id: string) {
  abrirMenuDaLinha(id);
  fireEvent.click(screen.getByRole("menuitem", { name: /Mover para…/ }));
}

/** As opções abertas do Select, como [rótulo, motivo de estar desligada]. */
function opcoesAbertas(): Array<{ rotulo: string; desligadaPor: string | null; elemento: HTMLElement }> {
  return screen.getAllByRole("option").map((elemento) => ({
    rotulo: elemento.querySelector("span.truncate")?.textContent ?? "",
    desligadaPor: elemento.getAttribute("aria-disabled") === "true" ? elemento.getAttribute("title") : null,
    elemento,
  }));
}

function abrirSelect(rotulo: string | RegExp) {
  fireEvent.click(screen.getByRole("combobox", { name: rotulo }));
}

function escolherNoSelect(rotulo: string | RegExp, opcao: string) {
  abrirSelect(rotulo);
  const alvo = opcoesAbertas().find((o) => o.rotulo === opcao);
  if (!alvo) throw new Error(`Sem a opção ${opcao}: ${opcoesAbertas().map((o) => o.rotulo).join(" | ")}`);
  fireEvent.click(alvo.elemento);
}

const confirmar = () => screen.getByRole("button", { name: "Mover" });

beforeEach(async () => {
  // A casca mede o robô flutuante e a barra com observadores que o jsdom não traz.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  state = buildSeed();
  servidor = servidorFalso();
  await limparEndereco();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Mover para… — o traçador: a Lista \"Propostas\" vai para a Pasta \"Clientes\" (EST-06)", () => {
  it("o ⋯ da Lista tem \"Mover para…\", que abre o diálogo com o título e a contagem de Tarefas", async () => {
    const PROPOSTAS = lista("Propostas", "fld_propostas");
    montar(<AppShell>{null}</AppShell>);
    await waitFor(() => expect(temLinha(PROPOSTAS)).toBe(true));

    moverPeloMenu(PROPOSTAS);

    expect(screen.getByRole("alertdialog", { name: "Mover “Propostas”" })).toBeTruthy();
    expect(screen.getByText("A Lista muda de lugar.")).toBeTruthy();
    expect((await enderecoAtual()).get("mover")).toBe(PROPOSTAS);
  });

  it("escolher \"Clientes\" e confirmar move pelo servidor, avisa depois da resposta e a árvore mostra a Lista na Pasta nova", async () => {
    const PROPOSTAS = lista("Propostas", "fld_propostas");
    montar(<AppShell>{null}</AppShell>);
    await waitFor(() => expect(temLinha(PROPOSTAS)).toBe(true));
    expect(linha(PROPOSTAS).closest("li")?.parentElement?.closest("li")?.querySelector("a")?.id).toBe("arvore-no-fld_propostas");

    moverPeloMenu(PROPOSTAS);
    escolherNoSelect("Destino", "Clientes");
    fireEvent.click(confirmar());

    await waitFor(() => expect(screen.getByText("Lista Propostas movida para Clientes.")).toBeTruthy());
    expect(servidor.gravar).toHaveBeenCalledTimes(1);
    expect(servidor.gravar.mock.calls[0]?.[0]?.chamadas[0]?.nome).toBe("moveContainer");
    expect(state.lists.find((l) => l.id === PROPOSTAS)?.parentId).toBe("fld_propostas"); // a cópia do teste não foi tocada
    // A árvore agora mostra "Propostas" dentro de "Clientes".
    expect(linha(PROPOSTAS).closest("li")?.parentElement?.closest("li")?.querySelector("a")?.id).toBe("arvore-no-fld_clientes");
    expect((await enderecoAtual()).get("mover")).toBeNull();
    await waitFor(() => expect(document.activeElement?.id).toBe(`arvore-no-${PROPOSTAS}`));
  });

  it("cancelar fecha o diálogo e limpa ?mover=, sem gravar", async () => {
    const PROPOSTAS = lista("Propostas", "fld_propostas");
    montar(<AppShell>{null}</AppShell>);
    await waitFor(() => expect(temLinha(PROPOSTAS)).toBe(true));
    moverPeloMenu(PROPOSTAS);
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect((await enderecoAtual()).get("mover")).toBeNull();
    expect(servidor.gravar).not.toHaveBeenCalled();
  });
});
