/**
 * Rotas REST de Canal (Fase 8, 08-01): a conta conectada de um provedor.
 *
 *   GET  /canais    lista (só `ativo` ou `arquivado`: Canal não tem lixeira)
 *   POST /canais    cria um Canal `desconectada` (201); só Administrador/Proprietário (B35)
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. O Membro atuante é SEMPRE
 * `request.membro`; o corpo é `.strict()` e recusa `workspaceId`, `tipo`,
 * `conexao`, `estado`, `configuradoPor` e `conexaoSimulada` (T-08-02): o tipo
 * sai do provedor e o Canal nasce desconectado.
 *
 * Não reusa `ESTADO`/`QUERY_LISTA` de `comum.ts`: eles aceitam `na_lixeira`, que
 * o Canal não tem (Pitfall 10).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { ESTADOS_DO_CANAL } from "@n1/dominio/crm/canais";
import { PROVEDORES_DE_CANAL } from "@n1/dominio/provedores-de-canal";
import type { ServicoDeCanais } from "../../servicos/crm/canais";
import { responder, responderLista, TEXTO_CURTO } from "./comum";

const QUERY_LISTA_DE_CANAIS = z
  .object({
    estado: z.enum(ESTADOS_DO_CANAL).default("ativo"),
    limite: z.coerce.number().int().min(1).max(LIMITES_CRM.paginaMaxima).default(LIMITES_CRM.paginaPadrao),
    deslocamento: z.coerce.number().int().min(0).default(0),
  })
  .strict();

const NOVO_CANAL = z
  .object({
    provedor: z.enum(PROVEDORES_DE_CANAL),
    nome: TEXTO_CURTO.min(1),
    identificador: TEXTO_CURTO.min(1),
  })
  .strict();

export async function rotasDeCanais(app: FastifyInstance, opcoes: { readonly servico: ServicoDeCanais }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/canais", { schema: { querystring: QUERY_LISTA_DE_CANAIS } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.query)),
  );

  rotas.post("/canais", { schema: { body: NOVO_CANAL } }, async (request, reply) =>
    responder(reply, await servico.criar(request.membro, request.body), 201),
  );
}
