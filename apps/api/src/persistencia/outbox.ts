/**
 * O catálogo dos eventos de saída da Fase 2 e a gravação transacional deles
 * em `plataforma.integration_outbox` (`003-integracao-e-importacao.sql`).
 *
 * D-18 — o evento nasce no MESMO `pg.Client` da transação que grava o fato de
 * negócio (a Tarefa), ANTES do `commit`: `gravarEventos` só é chamada de
 * dentro de `unidade-de-trabalho.ts::executar()`, nunca em separado. Isso é o
 * que torna "a Tarefa existe se e somente se o evento existe" verdade sem
 * precisar de coordenação entre duas transações.
 *
 * O evento é sempre produzido EXPLICITAMENTE por quem chama `executar()` (a
 * rota, via `opcoes.eventos`) a partir do resultado da operação — nunca
 * deduzido do `diferenca` que `gravar()` calcula. Um diff não distingue
 * importação, replay e criação operacional: a importação histórica (Plan
 * 02-22, 1.110 Tarefas) grava Tarefa sem outbox simplesmente por não passar
 * `opcoes.eventos`, e não porque algum filtro descarte o evento depois de
 * gerado (T-02-16, RESEARCH.md "Anti-Patterns").
 *
 * `EVENTOS` fecha o payload de cada tipo com `.strict()` de propósito: um
 * campo a mais no objeto passado para `gravarEventos` lança em vez de ser
 * silenciosamente descartado. O payload é deliberadamente pobre — só ids e
 * metadados que identificam o agregado, nunca valor monetário, documento,
 * chave Pix ou URL assinada. Quem recebe o evento (`automation/`) busca o
 * resto chamando `getTask`/`getCommentReplies` de volta com a credencial de
 * serviço (contrato v1, §8): mandar o dado financeiro pelo canal do evento
 * seria vazar por um caminho sem as garantias (schema, auditoria, escopo) do
 * contrato v1.
 */

import type { PoolClient } from "pg";
import { z } from "zod";

export const EVENTOS = {
  "solicitacao.criada.v1": z
    .object({
      taskId: z.string(),
      readableId: z.string(),
      listId: z.string(),
      origin: z.literal("plataforma"),
    })
    .strict(),
  "solicitacao.comentario-criado.v1": z
    .object({
      taskId: z.string(),
      commentId: z.string(),
      parentCommentId: z.string().optional(),
      authorMemberId: z.string(),
    })
    .strict(),
  "solicitacao.aprovacao-decidida.v1": z
    .object({
      taskId: z.string(),
      approvalId: z.string(),
      decision: z.enum(["aprovada", "rejeitada"]),
      source: z.enum(["click", "comment"]),
      decidedByMemberId: z.string(),
    })
    .strict(),
} as const;

export type NomeDeEvento = keyof typeof EVENTOS;

/** União discriminada por `type`: o payload de cada evento é o schema correspondente em `EVENTOS`. */
export type EventoDeSaida = {
  readonly [N in NomeDeEvento]: {
    readonly type: N;
    /** `aggregate_type`/`aggregate_id` — o que o índice único parcial da migração 003 usa para "um evento por agregado". */
    readonly aggregateType: string;
    readonly aggregateId: string;
    readonly payload: z.infer<(typeof EVENTOS)[N]>;
  };
}[NomeDeEvento];

/**
 * Grava cada evento em `plataforma.integration_outbox` usando o `cliente` da
 * transação corrente — nunca abre conexão própria. Valida o payload contra o
 * schema do catálogo ANTES do insert: um payload inválido lança, e a
 * exceção sobe para `executar()`, que faz `rollback` da transação inteira
 * (nem Tarefa nem evento ficam visíveis).
 *
 * Nunca chama `fetch` nem qualquer I/O de rede — a entrega é responsabilidade
 * exclusiva de `outbox-worker.ts`, fora deste bloco transacional. Uma chamada
 * HTTP aqui prenderia a conexão do Postgres pela duração da rede e acoplaria
 * a durabilidade do fato de negócio à disponibilidade do `automation/`
 * (D-19).
 */
export async function gravarEventos(
  cliente: PoolClient,
  workspaceId: string,
  eventos: readonly EventoDeSaida[],
): Promise<void> {
  for (const evento of eventos) {
    const schema = EVENTOS[evento.type];
    // `.parse` (não `.safeParse`): payload fora do contrato é bug de quem
    // chamou `executar()`, não uma resposta esperada — deve derrubar a
    // transação, não ser engolido.
    const payload = schema.parse(evento.payload);
    await cliente.query(
      `insert into plataforma.integration_outbox
         (workspace_id, aggregate_type, aggregate_id, event_type, payload)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [workspaceId, evento.aggregateType, evento.aggregateId, evento.type, JSON.stringify(payload)],
    );
  }
}
