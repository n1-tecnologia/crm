// @vitest-environment jsdom
/**
 * Fase 10, 2.6.5 item 7 (EST-10), D-15/D-16 — o interruptor «Bloquear para os
 * níveis abaixo» no `CabecalhoDoAspecto`. Monta o cabeçalho com o seed real e o
 * `StoreProvider` de verdade; o transporte devolve a própria cópia como o estado
 * do servidor (o que `transporteEmMemoria` faz) e guarda as chamadas e a cópia,
 * para o teste ler o que foi gravado e a tela refletir o resultado.
 */

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { createFolder, createList, createSpace } from "@n1/dominio/operations/structure";
import type { ChamadaDeOperacao } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import type { ConfigurableAspect } from "@n1/dominio/types";
import { CabecalhoDoAspecto } from "./cabecalho-do-aspecto";

afterEach(() => cleanup());

interface Gravacoes {
  readonly chamadas: ChamadaDeOperacao[];
  ultimaCopia: DataState | undefined;
}

function transporteQueGuarda(gravacoes: Gravacoes): Transporte {
  return {
    async gravar(pedido) {
      gravacoes.chamadas.push(...pedido.chamadas);
      gravacoes.ultimaCopia = pedido.copia;
      return {
        tipo: "estado",
        resultado: pedido.resultado,
        estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: {}, memberId: "" },
      };
    },
    hidratar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
  };
}

/** Um Espaço novo com uma Pasta e uma Lista: nenhum dado do seed interfere. */
function cadeia() {
  const estado = buildSeed();
  const dono = estado.workspace.ownerMemberId;
  const espaco = createSpace(estado, dono, { name: "Operações novas" });
  if (!espaco.ok) throw new Error(espaco.error);
  const pasta = createFolder(estado, dono, { name: "Contratos", parentType: "space", parentId: espaco.value.id });
  if (!pasta.ok) throw new Error(pasta.error);
  const lista = createList(estado, dono, { name: "Vigentes", parentType: "folder", parentId: pasta.value.id });
  if (!lista.ok) throw new Error(lista.error);
  return { estado, dono, espacoId: espaco.value.id, pastaId: pasta.value.id, listaId: lista.value.id };
}

function montar(
  props: { tipo: "space" | "folder" | "list"; id: string; aspecto: ConfigurableAspect },
  estado: DataState,
  memberId: string = estado.workspace.ownerMemberId,
  gravacoes: Gravacoes = { chamadas: [], ultimaCopia: undefined },
) {
  render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={transporteQueGuarda(gravacoes)}>
      <CabecalhoDoAspecto {...props} />
    </StoreProvider>,
  );
  return gravacoes;
}

const interruptor = () => screen.getByRole("switch", { name: "Bloquear para os níveis abaixo" }) as HTMLButtonElement;

describe("InterruptorDeBloqueio — o traçador (EST-10)", () => {
  it("Espaço sem sobrescrita abaixo, aba Status: o interruptor está habilitado e desligado", () => {
    const { estado, espacoId } = cadeia();
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);

    expect(interruptor().disabled).toBe(false);
    expect(interruptor().getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText("Já definido em:")).toBeNull();
  });

  it("ligar roda setContainerBlock(space, id, statusSet, true) e o Toast diz que o Conjunto de Status foi bloqueado", async () => {
    const { estado, espacoId } = cadeia();
    const gravacoes = montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);

    await act(async () => {
      fireEvent.click(interruptor());
    });

    expect(gravacoes.chamadas).toEqual([{ nome: "setContainerBlock", args: ["space", espacoId, "statusSet", true] }]);
    expect(screen.getByRole("status").textContent).toContain("Conjunto de Status bloqueado para os níveis abaixo.");
    expect(interruptor().getAttribute("aria-checked")).toBe("true");
    expect(interruptor().disabled).toBe(false);
  });

  it("desligar roda setContainerBlock(…, false) e o Toast diz que o Conjunto de Status foi liberado", async () => {
    const { estado, espacoId } = cadeia();
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);

    await act(async () => {
      fireEvent.click(interruptor());
    });
    await act(async () => {
      fireEvent.click(interruptor());
    });

    expect(interruptor().getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("status").textContent).toContain("Conjunto de Status liberado para os níveis abaixo.");
  });

  it("depois de bloquear no Espaço, o cabeçalho da Lista abaixo diz \"Bloqueado por Espaço {nome}\" e não tem interruptor", async () => {
    const { estado, espacoId, listaId } = cadeia();
    const gravacoes = montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);
    await act(async () => {
      fireEvent.click(interruptor());
    });
    const depois = gravacoes.ultimaCopia;
    if (!depois) throw new Error("nada foi gravado");
    cleanup();

    montar({ tipo: "list", id: listaId, aspecto: "statusSet" }, depois);

    expect(screen.getByText("Bloqueado por Espaço Operações novas")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText("Bloquear para os níveis abaixo")).toBeNull();
  });

  it("a Lista nunca mostra o interruptor, bloqueie ou não um ancestral (D-15)", () => {
    const { estado, listaId } = cadeia();
    for (const aspecto of ["statusSet", "features", "fieldDefinitions", "taskTypes", "defaultViews"] as const) {
      montar({ tipo: "list", id: listaId, aspecto }, estado);
      expect(screen.queryByRole("switch")).toBeNull();
      cleanup();
    }
  });

  it("a Pasta também tem o interruptor, e ligar grava com o tipo folder", async () => {
    const { estado, pastaId } = cadeia();
    const gravacoes = montar({ tipo: "folder", id: pastaId, aspecto: "features" }, estado);

    await act(async () => {
      fireEvent.click(interruptor());
    });

    expect(gravacoes.chamadas).toEqual([{ nome: "setContainerBlock", args: ["folder", pastaId, "features", true] }]);
    expect(screen.getByRole("status").textContent).toContain("Funcionalidades bloqueadas para os níveis abaixo.");
  });
});
