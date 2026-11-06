/**
 * Rota REST de Atividades do CRM novo (15-37, D-15-09, UCR-03):
 *
 *   GET /atividades?objetoTipo=&objetoId=&limite=&ate=
 *
 * Só lê. O `querystring` é `.strict()`: ator, ação, Espaço e qualquer outro campo
 * viram 400 antes do serviço (o ator e o Espaço saem da sessão, nunca do pedido,
 * T-15-12). `limite` tem teto (T-15-89) e `objetoTipo`/`objetoId` vêm juntos ou
 * nenhum — o serviço recusa o objeto pela metade com `validarFiltroDeAtividades`.
 *
 * A resposta é `{ ok: true, itens }`, sem `total`: a paginação é por tempo, com
 * `ate` (exclusivo) igual ao `at` da última linha recebida.
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIMITES_DE_ATIVIDADE, TIPOS_DE_OBJETO_DO_CRM, validarFiltroDeAtividades, type FiltroDeAtividades } from "@n1/dominio/crm/atividades";
import type { ServicoDeAtividades } from "../../servicos/crm/atividades";
import { recusa } from "../../servicos/crm/resultado";
import { responder } from "./comum";

const QUERY_DE_ATIVIDADES = z
  .object({
    objetoTipo: z.enum(TIPOS_DE_OBJETO_DO_CRM).optional(),
    objetoId: z.string().min(1).max(64).optional(),
    limite: z.coerce.number().int().min(1).max(LIMITES_DE_ATIVIDADE.paginaMaxima).default(LIMITES_DE_ATIVIDADE.paginaPadrao),
    ate: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export async function rotasDeAtividades(app: FastifyInstance, opcoes: { readonly servico: ServicoDeAtividades }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/atividades", { schema: { querystring: QUERY_DE_ATIVIDADES } }, async (request, reply) => {
    const { objetoTipo, objetoId, limite, ate } = request.query;
    const filtro: FiltroDeAtividades = {
      limite,
      ...(objetoTipo !== undefined ? { objetoTipo } : {}),
      ...(objetoId !== undefined ? { objetoId } : {}),
      ...(ate !== undefined ? { ate } : {}),
    };
    // A regra do domínio (objeto inteiro ou nenhum) é a mesma da tela: o pedido torto não chega ao serviço.
    const valido = validarFiltroDeAtividades(filtro);
    if (!valido.ok) {
      return responder(
        reply,
        recusa<never>(400, valido.error, { codigo: "VALOR_INVALIDO", ...(valido.field !== undefined ? { campo: valido.field } : {}) }),
      );
    }
    const resultado = await servico.listar(request.membro, filtro);
    if (!resultado.ok) return responder(reply, resultado);
    return reply.status(200).send({ ok: true, itens: resultado.valor });
  });
}
