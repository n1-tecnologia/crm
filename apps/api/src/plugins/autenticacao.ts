/**
 * Hook `onRequest` que verifica o JWT do Supabase em `Authorization: Bearer`
 * e decora `request.membro` com o Membro resolvido dentro do Espaço de
 * Trabalho configurado.
 *
 * Registrado direto na instância raiz — sem o wrapper de encapsulamento que
 * outros plugins usam — para alcançar toda rota registrada depois, sem
 * precisar declarar dependência por plugin. Uma rota se isenta marcando
 * `config: { publica: true }` — hoje só `GET /saude`.
 *
 * A regra de acesso replica `apps/web/src/dados/sessao-provider.tsx`
 * (`state === "ativo" || state === "suspenso"`), mas aqui ela é controle de
 * acesso de verdade: o front barra a tela, o backend barra a escrita
 * (Security Domain V4, RESEARCH.md).
 */

import type { FastifyInstance } from "fastify";
import type { Member } from "@n1/dominio";
import type { VerificarToken } from "../autenticacao/verificar-token";

export interface MembroDaSessao {
  readonly id: string;
  readonly workspaceId: string;
  readonly state: Member["state"];
}

declare module "fastify" {
  interface FastifyRequest {
    membro: MembroDaSessao;
  }
  interface FastifyContextConfig {
    publica?: boolean;
  }
}

export interface OpcoesDeAutenticacao {
  readonly workspaceId: string;
  readonly verificarToken: VerificarToken;
  readonly resolverMembro: (workspaceId: string, userId: string) => Promise<Member | undefined>;
}

export function registrarAutenticacao(app: FastifyInstance, opcoes: OpcoesDeAutenticacao): void {
  app.decorateRequest("membro", null, []);

  app.addHook("onRequest", async (request, reply) => {
    if (request.routeOptions.config.publica === true) return;

    const cabecalho = request.headers.authorization;
    const token = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : undefined;
    if (!token) {
      await reply.status(401).send({ ok: false, error: "Sem sessão." });
      return;
    }

    const claims = await opcoes.verificarToken(token);
    if (!claims) {
      await reply.status(401).send({ ok: false, error: "Sessão inválida ou expirada." });
      return;
    }

    // O `workspaceId` vem sempre das opções (de `WORKSPACE_ID`, nunca do
    // cliente): a resolução é SEMPRE "este `sub` dentro DESTE Espaço", nunca
    // "qualquer Membro com este userId" (T-1-02).
    const membro = await opcoes.resolverMembro(opcoes.workspaceId, claims.sub);
    if (!membro) {
      await reply
        .status(403)
        .send({ ok: false, error: "Sua conta existe, mas não é Membro deste Espaço de Trabalho." });
      return;
    }
    if (membro.state !== "ativo" && membro.state !== "suspenso") {
      const motivo =
        membro.state === "pendente"
          ? "Seu convite ainda não foi aceito."
          : "Sua participação neste Espaço de Trabalho foi encerrada.";
      await reply.status(403).send({ ok: false, error: motivo });
      return;
    }

    request.membro = { id: membro.id, workspaceId: opcoes.workspaceId, state: membro.state };
  });
}
