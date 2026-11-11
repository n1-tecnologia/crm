/**
 * Rotas da conexão do Instagram (Sessão 8, 8.2.2). Todas exigem a sessão (Bearer):
 *
 *   POST /canais/:id/instagram/autorizar   a URL da janela de login do Instagram ({ url })
 *   POST /canais/instagram/concluir        { codigo, state } que a página de retorno da web leu → o Canal conectado
 *   GET  /canais/:id/instagram/conta       o @, o nome e a foto da conta ligada, lidos da Meta
 *
 * O retorno da Meta vai para a WEB (`INSTAGRAM_REDIRECT_URI`), não para cá: a página
 * de retorno está logada e chama `concluir` com o token da sessão, o que amarra o
 * `state` a quem começou. Sem SQL e sem regra aqui (`rotas/CONTEXT.md`).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServicoDeConexaoDoInstagram } from "../../mensageria/provedores/instagram/conexao";
import { PARAMS_ID, responder } from "./comum";

const CONCLUSAO = z
  .object({
    codigo: z.string().trim().min(1).max(2048),
    state: z.string().trim().min(1).max(2048),
  })
  .strict();

export async function rotasDoInstagram(app: FastifyInstance, opcoes: { readonly servico: ServicoDeConexaoDoInstagram }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.post("/canais/:id/instagram/autorizar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.iniciar(request.membro, request.params.id)),
  );

  rotas.post("/canais/instagram/concluir", { schema: { body: CONCLUSAO } }, async (request, reply) =>
    responder(reply, await servico.concluir(request.membro, request.body)),
  );

  rotas.get("/canais/:id/instagram/conta", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.conta(request.membro, request.params.id)),
  );
}
