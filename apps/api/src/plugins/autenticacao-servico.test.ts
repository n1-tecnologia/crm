/**
 * D-15/T-02-12/T-02-03 — o hook de autenticação de serviço, provado com
 * `app.inject()` e `resolverCredencial` injetado por opção (D-DEC-09: sem
 * rede, sem banco). Nenhuma rota `/v1/integrations/*` real nasce nesta
 * Fase — `rotasDeIntegracaoParaTeste` (`app.ts`) registra duas rotas de
 * prova DENTRO do plugin encapsulado do prefixo, o único jeito de uma rota
 * herdar `registrarAutenticacaoDeServico` (uma rota adicionada fora desse
 * plugin seria irmã, não filha, e não herdaria o hook).
 *
 * Os casos (f)/(g) provam a fronteira com o hook humano
 * (`autenticacao.test.ts`) na MESMA instância de app — os dois hooks só
 * coexistem sem se atropelar porque `plugins/autenticacao.ts` corta por
 * `PREFIXO_ROTAS_DE_SERVICO` antes de tentar verificar um JWT.
 */

import { describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import type { ResolverCredencial } from "./autenticacao-servico";

const WORKSPACE = "ws_teste_servico";
const MEMBRO_AGENTE_PIPELINE_ID = "mem_agente_pipeline_teste";
const REQUEST_ID = "req-teste-fixo";

interface CredencialDeTeste {
  readonly id: string;
  readonly segredo: string;
  readonly workspaceId: string;
  readonly memberId: string;
  readonly scopes: readonly string[];
  readonly state: "ativa" | "rotacionando" | "revogada";
}

const CREDENCIAL_ATIVA: CredencialDeTeste = {
  id: "svc_ativa1234",
  segredo: "segredo-correto-da-ativa",
  workspaceId: WORKSPACE,
  memberId: MEMBRO_AGENTE_PIPELINE_ID,
  scopes: ["payment-requests:read"],
  state: "ativa",
};

const CREDENCIAL_REVOGADA: CredencialDeTeste = {
  id: "svc_revogada12",
  segredo: "segredo-correto-da-revogada",
  workspaceId: WORKSPACE,
  memberId: MEMBRO_AGENTE_PIPELINE_ID,
  scopes: ["payment-requests:read", "payment-requests:write"],
  state: "revogada",
};

/** Mesmo contrato de `persistencia/credenciais-de-servico.ts::resolverCredencial` — id inexistente e segredo errado devolvem o MESMO `undefined` (não-enumeração). */
function criarResolverCredencialDeTeste(credenciais: readonly CredencialDeTeste[]): ResolverCredencial {
  return async (token) => {
    const corte = token.indexOf(".");
    if (corte <= 0) return undefined;
    const id = token.slice(0, corte);
    const segredo = token.slice(corte + 1);

    const achada = credenciais.find((credencial) => credencial.id === id);
    if (!achada) return undefined;
    if (achada.state === "revogada") return undefined;
    if (achada.segredo !== segredo) return undefined;

    return {
      id: achada.id,
      workspaceId: achada.workspaceId,
      memberId: achada.memberId,
      scopes: achada.scopes,
      state: achada.state,
    };
  };
}

// Membro humano real do seed (ativo) — só precisa passar pela checagem de
// `state` do hook humano; nenhum caso aqui depende de qual Membro é.
const MARYANE = usuarioDoSeed("mem_maryane");
const semente = buildSeed();
const MEMBRO_HUMANO = semente.members.find((membro) => membro.userId === MARYANE);
if (!MEMBRO_HUMANO) throw new Error("seed sem mem_maryane — fixture do teste ficou desatualizada");

function appDeTeste(opcoes: { readonly resolverCredencial?: ResolverCredencial } = {}) {
  const resolverCredencial =
    opcoes.resolverCredencial ?? criarResolverCredencialDeTeste([CREDENCIAL_ATIVA, CREDENCIAL_REVOGADA]);

  return buildApp({
    logger: false,
    workspaceId: WORKSPACE,
    verificarToken: async (token) => (token === "token-humano-valido" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId, userId) => (userId === MARYANE ? MEMBRO_HUMANO : undefined),
    resolverCredencial,
    rotasDeIntegracaoParaTeste: (integracao) => {
      // Escopo que CREDENCIAL_ATIVA tem: 200 com request.servico.
      integracao.get("/quem-sou", { config: { escopo: "payment-requests:read" } }, async (request) => request.servico);
      // O corpo nunca decide o ator (caso h): devolve request.servico mesmo
      // com memberId/actingMemberId hostis no corpo.
      integracao.post("/quem-sou", { config: { escopo: "payment-requests:read" } }, async (request) => request.servico);
      // Escopo que CREDENCIAL_ATIVA NÃO tem: prova o 403 (caso d).
      integracao.post("/escrever", { config: { escopo: "payment-requests:write" } }, async () => ({ ok: true }));
    },
  });
}

function tokenDe(credencial: CredencialDeTeste): string {
  return `${credencial.id}.${credencial.segredo}`;
}

describe("registrarAutenticacaoDeServico — hook onRequest de /v1/integrations/*", () => {
  it("(a) sem Authorization responde 401 CREDENCIAL_AUSENTE", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/v1/integrations/quem-sou",
      headers: { "x-request-id": REQUEST_ID },
    });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({
      error: {
        code: "CREDENCIAL_AUSENTE",
        message: "Credencial de serviço ausente.",
        requestId: REQUEST_ID,
        retryable: false,
      },
    });
  });

  it("(b) id inexistente e segredo errado devolvem a MESMA resposta 401 CREDENCIAL_INVALIDA — não-enumeração", async () => {
    const app = appDeTeste();

    const idInexistente = await app.inject({
      method: "GET",
      url: "/v1/integrations/quem-sou",
      headers: { authorization: "Bearer svc_naoexiste.qualquer-segredo", "x-request-id": REQUEST_ID },
    });
    const segredoErrado = await app.inject({
      method: "GET",
      url: "/v1/integrations/quem-sou",
      headers: { authorization: `Bearer ${CREDENCIAL_ATIVA.id}.segredo-completamente-errado`, "x-request-id": REQUEST_ID },
    });

    expect(idInexistente.statusCode).toBe(401);
    expect(segredoErrado.statusCode).toBe(401);
    expect(idInexistente.json()).toEqual(segredoErrado.json());
    expect(idInexistente.json()).toEqual({
      error: {
        code: "CREDENCIAL_INVALIDA",
        message: "Credencial de serviço ausente ou inválida.",
        requestId: REQUEST_ID,
        retryable: false,
      },
    });
  });

  it("(c) credencial revogada responde 401", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/v1/integrations/quem-sou",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_REVOGADA)}`, "x-request-id": REQUEST_ID },
    });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().error.code).toBe("CREDENCIAL_INVALIDA");
  });

  it("(d) credencial válida sem o escopo da rota responde 403 ESCOPO_INSUFICIENTE", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/escrever",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ATIVA)}`, "x-request-id": REQUEST_ID },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({
      error: {
        code: "ESCOPO_INSUFICIENTE",
        message: "Credencial sem escopo para esta operação.",
        requestId: REQUEST_ID,
        retryable: false,
      },
    });
  });

  it("(e) credencial válida com escopo responde 200 e request.servico.memberId é o Membro da credencial", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/v1/integrations/quem-sou",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ATIVA)}`, "x-request-id": REQUEST_ID },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      credencialId: CREDENCIAL_ATIVA.id,
      workspaceId: CREDENCIAL_ATIVA.workspaceId,
      memberId: MEMBRO_AGENTE_PIPELINE_ID,
      scopes: CREDENCIAL_ATIVA.scopes,
    });
  });

  it("(f) JWT humano válido apresentado em /v1/integrations/* responde 401 — o hook de serviço não aceita JWT", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/v1/integrations/quem-sou",
      headers: { authorization: "Bearer token-humano-valido", "x-request-id": REQUEST_ID },
    });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().error.code).toBe("CREDENCIAL_INVALIDA");
  });

  it("(g) credencial de serviço apresentada em POST /operacoes/:nome responde 401 do hook humano — os caminhos não se cruzam", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/qualquerOperacao",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ATIVA)}` },
      payload: {},
    });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({ ok: false, error: "Sessão inválida ou expirada." });
  });

  it("(h) memberId/actingMemberId no corpo não alteram request.servico.memberId", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/quem-sou",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ATIVA)}`, "x-request-id": REQUEST_ID },
      payload: { memberId: "mem_impostor", actingMemberId: "mem_outro_impostor" },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().memberId).toBe(MEMBRO_AGENTE_PIPELINE_ID);
  });
});
