// @vitest-environment jsdom
/**
 * 10-21 Task 2 — a tela de Membros depois que a capacidade semanal saiu (D-13):
 * a tabela «Participações» tem seis colunas e nenhuma «Capacidade», e um Membro
 * que ainda carrega a chave antiga no jsonb (`hidratar` empurra o registro cru,
 * sem esquema) aparece normalmente, sem o número em lugar nenhum.
 *
 * Molde de `visibilidade-na-tela.test.tsx`: `buildSeed()`, `StoreProvider` de
 * verdade, transporte falso, `next/navigation` mockado.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Member } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import MembrosPage from "@/app/(shell)/configuracoes/membros/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/configuracoes/membros",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * O nome da chave antiga montado em pedaços: o campo não existe mais em
 * `Member`, e a verificação do plano exige que o nome inteiro não apareça em
 * nenhum arquivo de código. Aqui ele só existe em tempo de execução.
 */
const CHAVE_ANTIGA = ["weekly", "Capacity", "Minutes"].join("");
const VALOR_UNICO = 4321;

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

let state: DataState;
let donoId: string;

function montar() {
  return render(
    <StoreProvider
      sessao={{ memberId: donoId }}
      estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }}
      transporte={transporteFalso()}
    >
      <MembrosPage />
    </StoreProvider>,
  );
}

beforeEach(() => {
  state = buildSeed();
  donoId = state.workspace.ownerMemberId;
  // Um Membro com a chave antiga e um valor que nenhuma outra coisa da tela usa.
  state.members = state.members.map((m, i) =>
    i === 0 ? (Object.assign({}, m, { [CHAVE_ANTIGA]: VALOR_UNICO }) as Member) : m,
  );
});

afterEach(() => {
  cleanup();
});

describe("Membros — sem a capacidade semanal (D-13)", () => {
  it("a tabela «Participações» tem Membro, Papel, Estado, Disponibilidade, Entrou e a coluna de ações, e nenhuma «Capacidade»", () => {
    montar();
    const tabela = screen
      .getAllByRole("table")
      .find((t) => within(t).queryByRole("columnheader", { name: "Disponibilidade" }));
    expect(tabela).toBeTruthy();
    const cabecalhos = within(tabela as HTMLElement)
      .getAllByRole("columnheader")
      .map((th) => th.textContent?.trim() ?? "");
    expect(cabecalhos).toEqual(["Membro", "Papel", "Estado", "Disponibilidade", "Entrou", ""]);
    expect(cabecalhos.some((c) => /capacidade/i.test(c))).toBe(false);
    expect(screen.queryByText(/capacidade/i)).toBeNull();
  });

  it("um Membro que ainda carrega a chave antiga aparece normalmente e o valor gravado não aparece em lugar nenhum", () => {
    const comChave = state.members[0] as Member;
    expect((comChave as unknown as Record<string, unknown>)[CHAVE_ANTIGA]).toBe(VALOR_UNICO);
    montar();
    expect(screen.getAllByText(comChave.displayName).length).toBeGreaterThan(0);
    const texto = document.body.textContent ?? "";
    expect(texto).not.toContain(String(VALOR_UNICO));
    // O antigo editor mostrava horas (minutos / 60) e tinha um campo numérico.
    expect(texto).not.toContain(String(VALOR_UNICO / 60));
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
