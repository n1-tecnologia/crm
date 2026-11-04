/**
 * A regra da mesclagem de Contatos do modelo novo (3.2.2): quem pode ser
 * mesclado com quem (RN-CON-14) e qual Conversa fica quando as duas estão
 * abertas no mesmo Canal (RN-CXE-10).
 */

import { describe, expect, it } from "vitest";
import { conversasQueResolvemNaColisao, validarMesclagem } from "./mesclagem";

describe("validarMesclagem (RN-CON-14)", () => {
  it("recusa o mesmo Contato dos dois lados", () => {
    expect(validarMesclagem({ id: "a", estado: "ativo" }, { id: "a", estado: "ativo" })).toEqual({
      ok: false,
      error: "Escolha dois Contatos diferentes.",
      field: "absorvidoId",
    });
  });

  it.each(["na_lixeira", "mesclado"] as const)("recusa o sobrevivente %s", (estado) => {
    const r = validarMesclagem({ id: "a", estado }, { id: "b", estado: "ativo" });
    expect(r).toEqual({ ok: false, error: "Só é possível mesclar Contatos ativos ou arquivados.", field: "sobreviventeId" });
  });

  it.each(["na_lixeira", "mesclado"] as const)("recusa o absorvido %s", (estado) => {
    const r = validarMesclagem({ id: "a", estado: "ativo" }, { id: "b", estado });
    expect(r).toEqual({ ok: false, error: "Só é possível mesclar Contatos ativos ou arquivados.", field: "absorvidoId" });
  });

  it("o sobrevivente arquivado volta a ativo se o absorvido era ativo", () => {
    const r = validarMesclagem({ id: "a", estado: "arquivado" }, { id: "b", estado: "ativo" });
    expect(r).toEqual({ ok: true, value: { estadoDoSobrevivente: "ativo" } });
  });

  it("o sobrevivente fica como está nos outros três pares", () => {
    expect(validarMesclagem({ id: "a", estado: "ativo" }, { id: "b", estado: "arquivado" })).toEqual({
      ok: true,
      value: { estadoDoSobrevivente: "ativo" },
    });
    expect(validarMesclagem({ id: "a", estado: "ativo" }, { id: "b", estado: "ativo" })).toEqual({
      ok: true,
      value: { estadoDoSobrevivente: "ativo" },
    });
    expect(validarMesclagem({ id: "a", estado: "arquivado" }, { id: "b", estado: "arquivado" })).toEqual({
      ok: true,
      value: { estadoDoSobrevivente: "arquivado" },
    });
  });
});

describe("conversasQueResolvemNaColisao (RN-CXE-10)", () => {
  it("com três Conversas, resolve as duas de Mensagem mais antiga", () => {
    const resolvem = conversasQueResolvemNaColisao([
      { id: "c1", ultimaMensagemEm: "2026-01-01T10:00:00.000Z", criadoEm: "2026-01-01T09:00:00.000Z" },
      { id: "c2", ultimaMensagemEm: "2026-03-01T10:00:00.000Z", criadoEm: "2026-01-02T09:00:00.000Z" },
      { id: "c3", ultimaMensagemEm: "2026-02-01T10:00:00.000Z", criadoEm: "2026-01-03T09:00:00.000Z" },
    ]);
    expect([...resolvem].sort()).toEqual(["c1", "c3"]);
  });

  it("sem Mensagem vale o criadoEm", () => {
    const resolvem = conversasQueResolvemNaColisao([
      { id: "c1", ultimaMensagemEm: null, criadoEm: "2026-05-01T09:00:00.000Z" },
      { id: "c2", ultimaMensagemEm: null, criadoEm: "2026-04-01T09:00:00.000Z" },
    ]);
    expect(resolvem).toEqual(["c2"]);
  });

  it("uma Conversa sem Mensagem compete pelo criadoEm com a Mensagem das outras", () => {
    const resolvem = conversasQueResolvemNaColisao([
      { id: "c1", ultimaMensagemEm: "2026-01-01T10:00:00.000Z", criadoEm: "2025-12-01T09:00:00.000Z" },
      { id: "c2", ultimaMensagemEm: null, criadoEm: "2026-02-01T09:00:00.000Z" },
    ]);
    expect(resolvem).toEqual(["c1"]);
  });

  it("uma Conversa só, ou nenhuma, não resolve nada", () => {
    expect(conversasQueResolvemNaColisao([])).toEqual([]);
    expect(conversasQueResolvemNaColisao([{ id: "c1", ultimaMensagemEm: null, criadoEm: "2026-01-01T00:00:00.000Z" }])).toEqual([]);
  });

  it("o empate é decidido pelo id, sempre do mesmo jeito", () => {
    const empatadas = [
      { id: "c2", ultimaMensagemEm: "2026-01-01T10:00:00.000Z", criadoEm: "2026-01-01T09:00:00.000Z" },
      { id: "c1", ultimaMensagemEm: "2026-01-01T10:00:00.000Z", criadoEm: "2026-01-01T09:00:00.000Z" },
    ];
    expect(conversasQueResolvemNaColisao(empatadas)).toEqual(conversasQueResolvemNaColisao([...empatadas].reverse()));
    expect(conversasQueResolvemNaColisao(empatadas)).toHaveLength(1);
  });
});
