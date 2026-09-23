/**
 * A costura entre o motor de Automações e o de-para real do lançamento
 * (Plan 03-11) — `OpcoesDaAgenda`, o `{{cnpjEmpresa}}` injetado (PAG-04,
 * metade órfã de 03-04) e o Ensaio que não encadeia A8 (D3-03).
 *
 * Arquivo NOVO de propósito, para não disputar `automations-motor.test.ts`
 * (03-02, o motor em si) nem `agente-de-lancamento.test.ts` (03-04, as duas
 * metades do Agente). Puro: sem banco, sem rede — a ponte HTTP que resolve o
 * de-para de verdade é `apps/api/src/automacoes/invocar-agente.ts` (03-11,
 * Task 2); aqui só se prova que o motor RECEBE e USA o que a ponte injeta.
 *
 * Regra do arquivo (mesma de `automations-motor.test.ts`): nenhuma data nasce
 * de string ISO — `HOJE` e todo vencimento vêm do construtor numérico de
 * `Date`, para não cair na armadilha de fuso (meia-noite UTC de uma string
 * `"YYYY-MM-DD"` cai no dia anterior em América/São_Paulo).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { runScheduledAutomations, type OpcoesDaAgenda } from "./automations";
import { CP, DE_PARA_DO_PROTOTIPO, type DeParaDeLancamento, type ResolucaoDeCategoria } from "./financeiro";
import { changeTaskStatus, updateTask } from "./tasks";

const A7 = "aut_cp_a7";
const S = CP.status;

/** 31/08/2026, meio-dia — nunca uma string ISO (a armadilha de fuso). */
const HOJE = new Date(2026, 7, 31, 12);

/** `HOJE + dias`, no formato `civilDay` que `updateTask` aceita. */
function diaCivilEm(dias: number): string {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

function conta(id: string): Task {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

/** `tsk_cp_das`, vencendo amanhã — a candidata a A7 (vencimento(-1)) de sempre. */
function vespera(): Task {
  const t = conta("tsk_cp_das");
  expect(updateTask(state, CP.financeiroId, t.id, { dueDate: { form: "civilDay", value: diaCivilEm(1) } }).ok).toBe(true);
  return t;
}

/** `tsk_cp_trafego`, vencendo amanhã — a segunda candidata completa a A7 que `operations.test.ts` já usa. */
function trafegoNaVespera(): Task {
  const t = conta("tsk_cp_trafego");
  expect(updateTask(state, CP.financeiroId, t.id, { dueDate: { form: "civilDay", value: diaCivilEm(1) } }).ok).toBe(true);
  return t;
}

/** `tsk_cp_thiago_out` — "para pagar", sem Anexo, com Pessoa — a candidata a A5 (vencimento(-5)) de sempre. */
function comPessoaEmD5(): Task {
  const t = conta("tsk_cp_thiago_out");
  expect(updateTask(state, CP.financeiroId, t.id, { dueDate: { form: "civilDay", value: diaCivilEm(5) } }).ok).toBe(true);
  return t;
}

const execucoesDeA7 = (taskId: string) => state.automationExecutions.filter((e) => e.automationId === A7 && e.objectId === taskId);

/** Um de-para de UMA entrada, no molde do que a rota de 03-07 devolve por Tarefa. */
function deParaDe(categoria: string, resolucao: ResolucaoDeCategoria): DeParaDeLancamento {
  return { contaPorTag: { "conta tria": "TRIA" }, categoriaPorCampo: { [categoria]: resolucao }, origem: "omie" };
}

const rodar = (opcoes?: OpcoesDaAgenda) => runScheduledAutomations(state, CP.financeiroId, CP.listId, HOJE, opcoes);

describe("OpcoesDaAgenda: (a) sem opções, tudo idêntico a hoje", () => {
  it("runScheduledAutomations com 4 argumentos lança tsk_cp_das como sempre lançou", () => {
    const t = vespera();
    const r = runScheduledAutomations(state, CP.financeiroId, CP.listId, HOJE);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(t.statusId).toBe(S.lancado);
    const resumo = t.comments.find((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"));
    expect(resumo?.author).toEqual({ kind: "agent", id: CP.agentId });
    expect(execucoesDeA7(t.id).map((e) => e.state)).toEqual(["concluida"]);
  });
});

describe("{{cnpjEmpresa}} (PAG-04): o mapa chega pela ponte, nunca de uma tabela fixa", () => {
  it("(b) com mapa: o Comentário de A5 traz o CNPJ real e o nome da Empresa", () => {
    const t = comPessoaEmD5();
    const r = rodar({ cnpjPorEmpresa: { "Tria Company": "11.222.333/0001-81" } });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const cobranca = t.comments.find((c) => c.content.includes("emitir sua nota"));
    expect(cobranca?.content).toContain("11.222.333/0001-81 (Tria Company)");
  });

  it("(c) sem mapa, ou com a Empresa ausente dele: fallback textual, nunca um CNPJ inventado", () => {
    const t = comPessoaEmD5();
    const r = rodar({ cnpjPorEmpresa: { "Outra Empresa": "99.999.999/0001-99" } });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const cobranca = t.comments.find((c) => c.content.includes("emitir sua nota"));
    expect(cobranca?.content).toContain("da Empresa Tria Company");
    expect(cobranca?.content).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  });
});

describe("Ensaio (D3-03): rehearsal: true não encadeia A8", () => {
  it("(d) Status e Comentários intactos; a Execução de A7 fecha concluida com UM passo; nasce a AgentExecution de sombra", () => {
    const t = vespera();
    const statusAntes = t.statusId;
    const comentariosAntes = t.comments.length;
    const agentExecutionsAntes = state.agentExecutions.length;

    const r = rodar({ lancamento: { dePara: DE_PARA_DO_PROTOTIPO, rehearsal: true } });

    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(t.statusId).toBe(statusAntes);
    expect(t.comments.length).toBe(comentariosAntes);
    const execucoes = execucoesDeA7(t.id);
    expect(execucoes).toHaveLength(1);
    expect(execucoes[0]?.state).toBe("concluida");
    // UM passo de verdade (o invocarAgente que ensaiou); o resto é "pulado" —
    // o mesmo molde de qualquer `halt` do motor (`encerrar`/`aguardar`,
    // `automations-motor.test.ts`). A8 (tarefa.alterarStatus) nunca roda.
    expect(execucoes[0]?.steps.map((s) => s.result)).toEqual(["concluido", "pulado"]);
    expect(state.agentExecutions.length).toBe(agentExecutionsAntes + 1);
    expect(state.agentExecutions.at(-1)?.rehearsal).toBe(true);
  });
});

describe("Lançamento real (D3-03/T-3-36): só para quem o Omie confirmou", () => {
  it("(e) Tarefa fora de tarefasLancadas recusa e não move Status; a listada publica o RESUMO e A8 move para lançado omie", () => {
    const naoConfirmada = vespera();
    const confirmada = trafegoNaVespera();

    const r = rodar({ lancamento: { dePara: DE_PARA_DO_PROTOTIPO, rehearsal: false, tarefasLancadas: [confirmada.id] } });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);

    expect(naoConfirmada.statusId).toBe(S.paraPagar);
    expect(naoConfirmada.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(false);
    expect(execucoesDeA7(naoConfirmada.id).map((e) => e.state)).toEqual(["falhou"]);

    expect(confirmada.statusId).toBe(S.lancado);
    expect(confirmada.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(true);
    expect(execucoesDeA7(confirmada.id).map((e) => e.state)).toEqual(["concluida"]);
  });
});

describe("O de-para injetado chega mesmo ao domínio (não é ignorado)", () => {
  it("(f) veredito 'revisar' no de-para injetado recusa A7 mesmo com a Tarefa em tarefasLancadas — prova que dePara foi de fato usado", () => {
    const t = vespera();
    const categoriaDaTarefa = "Impostos"; // Categoria de tsk_cp_das no seed (docs/07-processos/contas-a-pagar.md)
    const dePara = deParaDe(categoriaDaTarefa, {
      veredito: "revisar",
      nome: "Impostos e taxas",
      codigo: "2.06.01",
      similaridade: 0.4,
      motivo: "duas categorias empatadas no Omie",
    });

    const r = rodar({ lancamento: { dePara, rehearsal: false, tarefasLancadas: [t.id] } });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);

    expect(t.statusId).toBe(S.paraPagar);
    expect(t.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(false);
    expect(execucoesDeA7(t.id).map((e) => e.state)).toEqual(["falhou"]);
  });
});

describe("(g) o caminho de evento continua intacto", () => {
  it("runListAutomations, chamado indiretamente por changeTaskStatus, segue com dois parâmetros e o mesmo comportamento de A2/A3", () => {
    const t = conta("tsk_cp_aluguel_out");
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.emRemessa).ok).toBe(true);
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.emAutorizacao).ok).toBe(true);
    expect(t.assignees.map((a) => a.id)).toEqual([CP.aprovadorId]); // A3
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.pago).ok).toBe(true);
    expect(t.assignees.map((a) => a.id)).toEqual([CP.aprovadorId]); // A2: só o Financeiro sai
  });
});
