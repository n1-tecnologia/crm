/**
 * Comparação pura — sem Postgres. `compararContasAReceber` é a função que
 * `conferirContasAReceber` chama depois de hidratar; aqui os dois lados
 * ("esperado" e "encontrado") são montados em memória, então este arquivo
 * não precisa de `DATABASE_URL` nem de conexão nenhuma.
 */

import { describe, expect, it } from "vitest";
import type { DataState } from "@n1/dominio";
import { CR } from "@n1/dominio/operations/financeiro";
import { compararContasAReceber } from "./conferir-contas-a-receber";
import { buildGestaoBootstrap } from "@n1/dominio/bootstrap-gestao";

/**
 * `buildGestaoBootstrap({ fixtures: ... })` não aceita `fixtures` — ela
 * sempre chama `applyContasAReceber(..., { fixtures: false })` por dentro
 * (é o bootstrap de produção). Isso é exatamente o "esperado" que este
 * módulo compara: o mesmo `DataState` que `bootstrap-gestao.ts:191` grava.
 */
function esperado(): DataState {
  return buildGestaoBootstrap({ agora: "2026-01-01T00:00:00.000Z" });
}

/** Cópia profunda e independente, para mutar sem afetar o "esperado" do próximo teste. */
function clone(state: DataState): DataState {
  return structuredClone(state);
}

describe("compararContasAReceber", () => {
  it("estado idêntico ao esperado devolve zero divergências", () => {
    const e = esperado();
    const f = clone(e);
    const relatorio = compararContasAReceber(e, f);
    expect(relatorio.divergencias).toEqual([]);
    expect(relatorio.contagens.status.encontrados).toBe(relatorio.contagens.status.esperados);
    expect(relatorio.contagens.automacoes.encontrados).toBe(relatorio.contagens.automacoes.esperados);
  });

  it("um Status com entryFromStatusIds adulterado aponta a divergência certa", () => {
    const e = esperado();
    const f = clone(e);
    const lista = f.lists.find((l) => l.id === CR.listId)!;
    const pendente = lista.statusSet!.definitions.find((s) => s.id === CR.status.pendente)!;
    // No catálogo: entryFromStatusIds = [paraReceber, recebido]. Adultera para só um.
    (pendente as { entryFromStatusIds?: readonly string[] }).entryFromStatusIds = [CR.status.paraReceber];

    const relatorio = compararContasAReceber(e, f);
    const divergencia = relatorio.divergencias.find((d) => d.colecao === "status" && d.id === CR.status.pendente && d.campo === "entryFromStatusIds");
    expect(divergencia).toBeDefined();
    expect(relatorio.divergencias).toHaveLength(1);
  });

  it("um Campo ausente em ws_n1 vira uma divergência de presença", () => {
    const e = esperado();
    const f = clone(e);
    f.fieldDefinitions = f.fieldDefinitions.filter((fd) => fd.id !== CR.fields.situacao);

    const relatorio = compararContasAReceber(e, f);
    expect(relatorio.divergencias).toEqual([
      { colecao: "campo", id: CR.fields.situacao, campo: "presença", esperado: "presente", encontrado: "ausente" },
    ]);
    expect(relatorio.contagens.campos.encontrados).toBe(relatorio.contagens.campos.esperados - 1);
  });

  it("uma Automação com temporalPredicate diferente vira uma divergência", () => {
    const e = esperado();
    const f = clone(e);
    const r4 = f.automations.find((a) => a.id === "aut_cr_r4")!;
    const versao = r4.versions.find((v) => v.state === "publicada")!;
    versao.trigger = { ...versao.trigger!, temporalPredicate: JSON.stringify({ dueDateOffsetDays: 45 }) };

    const relatorio = compararContasAReceber(e, f);
    const divergencia = relatorio.divergencias.find((d) => d.colecao === "automacao" && d.id === "aut_cr_r4" && d.campo === "trigger.temporalPredicate");
    expect(divergencia).toBeDefined();
    expect(relatorio.divergencias).toHaveLength(1);
  });

  it("uma Concessão a mais em ws_n1 (fora do catálogo) vira divergência de presença, sem remover nada", () => {
    const e = esperado();
    const f = clone(e);
    f.grants.push({
      id: "gr_extra_teste",
      workspaceId: f.workspace.id,
      subjectKind: "member",
      subjectId: "mem_maryane",
      action: "ver",
      resourceType: "list",
      resourceId: CR.listId,
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: "mem_maryane",
      grantedAt: "2026-01-01T00:00:00.000Z",
    });

    const relatorio = compararContasAReceber(e, f);
    expect(relatorio.divergencias).toEqual([
      { colecao: "concessao", id: "gr_extra_teste", campo: "presença", esperado: "ausente do catálogo", encontrado: "presente" },
    ]);
  });
});
