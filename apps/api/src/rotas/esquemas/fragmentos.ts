/**
 * A base compartilhada dos schemas de argumentos por módulo do domínio —
 * CR-02/IN-10 (`01-REVIEW.md`, `01-VERIFICATION.md`).
 *
 * Isto é validação de TRANSPORTE, não regra de negócio: cada fragmento
 * espelha o TIPO TypeScript de um pedaço da assinatura de uma ou mais
 * operações, nada mais. Uma regra ("título não pode ficar vazio", "e-mail
 * precisa ser válido", limites numéricos) continua exclusivamente em
 * `packages/dominio` — por isso nada aqui usa `.min()`, `.max()`, `.email()`
 * ou faixa numérica; quem decide isso é a operação, depois de receber a
 * forma certa.
 *
 * É a ÚNICA fonte dos fragmentos compartilhados entre os arquivos de schema
 * por módulo (`esquemas/tarefas.ts`, `esquemas/automacoes.ts`,
 * `esquemas/financeiro.ts` e os que o Plan 01-13/14/15 acrescentam): um
 * fragmento definido em dois arquivos divergiria na primeira mudança.
 *
 * Regra de importação, sem ciclo: `fragmentos.ts` → `<modulo>.ts` →
 * `esquemas-de-argumentos.ts` → `operacoes.ts`. Nenhum arquivo por módulo
 * importa de outro arquivo por módulo, e este arquivo não importa de nenhum
 * irmão desta pasta.
 */

import type { ActorKind, ConfigurableAspect, DataState, Id, ModeloDeTarefa, Priority, StatusCategory, View } from "@n1/dominio";
import { OPERACOES, type NomeDeOperacao } from "@n1/dominio/operations/registro";
import { z } from "zod";

/** Os argumentos de uma operação DEPOIS de `(state, actingMemberId)` — inferidos da assinatura real em `OPERACOES`. */
export type ArgumentosDe<N extends NomeDeOperacao> =
  (typeof OPERACOES)[N] extends (state: DataState, actingMemberId: Id, ...args: infer A) => unknown ? A : never;

/** Parcial — o tipo de cada arquivo por módulo (nem todo módulo cobre todas as operações ainda). */
export type Esquemas = { readonly [N in NomeDeOperacao]?: z.ZodType<ArgumentosDe<N>> };

/**
 * Completo — o tipo da composição final (Plan 01-16): faltar uma operação
 * registrada em `OPERACOES` não compila, apontando o nome que falta.
 */
export type EsquemasCompletos = { readonly [N in NomeDeOperacao]: z.ZodType<ArgumentosDe<N>> };

/**
 * `true` só se `A` e `B` forem a MESMA união literal (nos dois sentidos) —
 * IN-10: `satisfies Esquemas` só prende a checagem de schema NUM sentido (a
 * saída precisa ser atribuível ao tipo da assinatura); um `z.enum` com um
 * membro A MENOS compila e vira 400 falso para uma chamada legítima do
 * `apps/web`. Para uniões literais (não para objetos — `readonly`/`?:`
 * quebram a simetria, ver `01-REVIEW.md`), a checagem nos dois sentidos
 * funciona e fecha exatamente essa assimetria.
 */
export type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Portão: um `Confere<[Igual<…>, Igual<…>]>` sem nome não compila se alguma posição for `false`. */
export type Confere<T extends readonly true[]> = T;

/**
 * `JSON.stringify([id, undefined])` vira `[id, null]` — é o que
 * `transferWorkspaceOwnership(..., keepRoleId || undefined)` produz em
 * `transfer-ownership-dialog.tsx`. Todo parâmetro posicional opcional no FIM
 * de uma assinatura precisa aceitar `null` pela mesma razão e devolvê-lo como
 * `undefined` — o domínio recebe o que o tipo promete, nunca `null`.
 */
export function opcional<S extends z.ZodTypeAny>(schema: S) {
  return schema.nullish().transform((valor) => valor ?? undefined);
}

// ── Fragmentos compartilhados ──────────────────────────────────────────

export const ID = z.string();
export const PRIORITY = z.enum(["urgente", "alta", "normal", "baixa", "semPrioridade"]);
export const TASK_DATE = z.discriminatedUnion("form", [
  z.object({ form: z.literal("civilDay"), value: z.string() }).strict(),
  z.object({ form: z.literal("instant"), value: z.string() }).strict(),
]);
export const ACTOR_REF = z
  .object({
    kind: z.enum(["member", "agent", "automation", "integration", "system"]),
    id: ID,
  })
  .strict();
export const STATUS_MAPPING = z.object({ fromStatusId: ID, toStatusId: ID }).strict();
export const VALOR_DE_CAMPO = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]);
export const CONTAINER_TYPE = z.enum(["space", "folder", "list"]);
export const STATUS_CATEGORY = z.enum(["naoIniciado", "emAndamento", "concluido", "fechado"]);
/**
 * Os seis aspectos configuráveis de um contêiner (B25). `setContainerBlock` o usa;
 * a conferência abaixo falha a compilação se o domínio ganhar ou perder um.
 */
export const ASPECTO_CONFIGURAVEL = z.enum(["statusSet", "fieldDefinitions", "taskTypes", "features", "defaultViews", "automations"]);
export const MONEY = z.object({ amount: z.number(), currency: z.string() }).strict();
/** C35 — usado por `estrutura.ts` (`createList`), `planejamento.ts` (`instantiateListTemplate`) e `tarefas-conversacionais.ts`. */
export const MODELO_DE_TAREFA = z.enum(["operacional", "conversacional"]);
/**
 * Os tipos de Visualização. Mora aqui (e não em `escala.ts`) porque `saveView`
 * (`escala.ts`) e `setContainerDefaultViews` (`configuracao.ts`) o usam; tirar
 * o conjunto de tipos muda num lugar só, junto da conferência contra `View["kind"]`
 * (a Carga saiu em 10-07).
 */
export const VIEW_KIND = z.enum(["lista", "quadro", "calendario", "linhaDoTempo", "tabela"]);

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [
    Igual<z.infer<typeof PRIORITY>, Priority>,
    Igual<z.infer<typeof STATUS_CATEGORY>, StatusCategory>,
    Igual<z.infer<typeof ACTOR_REF>["kind"], ActorKind>,
    Igual<z.infer<typeof ASPECTO_CONFIGURAVEL>, ConfigurableAspect>,
    Igual<z.infer<typeof CONTAINER_TYPE>, "space" | "folder" | "list">,
    Igual<z.infer<typeof MODELO_DE_TAREFA>, ModeloDeTarefa>,
    Igual<z.infer<typeof VIEW_KIND>, View["kind"]>,
  ]
>;
