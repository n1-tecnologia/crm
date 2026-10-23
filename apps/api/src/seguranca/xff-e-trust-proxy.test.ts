/**
 * `X-Forwarded-For` forjado contra `TRUST_PROXY` (Fase 9, D-14 + D-19; T-09-80).
 *
 * O limite de taxa por IP das rotas públicas usa `request.ip`. Atrás do nginx, o
 * `request.ip` só é o IP de quem chamou se o Fastify confiar no nginx
 * (`trustProxy: "loopback"` na VPS) e ler o `X-Forwarded-For` PELA DIREITA — o IP
 * que o nginx anexou. Quem forja a parte esquerda do cabeçalho não pode criar balde
 * novo, e quem chega por outro endereço que não o do proxy não pode ter o cabeçalho
 * acreditado.
 *
 * `remoteAddress` do `inject` (opção do `light-my-request`) é o endereço do par TCP;
 * é assim que o teste faz o papel do nginx (127.0.0.1) e o de um cliente que bate
 * direto na porta (qualquer outro). Tudo em processo: nenhuma requisição sai da máquina.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { criarLimiteDeTaxa } from "../servicos/limite-de-taxa";

const SEGREDO_QUE_NAO_EXISTE = "SEGREDO-QUE-NAO-EXISTE-0123456789abcdef";

/** O app com o `trustProxy` pedido e um limite de `maximo` por IP; uma rota pública de prova devolve o `request.ip`. */
function appComTrustProxy(trustProxy: string, maximo: number) {
  const estado = buildSeed();
  const app = buildApp({
    logger: false,
    workspaceId: "ws_xff",
    trustProxy,
    verificarToken: async () => null,
    resolverMembro: async () => undefined,
    formulariosPublicos: { lerEstado: async () => estado, limitePorIp: criarLimiteDeTaxa({ janelaMs: 60_000, maximo }) },
  });
  app.get("/ip-de-prova", { config: { publica: true } }, async (request) => ({ ip: request.ip }));
  return app;
}

type App = ReturnType<typeof appComTrustProxy>;

const chamar = (app: App, remoteAddress: string, xff: string) =>
  app.inject({
    method: "GET",
    url: `/v1/public/forms/${SEGREDO_QUE_NAO_EXISTE}`,
    remoteAddress,
    headers: { "x-forwarded-for": xff },
  });

const ipDe = async (app: App, remoteAddress: string, xff: string): Promise<string> => {
  const resposta = await app.inject({ method: "GET", url: "/ip-de-prova", remoteAddress, headers: { "x-forwarded-for": xff } });
  return (resposta.json() as { ip: string }).ip;
};

describe('trustProxy: "loopback" (a VPS: nginx no mesmo servidor)', () => {
  it("o IP que vale é o que o nginx anexou à direita; a parte esquerda do XFF, que o cliente forja, não conta", async () => {
    const app = appComTrustProxy("loopback", 25);
    expect(await ipDe(app, "127.0.0.1", "9.9.9.9, 203.0.113.7")).toBe("203.0.113.7");
    expect(await ipDe(app, "127.0.0.1", "8.8.8.8, 203.0.113.7")).toBe("203.0.113.7");
    expect(await ipDe(app, "127.0.0.1", "1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.7")).toBe("203.0.113.7");
    expect(await ipDe(app, "127.0.0.1", "203.0.113.8")).toBe("203.0.113.8");
    await app.close();
  });

  it("variar só a parte esquerda do XFF não cria balde novo: a terceira chamada do mesmo IP é 429; outro IP à direita não", async () => {
    const app = appComTrustProxy("loopback", 2);
    expect((await chamar(app, "127.0.0.1", "9.9.9.9, 203.0.113.7")).statusCode).toBe(404);
    expect((await chamar(app, "127.0.0.1", "9.9.9.9, 203.0.113.7")).statusCode).toBe(404);
    const terceira = await chamar(app, "127.0.0.1", "8.8.8.8, 203.0.113.7");
    expect(terceira.statusCode, terceira.body).toBe(429);
    expect(Number(terceira.headers["retry-after"])).toBeGreaterThanOrEqual(1);

    // Controle: outro cliente de verdade (outro IP anexado pelo nginx) tem o próprio balde.
    const outro = await chamar(app, "127.0.0.1", "203.0.113.8");
    expect(outro.statusCode, "outro IP à direita não pode herdar o limite do primeiro").not.toBe(429);
    await app.close();
  });

  it("com o par TCP fora do loopback, o XFF é ignorado: três chamadas com XFF diferentes caem no mesmo balde (429 na terceira)", async () => {
    const app = appComTrustProxy("loopback", 2);
    expect(await ipDe(app, "198.51.100.9", "9.9.9.9, 203.0.113.7")).toBe("198.51.100.9");
    expect((await chamar(app, "198.51.100.9", "9.9.9.9")).statusCode).toBe(404);
    expect((await chamar(app, "198.51.100.9", "8.8.8.8")).statusCode).toBe(404);
    const terceira = await chamar(app, "198.51.100.9", "7.7.7.7");
    expect(terceira.statusCode, terceira.body).toBe(429);
    await app.close();
  });
});

describe('trustProxy vazio ("ninguém é proxy")', () => {
  it("o XFF é sempre ignorado, até quando o par é o loopback: o IP é o do par", async () => {
    const app = appComTrustProxy("", 25);
    expect(await ipDe(app, "127.0.0.1", "9.9.9.9, 203.0.113.7")).toBe("127.0.0.1");
    expect(await ipDe(app, "198.51.100.9", "9.9.9.9")).toBe("198.51.100.9");
    await app.close();
  });

  it("variar o XFF não cria balde novo: a terceira chamada do mesmo par é 429", async () => {
    const app = appComTrustProxy("", 2);
    expect((await chamar(app, "127.0.0.1", "9.9.9.9")).statusCode).toBe(404);
    expect((await chamar(app, "127.0.0.1", "8.8.8.8")).statusCode).toBe(404);
    const terceira = await chamar(app, "127.0.0.1", "7.7.7.7, 203.0.113.7");
    expect(terceira.statusCode, terceira.body).toBe(429);
    await app.close();
  });
});
