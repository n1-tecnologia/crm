/**
 * O cliente do Instagram contra um servidor falso no lugar da Meta: o que vai em
 * cada pedido (endereço, método, parâmetros, onde o token viaja) e o que se lê da
 * resposta, nos formatos que a documentação mostra. Nenhum erro carrega o token.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarServidorFalso, type ServidorFalso } from "../../../testes/servidor-falso";
import { criarClienteDoInstagram, ErroDoInstagram, PERMISSOES_DO_INSTAGRAM } from "./cliente";
import type { ConfiguracaoDoInstagram } from "./configuracao";
import { lerConfiguracaoDoInstagram } from "./configuracao";

const TOKEN = "IGAA-token-secreto-de-teste";
const AGORA = Date.parse("2026-11-09T12:00:00.000Z");

let meta: ServidorFalso;
let config: ConfiguracaoDoInstagram;

beforeAll(async () => {
  meta = await criarServidorFalso();
  config = {
    appId: "1234567890",
    appSecret: "segredo-do-app",
    redirectUri: "https://crm.exemplo.test/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno",
    versao: "v24.0",
    enderecos: { autorizar: `${meta.url}/oauth/authorize`, api: meta.url, graph: meta.url },
  };
});

afterAll(async () => {
  await meta.fechar();
});

const cliente = () => criarClienteDoInstagram(config, { agora: () => AGORA, tempoLimiteMs: 2_000 });
const ultima = () => meta.recebidas.at(-1)!;

describe("a janela de login", () => {
  it("pede as duas permissões da Revisão, com o redirect e o state, sem o login do Facebook", () => {
    const url = new URL(cliente().urlDeAutorizacao("estado-1"));
    expect(url.origin + url.pathname).toBe(`${meta.url}/oauth/authorize`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "1234567890",
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: PERMISSOES_DO_INSTAGRAM.join(","),
      state: "estado-1",
      enable_fb_login: "0",
      force_reauth: "true",
    });
  });
});

describe("os pedidos à Meta", () => {
  it("troca o código por formulário e lê o formato novo (`data: [...]`) e o antigo", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { data: [{ access_token: "curto", user_id: 9001, permissions: "instagram_business_basic,instagram_business_manage_messages" }] } });
    expect(await cliente().trocarCodigo("codigo-1")).toEqual({
      token: "curto",
      idNoApp: "9001",
      permissoes: ["instagram_business_basic", "instagram_business_manage_messages"],
    });
    const pedido = ultima();
    expect(pedido.metodo).toBe("POST");
    expect(pedido.caminho).toBe("/oauth/access_token");
    expect(Object.fromEntries(new URLSearchParams(pedido.corpo as string))).toEqual({
      client_id: "1234567890",
      client_secret: "segredo-do-app",
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code: "codigo-1",
    });

    meta.enfileirar({ kind: "ok", status: 200, corpo: { access_token: "curto2", user_id: "9002", permissions: ["instagram_business_basic"] } });
    expect(await cliente().trocarCodigo("codigo-2")).toEqual({ token: "curto2", idNoApp: "9002", permissoes: ["instagram_business_basic"] });
  });

  it("troca pelo token de 60 dias e renova, calculando o vencimento", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { access_token: "longo", token_type: "bearer", expires_in: 5_184_000 } });
    expect(await cliente().tokenDeLongaDuracao("curto")).toEqual({ token: "longo", expiraEm: new Date(AGORA + 5_184_000_000).toISOString() });
    const troca = new URL(ultima().caminho, meta.url);
    expect(troca.pathname).toBe("/access_token");
    expect(Object.fromEntries(troca.searchParams)).toEqual({ grant_type: "ig_exchange_token", client_secret: "segredo-do-app", access_token: "curto" });

    meta.enfileirar({ kind: "ok", status: 200, corpo: { access_token: "renovado", expires_in: 100 } });
    expect((await cliente().renovarToken("longo")).token).toBe("renovado");
    const renova = new URL(ultima().caminho, meta.url);
    expect(renova.pathname).toBe("/refresh_access_token");
    expect(renova.searchParams.get("grant_type")).toBe("ig_refresh_token");
  });

  it("lê a conta com o token no cabeçalho, não na URL", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { user_id: "17841400000000001", username: "loja.n1", name: "Loja N1", profile_picture_url: "https://cdn.exemplo/foto.jpg", id: "app-scoped" } });
    expect(await cliente().lerConta(TOKEN)).toEqual({ contaId: "17841400000000001", usuario: "loja.n1", nome: "Loja N1", fotoUrl: "https://cdn.exemplo/foto.jpg" });
    const pedido = ultima();
    expect(pedido.caminho).toBe("/v24.0/me?fields=user_id%2Cusername%2Cname%2Cprofile_picture_url");
    expect(pedido.cabecalhos.authorization).toBe(`Bearer ${TOKEN}`);
    expect(pedido.caminho).not.toContain(TOKEN);
  });

  it("inscreve a conta no campo messages e exige a confirmação", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { success: true } });
    await cliente().inscreverNasMensagens(TOKEN);
    expect(ultima().metodo).toBe("POST");
    expect(ultima().caminho).toBe("/v24.0/me/subscribed_apps?subscribed_fields=messages");

    meta.enfileirar({ kind: "ok", status: 200, corpo: { success: false } });
    await expect(cliente().inscreverNasMensagens(TOKEN)).rejects.toBeInstanceOf(ErroDoInstagram);
  });

  it("envia texto ao IGSID pela conta e devolve o id da mensagem", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { recipient_id: "igsid-1", message_id: "mid.abc" } });
    expect(await cliente().enviarTexto(TOKEN, "17841400000000001", "igsid-1", "Olá!")).toEqual({ idExterno: "mid.abc" });
    expect(ultima().caminho).toBe("/v24.0/17841400000000001/messages");
    expect(ultima().corpo).toEqual({ recipient: { id: "igsid-1" }, message: { text: "Olá!" } });
  });

  it("lê nome e @ de quem escreveu", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { name: "Ana Souza", username: "ana.souza", profile_pic: "https://cdn/ana.jpg" } });
    expect(await cliente().lerRemetente(TOKEN, "igsid-1")).toEqual({ usuario: "ana.souza", nome: "Ana Souza", fotoUrl: "https://cdn/ana.jpg" });
    expect(ultima().caminho).toBe("/v24.0/igsid-1?fields=name%2Cusername%2Cprofile_pic");
  });
});

describe("os erros", () => {
  it("levam o status, a frase e o código da Meta, nunca o token", async () => {
    meta.enfileirar({ kind: "ok", status: 400, corpo: { error: { message: `Invalid OAuth access token - ${"x".repeat(400)}`, type: "OAuthException", code: 190 } } });
    const erro = await cliente().lerConta(TOKEN).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDoInstagram);
    const doInstagram = erro as ErroDoInstagram;
    expect(doInstagram.status).toBe(400);
    expect(doInstagram.codigo).toBe(190);
    expect(doInstagram.tokenInvalido).toBe(true);
    expect(doInstagram.message.length).toBeLessThanOrEqual(300);
    expect(doInstagram.message).not.toContain(TOKEN);
  });

  it("o erro do login, no formato do api.instagram.com", async () => {
    meta.enfileirar({ kind: "ok", status: 400, corpo: { error_type: "OAuthException", code: 400, error_message: "Matching code was not found or was already used" } });
    await expect(cliente().trocarCodigo("usado")).rejects.toThrow("Matching code was not found or was already used");
  });

  it("sem resposta, a frase genérica, sem a URL (que pode ter o token)", async () => {
    meta.enfileirar({ kind: "timeout" });
    const erro = (await criarClienteDoInstagram(config, { tempoLimiteMs: 200 }).tokenDeLongaDuracao(TOKEN).catch((e: unknown) => e)) as ErroDoInstagram;
    expect(erro.message).toBe("O Instagram não respondeu a tempo.");
    expect(erro.message).not.toContain(TOKEN);
  });
});

describe("a configuração do ambiente", () => {
  const completo = {
    INSTAGRAM_APP_ID: "1",
    INSTAGRAM_APP_SECRET: "s",
    INSTAGRAM_REDIRECT_URI: "https://crm.exemplo.test/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno",
  };

  it("sem as três variáveis, a integração fica desligada", () => {
    expect(lerConfiguracaoDoInstagram({})).toBeUndefined();
    expect(lerConfiguracaoDoInstagram({ ...completo, INSTAGRAM_APP_ID: " " })).toBeUndefined();
  });

  it("com elas, os endereços da Meta e a versão padrão; recusa redirect sem https e versão mal escrita", () => {
    expect(lerConfiguracaoDoInstagram(completo)).toMatchObject({ appId: "1", versao: "v24.0", enderecos: { graph: "https://graph.instagram.com" } });
    expect(() => lerConfiguracaoDoInstagram({ ...completo, INSTAGRAM_REDIRECT_URI: "http://crm.exemplo.test/x" })).toThrow("https");
    expect(lerConfiguracaoDoInstagram({ ...completo, INSTAGRAM_REDIRECT_URI: "http://localhost:3001/x" })?.redirectUri).toBe("http://localhost:3001/x");
    expect(() => lerConfiguracaoDoInstagram({ ...completo, INSTAGRAM_GRAPH_VERSAO: "24" })).toThrow("v24.0");
  });
});
