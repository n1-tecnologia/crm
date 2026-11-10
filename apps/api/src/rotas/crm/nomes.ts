/**
 * Rota REST de nomes do CRM novo em lote (15-10, 3.4.9 e 3.4.10, UCR-08):
 *
 *   POST /crm/nomes   { alvos: [{ tipo, id }] }  →  200 { ok: true, itens, total }
 *
 * É LEITURA: não grava nada e não sobe a revisão do Espaço. É POST porque até 200
 * pares (tipo, id) não cabem numa query string, como o resumo da Tarefa
 * conversacional (`POST /tarefas-conversacionais/resumo`).
 *
 * O corpo é `.strict()` e só aceita o que o navegador PODE dizer: o tipo (um dos
 * `TIPOS_DE_OBJETO_DO_CRM`) e o id. Espaço, ator e nome nunca vêm do corpo (T-15-29).
 * `alvos` tem teto (`NOMES_MAXIMO`, T-15-30): a primeira barreira contra o lote grande
 * demais, que o serviço confere de novo. Cada item da resposta é `{ tipo, id, nome }`,
 * na ordem pedida, com `nome: null` para o id desconhecido, de outro Espaço ou de um
 * tipo que o Papel não lê — a resposta não distingue as três causas.
 *
 * Como o resumo, a rota herda `recusarSuspensoNaEscrita` por ser POST: um Membro
 * `suspenso` recebe 403 aqui também (WR-03 segue aberto, D-15-07).
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TIPOS_DE_OBJETO_DO_CRM } from "@n1/dominio/crm/atividades";
import { NOMES_MAXIMO } from "@n1/dominio/crm/nomes";
import type { ServicoDeNomes } from "../../servicos/crm/nomes";
import { responder } from "./comum";

/** Só o tipo e o id: o Espaço vem da sessão, e nenhum campo a mais passa. */
export const NOMES_DOS_ALVOS = z
  .object({
    alvos: z
      .array(z.object({ tipo: z.enum(TIPOS_DE_OBJETO_DO_CRM), id: z.string().min(1).max(64) }).strict())
      .max(NOMES_MAXIMO),
  })
  .strict();

export async function rotasDeNomes(app: FastifyInstance, opcoes: { readonly servico: ServicoDeNomes }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.post("/crm/nomes", { schema: { body: NOMES_DOS_ALVOS } }, async (request, reply) => {
    const resultado = await servico.nomes(request.membro, request.body.alvos);
    if (!resultado.ok) return responder(reply, resultado);
    return reply.status(200).send({ ok: true, itens: [...resultado.valor], total: resultado.valor.length });
  });
}
