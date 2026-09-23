// @vitest-environment jsdom
/**
 * 03-15 Task 2 — prova de um invariante que atravessa telas: nenhuma
 * superfície que lista Tarefa desenha o que `memberSeesTask` nega. Vive em
 * `features/shell/` e não junto das páginas por dois motivos: (1) o que ele
 * prova não é comportamento de UMA tela, é um invariante que a busca global
 * e "Minhas Tarefas" compartilham; (2) `app/` é território de convenção de
 * arquivo do Next — nada além das rotas entra ali.
 *
 * Molde igual a `compartilhadas-comigo.test.tsx`: `buildSeed()`,
 * `ordensDeTodasAsColecoes`, `StoreProvider` de verdade, zero rede.
 */

import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import BuscarPage from "@/app/(shell)/buscar/page";
import TarefasPage from "@/app/(shell)/estrutura/tarefas/page";

/**
 * `next/navigation` é mockado no precedente de `formulario.test.tsx:16-22`:
 * `useSearchParams` devolve um `URLSearchParams` REAL mutável por teste
 * (`__setParams`), que é o que `BuscarPage` lê (`params.get("q")`) — o termo
 * não vem de digitação simulada.
 */
vi.mock("next/navigation", () => {
  let params = new URLSearchParams();
  return {
    usePathname: () => "/",
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useSearchParams: () => params,
    __setParams: (next: URLSearchParams) => {
      params = next;
    },
  };
});

async function comQuery(q: string) {
  const nav = (await import("next/navigation")) as unknown as { __setParams: (p: URLSearchParams) => void };
  nav.__setParams(new URLSearchParams({ q }));
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

function transporteFalso(): Transporte {
  return {
    gravar: vi.fn(async (): Promise<RespostaDeGravacao> => ({ tipo: "falha", erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
}

function montar(ui: ReactElement, state: DataState, ordens: Ordens, memberId: string) {
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporteFalso()}>
      {ui}
    </StoreProvider>,
  );
}

let state: DataState;
let ordens: Ordens;

beforeEach(() => {
  state = buildSeed();
  ordens = ordensDeTodasAsColecoes(state);
});

afterEach(() => {
  cleanup();
});

describe("Busca global — a permissão que o cabeçalho B103 prometia", () => {
  it("(h) mesmo termo, mesmo estado: só a sessão muda o resultado", async () => {
    await comQuery("nimbus");

    montar(<BuscarPage />, state, ordens, "mem_thiago_pereira");
    expect(screen.queryByText("Plataforma white label — Nimbus")).toBeNull();
    cleanup();

    montar(<BuscarPage />, state, ordens, "mem_joao_konq");
    expect(screen.getByText("Plataforma white label — Nimbus")).toBeTruthy();
  });

  it("(i) o mesmo termo do lado do Pedro devolve as três contas dele, e nada para o Lucas", async () => {
    await comQuery("pedro alencar");

    montar(<BuscarPage />, state, ordens, "mem_joao_konq");
    expect(screen.queryByText("Pedro Alencar Consultoria em Dados")).toBeNull();
    cleanup();

    montar(<BuscarPage />, state, ordens, "mem_thiago_pereira");
    expect(screen.getAllByText("Pedro Alencar Consultoria em Dados").length).toBe(3);
  });

  it("(j) a Lista some da busca para quem não a alcança — 'demais Membros não veem a Lista', também na busca", async () => {
    await comQuery("contas a pagar");

    montar(<BuscarPage />, state, ordens, "mem_rafael");
    expect(screen.queryByText("Contas a pagar")).toBeNull();
    cleanup();

    montar(<BuscarPage />, state, ordens, "mem_maryane");
    expect(screen.getByText("Contas a pagar")).toBeTruthy();
  });
});

describe("'Minhas Tarefas' — a aba que vazava o Espaço inteiro", () => {
  it("(k) 'Todas que eu vejo' mostra só o que memberSeesTask concede a cada sessão", () => {
    montar(<TarefasPage />, state, ordens, "mem_thiago_pereira");
    fireEvent.click(screen.getByRole("tab", { name: /Todas que eu vejo/ }));
    expect(screen.getAllByText("Pedro Alencar Consultoria em Dados").length).toBe(3);
    expect(screen.queryByText("Plataforma white label — Nimbus")).toBeNull();
    cleanup();

    montar(<TarefasPage />, state, ordens, "mem_joao_konq");
    fireEvent.click(screen.getByRole("tab", { name: /Todas que eu vejo/ }));
    expect(screen.getByText("Plataforma white label — Nimbus")).toBeTruthy();
    expect(screen.queryByText("Pedro Alencar Consultoria em Dados")).toBeNull();
  });

  it("(l) o contador da aba é o tamanho do conjunto FILTRADO, não state.tasks.length", () => {
    montar(<TarefasPage />, state, ordens, "mem_joao_konq");
    const aba = screen.getByRole("tab", { name: /Todas que eu vejo/ });
    expect(within(aba).getByText("1")).toBeTruthy();
    expect(state.tasks.length).toBeGreaterThan(1);
  });

  it("(m) quem já alcançava a Lista pela árvore continua vendo tudo — o filtro aperta o Convidado, não estreita quem tinha direito", () => {
    montar(<TarefasPage />, state, ordens, "mem_maryane");
    fireEvent.click(screen.getByRole("tab", { name: /Todas que eu vejo/ }));
    // RecordList pagina 25 por vez ("Mostrar mais"); as contas de Contas a
    // pagar não estão nas primeiras 25 por vencimento — carregar o resto
    // antes de afirmar que elas continuam alcançáveis para quem já as via.
    let botao = screen.queryByRole("button", { name: "Mostrar mais" });
    while (botao) {
      fireEvent.click(botao);
      botao = screen.queryByRole("button", { name: "Mostrar mais" });
    }
    expect(screen.getAllByText("Pedro Alencar Consultoria em Dados").length).toBe(3);
    expect(screen.getByText("Plataforma white label — Nimbus")).toBeTruthy();
  });
});

describe("Guarda de não-regressão — outra metade do critério 5", () => {
  it("a busca continua sem falar com apps/api (Transporte é o único caminho de rede)", async () => {
    await comQuery("nimbus");
    const transporte = transporteFalso();
    render(
      <StoreProvider sessao={{ memberId: "mem_maryane" }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
        <BuscarPage />
      </StoreProvider>,
    );
    expect(transporte.gravar).not.toHaveBeenCalled();
    expect(transporte.hidratar).not.toHaveBeenCalled();
  });
});
