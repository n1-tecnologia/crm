/**
 * Processo "Contas a receber" (docs/07-processos/contas-a-receber.md): a
 * configuração montada no seed e as regras que a plataforma valida.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { containerAdminRefusal, effectiveListConfig, memberReachesContainer, memberSeesTask } from "../derive";
import type { DataState } from "../state";
import type { Task } from "../types";
import { runScheduledAutomations } from "./automations";
import { CP, CR, clienteDe, contaSemCliente, createReceivableSeries, parcelaDuplicada } from "./financeiro";
import { addTaskComment, changeTaskStatus, createTask, setTaskFieldValue, statusOptionRefusal, trashTask } from "./tasks";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});
const F = CR.fields;
const S = CR.status;
const conta = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};
const campo = (t: Task, id: string) => t.fieldValues.find((v) => v.definitionId === id && v.state === "ativo")?.value;
const hoje = new Date();
const em = (dias: number) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("Processo Contas a receber", () => {
  it("estrutura: Lista irmã na Pasta Financeiro, 6 Status, Tipo Conta e Valor herdados da Pasta, Campos da seção 9, sem Subtarefas", () => {
    const cfg = effectiveListConfig(state, CR.listId);
    expect(cfg?.statusSet.definitions.map((d) => d.name)).toEqual(["para receber", "disponível para saque", "pendente", "estornado", "descartado", "recebido"]);
    expect(cfg?.taskTypeIds).toContain(CP.taskTypeId);
    expect(cfg?.fieldDefinitionIds).toEqual(expect.arrayContaining([CP.fields.valor, CP.fields.centroDeCusto, CP.fields.empresa, F.produto, F.tipo, F.numeroParcela, F.dataPagamento, F.situacao]));
    expect(cfg?.fieldDefinitionIds).not.toContain(CP.fields.categoria);
    expect(cfg?.features.subtarefas).toBe(false);
    // Permissões (seção 10): Financeiro administra; Diretoria edita; Comercial vê só as contas dos seus clientes.
    expect(containerAdminRefusal(state, CP.financeiroId, "list", CR.listId)).toBeUndefined();
    expect(memberReachesContainer(state, CP.aprovadorId, "list", CR.listId)).toBe(true);
    expect(memberReachesContainer(state, CR.comercialId, "list", CR.listId)).toBe(false);
    expect(memberSeesTask(state, CR.comercialId, "tsk_cr_gab_2")).toBe(true); // Helena é da Júlia
    expect(memberSeesTask(state, CR.comercialId, "tsk_cr_dai_1")).toBe(false); // Camila é do Rafael
    expect(clienteDe(state, conta("tsk_cr_gab_2"))?.id).toBe("cnt_cr_helena");
    // A concessão é "comentar": a Comercial comenta, mas não muda Status, Valor nem apaga.
    expect(addTaskComment(state, CR.comercialId, "tsk_cr_gab_2", { content: "Cliente avisou que paga sexta." }).ok).toBe(true);
    const status = changeTaskStatus(state, CR.comercialId, "tsk_cr_gab_2", S.descartado);
    expect(status.ok).toBe(false);
    if (!status.ok) expect(status.error).toMatch(/por concessão/);
    expect(setTaskFieldValue(state, CR.comercialId, "tsk_cr_gab_2", CP.fields.valor, 1).ok).toBe(false);
    expect(trashTask(state, CR.comercialId, "tsk_cr_gab_2").ok).toBe(false);
  });

  it("“Iniciar cobrança” à mão marca a Situação (R2b), e descartar depois vira inadimplente (R6)", () => {
    const t = conta("tsk_cr_gab_3");
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.pendente).ok).toBe(true);
    expect(campo(t, F.situacao)).toBe(CR.situacoes.emCobranca);
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.descartado).ok).toBe(true);
    expect(campo(t, F.situacao)).toBe(CR.situacoes.inadimplente);
  });

  it("RN-CR-03: recebido exige Valor > 0; R3 preenche a Data de pagamento e volta a Situação para “em dia”", () => {
    const t = conta("tsk_cr_dai_1");
    expect(campo(t, F.situacao)).toBe(CR.situacoes.emCobranca);
    expect(setTaskFieldValue(state, CP.financeiroId, t.id, CP.fields.valor, 0).ok).toBe(true);
    const zero = changeTaskStatus(state, CP.financeiroId, t.id, S.recebido);
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.error).toMatch(/Valor maior que zero/);
    expect(statusOptionRefusal(state, CP.financeiroId, t, S.recebido)).toMatch(/Valor maior que zero/);
    expect(setTaskFieldValue(state, CP.financeiroId, t.id, CP.fields.valor, 3500).ok).toBe(true);
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.recebido).ok).toBe(true);
    expect(campo(t, F.dataPagamento)).toBe(em(0));
    expect(campo(t, F.situacao)).toBe(CR.situacoes.emDia);
  });

  it("RN-CR-04: pendente só de “para receber” ou “recebido”; descartado nunca de “recebido”; a reversão recebido → pendente → descartado existe", () => {
    const saque = conta("tsk_cr_saque_set"); // disponível para saque
    const r = changeTaskStatus(state, CP.financeiroId, saque.id, S.pendente);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/só recebe Tarefas vindas de/);
    const recebida = conta("tsk_cr_gus_3");
    const direto = changeTaskStatus(state, CP.financeiroId, recebida.id, S.descartado);
    expect(direto.ok).toBe(false);
    expect(changeTaskStatus(state, CP.financeiroId, recebida.id, S.pendente).ok).toBe(true);
    expect(changeTaskStatus(state, CP.financeiroId, recebida.id, S.descartado).ok).toBe(true);
    // Passou por "pendente": foi cobrança, e cobrança descartada é inadimplência (R2b + R6).
    expect(campo(recebida, F.situacao)).toBe(CR.situacoes.inadimplente);
    // Cancelamento direto (para receber → descartado) não passa por cobrança e segue "em dia".
    const cancelada = conta("tsk_cr_gab_4");
    expect(changeTaskStatus(state, CP.financeiroId, cancelada.id, S.descartado).ok).toBe(true);
    expect(campo(cancelada, F.situacao)).toBe(CR.situacoes.emDia);
  });

  it("R2/R4/R6: D+1 leva a pendente + em cobrança; D+30 menciona o dono do cliente; descartar em cobrança vira inadimplente", () => {
    const t = conta("tsk_cr_gab_2"); // venceu ontem, para receber
    const r = runScheduledAutomations(state, CP.financeiroId, CR.listId, hoje);
    expect(r.ok).toBe(true);
    expect(t.statusId).toBe(S.pendente);
    expect(campo(t, F.situacao)).toBe(CR.situacoes.emCobranca);
    expect(t.comments.at(-1)?.content).toMatch(/Helena Vasconcelos entrou em cobrança/);
    // R4 ainda não: só a D+30. Simulando o relógio 31 dias à frente.
    const depois = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 31);
    expect(runScheduledAutomations(state, CP.financeiroId, CR.listId, depois).ok).toBe(true);
    const aviso = t.comments.at(-1);
    expect(aviso?.content).toMatch(/há 30 dias em cobrança/);
    expect(aviso?.mentions.map((m) => m.id)).toContain(CR.comercialId);
    // R6.
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.descartado).ok).toBe(true);
    expect(campo(t, F.situacao)).toBe(CR.situacoes.inadimplente);
  });

  it("R1: a série nasce de uma vez, vinculada ao cliente, com o Financeiro; RN-CR-07 recusa a segunda série; recusa no meio desfaz tudo", () => {
    const ativas = () => state.tasks.filter((t) => t.lifecycle === "ativo").length;
    const antes = ativas();
    const r = createReceivableSeries(state, CP.financeiroId, { contactId: "cnt_2", centroDeCusto: "Tria Tech", empresa: "Tria Company", valorEntrada: 5000, vencimentoEntrada: em(1), valorParcela: 2500, parcelas: 3, primeiroVencimento: "2026-01-31" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((t) => t.title)).toEqual(["Entrada – Marina Alves", "1ª Parcela – Marina Alves", "2ª Parcela – Marina Alves", "3ª Parcela – Marina Alves"]);
    expect(r.value.map((t) => t.dueDate?.value)).toEqual([em(1), "2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(r.value.every((t) => t.statusId === S.paraReceber && t.assignees[0]?.id === CP.financeiroId && clienteDe(state, t)?.id === "cnt_2")).toBe(true);
    expect(campo(r.value[2] ?? r.value[0]!, F.numeroParcela)).toBe(2);
    expect(memberSeesTask(state, "mem_rafael", r.value[0]?.id ?? "")).toBe(true); // Marina é do Rafael
    expect(contaSemCliente(state, r.value[1]!)).toBe(false);
    const dobrada = createReceivableSeries(state, CP.financeiroId, { contactId: "cnt_2", centroDeCusto: "Tria Tech", valorParcela: 1, parcelas: 1, primeiroVencimento: em(5) });
    expect(dobrada.ok).toBe(false);
    if (!dobrada.ok) expect(dobrada.error).toMatch(/RN-CR-07/);
    // Sem alcance à Lista: nada nasce.
    const semAlcance = createReceivableSeries(state, "mem_julia", { contactId: "cnt_1", centroDeCusto: "Tria Tech", valorParcela: 1, parcelas: 2, primeiroVencimento: em(5) });
    expect(semAlcance.ok).toBe(false);
    expect(ativas()).toBe(antes + 4);
    // Recusa no meio (o limite de Tarefas por Lista cai na 2ª conta): a 1ª já
    // tinha Vínculo e concessão — vai para a lixeira e leva os dois junto.
    const linksAntes = state.links.length;
    const grantsAntes = state.grants.length;
    Object.assign(state.workspace, { limits: { ...state.workspace.limits, tasksPerList: state.tasks.filter((t) => t.listId === CR.listId && t.lifecycle === "ativo" && !t.parentTaskId).length + 1 } });
    const meio = createReceivableSeries(state, CP.financeiroId, { contactId: "cnt_3", centroDeCusto: "Tria Tech", valorParcela: 10, parcelas: 2, primeiroVencimento: em(5) });
    expect(meio.ok).toBe(false);
    if (!meio.ok) expect(meio.error).toMatch(/Limite/);
    expect(ativas()).toBe(antes + 4);
    expect(state.links.length).toBe(linksAntes);
    expect(state.grants.length).toBe(grantsAntes);
    // Data inválida não vira fevereiro do ano seguinte.
    expect(createReceivableSeries(state, CP.financeiroId, { contactId: "cnt_4", centroDeCusto: "Tria Tech", valorParcela: 10, parcelas: 1, primeiroVencimento: "2026-13-45" }).ok).toBe(false);
  });

  it("RN-CR-02 e RN-CR-07 como avisos: conta criada à mão sem cliente; parcela repetida", () => {
    const solta = createTask(state, CP.financeiroId, { listId: CR.listId, title: "5ª Parcela – Helena Vasconcelos" });
    expect(solta.ok).toBe(true);
    if (!solta.ok) return;
    expect(setTaskFieldValue(state, CP.financeiroId, solta.value.id, F.tipo, CR.tipos.parcela).ok).toBe(true);
    expect(contaSemCliente(state, solta.value)).toBe(true);
    const gab2 = conta("tsk_cr_gab_2");
    expect(parcelaDuplicada(state, gab2)).toBeUndefined();
    state.links.push({ ...state.links.find((l) => l.fromId === gab2.id)!, id: "lnk_teste", fromId: solta.value.id });
    expect(setTaskFieldValue(state, CP.financeiroId, solta.value.id, F.numeroParcela, 2).ok).toBe(true);
    expect(parcelaDuplicada(state, solta.value)?.id).toBe(gab2.id);
  });
});
