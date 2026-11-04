/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/tarefas-conversacionais.ts` — 6
 * operações. Ver `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import { ACTOR_REF, ID, MODELO_DE_TAREFA, MONEY, opcional, PRIORITY, TASK_DATE, type Esquemas } from "./fragmentos";
import type { Canal } from "@n1/dominio/crm/canais";
import { z } from "zod";

const CRIAR_TAREFA_CONVERSACIONAL_INPUT = z
  .object({
    listId: ID,
    contactId: ID,
    channelId: ID,
    title: z.string().optional(),
    statusId: ID.optional(),
    assignees: z.array(ACTOR_REF).optional(),
    priority: PRIORITY.optional(),
    dueDate: TASK_DATE.optional(),
    dealId: ID.optional(),
    taskTypeId: ID.optional(),
  })
  .strict();

const CRIAR_NEGOCIO_DA_TAREFA_INPUT = z
  .object({
    funnelId: ID,
    title: z.string().optional(),
    value: MONEY.optional(),
  })
  .strict();

/**
 * 3.3.7 — o `Canal[]` que a execução local de `definirCanaisDaLista` e de
 * `createList` leva como último argumento. O servidor NUNCA o usa: `LER_DO_CRM`
 * (`rotas/operacoes.ts`) o troca pelo que leu de `plataforma.canais` na
 * transação (T-14-29). Aqui só cabe a forma (um `id` por item, `.passthrough()`
 * para o resto do Canal) e o tamanho (T-14-30); o conteúdo é descartado.
 *
 * O tipo de saída declarado é o do domínio (`readonly Canal[]`) só para o
 * schema satisfazer a assinatura de `definirCanaisDaLista` e `createList`
 * (`Esquemas`): o valor que sai daqui nunca chega ao domínio, porque quem
 * despacha sobrescreve a posição pelo que `lerDoCrm` leu.
 */
export const CANAIS_DO_NAVEGADOR = z.array(z.object({ id: ID }).passthrough()).max(100) as unknown as z.ZodType<readonly Canal[]>;

export const TAREFAS_CONVERSACIONAIS = {
  alterarModeloDaLista: z.tuple([ID, MODELO_DE_TAREFA]),
  definirCanaisDaLista: z.tuple([ID, z.array(ID), opcional(CANAIS_DO_NAVEGADOR)]),
  criarTarefaConversacional: z.tuple([CRIAR_TAREFA_CONVERSACIONAL_INPUT]),
  trocarCanalDaTarefa: z.tuple([ID, ID]),
  // `dealId || null` em `tarefa-completa.tsx`: `null` desvincula.
  vincularNegocioATarefa: z.tuple([ID, ID.nullable()]),
  criarNegocioDaTarefa: z.tuple([ID, CRIAR_NEGOCIO_DA_TAREFA_INPUT]),
} satisfies Esquemas;
