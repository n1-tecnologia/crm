// @vitest-environment jsdom
/**
 * V02-04A — prova de seletor dos dez casos (a)-(j) da Timeline única
 * (Comentários + Registros de Atividade) na página cheia da Tarefa. Mesmo
 * padrão de isolamento de rede de `painel-aprovacao.test.tsx`: `Transporte`
 * falso, sem `fetch` nem `apps/api` no ar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { ActivityRecord, ApprovalRequest, Comment, Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { makeFormatters } from "@/features/shell/format";
import { Timeline, TimelineEsqueleto } from "./timeline";

/** `ordem = índice` — o mesmo que `GET /estado` devolveria (padrão de `store.test.ts`/`painel-aprovacao.test.tsx`). */
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
  // Nunca resolve por padrão: mantém o compositor em "enviando" até o teste
  // decidir o desfecho — o mesmo comportamento usado no caso (h).
  gravarMock.mockImplementation(() => new Promise<RespostaDeGravacao>(() => {}));
  return {
    gravar: gravarMock,
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    gravarMock,
  };
}

/** Uma Tarefa emprestada do seed, sem Comentários/Atividade/Checklist/Dependência — cada teste povoa o que precisa. */
function montarTarefa(state: DataState): Task {
  const original = state.tasks[0];
  if (!original) throw new Error("seed sem Tarefas para clonar");
  const task: Task = {
    ...structuredClone(original),
    id: "tsk_teste_timeline",
    title: "Pagamento de teste",
    comments: [],
    checklists: [],
    dependencies: [],
  };
  state.tasks.push(task);
  return task;
}

function comentario(overrides: Partial<Comment> & Pick<Comment, "id" | "author" | "content" | "createdAt">): Comment {
  return { attachments: [], mentions: [], ...overrides };
}

function atividade(
  state: DataState,
  overrides: Partial<ActivityRecord> & Pick<ActivityRecord, "id" | "actor" | "action" | "objectId" | "at">,
): ActivityRecord {
  return {
    workspaceId: state.workspace.id,
    objectType: "task",
    objectName: "Pagamento de teste",
    result: "ok",
    ...overrides,
  };
}

function renderizar(state: DataState, ordens: Ordens, transporte: Transporte, memberId: string, task: Task, readOnly = false) {
  const fmt = makeFormatters(state.workspace.locale);
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
      <Timeline task={task} fmt={fmt} readOnly={readOnly} />
    </StoreProvider>,
  );
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

describe("Timeline — intercalação cronológica (a)", () => {
  it("a ordem no DOM é a ordem cronológica dos seis, do mais antigo ao mais recente", () => {
    const task = montarTarefa(state);
    const base = Date.parse("2026-01-01T10:00:00Z");
    const em = (minutos: number) => new Date(base + minutos * 60_000).toISOString();

    task.comments.push(
      comentario({ id: "cmt_1", author: { kind: "member", id: "mem_maryane" }, content: "Comentário 1", createdAt: em(0) }),
      comentario({ id: "cmt_2", author: { kind: "member", id: "mem_maryane" }, content: "Comentário 2", createdAt: em(20) }),
      comentario({ id: "cmt_3", author: { kind: "member", id: "mem_maryane" }, content: "Comentário 3", createdAt: em(40) }),
    );
    state.activity.push(
      atividade(state, { id: "atv_1", actor: { kind: "member", id: "mem_maryane" }, action: "Ação 1", objectId: task.id, at: em(10) }),
      atividade(state, { id: "atv_2", actor: { kind: "member", id: "mem_maryane" }, action: "Ação 2", objectId: task.id, at: em(30) }),
      atividade(state, { id: "atv_3", actor: { kind: "member", id: "mem_maryane" }, action: "Ação 3", objectId: task.id, at: em(50) }),
    );

    const { container } = renderizar(state, ordens, transporte, "mem_maryane", task);
    const itens = Array.from(container.querySelectorAll("ol > li")).map((li) => li.textContent ?? "");
    const ordemEsperada = ["Comentário 1", "Ação 1", "Comentário 2", "Ação 2", "Comentário 3", "Ação 3"];
    const indices = ordemEsperada.map((rotulo) => itens.findIndex((texto) => texto.includes(rotulo)));
    expect(indices.every((i) => i >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });
});

describe("Timeline — Ator sistema/Formulário (b)", () => {
  it("o texto exibido é sistema/Formulário e o nome do dono do Formulário não aparece", () => {
    const task = montarTarefa(state);
    const dono = state.members.find((m) => m.id !== "mem_maryane" && m.state === "ativo");
    if (!dono) throw new Error("seed sem um segundo Membro ativo para o dono do Formulário");
    state.activity.push(
      atividade(state, {
        id: "atv_form",
        actor: { kind: "system", id: "formulario:frm_x" },
        action: "Tarefa criada por Formulário",
        objectId: task.id,
        at: "2026-01-01T10:00:00Z",
        delegate: undefined,
      }),
    );

    render(
      <StoreProvider sessao={{ memberId: "mem_maryane" }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
        <Timeline task={task} fmt={makeFormatters(state.workspace.locale)} readOnly={false} />
      </StoreProvider>,
    );

    expect(screen.getByText("sistema/Formulário")).toBeTruthy();
    expect(screen.queryByText(dono.displayName)).toBeNull();
  });
});

describe("Timeline — pill de roteamento (c)", () => {
  it("o comentário apontado por approval.origin.threadCommentId recebe a pill Pedido de aprovação", () => {
    const task = montarTarefa(state);
    task.comments.push(
      comentario({ id: "cmt_rot", author: { kind: "system", id: "sistema" }, content: "Encaminhado para aprovação.", createdAt: "2026-01-01T10:00:00Z" }),
    );
    const approval: ApprovalRequest = {
      id: "apr_teste",
      origin: { kind: "processTask", taskId: task.id, processStep: "pagamento", threadCommentId: "cmt_rot" },
      requestedBy: { kind: "system", id: "sistema" },
      reason: "processo",
      object: { toolId: "", input: "", targetResourceType: "task", targetResourceId: task.id, effectClass: "escritaIrreversivel" },
      approverMemberId: "mem_maryane",
      createdAt: "2026-01-01T10:00:00Z",
    };
    state.approvals.push(approval);

    const { container } = renderizar(state, ordens, transporte, "mem_maryane", task);
    const linha = container.querySelector("#comentario-cmt_rot");
    expect(linha).toBeTruthy();
    expect(linha?.textContent).toContain("Pedido de aprovação");
  });
});

describe("Timeline — resposta canônica (d)", () => {
  it("aparece com a copy exata e como resposta (recuo + Em resposta a)", () => {
    const task = montarTarefa(state);
    task.comments.push(
      comentario({ id: "cmt_rot", author: { kind: "system", id: "sistema" }, content: "Encaminhado para aprovação.", createdAt: "2026-01-01T10:00:00Z" }),
      comentario({
        id: "cmt_resp",
        author: { kind: "member", id: "mem_maryane" },
        content: "✅ Aprovado por Maryane Costa",
        parentCommentId: "cmt_rot",
        createdAt: "2026-01-01T10:05:00Z",
      }),
    );

    renderizar(state, ordens, transporte, "mem_maryane", task);

    expect(screen.getByText("✅ Aprovado por Maryane Costa")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Em resposta a/ });
    expect(link.getAttribute("href")).toBe("#comentario-cmt_rot");
  });
});

describe("Timeline — atividade de decisão (e)", () => {
  it("mostra a fonte por clique/por comentário e o motivo quando existe", () => {
    const task = montarTarefa(state);
    const approval: ApprovalRequest = {
      id: "apr_teste_decisao",
      origin: { kind: "processTask", taskId: task.id, processStep: "pagamento", threadCommentId: "cmt_rot" },
      requestedBy: { kind: "system", id: "sistema" },
      reason: "processo",
      object: { toolId: "", input: "", targetResourceType: "task", targetResourceId: task.id, effectClass: "escritaIrreversivel" },
      approverMemberId: "mem_maryane",
      createdAt: "2026-01-01T10:00:00Z",
      decision: "aprovada",
      decidedByMemberId: "mem_maryane",
      decidedAt: "2026-01-01T10:05:00Z",
      decisionSource: "click",
    };
    state.approvals.push(approval);
    state.activity.push(
      atividade(state, {
        id: "atv_decisao",
        actor: { kind: "member", id: "mem_maryane" },
        action: "Aprovação decidida",
        objectType: "approvalRequest",
        objectId: approval.id,
        at: "2026-01-01T10:05:00Z",
        after: "aprovada",
        detail: "por clique — Documento conferido.",
      }),
    );

    renderizar(state, ordens, transporte, "mem_maryane", task);

    expect(screen.getByText(/por clique — Documento conferido\./)).toBeTruthy();
  });
});

describe("Timeline — sanitização de integração (f)", () => {
  it("CNPJ e URL com query no detail nunca aparecem no DOM", () => {
    const task = montarTarefa(state);
    state.activity.push(
      atividade(state, {
        id: "atv_integracao",
        actor: { kind: "integration", id: "itg_omie" },
        action: "Webhook processado",
        objectId: task.id,
        at: "2026-01-01T10:00:00Z",
        before: "pendente",
        after: "confirmado",
        detail: "cliente 12.345.678/0001-95 — https://exemplo.com/callback?token=abc123",
      }),
    );

    const { container } = renderizar(state, ordens, transporte, "mem_maryane", task);
    const texto = container.textContent ?? "";
    expect(texto).not.toContain("12.345.678/0001-95");
    expect(texto).not.toContain("token=abc123");
    expect(texto).toContain("Webhook processado");
  });
});

describe("Timeline — Ctrl+Enter envia, Enter sozinho não (g)", () => {
  it("Ctrl+Enter dispara o envio; Enter sozinho mantém o compositor parado", async () => {
    const task = montarTarefa(state);
    renderizar(state, ordens, transporte, "mem_maryane", task);

    const campo = screen.getByPlaceholderText("Escreva um comentário. Ctrl+Enter envia.");
    fireEvent.change(campo, { target: { value: "Olá" } });

    fireEvent.keyDown(campo, { key: "Enter" });
    expect(screen.queryByRole("button", { name: "Enviando…" })).toBeNull();
    expect(screen.getByRole("button", { name: "Comentar" })).toBeTruthy();

    fireEvent.keyDown(campo, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviando…" })).toBeTruthy());
  });
});

describe("Timeline — rascunho preservado durante o envio e no erro (h)", () => {
  it("o texto permanece enquanto envia; em erro, permanece e a mensagem aparece junto ao compositor", async () => {
    const task = montarTarefa(state);
    transporte.gravarMock.mockImplementationOnce(
      async (): Promise<RespostaDeGravacao> => ({ tipo: "falha", erro: "Sem conexão com o servidor." }),
    );
    renderizar(state, ordens, transporte, "mem_maryane", task);

    const campo = screen.getByPlaceholderText("Escreva um comentário. Ctrl+Enter envia.") as HTMLTextAreaElement;
    fireEvent.change(campo, { target: { value: "Rascunho importante" } });
    fireEvent.keyDown(campo, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("Sem conexão com o servidor.")).toBeTruthy();
    expect(campo.value).toBe("Rascunho importante");
  });
});

describe("Timeline — paginação preserva a entrada visível (i)", () => {
  it("Carregar atividades anteriores acrescenta entradas no topo sem remover a que já estava visível", () => {
    const task = montarTarefa(state);
    const base = Date.parse("2026-01-01T00:00:00Z");
    for (let i = 1; i <= 22; i += 1) {
      task.comments.push(
        comentario({
          id: `cmt_pag_${i}`,
          author: { kind: "member", id: "mem_maryane" },
          content: `Comentário ${i}`,
          createdAt: new Date(base + i * 60_000).toISOString(),
        }),
      );
    }

    renderizar(state, ordens, transporte, "mem_maryane", task);

    // Janela inicial (20): os 2 mais antigos ficam fora; o 3º é o mais antigo visível.
    expect(screen.queryByText("Comentário 1")).toBeNull();
    expect(screen.queryByText("Comentário 2")).toBeNull();
    expect(screen.getByText("Comentário 3")).toBeTruthy();
    expect(screen.getByText("Comentário 22")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Carregar atividades anteriores" }));

    expect(screen.getByText("Comentário 1")).toBeTruthy();
    // A entrada que já estava visível continua visível.
    expect(screen.getByText("Comentário 3")).toBeTruthy();
    expect(screen.getByText("Comentário 22")).toBeTruthy();
  });
});

describe("Timeline — vazio e carregando (j)", () => {
  it("vazio mostra a copy exata", () => {
    const task = montarTarefa(state);
    renderizar(state, ordens, transporte, "mem_maryane", task);
    expect(screen.getByText("Nenhum comentário ou atividade nesta Solicitação.")).toBeTruthy();
  });

  it("TimelineEsqueleto tem geometria com aria-hidden e status sr-only", () => {
    const { container } = render(<TimelineEsqueleto />);
    const bloco = container.querySelector('[aria-hidden="true"]');
    expect(bloco).toBeTruthy();
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Carregando a timeline…");
  });
});
