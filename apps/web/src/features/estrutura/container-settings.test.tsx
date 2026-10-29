// @vitest-environment jsdom
/**
 * Fase 10, 2.1.8 (EST-03) — as Configurações do contêiner em abas, com a aba na
 * URL. O teste monta `ContainerSettings` com o seed real e o `StoreProvider` de
 * verdade; só `next/navigation` é falso, e `useSearchParams` devolve um
 * `URLSearchParams` REAL por teste (molde de `visibilidade-na-tela.test.tsx`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";


import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { ContainerSettings, abaDasConfiguracoes } from "./container-settings";

const navegacao = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: navegacao.replace, push: vi.fn() }),
  useSearchParams: () => navegacao.params,
}));

beforeEach(() => {
  navegacao.params = new URLSearchParams();
  navegacao.replace.mockReset();
});
afterEach(() => cleanup());

const TRANSPORTE: Transporte = {
  gravar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
  hidratar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
};

function montar(kind: "space" | "folder" | "list", id: string, estado: DataState = buildSeed()) {
  return render(
    <StoreProvider
      sessao={{ memberId: estado.workspace.ownerMemberId }}
      estadoInicial={{ data: estado, revisao: 1, ordens: {} }}
      transporte={TRANSPORTE}
    >
      <ContainerSettings kind={kind} id={id} />
    </StoreProvider>,
  );
}

const abaSelecionada = (): string => screen.getByRole("tab", { selected: true }).textContent ?? "";

describe("abaDasConfiguracoes — o fallback para `geral` (T-10-21)", () => {
  it("aceita só as chaves da lista fechada do nível e cai em `geral` no resto", () => {
    expect(abaDasConfiguracoes("campos", "list")).toBe("campos");
    expect(abaDasConfiguracoes("tipos-de-tarefa", "space")).toBe("tipos-de-tarefa");
    expect(abaDasConfiguracoes("formularios", "list")).toBe("formularios");
    expect(abaDasConfiguracoes("modelo-e-canais", "list")).toBe("modelo-e-canais");
    expect(abaDasConfiguracoes(null, "list")).toBe("geral");
    expect(abaDasConfiguracoes("", "list")).toBe("geral");
    expect(abaDasConfiguracoes("inexistente", "list")).toBe("geral");
    expect(abaDasConfiguracoes("formularios", "space")).toBe("geral");
    expect(abaDasConfiguracoes("modelo-e-canais", "folder")).toBe("geral");
    // A aba Visualizações só nasce com o editor (10-10): até lá é desconhecida.
    expect(abaDasConfiguracoes("visualizacoes", "list")).toBe("geral");
  });
});

describe("ContainerSettings — a aba vem da URL", () => {
  it("?aba=campos abre a Lista direto em Campos, com o editor de Campos e sem o de Status", () => {
    navegacao.params = new URLSearchParams({ aba: "campos" });
    montar("list", "lst_prospeccao");

    expect(abaSelecionada()).toBe("Campos");
    expect(screen.getByRole("region", { name: "Campos herdados" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sobrescrever aqui" })).toBeNull();
  });

  it("?aba= ausente ou desconhecida cai em Geral, que traz a Identidade e o Ciclo de vida", () => {
    montar("list", "lst_prospeccao");
    expect(abaSelecionada()).toBe("Geral");
    cleanup();

    navegacao.params = new URLSearchParams({ aba: "inexistente" });
    montar("list", "lst_prospeccao");
    expect(abaSelecionada()).toBe("Geral");
  });

  it("Espaço com ?aba=formularios cai em Geral, e o Espaço não tem as abas só da Lista", () => {
    navegacao.params = new URLSearchParams({ aba: "formularios" });
    montar("space", "spc_com");

    expect(abaSelecionada()).toBe("Geral");
    expect(screen.queryByRole("tab", { name: "Formulários" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Modelo e canais" })).toBeNull();
  });

  it("a Lista tem Formulários e Modelo e canais, e não tem a aba Visualizações ainda", () => {
    montar("list", "lst_prospeccao");
    const nomes = screen.getAllByRole("tab").map((aba) => aba.textContent);
    expect(nomes).toEqual(["Geral", "Status", "Funcionalidades", "Campos", "Tipos de Tarefa", "Formulários", "Modelo e canais"]);
  });

  it("clicar em Status faz router.replace com ?aba=status e scroll: false, mantendo os outros parâmetros", () => {
    navegacao.params = new URLSearchParams({ x: "1" });
    montar("list", "lst_prospeccao");

    fireEvent.click(screen.getByRole("tab", { name: "Status" }));

    expect(navegacao.replace).toHaveBeenCalledTimes(1);
    expect(navegacao.replace).toHaveBeenCalledWith("/?x=1&aba=status", { scroll: false });
  });

  it("o texto da tabela antiga não aparece em nenhuma das abas", () => {
    for (const aba of ["geral", "status", "funcionalidades", "campos", "tipos-de-tarefa", "formularios", "modelo-e-canais"]) {
      navegacao.params = new URLSearchParams({ aba });
      montar("list", "lst_prospeccao");
      expect(screen.queryByText(/Aspectos configuráveis/)).toBeNull();
      expect(screen.queryByText("Origem do valor")).toBeNull();
      cleanup();
    }
  });
});
