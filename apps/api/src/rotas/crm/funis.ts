/**
 * Rotas REST de Funil e Etapa (D-03): a configuração de catálogo do Espaço.
 *
 *   GET    /funis                          lista
 *   POST   /funis                          cria, com as Etapas (201)
 *   GET    /funis/:id                      ficha com as Etapas
 *   PATCH  /funis/:id                      edita atributos
 *   POST   /funis/:id/padrao               define o Funil padrão
 *   POST   /funis/:id/etapas               adiciona Etapa (201)
 *   PUT    /funis/:id/etapas/ordem         reordena (permutação completa)
 *   PATCH  /etapas/:id                     edita Etapa
 *   DELETE /etapas/:id                     remove Etapa (409 com Negócios: D-07)
 *   POST   /etapas/:id/remapear            move os Negócios e remove a Etapa
 *   POST   /funis/:id/arquivar | /restaurar
 *   DELETE /funis/:id                      lixeira (D-06; 409 com Negócios: D-07)
 *   DELETE /funis/:id/permanente           exclusão de vez, só da lixeira
 *   POST   /funis/:id/migrar-negocios      migra os Negócios para outro Funil
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. O Membro atuante é SEMPRE
 * `request.membro`; os corpos são `.strict()` e recusam `workspaceId`,
 * `criadoPor`, `estado` e `padrao` (T-07-02, T-07-14: o padrão só muda por
 * `POST /funis/:id/padrao`). Os arrays e o mapeamento têm teto de 40
 * (T-07-16). Nenhuma rota sem corpo declara `body` (Pitfall 4: o Fastify 5
 * recusa `content-type: json` sem corpo).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIMITE_DE_ETAPAS_POR_FUNIL } from "@n1/dominio/crm/funis";
import type { ServicoDeFunis } from "../../servicos/crm/funis";
import { PARAMS_ID, QUERY_LISTA, responder, responderLista, TEXTO_CURTO, TEXTO_LONGO } from "./comum";

const ID = z.string().min(1).max(64);
const COR = z.string().trim().max(32);
const PROBABILIDADE = z.number().int().min(0).max(100);

const NOVA_ETAPA = z
  .object({
    nome: TEXTO_CURTO.min(1),
    probabilidadePadrao: PROBABILIDADE.optional(),
    cor: COR.optional(),
    descricao: TEXTO_LONGO.optional(),
  })
  .strict();

const ETAPA_NO_FUNIL = z
  .object({
    nome: TEXTO_CURTO.min(1),
    probabilidadePadrao: PROBABILIDADE.optional(),
    cor: COR.optional(),
    descricao: TEXTO_LONGO.optional(),
    posicao: z.number().int().min(1).optional(),
  })
  .strict();

const EDICAO_DE_ETAPA = z
  .object({
    nome: TEXTO_CURTO.min(1).optional(),
    probabilidadePadrao: PROBABILIDADE.optional(),
    cor: COR.optional(),
    descricao: TEXTO_LONGO.optional(),
  })
  .strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });

/** Sem `padrao`, `estado` e `criadoPor`: o padrão tem rota própria e o resto vem da sessão. */
const NOVO_FUNIL = z
  .object({
    nome: TEXTO_CURTO.min(1),
    descricao: TEXTO_LONGO.optional(),
    cor: COR.optional(),
    privado: z.boolean().optional(),
    exigeMotivoPerda: z.boolean().optional(),
    exigeValorGanho: z.boolean().optional(),
    etapas: z.array(NOVA_ETAPA).min(1).max(LIMITE_DE_ETAPAS_POR_FUNIL),
  })
  .strict();

const EDICAO_DE_FUNIL = z
  .object({
    nome: TEXTO_CURTO.min(1).optional(),
    descricao: TEXTO_LONGO.optional(),
    cor: COR.optional(),
    privado: z.boolean().optional(),
    exigeMotivoPerda: z.boolean().optional(),
    exigeValorGanho: z.boolean().optional(),
    ordem: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });

const CORPO_DE_ORDEM = z.object({ etapaIds: z.array(ID).min(1).max(LIMITE_DE_ETAPAS_POR_FUNIL) }).strict();

const CORPO_DE_REMAPEAMENTO = z.object({ paraEtapaId: ID }).strict();

const CORPO_DE_MIGRACAO = z
  .object({
    paraFunilId: ID,
    mapeamento: z.record(ID, ID).refine((mapa) => Object.keys(mapa).length <= LIMITE_DE_ETAPAS_POR_FUNIL, {
      message: `No máximo ${LIMITE_DE_ETAPAS_POR_FUNIL} Etapas no mapeamento.`,
    }),
  })
  .strict();

export async function rotasDeFunis(app: FastifyInstance, opcoes: { readonly servico: ServicoDeFunis }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/funis", { schema: { querystring: QUERY_LISTA } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.query)),
  );

  rotas.post("/funis", { schema: { body: NOVO_FUNIL } }, async (request, reply) =>
    responder(reply, await servico.criar(request.membro, request.body), 201),
  );

  rotas.get("/funis/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.obter(request.membro, request.params.id)),
  );

  rotas.patch("/funis/:id", { schema: { params: PARAMS_ID, body: EDICAO_DE_FUNIL } }, async (request, reply) =>
    responder(reply, await servico.editar(request.membro, request.params.id, request.body)),
  );

  rotas.post("/funis/:id/padrao", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.definirPadrao(request.membro, request.params.id)),
  );

  rotas.post("/funis/:id/etapas", { schema: { params: PARAMS_ID, body: ETAPA_NO_FUNIL } }, async (request, reply) =>
    responder(reply, await servico.adicionarEtapa(request.membro, request.params.id, request.body), 201),
  );

  rotas.put("/funis/:id/etapas/ordem", { schema: { params: PARAMS_ID, body: CORPO_DE_ORDEM } }, async (request, reply) =>
    responder(reply, await servico.reordenarEtapas(request.membro, request.params.id, request.body.etapaIds)),
  );

  rotas.patch("/etapas/:id", { schema: { params: PARAMS_ID, body: EDICAO_DE_ETAPA } }, async (request, reply) =>
    responder(reply, await servico.editarEtapa(request.membro, request.params.id, request.body)),
  );

  rotas.delete("/etapas/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.removerEtapa(request.membro, request.params.id)),
  );

  rotas.post("/etapas/:id/remapear", { schema: { params: PARAMS_ID, body: CORPO_DE_REMAPEAMENTO } }, async (request, reply) =>
    responder(reply, await servico.remapearEtapa(request.membro, request.params.id, request.body.paraEtapaId)),
  );

  rotas.post("/funis/:id/arquivar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.arquivar(request.membro, request.params.id)),
  );

  rotas.post("/funis/:id/restaurar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.restaurar(request.membro, request.params.id)),
  );

  // D-06: DELETE envia à lixeira; excluir de vez é outra rota, e só parte da lixeira.
  rotas.delete("/funis/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.enviarParaLixeira(request.membro, request.params.id)),
  );

  rotas.delete("/funis/:id/permanente", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.excluirPermanentemente(request.membro, request.params.id)),
  );

  rotas.post("/funis/:id/migrar-negocios", { schema: { params: PARAMS_ID, body: CORPO_DE_MIGRACAO } }, async (request, reply) =>
    responder(reply, await servico.migrarNegocios(request.membro, request.params.id, request.body)),
  );
}
