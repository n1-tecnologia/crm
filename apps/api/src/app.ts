/**
 * Monta o Fastify inteiro — CORS, validação/serialização por zod, rota de
 * saúde, tratamento de erro — mas NUNCA escuta uma porta.
 *
 * É essa separação que permite `app.inject()` nos testes: monta o app,
 * injeta uma requisição fake, sem abrir socket nem depender de banco ou de
 * `SUPABASE_*` (D-DEC-09). Quem de fato escuta é `index.ts`, que chama
 * `listen()` em cima do que `buildApp()` devolve.
 */

import cors from "@fastify/cors";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from "@fastify/type-provider-zod";
import Fastify, { type FastifyInstance } from "fastify";
import { verificarTokenDoSupabase, type VerificarToken } from "./autenticacao/verificar-token";
import { carregarEnv } from "./persistencia/conexao";
import { membroPorUsuario } from "./persistencia/membros";
import { registrarAutenticacao, type OpcoesDeAutenticacao } from "./plugins/autenticacao";
import { rotasDeEstado } from "./rotas/estado";
import { rotasDeOperacoes } from "./rotas/operacoes";

export interface OpcoesDoApp {
  /** Padrão: `process.env.WORKSPACE_ID ?? "ws_n1"`. */
  readonly workspaceId?: string;
  /** Origem permitida pelo CORS. Padrão: `process.env.WEB_ORIGIN ?? "http://localhost:3001"`. */
  readonly webOrigin?: string;
  /** Padrão: `verificarTokenDoSupabase`. Testes injetam um stub, sem rede. */
  readonly verificarToken?: VerificarToken;
  /** Padrão: `membroPorUsuario`. Testes injetam um stub, sem banco. */
  readonly resolverMembro?: OpcoesDeAutenticacao["resolverMembro"];
  /** Padrão: `false` em teste, `true` no boot (`index.ts`). */
  readonly logger?: boolean;
}

export function buildApp(opcoes: OpcoesDoApp = {}): FastifyInstance {
  // Os padrões de porta/origem/workspace vêm de `apps/api/.env` quando não
  // passados por opção — os testes passam tudo explícito e nunca dependem
  // deste arquivo existir.
  carregarEnv();

  const workspaceId = opcoes.workspaceId ?? process.env.WORKSPACE_ID ?? "ws_n1";
  const webOrigin = opcoes.webOrigin ?? process.env.WEB_ORIGIN ?? "http://localhost:3001";

  const app = Fastify({ logger: opcoes.logger ?? false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Allowlist explícita: nunca `*`. O `Authorization: Bearer` viaja com a
  // origem do navegador, então um CORS aberto deixaria qualquer site chamar
  // `apps/api` usando a sessão de quem estiver com outra aba logada (T-1-03).
  app.register(cors, {
    origin: [webOrigin],
    credentials: false,
    methods: ["GET", "POST"],
    allowedHeaders: ["authorization", "content-type"],
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ ok: false, error: "Rota não encontrada." });
  });

  app.setErrorHandler((erro, request, reply) => {
    // Entrada mal formada: o corpo carrega a mensagem do schema, sem stack.
    if (hasZodFastifySchemaValidationErrors(erro)) {
      const primeira = erro.validation[0]?.message ?? "entrada inválida";
      reply.status(400).send({ ok: false, error: `Entrada inválida: ${primeira}` });
      return;
    }
    // Qualquer outro erro é inesperado: vai ao log do processo, nunca ao
    // corpo da resposta — o cliente não tem por que ver mensagem nem stack
    // de um bug interno (T-1-06).
    request.log.error(erro);
    reply.status(500).send({ ok: false, error: "Erro interno." });
  });

  // Registrado antes de qualquer rota protegida: toda rota que nascer depois
  // daqui exige token, a menos que se marque `config: { publica: true }`.
  registrarAutenticacao(app, {
    workspaceId,
    verificarToken: opcoes.verificarToken ?? verificarTokenDoSupabase,
    resolverMembro: opcoes.resolverMembro ?? membroPorUsuario,
  });

  app.get("/saude", { config: { publica: true } }, async () => ({
    ok: true,
    servico: "apps/api",
  }));

  // Depois do hook de autenticação: toda rota registrada aqui exige
  // `Authorization: Bearer`, salvo `config: { publica: true }`. `buildApp`
  // continua síncrono — `app.register` sem `await` enfileira o plugin, e o
  // Fastify resolve a fila sozinho no primeiro `ready()`/`listen()`/`inject()`
  // (é o mesmo motivo por que `app.register(cors, ...)` acima também não é
  // aguardado).
  app.register(rotasDeOperacoes);
  app.register(rotasDeEstado);

  return app;
}
