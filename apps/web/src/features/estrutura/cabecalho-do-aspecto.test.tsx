// @vitest-environment jsdom
/**
 * Fase 10, 2.6.5 item 7 (EST-10), D-15/D-16 — o interruptor «Bloquear para os
 * níveis abaixo» no `CabecalhoDoAspecto`. Monta o cabeçalho com o seed real e o
 * `StoreProvider` de verdade; o transporte devolve a própria cópia como o estado
 * do servidor (o que `transporteEmMemoria` faz) e guarda as chamadas e a cópia,
 * para o teste ler o que foi gravado e a tela refletir o resultado.
 */

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { createFieldDefinition, overrideStatusSet, setContainerDefaultViews, setContainerFeature } from "@n1/dominio/operations/configuration";
import { archiveContainer, createFolder, createList, createSpace } from "@n1/dominio/operations/structure";
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

/* ───────────── Task 2: "Já definido em:", aspectos que acumulam e a privacidade ───────────── */

const RAFAEL = "mem_rafael"; // Administrador: administra o Espaço, mas não alcança Pasta privada alheia
const JULIA = "mem_julia"; // Papel de vendas: não administra

describe("InterruptorDeBloqueio — aspecto que substitui com sobrescrita abaixo (D-16)", () => {
  it("Pasta com Conjunto próprio: o interruptor fica desligado e impedido, e a lista aponta para a mesma aba da Pasta", () => {
    const { estado, dono, espacoId } = cadeia();
    const clientes = createFolder(estado, dono, { name: "Clientes", parentType: "space", parentId: espacoId });
    if (!clientes.ok) throw new Error(clientes.error);
    const sobrescreve = overrideStatusSet(estado, dono, "folder", clientes.value.id);
    if (!sobrescreve.ok) throw new Error(sobrescreve.error);
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);

    expect(interruptor().disabled).toBe(true);
    expect(interruptor().getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Já definido em:")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Abrir as Configurações de Pasta Clientes" });
    expect(link.getAttribute("href")).toBe(`/estrutura/pastas/${clientes.value.id}/configuracoes?aba=status`);
    expect(link.textContent).toBe("Pasta Clientes");
    expect(screen.getByText("Volte a herdar neles para poder bloquear.")).toBeTruthy();
  });

  it("o describedBy do interruptor aponta para a lista e a lista rola dentro de max-h-48", () => {
    const { estado, dono, espacoId } = cadeia();
    const clientes = createFolder(estado, dono, { name: "Clientes", parentType: "space", parentId: espacoId });
    if (!clientes.ok) throw new Error(clientes.error);
    expect(overrideStatusSet(estado, dono, "folder", clientes.value.id).ok).toBe(true);
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);

    const descricao = document.getElementById(interruptor().getAttribute("aria-describedby") ?? "");
    expect(descricao?.textContent).toContain("Já definido em:");
    expect(descricao?.textContent).toContain("Volte a herdar neles para poder bloquear.");
    const lista = within(descricao as HTMLElement).getByRole("list");
    expect(lista.className).toContain("max-h-48");
    expect(lista.className).toContain("overflow-y-auto");
  });

  it("um link por contêiner: Pasta, Subpasta e Lista, cada um para as Configurações dele na mesma aba", () => {
    const { estado, dono, espacoId, pastaId } = cadeia();
    const sub = createFolder(estado, dono, { name: "Aditivos", parentType: "folder", parentId: pastaId });
    if (!sub.ok) throw new Error(sub.error);
    const solta = createList(estado, dono, { name: "Propostas", parentType: "space", parentId: espacoId });
    if (!solta.ok) throw new Error(solta.error);
    for (const [tipo, id] of [["folder", pastaId], ["folder", sub.value.id], ["list", solta.value.id]] as const) {
      const r = overrideStatusSet(estado, dono, tipo, id);
      if (!r.ok) throw new Error(r.error);
    }
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);

    const href = (nome: string) => screen.getByRole("link", { name: `Abrir as Configurações de ${nome}` }).getAttribute("href");
    expect(href("Pasta Contratos")).toBe(`/estrutura/pastas/${pastaId}/configuracoes?aba=status`);
    expect(href("Subpasta Aditivos")).toBe(`/estrutura/pastas/${sub.value.id}/configuracoes?aba=status`);
    expect(href("Lista Propostas")).toBe(`/estrutura/listas/${solta.value.id}/configuracoes?aba=status`);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("o link leva para a mesma aba do aspecto: Funcionalidades abre ?aba=funcionalidades e Visualizações ?aba=visualizacoes", () => {
    const { estado, dono, espacoId, pastaId } = cadeia();
    const funcionalidade = setContainerFeature(estado, dono, "folder", pastaId, "prioridade", false);
    if (!funcionalidade.ok) throw new Error(funcionalidade.error);
    const visualizacoes = setContainerDefaultViews(estado, dono, "folder", pastaId, { disponiveis: ["lista", "quadro"], inicial: "lista" });
    if (!visualizacoes.ok) throw new Error(visualizacoes.error);

    montar({ tipo: "space", id: espacoId, aspecto: "features" }, estado);
    expect(screen.getByRole("link", { name: "Abrir as Configurações de Pasta Contratos" }).getAttribute("href")).toBe(
      `/estrutura/pastas/${pastaId}/configuracoes?aba=funcionalidades`,
    );
    cleanup();

    montar({ tipo: "space", id: espacoId, aspecto: "defaultViews" }, estado);
    expect(screen.getByRole("link", { name: "Abrir as Configurações de Pasta Contratos" }).getAttribute("href")).toBe(
      `/estrutura/pastas/${pastaId}/configuracoes?aba=visualizacoes`,
    );
  });

  it("sem sobrescrita abaixo a lista não aparece e o interruptor está livre", () => {
    const { estado, espacoId } = cadeia();
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);

    expect(screen.queryByText("Já definido em:")).toBeNull();
    expect(screen.queryByText("Volte a herdar neles para poder bloquear.")).toBeNull();
    expect(interruptor().disabled).toBe(false);
  });
});

describe("InterruptorDeBloqueio — aspecto que acumula (A15)", () => {
  it("Campo próprio numa Pasta abaixo não impede o interruptor da aba Campos", () => {
    const { estado, dono, espacoId, pastaId } = cadeia();
    const campo = createFieldDefinition(estado, dono, { name: "Cliente", type: "text", definedAtType: "folder", definedAtId: pastaId });
    if (!campo.ok) throw new Error(campo.error);
    montar({ tipo: "space", id: espacoId, aspecto: "fieldDefinitions" }, estado);

    expect(interruptor().disabled).toBe(false);
    expect(screen.queryByText("Já definido em:")).toBeNull();
  });

  it("ligado, mostra \"Os já criados continuam valendo.\" ligada por aria-describedby; desligado, a dica some", async () => {
    const { estado, espacoId } = cadeia();
    montar({ tipo: "space", id: espacoId, aspecto: "taskTypes" }, estado);
    expect(screen.queryByText("Os já criados continuam valendo.")).toBeNull();

    await act(async () => {
      fireEvent.click(interruptor());
    });

    const dica = screen.getByText("Os já criados continuam valendo.");
    expect(interruptor().getAttribute("aria-describedby")).toBe(dica.id || dica.parentElement?.id);
    expect(screen.getByRole("status").textContent).toContain("Tipos de Tarefa bloqueados para os níveis abaixo.");

    await act(async () => {
      fireEvent.click(interruptor());
    });
    expect(screen.queryByText("Os já criados continuam valendo.")).toBeNull();
  });

  it("aspecto que substitui, ligado, não mostra a dica dos que acumulam", async () => {
    const { estado, espacoId } = cadeia();
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);
    await act(async () => {
      fireEvent.click(interruptor());
    });
    expect(screen.queryByText("Os já criados continuam valendo.")).toBeNull();
  });
});

describe("InterruptorDeBloqueio — privacidade da lista (B38a, T-10-28)", () => {
  /** Uma Pasta privada criada pelo dono, que o Administrador (Rafael) não alcança. */
  function comPastaPrivada() {
    const { estado, dono, espacoId } = cadeia();
    const privada = createFolder(estado, dono, { name: "Diretoria secreta", parentType: "space", parentId: espacoId, isPrivate: true });
    if (!privada.ok) throw new Error(privada.error);
    const r = overrideStatusSet(estado, dono, "folder", privada.value.id);
    if (!r.ok) throw new Error(r.error);
    return { estado, espacoId, privadaId: privada.value.id };
  }

  it("a Pasta privada que o Membro não alcança não aparece na lista, e o nome dela não está na tela", () => {
    const { estado, espacoId } = comPastaPrivada();
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado, RAFAEL);

    expect(document.body.textContent).not.toContain("Diretoria secreta");
    expect(screen.queryByText("Já definido em:")).toBeNull();
  });

  it("sendo a única, o interruptor continua habilitado; forçar vira Toast de erro com a frase do domínio, sem o nome privado", async () => {
    const { estado, espacoId } = comPastaPrivada();
    const gravacoes = montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado, RAFAEL);
    expect(interruptor().disabled).toBe(false);

    await act(async () => {
      fireEvent.click(interruptor());
    });

    expect(gravacoes.chamadas).toEqual([]);
    const alerta = screen.getByRole("alert");
    expect(alerta.textContent).toContain("1 contêiner que você não alcança define");
    expect(document.body.textContent).not.toContain("Diretoria secreta");
    expect(interruptor().getAttribute("aria-checked")).toBe("false");
    expect(interruptor().disabled).toBe(false);
  });

  it("o dono, que alcança a Pasta privada, a vê na lista", () => {
    const { estado, espacoId, privadaId } = comPastaPrivada();
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado);

    const link = screen.getByRole("link", { name: "Abrir as Configurações de Pasta Diretoria secreta" });
    expect(link.getAttribute("href")).toBe(`/estrutura/pastas/${privadaId}/configuracoes?aba=status`);
    expect(interruptor().disabled).toBe(true);
  });
});

describe("InterruptorDeBloqueio — quem pode, estado e erro (T-10-29)", () => {
  it("Membro que não administra: interruptor desligado e a nota com a frase de containerAdminRefusal", () => {
    const { estado, espacoId } = cadeia();
    montar({ tipo: "space", id: espacoId, aspecto: "statusSet" }, estado, JULIA);

    expect(interruptor().disabled).toBe(true);
    expect(screen.getByText(/Somente leitura: Configurar a Estrutura exige administrar o contêiner/)).toBeTruthy();
  });

  it("Pasta arquivada: interruptor desligado com a frase de arquivada", () => {
    const { estado, dono, pastaId } = cadeia();
    const r = archiveContainer(estado, dono, "folder", pastaId);
    if (!r.ok) throw new Error(r.error);
    montar({ tipo: "folder", id: pastaId, aspecto: "statusSet" }, estado);

    expect(interruptor().disabled).toBe(true);
    expect(screen.getByText("Somente leitura: Pasta arquivada: desarquive antes de editar.")).toBeTruthy();
  });

  it("gravando, o interruptor fica desligado até a resposta; o Toast vem depois", async () => {
    const { estado, espacoId } = cadeia();
    let liberar: () => void = () => undefined;
    const lenta: Transporte = {
      gravar: (pedido) =>
        new Promise((resolver) => {
          liberar = () =>
            resolver({
              tipo: "estado",
              resultado: pedido.resultado,
              estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: {}, memberId: "" },
            });
        }),
      hidratar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
    };
    render(
      <StoreProvider sessao={{ memberId: estado.workspace.ownerMemberId }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={lenta}>
        <CabecalhoDoAspecto tipo="space" id={espacoId} aspecto="statusSet" />
      </StoreProvider>,
    );

    await act(async () => {
      fireEvent.click(interruptor());
    });
    expect(interruptor().disabled).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => {
      liberar();
    });
    expect(interruptor().disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toContain("Conjunto de Status bloqueado para os níveis abaixo.");
  });

  it("recusa do servidor (corrida): Toast de erro com a frase e o interruptor volta ao estado anterior", async () => {
    const { estado, espacoId } = cadeia();
    const recusa: Transporte = {
      gravar: async () => ({ tipo: "falha", erro: "Não dá para bloquear Conjunto de Status: Pasta Clientes define o próprio. Volte a herdar neles para poder bloquear." }),
      hidratar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
    };
    render(
      <StoreProvider sessao={{ memberId: estado.workspace.ownerMemberId }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={recusa}>
        <CabecalhoDoAspecto tipo="space" id={espacoId} aspecto="statusSet" />
      </StoreProvider>,
    );

    await act(async () => {
      fireEvent.click(interruptor());
    });

    expect(screen.getByRole("alert").textContent).toContain("Pasta Clientes define o próprio");
    expect(interruptor().getAttribute("aria-checked")).toBe("false");
    expect(interruptor().disabled).toBe(false);
  });
});
