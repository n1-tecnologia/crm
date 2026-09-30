// @vitest-environment jsdom
/**
 * 06-14 Task 2 — o card da Conferência e a fila sem ambiguidade.
 *
 * - crm:WR-05: quem confere lê no card que o "ok" no fio do Resumo também
 *   confere, e que qualquer outra resposta no fio pede ajuste.
 * - crm:WR-03 (tela): um Resumo sem código de Categoria (`veredito:
 *   "ausente"`) não oferece "Conferido, pode lançar" no card nem "Conferir" na
 *   fila — o domínio recusa essa aprovação desde o 06-11; a tela deixa de
 *   oferecê-la e diz o que fazer: pedir ajuste com o código.
 *
 * Harness copiado de `painel-conferencia-do-resumo.test.tsx` (sem editá-lo):
 * `buildSeed()` + `publicarResumoParaConferencia` (a ponte) + Transporte falso.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { buildSeed } from "@n1/dominio/seed";
import { CP, decideProcessApproval, publicarResumoParaConferencia } from "@n1/dominio/operations";
import type { ConferenciaDoResumo, DeParaDeLancamento } from "@n1/dominio/operations";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { makeFormatters } from "@/features/shell/format";
import { PainelConferenciaDoResumo } from "./painel-conferencia-do-resumo";
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

/** A Categoria da conta ("Impostos") não está no de-para: o Resumo sai com `veredito: "ausente"`. */
const DE_PARA_SEM_CATEGORIA: DeParaDeLancamento = { contaPorTag: { "conta tria": "TRIA" }, categoriaPorCampo: {}, origem: "omie" };

const DE_PARA_REVISAR: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: {
    Impostos: { veredito: "revisar", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.62, motivo: "semelhança de nome" },
  },
  origem: "omie",
};

const PARAGRAFO_DO_FIO = 'Confira pelo botão ou responda "ok" no fio do Resumo; qualquer outra resposta no fio pede ajuste.';
const SEM_CODIGO_NO_CARD =
  'Peça ajuste com o código da Categoria — pelo botão ou respondendo no fio do Resumo com o código (ex.: "use 2.04.03").';
const SEM_CODIGO_NA_FILA = "Peça ajuste com o código da Categoria.";

let state: DataState;
let transporte: TransporteFalso;

const das = (): Task => {
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  return t;
};

function publicarResumo(dePara: DeParaDeLancamento = DE_PARA): ConferenciaDoResumo {
  const r = publicarResumoParaConferencia(state, CP.financeiroId, das().id, { dePara });
  if (!r.ok) throw new Error(r.error);
  return r.value.conferencia;
}

/** O Resumo sem código — e a prova de que o domínio ainda o monta assim (falha alto se mudar). */
function publicarResumoSemCodigo(): ConferenciaDoResumo {
  const conferencia = publicarResumo(DE_PARA_SEM_CATEGORIA);
  expect(conferencia.origin.lancamento.veredito).toBe("ausente");
  return conferencia;
}

function decidir(approvalId: string, decisao: "aprovada" | "rejeitada", reason?: string) {
  const r = decideProcessApproval(state, CP.financeiroId, approvalId, decisao, { source: "click", ...(reason ? { reason } : {}) });
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

const card = (memberId: string) =>
  comStore(memberId, <PainelConferenciaDoResumo task={das()} fmt={makeFormatters(state.workspace.locale)} report={() => {}} />);

beforeEach(() => {
  state = buildSeed();
  transporte = transporteFalso();
  navegacao.params = new URLSearchParams();
});

afterEach(() => {
  cleanup();
});

describe("(a) pendente, quem confere, com código: os dois botões e o parágrafo do fio", () => {
  it("o parágrafo exato aparece junto dos dois botões", () => {
    publicarResumo();
    card(CP.financeiroId);
    expect(screen.getByRole("button", { name: "Conferido, pode lançar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pedir ajuste" })).toBeTruthy();
    expect(screen.getByText(PARAGRAFO_DO_FIO)).toBeTruthy();
    expect(screen.queryByText(SEM_CODIGO_NO_CARD)).toBeNull();
  });
});

describe("(b) pendente, quem NÃO confere: sem o parágrafo", () => {
  it("continua \"Somente … confere este Resumo.\"", () => {
    publicarResumo();
    card("mem_marcos_paulo");
    expect(screen.getByText("Somente Maryane Generozo ou um Administrador confere este Resumo.")).toBeTruthy();
    expect(screen.queryByText(PARAGRAFO_DO_FIO)).toBeNull();
  });
});

describe("(c) conferida, ajuste pedido e desatualizada: sem o parágrafo", () => {
  it("conferida", () => {
    const c = publicarResumo();
    decidir(c.id, "aprovada");
    card(CP.financeiroId);
    expect(screen.getByText("Conferência do Resumo · Conferido")).toBeTruthy();
    expect(screen.queryByText(PARAGRAFO_DO_FIO)).toBeNull();
  });

  it("ajuste pedido", () => {
    const c = publicarResumo();
    decidir(c.id, "rejeitada", "é prestação comercial, não ADM");
    card(CP.financeiroId);
    expect(screen.getByText("Conferência do Resumo · Ajuste pedido")).toBeTruthy();
    expect(screen.queryByText(PARAGRAFO_DO_FIO)).toBeNull();
  });

  it("desatualizada", () => {
    publicarResumo();
    mudarValor(das(), 12345);
    card(CP.financeiroId);
    expect(screen.getByText("Conferência do Resumo · Desatualizado")).toBeTruthy();
    expect(screen.queryByText(PARAGRAFO_DO_FIO)).toBeNull();
  });
});

describe("(d) sem código de Categoria: nada de \"Conferido\" no card", () => {
  it("só \"Pedir ajuste\", com o texto exato, e sem o parágrafo do \"ok\"", () => {
    publicarResumoSemCodigo();
    card(CP.financeiroId);
    expect(screen.getByText("Conferência do Resumo · Pendente")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conferido, pode lançar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Pedir ajuste" })).toBeTruthy();
    expect(screen.getByText(SEM_CODIGO_NO_CARD)).toBeTruthy();
    expect(screen.queryByText(PARAGRAFO_DO_FIO)).toBeNull();
  });

  it("\"Pedir ajuste\" continua gravando a rejeição, por clique, com o motivo", () => {
    const conferencia = publicarResumoSemCodigo();
    card(CP.financeiroId);
    fireEvent.click(screen.getByRole("button", { name: "Pedir ajuste" }));
    const dialogo = screen.getByRole("alertdialog");
    fireEvent.change(within(dialogo).getByLabelText(/O que ajustar/), { target: { value: "use 2.06.01" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Pedir ajuste" }));

    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    const chamada = transporte.gravarMock.mock.calls[0]![0].chamadas[0]!;
    expect(chamada.nome).toBe("decideProcessApproval");
    expect(chamada.args).toEqual([conferencia.id, "rejeitada", { source: "click", reason: "use 2.06.01" }]);
  });
});

describe("(e) a fila /ia/aprovacoes", () => {
  it("Conferência sem código, vigente e pendente: sem \"Conferir\", com \"Pedir ajuste\" e o texto", () => {
    publicarResumoSemCodigo();
    comStore(CP.financeiroId, <AprovacoesPage />);
    expect(screen.getByText("Conferir Resumo de pagamento — CP-111")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conferir" })).toBeNull();
    expect(screen.getByRole("button", { name: "Pedir ajuste" })).toBeTruthy();
    expect(screen.getByText(SEM_CODIGO_NA_FILA)).toBeTruthy();
  });

  it("Conferência resolvida continua com \"Conferir\"", () => {
    publicarResumo();
    comStore(CP.financeiroId, <AprovacoesPage />);
    expect(screen.getByRole("button", { name: "Conferir" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pedir ajuste" })).toBeTruthy();
    expect(screen.queryByText(SEM_CODIGO_NA_FILA)).toBeNull();
  });
});

describe("(f) veredito \"revisar\": os dois botões, como hoje", () => {
  it("\"Conferido, pode lançar\" e o aviso de semelhança continuam", () => {
    const conferencia = publicarResumo(DE_PARA_REVISAR);
    expect(conferencia.origin.lancamento.veredito).toBe("revisar");
    card(CP.financeiroId);
    expect(screen.getByRole("button", { name: "Conferido, pode lançar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pedir ajuste" })).toBeTruthy();
    expect(screen.getByText("A categoria foi escolhida por semelhança de nome: confira o código antes de conferir.")).toBeTruthy();
    expect(screen.getByText(PARAGRAFO_DO_FIO)).toBeTruthy();
    expect(screen.queryByText(SEM_CODIGO_NO_CARD)).toBeNull();
  });
});

describe("(g) nem pelo link da fila: sem código, o diálogo de conferir não abre", () => {
  it("?aprovar=<id>:aprovada numa Conferência sem código não mostra \"Conferir o Resumo de …?\"", () => {
    const conferencia = publicarResumoSemCodigo();
    navegacao.params = new URLSearchParams({ aprovar: `${conferencia.id}:aprovada` });
    comStore(CP.financeiroId, <AprovacoesPage />);
    expect(screen.queryByText("Conferir o Resumo de CP-111?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Conferido, pode lançar" })).toBeNull();
  });
});
