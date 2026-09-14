/**
 * Fictional data for the workspace "Instituto Transformando Faces" (PRD, I.3 and II.7).
 *
 * Deterministic: ids and instants come from counters and from a fixed base
 * date, so two loads produce the same graph. Nothing here invents a concept —
 * every field maps to section 6 of an ontology document.
 */

import { nextId, resetIdSequence } from "./operations/activity";
import type { DataState } from "./state";
import type {
  ActivityRecord,
  ActorRef,
  Agent,
  ChannelType,
  ContactIdentifierType,
  AgentExecution,
  ApprovalRequest,
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationVersion,
  CatalogItem,
  Channel,
  ChatFolder,
  ChatSession,
  Collection,
  Company,
  Contact,
  ContactCompanyLink,
  Conversation,
  Deal,
  FieldDefinition,
  FieldValue,
  Folder,
  Funnel,
  Id,
  KnowledgeDocument,
  List,
  Member,
  Message,
  Panel,
  Queue,
  Role,
  Skill,
  SkillGrant,
  Space,
  StageTransition,
  StatusSet,
  Tag,
  Task,
  TaskType,
  Team,
  Template,
  Workspace,
} from "./types";

/** Fixed base so "há 3 dias" is stable between reloads. */
/**
 * Base de tempo do seed: HOJE às 09:00 UTC.
 *
 * Fixa dentro do dia, para "há 3 dias" não mudar entre recargas e para o HTML
 * do servidor bater com o do navegador. Mas ancorada no dia corrente e não numa
 * data escrita à mão: com data fixa, o protótipo apodrece — passado o prazo, a
 * janela de resposta de TODA Conversa vence e ninguém mais consegue responder
 * nada, sem que nada tenha mudado no código.
 */
import { applyContasAPagar } from "./seed-financeiro";
import { applyEspelhoComercial } from "./seed-comercial";
import { applyContasAReceber } from "./seed-contas-a-receber";

const BASE = Date.UTC(
  new Date().getUTCFullYear(),
  new Date().getUTCMonth(),
  new Date().getUTCDate(),
  9,
);
const at = (daysAgo: number, hour = 9): string =>
  new Date(BASE - daysAgo * 86_400_000 + (hour - 9) * 3_600_000).toISOString();
const day = (daysFromNow: number): string =>
  new Date(BASE + daysFromNow * 86_400_000).toISOString().slice(0, 10);

const CITIES = ["São Paulo", "Campinas", "Santo André", "Guarulhos", "Osasco", "Sorocaba"];
const REGIONS = ["SP", "SP", "SP", "SP", "SP", "SP"];

const WORKSPACE_ID = "ws_n1";
const member = (id: Id): ActorRef => ({ kind: "member", id });
const agentRef = (id: Id): ActorRef => ({ kind: "agent", id });
const SYSTEM: ActorRef = { kind: "system", id: "sistema" };

/** As clínicas e consultórios de quem compra o Full Face. */
const COMPANY_NAMES: ReadonlyArray<readonly [string, string, string]> = [
  ["Clínica Sorriso Vivo", "Sorriso Vivo Odontologia Ltda.", "sorrisovivo.com.br"],
  ["Instituto Harmonia", "Harmonia Estética Avançada Ltda.", "institutoharmonia.com.br"],
  ["Odonto Excellence", "Excellence Odontologia S/S", "odontoexcellence.com.br"],
  ["Clínica Renovar", "Renovar Saúde e Estética Ltda.", "clinicarenovar.com.br"],
  ["Espaço Bella Face", "Bella Face Serviços Estéticos Ltda.", "bellaface.com.br"],
  ["Centro Odonto Ipê", "Ipê Odontologia Integrada Ltda.", "odontoipe.com.br"],
  ["Clínica Vittá", "Vittá Medicina e Odontologia Ltda.", "clinicavitta.com.br"],
  ["Studio Face", "Studio Face Harmonização Ltda.", "studioface.com.br"],
  ["Clínica Nova Era", "Nova Era Odontologia Ltda.", "clinicanovaera.com.br"],
  ["Consultório Dra. Lopes", "Lopes Odontologia ME", "dralopes.com.br"],
  ["Clínica Vida", "Vida Serviços Médicos Ltda.", "clinicavida.com.br"],
  ["Espaço Regenera", "Regenera Estética Avançada Ltda.", "regenera.com.br"],
];

export function buildSeed(): DataState {
  resetIdSequence();

  // ── Papéis de sistema (A9.4) ───────────────────────────────────────────────
  const roles: Role[] = [
    { id: "role_prop", workspaceId: WORKSPACE_ID, name: "Proprietário do Espaço de Trabalho", system: true, base: "proprietario", permissions: [] },
    { id: "role_adm", workspaceId: WORKSPACE_ID, name: "Administrador", system: true, base: "administrador", permissions: [] },
    { id: "role_mem", workspaceId: WORKSPACE_ID, name: "Membro", system: true, base: "membro", permissions: [] },
    { id: "role_conv", workspaceId: WORKSPACE_ID, name: "Convidado", system: true, base: "convidado", permissions: [] },
    // B30 — Papéis personalizados: a base é teto, nunca acréscimo. O de Vendas
    // não administra nada porque a base Membro não administra.
    {
      id: "role_vendas",
      workspaceId: WORKSPACE_ID,
      name: "Vendas",
      system: false,
      base: "membro",
      permissions: [
        { action: "ver", resourceType: "funnel", scope: "subarvore" },
        { action: "criar", resourceType: "deal", scope: "subarvore" },
        { action: "editar", resourceType: "deal", scope: "proprios" },
        { action: "ver", resourceType: "conversation", scope: "subarvore" },
        { action: "comentar", resourceType: "task", scope: "subarvore" },
      ],
    },
    {
      id: "role_agente_crm",
      workspaceId: WORKSPACE_ID,
      name: "Agente de atendimento",
      system: false,
      base: "convidado",
      permissions: [
        { action: "ver", resourceType: "conversation", scope: "subarvore" },
        { action: "criar", resourceType: "message", scope: "subarvore" },
        { action: "executar", resourceType: "skill", scope: "registro" },
      ],
    },
  ];

  // ── Membros (PRD, I.3) ─────────────────────────────────────────────────────
  const mk = (
    id: Id,
    displayName: string,
    roleId: Id,
    state: Member["state"],
    availability: Member["availability"]["value"],
  ): Member => ({
    id,
    workspaceId: WORKSPACE_ID,
    userId: `usr_${id}`,
    displayName,
    state,
    roleId,
    joinedAt: at(400),
    availability: { value: availability, at: at(1), origin: "membro" },
    userMemory: { enabled: true, items: [] },
  });

  const members: Member[] = [
    { ...mk("mem_thiago", "Thiago Nascimento", "role_prop", "ativo", "disponivel"), photoFileId: "thiago" },
    mk("mem_rafael", "Rafael Nunes", "role_adm", "ativo", "disponivel"),
    mk("mem_julia", "Júlia Prado", "role_vendas", "ativo", "disponivel"),
    mk("mem_marcos", "Marcos Lima", "role_vendas", "ativo", "ausente"),
    mk("mem_beatriz", "Beatriz Sales", "role_conv", "ativo", "indisponivel"),
    { ...mk("mem_tiago", "Tiago Reis", "role_mem", "removido", "indisponivel"), removedAt: at(60), successorId: "mem_rafael" },
  ];
  members[0]?.userMemory.items.push({
    id: nextId("umi"),
    content: "Prefere respostas curtas e em português formal.",
    origin: { kind: "sessao", sessionId: "cht_1" },
    createdAt: at(20),
    state: "ativo",
  });

  const teams: Team[] = [
    { id: "team_com", workspaceId: WORKSPACE_ID, name: "Comercial", description: "Time de vendas B2B", memberIds: ["mem_rafael", "mem_julia"], createdBy: member("mem_thiago"), createdAt: at(380) },
    { id: "team_ops", workspaceId: WORKSPACE_ID, name: "Entrega", memberIds: ["mem_marcos"], createdBy: member("mem_thiago"), createdAt: at(380) },
    // As duas Equipes do processo comercial: elas dão as Elegíveis da Fila e as
    // permissões, e é por elas que o Painel separa SDR de Closer.
    { id: "team_sdr", workspaceId: WORKSPACE_ID, name: "SDR", description: "Prospecção e qualificação", memberIds: ["mem_julia", "mem_marcos"], createdBy: member("mem_thiago"), createdAt: at(200) },
    { id: "team_closers", workspaceId: WORKSPACE_ID, name: "Closers", description: "Condução da call ao fechamento", memberIds: ["mem_rafael"], createdBy: member("mem_thiago"), createdAt: at(200) },
  ];

  // ── Catálogos do Espaço de Trabalho (B34) ─────────────────────────────────
  const catalog: CatalogItem[] = [
    cat("cat_org_site", "origem", "Site", 0),
    cat("cat_org_indic", "origem", "Indicação", 1),
    cat("cat_org_camp", "origem", "Campanha", 2),
    cat("cat_org_wpp", "origem", "WhatsApp", 3),
    cat("cat_org_insta", "origem", "Instagram", 4),
    cat("cat_qual_lead", "qualificacao", "Lead", 0, "#94a3b8"),
    cat("cat_qual_prosp", "qualificacao", "Prospecto", 1, "#60a5fa"),
    // A Qualificação do Contato acompanha o Funil: Lead entra, Qualificado é
    // entregue ao Closer, Cliente é o `ganho` (DO-CON-05).
    cat("cat_qual_qualificado", "qualificacao", "Qualificado", 2, "#a78bfa"),
    cat("cat_qual_cli", "qualificacao", "Cliente", 3, "#34d399"),
    cat("cat_qual_ex", "qualificacao", "Ex-cliente", 4, "#f87171"),
    // Temperatura: quão perto do fechamento a pessoa está. É leitura do
    // vendedor, não do sistema — por isso é Catálogo e não cálculo.
    cat("cat_temp_frio", "temperatura", "Frio", 0, "#60a5fa"),
    cat("cat_temp_morno", "temperatura", "Morno", 1, "#fbbf24"),
    cat("cat_temp_quente", "temperatura", "Quente", 2, "#34d399"),
    { ...cat("cat_fin_atend", "finalidadeConsentimento", "Atendimento", 0), requiresConsentToSend: false, seeded: true },
    { ...cat("cat_fin_trans", "finalidadeConsentimento", "Transacional", 1), requiresConsentToSend: false, seeded: true },
    { ...cat("cat_fin_mkt", "finalidadeConsentimento", "Marketing", 2), requiresConsentToSend: true, seeded: true },
    { ...cat("cat_perda_dup", "motivoPerda", "Duplicado", 0), seeded: true },
    cat("cat_perda_preco", "motivoPerda", "Preço", 1),
    cat("cat_perda_prazo", "motivoPerda", "Prazo", 2),
    cat("cat_perda_semret", "motivoPerda", "Sem retorno", 3),
    // Motivos de Perda do processo SDR/Closer. "Desqualificado" é Motivo, não
    // Etapa: a taxa de desqualificação sai do Painel por Motivo, e o Negócio
    // pode ser reaberto se o lead voltar.
    cat("cat_perda_desqual", "motivoPerda", "Desqualificado", 4),
    cat("cat_perda_semresp", "motivoPerda", "Sem resposta", 5),
    cat("cat_perda_semconex", "motivoPerda", "Sem conexão", 6),
    cat("cat_perda_semagend", "motivoPerda", "Sem agendamento", 7),
    cat("cat_perda_naocomp", "motivoPerda", "Não compareceu", 8),
    cat("cat_perda_semorc", "motivoPerda", "Sem orçamento", 9),
    cat("cat_perda_naodecisor", "motivoPerda", "Não é decisor", 10),
    cat("cat_perda_concor", "motivoPerda", "Concorrente", 11),
    cat("cat_perda_parcela", "motivoPerda", "Parcelamento", 12),
    cat("cat_perda_momento", "motivoPerda", "Vai fazer depois", 13),
    // Do Funil de Validação: reprovado na call ou na análise.
    cat("cat_perda_naoaprov", "motivoPerda", "Não aprovado", 14),
    cat("cat_ganho_preco", "motivoGanho", "Preço", 0),
    cat("cat_ganho_escopo", "motivoGanho", "Escopo", 1),
  ];

  const tags: Tag[] = [
    tag("tag_urgente", "Urgente", "#ef4444"),
    tag("tag_convenio", "Recorrente", "#8b5cf6"),
    tag("tag_renovacao", "Renovação", "#0ea5e9"),
    tag("tag_nr7", "Integração", "#f59e0b"),
  ];

  // ── Conjuntos de Status: 3, com sobrescrita em Espaço e em Subpasta ──────
  const statusComercial: StatusSet = {
    id: "sts_com",
    definitions: [
      { id: "st_com_novo", name: "Novo", color: "#94a3b8", category: "naoIniciado", order: 0 },
      { id: "st_com_exec", name: "Em execução", color: "#3b82f6", category: "emAndamento", order: 1 },
      { id: "st_com_rev", name: "Em revisão", color: "#a855f7", category: "emAndamento", order: 2 },
      { id: "st_com_entregue", name: "Entregue", color: "#10b981", category: "concluido", order: 3 },
      { id: "st_com_cancel", name: "Cancelado", color: "#6b7280", category: "fechado", order: 4 },
    ],
  };
  const statusOps: StatusSet = {
    id: "sts_ops",
    definitions: [
      { id: "st_ops_fazer", name: "A fazer", color: "#94a3b8", category: "naoIniciado", order: 0 },
      { id: "st_ops_and", name: "Em andamento", color: "#3b82f6", category: "emAndamento", order: 1 },
      { id: "st_ops_conc", name: "Concluído", color: "#10b981", category: "concluido", order: 2 },
      { id: "st_ops_arq", name: "Arquivado", color: "#6b7280", category: "fechado", order: 3 },
    ],
  };
  const statusMkt: StatusSet = {
    id: "sts_mkt",
    definitions: [
      { id: "st_mkt_ideia", name: "Ideia", color: "#94a3b8", category: "naoIniciado", order: 0 },
      { id: "st_mkt_prod", name: "Produção", color: "#3b82f6", category: "emAndamento", order: 1 },
      { id: "st_mkt_pub", name: "Publicado", color: "#10b981", category: "concluido", order: 2 },
      { id: "st_mkt_arq", name: "Arquivado", color: "#6b7280", category: "fechado", order: 3 },
    ],
  };

  // ── Estrutura: 3 Espaços, 4 Pastas + 2 Subpastas, 7 Listas ────────────────
  const spaces: Space[] = [
    space("spc_com", "Comercial", "Vendas de programas corporativos", "#2563eb", 0, statusComercial, false),
    space("spc_ops", "Entrega", "Turmas, mentorias e suporte aos alunos", "#0891b2", 1, statusOps, false),
    space("spc_mkt", "Marketing", "Conteúdo e campanhas", "#c026d3", 2, statusMkt, true),
  ];
  // Um aspecto bloqueado, para que "bloqueado" seja visível na interface (B25).
  const marketing = spaces[2];
  if (marketing) marketing.blocks = { fieldDefinitions: true };

  const folders: Folder[] = [
    folder("fld_clientes", "Clientes", "space", "spc_com", 0),
    folder("fld_propostas", "Propostas", "space", "spc_com", 1),
    folder("fld_protocolos", "Playbooks", "space", "spc_ops", 0),
    folder("fld_campanhas", "Campanhas", "space", "spc_mkt", 0),
    // 2 Subpastas (Pasta com pai Pasta — B3)
    folder("fld_ativacao", "Ativação", "folder", "fld_clientes", 0),
    folder("fld_renovacao", "Renovação", "folder", "fld_clientes", 1),
  ];
  // Uma Subpasta que sobrescreve o Conjunto de Status, para exercitar a herança.
  const ativacao = folders[4];
  if (ativacao) {
    ativacao.modes = { statusSet: "sobrescrito" };
    ativacao.statusSet = {
      id: "sts_ativacao",
      definitions: [
        { id: "st_atv_novo", name: "Novo", color: "#94a3b8", category: "naoIniciado", order: 0 },
        { id: "st_atv_kick", name: "Kickoff", color: "#3b82f6", category: "emAndamento", order: 1 },
        { id: "st_atv_exec", name: "Execução", color: "#8b5cf6", category: "emAndamento", order: 2 },
        { id: "st_atv_ok", name: "Entregue", color: "#10b981", category: "concluido", order: 3 },
        { id: "st_atv_cancel", name: "Cancelado", color: "#6b7280", category: "fechado", order: 4 },
      ],
    };
  }

  const lists: List[] = [
    list("lst_ativacao", "Ativação", "folder", "fld_ativacao", 0),
    list("lst_renovacao", "Renovação 2026", "folder", "fld_renovacao", 0),
    list("lst_propostas", "Propostas em curso", "folder", "fld_propostas", 0),
    // 2 Listas diretas em Espaço (A3.1)
    list("lst_prospeccao", "Prospecção", "space", "spc_com", 1),
    list("lst_indicadores", "Indicadores comerciais", "space", "spc_com", 2),
    list("lst_revisoes", "Revisões", "folder", "fld_protocolos", 0),
    // Lista compartilhada com a Convidada
    list("lst_conteudo", "Calendário de conteúdo", "folder", "fld_campanhas", 0),
    // Uma Lista na lixeira, com Tarefas que foram junto (B43): é o único caso
    // que prova a diferença entre "foi na cascata" e "já estava lá antes".
    {
      ...list("lst_piloto", "Piloto de onboarding", "folder", "fld_ativacao", 1),
      lifecycle: "naLixeira",
      lifecycleBeforeTrash: "ativo",
      trashedAt: at(6),
    },
  ];
  const listaAtivacao = lists[0];
  if (listaAtivacao) listaAtivacao.plannedPeriod = { start: day(-10), end: day(35) };
  const listaRevisoes = lists[5];
  if (listaRevisoes) listaRevisoes.features = { exigirChecklistsConcluidos: true };

  const taskTypes: TaskType[] = [
    { id: "tt_tarefa_com", name: "Tarefa", icon: "circle-check", isPlatformDefault: true, definedAtType: "space", definedAtId: "spc_com" },
    { id: "tt_marco_com", name: "Marco", icon: "flag", isPlatformDefault: false, definedAtType: "space", definedAtId: "spc_com" },
    { id: "tt_reuniao_com", name: "Reunião", icon: "users", isPlatformDefault: false, definedAtType: "space", definedAtId: "spc_com" },
    { id: "tt_reuniao_ops", name: "Reunião", icon: "users", isPlatformDefault: false, definedAtType: "space", definedAtId: "spc_ops" },
    { id: "tt_tarefa_ops", name: "Tarefa", icon: "circle-check", isPlatformDefault: true, definedAtType: "space", definedAtId: "spc_ops" },
    { id: "tt_incidente_ops", name: "Incidente", icon: "triangle-alert", isPlatformDefault: false, definedAtType: "space", definedAtId: "spc_ops" },
    { id: "tt_tarefa_mkt", name: "Tarefa", icon: "circle-check", isPlatformDefault: true, definedAtType: "space", definedAtId: "spc_mkt" },
  ];

  // ── Definições de Campo: 5 de Tarefa em níveis distintos + 3 do CRM ───────
  const fieldDefinitions: FieldDefinition[] = [
    fd("fd_cliente", "Cliente", "text", "task", "space", "spc_com", false),
    fd("fd_centro", "Centro de custo", "singleSelect", "task", "space", "spc_com", false, ["Comercial", "Operações", "Marketing"]),
    fd("fd_horas", "Horas previstas", "number", "task", "folder", "fld_ativacao", false),
    fd("fd_turma", "Turma", "text", "task", "list", "lst_revisoes", true),
    fd("fd_risco", "Risco da entrega", "singleSelect", "task", "space", "spc_ops", false, ["Baixo", "Médio", "Alto"]),
    fd("fd_segmento", "Especialidade", "singleSelect", "company", undefined, undefined, false, ["Odontologia", "Medicina", "Biomedicina", "Multidisciplinar"]),
    fd("fd_porte", "Porte da clínica", "singleSelect", "company", undefined, undefined, false, ["Consultório", "Clínica", "Rede"]),
    fd("fd_setor", "Setor", "text", "company", undefined, undefined, false),

    // ── Campos do processo SDR/Closer (seção 7 do processo comercial) ──
    // Preenchidos pelo Agente enriquecedor.
    fd("fd_resumo_perfil", "Resumo do perfil", "longText", "contact", undefined, undefined, false),
    fd("fd_sinais_fit", "Sinais de fit", "multiSelect", "contact", undefined, undefined, false, [
      "Porte compatível",
      "Setor atendido",
      "Já tem programa",
      "Decisor identificado",
      "Presença digital ativa",
    ]),

    /**
     * Conexão é o momento em que o lead concorda em ser qualificado. Por ser
     * estado de relacionamento, só vira critério quando há FATO gravado: o
     * momento e a Mensagem que o evidencia. Sem os dois, "conectado" seria
     * opinião, e o Requisito de saída da Etapa não teria o que verificar.
     */
    fd("fd_conexao_em", "Conexão confirmada em", "dateTime", "deal", undefined, undefined, false),
    fd("fd_conexao_evidencia", "Evidência da conexão", "relation", "deal", undefined, undefined, false),

    // Roteiro de qualificação: são estes cinco que o Requisito de saída da
    // Etapa Qualificação exige preenchidos.
    /*
     * O roteiro de qualificação. Quatro dos campos são o BANT — Orçamento,
     * Decisor, Dor, Prazo. Os dois Critérios não são: um pergunta se vale a
     * pena continuar, o outro pergunta o que faz a N1 ganhar. São eixos
     * diferentes e por isso não cabem no mesmo campo.
     */
    fd("fd_criterio_fit", "Critério de fit", "longText", "deal", undefined, undefined, false, undefined,
      "Este profissional é do tipo que o Instituto forma? Habilitação, tempo de clínica e volume de pacientes. Confirma ou contradiz os Sinais de fit que o Agente levantou no Contato."),
    fd("fd_criterio", "Critério de decisão", "longText", "deal", undefined, undefined, false, undefined,
      "Por qual régua ele vai comparar o Full Face com a alternativa, inclusive com a alternativa de não fazer curso nenhum."),
    fd("fd_dor", "Dor", "longText", "deal", undefined, undefined, false, undefined,
      "O que dói hoje, com o custo que isso tem. Sem custo, é incômodo e não dor."),
    fd("fd_decisor", "Decisor", "text", "deal", undefined, undefined, false, undefined,
      "Quem assina. Se não for quem está na conversa, quem mais precisa entrar."),
    fd("fd_orcamento", "Orçamento", "currency", "deal", undefined, undefined, false, undefined,
      "Quanto existe reservado, não quanto a proposta vai custar."),
    fd("fd_prazo", "Prazo", "singleSelect", "deal", undefined, undefined, false, [
      "Imediato",
      "Até 30 dias",
      "Até 90 dias",
      "Sem prazo definido",
    ], "Em quanto tempo isso precisa estar rodando, e o que acontece se passar disso."),
    fd("fd_result_qual", "Resultado da qualificação", "singleSelect", "deal", undefined, undefined, false, [
      "Qualificado",
      "Desqualificado",
    ]),
    fd("fd_data_reuniao", "Data da reunião", "dateTime", "deal", undefined, undefined, false),
    /*
     * Campos do Closer. O Closer não repete a qualificação do SDR: ele parte
     * dela. O que ele precisa registrar é o que só aparece na call, e é isso
     * que cada Etapa passa a exigir na saída.
     */
    fd("fd_diagnostico", "Diagnóstico da call", "longText", "deal", undefined, undefined, false, undefined,
      "O que você viu na call que a qualificação não tinha: nível técnico atual, medo declarado, quanto ele já perdeu por não dominar o protocolo."),
    fd("fd_plano", "Plano", "singleSelect", "deal", undefined, undefined, false, ["Classic", "Pro", "Elite"],
      "Qual plano foi recomendado, com base nos casos que ele precisa acompanhar."),
    fd("fd_objecao", "Objeção principal", "singleSelect", "deal", undefined, undefined, false, [
      "Preço",
      "Parcelamento",
      "Momento",
      "Decisor",
      "Insegurança técnica",
      "Sem objeção",
    ], "A objeção que trava o fechamento. Sem ela nomeada, a negociação vira desconto automático."),
    fd("fd_pagamento", "Forma de pagamento", "singleSelect", "deal", undefined, undefined, false, [
      "À vista no Pix",
      "Cartão em 12x",
      "Cartão em 2 cartões",
      "Boleto parcelado",
    ], "Como ele vai pagar. É o que destrava o envio do contrato."),
    // Derivável do Registro "Proprietário alterado"; existe para simplificar Painéis.
    fd("fd_sdr_origem", "SDR de origem", "person", "deal", undefined, undefined, false),

    // ── Funil de Validação ──
    fd("fd_sinal_pago_em", "Sinal pago em", "dateTime", "deal", undefined, undefined, false, undefined,
      "Quando o sinal entrou. É o fato que abre o processo de aplicação: sem data, 'sinal pago' é conversa."),
    fd("fd_validacao", "Validação da call", "longText", "deal", undefined, undefined, false, undefined,
      "O que a call confirmou e o que não bate com o perfil do Full Face Avançado. É o que a análise lê."),
    fd("fd_resultado_validacao", "Resultado da validação", "singleSelect", "deal", undefined, undefined, false, [
      "Aprovado",
      "Não aprovado",
    ], "Apto ou não para o Full Face Avançado. Aprovado abre a venda; Não aprovado encerra com Motivo."),
    fd("fd_tratativa_sinal", "Tratativa do sinal", "singleSelect", "deal", undefined, undefined, false, [
      "Devolvido integralmente",
      "Retido conforme política",
      "Convertido em crédito",
    ], "O que foi feito com o sinal de quem não foi aprovado, conforme a política comercial."),
  ];

  // ── Funis: 4 (B60 — o padrão é criado com o Espaço de Trabalho) ───────────
  const funnels: Funnel[] = [
    /**
     * Funil SDR — prospecção e qualificação.
     *
     * Não há `ganho` aqui: a saída positiva é a MUDANÇA DE FUNIL para o Closer
     * (DO-FUN-11). Por isso `requireValueOnWin` é falso — valor é assunto do
     * Closer, e exigi-lo no SDR bloquearia uma passagem que não é venda.
     *
     * "Desqualificado" não é Etapa, é `perdido` com Motivo: assim a taxa de
     * desqualificação sai do Painel por Motivo e o Negócio pode ser reaberto se
     * o lead voltar.
     */
    {
      id: "fnl_sdr",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(200),
      lifecycle: "ativo",
      name: "SDR",
      description: "Da chegada do lead à reunião agendada com o Closer",
      color: "#9601c5",
      order: 2,
      isPrivate: false,
      stages: [
        // O "Resumo do perfil" NÃO entra como Requisito: ele é campo do
        // Contato, e o Requisito de Etapa só lê Valores de Campo do Negócio.
        { id: "sdr_novo", name: "Novo Lead", order: 0, defaultProbability: 5, requirements: [], allowedTransitionStageIds: [] },
        { id: "sdr_contato", name: "Contato Inicial", order: 1, defaultProbability: 10, requirements: [], allowedTransitionStageIds: [] },
        // A conexão só vira critério com FATO gravado: o momento em que o lead
        // concordou em ser qualificado.
        {
          id: "sdr_conexao",
          name: "Conexão",
          order: 2,
          defaultProbability: 20,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_conexao_em" }],
          allowedTransitionStageIds: [],
        },
        // Os cinco campos do roteiro: sair sem eles é dizer que qualificou sem
        // ter perguntado.
        {
          id: "sdr_qualificacao",
          name: "Qualificação",
          order: 3,
          defaultProbability: 35,
          requirements: [
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_criterio_fit" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_criterio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_dor" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_decisor" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_orcamento" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_prazo" },
          ],
          allowedTransitionStageIds: [],
        },
        {
          id: "sdr_qualificado",
          name: "Qualificado",
          order: 4,
          defaultProbability: 50,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_data_reuniao" }],
          allowedTransitionStageIds: [],
        },
        // Entregar ao Closer um Negócio sem Contato é entregar uma reunião com
        // ninguém.
        {
          id: "sdr_agendamento",
          name: "Agendamento",
          order: 5,
          defaultProbability: 60,
          requirements: [{ moment: "entrada", kind: "contatoObrigatorio" }],
          allowedTransitionStageIds: ["sdr_qualificado"],
        },
      ],
      closingRules: { requireLossReason: true, requireValueOnWin: false },
    },

    /**
     * Funil Closer — da reunião ao contrato.
     *
     * `ganho` aqui é a Venda (A4.4): "Venda" não é Etapa. Fechamento é a Etapa
     * de contrato em assinatura, e ela existe porque o Negócio ainda PODE SER
     * PERDIDO ali — um estado onde se perde é Etapa, não é momento.
     */
    {
      id: "fnl_closer",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(200),
      lifecycle: "ativo",
      name: "Closer",
      description: "Da reunião agendada ao contrato assinado",
      color: "#2C0263",
      order: 3,
      isPrivate: false,
      stages: [
        // Entrar sem Contato é receber uma reunião com ninguém.
        {
          id: "clo_agendamento",
          name: "Agendamento",
          order: 0,
          defaultProbability: 60,
          requirements: [
            { moment: "entrada", kind: "contatoObrigatorio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_data_reuniao" },
          ],
          allowedTransitionStageIds: [],
        },
        // Sair da Call sem diagnóstico é dizer que a reunião não produziu nada.
        {
          id: "clo_call",
          name: "Call",
          order: 1,
          defaultProbability: 70,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_diagnostico" }],
          allowedTransitionStageIds: [],
        },
        // Proposta é plano com preço: sem os dois não há o que negociar depois.
        {
          id: "clo_proposta",
          name: "Proposta",
          order: 2,
          defaultProbability: 80,
          requirements: [
            { moment: "entrada", kind: "valorObrigatorio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_plano" },
          ],
          allowedTransitionStageIds: [],
        },
        // A objeção nomeada é o que separa negociar de dar desconto.
        {
          id: "clo_negociacao",
          name: "Negociação",
          order: 3,
          defaultProbability: 88,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_objecao" }],
          allowedTransitionStageIds: [],
        },
        // Fechamento é contrato em assinatura, e ele ainda PODE ser perdido:
        // por isso é Etapa, e não o momento do ganho.
        {
          id: "clo_fechamento",
          name: "Fechamento",
          order: 4,
          defaultProbability: 95,
          requirements: [{ moment: "entrada", kind: "campoPreenchido", fieldDefinitionId: "fd_pagamento" }],
          allowedTransitionStageIds: ["clo_negociacao"],
        },
      ],
      closingRules: { requireLossReason: true, requireValueOnWin: true },
    },

    /*
     * Validação Full Face Avançado: do sinal pago ao contrato. A pessoa paga
     * para entrar no processo, passa por uma call de validação e só avança à
     * venda se for aprovada.
     *
     * "Ganho" e "Não aprovado" NÃO são Etapas, pelo mesmo motivo dos outros
     * Funis: ganho é a situação do Negócio, e reprovação é perda com Motivo
     * ("Não aprovado") — é assim que o Painel de perdas a enxerga, e é onde a
     * tratativa do sinal fica registrada (`fd_tratativa_sinal`).
     */
    {
      id: "fnl_validacao",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(60),
      lifecycle: "ativo",
      name: "Validação Full Face Avançado",
      description: "Do sinal pago à contratação, passando pela call de validação",
      color: "#0F766E",
      order: 4,
      isPrivate: false,
      stages: [
        // Sinal pago é fato com data, não intenção: sem `fd_sinal_pago_em` não entra.
        {
          id: "val_sinal",
          name: "Sinal pago",
          order: 0,
          defaultProbability: 15,
          requirements: [
            { moment: "entrada", kind: "contatoObrigatorio" },
            { moment: "entrada", kind: "campoPreenchido", fieldDefinitionId: "fd_sinal_pago_em" },
          ],
          allowedTransitionStageIds: [],
        },
        // O objetivo da Etapa é o agendamento: sair dela é ter data marcada.
        {
          id: "val_aguardando",
          name: "Aguardando agendamento",
          order: 1,
          defaultProbability: 20,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_data_reuniao" }],
          allowedTransitionStageIds: [],
        },
        {
          id: "val_agendada",
          name: "Call agendada",
          order: 2,
          defaultProbability: 35,
          requirements: [{ moment: "entrada", kind: "campoPreenchido", fieldDefinitionId: "fd_data_reuniao" }],
          allowedTransitionStageIds: [],
        },
        // A call produz a validação escrita; sem ela a análise não tem o que ler.
        {
          id: "val_realizada",
          name: "Call realizada",
          order: 3,
          defaultProbability: 50,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_validacao" }],
          allowedTransitionStageIds: [],
        },
        // Opcional: só quando a decisão não sai na hora. Pode ser pulada.
        {
          id: "val_analise",
          name: "Em análise",
          order: 4,
          defaultProbability: 55,
          requirements: [],
          allowedTransitionStageIds: [],
        },
        // Aprovado é o resultado registrado, não a opinião de quem moveu o card.
        {
          id: "val_aprovado",
          name: "Aprovado",
          order: 5,
          defaultProbability: 75,
          requirements: [{ moment: "entrada", kind: "campoPreenchido", fieldDefinitionId: "fd_resultado_validacao" }],
          allowedTransitionStageIds: [],
        },
        // Venda é proposta com valor; o ganho fecha com pagamento confirmado.
        {
          id: "val_venda",
          name: "Venda",
          order: 6,
          defaultProbability: 90,
          requirements: [
            { moment: "entrada", kind: "valorObrigatorio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_pagamento" },
          ],
          allowedTransitionStageIds: ["val_aprovado"],
        },
      ],
      closingRules: { requireLossReason: true, requireValueOnWin: true },
    },

    /*
     * Venda direta pelo WhatsApp: um Funil só, do lead ao pagamento, sem
     * passagem entre SDR e Closer. "Ganho" e "Perdido" são a situação do
     * Negócio, como nos outros três: ganhar é pagamento confirmado, perder é
     * Motivo registrado (sem resposta, desistiu, sem perfil).
     */
    {
      id: "fnl_venda_direta",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(45),
      lifecycle: "ativo",
      name: "Venda direta",
      description: "Funil de vendas pelo WhatsApp: do lead ao pagamento, numa conversa só",
      color: "#15803D",
      order: 5,
      isPrivate: false,
      stages: [
        { id: "vd_novo", name: "Novo lead", order: 0, defaultProbability: 5, requirements: [], allowedTransitionStageIds: [] },
        // Automação de abordagem move para cá quando a primeira Mensagem sai.
        { id: "vd_contato", name: "Primeiro contato", order: 1, defaultProbability: 10, requirements: [], allowedTransitionStageIds: [] },
        // Perfil, necessidade, momento e potencial: quatro Campos, os mesmos do roteiro.
        {
          id: "vd_qualificacao",
          name: "Em qualificação",
          order: 2,
          defaultProbability: 30,
          requirements: [
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_criterio_fit" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_dor" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_prazo" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_orcamento" },
          ],
          allowedTransitionStageIds: [],
        },
        // Oferta é produto com preço: sem valor não houve oferta.
        {
          id: "vd_oferta",
          name: "Oferta apresentada",
          order: 3,
          defaultProbability: 55,
          requirements: [
            { moment: "entrada", kind: "valorObrigatorio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_plano" },
          ],
          allowedTransitionStageIds: [],
        },
        // Objeções, condições, follow-up e o pagamento em trânsito. Sair daqui
        // é ganhar com a forma de pagamento definida.
        {
          id: "vd_negociacao",
          name: "Em negociação",
          order: 4,
          defaultProbability: 75,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_pagamento" }],
          allowedTransitionStageIds: ["vd_oferta"],
        },
      ],
      closingRules: { requireLossReason: true, requireValueOnWin: true },
    },
  ];

  // ── Empresas: 12, com matriz + 2 filiais e um Vínculo `parceira` ──────────
  const segmentOf = ["Odontologia", "Multidisciplinar", "Odontologia", "Medicina", "Biomedicina", "Odontologia", "Multidisciplinar", "Biomedicina", "Odontologia", "Odontologia", "Medicina", "Biomedicina"];
  const companies: Company[] = COMPANY_NAMES.map(([trade, legal, domain], index) => ({
    id: `cmp_${index + 1}`,
    workspaceId: WORKSPACE_ID,
    createdBy: member(index % 3 === 0 ? "mem_julia" : "mem_rafael"),
    createdAt: at(300 - index * 7),
    lifecycle: "ativo" as const,
    tradeName: trade,
    legalName: legal,
    ownerMemberId: index % 2 === 0 ? "mem_rafael" : "mem_julia",
    description: "",
    originId: catalog[index % 4]?.id,
    identifiers: [
      { id: `cmi_${index + 1}a`, type: "dominio" as const, value: domain, verified: true, principal: true, createdAt: at(300 - index * 7) },
      { id: `cmi_${index + 1}b`, type: "documentoFiscal" as const, value: `${10_000_000 + index * 137}000199`, country: "BR", verified: false, principal: true, createdAt: at(300 - index * 7) },
    ],
    addresses: [],
    tagIds: index % 5 === 0 ? ["tag_convenio"] : [],
    fieldValues: [
      { definitionId: "fd_segmento", value: segmentOf[index] ?? "Serviços", state: "ativo" as const },
      { definitionId: "fd_porte", value: index < 4 ? "Rede" : index < 8 ? "Clínica" : "Consultório", state: "ativo" as const },
    ],
    attachments: [],
    comments: [],
  }));
  // Matriz com 2 filiais (B51 — floresta acíclica, sem herança).
  const alfa = companies[1];
  const brasa = companies[2];
  if (alfa) alfa.parentCompanyId = "cmp_1";
  if (brasa) brasa.parentCompanyId = "cmp_1";

  // ── Contatos: 30 + 1 não identificado + 1 mesclado ───────────────────────
  const firstNames = ["Ana", "Marina", "Paulo", "Renata", "Diego", "Fernanda", "Bruno", "Carla", "Eduardo", "Patrícia", "Lucas", "Juliana", "Roberto", "Sandra", "Thiago", "Vanessa", "Gustavo", "Bianca", "Rodrigo", "Letícia", "André", "Priscila", "Felipe", "Camila", "Marcelo", "Aline", "Vinícius", "Débora", "Otávio", "Natália"];
  const lastNames = ["Ribeiro", "Alves", "Cardoso", "Moreira", "Barbosa", "Rocha", "Teixeira", "Dias", "Correia", "Freitas", "Pinto", "Araújo", "Monteiro", "Melo", "Cunha", "Farias", "Batista", "Nogueira", "Peixoto", "Xavier", "Aguiar", "Brandão", "Coelho", "Fonseca", "Guimarães", "Leal", "Macedo", "Nunes", "Prado", "Quirino"];

  const contacts: Contact[] = firstNames.map((first, index) => {
    const last = lastNames[index] ?? "Silva";
    const domain = COMPANY_NAMES[index % 12]?.[2] ?? "exemplo.com.br";
    const local = `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return {
      id: `cnt_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member(index % 4 === 0 ? "mem_julia" : "mem_rafael"),
      createdAt: at(280 - index * 6),
      lifecycle: "ativo" as const,
      firstName: first,
      lastName: last,
      ownerMemberId: index % 3 === 0 ? "mem_julia" : index % 3 === 1 ? "mem_rafael" : "mem_thiago",
      creationMode: index % 7 === 0 ? ("automaticoPorMensagem" as const) : ("manual" as const),
      originId: catalog[index % 4]?.id,
      qualificationId: index < 8 ? "cat_qual_cli" : index < 18 ? "cat_qual_prosp" : "cat_qual_lead",
      temperatureId: index % 3 === 0 ? "cat_temp_quente" : index % 3 === 1 ? "cat_temp_morno" : "cat_temp_frio",
      description: "",
      identifiers: [
        { id: `cid_${index + 1}a`, type: "email" as const, value: `${local}@${domain}`, displayValue: `${local}@${domain}`, verified: true, principal: true, createdBy: member("mem_rafael"), createdAt: at(280 - index * 6) },
        { id: `cid_${index + 1}b`, type: "identidadeDeWhatsApp" as const, value: `5511${970_000_000 + index * 1_237}`, displayValue: `+55 11 9${String(7_000_000 + index * 1_237).slice(0, 4)}-${1000 + index}`, channelOriginId: "chn_wpp", verified: true, principal: true, createdBy: SYSTEM, createdAt: at(280 - index * 6) },
        { id: `cid_${index + 1}d`, type: "perfilDeLinkedIn" as const, value: `linkedin.com/in/${local}`, displayValue: `linkedin.com/in/${local}`, verified: false, principal: true, createdBy: member("mem_julia"), createdAt: at(280 - index * 6) },
      ],
      consents: [
        { purposeId: "cat_fin_atend", channelType: "todos" as const, decision: "concedido" as const, at: at(280 - index * 6), origin: "mensagem" as const, recordedBy: SYSTEM, recordedAt: at(280 - index * 6) },
        ...(index % 3 === 0
          ? [{ purposeId: "cat_fin_mkt", channelType: "whatsapp" as const, decision: "concedido" as const, at: at(200 - index), origin: "formulario" as const, recordedBy: member("mem_julia"), recordedAt: at(200 - index) }]
          : []),
      ],
      addresses: [
        {
          kind: "comercial",
          city: CITIES[index % CITIES.length] ?? "São Paulo",
          region: REGIONS[index % REGIONS.length] ?? "SP",
          country: "BR",
          principal: true,
        },
      ],
      tagIds: index % 6 === 0 ? ["tag_convenio"] : [],
      fieldValues: [],
      comments: [],
    };
  });

  /**
   * Um par que dispara Suspeita de Duplicidade sem violar INV-CON-02: o mesmo
   * número aparece como `telefone` num Contato e como `identidadeDeWhatsApp` no
   * outro — Tipos distintos, então não é o mesmo Identificador (RN-CON-10).
   */
  const paraDuplicar = contacts[3];
  const numeroDuplicado = paraDuplicar?.identifiers.find(
    (i) => i.type === "identidadeDeWhatsApp",
  );
  if (paraDuplicar) {
    contacts.push({
      ...paraDuplicar,
      id: "cnt_33",
      firstName: paraDuplicar.firstName,
      lastName: paraDuplicar.lastName,
      creationMode: "automaticoPorMensagem",
      createdBy: SYSTEM,
      createdAt: at(3),
      ownerMemberId: "mem_julia",
      identifiers: [
        {
          id: "cid_33a",
          type: "telefone",
          value: numeroDuplicado?.value ?? "5511970000000",
          displayValue: numeroDuplicado?.displayValue ?? "+55 11 97000-0000",
          verified: false,
          principal: true,
          createdBy: SYSTEM,
          createdAt: at(3),
        },
      ],
      comments: [],
    });
  }

  const first = contacts[0];
  const second = contacts[1];
  if (first) {
    // 1 Contato "não identificado": Nome vazio é condição derivada, não estado.
    contacts.push({
      ...first,
      id: "cnt_31",
      firstName: "",
      lastName: "",
      creationMode: "automaticoPorMensagem",
      createdBy: SYSTEM,
      createdAt: at(2),
      ownerMemberId: "mem_julia",
      qualificationId: "cat_qual_lead",
      identifiers: [
        { id: "cid_31", type: "identidadeDeWhatsApp", value: "5511988887777", displayValue: "+55 11 98888-7777", channelOriginId: "chn_wpp", channelLabel: "Sérgio", verified: true, principal: true, createdBy: SYSTEM, createdAt: at(2) },
      ],
      consents: [],
      tagIds: [],
    });
  }
  if (second) {
    // 1 Contato `mesclado`, apontando o sobrevivente e guardando o estado (B14).
    contacts.push({
      ...second,
      id: "cnt_32",
      firstName: "Marina",
      lastName: "A.",
      lifecycle: "mesclado",
      mergedIntoId: "cnt_2",
      mergedAt: at(15),
      identifiers: [],
      preMergeState: { at: at(15), snapshot: JSON.stringify({ firstName: "Marina", lastName: "A." }) },
    });
  }

  /*
   * O decisor do Negócio de referência. A conversa diz que quem decide junto é
   * a Camila, e um Negócio em Negociação cujo decisor não existe como Contato é
   * um Negócio que ninguém consegue tocar.
   */
  if (first) {
    contacts.push({
      ...first,
      id: "cnt_34",
      firstName: "Camila",
      lastName: "Iallas",
      creationMode: "manual",
      createdBy: member("mem_julia"),
      createdAt: at(7),
      ownerMemberId: "mem_rafael",
      qualificationId: "cat_qual_qualificado",
      temperatureId: "cat_temp_morno",
      description: "",
      identifiers: [
        { id: "cid_34a", type: "email", value: "financeiro@clinicarenovar.com.br", displayValue: "financeiro@clinicarenovar.com.br", verified: true, principal: true, createdBy: member("mem_julia"), createdAt: at(7) },
        { id: "cid_34b", type: "perfilDeLinkedIn", value: "linkedin.com/in/camilaiallas", displayValue: "linkedin.com/in/camilaiallas", verified: false, principal: true, createdBy: member("mem_julia"), createdAt: at(7) },
      ],
      consents: [],
      tagIds: [],
      fieldValues: [
        {
          definitionId: "fd_resumo_perfil",
          value: "Cuida do financeiro da clínica. Entra na conversa quando a proposta chega com número.",
          state: "ativo",
        },
      ],
      comments: [],
    });
  }

  /*
   * Iallas, Cliente. É o Contato que carrega FOTO: `photoFileId` aponta para
   * `public/contatos/<id>.jpg`, e o avatar cai nas iniciais se o arquivo não
   * estiver lá.
   */
  if (first) {
    contacts.push({
      ...first,
      id: "cnt_35",
      firstName: "Iallas",
      lastName: "",
      creationMode: "manual",
      createdBy: member("mem_rafael"),
      createdAt: at(180),
      ownerMemberId: "mem_rafael",
      qualificationId: "cat_qual_cli",
      temperatureId: "cat_temp_quente",
      photoFileId: "iallas",
      description: "",
      identifiers: [
        { id: "cid_35a", type: "email", value: "iallas@clinicarenovar.com.br", displayValue: "iallas@clinicarenovar.com.br", verified: true, principal: true, createdBy: member("mem_rafael"), createdAt: at(180) },
        { id: "cid_35b", type: "identidadeDeWhatsApp", value: "5511993451188", displayValue: "+55 11 99345-1188", channelOriginId: "chn_wpp", verified: true, principal: true, createdBy: SYSTEM, createdAt: at(180) },
        { id: "cid_35c", type: "usuarioDeInstagram", value: "@dr.iallas", displayValue: "@dr.iallas", channelOriginId: "chn_insta", verified: true, principal: true, createdBy: SYSTEM, createdAt: at(180) },
        { id: "cid_35d", type: "perfilDeLinkedIn", value: "linkedin.com/in/iallas", displayValue: "linkedin.com/in/iallas", verified: true, principal: true, createdBy: member("mem_rafael"), createdAt: at(180) },
        { id: "cid_35e", type: "perfilDeTikTok", value: "@dr.iallas", displayValue: "@dr.iallas", verified: false, principal: true, createdBy: member("mem_rafael"), createdAt: at(180) },
      ],
      consents: [
        { purposeId: "cat_fin_atend", channelType: "todos" as const, decision: "concedido" as const, at: at(180), origin: "mensagem" as const, recordedBy: SYSTEM, recordedAt: at(180) },
        { purposeId: "cat_fin_mkt", channelType: "whatsapp" as const, decision: "concedido" as const, at: at(178), origin: "formulario" as const, recordedBy: member("mem_rafael"), recordedAt: at(178) },
      ],
      addresses: [{ kind: "comercial", city: "São Paulo", region: "SP", country: "BR", principal: true }],
      tagIds: ["tag_convenio"],
      fieldValues: [
        {
          definitionId: "fd_resumo_perfil",
          value: "Cirurgião-dentista com CRO ativo e clínica própria há quatro anos, cerca de 60 pacientes por mês. Já aplica toxina e preenchimento labial e quer o protocolo completo de full face.",
          state: "ativo",
        },
      ],
      comments: [],
    });
  }

  // 4 Contatos sem Empresa: os índices 26..29 ficam sem Vínculo.
  /** O Contato `cnt_N` trabalha nesta Empresa — a mesma conta usada abaixo. */
  const empresaDoContato = (numeroDoContato: number): Id =>
    numeroDoContato === 35 ? "cmp_4" : `cmp_${((numeroDoContato - 1) % 12) + 1}`;

  const contactCompanyLinks: ContactCompanyLink[] = [];
  for (let index = 0; index < 26; index += 1) {
    contactCompanyLinks.push({
      id: `ccl_c${index + 1}`,
      contactId: `cnt_${index + 1}`,
      companyId: `cmp_${(index % 12) + 1}`,
      role: index % 4 === 0 ? "Cirurgiã-dentista" : index % 4 === 1 ? "Médico" : index % 4 === 2 ? "Biomédica" : "Cirurgião-dentista",
      principalForContact: true,
      principalForCompany: index < 12,
      start: day(-300 + index * 5),
      createdBy: member("mem_rafael"),
      createdAt: at(280 - index * 6),
    });
  }
  contactCompanyLinks.push({
    id: "ccl_iallas",
    contactId: "cnt_35",
    companyId: "cmp_4",
    role: "Cirurgião-dentista",
    principalForContact: true,
    principalForCompany: false,
    start: day(-180),
    createdBy: member("mem_rafael"),
    createdAt: at(180),
  });

  // 2 Contatos em duas Empresas (B8) e 1 Vínculo encerrado (RN-CON-06).
  contactCompanyLinks.push(
    { id: "ccl_x1", contactId: "cnt_3", companyId: "cmp_9", role: "Conselheiro", principalForContact: false, principalForCompany: false, start: day(-120), createdBy: member("mem_rafael"), createdAt: at(120) },
    { id: "ccl_x2", contactId: "cnt_7", companyId: "cmp_11", role: "Sócio", principalForContact: false, principalForCompany: false, start: day(-90), createdBy: member("mem_rafael"), createdAt: at(90) },
    { id: "ccl_x3", contactId: "cnt_5", companyId: "cmp_6", role: "Analista de Marketing", principalForContact: false, principalForCompany: false, start: day(-400), end: day(-140), createdBy: member("mem_rafael"), createdAt: at(400) },
  );

  // ── Negócios: 25 (5 ganhos, 4 perdidos com Motivo, 1 reaberto) ───────────
  const deals: Deal[] = [];

  /**
   * Negócios percorrendo o Funil SDR e o Closer.
   *
   * Cada um carrega EXATAMENTE os campos que a Etapa dele já exige: quem está
   * em Qualificado tem os cinco do roteiro e a data da reunião; quem está em
   * Conexão tem o momento da conexão. Assim o quadro mostra Requisitos
   * satisfeitos, e não um formulário vazio que bloqueia todo arrasto.
   */
  const campo = (definitionId: Id, value: FieldValue["value"]): FieldValue => ({
    definitionId,
    value,
    state: "ativo",
  });
  const conexaoEm = (dias: number) => campo("fd_conexao_em", at(dias, 11));

  /*
   * Um Negócio aberto por Funil, os dois do Iallas: o quadro fica legível para
   * demonstrar o processo. O histórico continua inteiro nos encerrados, que o
   * quadro não mostra como card e os Painéis continuam medindo.
   */
  const sdrDeals: ReadonlyArray<{
    readonly stage: Id;
    readonly empresa: number;
    readonly contato: number;
    readonly campos: readonly FieldValue[];
  }> = [
    // O primeiro vira o Negócio de referência e é entregue ao Closer logo
    // abaixo; o segundo é a nova turma, e é o que fica no quadro do SDR.
    { stage: "sdr_novo", empresa: 4, contato: 35, campos: [] },
    {
      stage: "sdr_qualificacao",
      empresa: 4,
      contato: 35,
      campos: [conexaoEm(3)],
    },
  ];

  sdrDeals.forEach((entrada, index) => {
    deals.push({
      id: `deal_sdr_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_julia"),
      createdAt: at(20 - index),
      lifecycle: "ativo",
      readableId: `NEG-${2000 + index}`,
      title:
        index === 0
          ? `Full Face para ${contacts[entrada.contato - 1]?.firstName ?? "Lead"}`
          : `Módulo prático para ${contacts[entrada.contato - 1]?.firstName ?? "Lead"}`,
      object: "Full Face Avançado",
      description: "",
      companyId: empresaDoContato(entrada.contato),
      ownerMemberId: index % 2 === 0 ? "mem_julia" : "mem_marcos",
      funnelId: "fnl_sdr",
      stageId: entrada.stage,
      situation: "aberto",
      originId: index % 2 === 0 ? "cat_org_insta" : "cat_org_site",
      expectedCloseDate: day(20 + index),
      enteredStageAt: at(3 + index),
      contactLinks:
        entrada.stage === "sdr_qualificado"
          ? []
          : [
              { id: `dcl_sdr_${index + 1}`, contactId: `cnt_${entrada.contato}`, role: "decisor", principal: true, createdBy: member("mem_julia"), createdAt: at(20 - index) },
            ],
      tagIds: [],
      fieldValues: [...entrada.campos],
      attachments: [],
      comments: [],
      stageHistory: [],
    });
  });

  const protagonista = contacts.find((c) => c.id === "cnt_35");
  if (protagonista) {
    protagonista.fieldValues = [
      ...protagonista.fieldValues,
      {
        definitionId: "fd_sinais_fit",
        value: ["Habilitação ativa", "Clínica própria", "Já aplica toxina"],
        state: "ativo",
      },
    ];
  }

  /*
   * O Negócio de referência: o mesmo que a conversa de WhatsApp conta, já
   * entregue ao Closer e em Negociação.
   *
   * Cada Valor de Campo aqui tem origem numa resposta do Iallas na conversa, e
   * o histórico guarda o caminho inteiro, inclusive a mudança de Funil. É o
   * Negócio que o time abre para julgar a tela, então ele precisa estar cheio
   * como um Negócio real de verdade estaria.
   */
  const referencia = deals.find((d) => d.id === "deal_sdr_1");
  if (referencia) {
    referencia.title = "Full Face Avançado para Iallas";
    referencia.funnelId = "fnl_closer";
    referencia.stageId = "clo_negociacao";
    referencia.ownerMemberId = "mem_thiago";
    // Plano Elite: 10 casos, 4 mentorias, 90 dias de suporte.
    referencia.value = { amount: 16_997, currency: "BRL" };
    referencia.originId = "cat_org_insta";
    referencia.expectedCloseDate = day(18);
    referencia.enteredStageAt = at(3, 11);
    referencia.description =
      "Cirurgião-dentista com clínica própria há quatro anos e cerca de 60 pacientes por mês. Já aplica toxina e preenchimento labial; quer o protocolo completo.";
    referencia.fieldValues = [
      campo("fd_conexao_em", at(12, 14)),
      campo("fd_criterio_fit", "Cirurgião-dentista com CRO ativo, clínica própria há quatro anos, 60 pacientes por mês. Já faz toxina e preenchimento labial."),
      campo("fd_criterio", "Ver caso real do começo ao fim, não só teoria, e ter mentoria para tirar dúvida na hora de aplicar no próprio paciente."),
      campo("fd_dor", "Oito pacientes por mês pedem full face ou rinomodelação e ele encaminha para uma colega. São uns 16 mil por mês saindo da clínica."),
      campo("fd_decisor", "Decisão dele, com a Camila, que cuida do financeiro da clínica. Ela entra na call."),
      campo("fd_orcamento", 10_000),
      campo("fd_prazo", "Até 90 dias"),
      campo("fd_result_qual", "Qualificado"),
      campo("fd_data_reuniao", at(4, 10)),
      campo("fd_sdr_origem", "mem_thiago"),
      campo("fd_diagnostico", "Faz toxina e preenchimento labial há dois anos, nunca fez o protocolo completo. O medo declarado é a transição do terço médio. Encaminha oito casos por mês."),
      campo("fd_plano", "Elite"),
      campo("fd_objecao", "Parcelamento"),
    ];
    referencia.tagIds = ["tag_convenio"];
    referencia.contactLinks = [
      { id: "dcl_ref_1", contactId: "cnt_35", role: "influenciador", principal: true, createdBy: member("mem_thiago"), createdAt: at(12) },
      { id: "dcl_ref_2", contactId: "cnt_34", role: "decisor", principal: false, createdBy: member("mem_thiago"), createdAt: at(7) },
    ];
    const caminho: ReadonlyArray<[Id, string, number, Id, StageTransition["entryOrigin"], number]> = [
      ["sdr_novo", "Novo Lead", 0, "fnl_sdr", "criacao", 13],
      ["sdr_contato", "Contato Inicial", 1, "fnl_sdr", "avanco", 12],
      ["sdr_conexao", "Conexão", 2, "fnl_sdr", "avanco", 12],
      ["sdr_qualificacao", "Qualificação", 3, "fnl_sdr", "avanco", 11],
      ["sdr_qualificado", "Qualificado", 4, "fnl_sdr", "avanco", 9],
      ["sdr_agendamento", "Agendamento", 5, "fnl_sdr", "avanco", 7],
      ["clo_agendamento", "Agendamento", 0, "fnl_closer", "mudancaDeFunil", 7],
      ["clo_call", "Call", 1, "fnl_closer", "avanco", 4],
      ["clo_negociacao", "Negociação", 2, "fnl_closer", "avanco", 3],
    ];
    referencia.stageHistory = caminho.map(([id, nome, ordem, funil, origem, dias], posicao) => {
      const anterior = caminho[posicao - 1];
      return {
        id: nextId("trn"),
        at: at(dias, 12),
        ...(anterior
          ? { fromStageId: anterior[0], fromStageName: anterior[1], fromStageOrder: anterior[2], fromFunnelId: anterior[3] }
          : {}),
        toStageId: id,
        toStageName: nome,
        toStageOrder: ordem,
        toFunnelId: funil,
        entryOrigin: origem,
        actor: member(origem === "mudancaDeFunil" ? "mem_julia" : posicao > 5 ? "mem_rafael" : "mem_julia"),
      };
    });
  }

  /*
   * O Iallas no Funil de Validação: sinal pago, call marcada. Carrega
   * exatamente o que as Etapas até "Call agendada" exigem — a data do sinal e
   * a data da call — e o histórico das duas passagens.
   */
  {
    const trilha: ReadonlyArray<[Id, string, number, number]> = [
      ["val_sinal", "Sinal pago", 0, 5],
      ["val_aguardando", "Aguardando agendamento", 1, 5],
      ["val_agendada", "Call agendada", 2, 2],
    ];
    deals.push({
      id: "deal_val_1",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(5, 10),
      lifecycle: "ativo",
      readableId: "NEG-3000",
      title: "Validação para Iallas",
      object: "Full Face Avançado",
      description: "Pagou o sinal pelo link da proposta. Call de validação marcada com a Camila junto.",
      companyId: empresaDoContato(35),
      ownerMemberId: "mem_thiago",
      funnelId: "fnl_validacao",
      stageId: "val_agendada",
      situation: "aberto",
      value: { amount: 16_997, currency: "BRL" },
      originId: "cat_org_insta",
      expectedCloseDate: day(12),
      enteredStageAt: at(2, 15),
      contactLinks: [
        { id: "dcl_val_1", contactId: "cnt_35", role: "decisor", principal: true, createdBy: member("mem_thiago"), createdAt: at(5, 10) },
      ],
      tagIds: [],
      fieldValues: [
        campo("fd_sinal_pago_em", at(5, 9)),
        campo("fd_data_reuniao", at(-1, 10)),
        campo("fd_plano", "Elite"),
      ],
      attachments: [],
      comments: [],
      stageHistory: trilha.map(([id, nome, ordem, dias], posicao) => {
        const anterior = trilha[posicao - 1];
        return {
          id: nextId("trn"),
          at: at(dias, 15),
          ...(anterior
            ? { fromStageId: anterior[0], fromStageName: anterior[1], fromStageOrder: anterior[2], fromFunnelId: "fnl_validacao" }
            : {}),
          toStageId: id,
          toStageName: nome,
          toStageOrder: ordem,
          toFunnelId: "fnl_validacao",
          entryOrigin: posicao === 0 ? "criacao" : "avanco",
          actor: member("mem_thiago"),
        };
      }),
    });
  }

  /* O Iallas na Venda direta: qualificado no WhatsApp, oferta na mesa. */
  {
    const trilha: ReadonlyArray<[Id, string, number, number]> = [
      ["vd_novo", "Novo lead", 0, 9],
      ["vd_contato", "Primeiro contato", 1, 9],
      ["vd_qualificacao", "Em qualificação", 2, 8],
      ["vd_oferta", "Oferta apresentada", 3, 6],
    ];
    deals.push({
      id: "deal_vd_1",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_marcos"),
      createdAt: at(9, 10),
      lifecycle: "ativo",
      readableId: "NEG-4000",
      title: "Venda direta para Iallas",
      object: "Full Face Avançado",
      description: "Chegou pelo anúncio e respondeu no WhatsApp no mesmo dia. Quer o Pro; pediu as condições por escrito.",
      companyId: empresaDoContato(35),
      ownerMemberId: "mem_marcos",
      funnelId: "fnl_venda_direta",
      stageId: "vd_oferta",
      situation: "aberto",
      value: { amount: 10_997, currency: "BRL" },
      originId: "cat_org_insta",
      expectedCloseDate: day(7),
      enteredStageAt: at(6, 16),
      contactLinks: [
        { id: "dcl_vd_1", contactId: "cnt_35", role: "decisor", principal: true, createdBy: member("mem_marcos"), createdAt: at(9, 10) },
      ],
      tagIds: [],
      fieldValues: [
        campo("fd_criterio_fit", "Cirurgião-dentista, clínica própria, já aplica toxina. Perfil do curso."),
        campo("fd_dor", "Encaminha os casos de full face para uma colega e perde a receita."),
        campo("fd_prazo", "Até 30 dias"),
        campo("fd_orcamento", 11_000),
      ],
      attachments: [],
      comments: [],
      stageHistory: trilha.map(([id, nome, ordem, dias], posicao) => {
        const anterior = trilha[posicao - 1];
        return {
          id: nextId("trn"),
          at: at(dias, 16),
          ...(anterior
            ? { fromStageId: anterior[0], fromStageName: anterior[1], fromStageOrder: anterior[2], fromFunnelId: "fnl_venda_direta" }
            : {}),
          toStageId: id,
          toStageName: nome,
          toStageOrder: ordem,
          toFunnelId: "fnl_venda_direta",
          entryOrigin: posicao === 0 ? "criacao" : "avanco",
          actor: member("mem_marcos"),
        };
      }),
    });
  }

  /**
   * Desqualificados pelo SDR. O Motivo de Perda aqui é do começo do funil — sem
   * resposta, sem conexão, não é decisor — e não o motivo comercial do Closer.
   */
  const desqualificados: ReadonlyArray<{
    readonly etapa: Id;
    readonly empresa: number;
    readonly motivo: Id;
    readonly dono: Id;
  }> = [
    { etapa: "sdr_contato", empresa: 4, motivo: "cat_perda_semresp", dono: "mem_julia" },
    { etapa: "sdr_contato", empresa: 12, motivo: "cat_perda_semresp", dono: "mem_marcos" },
    { etapa: "sdr_conexao", empresa: 1, motivo: "cat_perda_semconex", dono: "mem_julia" },
    { etapa: "sdr_qualificacao", empresa: 11, motivo: "cat_perda_naodecisor", dono: "mem_marcos" },
    { etapa: "sdr_qualificacao", empresa: 2, motivo: "cat_perda_desqual", dono: "mem_julia" },
    { etapa: "sdr_agendamento", empresa: 7, motivo: "cat_perda_semagend", dono: "mem_marcos" },
  ];

  desqualificados.forEach((entrada, index) => {
    deals.push({
      id: `deal_sdr_perd_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member(entrada.dono),
      createdAt: at(60 - index * 4),
      lifecycle: "ativo",
      readableId: `NEG-${2100 + index}`,
      title: `Full Face para ${contacts[19 + index]?.firstName ?? "Lead"} ${contacts[19 + index]?.lastName ?? ""}`.trim(),
      object: "Full Face Avançado",
      description: "",
      companyId: empresaDoContato(20 + index),
      ownerMemberId: entrada.dono,
      funnelId: "fnl_sdr",
      stageId: entrada.etapa,
      situation: "perdido",
      lossReasonId: entrada.motivo,
      closedAt: at(40 - index * 4),
      originId: index % 2 === 0 ? "cat_org_insta" : "cat_org_site",
      expectedCloseDate: day(-20 + index),
      enteredStageAt: at(50 - index * 4),
      contactLinks: [
        { id: `dcl_sdr_perd_${index + 1}`, contactId: `cnt_${20 + index}`, role: "decisor", principal: true, createdBy: member(entrada.dono), createdAt: at(60 - index * 4) },
      ],
      tagIds: [],
      fieldValues: [],
      attachments: [],
      comments: [],
      stageHistory: [],
    });
  });

  /**
   * Os Campos que o Closer já teria preenchido para o Negócio ter chegado
   * àquela Etapa. Sem eles o seed nasce num estado que as próprias Regras de
   * Etapa não deixariam alcançar, e a reabertura recusa com razão.
   */
  const camposDoCloser = (etapa: Id): FieldValue[] => {
    const ordem = ["clo_agendamento", "clo_call", "clo_proposta", "clo_negociacao", "clo_fechamento"];
    const ate = ordem.indexOf(etapa);
    const campos: FieldValue[] = [];
    if (ate >= 1) {
      campos.push(
        campo("fd_diagnostico", "Já aplica toxina e preenchimento, mas nunca fez o protocolo completo. Encaminha os casos de full face."),
      );
    }
    if (ate >= 2) campos.push(campo("fd_plano", "Pro"));
    if (ate >= 3) campos.push(campo("fd_objecao", "Parcelamento"));
    if (ate >= 4) campos.push(campo("fd_pagamento", "Cartão em 12x"));
    return campos;
  };

  // Negócios já entregues ao Closer. O histórico guarda a passagem: sem ele, o
  // Painel do SDR não conseguiria contar o que ele entregou.
  const closerDeals: ReadonlyArray<{ readonly stage: Id; readonly empresa: number; readonly valor?: number }> = [];

  /**
   * Negócios encerrados no Closer. Eles existem para o Painel ter o que medir e
   * para as regras de encerramento terem o que exercitar: `ganho` exige valor,
   * `perdido` exige Motivo, e a reabertura precisa de um ganho para desfazer.
   */
  const encerrados: ReadonlyArray<{
    readonly situacao: "ganho" | "perdido";
    readonly etapa: Id;
    readonly empresa: number;
    readonly valor: number;
    readonly motivo: Id;
  }> = [
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 1, valor: 16_997, motivo: "cat_ganho_preco" },
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 2, valor: 10_997, motivo: "cat_ganho_escopo" },
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 5, valor: 16_997, motivo: "cat_ganho_preco" },
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 7, valor: 8_997, motivo: "cat_ganho_escopo" },
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 8, valor: 10_997, motivo: "cat_ganho_preco" },
    { situacao: "perdido", etapa: "clo_negociacao", empresa: 3, valor: 16_997, motivo: "cat_perda_preco" },
    { situacao: "perdido", etapa: "clo_call", empresa: 6, valor: 10_997, motivo: "cat_perda_concor" },
    { situacao: "perdido", etapa: "clo_negociacao", empresa: 9, valor: 8_997, motivo: "cat_perda_semorc" },
    { situacao: "perdido", etapa: "clo_agendamento", empresa: 11, valor: 10_997, motivo: "cat_perda_naocomp" },
  ];

  encerrados.forEach((entrada, index) => {
    deals.push({
      id: `deal_fim_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_julia"),
      createdAt: at(120 - index * 7),
      lifecycle: "ativo",
      readableId: `NEG-${2200 + index}`,
      title: `Full Face para ${contacts[entrada.empresa % 12]?.firstName ?? "Cliente"} ${contacts[entrada.empresa % 12]?.lastName ?? ""}`.trim(),
      object: "Full Face Avançado",
      description: "",
      companyId: `cmp_${entrada.empresa}`,
      ownerMemberId: "mem_rafael",
      funnelId: "fnl_closer",
      stageId: entrada.etapa,
      value: { amount: entrada.valor, currency: "BRL" },
      situation: entrada.situacao,
      ...(entrada.situacao === "ganho"
        ? { winReasonId: entrada.motivo }
        : { lossReasonId: entrada.motivo }),
      closedAt: at(30 - index * 2),
      originId: "cat_org_indic",
      expectedCloseDate: day(-30 + index),
      enteredStageAt: at(45 - index * 2),
      contactLinks: [
        { id: `dcl_fim_${index + 1}`, contactId: `cnt_${index + 1}`, role: "decisor", principal: true, createdBy: member("mem_rafael"), createdAt: at(120 - index * 7) },
      ],
      tagIds: [],
      fieldValues: [
        campo("fd_sdr_origem", "mem_julia"),
        campo("fd_data_reuniao", at(40 - index * 2, 10)),
        ...camposDoCloser(entrada.etapa),
      ],
      attachments: [],
      comments: [],
      stageHistory: [],
    });
  });


  closerDeals.forEach((entrada, index) => {
    const origem = funnels.find((f) => f.id === "fnl_sdr");
    deals.push({
      id: `deal_closer_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_julia"),
      createdAt: at(40 - index * 3),
      lifecycle: "ativo",
      readableId: `NEG-${2100 + index}`,
      title: `Full Face para ${contacts[entrada.empresa % 12]?.firstName ?? "Cliente"} ${contacts[entrada.empresa % 12]?.lastName ?? ""}`.trim(),
      object: "Full Face Avançado",
      description: "",
      companyId: `cmp_${entrada.empresa}`,
      // A7 — depois da passagem, quem responde é o Closer.
      ownerMemberId: "mem_rafael",
      funnelId: "fnl_closer",
      stageId: entrada.stage,
      ...(entrada.valor ? { value: { amount: entrada.valor, currency: "BRL" } } : {}),
      situation: "aberto",
      originId: "cat_org_indic",
      expectedCloseDate: day(10 + index * 5),
      enteredStageAt: at(5 + index),
      contactLinks: [
        { id: `dcl_clo_${index + 1}`, contactId: `cnt_${20 + index}`, role: "decisor", principal: true, createdBy: member("mem_rafael"), createdAt: at(40 - index * 3) },
      ],
      tagIds: [],
      fieldValues: [
        campo("fd_sdr_origem", "mem_julia"),
        campo("fd_data_reuniao", at(6 - index, 14)),
        ...camposDoCloser(entrada.stage),
      ],
      attachments: [],
      comments: [],
      ...(index === 3 ? { lifecycle: "arquivado" as const } : {}),
      stageHistory: [
        {
          id: `stt_pass_${index + 1}`,
          at: at(12 - index),
          fromStageId: "sdr_agendamento",
          fromStageName: "Agendamento",
          fromStageOrder: 5,
          toStageId: "clo_agendamento",
          toStageName: "Agendamento",
          toStageOrder: 0,
          fromFunnelId: origem?.id ?? "fnl_sdr",
          toFunnelId: "fnl_closer",
          entryOrigin: "mudancaDeFunil",
          actor: member("mem_julia"),
        },
      ],
    });
  });
  for (const deal of deals) {
    if (deal.stageHistory.length > 0) continue;
    const stage = funnels
      .find((funnel) => funnel.id === deal.funnelId)
      ?.stages.find((etapa) => etapa.id === deal.stageId);
    if (!stage) continue;
    deal.stageHistory.push({
      id: nextId("trn"),
      at: deal.createdAt,
      toStageId: stage.id,
      toStageName: stage.name,
      toStageOrder: stage.order,
      toFunnelId: deal.funnelId,
      entryOrigin: "criacao",
      actor: deal.createdBy,
    });
  }

  // ── Caixa de Entrada: 4 Canais (1 desconectado), 2 Filas, 20 Conversas ───
  const channels: Channel[] = [
    channel("chn_wpp", "Comercial SP", "whatsapp", "+5511987654321", "conectada", "fila_com"),
    channel("chn_insta", "@transformandofaces", "instagram", "transformandofaces", "desconectada", "fila_com"),
    channel("chn_mail", "contato@transformandofacesonline.com.br", "email", "contato@transformandofacesonline.com.br", "conectada", "fila_sup"),
    channel("chn_site", "Chat do site", "chatDoSite", "transformandofacesonline.com.br", "conectada", "fila_sup"),
    channel("chn_linkedin", "Transformando Faces no LinkedIn", "linkedin", "company/transformandofaces", "conectada", "fila_com"),
  ];
  const whatsapp = channels[0];
  if (whatsapp) {
    whatsapp.messageTemplates = [
      { providerId: "tpl_retomada", name: "Retomada de contato", language: "pt_BR", body: "Olá, {{1}}! Podemos retomar a conversa sobre o programa?", category: "utilidade", approval: "aprovado", syncedAt: at(5) },
      { providerId: "tpl_campanha", name: "Convite para webinar", language: "pt_BR", body: "Olá, {{1}}! A aula aberta sobre full face é dia {{2}}.", category: "marketing", approval: "aprovado", syncedAt: at(5) },
    ];
  }

  const queues: Queue[] = [
    { id: "fila_com", workspaceId: WORKSPACE_ID, createdBy: member("mem_thiago"), createdAt: at(380), lifecycle: "ativo", name: "Comercial", description: "Primeiro contato e qualificação", eligibleMemberIds: ["mem_julia", "mem_rafael"], eligibleTeamIds: ["team_com"], distribution: "rodizio", maxConversationsPerAttendant: 15, defaultContactOwnerMemberId: "mem_julia" },
    { id: "fila_sup", workspaceId: WORKSPACE_ID, createdBy: member("mem_thiago"), createdAt: at(380), lifecycle: "ativo", name: "Suporte", eligibleMemberIds: ["mem_marcos"], eligibleTeamIds: [], distribution: "manual" },
  ];

  const conversations: Conversation[] = [];
  for (let index = 0; index < 20; index += 1) {
    const state: Conversation["state"] = index < 8 ? "aberta" : index < 12 ? "pendente" : "resolvida";
    const chn = channels[index % 4];
    const contact = contacts[index];
    if (!chn || !contact) continue;
    // A aba de Canal do registro sai dos Identificadores do Contato. Uma
    // Conversa num Canal que ele não tem seria Conversa que ninguém vê.
    const tipoDeIdentificador = IDENTIFIER_OF_CHANNEL[chn.channelType];
    if (tipoDeIdentificador && !contact.identifiers.some((i) => i.type === tipoDeIdentificador)) {
      const valor =
        chn.channelType === "instagram"
          ? `@${contact.firstName.toLocaleLowerCase("pt-BR")}.${index}`
          : `sessao-${index + 1}`;
      contact.identifiers.push({
        id: `cid_${index + 1}c`,
        type: tipoDeIdentificador,
        value: valor,
        displayValue: valor,
        channelOriginId: chn.id,
        verified: true,
        principal: true,
        createdBy: SYSTEM,
        createdAt: at(280 - index * 6),
      });
    }
    const opening = index % 3 === 0 ? "Bom dia! Recebi a proposta e queria entender como funciona o acompanhamento dos casos." : index % 3 === 1 ? "Olá, o curso serve para quem já faz toxina mas nunca fez full face?" : "Preciso remarcar o treinamento da equipe comercial.";
    // A Conversa não resolvida precisa estar DENTRO da janela de resposta do
    // Tipo de Canal (RN-CXE-19), senão nada nela pode ser respondido livremente
    // e a Caixa de Entrada nasce inoperante. As resolvidas podem ser antigas.
    const receivedAt = state === "resolvida" ? at(5 - (index % 3), 10) : at(0, 4 - (index % 3));
    const messages: Message[] = [msg(`cnv_${index + 1}`, "recebida", { kind: "integration", id: chn.id }, opening, receivedAt)];
    if (index % 2 === 0) messages.push(msg(`cnv_${index + 1}`, "enviada", member("mem_julia"), "Bom dia! Consigo te enviar o cronograma ainda hoje.", at(0, 5 - (index % 3)), "lida"));
    if (index % 5 === 0) messages.push(msg(`cnv_${index + 1}`, "interna", member("mem_rafael"), "Cliente estratégico, priorizar.", at(0, 6 - (index % 3))));
    conversations.push({
      id: `cnv_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: SYSTEM,
      createdAt: receivedAt,
      lifecycle: "ativo",
      channelId: chn.id,
      contactId: contact.id,
      state,
      ...(chn.defaultQueueId ? { queueId: chn.defaultQueueId } : {}),
      ...(index % 3 !== 2 ? { assignee: member(index % 2 === 0 ? "mem_julia" : "mem_marcos") } : {}),
      title: opening.slice(0, 60),
      titleEdited: false,
      ...(index === 9 ? { snooze: { until: at(-2, 14), reason: "Cliente pediu retorno na quinta", by: member("mem_julia") } } : {}),
      drafts: [],
      starredBy: [],
      tagIds: [],
      fieldValues: [],
      participants: [{ id: nextId("prt"), subject: { kind: "contact", id: contact.id }, role: "contato", principal: true, enteredAt: receivedAt }],
      messages,
      ...(state === "resolvida" ? { resolvedAt: at(2, 16) } : {}),
      reopenCount: index === 13 ? 1 : 0,
    });
  }
  /**
   * A conversa de WhatsApp do Negócio `deal_sdr_1`: a abordagem do SDR, a
   * resposta do lead e a nota interna. É a tela de Negócio que o time usa como
   * referência — e uma coluna de conversa vazia ali não mostra o produto.
   */
  const wpp = channels[0];
  const iallas = contacts.find((c) => c.id === "cnt_35");
  if (wpp && iallas) {
    const inicio = at(0, 3);
    conversations.push({
      id: "cnv_sdr_1",
      workspaceId: WORKSPACE_ID,
      createdBy: SYSTEM,
      createdAt: inicio,
      lifecycle: "ativo",
      channelId: wpp.id,
      contactId: iallas.id,
      state: "aberta",
      ...(wpp.defaultQueueId ? { queueId: wpp.defaultQueueId } : {}),
      assignee: member("mem_thiago"),
      title: "Iallas, Full Face Avançado",
      titleEdited: false,
      drafts: [],
      starredBy: [],
      tagIds: [],
      fieldValues: [],
      participants: [
        { id: nextId("prt"), subject: { kind: "contact", id: iallas.id }, role: "contato", principal: true, enteredAt: inicio },
      ],
      /*
       * A conversa inteira, do primeiro contato à negociação, seguindo o
       * roteiro: abordagem, conexão (pedir permissão para perguntar), as seis
       * perguntas de qualificação, agendamento e passagem ao Closer.
       *
       * Ela existe porque a ficha do Negócio é a tela que o time usa para
       * julgar o produto, e uma conversa de quatro linhas não mostra o que o
       * processo faz. Cada resposta do Iallas é a origem de um Valor de Campo
       * gravado abaixo: dá para conferir de onde veio cada coisa.
       */
      messages: [
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Oi Iallas, tudo bem? Aqui é o Thiago, do Instituto Transformando Faces. Vi que você comentou no post do Full Face. Você já faz harmonização na clínica hoje?", at(12, 9), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Oi Thiago, tudo bem! Faço toxina e um pouco de preenchimento labial, mas sempre no básico. Queria fazer o full face completo e trava.", at(12, 11)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "É onde a maioria trava mesmo. Posso te fazer algumas perguntas rápidas para entender se o curso faz sentido para o seu momento? Cinco minutos, e se não fizer sentido eu mesmo te digo.", at(12, 14), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Pode sim, fica à vontade.", at(12, 15)),

        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Primeiro para eu me situar: você é dentista ou médico, e há quanto tempo está na clínica?", at(11, 9), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Sou cirurgião-dentista, CRO ativo, e tenho clínica própria há quatro anos. Atendo umas 60 pessoas por mês.", at(11, 10)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "E dessas 60, quantas pedem alguma coisa de harmonização que hoje você acaba não fazendo?", at(11, 11), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Umas oito por mês perguntam por full face ou rinomodelação. Eu encaminho para uma colega porque não me sinto seguro no protocolo completo.", at(11, 13)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Esses encaminhamentos, dá para estimar quanto ficaria no seu caixa se ficassem com você?", at(11, 14), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Full face na minha região sai uns 4 mil. Se eu fechasse metade, seriam uns 16 mil por mês que estão indo embora.", at(11, 15)),
        msg("cnv_sdr_1", "interna", member("mem_thiago"), "Dor com número: 16 mil por mês em encaminhamento. O Elite se paga no primeiro mês, usar isso na call.", at(11, 16)),

        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Faz sentido. Se você for escolher um curso para isso, o que vai pesar na sua decisão?", at(9, 10), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Duas coisas. Quero ver caso real do começo ao fim, não só teoria, porque já fiz curso que só mostra slide. E preciso de alguém para tirar dúvida quando eu for aplicar no meu paciente.", at(9, 12)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Anotei as duas. E essa decisão é só sua ou tem mais alguém junto?", at(9, 13), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "A decisão é minha, mas eu converso com a minha esposa, que cuida do financeiro da clínica.", at(9, 14)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Perfeito, aí a gente já deixa a proposta no formato que ela precisa ver. Você tem uma faixa de investimento em mente para este ano?", at(9, 15), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Eu separei uns 10 mil para capacitação. Consigo esticar se o retorno estiver claro.", at(9, 16)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Dá para trabalhar dentro disso. E para quando você quer estar aplicando o protocolo completo?", at(9, 17), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Queria começar a atender full face até o fim do ano. Janeiro é quando enche de paciente querendo se cuidar.", at(9, 18)),

        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Iallas, pelo que você me contou faz muito sentido a gente seguir. Quero te mostrar o acompanhamento dos 10 pacientes e como funciona a mentoria, com o seu caso na tela. Consigo quinta às 10h, uns 40 minutos. Funciona para você?", at(7, 10), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Quinta às 10h está ótimo. Posso chamar a minha esposa junto?", at(7, 11)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Melhor ainda, chama ela sim. Vou mandar o convite agora e um resumo do que conversamos para vocês dois.", at(7, 12), "lida"),
        msg("cnv_sdr_1", "interna", member("mem_thiago"), "Qualificado, com o roteiro preenchido. A Camila, que cuida do financeiro, vem na call, o que encurta o ciclo.", at(7, 12)),

        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Iallas, bom dia! Obrigado pelo tempo de ontem, a call rendeu. Estou finalizando a proposta do Elite, com os 10 casos e as quatro mentorias que a gente falou.", at(1, 9), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Bom dia Thiago! Gostamos bastante. Ela só ficou com uma dúvida sobre o parcelamento.", at(1, 10)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Fica em 12x de R$ 1.757,89 no cartão, ou R$ 16.997 à vista. A garantia é de 7 dias, então dá para entrar, ver o conteúdo e decidir sem risco. Mandei a proposta no seu e-mail agora.", at(0, 9), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Recebi. Vou falar com ela hoje à tarde e te dou um retorno até sexta.", at(0, 11)),
      ],
      reopenCount: 0,
    });
  }

  /**
   * Um registro de cada família na lixeira. Sem eles, as restaurações existem no
   * código e não têm linha na tela: a lixeira só mostraria Tarefas, e o botão
   * das outras famílias nunca seria clicado.
   */
  const conversaNaLixeira = conversations.find((c) => c.state === "resolvida");
  if (conversaNaLixeira) {
    conversaNaLixeira.lifecycle = "naLixeira";
    conversaNaLixeira.trashedAt = at(7);
  }
  const contatoNaLixeira = contacts.find(
    (c) => c.lifecycle === "ativo" && c.id !== "cnt_2" && !conversations.some((cv) => cv.contactId === c.id),
  );
  if (contatoNaLixeira) {
    contatoNaLixeira.lifecycle = "naLixeira";
    contatoNaLixeira.lifecycleBeforeTrash = "ativo";
    contatoNaLixeira.trashedAt = at(8);
  }
  const empresaNaLixeira = companies.find(
    (c) =>
      c.lifecycle === "ativo" &&
      !companies.some((filial) => filial.parentCompanyId === c.id) &&
      !deals.some((d) => d.companyId === c.id && d.situation === "aberto"),
  );
  if (empresaNaLixeira) {
    empresaNaLixeira.lifecycle = "naLixeira";
    empresaNaLixeira.lifecycleBeforeTrash = "ativo";
    empresaNaLixeira.trashedAt = at(11);
  }
  const negocioNaLixeira = deals.find((d) => d.situation === "perdido" && d.lifecycle === "ativo");
  if (negocioNaLixeira) {
    negocioNaLixeira.lifecycle = "naLixeira";
    negocioNaLixeira.lifecycleBeforeTrash = "ativo";
    negocioNaLixeira.trashedAt = at(13);
  }

  // A Conversa do fluxo 5: Rascunho de IA à espera de uso (B66).
  const conversaMarina = conversations[0];
  if (conversaMarina) {
    conversaMarina.contactId = "cnt_2";
    conversaMarina.assignee = member("mem_thiago");
    conversaMarina.drafts.push({
      actor: agentRef("agt_sdr"),
      content: "Oi, Marina! A turma começa na primeira semana de outubro e o acompanhamento dos casos dura 90 dias. Posso reservar a sua vaga?",
      origin: "agente",
      executionId: "exe_1",
      at: at(0, 10),
    });
  }

  // ── IA ───────────────────────────────────────────────────────────────────
  const agents: Agent[] = [
    agent("agt_padrao", "Assistente padrão", "mem_thiago", "ativo", "supervisionado", true),
    agent("agt_sdr", "Qualificador SDR", "mem_rafael", "ativo", "supervisionado", false),
    agent("agt_redator", "Redator de propostas", "mem_rafael", "ativo", "assistido", false),
    /**
     * Os três Agentes do processo comercial, e a autonomia de cada um segue o
     * ESTRAGO que ele pode causar:
     *
     * — Enriquecedor é `autonomo`: só lê fonte pública e grava Valor de Campo.
     *   Errar custa um resumo ruim, que o SDR corrige.
     * — Qualificador é `supervisionado`: ele FALA COM O LEAD. Toda Mensagem
     *   sai como Rascunho para um humano aprovar (B64).
     * — Classificador é `assistido`: ele não escreve nada; devolve um veredito
     *   que a Condição híbrida consome.
     */
    agent("agt_enriquecedor", "Enriquecedor de leads", "mem_julia", "ativo", "autonomo", false),
    agent("agt_classificador", "Classificador de conexão", "mem_julia", "ativo", "assistido", false),
  ];

  const skills: Skill[] = [
    skill("skl_qualificar", "Qualificar lead", "workspace", "publicada"),
    skill("skl_resumir", "Resumir contexto do Negócio", "workspace", "publicada"),
    skill("skl_proposta", "Redigir proposta comercial", "workspace", "publicada"),
    skill("skl_triagem", "Triagem de mensagem recebida", "plataforma", "publicada"),
    skill("skl_agenda", "Sugerir plano de estudo", "workspace", "rascunho"),
    skill("skl_followup", "Redigir follow-up", "workspace", "publicada"),
    skill("skl_analisar_perfil", "Analisar perfil público", "workspace", "publicada"),
    // A pergunta de permissão vive NAS INSTRUÇÕES desta Habilidade, não no
    // roteiro de quem usa: é ela que produz o evento que a Automação detecta.
    // Sem a pergunta, não há resposta, e sem resposta não há conexão para
    // confirmar.
    skill("skl_abordar_lead", "Abordar lead", "workspace", "publicada"),
    skill("skl_classificar_conexao", "Classificar conexão", "workspace", "publicada"),
  ];
  // Uma Habilidade com duas versões `publicada` coexistentes (B71).
  skills[2]?.versions.push({
    number: 2,
    state: "publicada",
    instructions: "Redigir proposta com o modelo de precificação por faixa de colaboradores.",
    inputContract: [{ name: "negocio", type: "referencia:deal", required: true, description: "Negócio de origem" }],
    outputContract: { structured: [], text: true },
    toolRequirements: [{ toolId: "ler_negocio", mandatory: true }],
    dependencies: [],
    recommendedCollectionIds: ["col_comercial"],
    publishedBy: "mem_rafael",
    createdAt: at(40),
    publishedAt: at(38),
  });

  const skillGrants: SkillGrant[] = [
    { id: "sgr_1", agentId: "agt_sdr", skillId: "skl_qualificar", grantedBy: "mem_rafael", grantedAt: at(90) },
    { id: "sgr_2", agentId: "agt_sdr", skillId: "skl_triagem", grantedBy: "mem_rafael", grantedAt: at(90) },
    { id: "sgr_3", agentId: "agt_sdr", skillId: "skl_resumir", grantedBy: "mem_rafael", grantedAt: at(60) },
    { id: "sgr_4", agentId: "agt_redator", skillId: "skl_proposta", pinnedVersion: 1, grantedBy: "mem_rafael", grantedAt: at(55) },
    { id: "sgr_5", agentId: "agt_redator", skillId: "skl_followup", grantedBy: "mem_rafael", grantedAt: at(55) },
    { id: "sgr_6", agentId: "agt_enriquecedor", skillId: "skl_analisar_perfil", grantedBy: "mem_julia", grantedAt: at(200) },
    { id: "sgr_7", agentId: "agt_sdr", skillId: "skl_abordar_lead", grantedBy: "mem_julia", grantedAt: at(200) },
    { id: "sgr_8", agentId: "agt_classificador", skillId: "skl_classificar_conexao", grantedBy: "mem_julia", grantedAt: at(200) },
  ];

  const automations: Automation[] = [
    automation("aut_boasvindas", "Boas-vindas na Fila Comercial", "queue", "fila_com", "mem_julia", "ativo", false),
    automation("aut_revisao", "Revisão mensal de playbooks", "list", "lst_revisoes", "mem_marcos", "pausado", false),
    automation("aut_rascunho", "Alerta de Automação com erro", "space", "spc_ops", "mem_marcos", "rascunho", false),
    ...processoComercial(),
  ];

  const collections: Collection[] = [
    collection("col_comercial", "Material comercial", "mem_rafael", false),
    collection("col_clinico", "Playbooks do comercial", "mem_thiago", false),
    collection("col_interno", "Interno, jurídico", "mem_thiago", true),
  ];

  const docSpecs: ReadonlyArray<readonly [Id, string, KnowledgeDocument["contentType"]]> = [
    ["col_comercial", "Apresentação institucional 2026", "pdf"],
    ["col_comercial", "Tabela de preços por faixa", "arquivoEstruturado"],
    ["col_comercial", "Casos de sucesso dos alunos", "texto"],
    ["col_comercial", "Roteiro de qualificação", "texto"],
    ["col_comercial", "Modelo de proposta", "texto"],
    ["col_comercial", "Comparativo com concorrentes", "texto"],
    ["col_clinico", "Proposta comercial, modelo base", "pdf"],
    ["col_clinico", "Planos e valores, modelo base", "pdf"],
    ["col_clinico", "Playbook de qualificação", "texto"],
    ["col_clinico", "Playbook de retomada", "texto"],
    ["col_clinico", "Janela de resposta, resumo comentado", "texto"],
    ["col_clinico", "Fluxo de campanha de captação", "texto"],
    ["col_interno", "Contrato padrão", "pdf"],
    ["col_interno", "Política de privacidade", "texto"],
    ["col_interno", "Termo de consentimento", "pdf"],
  ];

  // Uma Fonte `comErro` torna `desatualizado` o Documento que vem dela
  // (documento 20, 6.3). O Documento nasce já apontando para ela: a Fonte de um
  // Documento é referência obrigatória e imutável (INV-CNH-03).
  collections[1]?.sources.push({
    id: "src_col_clinico_url",
    kind: "url",
    name: "Documentação da API de Mensagens",
    config: "https://exemplo.com/api-de-mensagens",
    updatePolicy: { kind: "periodica", intervalHours: 168 },
    configuredByMemberId: "mem_thiago",
    state: "comErro",
    lastUpdateAt: at(30),
    lastUpdateResult: "Origem inacessível",
  });
  const URL_SOURCED_DOC_INDEX = 10;

  const documents: KnowledgeDocument[] = docSpecs.map(([collectionId, title, contentType], index) => ({
    id: `doc_${index + 1}`,
    workspaceId: WORKSPACE_ID,
    createdBy: member(index % 2 === 0 ? "mem_rafael" : "mem_thiago"),
    createdAt: at(150 - index * 8),
    lifecycle: "ativo" as const,
    collectionId,
    sourceId: index === URL_SOURCED_DOC_INDEX ? "src_col_clinico_url" : `src_${collectionId}_manual`,
    title,
    contentType,
    currentVersion: 1,
    versions: [
      {
        number: 1,
        content: { text: `Conteúdo de referência de “${title}”.` },
        derivedRepresentations: [],
        // 1 Documento com processamento `comErro`: existe, é visível e
        // comentável, e apenas não entra em Contexto (RN-CNH-20).
        processing: index === 5 ? ("comErro" as const) : ("processado" as const),
        origin: { kind: "envio" as const, by: member("mem_rafael"), at: at(150 - index * 8) },
        fragments: index === 5 ? [] : [{ id: `frg_${index + 1}`, position: { order: 0, locator: "1-1" }, derivedContent: `Trecho de ${title}.` }],
        createdAt: at(150 - index * 8),
      },
    ],
    metadata: { labels: index < 6 ? ["comercial"] : index < 12 ? ["entrega"] : ["jurídico"], language: "pt-BR" },
    provenance:
      index === URL_SOURCED_DOC_INDEX
        ? { kind: "template" as const, sourceId: "src_col_clinico_url", sourceName: "Documentação da API de Mensagens", at: at(150 - index * 8), sourceKind: "url", specificOrigin: "https://exemplo.com/api-de-mensagens" }
        : { kind: "template" as const, sourceId: `src_${collectionId}_manual`, sourceName: "Envio manual", at: at(150 - index * 8), sourceKind: "envioManual", specificOrigin: "texto digitado" },
    comments: [],
    attachments: [],
  }));

  // Pastas do Thiago: uma Sessão dentro de cada, uma solta — os três estados.
  const chatFolders: ChatFolder[] = [
    { id: "cfd_propostas", workspaceId: WORKSPACE_ID, ownerMemberId: "mem_thiago", name: "Propostas", createdAt: at(30) },
    { id: "cfd_processo", workspaceId: WORKSPACE_ID, ownerMemberId: "mem_thiago", name: "Processo comercial", createdAt: at(25) },
  ];

  const chatSessions: ChatSession[] = [
    { ...chat("cht_1", "mem_thiago", "Proposta Full Face Avançado", { type: "deal", id: "deal_fim_1", nameAtTheTime: "Full Face para Marina Alves" }, "agt_redator"), folderId: "cfd_propostas" },
    { ...chat("cht_2", "mem_thiago", "Revisar playbook de qualificação", { type: "task", id: "tsk_seed_1", nameAtTheTime: "Revisar playbook de qualificação" }, undefined), folderId: "cfd_processo" },
    chat("cht_6", "mem_thiago", "Objeções do plano Elite", { type: "deal", id: "deal_sdr_1", nameAtTheTime: "Full Face Avançado para Iallas" }, "agt_redator"),
    chat("cht_3", "mem_rafael", "Resumo da semana comercial", undefined, "agt_sdr"),
    chat("cht_4", "mem_julia", "Dúvida sobre janela de resposta", { type: "knowledgeDocument", id: "doc_11", nameAtTheTime: "Janela de resposta, resumo comentado" }, undefined),
    chat("cht_5", "mem_marcos", "Campanha de captação", undefined, undefined),
  ];

  const panels: Panel[] = [
    /*
     * Um Painel por papel, e não um Painel do comercial: o SDR entrega REUNIÃO
     * e o Closer entrega RECEITA. Misturar os dois num quadro só faz o número
     * de um justificar o do outro — que é exatamente o que o processo separa.
     */
    panel("pnl_sdr", "SDR", "mem_julia", { type: "funnel", id: "fnl_sdr", nameAtTheTime: "SDR" }, [
      widget("wg_sdr_funil", "Negócios por Etapa", "funil", "deal", "funnel", ["fnl_sdr"], [{ aggregation: "contagem", attribute: "id", label: "Negócios" }], [{ attribute: "stageId", label: "Etapa" }]),
      widget("wg_sdr_aberto", "Em prospecção agora", "numero", "deal", "funnel", ["fnl_sdr"], [{ aggregation: "contagem", attribute: "id", label: "Negócios" }], [], [{ attribute: "situation", operator: "igualA", value: "Aberto", label: "Situação: aberto" }]),
      widget("wg_sdr_origem", "Leads por Origem", "barras", "deal", "funnel", ["fnl_sdr"], [{ aggregation: "contagem", attribute: "id", label: "Leads" }], [{ attribute: "originId", label: "Origem" }]),
      widget("wg_sdr_perda", "Desqualificação por Motivo", "barras", "deal", "funnel", ["fnl_sdr"], [{ aggregation: "contagem", attribute: "id", label: "Negócios" }], [{ attribute: "lossReasonId", label: "Motivo de Perda" }]),
      widget("wg_sdr_dono", "Carteira por SDR", "barras", "deal", "funnel", ["fnl_sdr"], [{ aggregation: "contagem", attribute: "id", label: "Negócios" }], [{ attribute: "ownerMemberId", label: "Responsável" }]),
    ]),
    panel("pnl_closer", "Closer", "mem_rafael", { type: "funnel", id: "fnl_closer", nameAtTheTime: "Closer" }, [
      widget("wg_clo_funil", "Negócios por Etapa", "funil", "deal", "funnel", ["fnl_closer"], [{ aggregation: "contagem", attribute: "id", label: "Negócios" }], [{ attribute: "stageId", label: "Etapa" }]),
      widget("wg_clo_valor", "Valor em aberto", "numero", "deal", "funnel", ["fnl_closer"], [{ aggregation: "soma", attribute: "value", label: "Valor" }], []),
      widget("wg_clo_ganhos", "Ganhos por mês", "barras", "deal", "funnel", ["fnl_closer"], [{ aggregation: "soma", attribute: "value", label: "Valor ganho" }], [{ attribute: "closedAt", label: "Mês", timeGranularity: "mes" }]),
      widget("wg_clo_situacao", "Negócios por situação", "pizza", "deal", "funnel", ["fnl_closer"], [{ aggregation: "contagem", attribute: "id", label: "Negócios" }], [{ attribute: "situation", label: "Situação" }]),
      widget("wg_clo_perda", "Perdas por Motivo", "barras", "deal", "funnel", ["fnl_closer"], [{ aggregation: "contagem", attribute: "id", label: "Negócios" }], [{ attribute: "lossReasonId", label: "Motivo de Perda" }]),
    ]),
    panel("pnl_atend", "Atendimento", "mem_julia", { type: "queue", id: "fila_com", nameAtTheTime: "Comercial" }, [
      widget("wg_4", "Conversas por estado", "pizza", "conversation", "queue", ["fila_com"], [{ aggregation: "contagem", attribute: "id", label: "Conversas" }], [{ attribute: "state", label: "Estado de conversa" }]),
      widget("wg_5", "Sem Atribuído", "numero", "conversation", "inbox", ["inbox_n1"], [{ aggregation: "contagem", attribute: "id", label: "Conversas" }], []),
    ]),
    panel("pnl_ops", "Operações", "mem_marcos", { type: "space", id: "spc_ops", nameAtTheTime: "Entrega" }, [
      widget("wg_6", "Tarefas por categoria", "barras", "task", "space", ["spc_ops"], [{ aggregation: "contagem", attribute: "id", label: "Tarefas" }], [{ attribute: "statusCategory", label: "Categoria" }]),
      widget("wg_7", "Vencidas", "numero", "task", "space", ["spc_ops"], [{ aggregation: "contagem", attribute: "overdue", label: "Vencidas" }], []),
      widget("wg_8", "Carga por Responsável (min)", "barras", "task", "space", ["spc_ops"], [{ aggregation: "soma", attribute: "estimate", label: "Minutos estimados" }], [{ attribute: "assigneeMemberId", label: "Responsável" }], [{ attribute: "statusCategory", operator: "diferenteDe", value: "concluido", label: "Não concluídas" }, { attribute: "statusCategory", operator: "diferenteDe", value: "fechado", label: "Não fechadas" }]),
    ]),
  ];

  const state: DataState = {
    models: [
      { id: "mdl_base", name: "Modelo base", capabilities: { inputs: ["texto", "imagem", "documento"], outputs: ["texto"] }, discontinued: false },
      { id: "mdl_rapido", name: "Modelo rápido", capabilities: { inputs: ["texto"], outputs: ["texto"] }, discontinued: false },
      { id: "mdl_legado", name: "Modelo legado", capabilities: { inputs: ["texto"], outputs: ["texto"] }, discontinued: true },
    ],
    tools: TOOLS,
    workspace: buildWorkspace(),
    members,
    teams,
    roles,
    integrations: [
      { id: "int_erp", workspaceId: WORKSPACE_ID, name: "ERP financeiro", systemType: "erp", state: "conectada", configuredBy: "mem_rafael", createdBy: member("mem_rafael"), createdAt: at(200), exposedTools: ["erp_consultar_fatura"] },
    ],
    grants: [
      { id: "gr_beatriz", workspaceId: WORKSPACE_ID, subjectKind: "member", subjectId: "mem_beatriz", action: "ver", resourceType: "list", resourceId: "lst_conteudo", scope: "subarvore", origin: "compartilhamento", grantedBy: "mem_thiago", grantedAt: at(30) },
      { id: "gr_mkt_camila", workspaceId: WORKSPACE_ID, subjectKind: "member", subjectId: "mem_thiago", action: "administrar", resourceType: "space", resourceId: "spc_mkt", scope: "subarvore", origin: "concessaoDireta", grantedBy: "mem_thiago", grantedAt: at(200) },
    ],
    templates: TEMPLATES,
    catalog,
    tags,
    files: [],
    fieldDefinitions,
    taskTypes,
    views: [],
    goals: [],
    // Fase 4 — um Formulário de demonstração: /f/demo-formulario
    forms: [
      {
        id: "frm_demo",
        workspaceId: WORKSPACE_ID,
        createdBy: member("mem_thiago"),
        createdAt: at(5),
        lifecycle: "ativo",
        listId: "lst_prospeccao",
        name: "Pedido de contato",
        description: "Conte o que você precisa e a equipe comercial retorna.",
        ownerMemberId: "mem_thiago",
        questions: [
          { id: "fqs_demo_1", label: "Assunto", required: true, target: { kind: "title" } },
          { id: "fqs_demo_2", label: "Detalhes", required: false, target: { kind: "description" } },
        ],
        enabled: true,
        secret: "demo-formulario",
        submissions: 3,
      },
    ],
    spaces,
    folders,
    lists,
    tasks: buildTasks(),
    contacts,
    companies,
    deals,
    funnels,
    contactCompanyLinks,
    companyCompanyLinks: [{ id: "ccl_1", fromCompanyId: "cmp_4", toCompanyId: "cmp_7", kind: "parceira", createdAt: at(120) }],
    distinctFromLinks: [{ id: "dfl_1", contactAId: "cnt_11", contactBId: "cnt_23", createdBy: member("mem_julia"), createdAt: at(45) }],
    inbox: { id: "inbox_n1", workspaceId: WORKSPACE_ID, reopenWindowHours: 72, defaultDistribution: "manual", defaultContactOwnerMemberId: "mem_julia" },
    channels,
    queues,
    conversations,
    chatFolders,
    chatSessions,
    agents,
    agentExecutions: buildExecutions(),
    skills,
    skillGrants,
    automations,
    automationExecutions: [],
    approvals: buildApprovals(),
    collections,
    collectionGrants: [
      { id: "cgr_1", collectionId: "col_comercial", agentId: "agt_redator", actions: ["ver"], grantedBy: "mem_rafael", grantedAt: at(55) },
      { id: "cgr_2", collectionId: "col_comercial", agentId: "agt_sdr", actions: ["ver"], grantedBy: "mem_rafael", grantedAt: at(90) },
      { id: "cgr_3", collectionId: "col_clinico", agentId: "agt_padrao", actions: ["ver"], grantedBy: "mem_thiago", grantedAt: at(120) },
    ],
    documents,
    panels,
    links: [
      { id: "lnk_1", fromType: "task", fromId: "tsk_seed_1", toType: "deal", toId: "deal_fim_1", createdBy: member("mem_thiago"), createdAt: at(10) },
      { id: "lnk_2", fromType: "conversation", fromId: "cnv_1", toType: "deal", toId: "deal_fim_1", createdBy: member("mem_julia"), createdAt: at(5) },
      { id: "lnk_3", fromType: "task", fromId: "tsk_seed_3", toType: "contact", toId: "cnt_2", createdBy: member("mem_julia"), createdAt: at(8) },
      { id: "lnk_call", fromType: "task", fromId: "tsk_call_ref", toType: "deal", toId: "deal_sdr_1", role: "reunião", createdBy: member("mem_thiago"), createdAt: at(0, 10) },
    ],
    activity: [],
  };

  seedActivity(state);
  // Processo do Financeiro (docs/07-processos/contas-a-pagar.md): depois da
  // Atividade genérica, porque traz o próprio histórico de Status.
  applyContasAPagar(state, { at, day, workspaceId: WORKSPACE_ID });
  applyContasAReceber(state, { at, workspaceId: WORKSPACE_ID });
  // Processo comercial na Estrutura: Comercial › Caixa de entrada › um Kanban por Funil.
  applyEspelhoComercial(state, { at, workspaceId: WORKSPACE_ID });
  return state;
}

// ── construtores auxiliares ────────────────────────────────────────────────

function buildWorkspace(): Workspace {
  return {
    id: WORKSPACE_ID,
    name: "Instituto Transformando Faces",
    state: "ativo",
    ownerMemberId: "mem_thiago",
    createdBy: "mem_thiago",
    createdAt: at(400),
    locale: { timezone: "America/Sao_Paulo", currency: "BRL", language: "pt-BR" },
    trashPolicy: { retentionDays: 30 },
    maxSubtaskDepth: 3,
    taskReadableId: { enabled: true, prefix: "OPS", next: 1080 },
    dealReadableId: { enabled: true, prefix: "NEG", next: 1025 },
    limits: {
      members: 25,
      spaces: 10,
      contacts: 5000,
      agents: 10,
      tasksPerList: 500,
      subtaskDepthCeiling: 5,
      executionChainDepth: 5,
      agentToAgentDepth: 3,
      operationsPerExecution: 50,
      approvalTimeoutHoursCeiling: 168,
      widgetsPerPanel: 20,
    },
    defaultAgentId: "agt_padrao",
    defaultFunnelId: "fnl_sdr",
    suspensions: [],
  };
}

const cat = (id: Id, kind: CatalogItem["kind"], name: string, order: number, color?: string): CatalogItem => ({
  id,
  workspaceId: WORKSPACE_ID,
  kind,
  name,
  ...(color ? { color } : {}),
  order,
  lifecycle: "ativo",
});

const tag = (id: Id, name: string, color: string): Tag => ({
  id,
  workspaceId: WORKSPACE_ID,
  name,
  color,
  lifecycle: "ativo",
});

const space = (
  id: Id,
  name: string,
  description: string,
  color: string,
  order: number,
  statusSet: StatusSet,
  isPrivate: boolean,
): Space => ({
  id,
  workspaceId: WORKSPACE_ID,
  createdBy: member("mem_thiago"),
  createdAt: at(390),
  lifecycle: "ativo",
  name,
  description,
  color,
  order,
  isPrivate,
  modes: {},
  blocks: {},
  statusSet,
});

const folder = (id: Id, name: string, parentType: "space" | "folder", parentId: Id, order: number): Folder => ({
  id,
  workspaceId: WORKSPACE_ID,
  createdBy: member("mem_rafael"),
  createdAt: at(370),
  lifecycle: "ativo",
  name,
  order,
  isPrivate: false,
  modes: {},
  blocks: {},
  parentType,
  parentId,
});

const list = (id: Id, name: string, parentType: "space" | "folder", parentId: Id, order: number): List => ({
  id,
  workspaceId: WORKSPACE_ID,
  createdBy: member("mem_rafael"),
  createdAt: at(360),
  lifecycle: "ativo",
  name,
  order,
  isPrivate: false,
  modes: {},
  blocks: {},
  parentType,
  parentId,
});

const fd = (
  id: Id,
  name: string,
  type: FieldDefinition["type"],
  target: FieldDefinition["target"],
  definedAtType: FieldDefinition["definedAtType"],
  definedAtId: Id | undefined,
  required: boolean,
  options?: readonly string[],
  description?: string,
): FieldDefinition => ({
  id,
  workspaceId: WORKSPACE_ID,
  name,
  ...(description ? { description } : {}),
  type,
  ...(options ? { options } : {}),
  required,
  target,
  ...(definedAtType ? { definedAtType } : {}),
  ...(definedAtId ? { definedAtId } : {}),
  lifecycle: "ativo",
});

const channel = (
  id: Id,
  name: string,
  channelType: Channel["channelType"],
  externalId: string,
  connection: Channel["connection"],
  defaultQueueId: Id,
): Channel => ({
  id,
  workspaceId: WORKSPACE_ID,
  createdBy: member("mem_thiago"),
  createdAt: at(350),
  lifecycle: "ativo",
  name,
  channelType,
  externalId,
  connection,
  configuredByMemberId: "mem_thiago",
  defaultQueueId,
  defaultContactOwnerMemberId: "mem_julia",
  defaultOriginId: "cat_org_wpp",
  messageTemplates: [],
  groupsEnabled: false,
});

/** O Identificador que cada Canal exige do Contato (documento 14, 7.1). */
const IDENTIFIER_OF_CHANNEL: Partial<Record<ChannelType, ContactIdentifierType>> = {
  whatsapp: "identidadeDeWhatsApp",
  instagram: "usuarioDeInstagram",
  email: "email",
  chatDoSite: "identificadorDeChatDoSite",
};

function msg(
  conversationId: Id,
  direction: Message["direction"],
  actor: ActorRef,
  content: string,
  createdAt: string,
  deliveryStatus?: Message["deliveryStatus"],
): Message {
  return {
    id: nextId("msg"),
    conversationId,
    direction,
    actor,
    content,
    attachments: [],
    ...(direction === "enviada" ? { deliveryStatus: deliveryStatus ?? "entregue" } : {}),
    internalReads: [],
    reactions: [],
    externalEdits: [],
    createdAt,
  };
}

function agent(
  id: Id,
  name: string,
  ownerMemberId: Id,
  lifecycle: Agent["lifecycle"],
  autonomy: "assistido" | "supervisionado" | "autonomo",
  isDefault: boolean,
): Agent {
  const tools = isDefault
    ? ["ler_tarefa", "ler_negocio", "ler_contato", "consultar_conhecimento", "lembrar"]
    : name === "Qualificador SDR"
      ? ["ler_contato", "ler_conversa", "sugerir_resposta", "atualizar_qualificacao", "consultar_conhecimento"]
      : ["ler_negocio", "ler_contato", "consultar_conhecimento", "enviar_mensagem"];
  return {
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: isDefault ? SYSTEM : member(ownerMemberId),
    createdAt: at(380),
    lifecycle,
    name,
    description: isDefault
      ? "Agente instanciado com o Espaço de Trabalho; responde quando nenhum outro é escolhido."
      : name === "Qualificador SDR"
        ? "Qualifica leads da Fila Comercial e propõe o próximo passo."
        : "Redige propostas comerciais a partir do Negócio e do material de referência.",
    ownerMemberId,
    roleId: isDefault ? "role_conv" : "role_agente_crm",
    versions: [
      {
        number: 1,
        objective: isDefault
          ? "Ajudar Membros do Espaço de Trabalho."
          : name === "Qualificador SDR"
            ? "Qualificar leads e propor o próximo passo."
            : "Redigir propostas comerciais fiéis ao material aprovado.",
        instructions: "Responda em português do Brasil, de forma direta. Nunca invente dados de Contato, Empresa ou Negócio.",
        modelId: isDefault ? "padraoDaPlataforma" : "mdl_base",
        allowsModelOverride: isDefault,
        allowedToolIds: tools,
        grantedSkillIds: [],
        autonomy,
        approvalPolicy: { approverMemberIds: [ownerMemberId], approverTeamIds: [], timeoutHours: 72 },
        memoryEnabled: true,
        by: isDefault ? SYSTEM : member(ownerMemberId),
        at: at(380),
      },
    ],
    memory: [],
    memoryRetention: { maxItems: 200, maxDays: 180, keepDelegated: true },
  };
}

function skill(id: Id, name: string, ownership: "workspace" | "plataforma", state: "publicada" | "rascunho"): Skill {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: ownership === "plataforma" ? SYSTEM : member("mem_rafael"),
    createdAt: at(120),
    lifecycle: "ativo",
    name,
    description: `Competência reutilizável: ${name.toLowerCase()}.`,
    ownership,
    versions: [
      {
        number: 1,
        state,
        instructions: `Passos para ${name.toLowerCase()}, respeitando o material aprovado.`,
        inputContract: [{ name: "contexto", type: "texto", required: true, description: "Contexto de entrada" }],
        outputContract: { structured: [], text: true },
        toolRequirements: [{ toolId: "consultar_conhecimento", mandatory: false }],
        dependencies: [],
        recommendedCollectionIds: [],
        ...(state === "publicada" ? { publishedBy: "mem_rafael", publishedAt: at(110) } : {}),
        createdAt: at(120),
      },
    ],
  };
}

function automation(
  id: Id,
  name: string,
  scopeType: Automation["scopeType"],
  scopeId: Id,
  ownerMemberId: Id,
  lifecycle: Automation["lifecycle"],
  hybrid: boolean,
): Automation {
  const published = lifecycle !== "rascunho";
  const eventType = scopeType === "funnel" ? "negocioEntrouEmEtapa" : scopeType === "queue" ? "conversaCriada" : "tarefaCriada";
  return {
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: member(ownerMemberId),
    createdAt: at(100),
    lifecycle,
    name,
    description: "",
    scopeType,
    scopeId,
    ownerMemberId,
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: published ? "publicada" : "rascunho",
        trigger: { kind: "evento", eventType },
        conditions: hybrid
          ? [{ kind: "hibrida", expression: "classificar intenção", agentId: "agt_sdr", skillId: "skl_resumir" }]
          : [{ kind: "atributo", expression: "etapa = Proposta" }],
        actions: [
          ...(hybrid
            ? [{ order: 0, kind: "controle" as const, controlKind: "invocarAgente" as const, params: "resumir o Negócio", agentId: "agt_sdr", skillId: "skl_resumir", maxAutonomy: "supervisionado" as const, approverMemberId: ownerMemberId, timeoutHours: 24 }]
            : []),
          { order: hybrid ? 1 : 0, kind: "escrita" as const, toolId: "criar_tarefa", params: "Criar Tarefa de acompanhamento", targetExpression: "lst_funil_sdr" },
        ],
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        ...(published ? { publishedBy: ownerMemberId, publishedAt: at(95) } : {}),
        createdAt: at(100),
      },
    ],
  };
}

function collection(id: Id, name: string, ownerMemberId: Id, isPrivate: boolean): Collection {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: member(ownerMemberId),
    createdAt: at(160),
    lifecycle: "ativo",
    name,
    description: "",
    ownerMemberId,
    isPrivate,
    sources: [{ id: `src_${id}_manual`, kind: "envioManual", name: "Envio manual", state: "ativo" }],
    versionRetention: { maxSuperseded: 5, maxDays: 365 },
  };
}

function chat(
  id: Id,
  ownerMemberId: Id,
  title: string,
  anchor: ChatSession["anchor"],
  mainAgentId: Id | undefined,
): ChatSession {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: member(ownerMemberId),
    createdAt: at(12),
    lifecycle: "ativo",
    ownerMemberId,
    title,
    titleEdited: false,
    ...(anchor ? { anchor } : {}),
    ...(mainAgentId ? { mainAgentId } : {}),
    toolRestriction: { toolIds: [], effectClasses: [] },
    messages: [],
    sharedWithMemberIds: [],
    sharedWithTeamIds: [],
  };
}

function panel(id: Id, name: string, ownerMemberId: Id, anchor: Panel["anchor"], widgets: Panel["widgets"]): Panel {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: member(ownerMemberId),
    createdAt: at(80),
    lifecycle: "ativo",
    name,
    description: "",
    ownerMemberId,
    ...(anchor ? { anchor } : {}),
    widgets,
    layout: widgets.map((w, index) => ({ widgetId: w.id, x: (index % 2) * 6, y: Math.floor(index / 2) * 4, w: 6, h: 4 })),
  };
}

type Widget = Panel["widgets"][number];

function widget(
  id: Id,
  title: string,
  viewType: Widget["viewType"],
  target: NonNullable<Widget["dataSource"]>["target"],
  scopeType: NonNullable<Widget["dataSource"]>["scopeType"],
  scopeIds: Id[],
  metrics: Widget["metrics"],
  dimensions: Widget["dimensions"],
  fixedFilters: Widget["fixedFilters"] = [],
): Widget {
  return {
    id,
    title,
    viewType,
    dataSource: {
      target,
      scopeType,
      scopeIds,
      includeSubtasks: false,
      // B106 — the default is false, except for Deal.
      includeArchived: target === "deal",
      includeRehearsals: false,
    },
    metrics,
    dimensions,
    fixedFilters,
  };
}

const TOOLS = [
  tool("ler_tarefa", "Ler Tarefa", "task", "ver", "leitura"),
  tool("criar_tarefa", "Criar Tarefa", "list", "criar", "escritaReversivel"),
  tool("ler_contato", "Ler Contato", "contact", "ver", "leitura"),
  tool("ler_negocio", "Ler Negócio", "deal", "ver", "leitura"),
  tool("ler_conversa", "Ler Conversa", "conversation", "ver", "leitura"),
  tool("enviar_mensagem", "Enviar Mensagem", "conversation", "editar", "externa"),
  tool("sugerir_resposta", "Sugerir resposta", "conversation", "ver", "leitura"),
  tool("consultar_conhecimento", "Consultar Conhecimento", "collection", "ver", "leitura"),
  tool("adicionar_ao_conhecimento", "Adicionar ao Conhecimento", "collection", "criar", "escritaReversivel"),
  tool("atualizar_qualificacao", "Atualizar Qualificação de Contato", "contact", "editar", "escritaReversivel"),
  tool("mesclar_contatos", "Mesclar Contatos", "contact", "administrar", "escritaIrreversivel"),
  tool("marcar_negocio_ganho", "Marcar Negócio como ganho", "deal", "editar", "escritaIrreversivel"),
  tool("invocar_agente", "Invocar Agente", "agent", "executar", "escritaReversivel"),
  tool("acionar_automacao", "Acionar Automação", "automation", "executar", "escritaReversivel"),
  tool("erp_consultar_fatura", "Consultar fatura no ERP", "company", "ver", "leitura"),
  tool("lembrar", "Lembrar", "member", "editar", "escritaReversivel"),
  tool("ler_painel", "Ler Painel", "panel", "ver", "leitura"),
  tool("criar_comentario", "Criar Comentário", "task", "comentar", "escritaReversivel"),
  tool("alterar_status", "Alterar Status de Tarefa", "task", "editar", "escritaReversivel"),
  tool("omie_lancar_conta_a_pagar", "Lançar conta a pagar no Omie", "task", "editar", "externa"),
];

function tool(
  id: string,
  name: string,
  targetResourceType: string,
  requiredAction: "ver" | "criar" | "editar" | "excluir" | "administrar" | "executar" | "comentar",
  effectClass: "leitura" | "escritaReversivel" | "escritaIrreversivel" | "externa",
) {
  return { id, name, origin: "plataforma" as const, targetResourceType, requiredAction, effectClass, description: name };
}

const TEMPLATES: Template[] = [
  { id: "tpl_espaco", workspaceId: WORKSPACE_ID, kind: "espaco", name: "Espaço de cliente", body: "Pastas: Ativação, Renovação", creates: { folders: ["Ativação", "Renovação"] }, createdBy: member("mem_thiago"), createdAt: at(200), lifecycle: "ativo" },
  { id: "tpl_pasta", workspaceId: WORKSPACE_ID, kind: "pasta", name: "Pasta da turma", body: "Listas: Kickoff, Execução", creates: { lists: ["Kickoff", "Execução"] }, containsSubfolders: false, createdBy: member("mem_thiago"), createdAt: at(200), lifecycle: "ativo" },
  { id: "tpl_lista", workspaceId: WORKSPACE_ID, kind: "lista", name: "Lista da turma", body: "Tarefas padrão da turma", creates: {}, createdBy: member("mem_rafael"), createdAt: at(190), lifecycle: "ativo" },
  {
    id: "tpl_tarefa",
    workspaceId: WORKSPACE_ID,
    kind: "tarefa",
    name: "Visita técnica",
    body: "Checklist: Agendar, Confirmar, Registrar",
    creates: {
      task: {
        title: "Visita técnica",
        description: "Visita ao cliente para levantamento e registro.",
        priority: "normal",
        checklists: [{ name: "Roteiro", items: ["Agendar", "Confirmar", "Registrar"] }],
        subtasks: ["Preparar material", "Enviar relatório"],
      },
    },
    createdBy: member("mem_marcos"),
    createdAt: at(180),
    lifecycle: "ativo",
  },
  { id: "tpl_checklist", workspaceId: WORKSPACE_ID, kind: "checklist", name: "Abertura de campanha", body: "Conferir estoque; Solicitar folhetos; Confirmar equipe", createdBy: member("mem_marcos"), createdAt: at(180), lifecycle: "ativo" },
  { id: "tpl_agente", workspaceId: WORKSPACE_ID, kind: "agente", name: "SDR base", body: "Objetivo e instruções do Qualificador SDR", createdBy: member("mem_rafael"), createdAt: at(170), lifecycle: "ativo" },
];

function buildTasks(): Task[] {
  const tasks: Task[] = [];

  const base = (
    id: Id,
    listId: Id,
    title: string,
    statusId: Id,
    typeId: Id,
    daysAgo: number,
    assignees: ActorRef[],
    extra: Partial<Task> = {},
  ): Task => ({
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: member("mem_thiago"),
    createdAt: at(daysAgo),
    lifecycle: "ativo",
    listId,
    siblingOrder: 0,
    readableId: `OPS-${1000 + tasks.length}`,
    title,
    description: "",
    statusId,
    taskTypeId: typeId,
    priority: "normal",
    assignees,
    observerMemberIds: [],
    tagIds: [],
    fieldValues: [],
    checklists: [],
    timeEntries: [],
    dependencies: [],
    attachments: [],
    comments: [],
    updatedAt: at(daysAgo),
    ...extra,
  });

  // Tarefa vencida do fluxo 1, na Lista com "exigir Checklists concluídos".
  tasks.push(
    base("tsk_seed_1", "lst_revisoes", "Revisar playbook de qualificação", "st_ops_and", "tt_tarefa_ops", 20, [member("mem_thiago")], {
      priority: "alta",
      dueDate: { form: "civilDay", value: day(-3) },
      // Fase 4 — um link público de demonstração: /p/demo-tarefa
      publicShare: { secret: "demo-tarefa", active: true, createdBy: "mem_thiago", createdAt: at(2), showsComments: false, showsAttachments: true },
      checklists: [
        {
          id: "chk_seed_1",
          name: "Revisão",
          order: 0,
          items: [
            { id: "cki_1", text: "Conferir gatilhos por Etapa do Funil", order: 0, done: true, doneAt: at(4), doneBy: member("mem_thiago") },
            { id: "cki_2", text: "Validar com o responsável pela conta", order: 1, done: false },
            { id: "cki_3", text: "Publicar no Conhecimento", order: 2, done: false },
          ],
          createdBy: member("mem_thiago"),
          createdAt: at(20),
        },
      ],
      fieldValues: [{ definitionId: "fd_turma", value: "Turma de outubro", state: "ativo" }],
      comments: [
        { id: "cmt_1", author: member("mem_marcos"), content: "O gatilho de retomada mudou para a Etapa Conexão.", attachments: [], mentions: [], createdAt: at(3) },
        { id: "cmt_2", author: agentRef("agt_padrao"), authorDelegate: member("mem_thiago"), content: "Segundo o playbook publicado, a retomada passou de 3 para 2 dias.", attachments: [], mentions: [], createdAt: at(2) },
      ],
      timeEntries: [{ id: "tme_1", memberId: "mem_thiago", start: at(4, 9), end: at(4, 11), durationMinutes: 120, createdBy: member("mem_thiago") }],
    }),
  );
  tasks.push(base("tsk_seed_2", "lst_revisoes", "Atualizar playbook de retomada", "st_ops_fazer", "tt_tarefa_ops", 15, [member("mem_marcos")], { dueDate: { form: "civilDay", value: day(6) } }));
  tasks.push(
    base("tsk_seed_3", "lst_ativacao", "Preparar kickoff Metalúrgica Sul", "st_atv_kick", "tt_tarefa_com", 12, [member("mem_thiago"), agentRef("agt_sdr")], {
      priority: "urgente",
      dueDate: { form: "instant", value: at(-1, 15) },
      // A outra ponta de dep_1: a Dependência vive nas duas Tarefas.
      dependencies: [{ id: "dep_1b", kind: "bloqueia", taskId: "tsk_seed_4" }],
      tagIds: ["tag_urgente"],
      timeEntries: [{ id: "tme_2", memberId: "mem_marcos", start: at(2, 14), end: at(2, 16), durationMinutes: 120, createdBy: member("mem_marcos") }],
    }),
  );
  tasks.push(
    base("tsk_seed_4", "lst_ativacao", "Enviar cronograma da turma", "st_atv_novo", "tt_tarefa_com", 10, [member("mem_julia")], {
      dueDate: { form: "civilDay", value: day(2) },
      // Dependência sem ciclo, nunca entre ancestral e descendente (RN-TAR-16).
      dependencies: [{ id: "dep_1", kind: "eBloqueadaPor", taskId: "tsk_seed_3" }],
    }),
  );
  tasks.push(base("tsk_seed_5", "lst_propostas", "Revisar proposta do Elite", "st_com_rev", "tt_tarefa_com", 8, [member("mem_rafael")], { dueDate: { form: "civilDay", value: day(1) } }));

  // Subtarefas até 3 níveis (B1).
  tasks.push(base("tsk_seed_6", "lst_ativacao", "Definir itinerário das unidades", "st_atv_kick", "tt_tarefa_com", 11, [member("mem_marcos")], { parentTaskId: "tsk_seed_3", rootTaskId: "tsk_seed_3" }));
  tasks.push(base("tsk_seed_7", "lst_ativacao", "Confirmar sala em Guarulhos", "st_atv_novo", "tt_tarefa_com", 11, [member("mem_marcos")], { parentTaskId: "tsk_seed_6", rootTaskId: "tsk_seed_3" }));
  tasks.push(base("tsk_seed_8", "lst_ativacao", "Reservar equipamento portátil", "st_atv_novo", "tt_tarefa_com", 11, [], { parentTaskId: "tsk_seed_7", rootTaskId: "tsk_seed_3" }));

  // Uma Tarefa recorrente (B6).
  tasks.push(
    base("tsk_seed_9", "lst_revisoes", "Conferência mensal de laudos", "st_ops_fazer", "tt_tarefa_ops", 30, [member("mem_marcos")], {
      recurrence: { frequency: "mensal", interval: 1, triggerMode: "porCalendario", whenStillOpen: "gerarMesmoAssim", copies: { checklists: true, subtasks: false, assignees: true, fieldValues: false } },
      dueDate: { form: "civilDay", value: day(9) },
    }),
  );
  // Uma `arquivada` e duas `na lixeira`, com o estado anterior gravado (B43).
  tasks.push(base("tsk_seed_10", "lst_prospeccao", "Campanha de prospecção Q2", "st_com_entregue", "tt_tarefa_com", 90, [], { lifecycle: "arquivado", archivedAt: at(60) }));
  // A agenda do dia: Tarefas de Tipo Reunião, com data COM HORA.
  // Ancoradas na BASE, como todo o resto do seed. `Date.now()` aqui quebra a
  // hidratação: o seed é construído uma vez no servidor e outra no navegador, e
  // dois relógios diferentes geram dois horários diferentes para o mesmo texto.
  tasks.push(base("tsk_reuniao_1", "lst_prospeccao", "Reunião com Marina Alves", "st_com_exec", "tt_reuniao_com", 3, [member("mem_thiago")], {
    dueDate: { form: "instant", value: at(0, 9) },
    estimate: 30,
  }));
  /*
   * A call do Negócio de referência, já em andamento: é a tela que o Closer
   * usa enquanto fala com o lead. Ela é uma Tarefa de Tipo Reunião ligada ao
   * Negócio por Vínculo, porque Reunião não é entidade própria (D8).
   */
  tasks.push(base("tsk_call_ref", "lst_propostas", "Call do Full Face com Iallas", "st_com_exec", "tt_reuniao_com", 1, [member("mem_thiago")], {
    dueDate: { form: "instant", value: at(0, 10) },
    estimate: 40,
    timeEntries: [
      {
        id: "tme_call_ref",
        memberId: "mem_thiago",
        start: at(0, 10),
        description: "Reunião",
        createdBy: member("mem_thiago"),
      },
    ],
  }));
  tasks.push(base("tsk_reuniao_2", "lst_ativacao", "Kickoff Metalúrgica Sul", "st_com_novo", "tt_reuniao_com", 3, [member("mem_thiago")], {
    dueDate: { form: "instant", value: at(0, 12) },
    estimate: 60,
  }));
  tasks.push(base("tsk_reuniao_3", "lst_revisoes", "Alinhamento da turma", "st_ops_and", "tt_reuniao_ops", 3, [member("mem_thiago")], {
    dueDate: { form: "instant", value: at(0, 15) },
    estimate: 60,
  }));

  tasks.push(base("tsk_seed_11", "lst_prospeccao", "Lista fria para importar", "st_com_novo", "tt_tarefa_com", 25, [], { lifecycle: "naLixeira", lifecycleBeforeTrash: "ativo", trashedAt: at(5) }));
  tasks.push(base("tsk_seed_12", "lst_prospeccao", "Teste de importação", "st_com_novo", "tt_tarefa_com", 24, [], { lifecycle: "naLixeira", lifecycleBeforeTrash: "arquivado", trashedAt: at(4) }));
  // Foram à lixeira NA CASCATA da Lista: mesmo `trashedAt` que ela.
  tasks.push(base("tsk_seed_13", "lst_piloto", "Definir roteiro do piloto", "st_com_novo", "tt_tarefa_com", 23, [], { lifecycle: "naLixeira", lifecycleBeforeTrash: "ativo", trashedAt: at(6) }));
  tasks.push(base("tsk_seed_14", "lst_piloto", "Convidar os dois primeiros clientes", "st_com_novo", "tt_tarefa_com", 22, [], { lifecycle: "naLixeira", lifecycleBeforeTrash: "ativo", trashedAt: at(6) }));
  // Já estava na lixeira ANTES da Lista: restaurar a Lista não a traz de volta.
  tasks.push(base("tsk_seed_15", "lst_piloto", "Rascunho descartado do roteiro", "st_com_novo", "tt_tarefa_com", 21, [], { lifecycle: "naLixeira", lifecycleBeforeTrash: "ativo", trashedAt: at(9) }));

  // Volume: completa até ~60 Tarefas distribuídas nas Listas operacionais.
  const fillers: ReadonlyArray<readonly [Id, Id, Id, string]> = [
    ["lst_ativacao", "st_atv_exec", "tt_tarefa_com", "Ativação"],
    ["lst_renovacao", "st_com_novo", "tt_tarefa_com", "Renovação"],
    ["lst_propostas", "st_com_exec", "tt_tarefa_com", "Proposta"],
    ["lst_prospeccao", "st_com_novo", "tt_tarefa_com", "Prospecção"],
    ["lst_revisoes", "st_ops_and", "tt_tarefa_ops", "Revisão"],
    ["lst_conteudo", "st_mkt_prod", "tt_tarefa_mkt", "Conteúdo"],
    ["lst_indicadores", "st_com_exec", "tt_tarefa_com", "Indicador"],
  ];
  // 13, 14 e 15 são as três Tarefas na lixeira logo acima; começar aqui em 13
  // gerava três ids repetidos, e `find` por id resolvia para a primeira.
  let counter = 16;
  for (let round = 0; round < 7 && counter <= 60; round += 1) {
    for (const [listId, statusId, typeId, label] of fillers) {
      if (counter > 60) break;
      const company = COMPANY_NAMES[counter % 12]?.[0] ?? "cliente";
      tasks.push(
        base(`tsk_seed_${counter}`, listId, `${label} para ${company}`, statusId, typeId, 40 - (counter % 30), counter % 3 === 0 ? [member("mem_marcos")] : counter % 3 === 1 ? [member("mem_julia")] : [], {
          priority: counter % 9 === 0 ? "alta" : "normal",
          // Metade com datas e estimativa: é o que a Linha do tempo e a Carga leem.
          ...(counter % 2 === 0
            ? { startDate: { form: "civilDay" as const, value: day((counter % 14) - 8) }, dueDate: { form: "civilDay" as const, value: day((counter % 14) - 5 + (counter % 5)) } }
            : {}),
          ...(counter % 3 !== 2 ? { estimate: 60 * (1 + (counter % 6)) } : {}),
          siblingOrder: round,
        }),
      );
      counter += 1;
    }
  }
  return tasks;
}

function buildExecutions(): AgentExecution[] {
  const chain = { depth: 0, visitedAgentIds: [], visitedAutomationObjects: [] };
  const emptyContext = { readRecordIds: [], fragmentRefs: [], memoryItemIds: [], chatMessageIds: [] };
  return [
    {
      id: "exe_1",
      workspaceId: WORKSPACE_ID,
      agentId: "agt_sdr",
      agentVersion: 1,
      state: "concluida",
      // RN-CXE-23 — invoked by the inbox, WITHOUT a delegate.
      origin: "caixaDeEntrada",
      invokedBy: SYSTEM,
      chain,
      modelId: "mdl_base",
      effectiveAutonomy: "supervisionado",
      rehearsal: false,
      input: "Mensagem recebida de Marina Alves",
      steps: [
        { index: 0, kind: "ferramenta", toolId: "ler_conversa", toolAllowed: true, resourcePermitted: true, effectClass: "leitura", result: "concluido", at: at(0, 10) },
        { index: 1, kind: "ferramenta", toolId: "sugerir_resposta", toolAllowed: true, resourcePermitted: true, effectClass: "leitura", result: "concluido", at: at(0, 10) },
      ],
      output: "Rascunho de resposta gerado.",
      contextComposition: emptyContext,
      knowledgeReferences: [{ documentId: "doc_5", documentTitle: "Modelo de proposta", version: 1, fragmentIds: ["frg_5"], collectionId: "col_comercial", collectionName: "Material comercial" }],
      cost: { modelUnits: 820, toolCalls: 2, childExecutions: 0, durationMs: 3400 },
      startedAt: at(0, 10),
      endedAt: at(0, 10),
    },
    {
      id: "exe_2",
      workspaceId: WORKSPACE_ID,
      agentId: "agt_redator",
      agentVersion: 1,
      state: "aguardandoAprovacao",
      origin: "sessaoDeChat",
      invokedBy: member("mem_thiago"),
      delegate: member("mem_thiago"),
      chain,
      chatSessionId: "cht_1",
      anchor: { type: "deal", id: "deal_fim_1" },
      modelId: "mdl_base",
      effectiveAutonomy: "assistido",
      rehearsal: false,
      input: "Envie a proposta para a Ana pelo WhatsApp",
      steps: [
        { index: 0, kind: "ferramenta", toolId: "ler_negocio", toolAllowed: true, resourcePermitted: true, effectClass: "leitura", result: "concluido", at: at(0, 11) },
        { index: 1, kind: "aprovacao", toolId: "enviar_mensagem", effectClass: "externa", result: "aguardando", approvalRequestId: "apr_1", at: at(0, 11) },
      ],
      contextComposition: emptyContext,
      knowledgeReferences: [],
      cost: { modelUnits: 1240, toolCalls: 1, childExecutions: 0, durationMs: 5100 },
      startedAt: at(0, 11),
    },
    {
      id: "exe_3",
      workspaceId: WORKSPACE_ID,
      agentId: "agt_sdr",
      agentVersion: 1,
      state: "falhou",
      origin: "automacao",
      invokedBy: SYSTEM,
      // DO-AUT-15 — the automation is the delegate; it does not enter the
      // permission intersection (RN-AUT-25).
      delegate: { kind: "automation", id: "aut_proposta" },
      chain: { ...chain, depth: 1, parentExecutionId: "aexe_1" },
      modelId: "mdl_base",
      effectiveAutonomy: "supervisionado",
      rehearsal: false,
      input: "Resumir o Negócio que entrou em Proposta",
      steps: [{ index: 0, kind: "ferramenta", toolId: "ler_negocio", toolAllowed: true, resourcePermitted: false, effectClass: "leitura", result: "negada", at: at(3, 9) }],
      contextComposition: emptyContext,
      knowledgeReferences: [],
      cost: { modelUnits: 210, toolCalls: 1, childExecutions: 0, durationMs: 900 },
      terminationReason: "Permissão negada sobre o registro-alvo",
      startedAt: at(3, 9),
      endedAt: at(3, 9),
    },
  ];
}

function buildApprovals(): ApprovalRequest[] {
  return [
    {
      id: "apr_1",
      executionId: "exe_2",
      stepIndex: 1,
      requestedBy: agentRef("agt_redator"),
      reason: "autonomia",
      object: {
        toolId: "enviar_mensagem",
        input: "Oi, Ana! Segue a proposta do Full Face Avançado no plano Elite, com os 10 casos e as quatro mentorias.",
        targetResourceType: "conversation",
        targetResourceId: "cnv_1",
        effectClass: "externa",
      },
      approverMemberId: "mem_thiago",
      createdAt: at(0, 11),
      // B80 — the platform default of 72 hours, still open.
      deadline: at(-3, 11),
    },
  ];
}

/** Activity records derived from what the seed built (A6.2). */
function seedActivity(state: DataState): void {
  const records: ActivityRecord[] = [];
  const add = (
    actor: ActorRef,
    action: string,
    objectType: string,
    objectId: Id,
    objectName: string,
    when: string,
    delegate?: ActorRef,
    change?: { readonly before?: string; readonly after?: string },
  ) => {
    records.push({
      id: nextId("act"),
      workspaceId: WORKSPACE_ID,
      actor,
      ...(delegate ? { delegate } : {}),
      action,
      objectType,
      objectId,
      objectName,
      at: when,
      result: "ok",
      ...(change?.before ? { before: change.before } : {}),
      ...(change?.after ? { after: change.after } : {}),
    });
  };

  for (const task of state.tasks) {
    add(task.createdBy, "Tarefa criada", "task", task.id, task.title, task.createdAt);
    if (task.assignees.length > 0) add(member("mem_thiago"), "Responsável atribuído", "task", task.id, task.title, task.createdAt);
  }
  for (const deal of state.deals) {
    add(deal.createdBy, "Negócio criado", "deal", deal.id, deal.title, deal.createdAt);
    for (const transition of deal.stageHistory) {
      /*
        Sem a Etapa, quatro passagens viram quatro linhas idênticas. E os dois
        Funis têm uma Etapa "Agendamento" cada: na passagem ao Closer, dizer só
        a Etapa faria a linha ler "Agendamento → Agendamento", que é o evento
        mais importante do funil escrito como se nada tivesse acontecido.
      */
      const mudouDeFunil =
        transition.fromFunnelId !== undefined && transition.fromFunnelId !== transition.toFunnelId;
      const ondeFica = (funilId: Id | undefined, etapa: string) => {
        const funil = state.funnels.find((f) => f.id === funilId);
        return mudouDeFunil && funil ? `${funil.name} · ${etapa}` : etapa;
      };
      add(
        transition.actor,
        mudouDeFunil ? "Negócio mudou de Funil" : "Negócio entrou em Etapa",
        "deal",
        deal.id,
        deal.title,
        transition.at,
        undefined,
        {
          ...(transition.fromStageName
            ? { before: ondeFica(transition.fromFunnelId, transition.fromStageName) }
            : {}),
          after: ondeFica(transition.toFunnelId, transition.toStageName),
        },
      );
    }
    if (deal.situation === "ganho") add(member(deal.ownerMemberId), "Negócio marcado como ganho", "deal", deal.id, deal.title, deal.closedAt ?? deal.createdAt);
    if (deal.situation === "perdido") add(member(deal.ownerMemberId), "Negócio marcado como perdido", "deal", deal.id, deal.title, deal.closedAt ?? deal.createdAt);
  }
  for (const contact of state.contacts) {
    const name = `${contact.firstName} ${contact.lastName}`.trim() || "Contato sem nome";
    add(contact.createdBy, "Contato criado", "contact", contact.id, name, contact.createdAt);
  }
  for (const conversation of state.conversations) {
    add(SYSTEM, "Conversa criada por Mensagem recebida", "conversation", conversation.id, conversation.title, conversation.createdAt);
    if (conversation.assignee) add(member("mem_julia"), "Conversa atribuída", "conversation", conversation.id, conversation.title, conversation.createdAt);
    if (conversation.state === "resolvida") add(member("mem_julia"), "Conversa resolvida", "conversation", conversation.id, conversation.title, conversation.resolvedAt ?? conversation.createdAt);
  }
  for (const execution of state.agentExecutions) {
    const agentName = state.agents.find((a) => a.id === execution.agentId)?.name ?? "Agente";
    add(agentRef(execution.agentId), "Execução iniciada", "agentExecution", execution.id, agentName, execution.startedAt, execution.delegate);
    if (execution.endedAt) add(agentRef(execution.agentId), `Execução ${execution.state}`, "agentExecution", execution.id, agentName, execution.endedAt, execution.delegate);
  }
  add(member("mem_thiago"), "Membro removido", "member", "mem_tiago", "Tiago Reis", at(60));
  add(member("mem_thiago"), "Espaço de Trabalho criado", "workspace", WORKSPACE_ID, "Instituto Transformando Faces", at(400));

  records.sort((a, b) => b.at.localeCompare(a.at));
  state.activity = records;
}


/* ═══════════════════════════ processo comercial ═══════════════════════════ */

/**
 * As seis Automações do Funil SDR/Closer (seção 6 do processo).
 *
 * Todas com escopo de Funil ou Caixa de Entrada (B41 — o escopo é imutável e
 * delimita o GATILHO, nunca a Ação), Proprietário humano e Versão publicada.
 *
 * A ordem das Ações importa em duas delas: na passagem ao Closer, mover de
 * Funil vem antes de trocar o Proprietário, porque a Etapa de destino é que
 * define quem responde; e o enriquecimento grava os campos antes de abordar,
 * porque abordar sem saber quem é a pessoa é o que a Etapa existe para evitar.
 */
function processoComercial(): Automation[] {
  const base = (
    id: Id,
    name: string,
    description: string,
    scopeType: Automation["scopeType"],
    scopeId: Id,
    ownerMemberId: Id,
    trigger: AutomationVersion["trigger"],
    conditions: AutomationCondition[],
    actions: AutomationAction[],
  ): Automation => ({
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: member(ownerMemberId),
    createdAt: at(200),
    lifecycle: "ativo",
    name,
    description,
    scopeType,
    scopeId,
    ownerMemberId,
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        ...(trigger ? { trigger } : {}),
        conditions,
        actions,
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        publishedBy: ownerMemberId,
        publishedAt: at(199),
        createdAt: at(200),
      },
    ],
  });

  return [
    // 6.1 — a porta de entrada: Mensagem recebida de quem ainda não é Contato.
    base(
      "aut_sdr_entrada",
      "Entrada no SDR",
      "Todo lead que chega por Mensagem vira Negócio no Funil SDR.",
      "inbox",
      "inbox_n1",
      "mem_julia",
      { kind: "evento", eventType: "contatoCriado", eventSubtype: "porMensagemRecebida" },
      [{ kind: "atributo", expression: "Origem do Contato está entre as origens de aquisição" }],
      [
        { order: 0, kind: "escrita", toolId: "criar_negocio", params: "Funil SDR, Etapa Novo Lead, Proprietário resolvido pela Fila", targetExpression: "fnl_sdr:sdr_novo" },
        { order: 1, kind: "escrita", toolId: "vincular_conversa_negocio", params: "Vínculo Conversa–Negócio" },
        { order: 2, kind: "escrita", toolId: "atualizar_qualificacao", params: "Qualificação do Contato = Lead", targetExpression: "cat_qual_lead" },
      ],
    ),

    // 6.2 — enriquecer ANTES de abordar.
    base(
      "aut_sdr_enriquecimento",
      "Enriquecimento do lead",
      "Analisa o perfil público e devolve o resumo antes da abordagem.",
      "funnel",
      "fnl_sdr",
      "mem_julia",
      { kind: "evento", eventType: "negocioEntrouEmEtapa", eventSubtype: "sdr_novo" },
      [],
      [
        {
          order: 0,
          kind: "controle",
          controlKind: "invocarAgente",
          params: "analisar Instagram, site e redes informados",
          agentId: "agt_enriquecedor",
          skillId: "skl_analisar_perfil",
          maxAutonomy: "autonomo",
          timeoutHours: 2,
        },
        { order: 1, kind: "escrita", toolId: "atualizar_campos_contato", params: "gravar Resumo do perfil e Sinais de fit", targetExpression: "fd_resumo_perfil, fd_sinais_fit" },
        { order: 2, kind: "controle", controlKind: "notificar", params: "avisar o SDR de que o lead está pronto para abordagem" },
        // B64 — o Agente fala com o lead, então a Mensagem sai como Rascunho
        // para um humano aprovar. `supervisionado` não é conservadorismo: é a
        // diferença entre errar internamente e errar na frente do cliente.
        {
          order: 3,
          kind: "controle",
          controlKind: "invocarAgente",
          params: "redigir a abordagem com a pergunta de permissão",
          agentId: "agt_sdr",
          skillId: "skl_abordar_lead",
          maxAutonomy: "supervisionado",
          approverMemberId: "mem_julia",
          timeoutHours: 24,
        },
      ],
    ),

    // 6.3 — as quatro progressões automáticas.
    base(
      "aut_sdr_abordagem",
      "Abordagem realizada",
      "Mensagem enviada ao lead move o Negócio para Contato Inicial.",
      "funnel",
      "fnl_sdr",
      "mem_julia",
      { kind: "evento", eventType: "mensagemEnviada" },
      [{ kind: "atributo", expression: "Negócio vinculado está em Novo Lead" }],
      [{ order: 0, kind: "escrita", toolId: "mover_negocio_etapa", params: "mover para Contato Inicial", targetExpression: "sdr_contato" }],
    ),
    base(
      "aut_sdr_resposta",
      "Abordagem respondida",
      "Primeira resposta do lead move o Negócio para Conexão.",
      "funnel",
      "fnl_sdr",
      "mem_julia",
      { kind: "evento", eventType: "mensagemRecebida" },
      [{ kind: "atributo", expression: "Negócio vinculado está em Contato Inicial" }],
      [{ order: 0, kind: "escrita", toolId: "mover_negocio_etapa", params: "mover para Conexão", targetExpression: "sdr_conexao" }],
    ),
    base(
      "aut_sdr_conexao",
      "Conexão confirmada",
      "Classifica a resposta do lead e grava o fato da conexão.",
      "funnel",
      "fnl_sdr",
      "mem_julia",
      { kind: "evento", eventType: "mensagemRecebida" },
      [
        { kind: "atributo", expression: "Negócio vinculado está em Conexão" },
        /**
         * B90 — Condição híbrida: o Agente classifica e devolve
         * `{conectado, mensagem_evidencia}`. Em `incerto`, a Automação NÃO
         * avança: quem confirma é o SDR, apontando a Mensagem. Avançar no
         * incerto grava um fato que ninguém verificou.
         */
        {
          kind: "hibrida",
          expression: "o lead concordou em responder às perguntas de qualificação?",
          agentId: "agt_classificador",
          skillId: "skl_classificar_conexao",
          defaultOnFailure: "nao-avancar",
        },
      ],
      [
        { order: 0, kind: "escrita", toolId: "atualizar_campos_negocio", params: "gravar Conexão confirmada em e Evidência da conexão", targetExpression: "fd_conexao_em, fd_conexao_evidencia" },
        { order: 1, kind: "escrita", toolId: "mover_negocio_etapa", params: "mover para Qualificação", targetExpression: "sdr_qualificacao" },
      ],
    ),

    // 6.4 — a passagem ao Closer.
    base(
      "aut_sdr_passagem",
      "Passagem ao Closer",
      "Entrega o Negócio qualificado ao Closer, com a call já criada.",
      "funnel",
      "fnl_sdr",
      "mem_julia",
      { kind: "evento", eventType: "negocioEntrouEmEtapa", eventSubtype: "sdr_agendamento" },
      [],
      [
        // A ordem é regra: o Funil de destino define quem responde pelo
        // Negócio, então mover vem antes de trocar o Proprietário.
        { order: 0, kind: "escrita", toolId: "mover_negocio_funil", params: "Funil Closer, Etapa Agendamento", targetExpression: "fnl_closer:clo_agendamento" },
        { order: 1, kind: "escrita", toolId: "alterar_proprietario_negocio", params: "Closer responsável", targetExpression: "mem_rafael" },
        { order: 2, kind: "escrita", toolId: "atualizar_qualificacao", params: "Qualificação do Contato = Qualificado", targetExpression: "cat_qual_qualificado" },
        { order: 3, kind: "escrita", toolId: "criar_tarefa", params: "Realizar call, Responsável = novo Proprietário, vencimento = Data da reunião", targetExpression: "lst_funil_closer" },
        { order: 4, kind: "controle", controlKind: "notificar", params: "avisar o Closer e o SDR" },
      ],
    ),

    // 6.5 — as proteções de tempo. Os prazos CRESCEM conforme o Negócio
    // avança: descartar um lead qualificado custa muito mais que descartar um
    // que nunca respondeu, e um prazo único trataria os dois igual.
    base(
      "aut_sdr_prazos",
      "Proteções de tempo do SDR",
      "Retomada em 2 dias; perda com Motivo em 7, 10 ou 14 conforme a Etapa.",
      "funnel",
      "fnl_sdr",
      "mem_julia",
      { kind: "condicaoTemporal", temporalPredicate: "tempo na Etapa sem o critério de saída" },
      [{ kind: "temporal", expression: "2 dias sem avanço → retomada; 7 (Contato Inicial), 10 (Conexão) ou 14 (Qualificado) → perda" }],
      [
        { order: 0, kind: "escrita", toolId: "criar_tarefa", params: "Retomar contato", targetExpression: "lst_funil_sdr" },
        { order: 1, kind: "controle", controlKind: "aguardar", params: "até o prazo de perda da Etapa" },
        { order: 2, kind: "escrita", toolId: "marcar_negocio_perdido", params: "Motivo conforme a Etapa: Sem resposta, Sem conexão ou Sem agendamento" },
      ],
    ),

    /*
     * O Closer. As três Automações aqui cuidam do que acontece ANTES e DEPOIS
     * da call: o SDR entrega a reunião, o Closer entrega a receita, e o que
     * mata um Negócio no meio é a call que não acontece e a proposta que fica
     * sem resposta.
     */
    base(
      "aut_clo_confirmacao",
      "Confirmação da call",
      "Lembra o lead na véspera e no dia, porque o que mais custa ao Closer é a agenda vazia.",
      "funnel",
      "fnl_closer",
      "mem_rafael",
      { kind: "condicaoTemporal", temporalPredicate: "proximidade da Data da reunião" },
      [{ kind: "atributo", expression: "Etapa é Agendamento e Data da reunião está preenchida" }],
      [
        { order: 0, kind: "escrita", toolId: "enviar_mensagem", params: "Lembrete 24h antes, por WhatsApp" },
        { order: 1, kind: "controle", controlKind: "aguardar", params: "até 2 horas antes da reunião" },
        { order: 2, kind: "escrita", toolId: "enviar_mensagem", params: "Lembrete no dia, com o link da sala" },
        { order: 3, kind: "escrita", toolId: "criar_tarefa", params: "Preparar a call com o diagnóstico do SDR", targetExpression: "lst_funil_closer" },
      ],
    ),

    base(
      "aut_clo_proposta",
      "Proposta enviada",
      "Call concluída move para Proposta e abre a Tarefa de enviar o plano recomendado.",
      "funnel",
      "fnl_closer",
      "mem_rafael",
      { kind: "evento", eventType: "tarefaAtualizada", eventSubtype: "concluida" },
      [{ kind: "atributo", expression: "Tarefa é do Tipo Reunião e o Negócio está na Etapa Call" }],
      [
        { order: 0, kind: "escrita", toolId: "mover_negocio_etapa", params: "Etapa Proposta", targetExpression: "fnl_closer:clo_proposta" },
        { order: 1, kind: "escrita", toolId: "criar_tarefa", params: "Enviar proposta com o plano recomendado", targetExpression: "lst_funil_closer" },
        { order: 2, kind: "escrita", toolId: "atualizar_campos_negocio", params: "Registrar o plano recomendado" },
      ],
    ),

    // O silêncio depois da proposta é o que mais engana: parece negociação e é
    // perda. O prazo nomeia o Motivo em vez de deixar o Negócio parado.
    base(
      "aut_clo_prazos",
      "Proteções de tempo do Closer",
      "Retomada em 2 dias sem resposta à proposta; perda com Motivo em 10.",
      "funnel",
      "fnl_closer",
      "mem_rafael",
      { kind: "condicaoTemporal", temporalPredicate: "tempo na Etapa sem o critério de saída" },
      [{ kind: "temporal", expression: "2 dias na Proposta ou na Negociação sem resposta → retomada; 10 → perda" }],
      [
        { order: 0, kind: "escrita", toolId: "criar_tarefa", params: "Retomar a proposta", targetExpression: "lst_funil_closer" },
        { order: 1, kind: "controle", controlKind: "aguardar", params: "até o prazo de perda da Etapa" },
        { order: 2, kind: "escrita", toolId: "marcar_negocio_perdido", params: "Motivo conforme a Etapa: Sem retorno ou Vai fazer depois" },
      ],
    ),

  ];
}
