/**
 * Rotas da conexão do WhatsApp oficial (Sessão 7, 7.2.3). Todas exigem a sessão (Bearer):
 *
 *   POST /canais/:id/whatsapp-oficial/conectar   { phoneNumberId, wabaId, token } → o Canal conectado
 *   GET  /canais/:id/whatsapp-oficial/numero     o número, a conta e o identificador guardados (nunca o token)
 *   GET  /canais/:id/modelos                     os modelos de mensagem do Canal (7.3); vazio fora do WhatsApp oficial
 *   POST /canais/:id/modelos/sincronizar         lê os modelos na Meta e deixa o Canal com exatamente eles (7.3.2)
 *
 * O token chega UMA vez, no corpo do `conectar`, e vai direto para o cofre: nenhuma resposta o devolve e nenhum log o
 * guarda (o log de requisição do Fastify registra método e URL, não o corpo). Sem SQL e sem regra aqui (`rotas/CONTEXT.md`).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServicoDeConexaoDaCloudApi } from "../../mensageria/provedores/whatsapp-cloud/conexao";
import { PARAMS_ID, responder, responderLista } from "./comum";

const CONEXAO = z
  .object({
    // Os IDs da Meta são só dígitos.
    phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "O ID do número tem só dígitos."),
    wabaId: z.string().trim().regex(/^\d{5,30}$/, "O ID da conta do WhatsApp Business tem só dígitos."),
    // O token é uma palavra só, sem espaço nem quebra de linha (um colar com sobra é recusado, não "corrigido").
    token: z.string().trim().min(20, "O token é curto demais.").max(4096).regex(/^\S+$/, "O token não tem espaços."),
  })
  .strict();

export async function rotasDoWhatsAppOficial(app: FastifyInstance, opcoes: { readonly servico: ServicoDeConexaoDaCloudApi }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.post("/canais/:id/whatsapp-oficial/conectar", { schema: { params: PARAMS_ID, body: CONEXAO } }, async (request, reply) =>
    responder(reply, await servico.conectar(request.membro, request.params.id, request.body)),
  );

  rotas.get("/canais/:id/whatsapp-oficial/numero", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.numero(request.membro, request.params.id)),
  );

  rotas.get("/canais/:id/modelos", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responderLista(reply, await servico.modelos(request.membro, request.params.id)),
  );

  rotas.post("/canais/:id/modelos/sincronizar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.sincronizar(request.membro, request.params.id)),
  );
}
