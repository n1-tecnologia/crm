/**
 * `npm run automacoes:liberar -w @n1/api -- <workspaceId> <listId>`
 *
 * CLI fino de liberação da primeira volta em ensaio (Task 2, D3-03) — só
 * compõe `liberarLista()` (`./scheduler-worker.ts`); nenhuma regra de
 * negócio mora aqui. Uso: depois de ler o relato do ensaio (as contagens do
 * que TERIA acontecido, gravadas em `plataforma.automacao_agenda` com
 * `last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'`) e decidir que está aceitável,
 * quem opera roda este comando para que a próxima volta do agendador
 * processe a Lista de verdade.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { liberarLista } from "./scheduler-worker";

/** Sinaliza saída não-zero sem chamar `process.exit` direto — permite `encerrar()` sempre rodar antes. */
class SairComCodigo extends Error {
  constructor(readonly codigo: number) {
    super(`saída ${codigo}`);
  }
}

function falharComUso(mensagem: string): never {
  console.error(mensagem);
  throw new SairComCodigo(1);
}

async function rodar(): Promise<void> {
  const [workspaceId, listId] = process.argv.slice(2);
  if (!workspaceId || !listId) {
    falharComUso("uso: npm run automacoes:liberar -w @n1/api -- <workspaceId> <listId>");
  }

  carregarEnv();
  const liberadas = await liberarLista(workspaceId, listId);
  if (liberadas === 0) {
    falharComUso(
      `nenhuma linha de ensaio encontrada para ${workspaceId}/${listId} — confira o workspaceId e o listId, ` +
        "ou a Lista já foi liberada antes.",
    );
  }
  console.log(`liberadas ${liberadas} linha(s) de ensaio em ${workspaceId}/${listId}`);
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
