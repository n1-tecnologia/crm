/**
 * `esquemas-de-argumentos.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (`title: 123`, `description: {}`,
 * chave desconhecida, `Date` inválido, tupla com argumento a mais); (2) as
 * formas LITERAIS que `apps/web` manda hoje continuam passando — a rede de
 * regressão contra falso positivo de drift.
 */

import { describe, expect, it } from "vitest";
import { ehNomeDeOperacao } from "@n1/dominio/operations/registro";
import { ARGUMENTOS_GENERICOS, ESQUEMAS, esquemaDeArgumentos } from "./esquemas-de-argumentos";

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

  it("(h) ARGUMENTOS_GENERICOS aceita formas soltas, limita profundidade e recusa Date inválido", () => {
    expect(ARGUMENTOS_GENERICOS.safeParse([{ name: 123 }, [new Date()], null, "x", true]).success).toBe(true);

    const fundo = (n: number): unknown => (n === 0 ? 1 : { a: fundo(n - 1) });
    expect(ARGUMENTOS_GENERICOS.safeParse([fundo(6)]).success).toBe(true);
    expect(ARGUMENTOS_GENERICOS.safeParse([fundo(7)]).success).toBe(false);

    expect(ARGUMENTOS_GENERICOS.safeParse([new Date("garbage")]).success).toBe(false);

    expect(
      ARGUMENTOS_GENERICOS.safeParse([
        { knowledgeSources: [{ kind: "url", label: "https://exemplo.com" }], nomes: ["a", "b"] },
      ]).success,
    ).toBe(true);
  });

  it('(i) esquemaDeArgumentos devolve o schema por operação quando existe, e o estrutural quando não', () => {
    expect(esquemaDeArgumentos("createChatFolder")).toBe(ARGUMENTOS_GENERICOS);
    expect(esquemaDeArgumentos("updateTask")).toBe(ESQUEMAS.updateTask as unknown);
  });

  it("(j) ESQUEMAS tem exatamente 23 entradas, todas nomes de operação válidos", () => {
    const chaves = Object.keys(ESQUEMAS);
    expect(chaves.length).toBe(23);
    for (const chave of chaves) expect(ehNomeDeOperacao(chave)).toBe(true);
  });
});
