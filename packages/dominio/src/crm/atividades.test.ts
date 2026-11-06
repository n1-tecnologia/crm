/**
 * O vocabulário da Atividade do CRM novo (D-15-09) e o filtro de leitura: o objeto
 * vem inteiro ou não vem, e o limite não passa do teto que a rota aceita.
 */

import { describe, expect, it } from "vitest";
import { ACOES_DO_CRM, LIMITES_DE_ATIVIDADE, TIPOS_DE_OBJETO_DO_CRM, validarFiltroDeAtividades } from "./atividades";

describe("validarFiltroDeAtividades", () => {
  it("recusa o objeto pela metade, apontando o campo que falta", () => {
    expect(validarFiltroDeAtividades({ objetoTipo: "contact", limite: 50 })).toMatchObject({ ok: false, field: "objetoId" });
    expect(validarFiltroDeAtividades({ objetoId: "c1", limite: 50 })).toMatchObject({ ok: false, field: "objetoTipo" });
  });

  it("recusa o limite acima de paginaMaxima, abaixo de 1 ou não inteiro", () => {
    expect(validarFiltroDeAtividades({ limite: LIMITES_DE_ATIVIDADE.paginaMaxima + 1 })).toMatchObject({ ok: false, field: "limite" });
    expect(validarFiltroDeAtividades({ limite: 0 })).toMatchObject({ ok: false, field: "limite" });
    expect(validarFiltroDeAtividades({ limite: 1.5 })).toMatchObject({ ok: false, field: "limite" });
  });

  it("recusa uma data limite que não é um instante", () => {
    expect(validarFiltroDeAtividades({ limite: 50, ate: "ontem" })).toMatchObject({ ok: false, field: "ate" });
  });

  it("aceita os dois do objeto, nenhum dos dois e o limite no teto", () => {
    expect(validarFiltroDeAtividades({ objetoTipo: "contact", objetoId: "c1", limite: 50 }).ok).toBe(true);
    expect(validarFiltroDeAtividades({ limite: LIMITES_DE_ATIVIDADE.paginaMaxima, ate: "2026-11-06T10:00:00.000Z" }).ok).toBe(true);
  });
});

describe("vocabulário", () => {
  it("o padrão da página cabe no teto", () => {
    expect(LIMITES_DE_ATIVIDADE).toEqual({ paginaPadrao: 50, paginaMaxima: 200 });
  });

  it("os tipos de objeto são as cadeias que ActivityRecord.objectType já usa", () => {
    expect([...TIPOS_DE_OBJETO_DO_CRM]).toEqual(["contact", "company", "deal", "conversation", "funnel", "channel"]);
  });

  it("cada ação tem uma frase própria e não vazia", () => {
    const frases = Object.values(ACOES_DO_CRM);
    expect(frases.every((f) => f.trim() !== "")).toBe(true);
    expect(new Set(frases).size).toBe(frases.length);
    expect(ACOES_DO_CRM.notaRegistrada).toBe("Nota registrada no Contato");
  });
});
