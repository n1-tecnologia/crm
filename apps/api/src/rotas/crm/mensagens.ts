/**
 * Rotas REST de Mensagem relacional (Fase 8, 08-12): o fio de uma Conversa.
 *
 *   GET  /mensagens?conversaId=&limite=&deslocamento=   o fio da Conversa, por (criado_em, seq)
 *   POST /mensagens                                      envia (`enviada`) ou anota (`interna`) — 201
 *
 * A `recebida` entra SÓ por `registrarRecebida` do serviço (a porta da
 * integração): não existe rota humana para ela. A do webhook vem com o
 * provedor, autenticada por credencial de serviço. Por isso o corpo é
 * `.strict()` com `direcao: z.enum(DIRECOES_DE_ENVIO)` — sem `recebida` — e
 * recusa `idExterno`, `cargaBruta`, `statusEntrega`, `ator`, `canalId` e
 * `modeloId` (T-08-44): o Canal vem da Conversa, o Ator da sessão e o status da
 * conexão do Canal.
 *
 * Nenhuma resposta leva a carga bruta do provedor (A9, T-08-45): o repositório
 * nem a seleciona nas leituras, e esta rota não tem como pedi-la.
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. O Membro atuante é SEMPRE `request.membro`.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { DIRECOES_DE_ENVIO } from "@n1/dominio/crm/mensagens";
import type { ServicoDeMensagens } from "../../servicos/crm/mensagens";
import { responder, responderLista, TEXTO_LONGO } from "./comum";

const ID = z.string().min(1).max(64);

export const QUERY_LISTA_DE_MENSAGENS = z
  .object({
    conversaId: ID,
    limite: z.coerce.number().int().min(1).max(LIMITES_CRM.paginaMaxima).default(LIMITES_CRM.paginaPadrao),
    deslocamento: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const NOVA_MENSAGEM = z
  .object({
    conversaId: ID,
    direcao: z.enum(DIRECOES_DE_ENVIO),
    conteudo: TEXTO_LONGO.min(1),
    emRespostaAId: ID.optional(),
  })
  .strict();

export async function rotasDeMensagens(app: FastifyInstance, opcoes: { readonly servico: ServicoDeMensagens }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/mensagens", { schema: { querystring: QUERY_LISTA_DE_MENSAGENS } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.query)),
  );

  rotas.post("/mensagens", { schema: { body: NOVA_MENSAGEM } }, async (request, reply) =>
    responder(reply, await servico.enviar(request.membro, request.body), 201),
  );
}
