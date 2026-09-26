/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/tarefas-conversacionais.ts` — 6
 * operações. Ver `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import type { ModeloDeTarefa } from "@n1/dominio";
import { ACTOR_REF, ID, MONEY, PRIORITY, TASK_DATE, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const MODELO_DE_TAREFA = z.enum(["operacional", "conversacional"]);

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

export const TAREFAS_CONVERSACIONAIS = {
  alterarModeloDaLista: z.tuple([ID, MODELO_DE_TAREFA]),
  definirCanaisDaLista: z.tuple([ID, z.array(ID)]),
  criarTarefaConversacional: z.tuple([CRIAR_TAREFA_CONVERSACIONAL_INPUT]),
  trocarCanalDaTarefa: z.tuple([ID, ID]),
  // `dealId || null` em `tarefa-completa.tsx`: `null` desvincula.
  vincularNegocioATarefa: z.tuple([ID, ID.nullable()]),
  criarNegocioDaTarefa: z.tuple([ID, CRIAR_NEGOCIO_DA_TAREFA_INPUT]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<[Igual<z.infer<typeof MODELO_DE_TAREFA>, ModeloDeTarefa>]>;
