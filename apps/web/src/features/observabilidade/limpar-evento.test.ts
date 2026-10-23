/**
 * O Sentry da web (D-13, SEG-10; T-09-82, T-09-83): o evento que sai do
 * navegador ou do servidor do Next nunca leva corpo, cabeçalho (nem `Referer`),
 * cookie, query, e-mail do usuário nem o segredo de `/f/` e `/p/`.
 *
 * Sem SDK, sem rede, sem DSN real: `limparEvento` e `limparMigalha` são puras e
 * `opcoesDoSentryNaWeb` só monta o objeto de `Sentry.init`.
 */

import { describe, expect, it } from "vitest";
import { limparEvento, limparMigalha, opcoesDoSentryNaWeb } from "./limpar-evento";

const DSN_FALSO = "https://chave-falsa@o0.ingest.sentry.invalid/0";

function eventoComSegredos() {
  return {
    message: "falha ao abrir /p/SEGREDO-P",
    transaction: "/p/SEGREDO-P",
    user: { email: "a@b", id: "u-1", ip_address: "10.0.0.1" },
    request: {
      method: "GET",
      url: "https://app.exemplo.com/f/SEGREDO-W?utm=1",
      headers: { Referer: "https://app.exemplo.com/p/SEGREDO-P", cookie: "a=b", "User-Agent": "teste" },
      cookies: { a: "b" },
      data: "x",
      query_string: "utm=1",
      env: { REMOTE_ADDR: "10.0.0.1" },
    },
    breadcrumbs: [
      { category: "navigation", data: { from: "/f/SEGREDO-W", to: "/inicio" } },
      { category: "fetch", data: { url: "https://api/v1/public/forms/SEGREDO-W", method: "GET" } },
      { category: "console", message: "abrindo https://app.exemplo.com/p/SEGREDO-P agora" },
    ],
    exception: {
      values: [
        {
          type: "Error",
          value: "/f/SEGREDO-W",
          stacktrace: { frames: [{ filename: "app.js", lineno: 1, vars: { token: "SEGREDO-V" } }] },
        },
      ],
    },
  };
}

describe("limparEvento", () => {
  it("não deixa segredo de link, cookie, usuário nem query no evento serializado", () => {
    const texto = JSON.stringify(limparEvento(eventoComSegredos()));
    for (const proibido of ["SEGREDO-W", "SEGREDO-P", "SEGREDO-V", "a=b", "a@b", "utm=1", "10.0.0.1"]) {
      expect(texto, `vazou ${proibido}`).not.toContain(proibido);
    }
  });

  it("apaga corpo, cabeçalhos (inclusive Referer), cookies, query e ambiente da requisição, e mantém método e URL mascarada", () => {
    const { request } = limparEvento(eventoComSegredos());
    expect(request).toEqual({ method: "GET", url: "https://app.exemplo.com/f/***" });
  });

  it("apaga o usuário inteiro", () => {
    expect(limparEvento(eventoComSegredos())).not.toHaveProperty("user");
  });

  it("mascara a transação, a mensagem e o valor da exceção", () => {
    const evento = limparEvento(eventoComSegredos());
    expect(evento.transaction).toBe("/p/***");
    expect(evento.message).toBe("falha ao abrir /p/***");
    expect(evento.exception.values[0]?.value).toBe("/f/***");
  });

  it("mascara o segredo mesmo no meio de um texto de exceção, com URL completa ou só o caminho", () => {
    const evento = limparEvento({
      exception: {
        values: [
          { value: "Failed to fetch RSC payload for https://app.exemplo.com/p/SEGREDO-P. Falling back" },
          { value: "Erro em '/f/SEGREDO-W' (formulario)" },
        ],
      },
    });
    const texto = JSON.stringify(evento);
    expect(texto).not.toContain("SEGREDO-P");
    expect(texto).not.toContain("SEGREDO-W");
    expect(evento.exception.values[0]?.value).toBe("Failed to fetch RSC payload for https://app.exemplo.com/p/***. Falling back");
  });

  it("não troca o que não é link público: /financeiro/f/abc e /inicio ficam como estão", () => {
    const evento = limparEvento({ message: "erro em /financeiro/f/abc e em /inicio" });
    expect(evento.message).toBe("erro em /financeiro/f/abc e em /inicio");
  });

  it("mascara as migalhas de navegação, de fetch e de console dentro do evento", () => {
    const { breadcrumbs } = limparEvento(eventoComSegredos());
    expect(breadcrumbs[0]?.data).toEqual({ from: "/f/***", to: "/inicio" });
    expect(breadcrumbs[1]?.data).toEqual({ url: "https://api/v1/public/forms/***", method: "GET" });
    expect(breadcrumbs[2]?.message).toBe("abrindo https://app.exemplo.com/p/*** agora");
  });

  it("não altera o evento de origem e aceita evento sem requisição nem exceção", () => {
    const origem = eventoComSegredos();
    limparEvento(origem);
    expect(origem.request.headers.Referer).toContain("SEGREDO-P");
    expect(limparEvento({ level: "error" })).toEqual({ level: "error" });
  });
});

describe("limparMigalha", () => {
  it("mascara data.from, data.to, data.url e message", () => {
    const migalha = limparMigalha({
      message: "indo para /p/SEGREDO-P",
      data: {
        from: "https://app.exemplo.com/f/SEGREDO-W?x=1",
        to: "/p/SEGREDO-P",
        url: "https://api/v1/public/tasks/SEGREDO-P?y=2#topo",
        status_code: 200,
      },
    });
    expect(migalha).toEqual({
      message: "indo para /p/***",
      data: { from: "https://app.exemplo.com/f/***", to: "/p/***", url: "https://api/v1/public/tasks/***", status_code: 200 },
    });
  });

  it("deixa passar a migalha sem data nem message", () => {
    expect(limparMigalha({ category: "ui.click" })).toEqual({ category: "ui.click" });
  });
});

describe("opcoesDoSentryNaWeb", () => {
  it("sem DSN devolve opções sem dsn: o SDK não envia nada", () => {
    expect(opcoesDoSentryNaWeb(undefined)).not.toHaveProperty("dsn");
    expect(opcoesDoSentryNaWeb("   ")).not.toHaveProperty("dsn");
  });

  it("com DSN liga só o filtro: sem traços, sem coleta de dado, sem replay", () => {
    const opcoes = opcoesDoSentryNaWeb(DSN_FALSO);
    expect(opcoes.dsn).toBe(DSN_FALSO);
    expect(opcoes.tracesSampleRate).toBe(0);
    expect(opcoes.beforeSend).toBe(limparEvento);
    expect(opcoes.beforeBreadcrumb).toBe(limparMigalha);
    expect(opcoes.sendDefaultPii).toBe(false);
    expect(opcoes.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    });
    expect(opcoes).not.toHaveProperty("integrations");
    expect(opcoes).not.toHaveProperty("replaysSessionSampleRate");
    expect(opcoes).not.toHaveProperty("replaysOnErrorSampleRate");
  });
});
