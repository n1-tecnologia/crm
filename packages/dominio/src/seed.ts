/**
 * Fictional data for the workspace "Instituto Igor Alves" — o instituto do cliente,
 * que vende o curso Full Face a cirurgiões-dentistas. A estrutura segue o PRD
 * (I.3 e II.7); o nome do Espaço de Trabalho é o do cliente, não o do PRD.
 *
 * Deterministic: ids and instants come from counters and from a fixed base
 * date, so two loads produce the same graph. Nothing here invents a concept —
 * every field maps to section 6 of an ontology document.
 */

import { nextId, resetIdSequence } from "./operations/activity";
import type { DataState } from "./state";
import { usuarioDoSeed } from "./usuarios-do-seed";
import type {
  ActivityRecord,
  ActorRef,
  Agent,
  AgentExecution,
  ApprovalRequest,
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationVersion,
  CatalogItem,
  ChatFolder,
  ChatMessage,
  ChatSession,
  Collection,
  FieldDefinition,
  Folder,
  Id,
  KnowledgeDocument,
  List,
  Member,
  Model,
  Panel,
  Queue,
  Role,
  Skill,
  SkillGrant,
  Space,
  StatusSet,
  Tag,
  Task,
  TaskType,
  Team,
  Template,
  Tool,
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
import { POS_VENDA_LIST_ID, applyPosVenda } from "./seed-pos-venda";
import { applyContasAReceber } from "./seed-contas-a-receber";
import { applyFerramentas } from "./seed-ferramentas";

const BASE = Date.UTC(
  new Date().getUTCFullYear(),
  new Date().getUTCMonth(),
  new Date().getUTCDate(),
  9,
);
const at = (daysAgo: number, hour = 9): string =>
  new Date(BASE - daysAgo * 86_400_000 + (hour - 9) * 3_600_000).toISOString();
/** Um instante com minuto: `at` e mais `minuto` minutos (uma conversa acontece em minutos, não em horas). */
const aos = (daysAgo: number, hour: number, minuto: number): string =>
  new Date(Date.parse(at(daysAgo, hour)) + minuto * 60_000).toISOString();
const day = (daysFromNow: number): string =>
  new Date(BASE + daysFromNow * 86_400_000).toISOString().slice(0, 10);

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
    userId: usuarioDoSeed(id),
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
    space("spc_com", "Comercial", "Vendas do curso Full Face a cirurgiões-dentistas", "#2563eb", 0, statusComercial, false),
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

  // ── Filas da Caixa de Entrada ─────────────────────────────────────────────
  // Os Canais e as Conversas do CRM saíram do seed (15-31): a demonstração é o `bootstrap:crm-demo`.
  const queues: Queue[] = [
    { id: "fila_com", workspaceId: WORKSPACE_ID, createdBy: member("mem_thiago"), createdAt: at(380), lifecycle: "ativo", name: "Comercial", description: "Primeiro contato e qualificação", eligibleMemberIds: ["mem_julia", "mem_rafael"], eligibleTeamIds: ["team_com"], distribution: "rodizio", maxConversationsPerAttendant: 15, defaultContactOwnerMemberId: "mem_julia" },
    { id: "fila_sup", workspaceId: WORKSPACE_ID, createdBy: member("mem_thiago"), createdAt: at(380), lifecycle: "ativo", name: "Suporte", eligibleMemberIds: ["mem_marcos"], eligibleTeamIds: [], distribution: "manual" },
  ];

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
    /**
     * Um Agente em `rascunho` que NÃO pode ser ativado: o Modelo é o legado,
     * descontinuado. É o caso que a ficha mostra como indisponível e que
     * `ativarAgente` recusa por RN-AGE-07 — objetivo e instruções estão
     * preenchidos de propósito, para o único motivo ser o Modelo.
     */
    {
      id: "agt_onboarding",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_julia"),
      createdAt: at(3),
      lifecycle: "rascunho",
      name: "Assistente de onboarding",
      description: "Acompanha o aluno novo nas primeiras semanas e responde dúvidas sobre a turma.",
      ownerMemberId: "mem_julia",
      roleId: "role_conv",
      versions: [
        {
          number: 1,
          objective: "Guiar cada aluno novo pelas etapas do onboarding e apontar o que ainda falta.",
          instructions: "Leia a Tarefa de onboarding do aluno e responda em português do Brasil, com passos curtos. Nunca prometa prazo que não esteja na Tarefa.",
          modelId: "mdl_legado",
          allowsModelOverride: false,
          allowedToolIds: ["ler_tarefa"],
          grantedSkillIds: [],
          autonomy: "assistido",
          approvalPolicy: { approverMemberIds: ["mem_julia"], approverTeamIds: [], timeoutHours: 72 },
          memoryEnabled: true,
          by: member("mem_julia"),
          at: at(3),
        },
      ],
      memory: [],
      memoryRetention: { maxItems: 200, maxDays: 180, keepDelegated: true },
    },
  ];

  const skills: Skill[] = [
    skill("skl_qualificar", "Qualificar lead", "workspace", "publicada", "Percorre com o lead as perguntas de qualificação e resume necessidade, orçamento, prazo e quem decide."),
    skill("skl_resumir", "Resumir contexto do Negócio", "workspace", "publicada", "Condensa Conversas, Comentários e Valores de Campo de um Negócio num resumo curto para quem o assume."),
    skill("skl_proposta", "Redigir proposta comercial", "workspace", "publicada", "Escreve a proposta a partir do Negócio e do material aprovado, no modelo de precificação vigente."),
    skill("skl_triagem", "Triagem de mensagem recebida", "plataforma", "publicada", "Classifica uma Mensagem recebida por assunto e urgência e indica a Fila ou o Atendente que deve responder."),
    skill("skl_agenda", "Sugerir plano de estudo", "workspace", "rascunho", "Monta um plano de estudo semanal para o aluno a partir da turma e do tempo que ele tem disponível."),
    skill("skl_followup", "Redigir follow-up", "workspace", "publicada", "Redige a mensagem de retomada de um Negócio parado, no tom da última Conversa com o Contato."),
    skill("skl_analisar_perfil", "Analisar perfil público", "workspace", "publicada", "Lê Instagram, site e redes informadas do lead e devolve o resumo do perfil e os sinais de fit."),
    // A pergunta de permissão vive NAS INSTRUÇÕES desta Habilidade, não no
    // roteiro de quem usa: é ela que produz o evento que a Automação detecta.
    // Sem a pergunta, não há resposta, e sem resposta não há conexão para
    // confirmar.
    skill("skl_abordar_lead", "Abordar lead", "workspace", "publicada", "Escreve a primeira abordagem ao lead, com a pergunta de permissão que abre a qualificação."),
    skill("skl_classificar_conexao", "Classificar conexão", "workspace", "publicada", "Lê a resposta do lead e diz se ele aceitou responder às perguntas de qualificação, apontando a Mensagem de evidência."),
  ];
  // Uma Habilidade com duas versões `publicada` coexistentes (B71).
  skills[2]?.versions.push({
    number: 2,
    state: "publicada",
    instructions: "Redigir proposta com o modelo de precificação por turma do Full Face e forma de pagamento.",
    inputContract: [{ name: "negocio", type: "referencia:deal", required: true, description: "Negócio de origem" }],
    outputContract: { structured: [], text: true },
    toolRequirements: [{ toolId: "ler_negocio", mandatory: true }],
    dependencies: [],
    recommendedCollectionIds: ["col_comercial"],
    publishedBy: "mem_rafael",
    createdAt: at(40),
    publishedAt: at(38),
  });
  // O rascunho de "Sugerir plano de estudo" está sem Instruções: é o caso em
  // que a validação diz "As Instruções estão vazias." e publicar é recusado (RN-HAB-06).
  const rascunhoDaAgenda = skills.find((s) => s.id === "skl_agenda")?.versions[0];
  if (rascunhoDaAgenda) rascunhoDaAgenda.instructions = "";

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
  // DO-AGE-02 — cada Versão é a foto completa da configuração, inclusive as
  // Habilidades concedidas por identidade. A Versão 1 de cada Agente grava as
  // Concessões seedadas acima; sem isso, a primeira Versão criada por
  // `permitirFerramenta` (que copia a corrente) fotografava zero Habilidades
  // num Agente com quatro Concessões, e o histórico contava concessões que
  // nunca aconteceram.
  for (const agente of agents) {
    const concedidas = skillGrants.filter((g) => g.agentId === agente.id).map((g) => g.skillId);
    for (const versao of agente.versions) versao.grantedSkillIds = [...concedidas];
  }

  // Um rascunho de Lista com Gatilho e SEM Ação: o editor abre nele com a
  // validação dizendo "Adicione ao menos uma Ação." e, publicado, o motor
  // dispara de verdade em `createTask`. Na Lista de Pós-venda porque ela
  // sobrevive à poda do seed do produto — Prospecção e Ativação não.
  const avisarAoCriarTarefa: Automation = {
    ...automation("aut_lista_rascunho", "Avisar ao criar Tarefa", "list", POS_VENDA_LIST_ID, "mem_julia", "rascunho", false),
    createdAt: at(2),
    description: "Comenta na Tarefa nova para o Comercial saber que o pós-venda começou.",
  };
  const rascunhoDeLista = avisarAoCriarTarefa.versions[0];
  if (rascunhoDeLista) {
    rascunhoDeLista.conditions = [];
    rascunhoDeLista.actions = [];
  }

  const automations: Automation[] = [
    // Cada uma com a sua frase: o catálogo de Personalizar mostrava "Sem descrição." nas três.
    {
      ...automation("aut_boasvindas", "Boas-vindas na Fila Comercial", "queue", "fila_com", "mem_julia", "ativo", false),
      description: "Abre uma Tarefa de acompanhamento no SDR para cada Conversa nova que entra na Fila Comercial.",
    },
    {
      ...automation("aut_revisao", "Revisão mensal de playbooks", "list", "lst_revisoes", "mem_marcos", "pausado", false),
      description: "Abre uma Tarefa de acompanhamento a cada Tarefa nova da Lista de revisões dos playbooks.",
    },
    {
      ...automation("aut_rascunho", "Alerta de Automação com erro", "space", "spc_com", "mem_marcos", "rascunho", false),
      description: "Abre uma Tarefa de acompanhamento no Comercial a cada Tarefa nova do Espaço — rascunho a completar com o Gatilho de falha de Automação.",
    },
    avisarAoCriarTarefa,
    ...processoComercial(),
  ];

  const collections: Collection[] = [
    collection("col_comercial", "Material comercial", "mem_rafael", false),
    collection("col_clinico", "Playbooks do comercial", "mem_thiago", false),
    collection("col_interno", "Interno, jurídico", "mem_thiago", true),
    // Vazia de propósito: é onde "Adicionar Documento" começa do zero.
    { ...collection("col_onboarding", "Onboarding de alunos", "mem_julia", false), description: "Roteiro das primeiras semanas do aluno e respostas às dúvidas mais comuns.", createdAt: at(4) },
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
        ? { kind: "fonte" as const, sourceId: "src_col_clinico_url", sourceName: "Documentação da API de Mensagens", at: at(150 - index * 8), sourceKind: "url", specificOrigin: "https://exemplo.com/api-de-mensagens" }
        : { kind: "fonte" as const, sourceId: `src_${collectionId}_manual`, sourceName: "Envio manual", at: at(150 - index * 8), sourceKind: "envioManual", specificOrigin: "texto digitado" },
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
    // Uma Sessão já em andamento (2026-09-28: "simule um chat já iniciado e com mensagens e respostas").
    { ...chat("cht_2", "mem_thiago", "Revisar playbook de qualificação", { type: "task", id: "tsk_seed_1", nameAtTheTime: "Revisar playbook de qualificação" }, undefined), folderId: "cfd_processo", messages: conversaDoPlaybook() },
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
    models: MODELOS_DA_PLATAFORMA,
    tools: TOOLS,
    workspace: buildWorkspace(),
    members,
    teams,
    roles,
    integrations: [
      { id: "int_erp", workspaceId: WORKSPACE_ID, name: "ERP financeiro", systemType: "erp", state: "conectada", configuredBy: "mem_rafael", createdBy: member("mem_rafael"), createdAt: at(200), exposedTools: ["erp_consultar_fatura"] },
      // Desconectada de propósito: é o caso "Ferramenta permitida e inoperante" e "Fonte com erro" (20.6).
      { id: "int_agenda", workspaceId: WORKSPACE_ID, name: "Agenda (Google)", systemType: "agenda", state: "desconectada", configuredBy: "mem_thiago", createdBy: member("mem_thiago"), createdAt: at(45), exposedTools: ["agenda_criar_evento"] },
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
    // O CRM antigo saiu do seed (15-31, D-15-13): `bootstrap:crm-demo` carrega a demonstração nas tabelas novas.
    inbox: { id: "inbox_n1", workspaceId: WORKSPACE_ID, reopenWindowHours: 72, defaultDistribution: "manual", defaultContactOwnerMemberId: "mem_julia" },
    queues,
    // Só as Conversas de Grupo (F14-D-05) entram, pelas Ferramentas.
    conversations: [],
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
    grupos: [],
    comunidades: [],
    linksDeCaptacao: [],
    flows: [],
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
  // O atalho da Caixa de entrada do CRM, no nível das Listas do Espaço Comercial, já filtrada em "Minhas".
  // (A Pasta "Meus negócios" e as Listas espelho dos Funis saíram do seed com o CRM antigo, 15-31.)
  const comercial = state.spaces.find((s) => s.id === "spc_com");
  if (comercial) {
    comercial.shortcuts = [
      ...(comercial.shortcuts ?? []),
      { id: "atl_com_caixa", name: "Caixa de entrada", target: "caixaDeEntrada", scope: "minhas" },
    ];
  }
  // Lista conversacional sem Funil (C35): Comercial › Pós-venda, uma Tarefa por Contato com conversa.
  applyPosVenda(state, { at, day, workspaceId: WORKSPACE_ID });
  // Ferramentas do CRM (docs 23–25): Comunidade, Grupos, Link de Captação e Flow no Canal de WhatsApp.
  applyFerramentas(state, { at, workspaceId: WORKSPACE_ID });
  return state;
}

// ── construtores auxiliares ────────────────────────────────────────────────

function buildWorkspace(): Workspace {
  return {
    id: WORKSPACE_ID,
    name: "Instituto Igor Alves",
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
  modeloDeTarefa: "operacional",
  modes: {},
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

/**
 * O que cada Agente do seed é — descrição do cartão, objetivo da Versão 1 e
 * as Ferramentas permitidas —, por nome, para o catálogo de Personalizar não
 * parecer gerado por modelo (dois Agentes repetiam o texto do Redator). As
 * Ferramentas seguem o estrago que cada um pode causar: o Enriquecedor só lê
 * fonte pública e grava Valor de Campo; o Classificador só lê e responde.
 */
const PERFIL_DO_AGENTE: Record<string, { readonly description: string; readonly objective: string; readonly tools: readonly string[] }> = {
  "Assistente padrão": {
    description: "Agente instanciado com o Espaço de Trabalho; responde quando nenhum outro é escolhido.",
    objective: "Ajudar Membros do Espaço de Trabalho.",
    tools: ["ler_tarefa", "ler_negocio", "ler_contato", "consultar_conhecimento", "lembrar"],
  },
  "Qualificador SDR": {
    description: "Aborda e qualifica os leads que chegam pela Caixa de Entrada; toda Mensagem ao lead sai como Rascunho para um humano aprovar.",
    objective: "Qualificar cada lead novo e propor ao SDR o próximo passo.",
    tools: ["ler_contato", "ler_conversa", "sugerir_resposta", "atualizar_qualificacao", "consultar_conhecimento"],
  },
  "Redator de propostas": {
    description: "Redige propostas comerciais a partir do Negócio e do material de referência aprovado.",
    objective: "Redigir propostas comerciais fiéis ao material aprovado.",
    tools: ["ler_negocio", "ler_contato", "consultar_conhecimento", "enviar_mensagem"],
  },
  "Enriquecedor de leads": {
    description: "Levanta o perfil público do lead — Instagram, site e redes informadas — e grava no Contato o resumo e os sinais de fit.",
    objective: "Entregar ao SDR um resumo do perfil do lead antes da primeira abordagem.",
    tools: ["ler_contato", "consultar_conhecimento", "atualizar_campos_contato"],
  },
  "Classificador de conexão": {
    description: "Lê a resposta do lead e diz se houve conexão; não escreve nada, devolve o veredito que a Condição híbrida consome.",
    objective: "Classificar se o lead aceitou responder às perguntas de qualificação, apontando a Mensagem de evidência.",
    tools: ["ler_conversa", "ler_negocio", "ler_contato"],
  },
};

function agent(
  id: Id,
  name: string,
  ownerMemberId: Id,
  lifecycle: Agent["lifecycle"],
  autonomy: "assistido" | "supervisionado" | "autonomo",
  isDefault: boolean,
): Agent {
  const perfil = PERFIL_DO_AGENTE[name];
  if (!perfil) throw new Error(`seed: Agente “${name}” sem perfil em PERFIL_DO_AGENTE`);
  return {
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: isDefault ? SYSTEM : member(ownerMemberId),
    createdAt: at(380),
    lifecycle,
    name,
    description: perfil.description,
    ownerMemberId,
    roleId: isDefault ? "role_conv" : "role_agente_crm",
    versions: [
      {
        number: 1,
        objective: perfil.objective,
        instructions: "Responda em português do Brasil, de forma direta. Nunca invente dados de Contato, Empresa ou Negócio.",
        modelId: isDefault ? "padraoDaPlataforma" : "mdl_base",
        allowsModelOverride: isDefault,
        allowedToolIds: [...perfil.tools],
        // As Concessões seedadas (`skillGrants`) são gravadas aqui logo
        // depois, em `buildSeed`: a foto da Versão 1 precisa ser verdadeira.
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

function skill(
  id: Id,
  name: string,
  ownership: "workspace" | "plataforma",
  state: "publicada" | "rascunho",
  /** O que a Habilidade faz, em uma frase própria — o texto do cartão de Habilidades, nunca o nome repetido. */
  description: string,
): Skill {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: ownership === "plataforma" ? SYSTEM : member("mem_rafael"),
    createdAt: at(120),
    lifecycle: "ativo",
    name,
    description,
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

/*
  A conversa da Sessão "Revisar playbook de qualificação" (cht_2), ontem à
  tarde: três perguntas do Thiago e as respostas do Assistente padrão. Toda
  Mensagem 'assistente' e 'ferramenta' sai de uma Execução (exe_chat_1..3,
  em `buildExecutions`), e as Referências de Conhecimento apontam para
  Documentos da Coleção "Playbooks do comercial", que o Assistente padrão
  acessa (cgr_3). Nada aqui depende da Tarefa-âncora de cht_2 (tsk_seed_1):
  ela é da árvore de demonstração, e o seed de produto (`pruneDemo`) apaga
  as Execuções ancoradas nela e as Mensagens que as citam — a conversa
  sumiria do produto, ficando só as perguntas.
*/
const PLAYBOOK_REF = { documentId: "doc_9", documentTitle: "Playbook de qualificação", version: 1, fragmentIds: ["frg_9"], collectionId: "col_clinico", collectionName: "Playbooks do comercial" };
const JANELA_REF = { documentId: "doc_11", documentTitle: "Janela de resposta, resumo comentado", version: 1, fragmentIds: ["frg_11"], collectionId: "col_clinico", collectionName: "Playbooks do comercial" };

function conversaDoPlaybook(): ChatMessage[] {
  const eu = member("mem_thiago");
  const assistente = { kind: "agent" as const, id: "agt_padrao" };
  const mensagem = (order: number, minuto: number, parte: Pick<ChatMessage, "role" | "author" | "content"> & Partial<Pick<ChatMessage, "executionId" | "toolId" | "toolResult" | "knowledgeReferences">>): ChatMessage => ({
    id: `cmg_pb_${order + 1}`,
    order,
    fileIds: [],
    knowledgeReferences: [],
    complete: true,
    at: aos(1, 17, minuto),
    ...parte,
  });
  return [
    mensagem(0, 0, { role: "usuario", author: eu, content: "Preciso revisar o playbook de qualificação do SDR antes da reunião de sexta. Hoje a maioria dos leads chega pelo WhatsApp, e o Closer só aceita quem atende em clínica própria. O que no playbook ficou desatualizado?" }),
    mensagem(1, 1, { role: "ferramenta", author: assistente, executionId: "exe_chat_1", toolId: "consultar_conhecimento", toolResult: "concluida", content: "Consultou o Playbook de qualificação." }),
    mensagem(2, 2, {
      role: "assistente",
      author: assistente,
      executionId: "exe_chat_1",
      knowledgeReferences: [PLAYBOOK_REF],
      content: [
        "Li o Playbook de qualificação. Com o que você descreveu, três pontos ficaram desatualizados:",
        "",
        "1. O playbook manda qualificar por telefone, e os leads chegam pelo WhatsApp: a qualificação tem de acontecer por lá, na mesma Conversa.",
        "2. As perguntas de orçamento vêm antes das de perfil, e o lead esfria antes de contar como atende hoje.",
        "3. Não existe a pergunta sobre clínica própria, e é ela que decide se o lead vai para o Closer.",
        "",
        "Quer que eu monte a sequência revisada de perguntas?",
      ].join("\n"),
    }),
    mensagem(3, 6, { role: "usuario", author: eu, content: "Sim. Monte as perguntas na ordem da conversa, com no máximo seis." }),
    mensagem(4, 7, {
      role: "assistente",
      author: assistente,
      executionId: "exe_chat_2",
      knowledgeReferences: [PLAYBOOK_REF, JANELA_REF],
      content: [
        "Aqui vai a sequência revisada, na ordem da conversa:",
        "",
        "1. Você atende em clínica própria ou em clínica de terceiros?",
        "2. Quantos procedimentos de harmonização facial você faz por mês hoje?",
        "3. O que fez você procurar o Full Face agora?",
        "4. Você quer começar pelo Full Face Avançado ou conhecer o plano Elite, com mentorias?",
        "5. Qual o melhor dia para uma call de 20 minutos com o nosso Closer?",
        "6. Posso mandar o material por aqui mesmo, pelo WhatsApp?",
        "",
        "Pela Janela de resposta, a primeira pergunta sai em até 15 minutos depois do primeiro contato do lead.",
      ].join("\n"),
    }),
    mensagem(5, 11, { role: "usuario", author: eu, content: "Perfeito. A pergunta da clínica própria vira critério obrigatório para passar o lead ao Closer." }),
    mensagem(6, 12, {
      role: "assistente",
      author: assistente,
      executionId: "exe_chat_3",
      content:
        "Combinado: sem a resposta sobre clínica própria, o lead não passa ao Closer. Para valer para o time, o Playbook de qualificação precisa de uma nova versão publicada no Conhecimento, e eu não altero o documento por conta própria. Se quiser, escrevo o parágrafo do critério para você colar lá.",
    }),
  ];
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

// A1.3 — entidades globais, referenciadas nunca possuídas; o bootstrap de produção também precisa delas.
export const MODELOS_DA_PLATAFORMA: Model[] = [{ id: "mdl_base", name: "Modelo base", capabilities: { inputs: ["texto", "imagem", "documento"], outputs: ["texto"] }, discontinued: false }, { id: "mdl_rapido", name: "Modelo rápido", capabilities: { inputs: ["texto"], outputs: ["texto"] }, discontinued: false }, { id: "mdl_legado", name: "Modelo legado", capabilities: { inputs: ["texto"], outputs: ["texto"] }, discontinued: true }];
export const TOOLS = [
  tool("ler_tarefa", "Ler Tarefa", "task", "ver", "leitura", "Lê título, Status, datas e Responsáveis de uma Tarefa que o Agente pode ver."),
  tool("criar_tarefa", "Criar Tarefa", "list", "criar", "escritaReversivel", "Abre uma Tarefa nova numa Lista, com título, Responsável e vencimento informados."),
  tool("ler_contato", "Ler Contato", "contact", "ver", "leitura", "Lê nome, Identificadores, Origem, Qualificação e Tags de um Contato."),
  tool("ler_negocio", "Ler Negócio", "deal", "ver", "leitura", "Lê Funil, Etapa, valor, Proprietário e Contatos vinculados de um Negócio."),
  tool("ler_conversa", "Ler Conversa", "conversation", "ver", "leitura", "Lê as Mensagens trocadas numa Conversa e quem está atribuído a ela."),
  tool("enviar_mensagem", "Enviar Mensagem", "conversation", "editar", "externa", "Envia uma Mensagem ao Contato pelo Canal da Conversa; o texto sai da plataforma e não volta."),
  tool("sugerir_resposta", "Sugerir resposta", "conversation", "ver", "leitura", "Propõe um Rascunho de resposta na Conversa para um Atendente revisar antes de enviar."),
  tool("consultar_conhecimento", "Consultar Conhecimento", "collection", "ver", "leitura", "Busca nas Coleções que o Agente acessa e devolve as passagens relevantes, com a fonte de cada uma."),
  tool("adicionar_ao_conhecimento", "Adicionar ao Conhecimento", "collection", "criar", "escritaReversivel", "Grava um Documento novo numa Coleção, pronto para o processamento em Fragmentos."),
  tool("atualizar_qualificacao", "Atualizar Qualificação de Contato", "contact", "editar", "escritaReversivel", "Troca a Qualificação de um Contato por outra do catálogo do Espaço de Trabalho, com Registro."),
  tool("mesclar_contatos", "Mesclar Contatos", "contact", "administrar", "escritaIrreversivel", "Funde dois Contatos duplicados num só, reapontando Vínculos e Conversas; não há como desfazer."),
  tool("marcar_negocio_ganho", "Marcar Negócio como ganho", "deal", "editar", "escritaIrreversivel", "Encerra um Negócio como ganho, sob as Regras de encerramento do Funil; reabrir exige um Administrador."),
  tool("invocar_agente", "Invocar Agente", "agent", "executar", "escritaReversivel", "Chama outro Agente com um pedido e recebe a resposta dele dentro da mesma Execução."),
  tool("acionar_automacao", "Acionar Automação", "automation", "executar", "escritaReversivel", "Dispara uma Automação de Gatilho manual sobre um registro do escopo dela."),
  tool("erp_consultar_fatura", "Consultar fatura no ERP", "company", "ver", "leitura", "Busca no ERP as faturas emitidas para uma Empresa e devolve valores, vencimentos e situação.", "int_erp"),
  tool("lembrar", "Lembrar", "member", "editar", "escritaReversivel", "Guarda na Memória do Agente um fato sobre quem conversa com ele, para reaproveitar depois."),
  tool("ler_painel", "Ler Painel", "panel", "ver", "leitura", "Lê os valores correntes dos Widgets de um Painel que o Agente pode ver."),
  tool("criar_comentario", "Criar Comentário", "task", "comentar", "escritaReversivel", "Publica um Comentário numa Tarefa, assinado pelo Agente."),
  tool("alterar_status", "Alterar Status de Tarefa", "task", "editar", "escritaReversivel", "Move uma Tarefa para outro Status do Conjunto da sua Lista."),
  tool("omie_lancar_conta_a_pagar", "Lançar conta a pagar no Omie", "task", "editar", "externa", "Cria no Omie a conta a pagar correspondente à Tarefa do Financeiro, com fornecedor, valor e vencimento.", "int_omie"),
  // As Ferramentas que os dois motores de Automação executam de verdade
  // (`automations.ts` e `ferramentas/automacoes.ts`). Sem elas no Catálogo, um
  // rascunho criado a partir das Automações do Financeiro ou dos Grupos era
  // recusado ao publicar: o editor exige que o Catálogo diga a verdade (D5).
  tool("tarefa.definirResponsavel", "Definir Responsável da Tarefa", "task", "editar", "escritaReversivel", "Atribui um Membro como Responsável da Tarefa que disparou a Automação."),
  tool("tarefa.removerResponsavel", "Remover Responsável da Tarefa", "task", "editar", "escritaReversivel", "Tira um Membro da lista de Responsáveis da Tarefa que disparou a Automação."),
  tool("tarefa.adicionarObservadores", "Adicionar Observadores à Tarefa", "task", "editar", "escritaReversivel", "Inclui Membros como Observadores da Tarefa, para receberem as notificações dela."),
  tool("tarefa.alterarStatus", "Alterar Status da Tarefa", "task", "editar", "escritaReversivel", "Leva a Tarefa ao Status indicado; é o motor de Automações da Lista que executa."),
  tool("tarefa.comentar", "Comentar na Tarefa", "task", "comentar", "escritaReversivel", "Registra na Tarefa um Comentário em nome da Automação que disparou."),
  tool("tarefa.definirCampo", "Definir Valor de Campo da Tarefa", "task", "editar", "escritaReversivel", "Grava um valor num Campo Personalizado da Tarefa que disparou a Automação."),
  tool("contato.adicionarTag", "Adicionar Tag ao Contato", "contact", "editar", "escritaReversivel", "Aplica uma Tag do Espaço de Trabalho ao Contato do Grupo ou da Conversa."),
  tool("contato.definirCampo", "Definir Valor de Campo do Contato", "contact", "editar", "escritaReversivel", "Grava um valor num Campo Personalizado do Contato do Grupo ou da Conversa."),
  tool("grupo.removerParticipante", "Remover Participante do Grupo", "grupo", "administrar", "escritaIrreversivel", "Retira um Contato do Grupo e encerra a Participação dele; não há como desfazer."),
  tool("mensagem.enviarAoContato", "Enviar Mensagem ao Contato", "conversation", "editar", "externa", "Envia ao Contato, pelo Canal do Grupo ou da Conversa, o texto que a Automação montou."),
  // As Ferramentas de CRM que o processo comercial (SDR → Closer) usa nas
  // Ações. Sem elas no Catálogo, as nove Automações do processo nasciam
  // "inoperante: referência inválida" (RN-AUT-21) e a Versão 1 publicada não
  // passava na validação. Permissão e classe de efeito seguem negocios.md 17:
  // mudar de Etapa e de Funil é `editar`; perder é `editar` de classe
  // irreversível (RN-NEG-21); transferir o Proprietário é `administrar`.
  tool("criar_negocio", "Criar Negócio", "funnel", "criar", "escritaReversivel", "Abre um Negócio novo num Funil, na Etapa indicada, com o Contato e o Proprietário já resolvidos."),
  tool("vincular_conversa_negocio", "Vincular Conversa ao Negócio", "deal", "editar", "escritaReversivel", "Liga a Conversa de origem ao Negócio, para o histórico de Mensagens aparecer no registro dele."),
  tool("mover_negocio_etapa", "Mover Negócio de Etapa", "deal", "editar", "escritaReversivel", "Avança ou recua um Negócio para outra Etapa do mesmo Funil, sob as Transições e os Requisitos dela."),
  tool("mover_negocio_funil", "Mover Negócio de Funil", "deal", "editar", "escritaReversivel", "Transfere um Negócio para outro Funil, numa Etapa de destino explícita; identidade, Proprietário, Vínculos e histórico seguem com ele (RN-NEG-13)."),
  tool("marcar_negocio_perdido", "Marcar Negócio como perdido", "deal", "editar", "escritaIrreversivel", "Encerra um Negócio como perdido, com o Motivo de Perda que o Funil exige; reabrir é outro ato, com Registro."),
  tool("atualizar_campos_contato", "Atualizar Campos do Contato", "contact", "editar", "escritaReversivel", "Grava de uma vez vários Valores de Campo Personalizado num Contato, como o resumo do perfil e os sinais de fit."),
  tool("atualizar_campos_negocio", "Atualizar Campos do Negócio", "deal", "editar", "escritaReversivel", "Grava de uma vez vários Valores de Campo Personalizado num Negócio, como a data e a evidência da conexão."),
  tool("alterar_proprietario_negocio", "Transferir Proprietário do Negócio", "deal", "administrar", "escritaReversivel", "Passa a propriedade do Negócio a outro Membro ativo, que responde por ele dali em diante."),
  // Uma Ferramenta de Integração desconectada: fica permitida e inoperante (7.7).
  tool("agenda_criar_evento", "Criar evento na agenda", "contact", "editar", "externa", "Marca um compromisso na agenda conectada, com o Contato como convidado e o link da sala.", "int_agenda"),
];

function tool(
  id: string,
  name: string,
  targetResourceType: string,
  requiredAction: "ver" | "criar" | "editar" | "excluir" | "administrar" | "executar" | "comentar",
  effectClass: "leitura" | "escritaReversivel" | "escritaIrreversivel" | "externa",
  /** O que a Ferramenta faz, em uma frase — nunca o nome repetido: é o texto do cartão de Plugins. */
  description: string,
  /** Com uma Integração, a Ferramenta é dela (DO-HAB-13); sem, é da plataforma. */
  integrationId?: Id,
): Tool {
  return {
    id,
    name,
    ...(integrationId ? { origin: "integracao" as const, integrationId } : { origin: "plataforma" as const }),
    targetResourceType,
    requiredAction,
    effectClass,
    description,
  };
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
  // As três Execuções da conversa de cht_2 ("Revisar playbook de qualificação").
  const doPlaybook = (id: Id, minuto: number, input: string, extra: Pick<AgentExecution, "steps" | "output" | "knowledgeReferences" | "cost" | "contextComposition">): AgentExecution => ({
    id,
    workspaceId: WORKSPACE_ID,
    agentId: "agt_padrao",
    agentVersion: 1,
    state: "concluida",
    origin: "sessaoDeChat",
    invokedBy: member("mem_thiago"),
    delegate: member("mem_thiago"),
    chain,
    chatSessionId: "cht_2",
    // Sem âncora: a da Sessão (tsk_seed_1) é de demonstração e sai do produto.
    modelId: "mdl_base",
    effectiveAutonomy: "supervisionado",
    rehearsal: false,
    input,
    startedAt: aos(1, 17, minuto),
    endedAt: aos(1, 17, minuto + 1),
    ...extra,
  });
  const execucoesDoPlaybook: AgentExecution[] = [
    doPlaybook("exe_chat_1", 1, "Preciso revisar o playbook de qualificação do SDR antes da reunião de sexta. Hoje a maioria dos leads chega pelo WhatsApp, e o Closer só aceita quem atende em clínica própria. O que no playbook ficou desatualizado?", {
      steps: [{ index: 0, kind: "ferramenta", toolId: "consultar_conhecimento", toolAllowed: true, resourcePermitted: true, effectClass: "leitura", result: "concluido", at: aos(1, 17, 1) }],
      output: "Três pontos desatualizados no Playbook de qualificação.",
      contextComposition: { ...emptyContext, fragmentRefs: [{ documentId: "doc_9", version: 1, fragmentId: "frg_9" }], chatMessageIds: ["cmg_pb_1"] },
      knowledgeReferences: [PLAYBOOK_REF],
      cost: { modelUnits: 1380, toolCalls: 1, childExecutions: 0, durationMs: 6200 },
    }),
    doPlaybook("exe_chat_2", 6, "Sim. Monte as perguntas na ordem da conversa, com no máximo seis.", {
      steps: [{ index: 0, kind: "ferramenta", toolId: "consultar_conhecimento", toolAllowed: true, resourcePermitted: true, effectClass: "leitura", result: "concluido", at: aos(1, 17, 6) }],
      output: "Sequência revisada de seis perguntas.",
      contextComposition: {
        ...emptyContext,
        fragmentRefs: [
          { documentId: "doc_9", version: 1, fragmentId: "frg_9" },
          { documentId: "doc_11", version: 1, fragmentId: "frg_11" },
        ],
        chatMessageIds: ["cmg_pb_1", "cmg_pb_3", "cmg_pb_4"],
      },
      knowledgeReferences: [PLAYBOOK_REF, JANELA_REF],
      cost: { modelUnits: 1720, toolCalls: 1, childExecutions: 0, durationMs: 7400 },
    }),
    doPlaybook("exe_chat_3", 11, "Perfeito. A pergunta da clínica própria vira critério obrigatório para passar o lead ao Closer.", {
      steps: [],
      output: "Critério da clínica própria combinado; o Documento não foi alterado.",
      contextComposition: { ...emptyContext, chatMessageIds: ["cmg_pb_4", "cmg_pb_5", "cmg_pb_6"] },
      knowledgeReferences: [],
      cost: { modelUnits: 540, toolCalls: 0, childExecutions: 0, durationMs: 2100 },
    }),
  ];
  return [
    ...execucoesDoPlaybook,
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
    {
      // B82 — um Ensaio: Execução real gravada com `rehearsal`, escritas
      // `simulado` e sem Memória (D10). É o que a ficha do Agente lista.
      id: "exe_ensaio_1",
      workspaceId: WORKSPACE_ID,
      agentId: "agt_sdr",
      agentVersion: 1,
      state: "concluida",
      origin: "acaoDireta",
      invokedBy: member("mem_rafael"),
      delegate: member("mem_rafael"),
      chain,
      modelId: "mdl_base",
      effectiveAutonomy: "supervisionado",
      rehearsal: true,
      input: "Qualifique a Marina Alves e proponha o próximo passo",
      steps: [
        { index: 0, kind: "raciocinio", output: "Ensaio: responder a “Qualifique a Marina Alves e proponha o próximo passo” com as instruções da Versão 1.", result: "concluido", at: at(1, 15) },
        { index: 1, kind: "ferramenta", toolId: "ler_contato", output: "Leitura simulada de Contato", toolAllowed: true, resourcePermitted: true, effectClass: "leitura", result: "concluido", at: at(1, 15) },
        { index: 2, kind: "ferramenta", toolId: "atualizar_qualificacao", output: "Escrita não aplicada: ensaio (B82)", toolAllowed: true, resourcePermitted: true, effectClass: "escritaReversivel", result: "simulado", at: at(1, 15) },
      ],
      output: "Ensaio concluído: 3 passo(s), 1 escrita(s) simulada(s).",
      contextComposition: emptyContext,
      knowledgeReferences: [],
      cost: { modelUnits: 1, toolCalls: 2, childExecutions: 0, durationMs: 0 },
      startedAt: at(1, 15),
      endedAt: at(1, 15),
    },
    {
      // Uma Execução em curso, com delegante: é a que "Cancelar" alcança (RN-AGE-21).
      id: "exe_em_curso",
      workspaceId: WORKSPACE_ID,
      agentId: "agt_sdr",
      agentVersion: 1,
      state: "executando",
      origin: "acaoDireta",
      invokedBy: member("mem_rafael"),
      delegate: member("mem_rafael"),
      chain,
      anchor: { type: "conversation", id: "cnv_1" },
      modelId: "mdl_base",
      effectiveAutonomy: "supervisionado",
      rehearsal: false,
      input: "Resumir a Conversa com a Ana e sugerir o próximo passo",
      steps: [
        { index: 0, kind: "ferramenta", toolId: "ler_conversa", toolAllowed: true, resourcePermitted: true, effectClass: "leitura", result: "concluido", at: at(0, 8) },
      ],
      contextComposition: emptyContext,
      knowledgeReferences: [],
      cost: { modelUnits: 310, toolCalls: 1, childExecutions: 0, durationMs: 0 },
      startedAt: at(0, 8),
    },
  ];
}

function buildApprovals(): ApprovalRequest[] {
  return [
    {
      id: "apr_1",
      // D-06 — origem em Execução de Agente: união discriminada por `kind`.
      origin: { kind: "agentExecution", executionId: "exe_2", stepIndex: 1, deadline: at(-3, 11) },
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
      // B80 — the platform default of 72 hours, still open (comment kept next to `deadline` above).
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
  for (const execution of state.agentExecutions) {
    const agentName = state.agents.find((a) => a.id === execution.agentId)?.name ?? "Agente";
    add(agentRef(execution.agentId), "Execução iniciada", "agentExecution", execution.id, agentName, execution.startedAt, execution.delegate);
    if (execution.endedAt) add(agentRef(execution.agentId), `Execução ${execution.state}`, "agentExecution", execution.id, agentName, execution.endedAt, execution.delegate);
  }
  add(member("mem_thiago"), "Membro removido", "member", "mem_tiago", "Tiago Reis", at(60));
  add(member("mem_thiago"), "Espaço de Trabalho criado", "workspace", WORKSPACE_ID, "Instituto Igor Alves", at(400));

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
    // O Evento é o que a Caixa de Entrada emite ao criar o Contato no mesmo ato
    // da Mensagem (RN-CXE-06; caixa-de-entrada 18) — não o "Contato criado"
    // genérico, que é Evento de Contato e só ocorre no Espaço de Trabalho
    // (RN-AUT-07).
    base(
      "aut_sdr_entrada",
      "Entrada no SDR",
      "Todo lead que chega por Mensagem vira Negócio no Funil SDR.",
      "inbox",
      "inbox_n1",
      "mem_julia",
      { kind: "evento", eventType: "contatoCriadoPorMensagem" },
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

    // 6.3 — as quatro progressões automáticas. As três que escutam Mensagem
    // têm escopo na Caixa de Entrada: Evento de Mensagem ocorre na Caixa ou na
    // Fila, nunca no Funil (RN-AUT-07) — o escopo delimita o Gatilho, e a
    // Condição "Negócio vinculado está em…" é o que as prende ao Funil SDR.
    // As Ações alcançam o Negócio de qualquer escopo (B41).
    base(
      "aut_sdr_abordagem",
      "Abordagem realizada",
      "Mensagem enviada ao lead move o Negócio para Contato Inicial.",
      "inbox",
      "inbox_n1",
      "mem_julia",
      { kind: "evento", eventType: "mensagemEnviada" },
      [{ kind: "atributo", expression: "Negócio vinculado está em Novo Lead" }],
      [{ order: 0, kind: "escrita", toolId: "mover_negocio_etapa", params: "mover para Contato Inicial", targetExpression: "sdr_contato" }],
    ),
    base(
      "aut_sdr_resposta",
      "Abordagem respondida",
      "Primeira resposta do lead move o Negócio para Conexão.",
      "inbox",
      "inbox_n1",
      "mem_julia",
      { kind: "evento", eventType: "mensagemRecebida" },
      [{ kind: "atributo", expression: "Negócio vinculado está em Contato Inicial" }],
      [{ order: 0, kind: "escrita", toolId: "mover_negocio_etapa", params: "mover para Conexão", targetExpression: "sdr_conexao" }],
    ),
    base(
      "aut_sdr_conexao",
      "Conexão confirmada",
      "Classifica a resposta do lead e grava o fato da conexão.",
      "inbox",
      "inbox_n1",
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

    // A call é uma Tarefa, e Evento de Tarefa exige escopo da Estrutura
    // (RN-AUT-07): a Lista espelho do Closer, onde "Realizar call" é criada.
    base(
      "aut_clo_proposta",
      "Proposta enviada",
      "Call concluída move para Proposta e abre a Tarefa de enviar o plano recomendado.",
      "list",
      "lst_funil_closer",
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
