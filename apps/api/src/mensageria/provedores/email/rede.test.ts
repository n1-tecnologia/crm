/**
 * A guarda de rede de produção (17-03, D-17-07, EML-06, T-17-06 e T-17-07): recusa a rede interna, as portas fora da
 * lista e o rebinding. Roda sem rede: só resolvedores falsos, nunca consulta de DNS nem conexão.
 */

import { describe, expect, it, vi } from "vitest";
import {
  POLITICA_DE_PRODUCAO,
  PORTAS_DO_EMAIL,
  conferirDestino,
  criarPoliticaDeRede,
  type Resolvedor,
} from "./rede";

function resolvedorQueDevolve(...enderecos: string[]) {
  return vi.fn<Resolvedor>(async () =>
    enderecos.map((address) => ({ address, family: address.includes(":") ? (6 as const) : (4 as const) })),
  );
}

const PUBLICO = "93.184.216.34";

describe("a guarda de rede de produção", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "198.18.0.1",
    "224.0.0.1",
    "168.63.129.16",
    "::1",
    "::",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "fe80::1",
    "fc00::1",
    "fd00:ec2::254",
    "64:ff9b::7f00:1",
    "2002:7f00:1::1",
    "2001:db8::1",
  ])("recusa o endereço %s que o DNS devolve", async (endereco) => {
    const resolver = resolvedorQueDevolve(endereco);
    const r = await conferirDestino(
      { host: "imap.exemplo.com", porta: 993, servico: "imap" },
      { resolver, politica: POLITICA_DE_PRODUCAO },
    );
    expect(r).toEqual({ ok: false, motivo: "rede_interna" });
  });

  it("recusa o host que resolve para um IP público E um privado (qualquer endereço proibido recusa)", async () => {
    const r = await conferirDestino(
      { host: "imap.exemplo.com", porta: 993, servico: "imap" },
      { resolver: resolvedorQueDevolve(PUBLICO, "10.0.0.7") },
    );
    expect(r).toEqual({ ok: false, motivo: "rede_interna" });

    const invertido = await conferirDestino(
      { host: "imap.exemplo.com", porta: 993, servico: "imap" },
      { resolver: resolvedorQueDevolve("10.0.0.7", PUBLICO) },
    );
    expect(invertido).toEqual({ ok: false, motivo: "rede_interna" });
  });

  it("aceita o host que resolve só para endereço público, e conecta a esse IP", async () => {
    const r = await conferirDestino(
      { host: "IMAP.Exemplo.com.", porta: 993, servico: "imap" },
      { resolver: resolvedorQueDevolve(PUBLICO, "2606:2800:220:1:248:1893:25c8:1946") },
    );
    expect(r).toEqual({
      ok: true,
      destino: { host: "imap.exemplo.com", ip: PUBLICO, porta: 993, seguranca: "tls" },
    });
  });

  it("nome com acento vira punycode e é o que se resolve", async () => {
    const resolver = resolvedorQueDevolve(PUBLICO);
    const r = await conferirDestino({ host: "correio.café.com", porta: 993, servico: "imap" }, { resolver });
    expect(r).toMatchObject({ ok: true, destino: { host: "correio.xn--caf-dma.com" } });
    expect(resolver).toHaveBeenCalledWith("correio.xn--caf-dma.com");
  });

  it("IP literal no host: o privado é recusado sem chamar o resolvedor; o público passa", async () => {
    const resolver = resolvedorQueDevolve(PUBLICO);
    const recusado = await conferirDestino({ host: "10.0.0.5", porta: 993, servico: "imap" }, { resolver });
    expect(recusado).toEqual({ ok: false, motivo: "rede_interna" });
    const v6 = await conferirDestino({ host: "[::1]", porta: 465, servico: "smtp" }, { resolver });
    expect(v6).toEqual({ ok: false, motivo: "rede_interna" });
    const mapeado = await conferirDestino({ host: "::ffff:127.0.0.1", porta: 465, servico: "smtp" }, { resolver });
    expect(mapeado).toEqual({ ok: false, motivo: "rede_interna" });

    const aceito = await conferirDestino({ host: PUBLICO, porta: 993, servico: "imap" }, { resolver });
    expect(aceito).toEqual({ ok: true, destino: { host: PUBLICO, ip: PUBLICO, porta: 993, seguranca: "tls" } });
    expect(resolver).not.toHaveBeenCalled();
  });

  it.each(["a@b", "x y", "a/b", "", "   ", "a".repeat(254), "exemplo..com", "-", "127.1", "0x7f.1", "2130706433", "fe80::1%eth0"])(
    "o host %j é inválido e nenhuma consulta é feita",
    async (host) => {
      const resolver = resolvedorQueDevolve(PUBLICO);
      const r = await conferirDestino({ host, porta: 993, servico: "imap" }, { resolver });
      expect(r).toEqual({ ok: false, motivo: "host_invalido" });
      expect(resolver).not.toHaveBeenCalled();
    },
  );

  it("o resolvedor sem endereço, ou que falha, dá sem_endereco", async () => {
    const vazio = await conferirDestino(
      { host: "imap.exemplo.com", porta: 993, servico: "imap" },
      { resolver: resolvedorQueDevolve() },
    );
    expect(vazio).toEqual({ ok: false, motivo: "sem_endereco" });

    const falha = await conferirDestino(
      { host: "imap.exemplo.com", porta: 993, servico: "imap" },
      {
        resolver: async () => {
          throw Object.assign(new Error("getaddrinfo ENOTFOUND imap.exemplo.com"), { code: "ENOTFOUND" });
        },
      },
    );
    expect(falha).toEqual({ ok: false, motivo: "sem_endereco" });
  });

  it("as portas: só 993 e 143 no IMAP, só 465 e 587 no SMTP, e cada uma com a sua segurança", async () => {
    const resolver = resolvedorQueDevolve(PUBLICO);
    for (const porta of [25, 110, 8080, 465, 0, 65536, -1, 993.5]) {
      const r = await conferirDestino({ host: "imap.exemplo.com", porta, servico: "imap" }, { resolver });
      expect(r, `IMAP ${porta}`).toEqual({ ok: false, motivo: "porta" });
    }
    for (const porta of [993, 25, 143, 8025]) {
      const r = await conferirDestino({ host: "smtp.exemplo.com", porta, servico: "smtp" }, { resolver });
      expect(r, `SMTP ${porta}`).toEqual({ ok: false, motivo: "porta" });
    }
    // Recusar a porta vem antes de resolver o host.
    expect(resolver).not.toHaveBeenCalled();

    const imap143 = await conferirDestino({ host: "imap.exemplo.com", porta: 143, servico: "imap" }, { resolver });
    expect(imap143).toMatchObject({ ok: true, destino: { seguranca: "starttls" } });
    const smtp587 = await conferirDestino({ host: "smtp.exemplo.com", porta: 587, servico: "smtp" }, { resolver });
    expect(smtp587).toMatchObject({ ok: true, destino: { seguranca: "starttls" } });
    const smtp465 = await conferirDestino({ host: "smtp.exemplo.com", porta: 465, servico: "smtp" }, { resolver });
    expect(smtp465).toMatchObject({ ok: true, destino: { seguranca: "tls" } });
  });

  it("a tabela de produção tem exatamente as quatro portas e nenhuma em texto puro", () => {
    expect(PORTAS_DO_EMAIL).toEqual({ imap: { 993: "tls", 143: "starttls" }, smtp: { 465: "tls", 587: "starttls" } });
  });

  it("rebinding: o resolvedor que muda na 2ª resposta é chamado uma só vez por conferência", async () => {
    let chamadas = 0;
    const resolver = vi.fn<Resolvedor>(async () => {
      chamadas += 1;
      return [{ address: chamadas === 1 ? PUBLICO : "127.0.0.1", family: 4 }];
    });
    const r = await conferirDestino({ host: "imap.exemplo.com", porta: 993, servico: "imap" }, { resolver });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: true, destino: { ip: PUBLICO } });
  });

  it("criarPoliticaDeRede libera só os IPs exatos dados, e o resto segue a produção", async () => {
    const politica = criarPoliticaDeRede({ permitir: ["127.0.0.1"] });
    expect(politica.proibido("127.0.0.1", 4)).toBe(false);
    expect(politica.proibido("127.0.0.2", 4)).toBe(true);
    expect(politica.proibido("10.0.0.1", 4)).toBe(true);
    expect(politica.proibido(PUBLICO, 4)).toBe(false);
    expect(POLITICA_DE_PRODUCAO.proibido("127.0.0.1", 4)).toBe(true);
    expect(criarPoliticaDeRede().proibido("127.0.0.1", 4)).toBe(true);
  });
});
