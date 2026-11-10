/**
 * O consentimento do Contato (3.2.4). O vigente é o registro mais recente (por
 * `em`) da finalidade para o tipo do Canal OU para `todos`; revogar é inserir
 * um registro `revogado`, nunca apagar. `recusaPorFaltaDeConsentimento` é a
 * conta de `marketingConsentMissing` (modelo antigo) sobre as linhas novas.
 */

import { describe, expect, it } from "vitest";
import {
  consentimentoVigente,
  recusaPorFaltaDeConsentimento,
  validarNovoConsentimento,
  type ConsentimentoDoContato,
} from "./consentimentos";

const MARKETING = "cat_fin_mkt";
const ATENDIMENTO = "cat_fin_atend";

let contador = 0;
function registro(extra: Partial<ConsentimentoDoContato>): ConsentimentoDoContato {
  contador += 1;
  return {
    id: `cc_${contador}`,
    contatoId: "c1",
    finalidadeId: MARKETING,
    tipoDeCanal: "whatsapp",
    decisao: "concedido",
    em: "2026-11-01T10:00:00.000Z",
    origem: "formulario",
    evidenciaMensagemId: null,
    registradoPor: "mem_ana",
    registradoEm: "2026-11-01T10:00:00.000Z",
    ...extra,
  };
}

describe("consentimentoVigente", () => {
  it("só um concedido para whatsapp: o vigente é ele", () => {
    const concedido = registro({ decisao: "concedido" });
    expect(consentimentoVigente([concedido], MARKETING, "whatsapp")).toBe(concedido);
  });

  it("um revogado posterior para whatsapp passa a ser o vigente", () => {
    const concedido = registro({ decisao: "concedido", em: "2026-11-01T10:00:00.000Z" });
    const revogado = registro({ decisao: "revogado", em: "2026-11-02T10:00:00.000Z" });
    expect(consentimentoVigente([concedido, revogado], MARKETING, "whatsapp")).toBe(revogado);
    expect(consentimentoVigente([revogado, concedido], MARKETING, "whatsapp")).toBe(revogado);
  });

  it("um concedido para todos vale para email; um revogado mais recente só de whatsapp não afeta email", () => {
    const paraTodos = registro({ tipoDeCanal: "todos", decisao: "concedido", em: "2026-11-01T10:00:00.000Z" });
    const revogadoWhats = registro({ tipoDeCanal: "whatsapp", decisao: "revogado", em: "2026-11-03T10:00:00.000Z" });
    expect(consentimentoVigente([paraTodos, revogadoWhats], MARKETING, "email")).toBe(paraTodos);
    expect(consentimentoVigente([paraTodos, revogadoWhats], MARKETING, "whatsapp")).toBe(revogadoWhats);
  });

  it("o concedido de outro tipo de Canal não vale", () => {
    expect(consentimentoVigente([registro({ tipoDeCanal: "instagram" })], MARKETING, "whatsapp")).toBeUndefined();
  });

  it("registro de outra finalidade é ignorado e lista vazia dá undefined", () => {
    expect(consentimentoVigente([registro({ finalidadeId: ATENDIMENTO })], MARKETING, "whatsapp")).toBeUndefined();
    expect(consentimentoVigente([], MARKETING, "whatsapp")).toBeUndefined();
  });

  it("no empate de `em`, vale o registrado depois", () => {
    const antes = registro({ decisao: "concedido", registradoEm: "2026-11-01T10:00:00.000Z" });
    const depois = registro({ decisao: "revogado", registradoEm: "2026-11-01T10:00:05.000Z" });
    expect(consentimentoVigente([depois, antes], MARKETING, "whatsapp")).toBe(depois);
  });
});

describe("recusaPorFaltaDeConsentimento", () => {
  const FRASE = "Este Contato não consentiu receber marketing por este Canal.";
  const concedido = registro({ decisao: "concedido" });
  const revogado = registro({ decisao: "revogado", em: "2026-11-02T10:00:00.000Z" });

  it.each([
    ["sem nenhum registro", [], FRASE],
    ["com concedido", [concedido], undefined],
    ["com revogado depois do concedido", [concedido, revogado], FRASE],
  ])("modelo de marketing, %s", (_rotulo, registros, esperado) => {
    expect(
      recusaPorFaltaDeConsentimento({
        categoriaDoModelo: "marketing",
        registros,
        finalidadeDeMarketingId: MARKETING,
        tipoDoCanal: "whatsapp",
      }),
    ).toBe(esperado);
  });

  it("modelo de marketing sem finalidade de marketing no Catálogo: não há como provar, recusa", () => {
    expect(
      recusaPorFaltaDeConsentimento({
        categoriaDoModelo: "marketing",
        registros: [concedido],
        finalidadeDeMarketingId: undefined,
        tipoDoCanal: "whatsapp",
      }),
    ).toBe(FRASE);
  });

  it.each([["utilidade"], ["autenticacao"], [undefined]])("a categoria %s não passa pela regra", (categoriaDoModelo) => {
    expect(
      recusaPorFaltaDeConsentimento({ categoriaDoModelo, registros: [], finalidadeDeMarketingId: MARKETING, tipoDoCanal: "whatsapp" }),
    ).toBeUndefined();
  });
});

describe("validarNovoConsentimento", () => {
  const AGORA = "2026-11-04T12:00:00.000Z";
  const base = { finalidadeId: MARKETING, tipoDeCanal: "whatsapp", decisao: "concedido", origem: "formulario" } as const;

  it("recusa `em` no futuro, no campo em", () => {
    const r = validarNovoConsentimento({ ...base, em: "2026-11-05T12:00:00.000Z" }, AGORA);
    expect(r).toMatchObject({ ok: false, field: "em" });
  });

  it("recusa `em` que não é um instante", () => {
    expect(validarNovoConsentimento({ ...base, em: "ontem" }, AGORA)).toMatchObject({ ok: false, field: "em" });
  });

  it("aceita `em` no passado, em agora e ausente", () => {
    expect(validarNovoConsentimento({ ...base, em: "2026-10-01T00:00:00.000Z" }, AGORA)).toMatchObject({ ok: true });
    expect(validarNovoConsentimento({ ...base, em: AGORA }, AGORA)).toMatchObject({ ok: true });
    expect(validarNovoConsentimento(base, AGORA)).toMatchObject({ ok: true });
  });

  it("recusa finalidade em branco, no campo finalidadeId", () => {
    expect(validarNovoConsentimento({ ...base, finalidadeId: "  " }, AGORA)).toMatchObject({ ok: false, field: "finalidadeId" });
  });

  it("recusa decisão, origem e tipo de Canal fora do vocabulário", () => {
    expect(validarNovoConsentimento({ ...base, decisao: "talvez" as never }, AGORA)).toMatchObject({ ok: false, field: "decisao" });
    expect(validarNovoConsentimento({ ...base, origem: "telepatia" as never }, AGORA)).toMatchObject({ ok: false, field: "origem" });
    expect(validarNovoConsentimento({ ...base, tipoDeCanal: "fax" as never }, AGORA)).toMatchObject({ ok: false, field: "tipoDeCanal" });
  });
});
