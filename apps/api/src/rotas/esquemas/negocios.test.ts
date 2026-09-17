/**
 * `esquemas/negocios.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (`funnelId` numérico, `value`
 * malformado, chave desconhecida, enum fora da lista); (2) as formas
 * LITERAIS que `apps/web` manda hoje continuam passando — a rede de
 * regressão contra falso positivo de drift.
 */

import { describe, expect, it } from "vitest";
import { NEGOCIOS } from "./negocios";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/negocios — a forma dos args de deals.ts", () => {
  it("(a) cobertura — as 12 chaves de deals.ts em registro.ts", () => {
    const esperadas = [
      "moveDealToStage",
      "winDeal",
      "loseDeal",
      "reopenDeal",
      "linkContactToDeal",
      "removeStage",
      "migrateDealsToFunnel",
      "restoreDeal",
      "moveDealToFunnel",
      "createDeal",
      "unlinkContactFromDeal",
      "setDealFieldValue",
    ].sort();
    expect(Object.keys(NEGOCIOS).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const FORMAS_DO_WEB: ReadonlyArray<readonly [keyof typeof NEGOCIOS, unknown[]]> = [
      ["moveDealToStage", ["d1", "s1"]],
      ["winDeal", ["d1", {}]],
      ["winDeal", ["d1", { value: { amount: 10, currency: "BRL" }, winReasonId: "r1", closingNote: "n" }]],
      ["loseDeal", ["d1", { lossReasonId: "r1" }]],
      ["reopenDeal", ["d1"]],
      ["linkContactToDeal", ["d1", "c1", "decisor"]],
      ["removeStage", ["f1", "s1", "s2"]],
      ["migrateDealsToFunnel", ["f1", "f2", [{ fromStatusId: "a", toStatusId: "b" }], "abertos"]],
      ["migrateDealsToFunnel", ["f1", "f2", [{ fromStatusId: "a", toStatusId: "b" }]]],
      ["restoreDeal", ["d1"]],
      ["moveDealToFunnel", ["d1", "f2", "s2"]],
      ["moveDealToFunnel", ["d1", "f2", "s2", undefined]],
      ["createDeal", [{ title: "t", funnelId: "f1" }]],
      [
        "createDeal",
        [
          {
            title: "t",
            funnelId: "f1",
            companyId: "c1",
            contactId: "ct1",
            value: { amount: 10, currency: "BRL" },
            originId: "o1",
            ownerMemberId: "m1",
          },
        ],
      ],
      ["unlinkContactFromDeal", ["d1", "l1"]],
      ["setDealFieldValue", ["d1", "fd1", ["a"]]],
      ["setDealFieldValue", ["d1", "fd1", null]],
      ["setDealFieldValue", ["d1", "fd1", 3]],
    ];
    for (const [nome, args] of FORMAS_DO_WEB) {
      expect(NEGOCIOS[nome].safeParse(viaJson(args)).success, nome).toBe(true);
    }

    const moveComNull = NEGOCIOS.moveDealToFunnel.safeParse(viaJson(["d1", "f2", "s2", undefined]));
    expect(moveComNull.success).toBe(true);
    if (moveComNull.success) expect(moveComNull.data).toEqual(["d1", "f2", "s2", undefined]);
  });

  it("(c) formas hostis caem", () => {
    expect(NEGOCIOS.createDeal.safeParse(viaJson([{ title: "t", funnelId: 42 }])).success).toBe(false);
    expect(
      NEGOCIOS.createDeal.safeParse(
        viaJson([{ title: "t", funnelId: "f1", value: { amount: "10", currency: "BRL" } }]),
      ).success,
    ).toBe(false);
    expect(NEGOCIOS.createDeal.safeParse(viaJson([{ title: "t", funnelId: "f1", lixo: 1 }])).success).toBe(false);
    expect(NEGOCIOS.linkContactToDeal.safeParse(viaJson(["d1", "c1", "chefe"])).success).toBe(false);
    expect(
      NEGOCIOS.migrateDealsToFunnel.safeParse(viaJson(["f1", "f2", [{ fromStatusId: "a" }]])).success,
    ).toBe(false);
    expect(
      NEGOCIOS.migrateDealsToFunnel.safeParse(
        viaJson(["f1", "f2", [{ fromStatusId: "a", toStatusId: "b" }], "fechados"]),
      ).success,
    ).toBe(false);
    expect(NEGOCIOS.winDeal.safeParse(viaJson(["d1", { value: { amount: 10 } }])).success).toBe(false);
    expect(NEGOCIOS.moveDealToStage.safeParse(viaJson(["d1"])).success).toBe(false);
  });
});
