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
 * TRÊS MODOS, um por invocação — nunca dois gestos no mesmo comando:
 *   1. Sem `--prazo-r4`/`--prazo-r5`/`--saque-recorrente`: evolução da Task 1
 *      (Lista, Status, Campos, Automações, Concessões, Visões).
 *   2. Com `--prazo-r4=<n>`/`--prazo-r5=<n>`: SÓ o ajuste de prazo (Task 2,
 *      D5-15).
 *   3. Com `--saque-recorrente`: SÓ garante o Saque de plataforma recorrente
 *      (Task 3, R7) — exige `--valor=<n>` maior que zero (D5-14).
 *
 * Flags (`--chave=valor` ou booleanas, sem biblioteca de parsing):
 *   --dry-run           padrão; não grava
 *   --apply             grava de verdade, dentro da Unidade de Trabalho
 *   --workspace=<id>    padrão WORKSPACE_ID do ambiente, ou "ws_n1"
 *   --membro=<id>       Membro atuante (ActivityRecord.actor); padrão "mem_maryane"
 *   --prazo-r4=<n>      novo `dueDateOffsetDays` de R4 (inteiro > 0)
 *   --prazo-r5=<n>      novo `dueDateOffsetDays` de R5 (inteiro > prazo-r4)
 *   --saque-recorrente  garante a Tarefa "Saque da plataforma de cursos" com Recorrência mensal
 *   --valor=<n>         Valor do Saque (> 0) — obrigatório com `--saque-recorrente`
 *
 * Disciplina de saída (T-02-21): só ids, contagens e o antes/depois —
 * nunca conteúdo de Campo, nome de cliente ou valor monetário (o `--valor`
 * do Saque ecoado na saída é o que o próprio operador acabou de digitar).
 * Código de saída 1 quando a operação recusa.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { ajustarPrazosDeCobranca, configurarContasAReceber, garantirSaqueRecorrente } from "./contas-a-receber";

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

const prazoR4Texto = valorDe("prazo-r4");
const prazoR5Texto = valorDe("prazo-r5");
const saqueRecorrente = temFlag("saque-recorrente");
const valorTexto = valorDe("valor");

console.log(`modo         ${dryRun ? "dry-run (nada gravado)" : "apply"}`);

if (saqueRecorrente) {
  const resultado = await garantirSaqueRecorrente({
    workspaceId,
    actingMemberId,
    dryRun,
    valor: valorTexto !== undefined ? Number(valorTexto) : NaN,
  });
  if (!resultado.ok) {
    console.error(`recusado     ${resultado.error}`);
    await encerrar();
    process.exit(1);
  }
  console.log(`saque        ${resultado.diff.criado ? "criado" : "já existia — Regra conferida, sem divergência"} — ${resultado.diff.taskId}`);
} else if (prazoR4Texto !== undefined || prazoR5Texto !== undefined) {
  const resultado = await ajustarPrazosDeCobranca({
    workspaceId,
    actingMemberId,
    dryRun,
    prazoR4: Number(prazoR4Texto),
    prazoR5: Number(prazoR5Texto),
  });
  if (!resultado.ok) {
    console.error(`recusado     ${resultado.error}`);
    await encerrar();
    process.exit(1);
  }
  console.log(`R4           ${resultado.diff.r4.antes} → ${resultado.diff.r4.depois}`);
  console.log(`R5           ${resultado.diff.r5.antes} → ${resultado.diff.r5.depois}`);
} else {
  const resultado = await configurarContasAReceber({ workspaceId, actingMemberId, dryRun });
  if (!resultado.ok) {
    console.error(`recusado     ${resultado.error}`);
    await encerrar();
    process.exit(1);
  }
  console.log(`criados      ${resultado.diff.criados.length}${resultado.diff.criados.length > 0 ? ` — ${resultado.diff.criados.join(", ")}` : ""}`);
  console.log(`conferidos   ${resultado.diff.conferidos.length}`);
  console.log(`divergentes  ${resultado.diff.divergentes.length}`);
}

await encerrar();
