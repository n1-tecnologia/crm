/**
 * Rotas REST de Empresa e de vínculo Contato-Empresa (D-03, 07-05).
 *
 *   GET    /empresas                                          lista
 *   POST   /empresas                                          cria Empresa + admin (201, D-08)
 *   GET    /empresas/:id                                      ficha
 *   PATCH  /empresas/:id                                      edita
 *   POST   /empresas/:id/identificadores                      adiciona Identificador (201)
 *   PATCH  /empresas/:id/identificadores/:identificadorId
 *   DELETE /empresas/:id/identificadores/:identificadorId
 *   POST   /empresas/:id/contatos                             vincula um Contato (201)
 *   PATCH  /empresas/:id/contatos/:vinculoId                  cargo e admin
 *   POST   /empresas/:id/contatos/:vinculoId/encerrar         preenche o fim do vínculo
 *   POST   /empresas/:id/trocar-admin                         troca o admin numa transação
 *   POST   /empresas/:id/arquivar | /restaurar
 *   DELETE /empresas/:id                                      lixeira (D-06, D-08)
 *   DELETE /empresas/:id/permanente                           exclusão de vez, só da lixeira
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. O Membro atuante é SEMPRE
 * `request.membro`; os corpos são `.strict()` e recusam `workspaceId`,
 * `criadoPor` e `estado` (T-07-02, mass assignment). O admin de `POST /empresas`
 * é um Contato que já existe OU um novo, nunca os dois nem nenhum (D-08). Os
 * tetos de tamanho vêm de `LIMITES_CRM` (T-07-10). As rotas sem corpo, ou com
 * corpo opcional (`encerrar`, `restaurar`), não declaram `body` obrigatório
 * (Pitfall 4: o Fastify 5 recusa `content-type: json` sem corpo).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { TIPOS_IDENTIFICADOR_EMPRESA } from "@n1/dominio/crm/empresas";
import type { ServicoDeEmpresas } from "../../servicos/crm/empresas";
import {
  CAMPOS_ADICIONAIS,
  DATA_CIVIL,
  ENDERECO,
  PARAMS_ID,
  QUERY_LISTA,
  responder,
  responderLista,
  TEXTO_CURTO,
  TEXTO_LONGO,
} from "./comum";
import { NOVO_CONTATO } from "./contatos";

const ID = z.string().min(1).max(64);
const PARAMS_IDENTIFICADOR = z.object({ id: ID, identificadorId: ID }).strict();
const PARAMS_VINCULO = z.object({ id: ID, vinculoId: ID }).strict();

const ENDERECOS = z.array(ENDERECO).max(LIMITES_CRM.enderecosMaximo);
const PAIS = z.string().trim().length(2);

const IDENTIFICADOR_NOVO = z
  .object({
    tipo: z.enum(TIPOS_IDENTIFICADOR_EMPRESA),
    valor: TEXTO_CURTO.min(1),
    pais: PAIS.optional(),
  })
  .strict();

/** Os campos de dados da Empresa, na criação. O domínio exige nome fantasia ou razão social. */
const CAMPOS_DE_CRIACAO = {
  nomeFantasia: TEXTO_CURTO.optional(),
  razaoSocial: TEXTO_CURTO.optional(),
  descricao: TEXTO_LONGO.optional(),
  matrizId: ID.optional(),
  enderecos: ENDERECOS.optional(),
  camposAdicionais: CAMPOS_ADICIONAIS.optional(),
  origem: TEXTO_CURTO.optional(),
  proprietarioId: ID.optional(),
};

export const NOVA_EMPRESA = z
  .object({
    ...CAMPOS_DE_CRIACAO,
    identificadores: z.array(IDENTIFICADOR_NOVO).max(LIMITES_CRM.identificadoresMaximo).optional(),
  })
  .strict();

/** D-08: um Contato que já existe, OU um novo criado junto. Nunca os dois, nunca nenhum. */
const ADMIN = z.union([
  z.object({ contatoId: ID, cargo: TEXTO_CURTO.optional() }).strict(),
  z.object({ novoContato: NOVO_CONTATO, cargo: TEXTO_CURTO.optional() }).strict(),
]);

const CORPO_DE_CRIACAO = z.object({ empresa: NOVA_EMPRESA, admin: ADMIN }).strict();

/**
 * Na edição, texto vazio LIMPA o campo (a matriz aceita `""` para isso).
 * Identificadores e vínculos têm sub-recurso próprio e ficam de fora.
 */
const CORPO_DE_EDICAO = z
  .object({
    ...CAMPOS_DE_CRIACAO,
    matrizId: z.union([ID, z.literal("")]).optional(),
  })
  .strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });

const CORPO_DE_EDICAO_DE_IDENTIFICADOR = z
  .object({
    principal: z.boolean().optional(),
    verificado: z.boolean().optional(),
    pais: z.union([PAIS, z.literal("")]).optional(),
  })
  .strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });

const NOVO_VINCULO = z
  .object({
    contatoId: ID,
    cargo: TEXTO_CURTO.optional(),
    admin: z.boolean().optional(),
    inicio: DATA_CIVIL.optional(),
  })
  .strict();

const CORPO_DE_EDICAO_DE_VINCULO = z
  .object({ cargo: TEXTO_CURTO.optional(), admin: z.boolean().optional() })
  .strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });

/**
 * Corpo opcional: sem `fim`, o vínculo termina hoje. Sem corpo e sem `content-type` o Fastify 5
 * entrega `null` ao validador, por isso `nullish` e não `optional`.
 */
const CORPO_DE_ENCERRAMENTO = z.object({ fim: DATA_CIVIL.optional() }).strict().nullish();

const CORPO_DE_TROCA_DE_ADMIN = z
  .object({
    vinculoAtualId: ID,
    novoAdmin: z.object({ contatoId: ID, cargo: TEXTO_CURTO.optional() }).strict(),
  })
  .strict();

/** Corpo opcional: restaurar de arquivada não pede nada; da lixeira, o admin. */
const CORPO_DE_RESTAURACAO = z
  .object({ admin: z.object({ contatoId: ID, cargo: TEXTO_CURTO.optional() }).strict().optional() })
  .strict()
  .nullish();

export async function rotasDeEmpresas(app: FastifyInstance, opcoes: { readonly servico: ServicoDeEmpresas }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/empresas", { schema: { querystring: QUERY_LISTA } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.query)),
  );

  rotas.post("/empresas", { schema: { body: CORPO_DE_CRIACAO } }, async (request, reply) =>
    responder(reply, await servico.criar(request.membro, request.body), 201),
  );

  rotas.get("/empresas/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.obter(request.membro, request.params.id)),
  );

  rotas.patch("/empresas/:id", { schema: { params: PARAMS_ID, body: CORPO_DE_EDICAO } }, async (request, reply) =>
    responder(reply, await servico.editar(request.membro, request.params.id, request.body)),
  );

  rotas.post(
    "/empresas/:id/identificadores",
    { schema: { params: PARAMS_ID, body: IDENTIFICADOR_NOVO } },
    async (request, reply) =>
      responder(reply, await servico.adicionarIdentificador(request.membro, request.params.id, request.body), 201),
  );

  rotas.patch(
    "/empresas/:id/identificadores/:identificadorId",
    { schema: { params: PARAMS_IDENTIFICADOR, body: CORPO_DE_EDICAO_DE_IDENTIFICADOR } },
    async (request, reply) =>
      responder(
        reply,
        await servico.editarIdentificador(request.membro, request.params.id, request.params.identificadorId, request.body),
      ),
  );

  rotas.delete(
    "/empresas/:id/identificadores/:identificadorId",
    { schema: { params: PARAMS_IDENTIFICADOR } },
    async (request, reply) =>
      responder(reply, await servico.removerIdentificador(request.membro, request.params.id, request.params.identificadorId)),
  );

  rotas.post("/empresas/:id/contatos", { schema: { params: PARAMS_ID, body: NOVO_VINCULO } }, async (request, reply) =>
    responder(reply, await servico.vincularContato(request.membro, request.params.id, request.body), 201),
  );

  rotas.patch(
    "/empresas/:id/contatos/:vinculoId",
    { schema: { params: PARAMS_VINCULO, body: CORPO_DE_EDICAO_DE_VINCULO } },
    async (request, reply) =>
      responder(reply, await servico.editarVinculo(request.membro, request.params.id, request.params.vinculoId, request.body)),
  );

  rotas.post(
    "/empresas/:id/contatos/:vinculoId/encerrar",
    { schema: { params: PARAMS_VINCULO, body: CORPO_DE_ENCERRAMENTO } },
    async (request, reply) =>
      responder(
        reply,
        await servico.encerrarVinculo(request.membro, request.params.id, request.params.vinculoId, request.body ?? {}),
      ),
  );

  rotas.post(
    "/empresas/:id/trocar-admin",
    { schema: { params: PARAMS_ID, body: CORPO_DE_TROCA_DE_ADMIN } },
    async (request, reply) => responder(reply, await servico.trocarAdmin(request.membro, request.params.id, request.body)),
  );

  rotas.post("/empresas/:id/arquivar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.arquivar(request.membro, request.params.id)),
  );

  rotas.post(
    "/empresas/:id/restaurar",
    { schema: { params: PARAMS_ID, body: CORPO_DE_RESTAURACAO } },
    async (request, reply) => responder(reply, await servico.restaurar(request.membro, request.params.id, request.body ?? {})),
  );

  // D-06: DELETE envia à lixeira (e encerra os vínculos, D-08); excluir de vez é outra rota, e só parte da lixeira.
  rotas.delete("/empresas/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.enviarParaLixeira(request.membro, request.params.id)),
  );

  rotas.delete("/empresas/:id/permanente", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.excluirPermanentemente(request.membro, request.params.id)),
  );
}
