// @vitest-environment jsdom
/**
 * Fase 10, 2.6.2 (EST-08) — o editor da aba "Visualizações". Monta o editor com o
 * seed real e o `StoreProvider` de verdade; o transporte devolve a própria cópia
 * como o estado do servidor (o que `transporteEmMemoria` faz) e guarda as
 * chamadas, para o teste ler o que foi gravado e a tela refletir o resultado.
 */

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { containerAdminRefusal } from "@n1/dominio/derive";
import { setContainerBlock, setContainerDefaultViews } from "@n1/dominio/operations/configuration";
import { saveView } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import type { ChamadaDeOperacao } from "@n1/dominio/operations";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { EditorDeVisualizacoesPadrao } from "./editor-de-visualizacoes-padrao";

afterEach(() => cleanup());

const ESPACO = "spc_com";
const TODOS = ["lista", "quadro", "calendario", "tabela", "linhaDoTempo"] as const;

function transporteQueGuarda(chamadas: ChamadaDeOperacao[]): Transporte {
  return {
    async gravar(pedido) {
      chamadas.push(...pedido.chamadas);
      return {
        tipo: "estado",
        resultado: pedido.resultado,
        estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: {}, memberId: "" },
      };
    },
    hidratar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
  };
}

function montar(
  props: { tipo: "space" | "folder" | "list"; id: string; conversacional?: boolean; desligadoPor?: string },
  estado: DataState = buildSeed(),
  memberId: string = estado.workspace.ownerMemberId,
) {
  const chamadas: ChamadaDeOperacao[] = [];
  render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={transporteQueGuarda(chamadas)}>
      <EditorDeVisualizacoesPadrao conversacional={false} {...props} />
    </StoreProvider>,
  );
  return { chamadas };
}

const caixa = (tipo: string) => screen.getByRole("checkbox", { name: tipo }) as HTMLInputElement;
const radio = (tipo: string) => screen.getByRole("radio", { name: `Inicial: ${tipo}` }) as HTMLInputElement;

describe("EditorDeVisualizacoesPadrao — o Espaço (EST-08)", () => {
  it("sem definição própria mostra os cinco tipos marcados, a Lista como inicial e nenhum «Voltar a herdar»", () => {
    montar({ tipo: "space", id: ESPACO });

    for (const tipo of ["Lista", "Quadro", "Calendário", "Tabela", "Linha do tempo"]) expect(caixa(tipo).checked).toBe(true);
    expect(radio("Lista").checked).toBe(true);
    expect(radio("Quadro").checked).toBe(false);
    expect(screen.getByRole("radiogroup", { name: "Visualização inicial" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Voltar a herdar" })).toBeNull();
  });

  it("o tipo inicial não se desmarca: a caixa fica desligada com o motivo ligado por aria-describedby", () => {
    montar({ tipo: "space", id: ESPACO });

    const lista = caixa("Lista");
    expect(lista.disabled).toBe(true);
    const motivo = document.getElementById(lista.getAttribute("aria-describedby") ?? "");
    expect(motivo?.textContent).toBe("É a Visualização inicial. Escolha outra antes de desmarcar.");
    expect(caixa("Quadro").disabled).toBe(false);
  });

  it("desmarcar Calendário grava `disponiveis` sem `calendario` e cria a definição própria", async () => {
    const { chamadas } = montar({ tipo: "space", id: ESPACO });

    await act(async () => {
      fireEvent.click(caixa("Calendário"));
    });

    expect(chamadas).toEqual([
      {
        nome: "setContainerDefaultViews",
        args: ["space", ESPACO, { disponiveis: ["lista", "quadro", "tabela", "linhaDoTempo"], inicial: "lista" }],
      },
    ]);
    expect(caixa("Calendário").checked).toBe(false);
    expect(radio("Calendário").disabled).toBe(true);
    expect(screen.getByText("Visualizações padrão alteradas.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voltar a herdar" })).toBeTruthy();
  });

  it("escolher Quadro como inicial grava `inicial: quadro` e libera a caixa da Lista", async () => {
    const { chamadas } = montar({ tipo: "space", id: ESPACO });

    await act(async () => {
      fireEvent.click(radio("Quadro"));
    });

    expect(chamadas).toEqual([
      { nome: "setContainerDefaultViews", args: ["space", ESPACO, { disponiveis: [...TODOS], inicial: "quadro" }] },
    ]);
    expect(radio("Quadro").checked).toBe(true);
    expect(caixa("Quadro").disabled).toBe(true);
    expect(caixa("Lista").disabled).toBe(false);
  });

  it("o rádio de um tipo não marcado fica desligado", async () => {
    montar({ tipo: "space", id: ESPACO });
    await act(async () => {
      fireEvent.click(caixa("Tabela"));
    });
    expect(radio("Tabela").disabled).toBe(true);
    expect(radio("Quadro").disabled).toBe(false);
  });

  it("«Voltar a herdar» grava null, sem confirmação, e a tela volta ao valor herdado", async () => {
    const { chamadas } = montar({ tipo: "space", id: ESPACO });
    await act(async () => {
      fireEvent.click(caixa("Calendário"));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Voltar a herdar" }));
    });

    expect(chamadas.at(-1)).toEqual({ nome: "setContainerDefaultViews", args: ["space", ESPACO, null] });
    expect(caixa("Calendário").checked).toBe(true);
    expect(screen.queryByRole("button", { name: "Voltar a herdar" })).toBeNull();
    expect(screen.getByText("Visualizações padrão voltaram a ser herdadas.")).toBeTruthy();
  });
});

describe("EditorDeVisualizacoesPadrao — Pasta e Lista", () => {
  it("editar uma Pasta que herda parte do valor EFETIVO (o do Espaço) alterado pela mudança", async () => {
    const estado = buildSeed();
    const dono = estado.workspace.ownerMemberId;
    const espaco = setContainerDefaultViews(estado, dono, "space", ESPACO, { disponiveis: ["lista", "quadro", "tabela"], inicial: "quadro" });
    expect(espaco.ok).toBe(true);
    const pasta = estado.folders.find((f) => f.parentType === "space" && f.parentId === ESPACO);
    if (!pasta) throw new Error("o seed precisa de uma Pasta no Espaço Comercial");

    const { chamadas } = montar({ tipo: "folder", id: pasta.id }, estado);
    expect(caixa("Calendário").checked).toBe(false);
    expect(radio("Quadro").checked).toBe(true);

    await act(async () => {
      fireEvent.click(caixa("Lista"));
    });
    expect(chamadas[0]?.args).toEqual(["folder", pasta.id, { disponiveis: ["quadro", "tabela"], inicial: "quadro" }]);
  });

  it("numa Lista conversacional a linha «Linha do tempo» fica desligada com o motivo", () => {
    montar({ tipo: "list", id: "lst_prospeccao", conversacional: true });

    expect(caixa("Linha do tempo").disabled).toBe(true);
    expect(radio("Linha do tempo").disabled).toBe(true);
    expect(screen.getByText("Não existe em Listas conversacionais.")).toBeTruthy();
    expect(caixa("Quadro").disabled).toBe(false);
  });

  it("numa Lista comum a Linha do tempo é uma linha como as outras", () => {
    montar({ tipo: "list", id: "lst_prospeccao" });
    expect(caixa("Linha do tempo").disabled).toBe(false);
    expect(screen.queryByText("Não existe em Listas conversacionais.")).toBeNull();
  });
});

describe("EditorDeVisualizacoesPadrao — desligado com o motivo", () => {
  it("quem não administra vê tudo desligado e a nota «Somente leitura»", () => {
    const estado = buildSeed();
    const semPermissao = estado.members.find((m) => m.state === "ativo" && containerAdminRefusal(estado, m.id, "space", ESPACO) !== undefined);
    if (!semPermissao) throw new Error("o seed precisa de um Membro sem permissão de administrar o Espaço Comercial");

    montar({ tipo: "space", id: ESPACO }, estado, semPermissao.id);

    for (const tipo of ["Quadro", "Calendário", "Tabela", "Linha do tempo"]) expect(caixa(tipo).disabled).toBe(true);
    expect(radio("Quadro").disabled).toBe(true);
    expect(screen.getByText(/^Somente leitura:/)).toBeTruthy();
  });

  it("`desligadoPor` do chamador desliga tudo e vira a nota", () => {
    montar({ tipo: "space", id: ESPACO, desligadoPor: "Motivo do chamador." });
    expect(caixa("Quadro").disabled).toBe(true);
    expect(screen.getByText("Somente leitura: Motivo do chamador.")).toBeTruthy();
  });

  it("bloqueado por um ancestral: nenhum controle liga e «Voltar a herdar» não existe", () => {
    const estado = buildSeed();
    const dono = estado.workspace.ownerMemberId;
    const pasta = estado.folders.find((f) => f.parentType === "space" && f.parentId === ESPACO);
    if (!pasta) throw new Error("o seed precisa de uma Pasta no Espaço Comercial");
    const bloqueio = setContainerBlock(estado, dono, "space", ESPACO, "defaultViews", true);
    expect(bloqueio.ok).toBe(true);

    montar({ tipo: "folder", id: pasta.id }, estado);

    expect(caixa("Quadro").disabled).toBe(true);
    expect(radio("Quadro").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Voltar a herdar" })).toBeNull();
  });

  it("uma recusa do domínio vira Toast de erro literal", async () => {
    // O contêiner some entre a montagem e o clique: a operação recusa, a tela mostra a frase dela.
    const estado = buildSeed();
    const { chamadas } = montar({ tipo: "space", id: ESPACO }, estado);
    const espaco = estado.spaces.find((s) => s.id === ESPACO);
    if (!espaco) throw new Error("sem o Espaço");
    // Arquivar o Espaço por baixo: o domínio recusa editar contêiner inativo.
    (espaco as { lifecycle: string }).lifecycle = "arquivado";

    await act(async () => {
      fireEvent.click(caixa("Calendário"));
    });

    expect(chamadas).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toContain("Um contêiner arquivado ou na lixeira não muda de configuração.");
  });
});

describe("EditorDeVisualizacoesPadrao — o aviso das salvas guardadas (D-06)", () => {
  function salvar(estado: DataState, listId: string, name: string, kind: "calendario" | "quadro") {
    const resultado = saveView(estado, estado.workspace.ownerMemberId, { listId, name, kind, filters: {}, shared: true });
    if (!resultado.ok) throw new Error(resultado.error);
  }

  it("desmarcar um tipo com 2 Visualizações salvas abaixo acrescenta a frase de guardadas, no plural", async () => {
    const estado = buildSeed();
    salvar(estado, "lst_prospeccao", "Agenda A", "calendario");
    salvar(estado, "lst_pos_venda", "Agenda B", "calendario");
    // Outro tipo, e outro Espaço: nenhum dos dois conta.
    salvar(estado, "lst_prospeccao", "Quadro A", "quadro");
    const outraLista = estado.lists.find((l) => l.id !== "lst_prospeccao" && l.id !== "lst_pos_venda" && l.id !== "lst_indicadores" && l.parentType === "space" && l.parentId !== ESPACO);
    if (outraLista) salvar(estado, outraLista.id, "Agenda de fora", "calendario");

    montar({ tipo: "space", id: ESPACO }, estado);
    await act(async () => {
      fireEvent.click(caixa("Calendário"));
    });

    expect(
      screen.getByText("Visualizações padrão alteradas. 2 Visualizações salvas de Calendário ficam guardadas e voltam se o tipo voltar."),
    ).toBeTruthy();
  });

  it("com 1 Visualização salva a frase vai ao singular", async () => {
    const estado = buildSeed();
    salvar(estado, "lst_prospeccao", "Agenda A", "calendario");

    montar({ tipo: "space", id: ESPACO }, estado);
    await act(async () => {
      fireEvent.click(caixa("Calendário"));
    });

    expect(
      screen.getByText("Visualizações padrão alteradas. 1 Visualização salva de Calendário fica guardada e volta se o tipo voltar."),
    ).toBeTruthy();
  });

  it("sem salvas do tipo, o aviso é só «Visualizações padrão alteradas.»", async () => {
    montar({ tipo: "space", id: ESPACO });
    await act(async () => {
      fireEvent.click(caixa("Calendário"));
    });
    expect(screen.getByText("Visualizações padrão alteradas.")).toBeTruthy();
  });

  it("uma Lista que define as próprias Visualizações e continua oferecendo o tipo não tem salva escondida", async () => {
    const estado = buildSeed();
    const dono = estado.workspace.ownerMemberId;
    const propria = setContainerDefaultViews(estado, dono, "list", "lst_prospeccao", { disponiveis: [...TODOS], inicial: "lista" });
    expect(propria.ok).toBe(true);
    salvar(estado, "lst_prospeccao", "Agenda A", "calendario");

    montar({ tipo: "space", id: ESPACO }, estado);
    await act(async () => {
      fireEvent.click(caixa("Calendário"));
    });

    expect(screen.getByText("Visualizações padrão alteradas.")).toBeTruthy();
  });
});
