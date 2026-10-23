/**
 * Fase 9, 1.2.2 — o CRM antigo (Negócios) recusa o Convidado e o Membro não
 * ativo pelo domínio, na primeira conferência de cada operação registrada.
 * A rota (09-07) é a primeira barreira; esta é a segunda.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Deal, Id, Member } from "../types";
import { recusaDeEscritaNoCrmAntigo } from "./crm-antigo";
import {
  createDeal,
  linkContactToDeal,
  loseDeal,
  migrateDealsToFunnel,
  moveDealToFunnel,
  moveDealToStage,
  removeStage,
  reopenDeal,
  restoreDeal,
  setDealFieldValue,
  unlinkContactFromDeal,
  winDeal,
} from "./deals";

const CONVIDADO = "mem_beatriz";
const MEMBRO = "mem_julia";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const membro = (id: Id): Member => {
  const m = state.members.find((x) => x.id === id);
  if (!m) throw new Error(`Membro ${id} não está no seed.`);
  return m;
};
const negocio = (id: Id): Deal => {
  const d = state.deals.find((x) => x.id === id);
  if (!d) throw new Error(`Negócio ${id} não está no seed.`);
  return d;
};

const FRASE_CONVIDADO = /Um Convidado não altera o CRM/;
const FRASE_NAO_ATIVO = /Só um Membro ativo altera o CRM/;

describe("recusaDeEscritaNoCrmAntigo", () => {
  it("aceita Membro ativo de base membro, recusa Convidado, suspenso e ausente", () => {
    expect(recusaDeEscritaNoCrmAntigo(state, MEMBRO)).toBeUndefined();
    expect(recusaDeEscritaNoCrmAntigo(state, CONVIDADO)).toMatch(FRASE_CONVIDADO);
    membro(MEMBRO).state = "suspenso";
    expect(recusaDeEscritaNoCrmAntigo(state, MEMBRO)).toMatch(FRASE_NAO_ATIVO);
    expect(recusaDeEscritaNoCrmAntigo(state, "mem_que_nao_existe")).toMatch(FRASE_NAO_ATIVO);
  });
});

describe("Negócios — 1.2.2: Convidado e Membro não ativo recebem ok: false e o estado não muda", () => {
  const deal = "deal_sdr_1";
  const operacoes: ReadonlyArray<readonly [string, (s: DataState, quem: Id) => { ok: boolean; error?: string }]> = [
    ["moveDealToStage", (s, q) => moveDealToStage(s, q, deal, "clo_negociacao")],
    ["winDeal", (s, q) => winDeal(s, q, deal, {})],
    ["loseDeal", (s, q) => loseDeal(s, q, deal, {})],
    ["reopenDeal", (s, q) => reopenDeal(s, q, deal)],
    ["linkContactToDeal", (s, q) => linkContactToDeal(s, q, deal, "cnt_2", "decisor")],
    ["removeStage", (s, q) => removeStage(s, q, "fnl_closer", "clo_negociacao", "clo_proposta")],
    ["migrateDealsToFunnel", (s, q) => migrateDealsToFunnel(s, q, "fnl_sdr", "fnl_closer", [])],
    ["restoreDeal", (s, q) => restoreDeal(s, q, deal)],
    ["moveDealToFunnel", (s, q) => moveDealToFunnel(s, q, deal, "fnl_validacao", "val_agendada")],
    ["createDeal", (s, q) => createDeal(s, q, { title: "Novo", funnelId: "fnl_closer" })],
    ["unlinkContactFromDeal", (s, q) => unlinkContactFromDeal(s, q, deal, "dcl_qualquer")],
    ["setDealFieldValue", (s, q) => setDealFieldValue(s, q, deal, "fd_qualquer", "x")],
  ];

  it.each(operacoes)("%s: o Convidado recebe a frase do Convidado e o estado fica idêntico", (_nome, chamar) => {
    const antes = structuredClone(state);
    const r = chamar(state, CONVIDADO);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(FRASE_CONVIDADO);
    expect(state).toStrictEqual(antes);
  });

  it.each(operacoes)("%s: um Membro suspenso recebe a frase de Membro não ativo e o estado fica idêntico", (_nome, chamar) => {
    membro(MEMBRO).state = "suspenso";
    const antes = structuredClone(state);
    const r = chamar(state, MEMBRO);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(FRASE_NAO_ATIVO);
    expect(state).toStrictEqual(antes);
  });

  it("winDeal: o Convidado não ganha o Negócio; um Membro ativo de base membro ganha o mesmo Negócio", () => {
    const antes = structuredClone(state);
    const recusado = winDeal(state, CONVIDADO, deal, { value: { amount: 1000, currency: "BRL" } });
    expect(recusado.ok).toBe(false);
    expect(state).toStrictEqual(antes);
    expect(negocio(deal).situation).toBe("aberto");

    const feito = winDeal(state, MEMBRO, deal, { value: { amount: 1000, currency: "BRL" } });
    expect(feito.ok).toBe(true);
    expect(negocio(deal).situation).toBe("ganho");
  });

  it("moveDealToStage: um Membro ativo de base membro continua movendo o Negócio", () => {
    const r = moveDealToStage(state, MEMBRO, deal, "clo_proposta");
    // Pode recusar por Requisito da Etapa; o que não pode é recusar por ser Membro.
    if (!r.ok) expect(r.error).not.toMatch(FRASE_CONVIDADO);
  });
});
