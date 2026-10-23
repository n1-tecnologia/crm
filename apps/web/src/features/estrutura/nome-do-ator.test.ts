/**
 * Fase 9, D-03 / R5 — o Convidado recebe `agents: []`; onde a tela procurava o
 * nome do Agente aparece "Agente", nunca "—" nem um espaço vazio.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { nomeDoAgente } from "./nome-do-ator";

describe("nomeDoAgente", () => {
  const estado = buildSeed();
  const agente = estado.agents[0]!;

  it("devolve o nome do Agente quando o registro está no estado", () => {
    expect(nomeDoAgente(estado, agente.id)).toBe(agente.name);
  });

  it("devolve 'Agente' quando a coleção não chega (Convidado)", () => {
    expect(nomeDoAgente({ ...estado, agents: [] }, agente.id)).toBe("Agente");
  });

  it("devolve 'Agente' para um id que não existe", () => {
    expect(nomeDoAgente(estado, "agt_que_nao_existe")).toBe("Agente");
  });
});
