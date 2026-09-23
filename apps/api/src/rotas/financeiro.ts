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
import { memberReachesContainer } from "@n1/dominio/derive";
import { CP } from "@n1/dominio/operations";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import {
  criarClienteDeLeituras,
  type ClienteDeLeituras,
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
  /** O teste injeta um cliente falso; sem opção, o módulo constrói o real. */
  readonly cliente?: ClienteDeLeituras;
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
  // Único ponto do módulo que lê variável de ambiente — as duas que D4-02
  // introduziu (04-02 já as documenta, vazias, em `apps/api/.env.example`).
  const cliente =
    opcoes.cliente ??
    criarClienteDeLeituras({
      destinoUrl: process.env.FINANCEIRO_LEITURAS_URL ?? "",
      token: process.env.PLATAFORMA_LEITURA_TOKEN ?? "",
    });

  /**
   * Hidrata o Espaço só para decidir alcance à Pasta "Financeiro" (D4-14) e
   * libera a conexão sempre, antes ou depois da decisão. Sem alcance, 403 com
   * a mesma frase para todo mundo — não entregar o mapa da permissão a quem
   * não a tem.
   */
  async function comAlcance(request: FastifyRequest, reply: FastifyReply, seguir: () => Promise<unknown>): Promise<unknown> {
    const conexao = await pool().connect();
    try {
      const { state } = await hidratar(conexao, request.membro.workspaceId);
      if (!memberReachesContainer(state, request.membro.id, "folder", CP.folderId)) {
        reply.code(403);
        return { error: "Sem acesso ao Financeiro." };
      }
      return await seguir();
    } finally {
      conexao.release();
    }
  }

  /**
   * Traduz a falha do cliente de leituras em status do `apps/api`. As duas
   * frases abaixo são as que a tela renderiza no estado de falha (D4-15) —
   * fixas, em pt-BR, sem detalhe de origem. `code`/`summary` vão só para o
   * log (T-4-11): nunca para o corpo da resposta.
   */
  function responder(request: FastifyRequest, reply: FastifyReply, resultado: RespostaDeLeitura<unknown>): unknown {
    if (resultado.ok) return resultado.corpo;
    request.log.warn({ code: resultado.code, summary: resultado.summary }, "financeiro: leitura ao automation/ falhou");
    if (resultado.code === "CREDENCIAL_AUSENTE") {
      reply.code(503);
      return { error: "A leitura do Financeiro não está configurada." };
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
}
