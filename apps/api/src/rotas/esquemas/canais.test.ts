/**
 * `esquemas/canais.ts` — testes puros, sem banco: só a FORMA dos argumentos.
 * (a) cobertura, (b) as formas LITERAIS de `apps/web` passam, (c) formas
 * hostis caem.
 */

import { describe, expect, it } from "vitest";
import { CANAIS } from "./canais";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/canais — a forma dos args de canais.ts", () => {
  it("(a) cobertura — as 2 chaves de canais.ts em registro.ts", () => {
    expect(Object.keys(CANAIS).sort()).toEqual(["configurarCanal", "criarCanal"]);
  });

  it("(b) formas literais do web passam", () => {
    // adicionar-canal-dialog.tsx
    expect(
      CANAIS.criarCanal.safeParse(viaJson([{ channelType: "whatsapp", name: "Vendas", externalId: "+55 11 99999-0000" }]))
        .success,
    ).toBe(true);
    expect(
      CANAIS.criarCanal.safeParse(
        viaJson([{ channelType: "email", name: "Suporte", externalId: "a@b.c", defaultQueueId: "q1", defaultOriginId: "o1" }]),
      ).success,
    ).toBe(true);
    // configuracoes/canais/[canal]/page.tsx
    expect(CANAIS.configurarCanal.safeParse(viaJson(["ch1", { defaultQueueId: "q1" }])).success).toBe(true);
    expect(CANAIS.configurarCanal.safeParse(viaJson(["ch1", { defaultQueueId: null }])).success).toBe(true);
    expect(CANAIS.configurarCanal.safeParse(viaJson(["ch1", { defaultOriginId: null }])).success).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(CANAIS.criarCanal.safeParse([{ channelType: "telegram", name: "x", externalId: "y" }]).success).toBe(false);
    expect(CANAIS.criarCanal.safeParse([{ channelType: "whatsapp", name: "x", externalId: "y", extra: 1 }]).success).toBe(false);
    expect(CANAIS.configurarCanal.safeParse(["ch1", { channelType: "email" }]).success).toBe(false);
  });
});
