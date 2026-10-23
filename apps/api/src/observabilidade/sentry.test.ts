/**
 * O Sentry da `apps/api` sem corpo, cabeçalho, cookie, query nem segredo de
 * link (D-13, SEG-10; T-09-63). Sem rede e sem DSN de verdade: o SDK é
 * substituído por espiões e o DSN abaixo usa um domínio `.invalid`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  close: vi.fn(async () => true),
}));
vi.mock("@sentry/node", () => sdk);

import { fecharSentry, iniciarSentry, limparEvento, limparMigalha, opcoesDoSentry } from "./sentry";

const DSN_DE_TESTE = "https://chavefalsa@o0.ingest.example.invalid/0";

beforeEach(() => {
  sdk.init.mockClear();
  sdk.captureException.mockClear();
  sdk.close.mockClear();
});

function eventoComSegredos() {
  return {
    message: "falhou",
    request: {
      method: "GET",
      url: "https://api/v1/public/forms/SEGREDO-S?x=1",
      headers: { authorization: "Bearer T", cookie: "sb=sessao" },
      cookies: { a: "b" },
      data: '{"valor":"123,45"}',
      query_string: "x=1",
      env: { REMOTE_ADDR: "10.0.0.1" },
    },
    user: { email: "a@b", ip_address: "10.0.0.1" },
    transaction: "GET /v1/public/tasks/SEGREDO-T",
    breadcrumbs: [
      { category: "fetch", message: "fetch /v1/public/forms/SEGREDO-S", data: { url: "/v1/public/forms/SEGREDO-S", status_code: 200 } },
    ],
    exception: {
      values: [
        {
          type: "Error",
          value: "falhou em /v1/public/forms/SEGREDO-S",
          stacktrace: { frames: [{ filename: "app.ts", lineno: 3, vars: { senha: "hunter2" } }] },
        },
      ],
    },
  };
}

describe("limparEvento — o evento sai sem dado de requisição nem segredo de link", () => {
  it("apaga corpo, cabeçalhos, cookies, query e usuário, e mascara o segredo da URL em todo lugar", () => {
    const limpo = limparEvento(eventoComSegredos());
    const texto = JSON.stringify(limpo);

    for (const proibido of ["SEGREDO-S", "SEGREDO-T", "Bearer T", "a@b", "x=1", "hunter2", "sb=sessao", "123,45", "10.0.0.1"]) {
      expect(texto, proibido).not.toContain(proibido);
    }
    expect(limpo.request).not.toHaveProperty("headers");
    expect(limpo.request).not.toHaveProperty("cookies");
    expect(limpo.request).not.toHaveProperty("data");
    expect(limpo.request).not.toHaveProperty("query_string");
    expect(limpo).not.toHaveProperty("user");
  });

  it("mantém o que ajuda a achar o erro: método, caminho mascarado, transação e mensagem", () => {
    const limpo = limparEvento(eventoComSegredos());

    expect(limpo.request?.method).toBe("GET");
    expect(limpo.request?.url).toBe("https://api/v1/public/forms/***");
    expect(limpo.transaction).toBe("GET /v1/public/tasks/***");
    expect(limpo.exception?.values?.[0]?.value).toBe("falhou em /v1/public/forms/***");
    expect(limpo.breadcrumbs?.[0]?.data?.url).toBe("/v1/public/forms/***");
    expect(limpo.breadcrumbs?.[0]?.message).toBe("fetch /v1/public/forms/***");
    expect(limpo.breadcrumbs?.[0]?.data?.status_code).toBe(200);
  });

  it("não altera o objeto de entrada e aceita um evento sem os campos opcionais", () => {
    const original = eventoComSegredos();
    const copia = JSON.parse(JSON.stringify(original));
    limparEvento(original);

    expect(original).toEqual(copia);
    expect(limparEvento({ message: "simples" })).toEqual({ message: "simples" });
  });
});

describe("limparMigalha", () => {
  it("mascara data.url e message, e tira a query da url", () => {
    const limpa = limparMigalha({ message: "GET /v1/public/tasks/SEGREDO-T", data: { url: "/v1/public/tasks/SEGREDO-T?token=abc", method: "GET" } });

    expect(JSON.stringify(limpa)).not.toContain("SEGREDO-T");
    expect(JSON.stringify(limpa)).not.toContain("token=abc");
    expect(limpa.message).toBe("GET /v1/public/tasks/***");
    expect(limpa.data?.url).toBe("/v1/public/tasks/***");
    expect(limpa.data?.method).toBe("GET");
  });
});

describe("iniciarSentry e opcoesDoSentry", () => {
  it("sem SENTRY_DSN não inicia o SDK e devolve false", () => {
    expect(iniciarSentry({})).toBe(false);
    expect(iniciarSentry({ SENTRY_DSN: "   " })).toBe(false);
    expect(sdk.init).not.toHaveBeenCalled();
  });

  it("com SENTRY_DSN inicia o SDK uma vez com as opções limpas e devolve true", () => {
    expect(iniciarSentry({ SENTRY_DSN: DSN_DE_TESTE, SENTRY_AMBIENTE: "homologacao" })).toBe(true);

    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init.mock.calls[0]?.[0]).toMatchObject({ dsn: DSN_DE_TESTE, environment: "homologacao", tracesSampleRate: 0 });
  });

  it("as opções desligam traços e coleta de dado, e ligam os dois filtros", () => {
    const opcoes = opcoesDoSentry({ SENTRY_DSN: DSN_DE_TESTE, SENTRY_AMBIENTE: "homologacao" });

    expect(opcoes.tracesSampleRate).toBe(0);
    expect(opcoes.environment).toBe("homologacao");
    expect(opcoes.sendDefaultPii).toBe(false);
    expect(opcoes.beforeSend).toBe(limparEvento);
    expect(opcoes.beforeBreadcrumb).toBe(limparMigalha);
    expect(opcoes.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    });
  });

  it("sem SENTRY_AMBIENTE o ambiente é desenvolvimento", () => {
    expect(opcoesDoSentry({ SENTRY_DSN: DSN_DE_TESTE }).environment).toBe("desenvolvimento");
  });
});

describe("fecharSentry", () => {
  it("espera o envio pendente por até 2 segundos", async () => {
    await fecharSentry();

    expect(sdk.close).toHaveBeenCalledWith(2000);
  });
});
