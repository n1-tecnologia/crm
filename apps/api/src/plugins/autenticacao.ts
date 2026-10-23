/**
 * Hook `onRequest` que verifica o JWT do Supabase em `Authorization: Bearer`
 * e decora `request.membro` com o Membro resolvido dentro do Espaço de
 * Trabalho configurado.
 *
 * Registrado direto na instância raiz — sem o wrapper de encapsulamento que
 * outros plugins usam — para alcançar toda rota registrada depois, sem
 * precisar declarar dependência por plugin. Uma rota se isenta marcando
 * `config: { publica: true }` — hoje só `GET /saude` — e todo o prefixo
 * `PREFIXO_ROTAS_DE_SERVICO` (`/v1/integrations`, D-15) se isenta por URL,
 * porque autentica por credencial de serviço (`autenticacao-servico.ts`),
 * nunca por JWT humano.
 *
 * A regra de acesso replica `apps/web/src/dados/sessao-provider.tsx`
 * (`state === "ativo" || state === "suspenso"`), mas aqui ela é controle de
 * acesso de verdade: o front barra a tela, o backend barra a escrita
 * (Security Domain V4, RESEARCH.md).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Member } from "@n1/dominio";
import type { VerificarToken } from "../autenticacao/verificar-token";
import { PREFIXO_ROTAS_DE_SERVICO } from "./autenticacao-servico";

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

/** A frase que o Membro suspenso lê ao tentar gravar (1.2.1). */
export const FRASE_DE_SUSPENSO = "Seu acesso está suspenso: você consulta, mas não altera.";

/**
 * 1.2.1 — o suspenso passa pela autenticação (acima) para CONSULTAR; quem grava
 * recusa por esta função, ou por `podeNoCrm` no CRM novo. Devolve a frase da
 * recusa quando o Membro não está `ativo`, e `undefined` quando pode seguir.
 */
export function recusaDeSuspenso(membro: MembroDaSessao): string | undefined {
  return membro.state !== "ativo" ? FRASE_DE_SUSPENSO : undefined;
}

/**
 * Hook `preValidation` das rotas REST que gravam (Financeiro, anexos da Tarefa e
 * CRM): para um método fora de GET/HEAD/OPTIONS, o Membro que não está `ativo`
 * recebe 403 com a frase do suspenso, ANTES de validar o corpo (1.2 e a Open
 * Question 7 da pesquisa: o suspenso consulta e não grava, em toda família de
 * rota). `POST /operacoes/:nome` recusa na própria rota (1.2.1), depois de
 * conferir o nome da operação.
 *
 * Registre-o na primeira linha do plugin, antes de registrar os filhos, para
 * que as rotas deles o herdem. No CRM a `podeNoCrm` continua como segunda barreira.
 */
export async function recusarSuspensoNaEscrita(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (METODOS_DE_LEITURA.has(request.method)) return;
  const frase = recusaDeSuspenso(request.membro);
  if (frase === undefined) return;
  await reply.status(403).send({ ok: false, error: frase, codigo: "SUSPENSO" });
}

const METODOS_DE_LEITURA: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

export interface OpcoesDeAutenticacao {
  readonly workspaceId: string;
  readonly verificarToken: VerificarToken;
  readonly resolverMembro: (workspaceId: string, userId: string) => Promise<Member | undefined>;
}

export function registrarAutenticacao(app: FastifyInstance, opcoes: OpcoesDeAutenticacao): void {
  app.decorateRequest("membro", null, []);

  app.addHook("onRequest", async (request, reply) => {
    if (request.routeOptions.config.publica === true) return;
    // `/v1/integrations/*` autentica por credencial de serviço
    // (`plugins/autenticacao-servico.ts`), nunca por JWT humano — D-15,
    // T-02-03. Este hook está na raiz do Fastify, e um hook na raiz
    // cascateia para TODO filho, inclusive o plugin encapsulado dessas
    // rotas; sem este corte explícito, ele chegaria lá primeiro e
    // rejeitaria uma credencial de serviço válida (que não é um JWT) antes
    // do hook de serviço ter a chance de rodar. Nenhuma rota humana usa
    // este prefixo, então o corte nunca esconde uma checagem que devesse
    // valer.
    if (request.url === PREFIXO_ROTAS_DE_SERVICO || request.url.startsWith(`${PREFIXO_ROTAS_DE_SERVICO}/`)) return;

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
