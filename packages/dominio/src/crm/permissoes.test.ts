/**
 * A matriz de D-14, como tabela: quem lê, quem escreve e quem configura Funil.
 * `podeNoCrm` devolve `undefined` quando pode e a frase de recusa quando não
 * pode — a mesma forma de `mayWriteDeal`.
 */

import { describe, expect, it } from "vitest";
import type { MemberState, SystemRole } from "../types/workspace";
import { ehAdministracao, podeNoCrm, type AcaoCrm, type RecursoCrm } from "./permissoes";

const BASES: readonly SystemRole[] = ["proprietario", "administrador", "membro", "convidado"];
const RECURSOS: readonly RecursoCrm[] = ["contato", "empresa", "funil", "negocio"];
const ESCRITAS: readonly AcaoCrm[] = [
  "criar",
  "editar",
  "arquivar",
  "enviar_para_lixeira",
  "restaurar",
  "excluir_permanentemente",
  "mover",
  "ganhar",
  "perder",
  "reabrir",
  "definir_padrao",
];

describe("podeNoCrm — leitura (a)", () => {
  const casos = BASES.flatMap((base) => RECURSOS.map((recurso) => [base, recurso] as const));

  it.each(casos)("%s lê %s quando ativo", (base, recurso) => {
    expect(podeNoCrm(base, "ativo", "ler", recurso)).toBeUndefined();
  });

  it.each(casos)("%s lê %s quando suspenso", (base, recurso) => {
    expect(podeNoCrm(base, "suspenso", "ler", recurso)).toBeUndefined();
  });

  it.each(["pendente", "removido"] as const satisfies readonly MemberState[])(
    "Membro %s não lê o CRM",
    (estado) => {
      for (const base of BASES) {
        for (const recurso of RECURSOS) {
          expect(podeNoCrm(base, estado, "ler", recurso)).toEqual(expect.any(String));
        }
      }
    },
  );

  it("Membro desconhecido não é encontrado", () => {
    expect(podeNoCrm(undefined, undefined, "ler", "contato")).toBe("Membro não encontrado neste Espaço de Trabalho.");
    expect(podeNoCrm("membro", undefined, "criar", "contato")).toBe("Membro não encontrado neste Espaço de Trabalho.");
  });
});

describe("podeNoCrm — escrita (b)", () => {
  const casos = BASES.flatMap((base) =>
    RECURSOS.flatMap((recurso) => ESCRITAS.map((acao) => [base, recurso, acao] as const)),
  );

  it.each(casos)("%s suspenso não escreve (%s, %s)", (base, recurso, acao) => {
    expect(podeNoCrm(base, "suspenso", acao, recurso)).toBe("Só um Membro ativo altera o CRM.");
  });

  it.each(casos)("%s pendente ou removido não escreve (%s, %s)", (base, recurso, acao) => {
    expect(podeNoCrm(base, "pendente", acao, recurso)).toBe("Só um Membro ativo altera o CRM.");
    expect(podeNoCrm(base, "removido", acao, recurso)).toBe("Só um Membro ativo altera o CRM.");
  });
});

describe("podeNoCrm — Convidado só consulta (c)", () => {
  const casos = RECURSOS.flatMap((recurso) => ESCRITAS.map((acao) => [recurso, acao] as const));

  it.each(casos)("convidado ativo não escreve em %s (%s)", (recurso, acao) => {
    const frase = podeNoCrm("convidado", "ativo", acao, recurso);
    expect(frase).toContain("Convidado");
    expect(frase).toContain("consulta");
  });
});

describe("podeNoCrm — Membro (d)", () => {
  const recursosDeTrabalho: readonly RecursoCrm[] = ["contato", "empresa", "negocio"];
  const casos = recursosDeTrabalho.flatMap((recurso) =>
    ESCRITAS.filter((acao) => acao !== "reabrir").map((acao) => [recurso, acao] as const),
  );

  it.each(casos)("membro ativo escreve em %s (%s)", (recurso, acao) => {
    expect(podeNoCrm("membro", "ativo", acao, recurso)).toBeUndefined();
  });

  it.each(ESCRITAS)("membro ativo não escreve em funil (%s) — RN-FUN-17", (acao) => {
    expect(podeNoCrm("membro", "ativo", acao, "funil")).toContain("RN-FUN-17");
  });

  it("definir_padrao de Funil é só da administração", () => {
    expect(podeNoCrm("membro", "ativo", "definir_padrao", "funil")).toContain("RN-FUN-17");
    expect(podeNoCrm("administrador", "ativo", "definir_padrao", "funil")).toBeUndefined();
  });
});

describe("podeNoCrm — reabrir Negócio (e)", () => {
  it("membro não reabre Negócio ganho — RN-NEG-10", () => {
    expect(podeNoCrm("membro", "ativo", "reabrir", "negocio", { situacao: "ganho" })).toContain("RN-NEG-10");
  });

  it("membro reabre Negócio perdido", () => {
    expect(podeNoCrm("membro", "ativo", "reabrir", "negocio", { situacao: "perdido" })).toBeUndefined();
  });

  it.each(["administrador", "proprietario"] as const)("%s reabre Negócio ganho e perdido", (base) => {
    expect(podeNoCrm(base, "ativo", "reabrir", "negocio", { situacao: "ganho" })).toBeUndefined();
    expect(podeNoCrm(base, "ativo", "reabrir", "negocio", { situacao: "perdido" })).toBeUndefined();
  });
});

describe("podeNoCrm — Funil é da administração (f)", () => {
  it.each(["administrador", "proprietario"] as const)("%s escreve em funil em todas as ações", (base) => {
    for (const acao of ESCRITAS) {
      expect(podeNoCrm(base, "ativo", acao, "funil")).toBeUndefined();
    }
  });
});

describe("ehAdministracao", () => {
  it("só administrador e proprietario", () => {
    expect(ehAdministracao("administrador")).toBe(true);
    expect(ehAdministracao("proprietario")).toBe(true);
    expect(ehAdministracao("membro")).toBe(false);
    expect(ehAdministracao("convidado")).toBe(false);
    expect(ehAdministracao(undefined)).toBe(false);
  });
});
