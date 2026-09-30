// @vitest-environment jsdom
/**
 * 06-19 Task 2 — a tela enquanto o Agente lança a conta no Omie (crm2:WR-01).
 *
 * Com a marca "Lançamento no Omie em curso" vigente, o card da Conferência
 * diz que o Agente está lançando, e o diálogo "Lançado no Omie" fica
 * desligado com a mesma recusa que o domínio aplica
 * (`RECUSA_LANCAMENTO_EM_CURSO`). Marca vencida ou encerrada: nada disso.
 *
 * Harness no molde de `painel-conferencia-no-fio.test.tsx` (sem editá-lo):
 * `buildSeed()` + `publicarResumoParaConferencia` (a ponte) + Transporte falso.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import {
  CP,
  PRAZO_DO_LANCAMENTO_EM_CURSO_MS,
  RECUSA_LANCAMENTO_EM_CURSO,
  REGISTRO_LANCAMENTO_EM_CURSO,
  changeTaskStatus,
  decideProcessApproval,
  marcarLancamentoEmCurso,
  publicarResumoParaConferencia,
  registrarLancamentoNoOmie,
} from "@n1/dominio/operations";
import type { DeParaDeLancamento } from "@n1/dominio/operations";
import { containerAdminRefusal } from "@n1/dominio/derive";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { makeFormatters } from "@/features/shell/format";
import { PainelConferenciaDoResumo } from "./painel-conferencia-do-resumo";
import { lancamentoNoOmieRecusado } from "./lancamento-no-omie-dialog";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const SERVICO = "mem_thiago";
const MARYANE = CP.financeiroId;
const LINHA = "O Agente está lançando esta conta no Omie agora. Espere a confirmação neste fio.";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

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
  } as unknown as Transporte;
}

let state: DataState;

const das = (): Task => {
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  return t;
};

function exigir<T>(r: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function card(memberId: string) {
  return render(
    <StoreProvider
      sessao={{ memberId }}
      estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }}
      transporte={transporteFalso()}
    >
      <PainelConferenciaDoResumo task={das()} fmt={makeFormatters(state.workspace.locale)} report={() => {}} />
    </StoreProvider>,
  );
}

beforeEach(() => {
  state = buildSeed();
  const p = exigir(publicarResumoParaConferencia(state, SERVICO, das().id, { dePara: DE_PARA }));
  exigir(decideProcessApproval(state, MARYANE, p.conferencia.id, "aprovada", { source: "click" }));
  exigir(changeTaskStatus(state, MARYANE, das().id, CP.status.emLancamento));
});

afterEach(() => {
  cleanup();
});

describe("(j) com a marca vigente", () => {
  it("o card diz que o Agente está lançando, e o diálogo \"Lançado no Omie\" é recusado", () => {
    exigir(marcarLancamentoEmCurso(state, SERVICO, das().id));
    card(MARYANE);
    const linha = screen.getByText(LINHA);
    expect(linha.getAttribute("role")).toBe("status");
    expect(lancamentoNoOmieRecusado(state, MARYANE, das())).toBe(RECUSA_LANCAMENTO_EM_CURSO);
  });
});

describe("(k) marca vencida ou encerrada", () => {
  it("vencida: sem a linha, e o diálogo volta à regra de sempre", () => {
    exigir(marcarLancamentoEmCurso(state, SERVICO, das().id));
    const i = state.activity.findIndex((a) => a.objectId === das().id && a.action === REGISTRO_LANCAMENTO_EM_CURSO);
    state.activity[i] = { ...state.activity[i]!, at: new Date(Date.now() - PRAZO_DO_LANCAMENTO_EM_CURSO_MS - 1_000).toISOString() };
    card(MARYANE);
    expect(screen.queryByText(LINHA)).toBeNull();
    expect(lancamentoNoOmieRecusado(state, MARYANE, das())).toBe(containerAdminRefusal(state, MARYANE, "list", das().listId));
  });

  it("encerrada pelo registro: sem a linha, e o diálogo volta à regra de sempre", () => {
    exigir(marcarLancamentoEmCurso(state, SERVICO, das().id));
    exigir(registrarLancamentoNoOmie(state, SERVICO, das().id, { payableId: "4100000001", reaproveitado: false, anexos: [] }));
    card(MARYANE);
    expect(screen.queryByText(LINHA)).toBeNull();
    expect(lancamentoNoOmieRecusado(state, MARYANE, das())).toBe(containerAdminRefusal(state, MARYANE, "list", das().listId));
  });
});
