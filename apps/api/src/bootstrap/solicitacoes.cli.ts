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
 *   --email-do-agente=<e-mail>
 *                      e-mail de serviço do Membro "Agente do pipeline";
 *                      padrão EMAIL_DO_AGENTE_DO_PIPELINE (domínio .invalid)
 *
 * Plano pós-auditoria, 2.2: o CLI SEMPRE pede ao evolver o Membro de serviço
 * do "Agente do pipeline" — cria e ativa quando ninguém ativo ocupa o Papel,
 * e concede a ele `administrar` nas Listas de Contas a pagar e a receber (o
 * que o agendador e a ponte do lançamento exigem), por ato de governança.
 * `--membro` precisa ser Administrador ou Proprietário para isso.
 *
 * Disciplina de saída (T-02-21): só ids, contagens e o antes/depois do
 * limite — nunca conteúdo de Campo, nome de fornecedor ou valor. Código de
 * saída 1 quando a evolução recusa por divergência.
 */

import { EMAIL_DO_AGENTE_DO_PIPELINE } from "@n1/dominio/solicitacao-de-pagamento-evolver";
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
const emailDoAgente = valorDe("email-do-agente") || EMAIL_DO_AGENTE_DO_PIPELINE;
const dryRun = !temFlag("apply");

const resultado = await configurarSolicitacoes({
  workspaceId,
  actingMemberId,
  dryRun,
  tasksPerListMinimo: limite !== undefined ? Number(limite) : undefined,
  membroDeServico: { email: emailDoAgente },
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
// Checklist 1.1 — os Campos de Contas a pagar com o nome de um Campo da Lista, que ela deixa de usar.
const herdadosFora = resultado.diff.camposHerdadosFora ?? [];
console.log(`campos herdados fora ${herdadosFora.length}${herdadosFora.length > 0 ? ` — ${herdadosFora.join(", ")}` : " (já estavam)"}`);
console.log(`agente do pipeline ${resultado.diff.membroDeServicoCriado ? `criado — ${resultado.diff.membroDeServicoCriado}` : "já existia (nada criado)"}`);
const concessoes = [...(resultado.diff.concedidos ?? []).map((id) => `${id}→ver na Lista de Solicitações`), ...(resultado.diff.concessoesDeGovernanca ?? [])];
console.log(`concessões ${concessoes.length}${concessoes.length > 0 ? ` — ${concessoes.join(", ")}` : ""}`);

await encerrar();
