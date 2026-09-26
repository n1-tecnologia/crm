/**
 * `esquemas/ia-automacoes-editor.ts` — testes puros, sem banco: só a FORMA
 * dos argumentos. (a) cobertura, (b) as formas LITERAIS de `apps/web`
 * (`editor-de-automacao.tsx`, `automacao-spec.ts`, `nova-automacao-dialog.tsx`)
 * passam, (c) formas hostis caem.
 */

import { describe, expect, it } from "vitest";
import { IA_AUTOMACOES_EDITOR } from "./ia-automacoes-editor";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/ia-automacoes-editor — a forma dos args de ia/automacoes-editor.ts", () => {
  it("(a) cobertura — as 18 chaves de ia/automacoes-editor.ts em registro.ts", () => {
    const esperadas = [
      "criarAutomacao",
      "editarAutomacao",
      "duplicarAutomacao",
      "criarRascunhoDaAutomacao",
      "descartarRascunhoDaAutomacao",
      "definirGatilho",
      "adicionarCondicao",
      "editarCondicao",
      "removerCondicao",
      "adicionarAcao",
      "editarAcao",
      "moverAcao",
      "removerAcao",
      "definirPoliticaDeErro",
      "pausarAutomacao",
      "retomarAutomacao",
      "arquivarAutomacao",
      "enviarAutomacaoALixeira",
    ].sort();
    expect(Object.keys(IA_AUTOMACOES_EDITOR).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const A = IA_AUTOMACOES_EDITOR;
    // nova-automacao-dialog.tsx
    expect(
      A.criarAutomacao.safeParse(
        viaJson([{ name: "A", description: "", scopeType: "list", scopeId: "lst_1", trigger: { kind: "evento", eventType: "tarefa.criada" } }]),
      ).success,
    ).toBe(true);
    expect(A.criarAutomacao.safeParse(viaJson([{ name: "A", description: "d", scopeType: "workspace", scopeId: "wsp_1" }])).success).toBe(
      true,
    );
    // gatilhoDoValor — as quatro formas
    expect(A.definirGatilho.safeParse(viaJson(["aut_1", { kind: "manual" }])).success).toBe(true);
    expect(
      A.definirGatilho.safeParse(
        viaJson(["aut_1", { kind: "agendamento", schedule: { frequency: "semanas", interval: 1, weekDays: [1, 3], time: "09:00" } }]),
      ).success,
    ).toBe(true);
    expect(
      A.definirGatilho.safeParse(viaJson(["aut_1", { kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: 2 }) }]))
        .success,
    ).toBe(true);
    expect(A.definirGatilho.safeParse(viaJson(["aut_1", null])).success).toBe(true);
    // condicaoDoValor
    expect(
      A.adicionarCondicao.safeParse(viaJson(["aut_1", { kind: "atributo", expression: JSON.stringify({ status: "s1" }) }])).success,
    ).toBe(true);
    expect(
      A.editarCondicao.safeParse(
        viaJson(["aut_1", 0, { kind: "hibrida", expression: "x", agentId: "agt_1", skillId: "skl_1", defaultOnFailure: "falso" }]),
      ).success,
    ).toBe(true);
    expect(A.removerCondicao.safeParse(viaJson(["aut_1", 0])).success).toBe(true);
    // acaoDoValor
    expect(
      A.adicionarAcao.safeParse(viaJson(["aut_1", { kind: "escrita", toolId: "criar_tarefa", params: "{}", targetExpression: "x" }])).success,
    ).toBe(true);
    expect(
      A.editarAcao.safeParse(
        viaJson([
          "aut_1",
          2,
          { kind: "controle", controlKind: "invocarAgente", params: "{}", agentId: "agt_1", skillId: "skl_1", maxAutonomy: "supervisionado", timeoutHours: 4 },
        ]),
      ).success,
    ).toBe(true);
    expect(
      A.adicionarAcao.safeParse(viaJson(["aut_1", { kind: "controle", controlKind: "solicitarAprovacao", params: "{}", approverMemberId: "m1" }]))
        .success,
    ).toBe(true);
    expect(A.moverAcao.safeParse(viaJson(["aut_1", 1, "subir"])).success).toBe(true);
    expect(A.removerAcao.safeParse(viaJson(["aut_1", 1])).success).toBe(true);
    // PainelDePolitica
    expect(A.definirPoliticaDeErro.safeParse(viaJson(["aut_1", { onActionFailure: "continuar", retries: 2 }])).success).toBe(true);
    expect(
      A.definirPoliticaDeErro.safeParse(viaJson(["aut_1", { onActionFailure: "interromper", retries: 0, maxAutonomy: null }])).success,
    ).toBe(true);
    // editarAutomacao — `gravar({ ... })`
    expect(A.editarAutomacao.safeParse(viaJson(["aut_1", { name: "N" }])).success).toBe(true);
    expect(A.editarAutomacao.safeParse(viaJson(["aut_1", { reactsToAutomationEvents: true }])).success).toBe(true);
    for (const nome of [
      "duplicarAutomacao",
      "criarRascunhoDaAutomacao",
      "descartarRascunhoDaAutomacao",
      "pausarAutomacao",
      "retomarAutomacao",
      "arquivarAutomacao",
      "enviarAutomacaoALixeira",
    ] as const) {
      expect(A[nome].safeParse(viaJson(["aut_1"])).success).toBe(true);
    }
  });

  it("(c) formas hostis caem", () => {
    const A = IA_AUTOMACOES_EDITOR;
    expect(A.criarAutomacao.safeParse([{ name: "A", scopeType: "planeta", scopeId: "x" }]).success).toBe(false);
    expect(A.definirGatilho.safeParse(["aut_1", { kind: "sempre" }]).success).toBe(false);
    expect(A.definirGatilho.safeParse(["aut_1", { kind: "agendamento", schedule: { frequency: "anos", interval: 1 } }]).success).toBe(false);
    expect(A.adicionarAcao.safeParse(["aut_1", { kind: "escrita", params: "{}", order: 3 }]).success).toBe(false);
    expect(A.moverAcao.safeParse(["aut_1", 1, "esquerda"]).success).toBe(false);
    expect(A.definirPoliticaDeErro.safeParse(["aut_1", { onActionFailure: "ignorar", retries: 0 }]).success).toBe(false);
    expect(A.definirGatilho.safeParse(["aut_1"]).success).toBe(false);
  });
});
