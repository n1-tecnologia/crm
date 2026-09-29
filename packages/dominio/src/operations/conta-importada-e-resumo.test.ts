/**
 * G1 (Fase 6) no domínio — `movidaDepoisDaImportacao`: a régua que a ponte
 * (`apps/api`) usa para não varrer a conta importada parada e que a tela usa
 * para não prometer um Resumo que não virá. Uma função só, nos dois lados.
 */
import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { CP, erpMissingFields, movidaDepoisDaImportacao } from "./financeiro";
import { importarContaAPagarHistorica } from "./importacao-contas-a-pagar";
import { changeTaskStatus } from "./tasks";

const S = CP.status;
const F = CP.fields;
const MARYANE = CP.financeiroId;

/** Uma conta importada do ClickUp, completa, parada em "para pagar" — como `contas-a-pagar:importar` grava. */
function importadaEmParaPagar(estado: DataState): Task {
  const r = importarContaAPagarHistorica(estado, MARYANE, {
    legacyTaskId: "868legado-g1",
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
  // A importação carimba `provenance.at` com o relógio; fixar num instante
  // passado garante que o movimento feito no teste é estritamente posterior.
  const indice = estado.tasks.findIndex((t) => t.id === r.value.id);
  const importada = estado.tasks[indice]!;
  estado.tasks[indice] = { ...importada, provenance: { ...importada.provenance!, at: "2026-09-01T00:00:00.000Z" } };
  return estado.tasks[indice]!;
}

function mover(estado: DataState, id: string, statusId: string): void {
  const r = changeTaskStatus(estado, MARYANE, id, statusId);
  if (!r.ok) throw new Error(r.error);
}

function conta(estado: DataState, id: string): Task {
  const t = estado.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

describe("movidaDepoisDaImportacao (G1) — a conta que a ponte varre", () => {
  it("conta nascida na plataforma: sempre", () => {
    const estado = buildSeed();
    const nativas = estado.tasks.filter((t) => t.listId === CP.listId && t.provenance?.kind !== "import");
    expect(nativas.length).toBeGreaterThan(0);
    for (const t of nativas) expect(movidaDepoisDaImportacao(estado, t)).toBe(true);
  });

  it("importada completa em \"para pagar\", parada desde a importação: não — mesmo com o histórico do ClickUp reproduzido", () => {
    const estado = buildSeed();
    const t = importadaEmParaPagar(estado);
    expect(erpMissingFields(estado, t)).toEqual([]);
    expect(estado.activity.some((a) => a.objectId === t.id && a.action === "Status alterado")).toBe(true);
    expect(movidaDepoisDaImportacao(estado, t)).toBe(false);
  });

  it("importada e movida aqui depois da importação: sim — e volta a valer em qualquer Status", () => {
    const estado = buildSeed();
    const t = importadaEmParaPagar(estado);
    mover(estado, t.id, S.emLancamento);
    expect(movidaDepoisDaImportacao(estado, conta(estado, t.id))).toBe(true);
    mover(estado, t.id, S.paraPagar);
    expect(movidaDepoisDaImportacao(estado, conta(estado, t.id))).toBe(true);
  });
});
