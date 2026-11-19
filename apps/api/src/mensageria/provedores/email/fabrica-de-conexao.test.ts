/**
 * O traçador do 17-03: a fábrica confere o destino e abre IMAP e SMTP de verdade no IP conferido, com o nome original no
 * certificado. Os clientes (`imapflow`, `nodemailer`) conversam com os dublês de `17-02` por TLS; o resolvedor é falso e a
 * política libera só `127.0.0.1`. Nada aqui consulta DNS nem fala com servidor de e-mail de verdade.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  iniciarServidorDeEmailFalso,
  PASTA_DE_ENVIADOS_FALSA,
  type ServidorDeEmailFalso,
} from "../../../testes/servidor-de-email-falso";
import { criarFabricaDeConexao } from "./fabrica-de-conexao";
import { RecusaDeRede, criarPoliticaDeRede, type Resolvedor, type TabelaDePortas } from "./rede";
import type { AutenticacaoDoEmail } from "./credencial";

const AUTH: AutenticacaoDoEmail = { tipo: "senha", usuario: "ana@caixa.teste", senha: "senha-certa" };
const HOST_IMAP = "imap.caixa.teste";
const HOST_SMTP = "smtp.caixa.teste";

let servidor: ServidorDeEmailFalso | undefined;

afterEach(async () => {
  await servidor?.fechar();
  servidor = undefined;
});

async function preparar() {
  servidor = await iniciarServidorDeEmailFalso();
  const resolver = vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]);
  const portas: TabelaDePortas = {
    imap: { [servidor.imap.porta]: "tls" },
    smtp: { [servidor.smtp.porta]: "tls" },
  };
  const fabrica = criarFabricaDeConexao({
    resolver,
    politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
    portas,
    ca: servidor.ca,
  });
  return { fabrica, resolver, servidor, portas };
}

describe("fábrica de conexão: o traçador", () => {
  it("verificarImap devolve uidNext e uidValidity em texto e a pasta \\Sent; o dublê vê o SNI do nome original", async () => {
    const { fabrica, servidor: f } = await preparar();

    const lido = await fabrica.verificarImap({ host: HOST_IMAP, porta: f.imap.porta, auth: AUTH });

    expect(typeof lido.uidValidity).toBe("string");
    expect(lido.uidValidity).toMatch(/^[0-9]+$/);
    expect(Number.isInteger(lido.uidNext)).toBe(true);
    expect(lido.uidNext).toBeGreaterThanOrEqual(1);
    expect(lido.pastaEnviados).toBe(PASTA_DE_ENVIADOS_FALSA);

    // O certificado foi conferido pelo nome que a pessoa digitou, não pelo IP ao qual a conexão foi feita.
    const conexoes = f.conexoesImap();
    expect(conexoes.length).toBeGreaterThanOrEqual(1);
    expect(conexoes[0]!.remoto.startsWith("127.0.0.1:")).toBe(true);
    expect(conexoes[0]!.sni).toBe(HOST_IMAP);
  });

  it("verificarSmtp resolve e o dublê vê o SNI smtp.caixa.teste", async () => {
    const { fabrica, servidor: f } = await preparar();

    await expect(fabrica.verificarSmtp({ host: HOST_SMTP, porta: f.smtp.porta, auth: AUTH })).resolves.toBeUndefined();

    const conexoes = f.conexoesSmtp();
    expect(conexoes.length).toBeGreaterThanOrEqual(1);
    expect(conexoes[0]!.remoto.startsWith("127.0.0.1:")).toBe(true);
    expect(conexoes[0]!.sni).toBe(HOST_SMTP);
  });

  it("o resolvedor é chamado UMA vez por abertura, e as bibliotecas recebem o IP literal no host", async () => {
    const { fabrica, resolver, servidor: f } = await preparar();

    const cliente = await fabrica.abrirImap({ host: HOST_IMAP, porta: f.imap.porta, auth: AUTH, uso: "teste" });
    try {
      expect(resolver).toHaveBeenCalledTimes(1);
      expect(resolver).toHaveBeenCalledWith(HOST_IMAP);
      expect(cliente.usable).toBe(true);
      // O `host` do cliente é o IP conferido; o nome original só serve de `servername`.
      expect((cliente as unknown as { host: string }).host).toBe("127.0.0.1");
      expect((cliente as unknown as { servername: string }).servername).toBe(HOST_IMAP);
    } finally {
      await cliente.logout();
    }

    const transporte = await fabrica.abrirSmtp({ host: HOST_SMTP, porta: f.smtp.porta, auth: AUTH, uso: "teste" });
    try {
      expect(resolver).toHaveBeenCalledTimes(2);
      const opcoes = (transporte as unknown as { options: { host: string; servername: string } }).options;
      expect(opcoes.host).toBe("127.0.0.1");
      expect(opcoes.servername).toBe(HOST_SMTP);
    } finally {
      transporte.close();
    }
  });

  it("recusa antes de conectar: porta fora da tabela vira RecusaDeRede e o dublê não vê conexão", async () => {
    const { fabrica, resolver, servidor: f } = await preparar();

    await expect(fabrica.verificarImap({ host: HOST_IMAP, porta: 25, auth: AUTH })).rejects.toBeInstanceOf(RecusaDeRede);
    await expect(fabrica.verificarSmtp({ host: HOST_SMTP, porta: 8080, auth: AUTH })).rejects.toMatchObject({
      motivo: "porta",
      servico: "smtp",
    });
    expect(resolver).not.toHaveBeenCalled();
    expect(f.conexoesImap()).toHaveLength(0);
    expect(f.conexoesSmtp()).toHaveLength(0);
  });

  it("sem a CA do dublê o certificado não é aceito (a verificação não tem botão)", async () => {
    const { servidor: f, portas } = await preparar();
    const semCa = criarFabricaDeConexao({
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
      politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
      portas,
    });

    await expect(semCa.verificarImap({ host: HOST_IMAP, porta: f.imap.porta, auth: AUTH })).rejects.toThrow();
  });
});
