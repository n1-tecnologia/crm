// @vitest-environment jsdom
/**
 * 06-14 Task 1 — o gesto "Responder" no tópico da conta a pagar (D6-02: "clique
 * ou 'ok' no fio"). Antes, só o clique no card era alcançável pela tela: quem
 * seguia a chamada do Resumo ("responda ok") escrevia um Comentário RAIZ, a
 * ponte o ignorava e ninguém era avisado (06-VERIFICATION.md, gap do critério 2).
 *
 * O estado é montado pelo próprio domínio (`buildSeed()` + o que a ponte faz,
 * `publicarResumoParaConferencia`). A rede é um `Transporte` falso: o que se
 * assere é a chamada gravada e, na `copia` que foi ao servidor (D-05), o que a
 * ponte leria — `respostasDeConferenciaPendentes` e
 * `classificarRespostaDeConferencia`, as MESMAS funções que ela usa.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import {
  CP,
  classificarRespostaDeConferencia,
  conferenciaDoResumo,
  decideProcessApproval,
  publicarResumoParaConferencia,
  respostasDeConferenciaPendentes,
} from "@n1/dominio/operations";
import type { ConferenciaDoResumo, DeParaDeLancamento } from "@n1/dominio/operations";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { ApprovalRequest, Comment, Task } from "@n1/dominio/types";
import { StoreProvider, useData } from "@/dados/store";
import type { PedidoDeGravacao, RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { makeFormatters } from "@/features/shell/format";
import { Timeline } from "./timeline";

/** `ordem = índice` — o mesmo que `GET /estado` devolveria (padrão de `timeline.test.tsx`). */
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
  // Nunca resolve por padrão: o compositor fica em "enviando" até o teste decidir o desfecho.
  gravarMock.mockImplementation(() => new Promise<RespostaDeGravacao>(() => {}));
  return {
    gravar: gravarMock,
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    gravarMock,
  };
}

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

let state: DataState;
let transporte: TransporteFalso;

const conta = (estado: DataState = state): Task => {
  const t = estado.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  return t;
};

/** O que a ponte faz no Momento 1: publica o Resumo e abre a Conferência. */
function publicarResumo(): ConferenciaDoResumo {
  const r = publicarResumoParaConferencia(state, CP.financeiroId, conta().id, { dePara: DE_PARA });
  if (!r.ok) throw new Error(r.error);
  return r.value.conferencia;
}

function renderizar(memberId: string, readOnly = false) {
  const fmt = makeFormatters(state.workspace.locale);
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }} transporte={transporte}>
      <Timeline task={conta()} fmt={fmt} readOnly={readOnly} />
    </StoreProvider>,
  );
}

/** A página cheia lê a Tarefa do store: quando o estado vira a cópia gravada, a Timeline recebe a Tarefa nova. */
function TimelineDoStore() {
  const task = useData((data) => data.tasks.find((t) => t.id === "tsk_cp_das"));
  const locale = useData((data) => data.workspace.locale);
  if (!task) return null;
  return <Timeline task={task} fmt={makeFormatters(locale)} readOnly={false} />;
}

function linhaDe(container: HTMLElement, commentId: string): HTMLElement {
  const li = container.querySelector<HTMLElement>(`#comentario-${commentId}`);
  if (!li) throw new Error(`sem a linha do Comentário ${commentId}`);
  return li;
}

/** Abre a resposta no Comentário, digita e envia com Ctrl+Enter. */
function responder(container: HTMLElement, commentId: string, texto: string) {
  const linha = linhaDe(container, commentId);
  fireEvent.click(within(linha).getByRole("button", { name: "Responder" }));
  const campo = within(linha).getByRole("textbox", { name: "Resposta no fio" });
  fireEvent.change(campo, { target: { value: texto } });
  fireEvent.keyDown(campo, { key: "Enter", ctrlKey: true });
}

function pedidoGravado(indice = 0): PedidoDeGravacao {
  const pedido = transporte.gravarMock.mock.calls[indice]?.[0];
  if (!pedido) throw new Error(`nenhuma gravação no índice ${indice}`);
  return pedido;
}

function argsDoComentario(pedido: PedidoDeGravacao): { readonly content: string; readonly parentCommentId?: string } {
  expect(pedido.chamadas).toHaveLength(1);
  const chamada = pedido.chamadas[0]!;
  expect(chamada.nome).toBe("addTaskComment");
  return chamada.args[1] as { readonly content: string; readonly parentCommentId?: string };
}

const AVISO = 'Para conferir o Resumo pelo tópico, use "Responder" no Comentário do Resumo; um comentário novo aqui não confere.';

beforeEach(() => {
  state = buildSeed();
  transporte = transporteFalso();
});

afterEach(() => {
  cleanup();
});

describe("(a) todo Comentário tem \"Responder\", e ele abre o compositor de resposta na linha", () => {
  it("um botão por Comentário; o compositor tem rótulo, placeholder, envio e Cancelar; um aberto por vez", () => {
    const conferencia = publicarResumo();
    conta().comments.push({
      id: "cmt_outro_fio",
      author: { kind: "member", id: CP.financeiroId },
      content: "Boleto anexado.",
      createdAt: "2026-01-01T09:00:00Z",
      attachments: [],
      mentions: [],
    });
    const { container } = renderizar(CP.financeiroId);

    const comentarios = conta().comments.filter((c) => !c.deletedAt);
    expect(comentarios.length).toBeGreaterThan(1);
    for (const c of comentarios) {
      expect(within(linhaDe(container, c.id)).getByRole("button", { name: "Responder" })).toBeTruthy();
    }

    const linha = linhaDe(container, conferencia.origin.resumoCommentId);
    fireEvent.click(within(linha).getByRole("button", { name: "Responder" }));
    const campo = within(linha).getByRole("textbox", { name: "Resposta no fio" });
    expect(campo.getAttribute("placeholder")).toBe("Responder…");
    expect(within(linha).getByRole("button", { name: "Enviar resposta" })).toBeTruthy();
    expect(within(linha).getByRole("button", { name: "Cancelar" })).toBeTruthy();
    expect(within(linha).queryByRole("button", { name: "Responder" })).toBeNull();

    // Abrir em outro Comentário fecha o primeiro.
    fireEvent.click(within(linhaDe(container, "cmt_outro_fio")).getByRole("button", { name: "Responder" }));
    expect(screen.getAllByRole("textbox", { name: "Resposta no fio" })).toHaveLength(1);
    expect(within(linhaDe(container, "cmt_outro_fio")).getByRole("textbox", { name: "Resposta no fio" })).toBeTruthy();
    expect(within(linha).getByRole("button", { name: "Responder" })).toBeTruthy();
  });
});

describe("(b) enviar grava uma addTaskComment com o pai = raiz do fio", () => {
  it("Ctrl+Enter e o botão \"Enviar resposta\" mandam o conteúdo e o parentCommentId", async () => {
    const conferencia = publicarResumo();
    const { container } = renderizar(CP.financeiroId);

    responder(container, conferencia.origin.resumoCommentId, "ok");
    await waitFor(() => expect(transporte.gravarMock).toHaveBeenCalledTimes(1));
    const args = argsDoComentario(pedidoGravado());
    expect(args.content).toBe("ok");
    expect(args.parentCommentId).toBe(conferencia.origin.threadCommentId);
    expect(within(linhaDe(container, conferencia.origin.resumoCommentId)).getByRole("button", { name: "Enviando…" })).toBeTruthy();
  });

  it("o botão de envio também grava", async () => {
    const conferencia = publicarResumo();
    const { container } = renderizar(CP.financeiroId);
    const linha = linhaDe(container, conferencia.origin.resumoCommentId);
    fireEvent.click(within(linha).getByRole("button", { name: "Responder" }));
    fireEvent.change(within(linha).getByRole("textbox", { name: "Resposta no fio" }), { target: { value: "confere o vencimento" } });
    fireEvent.click(within(linha).getByRole("button", { name: "Enviar resposta" }));
    await waitFor(() => expect(transporte.gravarMock).toHaveBeenCalledTimes(1));
    const args = argsDoComentario(pedidoGravado());
    expect(args.content).toBe("confere o vencimento");
    expect(args.parentCommentId).toBe(conferencia.origin.threadCommentId);
  });
});

describe("(c) o \"ok\" do Financeiro no fio é o que a ponte lê como aprovação", () => {
  it("entra nas respostas pendentes, é aprovação, e a decisão da ponte confere o Resumo", async () => {
    const conferencia = publicarResumo();
    const { container } = renderizar(CP.financeiroId);

    responder(container, conferencia.origin.resumoCommentId, "ok");
    await waitFor(() => expect(transporte.gravarMock).toHaveBeenCalledTimes(1));
    const { copia } = pedidoGravado();

    const pendentes = respostasDeConferenciaPendentes(copia, conta(copia));
    expect(pendentes).toHaveLength(1);
    const resposta = pendentes[0]!;
    expect(resposta.content).toBe("ok");
    expect(resposta.author).toEqual({ kind: "member", id: CP.financeiroId });
    expect(resposta.parentCommentId).toBe(conferencia.origin.threadCommentId);
    expect(classificarRespostaDeConferencia(resposta.content)).toBe("aprovacao");

    // O que a ponte aplica depois de ler a resposta.
    const decidida = decideProcessApproval(copia, CP.financeiroId, conferencia.id, "aprovada", { source: "comment" });
    expect(decidida.ok).toBe(true);
    expect(conferenciaDoResumo(copia, conta(copia)).estado).toBe("conferida");
  });
});

describe("(d) qualquer outra resposta no fio é ajuste", () => {
  it("\"é prestação comercial, não ADM\" entra nas pendentes e é ajuste", async () => {
    const conferencia = publicarResumo();
    const { container } = renderizar(CP.financeiroId);

    responder(container, conferencia.origin.resumoCommentId, "é prestação comercial, não ADM");
    await waitFor(() => expect(transporte.gravarMock).toHaveBeenCalledTimes(1));
    const { copia } = pedidoGravado();
    const pendentes = respostasDeConferenciaPendentes(copia, conta(copia));
    expect(pendentes.map((c) => c.content)).toEqual(["é prestação comercial, não ADM"]);
    expect(classificarRespostaDeConferencia(pendentes[0]!.content)).toBe("ajuste");
  });
});

describe("(e) responder ao Resumo REVISADO cai na raiz do fio", () => {
  it("o parentCommentId é a raiz, não o revisado, e a resposta conta para a Conferência nova", async () => {
    const primeira = publicarResumo();
    const rejeitada = decideProcessApproval(state, CP.financeiroId, primeira.id, "rejeitada", {
      source: "click",
      reason: "é prestação comercial, não ADM",
    });
    if (!rejeitada.ok) throw new Error(rejeitada.error);
    const nova = publicarResumo();
    expect(nova.id).not.toBe(primeira.id);
    expect(nova.origin.threadCommentId).toBe(primeira.origin.threadCommentId);
    expect(nova.origin.resumoCommentId).not.toBe(nova.origin.threadCommentId);

    const { container } = renderizar(CP.financeiroId);
    responder(container, nova.origin.resumoCommentId, "ok");
    await waitFor(() => expect(transporte.gravarMock).toHaveBeenCalledTimes(1));
    const pedido = pedidoGravado();
    const args = argsDoComentario(pedido);
    expect(args.parentCommentId).toBe(nova.origin.threadCommentId);
    expect(args.parentCommentId).not.toBe(nova.origin.resumoCommentId);

    const pendentes = respostasDeConferenciaPendentes(pedido.copia, conta(pedido.copia));
    expect(pendentes.map((c) => c.content)).toEqual(["ok"]);
    expect(conferenciaDoResumo(pedido.copia, conta(pedido.copia)).conferencia?.id).toBe(nova.id);
  });
});

describe("(f) prova negativa: o \"ok\" no compositor raiz não confere", () => {
  it("sai sem parentCommentId, e a ponte não vê resposta nenhuma", async () => {
    publicarResumo();
    renderizar(CP.financeiroId);

    const campo = screen.getByPlaceholderText("Escreva um comentário. @ menciona alguém. Ctrl+Enter envia.");
    fireEvent.change(campo, { target: { value: "ok" } });
    fireEvent.keyDown(campo, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(transporte.gravarMock).toHaveBeenCalledTimes(1));

    const pedido = pedidoGravado();
    const args = argsDoComentario(pedido);
    expect(args.content).toBe("ok");
    expect(args.parentCommentId).toBeUndefined();
    expect(respostasDeConferenciaPendentes(pedido.copia, conta(pedido.copia))).toEqual([]);
  });
});

describe("(g) o aviso na doca do compositor raiz", () => {
  it("com a Conferência pendente, o aviso exato aparece", () => {
    publicarResumo();
    renderizar(CP.financeiroId);
    expect(screen.getByText(AVISO)).toBeTruthy();
  });

  it("com a Conferência conferida, não aparece", () => {
    const c = publicarResumo();
    const r = decideProcessApproval(state, CP.financeiroId, c.id, "aprovada", { source: "click" });
    if (!r.ok) throw new Error(r.error);
    renderizar(CP.financeiroId);
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it("sem Conferência, não aparece", () => {
    renderizar(CP.financeiroId);
    expect(screen.queryByText(AVISO)).toBeNull();
  });
});

describe("(h) somente leitura", () => {
  it("nenhum \"Responder\" e nenhum aviso", () => {
    publicarResumo();
    renderizar(CP.financeiroId, true);
    expect(conta().comments.length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Responder" })).toBeNull();
    expect(screen.queryByText(AVISO)).toBeNull();
  });
});

describe("(i) os três desfechos do envio", () => {
  it("\"Cancelar\" fecha sem gravar nada, e o foco volta ao \"Responder\"", async () => {
    const conferencia = publicarResumo();
    const { container } = renderizar(CP.financeiroId);
    const linha = linhaDe(container, conferencia.origin.resumoCommentId);
    fireEvent.click(within(linha).getByRole("button", { name: "Responder" }));
    fireEvent.change(within(linha).getByRole("textbox", { name: "Resposta no fio" }), { target: { value: "ok" } });
    fireEvent.click(within(linha).getByRole("button", { name: "Cancelar" }));

    expect(within(linha).queryByRole("textbox", { name: "Resposta no fio" })).toBeNull();
    expect(transporte.gravarMock).not.toHaveBeenCalled();
    const botao = within(linha).getByRole("button", { name: "Responder" });
    await waitFor(() => expect(document.activeElement).toBe(botao));
  });

  it("na falha do servidor, o rascunho fica e o erro aparece dentro do compositor de resposta", async () => {
    transporte.gravarMock.mockImplementationOnce(
      async (): Promise<RespostaDeGravacao> => ({ tipo: "falha", erro: "Sem conexão com o servidor." }),
    );
    const conferencia = publicarResumo();
    const { container } = renderizar(CP.financeiroId);
    responder(container, conferencia.origin.resumoCommentId, "ok");

    const linha = linhaDe(container, conferencia.origin.resumoCommentId);
    const alerta = await within(linha).findByRole("alert");
    expect(alerta.textContent).toBe("Sem conexão com o servidor.");
    const campo = within(linha).getByRole("textbox", { name: "Resposta no fio" }) as HTMLTextAreaElement;
    expect(campo.value).toBe("ok");
  });

  it("no sucesso, fecha só quando a resposta aparece na lista, \"Em resposta a\"", async () => {
    transporte.gravarMock.mockImplementationOnce(
      async (pedido): Promise<RespostaDeGravacao> => ({
        tipo: "estado",
        resultado: pedido.resultado,
        estado: { data: pedido.copia, revisao: 2, ordens: ordensDeTodasAsColecoes(pedido.copia), memberId: CP.financeiroId },
      }),
    );
    const conferencia = publicarResumo();
    const { container } = render(
      <StoreProvider
        sessao={{ memberId: CP.financeiroId }}
        estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }}
        transporte={transporte}
      >
        <TimelineDoStore />
      </StoreProvider>,
    );

    const antes = new Set(conta().comments.map((c) => c.id));
    responder(container, conferencia.origin.resumoCommentId, "ok");

    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Resposta no fio" })).toBeNull());
    const { copia } = pedidoGravado();
    const nova: Comment | undefined = conta(copia).comments.find((c) => !antes.has(c.id));
    if (!nova) throw new Error("a resposta não está na cópia gravada");
    const linhaNova = linhaDe(container, nova.id);
    expect(within(linhaNova).getByText("ok")).toBeTruthy();
    expect(within(linhaNova).getByRole("link", { name: /Em resposta a/ }).getAttribute("href")).toBe(
      `#comentario-${conferencia.origin.threadCommentId}`,
    );
  });
});

describe("(j) a pílula do raiz do fio diz de que processo ele é", () => {
  it("o raiz do Resumo leva \"Conferência do Resumo\", não \"Pedido de aprovação\"", () => {
    const conferencia = publicarResumo();
    const { container } = renderizar(CP.financeiroId);
    const raiz = linhaDe(container, conferencia.origin.threadCommentId);
    expect(raiz.textContent).toContain("Conferência do Resumo");
    expect(raiz.textContent).not.toContain("Pedido de aprovação");
  });

  it("o raiz de uma Aprovação de pagamento continua com \"Pedido de aprovação\"", () => {
    const task = conta();
    task.comments.push({
      id: "cmt_rot_pagamento",
      author: { kind: "system", id: "sistema" },
      content: "Encaminhado para aprovação.",
      createdAt: "2026-01-01T10:00:00Z",
      attachments: [],
      mentions: [],
    });
    const approval: ApprovalRequest = {
      id: "apr_teste_pagamento",
      origin: { kind: "processTask", taskId: task.id, processStep: "pagamento", threadCommentId: "cmt_rot_pagamento" },
      requestedBy: { kind: "system", id: "sistema" },
      reason: "processo",
      object: { toolId: "", input: "", targetResourceType: "task", targetResourceId: task.id, effectClass: "escritaIrreversivel" },
      approverMemberId: CP.financeiroId,
      createdAt: "2026-01-01T10:00:00Z",
    };
    state.approvals.push(approval);
    const { container } = renderizar(CP.financeiroId);
    const raiz = linhaDe(container, "cmt_rot_pagamento");
    expect(raiz.textContent).toContain("Pedido de aprovação");
    expect(raiz.textContent).not.toContain("Conferência do Resumo");
  });
});
