/**
 * Rota REST da mesclagem de Contatos (14-09, 3.2.2):
 *
 *   POST /contatos/:id/mesclar    passa o `absorvidoId` do corpo para o Contato `:id`
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição, chama o
 * serviço e formata a resposta. O sobrevivente é SEMPRE o `:id`; o corpo é
 * `.strict()` e recusa `sobreviventeId` e `workspaceId` (o Espaço vem da sessão).
 * A resposta é o Contato sobrevivente detalhado (200): nada de `registros` volta
 * no corpo, mesmo que o gesto tenha gravado lá.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServicoDeMesclagem } from "../../servicos/crm/mesclagem";
import { PARAMS_ID, responder } from "./comum";

const MESCLAR = z.object({ absorvidoId: z.string().min(1).max(64) }).strict();

export async function rotasDeMesclagem(app: FastifyInstance, opcoes: { readonly servico: ServicoDeMesclagem }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.post("/contatos/:id/mesclar", { schema: { params: PARAMS_ID, body: MESCLAR } }, async (request, reply) =>
    responder(reply, await servico.mesclar(request.membro, request.params.id, request.body)),
  );
}
