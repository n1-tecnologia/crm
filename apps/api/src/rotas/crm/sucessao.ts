/**
 * Rota REST da prévia da sucessão (14-10, 3.2.8):
 *
 *   GET /membros/:id/sucessao-no-crm    quanto do CRM passa ao Sucessor se o Membro `:id` sair
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição, chama o
 * serviço e formata a resposta. O Papel de quem pede é conferido no serviço
 * (Administrador ou Proprietário ativo). A passagem em si não é uma rota: roda
 * dentro de `POST /operacoes/removeMember` (`AO_CONFIRMAR`, `rotas/operacoes.ts`).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import type { ServicoDeSucessao } from "../../servicos/crm/sucessao";
import { PARAMS_ID, responder } from "./comum";

export async function rotasDeSucessao(app: FastifyInstance, opcoes: { readonly servico: ServicoDeSucessao }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/membros/:id/sucessao-no-crm", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.previa(request.membro, request.params.id)),
  );
}
