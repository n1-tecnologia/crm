/**
 * 09-21 — um Bearer com três partes e base64 inválido (`abc.def.ghi`) derrubava
 * `GET /estado` em 500 "Erro interno.": `auth.getClaims` lança `Error: Invalid
 * UTF-8 sequence` (decodificação do cabeçalho do JWT, em `@supabase/auth-js`),
 * `verificarTokenDoSupabase` não capturava e o tratador de erro respondia 500 e
 * mandava o erro ao Sentry. Um token que o cliente inventa não é erro do
 * servidor: é a mesma sessão inválida de qualquer outro token ruim (401).
 *
 * Roda a verificação REAL (`verificarTokenDoSupabase`, a de produção), sem
 * banco e sem rede: o cliente do Supabase é criado com URL e chave falsas, e
 * todo token daqui falha ao DECODIFICAR, antes de qualquer chamada ao JWKS.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app";
import { verificarTokenDoSupabase } from "../autenticacao/verificar-token";

const em64url = (texto: string): string => Buffer.from(texto).toString("base64url");

/** Os tokens que o cliente pode inventar. Todos falham ao decodificar. */
const TOKENS_MALFORMADOS: ReadonlyArray<readonly [string, string]> = [
  ["três partes de letras (abc.def.ghi)", "abc.def.ghi"],
  ["três partes que não são base64 (!!!.!!!.!!!)", "!!!.!!!.!!!"],
  ["cabeçalho em base64 válido, mas JSON inválido", `${em64url("isto não é json")}.${em64url("{}")}.${em64url("assinatura")}`],
  ["corpo em base64 válido, mas JSON inválido", `${em64url('{"alg":"RS256","kid":"k","typ":"JWT"}')}.${em64url("isto não é json")}.${em64url("assinatura")}`],
  ["cabeçalho com bytes que não são UTF-8", `${Buffer.from([0xff, 0xfe, 0xfd]).toString("base64url")}.${em64url("{}")}.${em64url("assinatura")}`],
  // Já eram 401 antes da correção: ficam aqui como controle.
  ["uma parte só (abc)", "abc"],
  ["duas partes (a.b)", "a.b"],
];

const CORPO_DA_SESSAO_INVALIDA = { ok: false, error: "Sessão inválida ou expirada." };

describe("token malformado — 401, nunca 500 (09-21)", () => {
  const anterior = { url: process.env.SUPABASE_URL, chave: process.env.SUPABASE_SECRET_KEY };
  const capturarErro = vi.fn();

  beforeAll(() => {
    // Antes do primeiro `clienteAdmin()`: o cliente é criado uma vez por processo e nunca fala com a rede aqui.
    process.env.SUPABASE_URL = "http://127.0.0.1:9";
    process.env.SUPABASE_SECRET_KEY = "chave-falsa-so-para-o-teste";
  });

  afterAll(() => {
    if (anterior.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = anterior.url;
    if (anterior.chave === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = anterior.chave;
  });

  // Sem `verificarToken` injetado: é a verificação de produção que está em prova.
  const appDeProducao = () => buildApp({ logger: false, workspaceId: "ws_teste", resolverMembro: async () => undefined, capturarErro });

  describe.each(TOKENS_MALFORMADOS)("%s", (_nome, token) => {
    it("verificarTokenDoSupabase devolve null em vez de lançar", async () => {
      await expect(verificarTokenDoSupabase(token)).resolves.toBeNull();
    });

    it("GET /estado responde 401 'Sessão inválida ou expirada.', sem 500 e sem Sentry", async () => {
      capturarErro.mockClear();
      const resposta = await appDeProducao().inject({ method: "GET", url: "/estado", headers: { authorization: `Bearer ${token}` } });
      expect(resposta.statusCode).toBe(401);
      expect(resposta.json()).toEqual(CORPO_DA_SESSAO_INVALIDA);
      expect(resposta.body).not.toContain(token);
      expect(capturarErro).not.toHaveBeenCalled();
    });
  });

  it("a rota pública de saúde continua sem exigir token, com ou sem Bearer malformado", async () => {
    const app = appDeProducao();
    const semToken = await app.inject({ method: "GET", url: "/saude" });
    expect(semToken.statusCode).toBe(200);
    expect(semToken.json()).toEqual({ ok: true, servico: "apps/api" });
    const comLixo = await app.inject({ method: "GET", url: "/saude", headers: { authorization: "Bearer abc.def.ghi" } });
    expect(comLixo.statusCode).toBe(200);
  });

  it("sem Authorization continua 401 'Sem sessão.'", async () => {
    const resposta = await appDeProducao().inject({ method: "GET", url: "/estado" });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({ ok: false, error: "Sem sessão." });
  });
});
