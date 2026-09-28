/**
 * As sete leituras do Financeiro (Task 1/2) — no molde de `estado.test.ts`:
 * um bloco "sem banco" que roda sempre (401 e a allowlist barrando antes da
 * rede) e um bloco contra o Postgres real (`describe.skip` sem
 * `DATABASE_URL`, DEC-09) que prova 200/403/503/502 e o repasse exato do
 * filtro `empresa`. Todo caso usa `buildApp({ financeiro: { cliente,
 * clienteDeEscrita } })` com clientes falsos — nenhum toca rede real.
 *
 * Plano pós-auditoria (lado CRM N1 da 4.3e): as escritas saem por um
 * cliente com `PLATAFORMA_LANCAMENTO_TOKEN`, as leituras continuam com
 * `PLATAFORMA_LEITURA_TOKEN`. O bloco "credencial por sentido" prova isso sem
 * banco (alcance por `hidratarEstado` injetado), com os clientes REAIS
 * contra um servidor HTTP local e o cabeçalho `Authorization` de cada
 * chamada.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import type { ArquivoParaEnviar, ClienteDeLeituras, RespostaDeLeitura } from "../automacoes/cliente-leituras-financeiro";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { EMPRESAS_PERMITIDAS, opcoesDosClientesDoFinanceiro, type OpcoesDeFinanceiro } from "./financeiro";

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

interface ChamadaDeEscrita {
  readonly metodo: "enviar" | "enviarArquivo";
  readonly caminho: string;
  readonly corpo?: unknown;
  readonly arquivo?: ArquivoParaEnviar;
}

/**
 * Cliente de escrita falso (Task 3, 04-10): captura `enviar`/`enviarArquivo` —
 * `ler` lança, porque nenhuma rota de escrita lê. Nenhuma rede.
 */
function clienteFalsoDeEscrita(resultado: RespostaDeLeitura<unknown>): {
  readonly cliente: ClienteDeLeituras;
  readonly chamadas: ChamadaDeEscrita[];
} {
  const chamadas: ChamadaDeEscrita[] = [];
  const cliente: ClienteDeLeituras = {
    async ler<T>(): Promise<RespostaDeLeitura<T>> {
      throw new Error("não usado neste teste");
    },
    async enviar<T>(caminho: string, corpo: unknown): Promise<RespostaDeLeitura<T>> {
      chamadas.push({ metodo: "enviar", caminho, corpo });
      return resultado as unknown as RespostaDeLeitura<T>;
    },
    async enviarArquivo<T>(caminho: string, arquivo: ArquivoParaEnviar): Promise<RespostaDeLeitura<T>> {
      chamadas.push({ metodo: "enviarArquivo", caminho, arquivo });
      return resultado as unknown as RespostaDeLeitura<T>;
    },
  };
  return { cliente, chamadas };
}

/** Um cliente que falha o teste se for usado — prova qual dos dois clientes uma rota NÃO chama. */
const clienteProibido: ClienteDeLeituras = {
  async ler<T>(): Promise<RespostaDeLeitura<T>> {
    throw new Error("cliente errado: esta rota não deveria ler por aqui");
  },
  async enviar<T>(): Promise<RespostaDeLeitura<T>> {
    throw new Error("cliente errado: esta rota não deveria escrever por aqui");
  },
  async enviarArquivo<T>(): Promise<RespostaDeLeitura<T>> {
    throw new Error("cliente errado: este upload não deveria sair por aqui");
  },
};

function appDeTeste(workspaceId: string, cliente?: ClienteDeLeituras, financeiro: OpcoesDeFinanceiro = {}) {
  return buildApp({
    logger: false,
    workspaceId,
    verificarToken: async (token) => {
      if (token === "token-maryane") return { sub: MARYANE };
      if (token === "token-rafael") return { sub: RAFAEL };
      return null;
    },
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
    financeiro: { ...(cliente ? { cliente } : {}), ...financeiro },
  });
}

/**
 * O upload de Extratos continua no cliente de LEITURA (a rota é o webhook do
 * n8n, fora de `/v1/leituras`): o falso vai lá, e o de escrita é proibido.
 */
function appDeUpload(workspaceId: string, cliente: ClienteDeLeituras) {
  return appDeTeste(workspaceId, cliente, { clienteDeEscrita: clienteProibido });
}

/** Para as escritas: o falso vai no cliente de ESCRITA, e o de leitura é proibido. */
function appDeEscrita(workspaceId: string, clienteDeEscrita: ClienteDeLeituras, financeiro: OpcoesDeFinanceiro = {}) {
  return appDeTeste(workspaceId, clienteProibido, { clienteDeEscrita, ...financeiro });
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

describe("POST /financeiro/* — sem banco (as escritas de D4-07 e a ausência da rota de aprovar)", () => {
  it("(a) sem token responde 401 em POST /financeiro/extratos/nubank", async () => {
    const resposta = await appDeTeste("ws_financeiro_teste").inject({
      method: "POST",
      url: "/financeiro/extratos/nubank",
      headers: { "x-file-name": "extrato.csv", "content-type": "text/csv" },
      payload: Buffer.from("0123456789"),
    });
    expect(resposta.statusCode).toBe(401);
  });

  it("(b) sem token responde 401 em POST /financeiro/produtos/p1/aliquotas", async () => {
    const resposta = await appDeTeste("ws_financeiro_teste").inject({
      method: "POST",
      url: "/financeiro/produtos/p1/aliquotas",
      payload: { porcentagemProduto: "10" },
    });
    expect(resposta.statusCode).toBe(401);
  });

  it("(c) origem fora da allowlist é 400 antes de tocar o cliente falso", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: {} });
    const resposta = await appDeUpload("ws_financeiro_teste", escrita).inject({
      method: "POST",
      url: "/financeiro/extratos/banco-inventado",
      headers: { authorization: "Bearer token-maryane", "x-file-name": "extrato.csv", "content-type": "text/csv" },
      payload: Buffer.from("0123456789"),
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ error: "Origem de extrato desconhecida." });
    expect(chamadas).toHaveLength(0);
  });

  it("(d) extensão fora da lista real de parseRecebimento é 400 com a frase das extensões", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: {} });
    const resposta = await appDeUpload("ws_financeiro_teste", escrita).inject({
      method: "POST",
      url: "/financeiro/extratos/nubank",
      headers: { authorization: "Bearer token-maryane", "x-file-name": "extrato.exe", "content-type": "application/octet-stream" },
      payload: Buffer.from("0123456789"),
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ error: "Envie um arquivo .pdf, .csv, .xlsx, .xls ou .ofx." });
    expect(chamadas).toHaveLength(0);
  });

  it("(e) content-type sem parser registrado é 415 — a primeira barreira é não ter parser (afirma só o status)", async () => {
    const resposta = await appDeTeste("ws_financeiro_teste").inject({
      method: "POST",
      url: "/financeiro/extratos/nubank",
      headers: { authorization: "Bearer token-maryane", "x-file-name": "extrato.csv", "content-type": "text/html" },
      payload: "<html></html>",
    });
    expect(resposta.statusCode).toBe(415);
  });

  it("(f) empresa fora da allowlist no import do Plano de contas é 400", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: {} });
    const resposta = await appDeEscrita("ws_financeiro_teste", escrita).inject({
      method: "POST",
      url: "/financeiro/plano-contas/importar",
      headers: { authorization: "Bearer token-maryane" },
      payload: { empresa: "outra", tipo: "pagar", linhas: [{ cod: "1" }] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it("(g) linhas: [] é 400 — mínimo de 1 linha", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: {} });
    const resposta = await appDeEscrita("ws_financeiro_teste", escrita).inject({
      method: "POST",
      url: "/financeiro/plano-contas/importar",
      headers: { authorization: "Bearer token-maryane" },
      payload: { empresa: "tria", tipo: "pagar", linhas: [] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it("(g) 2001 linhas é 400 — teto de 2000 (T-4-29)", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: {} });
    const linhas = Array.from({ length: 2001 }, (_, i) => ({ cod: String(i) }));
    const resposta = await appDeEscrita("ws_financeiro_teste", escrita).inject({
      method: "POST",
      url: "/financeiro/plano-contas/importar",
      headers: { authorization: "Bearer token-maryane" },
      payload: { empresa: "tria", tipo: "pagar", linhas },
    });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it("(h) key de workflow fora da allowlist é 400 e o cliente falso não é chamado (T-4-27)", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 202, corpo: { accepted: true } });
    const resposta = await appDeEscrita("ws_financeiro_teste", escrita).inject({
      method: "POST",
      url: "/financeiro/workflows/qualquer-coisa/executar",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ error: "Workflow não disponível para execução manual." });
    expect(chamadas).toHaveLength(0);
  });

  it("(i) a rota de aprovar não existe — 404 em dois caminhos plausíveis (T-4-09)", async () => {
    const resposta1 = await appDeTeste("ws_financeiro_teste").inject({
      method: "POST",
      url: "/financeiro/solicitacoes/1/aprovado",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta1.statusCode).toBe(404);

    const resposta2 = await appDeTeste("ws_financeiro_teste").inject({
      method: "POST",
      url: "/financeiro/execucoes/1/aprovar",
      headers: { authorization: "Bearer token-maryane" },
    });
    expect(resposta2.statusCode).toBe(404);
  });
});

describe("credencial por sentido (plano pós-auditoria, 4.3e) — sem banco", () => {
  it("opcoesDosClientesDoFinanceiro: leitura com PLATAFORMA_LEITURA_TOKEN, escrita com PLATAFORMA_LANCAMENTO_TOKEN, mesma origem", () => {
    const { leitura, escrita } = opcoesDosClientesDoFinanceiro({
      FINANCEIRO_LEITURAS_URL: "https://financeiro.exemplo",
      PLATAFORMA_LEITURA_TOKEN: "tok-leitura",
      PLATAFORMA_LANCAMENTO_TOKEN: "tok-lancamento",
    });
    expect(leitura).toEqual({ destinoUrl: "https://financeiro.exemplo", token: "tok-leitura" });
    expect(escrita).toEqual({ destinoUrl: "https://financeiro.exemplo", token: "tok-lancamento" });
  });

  it("ausentes viram token vazio — o cliente responde CREDENCIAL_AUSENTE sem sair para a rede", () => {
    const { leitura, escrita } = opcoesDosClientesDoFinanceiro({});
    expect(leitura.token).toBe("");
    expect(escrita.token).toBe("");
  });

  describe("os clientes REAIS contra um servidor local", () => {
    const VARIAVEIS = ["FINANCEIRO_LEITURAS_URL", "PLATAFORMA_LEITURA_TOKEN", "PLATAFORMA_LANCAMENTO_TOKEN"] as const;
    const originais = Object.fromEntries(VARIAVEIS.map((v) => [v, process.env[v]]));
    let servidor: ServidorFalso;

    afterEach(async () => {
      for (const v of VARIAVEIS) {
        if (originais[v] === undefined) delete process.env[v];
        else process.env[v] = originais[v];
      }
      await servidor?.fechar();
    });

    /** O app com os clientes construídos do ambiente — só o alcance (hidratação) é injetado. */
    async function appReal(tokens: { readonly leitura?: string; readonly lancamento?: string } = { leitura: "tok-leitura", lancamento: "tok-lancamento" }) {
      servidor = await criarServidorFalso();
      process.env.FINANCEIRO_LEITURAS_URL = servidor.url;
      if (tokens.leitura === undefined) delete process.env.PLATAFORMA_LEITURA_TOKEN;
      else process.env.PLATAFORMA_LEITURA_TOKEN = tokens.leitura;
      if (tokens.lancamento === undefined) delete process.env.PLATAFORMA_LANCAMENTO_TOKEN;
      else process.env.PLATAFORMA_LANCAMENTO_TOKEN = tokens.lancamento;
      return appDeTeste("ws_financeiro_teste", undefined, { hidratarEstado: async () => semente });
    }

    it("GET sai com o token de leitura", async () => {
      const app = await appReal();
      servidor.enfileirar({ kind: "ok", status: 200, corpo: { metricas: [] } });
      const resposta = await app.inject({ method: "GET", url: "/financeiro/dashboard", headers: { authorization: "Bearer token-maryane" } });
      expect(resposta.statusCode).toBe(200);
      expect(servidor.recebidas.map((r) => [r.metodo, r.caminho, r.cabecalhos.authorization])).toEqual([["GET", "/v1/leituras/dashboard", "Bearer tok-leitura"]]);
    });

    it.each([
      ["/financeiro/produtos/p1/aliquotas", { porcentagemProduto: "10" }, "/v1/leituras/produtos/p1/aliquotas"],
      ["/financeiro/plano-contas/importar", { empresa: "tria", tipo: "pagar", linhas: [{ cod: "1" }] }, "/v1/leituras/plano-contas/importar"],
      ["/financeiro/plano-contas/7/remover", {}, "/v1/leituras/plano-contas/7/remover"],
      ["/financeiro/workflows/tria-invoice-emit/executar", undefined, "/v1/leituras/workflows/tria-invoice-emit/executar"],
      ["/financeiro/execucoes/exe1/repetir-passo", { passo: "launch_omie" }, "/v1/leituras/execucoes/exe1/repetir-passo"],
      ["/financeiro/execucoes/exe1/cancelar", { motivo: "teste" }, "/v1/leituras/execucoes/exe1/cancelar"],
    ] as const)("POST %s sai com o token de LANÇAMENTO", async (url, payload, caminho) => {
      const app = await appReal();
      servidor.enfileirar({ kind: "ok", status: 200, corpo: { ok: true } });
      const resposta = await app.inject({
        method: "POST",
        url,
        headers: { authorization: "Bearer token-maryane" },
        ...(payload !== undefined ? { payload } : {}),
      });
      expect(resposta.statusCode).toBeLessThan(300);
      expect(servidor.recebidas.map((r) => [r.metodo, r.caminho, r.cabecalhos.authorization])).toEqual([["POST", caminho, "Bearer tok-lancamento"]]);
    });

    it("o upload de Extrato continua com o token de leitura — é o webhook do n8n, fora de /v1/leituras", async () => {
      const app = await appReal();
      servidor.enfileirar({ kind: "ok", status: 200, corpo: { ok: true } });
      const resposta = await app.inject({
        method: "POST",
        url: "/financeiro/extratos/nubank",
        headers: { authorization: "Bearer token-maryane", "x-file-name": "extrato.csv", "content-type": "text/csv" },
        payload: Buffer.from("0123456789"),
      });
      expect(resposta.statusCode).toBe(200);
      expect(servidor.recebidas.map((r) => [r.caminho, r.cabecalhos.authorization])).toEqual([["/webhook/receber-whatsapp-doc/nubank", "Bearer tok-leitura"]]);
    });

    it("sem PLATAFORMA_LANCAMENTO_TOKEN, a escrita responde 503 com a frase da escrita e nada sai — mesmo com o token de leitura presente", async () => {
      const app = await appReal({ leitura: "tok-leitura" });
      const resposta = await app.inject({
        method: "POST",
        url: "/financeiro/plano-contas/7/remover",
        headers: { authorization: "Bearer token-maryane" },
        payload: {},
      });
      expect(resposta.statusCode).toBe(503);
      expect(resposta.json()).toEqual({ error: "A escrita do Financeiro não está configurada." });
      expect(servidor.recebidas).toHaveLength(0);
    });

    it("Membro sem alcance recebe 403 e nenhuma requisição sai (a autorização vem antes da rede)", async () => {
      const app = await appReal();
      const resposta = await app.inject({
        method: "POST",
        url: "/financeiro/execucoes/exe1/cancelar",
        headers: { authorization: "Bearer token-rafael" },
        payload: {},
      });
      expect(resposta.statusCode).toBe(403);
      expect(servidor.recebidas).toHaveLength(0);
    });
  });
});

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;
const WS = "ws_financeiro_teste_banco";

d("GET e POST /financeiro/* — contra o banco real", () => {
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

  it("(j) Membro sem alcance recebe 403 em POST /financeiro/extratos/nubank, cliente falso não chamado", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: { ok: true } });
    const resposta = await appDeUpload(WS, escrita).inject({
      method: "POST",
      url: "/financeiro/extratos/nubank",
      headers: { authorization: "Bearer token-rafael", "x-file-name": "extrato.csv", "content-type": "text/csv" },
      payload: Buffer.from("0123456789"),
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({ error: "Sem acesso ao Financeiro." });
    expect(chamadas).toHaveLength(0);
  });

  it("(j) Membro sem alcance recebe 403 em POST /financeiro/plano-contas/importar, cliente falso não chamado", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: { imported: 1 } });
    const resposta = await appDeEscrita(WS, escrita).inject({
      method: "POST",
      url: "/financeiro/plano-contas/importar",
      headers: { authorization: "Bearer token-rafael" },
      payload: { empresa: "tria", tipo: "pagar", linhas: [{ cod: "1" }] },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({ error: "Sem acesso ao Financeiro." });
    expect(chamadas).toHaveLength(0);
  });

  it("(k) Membro com alcance: upload de 10 bytes com x-file-name extrato.csv vira 200 e o cliente recebeu o caminho, o Buffer, o nome e a origem exatos", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: { ok: true, parsed: 1, inserted: 1 } });
    const conteudo = Buffer.from("0123456789");
    const resposta = await appDeUpload(WS, escrita).inject({
      method: "POST",
      url: "/financeiro/extratos/nubank",
      headers: { authorization: "Bearer token-maryane", "x-file-name": "extrato.csv", "content-type": "text/csv" },
      payload: conteudo,
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.metodo).toBe("enviarArquivo");
    expect(chamadas[0]?.caminho).toBe("/webhook/receber-whatsapp-doc/nubank");
    expect(chamadas[0]?.arquivo?.conteudo).toEqual(conteudo);
    expect(chamadas[0]?.arquivo?.nome).toBe("extrato.csv");
    expect(chamadas[0]?.arquivo?.origem).toBe("nubank");
  });

  it("(l) Upload com x-file-name '../../etc/passwd.csv': o cliente recebeu só 'passwd.csv' — o saneamento acontece", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: { ok: true, parsed: 0, inserted: 0 } });
    const resposta = await appDeUpload(WS, escrita).inject({
      method: "POST",
      url: "/financeiro/extratos/nubank",
      headers: { authorization: "Bearer token-maryane", "x-file-name": "../../etc/passwd.csv", "content-type": "text/csv" },
      payload: Buffer.from("0123456789"),
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.arquivo?.nome).toBe("passwd.csv");
  });

  it("(m) Corpo vazio no upload é 400 e o cliente falso não é chamado", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: { ok: true } });
    const resposta = await appDeUpload(WS, escrita).inject({
      method: "POST",
      url: "/financeiro/extratos/nubank",
      headers: { authorization: "Bearer token-maryane", "x-file-name": "extrato.csv", "content-type": "text/csv" },
      payload: Buffer.alloc(0),
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ error: "Arquivo vazio." });
    expect(chamadas).toHaveLength(0);
  });

  it("(n) Importar com categoriaClickup no corpo: o cliente recebeu categoria_clickup — a tradução acontece só na borda", async () => {
    const { cliente: escrita, chamadas } = clienteFalsoDeEscrita({ ok: true, status: 200, corpo: { imported: 1 } });
    const resposta = await appDeEscrita(WS, escrita).inject({
      method: "POST",
      url: "/financeiro/plano-contas/importar",
      headers: { authorization: "Bearer token-maryane" },
      payload: { empresa: "tria", tipo: "pagar", linhas: [{ cod: "1", categoria: "Cat", categoriaClickup: "CU1", descricao: "Desc" }] },
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas).toHaveLength(1);
    const corpoEnviado = chamadas[0]?.corpo as { linhas: Array<Record<string, unknown>> };
    expect(corpoEnviado.linhas[0]).toEqual({ cod: "1", categoria: "Cat", categoria_clickup: "CU1", descricao: "Desc" });
    expect(corpoEnviado.linhas[0]).not.toHaveProperty("categoriaClickup");
  });
});
