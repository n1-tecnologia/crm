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

/** Cria um Espaço com `listas` Listas e `pastas` Pastas diretas, pelas operações do domínio. */
function espacoCom(nome: string, listas: number, pastas: number): string {
  const espaco = createSpace(state, THIAGO, { name: nome });
  if (!espaco.ok) throw new Error(espaco.error);
  for (let i = 1; i <= listas; i++) {
    expect(createList(state, THIAGO, { name: `Lista ${i} de ${nome}`, parentType: "space", parentId: espaco.value.id }).ok).toBe(true);
  }
  for (let i = 1; i <= pastas; i++) {
    expect(createFolder(state, THIAGO, { name: `Pasta ${i} de ${nome}`, parentType: "space", parentId: espaco.value.id }).ok).toBe(true);
  }
  return espaco.value.id;
}

describe("Página do Espaço — Painéis, vazios e plural (2.1.9)", () => {
  it("sem Painel ancorado, nem a régua «Painéis» nem a dica aparecem", async () => {
    await montar(COMERCIAL);
    expect(screen.queryByText("Painéis")).toBeNull();
    expect(screen.queryByText(/Um Painel é criado em Painéis/)).toBeNull();
    expect(screen.queryByText(/Nenhum Painel/)).toBeNull();
  });

  it("com um Painel ancorado, aparece a régua «Painéis» com a contagem e o item", async () => {
    await montar("spc_ops");
    const regua = screen.getByText("Painéis");
    expect(regua).toBeTruthy();
    expect(regua.parentElement?.textContent).toContain("1");
    const painel = document.querySelector<HTMLAnchorElement>('a[href="/paineis/pnl_ops"]');
    expect(painel?.textContent).toContain("Operações");
  });

  it("um Espaço sem Lista nem Pasta mostra um só estado vazio, com «Nova Lista» abrindo o diálogo", async () => {
    const id = espacoCom("Vazio", 0, 0);
    await montar(id);

    expect(screen.getByText("Este Espaço está vazio.")).toBeTruthy();
    expect(screen.getByText("Crie uma Lista ou uma Pasta pelo botão Criar.")).toBeTruthy();
    // Um só aviso: nenhuma das duas réguas, nem as linhas de grupo vazio.
    expect(screen.queryByText("Nenhuma Lista.")).toBeNull();
    expect(screen.queryByText("Nenhuma Pasta.")).toBeNull();
    expect(screen.queryByText("Listas")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Nova Lista" }));
    const destino = new URL(String(replace.mock.calls[0]![0]), "http://x");
    expect(destino.searchParams.get("criar")).toBe(`lista:space:${id}`);
  });

  it("só sem Pastas: a régua «Pastas» diz «Nenhuma Pasta.» e as Listas seguem", async () => {
    const id = espacoCom("So listas", 1, 0);
    await montar(id);
    expect(screen.getByText("Nenhuma Pasta.")).toBeTruthy();
    expect(screen.queryByText("Nenhuma Lista.")).toBeNull();
    expect(screen.queryByText("Este Espaço está vazio.")).toBeNull();
    expect(screen.getByText("Lista 1 de So listas")).toBeTruthy();
  });

  it("só sem Listas: a régua «Listas» diz «Nenhuma Lista.» e as Pastas seguem", async () => {
    const id = espacoCom("So pastas", 0, 1);
    await montar(id);
    expect(screen.getByText("Nenhuma Lista.")).toBeTruthy();
    expect(screen.queryByText("Nenhuma Pasta.")).toBeNull();
    expect(screen.queryByText("Este Espaço está vazio.")).toBeNull();
    expect(screen.getByText("Pasta 1 de So pastas")).toBeTruthy();
  });

  it("um Espaço arquivado e vazio não oferece «Nova Lista»", async () => {
    const id = espacoCom("Arquivado vazio", 0, 0);
    expect(archiveContainer(state, THIAGO, "space", id).ok).toBe(true);
    await montar(id);
    expect(screen.getByText("Este Espaço está vazio.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nova Lista" })).toBeNull();
  });

  it("o cabeçalho conta no plural certo: «1 Lista · 2 Pastas» e «2 Listas · 1 Pasta»", async () => {
    await montar(espacoCom("Um e dois", 1, 2));
    expect(screen.getByText("1 Lista · 2 Pastas")).toBeTruthy();
    cleanup();
    await montar(espacoCom("Dois e um", 2, 1));
    expect(screen.getByText("2 Listas · 1 Pasta")).toBeTruthy();
  });

  it("um atalho conta como Lista na seção: um Espaço só com atalho não está vazio", async () => {
    const id = espacoCom("Com atalho", 0, 0);
    const espaco = state.spaces.find((s) => s.id === id)!;
    (espaco as { shortcuts?: unknown }).shortcuts = state.spaces.find((s) => s.id === COMERCIAL)!.shortcuts;
    await montar(id);
    expect(screen.queryByText("Este Espaço está vazio.")).toBeNull();
    expect(screen.getByText(/Caixa de Entrada do CRM/)).toBeTruthy();
  });
});
