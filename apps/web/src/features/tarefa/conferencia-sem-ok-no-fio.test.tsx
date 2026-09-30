// @vitest-environment jsdom
/**
 * 06-18 Task 3 (crm2:WR-03, a parte da tela) — a tela ensina só o gesto que
 * funciona.
 *
 * - Com a decisão por comentário desligada, a Conferência guarda
 *   `origin.aprovacaoPeloFio = false` (D6-10: dado, não configuração), e nem
 *   o card nem a doca do tópico mandam responder "ok": conferir é pelo botão,
 *   e o fio continua pedindo ajuste.
 * - Os botões seguem a MESMA régua do fio: `podeConferirOResumo` é
 *   `podeDecidirAConferencia` do domínio — o aprovador de G3 vê os botões, e a
 *   Maryane sob G3 lê "Somente … ou um Administrador confere este Resumo.".
 * - Sem a opção, os textos de 06-14 ficam (controle).
 *
 * Harness no molde de `painel-conferencia-no-fio.test.tsx` e
 * `timeline-responder.test.tsx` (sem editá-los): `buildSeed()` +
 * `publicarResumoParaConferencia` (a ponte) + Transporte falso. Arquivo novo
 * (CON-05).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { buildSeed } from "@n1/dominio/seed";
import { CP, podeDecidirAConferencia, publicarResumoParaConferencia } from "@n1/dominio/operations";
import type { ConferenciaDoResumo, DeParaDeLancamento } from "@n1/dominio/operations";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { makeFormatters } from "@/features/shell/format";
import { PainelConferenciaDoResumo, podeConferirOResumo } from "./painel-conferencia-do-resumo";
import { Timeline } from "./timeline";

vi.mock("next/navigation", () => ({
  usePathname: () => "/tarefas/tsk_cp_das",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
}

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

/** O Membro de serviço da ponte nos testes. */
const SERVICO = "mem_thiago";
const PARAGRAFO_DO_FIO = 'Confira pelo botão ou responda "ok" no fio do Resumo; qualquer outra resposta no fio pede ajuste.';
const PARAGRAFO_SEM_OK = "Confira pelo botão; uma resposta no fio do Resumo pede ajuste.";
const AVISO_DA_DOCA = 'Para conferir o Resumo pelo tópico, use "Responder" no Comentário do Resumo; um comentário novo aqui não confere.';
const AVISO_DA_DOCA_SEM_OK = 'Para pedir ajuste no Resumo pelo tópico, use "Responder" no Comentário do Resumo; conferir é pelo botão do card.';

let state: DataState;
let transporte: Transporte;

const das = (): Task => {
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  return t;
};

function publicarResumo(extra: { readonly aprovacaoPorComentario?: boolean; readonly avisarId?: string } = {}): ConferenciaDoResumo {
  const r = publicarResumoParaConferencia(state, SERVICO, das().id, { dePara: DE_PARA, ...extra });
  if (!r.ok) throw new Error(r.error);
  return r.value.conferencia;
}

function comStore(memberId: string, filho: ReactNode) {
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }} transporte={transporte}>
      {filho}
    </StoreProvider>,
  );
}

const card = (memberId: string) =>
  comStore(memberId, <PainelConferenciaDoResumo task={das()} fmt={makeFormatters(state.workspace.locale)} report={() => {}} />);
const timeline = (memberId: string) => comStore(memberId, <Timeline task={das()} fmt={makeFormatters(state.workspace.locale)} readOnly={false} />);

beforeEach(() => {
  state = buildSeed();
  transporte = transporteFalso();
});

afterEach(() => {
  cleanup();
});

describe("(a) o card sem \"ok\" quando a Conferência não aceita o ok pelo fio", () => {
  it("os dois botões, e o parágrafo pelo botão — nenhum \"responda ok\"", () => {
    const c = publicarResumo({ aprovacaoPorComentario: false });
    expect(c.origin.aprovacaoPeloFio).toBe(false);
    const { container } = card(CP.financeiroId);
    expect(screen.getByRole("button", { name: "Conferido, pode lançar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pedir ajuste" })).toBeTruthy();
    expect(screen.getByText(PARAGRAFO_SEM_OK)).toBeTruthy();
    expect(container.textContent).not.toContain('responda "ok"');
  });
});

describe("(b) a doca do tópico sem \"ok\"", () => {
  it("Conferência pendente sem ok pelo fio: o aviso do ajuste, não o de conferir", () => {
    publicarResumo({ aprovacaoPorComentario: false });
    timeline(CP.financeiroId);
    expect(screen.getByText(AVISO_DA_DOCA_SEM_OK)).toBeTruthy();
    expect(screen.queryByText(/Para conferir o Resumo pelo tópico/)).toBeNull();
  });
});

describe("(c) os botões pela régua do domínio", () => {
  it("podeConferirOResumo = podeDecidirAConferencia para todos os Membros da seed, na padrão e na de G3", () => {
    const padrao = publicarResumo();
    for (const m of state.members) expect([m.id, podeConferirOResumo(state, m.id, padrao)]).toEqual([m.id, podeDecidirAConferencia(state, m.id, padrao)]);

    state = buildSeed();
    const g3 = publicarResumo({ avisarId: "mem_walter" });
    expect(g3.approverMemberId).toBe("mem_walter");
    for (const m of state.members) expect([m.id, podeConferirOResumo(state, m.id, g3)]).toEqual([m.id, podeDecidirAConferencia(state, m.id, g3)]);
    expect(podeConferirOResumo(state, "mem_walter", g3)).toBe(true);
    expect(podeConferirOResumo(state, CP.financeiroId, g3)).toBe(false);
  });

  it("G3: o mem_walter vê os botões; a Maryane lê quem confere", () => {
    publicarResumo({ avisarId: "mem_walter" });
    card("mem_walter");
    expect(screen.getByRole("button", { name: "Conferido, pode lançar" })).toBeTruthy();
    cleanup();
    card(CP.financeiroId);
    expect(screen.queryByRole("button", { name: "Conferido, pode lançar" })).toBeNull();
    expect(screen.getByText("Somente Walter Galvão Neto ou um Administrador confere este Resumo.")).toBeTruthy();
  });
});

describe("(d) controle: sem a opção, os textos de 06-14", () => {
  it("o card e a doca como antes", () => {
    const c = publicarResumo();
    expect("aprovacaoPeloFio" in c.origin).toBe(false);
    card(CP.financeiroId);
    expect(screen.getByText(PARAGRAFO_DO_FIO)).toBeTruthy();
    cleanup();
    timeline(CP.financeiroId);
    expect(screen.getByText(AVISO_DA_DOCA)).toBeTruthy();
    expect(screen.queryByText(AVISO_DA_DOCA_SEM_OK)).toBeNull();
  });
});
