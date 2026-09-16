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
 */

import type { FastifyInstance } from "fastify";
import { pool } from "../persistencia/conexao";
import { hidratar, ordensComoObjeto } from "../persistencia/repositorio";

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
}
