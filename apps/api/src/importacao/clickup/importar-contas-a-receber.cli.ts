/**
 * `npm run contas-a-receber:importar -w @n1/api [-- flags]`
 *
 * CLI fino de REC-01, só composição (D-01) — MESMO molde de
 * `./importar-contas-a-pagar.cli.ts` (Plan 03-10): parsing manual de
 * `--chave=valor`, sem biblioteca; `pool().connect()` → trabalho →
 * `cliente.release()` → `encerrar()`. Nenhuma regra de importação mora
 * aqui: o SQL vive em `./importar-contas-a-receber.ts` e `./marco-zero.ts`
 * (reaproveitado sem mudança — a marca é genérica por `listId`).
 *
 * Modos e flags:
 * - sem flag → `--dry-run` (o padrão nunca grava)
 * - `--apply` → importa de verdade e grava `MARCO_ZERO` ao final, e só se a
 *   importação terminou sem rejeição (WR-07 — ver `./politica-do-marco-zero.ts`)
 * - `--lote=<n>` (padrão `250`), `--pasta=<dir>` (padrão
 *   `apps/api/exportacoes/clickup/901107648977`), `--resume` (retoma pelo
 *   ledger — reusar o mesmo `--run`), `--run=<uuid>` (para `--resume` e
 *   para `--reconciliar`)
 * - `--reconciliar --run=<uuid>` → só relata, não importa nada
 * - `--so-marco-zero` → **exige `--apply` para escrever** (WR-07). Sem
 *   `--apply`, só CONSULTA se a marca existe e relata — nunca grava. Com
 *   `--apply`, grava a marca (o processo morreu entre o último lote e ela)
 *   — IDEMPOTENTE por `(workspaceId, listId)`: se o Plan 05-10 já a gravou
 *   para `CR.listId`, esta chamada não cria uma segunda linha
 *   (`marcarMarcoZero` devolve `false`, o CLI relata "já existia").
 * - `--sem-verificacao-de-hash` — pula a conferência de `sha256` contra
 *   `MANIFESTO.json`; recusada junto com `--apply` (T-3-27)
 *
 * Este CLI nunca expõe uma flag de origem: a origem do ledger é sempre
 * `ORIGEM_CONTAS_A_RECEBER`. `WORKSPACE_ID` vem do ambiente com padrão
 * `ws_n1`. A saída imprime só contagens, categorias de lacuna/rejeição,
 * `run_id` e caminhos — nunca nome de cliente, título de Tarefa ou valor
 * monetário (T-02-21/D-25).
 */

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { CP, CR } from "@n1/dominio/operations/financeiro";
import { CODIGOS_DA_AGENDA } from "../../automacoes/scheduler-worker";
import { carregarEnv, encerrar, pool } from "../../persistencia/conexao";
import { importarTudo, reconciliar, relatorioDetalhadoPorLinha, relatorioSanitizado } from "./importar-contas-a-receber";
import { diaCivilDeHoje, marcarMarcoZero } from "./marco-zero";
import { decidirMarcoZero } from "./politica-do-marco-zero";

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
  const actingMemberId = process.env.CONTAS_A_RECEBER_OPERADOR_MEMBER_ID ?? CP.financeiroId;
  const pastaDaLista = valorDe("pasta") ?? fileURLToPath(new URL("../../../exportacoes/clickup/901107648977/", import.meta.url));
  const lote = Number(valorDe("lote") ?? "250");
  const apply = temFlag("apply");
  const dryRun = !apply;
  const pularVerificacaoDeHash = temFlag("sem-verificacao-de-hash");
  const runIdInformado = valorDe("run");
  const soMarcoZero = temFlag("so-marco-zero");
  const reconciliarFlag = temFlag("reconciliar");

  if (pularVerificacaoDeHash && apply) {
    console.error("--sem-verificacao-de-hash não pode vir junto de --apply (T-3-27).");
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
    // WR-07 — decisão pura primeiro: sem --apply, o ramo só relata; nunca
    // grava. `decidirMarcoZero` não sabe SQL, só decide `acao`.
    const decisao = decidirMarcoZero({ soMarcoZero: true, apply });
    const cliente = await pool().connect();
    try {
      if (decisao.acao === "relatar") {
        const existente = await cliente.query(
          "select 1 from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2 and last_error_code = $3 limit 1",
          [workspaceId, CR.listId, CODIGOS_DA_AGENDA.MARCO_ZERO],
        );
        console.log(
          (existente.rowCount ?? 0) > 0
            ? `MARCO_ZERO existe para ${workspaceId}/${CR.listId}.`
            : "MARCO_ZERO não existe — rode com --apply para gravar.",
        );
        return;
      }
      // decisao.acao === "gravar" (soMarcoZero + apply é o único caminho aqui)
      const diaCivil = diaCivilDeHoje();
      const gravou = await marcarMarcoZero(cliente, { workspaceId, listId: CR.listId, diaCivil });
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

  // WR-07 — a decisão pura primeiro, ANTES de qualquer chamada a
  // `marcarMarcoZero`: `rejeitadas > 0` recusa a marca (a checagem que hoje
  // corria depois de já ter gravado); dry-run (`!apply`) nunca toca a marca
  // nem recusa nada — não há o que "terminar pela metade" sem `--apply`.
  const decisao = decidirMarcoZero({ soMarcoZero: false, apply, rejeitadas: resultado.rejeitadas });

  if (decisao.acao === "recusar") {
    console.error(`${decisao.motivo} Código de saída 1.`);
    throw new SairComCodigo(1);
  }

  if (decisao.acao === "gravar") {
    const cliente = await pool().connect();
    try {
      const diaCivil = diaCivilDeHoje();
      const gravouAgora = await marcarMarcoZero(cliente, { workspaceId, listId: CR.listId, diaCivil });
      if (gravouAgora) {
        console.log(`MARCO_ZERO gravado em ${diaCivil}.`);
      } else {
        const jaMarcada = await cliente.query(
          "select 1 from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2 and last_error_code = $3 limit 1",
          [workspaceId, CR.listId, CODIGOS_DA_AGENDA.MARCO_ZERO],
        );
        if ((jaMarcada.rowCount ?? 0) > 0) {
          console.log("MARCO_ZERO já existia — nada a fazer (idempotente por workspaceId+listId; pode ter vindo do Plan 05-10).");
        } else {
          console.error("MARCO_ZERO não foi gravado e não existia antes — confira o Postgres antes de liberar a agenda.");
          throw new SairComCodigo(1);
        }
      }
    } finally {
      cliente.release();
    }
    console.log(`Próximo passo, quando o relato estiver aceitável: npm run automacoes:liberar -w @n1/api -- ${workspaceId} ${CR.listId}`);
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
