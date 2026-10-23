/**
 * Provas de SEG-05 (Plan 09-10, D-17): a cifra do cofre.
 *
 * Este arquivo nunca lê o `.env`: toda chave é gerada aqui, em memória, com
 * `randomBytes(32)`, e nunca é impressa nem gravada.
 */

import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cifrar, decifrar, lerChavesDoCofre, type ChavesDoCofre, type DonoDaCredencial } from "./cofre";

const dono: DonoDaCredencial = {
  workspaceId: "ws_teste",
  donoTipo: "canal",
  donoId: "canal_1",
  tipo: "token_de_acesso",
};

function chavesCom(chave: Buffer, versao = 1): ChavesDoCofre {
  return { atual: { versao, chave } };
}

describe("cofre: cifra AES-256-GCM sem banco", () => {
  it("decifra o que cifrou", () => {
    const chave = randomBytes(32);
    const linha = cifrar("tok-123", chave, 1, dono);
    expect(decifrar(linha, chavesCom(chave), dono)).toBe("tok-123");
  });

  it("usa IV novo de 12 bytes a cada gravação e etiqueta de 16 bytes", () => {
    const chave = randomBytes(32);
    const a = cifrar("tok-123", chave, 1, dono);
    const b = cifrar("tok-123", chave, 1, dono);
    expect(a.iv.length).toBe(12);
    expect(a.etiqueta.length).toBe(16);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.segredoCifrado.equals(b.segredoCifrado)).toBe(false);
  });

  it("lança com outra chave de 32 bytes", () => {
    const linha = cifrar("tok-123", randomBytes(32), 1, dono);
    expect(() => decifrar(linha, chavesCom(randomBytes(32)), dono)).toThrow();
  });

  it("lança quando a linha é copiada para outro dono (AAD)", () => {
    const chave = randomBytes(32);
    const linha = cifrar("tok-123", chave, 1, dono);
    expect(() => decifrar(linha, chavesCom(chave), { ...dono, donoId: "canal_2" })).toThrow();
    expect(() => decifrar(linha, chavesCom(chave), { ...dono, workspaceId: "ws_outro" })).toThrow();
    expect(() => decifrar(linha, chavesCom(chave), { ...dono, tipo: "outro_tipo" })).toThrow();
  });

  it("lança com a etiqueta truncada para 8 bytes", () => {
    const chave = randomBytes(32);
    const linha = cifrar("tok-123", chave, 1, dono);
    const truncada = { ...linha, etiqueta: linha.etiqueta.subarray(0, 8) };
    expect(() => decifrar(truncada, chavesCom(chave), dono)).toThrow();
  });

  it("lança com o texto cifrado adulterado", () => {
    const chave = randomBytes(32);
    const linha = cifrar("tok-123", chave, 1, dono);
    const adulterado = Buffer.from(linha.segredoCifrado);
    adulterado[0] = (adulterado[0] ?? 0) ^ 0xff;
    expect(() => decifrar({ ...linha, segredoCifrado: adulterado }, chavesCom(chave), dono)).toThrow();
  });

  it("recusa cifrar com chave que não tem 32 bytes", () => {
    expect(() => cifrar("tok-123", randomBytes(16), 1, dono)).toThrow("COFRE_CHAVE precisa ter 32 bytes (base64).");
  });
});

describe("cofre: chaves por ambiente", () => {
  it("lê a chave atual e a versão do ambiente", () => {
    const chave = randomBytes(32);
    const chaves = lerChavesDoCofre({
      COFRE_CHAVE: chave.toString("base64"),
      COFRE_CHAVE_VERSAO: "3",
    });
    expect(chaves.atual.versao).toBe(3);
    expect(chaves.atual.chave.equals(chave)).toBe(true);
    expect(chaves.anterior).toBeUndefined();
  });

  it("lança com chave de 31 bytes", () => {
    expect(() =>
      lerChavesDoCofre({ COFRE_CHAVE: randomBytes(31).toString("base64"), COFRE_CHAVE_VERSAO: "1" }),
    ).toThrow("COFRE_CHAVE precisa ter 32 bytes (base64).");
  });

  it("lança sem COFRE_CHAVE", () => {
    expect(() => lerChavesDoCofre({ COFRE_CHAVE_VERSAO: "1" })).toThrow(/COFRE_CHAVE/);
    expect(() => lerChavesDoCofre({ COFRE_CHAVE: "", COFRE_CHAVE_VERSAO: "1" })).toThrow(/COFRE_CHAVE/);
  });

  it("lança com versão inválida (0, negativa, fracionária, texto)", () => {
    const COFRE_CHAVE = randomBytes(32).toString("base64");
    for (const versao of ["0", "-1", "1.5", "abc", ""]) {
      expect(() => lerChavesDoCofre({ COFRE_CHAVE, COFRE_CHAVE_VERSAO: versao })).toThrow(/COFRE_CHAVE_VERSAO/);
    }
  });

  it("decifra uma linha da chave anterior e lança para versão desconhecida", () => {
    const antiga = randomBytes(32);
    const nova = randomBytes(32);
    const linhaAntiga = cifrar("tok-antigo", antiga, 1, dono);
    const chaves = lerChavesDoCofre({
      COFRE_CHAVE: nova.toString("base64"),
      COFRE_CHAVE_VERSAO: "2",
      COFRE_CHAVE_ANTERIOR: antiga.toString("base64"),
      COFRE_CHAVE_ANTERIOR_VERSAO: "1",
    });
    expect(decifrar(linhaAntiga, chaves, dono)).toBe("tok-antigo");
    expect(decifrar(cifrar("tok-novo", nova, 2, dono), chaves, dono)).toBe("tok-novo");

    const desconhecida = cifrar("tok-x", antiga, 7, dono);
    expect(() => decifrar(desconhecida, chaves, dono)).toThrow("A chave da versão 7 não está configurada.");
  });

  it("lança quando a chave anterior vem sem versão ou com tamanho errado", () => {
    const base = { COFRE_CHAVE: randomBytes(32).toString("base64"), COFRE_CHAVE_VERSAO: "2" };
    expect(() =>
      lerChavesDoCofre({ ...base, COFRE_CHAVE_ANTERIOR: randomBytes(32).toString("base64") }),
    ).toThrow(/COFRE_CHAVE_ANTERIOR_VERSAO/);
    expect(() =>
      lerChavesDoCofre({
        ...base,
        COFRE_CHAVE_ANTERIOR: randomBytes(8).toString("base64"),
        COFRE_CHAVE_ANTERIOR_VERSAO: "1",
      }),
    ).toThrow(/32 bytes/);
  });
});
