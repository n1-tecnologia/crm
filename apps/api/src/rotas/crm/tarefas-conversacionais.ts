/**
 * Rotas REST da Tarefa conversacional nas tabelas novas (Fase 14, 3.3.1):
 *
 *   POST /tarefas-conversacionais          cria a Tarefa (em `registros`) e abre ou reaproveita a Conversa (em `plataforma.conversas`), no mesmo commit (201)
 *   POST /tarefas-conversacionais/resumo   Contato, Canal, última Mensagem e Negócio de até 200 Tarefas, numa chamada só (200 `{ itens, total }`)
 *   POST /tarefas-conversacionais/:taskId/canal   troca o Canal da Tarefa: reaproveita ou abre a Conversa e troca só o Vínculo (200)
 *   POST /tarefas-conversacionais/:taskId/negocio   liga o Negócio do Contato da Tarefa, ou o desliga com `negocioId: null` (200)
 *   POST /tarefas-conversacionais/:taskId/negocio/novo   cria o Negócio na 1ª Etapa do Funil e liga a Tarefa a ele, no mesmo commit (201)
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição, chama o
 * serviço e formata a resposta. O Membro atuante é SEMPRE `request.membro`.
 *
 * O corpo é `.strict()` e só aceita o que o navegador PODE dizer: a Lista, o
 * Contato, o Canal, a primeira Mensagem, o Negócio e os campos da Tarefa. Não
 * aceita `alvoConferido`, `referencias`, `workspaceId` nem nome de Contato: quem
 * confere Contato, Canal e Negócio é o serviço, lendo as tabelas na transação
 * (T-14-31). O objeto `mensagem` também é `.strict()`.
 *
 * O resumo é POST porque os Vínculos (até 200 trios de ids) não cabem numa query
 * string. É leitura: não grava nada, e o corpo `.strict()` com `.max(200)` é a
 * primeira barreira contra o lote grande demais (T-14-34); o serviço confere de novo.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { VALOR_DECIMAL } from "@n1/dominio/crm/negocios";
import { RESUMO_MAXIMO } from "@n1/dominio/crm/resumo-da-tarefa";
import { sucesso } from "../../servicos/crm/resultado";
import type { ServicoDeTarefasConversacionais } from "../../servicos/crm/tarefas-conversacionais";
import { ACTOR_REF, PRIORITY, TASK_DATE } from "../esquemas/fragmentos";
import { PRIMEIRA_MENSAGEM, responder, responderLista, TEXTO_CURTO, TEXTO_LONGO } from "./comum";

const ID = z.string().min(1).max(64);

/** O Contato e a Conversa de hoje vêm do Vínculo da Tarefa, lido no servidor: o corpo só diz o Canal novo e, se precisar, a primeira Mensagem. */
export const TROCA_DE_CANAL = z
  .object({
    canalId: ID,
    /** Obrigatória só quando o Contato da Tarefa não tem Conversa aberta no Canal novo (D-07): quem decide é o serviço. */
    mensagem: PRIMEIRA_MENSAGEM.optional(),
  })
  .strict();

/** `null` desliga. O Contato do Negócio é conferido contra o Vínculo da Tarefa, lido no servidor: o corpo não o diz. */
export const LIGAR_NEGOCIO = z.object({ negocioId: ID.nullable() }).strict();

/** O mesmo `valor` de `POST /negocios`: texto decimal com até 2 casas, nunca número. Sem Contato, Etapa nem Proprietário: o Negócio nasce do Contato da Tarefa, na 1ª Etapa, do Membro da sessão. */
const VALOR = z.string().regex(VALOR_DECIMAL, "O valor é um número com até 2 casas decimais, escrito com ponto (ex.: 1234.50).");
export const NEGOCIO_NOVO_DA_TAREFA = z.object({ funilId: ID, titulo: TEXTO_CURTO.min(1).optional(), valor: VALOR.optional() }).strict();

const PARAMS_DA_TAREFA = z.object({ taskId: ID }).strict();

export const NOVA_TAREFA_CONVERSACIONAL = z
  .object({
    listId: ID,
    contatoId: ID,
    canalId: ID,
    /** Obrigatória só quando o par (Contato, Canal) não tem Conversa aberta (D-07): quem decide é o serviço. */
    mensagem: PRIMEIRA_MENSAGEM.optional(),
    negocioId: ID.optional(),
    title: TEXTO_CURTO.optional(),
    statusId: ID.optional(),
    assignees: z.array(ACTOR_REF).max(50).optional(),
    priority: PRIORITY.optional(),
    dueDate: TASK_DATE.optional(),
    taskTypeId: ID.optional(),
  })
  .strict();

/** Só os ids que a Tarefa guarda: o Espaço vem da sessão, e nenhum campo a mais passa. */
export const RESUMO_DE_TAREFAS = z
  .object({
    vinculos: z
      .array(z.object({ taskId: ID, contatoId: ID.optional(), conversaId: ID.optional(), negocioId: ID.optional() }).strict())
      .max(RESUMO_MAXIMO),
  })
  .strict();

export async function rotasDeTarefasConversacionais(
  app: FastifyInstance,
  opcoes: { readonly servico: ServicoDeTarefasConversacionais },
): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.post("/tarefas-conversacionais", { schema: { body: NOVA_TAREFA_CONVERSACIONAL } }, async (request, reply) =>
    responder(reply, await servico.criar(request.membro, request.body), 201),
  );

  rotas.post("/tarefas-conversacionais/resumo", { schema: { body: RESUMO_DE_TAREFAS } }, async (request, reply) => {
    const resultado = await servico.resumo(request.membro, request.body.vinculos);
    return responderLista(reply, resultado.ok ? sucesso({ itens: [...resultado.valor], total: resultado.valor.length }) : resultado);
  });

  rotas.post("/tarefas-conversacionais/:taskId/canal", { schema: { params: PARAMS_DA_TAREFA, body: TROCA_DE_CANAL } }, async (request, reply) =>
    responder(reply, await servico.trocarCanal(request.membro, request.params.taskId, request.body)),
  );

  rotas.post("/tarefas-conversacionais/:taskId/negocio", { schema: { params: PARAMS_DA_TAREFA, body: LIGAR_NEGOCIO } }, async (request, reply) =>
    responder(reply, await servico.vincularNegocio(request.membro, request.params.taskId, request.body)),
  );

  rotas.post("/tarefas-conversacionais/:taskId/negocio/novo", { schema: { params: PARAMS_DA_TAREFA, body: NEGOCIO_NOVO_DA_TAREFA } }, async (request, reply) =>
    responder(reply, await servico.criarNegocio(request.membro, request.params.taskId, request.body), 201),
  );
}
