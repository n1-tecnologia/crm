/**
 * As rotas da conexão do WhatsApp oficial (Sessão 7, 7.2.3), com um serviço falso injetado por
 * `buildApp({ crm: { whatsappOficial } })` (sem banco): a sessão é exigida, o corpo é validado (`.strict()`), e o token
 * entra só pelo corpo do `conectar`. A regra de conectar (número, cofre, transação) é do serviço e tem o teste dele em
 * `mensageria/provedores/whatsapp-cloud/whatsapp-cloud.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { Canal } from "@n1/dominio/crm/canais";
import { buildApp } from "../../app";
import type { ServicoDeConexaoDaCloudApi } from "../../mensageria/provedores/whatsapp-cloud/conexao";
import { recusa, sucesso } from "../../servicos/crm/resultado";

const MARYANE = usuarioDoSeed("mem_maryane");
const membros = buildSeed().members;
const AUTORIZACAO = { authorization: "Bearer token-maryane" };
const TOKEN = "EAAG-token-permanente-de-teste-1234567890";

function novoApp() {
  const chamadas: unknown[][] = [];
  const servico: ServicoDeConexaoDaCloudApi = {
    conectar: (...a) => {
      chamadas.push(["conectar", ...a]);
      return Promise.resolve(sucesso({ id: "canal_1", conexao: "conectada" } as Canal));
    },
    numero: (...a) => {
      chamadas.push(["numero", ...a]);
      return Promise.resolve(sucesso({ phoneNumberId: "1098765432100", wabaId: "100200300400500", numeroExibido: "+55 11 97777-0001" }));
    },
    modelos: (...a) => {
      chamadas.push(["modelos", ...a]);
      return Promise.resolve(sucesso({ itens: [], total: 0 }));
    },
    sincronizar: (...a) => {
      chamadas.push(["sincronizar", ...a]);
      return Promise.resolve(sucesso({ criados: 1, atualizados: 0, removidos: 0, ignorados: 0 }));
    },
  };
  const app = buildApp({
    logger: false,
    workspaceId: "ws_rota_whatsapp",
    verificarToken: async (token: string) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId: string, userId: string) => membros.find((m) => m.userId === userId),
    crm: { whatsappOficial: servico },
  });
  return { app, chamadas, servico };
}

const corpoBom = { phoneNumberId: "1098765432100", wabaId: "100200300400500", token: TOKEN };
const conectar = (app: ReturnType<typeof novoApp>["app"], payload: unknown, headers: Record<string, string> = AUTORIZACAO) =>
  app.inject({ method: "POST", url: "/canais/canal_1/whatsapp-oficial/conectar", headers, payload: payload as object });

describe("POST /canais/:id/whatsapp-oficial/conectar", () => {
  it("exige a sessão: sem Authorization, 401 e o serviço nem é chamado", async () => {
    const { app, chamadas } = novoApp();
    expect((await conectar(app, corpoBom, {})).statusCode).toBe(401);
    expect(chamadas).toEqual([]);
  });

  it("passa o Membro da sessão, o id do Canal e os três campos ao serviço, e responde com o Canal conectado", async () => {
    const { app, chamadas } = novoApp();
    const resposta = await conectar(app, corpoBom);
    expect(resposta.statusCode).toBe(200);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]![0]).toBe("conectar");
    expect(chamadas[0]![2]).toBe("canal_1");
    expect(chamadas[0]![3]).toEqual(corpoBom);
    // A resposta é o Canal: o token nunca volta.
    expect(resposta.body).not.toContain(TOKEN);
  });

  it.each([
    ["ID do número com letras", { ...corpoBom, phoneNumberId: "abc123" }],
    ["ID do número curto demais", { ...corpoBom, phoneNumberId: "123" }],
    ["ID da conta com letras", { ...corpoBom, wabaId: "waba-1" }],
    ["token curto demais", { ...corpoBom, token: "curto" }],
    ["token com espaço no meio (colar com sobra)", { ...corpoBom, token: `${TOKEN} sobra` }],
    ["campo a mais (.strict)", { ...corpoBom, extra: 1 }],
    ["sem token", { phoneNumberId: corpoBom.phoneNumberId, wabaId: corpoBom.wabaId }],
  ])("recusa %s com 400, sem chamar o serviço e sem repetir o token na resposta", async (_nome, corpo) => {
    const { app, chamadas } = novoApp();
    const resposta = await conectar(app, corpo);
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
    expect(resposta.body).not.toContain(TOKEN);
  });

  it("os espaços em volta do que foi colado são aparados (o token chega limpo ao serviço)", async () => {
    const { app, chamadas } = novoApp();
    await conectar(app, { phoneNumberId: ` ${corpoBom.phoneNumberId} `, wabaId: `${corpoBom.wabaId}\n`, token: ` ${TOKEN}\n` });
    expect(chamadas[0]![3]).toEqual(corpoBom);
  });

  it("a recusa do serviço sai com o status e o código dele, sem o token", async () => {
    const { app, servico } = novoApp();
    servico.conectar = () => Promise.resolve(recusa(409, "Este token é de outro número.", { codigo: "NUMERO_DIFERENTE", campo: "phoneNumberId" }));
    const resposta = await conectar(app, corpoBom);
    expect(resposta.statusCode).toBe(409);
    expect(JSON.parse(resposta.body)).toMatchObject({ ok: false, codigo: "NUMERO_DIFERENTE", campo: "phoneNumberId" });
    expect(resposta.body).not.toContain(TOKEN);
  });
});

describe("GET /canais/:id/whatsapp-oficial/numero", () => {
  it("exige a sessão", async () => {
    const { app } = novoApp();
    expect((await app.inject({ method: "GET", url: "/canais/canal_1/whatsapp-oficial/numero" })).statusCode).toBe(401);
  });

  it("devolve o número, a conta e o identificador guardados, e nenhum campo de token", async () => {
    const { app } = novoApp();
    const resposta = await app.inject({ method: "GET", url: "/canais/canal_1/whatsapp-oficial/numero", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body) as { dados?: Record<string, unknown>; valor?: Record<string, unknown> };
    const dados = corpo.dados ?? corpo.valor ?? (corpo as Record<string, unknown>);
    expect(JSON.stringify(dados)).toContain("+55 11 97777-0001");
    expect(resposta.body.toLowerCase()).not.toContain("token");
  });
});

describe("os modelos de mensagem do Canal (7.3)", () => {
  it("GET /canais/:id/modelos exige a sessão e passa o Membro e o id ao serviço", async () => {
    const { app, chamadas } = novoApp();
    expect((await app.inject({ method: "GET", url: "/canais/canal_1/modelos" })).statusCode).toBe(401);
    const resposta = await app.inject({ method: "GET", url: "/canais/canal_1/modelos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas.map((c) => [c[0], c[2]])).toEqual([["modelos", "canal_1"]]);
  });

  it("POST /canais/:id/modelos/sincronizar exige a sessão e devolve as contagens", async () => {
    const { app, chamadas } = novoApp();
    expect((await app.inject({ method: "POST", url: "/canais/canal_1/modelos/sincronizar" })).statusCode).toBe(401);
    const resposta = await app.inject({ method: "POST", url: "/canais/canal_1/modelos/sincronizar", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(JSON.parse(resposta.body)).toMatchObject({ ok: true, dados: { criados: 1, atualizados: 0, removidos: 0, ignorados: 0 } });
    expect(chamadas.map((c) => [c[0], c[2]])).toEqual([["sincronizar", "canal_1"]]);
  });
});
