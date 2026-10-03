// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { CP, CR } from "@n1/dominio/operations/financeiro";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { abrirGuiaDoFinanceiro, GuiaDoFinanceiro } from "./guia-do-financeiro-dialogo";
import { chaveDaEntrada, chaveDoProgresso, passosPara } from "./guia-do-financeiro";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push }),
  useSearchParams: () => new URLSearchParams(),
}));

function ordens(estado: DataState): Ordens {
  const resultado: Ordens = {};
  for (const [colecao, valor] of Object.entries(estado)) {
    if (!Array.isArray(valor)) continue;
    const porId: Record<string, number> = {};
    valor.forEach((registro, indice) => {
      if (registro && typeof registro === "object" && "id" in registro) porId[(registro as { id: string }).id] = indice;
    });
    resultado[colecao] = porId;
  }
  return resultado;
}

const transporte: Transporte = {
  gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não usado neste teste." })),
  hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não usado neste teste." })),
};

function montar(memberId: string) {
  const estado = buildSeed();
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: estado, revisao: 1, ordens: ordens(estado) }} transporte={transporte}>
      <GuiaDoFinanceiro />
    </StoreProvider>,
  );
}

const MARI = CP.financeiroId;
const progresso = () => JSON.parse(window.localStorage.getItem(chaveDoProgresso(MARI)) ?? "null");
/** Uma entrada nova: o navegador fechou e abriu (o `sessionStorage` some). */
const novaEntrada = () => {
  cleanup();
  window.sessionStorage.clear();
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  push.mockClear();
});
afterEach(() => cleanup());

describe("GuiaDoFinanceiro — abre na entrada, até 3 vezes", () => {
  it("na primeira entrada abre com o vídeo e conta a vez", async () => {
    montar(MARI);
    expect(await screen.findByText("Como funciona o Financeiro")).toBeTruthy();
    const video = document.querySelector("video");
    expect(video?.getAttribute("src")).toMatch(/\/storage\/v1\/object\/public\/guias\/financeiro\.mp4$/);
    expect(video?.muted).toBe(true);
    expect(progresso()).toEqual({ vezes: 1, dispensado: false });
    expect(window.sessionStorage.getItem(chaveDaEntrada(MARI))).not.toBeNull();
  });

  it("na mesma entrada não abre de novo (recarregar não conta)", () => {
    montar(MARI);
    cleanup();
    montar(MARI);
    expect(screen.queryByText("Como funciona o Financeiro")).toBeNull();
    expect(progresso().vezes).toBe(1);
  });

  it("abre nas três primeiras entradas e não na quarta", () => {
    for (let vez = 1; vez <= 3; vez += 1) {
      novaEntrada();
      montar(MARI);
      expect(screen.getByText("Como funciona o Financeiro")).toBeTruthy();
    }
    novaEntrada();
    montar(MARI);
    expect(screen.queryByText("Como funciona o Financeiro")).toBeNull();
    expect(progresso().vezes).toBe(3);
  });

  it("“Não mostrar mais” fecha e o guia não abre nas próximas entradas", () => {
    montar(MARI);
    fireEvent.click(screen.getByRole("button", { name: "Não mostrar mais" }));
    expect(progresso()).toEqual({ vezes: 1, dispensado: true });
    novaEntrada();
    montar(MARI);
    expect(screen.queryByText("Como funciona o Financeiro")).toBeNull();
  });

  it("quem não alcança o Financeiro nunca vê o guia", () => {
    montar(CR.comercialId);
    expect(screen.queryByText("Como funciona o Financeiro")).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("o menu reabre o guia mesmo depois de “Não mostrar mais”", async () => {
    montar(MARI);
    fireEvent.click(screen.getByRole("button", { name: "Não mostrar mais" }));
    // O diálogo do sistema sai com animação: desmonta um instante depois.
    await waitFor(() => expect(screen.queryByText("Como funciona o Financeiro")).toBeNull());
    act(() => abrirGuiaDoFinanceiro());
    expect(screen.getByText("Como funciona o Financeiro")).toBeTruthy();
  });
});

describe("GuiaDoFinanceiro — do vídeo ao passo a passo", () => {
  it("“Ver o passo a passo” anda pelos passos; “Ir para lá” navega e encolhe o guia", () => {
    montar(MARI);
    fireEvent.click(screen.getByRole("button", { name: "Ver o passo a passo" }));
    expect(screen.getByText(/Guia do Financeiro · passo 1 de \d/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText(/Guia do Financeiro · passo 2 de \d/)).toBeTruthy();

    const segundo = passosPara(buildSeed(), MARI)[1]!;
    fireEvent.click(screen.getByRole("button", { name: segundo.destino!.rotulo }));
    expect(push).toHaveBeenCalledWith(segundo.destino!.href);
    expect(screen.getByRole("region", { name: "Guia do Financeiro" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText(/Guia do Financeiro · passo 2 de \d/)).toBeTruthy();
  });
});
