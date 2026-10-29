/**
 * Fase 10, 2.6.1 (D-06, D-07) — Visualizações padrão: o Espaço ou a Pasta
 * define quais tipos de Visualização as Listas abaixo oferecem e qual abre
 * primeiro; a Lista herda pelo caminho e o nó mais próximo que define vence
 * POR INTEIRO. Cada teste afirma o RESULTADO da operação e o estado que ela
 * deixou, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { effectiveContainerConfig, effectiveListConfig, VISUALIZACOES_DA_PLATAFORMA } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { VisualizacoesPadrao } from "../types";
import { administraOEspaco } from "./ia/permissoes-ia";
import { setContainerDefaultViews } from "./configuration";
import { saveView } from "./scale";

const THIAGO = "mem_thiago";
const ESPACO = "spc_com";
const PASTA = "fld_renovacao"; // dentro de fld_clientes, dentro de spc_com
const LISTA_NA_PASTA = "lst_renovacao";
const LISTA_NO_ESPACO = "lst_prospeccao";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const semCalendario: VisualizacoesPadrao = { disponiveis: ["lista", "quadro", "tabela", "linhaDoTempo"], inicial: "lista" };
const soQuadro: VisualizacoesPadrao = { disponiveis: ["quadro"], inicial: "quadro" };

const views = (listId: string) => effectiveListConfig(state, listId)?.views;

const semAdmin = (): string => {
  const m = state.members.find((x) => x.state === "ativo" && !administraOEspaco(state, x.id));
  if (!m) throw new Error("o seed precisa de um Membro ativo que não administre o Espaço");
  return m.id;
};

describe("setContainerDefaultViews — herança pelo caminho (EST-08)", () => {
  it("sem ninguém definindo, a Lista usa o padrão da plataforma e viewsDefinedAt fica ausente", () => {
    const config = effectiveListConfig(state, LISTA_NA_PASTA);
    expect(config?.views).toEqual(VISUALIZACOES_DA_PLATAFORMA);
    expect(config?.views.disponiveis).toEqual(["lista", "quadro", "calendario", "tabela", "linhaDoTempo"]);
    expect(config?.views.inicial).toBe("lista");
    expect(config && "viewsDefinedAt" in config).toBe(false);
  });

  it("o Espaço tira o Calendário e as Listas abaixo deixam de tê-lo", () => {
    const r = setContainerDefaultViews(state, THIAGO, "space", ESPACO, semCalendario);
    expect(r.ok).toBe(true);
    for (const lista of [LISTA_NA_PASTA, LISTA_NO_ESPACO]) {
      const config = effectiveListConfig(state, lista);
      expect(config?.views.disponiveis).toEqual(["lista", "quadro", "tabela", "linhaDoTempo"]);
      expect(config?.views.disponiveis).not.toContain("calendario");
      expect(config?.viewsDefinedAt).toMatchObject({ type: "space", id: ESPACO });
    }
    expect(state.spaces.find((s) => s.id === ESPACO)?.modes.defaultViews).toBe("sobrescrito");
  });

  it("uma Pasta sobrescreve por inteiro e a Lista dela segue a Pasta; a Lista direta no Espaço segue o Espaço", () => {
    expect(setContainerDefaultViews(state, THIAGO, "space", ESPACO, semCalendario).ok).toBe(true);
    expect(setContainerDefaultViews(state, THIAGO, "folder", PASTA, soQuadro).ok).toBe(true);
    expect(views(LISTA_NA_PASTA)).toEqual(soQuadro);
    expect(effectiveListConfig(state, LISTA_NA_PASTA)?.viewsDefinedAt).toMatchObject({ type: "folder", id: PASTA });
    expect(views(LISTA_NO_ESPACO)).toEqual(semCalendario);
    // a Pasta não mescla com o Espaço: o que ela não lista, não existe
    expect(views(LISTA_NA_PASTA)?.disponiveis).not.toContain("lista");
    // a Pasta de cima (fld_clientes) não foi tocada
    expect(effectiveContainerConfig(state, "folder", "fld_clientes")?.views).toEqual(semCalendario);
  });

  it("null na Pasta volta ao valor do Espaço; null no Espaço volta ao padrão da plataforma", () => {
    setContainerDefaultViews(state, THIAGO, "space", ESPACO, semCalendario);
    setContainerDefaultViews(state, THIAGO, "folder", PASTA, soQuadro);

    expect(setContainerDefaultViews(state, THIAGO, "folder", PASTA, null).ok).toBe(true);
    expect(views(LISTA_NA_PASTA)).toEqual(semCalendario);
    const pasta = state.folders.find((f) => f.id === PASTA);
    expect(pasta?.defaultViews).toBeUndefined();
    expect(pasta?.modes.defaultViews).toBe("herdado");

    expect(setContainerDefaultViews(state, THIAGO, "space", ESPACO, null).ok).toBe(true);
    expect(views(LISTA_NA_PASTA)).toEqual(VISUALIZACOES_DA_PLATAFORMA);
    expect(effectiveListConfig(state, LISTA_NA_PASTA) && "viewsDefinedAt" in effectiveListConfig(state, LISTA_NA_PASTA)!).toBe(false);
  });
});

describe("setContainerDefaultViews — recusas", () => {
  it("recusa `inicial` fora de `disponiveis` e não grava nada", () => {
    const r = setContainerDefaultViews(state, THIAGO, "space", ESPACO, { disponiveis: ["quadro", "tabela"], inicial: "lista" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("A Visualização inicial precisa estar entre as disponíveis.");
    expect(state.spaces.find((s) => s.id === ESPACO)?.defaultViews).toBeUndefined();
  });

  it("recusa `disponiveis` vazio", () => {
    const r = setContainerDefaultViews(state, THIAGO, "space", ESPACO, { disponiveis: [], inicial: "lista" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Escolha ao menos um tipo de Visualização.");
  });

  it("recusa tipo fora de VISUALIZACOES_DA_PLATAFORMA e tipo repetido", () => {
    const desconhecido = setContainerDefaultViews(state, THIAGO, "space", ESPACO, {
      disponiveis: ["lista", "mapa" as never],
      inicial: "lista",
    });
    expect(desconhecido.ok).toBe(false);
    if (!desconhecido.ok) expect(desconhecido.error).toBe("Tipo de Visualização desconhecido.");

    const repetido = setContainerDefaultViews(state, THIAGO, "space", ESPACO, { disponiveis: ["lista", "lista"], inicial: "lista" });
    expect(repetido.ok).toBe(false);
    expect(state.spaces.find((s) => s.id === ESPACO)?.defaultViews).toBeUndefined();
  });

  it("recusa Membro sem administrar e Convidado", () => {
    const comum = setContainerDefaultViews(state, semAdmin(), "space", ESPACO, semCalendario);
    expect(comum.ok).toBe(false);
    const convidado = setContainerDefaultViews(state, "mem_beatriz", "space", ESPACO, semCalendario);
    expect(convidado.ok).toBe(false);
    expect(state.spaces.find((s) => s.id === ESPACO)?.defaultViews).toBeUndefined();
  });

  it("recusa contêiner arquivado", () => {
    const pasta = state.folders.find((f) => f.id === PASTA)!;
    pasta.lifecycle = "arquivado";
    const r = setContainerDefaultViews(state, THIAGO, "folder", PASTA, soQuadro);
    expect(r.ok).toBe(false);
    expect(pasta.defaultViews).toBeUndefined();
  });

  it("recusa quando um ancestral bloqueia as Visualizações padrão", () => {
    state.spaces.find((s) => s.id === ESPACO)!.blocks.defaultViews = true;
    const r = setContainerDefaultViews(state, THIAGO, "folder", PASTA, soQuadro);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Espaço Comercial bloqueia as Visualizações padrão abaixo dele.");
  });
});

describe("setContainerDefaultViews — Atividade", () => {
  it("grava 'Visualizações padrão alteradas' com antes/depois legíveis", () => {
    setContainerDefaultViews(state, THIAGO, "space", ESPACO, semCalendario);
    const registro = state.activity.find((a) => a.action === "Visualizações padrão alteradas" && a.objectId === ESPACO);
    expect(registro?.objectType).toBe("space");
    expect(registro?.detail).toBe("Visualizações padrão");
    expect(registro?.before).toBe("herdadas");
    expect(registro?.after).toBe("Lista, Quadro, Tabela, Linha do tempo · inicial Lista");

    setContainerDefaultViews(state, THIAGO, "space", ESPACO, null);
    const volta = state.activity.filter((a) => a.action === "Visualizações padrão alteradas" && a.objectId === ESPACO)[0]; // a Atividade mais nova vem primeiro
    expect(volta?.before).toBe("Lista, Quadro, Tabela, Linha do tempo · inicial Lista");
    expect(volta?.after).toBe("herdadas");
  });

  it("repetir o mesmo valor não grava Atividade", () => {
    setContainerDefaultViews(state, THIAGO, "space", ESPACO, semCalendario);
    const antes = state.activity.length;
    const r = setContainerDefaultViews(state, THIAGO, "space", ESPACO, { ...semCalendario });
    expect(r.ok).toBe(true);
    expect(state.activity.length).toBe(antes);
  });
});

describe("saveView — só salva tipo que a Lista oferece (D-06, 2.6.1 item 5)", () => {
  const salvar = (kind: Parameters<typeof saveView>[2]["kind"], name: string) =>
    saveView(state, THIAGO, { listId: LISTA_NA_PASTA, name, kind, filters: {}, shared: true });

  it("recusa kind fora de `views.disponiveis` da Lista e aceita o disponível", () => {
    setContainerDefaultViews(state, THIAGO, "space", ESPACO, semCalendario);
    const recusada = salvar("calendario", "Prazos");
    expect(recusada.ok).toBe(false);
    if (!recusada.ok) expect(recusada.error).toBe("Esta Lista não oferece esse tipo de Visualização.");
    expect(state.views.some((v) => v.listId === LISTA_NA_PASTA && v.name === "Prazos")).toBe(false);

    expect(salvar("quadro", "Por Status").ok).toBe(true);
  });

  it("tirar um tipo das Visualizações padrão não apaga nem muda as Visualizações já salvas daquele tipo", () => {
    const antiga = salvar("calendario", "Prazos antigos");
    expect(antiga.ok).toBe(true);
    const idAntiga = antiga.ok ? antiga.value.id : "";
    const antes = JSON.stringify(state.views.find((v) => v.id === idAntiga));

    expect(setContainerDefaultViews(state, THIAGO, "space", ESPACO, semCalendario).ok).toBe(true);

    expect(JSON.stringify(state.views.find((v) => v.id === idAntiga))).toBe(antes);
    expect(salvar("calendario", "Prazos novos").ok).toBe(false);
  });
});
