/**
 * A FORMA dos `args` de `POST /operacoes/:nome` — CR-02 (`01-REVIEW.md`).
 *
 * Isto é validação de TRANSPORTE, não regra de negócio: cada schema espelha
 * o TIPO TypeScript da assinatura de uma operação do domínio, nada mais. Uma
 * regra ("título não pode ficar vazio", "e-mail precisa ser válido", limites
 * numéricos) continua exclusivamente em `packages/dominio` — por isso nenhum
 * schema aqui usa `.min()`, `.max()`, `.email()` ou faixa numérica; quem
 * decide isso é a operação, depois de receber a forma certa.
 *
 * Objetos são `.strict()`: uma chave que o domínio não conhece não é
 * inofensiva — é ruído que `gravar()` persistiria no `jsonb` compartilhado
 * (`plataforma.registros`), que TODOS os Membros do Espaço hidratam em
 * `GET /estado`. `.strict()` fecha essa porta antes da Unidade de Trabalho.
 *
 * A validação roda DEPOIS de `reviverArgumentos` (`registro.ts`) — por isso
 * os schemas usam `z.date()`, não a forma serializada `{ $tipo: "Date", iso }`
 * que só existe no corpo HTTP.
 *
 * Cobertura: schema por operação para as 23 operações que o Espaço "Gestão"
 * (D-07) de fato usa na Fase 1 — `tasks.ts` (20), `automations.ts` (1),
 * `financeiro.ts` (2). As demais ~109 operações do registro (`OPERACOES`)
 * caem no fallback estrutural `ARGUMENTOS_GENERICOS`, conservador o bastante
 * para barrar objeto onde o domínio espera escalar (o efeito 2 de CR-02),
 * até ganharem schema próprio.
 *
 * `inviteMember` fica DE PROPÓSITO fora de `ESQUEMAS`: `SERVICOS.inviteMember`
 * (`operacoes.ts`) já valida com `.strip()`, e é o ÚNICO lugar que descarta
 * `userId` do corpo (T-1-08) — um `.strict()` aqui quebraria
 * `convidar-membro.test.ts` (c), que depende do estrutural deixar
 * `{ email, roleId, userId }` passar para o `.strip()` fazer seu trabalho.
 */

import type { DataState, Id } from "@n1/dominio";
import { OPERACOES, type NomeDeOperacao } from "@n1/dominio/operations/registro";
import { z } from "zod";

/** Os argumentos de uma operação DEPOIS de `(state, actingMemberId)` — inferidos da assinatura real em `OPERACOES`. */
export type ArgumentosDe<N extends NomeDeOperacao> =
  (typeof OPERACOES)[N] extends (state: DataState, actingMemberId: Id, ...args: infer A) => unknown ? A : never;

type Esquemas = { readonly [N in NomeDeOperacao]?: z.ZodType<ArgumentosDe<N>> };

/**
 * `JSON.stringify([id, undefined])` vira `[id, null]` — é o que
 * `transferWorkspaceOwnership(..., keepRoleId || undefined)` produz em
 * `transfer-ownership-dialog.tsx`. Todo parâmetro posicional opcional no FIM
 * de uma assinatura precisa aceitar `null` pela mesma razão e devolvê-lo como
 * `undefined` — o domínio recebe o que o tipo promete, nunca `null`.
 */
function opcional<S extends z.ZodTypeAny>(schema: S) {
  return schema.nullish().transform((valor) => valor ?? undefined);
}

// ── Fragmentos compartilhados (não exportados — só a forma) ──────────────

const ID = z.string();
const PRIORITY = z.enum(["urgente", "alta", "normal", "baixa", "semPrioridade"]);
const TASK_DATE = z.discriminatedUnion("form", [
  z.object({ form: z.literal("civilDay"), value: z.string() }).strict(),
  z.object({ form: z.literal("instant"), value: z.string() }).strict(),
]);
const ACTOR_REF = z
  .object({
    kind: z.enum(["member", "agent", "automation", "integration", "system"]),
    id: ID,
  })
  .strict();
const STATUS_MAPPING = z.object({ fromStatusId: ID, toStatusId: ID }).strict();
const VALOR_DE_CAMPO = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]);

const CREATE_TASK_INPUT = z
  .object({
    listId: ID,
    title: z.string(),
    parentTaskId: ID.optional(),
    statusId: ID.optional(),
    assignees: z.array(ACTOR_REF).optional(),
    priority: PRIORITY.optional(),
    dueDate: TASK_DATE.optional(),
    taskTypeId: ID.optional(),
  })
  .strict();

const UPDATE_TASK_INPUT = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    priority: PRIORITY.optional(),
    startDate: TASK_DATE.nullable().optional(),
    dueDate: TASK_DATE.nullable().optional(),
    estimate: z.number().nullable().optional(),
    taskTypeId: ID.optional(),
  })
  .strict();

const ADD_TASK_COMMENT_INPUT = z
  .object({
    content: z.string(),
    parentCommentId: ID.optional(),
    mentions: z.array(z.object({ type: z.string(), id: ID }).strict()).optional(),
    actor: ACTOR_REF.optional(),
  })
  .strict();

const RECEIVABLE_SERIES_INPUT = z
  .object({
    contactId: ID,
    centroDeCusto: z.string(),
    empresa: z.string().optional(),
    produto: z.string().optional(),
    forma: z.string().optional(),
    valorEntrada: z.number().optional(),
    vencimentoEntrada: z.string().optional(),
    valorParcela: z.number(),
    parcelas: z.number(),
    primeiroVencimento: z.string(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo local `Esquemas`) é o portão de drift: uma
 * entrada cuja aridade ou tipo não bate com `ArgumentosDe<N>` não compila
 * (verificado neste repositório, zod 4.6.5 + TS 5: `moveTask: z.tuple([ID])` e
 * `updateTask: z.tuple([ID, z.object({ title: z.number() })])` falham com
 * TS2322 apontando `_output`). Se uma entrada não compilar, o erro está na
 * entrada — não relaxar para `z.ZodTypeAny`.
 */
export const ESQUEMAS = {
  // tasks.ts
  createTask: z.tuple([CREATE_TASK_INPUT]),
  changeTaskStatus: z.tuple([ID, ID]),
  assignTask: z.tuple([ID, ACTOR_REF]),
  unassignTask: z.tuple([ID, ACTOR_REF]),
  moveTask: z.tuple([ID, ID, opcional(z.array(STATUS_MAPPING))]),
  convertChecklistItem: z.tuple([ID, ID, ID, opcional(ID)]),
  trashTask: z.tuple([ID]),
  restoreTask: z.tuple([ID]),
  restoreList: z.tuple([ID]),
  addChecklist: z.tuple([ID, z.string()]),
  addChecklistItem: z.tuple([ID, ID, z.string()]),
  setChecklistItemDone: z.tuple([ID, ID, ID, z.boolean()]),
  startMeeting: z.tuple([ID]),
  endMeeting: z.tuple([ID]),
  updateTask: z.tuple([ID, UPDATE_TASK_INPUT]),
  setTaskFieldValue: z.tuple([ID, ID, VALOR_DE_CAMPO]),
  addTaskComment: z.tuple([ID, ADD_TASK_COMMENT_INPUT]),
  resolveTaskComment: z.tuple([ID, ID, z.boolean()]),
  setTaskTags: z.tuple([ID, z.array(ID)]),
  watchTask: z.tuple([ID, ID, z.boolean()]),
  // automations.ts
  runScheduledAutomations: z.tuple([ID, z.date()]),
  // financeiro.ts
  createReceivableSeries: z.tuple([RECEIVABLE_SERIES_INPUT]),
  runLancamentoAgent: z.tuple([ID, ID, ID]),
} satisfies Esquemas;

/** A forma mais funda que uma operação recebe hoje tem 4 níveis
 * (`AgentDraft.knowledgeSources[].kind`) — 6 é folga, não aperto. `z.date()`
 * recusa `Invalid Date`, que `reviverArgumentos` produz de um `iso` lixo. O
 * que o estrutural NÃO garante — e a rota compensa mapeando `TypeError` — é
 * tipo-por-campo nas operações sem schema próprio. */
const PROFUNDIDADE_MAXIMA = 6;

function valorJson(nivel: number): z.ZodTypeAny {
  const folha = z.union([z.string(), z.number(), z.boolean(), z.null(), z.date()]);
  if (nivel === 0) return folha;
  const proximoNivel = valorJson(nivel - 1);
  return z.union([folha, z.array(proximoNivel), z.record(z.string(), proximoNivel)]);
}

/** Fallback estrutural para operações sem entrada em `ESQUEMAS`. */
export const ARGUMENTOS_GENERICOS: z.ZodType<unknown[]> = z.array(valorJson(PROFUNDIDADE_MAXIMA));

/** `ESQUEMAS[nome] ?? ARGUMENTOS_GENERICOS`. */
export function esquemaDeArgumentos(nome: NomeDeOperacao): z.ZodType<unknown[]> {
  // `ESQUEMAS` é `Partial<Record<...>>` na prática (nem toda operação tem
  // entrada) — o cast é só isso; a FORMA de cada valor já foi garantida pelo
  // portão de drift acima.
  const esquemasPorNome = ESQUEMAS as Partial<Record<NomeDeOperacao, z.ZodType<unknown[]>>>;
  return esquemasPorNome[nome] ?? ARGUMENTOS_GENERICOS;
}
