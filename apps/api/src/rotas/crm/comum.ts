/**
 * Fragmentos zod de transporte e o envelope HTTP do CRM, compartilhados por
 * todas as rotas de `rotas/crm/`.
 *
 * Envelope: sucesso de item `{ ok: true, dados }`; sucesso de lista
 * `{ ok: true, itens, total }`; erro `{ ok: false, error, codigo?, campo?,
 * bloqueios? }`. 400 = forma (zod, `setErrorHandler` de `app.ts`), 403 =
 * Papel, 404 = não existe NESTE Espaço, 409 = regra/integridade. Erro de regra
 * nunca viaja em 200.
 */

import type { FastifyReply } from "fastify";
import { z } from "zod";
import { ESTADOS_CRM, LIMITES_CRM, type Pagina } from "@n1/dominio/crm/comum";
import type { ResultadoCrm } from "../../servicos/crm/resultado";

export const PARAMS_ID = z.object({ id: z.string().min(1).max(64) }).strict();

export const ESTADO = z.enum(ESTADOS_CRM);

export const QUERY_LISTA = z
  .object({
    estado: ESTADO.default("ativo"),
    q: z.string().trim().max(100).optional(),
    limite: z.coerce.number().int().min(1).max(LIMITES_CRM.paginaMaxima).default(LIMITES_CRM.paginaPadrao),
    deslocamento: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const TEXTO_CURTO = z.string().trim().max(LIMITES_CRM.textoCurto);
export const TEXTO_LONGO = z.string().trim().max(LIMITES_CRM.textoLongo);
export const DATA_CIVIL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.");

export const ENDERECO = z
  .object({
    rotulo: z.enum(["residencial", "comercial", "outro"]),
    logradouro: TEXTO_CURTO.optional(),
    numero: TEXTO_CURTO.optional(),
    complemento: TEXTO_CURTO.optional(),
    bairro: TEXTO_CURTO.optional(),
    cidade: TEXTO_CURTO.optional(),
    estado: TEXTO_CURTO.optional(),
    pais: TEXTO_CURTO.optional(),
    codigoPostal: TEXTO_CURTO.optional(),
    principal: z.boolean(),
  })
  .strict();

export const CAMPOS_ADICIONAIS = z
  .record(
    z.string().min(1).max(LIMITES_CRM.chaveDeCampoMaxima),
    z.union([z.string().max(LIMITES_CRM.valorDeCampoMaximo), z.number(), z.boolean()]),
  )
  .refine((campos) => Object.keys(campos).length <= LIMITES_CRM.camposAdicionaisMaximo, {
    message: `No máximo ${LIMITES_CRM.camposAdicionaisMaximo} campos adicionais.`,
  });

/** Traduz o desfecho do serviço em resposta: sucesso de item ou recusa com o status dela. */
export function responder<T>(reply: FastifyReply, resultado: ResultadoCrm<T>, statusDeSucesso = 200) {
  if (resultado.ok) return reply.status(statusDeSucesso).send({ ok: true, dados: resultado.valor });
  const { status, error, codigo, campo, bloqueios } = resultado;
  return reply.status(status).send({
    ok: false,
    error,
    ...(codigo !== undefined ? { codigo } : {}),
    ...(campo !== undefined ? { campo } : {}),
    ...(bloqueios !== undefined ? { bloqueios } : {}),
  });
}

/** O mesmo, para lista: `{ ok: true, itens, total }`. */
export function responderLista<T>(reply: FastifyReply, resultado: ResultadoCrm<Pagina<T>>) {
  if (resultado.ok) return reply.status(200).send({ ok: true, itens: resultado.valor.itens, total: resultado.valor.total });
  return responder(reply, resultado);
}
