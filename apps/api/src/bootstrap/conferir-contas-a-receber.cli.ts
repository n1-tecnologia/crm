/**
 * `npm run contas-a-receber:conferir -w @n1/api [-- --workspace=<id>]`
 *
 * Conferência SOMENTE LEITURA de "Contas a receber" (D5-02b): compara
 * `ws_n1` (ou o Espaço passado) com o catálogo de `seed-contas-a-receber.ts`
 * e mede o estado operacional da Lista (contagem de Tarefas, data da última
 * criada, distribuição por Status).
 *
 * NÃO HÁ FLAG DE APLICAR MUDANÇA NESTE CLI — o módulo que ele chama
 * (`conferir-contas-a-receber.ts`) não tem caminho de escrita nenhum: só
 * `select`, e a transação sempre termina em `rollback`.
 *
 * Disciplina de saída (T-02-21, T-5-29): só ids do catálogo, nomes de
 * Status/Campo do catálogo e contagens — nunca nome de cliente nem valor
 * monetário. Código de saída sempre 0: este comando relata, não reprova.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { conferirContasAReceber } from "./conferir-contas-a-receber";

carregarEnv();

const argv = process.argv.slice(2);
function valorDe(chave: string): string | undefined {
  const prefixo = `--${chave}=`;
  return argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

const workspaceId = valorDe("workspace") ?? process.env.WORKSPACE_ID ?? "ws_n1";

const relatorio = await conferirContasAReceber({ workspaceId });

console.log(`espaço de trabalho   ${workspaceId}`);
console.log(`modo                 somente leitura (sem opção de gravar; rollback sempre)`);
console.log("");

console.log(`1. Lista             esperada ${relatorio.contagens.lista.esperados} · encontrada ${relatorio.contagens.lista.encontrados}`);
console.log(`2. Status             esperados ${relatorio.contagens.status.esperados} · encontrados ${relatorio.contagens.status.encontrados}`);
console.log(`3. Campos             esperados ${relatorio.contagens.campos.esperados} · encontrados ${relatorio.contagens.campos.encontrados}`);
console.log(`4. Automações         esperadas ${relatorio.contagens.automacoes.esperados} · encontradas ${relatorio.contagens.automacoes.encontrados}`);
console.log(`5. Concessões         esperadas ${relatorio.contagens.concessoes.esperados} · encontradas ${relatorio.contagens.concessoes.encontrados}`);
console.log(`5. Visões             esperadas ${relatorio.contagens.visoes.esperados} · encontradas ${relatorio.contagens.visoes.encontrados}`);
console.log("");

if (relatorio.divergencias.length === 0) {
  console.log("divergências         nenhuma");
} else {
  console.log(`divergências         ${relatorio.divergencias.length}`);
  for (const d of relatorio.divergencias) {
    console.log(`  [${d.colecao}] ${d.id} · ${d.campo}: esperado "${d.esperado}" · encontrado "${d.encontrado}"`);
  }
}
console.log("");

if (relatorio.operacional) {
  console.log("contagens operacionais (o que responde se a Lista está dormente):");
  console.log(`  total de Tarefas em CR.listId   ${relatorio.operacional.totalTarefas}`);
  console.log(`  última Tarefa criada em         ${relatorio.operacional.ultimaCriadaEm ?? "(nenhuma)"}`);
  console.log("  por Status:");
  for (const s of relatorio.operacional.porStatus) {
    console.log(`    ${s.nome} (${s.statusId})   ${s.total}`);
  }
}

await encerrar();
