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
 * (`dia(2026, 7, 31)`) e nunca por string ISO — `runScheduledAutomations`
 * compara dia civil LOCAL, e `new Date("2026-08-31")` é meia-noite UTC, que em
 * América/São_Paulo cai no dia 30. Onde o comportamento depende do relógio
 * real (o caminho de evento), a asserção é contra o carimbo que a própria
 * Execução gravou, nunca contra um `new Date()` do teste.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Automation, AutomationAction, AutomationCondition, AutomationExecution, AutomationTrigger, Id, Task } from "../types";
import { runScheduledAutomations } from "./automations";
import { CP, CR } from "./financeiro";
import { changeTaskStatus, updateTask } from "./tasks";

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
): Automation => {
  const carimbo = "2026-01-01T12:00:00.000Z";
  const automation: Automation = {
    id,
    workspaceId: state.workspace.id,
    createdBy: { kind: "member", id: CP.financeiroId },
    createdAt: carimbo,
    lifecycle: "ativo",
    name,
    description: name,
    scopeType: "list",
    scopeId: listId,
    ownerMemberId: CP.financeiroId,
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        trigger,
        conditions,
        actions,
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        publishedBy: CP.financeiroId,
        publishedAt: carimbo,
        createdAt: carimbo,
      },
    ],
  };
  state.automations.push(automation);
  return automation;
};

const porVencimento = (dias: number): AutomationTrigger => ({ kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: dias }) });
const acao = (order: number, toolId: string, params: object): AutomationAction => ({ order, kind: "escrita", toolId, params: JSON.stringify(params) });

/* ─────────────────────── Uma base de tempo só ─────────────────────── */

describe("Motor de Automações — o `today` injetado é o relógio da Execução agendada", () => {
  /** D-5 de 05/09/2026 é 31/08/2026: o dia em que A5 dispara para esta conta. */
  const VENCIMENTO = "2026-09-05";

  const contaVencendoEmSetembro = (): Task => {
    const t = conta("tsk_cp_thiago_out"); // “para pagar”, sem Anexo, com Pessoa preenchida
    const r = updateTask(state, CP.financeiroId, t.id, { dueDate: { form: "civilDay", value: VENCIMENTO } });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    return t;
  };

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
