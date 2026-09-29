// @vitest-environment jsdom
/**
 * Fase 6 (06-04 Task 1) — o card "Conferência do Resumo", a pílula e a fila.
 *
 * O estado é montado pelo próprio domínio, sem registro fabricado à mão:
 * `buildSeed()` + `publicarResumoParaConferencia` (o que a ponte faz) +
 * `decideProcessApproval` (o que o clique ou o fio fazem). A rede é um
 * `Transporte` falso, no molde de `painel-aprovacao.test.tsx`: o que se
 * assere é a chamada gravada (`decideProcessApproval` com `source: "click"`).
 *
 * No seed: `mem_maryane` é o Financeiro (aprovador da Conferência, alcança a
 * Lista); `mem_thiago` é Proprietário e alcança; `mem_rafael` é
 * Administrador — revisor por `revisoresDoResumo` — mas NÃO alcança a Lista
 * de Contas a pagar; `mem_marcos_paulo` alcança e não é revisor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { buildSeed } from "@n1/dominio/seed";
import { CP, decideProcessApproval, publicarResumoParaConferencia } from "@n1/dominio/operations";
import type { DeParaDeLancamento } from "@n1/dominio/operations";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { ApprovalRequest, Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { makeFormatters } from "@/features/shell/format";
import {
  PainelConferenciaDoResumo,
  PainelDeDecisaoDaTarefa,
  PilulaDaConferencia,
} from "./painel-conferencia-do-resumo";
import AprovacoesPage from "@/app/(shell)/ia/aprovacoes/page";

const navegacao = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ia/aprovacoes",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => navegacao.params,
}));

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

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

let state: DataState;
let transporte: TransporteFalso;

const conta = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};
/** `tsk_cp_das` (CP-111): "para pagar", completa, Tag "conta tria", Categoria "Impostos". */
const das = () => conta("tsk_cp_das");

/** O que a ponte faz no Momento 1: publica o Resumo e abre a Conferência. */
function publicarResumo(): ApprovalRequest {
  const r = publicarResumoParaConferencia(state, CP.financeiroId, das().id, { dePara: DE_PARA });
  if (!r.ok) throw new Error(r.error);
  return r.value.conferencia;
}

function decidir(approvalId: string, decisao: "aprovada" | "rejeitada", source: "click" | "comment", reason?: string) {
  const r = decideProcessApproval(state, CP.financeiroId, approvalId, decisao, { source, ...(reason ? { reason } : {}) });
  if (!r.ok) throw new Error(r.error);
}

function mudarValor(task: Task, valor: number) {
  const fv = task.fieldValues.find((f) => f.definitionId === CP.fields.valor && f.state === "ativo");
  if (!fv) throw new Error("sem Valor");
  (fv as { value: unknown }).value = valor;
}

function comStore(memberId: string, filho: ReactNode) {
  return render(
    <StoreProvider
      sessao={{ memberId }}
      estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }}
      transporte={transporte}
    >
      {filho}
    </StoreProvider>,
  );
}

const fmt = () => makeFormatters(state.workspace.locale);
const card = (memberId: string, task: Task = das()) =>
  comStore(memberId, <PainelConferenciaDoResumo task={task} fmt={fmt()} report={() => {}} />);

beforeEach(() => {
  state = buildSeed();
  transporte = transporteFalso();
  navegacao.params = new URLSearchParams();
});

afterEach(() => {
  cleanup();
});

describe("(a) Conferência pendente, quem confere", () => {
  it("mostra tripla, valor, fornecedor, o link do Resumo e os dois botões", () => {
    const conferencia = publicarResumo();
    const origin = conferencia.origin as Extract<ApprovalRequest["origin"], { processStep: "resumo" }>;
    card(CP.financeiroId);

    expect(screen.getByText("Conferência do Resumo · Pendente")).toBeTruthy();
    expect(screen.getByText("TRIA · Impostos e taxas · 2.06.01")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Ver o Resumo no tópico" });
    expect(link.getAttribute("href")).toBe(`#comentario-${origin.resumoCommentId}`);
    expect(screen.getByRole("button", { name: "Conferido, pode lançar" }).getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByRole("button", { name: "Pedir ajuste" }).getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByText("Valor")).toBeTruthy();
    expect(screen.getByText("Fornecedor")).toBeTruthy();
  });

  it("um Proprietário que alcança a conta também confere", () => {
    publicarResumo();
    card("mem_thiago");
    expect(screen.getByRole("button", { name: "Conferido, pode lançar" })).toBeTruthy();
  });

  it("\"Conferido, pode lançar\" grava decideProcessApproval aprovada, por clique", () => {
    const conferencia = publicarResumo();
    card(CP.financeiroId);

    fireEvent.click(screen.getByRole("button", { name: "Conferido, pode lançar" }));
    const dialogo = screen.getByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Conferido, pode lançar" }));

    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    const chamada = transporte.gravarMock.mock.calls[0]![0].chamadas[0]!;
    expect(chamada.nome).toBe("decideProcessApproval");
    expect(chamada.args).toEqual([conferencia.id, "aprovada", { source: "click" }]);
  });

  it("\"Pedir ajuste\" exige o motivo e grava a rejeição com ele, por clique", () => {
    const conferencia = publicarResumo();
    card(CP.financeiroId);

    fireEvent.click(screen.getByRole("button", { name: "Pedir ajuste" }));
    const dialogo = screen.getByRole("alertdialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Pedir ajuste" });
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(confirmar);
    expect(transporte.gravarMock).not.toHaveBeenCalled();

    fireEvent.change(within(dialogo).getByLabelText(/O que ajustar/), { target: { value: "é prestação comercial, não ADM" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Pedir ajuste" }));

    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    const chamada = transporte.gravarMock.mock.calls[0]![0].chamadas[0]!;
    expect(chamada.nome).toBe("decideProcessApproval");
    expect(chamada.args).toEqual([conferencia.id, "rejeitada", { source: "click", reason: "é prestação comercial, não ADM" }]);
  });
});

describe("(b) quem não confere não vê os botões", () => {
  it("Membro que alcança a conta mas não é revisor nem aprovador", () => {
    publicarResumo();
    card("mem_marcos_paulo");
    expect(screen.getByText("Somente Maryane Generozo ou um Administrador confere este Resumo.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conferido, pode lançar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pedir ajuste" })).toBeNull();
  });

  it("Administrador revisor que NÃO alcança a conta (a resposta no fio seria recusada)", () => {
    publicarResumo();
    card("mem_rafael");
    expect(screen.queryByRole("button", { name: "Conferido, pode lançar" })).toBeNull();
    expect(screen.getByText("Somente Maryane Generozo ou um Administrador confere este Resumo.")).toBeTruthy();
  });
});

describe("(c) os outros estados", () => {
  it("conferida por clique", () => {
    const c = publicarResumo();
    decidir(c.id, "aprovada", "click");
    card(CP.financeiroId);
    expect(screen.getByText("Conferência do Resumo · Conferido")).toBeTruthy();
    expect(screen.getByText(/^Conferido por Maryane Generozo em .+ · por clique$/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conferido, pode lançar" })).toBeNull();
  });

  it("conferida por comentário", () => {
    const c = publicarResumo();
    decidir(c.id, "aprovada", "comment");
    card(CP.financeiroId);
    expect(screen.getByText(/· por comentário$/)).toBeTruthy();
  });

  it("ajuste pedido", () => {
    const c = publicarResumo();
    decidir(c.id, "rejeitada", "click", "é prestação comercial, não ADM");
    card(CP.financeiroId);
    expect(
      screen.getByText("Ajuste pedido por Maryane Generozo: é prestação comercial, não ADM — o Agente vai republicar o Resumo"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pedir ajuste" })).toBeNull();
  });

  it("desatualizada: a conta mudou depois da conferência", () => {
    const c = publicarResumo();
    decidir(c.id, "aprovada", "click");
    mudarValor(das(), 12345);
    card(CP.financeiroId);
    expect(screen.getByText("Os dados mudaram depois da conferência; um Resumo novo será publicado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conferido, pode lançar" })).toBeNull();
  });

  it("sem Resumo numa conta completa em \"para pagar\"", () => {
    card(CP.financeiroId, conta("tsk_cp_comissao"));
    expect(screen.getByText("Aguardando o Resumo do Agente.")).toBeTruthy();
  });

  it("sem card: Integração manual, conta incompleta, conta já lançada sem Resumo", () => {
    for (const id of ["tsk_cp_condominio", "tsk_cp_ferramenta", "tsk_cp_negada"]) {
      const { container } = card(CP.financeiroId, conta(id));
      expect(container.textContent, id).toBe("");
      cleanup();
    }
  });
});

describe("(d) um ponto de decisão por Tarefa", () => {
  it("conta a pagar: o card da Conferência, nunca o de Aprovação", () => {
    publicarResumo();
    comStore(CP.financeiroId, <PainelDeDecisaoDaTarefa task={das()} fmt={fmt()} report={() => {}} />);
    expect(screen.getByText("Conferência do Resumo · Pendente")).toBeTruthy();
    expect(screen.queryByText("Aprovação pendente")).toBeNull();
    expect(screen.queryByRole("button", { name: "Aprovar solicitação" })).toBeNull();
  });

  it("outra Tarefa com Aprovação de processo: o PainelAprovacao de sempre", () => {
    const outra = state.tasks.find((t) => t.listId !== CP.listId);
    if (!outra) throw new Error("seed sem Tarefa fora de Contas a pagar");
    state.approvals.push({
      id: "apr_teste_sp",
      origin: { kind: "processTask", taskId: outra.id, processStep: "pagamento", threadCommentId: "cmt_x" },
      requestedBy: { kind: "system", id: "sistema" },
      reason: "processo",
      object: { toolId: "", input: "", targetResourceType: "task", targetResourceId: outra.id, effectClass: "escritaIrreversivel" },
      approverMemberId: "mem_thiago",
      createdAt: outra.createdAt,
    });
    comStore("mem_thiago", <PainelDeDecisaoDaTarefa task={outra} fmt={fmt()} report={() => {}} />);
    expect(screen.getByText("Aprovação pendente")).toBeTruthy();
    expect(screen.queryByText(/Conferência do Resumo/)).toBeNull();
  });
});

describe("(e) a fila /ia/aprovacoes", () => {
  it("lista a Conferência pendente com o título e os campos da conta", () => {
    publicarResumo();
    comStore(CP.financeiroId, <AprovacoesPage />);
    expect(screen.getByText("Conferir Resumo de pagamento — CP-111")).toBeTruthy();
    expect(screen.getByText("Lançamento: TRIA · Impostos e taxas · 2.06.01")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conferir" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pedir ajuste" })).toBeTruthy();
  });

  it("decide pelo mesmo controlador: decideProcessApproval por clique", () => {
    const conferencia = publicarResumo();
    navegacao.params = new URLSearchParams({ aprovar: `${conferencia.id}:aprovada` });
    comStore(CP.financeiroId, <AprovacoesPage />);

    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText("Conferir o Resumo de CP-111?")).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Conferido, pode lançar" }));

    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    const chamada = transporte.gravarMock.mock.calls[0]![0].chamadas[0]!;
    expect(chamada.nome).toBe("decideProcessApproval");
    expect(chamada.args).toEqual([conferencia.id, "aprovada", { source: "click" }]);
  });

  it("\"Pedir ajuste\" na fila abre o diálogo do motivo, não o de rejeitar Solicitação", () => {
    const conferencia = publicarResumo();
    navegacao.params = new URLSearchParams({ aprovar: `${conferencia.id}:rejeitada` });
    comStore(CP.financeiroId, <AprovacoesPage />);
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText("Pedir ajuste no Resumo de CP-111?")).toBeTruthy();
    expect(within(dialogo).queryByText(/Rejeitar solicitação/)).toBeNull();
  });

  it("quem não alcança a conta não vê a Conferência na fila", () => {
    publicarResumo();
    comStore("mem_rafael", <AprovacoesPage />);
    expect(screen.queryByText("Conferir Resumo de pagamento — CP-111")).toBeNull();
  });

  it("uma Aprovação de Solicitação continua como hoje", () => {
    publicarResumo();
    const outra = state.tasks.find((t) => t.listId !== CP.listId);
    if (!outra) throw new Error("seed sem Tarefa fora de Contas a pagar");
    state.approvals.push({
      id: "apr_teste_sp",
      origin: { kind: "processTask", taskId: outra.id, processStep: "pagamento", threadCommentId: "cmt_x" },
      requestedBy: { kind: "system", id: "sistema" },
      reason: "processo",
      object: { toolId: "", input: "", targetResourceType: "task", targetResourceId: outra.id, effectClass: "escritaIrreversivel" },
      approverMemberId: CP.financeiroId,
      createdAt: outra.createdAt,
    });
    comStore(CP.financeiroId, <AprovacoesPage />);
    expect(screen.getByText("Solicitação de pagamento")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aprovar solicitação" })).toBeTruthy();
    expect(screen.getByText("Conferir Resumo de pagamento — CP-111")).toBeTruthy();
  });
});

describe("(f) a pílula ao lado do Status", () => {
  const pilula = (task: Task) => comStore(CP.financeiroId, <PilulaDaConferencia task={task} />);

  it("um texto por estado", () => {
    pilula(conta("tsk_cp_comissao"));
    expect(screen.getByText("Aguardando Resumo")).toBeTruthy();
    cleanup();

    const c = publicarResumo();
    pilula(das());
    expect(screen.getByText("Resumo para conferir")).toBeTruthy();
    cleanup();

    decidir(c.id, "aprovada", "click");
    pilula(das());
    expect(screen.getByText("Resumo conferido")).toBeTruthy();
    cleanup();

    mudarValor(das(), 12345);
    pilula(das());
    expect(screen.getByText("Resumo desatualizado")).toBeTruthy();
  });

  it("\"Ajuste pedido\"", () => {
    const c = publicarResumo();
    decidir(c.id, "rejeitada", "click", "outro centro de custo");
    pilula(das());
    expect(screen.getByText("Ajuste pedido")).toBeTruthy();
  });

  it("ausente para Integração manual e para conta em \"lançado omie\" ou depois", () => {
    const c = publicarResumo();
    decidir(c.id, "aprovada", "click");
    das().statusId = CP.status.lancado;
    for (const task of [das(), conta("tsk_cp_condominio"), conta("tsk_cp_negada"), conta("tsk_cp_thiago_ago")]) {
      const { container } = pilula(task);
      expect(container.textContent, task.id).toBe("");
      cleanup();
    }
  });
});
