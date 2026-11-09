/** Esqueleto (16-07, RED): `GET /eventos` ainda responde 503. */

import type { FastifyInstance } from "fastify";
import type { HubDeEventos } from "../mensageria/hub-de-eventos";

export interface OpcoesDeEventos {
  readonly hub?: HubDeEventos;
  readonly batidaMs?: number;
  readonly duracaoMaximaMs?: number;
}

export async function rotasDeEventos(app: FastifyInstance, _opcoes: OpcoesDeEventos): Promise<void> {
  app.get("/eventos", async (_request, reply) =>
    reply.status(503).send({ ok: false, error: "O tempo real está indisponível agora.", codigo: "TEMPO_REAL_INDISPONIVEL" }),
  );
}
