// @vitest-environment jsdom
/**
 * Fase 10, 2.6.2 (D-06, T-10-26) — a barra de Visualizações salvas só lista as
 * de tipo que a Lista mostra. Esconder não é apagar: a salva volta junto com o
 * tipo, e o estado nunca perde nenhuma. Se a salva ATIVA some, a seleção limpa
 * sem aviso.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { saveView, setDefaultView } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import type { View } from "@n1/dominio/types";
import { FILTRO_VAZIO, ViewBar } from "./view-bar";
import type { TipoDeAba } from "./tipo-de-visualizacao";

afterEach(() => cleanup());

const LISTA = "lst_prospeccao";
const TODAS: readonly TipoDeAba[] = ["lista", "quadro", "calendario", "tabela", "linha"];
const SEM_CALENDARIO: readonly TipoDeAba[] = ["lista", "quadro", "tabela", "linha"];

const TRANSPORTE: Transporte = {
  gravar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
  hidratar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
};

function comTresSalvas(): { readonly estado: DataState; readonly salvas: Record<"lista" | "calendario" | "quadro", View> } {
  const estado = buildSeed();
  const dono = estado.workspace.ownerMemberId;
  const salvar = (name: string, kind: View["kind"]): View => {
    const resultado = saveView(estado, dono, { listId: LISTA, name, kind, filters: {}, shared: true });
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.value;
  };
  return {
    estado,
    salvas: { lista: salvar("Minha lista", "lista"), calendario: salvar("Meu calendário", "calendario"), quadro: salvar("Meu quadro", "quadro") },
  };
}

function barra(estado: DataState, abas: readonly TipoDeAba[], extras: Partial<Parameters<typeof ViewBar>[0]> = {}) {
  const props = {
    listId: LISTA,
    filters: FILTRO_VAZIO,
    sortBy: undefined,
    kind: "lista" as const,
    abas,
    onFilters: vi.fn(),
    onSort: vi.fn(),
    activeViewId: null,
    onOpenView: vi.fn(),
    report: vi.fn(),
    ...extras,
  };
  const arvore = (proximas: readonly TipoDeAba[]) => (
    <StoreProvider sessao={{ memberId: estado.workspace.ownerMemberId }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={TRANSPORTE}>
      <ViewBar {...props} abas={proximas} />
    </StoreProvider>
  );
  return { props, arvore };
}

const chip = (nome: string) => screen.queryByRole("button", { name: new RegExp(`^${nome}`) });

describe("ViewBar — as salvas de tipo indisponível somem e voltam (D-06)", () => {
  it("some e volta: sem o Calendário nas abas a salva dele sai da barra, e com ele de volta reaparece", () => {
    const { estado, salvas } = comTresSalvas();
    const { arvore } = barra(estado, SEM_CALENDARIO);

    const { rerender } = render(arvore(SEM_CALENDARIO));
    expect(chip("Minha lista")).toBeTruthy();
    expect(chip("Meu quadro")).toBeTruthy();
    expect(chip("Meu calendário")).toBeNull();
    // T-10-26: o filtro é só de leitura — a salva continua guardada no estado.
    expect(estado.views.some((v) => v.id === salvas.calendario.id)).toBe(true);

    rerender(arvore(TODAS));
    expect(chip("Meu calendário")).toBeTruthy();
    expect(chip("Minha lista")).toBeTruthy();
    expect(chip("Meu quadro")).toBeTruthy();
    expect(estado.views.filter((v) => v.listId === LISTA)).toHaveLength(3);
  });

  it("«Salvar Visualização» continua à mostra, mesmo com salvas escondidas", () => {
    const { estado } = comTresSalvas();
    render(barra(estado, ["lista"]).arvore(["lista"]));

    expect(screen.getByRole("button", { name: "Salvar Visualização" })).toBeTruthy();
    expect(chip("Meu quadro")).toBeNull();
    expect(chip("Meu calendário")).toBeNull();
  });

  it("a salva ativa cujo tipo sumiu limpa a seleção (filtros vazios), sem Toast", () => {
    const { estado, salvas } = comTresSalvas();
    const { props, arvore } = barra(estado, SEM_CALENDARIO, { activeViewId: salvas.calendario.id });

    render(arvore(SEM_CALENDARIO));

    expect(props.onOpenView).toHaveBeenCalledWith(null);
    expect(props.onFilters).toHaveBeenCalledWith(FILTRO_VAZIO);
    expect(props.onSort).toHaveBeenCalledWith(undefined);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(props.report).not.toHaveBeenCalled();
  });

  it("a salva ativa cujo tipo continua à mostra não é tocada", () => {
    const { estado, salvas } = comTresSalvas();
    const { props, arvore } = barra(estado, SEM_CALENDARIO, { activeViewId: salvas.quadro.id });

    render(arvore(SEM_CALENDARIO));

    expect(props.onOpenView).not.toHaveBeenCalled();
    expect(props.onFilters).not.toHaveBeenCalled();
    expect(chip("Meu quadro")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("a salva padrão de um tipo escondido continua `isDefault` no estado: some da barra e volta marcada como padrão", () => {
    const { estado, salvas } = comTresSalvas();
    const dono = estado.workspace.ownerMemberId;
    const padrao = setDefaultView(estado, dono, salvas.calendario.id, true);
    expect(padrao.ok).toBe(true);
    const { arvore } = barra(estado, SEM_CALENDARIO);

    const { rerender } = render(arvore(SEM_CALENDARIO));
    expect(chip("Meu calendário")).toBeNull();
    expect(estado.views.find((v) => v.id === salvas.calendario.id)?.isDefault).toBe(true);

    rerender(arvore(TODAS));
    expect(chip("Meu calendário")?.textContent).toContain("padrão");
  });
});
