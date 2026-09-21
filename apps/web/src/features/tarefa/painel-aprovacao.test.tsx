// @vitest-environment jsdom
/**
 * V02-03B — prova de seletor dos nove casos (a)-(i) do card de Aprovação na
 * Tarefa. Componente síncrono/cliente: o guia local do Next reserva Server
 * Components assíncronos para E2E (Playwright), então este arquivo cobre só
 * `PainelAprovacao`/`PainelAprovacaoEsqueleto` com `@testing-library/react`
 * sobre um `Transporte` falso — mesmo padrão de isolamento de rede que
 * `store.test.ts` já usa, sem `fetch` nem `apps/api` no ar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "@n1/dominio";
import { effectiveListConfig } from "@n1/dominio/derive";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { ApprovalRequest, StatusDefinition, Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { makeFormatters } from "@/features/shell/format";
import { PainelAprovacao, PainelAprovacaoEsqueleto } from "./painel-aprovacao";

const CAMPO_CENTRO_DE_CUSTO = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === "Centro de Custo")!.id;
const CAMPO_VALOR = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === "Valor")!.id;

/** `ordem = índice` — o mesmo que `GET /estado` devolveria (padrão de `store.test.ts`). */
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

/**
 * `decideProcessApproval` resolve "aprovado"/"não aprovado" pelo NOME no
 * Conjunto de Status efetivo da Lista (a Lista real de Solicitações de
 * pagamento nasce no Plan 02-08, fora deste plano) — os testes de decisão
 * emprestam a Lista de uma Tarefa qualquer do seed e acrescentam os três
 * nomes que faltarem, sem tocar nos Status existentes que outras Tarefas já
 * usam.
 */
function garantirStatusDeProcesso(state: DataState, listId: string): void {
  const config = effectiveListConfig(state, listId);
  if (!config) throw new Error("Lista de teste sem configuração efetiva.");
  const existentes = config.statusSet.definitions;
  const jaTem = (nome: string) => existentes.some((d) => d.name === nome);
  const novas: StatusDefinition[] = [];
  let ordem = existentes.length;
  if (!jaTem("em aprovação")) {
    novas.push({ id: "sts_teste_em_aprovacao", name: "em aprovação", color: "#3b82f6", category: "emAndamento", order: ordem++ });
  }
  if (!jaTem("aprovado")) {
    novas.push({ id: "sts_teste_aprovado", name: "aprovado", color: "#166534", category: "fechado", order: ordem++ });
  }
  if (!jaTem("não aprovado")) {
    novas.push({ id: "sts_teste_nao_aprovado", name: "não aprovado", color: "#ef4444", category: "concluido", order: ordem++ });
  }
  if (novas.length === 0) return;
  const alvo = config.statusSetDefinedAt;
  const container =
    alvo.type === "list"
      ? state.lists.find((l) => l.id === alvo.id)
      : alvo.type === "folder"
        ? state.folders.find((f) => f.id === alvo.id)
        : state.spaces.find((s) => s.id === alvo.id);
  if (!container?.statusSet) throw new Error("statusSet do container de teste ausente.");
  container.statusSet.definitions.push(...novas);
}

/** Uma Tarefa de Solicitação de pagamento + a Solicitação de Aprovação `processTask` ligada a ela. */
function montarCenario(state: DataState, aprovadorId: string) {
  const original = state.tasks[0];
  if (!original) throw new Error("seed sem Tarefas para clonar");
  garantirStatusDeProcesso(state, original.listId);

  const comentario = {
    id: "cmt_teste_roteamento",
    author: { kind: "system", id: "sistema" } as const,
    content: "Encaminhado para aprovação.",
    attachments: [],
    mentions: [],
    createdAt: original.createdAt,
  };

  const task: Task = {
    ...structuredClone(original),
    id: "tsk_teste_sp",
    readableId: "SP-0001",
    title: "Pagamento de teste",
    fieldValues: [
      { definitionId: CAMPO_CENTRO_DE_CUSTO, value: "TRIA", state: "ativo" },
      { definitionId: CAMPO_VALOR, value: 1500, state: "ativo" },
    ],
    attachments: [],
    comments: [comentario],
    // `decideProcessApproval` movimenta o Status por `changeTaskStatus`: uma
    // Tarefa emprestada do seed pode trazer Checklist/Dependência abertos que
    // bloqueiam a transição — nada disso é do interesse destes testes.
    checklists: [],
    dependencies: [],
  };

  const approval: ApprovalRequest = {
    id: "apr_teste_sp",
    origin: { kind: "processTask", taskId: task.id, processStep: "pagamento", threadCommentId: comentario.id },
    requestedBy: { kind: "system", id: "sistema" },
    reason: "processo",
    object: { toolId: "", input: "", targetResourceType: "task", targetResourceId: task.id, effectClass: "escritaIrreversivel" },
    approverMemberId: aprovadorId,
    createdAt: original.createdAt,
  };

  state.tasks.push(task);
  state.approvals.push(approval);
  return { task, approval };
}

function renderizar(state: DataState, ordens: Ordens, transporte: Transporte, memberId: string, task: Task) {
  const fmt = makeFormatters(state.workspace.locale);
  return render(
    <StoreProvider
      sessao={{ memberId }}
      estadoInicial={{ data: state, revisao: 1, ordens }}
      transporte={transporte}
    >
      <PainelAprovacao task={task} fmt={fmt} report={() => {}} />
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

describe("PainelAprovacao — pendente, autorizado (a)", () => {
  it("os dois CTAs aparecem habilitados", () => {
    const { task } = montarCenario(state, "mem_julia");
    renderizar(state, ordens, transporte, "mem_julia", task);

    expect(screen.getByText("Aprovação pendente")).toBeTruthy();
    const aprovar = screen.getByRole("button", { name: "Aprovar solicitação" });
    const rejeitar = screen.getByRole("button", { name: "Rejeitar solicitação" });
    expect(aprovar.getAttribute("aria-disabled")).toBe("false");
    expect(rejeitar.getAttribute("aria-disabled")).toBe("false");
  });
});

describe("PainelAprovacao — pendente, não autorizado (b)", () => {
  it("CTAs indisponíveis e a razão visível", () => {
    const { task } = montarCenario(state, "mem_julia"); // aprovador é Júlia
    renderizar(state, ordens, transporte, "mem_marcos", task); // sessão é Marcos, membro comum

    expect(
      screen.getByText("Somente Júlia Prado ou um Administrador pode decidir esta Solicitação."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aprovar solicitação" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rejeitar solicitação" })).toBeNull();
  });
});

describe("PainelAprovacao — sem prazo (c)", () => {
  it("nenhum texto de prazo/expiração/contagem no DOM", () => {
    const { task } = montarCenario(state, "mem_julia");
    const { container } = renderizar(state, ordens, transporte, "mem_julia", task);

    const texto = container.textContent ?? "";
    expect(/prazo/i.test(texto)).toBe(false);
    expect(/expira/i.test(texto)).toBe(false);
    expect(/restante/i.test(texto)).toBe(false);
  });
});

describe("PainelAprovacao — rejeitar com motivo vazio (d)", () => {
  it("CTA de confirmação impedido e ajuda de erro visível", () => {
    const { task } = montarCenario(state, "mem_julia");
    renderizar(state, ordens, transporte, "mem_julia", task);

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar solicitação" }));
    const dialogo = screen.getByRole("alertdialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Rejeitar solicitação" });
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");
    expect(within(dialogo).getByText("O motivo ficará visível para o Financeiro na timeline.")).toBeTruthy();
  });
});

describe("PainelAprovacao — durante o envio (e)", () => {
  it("CTAs desabilitados e label «Aprovando…»", async () => {
    const { task } = montarCenario(state, "mem_julia");
    // Nunca resolve neste teste — mantém o controlador em `processando`.
    transporte.gravarMock.mockImplementationOnce(() => new Promise<RespostaDeGravacao>(() => {}));
    renderizar(state, ordens, transporte, "mem_julia", task);

    fireEvent.click(screen.getByRole("button", { name: "Aprovar solicitação" }));
    const dialogo = screen.getByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Aprovar solicitação" }));

    await waitFor(() =>
      expect(within(dialogo).getByRole("button", { name: "Aprovando…" })).toBeTruthy(),
    );
    const confirmar = within(dialogo).getByRole("button", { name: "Aprovando…" });
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("PainelAprovacao — conflito (f)", () => {
  it("mostra «Esta Solicitação já foi decidida por» e não oferece sobrescrita", async () => {
    // Júlia tenta REJEITAR; a resposta do servidor traz a Solicitação já
    // APROVADA por outra pessoa — decisão oposta, o conflito genuíno que
    // `decideProcessApproval` nunca sobrescreve (D-09).
    const { task, approval } = montarCenario(state, "mem_julia");
    const ordemDaAprovacao = ordens.approvals?.[approval.id] ?? 0;

    transporte.gravarMock.mockImplementationOnce(async (): Promise<RespostaDeGravacao> => ({
      tipo: "diferenca",
      resultado: { ok: false, error: "Esta Solicitação já foi aprovada por Marcos Lima." },
      revisao: 2,
      revisaoAnterior: 1,
      diferenca: {
        gravados: [
          {
            colecao: "approvals",
            id: approval.id,
            ordem: ordemDaAprovacao,
            dados: {
              ...approval,
              decision: "aprovada",
              decidedByMemberId: "mem_marcos",
              decidedAt: new Date().toISOString(),
              decisionSource: "click",
            },
          },
        ],
        removidos: [],
      },
    }));

    renderizar(state, ordens, transporte, "mem_julia", task);

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar solicitação" }));
    const dialogo = screen.getByRole("alertdialog");
    const motivo = within(dialogo).getByLabelText(/Motivo da rejeição/);
    fireEvent.change(motivo, { target: { value: "Documento divergente." } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Rejeitar solicitação" }));

    await waitFor(() =>
      expect(screen.getByText("Esta Solicitação já foi decidida por Marcos Lima. A tela foi atualizada.")).toBeTruthy(),
    );
    expect(screen.queryByText(/sobrescrever/i)).toBeNull();
  });
});

describe("PainelAprovacao — decidida (g)", () => {
  it("heading, fonte da decisão visível e nenhum CTA", () => {
    const { task, approval } = montarCenario(state, "mem_julia");
    Object.assign(approval, {
      decision: "aprovada",
      decidedByMemberId: "mem_julia",
      decidedAt: new Date().toISOString(),
      decisionSource: "click",
    });
    renderizar(state, ordens, transporte, "mem_julia", task);

    expect(screen.getByText("Aprovação concluída")).toBeTruthy();
    expect(screen.getByText(/por clique/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aprovar solicitação" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rejeitar solicitação" })).toBeNull();
  });

  it("mostra «por comentário» quando a fonte for o fallback do tópico", () => {
    const { task, approval } = montarCenario(state, "mem_julia");
    Object.assign(approval, {
      decision: "rejeitada",
      decidedByMemberId: "mem_julia",
      decidedAt: new Date().toISOString(),
      decisionSource: "comment",
    });
    renderizar(state, ordens, transporte, "mem_julia", task);

    expect(screen.getByText(/por comentário/)).toBeTruthy();
  });
});

describe("PainelAprovacaoEsqueleto — carregamento (h)", () => {
  it("geometria com aria-hidden e status sr-only", () => {
    const { container } = render(<PainelAprovacaoEsqueleto />);
    const bloco = container.querySelector('[aria-hidden="true"]');
    expect(bloco).toBeTruthy();
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Carregando a Aprovação…");
  });
});

describe("PainelAprovacao — acessibilidade (i)", () => {
  it("os CTAs têm nome acessível textual", () => {
    const { task } = montarCenario(state, "mem_julia");
    renderizar(state, ordens, transporte, "mem_julia", task);
    // getByRole com `name` já exige nome acessível textual — falha se o botão
    // só tiver ícone/cor.
    expect(screen.getByRole("button", { name: "Aprovar solicitação" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rejeitar solicitação" })).toBeTruthy();
  });

  it("o ConfirmDialog devolve o foco ao gatilho ao fechar", async () => {
    const { task } = montarCenario(state, "mem_julia");
    renderizar(state, ordens, transporte, "mem_julia", task);

    const gatilho = screen.getByRole("button", { name: "Aprovar solicitação" });
    gatilho.focus();
    fireEvent.click(gatilho);
    const dialogo = screen.getByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Voltar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.activeElement).toBe(gatilho);
  });
});
