/**
 * 12.3.2 — `POST /membros/:id/convite`: reenviar o convite de um Membro
 * pendente. Só Administrador ou Proprietário ativo (a regra é
 * `registrarReenvioDoConvite`, no domínio). O serviço `reenviarConvite` fala
 * com o Supabase Auth; a resposta nunca leva token nem link.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LimiteDeEnvio, type AuthDeConvite } from "../autenticacao/auth-de-convite";
import type { ResolverUsuario } from "../autenticacao/resolver-usuario";
import { reenviarConvite } from "../servicos/reenviar-convite";

export interface OpcoesDeMembros {
  /** Os testes passam um Auth falso; em produção, o Supabase. */
  readonly auth?: AuthDeConvite;
  readonly resolverUsuario?: ResolverUsuario;
}

const PARAMS = z.object({ id: z.string().min(1).max(200) });

export async function rotasDeMembros(app: FastifyInstance, opcoes: OpcoesDeMembros): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post("/membros/:id/convite", { schema: { params: PARAMS } }, async (request, reply) => {
    try {
      const resultado = await reenviarConvite(
        { workspaceId: request.membro.workspaceId, actingMemberId: request.membro.id, memberId: request.params.id },
        opcoes,
      );
      if (!resultado.ok) return reply.code(resultado.status).send({ ok: false, error: resultado.error });
      return reply.code(200).send(resultado);
    } catch (erro) {
      if (erro instanceof LimiteDeEnvio) {
        return reply.code(429).send({ ok: false, error: "O envio de e-mails chegou ao limite por hora. Tente de novo mais tarde." });
      }
      throw erro;
    }
  });
}
