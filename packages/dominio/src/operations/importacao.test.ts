/**
 * Prova de domínio de SOL-09 (Plan 02-22, Task 1): os sete casos (a)-(g) do
 * plano para `importarSolicitacaoHistorica`. A Lista "Solicitações de
 * pagamento" precisa existir antes de cada caso — `evoluirConfiguracaoDeSolicitacoes`
 * (Plan 02-08) sobre `buildGestaoBootstrap` (Fase 1), o mesmo par que
 * `solicitacao-de-pagamento-evolver.test.ts` usa.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "../bootstrap-gestao";
import { SOL } from "../solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes } from "../solicitacao-de-pagamento-evolver";
import type { DataState } from "../state";
import type { Id } from "../types";
import { importActor, importarSolicitacaoHistorica, type EntradaDeImportacaoHistorica } from "./importacao";

const AGORA = "2026-09-21T12:00:00.000Z";
const OPERADOR: Id = "mem_maryane";
const CENTRO_DE_CUSTO_ID: Id = "fld_sp_a_centro_de_custo";

function entradaBase(overrides: Partial<EntradaDeImportacaoHistorica> = {}): EntradaDeImportacaoHistorica {
  return {
    legacyTaskId: "clk_1001",
    origem: "clickup",
    status: "aprovado",
    titulo: "Solicitação importada — ClickUp clk_1001",
    campos: { [CENTRO_DE_CUSTO_ID]: "TRIA" },
    lacunas: [],
    ...overrides,
  };
}

describe("importarSolicitacaoHistorica", () => {
  let s: DataState;

  beforeEach(() => {
    s = buildGestaoBootstrap({ agora: AGORA });
    const evoluida = evoluirConfiguracaoDeSolicitacoes(s, OPERADOR);
    expect(evoluida.ok, evoluida.ok ? "" : evoluida.error).toBe(true);
  });

  it("(a) importação cria Tarefa fechada no Status dado, com provenance.kind de importação", () => {
    const r = importarSolicitacaoHistorica(s, OPERADOR, entradaBase({ status: "aprovado" }));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(r.value.statusId).toBe(SOL.status.aprovado);
    expect(r.value.provenance?.kind).toBe("import");
    expect(r.value.provenance?.sourceId).toBe("clk_1001");
    expect(r.value.provenance?.sourceName).toBe("clickup");
    expect(r.value.completedAt).toBeDefined();

    const r2 = importarSolicitacaoHistorica(s, OPERADOR, entradaBase({ legacyTaskId: "clk_1002", status: "não aprovado" }));
    expect(r2.ok, r2.ok ? "" : r2.error).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    expect(r2.value.statusId).toBe(SOL.status.naoAprovado);
  });

  it("(b) reimportar o mesmo (origem, legacyTaskId) falha e nada muda", () => {
    const primeira = importarSolicitacaoHistorica(s, OPERADOR, entradaBase());
    expect(primeira.ok).toBe(true);

    const totalDeTarefasAntes = s.tasks.length;
    const totalDeAtividadesAntes = s.activity.length;

    const segunda = importarSolicitacaoHistorica(s, OPERADOR, entradaBase({ titulo: "Outro título, mesma linha" }));
    expect(segunda.ok).toBe(false);
    expect(s.tasks.length).toBe(totalDeTarefasAntes);
    expect(s.activity.length).toBe(totalDeAtividadesAntes);
  });

  it("(c) sem criadaEm, createdAt é o agora e a lacuna data_de_criacao_ausente é registrada", () => {
    const antes = Date.now();
    const r = importarSolicitacaoHistorica(s, OPERADOR, entradaBase());
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(Date.parse(r.value.createdAt)).toBeGreaterThanOrEqual(antes);
    const lacuna = s.activity.find(
      (a) => a.objectId === r.value.id && a.action === "Lacuna de importação" && a.detail === "data_de_criacao_ausente",
    );
    expect(lacuna).toBeDefined();
  });

  it("(d) sem autoriaConhecida, o Ator é importacao:clickup, kind system", () => {
    const r = importarSolicitacaoHistorica(s, OPERADOR, entradaBase());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(importActor("clickup")).toEqual({ kind: "system", id: "importacao:clickup" });
    const registros = s.activity.filter((a) => a.objectId === r.value.id);
    expect(registros.length).toBeGreaterThan(0);
    expect(registros.every((a) => a.actor.kind === "system" && a.actor.id === "importacao:clickup")).toBe(true);
  });

  it("(e) resumo vira Comentário com o mesmo Ator", () => {
    const r = importarSolicitacaoHistorica(s, OPERADOR, entradaBase({ resumo: "RESUMO:\n- item 1\n- item 2" }));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(r.value.comments.length).toBe(1);
    expect(r.value.comments[0]?.content).toBe("RESUMO:\n- item 1\n- item 2");
    expect(r.value.comments[0]?.author).toEqual({ kind: "system", id: "importacao:clickup" });

    const comAutoria = importarSolicitacaoHistorica(
      s,
      OPERADOR,
      entradaBase({ legacyTaskId: "clk_2002", resumo: "outro resumo", autoriaConhecida: { memberId: OPERADOR } }),
    );
    expect(comAutoria.ok).toBe(true);
    if (!comAutoria.ok) throw new Error("unreachable");
    expect(comAutoria.value.comments[0]?.author).toEqual({ kind: "member", id: OPERADOR });
  });

  it("(f) falha no meio (Campo inválido) devolve o estado exatamente ao anterior", () => {
    const totalDeTarefasAntes = s.tasks.length;
    const totalDeAtividadesAntes = s.activity.length;
    const readableAntes = s.workspace.taskReadableId.next;

    const r = importarSolicitacaoHistorica(
      s,
      OPERADOR,
      entradaBase({ campos: { [CENTRO_DE_CUSTO_ID]: "TRIA", fld_sp_m_forma_de_pagamento: "Cripto — não existe" } }),
    );
    expect(r.ok).toBe(false);
    expect(s.tasks.length).toBe(totalDeTarefasAntes);
    expect(s.activity.length).toBe(totalDeAtividadesAntes);
    expect(s.workspace.taskReadableId.next).toBe(readableAntes);
  });

  it("(g) não produz evento: assinatura sem parâmetro de evento, DataState sem coleção nova", () => {
    expect(importarSolicitacaoHistorica.length).toBe(3);
    const chavesAntes = Object.keys(s).sort();
    const r = importarSolicitacaoHistorica(s, OPERADOR, entradaBase());
    expect(r.ok).toBe(true);
    const chavesDepois = Object.keys(s).sort();
    expect(chavesDepois).toEqual(chavesAntes);
  });
});
