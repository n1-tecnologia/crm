/**
 * O agregado do Início no CRM novo (15-18, UCR-07): os limites e a conferência da janela
 * das estatísticas, que a rota e o serviço aplicam igual.
 */

import { describe, expect, it } from "vitest";
import {
  conferirJanelaDeEstatisticas,
  CONTATOS_RECENTES_DO_PANORAMA,
  fusoValido,
  JANELA_MAXIMA_DE_ESTATISTICAS_DIAS,
  LIMITE_DE_LEADS,
  QUALIFICACOES_MAXIMAS,
} from "./inicio";

const ATE = "2027-04-05T00:00:00Z";
const diasAntes = (dias: number) => new Date(Date.parse(ATE) - dias * 86_400_000).toISOString();

describe("limites do Início", () => {
  it("o panorama cita 5 Contatos, os Leads têm teto de 50, a janela é de 400 dias e a rota aceita 20 Qualificações", () => {
    expect(CONTATOS_RECENTES_DO_PANORAMA).toBe(5);
    expect(LIMITE_DE_LEADS).toBe(50);
    expect(JANELA_MAXIMA_DE_ESTATISTICAS_DIAS).toBe(400);
    expect(QUALIFICACOES_MAXIMAS).toBe(20);
  });
});

describe("fusoValido", () => {
  it("aceita nomes IANA e UTC", () => {
    expect(fusoValido("America/Sao_Paulo")).toBe(true);
    expect(fusoValido("Europe/Lisbon")).toBe(true);
    expect(fusoValido("UTC")).toBe(true);
  });

  it.each(["Marte/Base", "", "sao paulo", "America/Sao_Paulo; drop table x", "+03:00", "EST5EDT'--"])("recusa %j", (fuso) => {
    expect(fusoValido(fuso)).toBe(false);
  });
});

describe("conferirJanelaDeEstatisticas", () => {
  it("aceita a janela de 400 dias exatos e a de um instante só", () => {
    expect(conferirJanelaDeEstatisticas(diasAntes(JANELA_MAXIMA_DE_ESTATISTICAS_DIAS), ATE, "UTC")).toEqual({ ok: true });
    expect(conferirJanelaDeEstatisticas(ATE, ATE, "UTC")).toEqual({ ok: true });
  });

  it("recusa 401 dias, no campo desde", () => {
    const conferida = conferirJanelaDeEstatisticas(diasAntes(JANELA_MAXIMA_DE_ESTATISTICAS_DIAS + 1), ATE, "UTC");
    expect(conferida).toMatchObject({ ok: false, field: "desde" });
  });

  it("recusa desde depois de ate", () => {
    expect(conferirJanelaDeEstatisticas(ATE, diasAntes(1), "UTC")).toMatchObject({ ok: false, field: "desde" });
  });

  it("recusa instante que não existe, apontando o campo", () => {
    expect(conferirJanelaDeEstatisticas("ontem", ATE, "UTC")).toMatchObject({ ok: false, field: "desde" });
    expect(conferirJanelaDeEstatisticas(diasAntes(1), "amanhã", "UTC")).toMatchObject({ ok: false, field: "ate" });
  });

  it("recusa fuso desconhecido, no campo fuso", () => {
    expect(conferirJanelaDeEstatisticas(diasAntes(1), ATE, "Marte/Base")).toMatchObject({ ok: false, field: "fuso" });
  });
});
