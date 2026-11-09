/**
 * Esqueleto do RED (16-03, Task 1): a rota existe e é pública, mas ainda não verifica nem grava.
 */

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { ChavesDoCofre } from "../servicos/cofre";
import type { RegistroDeProvedores } from "../mensageria/registro";

export interface OpcoesDeWebhooksDeMensageria {
  readonly pool?: () => Pool;
  readonly chaves?: ChavesDoCofre;
  readonly registro?: RegistroDeProvedores;
  readonly acordarProcessador?: () => void;
  readonly limitePorIp?: { readonly janelaMs: number; readonly maximo: number };
}

export async function rotasDeWebhooksDeMensageria(app: FastifyInstance, _opcoes: OpcoesDeWebhooksDeMensageria = {}): Promise<void> {
  app.post("/webhooks/mensageria/:canalId", { config: { publica: true } }, async (_request, reply) => {
    return reply.code(501).send({ ok: false, error: "Não implementado." });
  });
}
