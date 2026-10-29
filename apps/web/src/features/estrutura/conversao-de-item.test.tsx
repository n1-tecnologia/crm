// @vitest-environment jsdom
/**
 * TAR-02 na tela (11-07): converter um Item de Checklist em Subtarefa pela
 * Tarefa aberta. O botão sai da MESMA derivada que a operação consulta
 * (`conversaoDeItemRecusada`, D-05); a confirmação é de um clique, sem digitar o
 * nome (D-01); o aviso usa o id que o SERVIDOR devolveu, não o da cópia local
 * (T-11-19); e o cartão do Quadro não ganha gesto de converter (D-03).
 * Mesmo molde de `timeline.test.tsx` e `painel-aprovacao.test.tsx`:
 * `StoreProvider` real sobre `Transporte` falso.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import { setContainerFeature } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { BotaoDeConversao, DialogoDeConversao } from "./conversao-de-item";

const THIAGO = "mem_thiago";
const BEATRIZ = "mem_beatriz"; // Convidado: não escreve na Tarefa
const TAREFA = "tsk_seed_1";
const CHECKLIST = "chk_seed_1";
const ITEM = "cki_2";
const TEXTO_DO_ITEM = "Validar com o responsável pela conta";

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

interface TransporteFalso extends Transporte {
  readonly gravarMock: ReturnType<typeof vi.fn<Transporte["gravar"]>>;
}

function transporteFalso(): TransporteFalso {
  const gravarMock = vi.fn<Transporte["gravar"]>();
  gravarMock.mockImplementation(() => new Promise<RespostaDeGravacao>(() => {}));
  return {
    gravar: gravarMock,
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    gravarMock,
  };
}

let state: DataState;
let ordens: Ordens;
let transporte: TransporteFalso;

beforeEach(() => {
  state = buildSeed();
  ordens = ordensDeTodasAsColecoes(state);
  transporte = transporteFalso();
});

afterEach(() => {
  cleanup();
});

function tarefa(id: string): Task {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) throw new Error(`seed sem a Tarefa ${id}`);
  return task;
}

/** Empurra um Checklist de um Item na Tarefa (como `conversao-de-item.test.ts` do domínio). */
function comChecklist(taskId: string, itemId: string): void {
  tarefa(taskId).checklists.push({
    id: "chk_x",
    name: "Passos",
    order: 0,
    items: [{ id: itemId, text: "Passo de teste", order: 0, done: false }],
    createdBy: { kind: "member", id: THIAGO },
    createdAt: new Date().toISOString(),
  });
}

function comStore(memberId: string, filho: React.ReactNode) {
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
      {filho}
    </StoreProvider>,
  );
}

describe("BotaoDeConversao — só onde o domínio deixa (D-05)", () => {
  it("aparece em tsk_seed_1 na cor normal (sem style) e chama onConverter ao clicar", () => {
    const onConverter = vi.fn();
    comStore(THIAGO, <BotaoDeConversao task={tarefa(TAREFA)} onConverter={onConverter} />);

    const botao = screen.getByRole("button", { name: "Converter em Subtarefa" });
    expect(botao.hasAttribute("style")).toBe(false);
    fireEvent.click(botao);

    expect(onConverter).toHaveBeenCalledTimes(1);
  });

  it("aparece em tsk_seed_7 (nível 2, máximo − 1)", () => {
    comChecklist("tsk_seed_7", "cki_x");
    comStore(THIAGO, <BotaoDeConversao task={tarefa("tsk_seed_7")} onConverter={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Converter em Subtarefa" })).not.toBeNull();
  });

  it("some em tsk_seed_8 (nível 3, o máximo)", () => {
    comChecklist("tsk_seed_8", "cki_x");
    comStore(THIAGO, <BotaoDeConversao task={tarefa("tsk_seed_8")} onConverter={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Converter em Subtarefa" })).toBeNull();
  });

  it("some numa Lista com Subtarefas desligada", () => {
    const desligar = setContainerFeature(state, THIAGO, "list", tarefa(TAREFA).listId, "subtarefas", false);
    if (!desligar.ok) throw new Error(desligar.error);
    comStore(THIAGO, <BotaoDeConversao task={tarefa(TAREFA)} onConverter={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Converter em Subtarefa" })).toBeNull();
  });

  it("some para quem não escreve na Tarefa (Convidado)", () => {
    comStore(BEATRIZ, <BotaoDeConversao task={tarefa(TAREFA)} onConverter={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Converter em Subtarefa" })).toBeNull();
  });
});

function renderizarDialogo(callbacks: {
  onFechar: () => void;
  onConvertida: (s: { readonly id: string; readonly title: string }) => void;
  onErro: (m: string) => void;
}) {
  return comStore(
    THIAGO,
    <DialogoDeConversao task={tarefa(TAREFA)} checklistId={CHECKLIST} itemId={ITEM} {...callbacks} />,
  );
}

describe("DialogoDeConversao — um clique, sem digitar o nome (D-01)", () => {
  it("mostra o título com o texto do Item, avisa que não tem volta e não tem campo de texto", () => {
    renderizarDialogo({ onFechar: vi.fn(), onConvertida: vi.fn(), onErro: vi.fn() });

    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText(`Converter “${TEXTO_DO_ITEM}” em Subtarefa?`)).toBeTruthy();
    expect(within(dialogo).getByText(/não tem volta/)).toBeTruthy();
    expect(within(dialogo).queryByRole("textbox")).toBeNull();
    const confirmar = within(dialogo).getByRole("button", { name: "Converter" });
    expect(confirmar.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("não renderiza nada quando o Item não existe", () => {
    comStore(
      THIAGO,
      <DialogoDeConversao
        task={tarefa(TAREFA)}
        checklistId={CHECKLIST}
        itemId="cki_que_nao_existe"
        onFechar={vi.fn()}
        onConvertida={vi.fn()}
        onErro={vi.fn()}
      />,
    );

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("DialogoDeConversao — o id é o do servidor (T-11-19)", () => {
  it("Converter grava uma chamada convertChecklistItem e onConvertida recebe o id que o servidor devolveu", async () => {
    transporte.gravarMock.mockImplementationOnce(async (): Promise<RespostaDeGravacao> => ({
      tipo: "diferenca",
      resultado: { ok: true, value: { id: "tsk_do_servidor", title: TEXTO_DO_ITEM } },
      revisao: 2,
      revisaoAnterior: 1,
      diferenca: { gravados: [], removidos: [] },
    }));
    const onFechar = vi.fn();
    const onConvertida = vi.fn();
    const onErro = vi.fn();
    renderizarDialogo({ onFechar, onConvertida, onErro });

    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Converter" }));

    await waitFor(() => expect(onConvertida).toHaveBeenCalledTimes(1));
    expect(onConvertida).toHaveBeenCalledWith({ id: "tsk_do_servidor", title: TEXTO_DO_ITEM });
    expect(onFechar).toHaveBeenCalled();
    expect(onErro).not.toHaveBeenCalled();
    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    const pedido = transporte.gravarMock.mock.calls[0]?.[0];
    expect(pedido?.chamadas.map((c) => c.nome)).toEqual(["convertChecklistItem"]);
  });

  it("uma recusa do servidor chega em onErro com a mensagem dele", async () => {
    transporte.gravarMock.mockImplementationOnce(async (): Promise<RespostaDeGravacao> => ({
      tipo: "diferenca",
      resultado: { ok: false, error: "Esta Tarefa não está ativa. Restaure-a para editá-la." },
      revisao: 2,
      revisaoAnterior: 1,
      diferenca: { gravados: [], removidos: [] },
    }));
    const onConvertida = vi.fn();
    const onErro = vi.fn();
    renderizarDialogo({ onFechar: vi.fn(), onConvertida, onErro });

    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Converter" }));

    await waitFor(() => expect(onErro).toHaveBeenCalledWith("Esta Tarefa não está ativa. Restaure-a para editá-la."));
    expect(onConvertida).not.toHaveBeenCalled();
  });
});

describe("Quadro — o cartão não converte (D-03)", () => {
  it("cartao-de-tarefa.tsx não tem convertChecklistItem nem Converter", () => {
    const aqui = dirname(fileURLToPath(import.meta.url));
    const fonte = readFileSync(join(aqui, "cartao-de-tarefa.tsx"), "utf8");

    expect(fonte).not.toContain("convertChecklistItem");
    expect(fonte).not.toContain("Converter");
  });
});
