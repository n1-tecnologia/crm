/**
 * `esquemas/conversas.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (`content` fora do tipo, chave
 * desconhecida, `kind` de `ActorRef` fora da lista); (2) as formas LITERAIS
 * que `apps/web` manda hoje continuam passando — a rede de regressão contra
 * falso positivo de drift.
 */

import { describe, expect, it } from "vitest";
import { CONVERSAS } from "./conversas";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/conversas — a forma dos args de conversations.ts", () => {
  it("(a) cobertura — as 11 chaves de conversations.ts em registro.ts", () => {
    const esperadas = [
      "sendMessage",
      "resolveConversation",
      "reopenConversation",
      "assignConversation",
      "trashConversation",
      "moveConversationToContact",
      "discardDraft",
      "restoreConversation",
      "startConversation",
      "toggleConversationStar",
      "markConversationRead",
    ].sort();
    expect(Object.keys(CONVERSAS).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const FORMAS_DO_WEB: ReadonlyArray<readonly [keyof typeof CONVERSAS, unknown[]]> = [
      ["sendMessage", [{ conversationId: "cnv1", content: "oi" }]],
      ["sendMessage", [{ conversationId: "cnv1", content: "oi", internal: true }]],
      ["sendMessage", [{ conversationId: "cnv1", content: "oi", templateProviderId: "x" }]],
      ["sendMessage", [{ conversationId: "cnv1", content: "oi", actor: { kind: "agent", id: "a" } }]],
      ["sendMessage", [{ conversationId: "cnv1", content: "oi", delegate: { kind: "agent", id: "a" } }]],
      ["sendMessage", [{ conversationId: "cnv1", content: "oi", adoptedDraftOf: { kind: "agent", id: "a" } }]],
      ["resolveConversation", ["cnv1"]],
      ["reopenConversation", ["cnv1"]],
      ["assignConversation", ["cnv1", { kind: "member", id: "m1" }]],
      ["assignConversation", ["cnv1", undefined]],
      ["trashConversation", ["cnv1"]],
      ["moveConversationToContact", ["cnv1", "c1"]],
      ["moveConversationToContact", ["cnv1", "c1", true]],
      ["discardDraft", ["cnv1", { kind: "agent", id: "a" }]],
      ["restoreConversation", ["cnv1"]],
      ["startConversation", ["ch1", "c1"]],
      ["toggleConversationStar", ["cnv1"]],
      ["markConversationRead", ["cnv1"]],
    ];
    for (const [nome, args] of FORMAS_DO_WEB) {
      expect(CONVERSAS[nome].safeParse(viaJson(args)).success, nome).toBe(true);
    }

    const semAtribuido = CONVERSAS.assignConversation.safeParse(viaJson(["cnv1", undefined]));
    expect(semAtribuido.success).toBe(true);
    if (semAtribuido.success) expect(semAtribuido.data).toEqual(["cnv1", undefined]);
  });

  it("(c) formas hostis caem", () => {
    expect(CONVERSAS.sendMessage.safeParse(viaJson([{ conversationId: "cnv1", content: 123 }])).success).toBe(
      false,
    );
    expect(
      CONVERSAS.sendMessage.safeParse(viaJson([{ conversationId: "cnv1", content: "x", anexo: {} }])).success,
    ).toBe(false);
    expect(
      CONVERSAS.sendMessage.safeParse(
        viaJson([{ conversationId: "cnv1", content: "x", actor: { kind: "robo", id: "a" } }]),
      ).success,
    ).toBe(false);
    expect(CONVERSAS.assignConversation.safeParse(viaJson(["cnv1", "m1"])).success).toBe(false);
    expect(CONVERSAS.moveConversationToContact.safeParse(viaJson(["cnv1", "c1", "sim"])).success).toBe(false);
  });
});
