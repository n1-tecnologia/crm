/** A Pasta "Meus negócios" (D-15-14): o planejador é puro, a remoção mexe só em Pasta, Listas e Visualizações. */

import { describe, expect, it } from "vitest";
import type { EstadoComPasta } from "./formatos-antigos";
import { chavesDaPasta, planejarPasta, removerPasta } from "./pasta-meus-negocios";

function estadoBase(sobre: Partial<EstadoComPasta> = {}): EstadoComPasta {
  return {
    folders: [
      { id: "fld_meus_negocios", name: "Meus negócios" },
      { id: "fld_outra", name: "Outra" },
    ],
    lists: [
      { id: "lst_funil_a", name: "A", parentType: "folder", parentId: "fld_meus_negocios" },
      { id: "lst_funil_b", name: "B", parentType: "folder", parentId: "fld_meus_negocios" },
      { id: "lst_solta", name: "Solta", parentType: "folder", parentId: "fld_outra" },
    ],
    views: [
      { id: "viw_a", listId: "lst_funil_a" },
      { id: "viw_b", listId: "lst_funil_b" },
      { id: "viw_solta", listId: "lst_solta" },
    ],
    tasks: [{ id: "tsk_solta", listId: "lst_solta" }],
    ...sobre,
  };
}

describe("planejarPasta", () => {
  it("sem a Pasta: nada a fazer", () => {
    const plano = planejarPasta(estadoBase({ folders: [{ id: "fld_outra", name: "Outra" }] }));
    expect(plano).toMatchObject({ existe: false, removivel: false, listas: [] });
  });

  it("Listas vazias: removível, e só as Listas da Pasta entram", () => {
    const plano = planejarPasta(estadoBase());
    expect(plano.existe).toBe(true);
    expect(plano.removivel).toBe(true);
    expect(plano.listas.map((l) => [l.id, l.tarefas])).toEqual([
      ["lst_funil_a", 0],
      ["lst_funil_b", 0],
    ]);
  });

  it("uma Lista com Tarefa (de qualquer estado) impede a remoção da Pasta inteira", () => {
    const plano = planejarPasta(estadoBase({ tasks: [{ id: "t1", listId: "lst_funil_b" }, { id: "t2", listId: "lst_funil_b" }] }));
    expect(plano.removivel).toBe(false);
    expect(plano.listas.find((l) => l.id === "lst_funil_b")?.tarefas).toBe(2);
  });

  it("Pasta sem nenhuma Lista é removível", () => {
    const plano = planejarPasta(estadoBase({ lists: [] , views: []}));
    expect(plano.removivel).toBe(true);
  });
});

describe("chavesDaPasta e removerPasta", () => {
  it("as chaves são a Pasta, as Listas e as Visualizações dela, e mais nada", () => {
    const estado = estadoBase();
    expect(chavesDaPasta(estado, planejarPasta(estado)).map((c) => `${c.colecao}:${c.id}`).sort()).toEqual([
      "folders:fld_meus_negocios",
      "lists:lst_funil_a",
      "lists:lst_funil_b",
      "views:viw_a",
      "views:viw_b",
    ]);
  });

  it("não devolve chave quando a Pasta não é removível", () => {
    const estado = estadoBase({ tasks: [{ id: "t1", listId: "lst_funil_a" }] });
    expect(chavesDaPasta(estado, planejarPasta(estado))).toEqual([]);
  });

  it("remove do estado a Pasta, as Listas e as Visualizações dela; o resto fica", () => {
    const estado = estadoBase();
    removerPasta(estado, planejarPasta(estado));
    expect(estado.folders.map((f) => f.id)).toEqual(["fld_outra"]);
    expect(estado.lists.map((l) => l.id)).toEqual(["lst_solta"]);
    expect(estado.views.map((v) => v.id)).toEqual(["viw_solta"]);
    expect(estado.tasks.map((t) => t.id)).toEqual(["tsk_solta"]);
  });

  it("não remove nada quando a Pasta não é removível", () => {
    const estado = estadoBase({ tasks: [{ id: "t1", listId: "lst_funil_a" }] });
    removerPasta(estado, planejarPasta(estado));
    expect(estado.folders).toHaveLength(2);
    expect(estado.lists).toHaveLength(3);
  });
});
