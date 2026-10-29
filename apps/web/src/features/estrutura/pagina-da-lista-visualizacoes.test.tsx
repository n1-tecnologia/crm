// @vitest-environment jsdom
/**
 * Fase 10, 2.6.2 (EST-08) — a página da Lista consome as Visualizações padrão
 * herdadas: as abas vêm de `config.views.disponiveis` (filtradas pela lente) e a
 * Lista abre na inicial do Espaço, a menos que ela tenha uma salva padrão de um
 * tipo que continua à mostra.
 *
 * Molde de `pagina-do-espaco.test.tsx`: `buildSeed()`, `StoreProvider` de
 * verdade, zero rede; o estado é preparado pelas operações do domínio ANTES de
 * montar a página.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { setContainerDefaultViews } from "@n1/dominio/operations/configuration";
import { saveView, setDefaultView } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import ListaPage from "@/app/(shell)/estrutura/listas/[lista]/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/estrutura/listas/x",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const ESPACO = "spc_com";
const LISTA = "lst_prospeccao";

let state: DataState;
let dono: string;

beforeEach(() => {
  // `CorpoDeTela` mede o corpo com `ResizeObserver`, que o jsdom não traz.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  state = buildSeed();
  dono = state.workspace.ownerMemberId;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function montar(listaId: string = LISTA) {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  const params = Promise.resolve({ lista: listaId });
  await act(async () => {
    render(
      <StoreProvider sessao={{ memberId: dono }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
        <Suspense fallback="carregando">
          <ListaPage params={params} />
        </Suspense>
      </StoreProvider>,
    );
  });
}

const nomesDasAbas = (): string[] =>
  screen.queryAllByRole("tab", { name: /^(Lista|Quadro|Calendário|Tabela|Linha do tempo)$/ }).map((aba) => aba.textContent ?? "");
const abaAtiva = (): string => screen.getAllByRole("tab", { selected: true })[0]?.textContent ?? "";

function definirNoEspaco(valor: Parameters<typeof setContainerDefaultViews>[4]) {
  const resultado = setContainerDefaultViews(state, dono, "space", ESPACO, valor);
  if (!resultado.ok) throw new Error(resultado.error);
}

describe("Página da Lista — as abas vêm das Visualizações padrão (EST-08)", () => {
  it("sem definição no Espaço, mostra as cinco abas e abre na Lista", async () => {
    await montar();

    expect(nomesDasAbas()).toEqual(["Lista", "Quadro", "Calendário", "Tabela", "Linha do tempo"]);
    expect(abaAtiva()).toBe("Lista");
  });

  it("o Espaço tira o Calendário e escolhe o Quadro como inicial: a aba some e a Lista sem padrão própria abre no Quadro", async () => {
    definirNoEspaco({ disponiveis: ["lista", "quadro", "tabela", "linhaDoTempo"], inicial: "quadro" });

    await montar();

    expect(nomesDasAbas()).not.toContain("Calendário");
    expect(nomesDasAbas()).toEqual(["Lista", "Quadro", "Tabela", "Linha do tempo"]);
    expect(abaAtiva()).toBe("Quadro");
  });

  it("a Lista com salva padrão própria cujo tipo continua à mostra abre nela, não na inicial do Espaço", async () => {
    definirNoEspaco({ disponiveis: ["lista", "quadro", "tabela"], inicial: "quadro" });
    const salva = saveView(state, dono, { listId: LISTA, name: "Minha tabela", kind: "tabela", filters: {}, shared: true });
    if (!salva.ok) throw new Error(salva.error);
    const padrao = setDefaultView(state, dono, salva.value.id, true);
    if (!padrao.ok) throw new Error(padrao.error);

    await montar();

    expect(abaAtiva()).toBe("Tabela");
  });

  it("a salva padrão de um tipo que o Espaço tirou fica guardada e não abre: a Lista abre na inicial", async () => {
    const salva = saveView(state, dono, { listId: LISTA, name: "Meu calendário", kind: "calendario", filters: {}, shared: true });
    if (!salva.ok) throw new Error(salva.error);
    const padrao = setDefaultView(state, dono, salva.value.id, true);
    if (!padrao.ok) throw new Error(padrao.error);
    definirNoEspaco({ disponiveis: ["lista", "quadro", "tabela"], inicial: "quadro" });

    await montar();

    expect(abaAtiva()).toBe("Quadro");
    // Nada foi apagado: a salva continua no estado.
    expect(state.views.some((v) => v.id === salva.value.id)).toBe(true);
  });

  it("o Espaço só liberou a Linha do tempo e a Lista é conversacional: sobra só a aba Lista", async () => {
    definirNoEspaco({ disponiveis: ["linhaDoTempo"], inicial: "linhaDoTempo" });

    await montar("lst_pos_venda");

    // Com uma única aba a barra de Abas nem é desenhada (Task 2); aqui basta a Lista ser a única.
    expect(nomesDasAbas().filter((nome) => nome !== "Lista")).toEqual([]);
  });

  it("a Lista conversacional não ganha a Linha do tempo mesmo com o Espaço liberando todas", async () => {
    await montar("lst_pos_venda");

    expect(nomesDasAbas()).toEqual(["Lista", "Quadro", "Calendário", "Tabela"]);
  });
});
