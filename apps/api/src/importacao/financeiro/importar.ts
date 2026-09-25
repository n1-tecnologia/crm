/**
 * A orquestração de SOL-09 (D-24/D-25): um lote por chamada de
 * `importarLote`, ledger na MESMA transação da Tarefa, retomada por
 * `cursor` e reconciliação por `reconciliar`. `./solicitacoes.ts` lê o
 * Postgres do `financeiro-tria` e classifica; `./de-para.ts` resolve
 * autoria; `./anexos.ts` liga o anexo histórico quando inequívoco. Este
 * arquivo não abre o banco legado nem decide o que é uma linha válida — só
 * decide o que entra em cada transação e grava o ledger.
 *
 * ## Uma chamada de `importarLote` = uma página do legado
 *
 * Ao contrário de `importar-contas-a-pagar.ts` (que lê um export inteiro do
 * disco e itera lotes internamente), aqui `importarLote` lê UMA página via
 * `lerSolicitacoesLegadas` e devolve `proximoCursor` — quem itera até o
 * fim é o CLI (`./importar.cli.ts`, Task 2), que chama de novo com o cursor
 * devolvido até `proximoCursor` vir `undefined`. A escolha é da paginação
 * já existir do lado da leitura (D-24: cursor por `id` crescente do Supabase
 * legado) — duplicar esse laço aqui só moveria o mesmo código de lugar.
 *
 * ## `resultado` do ledger: só três valores, "ambígua" mora dentro de "rejeitada"
 *
 * `plataforma.importacao_ledger.resultado` (migração `003`, imutável,
 * DEC-10) só aceita `'importada' | 'rejeitada' | 'avisada'` — não existe
 * `'ambigua'` no `check`. Uma linha `ambigua` (classificação `aprovado`
 * nulo/fora do domínio, D-25 — nunca inferido) grava `resultado = 'rejeitada'`
 * com `motivo = 'aprovado_ambiguo'`; a contagem `ambiguas` do retorno é
 * derivada em memória por esse `motivo`, nunca uma coluna nova. `avisada` é
 * usada para uma linha que VIROU Tarefa mas carrega ao menos uma lacuna
 * (dado ausente OU anexo não ligado) — o mesmo uso que
 * `importar-contas-a-pagar.ts` já dá ao valor, reaproveitado aqui em vez de
 * inventar uma quarta categoria.
 *
 * ## Idempotência: TODA linha com `TaskID` é filtrada pelo ledger primeiro
 *
 * Não só as válidas: uma linha `rejeitada`/`ambígua` COM `TaskID` também
 * grava no ledger (com `on conflict do nothing`), e por isso também precisa
 * ser filtrada ANTES — senão a segunda execução do `--dry-run`/`--apply`
 * sobre o mesmo lote recontaria a mesma linha como "rejeitada" de novo em
 * vez de "duplicada", e a promessa de `reconciliar` ("a segunda execução
 * bate com a primeira") quebraria para o subconjunto rejeitado. Linhas SEM
 * `TaskID` (`taskid_ausente`) nunca entram no ledger — a chave primária
 * exige `legacy_task_id not null` — e são deterministicamente
 * reclassificadas do mesmo jeito a cada execução, então não precisam de
 * proteção de ledger para manter contagem estável entre execuções.
 *
 * ## Anexo: resolvido ANTES da transação, escrito DENTRO dela
 *
 * `ligarAnexoHistorico` (`./anexos.ts`) é assíncrona (upload de Storage);
 * `executar()` exige uma função SÍNCRONA de domínio. Por isso o anexo é
 * resolvido por linha antes de abrir `executar()` — o mesmo motivo por que
 * a autoria (`resolverAutoriaLegada`, síncrona, mas resolvida no mesmo
 * lugar por coerência com o passo 4 do plano) é resolvida ali também.
 * Quando ligado, o `WorkspaceFile`/`Attachment` são construídos aqui,
 * dentro de `operacaoDoLote` (então na mesma transação da Tarefa) — não em
 * `packages/dominio/src/operations/importacao.ts`, que fica fora do
 * `files_modified` deste plano e cuja assinatura
 * (`EntradaDeImportacaoHistorica`) hoje não aceita anexo nenhum. A
 * construção replica o MESMO formato que o domínio já usa em dois lugares
 * (`operations/collaboration.ts#attachFile`,
 * `operations/scale.ts#submitForm`) — `nextId("fil")`, `state.files.push`,
 * `task.attachments.push` — só que fora do pacote, porque estender o
 * contrato de `importarSolicitacaoHistorica` é uma mudança de domínio que
 * este plano não pediu (fora de `files_modified`). Documentado como decisão
 * de execução no SUMMARY deste plano — candidato a subir para
 * `packages/dominio` se um segundo consumidor precisar do mesmo padrão.
 *
 * ## Dry-run: simulação, não `rollback`
 *
 * O texto do plano descreve "uma transação que termina em rollback"; esta
 * implementação segue o padrão já em produção de
 * `importar-contas-a-pagar.ts` (`importarLote` ali) — dry-run NUNCA chama
 * `executar()`, só classifica e simula as contagens que a Tarefa teria
 * (`avisada` quando há lacuna, `importada` quando não há). O efeito
 * observável é idêntico (dry-run não grava nada, contagens corretas) com
 * menos código novo e nenhum risco de um `rollback` mal-executado deixar
 * `revisao` de `plataforma.workspaces` incrementada por engano.
 */

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

import { ok, type DataState, type Id, type OperationResult, type Attachment, type WorkspaceFile } from "@n1/dominio";
import { memberActor, nextId, recordActivity } from "@n1/dominio/operations/activity";
import { importActor, importarSolicitacaoHistorica, type EntradaDeImportacaoHistorica } from "@n1/dominio/operations/importacao";

import { pool } from "../../persistencia/conexao";
import { executar, type OpcoesExecucao } from "../../persistencia/unidade-de-trabalho";
import { ligarAnexoHistorico, type ResultadoDaLigacao } from "./anexos";
import { resolverAutoriaLegada } from "./de-para";
import { classificarLinha, lerSolicitacoesLegadas, type ClassificacaoDeLinha, type LinhaLegadaBruta } from "./solicitacoes";

/** A origem é sempre `"clickup"` (D-24: a fonte é a Lista do ClickUp, mesmo a linha vindo do Supabase legado) — nunca uma flag do CLI. */
export const ORIGEM_SOLICITACOES_HISTORICAS = "clickup" as const;

/** Id literal da Lista "Solicitações de pagamento" (mesmo literal duplicado em `packages/dominio/src/operations/importacao.ts`). */
const LISTA_SOLICITACOES_ID: Id = "lst_solicitacoes_de_pagamento";

function canonicalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonicalizar);
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([chave, valorAninhado]) => [chave, canonicalizar(valorAninhado)]),
    );
  }
  return valor;
}

/** sha-256 do JSON canônico da linha bruta — auditoria por linha do ledger, nunca o dado em si (T-02-21). */
export function hashCanonico(valor: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalizar(valor))).digest("hex");
}

/* ─────────────────────────────── Tipos do lote ─────────────────────────────── */

export type ResultadoDaLinha = "importada" | "rejeitada" | "avisada";

interface ResultadoPorLinha {
  readonly legacyTaskId: string;
  readonly taskId?: Id;
  readonly resultado: ResultadoDaLinha;
  /** Categoria — nunca o valor de um Campo (T-02-21). */
  readonly motivo?: string;
  readonly sourceHash: string;
}

interface EntradaPendente {
  readonly entrada: EntradaDeImportacaoHistorica;
  readonly sourceHash: string;
  readonly anexo?: ResultadoDaLigacao & { readonly ligado: true };
}

export interface OpcoesDeImportarLote {
  readonly workspaceId: string;
  readonly actingMemberId: Id;
  readonly runId: string;
  /** Credencial somente-leitura do `financeiro-tria` — nunca a do `apps/api`. */
  readonly connectionString: string;
  readonly tamanho: number;
  readonly cursor?: string;
  readonly dryRun: boolean;
  /** Raiz de `apps/api/exportacoes/` — repassada a `ligarAnexoHistorico`. */
  readonly pastaDeExportacoes: string;
  /**
   * Só o teste (`importar.test.ts`) injeta isto — substitui
   * `lerSolicitacoesLegadas` por uma fonte em memória (a fixture do Plan
   * 02-22), no mesmo espírito do `origem` que `importar-contas-a-pagar.ts`
   * só o teste passa. O CLI (`./importar.cli.ts`) nunca informa este campo:
   * a leitura real do `financeiro-tria` é sempre `lerSolicitacoesLegadas`.
   */
  readonly leitor?: typeof lerSolicitacoesLegadas;
  /**
   * Só o teste informa isto — o valor gravado na coluna `origem` do LEDGER
   * (`plataforma.importacao_ledger`, chave `(origem, legacy_task_id)`,
   * SEM `workspace_id`: é uma tabela global). Nunca afeta
   * `entrada.origem`/`Task.provenance.sourceName`, que o domínio
   * (`importarSolicitacaoHistorica`) recusa se não for literalmente
   * `"clickup"` — só isola a LINHA DO LEDGER de um `TaskID` de teste que,
   * por coincidência, colidisse com um `TaskID` real (T-3-... mesmo padrão
   * de `importar-contas-a-pagar.ts`). Padrão: `ORIGEM_SOLICITACOES_HISTORICAS`.
   */
  readonly origem?: string;
}

export interface ResultadoDeImportarLote {
  readonly lidas: number;
  readonly validas: number;
  readonly importadas: number;
  readonly rejeitadas: number;
  readonly ambiguas: number;
  readonly duplicadas: number;
  readonly anexosLigados: number;
  readonly anexosAusentes: number;
  readonly proximoCursor?: string;
  /** Categoria de rejeição/aviso → contagem — nunca `legacyTaskId` nem valor de Campo (T-02-21). */
  readonly motivosPorCategoria: Readonly<Record<string, number>>;
}

/**
 * Importa uma página do legado. Ver o cabeçalho do arquivo para o desenho
 * completo (paginação, mapeamento de `resultado`, idempotência, anexo,
 * dry-run).
 */
export async function importarLote(opcoes: OpcoesDeImportarLote): Promise<ResultadoDeImportarLote> {
  const origemDoLedger = opcoes.origem ?? ORIGEM_SOLICITACOES_HISTORICAS;
  const ler = opcoes.leitor ?? lerSolicitacoesLegadas;
  const pagina = await ler({
    connectionString: opcoes.connectionString,
    lote: opcoes.tamanho,
    ...(opcoes.cursor !== undefined ? { cursor: opcoes.cursor } : {}),
  });
  const lidas = pagina.linhas.length;

  // 2 — classificar cada linha; `vistos` acumula só DENTRO desta página
  // (contrato de `classificarLinha`: quem itera decide quando acrescentar).
  const vistos = new Set<string>();
  const classificadas: readonly { readonly linha: LinhaLegadaBruta; readonly classificacao: ClassificacaoDeLinha }[] = pagina.linhas.map(
    (linha) => {
      const classificacao = classificarLinha(linha, vistos);
      if (classificacao.taskId) vistos.add(classificacao.taskId);
      return { linha, classificacao };
    },
  );

  const cliente = await pool().connect();
  try {
    // 3 — consultar o ledger para TODA linha com `TaskID` (não só as
    // válidas — ver o cabeçalho, seção "Idempotência").
    const legacyIdsComTaskId = [
      ...new Set(classificadas.map((c) => c.classificacao.taskId).filter((id): id is string => id !== undefined)),
    ];
    const jaNoLedger =
      legacyIdsComTaskId.length === 0
        ? new Set<string>()
        : new Set(
            (
              await cliente.query<{ legacy_task_id: string }>(
                `select legacy_task_id from plataforma.importacao_ledger where origem = $1 and legacy_task_id = any($2::text[])`,
                [origemDoLedger, legacyIdsComTaskId],
              )
            ).rows.map((linha) => linha.legacy_task_id),
          );

    let validas = 0;
    let rejeitadas = 0;
    let ambiguas = 0;
    let duplicadas = 0;
    let anexosLigados = 0;
    let anexosAusentes = 0;
    const motivosPorCategoria: Record<string, number> = {};
    const ledgerParaGravarForaDaTransacao: { readonly legacyTaskId: string; readonly resultado: "rejeitada"; readonly motivo: string; readonly sourceHash: string }[] = [];
    const pendentes: EntradaPendente[] = [];

    for (const { linha, classificacao } of classificadas) {
      const sourceHash = hashCanonico(linha);
      if (classificacao.taskId && jaNoLedger.has(classificacao.taskId)) {
        duplicadas += 1;
        continue;
      }

      if (classificacao.resultado === "ambigua") {
        ambiguas += 1;
        const motivo = classificacao.motivo ?? "aprovado_ambiguo";
        motivosPorCategoria[motivo] = (motivosPorCategoria[motivo] ?? 0) + 1;
        if (classificacao.taskId) {
          ledgerParaGravarForaDaTransacao.push({ legacyTaskId: classificacao.taskId, resultado: "rejeitada", motivo, sourceHash });
        }
        continue;
      }

      if (classificacao.resultado === "rejeitada") {
        rejeitadas += 1;
        const motivo = classificacao.motivo ?? "desconhecido";
        motivosPorCategoria[motivo] = (motivosPorCategoria[motivo] ?? 0) + 1;
        // "taskid_duplicado" é a SEGUNDA ocorrência do mesmo TaskID DENTRO
        // deste lote (`vistos`, não `jaNoLedger`) — a primeira ocorrência já
        // vai gravar sua própria linha no ledger (válida → `aoConfirmar`
        // dentro da transação; rejeitada/ambígua → aqui mesmo, antes dela na
        // ordem de iteração). Gravar TAMBÉM uma linha "rejeitada" aqui correria
        // NA FRENTE da gravação real da primeira ocorrência (este bloco roda
        // fora da transação, antes de `executar()`) e o `on conflict do
        // nothing` faria a linha "rejeitada" da duplicata vencer a chave —
        // apagando silenciosamente o resultado verdadeiro (`importada`) da
        // primeira ocorrência sem apagar a Tarefa que ela criou. Achado real:
        // fixture de teste tem `clk_100001` duas vezes (id=1 válida, id=12
        // duplicata) — sem este `if`, `reconciliar()` mostrava 25 onde
        // `importarLote` contava 26.
        if (classificacao.taskId && motivo !== "taskid_duplicado") {
          ledgerParaGravarForaDaTransacao.push({ legacyTaskId: classificacao.taskId, resultado: "rejeitada", motivo, sourceHash });
        }
        continue;
      }

      // resultado === "valida"
      validas += 1;
      const entradaClassificada = classificacao.entrada;
      if (!entradaClassificada) continue; // inalcançável: "valida" sempre traz `entrada`.

      // 4 — resolver autoria e anexo (ambos antes de `executar()`; anexo é I/O assíncrono, autoria é síncrona mas fica junto por coerência).
      const idResponsavel = typeof linha.id_responsavel === "string" ? linha.id_responsavel : undefined;
      const autoria = resolverAutoriaLegada(idResponsavel);

      const resultadoDoAnexo = opcoes.dryRun
        ? await ligarAnexoHistorico({
            legacyTaskId: entradaClassificada.legacyTaskId,
            workspaceId: opcoes.workspaceId,
            pastaDeExportacoes: opcoes.pastaDeExportacoes,
            dryRun: true,
          })
        : await ligarAnexoHistorico({
            legacyTaskId: entradaClassificada.legacyTaskId,
            workspaceId: opcoes.workspaceId,
            pastaDeExportacoes: opcoes.pastaDeExportacoes,
            dryRun: false,
          });

      let lacunas = entradaClassificada.lacunas;
      if (resultadoDoAnexo.ligado) {
        anexosLigados += 1;
      } else {
        anexosAusentes += 1;
        lacunas = [...lacunas, resultadoDoAnexo.aviso];
        motivosPorCategoria[resultadoDoAnexo.aviso] = (motivosPorCategoria[resultadoDoAnexo.aviso] ?? 0) + 1;
      }

      const entrada: EntradaDeImportacaoHistorica = {
        legacyTaskId: entradaClassificada.legacyTaskId,
        origem: entradaClassificada.origem,
        status: entradaClassificada.status,
        titulo: entradaClassificada.titulo,
        campos: entradaClassificada.campos,
        ...(entradaClassificada.resumo !== undefined ? { resumo: entradaClassificada.resumo } : {}),
        ...(entradaClassificada.criadaEm !== undefined ? { criadaEm: entradaClassificada.criadaEm } : {}),
        ...(autoria ? { autoriaConhecida: { memberId: autoria.memberId } } : {}),
        lacunas,
      };

      pendentes.push({
        entrada,
        sourceHash,
        ...(resultadoDoAnexo.ligado ? { anexo: resultadoDoAnexo } : {}),
      });
    }

    // Ledger das rejeitadas/ambíguas COM TaskID — nunca em dry-run (dry-run não grava nada).
    if (!opcoes.dryRun) {
      for (const linha of ledgerParaGravarForaDaTransacao) {
        await cliente.query(
          `insert into plataforma.importacao_ledger (origem, legacy_task_id, run_id, task_id, resultado, motivo, source_hash)
           values ($1, $2, $3, null, $4, $5, $6)
           on conflict (origem, legacy_task_id) do nothing`,
          [origemDoLedger, linha.legacyTaskId, opcoes.runId, linha.resultado, linha.motivo, linha.sourceHash],
        );
      }
    }

    let importadas = 0;
    let avisadas = 0;

    if (pendentes.length > 0) {
      if (opcoes.dryRun) {
        // Simulação — nunca chama `executar()` (ver o cabeçalho, seção "Dry-run").
        for (const { entrada } of pendentes) {
          if (entrada.lacunas.length > 0) avisadas += 1;
          else importadas += 1;
        }
      } else {
        let resultadosDoLote: ResultadoPorLinha[] = [];

        const operacaoDoLote = (state: DataState): OperationResult<readonly ResultadoPorLinha[]> => {
          resultadosDoLote = [];
          for (const { entrada, sourceHash, anexo } of pendentes) {
            const resultado = importarSolicitacaoHistorica(state, opcoes.actingMemberId, entrada);
            if (!resultado.ok) {
              resultadosDoLote.push({
                legacyTaskId: entrada.legacyTaskId,
                resultado: "rejeitada",
                motivo: resultado.error.slice(0, 200),
                sourceHash,
              });
              continue;
            }
            const task = resultado.value;

            // Anexo: construído aqui, dentro da MESMA transação da Tarefa — ver o
            // cabeçalho do arquivo, seção "Anexo: resolvido ANTES da transação,
            // escrito DENTRO dela". Mesmo formato que `packages/dominio` já usa em
            // `operations/collaboration.ts#attachFile` e `operations/scale.ts#submitForm`.
            if (anexo) {
              const ator = entrada.autoriaConhecida ? memberActor(entrada.autoriaConhecida.memberId) : importActor(entrada.origem);
              const workspaceFile: WorkspaceFile = {
                id: nextId("fil"),
                workspaceId: state.workspace.id,
                name: anexo.displayName,
                mediaType: anexo.mediaType,
                sizeBytes: anexo.sizeBytes,
                objectKey: anexo.objectKey,
                sha256: anexo.sha256,
                state: "enviado",
                createdBy: ator,
                createdAt: task.createdAt,
              };
              state.files.push(workspaceFile);
              const attachment: Attachment = {
                fileId: workspaceFile.id,
                order: (task.attachments.at(-1)?.order ?? -1) + 1,
                mediaType: anexo.mediaType,
                displayName: anexo.displayName,
              };
              task.attachments.push(attachment);
              recordActivity(state, {
                actor: ator,
                action: "Anexo histórico ligado",
                objectType: "task",
                objectId: task.id,
                objectName: task.title,
                detail: "importacao",
                at: task.createdAt,
              });
            }

            // `motivo` numa linha `avisada` guarda só a PRIMEIRA lacuna — o
            // `manifesto.ts` (Task 2) usa isto para um recorte aproximado de
            // "lacunas por categoria"; a Tarefa em si já tem TODAS as
            // lacunas como Registro de Atividade (`packages/dominio`), esta
            // coluna nunca é a fonte completa, só um resumo reconciliável.
            resultadosDoLote.push({
              legacyTaskId: entrada.legacyTaskId,
              taskId: task.id,
              resultado: entrada.lacunas.length > 0 ? "avisada" : "importada",
              ...(entrada.lacunas.length > 0 ? { motivo: entrada.lacunas[0] } : {}),
              sourceHash,
            });
          }
          return ok(resultadosDoLote);
        };

        const aoConfirmar = async (clienteDaTransacao: PoolClient, resultados: readonly ResultadoPorLinha[]): Promise<void> => {
          for (const resultado of resultados) {
            await clienteDaTransacao.query(
              `insert into plataforma.importacao_ledger (origem, legacy_task_id, run_id, task_id, resultado, motivo, source_hash)
               values ($1, $2, $3, $4, $5, $6, $7)
               on conflict (origem, legacy_task_id) do nothing`,
              [
                origemDoLedger,
                resultado.legacyTaskId,
                opcoes.runId,
                resultado.taskId ?? null,
                resultado.resultado,
                resultado.motivo ?? null,
                resultado.sourceHash,
              ],
            );
          }
        };

        // Barreira de execução: nenhuma chamada de `executar()` desta importação
        // pode carregar evento de saída — 1.110 pagamentos antigos não podem ser
        // reprocessados pelo pipeline (D-24/T-02-16). A linha abaixo falha alto
        // se o parâmetro proibido for acrescentado ao objeto no futuro, em vez de
        // deixar passar em silêncio.
        const opcoesDeExecucao: OpcoesExecucao<readonly ResultadoPorLinha[]> = { aoConfirmar, semEventosDeSaida: true };
        if ("eventos" in opcoesDeExecucao) throw new Error("importarLote nunca pode carregar isto — plataforma.integration_outbox não pode crescer.");

        const resultadoDaTransacao = await executar(opcoes.workspaceId, operacaoDoLote, opcoesDeExecucao);
        if ("conflito" in resultadoDaTransacao && resultadoDaTransacao.conflito) throw new Error(resultadoDaTransacao.error);
        if (!resultadoDaTransacao.ok) throw new Error(resultadoDaTransacao.error);

        for (const resultado of resultadosDoLote) {
          if (resultado.resultado === "importada") importadas += 1;
          else if (resultado.resultado === "avisada") {
            avisadas += 1;
            if (resultado.motivo) motivosPorCategoria[resultado.motivo] = (motivosPorCategoria[resultado.motivo] ?? 0) + 1;
          } else {
            rejeitadas += 1;
            const motivo = resultado.motivo ?? "desconhecido";
            motivosPorCategoria[motivo] = (motivosPorCategoria[motivo] ?? 0) + 1;
          }
        }
      }
    }

    return {
      lidas,
      validas,
      importadas: importadas + avisadas,
      rejeitadas,
      ambiguas,
      duplicadas,
      anexosLigados,
      anexosAusentes,
      ...(pagina.proximoCursor !== undefined ? { proximoCursor: pagina.proximoCursor } : {}),
      motivosPorCategoria,
    };
  } finally {
    cliente.release();
  }
}

/* ──────────────────────────────── reconciliar ──────────────────────────────── */

export interface ResultadoDeReconciliacao {
  readonly runId: string;
  readonly porResultado: Readonly<Record<ResultadoDaLinha, number>>;
  readonly tarefasNoEspaco: number;
  readonly bateComOLedger: boolean;
}

/**
 * Lê o ledger daquele `run_id` e devolve as contagens por `resultado`, mais
 * a contagem de Tarefas da Lista com `provenance.kind === "import"` e
 * `provenance.sourceName === "clickup"` — o literal que
 * `importarSolicitacaoHistorica` grava de verdade (ver o cabeçalho de
 * `packages/dominio/src/operations/importacao.ts`: o catálogo de
 * proveniência só tem `"import"` em inglês, não `"importacao"`). É o que
 * prova que reaplicar não duplicou (V02-09A).
 */
export async function reconciliar(opcoes: {
  readonly runId: string;
  readonly workspaceId: string;
  /** Só o teste informa isto — mesmo campo de `OpcoesDeImportarLote.origem`, nunca afeta `provenance.sourceName` (ver ali). */
  readonly origem?: string;
}): Promise<ResultadoDeReconciliacao> {
  const cliente = await pool().connect();
  try {
    const porResultadoLinhas = await cliente.query<{ resultado: string; n: string }>(
      `select resultado, count(*)::text as n from plataforma.importacao_ledger where run_id = $1 and origem = $2 group by resultado`,
      [opcoes.runId, opcoes.origem ?? ORIGEM_SOLICITACOES_HISTORICAS],
    );
    const porResultado: Record<ResultadoDaLinha, number> = { importada: 0, rejeitada: 0, avisada: 0 };
    for (const linha of porResultadoLinhas.rows) {
      if (linha.resultado === "importada" || linha.resultado === "rejeitada" || linha.resultado === "avisada") {
        porResultado[linha.resultado] = Number(linha.n);
      }
    }
    const tarefas = await cliente.query<{ n: string }>(
      `select count(*)::text as n from plataforma.registros
        where workspace_id = $1 and colecao = 'tasks' and list_id = $2
          and dados #>> '{provenance,kind}' = 'import' and dados #>> '{provenance,sourceName}' = $3`,
      [opcoes.workspaceId, LISTA_SOLICITACOES_ID, ORIGEM_SOLICITACOES_HISTORICAS],
    );
    const tarefasNoEspaco = Number(tarefas.rows[0]?.n ?? "0");
    return {
      runId: opcoes.runId,
      porResultado,
      tarefasNoEspaco,
      bateComOLedger: porResultado.importada + porResultado.avisada === tarefasNoEspaco,
    };
  } finally {
    cliente.release();
  }
}
