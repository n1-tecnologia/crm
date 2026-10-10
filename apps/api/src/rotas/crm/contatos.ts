/**
 * Rotas REST de Contato (D-03): o CRUD completo, de 07-01 (traçador) a 07-03.
 *
 *   GET    /contatos                                   lista
 *   POST   /contatos                                   cria (201)
 *   GET    /contatos/:id                               ficha
 *   PATCH  /contatos/:id                               edita
 *   POST   /contatos/:id/identificadores               adiciona Identificador (201)
 *   PATCH  /contatos/:id/identificadores/:identificadorId
 *   DELETE /contatos/:id/identificadores/:identificadorId
 *   POST   /contatos/:id/arquivar | /restaurar
 *   DELETE /contatos/:id                               lixeira (D-06)
 *   DELETE /contatos/:id/permanente                    exclusão de vez, só da lixeira
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. O Membro atuante é SEMPRE
 * `request.membro`; os corpos são `.strict()` e recusam `workspaceId`,
 * `criadoPor`, `estado` e `modoCriacao` (T-07-02, mass assignment). Os tetos
 * de tamanho vêm de `LIMITES_CRM` (T-07-10). Nenhuma rota sem corpo declara
 * `body` (Pitfall 4: o Fastify 5 recusa `content-type: json` sem corpo).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { TIPOS_IDENTIFICADOR_CONTATO } from "@n1/dominio/crm/contatos";
import type { ServicoDeContatos } from "../../servicos/crm/contatos";
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

const PARAMS_IDENTIFICADOR = z
  .object({ id: z.string().min(1).max(64), identificadorId: z.string().min(1).max(64) })
  .strict();

const IDENTIFICADOR_NOVO = z
  .object({
    tipo: z.enum(TIPOS_IDENTIFICADOR_CONTATO),
    valor: TEXTO_CURTO.min(1),
    valorExibido: TEXTO_CURTO.optional(),
    rotuloCanal: TEXTO_CURTO.optional(),
  })
  .strict();

const PROPRIETARIO = z.string().min(1).max(64);
const ENDERECOS = z.array(ENDERECO).max(LIMITES_CRM.enderecosMaximo);

/** Os campos de dados do Contato, na criação. Todos opcionais; o domínio exige Nome ou Identificador. */
const CAMPOS_DE_CRIACAO = {
  nome: TEXTO_CURTO.optional(),
  sobrenome: TEXTO_CURTO.optional(),
  dataNascimento: DATA_CIVIL.optional(),
  idioma: TEXTO_CURTO.optional(),
  fusoHorario: TEXTO_CURTO.optional(),
  fotoUrl: z.url().max(2000).optional(),
  descricao: TEXTO_LONGO.optional(),
  enderecos: ENDERECOS.optional(),
  camposAdicionais: CAMPOS_ADICIONAIS.optional(),
  origem: TEXTO_CURTO.optional(),
  qualificacao: TEXTO_CURTO.optional(),
  proprietarioId: PROPRIETARIO.optional(),
};

const CORPO_DE_CRIACAO = z
  .object({
    ...CAMPOS_DE_CRIACAO,
    identificadores: z.array(IDENTIFICADOR_NOVO).max(LIMITES_CRM.identificadoresMaximo).optional(),
  })
  .strict();

/**
 * Na edição, texto vazio LIMPA o campo (data e foto aceitam `""` para isso).
 * Identificadores têm sub-recurso próprio e ficam de fora.
 */
const CORPO_DE_EDICAO = z
  .object({
    ...CAMPOS_DE_CRIACAO,
    dataNascimento: z.union([DATA_CIVIL, z.literal("")]).optional(),
    fotoUrl: z.union([z.url().max(2000), z.literal("")]).optional(),
  })
  .strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });

const CORPO_DE_EDICAO_DE_IDENTIFICADOR = z
  .object({
    principal: z.boolean().optional(),
    verificado: z.boolean().optional(),
    valorExibido: TEXTO_CURTO.optional(),
    rotuloCanal: TEXTO_CURTO.optional(),
  })
  .strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });

export async function rotasDeContatos(app: FastifyInstance, opcoes: { readonly servico: ServicoDeContatos }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/contatos", { schema: { querystring: QUERY_LISTA } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.query)),
  );

  rotas.post("/contatos", { schema: { body: CORPO_DE_CRIACAO } }, async (request, reply) =>
    responder(reply, await servico.criar(request.membro, request.body), 201),
  );

  rotas.get("/contatos/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.obter(request.membro, request.params.id)),
  );

  rotas.patch("/contatos/:id", { schema: { params: PARAMS_ID, body: CORPO_DE_EDICAO } }, async (request, reply) =>
    responder(reply, await servico.editar(request.membro, request.params.id, request.body)),
  );

  rotas.post(
    "/contatos/:id/identificadores",
    { schema: { params: PARAMS_ID, body: IDENTIFICADOR_NOVO } },
    async (request, reply) =>
      responder(reply, await servico.adicionarIdentificador(request.membro, request.params.id, request.body), 201),
  );

  rotas.patch(
    "/contatos/:id/identificadores/:identificadorId",
    { schema: { params: PARAMS_IDENTIFICADOR, body: CORPO_DE_EDICAO_DE_IDENTIFICADOR } },
    async (request, reply) =>
      responder(
        reply,
        await servico.editarIdentificador(request.membro, request.params.id, request.params.identificadorId, request.body),
      ),
  );

  rotas.delete(
    "/contatos/:id/identificadores/:identificadorId",
    { schema: { params: PARAMS_IDENTIFICADOR } },
    async (request, reply) =>
      responder(reply, await servico.removerIdentificador(request.membro, request.params.id, request.params.identificadorId)),
  );

  rotas.post("/contatos/:id/arquivar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.arquivar(request.membro, request.params.id)),
  );

  rotas.post("/contatos/:id/restaurar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.restaurar(request.membro, request.params.id)),
  );

  // D-06: DELETE envia à lixeira; excluir de vez é outra rota, e só parte da lixeira.
  rotas.delete("/contatos/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.enviarParaLixeira(request.membro, request.params.id)),
  );

  rotas.delete("/contatos/:id/permanente", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.excluirPermanentemente(request.membro, request.params.id)),
  );
}
