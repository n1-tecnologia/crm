/**
 * `npm run contas-a-receber:configurar -w @n1/api [-- flags]`
 *
 * Evolui a configuração da Lista "Contas a receber" (Plan 05-10) sobre um
 * Espaço de Trabalho que já rodou `npm run bootstrap:gestao -w @n1/api`
 * (Fase 1) — cria o que a conferência de 05-09 achou faltando, confere o que
 * já está, recusa divergência sem sobrescrever nada.
 *
 * Sem flag, roda em `--dry-run`: hidrata, calcula o diff, mostra e faz
 * rollback — aplicar exige intenção explícita (`--apply`).
 *
 * Flags (`--chave=valor` ou booleanas, sem biblioteca de parsing):
 *   --dry-run          padrão; não grava
 *   --apply            grava de verdade, dentro da Unidade de Trabalho
 *   --workspace=<id>   padrão WORKSPACE_ID do ambiente, ou "ws_n1"
 *   --membro=<id>      Membro atuante (ActivityRecord.actor); padrão "mem_maryane"
 *
 * Disciplina de saída (T-02-21): só ids, contagens e o antes/depois —
 * nunca conteúdo de Campo, nome de cliente ou valor monetário. Código de
 * saída 1 quando a evolução recusa por divergência.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { configurarContasAReceber } from "./contas-a-receber";

carregarEnv();

const argv = process.argv.slice(2);

function valorDe(chave: string): string | undefined {
  const prefixo = `--${chave}=`;
  const achado = argv.find((argumento) => argumento.startsWith(prefixo));
  return achado?.slice(prefixo.length);
}

function temFlag(chave: string): boolean {
  return argv.includes(`--${chave}`);
}

const workspaceId = valorDe("workspace") ?? process.env.WORKSPACE_ID ?? "ws_n1";
const actingMemberId = valorDe("membro") ?? "mem_maryane";
const dryRun = !temFlag("apply");

const resultado = await configurarContasAReceber({ workspaceId, actingMemberId, dryRun });

console.log(`modo         ${resultado.dryRun ? "dry-run (nada gravado)" : "apply"}`);

if (!resultado.ok) {
  console.error(`recusado     ${resultado.error}`);
  await encerrar();
  process.exit(1);
}

console.log(`criados      ${resultado.diff.criados.length}${resultado.diff.criados.length > 0 ? ` — ${resultado.diff.criados.join(", ")}` : ""}`);
console.log(`conferidos   ${resultado.diff.conferidos.length}`);
console.log(`divergentes  ${resultado.diff.divergentes.length}`);

await encerrar();
