/**
 * Fase 15 (D-15-07, UCR-01) — `instantiateListTemplate` confere os Canais de
 * atendimento contra os Canais que o servidor leu de `plataforma.canais`
 * (5º parâmetro `canais`). O estado não guarda mais Canal (3.5.4): um Template de Lista
 * com `listConfig` precisa instanciar a Lista conversacional só com o que o servidor leu.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Canal } from "../crm/canais";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { instantiateListTemplate, saveListAsTemplate } from "./planning";

const THIAGO = "mem_thiago";

const umCanal = (sobrepor: Partial<Canal> = {}): Canal => ({
  id: "can_so_na_tabela",
  nome: "WhatsApp da loja",
  tipo: "whatsapp",
  provedor: "whatsapp-cloud",
  identificadorExterno: "+5511911110001",
  conexao: "conectada",
  conexaoSimulada: false,
  conectadaEm: null,
  estado: "ativo",
  arquivadoEm: null,
  configuradoPor: THIAGO,
  filaPadraoId: null,
  proprietarioPadraoId: null,
  origemPadraoId: null,
  gruposHabilitados: false,
  criadoPor: THIAGO,
  criadoEm: "2026-11-05T12:00:00.000Z",
  atualizadoEm: "2026-11-05T12:00:00.000Z",
  ...sobrepor,
});

let state: DataState;
let templateId: string;

beforeEach(() => {
  state = buildSeed();
  // O Canal só existe na tabela.
  // `TEMPLATES` do seed é um array de módulo, compartilhado entre `buildSeed()`s: sem a cópia,
  // o Template salvo por um teste vaza para o seguinte.
  state.templates = [...state.templates];
  const salvo = saveListAsTemplate(state, THIAGO, "lst_propostas", { name: "Atendimento com status" });
  if (!salvo.ok) throw new Error(salvo.error);
  templateId = salvo.value.id;
});

const entrada = (canaisDeAtendimento: readonly string[]) => ({
  name: "Suporte do Template",
  parentType: "space" as const,
  parentId: "spc_com",
  modeloDeTarefa: "conversacional" as const,
  canaisDeAtendimento,
});

describe("instantiateListTemplate — Canais de atendimento conferidos nos Canais lidos da tabela", () => {
  it("instancia a Lista conversacional com um Canal ativo que só existe em `canais`", () => {
    const r = instantiateListTemplate(state, THIAGO, templateId, entrada(["can_so_na_tabela"]), [umCanal()]);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.canaisDeAtendimento).toEqual(["can_so_na_tabela"]);
    expect(r.value.modeloDeTarefa).toBe("conversacional");
    expect(state.lists.some((l) => l.id === r.value.id)).toBe(true);
  });

  it("recusa quando `canais` não traz o Canal pedido, e não deixa Lista nenhuma para trás", () => {
    const antes = state.lists.length;
    const r = instantiateListTemplate(state, THIAGO, templateId, entrada(["can_so_na_tabela"]), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Canal não encontrado ou arquivado.");
    expect(state.lists).toHaveLength(antes);
  });

  it("recusa um Canal arquivado da tabela", () => {
    const r = instantiateListTemplate(state, THIAGO, templateId, entrada(["can_so_na_tabela"]), [umCanal({ estado: "arquivado", arquivadoEm: "2026-11-05T12:00:00.000Z" })]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Canal não encontrado ou arquivado.");
  });

  it("instanciar duas vezes o mesmo Template cria duas Listas independentes, as duas conferidas pelos Canais lidos", () => {
    const canais = [umCanal()];
    const a = instantiateListTemplate(state, THIAGO, templateId, { ...entrada(["can_so_na_tabela"]), name: "Suporte A" }, canais);
    const b = instantiateListTemplate(state, THIAGO, templateId, { ...entrada(["can_so_na_tabela"]), name: "Suporte B" }, canais);
    expect(a.ok, a.ok ? "" : a.error).toBe(true);
    expect(b.ok, b.ok ? "" : b.error).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.id).not.toBe(b.value.id);
    expect(a.value.canaisDeAtendimento).toEqual(["can_so_na_tabela"]);
    expect(b.value.canaisDeAtendimento).toEqual(["can_so_na_tabela"]);
  });
});
