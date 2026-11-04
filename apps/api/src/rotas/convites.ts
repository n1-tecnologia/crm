/**
 * 12.3.3 — `POST /convites/aceitar`: o convidado aceita o convite no primeiro
 * acesso. É a única rota que o hook de autenticação deixa o Membro `pendente`
 * alcançar (`config: { aceitaPendente: true }`); em qualquer outra ele recebe
 * 403 `CONVITE_PENDENTE`.
 *
 * Quem aceita é sempre o Membro da sessão (`request.membro`), nunca um id do
 * corpo: o corpo traz só o nome. A regra (estar pendente, ter Usuário, nome
 * válido) é `aceitarConvite`, no domínio.
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { aceitarConvite } from "@n1/dominio/operations/ciclo-do-membro";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { executar } from "../persistencia/unidade-de-trabalho";

const CORPO = z.object({ nome: z.string().max(200) }).strict();

export async function rotasDeConvites(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/convites/aceitar",
    { config: { aceitaPendente: true }, schema: { body: CORPO } },
    async (request, reply) => {
      const resultado = await executar(request.membro.workspaceId, (state) =>
        aceitarConvite(state, request.membro.id, { nome: request.body.nome }),
      );
      if ("conflito" in resultado) return reply.code(409).send({ ok: false, error: resultado.error });
      if (!resultado.ok) {
        return reply.code(400).send({ ok: false, error: resultado.error, ...(resultado.field ? { campo: resultado.field } : {}) });
      }
      return reply.code(200).send({ ok: true });
    },
  );
}
