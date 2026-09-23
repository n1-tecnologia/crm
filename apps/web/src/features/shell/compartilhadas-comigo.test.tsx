// @vitest-environment jsdom
/**
 * 03-15 Task 1 — prova de que "Compartilhadas comigo" pergunta
 * `memberSeesTask`, não `state.grants` (T-3-77), e prova o caso NEGATIVO na
 * tela, nos dois sentidos: a Pessoa A não encontra a conta da Pessoa B.
 *
 * Molde igual a `features/tarefa/painel-aprovacao.test.tsx`: `buildSeed()`,
 * `ordensDeTodasAsColecoes`, `transporteFalso()`, `StoreProvider` de verdade,
 * zero rede.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Grant } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { MAXIMO_COMPARTILHADAS, TarefasCompartilhadas, tarefasCompartilhadasCom } from "./compartilhadas-comigo";

// `usePathname` é a única dependência de `next/navigation` do componente.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

function transporteFalso(): Transporte {
  return {
    gravar: vi.fn(async (): Promise<RespostaDeGravacao> => ({ tipo: "falha", erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
}

function montar(state: DataState, ordens: Ordens, memberId: string) {
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens }} transporte={transporteFalso()}>
      <TarefasCompartilhadas />
    </StoreProvider>,
  );
}

let state: DataState;
let ordens: Ordens;

beforeEach(() => {
  state = buildSeed();
  ordens = ordensDeTodasAsColecoes(state);
});

afterEach(() => {
  cleanup();
});

describe("tarefasCompartilhadasCom — o seletor puro", () => {
  it("(a) a Pessoa vê a própria conta, sem nenhuma Grant", () => {
    const tarefas = tarefasCompartilhadasCom(state, "mem_thiago_pereira");
    expect(tarefas.some((t) => t.id === "tsk_cp_thiago_out")).toBe(true);
    expect(state.grants.filter((g) => g.resourceId === "tsk_cp_thiago_out").length).toBe(0);
  });

  it("(e) quem alcança a Lista pela árvore não recebe a conta duas vezes", () => {
    const tarefas = tarefasCompartilhadasCom(state, "mem_maryane");
    expect(tarefas.some((t) => t.listId === "lst_contas_a_pagar")).toBe(false);
  });
});

describe("TarefasCompartilhadas — render", () => {
  it("(b) NEGATIVO sentido 1: a sessão do Pedro não vê a conta do Lucas", () => {
    // O título existe no estado — a asserção prova recorte, não coincidência.
    expect(state.tasks.some((t) => t.title === "Plataforma white label — Nimbus")).toBe(true);

    montar(state, ordens, "mem_thiago_pereira");
    expect(screen.queryByText("Plataforma white label — Nimbus")).toBeNull();
  });

  it("(c) NEGATIVO sentido 2: a sessão do Lucas não vê a conta do Pedro", () => {
    const { container } = montar(state, ordens, "mem_joao_konq");
    expect(screen.getByText("Plataforma white label — Nimbus")).toBeTruthy();
    expect(container.querySelector('a[href="/estrutura/tarefas/tsk_cp_thiago_out"]')).toBeNull();
  });

  it("(d) o Administrador não vê Contas a pagar nenhuma; a Convidada sem conta não vê a seção", () => {
    // ACHADO, verificado no seed e não presumido do enunciado do plano: uma
    // Grant PRÉ-EXISTENTE e não relacionada a Contas a pagar
    // (`gr_cr_tsk_cr_dai_1`, Contas a receber) dá a mem_rafael acesso
    // compartilhado a UMA Tarefa que ele não alcança pela árvore — o mesmo
    // mecanismo de (f), sobre um fornecedor completamente diferente. A seção
    // dele, portanto, NÃO é vazia (ao contrário do que o texto do plano
    // presumia): ela existe e mostra exatamente essa Tarefa antiga. O que
    // prova T-3-01/critério 5 é a ausência de QUALQUER conta de
    // `lst_contas_a_pagar` — não a ausência da seção inteira. Ver "Deviations
    // from Plan" no SUMMARY.
    montar(state, ordens, "mem_rafael");
    expect(screen.queryByText("Pedro Alencar Consultoria em Dados")).toBeNull();
    expect(screen.queryByText("Plataforma white label — Nimbus")).toBeNull();
    expect(
      state.tasks
        .filter((t) => t.listId === "lst_contas_a_pagar")
        .every((t) => screen.queryByText(t.title) === null),
    ).toBe(true);
    cleanup();

    const { container: c2 } = montar(state, ordens, "mem_beatriz");
    expect(screen.queryByText("Compartilhadas comigo")).toBeNull();
    expect(c2.firstChild).toBeNull();
  });

  it("(e) quem alcança a Lista pela árvore não vê a seção duplicada na tela", () => {
    montar(state, ordens, "mem_maryane");
    // mem_maryane pode ter outras Tarefas compartilhadas por Grant em outras
    // Listas; o que a asserção prova é que nenhuma conta de Contas a pagar
    // aparece — ela já a alcança pela árvore.
    expect(screen.queryByText("Pedro Alencar Consultoria em Dados")).toBeNull();
    expect(screen.queryByText("Plataforma white label — Nimbus")).toBeNull();
  });

  it("(f) a Grant continua valendo — o mecanismo antigo foi englobado, não trocado", () => {
    const listaQueBeatrizNaoAlcanca = state.lists.find(
      (l) => l.id !== "lst_conteudo" && !state.grants.some((g) => g.subjectId === "mem_beatriz" && g.resourceId === l.id),
    );
    const tarefaAlvo = state.tasks.find((t) => t.listId === listaQueBeatrizNaoAlcanca?.id);
    if (!tarefaAlvo) throw new Error("fixture: nenhuma Tarefa candidata encontrada no seed");

    const grantFicticia: Grant = {
      id: "gr_teste_compartilhada",
      workspaceId: tarefaAlvo.workspaceId,
      subjectKind: "member",
      subjectId: "mem_beatriz",
      action: "ver",
      resourceType: "task",
      resourceId: tarefaAlvo.id,
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: "mem_thiago",
      grantedAt: new Date(0).toISOString(),
    };
    state.grants.push(grantFicticia);

    montar(state, ordens, "mem_beatriz");
    expect(screen.getByText("Compartilhadas comigo")).toBeTruthy();
    expect(screen.getByText(tarefaAlvo.title)).toBeTruthy();
  });

  it("(g) conta fechada sai da seção — o título do Pedro aparece exatamente uma vez", () => {
    // tsk_cp_thiago_ago e tsk_cp_thiago_set estão em "pago" (categoria terminal).
    montar(state, ordens, "mem_thiago_pereira");
    expect(screen.getAllByText("Pedro Alencar Consultoria em Dados").length).toBe(1);
  });

  it("respeita MAXIMO_COMPARTILHADAS", () => {
    expect(MAXIMO_COMPARTILHADAS).toBe(10);
  });
});
