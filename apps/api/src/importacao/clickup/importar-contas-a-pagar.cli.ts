/**
 * `npm run contas-a-pagar:importar -w @n1/api [-- flags]`
 *
 * CLI fino de PAG-01, só composição (D-01) — no molde de `exportar.cli.ts`
 * (parsing manual de `--chave=valor`, sem biblioteca) e de `gestao.cli.ts`
 * (`pool().connect()` → trabalho → `cliente.release()` → `encerrar()`).
 * Nenhuma regra de importação mora aqui: o SQL vive em
 * `./importar-contas-a-pagar.ts` e `./marco-zero.ts`.
 *
 * Modos e flags:
 * - sem flag → `--dry-run` (o padrão nunca grava)
 * - `--apply` → importa de verdade e grava `MARCO_ZERO` ao final
 * - `--lote=<n>` (padrão `250`), `--pasta=<dir>` (padrão
 *   `apps/api/exportacoes/clickup/901107637383`), `--resume` (retoma pelo
 *   ledger — reusar o mesmo `--run`), `--run=<uuid>` (para `--resume` e
 *   para `--reconciliar`)
 * - `--reconciliar --run=<uuid>` → só relata, não importa nada
 * - `--so-marco-zero` → grava só a marca (o processo morreu entre o último
 *   lote e ela)
 * - `--sem-verificacao-de-hash` → pula a conferência de `sha256` contra
 *   `MANIFESTO.json`; aceitável só com o padrão (`--dry-run`), recusado
 *   junto com `--apply` (T-3-27)
 *
 * Este CLI nunca expõe uma flag de origem: a origem do ledger é sempre
 * `ORIGEM_CONTAS_A_PAGAR`, a constante de `@n1/dominio` — só o teste de
 * `./importar-contas-a-pagar.test.ts` passa um valor diferente, por dentro,
 * nunca por uma flag deste arquivo.
 *
 * `WORKSPACE_ID` vem do ambiente com padrão `ws_n1`, como em
 * `gestao.cli.ts`. A saída imprime só contagens, categorias de lacuna,
 * `run_id` e caminhos — nunca título de Tarefa, valor de Campo ou nome de
 * fornecedor (T-3-25).
 */

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { CP } from "@n1/dominio/operations/financeiro";
import { carregarEnv, encerrar, pool } from "../../persistencia/conexao";
import { importarTudo, reconciliar, relatorioDetalhadoPorLinha, relatorioSanitizado } from "./importar-contas-a-pagar";
import { diaCivilDeHoje, marcarMarcoZero } from "./marco-zero";

/** Sinaliza saída não-zero sem chamar `process.exit` direto — `encerrar()` sempre roda antes (molde de `liberar.cli.ts`). */
class SairComCodigo extends Error {
  constructor(readonly codigo: number) {
    super(`saída ${codigo}`);
  }
}

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
  const actingMemberId = process.env.CONTAS_A_PAGAR_OPERADOR_MEMBER_ID ?? CP.financeiroId;
  const pastaDaLista = valorDe("pasta") ?? fileURLToPath(new URL("../../../exportacoes/clickup/901107637383/", import.meta.url));
  const lote = Number(valorDe("lote") ?? "250");
  const apply = temFlag("apply");
  const dryRun = !apply;
  const pularVerificacaoDeHash = temFlag("sem-verificacao-de-hash");
  const runIdInformado = valorDe("run");
  const soMarcoZero = temFlag("so-marco-zero");
  const reconciliarFlag = temFlag("reconciliar");

  if (pularVerificacaoDeHash && apply) {
    throw new SairComCodigo(1);
  }

  if (reconciliarFlag) {
    if (!runIdInformado) {
      console.error("--reconciliar exige --run=<uuid>.");
      throw new SairComCodigo(1);
    }
    const resultado = await reconciliar({ runId: runIdInformado, workspaceId });
    console.log(JSON.stringify(resultado, null, 2));
    return;
  }

  if (soMarcoZero) {
    const cliente = await pool().connect();
    try {
      const diaCivil = diaCivilDeHoje();
      const gravou = await marcarMarcoZero(cliente, { workspaceId, listId: CP.listId, diaCivil });
      console.log(gravou ? `MARCO_ZERO gravado em ${diaCivil}.` : "MARCO_ZERO já existia — nada a fazer.");
    } finally {
      cliente.release();
    }
    return;
  }

  const runId = runIdInformado ?? randomUUID();
  console.log(`run ${runId} · modo ${dryRun ? "dry-run" : "apply"} · pasta ${pastaDaLista} · lote ${lote}`);

  const resultado = await importarTudo({
    pastaDaLista,
    workspaceId,
    actingMemberId,
    runId,
    lote,
    dryRun,
    pularVerificacaoDeHash,
    registrarProgresso: (linha) => console.log(linha),
  });

  console.log(
    `lidas ${resultado.lidas} · importadas ${resultado.importadas} · avisadas ${resultado.avisadas} · ` +
      `rejeitadas ${resultado.rejeitadas} · puladas ${resultado.puladas}`,
  );
  console.log(`lacunas por categoria: ${JSON.stringify(resultado.lacunasPorCategoria)}`);
  console.log(`rejeições por categoria: ${JSON.stringify(resultado.rejeicoesPorCategoria)}`);

  const { pastaDoRelatorio } = await relatorioSanitizado({ ...resultado, pastaDaLista, dryRun });
  console.log(`relatório agregado (versionado): ${pastaDoRelatorio}`);
  const { caminho } = await relatorioDetalhadoPorLinha(pastaDaLista, runId, resultado.detalhesPorLinha);
  console.log(`relatório detalhado por linha (fora do git): ${caminho}`);

  if (!dryRun) {
    const cliente = await pool().connect();
    try {
      const diaCivil = diaCivilDeHoje();
      const gravouAgora = await marcarMarcoZero(cliente, { workspaceId, listId: CP.listId, diaCivil });
      if (gravouAgora) {
        console.log(`MARCO_ZERO gravado em ${diaCivil}.`);
      } else {
        const jaMarcada = await cliente.query(
          "select 1 from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2 and last_error_code = 'MARCO_ZERO' limit 1",
          [workspaceId, CP.listId],
        );
        if ((jaMarcada.rowCount ?? 0) > 0) {
          console.log("MARCO_ZERO já existia — nada a fazer.");
        } else {
          console.error("MARCO_ZERO não foi gravado e não existia antes — confira o Postgres antes de liberar a agenda.");
          throw new SairComCodigo(1);
        }
      }
    } finally {
      cliente.release();
    }
    console.log(`Próximo passo, quando o relato estiver aceitável: npm run automacoes:liberar -w @n1/api -- ${workspaceId} ${CP.listId}`);
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
