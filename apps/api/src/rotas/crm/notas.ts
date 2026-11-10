/**
 * Rotas REST de Notas do Contato (14-06, 3.2.7):
 *
 *   GET  /contatos/:id/notas    as notas do Contato, a mais recente primeiro (`limite`/`deslocamento`)
 *   POST /contatos/:id/notas    grava a nota (201); o autor é o Membro da sessão
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. O corpo é `.strict()` e recusa
 * `autorId`, `contatoId` e `workspaceId` (T-14-13): o autor e o Espaço saem da
 * sessão. A nota é só texto (D-04): não há anexo nem menção.
 *
 * Não reusa `QUERY_LISTA` de `comum.ts`: ele carrega `estado` e `q`, que a nota
 * não tem.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import type { ServicoDeNotas } from "../../servicos/crm/notas";
import { PARAMS_ID, responder, responderLista, TEXTO_LONGO } from "./comum";

const QUERY_DE_NOTAS = z
  .object({
    limite: z.coerce.number().int().min(1).max(LIMITES_CRM.paginaMaxima).default(LIMITES_CRM.paginaPadrao),
    deslocamento: z.coerce.number().int().min(0).default(0),
  })
  .strict();

const NOVA_NOTA = z.object({ conteudo: TEXTO_LONGO.min(1) }).strict();

export async function rotasDeNotas(app: FastifyInstance, opcoes: { readonly servico: ServicoDeNotas }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/contatos/:id/notas", { schema: { params: PARAMS_ID, querystring: QUERY_DE_NOTAS } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.params.id, request.query)),
  );

  rotas.post("/contatos/:id/notas", { schema: { params: PARAMS_ID, body: NOVA_NOTA } }, async (request, reply) =>
    responder(reply, await servico.adicionar(request.membro, request.params.id, request.body), 201),
  );
}
