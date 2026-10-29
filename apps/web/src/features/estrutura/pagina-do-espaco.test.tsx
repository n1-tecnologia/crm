// @vitest-environment jsdom
/**
 * 10-09 (2.1.9, D-17) — a página do Espaço no formato da página da Pasta:
 * seções Listas e Pastas, menu "Criar", "Privado" como selo, Painéis só quando
 * houver, e cada grupo na ordem gravada (`irmaosOrdenados`).
 *
 * Molde de `visibilidade-na-tela.test.tsx`: `buildSeed()`, `StoreProvider` de
 * verdade, zero rede. `next/navigation` é mockado para o teste ler o que
 * `openCreate` grava na URL (`router.replace`).
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { memberReachesContainer } from "@n1/dominio/derive";
import { archiveContainer, createFolder, createList, createSpace } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import EspacoPage from "@/app/(shell)/estrutura/espacos/[espaco]/page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const THIAGO = "mem_thiago";
const COMERCIAL = "spc_com";

let state: DataState;

beforeEach(() => {
  state = buildSeed();
  replace.mockReset();
});

afterEach(() => {
  cleanup();
});

async function montar(espacoId: string, memberId = THIAGO) {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  const params = Promise.resolve({ espaco: espacoId });
  await act(async () => {
    render(
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
        <Suspense fallback="carregando">
          <EspacoPage params={params} />
        </Suspense>
      </StoreProvider>,
    );
  });
}

/** Os nomes dos links de uma seção da página, na ordem em que aparecem. */
function linksDe(prefixo: string): string[] {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href^="${prefixo}"]`))
    .filter((a) => !a.getAttribute("href")!.endsWith("/configuracoes"))
    .map((a) => a.getAttribute("href")!.slice(prefixo.length));
}

function abrirMenuCriar() {
  fireEvent.click(screen.getByRole("button", { name: /Criar neste Espaço/ }));
}

describe("Página do Espaço — formato da Pasta (2.1.9)", () => {
  it("lista as Listas e depois as Pastas, cada grupo em régua, e não tem mais o painel «Atributos»", async () => {
    await montar(COMERCIAL);

    const listas = screen.getByText("Listas", { selector: "*" });
    const pastas = screen.getAllByText("Pastas")[0]!;
    // Listas vem antes de Pastas no documento (formato da Pasta; I4).
    expect(listas.compareDocumentPosition(pastas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByText("Prospecção")).toBeTruthy();
    expect(screen.getByText("Indicadores comerciais")).toBeTruthy();
    expect(screen.queryByText("Atributos")).toBeNull();
    expect(screen.queryByText("Criado por")).toBeNull();

    // Os atalhos seguem depois das Listas, na mesma seção.
    const ultimaLista = document.querySelector<HTMLAnchorElement>('a[href="/estrutura/listas/lst_pos_venda"]')!;
    const atalho = screen.getByText(/Caixa de Entrada do CRM/);
    expect(ultimaLista.compareDocumentPosition(atalho) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("mostra cada grupo na ordem de `order`: inverter duas Listas muda a ordem na tela", async () => {
    await montar(COMERCIAL);
    expect(linksDe("/estrutura/listas/")).toEqual(["lst_prospeccao", "lst_indicadores", "lst_pos_venda"]);
    cleanup();

    const lista = (id: string) => state.lists.find((l) => l.id === id)!;
    const primeira = lista("lst_prospeccao");
    const ultima = lista("lst_pos_venda");
    const [ordemA, ordemB] = [primeira.order, ultima.order];
    (primeira as { order: number }).order = ordemB;
    (ultima as { order: number }).order = ordemA;

    await montar(COMERCIAL);
    expect(linksDe("/estrutura/listas/")).toEqual(["lst_pos_venda", "lst_indicadores", "lst_prospeccao"]);
  });

  it("o menu «Criar neste Espaço» tem Lista e Pasta, nessa ordem, e «Lista» abre o diálogo com o Espaço já escolhido", async () => {
    await montar(COMERCIAL);
    abrirMenuCriar();

    const itens = screen.getAllByRole("menuitem").map((i) => i.textContent?.trim());
    expect(itens).toEqual(["Lista", "Pasta"]);

    fireEvent.click(screen.getByRole("menuitem", { name: "Lista" }));
    expect(replace).toHaveBeenCalledTimes(1);
    const destino = new URL(String(replace.mock.calls[0]![0]), "http://x");
    expect(destino.searchParams.get("criar")).toBe(`lista:space:${COMERCIAL}`);
  });

  it("«Pasta» pede a criação de uma Pasta dentro do Espaço", async () => {
    await montar(COMERCIAL);
    abrirMenuCriar();
    fireEvent.click(screen.getByRole("menuitem", { name: "Pasta" }));
    const destino = new URL(String(replace.mock.calls[0]![0]), "http://x");
    expect(destino.searchParams.get("criar")).toBe(`pasta:space:${COMERCIAL}`);
  });

  it("Espaço arquivado não tem «Criar», mas mostra o selo", async () => {
    expect(archiveContainer(state, THIAGO, "space", COMERCIAL).ok).toBe(true);
    await montar(COMERCIAL);
    expect(screen.queryByRole("button", { name: /Criar neste Espaço/ })).toBeNull();
    expect(within(screen.getByRole("heading", { level: 1 })).getByText("arquivado")).toBeTruthy();
  });

  it("um Espaço privado ganha o selo «Privado» ao lado do título, não uma linha de atributos", async () => {
    await montar("spc_mkt");
    const titulo = screen.getByRole("heading", { level: 1 });
    expect(within(titulo).getByText("Privado")).toBeTruthy();
  });

  it("Espaço inexistente mostra «Espaço não encontrado.»", async () => {
    await montar("spc_nao_existe");
    expect(screen.getByText("Espaço não encontrado.")).toBeTruthy();
  });

  it("só mostra as Pastas que o Membro alcança", async () => {
    const privada = createFolder(state, THIAGO, { name: "Reservada", parentType: "space", parentId: COMERCIAL, isPrivate: true });
    expect(privada.ok).toBe(true);
    const id = privada.ok ? privada.value.id : "";
    expect(memberReachesContainer(state, "mem_tiago", "folder", id)).toBe(false);
    await montar(COMERCIAL, "mem_tiago");
    expect(screen.queryByText("Reservada")).toBeNull();
  });
});

// `createList`/`createSpace` ficam importados para os casos de vazio e plural.
void createList;
void createSpace;
