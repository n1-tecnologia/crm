/**
 * O MOTOR de Automações — não os processos que o usam.
 *
 * `operations.test.ts` e `contas-a-receber.test.ts` cobrem o Financeiro: o que
 * A2–A9 e R1–R6 fazem com uma conta. Este arquivo cobre o executor em si — as
 * duas portas de entrada (`runListAutomations`, pelo evento, e
 * `runScheduledAutomations`, pela agenda), o vocabulário de controle e a
 * `AutomationExecution` que explica cada rodada.
 *
 * Regra do arquivo, vinculante (`03-VALIDATION.md` § Sampling Risk — como o
 * tempo é injetado): **nada aqui lê o relógio da máquina**. Toda data de
 * agenda é injetada, construída pelo construtor numérico de `Date`
 * (`dia(2026, 7, 31)`) e nunca a partir de uma string ISO de dia civil —
 * `runScheduledAutomations` compara dia civil LOCAL, e uma string de dia
 * civil é lida como meia-noite UTC, que em América/São_Paulo cai no dia
 * anterior. Onde o comportamento depende do relógio real (o caminho de
 * evento), a asserção é contra o carimbo que a própria Execução gravou —
 * nunca contra um relógio lido pelo teste.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { pendingMentions } from "../derive";
import type { DataState } from "../state";
import type { Automation, AutomationAction, AutomationCondition, AutomationExecution, AutomationTrigger, Id, StatusSet, Task } from "../types";
import { runScheduledAutomations } from "./automations";
import { CP, CR } from "./financeiro";
import { createTaskType } from "./configuration";
import { createList, createSpace } from "./structure";
import { changeTaskStatus, createTask, updateTask } from "./tasks";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const F = CP.fields;

const conta = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};

const campo = (t: Task, id: Id): unknown => t.fieldValues.find((v) => v.definitionId === id && v.state === "ativo")?.value;

/** Mês 0-based, como o construtor de `Date`: `dia(2026, 7, 31)` é 31/08/2026, meia-noite local. */
const dia = (ano: number, mes: number, diaDoMes: number): Date => new Date(ano, mes, diaDoMes);

/** O dia civil local de um instante gravado — usado para comparar com o que a Execução carimbou. */
const diaCivilDe = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const rodar = (quando: Date, listId: Id = CP.listId) => runScheduledAutomations(state, CP.financeiroId, listId, quando);

const execucoesDe = (automationId: Id, objectId: Id): AutomationExecution[] =>
  state.automationExecutions.filter((e) => e.automationId === automationId && e.objectId === objectId);

/** Publica uma Automação de teste direto no `state` — o motor é genérico e o teste não pode depender de A1–A9. */
const publicar = (
  id: Id,
  name: string,
  trigger: AutomationTrigger,
  conditions: AutomationCondition[],
  actions: AutomationAction[],
  listId: Id = CP.listId,
  ownerMemberId: Id = CP.financeiroId,
): Automation => {
  const carimbo = "2026-01-01T12:00:00.000Z";
  const automation: Automation = {
    id,
    workspaceId: state.workspace.id,
    createdBy: { kind: "member", id: ownerMemberId },
    createdAt: carimbo,
    lifecycle: "ativo",
    name,
    description: name,
    scopeType: "list",
    scopeId: listId,
    ownerMemberId,
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        trigger,
        conditions,
        actions,
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        publishedBy: ownerMemberId,
        publishedAt: carimbo,
        createdAt: carimbo,
      },
    ],
  };
  state.automations.push(automation);
  return automation;
};

const porVencimento = (dias: number): AutomationTrigger => ({ kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: dias }) });
const porEntrarEm = (status: string): AutomationTrigger => ({ kind: "evento", eventType: "tarefaEntrouEmStatus", eventSubtype: status });
const acao = (order: number, toolId: string, params: object): AutomationAction => ({ order, kind: "escrita", toolId, params: JSON.stringify(params) });
const controle = (
  order: number,
  controlKind: NonNullable<AutomationAction["controlKind"]>,
  params: object,
  extra: Partial<AutomationAction> = {},
): AutomationAction => ({ order, kind: "controle", controlKind, params: JSON.stringify(params), ...extra });

/** D-5 de 05/09/2026 é 31/08/2026: o dia em que a agenda alcança esta conta. */
const VENCIMENTO = "2026-09-05";

/** `tsk_cp_thiago_out` — “para pagar”, sem Anexo, com Pessoa preenchida — vencendo em 05/09/2026. */
const contaVencendoEmSetembro = (): Task => {
  const t = conta("tsk_cp_thiago_out");
  const r = updateTask(state, CP.financeiroId, t.id, { dueDate: { form: "civilDay", value: VENCIMENTO } });
  expect(r.ok, r.ok ? "" : r.error).toBe(true);
  return t;
};

/**
 * `solicitarAprovacao` (`operations/ai.ts`) exige o status `em aprovação`, que
 * Contas a pagar não tem — a Lista de Solicitações de pagamento nasce de
 * verdade só na Fase 2/3. Aqui basta uma Lista com os quatro Status de D-01.
 */
const STATUS_SET_APROVACAO: StatusSet = {
  id: "sts_sol_motor",
  definitions: [
    { id: "st_sol_motor_para_fazer", name: "para fazer", color: "#94a3b8", category: "naoIniciado", order: 0 },
    { id: "st_sol_motor_em_aprovacao", name: "em aprovação", color: "#f59e0b", category: "emAndamento", order: 1 },
    { id: "st_sol_motor_nao_aprovado", name: "não aprovado", color: "#ef4444", category: "concluido", order: 2 },
    { id: "st_sol_motor_aprovado", name: "aprovado", color: "#22c55e", category: "fechado", order: 3 },
  ],
};

interface AutomacaoDeTeste {
  readonly id: Id;
  readonly name: string;
  readonly trigger: AutomationTrigger;
  readonly actions: AutomationAction[];
}
const publicarEm = (id: Id, name: string, trigger: AutomationTrigger, actions: AutomationAction[]): AutomacaoDeTeste => ({ id, name, trigger, actions });

/** Proprietário do Espaço público de teste — o Financeiro do seed do Financeiro não administra um Espaço novo do CRM. */
const DONO = "mem_thiago";
/** O Aprovador nomeado na versão publicada da Automação (T-3-07: nomeado, nunca o dono por omissão). */
const APROVADOR = "mem_julia";

/** Espaço + Lista com `em aprovação`, Automações publicadas ANTES da Tarefa (o gatilho é `tarefaCriada`). */
const listaComAprovacao = (automacoes: AutomacaoDeTeste[]): { readonly listId: Id; readonly taskId: Id } => {
  const espaco = createSpace(state, DONO, { name: "Solicitações (motor 03-02)", statusSet: STATUS_SET_APROVACAO });
  if (!espaco.ok) throw new Error(`fixture: ${espaco.error}`);
  const tipo = createTaskType(state, DONO, { name: "Solicitação (motor 03-02)", icon: "circle", definedAtType: "space", definedAtId: espaco.value.id });
  if (!tipo.ok) throw new Error(`fixture: ${tipo.error}`);
  const lista = createList(state, DONO, { name: "Solicitações de pagamento (motor 03-02)", parentType: "space", parentId: espaco.value.id });
  if (!lista.ok) throw new Error(`fixture: ${lista.error}`);
  for (const a of automacoes) publicar(a.id, a.name, a.trigger, [], a.actions, lista.value.id, DONO);
  const task = createTask(state, DONO, { listId: lista.value.id, title: "Pagamento de teste (03-02)" });
  if (!task.ok) throw new Error(`fixture: ${task.error}`);
  return { listId: lista.value.id, taskId: task.value.id };
};

/* ─────────────────────── Uma base de tempo só ─────────────────────── */

describe("Motor de Automações — o `today` injetado é o relógio da Execução agendada", () => {
  const cobrancas = (t: Task): number => t.comments.filter((c) => c.content.includes("emitir sua nota")).length;

  it("A5 dispara uma vez no dia injetado; a segunda chamada com o MESMO `today` não repete", () => {
    const t = contaVencendoEmSetembro();

    const primeira = rodar(dia(2026, 7, 31));
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);
    expect(primeira.ok && primeira.value.executed).toBe(1);
    expect(cobrancas(t)).toBe(1);
    expect(execucoesDe("aut_cp_a5", t.id)).toHaveLength(1);

    // A Execução carimbou o dia INJETADO, não o relógio da máquina — é isto que
    // torna `jaRodou` uma comparação entre duas datas da mesma base de tempo.
    const carimbo = execucoesDe("aut_cp_a5", t.id)[0]?.startedAt ?? "";
    expect(new Date(carimbo).getTime()).toBe(dia(2026, 7, 31).getTime());

    const segunda = rodar(dia(2026, 7, 31));
    expect(segunda.ok && segunda.value.executed).toBe(0);
    expect(segunda.ok && segunda.value.skipped).toBeGreaterThan(primeira.ok ? primeira.value.skipped : 0);
    expect(cobrancas(t)).toBe(1);
    expect(execucoesDe("aut_cp_a5", t.id)).toHaveLength(1);
  });

  it("a Execução concluída em 31/08 vale para sempre: 01/09 não cobra de novo", () => {
    const t = contaVencendoEmSetembro();
    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);
    expect(cobrancas(t)).toBe(1);

    const depois = rodar(dia(2026, 8, 1));
    expect(depois.ok && depois.value.executed).toBe(0);
    expect(cobrancas(t)).toBe(1);
    expect(execucoesDe("aut_cp_a5", t.id)).toHaveLength(1);
  });

  it("uma Execução que FALHOU no dia injetado não é repetida naquele dia — e é no dia seguinte", () => {
    const t = contaVencendoEmSetembro();
    publicar("aut_teste_falha", "Falha proposital", porVencimento(-5), [], [acao(1, "ferramenta.que.nao.existe", {})]);

    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);
    const falhas = () => execucoesDe("aut_teste_falha", t.id);
    expect(falhas()).toHaveLength(1);
    expect(falhas()[0]?.state).toBe("falhou");

    // Mesmo dia injetado: `jaRodou` reconhece a falha de hoje porque as duas
    // pontas da comparação estão na mesma base de tempo.
    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);
    expect(falhas()).toHaveLength(1);

    // Outro dia: tenta de novo.
    expect(rodar(dia(2026, 8, 1)).ok).toBe(true);
    expect(falhas()).toHaveLength(2);
  });

  it("`tarefa.definirCampo` com `today: true` pela agenda grava o dia INJETADO", () => {
    const t = contaVencendoEmSetembro();
    publicar("aut_teste_data", "Carimbar a data de emissão", porVencimento(-5), [], [acao(1, "tarefa.definirCampo", { definitionId: F.dataEmissao, today: true })]);

    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);
    expect(campo(t, F.dataEmissao)).toBe("2026-08-31");
  });

  it("pelo caminho de EVENTO a base de tempo continua o relógio real — o mesmo que a Execução carimba", () => {
    const t = conta("tsk_cr_gab_3"); // “para receber”, sem Data de pagamento
    expect(campo(t, CR.fields.dataPagamento)).toBeUndefined();

    expect(changeTaskStatus(state, CP.financeiroId, t.id, CR.status.recebido).ok).toBe(true);

    const execucao = execucoesDe("aut_cr_r3", t.id)[0];
    expect(execucao?.state).toBe("concluida");
    expect(execucao?.triggerKind).toBe("evento");
    // R3 gravou o dia civil do instante em que a Execução começou: um relógio só.
    expect(campo(t, CR.fields.dataPagamento)).toBe(diaCivilDe(execucao?.startedAt ?? ""));
  });
});

/* ──────────────── O vocabulário de controle de AUTO-01 ──────────────── */

describe("Motor de Automações — as cinco Ações de controle", () => {
  const terminou = (automationId: Id, objectId: Id): AutomationExecution | undefined => execucoesDe(automationId, objectId).at(-1);

  it("`notificar` publica UM Comentário com autoria da Automação e vira notificação in-app por pendingMentions", () => {
    const t = contaVencendoEmSetembro();
    publicar("aut_teste_notificar", "Avisar quem precisa saber", porVencimento(-5), [], [
      controle(1, "notificar", {
        template: "Nota fiscal pendente em {{titulo}} (vence {{vencimento}}).",
        mentionMemberIds: [CP.aprovadorId],
        fromFieldDefinitionId: F.pessoa,
      }),
    ]);

    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);

    const avisos = t.comments.filter((c) => c.content.startsWith("Nota fiscal pendente"));
    expect(avisos).toHaveLength(1);
    const aviso = avisos[0];
    expect(aviso?.author).toEqual({ kind: "automation", id: "aut_teste_notificar" });
    expect(aviso?.content).toContain("Pedro Alencar Consultoria em Dados");
    expect([...(aviso?.mentions ?? [])].map((m) => m.id).sort()).toEqual([CP.aprovadorId, "mem_thiago_pereira"].sort());

    // A metade que importa: o Membro alvo PASSA A ENXERGAR o aviso.
    expect(pendingMentions(state, CP.aprovadorId).some((p) => p.comment.id === aviso?.id)).toBe(true);
    expect(pendingMentions(state, "mem_thiago_pereira").some((p) => p.comment.id === aviso?.id)).toBe(true);

    expect(terminou("aut_teste_notificar", t.id)?.state).toBe("concluida");
  });

  it("`notificar` sem texto falha dizendo o que falta — nunca com “Controle não suportado”", () => {
    const t = contaVencendoEmSetembro();
    publicar("aut_teste_notificar_vazio", "Notificar sem texto", porVencimento(-5), [], [
      controle(1, "notificar", { mentionMemberIds: [CP.aprovadorId] }),
    ]);

    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);

    const execucao = terminou("aut_teste_notificar_vazio", t.id);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).not.toMatch(/não suportado/);
    expect(execucao?.terminationReason).toMatch(/template/);
  });

  it("`solicitarAprovacao` roteia a decisão ao Aprovador nomeado e repetir não cria uma segunda pendência", () => {
    const { taskId } = listaComAprovacao([
      publicarEm(
        "aut_teste_aprovacao",
        "Rotear ao Aprovador",
        { kind: "evento", eventType: "tarefaCriada" },
        [controle(1, "solicitarAprovacao", { template: "Para sua aprovação: {{titulo}}." }, { approverMemberId: APROVADOR })],
      ),
      publicarEm(
        "aut_teste_aprovacao_repetida",
        "Rotear de novo ao mesmo Aprovador",
        { kind: "evento", eventType: "tarefaCriada" },
        [controle(1, "solicitarAprovacao", { template: "Para sua aprovação (de novo): {{titulo}}." }, { approverMemberId: APROVADOR })],
      ),
    ]);

    const pendencias = state.approvals.filter((a) => a.origin.kind === "processTask" && a.origin.taskId === taskId);
    expect(pendencias).toHaveLength(1);
    expect(pendencias[0]?.approverMemberId).toBe(APROVADOR);
    expect(pendencias[0]?.reason).toBe("processo");

    const tarefa = conta(taskId);
    // O Comentário de roteamento existe, é o âncora da pendência e menciona o Aprovador.
    const roteamento = tarefa.comments.find((c) => c.id === (pendencias[0]?.origin.kind === "processTask" ? pendencias[0].origin.threadCommentId : ""));
    expect(roteamento?.content).toBe("Para sua aprovação: Pagamento de teste (03-02).");
    expect(roteamento?.mentions.map((m) => m.id)).toContain(APROVADOR);
    expect(roteamento?.author).toEqual({ kind: "automation", id: "aut_teste_aprovacao" });

    expect(terminou("aut_teste_aprovacao", taskId)?.state).toBe("concluida");
    expect(terminou("aut_teste_aprovacao_repetida", taskId)?.state).toBe("concluida");
  });

  it("`solicitarAprovacao` numa Lista sem o status “em aprovação” falha com a recusa da própria operação de domínio", () => {
    const t = contaVencendoEmSetembro(); // Contas a pagar NÃO tem “em aprovação”
    publicar("aut_teste_aprovacao_sem_status", "Rotear onde não dá", porVencimento(-5), [], [
      controle(1, "solicitarAprovacao", { template: "Para sua aprovação: {{titulo}}." }, { approverMemberId: CP.aprovadorId }),
    ]);

    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);

    const execucao = terminou("aut_teste_aprovacao_sem_status", t.id);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toMatch(/em aprovação/);
  });

  it("`solicitarAprovacao` sem Aprovador nomeado falha — nunca cai no dono da Automação por omissão (T-3-07)", () => {
    const t = contaVencendoEmSetembro();
    publicar("aut_teste_aprovacao_sem_aprovador", "Rotear a ninguém", porVencimento(-5), [], [
      controle(1, "solicitarAprovacao", { template: "Para sua aprovação: {{titulo}}." }),
    ]);

    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);

    const execucao = terminou("aut_teste_aprovacao_sem_aprovador", t.id);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toMatch(/Aprovador/);
    expect(state.approvals.some((a) => a.origin.kind === "processTask" && a.origin.taskId === t.id)).toBe(false);
  });

  it("`encerrar` conclui a Execução ali: as Ações seguintes ficam “pulado” e o motivo fica registrado", () => {
    const t = contaVencendoEmSetembro();
    publicar("aut_teste_encerrar", "Parar no meio", porVencimento(-5), [], [
      controle(1, "encerrar", { motivo: "Nada a fazer por hoje." }),
      acao(2, "tarefa.comentar", { template: "Este Comentário nunca deveria existir." }),
    ]);

    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);

    const execucao = terminou("aut_teste_encerrar", t.id);
    expect(execucao?.state).toBe("concluida");
    expect(execucao?.terminationReason).toBe("Nada a fazer por hoje.");
    expect(execucao?.steps.map((s) => s.result)).toEqual(["concluido", "pulado"]);
    expect(t.comments.some((c) => c.content.startsWith("Este Comentário nunca"))).toBe(false);
  });

  it("`aguardar` sob agenda: antes do prazo nada depois acontece e a Execução fica pendente; no dia do prazo segue e conclui", () => {
    const t = contaVencendoEmSetembro();
    const statusAntes = t.statusId;
    publicar("aut_teste_aguardar", "Esperar três dias após o vencimento", porVencimento(-5), [], [
      controle(1, "aguardar", { aguardarDias: 3, aguardarDesde: "vencimento" }),
      acao(2, "tarefa.comentar", { template: "Três dias vencida e ninguém pagou." }),
    ]);

    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);
    const espera = execucoesDe("aut_teste_aguardar", t.id);
    expect(espera).toHaveLength(1);
    expect(espera[0]?.state).toBe("pendente");
    expect(espera[0]?.steps.map((s) => s.result)).toEqual(["aguardando", "pulado"]);
    expect(espera[0]?.terminationReason).toMatch(/2026-09-08/);
    expect(t.comments.some((c) => c.content.startsWith("Três dias vencida"))).toBe(false);
    expect(t.statusId).toBe(statusAntes);

    // Duas chamadas no mesmo `today` não empilham duas Execuções “pendente”.
    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);
    expect(execucoesDe("aut_teste_aguardar", t.id)).toHaveLength(1);

    // No dia do prazo (08/09/2026) a mesma Automação segue e conclui.
    expect(rodar(dia(2026, 8, 8)).ok).toBe(true);
    const todas = execucoesDe("aut_teste_aguardar", t.id);
    expect(todas).toHaveLength(2);
    expect(todas[1]?.state).toBe("concluida");
    expect(todas[1]?.steps.map((s) => s.result)).toEqual(["concluido", "concluido"]);
    expect(t.comments.some((c) => c.content.startsWith("Três dias vencida"))).toBe(true);
  });

  it("`aguardar` sob gatilho de EVENTO falha com texto explícito: não há quem retome uma Execução de evento", () => {
    const t = conta("tsk_cp_condominio"); // “em lançamento omie”
    publicar("aut_teste_aguardar_evento", "Esperar num evento", porEntrarEm("lançado omie"), [], [
      controle(1, "aguardar", { aguardarDias: 3 }),
    ]);

    expect(changeTaskStatus(state, CP.financeiroId, t.id, CP.status.lancado).ok).toBe(true);

    const execucao = terminou("aut_teste_aguardar_evento", t.id);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toMatch(/agenda/);
    expect(execucao?.terminationReason).not.toMatch(/não suportado/);
  });

  it("`aguardar` que não é a primeira Ação falha: a retomada roda a Execução do começo", () => {
    const t = contaVencendoEmSetembro();
    publicar("aut_teste_aguardar_tarde", "Esperar depois de agir", porVencimento(-5), [], [
      acao(1, "tarefa.comentar", { template: "Já aconteceu antes da espera." }),
      controle(2, "aguardar", { aguardarDias: 3 }),
    ]);

    expect(rodar(dia(2026, 7, 31)).ok).toBe(true);

    const execucao = terminou("aut_teste_aguardar_tarde", t.id);
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toMatch(/primeira Ação/);
    expect(execucao?.steps.map((s) => s.result)).toEqual(["concluido", "falhou"]);
  });
});
