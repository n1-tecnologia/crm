// @vitest-environment jsdom
/**
 * Fase 9, D-03 — `/ia/*` mostra "sem acesso" ao Convidado, sem montar as
 * páginas filhas. `StoreProvider` de verdade sobre um `Transporte` falso.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import LayoutDaIA from "@/app/(shell)/ia/layout";

const transporte: Transporte = {
  gravar: async () => ({ tipo: "falha", erro: "fim do teste" }),
  hidratar: async () => ({ tipo: "falha", erro: "sem servidor" }),
};

function montar(memberId: string) {
  const estado = buildSeed();
  render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={transporte}>
      <LayoutDaIA>
        <p>conteúdo da página de IA</p>
      </LayoutDaIA>
    </StoreProvider>,
  );
}

afterEach(() => cleanup());

describe("LayoutDaIA", () => {
  it("o Convidado vê 'a área de IA · sem acesso' e a página filha não é montada", () => {
    montar("mem_beatriz");
    expect(screen.getByText("a área de IA · sem acesso")).toBeTruthy();
    expect(screen.queryByText("conteúdo da página de IA")).toBeNull();
  });

  it("um Membro vê a página filha, sem a mensagem de acesso", () => {
    montar("mem_julia");
    expect(screen.getByText("conteúdo da página de IA")).toBeTruthy();
    expect(screen.queryByText("a área de IA · sem acesso")).toBeNull();
  });
});
