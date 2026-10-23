// @vitest-environment jsdom
/**
 * Checklist 1.2/1.3/1.7 — o editor de Formulários edita o que a página
 * pública mostra: ordem (subir/descer), seção, ajuda e condição de cada
 * pergunta; a pergunta nova depende de outra pelo id provisório; e o texto
 * velho de protótipo saiu. `StoreProvider` de verdade sobre um `Transporte`
 * falso: o que se prova é a chamada `updateForm` que sairia para o servidor.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { PedidoDeGravacao, Transporte } from "@/dados/transporte";
import { FormsEditor } from "./forms-editor";

function ordensDeTodasAsColecoes(estado: DataState): Ordens {
  const resultado: Ordens = {};
  for (const [colecao, valor] of Object.entries(estado)) {
    if (!Array.isArray(valor)) continue;
    const porId: Record<string, number> = {};
    valor.forEach((registro, indice) => {
      if (registro && typeof registro === "object" && "id" in registro) porId[(registro as { readonly id: string }).id] = indice;
    });
    resultado[colecao] = porId;
  }
  return resultado;
}

function montar(opcoes: { readonly secret?: string } = {}) {
  const estado = buildSeed();
  // 09-02: quem não administra a Lista recebe o segredo do Formulário como "".
  if (opcoes.secret !== undefined) {
    const secret = opcoes.secret;
    estado.forms = estado.forms.map((f) => ({ ...f, secret }));
  }
  const gravar = vi.fn<Transporte["gravar"]>(async () => ({ tipo: "falha", erro: "fim do teste" }));
  const transporte: Transporte = { gravar, hidratar: async () => ({ tipo: "falha", erro: "sem servidor" }) };
  render(
    <StoreProvider sessao={{ memberId: estado.workspace.ownerMemberId }} estadoInicial={{ data: estado, revisao: 1, ordens: ordensDeTodasAsColecoes(estado) }} transporte={transporte}>
      <FormsEditor listId="lst_prospeccao" bloqueio={undefined} report={() => {}} />
    </StoreProvider>,
  );
  return { gravar };
}

const escolher = (combobox: HTMLElement, opcao: string | RegExp) => {
  fireEvent.click(combobox);
  fireEvent.click(screen.getByRole("option", { name: opcao }));
};

/** O cartão da pergunta N (o `div.painel` em volta do campo "Pergunta N"). */
const cartao = (n: number) => screen.getByLabelText(`Pergunta ${n}`).closest(".painel") as HTMLElement;

afterEach(() => cleanup());

describe("FormsEditor — o link do Formulário (Fase 9, 1.1.3)", () => {
  it("segredo vazio: a frase no lugar do link, nenhum href '/f/' e sem 'Copiar link'", () => {
    montar({ secret: "" });
    expect(screen.getByText("Só quem administra a Lista vê o link.")).toBeTruthy();
    expect(document.querySelector('a[href^="/f/"]')).toBeNull();
    expect(document.body.textContent ?? "").not.toContain("/f/");
    expect(screen.queryByRole("button", { name: "Copiar link" })).toBeNull();
  });

  it("com segredo: o link /f/abc e 'Copiar link' aparecem como hoje", () => {
    montar({ secret: "abc" });
    expect(document.querySelector('a[href="/f/abc"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeTruthy();
    expect(screen.queryByText("Só quem administra a Lista vê o link.")).toBeNull();
  });
});

describe("FormsEditor — o Formulário editável (checklist 1.2/1.3/1.7)", () => {
  it("1.7: o texto velho de protótipo saiu", () => {
    montar();
    expect(screen.queryByText(/Protótipo: os dados vivem na memória/)).toBeNull();
  });

  it("seção, ajuda, condição pela pergunta nova (id provisório) e ordem saem na chamada updateForm", () => {
    const { gravar } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Ações de Pedido de contato" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    const dialogo = screen.getByRole("alertdialog");

    // Pergunta 3: Centro de custo, na seção "Contato", com ajuda.
    fireEvent.click(within(dialogo).getByRole("button", { name: "Pergunta" }));
    fireEvent.change(within(cartao(3)).getByLabelText("Pergunta 3"), { target: { value: "Centro" } });
    escolher(within(cartao(3)).getByRole("combobox", { name: "Preenche" }), /^Campo: Centro de custo/);
    fireEvent.change(within(cartao(3)).getByLabelText("Seção", { exact: false }), { target: { value: "Contato" } });
    fireEvent.change(within(cartao(3)).getByLabelText("Ajuda", { exact: false }), { target: { value: "Quem atende" } });

    // Pergunta 4: Cliente, só quando o Centro for "Comercial".
    fireEvent.click(within(dialogo).getByRole("button", { name: "Pergunta" }));
    fireEvent.change(within(cartao(4)).getByLabelText("Pergunta 4"), { target: { value: "Cliente" } });
    escolher(within(cartao(4)).getByRole("combobox", { name: "Preenche" }), /^Campo: Cliente/);
    escolher(within(cartao(4)).getByRole("combobox", { name: "Mostrar" }), "Quando “Centro” for…");
    fireEvent.click(within(cartao(4)).getByRole("combobox", { name: "Abrir opções" }));
    fireEvent.click(screen.getByRole("option", { name: "Comercial" }));

    // Ordem: "Detalhes" desce uma posição (fica depois do "Centro").
    fireEvent.click(within(dialogo).getByRole("button", { name: "Descer pergunta 2" }));

    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    expect(gravar).toHaveBeenCalledTimes(1);
    const pedido = gravar.mock.calls[0]![0] as PedidoDeGravacao;
    expect(pedido.chamadas[0]!.nome).toBe("updateForm");
    const [formId, input] = pedido.chamadas[0]!.args as [string, { questions: Array<Record<string, unknown>> }];
    expect(formId).toBe("frm_demo");
    expect(input.questions.map((q) => q.label)).toEqual(["Assunto", "Centro", "Detalhes", "Cliente"]);
    const centro = input.questions[1]!;
    expect(centro).toMatchObject({ section: "Contato", help: "Quem atende", target: { kind: "field", definitionId: "fd_centro" } });
    expect(String(centro.id)).toMatch(/^novo_/);
    expect(input.questions[3]).toMatchObject({ showWhen: { questionId: centro.id, values: ["Comercial"] } });
    expect(input.questions[0]).not.toHaveProperty("showWhen");
  });

  it("remover a pergunta-gatilho tira a condição de quem dependia dela", () => {
    const { gravar } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Ações de Pedido de contato" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    const dialogo = screen.getByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Pergunta" }));
    fireEvent.change(within(cartao(3)).getByLabelText("Pergunta 3"), { target: { value: "Centro" } });
    escolher(within(cartao(3)).getByRole("combobox", { name: "Preenche" }), /^Campo: Centro de custo/);
    fireEvent.click(within(dialogo).getByRole("button", { name: "Pergunta" }));
    fireEvent.change(within(cartao(4)).getByLabelText("Pergunta 4"), { target: { value: "Cliente" } });
    escolher(within(cartao(4)).getByRole("combobox", { name: "Preenche" }), /^Campo: Cliente/);
    escolher(within(cartao(4)).getByRole("combobox", { name: "Mostrar" }), "Quando “Centro” for…");

    fireEvent.click(within(dialogo).getByRole("button", { name: "Remover pergunta 3" }));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    const [, input] = (gravar.mock.calls[0]![0] as PedidoDeGravacao).chamadas[0]!.args as [string, { questions: Array<Record<string, unknown>> }];
    expect(input.questions.map((q) => q.label)).toEqual(["Assunto", "Detalhes", "Cliente"]);
    expect(input.questions[2]).not.toHaveProperty("showWhen");
  });
});
