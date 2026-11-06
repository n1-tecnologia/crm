/**
 * `esquemas/conversas.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (`kind` de `ActorRef` fora da lista,
 * `assignConversation` com texto no lugar do Ator); (2) as formas LITERAIS que
 * `apps/web` manda hoje (a Conversa de grupo na Caixa) continuam passando — a
 * rede de regressão contra falso positivo de drift.
 *
 * 15-32: só as cinco operações de Conversa que a Conversa de grupo ainda chama
 * pelo store seguem no registro; as outras seis saíram.
 */

import { describe, expect, it } from "vitest";
import { CONVERSAS } from "./conversas";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/conversas — a forma dos args das operações da Conversa de grupo", () => {
  it("(a) cobertura — as cinco chaves de conversa-de-grupo.ts em registro.ts", () => {
    const esperadas = [
      "resolveConversation",
      "reopenConversation",
      "assignConversation",
      "trashConversation",
      "toggleConversationStar",
    ].sort();
    expect(Object.keys(CONVERSAS).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const FORMAS_DO_WEB: ReadonlyArray<readonly [keyof typeof CONVERSAS, unknown[]]> = [
      ["resolveConversation", ["cnv1"]],
      ["reopenConversation", ["cnv1"]],
      ["assignConversation", ["cnv1", { kind: "member", id: "m1" }]],
      ["assignConversation", ["cnv1", undefined]],
      ["trashConversation", ["cnv1"]],
      ["toggleConversationStar", ["cnv1"]],
    ];
    for (const [nome, args] of FORMAS_DO_WEB) {
      expect(CONVERSAS[nome].safeParse(viaJson(args)).success, nome).toBe(true);
    }

    const semAtribuido = CONVERSAS.assignConversation.safeParse(viaJson(["cnv1", undefined]));
    expect(semAtribuido.success).toBe(true);
    if (semAtribuido.success) expect(semAtribuido.data).toEqual(["cnv1", undefined]);
  });

  it("(c) formas hostis caem", () => {
    expect(CONVERSAS.assignConversation.safeParse(viaJson(["cnv1", "m1"])).success).toBe(false);
    expect(CONVERSAS.assignConversation.safeParse(viaJson(["cnv1", { kind: "robo", id: "a" }])).success).toBe(false);
    expect(CONVERSAS.resolveConversation.safeParse(viaJson(["cnv1", "sobra"])).success).toBe(false);
  });
});
