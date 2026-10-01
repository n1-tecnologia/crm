/**
 * `GET /estado` — a carga inicial do Espaço de Trabalho (D-04): decorre de
 * D-DEC-01 (hidratar o `DataState` inteiro) e não foi rediscutido. Reaproveita
 * `hidratar()` (`../persistencia/repositorio.ts`), já testado contra o banco
 * real (PERS-01) — esta rota só traduz `EstadoHidratado` para o corpo HTTP
 * que `apps/web/src/dados/transporte.ts` espera.
 *
 * Sem schema de resposta zod: o `DataState` inteiro chega a ~475 KB — validar
 * isso contra um schema custaria mais do que protege; o `JSON.stringify`
 * padrão do Fastify basta.
 *
 * `GET /anexos/:fileId/url` — Plan 02-19: o navegador autenticado do
 * `apps/web` não recebia caminho para baixar um Arquivo por URL assinada
 * (`urlDeDownload`, `servicos/storage-uploads.ts`, só chamado hoje pelo
 * contrato `automation/` do Plan 02-13). Vive neste mesmo módulo — não em
 * `app.ts` nem em arquivo próprio — porque `rotasDeEstado` já está
 * registrada na raiz e já herda `registrarAutenticacao`: nenhum outro
 * plano da mesma onda precisa tocar `app.ts` por causa desta rota. Sempre
 * gera uma URL nova (nunca reaproveita); nunca devolve o caminho do
 * objeto no Storage — só `{ url, expiresAt }`, e `expiresAt` não é lido
 * de volta por nenhuma tela hoje (T-02-14).
 */

import type { FastifyInstance } from "fastify";
import type { WorkspaceFile } from "@n1/dominio";
import { pool } from "../persistencia/conexao";
import { hidratar, ordensComoObjeto } from "../persistencia/repositorio";
import { urlDeDownload } from "../servicos/storage-uploads";

export async function rotasDeEstado(app: FastifyInstance): Promise<void> {
  app.get("/estado", async (request) => {
    const cliente = await pool().connect();
    try {
      const { state, revisao, ordem } = await hidratar(cliente, request.membro.workspaceId);
      return {
        data: state,
        revisao,
        ordens: ordensComoObjeto(ordem),
        sessao: { memberId: request.membro.id },
      };
    } finally {
      cliente.release();
    }
  });

  // Checklist E2 — a tela não via sozinha o que a ponte e o `automation/`
  // gravam. Ela pergunta só a revisão do Espaço (um número, uma linha) e, se
  // o servidor está à frente, recarrega o `/estado` inteiro. Sem Espaço
  // gravado, revisão 0: não há o que recarregar.
  app.get("/estado/revisao", async (request) => {
    const { rows } = await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [
      request.membro.workspaceId,
    ]);
    return { revisao: Number(rows[0]?.revisao ?? 0) };
  });

  app.get<{ Params: { fileId: string } }>("/anexos/:fileId/url", async (request, reply) => {
    const cliente = await pool().connect();
    try {
      // Autorização hoje é por Espaço de Trabalho (quem tem sessão neste
      // Espaço já recebe o `WorkspaceFile` inteiro — objectKey incluído —
      // por `GET /estado`; esta rota não abre superfície nova, só evita que
      // a tela precise reter a URL assinada). Uma autorização por Tarefa
      // ("quem vê a Tarefa vê o anexo") fica para quando o Papel do
      // Financeiro virar Concessão real de Membro (mesmo adiamento de
      // `fluxo-manual-dialog.tsx`).
      const { rows } = await cliente.query<{ dados: unknown }>(
        `select dados from plataforma.registros where workspace_id = $1 and colecao = 'files' and id = $2`,
        [request.membro.workspaceId, request.params.fileId],
      );
      const arquivo = rows[0]?.dados as WorkspaceFile | undefined;
      if (!arquivo) {
        reply.code(404);
        return { error: "Anexo não encontrado." };
      }
      const gerado = await urlDeDownload(arquivo.objectKey);
      return { url: gerado.downloadUrl, expiresAt: gerado.expiresAt.toISOString() };
    } finally {
      cliente.release();
    }
  });
}
