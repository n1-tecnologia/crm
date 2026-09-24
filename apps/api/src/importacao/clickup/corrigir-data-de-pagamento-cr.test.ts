/**
 * `levantarCorrecoes` é PURO (sem I/O, sem banco): a prova cobre exatamente
 * o vocabulário do plano — `corrigir`/`divergente`/`nao-encontrada`, os
 * totais (lidas, com Data de pagamento, afetadas por origem) e as duas
 * fronteiras de fuso (02:59:59Z/03:00:00Z, mesma dupla de
 * `contas-a-receber.test.ts`).
 *
 * O `state` vem de `buildGestaoBootstrap` (`@n1/dominio`) — as Tarefas "já
 * importadas em ws_n1" são criadas de verdade por
 * `importarContaAReceberHistorica`, não fabricadas à mão, para que a
 * proveniência (`provenance.kind === "import"`) e o Campo "Data de
 * pagamento" tenham exatamente a forma que a importação real grava.
 */

import { buildGestaoBootstrap } from "@n1/dominio/bootstrap-gestao";
import { CR } from "@n1/dominio/operations/financeiro";
import { importarContaAReceberHistorica, type EntradaDeContaAReceberHistorica } from "@n1/dominio/operations/importacao-contas-a-receber";
import type { DataState } from "@n1/dominio/state";
import type { Id } from "@n1/dominio/types/primitives";
import { describe, expect, it } from "vitest";
import { setTaskFieldValue } from "@n1/dominio/operations/tasks";

import type { TarefaClickUpBruta } from "./contas-a-pagar";
import { levantarCorrecoes } from "./corrigir-data-de-pagamento-cr";

const AGORA = "2026-09-24T12:00:00.000Z";
const OPERADOR: Id = "mem_maryane";

/** `c41d9418-…` é o id literal de "Data de pagamento" — mesmo literal duplicado por `contas-a-receber.test.ts`. */
const ID_CAMPO_DATA_DE_PAGAMENTO = "c41d9418-824c-4beb-9264-e5b03e815c9d";

function entradaBase(legacyTaskId: string, dataPagamento: string): EntradaDeContaAReceberHistorica {
  return {
    legacyTaskId,
    titulo: `Conta importada ${legacyTaskId}`,
    statusFinalId: CR.status.recebido,
    criadaEm: "2025-02-19T12:55:00.000Z",
    transicoes: [{ em: "2025-02-19T12:55:00.000Z", statusId: CR.status.recebido, nomeLegado: "recebido" }],
    campos: { [CR.fields.tipo]: CR.tipos.entrada },
    dataPagamento,
    lacunas: ["data-de-pagamento-por-date-closed"],
  };
}

function importar(state: DataState, legacyTaskId: string, dataPagamento: string): Id {
  const r = importarContaAReceberHistorica(state, OPERADOR, entradaBase(legacyTaskId, dataPagamento));
  expect(r.ok, r.ok ? "" : r.error).toBe(true);
  if (!r.ok) throw new Error("unreachable");
  return r.value.id;
}

function tarefaComDateClosed(id: string, dateClosedEpochMs: number): TarefaClickUpBruta {
  return { id, name: `Conta ${id}`, status: { status: "recebido" }, date_created: "1706918100000", date_closed: String(dateClosedEpochMs) };
}

function tarefaComCampo(id: string, campoEpochMs: number): TarefaClickUpBruta {
  return {
    id,
    name: `Conta ${id}`,
    status: { status: "recebido" },
    date_created: "1706918100000",
    custom_fields: [{ id: ID_CAMPO_DATA_DE_PAGAMENTO, type: "date", value: String(campoEpochMs) }],
  };
}

describe("levantarCorrecoes (CR-06, Plan 05-22) — puro", () => {
  it("classifica corrigir/divergente/nao-encontrada e ignora quem já bate (UTC === São Paulo), incluindo as duas fronteiras 02:59:59Z/03:00:00Z", () => {
    const state = buildGestaoBootstrap({ agora: AGORA });

    // (1) date_closed = 2025-03-15T01:30:00Z, sem Campo — errado "2025-03-15",
    // correto "2025-03-14", origem "date_closed". Já importada com o dia UTC
    // errado gravado → corrigir.
    const idCorrigir = importar(state, "fic_corr_01", "2025-03-15");

    // (3) mesmo padrão de (1), mas o Campo em ws_n1 já foi alterado à mão →
    // divergente, nada sobrescrito.
    const idDivergente = importar(state, "fic_corr_03", "2025-03-15");
    const mudou = setTaskFieldValue(state, OPERADOR, idDivergente, CR.fields.dataPagamento, "2025-04-01");
    expect(mudou.ok, mudou.ok ? "" : mudou.error).toBe(true);

    // (6) mesmo padrão de (1), só que a origem é o Campo "Data de pagamento",
    // não `date_closed` — prova que `afetadasPorOrigem.campo` também conta.
    const idCorrigirPorCampo = importar(state, "fic_corr_06", "2025-03-15");

    const tarefasDoExport: TarefaClickUpBruta[] = [
      tarefaComDateClosed("fic_corr_01", 1742002200000), // 2025-03-15T01:30:00Z → corrigir (date_closed)
      tarefaComCampo("fic_corr_02", 1749556800000), // 2025-06-10T12:00:00Z → não entra (UTC === São Paulo)
      tarefaComDateClosed("fic_corr_03", 1742002200000), // mesmo instante de (1) → divergente
      tarefaComDateClosed("fic_corr_04", 1742007599000), // fronteira 02:59:59Z → diverge, mas SEM Tarefa em ws_n1 → nao-encontrada
      tarefaComDateClosed("fic_corr_05", 1742007600000), // fronteira 03:00:00Z → UTC === São Paulo → não entra
      tarefaComCampo("fic_corr_06", 1742002200000), // mesmo instante de (1), origem Campo → corrigir (campo)
    ];

    const { correcoes, totais } = levantarCorrecoes(tarefasDoExport, state);

    expect(totais.lidas).toBe(6);
    expect(totais.comDataDePagamento).toBe(6); // todas resolvem um instante — só a divergência de dia decide quem entra em `correcoes`.
    expect(totais.afetadasPorOrigem).toEqual({ campo: 1, date_closed: 3 });

    // Só as 4 que de fato divergem entram — (2) e (5) nunca aparecem.
    expect(correcoes).toHaveLength(4);
    expect(correcoes.some((c) => c.legacyTaskId === "fic_corr_02")).toBe(false);
    expect(correcoes.some((c) => c.legacyTaskId === "fic_corr_05")).toBe(false);

    const corrigir = correcoes.find((c) => c.legacyTaskId === "fic_corr_01");
    expect(corrigir).toEqual({ legacyTaskId: "fic_corr_01", taskId: idCorrigir, origem: "date_closed", errado: "2025-03-15", correto: "2025-03-14", situacao: "corrigir" });

    const divergente = correcoes.find((c) => c.legacyTaskId === "fic_corr_03");
    expect(divergente).toEqual({ legacyTaskId: "fic_corr_03", taskId: idDivergente, origem: "date_closed", errado: "2025-03-15", correto: "2025-03-14", situacao: "divergente" });

    const naoEncontrada = correcoes.find((c) => c.legacyTaskId === "fic_corr_04");
    expect(naoEncontrada).toEqual({ legacyTaskId: "fic_corr_04", origem: "date_closed", errado: "2025-03-15", correto: "2025-03-14", situacao: "nao-encontrada" });
    expect(naoEncontrada?.taskId).toBeUndefined();

    const corrigirPorCampo = correcoes.find((c) => c.legacyTaskId === "fic_corr_06");
    expect(corrigirPorCampo).toEqual({ legacyTaskId: "fic_corr_06", taskId: idCorrigirPorCampo, origem: "campo", errado: "2025-03-15", correto: "2025-03-14", situacao: "corrigir" });
  });

  it("tarefa sem instante resolvível (nem Campo nem date_closed) não conta como 'com Data de pagamento'", () => {
    const state = buildGestaoBootstrap({ agora: AGORA });
    const tarefaSemNenhum: TarefaClickUpBruta = { id: "fic_corr_sem_data", name: "Sem data alguma", status: { status: "recebido" }, date_created: "1706918100000" };

    const { correcoes, totais } = levantarCorrecoes([tarefaSemNenhum], state);

    expect(totais.lidas).toBe(1);
    expect(totais.comDataDePagamento).toBe(0);
    expect(totais.afetadasPorOrigem).toEqual({ campo: 0, date_closed: 0 });
    expect(correcoes).toHaveLength(0);
  });
});
