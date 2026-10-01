// @vitest-environment jsdom
/**
 * Checklist 1.1 — nas configurações da Lista, os Campos herdados aparecem com
 * "usar aqui"; desligar um é UMA chamada `usarCampoHerdado`, que sairia para
 * o servidor. `StoreProvider` de verdade sobre um `Transporte` falso.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { PedidoDeGravacao, Transporte } from "@/dados/transporte";
import { FieldDefinitionsEditor } from "./configuration-editors";

afterEach(() => cleanup());

function montar(estado: DataState = buildSeed()) {
  const gravar = vi.fn<Transporte["gravar"]>(async () => ({ tipo: "falha", erro: "fim do teste" }));
  render(
    <StoreProvider sessao={{ memberId: estado.workspace.ownerMemberId }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={{ gravar, hidratar: async () => ({ tipo: "falha", erro: "sem servidor" }) }}>
      <FieldDefinitionsEditor containerType="list" containerId="lst_prospeccao" report={() => {}} />
    </StoreProvider>,
  );
  return { gravar };
}

describe("Campos herdados — usar aqui (checklist 1.1)", () => {
  it("lista os Campos que vêm do Espaço, com de onde vêm, e desligar um chama usarCampoHerdado", () => {
    const { gravar } = montar();
    const secao = screen.getByRole("region", { name: "Campos herdados" });
    const linha = within(secao).getByText("Centro de custo").closest("li") as HTMLElement;
    expect(linha.textContent).toContain("de Comercial");
    fireEvent.click(within(linha).getByRole("switch"));
    expect(gravar).toHaveBeenCalledTimes(1);
    const chamada = (gravar.mock.calls[0]![0] as PedidoDeGravacao).chamadas[0]!;
    expect(chamada.nome).toBe("usarCampoHerdado");
    expect(chamada.args).toEqual(["list", "lst_prospeccao", "fd_centro", false]);
  });

  it("um Campo que um Formulário ativo pergunta não sai: a recusa do domínio, sem chamada ao servidor", () => {
    const estado = buildSeed();
    const demo = estado.forms.find((f) => f.id === "frm_demo")!;
    demo.questions.push({ id: "fqs_teste_cliente", label: "Cliente", required: false, target: { kind: "field", definitionId: "fd_cliente" } });
    const { gravar } = montar(estado);
    const secao = screen.getByRole("region", { name: "Campos herdados" });
    const linha = within(secao).getByText("Cliente").closest("li") as HTMLElement;
    fireEvent.click(within(linha).getByRole("switch"));
    expect(gravar).not.toHaveBeenCalled();
  });
});
