// @vitest-environment jsdom
/**
 * Prova de que o gesto de lote (`BulkStatusBar`) é UMA chamada de
 * `alterarStatusEmLote`, nunca mais um laço de `changeTaskStatus` — casos
 * `(a)`…`(f)` — e de que o relato de falha parcial (`RelatorioDeLotePainel`)
 * lê os quatro resultados sem nunca "melhorar" um título com o estado local —
 * casos `(g)`…`(k)`, Plan 03-13. Mesmo molde de isolamento de rede que
 * `painel-aprovacao.test.tsx` já usa: `StoreProvider` de verdade sobre um
 * `Transporte` falso, nenhum `fetch`, nenhum `apps/api` no ar.
 */

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { alterarStatusEmLote, CP } from "@n1/dominio/operations";
import { effectiveListConfig } from "@n1/dominio/derive";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Id, StatusDefinition, Task } from "@n1/dominio/types";
import { StoreProvider, useRun } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { BulkStatusBar } from "./bulk-status-bar";
import { RelatorioDeLotePainel } from "./relatorio-de-lote";
import type { RelatorioDeLote } from "@n1/dominio/operations/lote";

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
 * Clona `tsk_cp_das` (uma conta COMPLETA de verdade do seed: Centro de Custo,
 * Valor, vencimento, Forma "Boleto" com o dado de pagamento coerente) — nunca
 * dado do export real, só fixture já presente no seed do próprio pacote.
 */
function gerarContas(state: DataState, quantidade: number, statusId: Id = CP.status.paraPagar): Task[] {
  const template = state.tasks.find((t) => t.id === "tsk_cp_das");
  if (!template) throw new Error("seed sem tsk_cp_das para clonar.");
  const geradas: Task[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    const clone: Task = {
      ...structuredClone(template),
      id: `tsk_lote_teste_${i}`,
      readableId: `CP-LOTE-${i}`,
      statusId,
      title: `Conta de teste ${i}`,
    };
    geradas.push(clone);
    state.tasks.push(clone);
  }
  return geradas;
}

/** A definição do Status de destino, pelo nome — o `Select` lista por `name`. */
function definicoesDaLista(state: DataState): readonly StatusDefinition[] {
  const config = effectiveListConfig(state, CP.listId);
  if (!config) throw new Error("Lista de Contas a pagar sem configuração efetiva.");
  return config.statusSet.definitions;
}

/** Harness: quem gerencia `selected`/`onSelect` é sempre o chamador (a página, aqui um `useState`). */
function Harness({
  tasks,
  definitions,
  inicial,
  onRelatorio,
  report,
}: {
  readonly tasks: readonly Task[];
  readonly definitions: readonly StatusDefinition[];
  readonly inicial: ReadonlySet<string>;
  readonly onRelatorio: (relatorio: RelatorioDeLote) => void;
  readonly report: (result: { ok: boolean; error?: string }, message: string) => void;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(inicial);
  return (
    <BulkStatusBar
      tasks={tasks}
      definitions={definitions}
      selected={selected}
      onSelect={setSelected}
      onClear={() => setSelected(new Set())}
      onRelatorio={onRelatorio}
      report={report}
    />
  );
}

function renderizarBarra(
  state: DataState,
  ordens: Ordens,
  transporte: Transporte,
  memberId: string,
  tasks: readonly Task[],
  definitions: readonly StatusDefinition[],
  inicial: ReadonlySet<string>,
  onRelatorio: (relatorio: RelatorioDeLote) => void = () => {},
  report: (result: { ok: boolean; error?: string }, message: string) => void = () => {},
) {
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
      <Harness tasks={tasks} definitions={definitions} inicial={inicial} onRelatorio={onRelatorio} report={report} />
    </StoreProvider>,
  );
}

/** Abre o `Select` de destino e escolhe a opção pelo rótulo (nome do Status). */
function escolherDestino(nome: string) {
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: nome }));
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

describe("BulkStatusBar — um gesto, uma chamada (a)", () => {
  it("gravarMock é chamado exatamente 1 vez para um lote de 61, com uma ChamadaDeOperacao só", () => {
    const tasks = gerarContas(state, 61, CP.status.paraPagar);
    const definitions = definicoesDaLista(state);
    const ids = tasks.map((t) => t.id);

    renderizarBarra(state, ordens, transporte, CP.financeiroId, tasks, definitions, new Set(ids));

    escolherDestino("em autorização bancária");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    const dialogo = screen.getByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Mover todas" }));

    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    const pedido = transporte.gravarMock.mock.calls[0]![0];
    expect(pedido.chamadas.length).toBe(1);
    expect(pedido.chamadas[0]!.nome).toBe("alterarStatusEmLote");
  });
});

describe("BulkStatusBar — os argumentos certos (b)", () => {
  it("args são [idsSelecionados, statusIdAlvo], na ordem de entrada, sem actingMemberId", () => {
    const tasks = gerarContas(state, 3, CP.status.paraPagar);
    const definitions = definicoesDaLista(state);
    const ids = tasks.map((t) => t.id);

    renderizarBarra(state, ordens, transporte, CP.financeiroId, tasks, definitions, new Set(ids));

    escolherDestino("em autorização bancária");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    const dialogo = screen.getByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Mover todas" }));

    const pedido = transporte.gravarMock.mock.calls[0]![0];
    expect(pedido.chamadas[0]!.args).toEqual([ids, CP.status.emAutorizacao]);
  });
});

describe("BulkStatusBar — recusa do gesto não vai à rede (c)", () => {
  it("acima de LIMITE_DO_LOTE, Aplicar fica desabilitado e nada é gravado", () => {
    const tasks = gerarContas(state, 201, CP.status.paraPagar);
    const definitions = definicoesDaLista(state);
    const ids = tasks.map((t) => t.id);

    renderizarBarra(state, ordens, transporte, CP.financeiroId, tasks, definitions, new Set(ids));

    escolherDestino("em autorização bancária");
    const aplicar = screen.getByRole("button", { name: "Aplicar" });
    expect(aplicar.getAttribute("aria-disabled")).toBe("true");
    expect(aplicar.getAttribute("title") ?? "").toContain("200");

    // Forçar o clique assim mesmo: o botão engole o clique quando inativo
    // (design/components.tsx::Button) — nada deve ir à rede.
    fireEvent.click(aplicar);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(transporte.gravarMock).not.toHaveBeenCalled();
  });
});

describe("BulkStatusBar — prévia honesta antes do clique (d)", () => {
  it("Financeiro + “pago”: todas recusariam, frase literal de RN-CP-04, Aplicar desabilitado", () => {
    const tasks = gerarContas(state, 5, CP.status.paraPagar);
    const definitions = definicoesDaLista(state);
    const ids = tasks.map((t) => t.id);

    renderizarBarra(state, ordens, transporte, CP.financeiroId, tasks, definitions, new Set(ids));

    escolherDestino("pago");

    // Duas ocorrências no DOM: a linha visível da prévia e o texto espelhado
    // (oculto) que `aria-describedby` do botão aponta — as duas carregam a
    // MESMA frase literal de `statusOptionRefusal`.
    expect(screen.getAllByText(/Só .*move para/).length).toBeGreaterThan(0);
    const aplicar = screen.getByRole("button", { name: "Aplicar" });
    expect(aplicar.getAttribute("aria-disabled")).toBe("true");
  });

  it("Aprovador + “pago”: sem recusa prevista, Aplicar habilitado", () => {
    const tasks = gerarContas(state, 5, CP.status.paraPagar);
    const definitions = definicoesDaLista(state);
    const ids = tasks.map((t) => t.id);

    renderizarBarra(state, ordens, transporte, CP.aprovadorId, tasks, definitions, new Set(ids));

    escolherDestino("pago");

    const aplicar = screen.getByRole("button", { name: "Aplicar" });
    expect(aplicar.getAttribute("aria-disabled")).toBe("false");
  });
});

describe("BulkStatusBar — recusa parcial na prévia não bloqueia (e)", () => {
  it("1 de N sem Forma de pagamento: prévia informa a recusa e Aplicar continua habilitado", () => {
    const completas = gerarContas(state, 4, CP.status.paraPagar);
    // `tsk_cp_ferramenta` é a conta incompleta do próprio seed — nasce em
    // "para pagar" sem Forma de pagamento, e por isso RN-CP-02 a recusa na
    // saída (`dadoDePagamento`, `seed-financeiro.ts`).
    const incompleta = state.tasks.find((t) => t.id === "tsk_cp_ferramenta");
    if (!incompleta) throw new Error("seed sem tsk_cp_ferramenta.");
    const tasks = [...completas, incompleta];
    const definitions = definicoesDaLista(state);
    const ids = tasks.map((t) => t.id);

    renderizarBarra(state, ordens, transporte, CP.financeiroId, tasks, definitions, new Set(ids));

    escolherDestino("em autorização bancária");

    expect(screen.getByText(/1 de 5 seria/)).toBeTruthy();
    const aplicar = screen.getByRole("button", { name: "Aplicar" });
    expect(aplicar.getAttribute("aria-disabled")).toBe("false");
  });
});

describe("BulkStatusBar — changeTaskStatus sumiu do caminho de lote (f)", () => {
  it("nenhuma chamada de changeTaskStatus é registrada por um gesto de lote", () => {
    const tasks = gerarContas(state, 3, CP.status.paraPagar);
    const definitions = definicoesDaLista(state);
    const ids = tasks.map((t) => t.id);

    renderizarBarra(state, ordens, transporte, CP.financeiroId, tasks, definitions, new Set(ids));

    escolherDestino("em autorização bancária");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    const dialogo = screen.getByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Mover todas" }));

    const pedido = transporte.gravarMock.mock.calls[0]![0];
    expect(pedido.chamadas.some((c) => c.nome === "changeTaskStatus")).toBe(false);
  });
});

/* ── RelatorioDeLotePainel — Tasks (g)…(k) ──────────────────────────────── */

function relatorioBase(overrides: Partial<RelatorioDeLote> = {}): RelatorioDeLote {
  return {
    statusId: CP.status.emAutorizacao,
    solicitadas: 0,
    alteradas: 0,
    jaEstavam: 0,
    recusadas: 0,
    parciais: 0,
    ocorrenciasCriadas: 0,
    itens: [],
    ...overrides,
  };
}

/** `RelatorioDeLotePainel` lê `useLastResult()` (T-3-61, caso `k`) — precisa de um `StoreProvider`, mesmo nos casos que não disparam `run()`. */
function renderizarPainel(props: {
  readonly relatorio: RelatorioDeLote;
  readonly nomeDoStatus: string;
  readonly onFechar?: () => void;
  readonly onAbrirConta?: (taskId: string) => void;
}) {
  return render(
    <StoreProvider sessao={{ memberId: CP.financeiroId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
      <RelatorioDeLotePainel
        relatorio={props.relatorio}
        nomeDoStatus={props.nomeDoStatus}
        onFechar={props.onFechar ?? (() => {})}
        {...(props.onAbrirConta ? { onAbrirConta: props.onAbrirConta } : {})}
      />
    </StoreProvider>,
  );
}

describe("RelatorioDeLotePainel — os quatro números aparecem (g)", () => {
  it("37 alteradas, 4 já estavam, 20 recusadas, ocorrenciasCriadas, e 20 linhas de recusa com motivo", () => {
    const itensRecusados = Array.from({ length: 20 }, (_, i) => ({
      taskId: `tsk_recusada_${i}`,
      resultado: "recusada" as const,
      readableId: `CP-${i}`,
      titulo: `Conta recusada ${i}`,
      motivo: `Motivo da recusa ${i}.`,
    }));
    const relatorio = relatorioBase({
      solicitadas: 61,
      alteradas: 37,
      jaEstavam: 4,
      recusadas: 20,
      parciais: 0,
      ocorrenciasCriadas: 37,
      itens: itensRecusados,
    });

    renderizarPainel({ relatorio, nomeDoStatus: "em autorização bancária" });

    expect(screen.getAllByText(/37/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20/).length).toBeGreaterThan(0);
    expect(screen.getByText(/37 ocorrência/)).toBeTruthy();
    for (const item of itensRecusados) {
      expect(screen.getByText(item.motivo)).toBeTruthy();
    }
  });
});

describe("RelatorioDeLotePainel — parcial não é confundido (h)", () => {
  it("bloco próprio com as duas metades, sem botão de repetir", () => {
    const motivo = "Concluída, mas a próxima ocorrência não foi criada: Data de vencimento inválida.";
    const relatorio = relatorioBase({
      solicitadas: 1,
      alteradas: 0,
      jaEstavam: 0,
      recusadas: 0,
      parciais: 1,
      ocorrenciasCriadas: 0,
      itens: [{ taskId: "tsk_parcial_1", resultado: "parcial", readableId: "CP-900", titulo: "Conta parcial", motivo }],
    });

    renderizarPainel({ relatorio, nomeDoStatus: "pago" });

    expect(screen.getByText(/mudou de Status/i)).toBeTruthy();
    expect(screen.getAllByText(/ocorrência.*não foi criada/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /repetir/i })).toBeNull();
  });
});

describe("RelatorioDeLotePainel — T-3-55, nenhum título vem do estado local (i)", () => {
  it("sem titulo/readableId: fallback aparece, o título real da Tarefa nunca aparece", () => {
    // A Tarefa real EXISTE no estado, com um título real — a prova é que ele
    // não aparece na tela mesmo estando disponível para quem "melhorasse" o
    // rótulo lendo o estado local (o que este painel, por desenho, não pode
    // fazer: suas props não contêm Tarefa nenhuma).
    const tituloReal = state.tasks.find((t) => t.id === "tsk_cp_das")!.title;
    const relatorio = relatorioBase({
      solicitadas: 1,
      recusadas: 1,
      itens: [{ taskId: "tsk_cp_das", resultado: "recusada", motivo: "Você não tem acesso a esta Tarefa." }],
    });

    renderizarPainel({ relatorio, nomeDoStatus: "pago" });

    expect(screen.queryByText(tituloReal)).toBeNull();
    expect(screen.getByText("Conta sem acesso")).toBeTruthy();
  });
});

describe("RelatorioDeLotePainel — sobrevive ao fim da seleção (j)", () => {
  it("depois da BulkStatusBar desmontar (seleção limpa), o painel de relatório continua na tela", () => {
    const relatorio = relatorioBase({ solicitadas: 3, alteradas: 3, ocorrenciasCriadas: 0 });
    const tasks = gerarContas(state, 3, CP.status.paraPagar);
    const definitions = definicoesDaLista(state);
    const ids = tasks.map((t) => t.id);

    function Pagina() {
      const [selecao, setSelecao] = useState<ReadonlySet<string>>(new Set(ids));
      return (
        <>
          {selecao.size > 0 ? (
            <BulkStatusBar
              tasks={tasks}
              definitions={definitions}
              selected={selecao}
              onSelect={setSelecao}
              onClear={() => setSelecao(new Set())}
              onRelatorio={() => {}}
              report={() => {}}
            />
          ) : null}
          <RelatorioDeLotePainel relatorio={relatorio} nomeDoStatus="em autorização bancária" onFechar={() => {}} />
        </>
      );
    }

    render(
      <StoreProvider sessao={{ memberId: CP.financeiroId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
        <Pagina />
      </StoreProvider>,
    );

    expect(screen.getByRole("button", { name: "Aplicar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));

    expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull();
    expect(screen.getByText(/3 alterada/)).toBeTruthy();
  });
});

describe("RelatorioDeLotePainel — o servidor tem a última palavra (k)", () => {
  it("um lastResult ok:false mais recente que o relatório aparece acima das contagens", async () => {
    const relatorio = relatorioBase({ solicitadas: 1, alteradas: 1 });

    function Pagina() {
      const run = useRun();
      return (
        <>
          <button
            type="button"
            onClick={() => run((data, me) => alterarStatusEmLote(data, me, [], CP.status.pago))}
          >
            disparar recusa
          </button>
          <RelatorioDeLotePainel relatorio={relatorio} nomeDoStatus="em autorização bancária" onFechar={() => {}} />
        </>
      );
    }

    render(
      <StoreProvider sessao={{ memberId: CP.financeiroId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporte}>
        <Pagina />
      </StoreProvider>,
    );

    // Garante que o instante capturado pelo painel na montagem é anterior ao
    // da recusa disparada a seguir — os dois usam `Date.now()`.
    await new Promise((resolver) => setTimeout(resolver, 2));
    // Lista de ids vazia: `alterarStatusEmLote` recusa ANTES de qualquer
    // rede (D-05) — a mesma via que uma recusa vinda do servidor usaria
    // (`lastResult` é o ponto de encontro dos dois casos, D-06).
    fireEvent.click(screen.getByRole("button", { name: "disparar recusa" }));

    expect(screen.getByText(/calculado localmente/)).toBeTruthy();
    expect(screen.getByText(/1 alterada/)).toBeTruthy();
  });
});
