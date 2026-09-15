/**
 * Processo "Contas a receber" (Financeiro) montado com as entidades da
 * ontologia, na mesma Pasta de Contas a pagar: Lista "Contas a receber";
 * Tipo "Conta" e Valor herdados da Pasta; seis Status com requisitos de
 * entrada e origens permitidas; Campos da seção 9; o cliente como Contato do
 * CRM ligado por Vínculo; as Automações R2–R6 (R1 é a operação "série de
 * parcelas", R7 é a Recorrência do saque); e Tarefas fictícias que reproduzem os
 * casos do histórico lido no ClickUp em 2026-09-14
 * (`docs/07-processos/contas-a-receber.md`): clientes, valores e datas são
 * inventados, com as datas perto de hoje para o processo poder rodar.
 *
 * Decisões da seção 12: `em cobrança`/`inadimplência` viram o Campo "Situação
 * de cobrança" (seção 6); `conta tria` vira o Campo "Conta de recebimento";
 * os Saques passam a registrar o valor sacado; `disponível para saque` e
 * `estornado` ficam no Conjunto porque estão configurados.
 */

import type { DataState } from "./state";
import { CP, CR } from "./operations/financeiro";
import type {
  ActorRef,
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationTrigger,
  Comment,
  Contact,
  FieldDefinition,
  FieldValue,
  Grant,
  Id,
  StatusSet,
  Task,
} from "./types";

interface Clock {
  readonly at: (daysAgo: number, hour?: number) => string;
  readonly workspaceId: Id;
}

const member = (id: Id): ActorRef => ({ kind: "member", id });
const F = CR.fields;
const S = CR.status;

export function applyContasAReceber(state: DataState, clock: Clock): void {
  const { at, workspaceId } = clock;
  const d = (n: number) => {
    const hoje = new Date();
    const x = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };

  /* ── Conjunto de Status (seção 3) ─────────────────────────────────────── */
  const statusSet: StatusSet = {
    id: "sts_contas_a_receber",
    definitions: [
      { id: S.paraReceber, name: "para receber", color: "#94a3b8", category: "naoIniciado", order: 0 },
      { id: S.disponivelSaque, name: "disponível para saque", color: "#0ea5e9", category: "emAndamento", order: 1 },
      // RN-CR-04 — pendente só de "para receber" ou de "recebido" (reversão).
      { id: S.pendente, name: "pendente", color: "#f97316", category: "emAndamento", order: 2, entryFromStatusIds: [S.paraReceber, S.recebido] },
      { id: S.estornado, name: "estornado", color: "#a855f7", category: "concluido", order: 3, entryFromStatusIds: [S.recebido] },
      // RN-CR-04 — descartado a partir de qualquer Status não fechado.
      { id: S.descartado, name: "descartado", color: "#6b7280", category: "concluido", order: 4, entryFromStatusIds: [S.paraReceber, S.disponivelSaque, S.pendente, S.estornado] },
      // RN-CR-03 — recebido exige Valor > 0; a Data de pagamento a R3 preenche se faltar.
      { id: S.recebido, name: "recebido", color: "#166534", category: "fechado", order: 5, entryRequirements: [{ definitionId: CP.fields.valor, positive: true }] },
    ],
  };

  state.lists.push({
    id: CR.listId,
    workspaceId,
    createdBy: member(CP.financeiroId),
    createdAt: at(400),
    lifecycle: "ativo",
    name: "Contas a receber",
    description: "Uma Tarefa por valor a receber: a entrada e cada parcela de um contrato, e os saques de plataforma.",
    order: 1,
    isPrivate: false,
    modes: { statusSet: "sobrescrito", features: "sobrescrito" },
    blocks: {},
    statusSet,
    // RN-CR-06 — nunca Subtarefa; Checklists e Dependências não fazem parte do processo.
    features: { subtarefas: false, checklists: false, dependencias: false, compartilhamentoPublico: false },
    parentType: "folder",
    parentId: CP.folderId,
  });

  /* ── Definições de Campo (seções 4 e 9) ───────────────────────────────── */
  const fd = (id: Id, name: string, type: FieldDefinition["type"], at_: "space" | "list", options?: readonly string[], description?: string): FieldDefinition => ({
    id,
    workspaceId,
    name,
    ...(description ? { description } : {}),
    type,
    ...(options ? { options } : {}),
    required: false,
    target: "task",
    definedAtType: at_,
    definedAtId: at_ === "space" ? CP.spaceId : CR.listId,
    lifecycle: "ativo",
  });
  state.fieldDefinitions.push(
    // Y-Produto: do Espaço, como no ClickUp (em Contas a pagar fica vazio).
    fd(F.produto, "Produto", "multiSelect", "space", ["Master Private", "Mentoria", "Consultoria", "Curso", "Plataforma"], "O que foi vendido."),
    fd(F.tipo, "Tipo de recebimento", "singleSelect", "list", [CR.tipos.entrada, CR.tipos.parcela, CR.tipos.saque, CR.tipos.avulso], "Entrada, parcela, saque de plataforma ou avulso — antes, só o Nome dizia."),
    fd(F.numeroParcela, "Número da parcela", "number", "list", undefined, "A ordem da parcela no contrato."),
    fd(F.totalParcelas, "Total de parcelas", "number", "list", undefined, "Quantas parcelas o contrato tem."),
    fd(F.dataPagamento, "Data de pagamento", "date", "list", undefined, "Quando o dinheiro entrou; a Automação R3 preenche se faltar."),
    fd(F.forma, "Forma de recebimento", "singleSelect", "list", ["Pix", "Boleto", "Cartão", "Plataforma"]),
    fd(F.situacao, "Situação de cobrança", "singleSelect", "list", [CR.situacoes.emDia, CR.situacoes.emCobranca, CR.situacoes.inadimplente], "Substitui as Tags “em cobrança” e “inadimplência”: são excludentes e têm ordem."),
    fd(F.contaRecebimento, "Conta de recebimento", "singleSelect", "list", ["TRIA", "KONQ", "KOPS", "ROBERTH", "AUTON", "TF TRIA", "ARKLINE", "INEVITAVEIS"], "Qual conta bancária recebe."),
  );

  /* ── Clientes no CRM (seção 2) ────────────────────────────────────────── */
  const contact = (id: Id, firstName: string, lastName: string, ownerMemberId: Id, email: string): Contact => ({
    id,
    workspaceId,
    createdBy: member(ownerMemberId),
    createdAt: at(260),
    lifecycle: "ativo",
    firstName,
    lastName,
    ownerMemberId,
    creationMode: "manual",
    qualificationId: "cat_qual_cli",
    description: "",
    identifiers: [{ id: `cid_${id}`, type: "email", value: email, displayValue: email, verified: true, principal: true, createdBy: member(ownerMemberId), createdAt: at(260) }],
    consents: [],
    addresses: [],
    tagIds: [],
    fieldValues: [],
    comments: [],
  });
  const helena = contact("cnt_cr_helena", "Helena", "Vasconcelos", CR.comercialId, "helena.vasconcelos@exemplo.com.br");
  const ricardo = contact("cnt_cr_ricardo", "Ricardo", "Tavares", CR.comercialId, "financeiro@tavaresclinica.exemplo.com.br");
  const camila = contact("cnt_cr_camila", "Camila", "Duarte", "mem_rafael", "camila.duarte@exemplo.com.br");
  const otavio = contact("cnt_cr_otavio", "Otávio", "Ramires", "mem_rafael", "otavio.ramires@exemplo.com.br");
  state.contacts.push(helena, ricardo, camila, otavio);

  /* ── Permissões (seção 10) ─────────────────────────────────────────────── */
  const grant = (id: Id, subjectId: Id, action: Grant["action"], resourceType: string, resourceId: Id): Grant => ({
    id,
    workspaceId,
    subjectKind: "member",
    subjectId,
    action,
    resourceType,
    resourceId,
    scope: "subarvore",
    origin: "concessaoDireta",
    grantedBy: "mem_thiago",
    grantedAt: at(300),
  });
  // A Diretoria vê, comenta e muda Status; o Financeiro já administra o Espaço.
  state.grants.push(grant("gr_cr_diretoria", CP.aprovadorId, "editar", "list", CR.listId));

  /* ── Automações (seção 8) ─────────────────────────────────────────────── */
  const automation = (id: Id, name: string, description: string, trigger: AutomationTrigger, conditions: AutomationCondition[], actions: AutomationAction[]): Automation => ({
    id,
    workspaceId,
    createdBy: member(CP.financeiroId),
    createdAt: at(100),
    lifecycle: "ativo",
    name,
    description,
    scopeType: "list",
    scopeId: CR.listId,
    ownerMemberId: CP.financeiroId,
    reactsToAutomationEvents: false,
    versions: [{ number: 1, state: "publicada", trigger, conditions, actions, errorPolicy: { onActionFailure: "interromper", retries: 0 }, publishedBy: CP.financeiroId, publishedAt: at(99), createdAt: at(100) }],
  });
  const entrou = (status: string): AutomationTrigger => ({ kind: "evento", eventType: "tarefaEntrouEmStatus", eventSubtype: status });
  const vencimento = (dias: number): AutomationTrigger => ({ kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: dias }) });
  const cond = (spec: object): AutomationCondition => ({ kind: "valorDeCampo", expression: JSON.stringify(spec) });
  const acao = (order: number, toolId: string, params: object): AutomationAction => ({ order, kind: "escrita", toolId, params: JSON.stringify(params) });
  state.automations.push(
    // R1 (série na assinatura) é a operação `createReceivableSeries`: sem Gestão contratual, o gatilho é o botão da Lista.
    automation("aut_cr_r2", "R2 · D+1: venceu, entra em cobrança", "Um dia após o vencimento, ainda “para receber”: vai para “pendente” (R2b marca a Situação) e avisa o Financeiro.", vencimento(1), [cond({ status: "para receber" })], [
      acao(1, "tarefa.alterarStatus", { statusName: "pendente" }),
      acao(2, "tarefa.comentar", { template: "Venceu em {{vencimento}} sem recebimento: {{cliente}} entrou em cobrança.", mentionMemberId: CP.financeiroId }),
    ]),
    automation("aut_cr_r2b", "R2b · Em pendente: Situação “em cobrança”", "Ao entrar em “pendente” — pelo relógio (R2) ou à mão (“Iniciar cobrança”) — a Situação de cobrança vira “em cobrança”.", entrou("pendente"), [], [
      acao(1, "tarefa.definirCampo", { definitionId: F.situacao, value: CR.situacoes.emCobranca }),
    ]),
    automation("aut_cr_r3", "R3 · Recebido: data e situação", "Ao entrar em “recebido”, preenche a Data de pagamento com hoje (se o Financeiro não preencheu) e volta a Situação para “em dia”.", entrou("recebido"), [], [
      acao(1, "tarefa.definirCampo", { definitionId: F.dataPagamento, today: true, onlyIfEmpty: true }),
      acao(2, "tarefa.definirCampo", { definitionId: F.situacao, value: CR.situacoes.emDia }),
    ]),
    automation("aut_cr_r4", "R4 · 30 dias em cobrança: Comercial", "Trinta dias após o vencimento, ainda “pendente”: Comentário com Menção ao dono do cliente no CRM — o “para conhecimento” de hoje.", vencimento(30), [cond({ status: "pendente" })], [
      acao(1, "tarefa.comentar", { template: "{{donoDoCliente}}, {{cliente}} está há 30 dias em cobrança ({{titulo}}, venceu {{vencimento}}). Para conhecimento.", mentionClientOwner: true }),
    ]),
    automation("aut_cr_r5", "R5 · 60 dias em cobrança: Diretoria", "Sessenta dias após o vencimento, ainda “pendente”: escalona à Diretoria.", vencimento(60), [cond({ status: "pendente" })], [
      acao(1, "tarefa.comentar", { template: "{{cliente}} está há 60 dias em cobrança ({{titulo}}). Escalonado à Diretoria para ligar ao cliente.", mentionMemberId: CP.aprovadorId }),
    ]),
    automation("aut_cr_r6", "R6 · Descartado em cobrança: inadimplente", "Ao entrar em “descartado” com Situação “em cobrança”, a Situação vira “inadimplente”. Um cancelamento (sem cobrança) segue “em dia”.", entrou("descartado"), [cond({ definitionId: F.situacao, equals: CR.situacoes.emCobranca })], [
      acao(1, "tarefa.definirCampo", { definitionId: F.situacao, value: CR.situacoes.inadimplente }),
    ]),
  );

  /* ── Tarefas (seções 5 e 7) ───────────────────────────────────────────── */
  const val = (definitionId: Id, value: FieldValue["value"]): FieldValue => ({ definitionId, value, state: "ativo" });
  let seq = 0;
  const conta = (id: Id, title: string, statusId: Id, due: string, createdDaysAgo: number, fields: FieldValue[], extra: Partial<Task> = {}): Task => {
    seq += 1;
    return {
      id,
      workspaceId,
      createdBy: member(CP.financeiroId),
      createdAt: at(createdDaysAgo),
      lifecycle: "ativo",
      listId: CR.listId,
      siblingOrder: seq,
      readableId: `CR-${100 + seq}`,
      title,
      description: "",
      statusId,
      taskTypeId: CP.taskTypeId,
      priority: "normal",
      dueDate: { form: "civilDay", value: due },
      assignees: [member(CP.financeiroId)],
      observerMemberIds: [CP.financeiroId],
      tagIds: [],
      fieldValues: fields,
      checklists: [],
      timeEntries: [],
      dependencies: [],
      attachments: [],
      comments: [],
      updatedAt: at(createdDaysAgo),
      ...extra,
    };
  };
  const comment = (id: Id, author: ActorRef, content: string, when: string, mentions: Array<{ type: string; id: Id }> = [], resolved?: { by: Id; at: string }): Comment => ({
    id,
    author,
    content,
    attachments: [],
    mentions,
    createdAt: when,
    ...(resolved ? { resolved } : {}),
  });
  const base = (centro: string, empresa: string, produto: string, conta_: string): FieldValue[] => [
    val(CP.fields.centroDeCusto, centro),
    val(CP.fields.empresa, empresa),
    val(F.produto, [produto]),
    val(F.contaRecebimento, conta_),
    val(F.forma, "Pix"),
  ];
  const parcela = (n: number, total: number, valor: number, situacao: string, dataPagamento?: string): FieldValue[] => [
    val(F.tipo, CR.tipos.parcela),
    val(F.numeroParcela, n),
    val(F.totalParcelas, total),
    val(CP.fields.valor, valor),
    val(F.situacao, situacao),
    ...(dataPagamento ? [val(F.dataPagamento, dataPagamento)] : []),
  ];
  // Helena Vasconcelos — a série criada de uma vez na assinatura (seção 5): entrada + 4 parcelas.
  const gabBase = base("Marcos Paulo", "Tria Company", "Master Private", "TRIA");
  const gabEntrada = conta("tsk_cr_gab_entrada", "Entrada – Helena Vasconcelos", S.recebido, d(-75), 70, [...gabBase, val(F.tipo, CR.tipos.entrada), val(F.totalParcelas, 4), val(CP.fields.valor, 20000), val(F.situacao, CR.situacoes.emDia), val(F.dataPagamento, d(-75))], { startDate: { form: "civilDay", value: d(-70) }, completedAt: at(70, 15) });
  const gab1 = conta("tsk_cr_gab_1", "1ª Parcela – Helena Vasconcelos", S.recebido, d(-45), 70, [...gabBase, ...parcela(1, 4, 20000, CR.situacoes.emDia, d(-44))], { startDate: { form: "civilDay", value: d(-70) }, completedAt: at(44, 10) });
  // Venceu ontem e ninguém marcou: é a que R2 leva para "pendente" na próxima rodada do relógio.
  const gab2 = conta("tsk_cr_gab_2", "2ª Parcela – Helena Vasconcelos", S.paraReceber, d(-1), 70, [...gabBase, ...parcela(2, 4, 20000, CR.situacoes.emDia)], { startDate: { form: "civilDay", value: d(-70) } });
  const gab3 = conta("tsk_cr_gab_3", "3ª Parcela – Helena Vasconcelos", S.paraReceber, d(29), 70, [...gabBase, ...parcela(3, 4, 20000, CR.situacoes.emDia)], { startDate: { form: "civilDay", value: d(-70) } });
  const gab4 = conta("tsk_cr_gab_4", "4ª Parcela – Helena Vasconcelos", S.paraReceber, d(59), 70, [...gabBase, ...parcela(4, 4, 20000, CR.situacoes.emDia)], { startDate: { form: "civilDay", value: d(-70) } });

  // Ricardo Tavares — a cobrança que escalonou por três times e terminou recebida (seção 7.4).
  const ken11 = conta("tsk_cr_ken_11", "11ª Parcela – Ricardo Tavares", S.recebido, d(-280), 300, [...base("Roberth Resende", "Tria Company", "Mentoria", "TRIA"), ...parcela(11, 12, 16875, CR.situacoes.emDia, d(-5))], {
    description: "Cobrança via WhatsApp: em D+10, D+40, D+90, D+150 e D+250. Contato do financeiro deles: Renata.",
    observerMemberIds: [CP.financeiroId, CR.comercialId, CP.aprovadorId],
    completedAt: at(5, 11),
    comments: [
      comment("cmt_cr_1", member(CP.financeiroId), "@Marcos Paulo ainda não finalizaram o contrato anterior e nem deram nenhum valor de entrada do atual.", at(150, 9), [{ type: "member", id: CP.aprovadorId }], { by: CP.aprovadorId, at: at(150, 12) }),
      comment("cmt_cr_2", member(CR.comercialId), "@Marcos Paulo você liberou a renovação 12 × 16.875 com a última parcela em aberto? @Rafael Nunes formaliza a renovação, por favor.", at(150, 14), [{ type: "member", id: CP.aprovadorId }, { type: "member", id: "mem_rafael" }]),
      comment("cmt_cr_3", member(CR.comercialId), "@Maryane Generozo manda a última cobrança?", at(50, 10), [{ type: "member", id: CP.financeiroId }]),
      comment("cmt_cr_4", member(CP.financeiroId), "Print da cobrança de 25/06 anexado. @Júlia Prado @Rafael Nunes pagamento não localizado.", at(28, 16), [{ type: "member", id: CR.comercialId }, { type: "member", id: "mem_rafael" }]),
      comment("cmt_cr_5", member(CP.financeiroId), "Cobrado novamente hoje.", at(21, 9)),
      comment("cmt_cr_6", member(CP.aprovadorId), "Me confirma aí que vou ligar para eles.", at(20, 8)),
      comment("cmt_cr_7", member(CP.financeiroId), "Já cobrei algumas vezes a Renata, que é o financeiro deles.", at(20, 9)),
    ],
  });

  // Camila Duarte — inadimplência: a 1ª pendente há meses, as demais descartadas (seção 7.5).
  const daiBase = base("Igor Alves", "PLX digital", "Curso", "TRIA");
  const dai1 = conta("tsk_cr_dai_1", "1ª Parcela – Camila Duarte", S.pendente, d(-120), 150, [...daiBase, ...parcela(1, 4, 3500, CR.situacoes.emCobranca)], {
    description: "contato via whatsapp\nem D+5\nem D+14\nem D+33\nem D+54",
    comments: [
      comment("cmt_cr_8", member(CP.financeiroId), "Print da conversa anexado. @Rafael Nunes para conhecimento.", at(106, 11), [{ type: "member", id: "mem_rafael" }]),
      comment("cmt_cr_9", member(CP.financeiroId), "Sem resposta. Cobrado de novo hoje.", at(66, 11)),
    ],
  });
  const dai2 = conta("tsk_cr_dai_2", "2ª Parcela – Camila Duarte", S.descartado, d(-90), 150, [...daiBase, ...parcela(2, 4, 3500, CR.situacoes.inadimplente)], { completedAt: at(30, 10) });
  const dai3 = conta("tsk_cr_dai_3", "3ª Parcela – Camila Duarte", S.descartado, d(-60), 150, [...daiBase, ...parcela(3, 4, 3500, CR.situacoes.inadimplente)], { completedAt: at(30, 10) });
  const dai4 = conta("tsk_cr_dai_4", "4ª Parcela – Camila Duarte", S.descartado, d(-30), 150, [...daiBase, ...parcela(4, 4, 3500, CR.situacoes.inadimplente)], { completedAt: at(30, 10) });

  // Otávio Ramires — cancelamento: parcelas restantes descartadas sem cobrança, Situação "em dia".
  const gusBase = base("Tria Tech", "Tria Company", "Consultoria", "TRIA");
  const gus3 = conta("tsk_cr_gus_3", "3ª Parcela – Otávio Ramires", S.recebido, d(-35), 120, [...gusBase, ...parcela(3, 5, 4200, CR.situacoes.emDia, d(-35))], { completedAt: at(35, 9) });
  const gus4 = conta("tsk_cr_gus_4", "4ª Parcela – Otávio Ramires", S.descartado, d(-5), 120, [...gusBase, ...parcela(4, 5, 4200, CR.situacoes.emDia)], { completedAt: at(12, 10) });
  const gus5 = conta("tsk_cr_gus_5", "5ª Parcela – Otávio Ramires", S.descartado, d(25), 120, [...gusBase, ...parcela(5, 5, 4200, CR.situacoes.emDia)], { completedAt: at(12, 10) });

  // Saques de plataforma — R7: recorrência mensal, valor sacado registrado (decisão da seção 12).
  const saqueBase = (valor: number): FieldValue[] => [val(CP.fields.centroDeCusto, "Tria Tech"), val(CP.fields.empresa, "Tria Company"), val(F.produto, ["Master Private"]), val(F.tipo, CR.tipos.saque), val(F.forma, "Plataforma"), val(F.contaRecebimento, "TRIA"), val(CP.fields.valor, valor), val(F.situacao, CR.situacoes.emDia)];
  const saqueAgo = conta("tsk_cr_saque_ago", "Saque da plataforma de cursos", S.recebido, d(-20), 50, [...saqueBase(8500), val(F.dataPagamento, d(-19))], { priority: "alta", completedAt: at(19, 10), description: "Saldo liberado na plataforma puxado para a conta da empresa." });
  const saqueSet = conta("tsk_cr_saque_set", "Saque da plataforma de cursos", S.disponivelSaque, d(10), 20, saqueBase(9200), {
    priority: "alta",
    recurrence: { frequency: "mensal", interval: 1, triggerMode: "aoConcluir", businessDays: "posterior", defaultAssigneeMemberId: CP.financeiroId, copies: { checklists: false, subtasks: false, assignees: false, fieldValues: true, fieldValuesExcept: [F.dataPagamento] } },
    provenance: { kind: "recurrence", sourceId: saqueAgo.id, sourceName: saqueAgo.title, at: at(19, 10) },
  });

  const tarefas = [gabEntrada, gab1, gab2, gab3, gab4, ken11, dai1, dai2, dai3, dai4, gus3, gus4, gus5, saqueAgo, saqueSet];
  state.tasks.push(...tarefas);

  /* ── Vínculos com o cliente e o que o Comercial vê (seções 2 e 10) ───── */
  const cliente = (t: Task, c: Contact) => {
    state.links.push({ id: `lnk_cr_${t.id}`, fromType: "task", fromId: t.id, toType: "contact", toId: c.id, role: CR.linkRole, createdBy: member(CP.financeiroId), createdAt: t.createdAt });
    // O dono do cliente no CRM vê e comenta só as contas dos seus clientes.
    state.grants.push(grant(`gr_cr_${t.id}`, c.ownerMemberId, "comentar", "task", t.id));
  };
  for (const t of [gabEntrada, gab1, gab2, gab3, gab4]) cliente(t, helena);
  cliente(ken11, ricardo);
  for (const t of [dai1, dai2, dai3, dai4]) cliente(t, camila);
  for (const t of [gus3, gus4, gus5]) cliente(t, otavio);

  /* ── Histórico (seções 3 e 7) ─────────────────────────────────────────── */
  const hist = (t: Task, actor: ActorRef, before: string, after: string, when: string, delegate?: ActorRef) => {
    state.activity.unshift({
      id: `act_cr_${state.activity.length + 1}`,
      workspaceId,
      actor,
      ...(delegate ? { delegate } : {}),
      action: "Status alterado",
      objectType: "task",
      objectId: t.id,
      objectName: t.title,
      at: when,
      result: "ok",
      before,
      after,
    });
  };
  for (const t of tarefas) {
    state.activity.push({ id: `act_cr_criada_${t.id}`, workspaceId, actor: t.createdBy, action: "Tarefa criada", objectType: "task", objectId: t.id, objectName: t.title, at: t.createdAt, result: "ok" });
  }
  hist(gabEntrada, member(CP.financeiroId), "para receber", "recebido", at(70, 15));
  hist(gab1, member(CP.financeiroId), "para receber", "recebido", at(44, 10));
  hist(ken11, member(CP.financeiroId), "para receber", "pendente", at(279, 9));
  hist(ken11, member(CP.financeiroId), "pendente", "recebido", at(5, 11));
  hist(dai1, { kind: "automation", id: "aut_cr_r2" }, "para receber", "pendente", at(119, 6), member(CP.financeiroId));
  for (const t of [dai2, dai3, dai4]) hist(t, member(CP.financeiroId), "pendente", "descartado", at(30, 10));
  hist(gus3, member(CP.financeiroId), "para receber", "recebido", at(35, 9));
  for (const t of [gus4, gus5]) hist(t, member(CP.financeiroId), "para receber", "descartado", at(12, 10));
  hist(saqueAgo, member(CP.financeiroId), "para receber", "recebido", at(19, 10));
  hist(saqueSet, member(CP.financeiroId), "para receber", "disponível para saque", at(2, 9));

  state.views.push(
    { id: "viw_cr_cobranca", name: "Em cobrança", kind: "lista", ownerKind: "container", ownerId: CR.listId, listId: CR.listId, filters: { statusId: S.pendente }, sortBy: { by: "dueDate", direction: "asc" }, isDefault: false, createdBy: CP.financeiroId, createdAt: at(90) },
    { id: "viw_cr_a_receber", name: "A receber", kind: "lista", ownerKind: "container", ownerId: CR.listId, listId: CR.listId, filters: { statusId: S.paraReceber }, sortBy: { by: "dueDate", direction: "asc" }, isDefault: false, createdBy: CP.financeiroId, createdAt: at(90) },
  );
}
