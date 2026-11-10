/**
 * Rotas REST do agregado do Início (15-18, 3.4.7, UCR-07), todas de LEITURA:
 *
 *   GET /crm/inicio/panorama                               →  200 { ok: true, dados: PanoramaDoCrm }
 *   GET /crm/inicio/leads-a-atender?qualificacao=<id>…     →  200 { ok: true, itens: LeadAAtenderDoCrm[], total }
 *   GET /crm/inicio/estatisticas?desde=&ate=&fuso=         →  200 { ok: true, dados: EstatisticasDoCrm }
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
import { conferirJanelaDeEstatisticas, QUALIFICACOES_MAXIMAS } from "@n1/dominio/crm/inicio";
import type { ServicoDoInicio } from "../../servicos/crm/inicio";
import { recusa } from "../../servicos/crm/resultado";
import { responder } from "./comum";

/** O panorama não tem parâmetro: qualquer um que chegue é 400. */
const QUERY_DO_PANORAMA = z.object({}).strict();

const ID_DE_QUALIFICACAO = z.string().min(1).max(64);

/**
 * `qualificacao` se repete (`?qualificacao=a&qualificacao=b`); com um valor só o Fastify entrega texto, e
 * aqui vira lista. Até `QUALIFICACOES_MAXIMAS` (T-15-46). Sem nenhuma, a lista é vazia e nada volta.
 * Não existe campo de Membro: "meus" é o Membro da sessão (UCR-07).
 */
const QUERY_DE_LEADS = z
  .object({
    qualificacao: z
      .union([ID_DE_QUALIFICACAO, z.array(ID_DE_QUALIFICACAO).max(QUALIFICACOES_MAXIMAS)])
      .transform((valor): string[] => (typeof valor === "string" ? [valor] : valor))
      .optional(),
  })
  .strict();

/** Instantes ISO 8601 com fuso e o nome IANA em que os dias são cortados; a janela máxima é conferida no domínio. */
const QUERY_DE_ESTATISTICAS = z
  .object({
    desde: z.iso.datetime({ offset: true }),
    ate: z.iso.datetime({ offset: true }),
    fuso: z.string().min(1).max(64),
  })
  .strict();

export async function rotasDoInicio(app: FastifyInstance, opcoes: { readonly servico: ServicoDoInicio }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.get("/crm/inicio/panorama", { schema: { querystring: QUERY_DO_PANORAMA } }, async (request, reply) => {
    return responder(reply, await servico.panorama(request.membro));
  });

  rotas.get("/crm/inicio/leads-a-atender", { schema: { querystring: QUERY_DE_LEADS } }, async (request, reply) => {
    const resultado = await servico.leadsAAtender(request.membro, request.query.qualificacao ?? []);
    if (!resultado.ok) return responder(reply, resultado);
    return reply.status(200).send({ ok: true, itens: [...resultado.valor], total: resultado.valor.length });
  });

  rotas.get("/crm/inicio/estatisticas", { schema: { querystring: QUERY_DE_ESTATISTICAS } }, async (request, reply) => {
    const { desde, ate, fuso } = request.query;
    // A regra da janela é a do domínio (a mesma do serviço): o pedido torto não chega a ele.
    const conferida = conferirJanelaDeEstatisticas(desde, ate, fuso);
    if (!conferida.ok) {
      return responder(reply, recusa<never>(400, conferida.error, { codigo: "VALOR_INVALIDO", campo: conferida.field }));
    }
    return responder(reply, await servico.estatisticas(request.membro, { desde, ate, fuso }));
  });
}
