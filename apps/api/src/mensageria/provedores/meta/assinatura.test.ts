import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signedRequest as assinar } from "../../../testes/assinatura-da-meta";
import { assinaturaDoCorpoConfere, lerSignedRequest } from "./assinatura";

const SEGREDO = "segredo-do-app";

const signedRequest = (carga: unknown, segredo = SEGREDO): string => assinar(carga, segredo);

describe("X-Hub-Signature-256", () => {
  const corpo = Buffer.from('{"object":"instagram"}');
  const assinatura = `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;

  it("confere com o corpo cru e o segredo certos", () => {
    expect(assinaturaDoCorpoConfere(SEGREDO, corpo, assinatura)).toBe(true);
  });

  it("recusa outro segredo, outro corpo, cabeçalho sem prefixo ou ausente", () => {
    expect(assinaturaDoCorpoConfere("outro", corpo, assinatura)).toBe(false);
    expect(assinaturaDoCorpoConfere(SEGREDO, Buffer.from('{"object": "instagram"}'), assinatura)).toBe(false);
    expect(assinaturaDoCorpoConfere(SEGREDO, corpo, assinatura.slice("sha256=".length))).toBe(false);
    expect(assinaturaDoCorpoConfere(SEGREDO, corpo, undefined)).toBe(false);
  });
});

describe("signed_request (desautorização e exclusão de dados)", () => {
  it("lê o user_id de um pedido assinado, numérico ou texto", () => {
    expect(lerSignedRequest(signedRequest({ algorithm: "HMAC-SHA256", user_id: "17841400000", issued_at: 1_700_000_000 }), SEGREDO)).toEqual({
      userId: "17841400000",
      emitidoEm: 1_700_000_000,
    });
    expect(lerSignedRequest(signedRequest({ algorithm: "HMAC-SHA256", user_id: 123 }), SEGREDO)).toEqual({ userId: "123" });
  });

  it("recusa assinatura de outro segredo, carga adulterada, algoritmo errado e forma inválida", () => {
    expect(lerSignedRequest(signedRequest({ algorithm: "HMAC-SHA256", user_id: "1" }, "outro"), SEGREDO)).toBeUndefined();
    const [assinatura] = signedRequest({ algorithm: "HMAC-SHA256", user_id: "1" }).split(".");
    const adulterada = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "2" })).toString("base64url");
    expect(lerSignedRequest(`${assinatura}.${adulterada}`, SEGREDO)).toBeUndefined();
    expect(lerSignedRequest(signedRequest({ algorithm: "none", user_id: "1" }), SEGREDO)).toBeUndefined();
    expect(lerSignedRequest(signedRequest({ algorithm: "HMAC-SHA256" }), SEGREDO)).toBeUndefined();
    expect(lerSignedRequest("sem-ponto", SEGREDO)).toBeUndefined();
    expect(lerSignedRequest("a.b.c", SEGREDO)).toBeUndefined();
    expect(lerSignedRequest("", SEGREDO)).toBeUndefined();
  });
});
