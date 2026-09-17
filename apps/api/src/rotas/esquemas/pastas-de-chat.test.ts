/**
 * `esquemas/pastas-de-chat.ts` — testes puros, sem banco, sem `buildApp`: só
 * a FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem — inclusive o caso (q) de
 * `operacoes.test.ts`, `createChatFolder` com `name: 123`, que passa a cair
 * ANTES de `executar()`; (2) as formas LITERAIS que `apps/web` manda hoje
 * continuam passando.
 */

import { describe, expect, it } from "vitest";
import { PASTAS_DE_CHAT } from "./pastas-de-chat";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/pastas-de-chat — a forma dos args de chat-folders.ts", () => {
  it("(a) cobertura — as 4 chaves de chat-folders.ts em registro.ts", () => {
    const esperadas = [
      "createChatFolder",
      "renameChatFolder",
      "deleteChatFolder",
      "moveChatSessionToFolder",
    ].sort();
    expect(Object.keys(PASTAS_DE_CHAT).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const FORMAS_DO_WEB: ReadonlyArray<readonly [keyof typeof PASTAS_DE_CHAT, unknown[]]> = [
      ["createChatFolder", [{ name: "Pasta" }]],
      ["renameChatFolder", ["cfd1", "Novo"]],
      ["deleteChatFolder", ["cfd1"]],
      ["moveChatSessionToFolder", ["cht1", "cfd1"]],
      ["moveChatSessionToFolder", ["cht1", null]],
    ];
    for (const [nome, args] of FORMAS_DO_WEB) {
      expect(PASTAS_DE_CHAT[nome].safeParse(viaJson(args)).success, nome).toBe(true);
    }
  });

  it("(c) formas hostis caem", () => {
    // O caso (q) de operacoes.test.ts: name: 123 hoje estoura TypeError dentro
    // da operação; com schema próprio, cai aqui, antes de executar().
    expect(PASTAS_DE_CHAT.createChatFolder.safeParse(viaJson([{ name: 123 }])).success).toBe(false);
    expect(
      PASTAS_DE_CHAT.createChatFolder.safeParse(viaJson([{ name: "x", cor: "azul" }])).success,
    ).toBe(false);
    expect(PASTAS_DE_CHAT.createChatFolder.safeParse(viaJson([{}])).success).toBe(false);
    // aridade — null é obrigatório, não ausente.
    expect(PASTAS_DE_CHAT.moveChatSessionToFolder.safeParse(viaJson(["cht1"])).success).toBe(false);
    expect(PASTAS_DE_CHAT.moveChatSessionToFolder.safeParse(viaJson(["cht1", 7])).success).toBe(false);
  });
});
