import { describe, expect, it } from "vitest";
import { abaDaView, abaInicialDaLista, abasDaLista, kindDaAba, ROTULO_DA_ABA, type TipoDeAba } from "./tipo-de-visualizacao";

describe("tipo de Visualização — aba ↔ kind", () => {
  it("vai e volta para todas as abas", () => {
    for (const aba of Object.keys(ROTULO_DA_ABA) as TipoDeAba[]) expect(abaDaView(kindDaAba(aba))).toBe(aba);
  });
  it("linha do tempo é o único nome que muda; sem kind, abre na Lista", () => {
    expect(kindDaAba("linha")).toBe("linhaDoTempo");
    expect(abaDaView("linhaDoTempo")).toBe("linha");
    expect(abaDaView("quadro")).toBe("quadro");
    expect(abaDaView(undefined)).toBe("lista");
  });
  it("tem cinco abas, sem Carga", () => {
    expect(Object.keys(ROTULO_DA_ABA)).toHaveLength(5);
  });
  it("é total: uma Visualização salva do tipo carga (ainda sem a 010) abre na Lista", () => {
    expect(abaDaView("carga" as never)).toBe("lista");
    expect(abaDaView("qualquer" as never)).toBe("lista");
  });
});

describe("abasDaLista — as abas vêm da configuração efetiva, filtradas pela lente (2.6.2, D-07)", () => {
  const TODOS = ["lista", "quadro", "calendario", "tabela", "linhaDoTempo"] as const;

  it("a lista comum e a financeira mostram os cinco tipos na ordem da barra", () => {
    expect(abasDaLista(TODOS, "comum")).toEqual(["lista", "quadro", "calendario", "tabela", "linha"]);
    expect(abasDaLista(TODOS, "financeira")).toEqual(["lista", "quadro", "calendario", "tabela", "linha"]);
  });

  it("a conversacional perde a Linha do tempo", () => {
    expect(abasDaLista(TODOS, "conversacional")).toEqual(["lista", "quadro", "calendario", "tabela"]);
  });

  it("segue a ordem da barra, não a de `disponiveis`", () => {
    expect(abasDaLista(["tabela", "quadro"], "comum")).toEqual(["quadro", "tabela"]);
  });

  it("só o que o Espaço liberou: sem Calendário, a aba some", () => {
    expect(abasDaLista(["lista", "quadro", "tabela", "linhaDoTempo"], "comum")).not.toContain("calendario");
  });

  it("a interseção vazia com a lente mostra só a aba Lista", () => {
    expect(abasDaLista(["linhaDoTempo"], "conversacional")).toEqual(["lista"]);
  });
});

describe("abaInicialDaLista — padrão salva, depois a inicial, depois a primeira (D-06)", () => {
  it("a Visualização salva padrão vence quando o tipo dela está nas abas", () => {
    expect(abaInicialDaLista(["lista", "quadro"], { kind: "quadro" }, "lista")).toBe("quadro");
    expect(abaInicialDaLista(["lista", "linha"], { kind: "linhaDoTempo" }, "lista")).toBe("linha");
  });

  it("padrão salva de tipo fora das abas é ignorada: abre na inicial", () => {
    expect(abaInicialDaLista(["lista", "quadro"], { kind: "calendario" }, "quadro")).toBe("quadro");
  });

  it("sem padrão salva, abre na inicial da configuração", () => {
    expect(abaInicialDaLista(["lista", "quadro", "tabela"], undefined, "tabela")).toBe("tabela");
  });

  it("inicial fora das abas mostradas (a lente a tirou) cai na primeira mostrada", () => {
    expect(abaInicialDaLista(["lista", "quadro"], undefined, "linhaDoTempo")).toBe("lista");
    expect(abaInicialDaLista(["quadro", "tabela"], undefined, "linhaDoTempo")).toBe("quadro");
  });
});
