/**
 * Rotas REST de Consentimentos do Contato (14-08, 3.2.4):
 *
 *   GET  /contatos/:id/consentimentos   o histórico do Contato, o mais recente primeiro
 *   POST /contatos/:id/consentimentos   registra uma decisão (201); o registrador é o Membro da sessão
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição,
 * chama o serviço e formata a resposta. Revogar é um `POST` com `decisao:
 * "revogado"`: não há `PUT`, `PATCH` nem `DELETE`, porque o histórico é a prova
 * (T-14-19). O corpo é `.strict()` e recusa `registradoPor`, `registradoEm`,
 * `contatoId` e `workspaceId`: o registrador e o Espaço saem da sessão, o
 * Contato sai do caminho. Os três vocabulários são os do domínio, cópia da 011.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DECISOES_DE_CONSENTIMENTO, ORIGENS_DE_CONSENTIMENTO, TIPOS_DE_CANAL_DO_CONSENTIMENTO } from "@n1/dominio/crm/consentimentos";
import type { ServicoDeConsentimentos } from "../../servicos/crm/consentimentos";
import { PARAMS_ID, responder, responderLista } from "./comum";

const ID = z.string().min(1).max(64);

const NOVO_CONSENTIMENTO = z
  .object({
    finalidadeId: ID,
    tipoDeCanal: z.enum(TIPOS_DE_CANAL_DO_CONSENTIMENTO),
    decisao: z.enum(DECISOES_DE_CONSENTIMENTO),
    origem: z.enum(ORIGENS_DE_CONSENTIMENTO),
    em: z.string().datetime().optional(),
    evidenciaMensagemId: ID.optional(),
  })
  .strict();

export async function rotasDeConsentimentos(app: FastifyInstance, opcoes: { readonly servico: ServicoDeConsentimentos }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/contatos/:id/consentimentos", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.params.id)),
  );

  rotas.post("/contatos/:id/consentimentos", { schema: { params: PARAMS_ID, body: NOVO_CONSENTIMENTO } }, async (request, reply) =>
    responder(reply, await servico.registrar(request.membro, request.params.id, request.body), 201),
  );
}
