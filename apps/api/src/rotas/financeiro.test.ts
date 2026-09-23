/**
 * As sete leituras do Financeiro (Task 1/2) — no molde de `estado.test.ts`:
 * um bloco "sem banco" que roda sempre (401 e a allowlist barrando antes da
 * rede) e um bloco contra o Postgres real (`describe.skip` sem
 * `DATABASE_URL`, DEC-09) que prova 200/403/503/502 e o repasse exato do
 * filtro `empresa`. Todo caso usa `buildApp({ financeiro: { cliente } })`
 * com um cliente falso — nenhum toca rede real.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import type { ClienteDeLeituras, RespostaDeLeitura } from "../automacoes/cliente-leituras-financeiro";
import { EMPRESAS_PERMITIDAS } from "./financeiro";

const MARYANE = usuarioDoSeed("mem_maryane"); // CP.financeiroId — tem Concessão em "Gestão" (o Espaço privado que contém a Pasta Financeiro).
const RAFAEL = usuarioDoSeed("mem_rafael"); // Sem Concessão nenhuma em "Gestão" — o Espaço privado corta antes do Papel.
const semente = buildSeed();
const membros = semente.members;

interface ChamadaCapturada {
  readonly caminho: string;
  readonly query?: Record<string, string>;
}

/** Cliente de leituras falso: devolve sempre `resultado` e captura toda chamada — nenhuma rede. */
function clienteFalso(resultado: RespostaDeLeitura<unknown>): { readonly cliente: ClienteDeLeituras; readonly chamadas: ChamadaCapturada[] } {
  const chamadas: ChamadaCapturada[] = [];
  const cliente: ClienteDeLeituras = {
    async ler<T>(caminho: string, opcoes?: { readonly query?: Record<string, string> }): Promise<RespostaDeLeitura<T>> {
      chamadas.push({ caminho, ...(opcoes?.query ? { query: opcoes.query } : {}) });
      return resultado as unknown as RespostaDeLeitura<T>;
    },
    async enviar<T>(): Promise<RespostaDeLeitura<T>> {
      throw new Error("não usado neste teste");
    },
    async enviarArquivo<T>(): Promise<RespostaDeLeitura<T>> {
      throw new Error("não usado neste teste");
    },
  };
  return { cliente, chamadas };
}

function appDeTeste(workspaceId: string, cliente?: ClienteDeLeituras) {
  return buildApp({
    logger: false,
    workspaceId,
    verificarToken: async (token) => {
      if (token === "token-maryane") return { sub: MARYANE };
      if (token === "token-rafael") return { sub: RAFAEL };
      return null;
    },
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
    ...(cliente ? { financeiro: { cliente } } : {}),
  });
}

describe("GET /financeiro/* — sem banco", () => {
  it("(a) sem token responde 401 em /financeiro/dashboard — prova que herdou o hook de JWT (T-4-07)", async () => {
    const resposta = await appDeTeste("ws_financeiro_teste").inject({ method: "GET", url: "/financeiro/dashboard" });
    expect(resposta.statusCode).toBe(401);
  });

  it("(a) sem token responde 401 em /financeiro/notas-fiscais também — a herança vale para o módulo todo", async () => {
    const resposta = await appDeTeste("ws_financeiro_teste").inject({ method: "GET", url: "/financeiro/notas-fiscais" });
    expect(resposta.statusCode).toBe(401);
  });

  it("(b) empresa fora da allowlist é 400 sem tocar o cliente falso — a rede nunca é alcançada (T-4-08)", async () => {
    const { cliente, chamadas } = clienteFalso({ ok: true, status: 200, corpo: {} });
    const resposta = await appDeTeste("ws_financeiro_teste", cliente).inject({
      method: "GET",
      url: "/financeiro/plano-contas?empresa=qualquer-coisa",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it("(c) tipo=apagar (parecido com pagar) não passa — 400, cliente falso não chamado", async () => {
    const { cliente, chamadas } = clienteFalso({ ok: true, status: 200, corpo: {} });
    const resposta = await appDeTeste("ws_financeiro_teste", cliente).inject({
      method: "GET",
      url: "/financeiro/plano-contas?tipo=apagar",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });
});

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;
const WS = "ws_financeiro_teste_banco";

d("GET /financeiro/* — contra o banco real", () => {
  beforeAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
      await semear(cliente, WS, semente);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  it("(d) Membro com alcance recebe 200 e o corpo repassado igual, sem reprojeção", async () => {
    const { cliente } = clienteFalso({ ok: true, status: 200, corpo: { metricas: [] } });
    const resposta = await appDeTeste(WS, cliente).inject({
      method: "GET",
      url: "/financeiro/dashboard",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ metricas: [] });
  });

  it("(e) Membro sem alcance recebe 403 e o cliente falso não é chamado — a autorização vem antes da rede (T-4-19)", async () => {
    const { cliente, chamadas } = clienteFalso({ ok: true, status: 200, corpo: { metricas: [] } });
    const resposta = await appDeTeste(WS, cliente).inject({
      method: "GET",
      url: "/financeiro/dashboard",
      headers: { authorization: "Bearer token-rafael" },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({ error: "Sem acesso ao Financeiro." });
    expect(chamadas).toHaveLength(0);
  });

  it("(f) cliente falso sem credencial vira 503 com a frase fixa", async () => {
    const { cliente } = clienteFalso({
      ok: false,
      permanente: true,
      code: "CREDENCIAL_AUSENTE",
      summary: "Credencial de leitura ausente.",
    });
    const resposta = await appDeTeste(WS, cliente).inject({
      method: "GET",
      url: "/financeiro/dashboard",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({ error: "A leitura do Financeiro não está configurada." });
  });

  it("(g) erro do automation/ vira 502 e o corpo não carrega detalhe de origem (T-4-11)", async () => {
    const { cliente } = clienteFalso({ ok: false, permanente: false, code: "HTTP_500", summary: "pg: senha=supersecreta" });
    const resposta = await appDeTeste(WS, cliente).inject({
      method: "GET",
      url: "/financeiro/dashboard",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(502);
    const corpo = JSON.stringify(resposta.json());
    expect(corpo).not.toContain("supersecreta");
    expect(corpo).not.toContain("pg:");
  });

  it("(h) ?empresa=exo_participacoes repassa exatamente esse valor ao cliente, sem a tela/teste redigitar a allowlist", async () => {
    const empresa = EMPRESAS_PERMITIDAS[4]; // "exo_participacoes"
    const { cliente, chamadas } = clienteFalso({ ok: true, status: 200, corpo: {} });
    const resposta = await appDeTeste(WS, cliente).inject({
      method: "GET",
      url: `/financeiro/dashboard?empresa=${empresa}`,
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.query).toEqual({ empresa });
  });
});
