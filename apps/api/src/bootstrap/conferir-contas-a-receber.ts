/**
 * Conferência SOMENTE LEITURA de "Contas a receber" contra `ws_n1` (D5-02b).
 *
 * `packages/dominio/src/bootstrap-gestao.ts:191` chama
 * `applyContasAReceber(state, clock, { fixtures: false })` — a mesma função
 * de produção — e `bootstrapGestao()` rodou contra o Supabase real na Fase 1.
 * A Lista, os 6 Status, os 8 Campos, as 6 Automações `aut_cr_*` e as duas
 * Visões provavelmente já estão em `ws_n1`. Este módulo NUNCA grava: monta o
 * "esperado" em memória a partir do mesmo seed que produção usa, hidrata o
 * "encontrado" numa transação `begin`/`rollback`, e devolve o diff.
 *
 * NÃO HÁ CAMINHO DE ESCRITA NESTE ARQUIVO NEM NO CLI IRMÃO — nenhum `insert`,
 * `update`, `delete` ou `gravar()`, e nenhuma flag que aplique mudança de
 * verdade. A única query contra o banco é `select`; a transação sempre
 * termina em `rollback`, mesmo quando a comparação não altera nada (T-5-28).
 */

import {
  COLECOES,
  type Automation,
  type AutomationVersion,
  type DataState,
  type FieldRequirement,
  type Id,
  type Inbox,
  type Workspace,
} from "@n1/dominio";
import { CR } from "@n1/dominio/operations/financeiro";
import { applyContasAReceber } from "@n1/dominio/seed-contas-a-receber";
import { MODELOS_DA_PLATAFORMA, TOOLS } from "@n1/dominio/seed";
import { canonico, hidratar } from "../persistencia/repositorio";
import { pool } from "../persistencia/conexao";

/** Mesmo formato de `DivergenciaDeConfiguracao` do evolver de 02-08, com `colecao` a mais: qual das cinco seções a divergência pertence. */
export interface DivergenciaDeConferencia {
  readonly colecao: "lista" | "status" | "campo" | "automacao" | "concessao" | "visao";
  readonly id: Id;
  readonly campo: string;
  readonly esperado: string;
  readonly encontrado: string;
}

export interface ContagemDeConferencia {
  readonly esperados: number;
  readonly encontrados: number;
}

export interface RelatorioDeConferencia {
  readonly divergencias: readonly DivergenciaDeConferencia[];
  readonly contagens: {
    readonly lista: ContagemDeConferencia;
    readonly status: ContagemDeConferencia;
    readonly campos: ContagemDeConferencia;
    readonly automacoes: ContagemDeConferencia;
    readonly concessoes: ContagemDeConferencia;
    readonly visoes: ContagemDeConferencia;
  };
  /** Ausente em `compararContasAReceber` (comparação pura, sem banco); presente só depois de `conferirContasAReceber` consultar `ws_n1`. */
  readonly operacional?: {
    readonly totalTarefas: number;
    readonly ultimaCriadaEm: string | null;
    readonly porStatus: ReadonlyArray<{ readonly statusId: Id; readonly nome: string; readonly total: number }>;
  };
}

/** Os 6 ids literais de `seed-contas-a-receber.ts` — não exportados de lá, então repetidos aqui (o mesmo padrão do CLI que lista `aut_cr_*` no seu próprio `read_first`). */
const AUTOMACAO_IDS: readonly Id[] = ["aut_cr_r2", "aut_cr_r2b", "aut_cr_r3", "aut_cr_r4", "aut_cr_r5", "aut_cr_r6"];

/** Nomes do catálogo (seção 3 da spec) — só para tornar a contagem por Status legível; nunca dado de Tarefa. */
const NOME_DO_STATUS: Record<Id, string> = {
  [CR.status.paraReceber]: "para receber",
  [CR.status.disponivelSaque]: "disponível para saque",
  [CR.status.pendente]: "pendente",
  [CR.status.estornado]: "estornado",
  [CR.status.descartado]: "descartado",
  [CR.status.recebido]: "recebido",
};

function compararPares(
  divergencias: DivergenciaDeConferencia[],
  colecao: DivergenciaDeConferencia["colecao"],
  id: Id,
  pares: ReadonlyArray<readonly [campo: string, esperado: string, encontrado: string]>,
): void {
  for (const [campo, esperado, encontrado] of pares) {
    if (esperado !== encontrado) divergencias.push({ colecao, id, campo, esperado, encontrado });
  }
}

/** `achadoOnde: "esperado"` = existe só no catálogo (falta em `ws_n1`); `"encontrado"` = existe só em `ws_n1` (sobra fora do catálogo). */
function presenca(divergencias: DivergenciaDeConferencia[], colecao: DivergenciaDeConferencia["colecao"], id: Id, achadoOnde: "esperado" | "encontrado"): void {
  const soNoEsperado = achadoOnde === "esperado";
  divergencias.push({
    colecao,
    id,
    campo: "presença",
    esperado: soNoEsperado ? "presente" : "ausente do catálogo",
    encontrado: soNoEsperado ? "ausente" : "presente",
  });
}

function ordenarIds(ids: readonly Id[] | undefined): readonly Id[] {
  return ids ? [...ids].sort() : [];
}

function ordenarRequisitos(reqs: readonly FieldRequirement[] | undefined): readonly FieldRequirement[] {
  return reqs ? [...reqs].sort((a, b) => `${a.definitionId ?? a.attribute}`.localeCompare(`${b.definitionId ?? b.attribute}`)) : [];
}

function versaoPublicada(automacao: Automation): AutomationVersion | undefined {
  return automacao.versions.find((v) => v.state === "publicada") ?? automacao.versions.at(-1);
}

/**
 * Comparação pura, sem banco — o que `conferir-contas-a-receber.test.ts`
 * exercita. `esperado` é o `DataState` produzido por
 * `applyContasAReceber(vazio, clock, { fixtures: false })`; `encontrado` é o
 * `DataState` hidratado de um Espaço de Trabalho real (ou, em teste, uma
 * cópia mutada do próprio `esperado`).
 */
export function compararContasAReceber(esperado: DataState, encontrado: DataState): RelatorioDeConferencia {
  const divergencias: DivergenciaDeConferencia[] = [];

  /* ── 1. Lista ──────────────────────────────────────────────────────── */
  const listaEsperada = esperado.lists.find((l) => l.id === CR.listId);
  const listaEncontrada = encontrado.lists.find((l) => l.id === CR.listId);
  if (!listaEsperada) {
    throw new Error(`Lista "${CR.listId}" ausente do catálogo esperado — bug no seed, não na conferência.`);
  }
  if (!listaEncontrada) {
    presenca(divergencias, "lista", CR.listId, "esperado");
  } else {
    compararPares(divergencias, "lista", CR.listId, [
      ["name", listaEsperada.name, listaEncontrada.name],
      ["parentId", listaEsperada.parentId, listaEncontrada.parentId],
    ]);
  }

  /* ── 2. Status ─────────────────────────────────────────────────────── */
  const statusEsperados = listaEsperada.statusSet!.definitions;
  const statusEncontrados = listaEncontrada?.statusSet?.definitions ?? [];
  let statusEncontradosCount = 0;
  for (const id of Object.values(CR.status)) {
    const e = statusEsperados.find((s) => s.id === id);
    const f = statusEncontrados.find((s) => s.id === id);
    if (!e) continue;
    if (!f) {
      presenca(divergencias, "status", id, "esperado");
      continue;
    }
    statusEncontradosCount += 1;
    compararPares(divergencias, "status", id, [
      ["name", e.name, f.name],
      ["color", e.color, f.color],
      ["category", e.category, f.category],
      ["order", String(e.order), String(f.order)],
      ["entryRequirements", canonico(ordenarRequisitos(e.entryRequirements)), canonico(ordenarRequisitos(f.entryRequirements))],
      ["entryFromStatusIds", canonico(ordenarIds(e.entryFromStatusIds)), canonico(ordenarIds(f.entryFromStatusIds))],
    ]);
  }

  /* ── 3. Campos ─────────────────────────────────────────────────────── */
  const campoIds = Object.values(CR.fields);
  let camposEncontradosCount = 0;
  for (const id of campoIds) {
    const e = esperado.fieldDefinitions.find((f) => f.id === id);
    const f = encontrado.fieldDefinitions.find((x) => x.id === id);
    if (!e) continue;
    if (!f) {
      presenca(divergencias, "campo", id, "esperado");
      continue;
    }
    camposEncontradosCount += 1;
    compararPares(divergencias, "campo", id, [
      ["name", e.name, f.name],
      ["type", e.type, f.type],
      ["required", String(e.required), String(f.required)],
      ["options", canonico(e.options ?? []), canonico(f.options ?? [])],
    ]);
  }

  /* ── 4. Automações ─────────────────────────────────────────────────── */
  let automacoesEncontradasCount = 0;
  for (const id of AUTOMACAO_IDS) {
    const e = esperado.automations.find((a) => a.id === id);
    const f = encontrado.automations.find((a) => a.id === id);
    if (!e) continue;
    if (!f) {
      presenca(divergencias, "automacao", id, "esperado");
      continue;
    }
    automacoesEncontradasCount += 1;
    compararPares(divergencias, "automacao", id, [
      ["lifecycle", e.lifecycle, f.lifecycle],
      ["scopeType", e.scopeType, f.scopeType],
      ["scopeId", e.scopeId, f.scopeId],
    ]);
    const ev = versaoPublicada(e);
    const fv = versaoPublicada(f);
    if (!ev) continue; // bug no seed, não na conferência
    if (!fv) {
      divergencias.push({ colecao: "automacao", id, campo: "versaoPublicada", esperado: "presente", encontrado: "ausente" });
      continue;
    }
    compararPares(divergencias, "automacao", id, [
      ["trigger.kind", ev.trigger?.kind ?? "", fv.trigger?.kind ?? ""],
      ["trigger.temporalPredicate", ev.trigger?.temporalPredicate ?? "", fv.trigger?.temporalPredicate ?? ""],
      ["trigger.eventSubtype", ev.trigger?.eventSubtype ?? "", fv.trigger?.eventSubtype ?? ""],
      ["conditions", canonico(ev.conditions), canonico(fv.conditions)],
      [
        "actions",
        canonico(ev.actions.map((a) => ({ order: a.order, toolId: a.toolId ?? null, controlKind: a.controlKind ?? null, params: JSON.parse(a.params) }))),
        canonico(fv.actions.map((a) => ({ order: a.order, toolId: a.toolId ?? null, controlKind: a.controlKind ?? null, params: JSON.parse(a.params) }))),
      ],
    ]);
  }

  /* ── 5. Concessões e Visões ligadas a CR.listId ───────────────────────
   * `esperado` (fixtures: false) não traz `gr_cr_diretoria` — essa Concessão
   * é fixture — então "esperadas" costuma ser zero; é o que a conferência
   * precisa acusar se produção tiver algo a mais ou a menos. */
  const grantsEsperados = esperado.grants.filter((g) => g.resourceId === CR.listId);
  const grantsEncontrados = encontrado.grants.filter((g) => g.resourceId === CR.listId);
  for (const g of grantsEsperados) {
    const f = grantsEncontrados.find((x) => x.id === g.id);
    if (!f) {
      presenca(divergencias, "concessao", g.id, "esperado");
      continue;
    }
    compararPares(divergencias, "concessao", g.id, [
      [
        "permissions",
        canonico({ subjectKind: g.subjectKind, subjectId: g.subjectId, action: g.action, resourceType: g.resourceType, scope: g.scope }),
        canonico({ subjectKind: f.subjectKind, subjectId: f.subjectId, action: f.action, resourceType: f.resourceType, scope: f.scope }),
      ],
    ]);
  }
  for (const f of grantsEncontrados) {
    if (!grantsEsperados.some((g) => g.id === f.id)) presenca(divergencias, "concessao", f.id, "encontrado");
  }

  const viewsEsperadas = esperado.views.filter((v) => v.listId === CR.listId);
  const viewsEncontradas = encontrado.views.filter((v) => v.listId === CR.listId);
  for (const v of viewsEsperadas) {
    const f = viewsEncontradas.find((x) => x.id === v.id);
    if (!f) {
      presenca(divergencias, "visao", v.id, "esperado");
      continue;
    }
    compararPares(divergencias, "visao", v.id, [
      ["name", v.name, f.name],
      ["filters", canonico(v.filters), canonico(f.filters)],
    ]);
  }
  for (const f of viewsEncontradas) {
    if (!viewsEsperadas.some((v) => v.id === f.id)) presenca(divergencias, "visao", f.id, "encontrado");
  }

  return {
    divergencias,
    contagens: {
      lista: { esperados: 1, encontrados: listaEncontrada ? 1 : 0 },
      status: { esperados: statusEsperados.length, encontrados: statusEncontradosCount },
      campos: { esperados: campoIds.length, encontrados: camposEncontradosCount },
      automacoes: { esperados: AUTOMACAO_IDS.length, encontrados: automacoesEncontradasCount },
      concessoes: { esperados: grantsEsperados.length, encontrados: grantsEncontrados.length },
      visoes: { esperados: viewsEsperadas.length, encontrados: viewsEncontradas.length },
    },
  };
}

/** Monta o `DataState` "esperado" do zero — só a configuração do processo, nada fictício (D-07), o mesmo molde de `estadoVazio()` em `bootstrap-gestao.ts`. */
function construirEsperado(workspaceId: Id): DataState {
  const colecoes = Object.fromEntries(COLECOES.map((c) => [c, [] as unknown[]])) as unknown as DataState;
  const agora = new Date().toISOString();
  const workspace: Workspace = {
    id: workspaceId,
    name: "conferência (nunca gravado)",
    state: "ativo",
    ownerMemberId: "mem_maryane",
    createdBy: "mem_maryane",
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
    defaultAgentId: "agt_padrao",
    defaultFunnelId: "fnl_padrao",
    suspensions: [],
  };
  const inbox: Inbox = { id: "inbox_conferencia", workspaceId, reopenWindowHours: 72, defaultDistribution: "manual" };
  const state: DataState = { ...colecoes, models: MODELOS_DA_PLATAFORMA, tools: TOOLS, workspace, inbox };
  applyContasAReceber(state, { at: () => agora, workspaceId }, { fixtures: false });
  return state;
}

/**
 * Abre a conexão, hidrata `workspaceId` DENTRO de uma transação, compara
 * contra o catálogo montado em memória, mede as três contagens operacionais
 * por SQL direto (só `select`) e SEMPRE dá `rollback` — mesmo quando nada
 * mudaria. Nunca grava.
 */
export async function conferirContasAReceber(opcoes: { readonly workspaceId: string }): Promise<RelatorioDeConferencia> {
  const { workspaceId } = opcoes;
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    const { state: encontrado } = await hidratar(cliente, workspaceId);

    const esperado = construirEsperado(workspaceId);
    const relatorio = compararContasAReceber(esperado, encontrado);

    const totalRes = await cliente.query<{ total: string; ultima: string | null }>(
      `select count(*)::text as total, max(dados->>'createdAt') as ultima
         from plataforma.registros
        where workspace_id = $1 and colecao = 'tasks' and list_id = $2`,
      [workspaceId, CR.listId],
    );
    const porStatusRes = await cliente.query<{ status_id: string | null; total: string }>(
      `select status_id, count(*)::text as total
         from plataforma.registros
        where workspace_id = $1 and colecao = 'tasks' and list_id = $2
        group by status_id
        order by status_id`,
      [workspaceId, CR.listId],
    );

    return {
      ...relatorio,
      operacional: {
        totalTarefas: Number(totalRes.rows[0]?.total ?? "0"),
        ultimaCriadaEm: totalRes.rows[0]?.ultima ?? null,
        porStatus: porStatusRes.rows.map((r) => ({
          statusId: r.status_id ?? "(sem status)",
          nome: r.status_id ? (NOME_DO_STATUS[r.status_id] ?? r.status_id) : "(sem status)",
          total: Number(r.total),
        })),
      },
    };
  } finally {
    await cliente.query("rollback").catch(() => undefined);
    cliente.release();
  }
}
