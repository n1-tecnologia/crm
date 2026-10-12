/**
 * Rotas REST de Conversa relacional (Fase 8, 08-06): o fio entre um Contato e um Canal.
 *
 *   GET  /conversas                 lista (só `ativo` ou `na_lixeira`; filtros por Canal, Contato e situação)
 *   GET  /conversas/:id             a Conversa com o resumo do Canal
 *   POST /conversas                 abre a Conversa COM a primeira Mensagem, numa transação (201)
 *   POST /conversas/:id/resolver    `aberta`/`pendente` → `resolvida`
 *   POST /conversas/:id/reabrir     `resolvida` → `aberta`, contando uma reabertura
 *
 * Sem `DELETE` nesta fase. As duas ações não têm corpo e por isso não declaram
 * `body` (o Fastify 5 recusa `content-type: json` sem corpo; ver `canais.ts`).
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. O Membro atuante é SEMPRE
 * `request.membro`; o corpo é `.strict()` — inclusive o objeto `mensagem`
 * aninhado — e recusa `workspaceId`, `situacao`, `estado`, `atribuido`,
 * `criadoPor` e `direcao` (T-08-26): a atribuição e a autoria saem da sessão, e
 * a Mensagem de abertura é sempre `enviada`.
 *
 * Não reusa `QUERY_LISTA` de `comum.ts`: ele aceita `arquivado`, que a Conversa
 * não tem (Pitfall 10).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { ESTADOS_DA_CONVERSA, SITUACOES_DA_CONVERSA, type FiltroDeConversas } from "@n1/dominio/crm/conversas";
import type { ServicoDeConversas } from "../../servicos/crm/conversas";
import { PARAMS_ID, responder, responderLista, TEXTO_LONGO } from "./comum";

const ID = z.string().min(1).max(64);

export const QUERY_LISTA_DE_CONVERSAS = z
  .object({
    estado: z.enum(ESTADOS_DA_CONVERSA).default("ativo"),
    canalId: ID.optional(),
    contatoId: ID.optional(),
    situacao: z.enum(SITUACOES_DA_CONVERSA).optional(),
    limite: z.coerce.number().int().min(1).max(LIMITES_CRM.paginaMaxima).default(LIMITES_CRM.paginaPadrao),
    deslocamento: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const NOVA_CONVERSA = z
  .object({
    canalId: ID,
    contatoId: ID,
    mensagem: z.object({ conteudo: TEXTO_LONGO.min(1) }).strict(),
  })
  .strict();

export async function rotasDeConversas(app: FastifyInstance, opcoes: { readonly servico: ServicoDeConversas }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/conversas", { schema: { querystring: QUERY_LISTA_DE_CONVERSAS } }, async (request, reply) => {
    const { estado, canalId, contatoId, situacao, limite, deslocamento } = request.query;
    const filtro: FiltroDeConversas = {
      estado,
      limite,
      deslocamento,
      ...(canalId !== undefined ? { canalId } : {}),
      ...(contatoId !== undefined ? { contatoId } : {}),
      ...(situacao !== undefined ? { situacao } : {}),
    };
    return responderLista(reply, await servico.listar(request.membro, filtro));
  });

  rotas.get("/conversas/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.obter(request.membro, request.params.id)),
  );

  rotas.post("/conversas", { schema: { body: NOVA_CONVERSA } }, async (request, reply) =>
    responder(reply, await servico.criar(request.membro, request.body), 201),
  );

  rotas.post("/conversas/:id/resolver", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.resolver(request.membro, request.params.id)),
  );

  rotas.post("/conversas/:id/reabrir", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.reabrir(request.membro, request.params.id)),
  );
}
