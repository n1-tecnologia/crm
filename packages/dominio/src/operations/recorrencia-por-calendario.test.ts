/**
 * FUND-17 — Recorrência por calendário (tarefa.md, 12.5): a próxima nasce
 * quando a data devida chega, pela agenda da Lista, concluída ou não a
 * corrente; com "aguardar conclusão", espera e nasce no ato de concluir.
 * A Regra se transfere, então rodar de novo no mesmo dia não duplica.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { containerAdminRefusal, isTerminalCategory, effectiveListConfig } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { RecurrenceRule, Task } from "../types";
import { runCalendarRecurrences, setRecurrence, spawnCalendarOccurrence, spawnNextOccurrence } from "./collaboration";
import { changeTaskStatus, updateTask } from "./tasks";

const THIAGO = "mem_thiago";
const LISTA = "lst_revisoes";
const CORRENTE = "tsk_seed_9";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const tarefa = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};
const geradasDe = (id: string) => state.tasks.filter((t) => t.provenance?.kind === "recurrence" && t.provenance.sourceId === id);
const civil = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoje = new Date();
const diasAtras = (n: number) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
  return civil(d);
};
const vencerEm = (dia: string) => {
  const r = updateTask(state, THIAGO, CORRENTE, { dueDate: { form: "civilDay", value: dia } });
  if (!r.ok) throw new Error(r.error);
};
const regraDoSeed = (): RecurrenceRule => {
  const rule = tarefa(CORRENTE).recurrence;
  if (!rule) throw new Error("tsk_seed_9 sem Regra");
  return rule;
};

describe("Recorrência por calendário", () => {
  it("o seed tem a corrente por calendário, 'gerar mesmo assim', em Lista que usa Recorrência", () => {
    expect(regraDoSeed().triggerMode).toBe("porCalendario");
    expect(regraDoSeed().whenStillOpen).toBe("gerarMesmoAssim");
    expect(effectiveListConfig(state, LISTA)?.features.recorrencia).toBe(true);
  });

  it("antes do vencimento nada nasce; o motivo diz o dia", () => {
    const r = runCalendarRecurrences(state, THIAGO, LISTA, hoje);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(r.value).toEqual({ created: 0, waiting: 0, failed: 0, failures: [] });
    const direto = spawnCalendarOccurrence(state, THIAGO, CORRENTE, hoje);
    expect(direto.ok).toBe(false);
    if (!direto.ok) expect(direto.error).toContain("nasce em");
  });

  it("no vencimento, com a corrente aberta, 'gerar mesmo assim' cria a próxima, transfere a Regra e não duplica no mesmo dia", () => {
    vencerEm(diasAtras(0));
    const r = runCalendarRecurrences(state, THIAGO, LISTA, hoje);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(r.value.created).toBe(1);
    const [proxima] = geradasDe(CORRENTE);
    expect(proxima).toBeDefined();
    expect(proxima?.listId).toBe(LISTA);
    expect(proxima?.recurrence?.triggerMode).toBe("porCalendario");
    expect(tarefa(CORRENTE).recurrence).toBeUndefined();
    // A corrente continua aberta: as duas coexistem.
    expect(isTerminalCategory(effectiveListConfig(state, LISTA)?.statusSet.definitions.find((d) => d.id === tarefa(CORRENTE).statusId)?.category ?? "naoIniciado")).toBe(false);
    // Um mês à frente, e sempre depois de hoje.
    expect(proxima?.dueDate?.value ?? "").not.toBe(diasAtras(0));
    expect((proxima?.dueDate?.value ?? "") > diasAtras(0)).toBe(true);
    const deNovo = runCalendarRecurrences(state, THIAGO, LISTA, hoje);
    if (deNovo.ok) expect(deNovo.value.created).toBe(0);
    expect(geradasDe(CORRENTE)).toHaveLength(1);
  });

  it("'aguardar conclusão': no vencimento espera; concluir a corrente com a data devida cria a próxima no mesmo ato", () => {
    vencerEm(diasAtras(2));
    const definida = setRecurrence(state, THIAGO, CORRENTE, { ...regraDoSeed(), whenStillOpen: "aguardarConclusao" });
    expect(definida.ok, definida.ok ? "" : definida.error).toBe(true);
    const r = runCalendarRecurrences(state, THIAGO, LISTA, hoje);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ created: 0, waiting: 1 });
    expect(geradasDe(CORRENTE)).toHaveLength(0);

    const terminal = effectiveListConfig(state, LISTA)?.statusSet.definitions.find((d) => isTerminalCategory(d.category));
    if (!terminal) throw new Error("Lista sem Status terminal");
    const concluida = changeTaskStatus(state, THIAGO, CORRENTE, terminal.id);
    expect(concluida.ok, concluida.ok ? "" : concluida.error).toBe(true);
    expect(geradasDe(CORRENTE)).toHaveLength(1);
    expect(tarefa(CORRENTE).recurrence).toBeUndefined();
    expect(state.activity.some((a) => a.action === "Recorrência transferida" && a.objectId === CORRENTE)).toBe(true);
  });

  it("'aguardar conclusão' concluída ANTES do vencimento não gera na conclusão: a agenda gera no dia", () => {
    const definida = setRecurrence(state, THIAGO, CORRENTE, { ...regraDoSeed(), whenStillOpen: "aguardarConclusao" });
    expect(definida.ok).toBe(true);
    const terminal = effectiveListConfig(state, LISTA)?.statusSet.definitions.find((d) => isTerminalCategory(d.category));
    expect(changeTaskStatus(state, THIAGO, CORRENTE, terminal!.id).ok).toBe(true);
    expect(geradasDe(CORRENTE)).toHaveLength(0);
    expect(tarefa(CORRENTE).recurrence).toBeDefined();
    vencerEm(diasAtras(0));
    const r = runCalendarRecurrences(state, THIAGO, LISTA, hoje);
    if (r.ok) expect(r.value.created).toBe(1);
    expect(geradasDe(CORRENTE)).toHaveLength(1);
  });

  it("spawnNextOccurrence recusa a Regra por calendário; corrente arquivada não gera; quem não administra a Lista não roda", () => {
    vencerEm(diasAtras(0));
    const errado = spawnNextOccurrence(state, THIAGO, CORRENTE);
    expect(errado.ok).toBe(false);
    if (!errado.ok) expect(errado.error).toContain("por calendário");
    expect(tarefa(CORRENTE).recurrence).toBeDefined();

    const comum = state.members.find((m) => m.state === "ativo" && containerAdminRefusal(state, m.id, "list", LISTA) !== undefined);
    if (comum) expect(runCalendarRecurrences(state, comum.id, LISTA, hoje).ok).toBe(false);

    tarefa(CORRENTE).lifecycle = "arquivado";
    const r = runCalendarRecurrences(state, THIAGO, LISTA, hoje);
    if (r.ok) expect(r.value.created).toBe(0);
    expect(geradasDe(CORRENTE)).toHaveLength(0);
  });
});
