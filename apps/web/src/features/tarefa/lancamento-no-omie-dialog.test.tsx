// @vitest-environment jsdom
/**
 * D3-03 — prova de comportamento do diálogo que captura a resposta humana
 * (o lado do Financeiro na conferência do Ensaio): recusa confirmar com
 * campo vazio, publica exatamente o texto que `textoDoLancamentoHumano`
 * monta, o registro é lido de volta por `lancamentoHumanoDe`, e nenhum campo
 * é lista/sugestão — mesmo padrão de isolamento de rede que
 * `painel-aprovacao.test.tsx` já usa, sem `fetch` nem `apps/api` no ar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { CP, lancamentoHumanoDe, textoDoLancamentoHumano } from "@n1/dominio/operations";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { DialogoLancamentoNoOmie } from "./lancamento-no-omie-dialog";

/** `ordem = índice` — o mesmo que `GET /estado` devolveria (padrão de `painel-aprovacao.test.tsx`/`store.test.ts`). */
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
  gravarMock.mockResolvedValue({ tipo: "falha", erro: "não configurado neste teste." });
  return {
    gravar: gravarMock,
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    gravarMock,
  };
}

function renderizar(state: DataState, ordens: Ordens, transporte: Transporte, memberId: string, task: Task) {
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
      <DialogoLancamentoNoOmie task={task} open onClose={() => {}} report={() => {}} />
    </StoreProvider>,
  );
}

let state: DataState;
let ordens: Ordens;
let transporte: TransporteFalso;
let tarefa: Task;

beforeEach(() => {
  state = buildSeed();
  ordens = ordensDeTodasAsColecoes(state);
  transporte = transporteFalso();
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  tarefa = t;
});

afterEach(() => {
  cleanup();
});

describe("DialogoLancamentoNoOmie — campos obrigatórios (a)", () => {
  it("recusa confirmar enquanto qualquer um dos três campos estiver vazio, nomeando o que falta", () => {
    renderizar(state, ordens, transporte, CP.financeiroId, tarefa);

    const confirmar = () => screen.getByRole("button", { name: "Registrar lançamento" });
    expect(confirmar().getAttribute("aria-disabled")).toBe("true");
    expect(confirmar().getAttribute("title")).toBe("Preencha a Conta de pagamento, a Categoria, o Código.");

    fireEvent.change(screen.getByLabelText(/Conta de pagamento/), { target: { value: "TRIA" } });
    expect(confirmar().getAttribute("title")).toBe("Preencha a Categoria, o Código.");

    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: "Impostos e taxas" } });
    expect(confirmar().getAttribute("title")).toBe("Preencha o Código.");

    fireEvent.change(screen.getByLabelText(/Código/), { target: { value: "2.06.01" } });
    expect(confirmar().getAttribute("aria-disabled")).toBe("false");
  });
});

describe("DialogoLancamentoNoOmie — o que é publicado (b)/(c)", () => {
  it("(b) publica um Comentário cujo conteúdo é EXATAMENTE textoDoLancamentoHumano — igualdade estrita com a função do domínio", () => {
    renderizar(state, ordens, transporte, CP.financeiroId, tarefa);

    fireEvent.change(screen.getByLabelText(/Conta de pagamento/), { target: { value: "TRIA" } });
    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: "Impostos e taxas" } });
    fireEvent.change(screen.getByLabelText(/Código/), { target: { value: "2.06.01" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar lançamento" }));

    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    const pedido = transporte.gravarMock.mock.calls[0]![0];
    expect(pedido.chamadas.length).toBe(1);
    expect(pedido.chamadas[0]!.nome).toBe("addTaskComment");
    const args = pedido.chamadas[0]!.args as [string, { readonly content: string }];
    expect(args[0]).toBe(tarefa.id);
    expect(args[1].content).toBe(textoDoLancamentoHumano({ conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" }));
  });

  it("(c) o Comentário publicado é lido de volta por lancamentoHumanoDe com os três valores intactos", () => {
    renderizar(state, ordens, transporte, CP.financeiroId, tarefa);

    fireEvent.change(screen.getByLabelText(/Conta de pagamento/), { target: { value: "TF TRIA" } });
    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: "Viagens e Hospedagens" } });
    fireEvent.change(screen.getByLabelText(/Código/), { target: { value: "2.04.05" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar lançamento" }));

    // `run()` roda a operação de verdade sobre uma cópia (D-05) — a cópia
    // enviada ao transporte já carrega o Comentário publicado, sem precisar
    // simular a resposta de rede.
    const pedido = transporte.gravarMock.mock.calls[0]![0];
    const tarefaNaCopia = pedido.copia.tasks.find((t) => t.id === tarefa.id);
    if (!tarefaNaCopia) throw new Error("Tarefa não encontrada na cópia gravada");
    const humano = lancamentoHumanoDe(pedido.copia, tarefaNaCopia);
    expect(humano).toMatchObject({ conta: "TF TRIA", categoria: "Viagens e Hospedagens", codigo: "2.04.05" });
    expect(humano?.por).toBe(CP.financeiroId);
  });
});

describe("DialogoLancamentoNoOmie — sem lista, sem sugestão (d)", () => {
  it("nenhum <select>/<option>, e os três campos nascem vazios", () => {
    const { container } = renderizar(state, ordens, transporte, CP.financeiroId, tarefa);

    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector("option")).toBeNull();
    expect((screen.getByLabelText(/Conta de pagamento/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Categoria/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Código/) as HTMLInputElement).value).toBe("");
  });
});
