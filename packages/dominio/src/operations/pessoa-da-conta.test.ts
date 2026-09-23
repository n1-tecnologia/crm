/**
 * PAG-06 — a Pessoa da conta enxerga a Tarefa em que ela é o valor do Campo
 * Pessoa, e nenhuma outra. A visibilidade é DERIVADA do dado: ninguém escreve
 * uma Grant, logo não há Grant a revogar quando o fornecedor muda.
 *
 * O caso que decide o requisito é o NEGATIVO. Um arquivo que só provasse o
 * positivo (“o Pedro vê a conta do Pedro”) passaria igualzinho num sistema que
 * mostra tudo a todos — é a recusa (“o Lucas NÃO vê a conta do Pedro”) que
 * separa uma regra de permissão de um `return true`.
 *
 * A regra mora na Lista, como dado: `List.sharedWithDefinitionIds` declara
 * quais Campos nomeiam quem enxerga. `guestEditableDefinitionIds` já dizia o
 * QUE o Convidado edita; esta diz QUEM ele é.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { memberNamedOnTask, memberReachesContainer, memberSeesTask, pendingMentions } from "../derive";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { runScheduledAutomations } from "./automations";
import { CP, CR } from "./financeiro";
import { addTaskComment, changeTaskStatus, createTask, setTaskFieldValue, updateTask } from "./tasks";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const F = CP.fields;
const S = CP.status;

/** Pedro Alencar e Lucas Ferraz: dois Convidados, duas contas, um Campo Pessoa. */
const PEDRO = "mem_thiago_pereira";
const LUCAS = "mem_joao_konq";

const conta = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};
const lista = () => {
  const l = state.lists.find((x) => x.id === CP.listId);
  if (!l) throw new Error("sem Lista de Contas a pagar");
  return l;
};
const grantsSobre = (taskId: string) => state.grants.filter((g) => g.resourceId === taskId);
const campo = (t: Task, definitionId: string) =>
  t.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;

describe("PAG-06 — a Pessoa da conta enxerga a própria conta por ser a Pessoa da conta", () => {
  it("a Lista declara o Campo Pessoa, e o seed não escreve nenhuma Grant de Pessoa à mão", () => {
    expect(lista().sharedWithDefinitionIds).toEqual([F.pessoa]);
    expect(state.grants.some((g) => g.id.startsWith("gr_cp_pessoa"))).toBe(false);
  });

  it("positivo, e por dentro do mecanismo certo: o Pedro vê a conta dele SEM nenhuma Grant sobre a Tarefa", () => {
    const minha = conta("tsk_cp_thiago_out");
    expect(campo(minha, F.pessoa)).toBe(PEDRO);
    // Não é “vê porque alguém concedeu”: não há concessão nenhuma nesta Tarefa.
    expect(grantsSobre(minha.id).length).toBe(0);
    expect(memberSeesTask(state, PEDRO, minha.id)).toBe(true);
    expect(memberNamedOnTask(state, PEDRO, minha)).toBe(true);
  });

  it("NEGATIVO nos dois sentidos — é este caso que decide o requisito (T-3-01)", () => {
    const doPedro = conta("tsk_cp_thiago_out");
    const doLucas = conta("tsk_cp_konq");
    expect(campo(doLucas, F.pessoa)).toBe(LUCAS);
    // E a recusa é pelo VALOR do Campo, não por falta de linha em state.grants:
    // nenhuma das duas Tarefas tem Grant alguma, e ainda assim cada um vê só a sua.
    expect(grantsSobre(doLucas.id).length).toBe(0);
    expect(memberSeesTask(state, LUCAS, doPedro.id)).toBe(false);
    expect(memberNamedOnTask(state, LUCAS, doPedro)).toBe(false);
    expect(memberSeesTask(state, PEDRO, doLucas.id)).toBe(false);
    expect(memberNamedOnTask(state, PEDRO, doLucas)).toBe(false);
    // E cada um continua vendo a sua.
    expect(memberSeesTask(state, PEDRO, doPedro.id)).toBe(true);
    expect(memberSeesTask(state, LUCAS, doLucas.id)).toBe(true);
  });

  it("NEGATIVO estrutural: derivar por Campo abre UMA Tarefa a UM Membro nomeado — não abre a Lista a ninguém", () => {
    // Rafael é Administrador, o Papel mais forte sem concessão no caminho; a
    // Lista de Contas a pagar continua invisível para ele, e a Tarefa também.
    expect(memberReachesContainer(state, "mem_rafael", "list", CP.listId)).toBe(false);
    expect(memberSeesTask(state, "mem_rafael", "tsk_cp_thiago_out")).toBe(false);
    // Júlia é Membro: mesmo resultado.
    expect(memberReachesContainer(state, "mem_julia", "list", CP.listId)).toBe(false);
    expect(memberSeesTask(state, "mem_julia", "tsk_cp_thiago_out")).toBe(false);
    // E quem administra a Lista continua alcançando-a como antes.
    expect(memberReachesContainer(state, CP.financeiroId, "list", CP.listId)).toBe(true);
  });

  it("guarda de tipo (T-3-11): só Campo `person` abre Tarefa — um texto igual a um id de Membro não abre nada", () => {
    const outra = conta("tsk_cp_aluguel_out");
    expect(memberSeesTask(state, PEDRO, outra.id)).toBe(false);
    // Um Campo de texto declarado como porta de entrada, com o id do Pedro
    // digitado dentro: a tentativa de elevação de privilégio, montada à mão.
    lista().sharedWithDefinitionIds = [F.pessoa, F.nomeFornecedor];
    const texto = outra.fieldValues.find((v) => v.definitionId === F.nomeFornecedor && v.state === "ativo");
    if (!texto) throw new Error("sem Nome do fornecedor");
    texto.value = PEDRO;
    expect(state.fieldDefinitions.find((d) => d.id === F.nomeFornecedor)?.type).toBe("text");
    expect(memberNamedOnTask(state, PEDRO, outra)).toBe(false);
    expect(memberSeesTask(state, PEDRO, outra.id)).toBe(false);
  });

  it("Lista que não declara nada se comporta exatamente como antes (Contas a receber)", () => {
    const cr = state.lists.find((l) => l.id === CR.listId);
    expect(cr?.sharedWithDefinitionIds).toBeUndefined();
    // Os mesmos valores de contas-a-receber.test.ts: a Comercial vê a conta do
    // cliente dela por Grant, e não a do cliente do Rafael.
    expect(memberSeesTask(state, CR.comercialId, "tsk_cr_gab_2")).toBe(true);
    expect(memberSeesTask(state, CR.comercialId, "tsk_cr_dai_1")).toBe(false);
  });
});

/**
 * Os três momentos em que a Grant escrita à mão nunca esteve: o Campo
 * preenchido depois da criação, a ocorrência que A1 faz nascer ao pagar, e a
 * troca de fornecedor. Nada de `packages/dominio` fora deste arquivo muda aqui
 * — o que se prova é que a regra do bloco acima já está correta nos três.
 */
describe("PAG-06 — o ciclo de vida: a visibilidade acompanha o dado, e continua sendo só visibilidade", () => {
  /** Cria uma conta como o Financeiro; `createTask` não aceita Valores de Campo. */
  const novaConta = (titulo: string): Task => {
    const r = createTask(state, CP.financeiroId, { listId: CP.listId, title: titulo });
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };

  it("(a) Campo preenchido DEPOIS da criação: a visibilidade nasce na mesma operação que grava o Campo", () => {
    const nova = novaConta("Consultoria avulsa — outubro");
    // O “antes” é o que documenta que a visibilidade é do dado, e não do ato de
    // criar: numa Conta de verdade a Pessoa só entra por `setTaskFieldValue`.
    expect(memberSeesTask(state, PEDRO, nova.id)).toBe(false);
    expect(setTaskFieldValue(state, CP.financeiroId, nova.id, F.pessoa, PEDRO).ok).toBe(true);
    expect(memberSeesTask(state, PEDRO, nova.id)).toBe(true);
    expect(grantsSobre(nova.id).length).toBe(0);
  });

  it("(b) a ocorrência que A1 cria ao pagar já nasce visível para a Pessoa — e só para ela", () => {
    // O que este caso prova: ANTES deste plano a Pessoa era Observadora de uma
    // Tarefa que não enxergava. `spawnNextOccurrence` copia `observerMemberIds`
    // e `fieldValues` e não copia Grant nenhuma; lendo o Campo que o spawn já
    // copia, a ocorrência do mês seguinte fica correta de graça.
    const t = conta("tsk_cp_thiago_out");
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.emAutorizacao).ok).toBe(true);
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.pago).ok).toBe(true);
    const proxima = state.tasks[state.tasks.length - 1];
    if (!proxima) throw new Error("sem próxima ocorrência");
    expect(proxima.provenance?.kind).toBe("recurrence");
    expect(campo(proxima, F.pessoa)).toBe(PEDRO);
    expect(proxima.observerMemberIds).toContain(PEDRO);
    expect(grantsSobre(proxima.id).length).toBe(0);
    expect(memberSeesTask(state, PEDRO, proxima.id)).toBe(true);
    expect(memberSeesTask(state, LUCAS, proxima.id)).toBe(false);
  });

  it("(c) trocar a Pessoa tira a visibilidade da anterior na mesma operação — não há revogação a esquecer", () => {
    const nova = novaConta("Consultoria avulsa — novembro");
    expect(setTaskFieldValue(state, CP.financeiroId, nova.id, F.pessoa, PEDRO).ok).toBe(true);
    expect(memberSeesTask(state, PEDRO, nova.id)).toBe(true);
    expect(memberSeesTask(state, LUCAS, nova.id)).toBe(false);
    // É este o caminho de “revoke perdido” de T-3-01, que sob derivação não existe.
    expect(setTaskFieldValue(state, CP.financeiroId, nova.id, F.pessoa, LUCAS).ok).toBe(true);
    expect(memberSeesTask(state, PEDRO, nova.id)).toBe(false);
    expect(memberSeesTask(state, LUCAS, nova.id)).toBe(true);
  });

  it("(d) limpar o Campo Pessoa faz os dois deixarem de enxergar", () => {
    const nova = novaConta("Consultoria avulsa — dezembro");
    expect(setTaskFieldValue(state, CP.financeiroId, nova.id, F.pessoa, PEDRO).ok).toBe(true);
    expect(memberSeesTask(state, PEDRO, nova.id)).toBe(true);
    // O vazio que `setTaskFieldValue` aceita para um Campo não obrigatório.
    expect(setTaskFieldValue(state, CP.financeiroId, nova.id, F.pessoa, "").ok).toBe(true);
    expect(campo(nova, F.pessoa)).toBeNull();
    expect(memberSeesTask(state, PEDRO, nova.id)).toBe(false);
    expect(memberSeesTask(state, LUCAS, nova.id)).toBe(false);
  });

  it("(e) enxergar não é escrever: numa Tarefa vista SÓ por derivação, a edição continua restrita a Anexo e Data de Emissão", () => {
    // A simetria com operations.test.ts “seção 10” (linhas 3744-3752) é o ponto:
    // lá a Tarefa é vista por Grant do seed, aqui por derivação, e o resultado
    // da ESCRITA tem que ser idêntico. É isto que prova que a derivação abriu
    // leitura e nada mais — `guestFieldWriter` e `taskWriteRefusal` intocados.
    const nova = novaConta("Consultoria avulsa — janeiro");
    expect(setTaskFieldValue(state, CP.financeiroId, nova.id, F.pessoa, PEDRO).ok).toBe(true);
    expect(grantsSobre(nova.id).length).toBe(0);
    expect(setTaskFieldValue(state, PEDRO, nova.id, F.anexo, "NFS-e_99.pdf").ok).toBe(true);
    expect(setTaskFieldValue(state, PEDRO, nova.id, F.dataEmissao, "2026-09-10").ok).toBe(true);
    expect(addTaskComment(state, PEDRO, nova.id, { content: "feito" }).ok).toBe(true);
    const valor = setTaskFieldValue(state, PEDRO, nova.id, F.valor, 1);
    expect(valor.ok).toBe(false);
    if (!valor.ok) expect(valor.error).toMatch(/Anexo e Data de Emissão/);
    expect(changeTaskStatus(state, PEDRO, nova.id, S.lancado).ok).toBe(false);
    expect(updateTask(state, PEDRO, nova.id, { title: "x" }).ok).toBe(false);
    // E na conta cujo Campo Pessoa é o Lucas, toda escrita do Pedro é recusada.
    expect(setTaskFieldValue(state, PEDRO, "tsk_cp_konq", F.anexo, "x.pdf").ok).toBe(false);
    expect(addTaskComment(state, PEDRO, "tsk_cp_konq", { content: "oi" }).ok).toBe(false);
  });

  it("(f) a cobrança de A5 chega a quem deve: pendingMentions filtra por memberSeesTask, e o filtro tem o valor certo dos dois lados", () => {
    // Fecha o laço com o registro de ameaça de 03-02, que aceitou T-3-01 no ramo
    // `notificar` justamente porque `pendingMentions` filtra por `memberSeesTask`.
    const t = conta("tsk_cp_thiago_out");
    expect(changeTaskStatus(state, CP.financeiroId, t.id, S.emAutorizacao).ok).toBe(true);
    expect(changeTaskStatus(state, CP.aprovadorId, t.id, S.pago).ok).toBe(true);
    const proxima = state.tasks[state.tasks.length - 1];
    if (!proxima) throw new Error("sem próxima ocorrência");
    // Dia civil fixo, construído pelo construtor numérico de Date: a partir de
    // string ISO seria meia-noite UTC, que em América/São_Paulo cai no dia
    // anterior, enquanto `runScheduledAutomations` lê getFullYear/getMonth/getDate
    // em horário local.
    expect(updateTask(state, CP.financeiroId, proxima.id, { dueDate: { form: "civilDay", value: "2026-11-20" } }).ok).toBe(true);
    const cincoDiasAntes = new Date(2026, 10, 15);
    const r = runScheduledAutomations(state, CP.financeiroId, CP.listId, cincoDiasAntes);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const cobranca = proxima.comments.find((c) => c.content.includes("emitir sua nota"));
    expect(cobranca).toBeDefined();
    expect(cobranca?.mentions.some((m) => m.id === PEDRO)).toBe(true);
    // A Menção chega ao Pedro porque ele enxerga a Tarefa por derivação…
    expect(pendingMentions(state, PEDRO).some((p) => p.comment.id === cobranca?.id)).toBe(true);
    // …e não ao Lucas, que não é a Pessoa desta conta.
    expect(pendingMentions(state, LUCAS).some((p) => p.comment.id === cobranca?.id)).toBe(false);
  });
});

