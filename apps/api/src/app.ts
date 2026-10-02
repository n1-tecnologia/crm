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
import { rotasDeClassificacoes, type OpcoesDeClassificacoes } from "./rotas/classificacoes";
import { rotasDeEstado } from "./rotas/estado";
import { rotasDeAnexosDaTarefa } from "./rotas/anexos-da-tarefa";
import { rotasDeFinanceiro, type OpcoesDeFinanceiro } from "./rotas/financeiro";
import { rotasDeFormulariosPublicos, type OpcoesDeFormulariosPublicos } from "./rotas/formularios-publicos";
import { rotasDeIntegracaoDeSolicitacoes } from "./rotas/integracao-solicitacoes";
import { rotasDeOperacoes } from "./rotas/operacoes";

export interface OpcoesDoApp {
  /** Padrão: `process.env.WORKSPACE_ID ?? "ws_n1"`. */
  readonly workspaceId?: string;
  /**
   * Origens permitidas pelo CORS, separadas por vírgula (a Vercel tem a URL
   * de produção e a do domínio próprio). Padrão: `process.env.WEB_ORIGIN ?? "http://localhost:3001"`.
   */
  readonly webOrigin?: string;
  /**
   * Quem pode dizer o IP de quem chamou pelo `X-Forwarded-For` — o
   * `trustProxy` do Fastify, em endereços ou faixas separados por vírgula
   * (`loopback` vale). Padrão: `process.env.TRUST_PROXY`; vazio, ninguém. Na
   * VPS é `loopback`: sem ele, atrás do nginx todo `request.ip` vira
   * 127.0.0.1 e o limite de taxa por IP do Formulário público vira um balde
   * só para a internet inteira.
   */
  readonly trustProxy?: string;
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
  /**
   * Plan 02-16 — as três rotas públicas do Formulário (`./rotas/formularios-publicos.ts`)
   * aceitam a mesma injeção de dependência dos outros pontos deste arquivo:
   * testes trocam `lerEstado` por um stub sem banco e os limites de taxa por
   * janelas curtas, sem precisar de `DATABASE_URL` (D-DEC-09).
   */
  readonly formulariosPublicos?: Omit<OpcoesDeFormulariosPublicos, "workspaceId">;
  /**
   * Plan 02-24 — `POST /v1/integrations/payment-approvals/classifications`
   * (`./rotas/classificacoes.ts`) aceita o mesmo padrão de injeção: testes
   * trocam o `Relogio` por `relogioFixo`, sem esperar tempo real para provar
   * a janela de 90 dias do fallback de comentário (D-10, V02-08B).
   */
  readonly classificacoes?: OpcoesDeClassificacoes;
  /** Fase 4 (04-05) — troca o cliente de leituras do Financeiro por um falso, sem rede. */
  readonly financeiro?: OpcoesDeFinanceiro;
}

export function buildApp(opcoes: OpcoesDoApp = {}): FastifyInstance {
  // Os padrões de porta/origem/workspace vêm de `apps/api/.env` quando não
  // passados por opção — os testes passam tudo explícito e nunca dependem
  // deste arquivo existir.
  carregarEnv();

  const workspaceId = opcoes.workspaceId ?? process.env.WORKSPACE_ID ?? "ws_n1";
  const webOrigins = (opcoes.webOrigin ?? process.env.WEB_ORIGIN ?? "http://localhost:3001")
    .split(",")
    .map((origem) => origem.trim())
    .filter(Boolean);
  const trustProxy = opcoes.trustProxy ?? process.env.TRUST_PROXY ?? "";

  const app = Fastify({ logger: opcoes.logger ?? false, ...(trustProxy ? { trustProxy } : {}) });
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
    // Erro do próprio Fastify com um status 4xx já definido (413 de
    // `bodyLimit`, 415 de content-type sem `addContentTypeParser` — Fase 4,
    // T-4-05) — a mensagem já é segura (do framework, sem stack nem detalhe
    // interno) e o código já é exatamente o que a rota espera; repassar em
    // vez de mascarar como 500 genérico, que esconderia a recusa por trás de
    // "Erro interno." e quebraria a mitigação que o `bodyLimit`/parser
    // restrito documentam.
    if (erro instanceof Error && "statusCode" in erro && typeof erro.statusCode === "number" && erro.statusCode >= 400 && erro.statusCode < 500) {
      reply.status(erro.statusCode).send({ ok: false, error: erro.message });
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
  // Fase 4: as leituras usam só GET, já coberto; por isso as escritas de 04-10 nascem como POST, não PATCH/DELETE.
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
      callback(null, { ...opcoesDeCors, origin: ehRotaDeServico ? false : webOrigins });
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
  // Checklist 7.3 — o anexo de verdade da Tarefa: ticket, envio direto ao bucket, confirmação.
  app.register(rotasDeAnexosDaTarefa);
  // Fase 4 (04-05) — na RAIZ herda o JWT de Membro; dentro do bloco de rotas
  // serviço-a-serviço abaixo exigiria credencial de serviço, invertendo quem chama quem (Pitfall 4).
  app.register(rotasDeFinanceiro, opcoes.financeiro ?? {});
  // D-02 — as únicas rotas SEM `Authorization: Bearer` desta instância: cada
  // uma se isenta explicitamente com `config: { publica: true }`, o mesmo
  // gancho de `/saude` acima (`plugins/autenticacao.ts`). CORS continua pela
  // allowlist (`webOrigin`): estas rotas não vivem sob `PREFIXO_ROTAS_DE_SERVICO`,
  // então o `delegator` de CORS acima aplica a mesma origem do resto do app.
  app.register(rotasDeFormulariosPublicos, { workspaceId, ...opcoes.formulariosPublicos });

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
      // Plan 02-24 — o callback do classificador de comentário, mesma
      // instância `integracao`, mesmo motivo do comentário acima: herdar
      // `registrarAutenticacaoDeServico`.
      rotasDeClassificacoes(integracao, opcoes.classificacoes);
      opcoes.rotasDeIntegracaoParaTeste?.(integracao);
    },
    { prefix: PREFIXO_ROTAS_DE_SERVICO },
  );

  return app;
}
