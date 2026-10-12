/**
 * Rotas REST de Canal (Fase 8, 08-01 e 08-03): a conta conectada de um provedor.
 *
 *   GET   /canais                       lista (só `ativo` ou `arquivado`: Canal não tem lixeira)
 *   POST  /canais                       cria um Canal `desconectada` (201); só Administrador/Proprietário (B35)
 *   GET   /canais/:id                   a ficha; todo Papel ativo ou suspenso lê
 *   PATCH /canais/:id                   configura: só `nome`, `filaPadraoId` e `origemPadraoId` (INV-CXE-02)
 *   POST  /canais/:id/simular-conexao   conecta sem provedor, marcando como simulada (D-08)
 *   POST  /canais/:id/desconectar       volta a `desconectada`
 *   POST  /canais/:id/arquivar          arquiva e desconecta na mesma escrita (11.1)
 *
 * Sem `DELETE`: Canal não tem lixeira (DO-CXE-03); arquivar é o fim de uso.
 * As três ações não têm corpo e por isso não declaram `body` (o Fastify 5
 * recusa `content-type: json` sem corpo; ver `rotas/crm/funis.ts`).
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
import { CONEXOES_DO_CANAL, ESTADOS_DO_CANAL } from "@n1/dominio/crm/canais";
import { PROVEDORES_DE_CANAL, TIPOS_COM_PROVEDOR } from "@n1/dominio/provedores-de-canal";
import type { ServicoDeCanais } from "../../servicos/crm/canais";
import { PARAMS_ID, responder, responderLista, TEXTO_CURTO } from "./comum";

const ID = z.string().min(1).max(64);

const QUERY_LISTA_DE_CANAIS = z
  .object({
    estado: z.enum(ESTADOS_DO_CANAL).default("ativo"),
    limite: z.coerce.number().int().min(1).max(LIMITES_CRM.paginaMaxima).default(LIMITES_CRM.paginaPadrao),
    deslocamento: z.coerce.number().int().min(0).default(0),
    tipo: z.enum(TIPOS_COM_PROVEDOR).optional(),
    provedor: z.enum(PROVEDORES_DE_CANAL).optional(),
    conexao: z.enum(CONEXOES_DO_CANAL).optional(),
    q: z.string().trim().max(100).optional(),
  })
  .strict();

const NOVO_CANAL = z
  .object({
    provedor: z.enum(PROVEDORES_DE_CANAL),
    nome: TEXTO_CURTO.min(1),
    identificador: TEXTO_CURTO.min(1),
    filaPadraoId: ID.optional(),
    origemPadraoId: ID.optional(),
  })
  .strict();

/**
 * Só os três campos que a configuração muda (INV-CXE-02). `tipo`, `provedor`,
 * `identificador` e `conexao` caem no `.strict()` e dão 400 (T-08-14); `null`
 * limpa a Fila ou a Origem padrão.
 */
const EDICAO_DE_CANAL = z
  .object({
    nome: TEXTO_CURTO.min(1).optional(),
    filaPadraoId: ID.nullable().optional(),
    origemPadraoId: ID.nullable().optional(),
  })
  .strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });

export async function rotasDeCanais(app: FastifyInstance, opcoes: { readonly servico: ServicoDeCanais }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/canais", { schema: { querystring: QUERY_LISTA_DE_CANAIS } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.query)),
  );

  rotas.post("/canais", { schema: { body: NOVO_CANAL } }, async (request, reply) =>
    responder(reply, await servico.criar(request.membro, request.body), 201),
  );

  rotas.get("/canais/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.obter(request.membro, request.params.id)),
  );

  rotas.patch("/canais/:id", { schema: { params: PARAMS_ID, body: EDICAO_DE_CANAL } }, async (request, reply) =>
    responder(reply, await servico.editar(request.membro, request.params.id, request.body)),
  );

  rotas.post("/canais/:id/simular-conexao", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.simularConexao(request.membro, request.params.id)),
  );

  rotas.post("/canais/:id/desconectar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.desconectar(request.membro, request.params.id)),
  );

  rotas.post("/canais/:id/arquivar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.arquivar(request.membro, request.params.id)),
  );
}
