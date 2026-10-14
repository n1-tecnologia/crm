/**
 * PARA-05 — a leitura pública de uma Tarefa por link (`/p/<segredo>`):
 * `GET /v1/public/tasks/:secret`, sem `Authorization` (`config: { publica: true }`,
 * o mesmo gancho de `/saude` e do Formulário público). Devolve a projeção de
 * `@n1/dominio/tarefa-publica` — nomes e valores, nunca ids nem o segredo — e
 * responde 404 uniforme para segredo inexistente, revogado ou Tarefa fora do
 * ativo (não enumerar). Limite de taxa por IP, como o Formulário.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { DataState } from "@n1/dominio/state";
import { projecaoPublicaDaTarefa } from "@n1/dominio/tarefa-publica";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { criarLimiteDeTaxa, type LimiteDeTaxa } from "../servicos/limite-de-taxa";

const ROTA = "GET /v1/public/tasks/:secret";
const COPY_INDISPONIVEL = "Este link foi revogado ou não existe. Peça um novo a quem o enviou.";

/** O segredo de `shareTaskPublicly` tem 24 hex; o mínimo de 8 deixa o `demo-tarefa` do seed de demonstração passar. */
const PARAMS = z.object({ secret: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/) }).strict();

export interface OpcoesDeTarefasPublicas {
  readonly workspaceId: string;
  /** Padrão: hidrata contra `pool()`. Testes injetam um estado (sem `DATABASE_URL`). */
  readonly lerEstado?: (workspaceId: string) => Promise<DataState>;
  /** Padrão: 60 por IP a cada minuto. */
  readonly limitePorIp?: LimiteDeTaxa;
}

async function lerEstadoReal(workspaceId: string): Promise<DataState> {
  const cliente = await pool().connect();
  try {
    return (await hidratar(cliente, workspaceId)).state;
  } finally {
    cliente.release();
  }
}

function indisponivel(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  request.log.info({ rota: ROTA, status: 404 });
  return reply.code(404).send({ ok: false, error: COPY_INDISPONIVEL });
}

export async function rotasDeTarefasPublicas(app: FastifyInstance, opcoes: OpcoesDeTarefasPublicas): Promise<void> {
  const lerEstado = opcoes.lerEstado ?? lerEstadoReal;
  const limitePorIp = opcoes.limitePorIp ?? criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 60 });

  app.get("/v1/public/tasks/:secret", { config: { publica: true } }, async (request, reply) => {
    const limite = limitePorIp.consumir(request.ip);
    if (!limite.permitido) {
      request.log.info({ rota: ROTA, status: 429 });
      return reply
        .code(429)
        .header("Retry-After", String(Math.max(Math.ceil(limite.restanteMs / 1000), 1)))
        .send({ ok: false, error: "Muitas tentativas. Aguarde um instante e tente novamente." });
    }
    const params = PARAMS.safeParse(request.params);
    if (!params.success) return indisponivel(request, reply);

    const state = await lerEstado(opcoes.workspaceId);
    const tarefa = projecaoPublicaDaTarefa(state, params.data.secret);
    if (!tarefa) return indisponivel(request, reply);
    request.log.info({ rota: ROTA, status: 200 });
    return reply.code(200).send(tarefa);
  });
}
