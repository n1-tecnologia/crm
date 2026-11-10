/**
 * Rotas REST de Mensagem relacional (Fase 8, 08-12): o fio de uma Conversa.
 *
 *   GET  /mensagens?conversaId=&limite=&deslocamento=   o fio da Conversa, por (criado_em, seq)
 *   POST /mensagens                                      envia (`enviada`) ou anota (`interna`) — 201
 *   POST /mensagens/{id}/reenviar                        "Tentar de novo" na Mensagem que falhou — 200 (16-06)
 *   POST mensagens/anexos                                o ticket para subir um arquivo ao bucket — 200 (16-09)
 *   GET  /mensagens/{id}/anexos/{indice}                 uma URL assinada nova do anexo — 200 (16-09)
 *
 * A `recebida` entra SÓ por `receberMensagem` (`servicos/crm/recebimento.ts`, a porta da
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
import { DIRECOES_DE_ENVIO, MAX_ANEXOS_POR_MENSAGEM } from "@n1/dominio/crm/mensagens";
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

/** O arquivo que a pessoa subiu pelo ticket: o servidor escolhe a chave, o cliente só devolve o que recebeu (T-16-33). */
const ANEXO_ENVIADO = z.object({ submissionId: ID, objectId: ID }).strict();

export const NOVA_MENSAGEM = z
  .object({
    conversaId: ID,
    direcao: z.enum(DIRECOES_DE_ENVIO),
    /** Pode ser vazio quando há anexo (INV-CXE-07): a rota recusa vazio SEM anexo, no refinamento abaixo. */
    conteudo: TEXTO_LONGO,
    emRespostaAId: ID.optional(),
    anexos: z.array(ANEXO_ENVIADO).max(MAX_ANEXOS_POR_MENSAGEM).optional(),
  })
  .strict()
  .refine((corpo) => corpo.conteudo !== "" || (corpo.anexos?.length ?? 0) > 0, {
    message: "Escreva a mensagem ou anexe um arquivo antes de enviar.",
    path: ["conteudo"],
  });

export const PARAMS_DE_MENSAGEM = z.object({ id: ID }).strict();

export const CORPO_DO_TICKET_DE_ANEXO = z
  .object({
    conversaId: ID,
    nome: z.string().trim().min(1).max(200),
    tipoDeMidia: z.string().trim().min(1).max(200),
    tamanhoBytes: z.number().int().positive(),
  })
  .strict();

/** O índice do anexo na Mensagem: dígitos e nada mais (`""` e `1.5` não viram número). */
export const PARAMS_DE_ANEXO = z.object({ id: ID, indice: z.string().regex(/^\d{1,4}$/).transform(Number) }).strict();

export async function rotasDeMensagens(app: FastifyInstance, opcoes: { readonly servico: ServicoDeMensagens }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/mensagens", { schema: { querystring: QUERY_LISTA_DE_MENSAGENS } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.query)),
  );

  rotas.post("/mensagens", { schema: { body: NOVA_MENSAGEM } }, async (request, reply) =>
    responder(reply, await servico.enviar(request.membro, request.body), 201),
  );

  // O ticket antes do `:id`: o caminho `anexos` não é a Mensagem de id `anexos`. O Espaço e o Membro vêm da sessão.
  rotas.post("/mensagens/anexos", { schema: { body: CORPO_DO_TICKET_DE_ANEXO } }, async (request, reply) =>
    responder(reply, await servico.pedirTicketDeAnexo(request.membro, request.body), 200),
  );

  // Uma URL assinada nova a cada pedido (TTL curto): o acesso é decidido aqui, pelo Papel e pelo Espaço, e não pela URL.
  rotas.get("/mensagens/:id/anexos/:indice", { schema: { params: PARAMS_DE_ANEXO } }, async (request, reply) =>
    responder(reply, await servico.urlDoAnexo(request.membro, request.params.id, request.params.indice)),
  );

  // Sem corpo: o Membro, o Espaço e a Mensagem vêm da sessão e do `:id`. Herda o JWT e o 403 do Membro suspenso.
  rotas.post("/mensagens/:id/reenviar", { schema: { params: PARAMS_DE_MENSAGEM } }, async (request, reply) =>
    responder(reply, await servico.reenviar(request.membro, request.params.id), 200),
  );
}
