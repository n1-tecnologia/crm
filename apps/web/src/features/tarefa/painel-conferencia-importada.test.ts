// @vitest-environment jsdom
/**
 * Fase 6 (G1 na tela) — a conta importada do ClickUp e parada desde a
 * importação não recebe Resumo da ponte (`movidaDepoisDaImportacao`, em
 * `@n1/dominio`); a tela usa a MESMA régua e não mostra "Aguardando Resumo"
 * para ela. Depois de um movimento feito na plataforma, a ponte a varre — e a
 * tela volta a mostrar a espera.
 */

import { describe, expect, it, vi } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations";
import { importarContaAPagarHistorica } from "@n1/dominio/operations/importacao-contas-a-pagar";
import { changeTaskStatus } from "@n1/dominio/operations/tasks";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { conferenciaVisivel } from "./painel-conferencia-do-resumo";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const S = CP.status;
const F = CP.fields;
const MARYANE = CP.financeiroId;

function importadaEmParaPagar(estado: DataState): Task {
  const r = importarContaAPagarHistorica(estado, MARYANE, {
    legacyTaskId: "868legado-tela",
    titulo: "Conta importada do ClickUp",
    statusFinalId: S.paraPagar,
    criadaEm: "2026-08-01T12:00:00.000Z",
    vencimento: { form: "civilDay", value: "2026-10-10" },
    transicoes: [{ em: "2026-08-01T12:00:00.000Z", statusId: S.paraPagar, nomeLegado: "para pagar" }],
    campos: {
      [F.centroDeCusto]: "TRIA",
      [F.categoria]: "Impostos",
      [F.valor]: 10,
      [F.forma]: "Chave Pix",
      [F.chavePix]: "financeiro@exemplo.com.br",
      [F.fornecedor]: "CNPJ",
      [F.cnpj]: "11.222.333/0001-81",
      [F.nomeFornecedor]: "Receita Federal do Brasil",
    },
    tags: ["tag_cp_1"],
    lacunas: [],
  });
  if (!r.ok) throw new Error(r.error);
  const indice = estado.tasks.findIndex((t) => t.id === r.value.id);
  const importada = estado.tasks[indice]!;
  estado.tasks[indice] = { ...importada, provenance: { ...importada.provenance!, at: "2026-09-01T00:00:00.000Z" } };
  return estado.tasks[indice]!;
}

function conta(estado: DataState, id: string): Task {
  const t = estado.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

describe("conferenciaVisivel — a conta importada parada não promete Resumo (G1)", () => {
  it("importada completa em \"para pagar\", sem movimento: nada a mostrar", () => {
    const estado = buildSeed();
    const t = importadaEmParaPagar(estado);
    expect(conferenciaVisivel(estado, t)).toBeUndefined();
  });

  it("depois de um movimento feito aqui: \"Aguardando Resumo\" (sem-resumo) volta a aparecer", () => {
    const estado = buildSeed();
    const t = importadaEmParaPagar(estado);
    for (const statusId of [S.emLancamento, S.paraPagar]) {
      const r = changeTaskStatus(estado, MARYANE, t.id, statusId);
      if (!r.ok) throw new Error(r.error);
    }
    expect(conferenciaVisivel(estado, conta(estado, t.id))).toEqual({ estado: "sem-resumo" });
  });
});
