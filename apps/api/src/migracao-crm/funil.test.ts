/** O planejador de Funis (D-15-04) é puro: decide o que migra, o que não migra e qual nasce padrão. */

import { describe, expect, it } from "vitest";
import type { FunilAntigo } from "./formatos-antigos";
import { planejarFunis } from "./funil";

const etapa = (id: string, name: string, order: number, defaultProbability = 0) => ({ id, name, order, defaultProbability });

function funilAntigo(sobre: Partial<FunilAntigo> & Pick<FunilAntigo, "id" | "name">): FunilAntigo {
  return { order: 0, isPrivate: false, lifecycle: "ativo", stages: [etapa("stg_1", "Novo", 0)], ...sobre };
}

describe("planejarFunis", () => {
  it("--funil=guardar: nada migra", () => {
    const plano = planejarFunis([funilAntigo({ id: "fnl_a", name: "A" })], [], "guardar");
    expect(plano.aInserir).toEqual([]);
    expect(plano.naoMigrados).toEqual([]);
  });

  it("Espaço sem Funil no CRM novo: o primeiro Funil elegível nasce padrão, os outros não", () => {
    const plano = planejarFunis(
      [funilAntigo({ id: "fnl_b", name: "B", order: 1 }), funilAntigo({ id: "fnl_a", name: "A", order: 0 })],
      [],
      "migrar",
    );
    expect(plano.aInserir.map((f) => [f.id, f.padrao])).toEqual([
      ["fnl_a", true],
      ["fnl_b", false],
    ]);
  });

  it("prefere como padrão o Funil que o Espaço apontava, se for elegível", () => {
    const plano = planejarFunis(
      [funilAntigo({ id: "fnl_a", name: "A", order: 0 }), funilAntigo({ id: "fnl_b", name: "B", order: 1 })],
      [],
      "migrar",
      "fnl_b",
    );
    expect(plano.aInserir.find((f) => f.padrao)?.id).toBe("fnl_b");
  });

  it("Espaço que já tem Funil padrão: migra sem padrão", () => {
    const plano = planejarFunis([funilAntigo({ id: "fnl_a", name: "A" })], [{ id: "fnl_x", nome: "X", padrao: true, estado: "ativo" }], "migrar");
    expect(plano.aInserir.map((f) => [f.id, f.padrao])).toEqual([["fnl_a", false]]);
  });

  it("Funil privado ou arquivado nunca nasce padrão", () => {
    const plano = planejarFunis(
      [funilAntigo({ id: "fnl_p", name: "P", isPrivate: true }), funilAntigo({ id: "fnl_q", name: "Q", lifecycle: "arquivado" })],
      [],
      "migrar",
    );
    expect(plano.aInserir.every((f) => !f.padrao)).toBe(true);
    expect(plano.aInserir.find((f) => f.id === "fnl_q")?.estado).toBe("arquivado");
  });

  it("nome em uso (sem distinguir caixa nem espaços nas pontas): não migra e diz o motivo", () => {
    const plano = planejarFunis([funilAntigo({ id: "fnl_a", name: "  vendas " })], [{ id: "fnl_x", nome: "Vendas", padrao: false, estado: "ativo" }], "migrar");
    expect(plano.aInserir).toEqual([]);
    expect(plano.naoMigrados).toEqual([{ id: "fnl_a", nome: "  vendas ", motivo: "nome em uso" }]);
  });

  it("nome igual a um Funil que está na lixeira não conflita", () => {
    const plano = planejarFunis([funilAntigo({ id: "fnl_a", name: "Vendas" })], [{ id: "fnl_x", nome: "Vendas", padrao: false, estado: "na_lixeira" }], "migrar");
    expect(plano.aInserir.map((f) => f.id)).toEqual(["fnl_a"]);
  });

  it("dois Funis antigos com o mesmo nome: o primeiro migra, o segundo diz 'nome em uso'", () => {
    const plano = planejarFunis([funilAntigo({ id: "fnl_a", name: "Vendas", order: 0 }), funilAntigo({ id: "fnl_b", name: "vendas", order: 1 })], [], "migrar");
    expect(plano.aInserir.map((f) => f.id)).toEqual(["fnl_a"]);
    expect(plano.naoMigrados.map((f) => f.motivo)).toEqual(["nome em uso"]);
  });

  it("id que já existe no CRM novo: não migra", () => {
    const plano = planejarFunis([funilAntigo({ id: "fnl_a", name: "A" })], [{ id: "fnl_a", nome: "Outro nome", padrao: false, estado: "ativo" }], "migrar");
    expect(plano.aInserir).toEqual([]);
    expect(plano.naoMigrados[0]?.motivo).toBe("id já existe no CRM novo");
  });

  it("Etapas: ordem 1..N pela ordem antiga, probabilidade limitada a 0-100, nome repetido barra o Funil", () => {
    const bom = planejarFunis(
      [funilAntigo({ id: "fnl_a", name: "A", stages: [etapa("s2", "Segunda", 5, 250), etapa("s1", "Primeira", 2, 10.4)] })],
      [],
      "migrar",
    );
    expect(bom.aInserir[0]?.etapas.map((e) => [e.idAntigo, e.ordem, e.probabilidade])).toEqual([
      ["s1", 1, 10],
      ["s2", 2, 100],
    ]);
    const repetido = planejarFunis([funilAntigo({ id: "fnl_a", name: "A", stages: [etapa("s1", "Igual", 0), etapa("s2", "igual ", 1)] })], [], "migrar");
    expect(repetido.aInserir).toEqual([]);
    expect(repetido.naoMigrados[0]?.motivo).toBe("Etapas com nome repetido");
  });

  it("Funil sem Etapa ou sem nome não migra", () => {
    const plano = planejarFunis([funilAntigo({ id: "fnl_a", name: "A", stages: [] }), funilAntigo({ id: "fnl_b", name: "   " })], [], "migrar");
    expect(plano.aInserir).toEqual([]);
    expect(plano.naoMigrados.map((f) => f.motivo)).toEqual(["sem Etapa", "sem nome"]);
  });
});
