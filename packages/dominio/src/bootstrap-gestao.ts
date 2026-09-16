/**
 * O `DataState` de produção da Fase 1 (PERS-06, D-07/D-08/D-09): o Espaço
 * "Gestão" nasce só com a configuração do processo Financeiro — Pasta,
 * Listas, Status, Campos, Tags, Papéis, Agente e Automações, exatamente como
 * `seed-financeiro.ts`/`seed-contas-a-receber.ts` já montam — e a Maryane,
 * única Membro, Proprietária (B7: com um Membro só, ela é a Proprietária).
 *
 * NÃO chama a função de seed do protótipo inteiro: aquilo montaria ~900
 * registros de CRM, IA e outros Espaços que D-07 proíbe explicitamente. Este
 * arquivo monta um `DataState` do zero, só com o que o bootstrap de
 * `apps/api` grava (Plan 01-05, Task 3).
 *
 * Sem contador de sequência: todo id aqui é literal, como o resto do seed —
 * reexecutar o bootstrap não pode gerar ids diferentes do que já está
 * gravado (Pitfall 4 do RESEARCH.md).
 */

import { COLECOES } from "./colecoes";
import { applyContasAPagar } from "./seed-financeiro";
import { applyContasAReceber } from "./seed-contas-a-receber";
import { MODELOS_DA_PLATAFORMA, TOOLS } from "./seed";
import type { DataState } from "./state";
import { emailDoSeed, USUARIOS_DO_SEED } from "./usuarios-do-seed";
import type { Agent, Funnel, Id, Inbox, Member, Role, Workspace } from "./types";

export interface OpcoesDoBootstrap {
  /** Padrão `"ws_n1"` — o único Espaço de Trabalho da Fase 1. */
  readonly workspaceId?: Id;
  /** ISO; padrão `new Date().toISOString()`. No bootstrap tudo nasce agora. */
  readonly agora?: string;
  readonly proprietaria?: {
    readonly memberId: Id;
    readonly userId: string;
    readonly displayName: string;
    readonly email: string;
  };
}

const PADRAO_PROPRIETARIA = {
  memberId: "mem_maryane",
  userId: USUARIOS_DO_SEED.mem_maryane,
  displayName: "Maryane Generozo",
  email: emailDoSeed("mem_maryane"),
};

/** Todas as chaves de `DataState` nascem vazias; `workspace`/`inbox` são preenchidas por fora (não são coleção). */
function estadoVazio(workspace: Workspace, inbox: Inbox): DataState {
  const colecoes = Object.fromEntries(COLECOES.map((c) => [c, [] as unknown[]])) as unknown as DataState;
  return { ...colecoes, models: MODELOS_DA_PLATAFORMA, tools: TOOLS, workspace, inbox };
}

/**
 * Rede de segurança para quando um seed de processo (Task 1) tiver deixado
 * passar alguma grant fixture: remove concessões cujo sujeito é um Membro que
 * não existe neste `DataState`. As Automações A3/A4/A9 continuam citando
 * `CP.aprovadorId` em payloads (JSON, não referência estrutural) — é a
 * consequência aceita de D-08: o Aprovador entra por convite, e religar essas
 * referências é trabalho da fase que o convida.
 */
function podarGrantsSemSujeito(state: DataState): void {
  const membros = new Set(state.members.map((m) => m.id));
  state.grants = state.grants.filter((g) => g.subjectKind !== "member" || membros.has(g.subjectId));
}

export function buildGestaoBootstrap(opcoes: OpcoesDoBootstrap = {}): DataState {
  const workspaceId = opcoes.workspaceId ?? "ws_n1";
  const agora = opcoes.agora ?? new Date().toISOString();
  const proprietaria = opcoes.proprietaria ?? PADRAO_PROPRIETARIA;

  // O relógio do bootstrap: tudo nasce agora. `at(daysAgo)` ignora o
  // argumento de propósito — não há "há 30 dias" num Espaço que acabou de
  // nascer; `day()` não é usado pela configuração (só pelas Tarefas fictícias,
  // que não entram aqui).
  const clock = { at: () => agora, day: () => agora.slice(0, 10), workspaceId };

  const workspace: Workspace = {
    id: workspaceId,
    // Editável depois pela tela (B34) — nome de partida, não trava nada.
    name: "N1 Digital",
    state: "ativo",
    ownerMemberId: proprietaria.memberId,
    createdBy: proprietaria.memberId,
    createdAt: agora,
    locale: { timezone: "America/Sao_Paulo", currency: "BRL", language: "pt-BR" },
    trashPolicy: { retentionDays: 30 },
    maxSubtaskDepth: 3,
    taskReadableId: { enabled: true, prefix: "N1", next: 1 },
    dealReadableId: { enabled: true, prefix: "NEG", next: 1 },
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
    // B33/B60 — os dois nascem com o Espaço de Trabalho.
    defaultAgentId: "agt_padrao",
    defaultFunnelId: "fnl_padrao",
    suspensions: [],
  };
  const inbox: Inbox = { id: "inbox_n1", workspaceId, reopenWindowHours: 72, defaultDistribution: "manual" };

  const state = estadoVazio(workspace, inbox);

  // Papéis de sistema (A9.4) — literais idênticos aos do seed genérico.
  const roles: Role[] = [
    { id: "role_prop", workspaceId, name: "Proprietário do Espaço de Trabalho", system: true, base: "proprietario", permissions: [] },
    { id: "role_adm", workspaceId, name: "Administrador", system: true, base: "administrador", permissions: [] },
    { id: "role_mem", workspaceId, name: "Membro", system: true, base: "membro", permissions: [] },
    { id: "role_conv", workspaceId, name: "Convidado", system: true, base: "convidado", permissions: [] },
  ];
  state.roles.push(...roles);

  // A Maryane: única Membro, Proprietária (B7/D-08) — o Papel de processo
  // (Financeiro) é o que `CP.financeiroId` referencia nas grants/automações
  // de configuração, e ela É `CP.financeiroId` por construção do domínio.
  const maryane: Member = {
    id: proprietaria.memberId,
    workspaceId,
    userId: proprietaria.userId,
    displayName: proprietaria.displayName,
    state: "ativo",
    roleId: "role_prop",
    joinedAt: agora,
    availability: { value: "disponivel", at: agora, origin: "membro" },
    userMemory: { enabled: true, items: [] },
  };
  state.members.push(maryane);

  // Agente padrão (B33 — instanciado com o Espaço, sempre ativo) e Funil
  // padrão (B60 — exatamente um, ativo, nunca privado): invariantes da
  // ontologia que todo Espaço de Trabalho exige para existir, não conteúdo
  // fictício — D-07 proíbe CRM/IA fictícios, não o mínimo estrutural.
  const agentePadrao: Agent = {
    id: "agt_padrao",
    workspaceId,
    createdBy: { kind: "system", id: "sistema" },
    createdAt: agora,
    lifecycle: "ativo",
    name: "Assistente padrão",
    description: "Agente instanciado com o Espaço de Trabalho; responde quando nenhum outro é escolhido.",
    ownerMemberId: proprietaria.memberId,
    roleId: "role_conv",
    versions: [
      {
        number: 1,
        objective: "Ajudar Membros do Espaço de Trabalho.",
        instructions: "Responda em português do Brasil, de forma direta. Nunca invente dados de Contato, Empresa ou Negócio.",
        modelId: "padraoDaPlataforma",
        allowsModelOverride: true,
        allowedToolIds: ["ler_tarefa", "ler_negocio", "ler_contato", "consultar_conhecimento", "lembrar"],
        grantedSkillIds: [],
        autonomy: "supervisionado",
        approvalPolicy: { approverMemberIds: [proprietaria.memberId], approverTeamIds: [], timeoutHours: 72 },
        memoryEnabled: true,
        by: { kind: "system", id: "sistema" },
        at: agora,
      },
    ],
    memory: [],
    memoryRetention: { maxItems: 200, maxDays: 180, keepDelegated: true },
  };
  state.agents.push(agentePadrao);

  const funilPadrao: Funnel = {
    id: "fnl_padrao",
    workspaceId,
    createdBy: { kind: "member", id: proprietaria.memberId },
    createdAt: agora,
    lifecycle: "ativo",
    name: "Padrão",
    order: 0,
    isPrivate: false,
    stages: [
      { id: "stg_padrao_novo", name: "Novo", order: 0, defaultProbability: 0, requirements: [], allowedTransitionStageIds: [] },
    ],
    closingRules: { requireLossReason: false, requireValueOnWin: false },
  };
  state.funnels.push(funilPadrao);

  // A configuração do Financeiro — só o que os dois módulos montam sem
  // fixtures: Espaço "Gestão" › Pasta "Financeiro" › Listas, Status, Campos,
  // Tags, Papéis do processo, Agente de lançamento + Coleção, Automações.
  applyContasAPagar(state, clock, { fixtures: false });
  applyContasAReceber(state, clock, { fixtures: false });

  podarGrantsSemSujeito(state);

  return state;
}
