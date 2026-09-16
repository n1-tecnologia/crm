/**
 * `buildGestaoBootstrap()` é o `DataState` de produção da Fase 1 (D-07/D-08):
 * puro, sem banco — a prova de que o Espaço "Gestão" nasce só com a
 * configuração do Financeiro, com a Maryane como única Membro, Proprietária,
 * e operável de verdade (RN-CP-04 continua valendo).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { buildSeed } from "./seed";
import { CP, CR } from "./operations/financeiro";
import { createTask, changeTaskStatus } from "./operations/tasks";
import { USUARIOS_DO_SEED } from "./usuarios-do-seed";
import type { DataState } from "./state";

const AGORA = "2026-09-16T12:00:00.000Z";

describe("buildGestaoBootstrap", () => {
  // Fresco a cada teste: as operações do domínio mutam em lugar (D-05), e a
  // Task de operabilidade abaixo grava uma Tarefa de verdade no estado — um
  // `s` compartilhado vazaria essa mutação para os testes seguintes.
  let s: DataState;
  beforeEach(() => {
    s = buildGestaoBootstrap({ agora: AGORA });
  });

  it("zero Tarefas, Contatos, Negócios, Conversas e demais fixtures do protótipo (D-07)", () => {
    expect(s.tasks.length).toBe(0);
    expect(s.contacts.length).toBe(0);
    expect(s.companies.length).toBe(0);
    expect(s.deals.length).toBe(0);
    expect(s.conversations.length).toBe(0);
    expect(s.chatSessions.length).toBe(0);
    expect(s.activity.length).toBe(0);
    expect(s.approvals.length).toBe(0);
    expect(s.agentExecutions.length).toBe(0);
    expect(s.automationExecutions.length).toBe(0);
    expect(s.goals.length).toBe(0);
    expect(s.links.length).toBe(0);
    expect(s.teams.length).toBe(0);
    expect(s.queues.length).toBe(0);
    expect(s.channels.length).toBe(0);
    expect(s.forms.length).toBe(0);
  });

  it("a única Membro é a Maryane, Proprietária, com o userId real (D-08, D-09)", () => {
    expect(s.members.length).toBe(1);
    const maryane = s.members[0]!;
    expect(maryane.id).toBe("mem_maryane");
    expect(maryane.roleId).toBe("role_prop");
    expect(maryane.state).toBe("ativo");
    expect(maryane.userId).toBe(USUARIOS_DO_SEED.mem_maryane);
    expect(s.workspace.ownerMemberId).toBe("mem_maryane");
  });

  it("a Estrutura do Financeiro existe e nada mais (D-07)", () => {
    expect(s.spaces.map((x) => x.id)).toEqual(["spc_gestao"]);
    expect(s.folders.map((x) => x.id)).toEqual(["fld_financeiro"]);
    const listIds = s.lists.map((x) => x.id).sort();
    expect(listIds).toEqual([CP.listId, CR.listId].sort());
    expect(s.taskTypes.some((t) => t.name === "Conta")).toBe(true);
    expect(s.tags.filter((t) => t.name.startsWith("conta ")).length).toBe(8);
  });

  it("o Agente de lançamento, o Agente padrão, o Funil padrão e a Coleção existem", () => {
    const agentIds = s.agents.map((x) => x.id);
    expect(agentIds).toContain("agt_padrao");
    expect(agentIds).toContain(CP.agentId);
    expect(s.funnels.map((x) => x.id)).toEqual(["fnl_padrao"]);
    expect(s.collections.some((c) => c.id === "col_financeiro_erp")).toBe(true);
  });

  it("as Automações A2–A9 e R2–R6 são exatamente as que buildSeed() já monta (config, não fixture)", () => {
    const semente = buildSeed();
    const porPrefixo = (state: typeof s, prefixo: string) => state.automations.filter((a) => a.id.startsWith(prefixo)).map((a) => a.id).sort();
    expect(porPrefixo(s, "aut_cp_")).toEqual(porPrefixo(semente, "aut_cp_"));
    expect(porPrefixo(s, "aut_cr_")).toEqual(porPrefixo(semente, "aut_cr_"));
    expect(s.automations.filter((a) => a.id.startsWith("aut_cp_")).length).toBeGreaterThan(0);
  });

  it("toda grant de Membro, todo dono de Coleção/Agente e todo criador de Visualização existe em members", () => {
    const membros = new Set(s.members.map((m) => m.id));
    for (const g of s.grants) {
      if (g.subjectKind === "member") expect(membros.has(g.subjectId), `grant ${g.id} referencia Membro inexistente ${g.subjectId}`).toBe(true);
    }
    for (const c of s.collections) expect(membros.has(c.ownerMemberId)).toBe(true);
    for (const a of s.agents) expect(membros.has(a.ownerMemberId)).toBe(true);
    for (const v of s.views) expect(membros.has(v.createdBy)).toBe(true);
  });

  it("a Maryane cria uma Conta a pagar — o bootstrap é operável (não só bonito)", () => {
    const r = createTask(s, "mem_maryane", { listId: CP.listId, title: "Conta de teste" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.statusId).toBe(CP.status.paraPagar);

    // RN-CP-04 — só o Aprovador fecha como pago; a Maryane não é o Aprovador,
    // e a Conta recém-criada nem tem o dado de pagamento para sair de "para
    // pagar" — o processo está configurado de verdade, não maquetado.
    const r2 = changeTaskStatus(s, "mem_maryane", r.value.id, CP.status.pago);
    expect(r2.ok).toBe(false);
  });

  it("nenhuma chave de DataState foi esquecida (mesmas chaves de buildSeed())", () => {
    expect(Object.keys(s).sort()).toEqual(Object.keys(buildSeed()).sort());
  });

  it("é determinístico: duas chamadas com o mesmo `agora` produzem estados idênticos", () => {
    const s2 = buildGestaoBootstrap({ agora: AGORA });
    expect(s2).toStrictEqual(s);
  });

  it("documenta D-08: o Aprovador ainda é referenciado em payload de Automação (consequência aceita, religa no convite)", () => {
    expect(s.automations.some((a) => JSON.stringify(a).includes(CP.aprovadorId))).toBe(true);
  });

  it("NÃO monta nada além da configuração: sem buildSeed()/nextId()/seedActivity()/pruneDemo() no arquivo", () => {
    // Prova estática indireta: se buildGestaoBootstrap chamasse buildSeed(), o
    // Espaço teria muito mais que 1 Membro e 0 Tarefas — já provado acima.
    expect(s.members.length).toBe(1);
    expect(s.tasks.length).toBe(0);
  });
});
