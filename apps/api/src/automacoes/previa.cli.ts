/**
 * `npm run automacoes:previa -w @n1/api [-- <workspaceId>] [--agenda [--dias N]]`
 *
 * SÓ LEITURA. Imprime, por (Espaço de Trabalho, Lista) candidata do relógio, o
 * que o agendador faria na primeira volta real: por onde a Lista entra, o
 * regime (ensaio ou direto), quem assinaria e quantas Tarefas da lixeira ele
 * eliminaria. Serve aos checkpoints Q3 e D-04 (10-15, 10-16): o dono roda contra
 * produção, lê a coluna "Lixeira vencida" e só então decide ligar o agendador.
 * Nada é gravado e nenhum título de Tarefa é impresso — a tabela pode ser colada
 * no chat. A lógica mora em `./previa.ts`; este arquivo só imprime.
 *
 * Com `--agenda` (10-16, D-04), em vez da prévia imprime as VOLTAS recentes de
 * `plataforma.automacao_agenda` (padrão: hoje e ontem; `--dias N` muda a janela):
 * Lista, dia, estado, código e contagens, e no fim quantas `falhou`, `SEM_ATOR` e
 * `RECUSA_DO_DOMINIO`. É o que o dono roda no dia seguinte a ligar o agendador.
 * Também só lê.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { relogioDoSistema } from "../testes/relogio";
import { formatarAgenda, formatarPrevia, previaDaAgenda, voltasRecentes } from "./previa";

/** `--dias N` ou `--dias=N`; ausente ou inválido, 2 (hoje e ontem). */
function diasDaAgenda(argumentos: readonly string[]): number {
  const i = argumentos.findIndex((a) => a === "--dias" || a.startsWith("--dias="));
  const bruto = i < 0 ? undefined : (argumentos[i] ?? "").startsWith("--dias=") ? (argumentos[i] ?? "").slice("--dias=".length) : argumentos[i + 1];
  const n = Number(bruto);
  return Number.isInteger(n) && n >= 1 ? n : 2;
}

async function rodar(): Promise<void> {
  const argumentos = process.argv.slice(2);
  const agenda = argumentos.includes("--agenda");
  const dias = diasDaAgenda(argumentos);
  const [workspaceId] = argumentos.filter((a, i) => !a.startsWith("--") && !(i > 0 && argumentos[i - 1] === "--dias"));
  carregarEnv();
  if (agenda) {
    const voltas = await voltasRecentes({ ...(workspaceId ? { workspaceId } : {}), dias });
    if (voltas.length === 0) {
      console.log(`nenhuma volta nos últimos ${dias} dia(s)${workspaceId ? ` no Espaço de Trabalho ${workspaceId}` : ""}.`);
      return;
    }
    console.log(formatarAgenda(voltas));
    return;
  }
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
