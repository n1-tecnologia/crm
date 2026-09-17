/**
 * `esquemas/construtor-de-agentes.ts` — testes puros, sem banco, sem
 * `buildApp`: só a FORMA dos argumentos, nunca regra de negócio. Provam duas
 * coisas: (1) as formas hostis que motivaram CR-02 caem — inclusive nos
 * quatro níveis de `AgentDraft`, a forma mais funda do registro; (2) o
 * `AgentDraft` literal que `agent-builder.tsx` manda hoje continua passando.
 */

import { describe, expect, it } from "vitest";
import { CONSTRUTOR_DE_AGENTES } from "./construtor-de-agentes";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

const AGENT_DRAFT_LITERAL = {
  name: "Assistente",
  description: "Ajuda no que precisar",
  instructions: "Responda com clareza.",
  modelId: "",
  allowedToolIds: ["t1"],
  icebreakers: ["Oi!"],
  knowledgeSources: [{ kind: "url", label: "https://exemplo.com" }],
  responseFormat: "texto",
  accessPoints: ["chat"],
};

describe("esquemas/construtor-de-agentes — a forma dos args de agent-builder.ts", () => {
  it("(a) cobertura — as 2 chaves de agent-builder.ts em registro.ts", () => {
    const esperadas = ["createAgent", "publishAgentVersion"].sort();
    expect(Object.keys(CONSTRUTOR_DE_AGENTES).sort()).toEqual(esperadas);
  });

  it("(b) o AgentDraft literal de agent-builder.tsx passa", () => {
    expect(
      CONSTRUTOR_DE_AGENTES.createAgent.safeParse(viaJson([AGENT_DRAFT_LITERAL])).success,
    ).toBe(true);
    expect(
      CONSTRUTOR_DE_AGENTES.publishAgentVersion.safeParse(viaJson(["agt1", AGENT_DRAFT_LITERAL])).success,
    ).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(
      CONSTRUTOR_DE_AGENTES.createAgent.safeParse(
        viaJson([{ ...AGENT_DRAFT_LITERAL, responseFormat: "xml" }]),
      ).success,
    ).toBe(false);
    expect(
      CONSTRUTOR_DE_AGENTES.createAgent.safeParse(
        viaJson([{ ...AGENT_DRAFT_LITERAL, knowledgeSources: [{ kind: "pdf", label: "x" }] }]),
      ).success,
    ).toBe(false);
    expect(
      CONSTRUTOR_DE_AGENTES.createAgent.safeParse(
        viaJson([{ ...AGENT_DRAFT_LITERAL, accessPoints: ["sms"] }]),
      ).success,
    ).toBe(false);
    expect(
      CONSTRUTOR_DE_AGENTES.createAgent.safeParse(viaJson([{ ...AGENT_DRAFT_LITERAL, lixo: 1 }])).success,
    ).toBe(false);
    const { instructions, ...semInstructions } = AGENT_DRAFT_LITERAL;
    void instructions;
    expect(CONSTRUTOR_DE_AGENTES.createAgent.safeParse(viaJson([semInstructions])).success).toBe(false);
  });
});
