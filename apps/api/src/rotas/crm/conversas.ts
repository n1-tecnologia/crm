/**
 * Rotas REST de Conversa relacional (Fase 8, 08-06): o fio entre um Contato e um Canal.
 *
 *   GET  /conversas                 lista (só `ativo` ou `na_lixeira`; filtros por Canal, Contato, situação, Atribuído, Fila,
 *                                   estrela, `naoLidas` e `q`; cada item traz `contatoNome`, `estrela` e `naoLidas` do Membro da sessão)
 *   GET  /conversas/:id             a Conversa com o resumo do Canal
 *   POST /conversas                 abre a Conversa COM a primeira Mensagem, numa transação (201)
 *   POST /conversas/:id/resolver    `aberta`/`pendente` → `resolvida`
 *   POST /conversas/:id/reabrir     `resolvida` → `aberta`, contando uma reabertura
 *   POST /conversas/:id/atribuir    atribui a um Membro ativo ou a um Agente do Espaço, ou tira a atribuição (`null`)
 *   PUT  /conversas/:id/marcacao    estrela e leitura do PRÓPRIO Membro da sessão: `{ estrela?, lidaAte? }` (3.2.6)
 *   POST /conversas/:id/lixeira     só a Conversa `resolvida` vai para a lixeira, guardando `naLixeiraEm` (3.2.6)
 *   POST /conversas/:id/restaurar   volta para `ativo`; recusa quando o Contato está na lixeira
 *   POST /conversas/:id/mover       troca o Contato da Conversa (3.2.5); `resolverExistente` resolve a que ocupa o par
 *
 * Sem `DELETE` nesta fase. Resolver, reabrir, lixeira e restaurar não têm corpo e por isso não declaram
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
import { PARAMS_ID, PRIMEIRA_MENSAGEM, responder, responderLista, TEXTO_CURTO, TEXTO_LONGO } from "./comum";

const ID = z.string().min(1).max(64);

export const QUERY_LISTA_DE_CONVERSAS = z
  .object({
    estado: z.enum(ESTADOS_DA_CONVERSA).default("ativo"),
    canalId: ID.optional(),
    contatoId: ID.optional(),
    situacao: z.enum(SITUACOES_DA_CONVERSA).optional(),
    atribuidoId: ID.optional(),
    filaId: ID.optional(),
    comEstrela: z.enum(["true", "false"]).transform((texto) => texto === "true").optional(),
    /** Do Membro da sessão, nunca de um id do cliente (T-15-18). */
    naoLidas: z.enum(["true", "false"]).transform((texto) => texto === "true").optional(),
    q: TEXTO_CURTO.optional(),
    limite: z.coerce.number().int().min(1).max(LIMITES_CRM.paginaMaxima).default(LIMITES_CRM.paginaPadrao),
    deslocamento: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const NOVA_CONVERSA = z
  .object({
    canalId: ID,
    contatoId: ID,
    mensagem: PRIMEIRA_MENSAGEM,
  })
  .strict();

export const MOVER_CONVERSA = z.object({ contatoId: ID, resolverExistente: z.boolean().optional() }).strict();

/** Só `estrela` e `lidaAte`: o Membro nunca vem no corpo, é o da sessão (T-14-17). */
export const MARCAR_CONVERSA = z
  .object({ estrela: z.boolean().optional(), lidaAte: z.string().datetime().optional() })
  .strict()
  .refine((corpo) => corpo.estrela !== undefined || corpo.lidaAte !== undefined, {
    message: "Informe a estrela ou até quando a Conversa foi lida.",
  });

export const ATRIBUIR_CONVERSA = z
  .object({ atribuido: z.object({ tipo: z.enum(["membro", "agente"]), id: ID }).strict().nullable() })
  .strict();

export async function rotasDeConversas(app: FastifyInstance, opcoes: { readonly servico: ServicoDeConversas }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/conversas", { schema: { querystring: QUERY_LISTA_DE_CONVERSAS } }, async (request, reply) => {
    const { estado, canalId, contatoId, situacao, atribuidoId, filaId, comEstrela, naoLidas, q, limite, deslocamento } = request.query;
    const filtro: FiltroDeConversas = {
      estado,
      limite,
      deslocamento,
      ...(canalId !== undefined ? { canalId } : {}),
      ...(contatoId !== undefined ? { contatoId } : {}),
      ...(situacao !== undefined ? { situacao } : {}),
      ...(atribuidoId !== undefined ? { atribuidoId } : {}),
      ...(filaId !== undefined ? { filaId } : {}),
      ...(comEstrela !== undefined ? { comEstrela } : {}),
      ...(naoLidas !== undefined ? { naoLidas } : {}),
      ...(q !== undefined && q !== "" ? { q } : {}),
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

  rotas.post("/conversas/:id/mover", { schema: { params: PARAMS_ID, body: MOVER_CONVERSA } }, async (request, reply) =>
    responder(
      reply,
      await servico.mover(request.membro, request.params.id, {
        contatoId: request.body.contatoId,
        resolverExistente: request.body.resolverExistente ?? false,
      }),
    ),
  );

  rotas.post("/conversas/:id/atribuir", { schema: { params: PARAMS_ID, body: ATRIBUIR_CONVERSA } }, async (request, reply) =>
    responder(reply, await servico.atribuir(request.membro, request.params.id, { atribuido: request.body.atribuido })),
  );

  rotas.post("/conversas/:id/lixeira", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.enviarParaLixeira(request.membro, request.params.id)),
  );

  rotas.post("/conversas/:id/restaurar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.restaurar(request.membro, request.params.id)),
  );

  rotas.put("/conversas/:id/marcacao", { schema: { params: PARAMS_ID, body: MARCAR_CONVERSA } }, async (request, reply) =>
    responder(reply, await servico.marcar(request.membro, request.params.id, request.body)),
  );
}
