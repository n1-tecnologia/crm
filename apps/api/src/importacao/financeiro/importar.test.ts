/**
 * Prova contra Postgres real dos casos (a)-(j) do Plan 02-25, Task 2 — lote
 * transacional, ledger na mesma transação da Tarefa, dry-run, retomada,
 * ausência de evento de saída, anexo (ligado/ausente/hash divergente) e
 * manifesto sanitizado.
 *
 * Pula sem `DATABASE_URL` (DEC-09), como `importar-contas-a-pagar.test.ts`.
 * A leitura do legado nunca é real aqui: `lerSolicitacoesLegadas` é
 * substituída por um leitor em memória sobre a fixture do Plan 02-22
 * (`fixtures/solicitacoes-sanitizadas.json`, inteiramente fictícia) — este
 * arquivo nunca abre uma conexão com o `financeiro-tria`.
 *
 * As "três axes" que isolam este teste de uma corrida real (mesmo padrão de
 * `importar-contas-a-pagar.test.ts`):
 * 1. Espaço: `ws_teste_sol_<random>`, semeado por `bootstrapGestao` +
 *    `configurarSolicitacoes` — a Lista "Solicitações de pagamento" de
 *    verdade, sem Tarefas.
 * 2. Origem do ledger: `opcoes.origem` é um valor por execução — só este
 *    teste o passa; a limpeza por `origem = $RUN` nunca alcança `clickup`
 *    real (`Task.provenance.sourceName` continua sempre `"clickup"`, porque
 *    o domínio recusa qualquer outro valor — ver `./importar.ts`).
 * 3. Leitura: nenhuma linha vem do `financeiro-tria` — todas nascem da
 *    fixture, injetadas por `opcoes.leitor`.
 *
 * Em vez de hardcodar quantas linhas da fixture são válidas/rejeitadas/
 * ambíguas (frágil a qualquer edição futura da fixture), este arquivo
 * calcula o esperado rodando `classificarLinha` diretamente sobre a mesma
 * fixture — o teste prova que `importarLote` bate com essa classificação
 * independente, não um número mágico.
 */

import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { Id } from "@n1/dominio";
import { bootstrapGestao } from "../../bootstrap/gestao";
import { configurarSolicitacoes } from "../../bootstrap/solicitacoes";
import { carregarEnv, encerrar, pool } from "../../persistencia/conexao";
import { limparCacheDeManifestoDeAnexos } from "./anexos";
import fixture from "./fixtures/solicitacoes-sanitizadas.json";
import { importarLote, reconciliar } from "./importar";
import { escreverManifestoDeImportacao, gerarManifestoDeImportacao } from "./manifesto";
import { classificarLinha, type LinhaLegadaBruta } from "./solicitacoes";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const temBucket = Boolean(
  process.env.SUPABASE_STORAGE_BUCKET && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
);
const d = temBanco ? describe : describe.skip;
const dComBucket = temBanco && temBucket ? describe : describe.skip;

const RUN_MARCADOR = `teste_importar_sol_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN_MARCADOR}`;
const ORIGEM_DE_TESTE = RUN_MARCADOR;
const ATOR: Id = "mem_maryane";

const LINHAS_DA_FIXTURE = fixture.linhas as unknown as readonly LinhaLegadaBruta[];

/** Leitor em memória, mesma paginação por cursor `id` que `lerSolicitacoesLegadas` usa de verdade. */
function leitorDaFixture(todas: readonly LinhaLegadaBruta[]) {
  return async (opcoes: { readonly lote: number; readonly cursor?: string }) => {
    const cursorId = opcoes.cursor ? Number(opcoes.cursor) : 0;
    const restantes = [...todas].filter((l) => Number(l.id) > cursorId).sort((a, b) => Number(a.id) - Number(b.id));
    const linhas = restantes.slice(0, opcoes.lote);
    const ultima = linhas.at(-1);
    const proximoCursor = linhas.length === opcoes.lote && ultima ? String(ultima.id) : undefined;
    return { linhas, proximoCursor };
  };
}

/** Classificação independente da mesma fixture — a régua contra a qual `importarLote` é medido. */
function classificacaoEsperada(): { readonly validas: number; readonly rejeitadas: number; readonly ambiguas: number; readonly comTaskId: number } {
  const vistos = new Set<string>();
  let validas = 0;
  let rejeitadas = 0;
  let ambiguas = 0;
  let comTaskId = 0;
  for (const linha of [...LINHAS_DA_FIXTURE].sort((a, b) => Number(a.id) - Number(b.id))) {
    const c = classificarLinha(linha, vistos);
    if (c.taskId) {
      vistos.add(c.taskId);
      comTaskId += 1;
    }
    if (c.resultado === "valida") validas += 1;
    else if (c.resultado === "ambigua") ambiguas += 1;
    else rejeitadas += 1;
  }
  return { validas, rejeitadas, ambiguas, comTaskId };
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
  const r = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
  return Number(r.rows[0]?.n ?? "0");
}

async function tarefaPorLegacyId(legacyTaskId: string): Promise<{ readonly statusId: string; readonly attachments: readonly unknown[] } | undefined> {
  const r = await pool().query<{ status_id: string; attachments: unknown }>(
    `select dados->>'statusId' as status_id, dados->'attachments' as attachments from plataforma.registros
      where workspace_id = $1 and colecao = 'tasks' and dados #>> '{provenance,sourceId}' = $2`,
    [WORKSPACE, legacyTaskId],
  );
  const linha = r.rows[0];
  if (!linha) return undefined;
  return { statusId: linha.status_id, attachments: (linha.attachments as unknown[] | null) ?? [] };
}

async function ledgerPorLegacyId(legacyTaskId: string): Promise<{ readonly resultado: string; readonly motivo: string | null } | undefined> {
  const r = await pool().query<{ resultado: string; motivo: string | null }>(
    "select resultado, motivo from plataforma.importacao_ledger where origem = $1 and legacy_task_id = $2",
    [ORIGEM_DE_TESTE, legacyTaskId],
  );
  return r.rows[0];
}

async function limparPastaTemp(pasta: string): Promise<void> {
  await rm(pasta, { recursive: true, force: true });
}

/** Monta um `apps/api/exportacoes/` sintético com MANIFESTO.json + um anexo real, para os casos (h)/(i). */
async function criarExportacaoComAnexo(opcoes: {
  readonly legacyTaskId: string;
  readonly conteudo: string;
  readonly shaNoManifesto?: string;
}): Promise<string> {
  const pasta = await mkdtemp(path.join(tmpdir(), "sol-exportacoes-"));
  const listId = "901109104938";
  const attId = "att0001";
  const nomeReal = `${attId}-nota-fiscal.pdf`;
  const pastaDoAnexo = path.join(pasta, "clickup", listId, "attachments", opcoes.legacyTaskId);
  await mkdir(pastaDoAnexo, { recursive: true });
  await writeFile(path.join(pastaDoAnexo, nomeReal), opcoes.conteudo);
  const shaReal = createHash("sha256").update(opcoes.conteudo).digest("hex");
  const manifesto = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    exportador: { commit: "teste" },
    amostra: false,
    timeInStatusDisponivel: "nao-verificado",
    listas: [],
    usuariosVistos: [],
    avisos: [],
    arquivos: [{ caminho: `${listId}/attachments/${opcoes.legacyTaskId}/${attId}`, bytes: opcoes.conteudo.length, sha256: opcoes.shaNoManifesto ?? shaReal }],
    hashAgregado: "teste",
  };
  await writeFile(path.join(pasta, "MANIFESTO.json"), JSON.stringify(manifesto, null, 2));
  return pasta;
}

let pastaSemAnexo: string;

d("importarLote / reconciliar (Postgres real)", () => {
  beforeAll(async () => {
    pastaSemAnexo = await mkdtemp(path.join(tmpdir(), "sol-exportacoes-vazia-"));
    await writeFile(
      path.join(pastaSemAnexo, "MANIFESTO.json"),
      JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), exportador: { commit: "teste" }, amostra: false, timeInStatusDisponivel: "nao-verificado", listas: [], usuariosVistos: [], avisos: [], arquivos: [], hashAgregado: "teste" }),
    );
    const cliente = await pool().connect();
    try {
      await bootstrapGestao(cliente, { workspaceId: WORKSPACE });
    } finally {
      cliente.release();
    }
    const configurado = await configurarSolicitacoes({ workspaceId: WORKSPACE, actingMemberId: ATOR, dryRun: false });
    if (!configurado.ok) throw new Error(`Falha ao configurar Solicitações no Espaço de teste: ${configurado.error}`);
  });

  afterEach(async () => {
    await pool().query("delete from plataforma.registros where workspace_id = $1 and colecao in ('tasks', 'activity')", [WORKSPACE]);
    await pool().query("delete from plataforma.importacao_ledger where origem = $1", [ORIGEM_DE_TESTE]);
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
    limparCacheDeManifestoDeAnexos();
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.registros where workspace_id = $1", [WORKSPACE]);
    await pool().query("delete from plataforma.workspaces where workspace_id = $1", [WORKSPACE]);
    await pool().query("delete from plataforma.importacao_ledger where origem = $1", [ORIGEM_DE_TESTE]);
    await limparPastaTemp(pastaSemAnexo);
    await encerrar();
  });

  it("(a) --dry-run: contagens batem com a classificação independente e nada é gravado", async () => {
    const runId = randomUUID();
    const esperado = classificacaoEsperada();
    const resultado = await importarLote({
      workspaceId: WORKSPACE,
      actingMemberId: ATOR,
      runId,
      connectionString: "postgres://nunca-usado",
      tamanho: LINHAS_DA_FIXTURE.length,
      dryRun: true,
      pastaDeExportacoes: pastaSemAnexo,
      leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
      origem: ORIGEM_DE_TESTE,
    });

    expect(resultado.lidas).toBe(LINHAS_DA_FIXTURE.length);
    expect(resultado.validas).toBe(esperado.validas);
    expect(resultado.rejeitadas).toBe(esperado.rejeitadas);
    expect(resultado.ambiguas).toBe(esperado.ambiguas);
    expect(resultado.duplicadas).toBe(0);
    expect(await contarTarefas()).toBe(0);
    expect(await contarLedger(runId)).toBe(0);
  });

  it("(b) --apply: válidas viram Tarefas fechadas, com provenance.kind = 'import'", async () => {
    const runId = randomUUID();
    const esperado = classificacaoEsperada();
    const resultado = await importarLote({
      workspaceId: WORKSPACE,
      actingMemberId: ATOR,
      runId,
      connectionString: "postgres://nunca-usado",
      tamanho: LINHAS_DA_FIXTURE.length,
      dryRun: false,
      pastaDeExportacoes: pastaSemAnexo,
      leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
      origem: ORIGEM_DE_TESTE,
    });

    expect(resultado.importadas).toBe(esperado.validas);
    expect(await contarTarefas()).toBe(esperado.validas);

    const tarefaAprovada = await tarefaPorLegacyId("clk_100001");
    expect(tarefaAprovada).toBeDefined();

    const provenance = await pool().query<{ kind: string }>(
      `select dados #>> '{provenance,kind}' as kind from plataforma.registros
        where workspace_id = $1 and colecao = 'tasks' and dados #>> '{provenance,sourceId}' = $2`,
      [WORKSPACE, "clk_100001"],
    );
    expect(provenance.rows[0]?.kind).toBe("import");
  });

  it("(c) reaplicar o --apply inteiro: mesmas contagens de Tarefa, zero Tarefas novas", async () => {
    const runId1 = randomUUID();
    const primeira = await importarLote({
      workspaceId: WORKSPACE,
      actingMemberId: ATOR,
      runId: runId1,
      connectionString: "postgres://nunca-usado",
      tamanho: LINHAS_DA_FIXTURE.length,
      dryRun: false,
      pastaDeExportacoes: pastaSemAnexo,
      leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
      origem: ORIGEM_DE_TESTE,
    });
    const tarefasApos1a = await contarTarefas();
    expect(tarefasApos1a).toBe(primeira.importadas);

    const runId2 = randomUUID();
    const segunda = await importarLote({
      workspaceId: WORKSPACE,
      actingMemberId: ATOR,
      runId: runId2,
      connectionString: "postgres://nunca-usado",
      tamanho: LINHAS_DA_FIXTURE.length,
      dryRun: false,
      pastaDeExportacoes: pastaSemAnexo,
      leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
      origem: ORIGEM_DE_TESTE,
    });

    expect(segunda.importadas).toBe(0);
    expect(await contarTarefas()).toBe(tarefasApos1a);
    // Toda linha com TaskID (válida, rejeitada-com-taskid ou ambígua) já está no ledger do primeiro run.
    const esperado = classificacaoEsperada();
    expect(segunda.duplicadas).toBe(esperado.comTaskId);
  });

  it("(d) interromper e retomar do ledger: o total final bate com a execução ininterrupta", async () => {
    const tamanhoDoLote = 5;

    // Execução ininterrupta, para servir de referência.
    const workspaceReferencia = `${WORKSPACE}_ref`;
    const clienteRef = await pool().connect();
    try {
      await bootstrapGestao(clienteRef, { workspaceId: workspaceReferencia });
    } finally {
      clienteRef.release();
    }
    const configuradoRef = await configurarSolicitacoes({ workspaceId: workspaceReferencia, actingMemberId: ATOR, dryRun: false });
    if (!configuradoRef.ok) throw new Error(configuradoRef.error);

    const runIdReferencia = randomUUID();
    let cursorRef: string | undefined;
    for (;;) {
      const pagina = await importarLote({
        workspaceId: workspaceReferencia,
        actingMemberId: ATOR,
        runId: runIdReferencia,
        connectionString: "postgres://nunca-usado",
        tamanho: tamanhoDoLote,
        dryRun: false,
        pastaDeExportacoes: pastaSemAnexo,
        leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
        origem: `${ORIGEM_DE_TESTE}_ref`,
        ...(cursorRef !== undefined ? { cursor: cursorRef } : {}),
      });
      if (!pagina.proximoCursor) break;
      cursorRef = pagina.proximoCursor;
    }
    const tarefasReferencia = await pool().query<{ n: string }>(
      "select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'tasks'",
      [workspaceReferencia],
    );
    const totalReferencia = Number(tarefasReferencia.rows[0]?.n ?? "0");

    try {
      // Execução "interrompida": só 2 lotes de 5 (10 das 32 linhas).
      const runIdInterrompido = randomUUID();
      let cursor: string | undefined;
      for (let pagina = 0; pagina < 2; pagina += 1) {
        const resultado = await importarLote({
          workspaceId: WORKSPACE,
          actingMemberId: ATOR,
          runId: runIdInterrompido,
          connectionString: "postgres://nunca-usado",
          tamanho: tamanhoDoLote,
          dryRun: false,
          pastaDeExportacoes: pastaSemAnexo,
          leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
          origem: ORIGEM_DE_TESTE,
          ...(cursor !== undefined ? { cursor } : {}),
        });
        cursor = resultado.proximoCursor;
      }

      // "--resume": mesmo run_id, recomeça da primeira página — o ledger filtra o que já foi feito.
      let cursorDaRetomada: string | undefined;
      for (;;) {
        const resultado = await importarLote({
          workspaceId: WORKSPACE,
          actingMemberId: ATOR,
          runId: runIdInterrompido,
          connectionString: "postgres://nunca-usado",
          tamanho: tamanhoDoLote,
          dryRun: false,
          pastaDeExportacoes: pastaSemAnexo,
          leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
          origem: ORIGEM_DE_TESTE,
          ...(cursorDaRetomada !== undefined ? { cursor: cursorDaRetomada } : {}),
        });
        if (!resultado.proximoCursor) break;
        cursorDaRetomada = resultado.proximoCursor;
      }

      expect(await contarTarefas()).toBe(totalReferencia);
    } finally {
      await pool().query("delete from plataforma.registros where workspace_id = $1", [workspaceReferencia]);
      await pool().query("delete from plataforma.workspaces where workspace_id = $1", [workspaceReferencia]);
      await pool().query("delete from plataforma.importacao_ledger where origem = $1", [`${ORIGEM_DE_TESTE}_ref`]);
    }
  });

  it("(e) zero linhas em plataforma.integration_outbox depois da importação inteira", async () => {
    const runId = randomUUID();
    await importarLote({
      workspaceId: WORKSPACE,
      actingMemberId: ATOR,
      runId,
      connectionString: "postgres://nunca-usado",
      tamanho: LINHAS_DA_FIXTURE.length,
      dryRun: false,
      pastaDeExportacoes: pastaSemAnexo,
      leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
      origem: ORIGEM_DE_TESTE,
    });
    expect(await contarOutbox()).toBe(0);
  });

  it("(f) rejeitadas e ambíguas estão no ledger com motivo de categoria, e não viraram Tarefa", async () => {
    const runId = randomUUID();
    await importarLote({
      workspaceId: WORKSPACE,
      actingMemberId: ATOR,
      runId,
      connectionString: "postgres://nunca-usado",
      tamanho: LINHAS_DA_FIXTURE.length,
      dryRun: false,
      pastaDeExportacoes: pastaSemAnexo,
      leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
      origem: ORIGEM_DE_TESTE,
    });

    const duplicado = await ledgerPorLegacyId("clk_100001");
    // id=1 é a primeira ocorrência (válida); id=12 repete o mesmo TaskID —
    // `on conflict do nothing` preserva a linha da PRIMEIRA (válida). A
    // prova de que a SEGUNDA nunca virou Tarefa é `contarTarefas()` bater
    // com `classificacaoEsperada().validas`, já coberto no caso (b).
    expect(duplicado).toBeDefined();
    expect(await tarefaPorLegacyId("clk_100013")).toBeUndefined(); // Aprovado ambíguo — nunca Tarefa.
    const ambigua = await ledgerPorLegacyId("clk_100013");
    expect(ambigua?.resultado).toBe("rejeitada");
    expect(ambigua?.motivo).toBe("aprovado_ambiguo");

    expect(await tarefaPorLegacyId("clk_100025")).toBeUndefined(); // Centro de Custo inválido.
    const centroInvalido = await ledgerPorLegacyId("clk_100025");
    expect(centroInvalido?.resultado).toBe("rejeitada");
    expect(centroInvalido?.motivo).toBe("centro_custo_invalido");
  });

  it("(g) o MANIFESTO.json não contém nenhum valor de string da fixture", async () => {
    const runId = randomUUID();
    const iniciadoEm = new Date().toISOString();
    const resultado = await importarLote({
      workspaceId: WORKSPACE,
      actingMemberId: ATOR,
      runId,
      connectionString: "postgres://nunca-usado",
      tamanho: LINHAS_DA_FIXTURE.length,
      dryRun: false,
      pastaDeExportacoes: pastaSemAnexo,
      leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
      origem: ORIGEM_DE_TESTE,
    });
    const concluidoEm = new Date().toISOString();

    const manifesto = await gerarManifestoDeImportacao({
      runId,
      workspaceId: WORKSPACE,
      iniciadoEm,
      concluidoEm,
      modo: "apply",
      resumoDaExecucao: {
        lidas: resultado.lidas,
        duplicadas: resultado.duplicadas,
        anexosLigados: resultado.anexosLigados,
        anexosAusentes: resultado.anexosAusentes,
      },
    });

    const pastaTemp = await mkdtemp(path.join(tmpdir(), "sol-manifesto-"));
    try {
      const { json } = await escreverManifestoDeImportacao(manifesto, pastaTemp);
      const texto = await readFile(json, "utf8");

      const valoresDaFixture = new Set<string>();
      for (const linha of LINHAS_DA_FIXTURE) {
        for (const valor of Object.values(linha)) {
          if (typeof valor === "string" && valor.length >= 4) valoresDaFixture.add(valor);
        }
      }
      const vazados = [...valoresDaFixture].filter((valor) => texto.includes(valor));
      expect(vazados).toEqual([]);
    } finally {
      await limparPastaTemp(pastaTemp);
    }
  });

  dComBucket("(h)/(i) anexo — hash divergente vira aviso reconciliável; reaplicação não duplica", () => {
    it("(h) hash divergente: anexosAusentes incrementa, a Tarefa existe sem anexo", async () => {
      const legacyTaskId = "clk_100015"; // válida, sem TaskID repetido
      const pasta = await criarExportacaoComAnexo({
        legacyTaskId,
        conteudo: "conteudo real do teste",
        shaNoManifesto: "0".repeat(64), // nunca bate com o hash real
      });
      try {
        const runId = randomUUID();
        const resultado = await importarLote({
          workspaceId: WORKSPACE,
          actingMemberId: ATOR,
          runId,
          connectionString: "postgres://nunca-usado",
          tamanho: LINHAS_DA_FIXTURE.length,
          dryRun: false,
          pastaDeExportacoes: pasta,
          leitor: leitorDaFixture(LINHAS_DA_FIXTURE.filter((l) => l.TaskID === legacyTaskId)),
          origem: ORIGEM_DE_TESTE,
        });
        expect(resultado.anexosAusentes).toBe(1);
        expect(resultado.anexosLigados).toBe(0);
        const tarefa = await tarefaPorLegacyId(legacyTaskId);
        expect(tarefa).toBeDefined();
        expect(tarefa?.attachments.length).toBe(0);
      } finally {
        await limparPastaTemp(pasta);
      }
    });

    it("(i) o mesmo anexo reaplicado não é reprocessado (a linha já está no ledger)", async () => {
      const legacyTaskId = "clk_100016";
      const conteudo = "conteudo real do anexo de teste";
      const pasta = await criarExportacaoComAnexo({ legacyTaskId, conteudo });
      try {
        const primeiroRun = randomUUID();
        const primeira = await importarLote({
          workspaceId: WORKSPACE,
          actingMemberId: ATOR,
          runId: primeiroRun,
          connectionString: "postgres://nunca-usado",
          tamanho: LINHAS_DA_FIXTURE.length,
          dryRun: false,
          pastaDeExportacoes: pasta,
          leitor: leitorDaFixture(LINHAS_DA_FIXTURE.filter((l) => l.TaskID === legacyTaskId)),
          origem: ORIGEM_DE_TESTE,
        });
        expect(primeira.anexosLigados).toBe(1);

        const segundoRun = randomUUID();
        const segunda = await importarLote({
          workspaceId: WORKSPACE,
          actingMemberId: ATOR,
          runId: segundoRun,
          connectionString: "postgres://nunca-usado",
          tamanho: LINHAS_DA_FIXTURE.length,
          dryRun: false,
          pastaDeExportacoes: pasta,
          leitor: leitorDaFixture(LINHAS_DA_FIXTURE.filter((l) => l.TaskID === legacyTaskId)),
          origem: ORIGEM_DE_TESTE,
        });
        // A linha já está no ledger — `ligarAnexoHistorico` nunca roda de novo,
        // então nenhum objeto novo sobe ao bucket (a prova de "não duplica").
        expect(segunda.anexosLigados).toBe(0);
        expect(segunda.anexosAusentes).toBe(0);
        expect(segunda.duplicadas).toBe(1);
      } finally {
        await limparPastaTemp(pasta);
      }
    });
  });

  it("(j) reconciliar sobre o run devolve contagens iguais às do apply", async () => {
    const runId = randomUUID();
    const resultado = await importarLote({
      workspaceId: WORKSPACE,
      actingMemberId: ATOR,
      runId,
      connectionString: "postgres://nunca-usado",
      tamanho: LINHAS_DA_FIXTURE.length,
      dryRun: false,
      pastaDeExportacoes: pastaSemAnexo,
      leitor: leitorDaFixture(LINHAS_DA_FIXTURE),
      origem: ORIGEM_DE_TESTE,
    });

    const reconciliacao = await reconciliar({ runId, workspaceId: WORKSPACE, origem: ORIGEM_DE_TESTE });
    expect(reconciliacao.porResultado.importada + reconciliacao.porResultado.avisada).toBe(resultado.importadas);
    expect(reconciliacao.tarefasNoEspaco).toBe(resultado.importadas);
    expect(reconciliacao.bateComOLedger).toBe(true);
  });
});
