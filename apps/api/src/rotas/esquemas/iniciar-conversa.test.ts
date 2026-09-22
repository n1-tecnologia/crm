/**
 * `esquemas/iniciar-conversa.ts` — testes puros, sem banco, sem `buildApp`:
 * só a FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1)
 * a forma hostil que motivou CR-02 (chave desconhecida, `value` malformado)
 * cai; (2) a forma LITERAL que `apps/web` manda continua passando.
 */

import { describe, expect, it } from "vitest";
import { INICIAR_CONVERSA } from "./iniciar-conversa";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/iniciar-conversa — a forma dos args de iniciar-conversa.ts", () => {
  it("(a) cobertura — a 1 chave de iniciar-conversa.ts em registro.ts", () => {
    expect(Object.keys(INICIAR_CONVERSA).sort()).toEqual(["iniciarConversa"]);
  });

  it("(b) formas literais do web passam", () => {
    expect(
      INICIAR_CONVERSA.iniciarConversa.safeParse(
        viaJson([{ listId: "lst_1", contactId: "cnt_1", stageId: "stg_1", channelId: "cnl_1" }]),
      ).success,
    ).toBe(true);
    expect(
      INICIAR_CONVERSA.iniciarConversa.safeParse(
        viaJson([
          {
            listId: "lst_1",
            contactId: "cnt_1",
            stageId: "stg_1",
            channelId: "cnl_1",
            title: "Negócio novo",
            value: { amount: 1000, currency: "BRL" },
            qualificationId: "qlf_1",
            temperatureId: "tmp_1",
          },
        ]),
      ).success,
    ).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(INICIAR_CONVERSA.iniciarConversa.safeParse(viaJson([{ listId: "lst_1", contactId: "cnt_1", stageId: "stg_1" }])).success).toBe(false);
    expect(
      INICIAR_CONVERSA.iniciarConversa.safeParse(
        viaJson([{ listId: "lst_1", contactId: "cnt_1", stageId: "stg_1", channelId: "cnl_1", value: { amount: "100", currency: "BRL" } }]),
      ).success,
    ).toBe(false);
    expect(
      INICIAR_CONVERSA.iniciarConversa.safeParse(
        viaJson([{ listId: "lst_1", contactId: "cnt_1", stageId: "stg_1", channelId: "cnl_1", lixo: 1 }]),
      ).success,
    ).toBe(false);
  });
});
