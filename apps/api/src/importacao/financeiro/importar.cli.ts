/**
 * `npm run solicitacoes:importar -w @n1/api [-- flags]` e
 * `npm run solicitacoes:reconciliar -w @n1/api -- --run=<uuid>`
 *
 * CLI fino de SOL-09, só composição (D-01) — no molde de
 * `../clickup/exportar.cli.ts` e `../clickup/importar-contas-a-pagar.cli.ts`
 * (parsing manual de `--chave=valor`, sem biblioteca; `pool().connect()` só
 * onde precisa; `encerrar()` sempre roda antes de sair). Nenhuma regra de
 * importação mora aqui: o SQL e a orquestração vivem em `./importar.ts`,
 * `./anexos.ts` e `./manifesto.ts`.
 *
 * Modos e flags:
 * - sem flag de modo → `--dry-run` (o padrão nunca grava, D-25)
 * - `--apply` → importa de verdade, grava Tarefa+ledger por lote
 * - `--batch-size=<n>` (padrão `50`)
 * - `--resume=<run-id>` → retoma um `--apply` interrompido: o cursor
 *   recomeça do MAIOR `legacy_task_id`... não — recomeça da PRIMEIRA página
 *   (`cursor` vazio); a idempotência que garante "não duplica" é o próprio
 *   ledger (`importarLote` filtra por `origem`+`legacy_task_id` a cada
 *   página, então relatar do início é seguro e mais simples que persistir um
 *   cursor externo — o custo é reclassificar linhas já resolvidas, não
 *   regravar Tarefa nenhuma)
 * - `solicitacoes:reconciliar --run=<uuid>` → só relata (lê o ledger e a
 *   Lista), nunca importa
 *
 * `WORKSPACE_ID` (padrão `ws_n1`), `SOLICITACOES_OPERADOR_MEMBER_ID`
 * (padrão `mem_maryane` — o único Membro que `bootstrapGestao` sempre
 * grava) e `FINANCEIRO_TRIA_DATABASE_URL_LEITURA` (a credencial
 * somente-leitura do `financeiro-tria`, D-24 — NUNCA a `DATABASE_URL` da
 * plataforma) vêm do ambiente. A saída imprime só contagens, categorias e
 * caminhos — nunca `TaskID`, título, valor de Campo, nome de fornecedor ou
 * comentário (T-02-21).
 *
 * Saída não-zero quando alguma rejeição/aviso não estiver entre as
 * categorias conhecidas (`CATEGORIAS_CONHECIDAS` — tudo que
 * `classificarLinha`/`ligarAnexoHistorico` já enumeram) — sinal de que o
 * domínio recusou por um motivo que este CLI não esperava, e que merece
 * revisão antes do próximo `--apply` (T-02-20).
 */

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { carregarEnv, encerrar } from "../../persistencia/conexao";
import { importarLote, reconciliar, type ResultadoDeImportarLote } from "./importar";
import { escreverManifestoDeImportacao, gerarManifestoDeImportacao } from "./manifesto";

/** Sinaliza saída não-zero sem chamar `process.exit` direto — `encerrar()` sempre roda antes (molde de `liberar.cli.ts`). */
class SairComCodigo extends Error {
  constructor(readonly codigo: number) {
    super(`saída ${codigo}`);
  }
}

const CATEGORIAS_CONHECIDAS = new Set([
  "taskid_ausente",
  "taskid_duplicado",
  "aprovado_ambiguo",
  "centro_custo_ausente",
  "centro_custo_invalido",
  "empresa_fora_do_dominio",
  "data_vencimento_formato_inesperado",
  "valor_ausente",
  "valor_nao_numerico",
  "documento_ausente",
  "documento_formato_inesperado",
  "data_de_criacao_ausente",
  "anexo_ausente",
  "anexo_hash_divergente",
  "anexo_multiplos_candidatos",
]);

const argv = process.argv.slice(2);

function valorDe(chave: string): string | undefined {
  const prefixo = `--${chave}=`;
  return argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

function temFlag(chave: string): boolean {
  return argv.includes(`--${chave}`);
}

async function rodar(): Promise<void> {
  carregarEnv();

  const workspaceId = process.env.WORKSPACE_ID ?? "ws_n1";
  const actingMemberId = process.env.SOLICITACOES_OPERADOR_MEMBER_ID ?? "mem_maryane";
  const connectionString = process.env.FINANCEIRO_TRIA_DATABASE_URL_LEITURA;
  const pastaDeExportacoes = valorDe("pasta") ?? fileURLToPath(new URL("../../../exportacoes/", import.meta.url));
  const tamanho = Number(valorDe("batch-size") ?? "50");
  const apply = temFlag("apply");
  const dryRun = !apply;
  const runIdInformado = valorDe("resume") ?? valorDe("run");
  const reconciliarFlag = temFlag("reconciliar") || process.argv[2] === "reconciliar";

  if (reconciliarFlag) {
    if (!runIdInformado) {
      console.error("--run=<uuid> é obrigatório para reconciliar.");
      throw new SairComCodigo(1);
    }
    const resultado = await reconciliar({ runId: runIdInformado, workspaceId });
    console.log(JSON.stringify(resultado, null, 2));
    return;
  }

  if (!connectionString) {
    console.error("FINANCEIRO_TRIA_DATABASE_URL_LEITURA ausente em apps/api/.env — credencial somente-leitura do financeiro-tria (D-24).");
    throw new SairComCodigo(1);
  }

  const runId = runIdInformado ?? randomUUID();
  const iniciadoEm = new Date().toISOString();
  console.log(`run ${runId} · modo ${dryRun ? "dry-run" : "apply"} · batch-size ${tamanho} · workspace ${workspaceId}`);

  let cursor: string | undefined;
  let numeroDaPagina = 0;
  const acumulado: {
    lidas: number;
    validas: number;
    importadas: number;
    rejeitadas: number;
    ambiguas: number;
    duplicadas: number;
    anexosLigados: number;
    anexosAusentes: number;
    motivosPorCategoria: Record<string, number>;
  } = { lidas: 0, validas: 0, importadas: 0, rejeitadas: 0, ambiguas: 0, duplicadas: 0, anexosLigados: 0, anexosAusentes: 0, motivosPorCategoria: {} };

  for (;;) {
    numeroDaPagina += 1;
    const resultado: ResultadoDeImportarLote = await importarLote({
      workspaceId,
      actingMemberId,
      runId,
      connectionString,
      tamanho,
      dryRun,
      pastaDeExportacoes,
      ...(cursor !== undefined ? { cursor } : {}),
    });

    acumulado.lidas += resultado.lidas;
    acumulado.validas += resultado.validas;
    acumulado.importadas += resultado.importadas;
    acumulado.rejeitadas += resultado.rejeitadas;
    acumulado.ambiguas += resultado.ambiguas;
    acumulado.duplicadas += resultado.duplicadas;
    acumulado.anexosLigados += resultado.anexosLigados;
    acumulado.anexosAusentes += resultado.anexosAusentes;
    for (const [categoria, n] of Object.entries(resultado.motivosPorCategoria)) {
      acumulado.motivosPorCategoria[categoria] = (acumulado.motivosPorCategoria[categoria] ?? 0) + n;
    }

    console.log(
      `página ${numeroDaPagina} · lidas ${resultado.lidas} · importadas ${resultado.importadas} · rejeitadas ${resultado.rejeitadas} · ambíguas ${resultado.ambiguas} · duplicadas ${resultado.duplicadas} · anexos ${resultado.anexosLigados}/${resultado.anexosLigados + resultado.anexosAusentes}`,
    );

    if (!resultado.proximoCursor) break;
    cursor = resultado.proximoCursor;
  }

  const concluidoEm = new Date().toISOString();
  console.log(
    `total · lidas ${acumulado.lidas} · válidas ${acumulado.validas} · importadas ${acumulado.importadas} · rejeitadas ${acumulado.rejeitadas} · ambíguas ${acumulado.ambiguas} · duplicadas ${acumulado.duplicadas} · anexos ligados ${acumulado.anexosLigados} · anexos ausentes ${acumulado.anexosAusentes}`,
  );
  console.log(`categorias: ${JSON.stringify(acumulado.motivosPorCategoria)}`);

  const manifesto = await gerarManifestoDeImportacao({
    runId,
    workspaceId,
    iniciadoEm,
    concluidoEm,
    modo: dryRun ? "dry-run" : "apply",
    resumoDaExecucao: {
      lidas: acumulado.lidas,
      duplicadas: acumulado.duplicadas,
      anexosLigados: acumulado.anexosLigados,
      anexosAusentes: acumulado.anexosAusentes,
    },
  });
  const { md, json } = await escreverManifestoDeImportacao(manifesto, pastaDeExportacoes);
  console.log(`manifesto: ${md} e ${json}`);

  const categoriasNaoReconhecidas = Object.keys(acumulado.motivosPorCategoria).filter((c) => !CATEGORIAS_CONHECIDAS.has(c));
  if (categoriasNaoReconhecidas.length > 0) {
    console.error(`categorias não reconhecidas: ${categoriasNaoReconhecidas.join(", ")} — revisar antes do próximo --apply.`);
    throw new SairComCodigo(1);
  }
}

try {
  await rodar();
} catch (erro) {
  if (erro instanceof SairComCodigo) {
    await encerrar();
    process.exit(erro.codigo);
  }
  console.error(erro instanceof Error ? erro.message : String(erro));
  await encerrar();
  process.exit(1);
}

await encerrar();
