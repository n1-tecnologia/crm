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
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { verificarTokenDoSupabase, type VerificarToken } from "./autenticacao/verificar-token";
import { carregarEnv } from "./persistencia/conexao";
import { membroPorUsuario } from "./persistencia/membros";
import { registrarAutenticacao, type OpcoesDeAutenticacao } from "./plugins/autenticacao";
import {
  PREFIXO_ROTAS_DE_SERVICO,
  registrarAutenticacaoDeServico,
  type OpcoesDeAutenticacaoDeServico,
} from "./plugins/autenticacao-servico";
import { rotasDeEstado } from "./rotas/estado";
import { rotasDeIntegracaoDeSolicitacoes } from "./rotas/integracao-solicitacoes";
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
  /** Padrão: `resolverCredencial` de `persistencia/credenciais-de-servico.ts`. Testes injetam um stub, sem banco. */
  readonly resolverCredencial?: OpcoesDeAutenticacaoDeServico["resolverCredencial"];
  /** Padrão: `false` em teste, `true` no boot (`index.ts`). */
  readonly logger?: boolean;
  /**
   * SÓ PARA TESTE. As sete rotas reais de `/v1/integrations/payment-requests/*`
   * (Plan 02-13, `rotasDeIntegracaoDeSolicitacoes`) já nascem direto aqui
   * dentro, em `app.ts` — este gancho continua existindo só para
   * `autenticacao-servico.test.ts` registrar rotas de prova adicionais
   * DENTRO do mesmo plugin encapsulado do prefixo, o único jeito de uma rota
   * herdar `registrarAutenticacaoDeServico` (uma rota adicionada em `app`
   * depois de `buildApp()` devolver seria irmã desse plugin, não filha — não
   * herdaria o hook).
   */
  readonly rotasDeIntegracaoParaTeste?: (integracao: FastifyInstance) => void;
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

  // Allowlist explícita: nunca `*`. O `Authorization: Bearer` viaja com a
  // origem do navegador, então um CORS aberto deixaria qualquer site chamar
  // `apps/api` usando a sessão de quem estiver com outra aba logada
  // (T-1-03). `delegator` decide por requisição — `/v1/integrations/*`
  // nunca recebe cabeçalho `Access-Control-*` (`origin: false`): o
  // `automation/` é servidor-a-servidor e nenhuma origem de navegador deve
  // alcançá-lo (D-15). Registrado direto na raiz, na mesma posição de
  // antes deste plano: mover `cors` para dentro de um filho encapsulado
  // quebra o preflight de rotas registradas de forma síncrona nesse
  // mesmo filho (como `/saude`) — o `onRoute` que `@fastify/cors` usa
  // para gerar a rota `OPTIONS` automática só é instalado quando o avvio
  // carrega o plugin `cors`, o que acontece DEPOIS de qualquer `.get()`
  // síncrono chamado logo em seguida no mesmo corpo de função.
  //
  // O `delegator` PRECISA vir dentro de um objeto (`{ delegator: fn }`),
  // nunca como o segundo argumento direto de `register()`: o `avvio` (por
  // baixo do `register()` do Fastify) trata qualquer FUNÇÃO passada ali
  // como fábrica de opções — chamada uma única vez no boot, recebendo a
  // instância do Fastify, não a requisição — antes mesmo dessa função
  // chegar ao `@fastify/cors`. Passar a função direto faz `request` virar
  // a instância do servidor, não a requisição, e o hook nunca dispara de
  // verdade por requisição.
  const opcoesDeCors = {
    credentials: false,
    methods: ["GET", "POST"],
    allowedHeaders: ["authorization", "content-type"],
  };
  app.register(cors, {
    delegator: (
      request: FastifyRequest,
      callback: (erro: Error | null, opcoes?: Record<string, unknown>) => void,
    ) => {
      const ehRotaDeServico =
        request.url === PREFIXO_ROTAS_DE_SERVICO || request.url.startsWith(`${PREFIXO_ROTAS_DE_SERVICO}/`);
      callback(null, { ...opcoesDeCors, origin: ehRotaDeServico ? false : [webOrigin] });
    },
  });

  // Registrado direto na raiz: toda rota que nascer depois daqui — em
  // QUALQUER filho, inclusive o de `/v1/integrations` abaixo — exige
  // token, a menos que se marque `config: { publica: true }` ou viva sob
  // `PREFIXO_ROTAS_DE_SERVICO` (o próprio hook trata essa exceção — ver
  // `plugins/autenticacao.ts`).
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
  // Fastify resolve a fila sozinho no primeiro `ready()`/`listen()`/`inject()`.
  app.register(rotasDeOperacoes);
  app.register(rotasDeEstado);

  // Rotas serviço-a-serviço: credencial própria
  // (`plugins/autenticacao-servico.ts`), nunca JWT humano. Rotas
  // `/v1/integrations/*` nascem DENTRO deste mesmo plugin em planos
  // futuros (D-22, OQ-SYN-01) — precisam ser filhas desta instância
  // `integracao`, não registradas soltas na raiz, para herdar o hook de
  // serviço (um hook de filho encapsulado só roda para rotas que são
  // filhas do MESMO plugin — diferente do hook humano acima, que está na
  // raiz e por isso cascateia para todo mundo).
  app.register(
    async (integracao) => {
      registrarAutenticacaoDeServico(integracao, {
        resolverCredencial: opcoes.resolverCredencial,
      });
      // As sete rotas `/v1/integrations/payment-requests/*` (Plan 02-13) —
      // registradas AQUI DENTRO, filhas da mesma instância `integracao`, para
      // herdar o hook de serviço acima (ver o comentário deste bloco).
      await rotasDeIntegracaoDeSolicitacoes(integracao);
      opcoes.rotasDeIntegracaoParaTeste?.(integracao);
    },
    { prefix: PREFIXO_ROTAS_DE_SERVICO },
  );

  return app;
}
