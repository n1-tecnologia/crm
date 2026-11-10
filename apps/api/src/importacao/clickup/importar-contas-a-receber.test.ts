/**
 * Prova contra Postgres real de `importarLote`/`reconciliar` de Contas a
 * receber — MESMOS casos (a)-(i) de `./importar-contas-a-pagar.test.ts`
 * (Plan 03-10, Task 2), com o caso que fecha o plano (o que prova que
 * `automationExecutions` fica em zero e nada nasce no outbox mesmo com as
 * seis Automações `aut_cr_*` ativas no Espaço de teste).
 *
 * Pula sem `DATABASE_URL` (DEC-09), como o irmão e `automacoes/scheduler-worker.test.ts`.
 *
 * As "três eixos" que isolam este teste de uma corrida real (mesmo desenho
 * do irmão): Espaço `ws_teste_cr_<random>` (semeado por `bootstrapGestao`,
 * que já traz Contas a receber com `{ fixtures: false }`); `opcoes.origem`
 * do ledger é um valor só deste teste; nenhuma leitura de
 * `apps/api/exportacoes/clickup/` — as entradas nascem prontas.
 *
 * `contexto: { catalogoDeClientes: [] }` em toda chamada de `importarLote`
 * — este arquivo prova a orquestração (lote, ledger, retomada, ausência de
 * efeito colateral), não a resolução de cliente (D5-12), que já tem prova
 * própria em `./contas-a-receber.test.ts`.
 */

import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Id } from "@n1/dominio";
import { CR } from "@n1/dominio/operations/financeiro";
import type { EntradaDeContaAReceberHistorica } from "@n1/dominio/operations/importacao-contas-a-receber";

import { bootstrapGestao } from "../../bootstrap/gestao";
import { carregarEnv, encerrar, pool } from "../../persistencia/conexao";
import { construirCatalogoDeClientes, hashCanonico, importarLote, reconciliar, type EntradaParaImportar } from "./importar-contas-a-receber";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const RUN = `teste_importar_cr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;
const ORIGEM_DE_TESTE = RUN;
const ATOR: Id = "mem_maryane";

function entrada(legacyTaskId: string, overrides: Partial<EntradaDeContaAReceberHistorica> = {}): EntradaParaImportar {
  const base: EntradaDeContaAReceberHistorica = {
    legacyTaskId,
    titulo: `Conta a receber de teste ${legacyTaskId}`,
    statusFinalId: CR.status.paraReceber,
    criadaEm: "2026-01-01T12:00:00.000Z",
    transicoes: [{ em: "2026-01-01T12:00:00.000Z", statusId: CR.status.paraReceber, nomeLegado: "para receber" }],
    campos: {},
    lacunas: [],
    ...overrides,
  };
  return { entrada: base, sourceHash: hashCanonico({ legacyTaskId }) };
}

async function lerRevisao(): Promise<number> {
  const r = await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [WORKSPACE]);
  if (!r.rows[0]) throw new Error(`sem Espaço ${WORKSPACE}`);
  return Number(r.rows[0].revisao);
}

async function contarLedger(runId: string): Promise<number> {
  const r = await pool().query<{ n: string }>(
    "select count(*)::text as n from plataforma.importacao_ledger where run_id = $1 and origem = $2",
    [runId, ORIGEM_DE_TESTE],
  );
  return Number(r.rows[0]?.n ?? "0");
}

async function contarTarefas(): Promise<number> {
  const r = await pool().query<{ n: string }>(
    "select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'tasks'",
    [WORKSPACE],
  );
  return Number(r.rows[0]?.n ?? "0");
}

async function contarOutbox(): Promise<number> {
  const r = await pool().query<{ n: string }>(
    "select count(*)::text as n from plataforma.integration_outbox where workspace_id = $1",
    [WORKSPACE],
  );
  return Number(r.rows[0]?.n ?? "0");
}

async function contarAutomationExecutions(): Promise<number> {
  const r = await pool().query<{ n: string }>(
    "select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'automationExecutions'",
    [WORKSPACE],
  );
  return Number(r.rows[0]?.n ?? "0");
}

async function comentariosDaTarefa(legacyTaskId: string): Promise<number> {
  const r = await pool().query<{ n: string }>(
    `select jsonb_array_length(dados->'comments') as n from plataforma.registros
      where workspace_id = $1 and colecao = 'tasks' and dados #>> '{provenance,sourceId}' = $2`,
    [WORKSPACE, legacyTaskId],
  );
  return Number(r.rows[0]?.n ?? "0");
}


/** Contatos e Empresas do Espaço de teste nas TABELAS do CRM (Fase 15, 3.4.10), numa transação: a restrição de admin da Empresa é adiada até o commit. */
async function semearClientesNasTabelas(): Promise<{ contatoAtivo: string; contatoNaLixeira: string; empresaAtiva: string; empresaNaLixeira: string }> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    const novoContato = async (nome: string, estado: string): Promise<string> =>
      (
        await cliente.query<{ id: string }>(
          "insert into plataforma.contatos (workspace_id, nome, estado, proprietario_id, criado_por) values ($1, $2, $3, $4, $4) returning id",
          [WORKSPACE, nome, estado, ATOR],
        )
      ).rows[0]!.id;
    const novaEmpresa = async (nome: string, estado: string, admin: string): Promise<string> => {
      const id = (
        await cliente.query<{ id: string }>(
          "insert into plataforma.empresas (workspace_id, nome_fantasia, estado, proprietario_id, criado_por) values ($1, $2, $3, $4, $4) returning id",
          [WORKSPACE, nome, estado, ATOR],
        )
      ).rows[0]!.id;
      await cliente.query("insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por) values ($1, $2, $3, true, $4)", [WORKSPACE, admin, id, ATOR]);
      return id;
    };
    const contatoAtivo = await novoContato("Ana Lima", "ativo");
    const contatoNaLixeira = await novoContato("Carla Dias", "na_lixeira");
    const empresaAtiva = await novaEmpresa("Acme da tabela", "ativo", contatoAtivo);
    const empresaNaLixeira = await novaEmpresa("Empresa na lixeira", "na_lixeira", contatoAtivo);
    await cliente.query("commit");
    return { contatoAtivo, contatoNaLixeira, empresaAtiva, empresaNaLixeira };
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  } finally {
    cliente.release();
  }
}

async function limparClientesDasTabelas(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    for (const tabela of ["contato_empresa", "empresas", "contato_identificadores", "contatos"]) {
      await cliente.query(`delete from plataforma.${tabela} where workspace_id = $1`, [WORKSPACE]);
    }
    await cliente.query("commit");
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  } finally {
    cliente.release();
  }
}

d("importarLote / reconciliar de Contas a receber (Postgres real)", () => {
  beforeAll(async () => {
    const cliente = await pool().connect();
    try {
      await bootstrapGestao(cliente, { workspaceId: WORKSPACE });
    } finally {
      cliente.release();
    }
  });

  afterEach(async () => {
    // T-5-SC (regra operacional #3 do executor): limpar tudo que o teste
    // escreveu para este Espaço, inclusive outbox e ledger — nunca deixar
    // linha órfã entre casos.
    await pool().query("delete from plataforma.registros where workspace_id = $1 and colecao in ('tasks', 'activity', 'automationExecutions')", [WORKSPACE]);
    await pool().query("delete from plataforma.importacao_ledger where origem = $1", [ORIGEM_DE_TESTE]);
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
    await limparClientesDasTabelas();
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.registros where workspace_id = $1", [WORKSPACE]);
    await pool().query("delete from plataforma.workspaces where workspace_id = $1", [WORKSPACE]);
    await pool().query("delete from plataforma.importacao_ledger where origem = $1", [ORIGEM_DE_TESTE]);
    await pool().query("delete from plataforma.automacao_agenda where workspace_id = $1", [WORKSPACE]);
    await encerrar();
  });

  it("(a) lote transacional: N Tarefas numa só chamada de executar(), N linhas de ledger com o mesmo run_id", async () => {
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      const entradas = [entrada(`a1_${runId}`), entrada(`a2_${runId}`), entrada(`a3_${runId}`)];
      const resultado = await importarLote({ cliente, workspaceId: WORKSPACE, actingMemberId: ATOR, runId, entradas, dryRun: false, origem: ORIGEM_DE_TESTE });
      expect(resultado.importadas).toBe(3);
      expect(resultado.rejeitadas).toBe(0);
      expect(resultado.puladas).toBe(0);
      expect(await contarLedger(runId)).toBe(3);
      expect(await contarTarefas()).toBe(3);
    } finally {
      cliente.release();
    }
  });

  it("(b) Tarefa e ledger são a mesma transação: forçar a falha do ledger faz o lote inteiro sumir", async () => {
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      const entradas = [entrada(`b1_${runId}`), entrada(`b2_${runId}`)];
      await expect(
        importarLote({
          cliente,
          workspaceId: WORKSPACE,
          actingMemberId: ATOR,
          runId,
          entradas,
          dryRun: false,
          origem: ORIGEM_DE_TESTE,
          forcarFalhaDeLedgerParaTesteDeAtomicidade: true,
        }),
      ).rejects.toThrow();
      expect(await contarTarefas()).toBe(0);
      expect(await contarLedger(runId)).toBe(0);
    } finally {
      cliente.release();
    }
  });

  it("(c) segunda execução é no-op: importadas 0, puladas N, revisao idêntica antes e depois", async () => {
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      const entradas = [entrada(`c1_${runId}`), entrada(`c2_${runId}`)];
      await importarLote({ cliente, workspaceId: WORKSPACE, actingMemberId: ATOR, runId, entradas, dryRun: false, origem: ORIGEM_DE_TESTE });

      const revisaoAntes = await lerRevisao();
      const segunda = await importarLote({ cliente, workspaceId: WORKSPACE, actingMemberId: ATOR, runId: randomUUID(), entradas, dryRun: false, origem: ORIGEM_DE_TESTE });
      const revisaoDepois = await lerRevisao();

      expect(segunda.importadas).toBe(0);
      expect(segunda.puladas).toBe(2);
      expect(revisaoDepois).toBe(revisaoAntes);
    } finally {
      cliente.release();
    }
  });

  it("(d) recusa do domínio não derruba o lote: a recusada vira ledger rejeitada, as outras entram", async () => {
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      const boa1 = entrada(`d1_${runId}`);
      const recusada = entrada(`d2_${runId}`, { statusFinalId: "st_nao_existe_no_conjunto" as Id });
      const boa2 = entrada(`d3_${runId}`);
      const resultado = await importarLote({
        cliente,
        workspaceId: WORKSPACE,
        actingMemberId: ATOR,
        runId,
        entradas: [boa1, recusada, boa2],
        dryRun: false,
        origem: ORIGEM_DE_TESTE,
      });
      expect(resultado.importadas).toBe(2);
      expect(resultado.rejeitadas).toBe(1);
      expect(await contarTarefas()).toBe(2);

      const linhaRecusada = await pool().query<{ resultado: string }>(
        "select resultado from plataforma.importacao_ledger where origem = $1 and legacy_task_id = $2",
        [ORIGEM_DE_TESTE, recusada.entrada.legacyTaskId],
      );
      expect(linhaRecusada.rows[0]?.resultado).toBe("rejeitada");
    } finally {
      cliente.release();
    }
  });

  it("(e) falha no meio é retomável: continuar do ledger não duplica e o total final bate", async () => {
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      const todas = [entrada(`e1_${runId}`), entrada(`e2_${runId}`), entrada(`e3_${runId}`), entrada(`e4_${runId}`), entrada(`e5_${runId}`)];

      const primeira = await importarLote({ cliente, workspaceId: WORKSPACE, actingMemberId: ATOR, runId, entradas: todas.slice(0, 4), dryRun: false, origem: ORIGEM_DE_TESTE });
      expect(primeira.importadas).toBe(4);

      const retomada = await importarLote({ cliente, workspaceId: WORKSPACE, actingMemberId: ATOR, runId, entradas: todas, dryRun: false, origem: ORIGEM_DE_TESTE });
      expect(retomada.importadas).toBe(1);
      expect(retomada.puladas).toBe(4);

      expect(await contarLedger(runId)).toBe(5);
      expect(await contarTarefas()).toBe(5);
    } finally {
      cliente.release();
    }
  });

  it("(f) --dry-run não grava: revisao inalterada, zero linhas novas de ledger", async () => {
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      const revisaoAntes = await lerRevisao();
      const entradas = [entrada(`f1_${runId}`), entrada(`f2_${runId}`, { lacunas: ["alguma_lacuna_de_teste"] })];
      const resultado = await importarLote({ cliente, workspaceId: WORKSPACE, actingMemberId: ATOR, runId, entradas, dryRun: true, origem: ORIGEM_DE_TESTE });

      expect(resultado.importadas).toBe(1);
      expect(resultado.avisadas).toBe(1);
      expect(await lerRevisao()).toBe(revisaoAntes);
      expect(await contarLedger(runId)).toBe(0);
      expect(await contarTarefas()).toBe(0);
    } finally {
      cliente.release();
    }
  });

  it("(g) nenhum evento de saída nasce da importação", async () => {
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      const antes = await contarOutbox();
      await importarLote({ cliente, workspaceId: WORKSPACE, actingMemberId: ATOR, runId, entradas: [entrada(`g1_${runId}`)], dryRun: false, origem: ORIGEM_DE_TESTE });
      expect(await contarOutbox()).toBe(antes);
    } finally {
      cliente.release();
    }
  });

  it("(h) — o caso que fecha o plano: nenhuma Execução de Automação, mesmo com as seis aut_cr_* ativas, e a Tarefa importada não ganha Comentário", async () => {
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      // A prova não pode ser vazia: as seis Automações precisam estar
      // ativas no Espaço de teste para que "nenhuma rodou" signifique algo.
      const ativas = await pool().query<{ n: string }>(
        `select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'automations' and dados #>> '{scopeId}' = $2`,
        [WORKSPACE, CR.listId],
      );
      expect(Number(ativas.rows[0]?.n ?? "0")).toBeGreaterThanOrEqual(6);

      const legacyTaskId = `h1_${runId}`;
      // Entrando direto em "recebido", com o Valor > 0 do requisito de R3 —
      // o cenário mais provável de acordar R2b/R3 se o replay não fosse mudo.
      await importarLote({
        cliente,
        workspaceId: WORKSPACE,
        actingMemberId: ATOR,
        runId,
        entradas: [entrada(legacyTaskId, { statusFinalId: CR.status.recebido, campos: { fd_cp_valor: 1000 }, dataPagamento: "2026-01-01" })],
        dryRun: false,
        origem: ORIGEM_DE_TESTE,
      });
      expect(await contarAutomationExecutions()).toBe(0);
      expect(await comentariosDaTarefa(legacyTaskId)).toBe(0);
      expect(await contarOutbox()).toBe(0);
    } finally {
      cliente.release();
    }
  });

  it("(i) reconciliar(runId) bate: ledger importada+avisada === Tarefas no Espaço com a proveniência real", async () => {
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      const entradas = [entrada(`i1_${runId}`), entrada(`i2_${runId}`, { lacunas: ["lacuna_de_teste"] })];
      await importarLote({ cliente, workspaceId: WORKSPACE, actingMemberId: ATOR, runId, entradas, dryRun: false, origem: ORIGEM_DE_TESTE });

      const reconciliacao = await reconciliar({ runId, workspaceId: WORKSPACE, origem: ORIGEM_DE_TESTE });
      expect(reconciliacao.porResultado.importada).toBe(1);
      expect(reconciliacao.porResultado.avisada).toBe(1);
      expect(reconciliacao.tarefasNoEspaco).toBe(2);
      expect(reconciliacao.bateComOLedger).toBe(true);
    } finally {
      cliente.release();
    }
  });
  it("(j) construirCatalogoDeClientes lê Contatos e Empresas ATIVOS das tabelas, não os do modelo antigo em registros (3.4.10)", async () => {
    const ids = await semearClientesNasTabelas();
    // Um Contato do modelo antigo, só em `registros`: não pode entrar no catálogo.
    await pool().query(
      `insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'contacts', 'cnt_legado_cr', $2::jsonb)`,
      [WORKSPACE, JSON.stringify({ id: "cnt_legado_cr", workspaceId: WORKSPACE, lifecycle: "ativo", firstName: "Legado", lastName: "Antigo", ownerMemberId: ATOR, identifiers: [], consents: [], addresses: [], tagIds: [], fieldValues: [], comments: [] })],
    );
    const { catalogoDeClientes } = await construirCatalogoDeClientes(WORKSPACE);
    expect(catalogoDeClientes).toEqual(
      expect.arrayContaining([
        { tipo: "contact", id: ids.contatoAtivo, nome: "Ana Lima" },
        { tipo: "company", id: ids.empresaAtiva, nome: "Acme da tabela" },
      ]),
    );
    expect(catalogoDeClientes.map((c) => c.id)).not.toContain(ids.contatoNaLixeira);
    expect(catalogoDeClientes.map((c) => c.id)).not.toContain(ids.empresaNaLixeira);
    expect(catalogoDeClientes.map((c) => c.id)).not.toContain("cnt_legado_cr");
    expect(catalogoDeClientes).toHaveLength(2);
  });

  it("(k) importarLote só aceita o clienteRef que está no catálogo recebido: o da tabela vira Vínculo, o de fora é rejeitado com o motivo", async () => {
    const ids = await semearClientesNasTabelas();
    const { catalogoDeClientes } = await construirCatalogoDeClientes(WORKSPACE);
    const runId = randomUUID();
    const cliente = await pool().connect();
    try {
      const entradas = [
        entrada(`k1_${runId}`, { clienteRef: { tipo: "contact", id: ids.contatoAtivo } }),
        entrada(`k2_${runId}`, { clienteRef: { tipo: "contact", id: ids.contatoNaLixeira } }),
        entrada(`k3_${runId}`, { clienteRef: { tipo: "company", id: ids.empresaAtiva } }),
      ];
      const resultado = await importarLote({ cliente, workspaceId: WORKSPACE, actingMemberId: ATOR, runId, entradas, dryRun: false, origem: ORIGEM_DE_TESTE, catalogoDeClientes });
      expect(resultado.importadas).toBe(2);
      expect(resultado.rejeitadas).toBe(1);
      const rejeitada = resultado.detalhes.find((d) => d.resultado === "rejeitada");
      expect(rejeitada?.legacyTaskId).toBe(`k2_${runId}`);
      expect(rejeitada?.motivo).toBe(`Cliente "${ids.contatoNaLixeira}" (contact) não encontrado no CRM.`);
      const { rows } = await pool().query<{ dados: { toType: string; toId: string; role: string } }>(
        "select dados from plataforma.registros where workspace_id = $1 and colecao = 'links' order by dados->>'toId'",
        [WORKSPACE],
      );
      expect(rows.map((r) => [r.dados.toType, r.dados.toId, r.dados.role]).sort()).toEqual(
        [["contact", ids.contatoAtivo, "cliente"], ["company", ids.empresaAtiva, "cliente"]].sort(),
      );
    } finally {
      cliente.release();
    }
  });
});
