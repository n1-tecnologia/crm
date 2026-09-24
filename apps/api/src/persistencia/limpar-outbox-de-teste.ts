/**
 * Limpeza ESCOPADA de linhas `pending` que a suíte de testes deixou em
 * `plataforma.integration_outbox` (e em `plataforma.automacao_agenda`) do
 * Postgres REAL, quando um `afterAll`/`afterEach` não rodou até o fim — a
 * mesma classe de defeito de CR-07 (05-19): `scheduler-worker.test.ts`
 * deixava linhas `automacao.notificar-canal.v1` `pending`, que o outbox
 * worker de produção (`apps/api/src/index.ts`, sem filtro de Espaço) entrega
 * de verdade contra `/webhooks/plataforma/notificar-canal` com `taskId` de
 * teste.
 *
 * A Task 1 deste plano fechou a origem do vazamento em
 * `scheduler-worker.test.ts` (o arquivo agora limpa o que grava, no
 * `beforeAll` E no `afterAll`). Este módulo é o remédio para o que JÁ está
 * no banco — de qualquer um dos onze arquivos de teste que gravam em
 * `integration_outbox` (auditados nesta mesma Task, ver SUMMARY) — e para
 * qualquer execução futura que aborte antes do próprio `afterAll`.
 *
 * Três garantias estruturais (T-5-64, T-5-66):
 *   1. `ws_n1` NUNCA é alcançado — nem por prefixo (nenhum item de
 *      `PREFIXOS_DE_ESPACO_DE_TESTE` é prefixo de `"ws_n1"`) nem pelo SQL
 *      (`workspace_id <> 'ws_n1'` em toda consulta e em todo `delete`).
 *   2. `removerOrfaos` só age com `apply: true` explícito — sem a flag,
 *      lança ANTES de abrir transação. Dry-run é o padrão em
 *      `levantar-outbox-de-teste.cli.ts`.
 *   3. Nada aqui lê ou imprime `payload`, `taskId` ou id de linha — só
 *      contagens agregadas por prefixo (T-5-66).
 */

import type { PoolClient } from "pg";

/**
 * Prefixos de `workspace_id` confirmados por auditoria (05-19, Task 2) — cada
 * um é de um ou mais arquivos de teste que gravam em `integration_outbox`.
 * Nenhum é vazio, nenhum é prefixo de `"ws_n1"` (`ehEspacoDeTeste` também
 * recusa `ws_n1` por construção, mas a lista em si já não alcançaria).
 */
export const PREFIXOS_DE_ESPACO_DE_TESTE: readonly string[] = [
  // apps/api/src/automacoes/scheduler-worker.test.ts
  // (WORKSPACE, WORKSPACE_M, WORKSPACE_ENSAIO, WORKSPACE_CANAL_A/B/C — CR-07)
  "ws_agendaworker_",
  // apps/api/src/persistencia/outbox.test.ts E persistencia/outbox-worker.test.ts
  // (RUN = `outbox_...` e `outbox_worker_...` — os dois começam por este prefixo)
  "ws_outbox_",
  // apps/api/src/rotas/classificacoes.test.ts (`ws_teste_classificacoes_...`),
  // rotas/integracao-solicitacoes.test.ts (`ws_teste_integracao_solicitacoes_...`),
  // persistencia/integracao.test.ts (`ws_teste_integracao_...`),
  // importacao/clickup/importar-contas-a-receber.test.ts (`ws_teste_importar_cr_...`),
  // importacao/clickup/importar-contas-a-pagar.test.ts (`ws_teste_importar_cp_...`)
  "ws_teste_",
  // apps/api/src/rotas/formularios-publicos.test.ts (WS e WS_CANAL = `${WS}_canal`)
  "ws_formularios_publicos_",
  // apps/api/src/bootstrap/contas-a-receber.test.ts (WS, WS2 = `${WS}_prazo`, WS3 = `${WS}_saque`)
  "ws_cr_configurar_",
  // apps/api/src/rotas/operacoes.test.ts — literal fixo, sem sufixo aleatório
  // (WR-15-símile: duas execuções concorrentes colidem; fora do escopo deste plano)
  "ws_rotas_teste",
  // apps/api/src/bootstrap/configuracao-por-empresa.test.ts — literal fixo (WR-15)
  "ws_config_empresa_teste",
];

/** `false` para `"ws_n1"` sob qualquer configuração; `true` só para um `workspaceId` que comece por um prefixo confirmado. */
export function ehEspacoDeTeste(workspaceId: string): boolean {
  if (workspaceId === "ws_n1") return false;
  return PREFIXOS_DE_ESPACO_DE_TESTE.some((prefixo) => prefixo.length > 0 && workspaceId.startsWith(prefixo));
}

function prefixoDe(workspaceId: string): string {
  return PREFIXOS_DE_ESPACO_DE_TESTE.find((prefixo) => workspaceId.startsWith(prefixo)) ?? workspaceId;
}

export interface ContagemPorPrefixo {
  readonly prefixo: string;
  readonly quantidade: number;
}

export interface LevantamentoDeOrfaos {
  /** Linhas `pending` de `integration_outbox`, agregadas por prefixo de Espaço de teste. */
  readonly outboxPorPrefixo: readonly ContagemPorPrefixo[];
  readonly totalOutbox: number;
  /** Linhas de `automacao_agenda` (qualquer estado), agregadas por prefixo de Espaço de teste. */
  readonly automacaoAgendaPorPrefixo: readonly ContagemPorPrefixo[];
  readonly totalAutomacaoAgenda: number;
  /** Contagem de `pending` de `ws_n1` — para comparar antes/depois; NUNCA entra no filtro de remoção. */
  readonly pendingDeWsN1: number;
}

function agregarPorPrefixo(linhas: ReadonlyArray<{ readonly workspaceId: string; readonly quantidade: number }>): ContagemPorPrefixo[] {
  const porPrefixo = new Map<string, number>();
  for (const linha of linhas) {
    const prefixo = prefixoDe(linha.workspaceId);
    porPrefixo.set(prefixo, (porPrefixo.get(prefixo) ?? 0) + linha.quantidade);
  }
  return [...porPrefixo.entries()]
    .map(([prefixo, quantidade]) => ({ prefixo, quantidade }))
    .sort((a, b) => a.prefixo.localeCompare(b.prefixo));
}

/**
 * Só LEITURA — nunca remove nada. Agrupa `integration_outbox` (`status =
 * 'pending'`) e `automacao_agenda`, os dois restritos a
 * `workspace_id <> 'ws_n1'` e a `workspace_id like any(prefixos)`. Nunca
 * seleciona `payload`, `taskId` nem id de linha — só o necessário para
 * decidir se a remoção é segura (Espaço, tipo de evento, status, tentativas,
 * contagem).
 */
export async function levantarOrfaos(cliente: PoolClient): Promise<LevantamentoDeOrfaos> {
  const prefixosLike = PREFIXOS_DE_ESPACO_DE_TESTE.map((prefixo) => `${prefixo}%`);

  const outbox = await cliente.query<{ workspace_id: string; event_type: string; status: string; attempts: number; n: string }>(
    `select workspace_id, event_type, status, attempts, count(*)::text as n
       from plataforma.integration_outbox
      where status = 'pending'
        and workspace_id <> 'ws_n1'
        and workspace_id like any($1)
      group by workspace_id, event_type, status, attempts`,
    [prefixosLike],
  );

  const agenda = await cliente.query<{ workspace_id: string; n: string }>(
    `select workspace_id, count(*)::text as n
       from plataforma.automacao_agenda
      where workspace_id <> 'ws_n1'
        and workspace_id like any($1)
      group by workspace_id`,
    [prefixosLike],
  );

  const wsN1 = await cliente.query<{ n: string }>(
    `select count(*)::text as n from plataforma.integration_outbox where workspace_id = 'ws_n1' and status = 'pending'`,
  );

  const linhasOutbox = outbox.rows.map((linha) => ({ workspaceId: linha.workspace_id, quantidade: Number(linha.n) }));
  const linhasAgenda = agenda.rows.map((linha) => ({ workspaceId: linha.workspace_id, quantidade: Number(linha.n) }));

  return {
    outboxPorPrefixo: agregarPorPrefixo(linhasOutbox),
    totalOutbox: linhasOutbox.reduce((soma, linha) => soma + linha.quantidade, 0),
    automacaoAgendaPorPrefixo: agregarPorPrefixo(linhasAgenda),
    totalAutomacaoAgenda: linhasAgenda.reduce((soma, linha) => soma + linha.quantidade, 0),
    pendingDeWsN1: Number(wsN1.rows[0]?.n ?? "0"),
  };
}

export interface RemocaoDeOrfaos {
  readonly outboxRemovidas: number;
  readonly automacaoAgendaRemovidas: number;
}

/**
 * Remove, numa única transação, o MESMO recorte que `levantarOrfaos` lê —
 * `pending` de `integration_outbox` e as linhas de `automacao_agenda` dos
 * mesmos Espaços de teste. Recusa (lança) sem `apply: true`, antes de abrir
 * a transação — nunca um dry-run acidental que grava.
 */
export async function removerOrfaos(cliente: PoolClient, opcoes: { readonly apply: boolean }): Promise<RemocaoDeOrfaos> {
  if (opcoes.apply !== true) {
    throw new Error("removerOrfaos recusa rodar sem { apply: true } — para conferir sem remover, use levantarOrfaos().");
  }
  const prefixosLike = PREFIXOS_DE_ESPACO_DE_TESTE.map((prefixo) => `${prefixo}%`);

  await cliente.query("begin");
  try {
    const outbox = await cliente.query(
      `delete from plataforma.integration_outbox
        where status = 'pending'
          and workspace_id <> 'ws_n1'
          and workspace_id like any($1)`,
      [prefixosLike],
    );
    const agenda = await cliente.query(
      `delete from plataforma.automacao_agenda
        where workspace_id <> 'ws_n1'
          and workspace_id like any($1)`,
      [prefixosLike],
    );
    await cliente.query("commit");
    return { outboxRemovidas: outbox.rowCount ?? 0, automacaoAgendaRemovidas: agenda.rowCount ?? 0 };
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  }
}
