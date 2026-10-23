/**
 * As sete leituras do Financeiro (Fase 4, TELA-01): `GET /financeiro/dashboard`,
 * `/problemas`, `/aprovacoes-pendentes`, `/workflows`, `/notas-fiscais`,
 * `/produtos` e `/plano-contas`.
 *
 * Por que este módulo nasce filho da RAIZ de `app.ts`, ao lado de
 * `rotasDeEstado`, e não do plugin de rotas de serviço: `app.ts` hospeda duas
 * famílias de rota que convivem lado a lado — uma para o sentido
 * `automation/` → `apps/api` (credencial de serviço, hoje só
 * `integracao-solicitacoes.ts`) e outra para o sentido Membro → `apps/api`
 * (JWT do Supabase, herdado do hook que roda na raiz). Estas sete rotas são a
 * segunda família: um Membro humano com sessão ativa está pedindo dado, nunca
 * um serviço apresentando credencial própria. Registrar este módulo dentro do
 * plugin de serviço inverteria quem chama quem e exigiria uma credencial que
 * o navegador nunca tem — o erro mais fácil desta fase, nomeado no RESEARCH
 * como Pitfall 4.
 *
 * A autorização é por alcance derivado, não por Concessão nova (D4-14): quem
 * alcança a Pasta "Financeiro" — hoje só quem tem Concessão na Gestão, o
 * Espaço privado que a contém — vê `/financeiro`; quem não alcança recebe
 * 403. `memberReachesContainer` já existe no domínio e já foi provado por
 * PAG-06/03-05 como o caminho certo para visibilidade derivada; nenhuma
 * tabela de permissão nova nasce aqui.
 *
 * O `apps/api` não fala com o schema `public` do `financeiro-tria` em nenhum
 * momento (D4-04) — são dois projetos Supabase distintos. Toda leitura do
 * legado entra por HTTP, pelo cliente de 04-02
 * (`../automacoes/cliente-leituras-financeiro.ts`), que já resolve timeout,
 * classificação de erro e saneamento de log; este módulo só decide alcance,
 * valida o filtro e traduz a resposta do cliente em status HTTP.
 *
 * Nenhuma rota aqui grava em `plataforma.registros`: hidratam só para decidir
 * alcance e liberam a conexão no `finally`, como `rotas/estado.ts` faz.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { DataState } from "@n1/dominio";
import { memberReachesContainer } from "@n1/dominio/derive";
import { CP } from "@n1/dominio/operations";
import { pool } from "../persistencia/conexao";
import { recusarSuspensoNaEscrita } from "../plugins/autenticacao";
import { hidratar } from "../persistencia/repositorio";
import {
  criarClienteDeLeituras,
  type ClienteDeLeituras,
  type OpcoesDoClienteDeLeituras,
  type RespostaDeLeitura,
} from "../automacoes/cliente-leituras-financeiro";

/**
 * A mesma allowlist fixa de seis empresas que `plano-contas-routes.ts` (no
 * `financeiro-tria`) já usa. Exportada para a tela e o teste não a
 * redigitarem — um valor livre nunca chega ao `automation/` (T-4-08).
 */
export const EMPRESAS_PERMITIDAS = [
  "tria",
  "finq",
  "pf",
  "exo_loteamentos",
  "exo_participacoes",
  "oliveira_participacoes",
] as const;

const EMPRESA = z.enum(EMPRESAS_PERMITIDAS);
const TIPO = z.enum(["pagar", "receber"]);

const QUERY_COM_EMPRESA = z.object({ empresa: EMPRESA.optional() }).strict();
const QUERY_SEM_FILTRO = z.object({}).strict();
const QUERY_PLANO_CONTAS = z.object({ empresa: EMPRESA.optional(), tipo: TIPO.optional() }).strict();

export interface OpcoesDeFinanceiro {
  /** O cliente das LEITURAS (GET). O teste injeta um falso; sem opção, o módulo constrói o real. */
  readonly cliente?: ClienteDeLeituras;
  /** O cliente das ESCRITAS (POST em `/v1/leituras/*`). Idem. */
  readonly clienteDeEscrita?: ClienteDeLeituras;
  /**
   * Padrão: hidrata do Postgres real para decidir alcance (D4-14).
   * Injetável só para o teste — o mesmo molde de `invocar-agente.ts` —, para
   * provar sem `DATABASE_URL` que cada rota usa o cliente certo.
   */
  readonly hidratarEstado?: (workspaceId: string) => Promise<DataState>;
}

/**
 * Os dois clientes que o módulo constrói do ambiente, puros para o teste
 * (plano pós-auditoria, lado CRM N1 da 4.3e). A mesma origem
 * (`FINANCEIRO_LEITURAS_URL`), credenciais diferentes: as LEITURAS usam
 * `PLATAFORMA_LEITURA_TOKEN`; as ESCRITAS — alíquota, Plano de contas,
 * gatilhos de NF, repetir passo e cancelar execução — usam
 * `PLATAFORMA_LANCAMENTO_TOKEN`, que o `automation/` passa a exigir em todo
 * `POST` de `/v1/leituras`. D4-02 separou as duas para que um vazamento do
 * token de leitura não gaste dinheiro; mandar escrita com ele desfazia isso.
 * Token ausente é `CREDENCIAL_AUSENTE` no próprio cliente — nenhuma
 * requisição sai.
 */
export function opcoesDosClientesDoFinanceiro(env: NodeJS.ProcessEnv): {
  readonly leitura: OpcoesDoClienteDeLeituras;
  readonly escrita: OpcoesDoClienteDeLeituras;
} {
  const destinoUrl = env.FINANCEIRO_LEITURAS_URL ?? "";
  return {
    leitura: { destinoUrl, token: env.PLATAFORMA_LEITURA_TOKEN ?? "" },
    escrita: { destinoUrl, token: env.PLATAFORMA_LANCAMENTO_TOKEN ?? "" },
  };
}

/** Remove as chaves com valor `undefined` — um filtro ausente nunca vira `"undefined"` na querystring do `automation/`. */
function queryLimpa(dados: Record<string, string | undefined>): Record<string, string> {
  const limpo: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(dados)) {
    if (valor !== undefined) limpo[chave] = valor;
  }
  return limpo;
}

export async function rotasDeFinanceiro(app: FastifyInstance, opcoes: OpcoesDeFinanceiro = {}): Promise<void> {
  // 1.2 — o Membro suspenso consulta o Financeiro, mas nenhuma escrita passa.
  app.addHook("preValidation", recusarSuspensoNaEscrita);
  // Único ponto do módulo que lê variável de ambiente.
  const doAmbiente = opcoesDosClientesDoFinanceiro(process.env);
  const cliente = opcoes.cliente ?? criarClienteDeLeituras(doAmbiente.leitura);
  const clienteDeEscrita = opcoes.clienteDeEscrita ?? criarClienteDeLeituras(doAmbiente.escrita);
  const hidratarEstado =
    opcoes.hidratarEstado ??
    (async (workspaceId: string) => {
      const conexao = await pool().connect();
      try {
        return (await hidratar(conexao, workspaceId)).state;
      } finally {
        conexao.release();
      }
    });

  /**
   * Hidrata o Espaço só para decidir alcance à Pasta "Financeiro" (D4-14) e
   * libera a conexão sempre, antes ou depois da decisão. Sem alcance, 403 com
   * a mesma frase para todo mundo — não entregar o mapa da permissão a quem
   * não a tem.
   */
  async function comAlcance(request: FastifyRequest, reply: FastifyReply, seguir: () => Promise<unknown>): Promise<unknown> {
    // A conexão é devolvida logo depois de hidratar — antes da chamada ao
    // `automation/`, que pode levar segundos e não precisa do banco.
    const state = await hidratarEstado(request.membro.workspaceId);
    if (!memberReachesContainer(state, request.membro.id, "folder", CP.folderId)) {
      reply.code(403);
      return { error: "Sem acesso ao Financeiro." };
    }
    return seguir();
  }

  /**
   * Traduz a falha do cliente de leituras em status do `apps/api`. As duas
   * frases abaixo são as que a tela renderiza no estado de falha (D4-15) —
   * fixas, em pt-BR, sem detalhe de origem. `code`/`summary` vão só para o
   * log (T-4-11): nunca para o corpo da resposta.
   */
  function responder(
    request: FastifyRequest,
    reply: FastifyReply,
    resultado: RespostaDeLeitura<unknown>,
    sentido: "leitura" | "escrita" = "leitura",
  ): unknown {
    if (resultado.ok) return resultado.corpo;
    request.log.warn({ code: resultado.code, summary: resultado.summary }, `financeiro: ${sentido} ao automation/ falhou`);
    if (resultado.code === "CREDENCIAL_AUSENTE") {
      reply.code(503);
      return { error: `A ${sentido} do Financeiro não está configurada.` };
    }
    reply.code(502);
    return { error: "O backend financeiro não respondeu." };
  }

  /**
   * O corpo comum às sete rotas: valida a query ANTES de tocar a rede (400
   * sem custo de conexão nenhuma), decide alcance, chama o `automation/` pelo
   * caminho correspondente e traduz a resposta. Nada aqui projeta DTO — a
   * projeção é do lado que lê o `public` (D4-05); o `apps/api` repassa o
   * corpo já projetado sem reabri-lo.
   */
  async function lidarComLeitura(
    request: FastifyRequest,
    reply: FastifyReply,
    esquemaDeQuery: z.ZodType<Record<string, string | undefined>>,
    caminhoDoAutomation: string,
  ): Promise<unknown> {
    const query = esquemaDeQuery.safeParse(request.query);
    if (!query.success) {
      reply.code(400);
      return { error: "Filtro inválido." };
    }
    return comAlcance(request, reply, async () => {
      const resultado = await cliente.ler<unknown>(caminhoDoAutomation, { query: queryLimpa(query.data) });
      return responder(request, reply, resultado);
    });
  }

  app.get("/financeiro/dashboard", (request, reply) => lidarComLeitura(request, reply, QUERY_COM_EMPRESA, "/v1/leituras/dashboard"));
  app.get("/financeiro/problemas", (request, reply) => lidarComLeitura(request, reply, QUERY_COM_EMPRESA, "/v1/leituras/problemas"));
  app.get("/financeiro/aprovacoes-pendentes", (request, reply) =>
    lidarComLeitura(request, reply, QUERY_COM_EMPRESA, "/v1/leituras/aprovacoes-pendentes"),
  );
  app.get("/financeiro/workflows", (request, reply) => lidarComLeitura(request, reply, QUERY_SEM_FILTRO, "/v1/leituras/workflows"));
  app.get("/financeiro/notas-fiscais", (request, reply) => lidarComLeitura(request, reply, QUERY_SEM_FILTRO, "/v1/leituras/notas-fiscais"));
  app.get("/financeiro/produtos", (request, reply) => lidarComLeitura(request, reply, QUERY_SEM_FILTRO, "/v1/leituras/produtos"));
  app.get("/financeiro/plano-contas", (request, reply) => lidarComLeitura(request, reply, QUERY_PLANO_CONTAS, "/v1/leituras/plano-contas"));

  /**
   * As poucas escritas que D4-07 autoriza: a alíquota de Produto, o CRUD/import
   * do Plano de contas, os dois gatilhos de emissão de NF (D4-12) e, das ações
   * de execução, só `retry-step` e `cancel` — recuperação operacional sem
   * equivalente na ontologia.
   *
   * `PATCH /financeiro/solicitacoes/:id/aprovado` e as ações `approve`/`review`
   * de execução NÃO ganham equivalente aqui e não são chamadas por nada deste
   * repositório: aprovar é decisão da plataforma desde a Fase 2 (D-06/D-09), e
   * um segundo botão de aprovar sobre outra tabela é a divergência que esta
   * migração existe para eliminar. O caso (i) do teste prova a ausência por
   * 404, não por comentário.
   *
   * Toda rota abaixo passa por `comAlcance` (D4-14) e valida o corpo com um
   * schema zod `.strict()` ANTES de chamar `clienteDeEscrita.enviar` — o
   * mesmo molde das sete leituras acima, com `POST` em vez de `GET` (o CORS
   * deste app já só declara `GET`/`POST`; ver o comentário em `app.ts`). O
   * cliente de escrita carrega `PLATAFORMA_LANCAMENTO_TOKEN`, não o de
   * leitura (plano pós-auditoria, 4.3e — ver `opcoesDosClientesDoFinanceiro`).
   */

  const PORCENTAGEM = /^\d{1,3}([.,]\d{1,4})?$/;
  const CORPO_ALIQUOTAS = z
    .object({
      porcentagemProduto: z.string().regex(PORCENTAGEM).optional(),
      porcentagemServico: z.string().regex(PORCENTAGEM).optional(),
    })
    .strict()
    .refine((corpo) => corpo.porcentagemProduto !== undefined || corpo.porcentagemServico !== undefined);

  app.post("/financeiro/produtos/:id/aliquotas", async (request, reply) => {
    const corpo = CORPO_ALIQUOTAS.safeParse(request.body);
    if (!corpo.success) {
      reply.code(400);
      return { error: "Informe ao menos uma alíquota válida." };
    }
    const { id } = request.params as { readonly id: string };
    return comAlcance(request, reply, async () => {
      const resultado = await clienteDeEscrita.enviar<unknown>(`/v1/leituras/produtos/${id}/aliquotas`, corpo.data);
      return responder(request, reply, resultado, "escrita");
    });
  });

  const LINHA_PLANO_CONTAS = z
    .object({
      cod: z.string().optional(),
      categoria: z.string().optional(),
      categoriaClickup: z.string().optional(),
      descricao: z.string().optional(),
    })
    .strict();

  // Entre 1 e 2000 linhas: sem teto, um corpo grande vira uma sequência de
  // embeddings do tamanho que o cliente mandar (T-4-29).
  const CORPO_IMPORTAR_PLANO_CONTAS = z
    .object({
      empresa: EMPRESA,
      tipo: TIPO,
      linhas: z.array(LINHA_PLANO_CONTAS).min(1).max(2000),
    })
    .strict();

  app.post("/financeiro/plano-contas/importar", async (request, reply) => {
    const corpo = CORPO_IMPORTAR_PLANO_CONTAS.safeParse(request.body);
    if (!corpo.success) {
      reply.code(400);
      return { error: "Corpo inválido para importação do Plano de contas." };
    }
    return comAlcance(request, reply, async () => {
      // Tradução na borda: o `automation/` fala `categoria_clickup`
      // (snake_case); a tela fala `categoriaClickup`. Só aqui a tradução
      // acontece — nenhum outro ponto do módulo conhece o nome legado.
      const linhas = corpo.data.linhas.map((linha) => ({
        cod: linha.cod,
        categoria: linha.categoria,
        categoria_clickup: linha.categoriaClickup,
        descricao: linha.descricao,
      }));
      const resultado = await clienteDeEscrita.enviar<unknown>("/v1/leituras/plano-contas/importar", {
        empresa: corpo.data.empresa,
        tipo: corpo.data.tipo,
        linhas,
      });
      return responder(request, reply, resultado, "escrita");
    });
  });

  const PARAMS_ID_NUMERICO = z.object({ id: z.coerce.number().int().positive() }).strict();
  const CORPO_VAZIO = z.object({}).strict();

  app.post("/financeiro/plano-contas/:id/remover", async (request, reply) => {
    const params = PARAMS_ID_NUMERICO.safeParse(request.params);
    const corpo = CORPO_VAZIO.safeParse(request.body ?? {});
    if (!params.success || !corpo.success) {
      reply.code(400);
      return { error: "Identificador inválido." };
    }
    return comAlcance(request, reply, async () => {
      const resultado = await clienteDeEscrita.enviar<unknown>(`/v1/leituras/plano-contas/${params.data.id}/remover`, {});
      return responder(request, reply, resultado, "escrita");
    });
  });

  /**
   * D4-12: os dois gatilhos de emissão de NF são em LOTE, nomeados abaixo por
   * `key` — nenhuma emissão por linha é alcançável por este caminho. A
   * allowlist literal abaixo é a TERCEIRA barreira contra emissão por linha (a
   * primeira é o union `manualRunKey` em `catalog.ts`, a segunda é a própria
   * rota do `automation/`) e é o que garante isso por construção (T-4-27):
   * mesmo que as duas primeiras um dia aceitem outra `key`, esta borda
   * continua recusando. As duas strings abaixo nascem só aqui — nenhum outro
   * lugar deste arquivo as redigita.
   */
  const WORKFLOWS_EXECUTAVEIS = ["tria-invoice-mark-7days", "tria-invoice-emit"] as const;
  const PARAMS_WORKFLOW = z.object({ key: z.enum(WORKFLOWS_EXECUTAVEIS) }).strict();

  app.post("/financeiro/workflows/:key/executar", async (request, reply) => {
    const params = PARAMS_WORKFLOW.safeParse(request.params);
    if (!params.success) {
      reply.code(400);
      return { error: "Workflow não disponível para execução manual." };
    }
    return comAlcance(request, reply, async () => {
      const resultado = await clienteDeEscrita.enviar<unknown>(`/v1/leituras/workflows/${params.data.key}/executar`, {});
      const corpoDeResposta = responder(request, reply, resultado, "escrita");
      if (resultado.ok) reply.code(202);
      return corpoDeResposta;
    });
  });

  const PARAMS_ID_EXECUCAO = z.object({ id: z.string().min(1) }).strict();
  const CORPO_REPETIR_PASSO = z.object({ passo: z.string().optional() }).strict();
  const CORPO_CANCELAR = z.object({ motivo: z.string().max(500).optional() }).strict();

  app.post("/financeiro/execucoes/:id/repetir-passo", async (request, reply) => {
    const params = PARAMS_ID_EXECUCAO.safeParse(request.params);
    const corpo = CORPO_REPETIR_PASSO.safeParse(request.body ?? {});
    if (!params.success || !corpo.success) {
      reply.code(400);
      return { error: "Corpo inválido." };
    }
    return comAlcance(request, reply, async () => {
      const resultado = await clienteDeEscrita.enviar<unknown>(`/v1/leituras/execucoes/${params.data.id}/repetir-passo`, corpo.data);
      return responder(request, reply, resultado, "escrita");
    });
  });

  app.post("/financeiro/execucoes/:id/cancelar", async (request, reply) => {
    const params = PARAMS_ID_EXECUCAO.safeParse(request.params);
    const corpo = CORPO_CANCELAR.safeParse(request.body ?? {});
    if (!params.success || !corpo.success) {
      reply.code(400);
      return { error: "Corpo inválido." };
    }
    return comAlcance(request, reply, async () => {
      const resultado = await clienteDeEscrita.enviar<unknown>(`/v1/leituras/execucoes/${params.data.id}/cancelar`, corpo.data);
      return responder(request, reply, resultado, "escrita");
    });
  });

  /**
   * O upload de Extratos (D4-13) — o único lugar desta fase onde o `apps/api`
   * recebe arquivo binário, e o único que pode recusar ANTES de gastar banda
   * com a VPS. `enviarArquivo` (04-02) chega até
   * `/webhook/receber-whatsapp-doc/:origem` do `automation/` — o path
   * ORIGINAL do n8n, que não morre no corte, é a rota que D4-13 nomeia, e não
   * uma rota de painel — com a credencial de serviço; o navegador nunca fala
   * com o `automation/` (D4-01).
   *
   * O alarme de D4-13 sobre `MP_RECEBIMENTO_SOURCE` não se materializa no
   * código atual: `sourceUrl` aparece uma única vez em todo o `automation/`
   * (a própria declaração em `tenants/marcos-paulo/config.ts`), sem nenhum
   * consumidor que recuse origem — conferido nesta sessão com
   * `grep -rn "sourceUrl" ../financeiro-tria/automation/src | wc -l` (== 1).
   * Se esse número deixar de ser 1, a allowlist voltou a existir e o
   * `x-source` que este proxy manda precisa ser negociado com quem a criou.
   */

  // Parser de corpo bruto restrito aos MIME aceitos — NÃO um "*" genérico.
  // Qualquer outro content-type cai no 415 padrão do Fastify: a primeira
  // barreira é simplesmente não ter parser registrado para ele (T-4-05).
  // `application/octet-stream` entra porque navegadores mandam isso para
  // `.ofx`; é por isso que a segunda barreira (extensão do `x-file-name`)
  // existe logo abaixo. Registrado DENTRO deste plugin encapsulado
  // (`app.register(rotasDeFinanceiro)`, sem `fastify-plugin`): vale só para
  // as rotas deste módulo, nunca vaza para `POST /operacoes/:nome` (T-4-30) —
  // a suíte de `operacoes` roda verde como prova.
  const MIME_DE_EXTRATO_ACEITOS = [
    "application/pdf",
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/x-ofx",
    "application/ofx",
    "application/octet-stream",
  ] as const;
  for (const tipo of MIME_DE_EXTRATO_ACEITOS) {
    app.addContentTypeParser(tipo, { parseAs: "buffer" }, (_req, corpo, feito) => feito(null, corpo));
  }

  // As sete origens conhecidas (o banco/cartão) — allowlist literal, nunca
  // valor livre repassado ao `automation/`.
  const ORIGENS_DE_EXTRATO = new Set([
    "nubank",
    "itau_unibanco",
    "btg_pactual",
    "btg_cartao",
    "nubank_violeta",
    "personallite_black",
    "azul_infinity",
  ]);

  // A extensão REAL que `parseRecebimento` despacha (CSV, XLSX/XLS, OFX, PDF)
  // — imagem não é suportada do outro lado, então não entra aqui.
  const EXTENSAO_DE_EXTRATO_ACEITA = /\.(pdf|csv|xlsx|xls|ofx)$/i;

  /** Só o basename, sem `/`, `\` ou `..` — um nome de arquivo é entrada não confiável (T-4-28). */
  function nomeDeArquivoSaneado(nome: string): string {
    const semCaminho = nome.split(/[/\\]/).pop() ?? nome;
    return semCaminho.replaceAll("..", "");
  }

  app.post("/financeiro/extratos/:origem", { bodyLimit: 25 * 1024 * 1024 }, async (request, reply) => {
    const { origem } = request.params as { readonly origem: string };
    if (!ORIGENS_DE_EXTRATO.has(origem)) {
      reply.code(400);
      return { error: "Origem de extrato desconhecida." };
    }

    const cabecalhoDeNome = request.headers["x-file-name"];
    const nomeOriginal = Array.isArray(cabecalhoDeNome) ? cabecalhoDeNome[0] : cabecalhoDeNome;
    if (!nomeOriginal || nomeOriginal.length > 200 || !EXTENSAO_DE_EXTRATO_ACEITA.test(nomeOriginal)) {
      reply.code(400);
      return { error: "Envie um arquivo .pdf, .csv, .xlsx, .xls ou .ofx." };
    }

    const conteudo = request.body;
    if (!Buffer.isBuffer(conteudo) || conteudo.byteLength === 0) {
      reply.code(400);
      return { error: "Arquivo vazio." };
    }

    const cabecalhoDeTipo = request.headers["content-type"];
    const contentType = (Array.isArray(cabecalhoDeTipo) ? cabecalhoDeTipo[0] : cabecalhoDeTipo) ?? "application/octet-stream";

    return comAlcance(request, reply, async () => {
      // Continua no cliente de LEITURA de propósito: a rota é o webhook do
      // n8n, não um `POST` de `/v1/leituras` — fora do que o `automation/`
      // passa a exigir com o token de lançamento (4.3e). Se ela ganhar
      // autenticação própria, a credencial é decidida lá.
      const resultado = await cliente.enviarArquivo<unknown>(`/webhook/receber-whatsapp-doc/${origem}`, {
        conteudo,
        contentType,
        nome: nomeDeArquivoSaneado(nomeOriginal),
        origem,
      });
      return responder(request, reply, resultado);
    });
  });
}
