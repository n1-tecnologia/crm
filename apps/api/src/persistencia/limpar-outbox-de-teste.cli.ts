/**
 * `npm run outbox:limpar-testes -w @n1/api [-- --apply]`
 *
 * Lista (padrão) ou remove (`--apply`) as linhas `pending` que a suíte de
 * testes de `apps/api` deixou em `plataforma.integration_outbox` — e as
 * linhas correspondentes em `plataforma.automacao_agenda` — de Espaços cujo
 * `workspace_id` bate com um dos prefixos confirmados por auditoria
 * (`PREFIXOS_DE_ESPACO_DE_TESTE`, `./limpar-outbox-de-teste.ts`). CR-07
 * (05-19, Task 3): remédio pontual para o que já está no banco; a origem do
 * vazamento em `scheduler-worker.test.ts` foi fechada na Task 1.
 *
 * Sem flag, roda em dry-run: só `levantarOrfaos` e imprime contagens —
 * nenhuma escrita. `--apply` exige intenção explícita e roda `removerOrfaos`
 * dentro de uma transação. `ws_n1` nunca é alcançado (recusado por
 * construção nos dois módulos).
 *
 * Disciplina de saída (T-5-66, mesma T-5-07/T-02-21): só `workspace_id`
 * agregado por PREFIXO, contagens e status/tentativas — nunca `payload`,
 * `taskId` ou id de linha.
 */

import { carregarEnv, encerrar, pool } from "./conexao";
import { levantarOrfaos, removerOrfaos } from "./limpar-outbox-de-teste";

carregarEnv();

const argv = process.argv.slice(2);
function temFlag(chave: string): boolean {
  return argv.includes(`--${chave}`);
}
const apply = temFlag("apply");

function imprimirContagens(titulo: string, linhas: ReadonlyArray<{ readonly prefixo: string; readonly quantidade: number }>, total: number): void {
  console.log(titulo);
  if (linhas.length === 0) {
    console.log("  (nenhuma linha)");
  }
  for (const { prefixo, quantidade } of linhas) {
    console.log(`  ${prefixo.padEnd(32)} ${quantidade}`);
  }
  console.log(`  total${" ".repeat(28)} ${total}`);
}

async function rodar(): Promise<void> {
  const cliente = await pool().connect();
  try {
    if (!apply) {
      const levantamento = await levantarOrfaos(cliente);
      console.log("modo               dry-run (nada removido — rode com -- --apply para remover)");
      console.log("");
      imprimirContagens("integration_outbox (status = pending) por prefixo:", levantamento.outboxPorPrefixo, levantamento.totalOutbox);
      console.log("");
      imprimirContagens("automacao_agenda por prefixo:", levantamento.automacaoAgendaPorPrefixo, levantamento.totalAutomacaoAgenda);
      console.log("");
      console.log(`ws_n1 (pending, NUNCA tocado)    ${levantamento.pendingDeWsN1}`);
      return;
    }

    const removido = await removerOrfaos(cliente, { apply: true });
    console.log("modo               apply");
    console.log(`integration_outbox removidas      ${removido.outboxRemovidas}`);
    console.log(`automacao_agenda removidas         ${removido.automacaoAgendaRemovidas}`);
  } finally {
    cliente.release();
  }
}

await rodar();
await encerrar();
