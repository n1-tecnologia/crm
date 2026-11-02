// @vitest-environment jsdom
/**
 * Fase 12, D-15 (GRV-05) — o item criado aparece na árvore na hora, mas só ganha
 * link depois de o servidor confirmar. Enquanto espera, a linha de uma Lista, de
 * uma Pasta ou de um Espaço novo é "salvando": sem link, `aria-busy="true"`,
 * `title` "Salvando…", sem «+», sem «⋯» e sem arrastar. A casca de verdade
 * (`AppShell`) sobre o `StoreProvider` de verdade e um transporte falso que o
 * teste segura e solta. Molde de `arvore-menu.test.tsx`.
 */

import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import { createFolder, createList, createSpace } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { idsNaoConfirmados, StoreProvider, useRun } from "@/dados/store";
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
  const atuais = new URLSearchParams();
  return {
    usePathname: () => "/estrutura/espacos/spc_com",
    useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
    useSearchParams: () => React.useSyncExternalStore(() => () => undefined, () => atuais, () => atuais),
  };
});

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
const ESPACO = "spc_com";

/** O gesto de criar, fora da árvore: o botão roda o comando que a tela de criação rodaria. */
function Criador({ gesto }: { readonly gesto: (estado: DataState, quem: string) => ReturnType<typeof createList> | ReturnType<typeof createFolder> | ReturnType<typeof createSpace> }) {
  const run = useRun();
  return (
    <button type="button" onClick={() => run(gesto as never)}>
      criar-agora
    </button>
  );
}

function montar(ui: ReactElement) {
  return render(
    <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }} transporte={servidor.transporte}>
      {ui}
    </StoreProvider>,
  );
}

async function abrirArvoreCom(gesto: Parameters<typeof Criador>[0]["gesto"]) {
  montar(
    <>
      <Criador gesto={gesto} />
      <AppShell>{null}</AppShell>
    </>,
  );
  await screen.findByRole("complementary", { name: "Navegação" });
}

/** As linhas "salvando" da árvore que mostram o nome, em ordem. */
function linhasSalvando(nome: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[aria-busy='true'][title='Salvando…']")].filter((el) => el.textContent?.includes(nome));
}

function linhaSalvando(nome: string): HTMLElement {
  const [unica, ...resto] = linhasSalvando(nome);
  if (!unica || resto.length > 0) throw new Error(`Esperava uma linha "salvando" para ${nome}, achei ${linhasSalvando(nome).length}`);
  return unica;
}

/** A linha inteira (seta, nome, «+», «⋯») de um nome na árvore, com ou sem link. */
const linhaInteira = (el: HTMLElement): HTMLElement => el.parentElement as HTMLElement;

const criar = () => fireEvent.click(screen.getByRole("button", { name: "criar-agora" }));

beforeEach(() => {
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("idsNaoConfirmados — pendente é derivado, sem estado novo (D-15)", () => {
  it("é vazio, sem varrer coleção nenhuma, quando `data` é o próprio `confirmado`", () => {
    const armadilha = new Proxy(buildSeed(), {
      ownKeys() {
        throw new Error("varreu as coleções de um estado que já é o confirmado");
      },
    }) as DataState;
    expect(idsNaoConfirmados(armadilha, armadilha).size).toBe(0);
  });

  it("devolve só o id do que está em `data` e ainda não está em `confirmado`", () => {
    const confirmado = buildSeed();
    const data = structuredClone(confirmado);
    const r = createList(data, THIAGO, { name: "Lista nova", parentType: "space", parentId: ESPACO });
    if (!r.ok) throw new Error(r.error);
    expect([...idsNaoConfirmados(data, confirmado)]).toEqual([r.value.id]);
  });

  it("é vazio quando `data` é uma cópia igual ao `confirmado` (nada a caminho)", () => {
    const confirmado = buildSeed();
    expect(idsNaoConfirmados(structuredClone(confirmado), confirmado).size).toBe(0);
  });
});

describe("a árvore — a Lista nova aparece 'salvando', sem link, e ganha o link quando o servidor confirma (D-15, GRV-05)", () => {
  it("segurando o transporte: a Lista está na árvore, sem link, aria-busy, 'Salvando…', sem «+», sem «⋯» e sem arrastar; soltando, vira link", async () => {
    let id = "";
    await abrirArvoreCom((estado, quem) => {
      const r = createList(estado, quem, { name: "Lista recém-criada", parentType: "space", parentId: ESPACO });
      if (r.ok) id = r.value.id;
      return r;
    });
    const soltar = servidor.segurar();

    criar();

    // Aparece na hora, mas não é um link.
    const salvando = await waitFor(() => linhaSalvando("Lista recém-criada"));
    expect(screen.queryByRole("link", { name: /Lista recém-criada/ })).toBeNull();
    expect(salvando.getAttribute("aria-busy")).toBe("true");
    expect(salvando.getAttribute("title")).toBe("Salvando…");
    const linha = linhaInteira(salvando);
    expect(within(linha).queryByRole("button", { name: /Criar dentro de/ })).toBeNull();
    expect(within(linha).queryByRole("button", { name: /Ações de/ })).toBeNull();
    expect(linha.getAttribute("draggable")).toBeNull();

    // O servidor confirma: a mesma Lista vira o link de sempre.
    await act(async () => {
      soltar();
    });
    const link = await screen.findByRole("link", { name: /Lista recém-criada/ });
    expect(link.getAttribute("href")).toBe(`/estrutura/listas/${id}`);
    expect(link.getAttribute("aria-busy")).toBeNull();
    expect(linhasSalvando("Lista recém-criada")).toHaveLength(0);
    expect(within(linhaInteira(link)).queryByRole("button", { name: /Ações de/ })).not.toBeNull();
  });

  it("com a recusa do servidor, a linha some", async () => {
    await abrirArvoreCom((estado, quem) => createList(estado, quem, { name: "Lista recusada", parentType: "space", parentId: ESPACO }));
    const soltar = servidor.segurar();
    servidor.recusarCom("O servidor recusou a Lista.");

    criar();
    await waitFor(() => linhaSalvando("Lista recusada"));

    await act(async () => {
      soltar();
    });
    await waitFor(() => expect(linhasSalvando("Lista recusada")).toHaveLength(0));
    expect(screen.queryByText("Lista recusada")).toBeNull();
    expect(screen.queryByRole("link", { name: /Lista recusada/ })).toBeNull();
  });

  it("a Pasta nova tem o mesmo 'salvando' e vira link quando o servidor confirma", async () => {
    let id = "";
    await abrirArvoreCom((estado, quem) => {
      const r = createFolder(estado, quem, { name: "Pasta recém-criada", parentType: "space", parentId: ESPACO });
      if (r.ok) id = r.value.id;
      return r;
    });
    const soltar = servidor.segurar();

    criar();

    const salvando = await waitFor(() => linhaSalvando("Pasta recém-criada"));
    expect(screen.queryByRole("link", { name: /Pasta recém-criada/ })).toBeNull();
    const linha = linhaInteira(salvando);
    expect(within(linha).queryByRole("button", { name: /Criar dentro de/ })).toBeNull();
    expect(within(linha).queryByRole("button", { name: /Ações de/ })).toBeNull();

    await act(async () => {
      soltar();
    });
    const link = await screen.findByRole("link", { name: /Pasta recém-criada/ });
    expect(link.getAttribute("href")).toBe(`/estrutura/pastas/${id}`);
    expect(linhasSalvando("Pasta recém-criada")).toHaveLength(0);
  });

  it("o Espaço novo tem o mesmo 'salvando' e vira link quando o servidor confirma", async () => {
    let id = "";
    await abrirArvoreCom((estado, quem) => {
      const r = createSpace(estado, quem, { name: "Espaço recém-criado" });
      if (r.ok) id = r.value.id;
      return r;
    });
    const soltar = servidor.segurar();

    criar();

    const salvando = await waitFor(() => linhaSalvando("Espaço recém-criado"));
    expect(screen.queryByRole("link", { name: /Espaço recém-criado/ })).toBeNull();
    const linha = linhaInteira(salvando);
    expect(within(linha).queryByRole("button", { name: /Criar dentro de/ })).toBeNull();
    expect(within(linha).queryByRole("button", { name: /Ações de/ })).toBeNull();

    await act(async () => {
      soltar();
    });
    const link = await screen.findByRole("link", { name: /Espaço recém-criado/ });
    expect(link.getAttribute("href")).toBe(`/estrutura/espacos/${id}`);
    expect(linhasSalvando("Espaço recém-criado")).toHaveLength(0);
  });
});
