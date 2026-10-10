/**
 * `GET /contatos` e `POST /contatos` — o traçador do CRM (07-01).
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. O Membro atuante é SEMPRE
 * `request.membro`; o corpo `.strict()` recusa `workspaceId`, `criadoPor`,
 * e `estado` (T-07-02, mass assignment). `proprietarioId` é aceito desde o
 * 07-02 (D-11): o serviço o valida como Membro ativo do mesmo Espaço. 07-03
 * alarga o corpo.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServicoDeContatos } from "../../servicos/crm/contatos";
import { QUERY_LISTA, responder, responderLista, TEXTO_CURTO, TEXTO_LONGO } from "./comum";

const CORPO_DE_CRIACAO = z
  .object({
    nome: TEXTO_CURTO.optional(),
    sobrenome: TEXTO_CURTO.optional(),
    descricao: TEXTO_LONGO.optional(),
    proprietarioId: z.string().min(1).max(64).optional(),
  })
  .strict();

export async function rotasDeContatos(app: FastifyInstance, opcoes: { readonly servico: ServicoDeContatos }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();

  rotas.get("/contatos", { schema: { querystring: QUERY_LISTA } }, async (request, reply) =>
    responderLista(reply, await opcoes.servico.listar(request.membro, request.query)),
  );

  rotas.post("/contatos", { schema: { body: CORPO_DE_CRIACAO } }, async (request, reply) =>
    responder(reply, await opcoes.servico.criar(request.membro, request.body), 201),
  );
}
