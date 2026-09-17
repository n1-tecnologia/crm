/**
 * `esquemas/ia.ts` — testes puros, sem banco, sem `buildApp`: só a FORMA dos
 * argumentos, nunca regra de negócio. Provam duas coisas: (1) as formas
 * hostis que motivaram CR-02 caem (decisão fora da lista, `title` numérico,
 * `type` de Âncora fora da lista, chave desconhecida); (2) as formas
 * LITERAIS que `apps/web` manda hoje continuam passando — a rede de
 * regressão contra falso positivo de drift.
 */

import { describe, expect, it } from "vitest";
import { IA } from "./ia";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/ia — a forma dos args de ai.ts", () => {
  it("(a) cobertura — as 7 chaves de ai.ts em registro.ts", () => {
    const esperadas = [
      "decideApproval",
      "publishAutomation",
      "restoreAgent",
      "restoreAutomation",
      "createChatSession",
      "configureChatSession",
      "sendChatMessage",
    ].sort();
    expect(Object.keys(IA).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const FORMAS_DO_WEB: ReadonlyArray<readonly [keyof typeof IA, unknown[]]> = [
      ["decideApproval", ["a1", "aprovada"]],
      ["decideApproval", ["a1", "rejeitada", "motivo"]],
      ["publishAutomation", ["au1"]],
      ["restoreAgent", ["agt1"]],
      ["restoreAutomation", ["au1"]],
      ["createChatSession", [{ title: "t" }]],
      [
        "createChatSession",
        [
          {
            title: "t",
            mainAgentId: "agt1",
            anchor: { type: "task", id: "t1" },
            chosenModelId: "mod1",
            folderId: "cfd1",
            skillId: "skl1",
          },
        ],
      ],
      ["configureChatSession", ["cht1", { folderId: null }]],
      ["configureChatSession", ["cht1", { anchor: null, skillId: "s1" }]],
      ["configureChatSession", ["cht1", {}]],
      ["sendChatMessage", ["cht1", "oi"]],
    ];
    for (const [nome, args] of FORMAS_DO_WEB) {
      expect(IA[nome].safeParse(viaJson(args)).success, nome).toBe(true);
    }
  });

  it("(c) formas hostis caem", () => {
    expect(IA.decideApproval.safeParse(viaJson(["a1", "talvez"])).success).toBe(false);
    expect(IA.createChatSession.safeParse(viaJson([{ title: 1 }])).success).toBe(false);
    expect(
      IA.createChatSession.safeParse(viaJson([{ title: "t", anchor: { type: "pombo", id: "x1" } }])).success,
    ).toBe(false);
    expect(
      IA.createChatSession.safeParse(
        viaJson([{ title: "t", anchor: { type: "task", id: "x1", lixo: 1 } }]),
      ).success,
    ).toBe(false);
    expect(IA.configureChatSession.safeParse(viaJson(["cht1", { folderId: 3 }])).success).toBe(false);
    expect(IA.sendChatMessage.safeParse(viaJson(["cht1", {}])).success).toBe(false);
  });
});
