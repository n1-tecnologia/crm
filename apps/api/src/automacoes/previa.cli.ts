/**
 * `npm run automacoes:previa -w @n1/api [-- <workspaceId>]`
 *
 * SÓ LEITURA. Imprime, por (Espaço de Trabalho, Lista) candidata do relógio, o
 * que o agendador faria na primeira volta real: por onde a Lista entra, o
 * regime (ensaio ou direto), quem assinaria e quantas Tarefas da lixeira ele
 * eliminaria. Serve aos checkpoints Q3 e D-04 (10-15, 10-16): o dono roda contra
 * produção, lê a coluna "Lixeira vencida" e só então decide ligar o agendador.
 * Nada é gravado e nenhum título de Tarefa é impresso — a tabela pode ser colada
 * no chat. A lógica mora em `./previa.ts`; este arquivo só imprime.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { relogioDoSistema } from "../testes/relogio";
import { formatarPrevia, previaDaAgenda } from "./previa";

async function rodar(): Promise<void> {
  const [workspaceId] = process.argv.slice(2);
  carregarEnv();
  const linhas = await previaDaAgenda({ ...(workspaceId ? { workspaceId } : {}), hoje: relogioDoSistema.agora() });
  if (linhas.length === 0) {
    console.log(workspaceId ? `nenhuma Lista candidata no Espaço de Trabalho ${workspaceId}.` : "nenhuma Lista candidata em nenhum Espaço de Trabalho.");
    return;
  }
  console.log(formatarPrevia(linhas));
}

try {
  await rodar();
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : String(erro));
  await encerrar();
  process.exit(1);
}

await encerrar();
