/**
 * O `state` e o PKCE do login do e-mail (Fase 17, 17-12, D-17-04). Sem banco e sem rede: só HMAC e relógio fixo.
 *
 * Prova: o `state` volta com o Membro, o Espaço, o Canal, o serviço e o nonce; vence em 10 min; um caractere trocado, outra
 * assinatura, outro serviço e um segredo que não é o do serviço o recusam; e o verificador do PKCE é determinístico, tem 43
 * caracteres e casa com o desafio S256.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { VALIDADE_DO_ESTADO_MS, assinarEstadoDoEmail, desafioPkce, emitirEstadoDoEmail, lerEstadoDoEmail, verificadorPkce } from "./estado";

const AGORA = Date.parse("2026-11-19T12:00:00.000Z");
const PEDIDO = { workspaceId: "ws_a", canalId: "cnl_a", membroId: "mem_a", servico: "microsoft" as const };
const SEGREDOS: Record<string, string | undefined> = { microsoft: "segredo-da-microsoft-de-teste", google: "segredo-do-google-de-teste" };
const segredoDe = (s: string) => SEGREDOS[s];

describe("assinarEstadoDoEmail e lerEstadoDoEmail", () => {
  it("volta com o pedido, o serviço e o nonce, e vence em 10 minutos", () => {
    const state = assinarEstadoDoEmail(SEGREDOS.microsoft!, PEDIDO, AGORA);
    const lido = lerEstadoDoEmail(segredoDe, state, AGORA);
    expect(lido).toMatchObject({ ...PEDIDO, expiraEm: AGORA + VALIDADE_DO_ESTADO_MS });
    expect(lido!.nonce).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(VALIDADE_DO_ESTADO_MS).toBe(10 * 60_000);
    expect(lerEstadoDoEmail(segredoDe, state, AGORA + VALIDADE_DO_ESTADO_MS)).toBeDefined();
    expect(lerEstadoDoEmail(segredoDe, state, AGORA + VALIDADE_DO_ESTADO_MS + 1)).toBeUndefined();
  });

  it("dois pedidos iguais saem com states e nonces diferentes", () => {
    const a = emitirEstadoDoEmail(SEGREDOS.microsoft!, PEDIDO, AGORA);
    const b = emitirEstadoDoEmail(SEGREDOS.microsoft!, PEDIDO, AGORA);
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it("recusa um caractere trocado, na parte dos dados e na da assinatura", () => {
    const state = assinarEstadoDoEmail(SEGREDOS.microsoft!, PEDIDO, AGORA);
    const trocar = (texto: string, i: number) => `${texto.slice(0, i)}${texto[i] === "A" ? "B" : "A"}${texto.slice(i + 1)}`;
    const ponto = state.indexOf(".");
    expect(lerEstadoDoEmail(segredoDe, trocar(state, 3), AGORA)).toBeUndefined();
    expect(lerEstadoDoEmail(segredoDe, trocar(state, ponto + 3), AGORA)).toBeUndefined();
  });

  it("recusa a forma errada, sem lançar", () => {
    for (const texto of ["", "sem-ponto", "a.b.c", "!!!.???", "e30.e30", ".", "a."]) {
      expect(lerEstadoDoEmail(segredoDe, texto, AGORA)).toBeUndefined();
    }
  });

  it("assinado com o segredo do Google e marcado microsoft não vale como da Microsoft", () => {
    const doGoogle = assinarEstadoDoEmail(SEGREDOS.google!, PEDIDO, AGORA);
    expect(lerEstadoDoEmail(segredoDe, doGoogle, AGORA)).toBeUndefined();
  });

  it("o s trocado nos dados invalida a assinatura (o serviço está sob a assinatura)", () => {
    const state = assinarEstadoDoEmail(SEGREDOS.microsoft!, PEDIDO, AGORA);
    const [dados, assinada] = state.split(".") as [string, string];
    const corpo = JSON.parse(Buffer.from(dados, "base64url").toString("utf8")) as Record<string, unknown>;
    const forjado = Buffer.from(JSON.stringify({ ...corpo, s: "google" }), "utf8").toString("base64url");
    expect(lerEstadoDoEmail(segredoDe, `${forjado}.${assinada}`, AGORA)).toBeUndefined();
  });

  it("serviço sem segredo (não configurado) não lê nada", () => {
    const state = assinarEstadoDoEmail(SEGREDOS.microsoft!, PEDIDO, AGORA);
    expect(lerEstadoDoEmail(() => undefined, state, AGORA)).toBeUndefined();
  });

  it("o state não carrega o segredo do cliente", () => {
    const state = assinarEstadoDoEmail(SEGREDOS.microsoft!, PEDIDO, AGORA);
    expect(state).not.toContain(SEGREDOS.microsoft);
    expect(Buffer.from(state.split(".")[0]!, "base64url").toString("utf8")).not.toContain(SEGREDOS.microsoft);
  });
});

describe("PKCE", () => {
  it("o verificador tem 43 caracteres base64url, é determinístico e depende do segredo e do nonce", () => {
    const v = verificadorPkce("segredo", "nonce-1");
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verificadorPkce("segredo", "nonce-1")).toBe(v);
    expect(verificadorPkce("segredo", "nonce-2")).not.toBe(v);
    expect(verificadorPkce("outro-segredo", "nonce-1")).not.toBe(v);
  });

  it("o desafio é base64url(sha256(verificador)), 43 caracteres (S256)", () => {
    const v = verificadorPkce("segredo", "nonce-1");
    const d = desafioPkce(v);
    expect(d).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(d).toBe(createHash("sha256").update(v).digest("base64url"));
    // O desafio sozinho não revela o verificador.
    expect(d).not.toBe(v);
  });
});
