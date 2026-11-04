/**
 * Rotas REST da Tarefa conversacional nas tabelas novas (Fase 14, 3.3.1):
 *
 *   POST /tarefas-conversacionais    cria a Tarefa (em `registros`) e abre ou reaproveita a Conversa (em `plataforma.conversas`), no mesmo commit (201)
 *
 * Sem SQL e sem regra aqui (`rotas/CONTEXT.md`): a rota lê a requisição, chama o
 * serviço e formata a resposta. O Membro atuante é SEMPRE `request.membro`.
 *
 * O corpo é `.strict()` e só aceita o que o navegador PODE dizer: a Lista, o
 * Contato, o Canal, a primeira Mensagem, o Negócio e os campos da Tarefa. Não
 * aceita `alvoConferido`, `referencias`, `workspaceId` nem nome de Contato: quem
 * confere Contato, Canal e Negócio é o serviço, lendo as tabelas na transação
 * (T-14-31). O objeto `mensagem` também é `.strict()`.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServicoDeTarefasConversacionais } from "../../servicos/crm/tarefas-conversacionais";
import { ACTOR_REF, PRIORITY, TASK_DATE } from "../esquemas/fragmentos";
import { responder, TEXTO_CURTO, TEXTO_LONGO } from "./comum";

const ID = z.string().min(1).max(64);

export const NOVA_TAREFA_CONVERSACIONAL = z
  .object({
    listId: ID,
    contatoId: ID,
    canalId: ID,
    /** Obrigatória só quando o par (Contato, Canal) não tem Conversa aberta (D-07): quem decide é o serviço. */
    mensagem: z.object({ conteudo: TEXTO_LONGO.min(1) }).strict().optional(),
    negocioId: ID.optional(),
    title: TEXTO_CURTO.optional(),
    statusId: ID.optional(),
    assignees: z.array(ACTOR_REF).max(50).optional(),
    priority: PRIORITY.optional(),
    dueDate: TASK_DATE.optional(),
    taskTypeId: ID.optional(),
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
}
