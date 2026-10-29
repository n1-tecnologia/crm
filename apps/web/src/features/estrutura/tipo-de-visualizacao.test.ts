import { describe, expect, it } from "vitest";
import { abaDaView, kindDaAba, ROTULO_DA_ABA, type TipoDeAba } from "./tipo-de-visualizacao";

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
