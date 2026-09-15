/**
 * Processo "Contas a pagar" (Financeiro) montado com as entidades da
 * ontologia: Espaço privado "Gestão" › Pasta "Financeiro" › Lista "Contas a
 * pagar"; Tipo "Conta"; oito Status com requisitos de saída e entrada
 * restrita; 21 Definições de Campo (4 no Espaço, herdadas); oito Tags
 * `conta *`; quatro papéis; o Agente de lançamento com sua Coleção de
 * Conhecimento; as Automações A2–A9 (A1 é a Recorrência da Tarefa); e Tarefas
 * fictícias que reproduzem os casos do histórico lido no ClickUp em 2026-09-13
 * (`docs/07-processos/contas-a-pagar.md`) — fornecedores, CNPJs, chaves e
 * valores são inventados.
 *
 * Decisões da seção 12 do documento: sem `Data Vencimento` (L, duplica a
 * nativa), sem `Equipe` (W) nem `Produto` (Y) (resíduos vazios); `aprovado`
 * fica no Conjunto porque está configurado, mesmo sem uso observado.
 */

import type { DataState } from "./state";
import { CP } from "./operations/financeiro";
import type {
  ActorRef,
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationTrigger,
  Comment,
  FieldDefinition,
  FieldValue,
  Grant,
  Id,
  Member,
  RecurrenceRule,
  StatusSet,
  Task,
} from "./types";

interface Clock {
  readonly at: (daysAgo: number, hour?: number) => string;
  readonly day: (daysFromNow: number) => string;
  readonly workspaceId: Id;
}

const member = (id: Id): ActorRef => ({ kind: "member", id });
const F = CP.fields;
const S = CP.status;

export function applyContasAPagar(state: DataState, clock: Clock): void {
  const { at, day, workspaceId } = clock;

  /* ── Membros ─────────────────────────────────────────────────────────── */
  const mk = (id: Id, displayName: string, roleId: Id): Member => ({
    id,
    workspaceId,
    userId: `usr_${id}`,
    displayName,
    state: "ativo",
    roleId,
    joinedAt: at(300),
    availability: { value: "disponivel", at: at(1), origin: "membro" },
    userMemory: { enabled: true, items: [] },
    weeklyCapacityMinutes: 40 * 60,
  });
  state.members.push(
    mk(CP.financeiroId, "Maryane Generozo", "role_mem"),
    mk(CP.aprovadorId, "Marcos Paulo", "role_mem"),
    mk(CP.aprovadorKonqId, "Walter Galvão Neto", "role_mem"),
    mk("mem_thiago_pereira", "Pedro Alencar", "role_conv"),
    mk("mem_joao_konq", "Lucas Ferraz (Konq)", "role_conv"),
  );

  /* ── Conjunto de Status (seção 3) ─────────────────────────────────────── */
  const dadoDePagamento = [
    // RN-CP-01 — Centro de Custo é o único obrigatório; conferido na saída de "para pagar".
    { definitionId: F.centroDeCusto },
    { definitionId: F.valor },
    { attribute: "dueDate" as const },
    { definitionId: F.forma },
    { definitionId: F.chavePix, whenDefinitionId: F.forma, whenValue: "Chave Pix" },
    { definitionId: F.codigoBarras, whenDefinitionId: F.forma, whenValue: "Boleto" },
    { definitionId: F.boleto, whenDefinitionId: F.forma, whenValue: "Boleto" },
    { definitionId: F.pixCopiaECola, whenDefinitionId: F.forma, whenValue: "QRCode Pix" },
    { definitionId: F.qrCode, whenDefinitionId: F.forma, whenValue: "QRCode Pix" },
    { definitionId: F.cpf, whenDefinitionId: F.fornecedor, whenValue: "CPF" },
    { definitionId: F.cnpj, whenDefinitionId: F.fornecedor, whenValue: "CNPJ" },
  ];
  const statusSet: StatusSet = {
    id: "sts_contas_a_pagar",
    definitions: [
      // RN-CP-02/03 — sair de "para pagar" exige o dado de pagamento coerente com a forma.
      { id: S.paraPagar, name: "para pagar", color: "#94a3b8", category: "naoIniciado", order: 0, exitRequirements: dadoDePagamento },
      { id: S.emLancamento, name: "em lançamento omie", color: "#f59e0b", category: "emAndamento", order: 1 },
      { id: S.lancado, name: "lançado omie", color: "#3b82f6", category: "emAndamento", order: 2 },
      { id: S.emRemessa, name: "em remessa bancária", color: "#8b5cf6", category: "emAndamento", order: 3 },
      { id: S.emAutorizacao, name: "em autorização bancária", color: "#f97316", category: "emAndamento", order: 4 },
      { id: S.aprovado, name: "aprovado", color: "#22c55e", category: "concluido", order: 5 },
      { id: S.negado, name: "negado", color: "#ef4444", category: "concluido", order: 6 },
      // RN-CP-04 — só o Aprovador fecha como pago.
      { id: S.pago, name: "pago", color: "#166534", category: "fechado", order: 7, entryAllowedMemberIds: [CP.aprovadorId, CP.aprovadorKonqId] },
    ],
  };

  /* ── Estrutura (seção 2) ──────────────────────────────────────────────── */
  state.spaces.push({
    id: CP.spaceId,
    workspaceId,
    createdBy: member(CP.financeiroId),
    createdAt: at(400),
    lifecycle: "ativo",
    name: "Gestão",
    description: "Financeiro, administrativo e governança. Privado: dados bancários e CPF de terceiros.",
    color: "#0f766e",
    order: 4,
    isPrivate: true,
    modes: {},
    blocks: {},
    statusSet: { id: "sts_gestao", definitions: [
      { id: "st_gst_novo", name: "Novo", color: "#94a3b8", category: "naoIniciado", order: 0 },
      { id: "st_gst_and", name: "Em andamento", color: "#3b82f6", category: "emAndamento", order: 1 },
      { id: "st_gst_feito", name: "Concluído", color: "#22c55e", category: "fechado", order: 2 },
    ] },
  });
  state.folders.push({
    id: CP.folderId,
    workspaceId,
    createdBy: member(CP.financeiroId),
    createdAt: at(400),
    lifecycle: "ativo",
    name: "Financeiro",
    order: 0,
    isPrivate: false,
    modes: {},
    blocks: {},
    parentType: "space",
    parentId: CP.spaceId,
  });
  state.lists.push({
    id: CP.listId,
    workspaceId,
    createdBy: member(CP.financeiroId),
    createdAt: at(400),
    lifecycle: "ativo",
    name: "Contas a pagar",
    description: "Uma Tarefa por conta; nasce ~30 dias antes do vencimento e morre em “pago”.",
    order: 0,
    isPrivate: false,
    modes: { statusSet: "sobrescrito", features: "sobrescrito" },
    blocks: {},
    statusSet,
    // Seção 2 — sem Subtarefas, Checklists nem Dependências; Recorrência e Registro de Tempo ficam.
    features: { subtarefas: false, checklists: false, dependencias: false, compartilhamentoPublico: false },
    parentType: "folder",
    parentId: CP.folderId,
    // Seção 10 — a Pessoa da conta preenche só Anexo e Data de Emissão.
    guestEditableDefinitionIds: [F.anexo, F.dataEmissao],
  });
  // O Tipo "Conta" é da Pasta: Contas a pagar e Contas a receber usam o mesmo (B25).
  state.taskTypes.push({ id: CP.taskTypeId, name: "Conta", icon: "receipt", isPlatformDefault: true, definedAtType: "folder", definedAtId: CP.folderId });

  /* ── Definições de Campo (seção 4), na ordem de preenchimento ─────────── */
  const fd = (id: Id, name: string, type: FieldDefinition["type"], at_: "space" | "folder" | "list", required = false, options?: readonly string[], description?: string): FieldDefinition => ({
    id,
    workspaceId,
    name,
    ...(description ? { description } : {}),
    type,
    ...(options ? { options } : {}),
    required,
    target: "task",
    definedAtType: at_,
    definedAtId: at_ === "space" ? CP.spaceId : at_ === "folder" ? CP.folderId : CP.listId,
    lifecycle: "ativo",
  });
  state.fieldDefinitions.push(
    fd(F.centroDeCusto, "Centro de Custo", "singleSelect", "space", true, ["Marcos Paulo", "Renato Cariani", "Igor Alves", "Kaka Diniz", "PLX Apoio", "TRIA", "Anthony Miranda", "Tria Tech", "IVL", "Roberth Resende", "Presidência", "USI", "Konq", "Auton Health", "Kops", "Inevitaveis"], "Quem paga (RN-CP-01: único obrigatório)."),
    fd(F.bu, "BU", "singleSelect", "space", false, ["Roberth Resende", "Igor Alves", "CLAIRIS", "Marcos Paulo", "Instituto Visão Livre", "Renato Cariani", "TRIA - Apoio Funcional", "Kaka Diniz", "Iallas Oliveira", "Tria Tech", "Expert Lucrativo", "KONQ", "Auton Heath"]),
    fd(F.empresa, "Empresa", "singleSelect", "space", false, ["Tria Company", "Oliveira Participações", "EXO Loteamento", "EXO Participações", "Loovi", "PLX digital", "IVL", "USI", "Konq Intermediações", "O2", "Inevitaveis"]),
    fd(F.categoria, "Categoria de pagamento", "singleSelect", "list", false, ["Distribuição de Lucro", "Impostos", "Prestação de Serviços", "Móveis e Utensílios", "Administrativo", "Evento", "Contas de consumo", "A identificar", "Cursos e treinamentos", "Comissão", "Tráfego Pago", "Ferramentas", "Insumos", "Viagens e Hospedagens", "Aporte", "Aluguel", "Tarifas", "Ação Gente e Cultura", "Devolução/Estorno de venda", "Editora", "Correios e Transportadora", "Doação", "Publicidade de Marca / Patrocínio", "Salário"]),
    fd(F.pessoa, "Pessoa", "person", "list", false, undefined, "Quem emite a nota e recebe a cobrança, quando está no Espaço de Trabalho."),
    fd(F.fornecedor, "Fornecedor", "singleSelect", "list", false, ["CPF", "CNPJ"]),
    fd(F.cnpj, "CNPJ", "text", "list"),
    fd(F.cpf, "CPF", "text", "list"),
    fd(F.nomeFornecedor, "Nome do fornecedor", "text", "list", false, undefined, "Quando a Pessoa não está no Espaço de Trabalho."),
    fd(F.anexo, "Anexo", "file", "list", false, undefined, "A nota fiscal (NFS-e em PDF); a Pessoa da conta anexa."),
    fd(F.dataEmissao, "Data de Emissão", "date", "list", false, undefined, "Data da nota; preenchida junto com o Anexo."),
    fd(F.forma, "Forma de pagamento", "singleSelect", "list", false, ["Chave Pix", "Boleto", "QRCode Pix"]),
    fd(F.chavePix, "Chave pix", "text", "list", false, undefined, "Quando a forma é Chave Pix; muitas vezes o próprio CNPJ."),
    fd(F.codigoBarras, "Código de barras", "text", "list", false, undefined, "Quando a forma é Boleto."),
    fd(F.pixCopiaECola, "Pix copia e cola", "text", "list", false, undefined, "Quando a forma é QRCode Pix."),
    fd(F.boleto, "Boleto", "file", "list"),
    fd(F.qrCode, "QR Code", "file", "list"),
    // Na Pasta: é o mesmo Valor de Contas a receber (T-Valor no ClickUp).
    fd(F.valor, "Valor", "currency", "folder", false, undefined, "Valor da conta, em reais."),
    fd(F.integracaoManual, "Integração manual", "singleSelect", "space", false, ["Manual"], "Marcado quando o lançamento no ERP não deve ser feito pelo Agente."),
    fd(F.solicitante, "Nome do solicitante", "text", "list", false, undefined, "Quem pediu a despesa."),
    fd(F.whatsapp, "WhatsApp", "phone", "list", false, undefined, "Contato do fornecedor."),
  );

  /* ── Tags (seção 5) ───────────────────────────────────────────────────── */
  const tagIds: Record<string, Id> = {};
  for (const [i, nome] of ["conta tria", "conta konq", "conta kops", "conta roberth", "conta auton", "conta tf tria", "conta arkline", "conta inevitaveis"].entries()) {
    const id = `tag_cp_${i + 1}`;
    tagIds[nome] = id;
    state.tags.push({ id, workspaceId, name: nome, color: ["#0f766e", "#7c3aed", "#0369a1", "#b45309", "#be123c", "#15803d", "#4338ca", "#a16207"][i] ?? "#334155", lifecycle: "ativo" });
  }

  /* ── Permissões (seção 10) ─────────────────────────────────────────────── */
  const grant = (id: Id, subjectKind: Grant["subjectKind"], subjectId: Id, action: Grant["action"], resourceType: string, resourceId: Id): Grant => ({
    id,
    workspaceId,
    subjectKind,
    subjectId,
    action,
    resourceType,
    resourceId,
    scope: "subarvore",
    origin: "concessaoDireta",
    grantedBy: "mem_thiago",
    grantedAt: at(300),
  });
  state.grants.push(
    grant("gr_cp_financeiro", "member", CP.financeiroId, "administrar", "space", CP.spaceId),
    grant("gr_cp_aprovador", "member", CP.aprovadorId, "editar", "list", CP.listId),
    grant("gr_cp_aprovador_konq", "member", CP.aprovadorKonqId, "editar", "list", CP.listId),
    grant("gr_cp_agente", "agent", CP.agentId, "comentar", "list", CP.listId),
    // A Presidência (Proprietário) enxerga a Gestão: é quem demonstra o processo.
    grant("gr_cp_presidencia", "member", "mem_thiago", "administrar", "space", CP.spaceId),
  );

  /* ── Agente de lançamento (seção 9) e seu Conhecimento ────────────────── */
  state.collections.push({
    id: "col_financeiro_erp",
    workspaceId,
    createdBy: member(CP.financeiroId),
    createdAt: at(120),
    lifecycle: "ativo",
    name: "De-para Omie",
    description: "Como cada conta é classificada no ERP: conta de pagamento, categoria e código.",
    ownerMemberId: CP.financeiroId,
    isPrivate: true,
    sources: [{ id: "src_col_financeiro_erp_manual", kind: "envioManual", name: "Envio manual", state: "ativo" }],
    versionRetention: { maxSuperseded: 5, maxDays: 365 },
  });
  state.documents.push({
    id: "doc_depara_omie",
    workspaceId,
    createdBy: member(CP.financeiroId),
    createdAt: at(120),
    lifecycle: "ativo",
    collectionId: "col_financeiro_erp",
    sourceId: "src_col_financeiro_erp_manual",
    title: "De-para ClickUp → Omie",
    contentType: "texto",
    currentVersion: 1,
    versions: [
      {
        number: 1,
        content: {
          text: [
            "Conta de pagamento pela Tag: conta tria → TRIA; conta konq → KONQ; conta kops → KOPS; conta roberth → ROBERTH; conta auton → AUTON; conta tf tria → TF TRIA; conta arkline → ARKLINE; conta inevitaveis → INEVITAVEIS.",
            "Categoria Omie e código: Prestação de Serviços → Prestação serviços - ADM (2.04.08); Impostos → Impostos e taxas (2.06.01); Aluguel → Aluguel e condomínio (2.03.01); Contas de consumo → Energia, água e telefone (2.03.05); Ferramentas → Software e assinaturas (2.05.02); Comissão → Comissões (2.02.03); Salário → Folha de pagamento (2.01.01); demais em `CATEGORIA_OMIE`.",
            "Sem Tag: a Conta de pagamento é inferida do Centro de Custo e deve ser confirmada antes da remessa.",
          ].join("\n"),
        },
        derivedRepresentations: [],
        processing: "processado",
        origin: { kind: "envio", by: member(CP.financeiroId), at: at(120) },
        fragments: [{ id: "frg_depara_1", position: { order: 0, locator: "1-3" }, derivedContent: "De-para de conta, categoria e código do ERP." }],
        createdAt: at(120),
      },
    ],
    metadata: { language: "pt-BR", labels: ["financeiro", "erp"] },
    provenance: { kind: "template", sourceId: "src_col_financeiro_erp_manual", sourceName: "Envio manual", at: at(120), sourceKind: "envioManual", specificOrigin: "texto digitado" },
    comments: [],
    attachments: [],
  });
  state.agents.push({
    id: CP.agentId,
    workspaceId,
    createdBy: member(CP.financeiroId),
    createdAt: at(120),
    lifecycle: "ativo",
    name: "Agente de lançamento",
    description: "Lê a conta a pagar, publica o Resumo de pagamento com a classificação contábil e a lança no Omie.",
    ownerMemberId: CP.financeiroId,
    roleId: "role_conv",
    versions: [
      {
        number: 1,
        objective: "Lançar cada conta a pagar no ERP com a classificação certa, deixando a justificativa auditável no Comentário.",
        instructions: "Leia a Tarefa. Se faltar Valor, vencimento, forma de pagamento ou o dado de pagamento, comente o que falta e pare. Senão, publique o Resumo de pagamento no formato padrão, resolvido, e lance no Omie.",
        modelId: "mdl_base",
        allowsModelOverride: false,
        allowedToolIds: ["ler_tarefa", "criar_comentario", "alterar_status", "consultar_conhecimento", "omie_lancar_conta_a_pagar"],
        grantedSkillIds: [],
        autonomy: "supervisionado",
        approvalPolicy: { approverMemberIds: [CP.financeiroId], approverTeamIds: [], timeoutHours: 24 },
        memoryEnabled: false,
        knowledgeSources: [{ kind: "base", label: "De-para Omie" }],
        by: member(CP.financeiroId),
        at: at(120),
      },
    ],
    memory: [],
    memoryRetention: { maxItems: 50, maxDays: 90, keepDelegated: false },
  });
  state.integrations.push({
    id: "int_omie",
    workspaceId,
    name: "Omie (ERP)",
    systemType: "erp",
    state: "conectada",
    configuredBy: CP.financeiroId,
    createdBy: member(CP.financeiroId),
    createdAt: at(120),
    exposedTools: ["omie_lancar_conta_a_pagar"],
  });

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
    scopeId: CP.listId,
    ownerMemberId: CP.financeiroId,
    reactsToAutomationEvents: false,
    versions: [{ number: 1, state: "publicada", trigger, conditions, actions, errorPolicy: { onActionFailure: "interromper", retries: 0 }, publishedBy: CP.financeiroId, publishedAt: at(99), createdAt: at(100) }],
  });
  const entrou = (status: string): AutomationTrigger => ({ kind: "evento", eventType: "tarefaEntrouEmStatus", eventSubtype: status });
  const vencimento = (dias: number): AutomationTrigger => ({ kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: dias }) });
  const cond = (spec: object): AutomationCondition => ({ kind: "valorDeCampo", expression: JSON.stringify(spec) });
  const acao = (order: number, toolId: string, params: object): AutomationAction => ({ order, kind: "escrita", toolId, params: JSON.stringify(params) });
  const cobranca = "{{campo:" + F.pessoa + "}} por favor emitir sua nota para o CNPJ {{cnpjEmpresa}} (vencimento {{vencimento}}). Lembrar de anexar a nota no campo Anexo e atualizar o campo Data de Emissão.";
  state.automations.push(
    // A1 (recorrência ao pagar) não é Automação: é a Regra de Recorrência da própria Tarefa (B6), disparada por `changeTaskStatus`.
    automation("aut_cp_a2", "A2 · Pago: sair do Financeiro", "Ao entrar em “pago”, o Financeiro deixa de ser Responsável; fica quem pagou.", entrou("pago"), [], [acao(1, "tarefa.removerResponsavel", { memberId: CP.financeiroId })]),
    automation("aut_cp_a3", "A3 · Autorização: Responsável vira o Aprovador", "Ao entrar em “em autorização bancária”, o Financeiro sai e o Aprovador entra como Responsável.", entrou("em autorização bancária"), [], [acao(1, "tarefa.definirResponsavel", { memberId: CP.aprovadorId })]),
    automation("aut_cp_a4", "A4 · Negado: volta ao Financeiro", "Ao entrar em “negado”, avisa o Financeiro e devolve a responsabilidade.", entrou("negado"), [], [
      acao(1, "tarefa.definirResponsavel", { memberId: CP.financeiroId }),
      acao(2, "tarefa.comentar", { template: "Pagamento negado pelo Aprovador. Revise a conta e devolva ao fluxo (lançado omie ou para pagar).", mentionMemberId: CP.financeiroId }),
    ]),
    automation("aut_cp_a5", "A5 · D-5: cobrar a nota", "Cinco dias antes do vencimento, em “para pagar”, sem Anexo e com Pessoa: comenta pedindo a nota.", vencimento(-5), [cond({ status: "para pagar" }), cond({ definitionId: F.anexo, empty: true }), cond({ definitionId: F.pessoa, empty: false })], [
      acao(1, "tarefa.comentar", { template: cobranca, mentionFieldDefinitionId: F.pessoa }),
    ]),
    automation("aut_cp_a6", "A6 · D-2: repetir a cobrança", "Dois dias antes do vencimento, ainda sem Anexo: cobra de novo.", vencimento(-2), [cond({ status: "para pagar" }), cond({ definitionId: F.anexo, empty: true }), cond({ definitionId: F.pessoa, empty: false })], [
      acao(1, "tarefa.comentar", { template: "{{campo:" + F.pessoa + "}} anexar sua nota ainda hoje — vence em {{vencimento}}.", mentionFieldDefinitionId: F.pessoa }),
    ]),
    automation("aut_cp_a7", "A7 · D-1: lançar no Omie pelo Agente", "Na véspera, em “para pagar”, sem Integração manual e com Valor: o Agente publica o Resumo e a conta vai para “lançado omie” (A8).", vencimento(-1), [cond({ status: "para pagar" }), cond({ definitionId: F.integracaoManual, empty: true }), cond({ definitionId: F.valor, empty: false })], [
      { order: 1, kind: "controle", controlKind: "invocarAgente", agentId: CP.agentId, params: "{}", maxAutonomy: "supervisionado" },
      acao(2, "tarefa.alterarStatus", { statusName: "lançado omie" }),
    ]),
    automation("aut_cp_a9", "A9 · Nova conta: Observadores", "Toda conta nova ganha como Observadores o Financeiro, o Aprovador e a Pessoa (se preenchida).", { kind: "evento", eventType: "tarefaCriada" }, [], [
      acao(1, "tarefa.adicionarObservadores", { memberIds: [CP.financeiroId, CP.aprovadorId], fromFieldDefinitionId: F.pessoa }),
    ]),
  );

  /* ── Tarefas (seções 6 e 7) ───────────────────────────────────────────── */
  const val = (definitionId: Id, value: FieldValue["value"]): FieldValue => ({ definitionId, value, state: "ativo" });
  const recorrente = (defaultAssignee: Id = CP.financeiroId): RecurrenceRule => ({
    frequency: "mensal",
    interval: 1,
    triggerMode: "aoConcluir",
    businessDays: "anterior",
    defaultAssigneeMemberId: defaultAssignee,
    copies: { checklists: false, subtasks: false, assignees: false, fieldValues: true, fieldValuesExcept: [F.anexo, F.dataEmissao] },
  });
  let seq = 0;
  const conta = (
    id: Id,
    title: string,
    description: string,
    statusId: Id,
    due: string,
    createdDaysAgo: number,
    assignee: Id,
    tag: string,
    fields: FieldValue[],
    extra: Partial<Task> = {},
  ): Task => {
    seq += 1;
    return {
      id,
      workspaceId,
      createdBy: member(CP.financeiroId),
      createdAt: at(createdDaysAgo),
      lifecycle: "ativo",
      listId: CP.listId,
      siblingOrder: seq,
      readableId: `CP-${100 + seq}`,
      title,
      description,
      statusId,
      taskTypeId: CP.taskTypeId,
      priority: "normal",
      dueDate: { form: "civilDay", value: due },
      assignees: [member(assignee)],
      observerMemberIds: [CP.financeiroId, CP.aprovadorId],
      tagIds: [tagIds[tag] ?? "tag_cp_1"],
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
  const comment = (id: Id, author: ActorRef, content: string, when: string, mentions: Array<{ type: string; id: Id }> = [], resolved?: { by: Id; at: string }, delegate?: ActorRef): Comment => ({
    id,
    author,
    ...(delegate ? { authorDelegate: delegate } : {}),
    content,
    attachments: [],
    mentions,
    createdAt: when,
    ...(resolved ? { resolved } : {}),
  });
  const base = (centro: string, bu: string, empresa: string, categoria: string): FieldValue[] => [val(F.centroDeCusto, centro), val(F.bu, bu), val(F.empresa, empresa), val(F.categoria, categoria)];
  const pix = (chave: string): FieldValue[] => [val(F.forma, "Chave Pix"), val(F.chavePix, chave)];
  const cnpj = (n: string): FieldValue[] => [val(F.fornecedor, "CNPJ"), val(F.cnpj, n)];
  const cpf = (n: string): FieldValue[] => [val(F.fornecedor, "CPF"), val(F.cpf, n)];

  // Datas do processo relativas a HOJE no fuso local — as Automações por
  // vencimento comparam com o dia civil local, e o `day()` do seed é UTC.
  const d = (n: number) => {
    const hoje = new Date();
    const x = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  void day;

  const thiagoAgo = conta("tsk_cp_thiago_ago", "Pedro Alencar Consultoria em Dados", "Prestação de serviços", S.pago, d(-39), 69, CP.aprovadorId, "conta tria", [
    ...base("Tria Tech", "Tria Tech", "Tria Company", "Prestação de Serviços"),
    val(F.pessoa, "mem_thiago_pereira"),
    ...cnpj("41.208.771/0001-35"),
    ...pix("41.208.771/0001-35"),
    val(F.valor, 12000),
    val(F.anexo, "NFS-e_0021.pdf"),
    val(F.dataEmissao, d(-41)),
  ], {
    observerMemberIds: [CP.financeiroId, CP.aprovadorId, "mem_thiago_pereira"],
    // Já gerou a ocorrência seguinte: a Regra foi transferida (12.5), não fica aqui.
    completedAt: at(38, 11),
    comments: [
      comment("cmt_cp_1", member(CP.financeiroId), "@Pedro Alencar por favor emitir sua nota para o CNPJ 11.222.333/0001-81. Lembrar de anexar a nota no campo anexo e atualizar o campo data de emissão.", at(44, 10), [{ type: "member", id: "mem_thiago_pereira" }]),
      comment("cmt_cp_2", member(CP.financeiroId), "@Pedro Alencar anexar sua nota ainda hoje.", at(41, 9), [{ type: "member", id: "mem_thiago_pereira" }]),
      comment("cmt_cp_3", member("mem_thiago_pereira"), "feito", at(41, 15)),
      comment("cmt_cp_4", { kind: "agent", id: CP.agentId }, [
        "📋 RESUMO DE PAGAMENTO",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "O que pagar:    Pedro Alencar Consultoria em Dados",
        "Centro de custo: Tria Tech",
        "Conta pagamento: TRIA",
        "Categoria:      Prestação serviços - ADM",
        "Código:         2.04.08",
        "",
        `📅 Vencimento:        ${d(-39).split("-").reverse().join("/")}`,
        `📅 Previsão pagto:    ${d(-39).split("-").reverse().join("/")}`,
        "💰 Valor:             R$ 12.000,00",
        "",
        "💳 Forma de pagamento:",
        "  • Tipo: Chave Pix: 41.208.771/0001-35",
        "",
        "📝 Observações: Conta de Pagamento mantida como \"TRIA\" conforme similaridade textual e mapeamento por Centro de Custo \"Tria Tech\". Código da categoria atualizado conforme código sugerido.",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "O que é e como será utilizado. Caso hajam parcelas, especifique aqui:",
        "Prestação de serviços",
      ].join("\n"), at(40, 22), [], { by: CP.agentId, at: at(40, 22) }, member(CP.financeiroId)),
    ],
  });
  // A ocorrência seguinte, nascida do fechamento: vence no mês seguinte, sem nota ainda.
  const thiagoSet = conta("tsk_cp_thiago_set", "Pedro Alencar Consultoria em Dados", "Prestação de serviços", S.pago, d(-9), 38, CP.aprovadorId, "conta tria", [
    ...base("Tria Tech", "Tria Tech", "Tria Company", "Prestação de Serviços"),
    val(F.pessoa, "mem_thiago_pereira"),
    ...cnpj("41.208.771/0001-35"),
    ...pix("41.208.771/0001-35"),
    val(F.valor, 12000),
    val(F.anexo, "NFS-e_0022.pdf"),
    val(F.dataEmissao, d(-12)),
  ], { observerMemberIds: [CP.financeiroId, CP.aprovadorId, "mem_thiago_pereira"], completedAt: at(5, 11), provenance: { kind: "recurrence", sourceId: "tsk_cp_thiago_ago", sourceName: "Pedro Alencar Consultoria em Dados", at: at(38, 11) } });
  const thiagoOut = conta("tsk_cp_thiago_out", "Pedro Alencar Consultoria em Dados", "Prestação de serviços", S.paraPagar, d(21), 5, CP.financeiroId, "conta tria", [
    ...base("Tria Tech", "Tria Tech", "Tria Company", "Prestação de Serviços"),
    val(F.pessoa, "mem_thiago_pereira"),
    ...cnpj("41.208.771/0001-35"),
    ...pix("41.208.771/0001-35"),
    val(F.valor, 12000),
  ], { observerMemberIds: [CP.financeiroId, CP.aprovadorId, "mem_thiago_pereira"], recurrence: recorrente(), provenance: { kind: "recurrence", sourceId: "tsk_cp_thiago_set", sourceName: "Pedro Alencar Consultoria em Dados", at: at(5, 11) } });

  const aluguelSet = conta("tsk_cp_aluguel_set", "Aluguel — sala 402", "Aluguel mensal da sala", S.pago, d(-9), 40, CP.aprovadorId, "conta tria", [
    ...base("TRIA", "TRIA - Apoio Funcional", "Tria Company", "Aluguel"),
    ...cnpj("23.456.789/0001-10"),
    val(F.nomeFornecedor, "Imobiliária Horizonte Azul"),
    val(F.forma, "Boleto"),
    val(F.codigoBarras, "23793.38128 60000.000003 00000.000400 1 99990000450000"),
    val(F.boleto, "boleto-aluguel-set.pdf"),
    val(F.valor, 4500),
  ], { completedAt: at(5, 11) });
  const aluguelOut = conta("tsk_cp_aluguel_out", "Aluguel — sala 402", "Aluguel mensal da sala", S.lancado, d(20), 5, CP.financeiroId, "conta tria", [
    ...base("TRIA", "TRIA - Apoio Funcional", "Tria Company", "Aluguel"),
    ...cnpj("23.456.789/0001-10"),
    val(F.nomeFornecedor, "Imobiliária Horizonte Azul"),
    val(F.forma, "Boleto"),
    val(F.codigoBarras, "23793.38128 60000.000003 00000.000400 1 99990000450000"),
    val(F.boleto, "boleto-aluguel-out.pdf"),
    val(F.valor, 4500),
    val(F.integracaoManual, "Manual"),
  ], { recurrence: recorrente(), provenance: { kind: "recurrence", sourceId: "tsk_cp_aluguel_set", sourceName: "Aluguel — sala 402", at: at(5, 11) } });

  const konq = conta("tsk_cp_konq", "Plataforma white label — Nimbus", "Implantação da plataforma white label", S.emAutorizacao, d(2), 12, CP.aprovadorKonqId, "conta konq", [
    ...base("Konq", "KONQ", "Konq Intermediações", "Prestação de Serviços"),
    ...cnpj("44.555.666/0001-72"),
    val(F.nomeFornecedor, "Nimbus Sistemas Ltda."),
    ...pix("44.555.666/0001-72"),
    val(F.valor, 20000),
    val(F.solicitante, "Walter Galvão Neto"),
  ], {
    comments: [
      comment("cmt_cp_5", member(CP.financeiroId), "@Lucas Ferraz por favor emitir sua nota para o CNPJ 44.555.666/0001-72.", at(6, 10), [{ type: "member", id: "mem_joao_konq" }]),
      comment("cmt_cp_6", member(CP.aprovadorKonqId), "Aprovado!", at(1, 16)),
    ],
  });
  const recarga = conta("tsk_cp_recarga", "Recarga do cartão corporativo", "Recarga de crédito do cartão corporativo", S.pago, d(-3), 4, CP.aprovadorId, "conta tria", [
    ...base("TRIA", "TRIA - Apoio Funcional", "Tria Company", "Administrativo"),
    ...cnpj("40.101.001/0001-77"),
    val(F.forma, "QRCode Pix"),
    val(F.pixCopiaECola, "00020126580014BR.GOV.BCB.PIX0136cartao-recarga-0001"),
    val(F.qrCode, "qrcode-recarga.png"),
    val(F.valor, 3000),
  ], { completedAt: at(2, 9) });
  const negada = conta("tsk_cp_negada", "Consultoria Jurídica Mensal", "Honorários — setembro", S.lancado, d(-19), 45, CP.financeiroId, "conta tria", [
    ...base("Presidência", "Marcos Paulo", "Tria Company", "Prestação de Serviços"),
    ...cnpj("31.222.333/0001-55"),
    val(F.nomeFornecedor, "Prado & Antunes Advocacia"),
    ...pix("31.222.333/0001-55"),
    val(F.valor, 8500),
  ], {
    comments: [comment("cmt_cp_7", member(CP.aprovadorId), "Valor diverge do contrato (R$ 7.500). Negado até ajuste da nota.", at(19, 15), [{ type: "member", id: CP.financeiroId }])],
  });
  const condominio = conta("tsk_cp_condominio", "Condomínio — sala 402", "Condomínio mensal", S.emLancamento, d(20), 6, CP.financeiroId, "conta tria", [
    ...base("TRIA", "TRIA - Apoio Funcional", "Tria Company", "Contas de consumo"),
    ...cnpj("22.333.444/0001-11"),
    val(F.forma, "Boleto"),
    val(F.codigoBarras, "23793.38128 60000.000003 00000.000500 2 99990000120000"),
    val(F.boleto, "boleto-condominio-out.pdf"),
    val(F.valor, 1200),
    val(F.integracaoManual, "Manual"),
  ], { recurrence: recorrente() });
  const energia = conta("tsk_cp_energia", "Energia elétrica — sala 402", "Conta de energia da sala", S.emLancamento, d(20), 6, CP.financeiroId, "conta tria", [
    ...base("TRIA", "TRIA - Apoio Funcional", "Tria Company", "Contas de consumo"),
    ...cnpj("70.111.222/0001-53"),
    val(F.forma, "Boleto"),
    val(F.codigoBarras, "83690000000-1 23450000000-2 00000000000-3 00000000000-4"),
    val(F.boleto, "energia-out.pdf"),
    val(F.valor, 640.35),
    val(F.integracaoManual, "Manual"),
  ], { recurrence: recorrente() });
  const impostos = conta("tsk_cp_das", "DAS — Simples Nacional", "Imposto mensal", S.paraPagar, d(12), 18, CP.financeiroId, "conta tria", [
    ...base("TRIA", "TRIA - Apoio Funcional", "Tria Company", "Impostos"),
    ...cnpj("11.222.333/0001-81"),
    val(F.forma, "Boleto"),
    val(F.codigoBarras, "85810000005-6 86267500000-1 26092600000-2 00000000000-3"),
    val(F.boleto, "das-set.pdf"),
    val(F.valor, 66267.5),
  ], { recurrence: recorrente() });
  const comissao = conta("tsk_cp_comissao", "Comissão — vendas do mês", "Comissão sobre vendas do mês anterior", S.paraPagar, d(12), 10, CP.financeiroId, "conta kops", [
    ...base("Kops", "Iallas Oliveira", "Tria Company", "Comissão"),
    val(F.pessoa, "mem_walter"),
    ...cpf("321.654.987-00"),
    ...pix("+55 11 98888-0000"),
    val(F.valor, 5400),
  ], { observerMemberIds: [CP.financeiroId, CP.aprovadorId, "mem_walter"] });
  // Sem forma de pagamento: não sai de "para pagar" — a tela e o Agente dizem o que falta.
  const incompleta = conta("tsk_cp_ferramenta", "Ferramenta de automação — assinatura", "Assinatura anual", S.paraPagar, d(1), 3, CP.financeiroId, "conta tf tria", [
    ...base("Tria Tech", "Tria Tech", "Tria Company", "Ferramentas"),
    ...cnpj("55.444.333/0001-22"),
    val(F.nomeFornecedor, "FluxoBot Automação"),
    val(F.valor, 2200),
  ]);
  const caucao = conta("tsk_cp_caucao", "Caução — sala nova", "Depósito de caução do novo contrato", S.paraPagar, d(6), 2, CP.financeiroId, "conta arkline", [
    ...base("Presidência", "Marcos Paulo", "Oliveira Participações", "Administrativo"),
    ...cnpj("23.456.789/0001-10"),
    val(F.nomeFornecedor, "Imobiliária Horizonte Azul"),
    ...pix("23.456.789/0001-10"),
    val(F.valor, 9000),
    val(F.solicitante, "Marcos Paulo"),
  ]);

  // Completa e na véspera: é a que o Agente lança ao rodar as Automações por vencimento.
  const trafego = conta("tsk_cp_trafego", "Tráfego pago — mídia social", "Campanhas do mês", S.paraPagar, d(1), 20, CP.financeiroId, "conta tria", [
    ...base("Tria Tech", "Tria Tech", "Tria Company", "Tráfego Pago"),
    ...cnpj("88.999.000/0001-46"),
    val(F.nomeFornecedor, "Anúncios Digitais S.A."),
    val(F.forma, "Boleto"),
    val(F.codigoBarras, "03399.63290 64000.000006 00125.201020 4 99990000390000"),
    val(F.boleto, "midia-paga.pdf"),
    val(F.valor, 3900),
  ]);

  state.tasks.push(thiagoAgo, thiagoSet, thiagoOut, aluguelSet, aluguelOut, konq, recarga, negada, condominio, energia, impostos, comissao, incompleta, caucao, trafego);

  // A Pessoa da conta vê só as próprias contas (seção 10): concessão por Tarefa.
  for (const [i, t] of [thiagoAgo, thiagoSet, thiagoOut].entries()) {
    state.grants.push(grant(`gr_cp_pessoa_${i + 1}`, "member", "mem_thiago_pereira", "ver", "task", t.id));
  }
  state.grants.push(grant("gr_cp_pessoa_joao", "member", "mem_joao_konq", "ver", "task", konq.id));

  /* ── Histórico de Status do fio condutor (seção 6) ────────────────────── */
  const hist = (taskId: Id, title: string, actor: ActorRef, before: string, after: string, when: string, delegate?: ActorRef) => {
    state.activity.unshift({
      id: `act_cp_${state.activity.length + 1}`,
      workspaceId,
      actor,
      ...(delegate ? { delegate } : {}),
      action: "Status alterado",
      objectType: "task",
      objectId: taskId,
      objectName: title,
      at: when,
      result: "ok",
      before,
      after,
    });
  };
  // Toda conta tem o Registro de criação (o `seedActivity` genérico correu antes destas).
  for (const t of [...state.tasks].filter((x) => x.listId === CP.listId)) {
    state.activity.push({
      id: `act_cp_criada_${t.id}`,
      workspaceId,
      actor: t.createdBy,
      action: "Tarefa criada",
      objectType: "task",
      objectId: t.id,
      objectName: t.title,
      at: t.createdAt,
      result: "ok",
    });
  }
  const T = thiagoAgo.title;
  hist(thiagoAgo.id, T, { kind: "agent", id: CP.agentId }, "para pagar", "lançado omie", at(40, 22), member(CP.financeiroId));
  hist(thiagoAgo.id, T, member(CP.financeiroId), "lançado omie", "em remessa bancária", at(39, 5));
  hist(thiagoAgo.id, T, member(CP.financeiroId), "em remessa bancária", "em autorização bancária", at(39, 6));
  hist(thiagoAgo.id, T, member(CP.aprovadorId), "em autorização bancária", "pago", at(38, 11));
  hist(negada.id, negada.title, member(CP.financeiroId), "em remessa bancária", "em autorização bancária", at(19, 14));
  hist(negada.id, negada.title, member(CP.aprovadorId), "em autorização bancária", "negado", at(19, 15));
  hist(negada.id, negada.title, member(CP.financeiroId), "negado", "lançado omie", at(19, 16));
  hist(thiagoSet.id, thiagoSet.title, member(CP.aprovadorId), "em autorização bancária", "pago", at(5, 11));
  hist(aluguelSet.id, aluguelSet.title, member(CP.aprovadorId), "em autorização bancária", "pago", at(5, 11));
  hist(recarga.id, recarga.title, member(CP.financeiroId), "para pagar", "em autorização bancária", at(3, 17));
  hist(recarga.id, recarga.title, member(CP.aprovadorId), "em autorização bancária", "pago", at(2, 9));

  // As Visualizações que o Financeiro usa: por conta bancária e o que falta pagar.
  state.views.push(
    { id: "viw_cp_abertas", name: "Ainda a pagar", kind: "lista", ownerKind: "container", ownerId: CP.listId, listId: CP.listId, filters: { statusId: S.paraPagar }, sortBy: { by: "dueDate", direction: "asc" }, isDefault: false, createdBy: CP.financeiroId, createdAt: at(90) },
    { id: "viw_cp_autorizacao", name: "Aguardando autorização", kind: "lista", ownerKind: "container", ownerId: CP.listId, listId: CP.listId, filters: { statusId: S.emAutorizacao }, sortBy: { by: "dueDate", direction: "asc" }, isDefault: false, createdBy: CP.financeiroId, createdAt: at(90) },
    { id: "viw_cp_tria", name: "Conta Tria", kind: "lista", ownerKind: "container", ownerId: CP.listId, listId: CP.listId, filters: { tagId: tagIds["conta tria"] ?? "" }, isDefault: false, createdBy: CP.financeiroId, createdAt: at(90) },
  );

  // Meta do Financeiro: contas em dia.
  state.goals.push({
    id: "gol_cp_em_dia",
    workspaceId,
    createdBy: member(CP.financeiroId),
    createdAt: at(30),
    lifecycle: "ativo",
    name: "Zero contas vencidas em aberto",
    ownerMemberId: CP.financeiroId,
    anchor: { type: "list", id: CP.listId },
    kind: "tarefasConcluidas",
    target: 3,
    taskIds: [thiagoSet.id, aluguelSet.id, recarga.id],
  });
}
