/**
 * Hook `onRequest` que verifica a credencial de serviço em
 * `Authorization: Bearer <id>.<segredo>` e decora `request.servico` com o
 * Membro "Agente do pipeline" que a credencial representa (D-15).
 *
 * Mesma forma de `plugins/autenticacao.ts` — `decorateRequest`, hook
 * `onRequest`, `config.publica` — mas encapsulado num plugin Fastify
 * aplicado só ao prefixo `PREFIXO_ROTAS_DE_SERVICO` (`/v1/integrations`),
 * registrado em `app.ts` como filho de `/v1/integrations`. Isto é o que
 * mantém os dois caminhos sem se cruzar: o hook humano nunca decide
 * 401/403 aqui, e este hook nunca decide nada em `/operacoes/:nome` ou
 * `/estado` (T-02-03).
 *
 * `request.membro` permanece `null`/ausente nestas rotas — quem escreve é o
 * serviço, e o `actingMemberId` de qualquer operação vem de
 * `request.servico.memberId` (o Agente do pipeline resolvido pela
 * credencial), nunca de nada que o corpo da requisição mande (T-02-12,
 * Elevation of Privilege — caso (h) do teste).
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { erroDoContrato } from "../contratos/erros";
import { resolverCredencial as resolverCredencialPadrao } from "../persistencia/credenciais-de-servico";

/**
 * O prefixo das rotas serviço-a-serviço — usado aqui para nada (o hook não
 * decide por URL, só pelo plugin em que está registrado) e em
 * `plugins/autenticacao.ts` para o hook humano recusar entrar neste
 * território, já que um hook na raiz do Fastify cascateia para todo filho
 * (inclusive este plugin encapsulado) — ver o comentário lá.
 */
export const PREFIXO_ROTAS_DE_SERVICO = "/v1/integrations";

export interface ServicoDaSessao {
  readonly credencialId: string;
  readonly workspaceId: string;
  readonly memberId: string;
  readonly scopes: readonly string[];
}

declare module "fastify" {
  interface FastifyRequest {
    servico: ServicoDaSessao;
  }
  interface FastifyContextConfig {
    /** Escopo exigido pela rota, ex.: `"payment-requests:write"`. Ausente = nenhum escopo específico exigido (além de ter credencial válida). */
    escopo?: string;
  }
}

export type ResolverCredencial = typeof resolverCredencialPadrao;

export interface OpcoesDeAutenticacaoDeServico {
  /** Padrão: `resolverCredencial` de `persistencia/credenciais-de-servico.ts`. Testes injetam um stub, sem banco. */
  readonly resolverCredencial?: ResolverCredencial;
}

export function registrarAutenticacaoDeServico(
  app: FastifyInstance,
  opcoes: OpcoesDeAutenticacaoDeServico = {},
): void {
  const resolverCredencial = opcoes.resolverCredencial ?? resolverCredencialPadrao;

  app.decorateRequest("servico", null, []);

  app.addHook("onRequest", async (request, reply) => {
    if (request.routeOptions.config.publica === true) return;

    // Nunca logar o header Authorization — só o requestId, que já é seguro
    // de aparecer em log e no envelope de erro.
    const requestId = (request.headers["x-request-id"] as string | undefined)?.trim() || randomUUID();
    request.id = requestId;

    const cabecalho = request.headers.authorization;
    const token = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : undefined;
    if (!token) {
      await reply.status(401).send(erroDoContrato("CREDENCIAL_AUSENTE", requestId));
      return;
    }

    const credencial = await resolverCredencial(token);
    if (!credencial) {
      // Mesma resposta para id inexistente e segredo errado — nunca dar ao
      // chamador um jeito de distinguir os dois casos (T-02-12).
      await reply.status(401).send(erroDoContrato("CREDENCIAL_INVALIDA", requestId));
      return;
    }

    const escopoExigido = request.routeOptions.config.escopo;
    if (escopoExigido !== undefined && !credencial.scopes.includes(escopoExigido)) {
      await reply.status(403).send(erroDoContrato("ESCOPO_INSUFICIENTE", requestId));
      return;
    }

    // O corpo da requisição nunca decide o ator: memberId vem sempre da
    // credencial resolvida contra o banco (caso (h) do teste).
    request.servico = {
      credencialId: credencial.id,
      workspaceId: credencial.workspaceId,
      memberId: credencial.memberId,
      scopes: credencial.scopes,
    };
  });
}
