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
import { filtrarOrdens, membroVeArquivo, visibilidadePara } from "@n1/dominio/derive-visibilidade";
import { maiorIdDe } from "@n1/dominio/operations";
import { arquivoSemConteudo } from "@n1/dominio/operations/anexos-enviados";
import { acrescentarCanaisProjetados, carregarCanaisProjetados } from "../persistencia/canais-projetados";
import { pool } from "../persistencia/conexao";
import { hidratar, ordensComoObjeto } from "../persistencia/repositorio";
import { urlDeDownload } from "../servicos/storage-uploads";

export async function rotasDeEstado(app: FastifyInstance): Promise<void> {
  app.get("/estado", async (request) => {
    const cliente = await pool().connect();
    try {
      const { state, revisao, ordem } = await hidratar(cliente, request.membro.workspaceId);
      // D-11: os Canais de `plataforma.canais` (008) entram no corpo como Canais relacionais.
      // Só aqui (e em `executar()`, 08-07), nunca dentro de `hidratar` — ver `persistencia/canais-projetados.ts`.
      acrescentarCanaisProjetados(state, await carregarCanaisProjetados(cliente, request.membro.workspaceId));
      // PRIV-03 — o Membro recebe só o que alcança (B38): contêiner privado
      // sem concessão, e as Tarefas dele, não saem do servidor. `sequencia` é
      // o contador de ids do estado INTEIRO, para a cópia local gerar os
      // mesmos ids que o servidor vai gerar (ver `maiorIdDe`).
      const { estado, ocultos } = visibilidadePara(state, request.membro.id);
      return {
        data: estado,
        revisao,
        ordens: filtrarOrdens(ordensComoObjeto(ordem), ocultos),
        sequencia: maiorIdDe(state),
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
      // POSC-08 — autorização por Tarefa: quem vê alguma Tarefa que carrega o
      // Arquivo baixa; quem não vê nenhuma recebe 404, como se ele não
      // existisse (a mesma leitura que recorta `GET /estado`). Um Arquivo que
      // nenhuma Tarefa carrega continua aberto a quem tem sessão no Espaço.
      const { state } = await hidratar(cliente, request.membro.workspaceId);
      const arquivo: WorkspaceFile | undefined = state.files.find((f) => f.id === request.params.fileId);
      if (!arquivo || !membroVeArquivo(state, request.membro.id, arquivo.id)) {
        reply.code(404);
        return { error: "Anexo não encontrado." };
      }
      // FUND-07 — anexo de protótipo (`legado/<id>`): nada subiu, não há URL a assinar.
      if (arquivoSemConteudo(arquivo)) {
        reply.code(409);
        return { error: "Este anexo foi gravado sem conteúdo, antes do envio real: não há o que baixar." };
      }
      const gerado = await urlDeDownload(arquivo.objectKey);
      return { url: gerado.downloadUrl, expiresAt: gerado.expiresAt.toISOString() };
    } finally {
      cliente.release();
    }
  });
}
