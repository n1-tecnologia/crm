/**
 * `esquemas-de-argumentos.ts` — testes puros, sem banco, sem `buildApp`: só a
 * COMPOSIÇÃO e a COMPLETUDE (`ESQUEMAS ≡ OPERACOES`, sem fallback). A FORMA
 * de cada schema por módulo é provada em `esquemas/<modulo>.test.ts` — este
 * arquivo não repete os casos por operação, só prova que a composição chega
 * inteira e que `esquemaDeArgumentos(nome)` nunca devolve outra coisa que não
 * `ESQUEMAS[nome]`.
 */

import { describe, expect, it } from "vitest";
import { ehNomeDeOperacao, OPERACOES, type NomeDeOperacao } from "@n1/dominio/operations/registro";
import { ESQUEMAS, esquemaDeArgumentos } from "./esquemas-de-argumentos";

describe("esquemas-de-argumentos — a forma dos args, não a regra", () => {
  it("(a) updateTask recusa title fora do tipo, description fora do tipo e chave desconhecida", () => {
    expect(ESQUEMAS.updateTask.safeParse(["t1", { title: 123 }]).success).toBe(false);
    expect(ESQUEMAS.updateTask.safeParse(["t1", { description: {} }]).success).toBe(false);
    expect(ESQUEMAS.updateTask.safeParse(["t1", { titulo: "x" }]).success).toBe(false);
  });

  it("(b) updateTask aceita a forma legítima do web, com data e estimate nulo", () => {
    expect(
      ESQUEMAS.updateTask.safeParse([
        "t1",
        { title: "x", dueDate: { form: "civilDay", value: "2026-01-01" }, estimate: null },
      ]).success,
    ).toBe(true);
  });

  it("(c) updateTask recusa tupla incompleta e tupla com argumento a mais", () => {
    expect(ESQUEMAS.updateTask.safeParse(["t1"]).success).toBe(false);
    expect(ESQUEMAS.updateTask.safeParse(["t1", {}, "extra"]).success).toBe(false);
  });

  it("(d) createTask aceita parentTaskId e assignees, recusa sem title", () => {
    expect(ESQUEMAS.createTask.safeParse([{ listId: "l", title: "t", parentTaskId: "p" }]).success).toBe(true);
    expect(
      ESQUEMAS.createTask.safeParse([{ listId: "l", title: "t", assignees: [{ kind: "member", id: "m" }] }])
        .success,
    ).toBe(true);
    expect(ESQUEMAS.createTask.safeParse([{ listId: "l" }]).success).toBe(false);
  });

  it("(e) addTaskComment, setTaskTags, setTaskFieldValue e createReceivableSeries aceitam as formas literais do web", () => {
    expect(
      ESQUEMAS.addTaskComment.safeParse(["t1", { content: "c", mentions: [{ type: "member", id: "m" }] }])
        .success,
    ).toBe(true);
    expect(ESQUEMAS.setTaskTags.safeParse(["t1", ["tag_a"]]).success).toBe(true);
    expect(ESQUEMAS.setTaskFieldValue.safeParse(["t1", "fld", ["a", "b"]]).success).toBe(true);
    expect(ESQUEMAS.setTaskFieldValue.safeParse(["t1", "fld", null]).success).toBe(true);
    expect(
      ESQUEMAS.createReceivableSeries.safeParse([
        { contactId: "c1", centroDeCusto: "cc", valorParcela: 100, parcelas: 3, primeiroVencimento: "2026-01-01" },
      ]).success,
    ).toBe(true);
    expect(
      ESQUEMAS.createReceivableSeries.safeParse([
        {
          contactId: "c1",
          centroDeCusto: "cc",
          empresa: "Tria",
          produto: "Prod",
          forma: "pix",
          valorEntrada: 50,
          vencimentoEntrada: "2026-01-01",
          valorParcela: 100,
          parcelas: 3,
          primeiroVencimento: "2026-02-01",
        },
      ]).success,
    ).toBe(true);
  });

  it("(f) moveTask aceita 2 args, transforma null em undefined no 3º, e aceita mapping", () => {
    expect(ESQUEMAS.moveTask.safeParse(["t1", "l1"]).success).toBe(true);
    const revivido = ESQUEMAS.moveTask.safeParse(["t1", "l1", null]);
    expect(revivido.success).toBe(true);
    if (revivido.success) expect(revivido.data).toEqual(["t1", "l1", undefined]);
    expect(
      ESQUEMAS.moveTask.safeParse(["t1", "l1", [{ fromStatusId: "a", toStatusId: "b" }]]).success,
    ).toBe(true);
  });

  it("(g) runScheduledAutomations recusa Date inválido e string, aceita Date válido", () => {
    expect(ESQUEMAS.runScheduledAutomations.safeParse(["l1", new Date("garbage")]).success).toBe(false);
    expect(ESQUEMAS.runScheduledAutomations.safeParse(["l1", new Date()]).success).toBe(true);
    expect(ESQUEMAS.runScheduledAutomations.safeParse(["l1", "2026-01-01"]).success).toBe(false);
  });

  it("(h) nenhuma operação cai em fallback — esquemaDeArgumentos(nome) é o próprio ESQUEMAS[nome] para todas as 268", () => {
    const esquemasPorNome = ESQUEMAS as Record<string, unknown>;
    for (const nome of Object.keys(OPERACOES)) {
      expect(esquemaDeArgumentos(nome as NomeDeOperacao)).toBe(esquemasPorNome[nome]);
    }
  });

  it('(i) esquemaDeArgumentos devolve o schema por operação — createChatFolder e updateTask', () => {
    expect(esquemaDeArgumentos("createChatFolder")).toBe(ESQUEMAS.createChatFolder as unknown);
    expect(esquemaDeArgumentos("updateTask")).toBe(ESQUEMAS.updateTask as unknown);
  });

  it("(j) ESQUEMAS cobre exatamente OPERACOES — mesmas chaves, 286, todas nomes de operação válidos", () => {
    const chaves = Object.keys(ESQUEMAS);
    expect(chaves.sort()).toEqual(Object.keys(OPERACOES).sort());
    // 132 + solicitarAprovacao + decideProcessApproval (Plan 02-04, D-06/D-09) + 65 de Ferramentas (notas, captacao, comunidades, grupos, flows) + iniciarConversa + converterSolicitacaoEmContaAPagar (Plan 03-06, D3-08) + alterarStatusEmLote (Plan 03-12, PAG-05) − 5 de Metas (removidas) = 197; +67 do frontend do main, 2026-09-25 (canais, tarefas-conversacionais, updateCompany/addCompanyNote e a IA: agentes, editor de Automação, conhecimento, habilidades, integrações) = 264; + alterarEmailDoConvite e alterarPapelDoMembro (2026-09-28) = 266; + usarCampoHerdado (checklist 1.1, 2026-10-01) = 267; + enviarLinkDeConvite (main a91b852, 2026-10-02) = 268; + updateContainer, archiveContainer, unarchiveContainer, trashContainer e restoreContainer (POSC-09, 2026-10-13) = 273; + createTag, updateTag, archiveTag e restoreTag (AVIS-02, 2026-10-14) = 277; + editTaskComment e deleteTaskComment (FUND-10, 2026-10-14) = 279; + removeChecklist e removeChecklistItem (PARA-01, 2026-10-14) = 281; + spawnCalendarOccurrence e runCalendarRecurrences (FUND-17, 2026-10-14) = 283; + purgeTask e purgeExpiredTasks (PARD-10, 2026-10-14) = 285; + unarchiveForm (POSC-10, 2026-10-14) = 286.
    expect(chaves.length).toBe(286);
    for (const chave of chaves) expect(ehNomeDeOperacao(chave)).toBe(true);
  });
});
