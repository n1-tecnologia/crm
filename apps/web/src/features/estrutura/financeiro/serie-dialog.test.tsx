// @vitest-environment jsdom
/**
 * Fase 15, 3.4.10 (UCR-08) — o diálogo "Nova série de parcelas" escolhe o cliente entre os Contatos
 * do CRM novo (`useContatos`, com busca), não do store: o estado não guarda Contato.
 * A chamada que vai ao servidor leva o id do Contato escolhido (o `clientes` junto serve só à
 * execução local, e o servidor o descarta).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { PedidoDeGravacao, RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { SerieDeParcelasDialog } from "./serie-dialog";

const crm = vi.hoisted(() => ({ pedidos: [] as Array<{ q?: string | undefined }>, itens: [] as unknown[] }));
vi.mock("@/dados/crm/contatos", () => ({
  useContatos: (filtro: { q?: string }) => {
    crm.pedidos.push({ q: filtro.q });
    return { data: { ok: true, itens: crm.itens, total: crm.itens.length }, isLoading: false };
  },
}));

const CONTATO = "11111111-1111-4111-8111-111111111111";

let state: DataState;
let gravados: PedidoDeGravacao[];

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  state = buildSeed();
  gravados = [];
  crm.pedidos = [];
  crm.itens = [
    { id: CONTATO, nomeDeExibicao: "Ana Lima", estado: "ativo", proprietarioId: "mem_rafael", emailPrincipal: null, telefonePrincipal: null, atualizadoEm: "2026-11-01T00:00:00.000Z" },
  ];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function transporte(): Transporte {
  return {
    gravar: vi.fn(async (pedido): Promise<RespostaDeGravacao> => {
      gravados.push(pedido);
      return { tipo: "estado", resultado: pedido.resultado, estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: {}, memberId: "" } };
    }),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
}

const daqui = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("SerieDeParcelasDialog — o cliente vem dos Contatos do CRM novo", () => {
  it("lista os Contatos de useContatos, busca pelo texto digitado e cria a série com o id escolhido", async () => {
    const aoCriar = vi.fn();
    await act(async () => {
      render(
        <StoreProvider sessao={{ memberId: CP.financeiroId }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte()}>
          <SerieDeParcelasDialog open onClose={() => undefined} onCreated={aoCriar} />
        </StoreProvider>,
      );
    });

    // A busca vai para useContatos como `q`.
    fireEvent.change(screen.getByLabelText("Buscar cliente"), { target: { value: "ana" } });
    expect(crm.pedidos.some((p) => p.q === "ana")).toBe(true);

    fireEvent.click(screen.getByLabelText("Cliente (Contato do CRM)"));
    fireEvent.click(screen.getByRole("option", { name: "Ana Lima" }));
    fireEvent.click(screen.getByLabelText("Centro de Custo"));
    fireEvent.click(screen.getAllByRole("option")[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText("Valor de cada parcela (R$)"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Vencimento da 1ª parcela"), { target: { value: daqui(10) } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Criar 1 parcela/ }));
    });

    expect(aoCriar).toHaveBeenCalledTimes(1);
    const [contas, nome] = aoCriar.mock.calls[0] as [Array<{ title: string }>, string];
    expect(nome).toBe("Ana Lima");
    expect(contas.map((c) => c.title)).toEqual(["1ª Parcela – Ana Lima"]);
    const chamada = gravados[0]?.chamadas[0];
    expect(chamada?.nome).toBe("createReceivableSeries");
    expect((chamada?.args[0] as { contactId: string }).contactId).toBe(CONTATO);
  });
});
