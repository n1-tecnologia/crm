/**
 * Rotas da conexão do e-mail (Fase 17, 17-05, EML-01). Todas exigem a sessão (Bearer):
 *
 *   POST /canais/:id/email/conectar   { usuario, senha, predefinicao? | imap + smtp } → o Canal conectado
 *   GET  /canais/:id/email/conta      a conta sem segredo (endereço, tipo de login, servidores, motivo da queda) e quais
 *                                     botões de login (Google, Microsoft) este servidor oferece
 *
 * A senha chega UMA vez, no corpo do `conectar`, e vai à fábrica de conexão e ao cofre: nenhuma resposta a devolve e nenhum
 * log a guarda (o log de requisição do Fastify registra método e URL, não o corpo). `predefinicao` (`gmail` ou `outlook`) é
 * só um nome: o host e a porta vêm do servidor. Os servidores digitados passam pela guarda de rede em toda conexão, que é
 * quem decide as portas permitidas (uma regra num lugar só). Sem SQL e sem regra aqui (`rotas/CONTEXT.md`).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServicoDeConexaoDoEmail } from "../../mensageria/provedores/email/conexao";
import { PARAMS_ID, responder } from "./comum";

const SERVIDOR = z
  .object({
    host: z.string().trim().min(1).max(253),
    porta: z.number().int().min(1).max(65535),
  })
  .strict();

const CONEXAO_POR_SENHA = z
  .object({
    usuario: z.string().trim().min(1).max(320),
    // A senha é guardada como veio: nada de `trim`, uma senha pode começar ou terminar com espaço.
    senha: z.string().min(1).max(1024),
    predefinicao: z.enum(["gmail", "outlook"]).optional(),
    imap: SERVIDOR.optional(),
    smtp: SERVIDOR.optional(),
  })
  .strict()
  .refine(
    (corpo) => (corpo.predefinicao !== undefined ? corpo.imap === undefined && corpo.smtp === undefined : corpo.imap !== undefined && corpo.smtp !== undefined),
    { message: "Escolha Gmail ou Outlook, ou informe o servidor IMAP e o SMTP.", path: ["predefinicao"] },
  );

export async function rotasDoEmail(app: FastifyInstance, opcoes: { readonly servico: ServicoDeConexaoDoEmail }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;

  rotas.post("/canais/:id/email/conectar", { schema: { params: PARAMS_ID, body: CONEXAO_POR_SENHA } }, async (request, reply) =>
    responder(reply, await servico.conectarPorSenha(request.membro, request.params.id, request.body)),
  );

  rotas.get("/canais/:id/email/conta", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.conta(request.membro, request.params.id)),
  );
}
