/**
 * `npm run solicitacoes:configurar -w @n1/api [-- flags]`
 *
 * Evolui a configuração da Lista "Solicitações de pagamento" (Plan 02-08)
 * sobre um Espaço de Trabalho que já rodou `npm run bootstrap:gestao -w
 * @n1/api` (Fase 1) — cria o ausente, confere o existente, recusa
 * divergência sem sobrescrever nada.
 *
 * Sem flag, roda em `--dry-run`: hidrata, calcula o diff, mostra e faz
 * rollback — aplicar exige intenção explícita (`--apply`).
 *
 * Flags (`--chave=valor` ou booleanas, sem biblioteca de parsing):
 *   --dry-run          padrão; não grava
 *   --apply            grava de verdade, dentro da Unidade de Trabalho
 *   --workspace=<id>   padrão WORKSPACE_ID do ambiente, ou "ws_n1"
 *   --membro=<id>      Membro atuante (ActivityRecord.actor); padrão "mem_maryane"
 *   --limite=<n>       tasksPerListMinimo; padrão o mínimo do evolver (5000)
 *
 * Disciplina de saída (T-02-21): só ids, contagens e o antes/depois do
 * limite — nunca conteúdo de Campo, nome de fornecedor ou valor. Código de
 * saída 1 quando a evolução recusa por divergência.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { configurarSolicitacoes } from "./solicitacoes";

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
const limite = valorDe("limite");
const dryRun = !temFlag("apply");

const resultado = await configurarSolicitacoes({
  workspaceId,
  actingMemberId,
  dryRun,
  tasksPerListMinimo: limite !== undefined ? Number(limite) : undefined,
});

console.log(`modo         ${resultado.dryRun ? "dry-run (nada gravado)" : "apply"}`);

if (!resultado.ok) {
  console.error(`recusado     ${resultado.error}`);
  await encerrar();
  process.exit(1);
}

console.log(`criados      ${resultado.diff.criados.length}${resultado.diff.criados.length > 0 ? ` — ${resultado.diff.criados.join(", ")}` : ""}`);
console.log(`conferidos   ${resultado.diff.conferidos.length}`);
console.log(`divergentes  ${resultado.diff.divergentes.length}`);
if (resultado.diff.tasksPerList) {
  console.log(`tasksPerList ${resultado.diff.tasksPerList.antes} → ${resultado.diff.tasksPerList.depois}`);
}

await encerrar();
