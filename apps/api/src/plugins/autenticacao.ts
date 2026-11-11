/**
 * Hook `onRequest` que verifica o JWT do Supabase em `Authorization: Bearer`
 * e decora `request.membro` com o Membro resolvido dentro do Espaço de
 * Trabalho configurado.
 *
 * Só o Membro `ativo` passa (12.1.5, decisão B: o suspenso fica sem acesso, como
 * um removido, e volta com o histórico ao ser reativado). A exceção é o
 * `pendente` numa rota marcada `config: { aceitaPendente: true }` — hoje só
 * `POST /convites/aceitar` (12.3.3), onde ele aceita o convite. Cada recusa leva
 * um `codigo` para a web saber que tela mostrar.
 *
 * Registrado direto na instância raiz — sem o wrapper de encapsulamento que
 * outros plugins usam — para alcançar toda rota registrada depois, sem
 * precisar declarar dependência por plugin. Uma rota se isenta marcando
 * `config: { publica: true }` — hoje só `GET /saude` — e todo o prefixo
 * `PREFIXO_ROTAS_DE_SERVICO` (`/v1/integrations`, D-15) se isenta por URL,
 * porque autentica por credencial de serviço (`autenticacao-servico.ts`),
 * nunca por JWT humano.
 *
 * A web repete a regra para mostrar a tela certa, mas o controle de acesso de
 * verdade é este: o front barra a tela, o backend barra o dado (Security
 * Domain V4, RESEARCH.md).
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
    /** 12.3.3 — a rota atende o Membro `pendente` (só quem aceita o convite). */
    aceitaPendente?: boolean;
  }
}

/** A frase que o Membro suspenso lê em qualquer rota (12.1.5 B). */
export const FRASE_DE_SUSPENSO = "Seu acesso foi suspenso.";

/** A frase que o Membro pendente lê fora das rotas `aceitaPendente`. */
export const FRASE_DE_CONVITE_PENDENTE = "Seu convite ainda não foi aceito.";

/** Os `codigo` das recusas do hook, para a web escolher a tela. */
export const CODIGO_SUSPENSO = "SUSPENSO";
export const CODIGO_CONVITE_PENDENTE = "CONVITE_PENDENTE";
export const CODIGO_REMOVIDO = "REMOVIDO";

/**
 * 1.2.1 — segunda barreira das rotas que gravam: devolve a frase da recusa
 * quando o Membro não está `ativo`, e `undefined` quando pode seguir. Desde a
 * 12.1.5 (B) o hook já barra o suspenso antes; esta conferência fica para que
 * nenhuma escrita dependa de uma barreira só.
 */
export function recusaDeSuspenso(membro: MembroDaSessao): string | undefined {
  return membro.state !== "ativo" ? FRASE_DE_SUSPENSO : undefined;
}

/**
 * Hook `preValidation` das rotas REST que gravam (Financeiro, anexos da Tarefa e
 * CRM): para um método fora de GET/HEAD/OPTIONS, o Membro que não está `ativo`
 * recebe 403 com a frase do suspenso, ANTES de validar o corpo. É a segunda
 * barreira: o hook de autenticação já recusa o suspenso em toda rota (12.1.5 B).
 * `POST /operacoes/:nome` repete a conferência na própria rota (1.2.1).
 *
 * Registre-o na primeira linha do plugin, antes de registrar os filhos, para
 * que as rotas deles o herdem. No CRM a `podeNoCrm` continua como segunda barreira.
 */
export async function recusarSuspensoNaEscrita(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (METODOS_DE_LEITURA.has(request.method)) return;
  const frase = recusaDeSuspenso(request.membro);
  if (frase === undefined) return;
  await reply.status(403).send({ ok: false, error: frase, codigo: CODIGO_SUSPENSO });
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
    const pendenteAceitando = membro.state === "pendente" && request.routeOptions.config.aceitaPendente === true;
    if (membro.state !== "ativo" && !pendenteAceitando) {
      const [motivo, codigo] =
        membro.state === "pendente"
          ? [FRASE_DE_CONVITE_PENDENTE, CODIGO_CONVITE_PENDENTE]
          : membro.state === "suspenso"
            ? [FRASE_DE_SUSPENSO, CODIGO_SUSPENSO]
            : ["Sua participação neste Espaço de Trabalho foi encerrada.", CODIGO_REMOVIDO];
      await reply.status(403).send({ ok: false, error: motivo, codigo });
      return;
    }

    request.membro = { id: membro.id, workspaceId: opcoes.workspaceId, state: membro.state };
  });
}
