/**
 * A troca dos Vínculos da mesclagem de Contatos (3.2.2, INV-CON-07): a função
 * pura que a `mergeContacts` antiga e a mesclagem do modelo novo compartilham,
 * e a operação que a api chama dentro do gesto misto, sobre um estado SEM
 * Contatos no CRM antigo (só `links`, `chatSessions` e a Atividade).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { ChatSession, Link } from "../types";
import { OPERACOES } from "./registro";
import { mesclarContatoNoEspaco, reapontarContatoNosVinculos } from "./vinculos-da-mesclagem";

const THIAGO = "mem_thiago";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OUTRO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const vinculo = (id: string, sobre: Partial<Link>): Link => ({
  id,
  fromType: "task",
  fromId: "tsk_1",
  toType: "contact",
  toId: A,
  role: "solicitante",
  createdBy: { kind: "member", id: THIAGO },
  createdAt: "2026-01-01T00:00:00.000Z",
  ...sobre,
});

describe("reapontarContatoNosVinculos", () => {
  it("passa para o sobrevivente o Vínculo que chega no absorvido", () => {
    const r = reapontarContatoNosVinculos([vinculo("l1", {})], A, B);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "l1", toType: "contact", toId: B, fromId: "tsk_1" });
  });

  it("passa também o Vínculo que sai do Contato", () => {
    const r = reapontarContatoNosVinculos(
      [vinculo("l1", { fromType: "contact", fromId: A, toType: "company", toId: "emp_1", role: undefined })],
      A,
      B,
    );
    expect(r[0]).toMatchObject({ fromType: "contact", fromId: B, toId: "emp_1" });
  });

  it("a Tarefa que apontava para os dois fica com um Vínculo só, o mais antigo", () => {
    const antigo = vinculo("l_antigo", { toId: B });
    const novo = vinculo("l_novo", { toId: A });
    const r = reapontarContatoNosVinculos([antigo, novo], A, B);
    expect(r.map((l) => l.id)).toEqual(["l_antigo"]);

    // O mais antigo é o que veio primeiro, mesmo quando é o do absorvido.
    const r2 = reapontarContatoNosVinculos([novo, antigo], A, B);
    expect(r2.map((l) => l.id)).toEqual(["l_novo"]);
    expect(r2[0]?.toId).toBe(B);
  });

  it("papéis diferentes na mesma Tarefa são Vínculos diferentes", () => {
    const r = reapontarContatoNosVinculos([vinculo("l1", { toId: B, role: "solicitante" }), vinculo("l2", { toId: A, role: "responsavel" })], A, B);
    expect(r.map((l) => l.id)).toEqual(["l1", "l2"]);
  });

  it("não toca o que não envolve o absorvido, nem junta Vínculos iguais de outro Contato", () => {
    const iguais = [vinculo("l1", { toId: OUTRO }), vinculo("l2", { toId: OUTRO })];
    const r = reapontarContatoNosVinculos(iguais, A, B);
    expect(r).toEqual(iguais);
  });

  it("não muda a lista de entrada", () => {
    const entrada = [vinculo("l1", {})];
    reapontarContatoNosVinculos(entrada, A, B);
    expect(entrada[0]?.toId).toBe(A);
  });
});

describe("mesclarContatoNoEspaco", () => {
  let state: DataState;

  beforeEach(() => {
    state = buildSeed();
    state.contacts = [];
    state.conversations = [];
    state.deals = [];
    state.links = [vinculo("l1", { toId: A }), vinculo("l2", { toId: OUTRO })];
  });

  const referencias = {
    sobrevivente: { id: B, nome: "Marina Duarte" },
    absorvido: { id: A, nome: "Marina D." },
  };

  it("reaponta os Vínculos e conta quantos tocavam o absorvido", () => {
    const r = mesclarContatoNoEspaco(state, THIAGO, referencias);
    expect(r).toEqual({ ok: true, value: { vinculosReapontados: 1 } });
    expect(state.links.map((l) => l.toId)).toEqual([B, OUTRO]);
  });

  it("reaponta a âncora das Sessões de Chat", () => {
    const sessao = state.chatSessions[0] as ChatSession;
    sessao.anchor = { type: "contact", id: A, name: "Marina D." } as ChatSession["anchor"];
    mesclarContatoNoEspaco(state, THIAGO, referencias);
    expect(sessao.anchor?.id).toBe(B);
    expect(sessao.anchor?.type).toBe("contact");
  });

  it("grava as duas Atividades com os nomes das referências", () => {
    const antes = state.activity.length;
    mesclarContatoNoEspaco(state, THIAGO, referencias);
    expect(state.activity.length).toBe(antes + 2);
    const recentes = state.activity.slice(0, 2);
    expect(recentes).toContainEqual(
      expect.objectContaining({ action: "Contato sobrevivente da mesclagem", objectId: B, objectName: "Marina Duarte" }),
    );
    expect(recentes).toContainEqual(
      expect.objectContaining({ action: "Contato mesclado", objectId: A, objectName: "Marina D.", after: "Marina Duarte" }),
    );
  });

  it("recusa o mesmo Contato dos dois lados e nada muda", () => {
    const antes = [state.links.length, state.activity.length];
    const r = mesclarContatoNoEspaco(state, THIAGO, { sobrevivente: { id: A, nome: "x" }, absorvido: { id: A, nome: "x" } });
    expect(r.ok).toBe(false);
    expect([state.links.length, state.activity.length]).toEqual(antes);
  });

  it("fica fora de OPERACOES: o navegador não a chama por POST /operacoes", () => {
    expect(Object.hasOwn(OPERACOES, "mesclarContatoNoEspaco")).toBe(false);
  });
});
