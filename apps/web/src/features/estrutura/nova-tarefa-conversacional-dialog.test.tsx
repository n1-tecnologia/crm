// @vitest-environment jsdom
/**
 * 14-16 Task 1 — o diálogo de nova Tarefa conversacional chama
 * `POST /tarefas-conversacionais` (D-07, A5). O Contato e o Canal chegam por props
 * (a Caixa e a ficha do Contato abrem assim), a Lista é a Pós-venda do seed, e a
 * api é falsa: `criarTarefaConversacional` e `useConversaAbertaDoPar` são mocks.
 * O que se prova: "Primeira Mensagem" aparece só sem Conversa aberta no par; o
 * envio manda os ids e a Mensagem (só quando o campo aparece), re-hidrata e fecha;
 * a recusa da api (400 com `campo: "mensagem"`) fica no campo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { POS_VENDA_LIST_ID } from "@n1/dominio/seed-pos-venda";
import type { Canal } from "@n1/dominio/crm/canais";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { ErroDeApi } from "@/dados/crm/cliente-crm";

const { criar, rehidratar, conversa } = vi.hoisted(() => ({
  criar: vi.fn(),
  rehidratar: vi.fn(async () => undefined),
  /** `undefined` = verificando, `null` = sem Conversa aberta, `{ id }` = há uma. */
  conversa: { atual: null as { id: string } | null | undefined, erro: undefined as Error | undefined },
}));

vi.mock("@/dados/store", async (original) => ({
  ...(await original<typeof import("@/dados/store")>()),
  useRehidratar: () => rehidratar,
}));

vi.mock("@/dados/crm/tarefas-conversacionais", () => ({
  criarTarefaConversacional: criar,
  useConversaAbertaDoPar: () => ({ conversa: conversa.atual, ...(conversa.erro ? { erro: conversa.erro } : {}) }),
}));

const CONTATO = {
  contato: { id: "ct_1", nome: "Helena", sobrenome: "Prado", estado: "ativo" },
  identificadores: [{ id: "id_1", contatoId: "ct_1", tipo: "whatsapp", valor: "5511999990000", valorExibido: null, principal: true }],
  vinculos: [],
};

vi.mock("@/dados/crm/contatos", () => ({
  useContato: (id: string | undefined) => ({ data: id === "ct_1" ? CONTATO : undefined }),
}));

const canal = (id: string, nome: string, tipo: Canal["tipo"]): Canal =>
  ({ id, nome, tipo, provedor: "whatsapp-nao-oficial", conexao: "conectada", estado: "ativo" }) as unknown as Canal;

vi.mock("@/dados/crm/canais", () => ({
  useCanais: () => ({ data: { ok: true, itens: [canal("chn_wpp", "WhatsApp da Escola", "whatsapp"), canal("chn_mail", "E-mail do Suporte", "email")], total: 2 } }),
}));

vi.mock("@/dados/crm/negocios", () => ({
  useNegocios: () => ({ data: { ok: true, itens: [], total: 0 } }),
}));

vi.mock("@/features/crm/seletor-de-registro", () => ({
  SeletorDeRegistro: () => null,
}));

import { NovaTarefaConversacionalDialog } from "./nova-tarefa-conversacional-dialog";

let state: DataState;

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
  criar.mockReset();
  rehidratar.mockClear();
  conversa.atual = null;
  conversa.erro = undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar(props: { onDone?: (mensagem: string, taskId: string) => void; onClose?: () => void } = {}) {
  const transporte: Transporte = {
    gravar: vi.fn(),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  const onDone = props.onDone ?? vi.fn();
  render(
    <StoreProvider sessao={{ memberId: state.workspace.ownerMemberId }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
      <NovaTarefaConversacionalDialog open listId={POS_VENDA_LIST_ID} contactId="ct_1" channelId="chn_wpp" onClose={props.onClose ?? vi.fn()} onDone={onDone} />
    </StoreProvider>,
  );
  return { onDone };
}

describe("a Primeira Mensagem (D-07)", () => {
  it("(a) sem Conversa aberta no par, o campo aparece e é obrigatório: criar fica desligado até escrever", () => {
    conversa.atual = null;
    montar();
    expect(screen.getByLabelText(/Primeira Mensagem/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(criar).not.toHaveBeenCalled();
  });

  it("(b) com Conversa aberta no par, o campo não existe", () => {
    conversa.atual = { id: "cv_1" };
    montar();
    expect(screen.queryByLabelText(/Primeira Mensagem/)).toBeNull();
  });

  it("(c) enquanto a api ainda responde, o campo não pisca na tela", () => {
    conversa.atual = undefined;
    montar();
    expect(screen.queryByLabelText(/Primeira Mensagem/)).toBeNull();
  });

  it("(d) se a conferência falhar, o campo aparece: a api decide no envio", () => {
    conversa.atual = undefined;
    conversa.erro = new ErroDeApi(500, "Falha.");
    montar();
    expect(screen.getByLabelText(/Primeira Mensagem/)).toBeTruthy();
  });
});

describe("criar a Tarefa pela rota", () => {
  it("(e) sem Conversa aberta: manda os ids e a Mensagem, re-hidrata e avisa quem abriu", async () => {
    conversa.atual = null;
    criar.mockResolvedValue({ task: { id: "t_9", title: "Helena Prado" }, conversa: { id: "cv_9", aberta: true } });
    const { onDone } = montar();
    fireEvent.change(screen.getByLabelText(/Primeira Mensagem/), { target: { value: "  Oi, Helena!  " } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("Tarefa criada: Helena Prado.", "t_9"));
    expect(criar).toHaveBeenCalledTimes(1);
    const corpo = criar.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(corpo).toMatchObject({ listId: POS_VENDA_LIST_ID, contatoId: "ct_1", canalId: "chn_wpp", mensagem: { conteudo: "Oi, Helena!" } });
    expect(rehidratar).toHaveBeenCalledTimes(1);
  });

  it("(f) com Conversa aberta: o corpo não leva `mensagem`", async () => {
    conversa.atual = { id: "cv_1" };
    criar.mockResolvedValue({ task: { id: "t_9", title: "Helena Prado" }, conversa: { id: "cv_1", aberta: false } });
    const { onDone } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(criar.mock.calls[0]?.[0]).not.toHaveProperty("mensagem");
  });

  it("(g) a recusa da api aparece no diálogo, nada é re-hidratado e o diálogo não avisa sucesso", async () => {
    conversa.atual = null;
    criar.mockRejectedValue(new ErroDeApi(400, "Escreva a primeira Mensagem.", { codigo: "VALOR_INVALIDO", campo: "mensagem" }));
    const { onDone } = montar();
    fireEvent.change(screen.getByLabelText(/Primeira Mensagem/), { target: { value: "Oi" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(screen.getByText("Escreva a primeira Mensagem.")).toBeTruthy());
    expect(onDone).not.toHaveBeenCalled();
    expect(rehidratar).not.toHaveBeenCalled();
  });
});
