/**
 * Rotas REST do agregado do Início (15-18, 3.4.7, UCR-07), todas de LEITURA:
 *
 *   GET /crm/inicio/panorama   →  200 { ok: true, dados: PanoramaDoCrm }
 *
 * Cada rota devolve números já somados no servidor (nunca listas paginadas para somar
 * no navegador: `paginaMaxima` é 200). Não grava nada e não sobe a revisão do Espaço.
 *
 * O `querystring` é `.strict()` e só aceita o que o navegador PODE dizer. O Espaço e o
 * Membro saem da sessão, nunca do pedido (T-15-45): um `membroId` na query vira 400 antes
 * de chegar ao serviço, e "meus" é sempre o Membro da sessão (UCR-07, privacidade).
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServicoDoInicio } from "../../servicos/crm/inicio";
import { responder } from "./comum";

/** O panorama não tem parâmetro: qualquer um que chegue é 400. */
const QUERY_DO_PANORAMA = z.object({}).strict();

export async function rotasDoInicio(app: FastifyInstance, opcoes: { readonly servico: ServicoDoInicio }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/crm/inicio/panorama", { schema: { querystring: QUERY_DO_PANORAMA } }, async (request, reply) => {
    return responder(reply, await servico.panorama(request.membro));
  });
}
