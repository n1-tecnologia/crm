/**
 * O relógio do motor de Automações (AUTO-01) — item Wave 0 de
 * `03-VALIDATION.md`. Prova o critério 3 do ROADMAP ("se o processo cair no
 * minuto errado, a agenda não é pulada") sem esperar tempo real: todo
 * instante vem de `relogioFixo` (`../testes/relogio.ts`), no molde de
 * `../persistencia/outbox-worker.test.ts`.
 *
 * Casos (a)-(e) são puros — não tocam banco, rodam sempre. (s) também roda
 * sempre — só valida argumentos de `liberar.cli.ts`, antes de qualquer I/O.
 * Os demais precisam de Postgres real com a migração `005` aplicada e pulam
 * sem `DATABASE_URL` (D-DEC-09). (f)-(l) usam uma espiã de `rodarAgenda`
 * (nunca o domínio de verdade) para controlar exatamente o que cada chamada
 * devolve; (m) usa `runScheduledAutomations` real para provar que a
 * idempotência de negócio é do domínio, não deste worker. (n)-(r) provam o
 * gate da primeira volta em ensaio (Task 2, D3-03): `MARCO_ZERO`, o ensaio em
 * si e a liberação explícita.
 */

import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "@n1/dominio/bootstrap-gestao";
import { evoluirConfiguracaoPorEmpresa } from "@n1/dominio/configuracao-por-empresa-evolver";
import { CP, CR } from "@n1/dominio/operations/financeiro";
import { CANAL_CAMPO_EMPRESA_ID, CANAL_CAMPO_WHATSAPP_ID, CANAL_LISTA_ID } from "@n1/dominio/operations/automations";
import { createTask, setTaskFieldValue } from "@n1/dominio/operations/tasks";
import type { DataState, Id, OperationResult } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { SOL } from "@n1/dominio/solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { semear as semearEstadoInteiro } from "../persistencia/repositorio";
import { describeComBanco, novoEspacoDeTeste, prepararBancoCrm, temBancoCrm } from "../testes/banco-crm";
import { relogioFixo } from "../testes/relogio";
import {
  CODIGOS_DA_AGENDA,
  criarSchedulerWorker as criarSchedulerWorkerDaFase10,
  dataCivil,
  diasCiveisPendentes,
  liberarLista,
  type OpcoesSchedulerWorker,
  type RodarAgenda,
  type SchedulerWorker,
} from "./scheduler-worker";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

// Os casos de Postgres deste arquivo precisam das migrações aplicadas (005 em
// diante). `prepararBancoCrm` só roda contra Postgres LOCAL e lança fora dele
// (T-07-08) — por isso o `if`: contra o banco remoto do `.env` nada migra.
beforeAll(async () => {
  if (temBancoCrm) await prepararBancoCrm();
});

/**
 * 10-05 — os casos (a)-(s) são ANTERIORES à escolha do ator e do regime por
 * Lista: rodam uma espiã de `rodarAgenda` sobre um Espaço vazio (sem Membro
 * nenhum), onde o ator é o preferido que o teste injeta e a primeira volta é
 * sempre ensaio. Este invólucro devolve a esses casos exatamente esse
 * comportamento, pelos pontos de extensão `escolherAtor`/`escolherRegime`,
 * sem mexer em nenhuma das chamadas antigas. Os casos da Fase 10 (bloco
 * `describeComBanco` no fim do arquivo) usam `criarSchedulerWorkerDaFase10`, o
 * worker com as escolhas de verdade.
 */
function criarSchedulerWorker(opcoes: OpcoesSchedulerWorker): SchedulerWorker {
  return criarSchedulerWorkerDaFase10({
    escolherAtor: (_state, _listId, preferidoId) => preferidoId,
    escolherRegime: () => "ensaio",
    ...opcoes,
  });
}

/* ── (a)-(e) — puras, sem banco, rodam sempre ────────────────────────────── */

describe("dataCivil / diasCiveisPendentes — puras (03-VALIDATION.md § Sampling Risk)", () => {
  it("(a) sem ultimoDia, devolve só o dia civil de hoje: uma (Espaço, Lista) nova começa hoje", () => {
    const hoje = new Date(2026, 8, 2);
    expect(diasCiveisPendentes(undefined, hoje, 7)).toEqual(["2026-09-02"]);
  });

  it("(b) com ultimoDia, devolve os dias em ordem crescente — o dia em que o processo esteve fora está na lista", () => {
    expect(diasCiveisPendentes("2026-08-31", new Date(2026, 8, 2), 7)).toEqual(["2026-09-01", "2026-09-02"]);
  });

  it("(c) a janela limita TRABALHO, não corretude: 7 dias, terminando no dia de hoje", () => {
    const dias = diasCiveisPendentes("2026-06-01", new Date(2026, 8, 2), 7);
    expect(dias).toHaveLength(7);
    expect(dias.at(-1)).toBe("2026-09-02");
  });

  it("(d) o dia já semeado não nasce de novo", () => {
    const hoje = new Date(2026, 8, 2);
    expect(diasCiveisPendentes("2026-09-02", hoje, 7)).toEqual([]);
  });

  it("(e) dataCivil nasce do construtor numérico — a armadilha de fuso", () => {
    const data = dataCivil("2026-08-31");
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(7);
    expect(data.getDate()).toBe(31);
    // Um `Date` construído a partir da string de dia civil diretamente seria
    // lido como meia-noite UTC, que em América/São_Paulo (UTC-3) cai no dia
    // anterior — por isso `dataCivil()` nunca recebe o dia por esse caminho,
    // e converte sempre pelo construtor numérico de `Date` (achado de 03-02).
  });
});

describe("liberar.cli.ts — validação de argumentos (sem banco)", () => {
  const viteNode = fileURLToPath(new URL("../../../../node_modules/.bin/vite-node", import.meta.url));
  const cli = fileURLToPath(new URL("./liberar.cli.ts", import.meta.url));

  function rodarCli(argumentos: readonly string[]): { readonly codigo: number; readonly saida: string } {
    try {
      const saida = execFileSync(viteNode, [cli, ...argumentos], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return { codigo: 0, saida };
    } catch (erro) {
      const falha = erro as { readonly status?: number; readonly stderr?: string; readonly stdout?: string };
      return { codigo: falha.status ?? 1, saida: `${falha.stdout ?? ""}${falha.stderr ?? ""}` };
    }
  }

  it("(s) sem argumentos, termina com código diferente de zero e uma mensagem que diz o que falta", () => {
    const { codigo, saida } = rodarCli([]);
    expect(codigo).not.toBe(0);
    expect(saida).toContain("uso:");
    expect(saida).toContain("automacoes:liberar");
  }, 20_000);
});

/* ── (f)-(m) — precisam de Postgres real com a migração 005 aplicada ────── */

const RUN = `agendaworker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;
const WORKSPACE_M = `ws_${RUN}_m`;

async function prepararWorkspaceVazio(workspaceId: string): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [workspaceId]);
  } finally {
    cliente.release();
  }
}

/**
 * CR-07 (05-19, 2026-09-24): o caso Canal A ("Canal por agenda") grava de
 * propósito uma linha `automacao.notificar-canal.v1` `pending` em
 * `plataforma.integration_outbox` — sem este `delete`, ela sobrevivia a cada
 * execução da suíte (não há FK que barre o `delete` do Espaço) e o outbox
 * worker de produção (`apps/api/src/index.ts:98`, sem filtro de Espaço)
 * entregava contra `/webhooks/plataforma/notificar-canal` com `taskId` de
 * teste. Em 2026-09-24 havia 9 linhas assim acumuladas. Mesma classe do
 * defeito já corrigido em `operacoes.test.ts` (commit `1923892`).
 */
async function limparWorkspace(workspaceId: string): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [workspaceId]);
    await cliente.query("delete from plataforma.automacao_agenda where workspace_id = $1", [workspaceId]);
    await cliente.query("delete from plataforma.registros where workspace_id = $1", [workspaceId]);
    await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [workspaceId]);
  } finally {
    cliente.release();
  }
}

/** Automação mínima de agenda: só o que `catalogoDeListasComAgenda` lê. */
async function inserirAutomacaoDeAgenda(workspaceId: string, listId: string, automationId: string): Promise<void> {
  const dados = {
    id: automationId,
    lifecycle: "ativo",
    scopeType: "list",
    scopeId: listId,
    name: "Automação de teste (03-08)",
    description: "",
    ownerMemberId: "mem_teste",
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        trigger: { kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: 0 }) },
        conditions: [],
        actions: [],
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
  const cliente = await pool().connect();
  try {
    await cliente.query(
      `insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'automations', $2, $3::jsonb)`,
      [workspaceId, automationId, JSON.stringify(dados)],
    );
  } finally {
    cliente.release();
  }
}

async function inserirLinhaDeAgenda(
  workspaceId: string,
  listId: string,
  diaCivil: string,
  estado: "pendente" | "processando" | "falhou",
  extra: { readonly lockedAt?: string; readonly lockedBy?: string; readonly tentativas?: number } = {},
): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query(
      `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil, estado, locked_at, locked_by, tentativas)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [workspaceId, listId, diaCivil, estado, extra.lockedAt ?? null, extra.lockedBy ?? null, extra.tentativas ?? 0],
    );
  } finally {
    cliente.release();
  }
}

interface LinhaLida {
  readonly estado: string;
  readonly tentativas: number;
  readonly locked_at: string | null;
  readonly locked_by: string | null;
  readonly last_error_code: string | null;
  readonly last_error_summary: string | null;
  readonly executadas: number | null;
  readonly falhadas: number | null;
  readonly puladas: number | null;
  readonly concluido_em: string | null;
}

async function lerLinhaDaAgenda(workspaceId: string, listId: string, diaCivil: string): Promise<LinhaLida> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<LinhaLida>(
      `select estado, tentativas, locked_at, locked_by, last_error_code, last_error_summary, executadas, falhadas, puladas, concluido_em
         from plataforma.automacao_agenda
        where workspace_id = $1 and list_id = $2 and dia_civil = $3`,
      [workspaceId, listId, diaCivil],
    );
    if (!r.rows[0]) throw new Error(`sem linha para ${workspaceId}/${listId}/${diaCivil}`);
    return r.rows[0];
  } finally {
    cliente.release();
  }
}

async function listarDiasDaAgenda(workspaceId: string, listId: string): Promise<Array<{ dia_civil: string; estado: string }>> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ dia_civil: string; estado: string }>(
      `select to_char(dia_civil, 'YYYY-MM-DD') as dia_civil, estado
         from plataforma.automacao_agenda
        where workspace_id = $1 and list_id = $2
        order by dia_civil`,
      [workspaceId, listId],
    );
    return r.rows;
  } finally {
    cliente.release();
  }
}

async function contarLinhasDaAgenda(workspaceId: string, listId: string): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ n: string }>(
      `select count(*)::text as n from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2`,
      [workspaceId, listId],
    );
    return Number(r.rows[0]?.n ?? "0");
  } finally {
    cliente.release();
  }
}

type ContagemDaAgenda = { readonly executed: number; readonly failed: number; readonly skipped: number };
type FalhaDaAgenda = { readonly taskId: Id; readonly title: string; readonly reason: string };

interface ChamadaDaAgenda {
  readonly listId: Id;
  readonly diaCivil: string;
}

/**
 * Uma `RodarAgenda` de mentira: registra cada chamada `(listId, diaCivil)` e
 * devolve o resultado programado, sem tocar `state`. É ela que torna
 * determinísticos o lease, a ordem do catch-up e o não-vazamento (T-3-04).
 */
function criarEspiaDeAgenda(
  programado: () => OperationResult<ContagemDaAgenda & { readonly failures: readonly FalhaDaAgenda[] }>,
): { readonly rodarAgenda: RodarAgenda; readonly chamadas: ChamadaDaAgenda[] } {
  const chamadas: ChamadaDaAgenda[] = [];
  const rodarAgenda: RodarAgenda = (_state: DataState, _atorId: Id, listId: Id, diaCivilData: Date) => {
    const diaCivil = `${diaCivilData.getFullYear()}-${String(diaCivilData.getMonth() + 1).padStart(2, "0")}-${String(diaCivilData.getDate()).padStart(2, "0")}`;
    chamadas.push({ listId, diaCivil });
    return programado();
  };
  return { rodarAgenda, chamadas };
}

const atorDeTeste = async (): Promise<Id> => "mem_teste";

d("scheduler-worker (Postgres real) — (f)-(l) com espiã, (m) com o domínio de verdade", () => {
  beforeAll(async () => {
    // Defensivo (CR-07): uma execução anterior morta pelo watchdog de 600s
    // não chega ao `afterAll` — limpa os dois Espaços deste bloco antes de
    // semear de novo, para nada órfão sobreviver entre execuções.
    await limparWorkspace(WORKSPACE);
    await limparWorkspace(WORKSPACE_M);
    await prepararWorkspaceVazio(WORKSPACE);
  });

  afterEach(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.automacao_agenda where workspace_id = $1", [WORKSPACE]);
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WORKSPACE]);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    await limparWorkspace(WORKSPACE);
    await limparWorkspace(WORKSPACE_M);
    await encerrar();
  });

  it("(f) semear() cria uma linha pendente por (Espaço, Lista com Automação de agenda, dia civil de hoje); duplicar não duplica", async () => {
    const listId = `lst_teste_${randomUUID()}`;
    const automationId = `aut_teste_${randomUUID()}`;
    await inserirAutomacaoDeAgenda(WORKSPACE, listId, automationId);

    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const worker = criarSchedulerWorker({ workerId: "w_f", workspaceId: WORKSPACE, relogio });

    expect(await worker.semear()).toBe(1);
    expect(await worker.semear()).toBe(0); // a PK (workspace_id, list_id, dia_civil) é quem garante — `on conflict do nothing`
    expect(await contarLinhasDaAgenda(WORKSPACE, listId)).toBe(1);

    const linha = await lerLinhaDaAgenda(WORKSPACE, listId, "2026-08-31");
    expect(linha.estado).toBe("pendente");
  });

  it("(f2) Plan 05-10 Task 4 — CR.listId é descoberto por catalogoDeListasComAgenda sem nenhuma linha nova no motor, ao lado de CP.listId", async () => {
    // Nenhum código novo: `catalogoDeListasComAgenda` (scheduler-worker.ts)
    // varre `colecao = 'automations'` por SQL, sem lista hardcoded — este
    // caso só PROVA isso para `CR.listId`, com o molde exato de
    // `inserirAutomacaoDeAgenda` que (f) já usa para uma Lista qualquer.
    // aut_cr_r2/aut_cr_r4/aut_cr_r5 publicadas (o mesmo trigger
    // `condicaoTemporal` que `seed-contas-a-receber.ts` grava) fazem
    // `CR.listId` aparecer no catálogo — junto de `CP.listId`, que já está
    // em produção desde a Fase 1 e usa o MESMO caminho de descoberta.
    await inserirAutomacaoDeAgenda(WORKSPACE, CP.listId, "aut_cp_teste_05_10");
    await inserirAutomacaoDeAgenda(WORKSPACE, CR.listId, "aut_cr_r2");
    await inserirAutomacaoDeAgenda(WORKSPACE, CR.listId, "aut_cr_r4");
    await inserirAutomacaoDeAgenda(WORKSPACE, CR.listId, "aut_cr_r5");

    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const worker = criarSchedulerWorker({ workerId: "w_f2", workspaceId: WORKSPACE, relogio });

    // Uma linha por (Espaço, Lista) do catálogo — não uma por Automação:
    // as três Automações de CR.listId contam como UMA Lista candidata.
    expect(await worker.semear()).toBe(2);
    expect(await contarLinhasDaAgenda(WORKSPACE, CP.listId)).toBe(1);
    expect(await contarLinhasDaAgenda(WORKSPACE, CR.listId)).toBe(1);

    const linhaCR = await lerLinhaDaAgenda(WORKSPACE, CR.listId, "2026-08-31");
    expect(linhaCR.estado).toBe("pendente");
  });

  it("(g) processarUm() reivindica UMA linha, chama a agenda com o dia civil DAQUELA linha e fecha 'concluido' com as contagens", async () => {
    const listId = `lst_teste_${randomUUID()}`;
    await inserirLinhaDeAgenda(WORKSPACE, listId, "2026-08-31", "pendente");
    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const { rodarAgenda, chamadas } = criarEspiaDeAgenda(() => ({ ok: true, value: { executed: 2, failed: 0, skipped: 1, failures: [] } }));
    // ensaioNaPrimeiraVolta: false — este caso prova o fechamento normal da
    // linha, não o gate de ensaio (Task 2 cobre o ensaio nos casos (n)-(s)).
    const worker = criarSchedulerWorker({ workerId: "w_g", workspaceId: WORKSPACE, relogio, resolverAtor: atorDeTeste, rodarAgenda, ensaioNaPrimeiraVolta: false });

    expect(await worker.processarUm()).toBe(true);
    expect(chamadas).toEqual([{ listId, diaCivil: "2026-08-31" }]);

    const linha = await lerLinhaDaAgenda(WORKSPACE, listId, "2026-08-31");
    expect(linha.estado).toBe("concluido");
    expect(linha.executadas).toBe(2);
    expect(linha.falhadas).toBe(0);
    expect(linha.puladas).toBe(1);
    expect(linha.concluido_em).not.toBeNull();
    expect(linha.last_error_code).toBeNull();
  });

  it("(h) O CRITÉRIO 3 — o dia perdido é reivindicado ao voltar, com a SUA data civil, na ordem do catch-up", async () => {
    const listId = `lst_teste_${randomUUID()}`;
    const automationId = `aut_teste_${randomUUID()}`;
    await inserirAutomacaoDeAgenda(WORKSPACE, listId, automationId);

    const dia = (ano: number, mes: number, diaDoMes: number, hora = 0): Date => new Date(ano, mes, diaDoMes, hora);
    const relogio = relogioFixo(dia(2026, 7, 31, 12));
    const { rodarAgenda, chamadas } = criarEspiaDeAgenda(() => ({ ok: true, value: { executed: 1, failed: 0, skipped: 0, failures: [] } }));
    // ensaioNaPrimeiraVolta: false — este caso prova o catch-up do critério 3,
    // não o gate de ensaio (Task 2 cobre o ensaio nos casos (n)-(s)).
    const worker = criarSchedulerWorker({ workerId: "w_h", workspaceId: WORKSPACE, relogio, resolverAtor: atorDeTeste, rodarAgenda, ensaioNaPrimeiraVolta: false });

    await worker.semear();
    expect(await worker.processarUm()).toBe(true); // fecha 31/08

    // O processo esteve fora o dia 1º de setembro inteiro.
    relogio.definir(dia(2026, 8, 2, 9));

    await worker.semear(); // semeia 2026-09-01 e 2026-09-02
    expect(await worker.processarUm()).toBe(true); // fecha o dia mais antigo em aberto primeiro
    expect(await worker.processarUm()).toBe(true); // fecha o segundo
    expect(await worker.processarUm()).toBe(false); // nada mais a reivindicar

    expect(chamadas.map((c) => c.diaCivil)).toEqual(["2026-08-31", "2026-09-01", "2026-09-02"]);
    expect(dataCivil("2026-09-01")).toEqual(dia(2026, 8, 1)); // o dia perdido, no formato que a linha grava

    const dias = await listarDiasDaAgenda(WORKSPACE, listId);
    expect(dias.map((l) => l.dia_civil)).toEqual(["2026-08-31", "2026-09-01", "2026-09-02"]);
    expect(dias.every((l) => l.estado === "concluido")).toBe(true);
  });

  it("(i) lease vencida: 'processando' velho volta a 'falhou' com LEASE_EXPIRADO e é reivindicada de novo; um 'processando' recente NÃO é tocado", async () => {
    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const listVencida = `lst_vencida_${randomUUID()}`;
    const listRecente = `lst_recente_${randomUUID()}`;

    // Vencida: locked_at 20min atrás, leaseMs padrão 15min; tentativas no teto
    // para que, ao voltar a 'falhou', NÃO seja reivindicada dentro do mesmo
    // processarUm() — isolando a prova de "recuperarTravadas() agiu sozinha".
    await inserirLinhaDeAgenda(WORKSPACE, listVencida, "2026-08-30", "processando", {
      lockedAt: new Date(2026, 7, 31, 11, 40).toISOString(),
      lockedBy: "instancia_morta",
      tentativas: 3,
    });
    // Recente: locked_at 2min atrás — dentro do lease, ninguém deve tocar.
    await inserirLinhaDeAgenda(WORKSPACE, listRecente, "2026-08-30", "processando", {
      lockedAt: new Date(2026, 7, 31, 11, 58).toISOString(),
      lockedBy: "instancia_viva",
      tentativas: 0,
    });

    const { rodarAgenda } = criarEspiaDeAgenda(() => ({ ok: true, value: { executed: 0, failed: 0, skipped: 0, failures: [] } }));
    const worker = criarSchedulerWorker({ workerId: "w_i", workspaceId: WORKSPACE, relogio, resolverAtor: atorDeTeste, rodarAgenda, maxTentativas: 3 });

    expect(await worker.processarUm()).toBe(false); // vencida excluída por tentativas; recente não é pendente/falhou

    const vencida = await lerLinhaDaAgenda(WORKSPACE, listVencida, "2026-08-30");
    expect(vencida.estado).toBe("falhou");
    expect(vencida.last_error_code).toBe("LEASE_EXPIRADO");
    expect(vencida.locked_by).toBeNull();
    expect(vencida.locked_at).toBeNull();

    const recente = await lerLinhaDaAgenda(WORKSPACE, listRecente, "2026-08-30");
    expect(recente.estado).toBe("processando");
    expect(recente.locked_by).toBe("instancia_viva");
    expect(recente.tentativas).toBe(0);

    // Com cota de tentativas, a linha devolvida volta a ser reivindicável —
    // "é reivindicada de novo na volta seguinte".
    const cliente = await pool().connect();
    try {
      await cliente.query(
        "update plataforma.automacao_agenda set tentativas = 0 where workspace_id = $1 and list_id = $2",
        [WORKSPACE, listVencida],
      );
    } finally {
      cliente.release();
    }
    expect(await worker.processarUm()).toBe(true);
    const retomada = await lerLinhaDaAgenda(WORKSPACE, listVencida, "2026-08-30");
    expect(retomada.estado).toBe("concluido");
  });

  it("(j) duas instâncias simultâneas sobre a mesma linha pendente: só uma processa, a espiã é chamada uma vez só", async () => {
    const listId = `lst_teste_${randomUUID()}`;
    await inserirLinhaDeAgenda(WORKSPACE, listId, "2026-08-31", "pendente");
    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const { rodarAgenda, chamadas } = criarEspiaDeAgenda(() => ({ ok: true, value: { executed: 0, failed: 0, skipped: 0, failures: [] } }));
    const workerA = criarSchedulerWorker({ workerId: "w_j_a", workspaceId: WORKSPACE, relogio, resolverAtor: atorDeTeste, rodarAgenda });
    const workerB = criarSchedulerWorker({ workerId: "w_j_b", workspaceId: WORKSPACE, relogio, resolverAtor: atorDeTeste, rodarAgenda });

    const [a, b] = await Promise.all([workerA.processarUm(), workerB.processarUm()]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(chamadas).toHaveLength(1);
  });

  it("(k) recusa do domínio fecha 'falhou' com RECUSA_DO_DOMINIO; ao atingir maxTentativas a linha para de ser reivindicada", async () => {
    const listId = `lst_teste_${randomUUID()}`;
    await inserirLinhaDeAgenda(WORKSPACE, listId, "2026-08-31", "pendente");
    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const { rodarAgenda } = criarEspiaDeAgenda(() => ({ ok: false, error: "Configurar a Estrutura exige administrar o contêiner: Administrador, Proprietário ou concessão direta." }) as OperationResult<ContagemDaAgenda & { failures: readonly FalhaDaAgenda[] }>);
    const worker = criarSchedulerWorker({ workerId: "w_k", workspaceId: WORKSPACE, relogio, resolverAtor: atorDeTeste, rodarAgenda, maxTentativas: 1 });

    expect(await worker.processarUm()).toBe(true);
    const linha = await lerLinhaDaAgenda(WORKSPACE, listId, "2026-08-31");
    expect(linha.estado).toBe("falhou");
    expect(linha.last_error_code).toBe("RECUSA_DO_DOMINIO");
    expect(linha.last_error_summary ?? "").toContain("administrar o contêiner");

    // maxTentativas: 1 já foi consumida — nenhuma cota sobra.
    expect(await worker.processarUm()).toBe(false);
  });

  it("(l) T-3-04 — nem last_error_summary nem o que chega a registrar() contêm título de Tarefa ou o texto de reason", async () => {
    const listId = `lst_teste_${randomUUID()}`;
    await inserirLinhaDeAgenda(WORKSPACE, listId, "2026-08-31", "pendente");
    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const mensagensRegistradas: string[] = [];
    const { rodarAgenda } = criarEspiaDeAgenda(() => ({
      ok: true,
      value: {
        executed: 0,
        failed: 1,
        skipped: 0,
        failures: [{ taskId: "tsk_x", title: "Fornecedor Acme LTDA", reason: "CNPJ 12.345.678/0001-99 pendente de anexo" }],
      },
    }));
    const worker = criarSchedulerWorker({
      workerId: "w_l",
      workspaceId: WORKSPACE,
      relogio,
      resolverAtor: atorDeTeste,
      rodarAgenda,
      registrar: (_nivel, mensagem) => {
        mensagensRegistradas.push(mensagem);
      },
    });

    expect(await worker.processarUm()).toBe(true);

    const linha = await lerLinhaDaAgenda(WORKSPACE, listId, "2026-08-31");
    expect(linha.last_error_summary ?? "").not.toContain("Fornecedor Acme LTDA");
    expect(linha.last_error_summary ?? "").not.toContain("12.345.678/0001-99");
    expect(mensagensRegistradas.join("\n")).not.toContain("Fornecedor Acme LTDA");
    expect(mensagensRegistradas.join("\n")).not.toContain("12.345.678/0001-99");
  });

  it("(m) ponta a ponta com runScheduledAutomations real — a idempotência é do domínio, o worker não a duplica", async () => {
    const hoje = new Date(2026, 7, 31, 12);
    const vencimentoCivil = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

    const estado = buildGestaoBootstrap({ workspaceId: WORKSPACE_M });
    const criacao = createTask(estado, CP.financeiroId, {
      listId: CP.listId,
      title: "Conta de teste ponta a ponta (03-08)",
      statusId: CP.status.paraPagar,
      dueDate: { form: "civilDay", value: vencimentoCivil },
    });
    expect(criacao.ok).toBe(true);
    if (!criacao.ok) return;
    // Pessoa preenchida e Anexo vazio (nunca setado) satisfazem as condições de A5.
    const pessoa = setTaskFieldValue(estado, CP.financeiroId, criacao.value.id, CP.fields.pessoa, CP.financeiroId);
    expect(pessoa.ok).toBe(true);

    const cliente = await pool().connect();
    try {
      await cliente.query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [WORKSPACE_M]);
      await semearEstadoInteiro(cliente, WORKSPACE_M, estado);
    } finally {
      cliente.release();
    }

    const relogio = relogioFixo(hoje);
    // O Membro Proprietário que o bootstrap cria (`CP.financeiroId`) já tem
    // `administrar` concedido sobre o Espaço "Gestão" — sem depender de
    // existir um Agente do pipeline neste Espaço de teste isolado.
    // ensaioNaPrimeiraVolta: false — este caso prova a idempotência do
    // DOMÍNIO ponta a ponta; o gate de ensaio em si é o dos casos (n)-(s).
    const worker = criarSchedulerWorker({
      workerId: "w_m",
      workspaceId: WORKSPACE_M,
      relogio,
      resolverAtor: async () => CP.financeiroId,
      ensaioNaPrimeiraVolta: false,
    });

    expect(await worker.semear()).toBeGreaterThan(0);
    expect(await worker.processarUm()).toBe(true);

    const primeira = await lerLinhaDaAgenda(WORKSPACE_M, CP.listId, vencimentoCivil);
    expect(primeira.estado).toBe("concluido");
    expect(primeira.executadas).toBeGreaterThan(0);
    expect(primeira.last_error_code).toBeNull();

    // Segunda volta do MESMO dia civil: reabrimos a linha para exercitar
    // `runScheduledAutomations` de novo sobre o mesmo estado — se a
    // idempotência fosse deste worker (e não do domínio), ela dispararia de
    // novo. `jaRodou` (AutomationExecution) é quem barra.
    const clienteReabre = await pool().connect();
    try {
      await clienteReabre.query(
        "update plataforma.automacao_agenda set estado = 'pendente' where workspace_id = $1 and list_id = $2 and dia_civil = $3",
        [WORKSPACE_M, CP.listId, vencimentoCivil],
      );
    } finally {
      clienteReabre.release();
    }
    expect(await worker.processarUm()).toBe(true);
    const segunda = await lerLinhaDaAgenda(WORKSPACE_M, CP.listId, vencimentoCivil);
    expect(segunda.executadas).toBe(0);
    expect(segunda.puladas).toBeGreaterThan(0);
  });
});

/* ── (n)-(r) — o gate da primeira volta em ensaio (Task 2, D3-03) ────────── */

const WORKSPACE_ENSAIO = `ws_${RUN}_ensaio`;

async function lerRevisao(workspaceId: string): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ revisao: string }>(
      "select revisao from plataforma.workspaces where workspace_id = $1",
      [workspaceId],
    );
    if (!r.rows[0]) throw new Error(`sem Espaço ${workspaceId}`);
    return Number(r.rows[0].revisao);
  } finally {
    cliente.release();
  }
}

d("primeira volta sobre o backlog importado — MARCO_ZERO, ensaio e liberação (Task 2)", () => {
  beforeAll(async () => {
    // Defensivo (CR-07): ver o comentário equivalente no bloco (f)-(m).
    await limparWorkspace(WORKSPACE_ENSAIO);
    await prepararWorkspaceVazio(WORKSPACE_ENSAIO);
  });

  afterEach(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.automacao_agenda where workspace_id = $1", [WORKSPACE_ENSAIO]);
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WORKSPACE_ENSAIO]);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    await limparWorkspace(WORKSPACE_ENSAIO);
    await encerrar();
  });

  it("(n) primeira volta em ensaio: o cálculo acontece, fecha 'concluido' com ENSAIO_PRIMEIRA_VOLTA e as contagens do que TERIA acontecido — nada é gravado", async () => {
    const listId = `lst_ensaio_${randomUUID()}`;
    await inserirLinhaDeAgenda(WORKSPACE_ENSAIO, listId, "2026-08-31", "pendente");
    const revisaoAntes = await lerRevisao(WORKSPACE_ENSAIO);

    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const { rodarAgenda, chamadas } = criarEspiaDeAgenda(() => ({ ok: true, value: { executed: 3, failed: 1, skipped: 2, failures: [] } }));
    const worker = criarSchedulerWorker({ workerId: "w_n", workspaceId: WORKSPACE_ENSAIO, relogio, resolverAtor: atorDeTeste, rodarAgenda });

    expect(await worker.processarUm()).toBe(true);
    expect(chamadas).toHaveLength(1); // o cálculo aconteceu — a espiã foi chamada

    const linha = await lerLinhaDaAgenda(WORKSPACE_ENSAIO, listId, "2026-08-31");
    expect(linha.estado).toBe("concluido");
    expect(linha.last_error_code).toBe(CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA);
    expect(linha.executadas).toBe(3);
    expect(linha.falhadas).toBe(1);
    expect(linha.puladas).toBe(2);

    // A prova de que nada foi gravado: a revisão do Espaço é a MESMA de antes.
    expect(await lerRevisao(WORKSPACE_ENSAIO)).toBe(revisaoAntes);
  });

  it("(o) enquanto a linha de ensaio não for liberada, semear() não cria dia novo e processarUm() não tem o que reivindicar", async () => {
    const listId = `lst_ensaio_${randomUUID()}`;
    const automationId = `aut_ensaio_${randomUUID()}`;
    await inserirAutomacaoDeAgenda(WORKSPACE_ENSAIO, listId, automationId);

    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const { rodarAgenda } = criarEspiaDeAgenda(() => ({ ok: true, value: { executed: 0, failed: 0, skipped: 0, failures: [] } }));
    const worker = criarSchedulerWorker({ workerId: "w_o", workspaceId: WORKSPACE_ENSAIO, relogio, resolverAtor: atorDeTeste, rodarAgenda });

    await worker.semear();
    expect(await worker.processarUm()).toBe(true); // fecha o dia 31 em ensaio

    relogio.definir(new Date(2026, 8, 2, 9)); // dois dias depois — sem liberação, a Lista fica parada
    expect(await worker.semear()).toBe(0); // bloqueada pelo ensaio: nenhum dia novo
    expect(await worker.processarUm()).toBe(false); // nada a reivindicar
  });

  it("(p) depois de liberarLista(), semear() volta a criar dias e processarUm() processa de verdade", async () => {
    const listId = `lst_ensaio_${randomUUID()}`;
    const automationId = `aut_ensaio_${randomUUID()}`;
    await inserirAutomacaoDeAgenda(WORKSPACE_ENSAIO, listId, automationId);

    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const { rodarAgenda } = criarEspiaDeAgenda(() => ({ ok: true, value: { executed: 5, failed: 0, skipped: 0, failures: [] } }));
    const worker = criarSchedulerWorker({ workerId: "w_p", workspaceId: WORKSPACE_ENSAIO, relogio, resolverAtor: atorDeTeste, rodarAgenda });

    await worker.semear();
    expect(await worker.processarUm()).toBe(true); // fecha em ensaio

    const liberadas = await liberarLista(WORKSPACE_ENSAIO, listId);
    expect(liberadas).toBe(1);

    relogio.definir(new Date(2026, 8, 1, 9));
    expect(await worker.semear()).toBeGreaterThan(0);
    expect(await worker.processarUm()).toBe(true);

    const linha = await lerLinhaDaAgenda(WORKSPACE_ENSAIO, listId, "2026-09-01");
    expect(linha.estado).toBe("concluido");
    expect(linha.last_error_code).toBeNull(); // liberada: gravou de verdade
    expect(linha.executadas).toBe(5);
  });

  it("(q) uma linha MARCO_ZERO fixa o início da agenda e NÃO conta como volta real: a primeira volta seguinte ainda é ensaio", async () => {
    const listId = `lst_ensaio_${randomUUID()}`;
    const automationId = `aut_ensaio_${randomUUID()}`;
    await inserirAutomacaoDeAgenda(WORKSPACE_ENSAIO, listId, automationId);

    // O que 03-10 escreve ao terminar a importação: fixa o início da agenda.
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil, estado, last_error_code)
         values ($1, $2, '2026-08-20', 'concluido', $3)`,
        [WORKSPACE_ENSAIO, listId, CODIGOS_DA_AGENDA.MARCO_ZERO],
      );
    } finally {
      cliente.release();
    }

    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const { rodarAgenda } = criarEspiaDeAgenda(() => ({ ok: true, value: { executed: 1, failed: 0, skipped: 0, failures: [] } }));
    const worker = criarSchedulerWorker({ workerId: "w_q", workspaceId: WORKSPACE_ENSAIO, relogio, resolverAtor: atorDeTeste, rodarAgenda });

    // Catch-up desde 2026-08-20 (exclusive), truncado à janela padrão de 7:
    // nenhum dia anterior à importação nasce.
    expect(await worker.semear()).toBe(7);
    const dias = await listarDiasDaAgenda(WORKSPACE_ENSAIO, listId);
    const novos = dias.filter((linha) => linha.dia_civil !== "2026-08-20");
    expect(novos).toHaveLength(7);
    expect(novos[0]!.dia_civil).toBe("2026-08-25"); // não desde o início dos tempos — desde MARCO_ZERO, truncado pela janela

    expect(await worker.processarUm()).toBe(true);
    const primeira = await lerLinhaDaAgenda(WORKSPACE_ENSAIO, listId, novos[0]!.dia_civil);
    expect(primeira.last_error_code).toBe(CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA); // MARCO_ZERO não é volta real
  });

  it("(r) com ensaioNaPrimeiraVolta: false, a primeira volta já é real — a porta para uma Lista sem backlog", async () => {
    const listId = `lst_ensaio_${randomUUID()}`;
    await inserirLinhaDeAgenda(WORKSPACE_ENSAIO, listId, "2026-08-31", "pendente");
    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const { rodarAgenda } = criarEspiaDeAgenda(() => ({ ok: true, value: { executed: 4, failed: 0, skipped: 0, failures: [] } }));
    const worker = criarSchedulerWorker({
      workerId: "w_r",
      workspaceId: WORKSPACE_ENSAIO,
      relogio,
      resolverAtor: atorDeTeste,
      rodarAgenda,
      ensaioNaPrimeiraVolta: false,
    });

    expect(await worker.processarUm()).toBe(true);
    const linha = await lerLinhaDaAgenda(WORKSPACE_ENSAIO, listId, "2026-08-31");
    expect(linha.estado).toBe("concluido");
    expect(linha.last_error_code).toBeNull();
    expect(linha.executadas).toBe(4);
  });
});

/* ── Canal por agenda (AUTO-02, Task 3): o evento nasce na mesma transação, e o Ensaio não grava nada.
 * Migrado de Contas a pagar para a Solicitação de pagamento em 05-19 (CR-07/colateral de D5-19/05-13):
 * `destinoDeCanal` só resolve destino em `CANAL_LISTA_ID` desde então. ────────── */

/** Quantas linhas de `automacao.notificar-canal.v1` o payload aponta para `taskId` neste Espaço de Trabalho. */
async function contarOutboxCanalDaTarefa(workspaceId: string, taskId: string): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ n: string }>(
      `select count(*)::text as n from plataforma.integration_outbox
        where workspace_id = $1 and event_type = 'automacao.notificar-canal.v1' and payload->>'taskId' = $2`,
      [workspaceId, taskId],
    );
    return Number(r.rows[0]?.n ?? "0");
  } finally {
    cliente.release();
  }
}

interface CenarioCanal {
  readonly taskId: Id;
  readonly vencimentoCivil: string;
}

/**
 * `buildGestaoBootstrap` já publica automações reais de `condicaoTemporal`
 * em `CP.listId` (A2 etc.) e `CR.listId` (R2/R4/R5) — `catalogoDeListasComAgenda`
 * as descobre junto de `CANAL_LISTA_ID`, então `semear()` cria uma linha de
 * agenda por Lista (três, não uma) para o mesmo dia civil. `processarUm()`
 * reivindica UMA linha por chamada, pela ordem `dia_civil, criado_em` — como
 * as automações de CP/CR nascem no seed ANTES da Automação de Canal (que só
 * é empurrada depois dos dois evolvers), a linha de `CANAL_LISTA_ID` não é
 * necessariamente a primeira. Drena a fila inteira (como o worker de
 * produção faz em regime) para não depender dessa ordem — as outras duas
 * Listas não têm Tarefa nenhuma neste Espaço de teste, então processá-las é
 * inofensivo (zero Tarefas elegíveis).
 */
async function drenarAgenda(worker: SchedulerWorker): Promise<void> {
  let sobrouAlgo = true;
  while (sobrouAlgo) {
    sobrouAlgo = await worker.processarUm();
  }
}

/**
 * Monta, num `DataState` real (`buildGestaoBootstrap` + os dois evolvers de
 * configuração), uma Automação de Canal por AGENDA (`condicaoTemporal`,
 * `dueDateOffsetDays: 0`) sobre `CANAL_LISTA_ID` ("Solicitações de
 * pagamento", D5-19/05-13 — `destinoDeCanal` só resolve destino nesta Lista
 * desde então), e uma Solicitação cujo vencimento é `hoje` — o gatilho
 * dispara na primeira rodada. `comWhatsapp: false` deixa o Campo vazio de
 * propósito, para o caso (c) (a Ação recusa). O valor de WhatsApp nunca tem
 * dígito de telefone (05-07/eventos-de-canal.test.ts): o Campo é tipo
 * `phone` mas aceita qualquer texto não vazio, e o critério de aceite deste
 * arquivo proíbe sequência de 9+ dígitos. Semeia o `workspaceId` inteiro e
 * devolve o `taskId` para a asserção contra `plataforma.integration_outbox`.
 */
async function prepararCenarioCanalPorAgenda(workspaceId: string, hoje: Date, comWhatsapp: boolean): Promise<CenarioCanal> {
  const vencimentoCivil = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const estado = buildGestaoBootstrap({ workspaceId });
  // A Lista de Solicitações e as Integrações por Empresa (Marcos Paulo, com
  // `avisosPorCanal.whatsapp` declarado) não nascem em `buildGestaoBootstrap`
  // — precisam dos dois evolvers, no mesmo molde de `operacoes.test.ts`
  // (w)/(x), 05-17.
  const solicitacoes = evoluirConfiguracaoDeSolicitacoes(estado, CP.financeiroId);
  if (!solicitacoes.ok) throw new Error(`fixture: ${solicitacoes.error}`);
  const empresas = evoluirConfiguracaoPorEmpresa(estado, CP.financeiroId);
  if (!empresas.ok) throw new Error(`fixture: ${empresas.error}`);

  estado.automations.push({
    id: `aut_canal_agenda_${randomUUID()}`,
    workspaceId: estado.workspace.id,
    createdBy: { kind: "member", id: CP.financeiroId },
    createdAt: "2026-01-01T00:00:00.000Z",
    lifecycle: "ativo",
    name: "Canal por agenda (teste 05-19, Task 1 — migrado de Contas a pagar)",
    description: "",
    scopeType: "list",
    scopeId: CANAL_LISTA_ID,
    ownerMemberId: CP.financeiroId,
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        trigger: { kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: 0 }) },
        conditions: [],
        actions: [
          {
            order: 1,
            kind: "controle",
            controlKind: "notificar",
            params: JSON.stringify({ canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" }),
          },
        ],
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  const criacao = createTask(estado, CP.financeiroId, {
    listId: CANAL_LISTA_ID,
    title: "Solicitação de teste — Canal por agenda (05-19)",
    statusId: SOL.status.paraFazer,
    dueDate: { form: "civilDay", value: vencimentoCivil },
  });
  if (!criacao.ok) throw new Error(`fixture: ${criacao.error}`);
  // `destinoDeCanal` (D5-19) exige Empresa nos DOIS modos — sempre preenchida,
  // mesmo quando o caso é o de recusa por WhatsApp vazio.
  const empresa = setTaskFieldValue(estado, CP.financeiroId, criacao.value.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo");
  if (!empresa.ok) throw new Error(`fixture: ${empresa.error}`);
  if (comWhatsapp) {
    const campo = setTaskFieldValue(estado, CP.financeiroId, criacao.value.id, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-teste-agenda-canal");
    if (!campo.ok) throw new Error(`fixture: ${campo.error}`);
  }

  const cliente = await pool().connect();
  try {
    await cliente.query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [workspaceId]);
    await semearEstadoInteiro(cliente, workspaceId, estado);
  } finally {
    cliente.release();
  }

  return { taskId: criacao.value.id, vencimentoCivil };
}

d("scheduler-worker (Postgres real) — Canal por agenda (AUTO-02, Task 3; migrado para a Solicitação em 05-19/CR-07)", () => {
  const WORKSPACE_CANAL_A = `ws_${RUN}_canal_a`;
  const WORKSPACE_CANAL_B = `ws_${RUN}_canal_b`;
  const WORKSPACE_CANAL_C = `ws_${RUN}_canal_c`;

  beforeAll(async () => {
    // Defensivo (CR-07): ver o comentário do bloco (f)-(m) — este é o bloco
    // que originou o incidente (9 linhas órfãs de outbox em 2026-09-24).
    await limparWorkspace(WORKSPACE_CANAL_A);
    await limparWorkspace(WORKSPACE_CANAL_B);
    await limparWorkspace(WORKSPACE_CANAL_C);
  });

  afterAll(async () => {
    await limparWorkspace(WORKSPACE_CANAL_A);
    await limparWorkspace(WORKSPACE_CANAL_B);
    await limparWorkspace(WORKSPACE_CANAL_C);
    await encerrar();
  });

  it("(a) rodada normal: uma Automação de Canal por agenda grava uma linha de automacao.notificar-canal.v1", async () => {
    const hoje = new Date(2026, 7, 31, 12);
    const { taskId } = await prepararCenarioCanalPorAgenda(WORKSPACE_CANAL_A, hoje, true);
    const relogio = relogioFixo(hoje);
    const worker = criarSchedulerWorker({
      workerId: "w_canal_a",
      workspaceId: WORKSPACE_CANAL_A,
      relogio,
      resolverAtor: async () => CP.financeiroId,
      // ensaioNaPrimeiraVolta: false — este caso prova a rodada NORMAL; o
      // Ensaio da primeira volta é o caso (b), a seguir.
      ensaioNaPrimeiraVolta: false,
    });

    expect(await worker.semear()).toBeGreaterThan(0);
    await drenarAgenda(worker);

    expect(await contarOutboxCanalDaTarefa(WORKSPACE_CANAL_A, taskId)).toBe(1);
  });

  it("(b) a MESMA rodada em Ensaio da primeira volta: ZERO linhas no outbox — o Ensaio não manda WhatsApp (D3-03)", async () => {
    const hoje = new Date(2026, 7, 31, 12);
    const { taskId, vencimentoCivil } = await prepararCenarioCanalPorAgenda(WORKSPACE_CANAL_B, hoje, true);
    const relogio = relogioFixo(hoje);
    const worker = criarSchedulerWorker({
      workerId: "w_canal_b",
      workspaceId: WORKSPACE_CANAL_B,
      relogio,
      resolverAtor: async () => CP.financeiroId,
      // ensaioNaPrimeiraVolta: true (padrão) — esta é a primeira volta REAL
      // desta (Espaço, Lista): o gate de Ensaio entra.
    });

    expect(await worker.semear()).toBeGreaterThan(0);
    await drenarAgenda(worker);

    const linha = await lerLinhaDaAgenda(WORKSPACE_CANAL_B, CANAL_LISTA_ID, vencimentoCivil);
    expect(linha.estado).toBe("concluido");
    expect(linha.last_error_code).toBe(CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA);
    expect(linha.executadas).toBeGreaterThan(0); // o cálculo aconteceu — a Automação de Canal rodou de verdade

    // A garantia mais importante deste plano: o Ensaio mede, mas não manda WhatsApp.
    expect(await contarOutboxCanalDaTarefa(WORKSPACE_CANAL_B, taskId)).toBe(0);
  });

  it("(c) a Automação de Canal RECUSA (destino vazio): ZERO linhas no outbox", async () => {
    const hoje = new Date(2026, 7, 31, 12);
    const { taskId } = await prepararCenarioCanalPorAgenda(WORKSPACE_CANAL_C, hoje, false); // Campo WhatsApp NUNCA preenchido
    const relogio = relogioFixo(hoje);
    const worker = criarSchedulerWorker({
      workerId: "w_canal_c",
      workspaceId: WORKSPACE_CANAL_C,
      relogio,
      resolverAtor: async () => CP.financeiroId,
      ensaioNaPrimeiraVolta: false, // isola a recusa — o Ensaio já é o caso (b)
    });

    expect(await worker.semear()).toBeGreaterThan(0);
    await drenarAgenda(worker);

    expect(await contarOutboxCanalDaTarefa(WORKSPACE_CANAL_C, taskId)).toBe(0);
  });
});

/* ── 10-05 — a Recorrência por calendário ganha o relógio do servidor (D-01, D-02, F3) ── */

/** A Lista `lst_revisoes` do seed tem a Tarefa `tsk_seed_9`, recorrente por calendário (e a Automação `aut_revisao`, PAUSADA, por evento). */
const LISTA_DA_RECORRENCIA = "lst_revisoes";
const SERIE_DA_RECORRENCIA = "tsk_seed_9";
const MEMBRO_PROPRIETARIO = "mem_thiago";
const DIA_DA_VOLTA = "2026-08-31";

/** Grava o Espaço de Trabalho do seed, com a Tarefa recorrente VENCIDA, e devolve o `workspace_id` novo. */
async function semearEspacoDeRecorrencia(rotulo: string, ajustar?: (estado: DataState) => void): Promise<string> {
  const workspaceId = novoEspacoDeTeste(rotulo);
  const estado = buildSeed();
  const serie = estado.tasks.find((t) => t.id === SERIE_DA_RECORRENCIA);
  if (!serie) throw new Error(`o seed perdeu ${SERIE_DA_RECORRENCIA}`);
  serie.dueDate = { form: "civilDay", value: "2026-08-20" }; // vencida em relação ao relógio fixo de 31/08
  ajustar?.(estado);
  const cliente = await pool().connect();
  try {
    await semearEstadoInteiro(cliente, workspaceId, estado);
  } finally {
    cliente.release();
  }
  return workspaceId;
}

/** Quantas ocorrências nasceram da série por recorrência (provenance), direto em `plataforma.registros`. */
async function contarOcorrenciasDaSerie(workspaceId: string): Promise<number> {
  const r = await pool().query<{ n: string }>(
    `select count(*)::text as n from plataforma.registros
      where workspace_id = $1 and colecao = 'tasks'
        and dados->'provenance'->>'kind' = 'recurrence' and dados->'provenance'->>'sourceId' = $2`,
    [workspaceId, SERIE_DA_RECORRENCIA],
  );
  return Number(r.rows[0]?.n ?? "0");
}

/** Os autores (Membro) da Atividade "Próxima ocorrência criada" do Espaço. */
async function autoresDaProximaOcorrencia(workspaceId: string): Promise<string[]> {
  const r = await pool().query<{ ator: string }>(
    `select dados->'actor'->>'id' as ator from plataforma.registros
      where workspace_id = $1 and colecao = 'activity' and dados->>'action' = 'Próxima ocorrência criada'`,
    [workspaceId],
  );
  return r.rows.map((linha) => linha.ator);
}

/** O Agente do pipeline some do Espaço (não há Membro do Papel): a resolução do preferido LANÇA. */
const preferidoQueFalha = async (): Promise<Id> => {
  throw new Error("Não existe Membro do Papel 'Agente do pipeline' neste Espaço.");
};

describeComBanco("10-05 — Lista só com recorrência por calendário: direto, assinada por quem a administra (EST-01)", () => {
  const criados: string[] = [];

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const workspaceId of criados) await limparWorkspace(workspaceId);
    await encerrar();
  });

  it("(t) Lista sem Automação, com Tarefa recorrente vencida: o catálogo a vê, a volta nasce DIRETO, cria a próxima ocorrência e a Atividade é de um Membro humano que a administra", async () => {
    const workspaceId = await semearEspacoDeRecorrencia("agenda_direto");
    criados.push(workspaceId);
    expect(await contarOcorrenciasDaSerie(workspaceId)).toBe(0);

    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    // Sem `ensaioNaPrimeiraVolta: false`: o regime de verdade é quem decide.
    const worker = criarSchedulerWorkerDaFase10({ workerId: "w_t", workspaceId, listId: LISTA_DA_RECORRENCIA, relogio, resolverAtor: preferidoQueFalha });

    expect(await worker.semear()).toBeGreaterThan(0);
    expect(await contarLinhasDaAgenda(workspaceId, LISTA_DA_RECORRENCIA)).toBe(1);
    expect(await worker.processarUm()).toBe(true);

    const linha = await lerLinhaDaAgenda(workspaceId, LISTA_DA_RECORRENCIA, DIA_DA_VOLTA);
    expect(linha.estado).toBe("concluido");
    expect(linha.last_error_code).toBeNull(); // sem ENSAIO_PRIMEIRA_VOLTA
    expect(linha.executadas).toBeGreaterThanOrEqual(1);

    expect(await contarOcorrenciasDaSerie(workspaceId)).toBe(1);
    // O preferido falhou ao resolver e a volta não caiu: assinou o Proprietário do Espaço de Trabalho.
    expect(await autoresDaProximaOcorrencia(workspaceId)).toEqual([MEMBRO_PROPRIETARIO]);
  });

  it("(u) a mesma Lista COM Automação por vencimento mantém o ensaio: a linha fecha ENSAIO_PRIMEIRA_VOLTA e nada é gravado", async () => {
    const workspaceId = await semearEspacoDeRecorrencia("agenda_ensaio", (estado) => {
      const molde = estado.automations.find((a) => a.id === "aut_revisao");
      const [versao] = molde?.versions ?? [];
      if (!molde || !versao) throw new Error("o seed perdeu aut_revisao");
      estado.automations.push({
        ...molde,
        id: "aut_teste_vencimento_10_05",
        lifecycle: "ativo",
        versions: [{ ...versao, state: "publicada", trigger: { kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: 0 }) } }],
      });
    });
    criados.push(workspaceId);
    const revisaoAntes = await lerRevisao(workspaceId);

    const relogio = relogioFixo(new Date(2026, 7, 31, 12));
    const worker = criarSchedulerWorkerDaFase10({ workerId: "w_u", workspaceId, listId: LISTA_DA_RECORRENCIA, relogio, resolverAtor: preferidoQueFalha });

    expect(await worker.semear()).toBeGreaterThan(0);
    expect(await worker.processarUm()).toBe(true);

    const linha = await lerLinhaDaAgenda(workspaceId, LISTA_DA_RECORRENCIA, DIA_DA_VOLTA);
    expect(linha.estado).toBe("concluido");
    expect(linha.last_error_code).toBe(CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA);
    expect(await contarOcorrenciasDaSerie(workspaceId)).toBe(0);
    expect(await lerRevisao(workspaceId)).toBe(revisaoAntes); // a revisão do Espaço é a MESMA: nada foi gravado
  });
});
