/**
 * `npm run contas-a-receber:corrigir-data-pagamento -w @n1/api [-- --apply]`
 *
 * CR-06, a metade "dados" (Plan 05-22) — molde fino de
 * `./importar-contas-a-receber.cli.ts`: `--chave=valor` sem biblioteca,
 * `SairComCodigo`, `encerrar()` sempre roda antes de sair.
 *
 * Sem flag → `--dry-run` (o padrão nunca grava): relê o export, aplica a
 * MESMA precedência e o MESMO fuso da importação corrigida (05-16) e lista
 * as Contas a receber de `ws_n1` cuja Data de pagamento ficou no dia UTC
 * errado. `--apply` corrige de verdade, dentro de UMA transação auditada,
 * sem Automação e sem outbox.
 *
 * `WORKSPACE_ID` padrão `ws_n1`; operador por
 * `CONTAS_A_RECEBER_OPERADOR_MEMBER_ID`, padrão `CP.financeiroId` (o mesmo
 * do importador). Saída: só contagens, categorias e datas — nunca título de
 * Tarefa, nome de cliente ou valor monetário (T-02-21/D-25); o detalhe por
 * linha (com `legacyTaskId`) fica fora do git, sob a pasta do export.
 */

import { fileURLToPath } from "node:url";

import { CP } from "@n1/dominio/operations/financeiro";
import { carregarEnv, encerrar } from "../../persistencia/conexao";
import { aplicarCorrecoes, type SituacaoDaCorrecao } from "./corrigir-data-de-pagamento-cr";

/** Sinaliza saída não-zero sem chamar `process.exit` direto — `encerrar()` sempre roda antes (molde de `importar-contas-a-receber.cli.ts`). */
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
  const apply = temFlag("apply");
  const dryRun = !apply;

  console.log(`run · modo ${dryRun ? "dry-run" : "apply"} · workspace ${workspaceId} · pasta ${pastaDaLista}`);

  const resultado = await aplicarCorrecoes({ pastaDaLista, workspaceId, actingMemberId, dryRun });

  const porSituacao: Record<SituacaoDaCorrecao, number> = { corrigir: 0, divergente: 0, "nao-encontrada": 0 };
  for (const correcao of resultado.correcoes) porSituacao[correcao.situacao] += 1;

  console.log(`run ${resultado.runId}`);
  console.log(`lidas ${resultado.totais.lidas} · com Data de pagamento ${resultado.totais.comDataDePagamento}`);
  console.log(`afetadas por origem: ${JSON.stringify(resultado.totais.afetadasPorOrigem)}`);
  console.log(`corrigir ${porSituacao.corrigir} · divergente ${porSituacao.divergente} · nao-encontrada ${porSituacao["nao-encontrada"]}`);
  if (!dryRun) console.log(`aplicadas ${resultado.aplicadas}`);
  console.log(`detalhe por linha (fora do git): ${resultado.caminhoDoDetalhe}`);

  if (dryRun && porSituacao.corrigir === 0) {
    console.log("Nada a corrigir — dry-run idempotente (ou nenhuma das 240 foi afetada).");
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
