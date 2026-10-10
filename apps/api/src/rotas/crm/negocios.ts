/**
 * Rotas REST de Negócio (D-03, D-05): o CRUD e as ações que movem o quadro.
 *
 *   GET    /negocios                      lista (funilId, situacao, estado, empresaId, contatoId, q)
 *   POST   /negocios                      cria (201); sem Funil o padrão, sem Etapa a inicial
 *   GET    /negocios/:id                  ficha com Funil, Etapas, Empresa ou Contato
 *   PATCH  /negocios/:id                  edita escalares e troca o dono
 *   POST   /negocios/:id/mover            muda de Etapa (e de Funil, com Etapa explícita)
 *   POST   /negocios/:id/ganhar           encerra como ganho (409 NEGOCIO_EXIGE_VALOR)
 *   POST   /negocios/:id/perder           encerra como perdido (409 NEGOCIO_EXIGE_MOTIVO)
 *   POST   /negocios/:id/reabrir          reabre (ganho só por administração: 403)
 *   POST   /negocios/:id/arquivar | /restaurar
 *   DELETE /negocios/:id                  lixeira (D-06)
 *   DELETE /negocios/:id/permanente       exclusão de vez, só da lixeira
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. O Membro atuante é SEMPRE
 * `request.membro`; os corpos são `.strict()` e recusam `workspaceId`,
 * `criadoPor`, `estado`, `situacao` e `encerradoEm` (T-07-02, T-07-27): a
 * situação só muda por `ganhar`/`perder`/`reabrir`. `valor` é texto decimal
 * (`numeric(15,2)`), nunca número. Os corpos de `ganhar`, `perder` e `reabrir`
 * são opcionais: sem corpo e sem `content-type` o Fastify 5 entrega `null`
 * ao validador (Pitfall 4), por isso `nullish`. As demais rotas sem corpo não
 * declaram `body`.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SITUACOES_NEGOCIO } from "@n1/dominio/crm/comum";
import { MOEDA, VALOR_DECIMAL } from "@n1/dominio/crm/negocios";
import type { ServicoDeNegocios } from "../../servicos/crm/negocios";
import { DATA_CIVIL, PARAMS_ID, QUERY_LISTA, responder, responderLista, TEXTO_CURTO, TEXTO_LONGO } from "./comum";

const ID = z.string().min(1).max(64);
const VALOR = z.string().regex(VALOR_DECIMAL, "O valor é um número com até 2 casas decimais, escrito com ponto (ex.: 1234.50).");
const CODIGO_DE_MOEDA = z.string().regex(MOEDA, "A moeda é um código de 3 letras maiúsculas (ex.: BRL).");
const PROBABILIDADE = z.number().int().min(0).max(100);

/** `negocios_dono_ck`: exatamente um entre Empresa e Contato. */
const FRASE_DONO = "Um Negócio é de uma Empresa ou de um Contato.";

/** Sem `situacao`, `encerradoEm`, `estado` e `criadoPor`: mudam por ação própria ou vêm da sessão. */
const NOVO_NEGOCIO = z
  .object({
    titulo: TEXTO_CURTO.min(1),
    objeto: TEXTO_CURTO.optional(),
    descricao: TEXTO_LONGO.optional(),
    empresaId: ID.optional(),
    contatoId: ID.optional(),
    funilId: ID.optional(),
    etapaId: ID.optional(),
    valor: VALOR.optional(),
    moeda: CODIGO_DE_MOEDA.optional(),
    probabilidade: PROBABILIDADE.optional(),
    origem: TEXTO_CURTO.optional(),
    dataPrevistaFechamento: DATA_CIVIL.optional(),
    proprietarioId: ID.optional(),
  })
  .strict()
  .refine((corpo) => (corpo.empresaId === undefined) !== (corpo.contatoId === undefined), { message: FRASE_DONO });

/** `null` limpa; `empresaId` e `contatoId` juntos trocam o dono. Funil e Etapa mudam por `mover`. */
const EDICAO = z
  .object({
    titulo: TEXTO_CURTO.min(1).optional(),
    objeto: TEXTO_CURTO.nullable().optional(),
    descricao: TEXTO_LONGO.nullable().optional(),
    empresaId: ID.nullable().optional(),
    contatoId: ID.nullable().optional(),
    valor: VALOR.nullable().optional(),
    moeda: CODIGO_DE_MOEDA.optional(),
    probabilidade: PROBABILIDADE.nullable().optional(),
    origem: TEXTO_CURTO.nullable().optional(),
    dataPrevistaFechamento: DATA_CIVIL.nullable().optional(),
    proprietarioId: ID.optional(),
  })
  .strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });

const QUERY_NEGOCIOS = QUERY_LISTA.extend({
  funilId: ID.optional(),
  situacao: z.enum(SITUACOES_NEGOCIO).optional(),
  empresaId: ID.optional(),
  contatoId: ID.optional(),
});

const CORPO_DE_MOVIMENTO = z.object({ etapaId: ID, funilId: ID.optional() }).strict();

const CORPO_DE_GANHO = z
  .object({ valor: VALOR.optional(), motivoGanho: TEXTO_CURTO.optional(), notaEncerramento: TEXTO_LONGO.optional() })
  .strict()
  .nullish();

const CORPO_DE_PERDA = z.object({ motivoPerda: TEXTO_CURTO.optional(), notaEncerramento: TEXTO_LONGO.optional() }).strict().nullish();

const CORPO_DE_REABERTURA = z.object({ etapaId: ID.optional(), funilId: ID.optional() }).strict().nullish();

export async function rotasDeNegocios(app: FastifyInstance, opcoes: { readonly servico: ServicoDeNegocios }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/negocios", { schema: { querystring: QUERY_NEGOCIOS } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.query)),
  );

  rotas.post("/negocios", { schema: { body: NOVO_NEGOCIO } }, async (request, reply) =>
    responder(reply, await servico.criar(request.membro, request.body), 201),
  );

  rotas.get("/negocios/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.obter(request.membro, request.params.id)),
  );

  rotas.patch("/negocios/:id", { schema: { params: PARAMS_ID, body: EDICAO } }, async (request, reply) =>
    responder(reply, await servico.editar(request.membro, request.params.id, request.body)),
  );

  rotas.post("/negocios/:id/mover", { schema: { params: PARAMS_ID, body: CORPO_DE_MOVIMENTO } }, async (request, reply) =>
    responder(reply, await servico.mover(request.membro, request.params.id, request.body)),
  );

  rotas.post("/negocios/:id/ganhar", { schema: { params: PARAMS_ID, body: CORPO_DE_GANHO } }, async (request, reply) =>
    responder(reply, await servico.ganhar(request.membro, request.params.id, request.body ?? {})),
  );

  rotas.post("/negocios/:id/perder", { schema: { params: PARAMS_ID, body: CORPO_DE_PERDA } }, async (request, reply) =>
    responder(reply, await servico.perder(request.membro, request.params.id, request.body ?? {})),
  );

  rotas.post("/negocios/:id/reabrir", { schema: { params: PARAMS_ID, body: CORPO_DE_REABERTURA } }, async (request, reply) =>
    responder(reply, await servico.reabrir(request.membro, request.params.id, request.body ?? {})),
  );

  rotas.post("/negocios/:id/arquivar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.arquivar(request.membro, request.params.id)),
  );

  rotas.post("/negocios/:id/restaurar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.restaurar(request.membro, request.params.id)),
  );

  // D-06: DELETE envia à lixeira; excluir de vez é outra rota, e só parte da lixeira.
  rotas.delete("/negocios/:id", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.enviarParaLixeira(request.membro, request.params.id)),
  );

  rotas.delete("/negocios/:id/permanente", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.excluirPermanentemente(request.membro, request.params.id)),
  );
}
