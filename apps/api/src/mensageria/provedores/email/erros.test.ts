/**
 * O erro de conexão vira frase de produto (17-03, D-17-07, T-17-09 e T-17-10). Os erros vêm de verdade do `imapflow` e do
 * `nodemailer` falando com os dublês de 17-02 (e com dois servidores mínimos deste arquivo: um mudo e um sem STARTTLS).
 * Nada aqui sai da máquina de teste.
 */

import { createServer, type Server, type Socket } from "node:net";
import { SMTPServer } from "smtp-server";
import { afterEach, describe, expect, it } from "vitest";
import { iniciarServidorDeEmailFalso, type ServidorDeEmailFalso } from "../../../testes/servidor-de-email-falso";
import type { AutenticacaoDoEmail } from "./credencial";
import { classificarErroDeConexao, FRASES_DE_CONEXAO, type FalhaDeConexao } from "./erros";
import { criarFabricaDeConexao, type FabricaDeConexao, type OpcoesDaFabrica } from "./fabrica-de-conexao";
import { RecusaDeRede, criarPoliticaDeRede, type SegurancaDaPorta, type TabelaDePortas } from "./rede";

const SENHA = "senha-certa";
const SENHA_ERRADA = "senha-errada-xk93";
const AUTH: AutenticacaoDoEmail = { tipo: "senha", usuario: "ana@caixa.teste", senha: SENHA };
const AUTH_ERRADA: AutenticacaoDoEmail = { tipo: "senha", usuario: "ana@caixa.teste", senha: SENHA_ERRADA };
const HOST_IMAP = "imap.caixa.teste";
const HOST_SMTP = "smtp.caixa.teste";
const TEMPOS_CURTOS: OpcoesDaFabrica["tempos"] = { teste: { conectarMs: 300, saudacaoMs: 300, socketMs: 300 } };

let servidor: ServidorDeEmailFalso | undefined;
const fechaveis: Array<{ close: (cb?: () => void) => unknown }> = [];
const sockets = new Set<Socket>();

afterEach(async () => {
  await servidor?.fechar();
  servidor = undefined;
  for (const s of sockets) s.destroy();
  sockets.clear();
  for (const f of fechaveis.splice(0)) await new Promise<void>((resolve) => void f.close(() => resolve()));
});

function fabrica(
  portas: TabelaDePortas,
  extras: { ca?: string; tempos?: OpcoesDaFabrica["tempos"] } = {},
): FabricaDeConexao {
  return criarFabricaDeConexao({
    resolver: async () => [{ address: "127.0.0.1", family: 4 }],
    politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
    portas,
    ...(extras.ca ? { ca: extras.ca } : {}),
    ...(extras.tempos ? { tempos: extras.tempos } : {}),
  });
}

async function capturar(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa;
  } catch (erro) {
    return erro;
  }
  throw new Error("a conexão deveria ter falhado");
}

async function subirServidorDeNet(aoConectar: (socket: Socket) => void): Promise<{ porta: number }> {
  const s: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => undefined);
    socket.on("close", () => sockets.delete(socket));
    aoConectar(socket);
  });
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  fechaveis.push(s);
  return { porta: (s.address() as { port: number }).port };
}

async function portaFechada(): Promise<number> {
  const s = createServer();
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  const porta = (s.address() as { port: number }).port;
  await new Promise<void>((resolve) => s.close(() => resolve()));
  return porta;
}

function tabela(imap?: [number, SegurancaDaPorta], smtp?: [number, SegurancaDaPorta]): TabelaDePortas {
  return {
    imap: imap ? { [imap[0]]: imap[1] } : {},
    smtp: smtp ? { [smtp[0]]: smtp[1] } : {},
  };
}

function semSegredos(falha: FalhaDeConexao): void {
  const serializada = JSON.stringify(falha);
  for (const segredo of [SENHA, SENHA_ERRADA]) {
    expect(serializada).not.toContain(segredo);
    expect(falha.frase).not.toContain(segredo);
  }
  // A frase é de produto: nem host, nem porta, nem IP.
  expect(falha.frase).not.toMatch(/127\.0\.0\.1|caixa\.teste|\d{4,5}/);
}

describe("login recusado", () => {
  it("IMAP: frase fixa, texto do servidor à parte, sem a senha", async () => {
    servidor = await iniciarServidorDeEmailFalso();
    const f = fabrica(tabela([servidor.imap.porta, "tls"]), { ca: servidor.ca });

    const erro = await capturar(f.verificarImap({ host: HOST_IMAP, porta: servidor.imap.porta, auth: AUTH_ERRADA }));
    const falha = classificarErroDeConexao(erro, "imap", [SENHA_ERRADA]);

    expect(falha).toMatchObject({
      tipo: "recusou_login",
      servico: "imap",
      frase: "O servidor IMAP recusou o usuário ou a senha.",
      permanente: true,
    });
    expect(falha.fraseDoServidor).toBeTruthy();
    expect(falha.fraseDoServidor!.length).toBeLessThanOrEqual(300);
    expect(falha.fraseDoServidor).not.toMatch(/[\r\n]/);
    semSegredos(falha);
  });

  it("SMTP: frase fixa do SMTP e o texto do servidor à parte", async () => {
    servidor = await iniciarServidorDeEmailFalso();
    const f = fabrica(tabela(undefined, [servidor.smtp.porta, "tls"]), { ca: servidor.ca });

    const erro = await capturar(f.verificarSmtp({ host: HOST_SMTP, porta: servidor.smtp.porta, auth: AUTH_ERRADA }));
    const falha = classificarErroDeConexao(erro, "smtp", [SENHA_ERRADA]);

    expect(falha).toMatchObject({
      tipo: "recusou_login",
      servico: "smtp",
      frase: "O servidor SMTP recusou o usuário ou a senha.",
      permanente: true,
    });
    expect(falha.fraseDoServidor).toBeTruthy();
    semSegredos(falha);
  });

  it("o filtro tira o desafio XOAUTH2, o token e a senha da frase do servidor", () => {
    const erro = Object.assign(new Error("Command failed"), {
      authenticationFailed: true,
      responseText:
        "AUTHENTICATE failed. user=ana@caixa.teste\u0001auth=Bearer ya29.a0AbCdEfGhIjKlMnOpQrStUvWxYz0123456789\u0001\u0001\r\n e a senha hunter2xyz foi vista",
    });
    const falha = classificarErroDeConexao(erro, "imap", ["hunter2xyz"]);

    expect(falha.tipo).toBe("recusou_login");
    expect(falha.fraseDoServidor).toBeDefined();
    for (const proibido of ["user=", "auth=", "Bearer", "ya29", "hunter2xyz", "\r", "\n", "\u0001"]) {
      expect(falha.fraseDoServidor).not.toContain(proibido);
    }
    expect(falha.fraseDoServidor).toContain("AUTHENTICATE failed");
  });

  it("a frase do servidor passa de 300 caracteres e é cortada; vazia some", () => {
    const longa = classificarErroDeConexao(
      Object.assign(new Error("x"), { authenticationFailed: true, responseText: "recusado ".repeat(100) }),
      "imap",
    );
    expect(longa.fraseDoServidor!.length).toBe(300);

    const vazia = classificarErroDeConexao(Object.assign(new Error("x"), { code: "EAUTH", response: "  \r\n " }), "smtp");
    expect(vazia.tipo).toBe("recusou_login");
    expect(vazia).not.toHaveProperty("fraseDoServidor");
  });
});

describe("certificado", () => {
  it("sem a CA do dublê o certificado é inválido, e o texto do servidor não é repetido (IMAP e SMTP)", async () => {
    servidor = await iniciarServidorDeEmailFalso();
    const f = fabrica(tabela([servidor.imap.porta, "tls"], [servidor.smtp.porta, "tls"]));

    const erroImap = await capturar(f.verificarImap({ host: HOST_IMAP, porta: servidor.imap.porta, auth: AUTH }));
    const imap = classificarErroDeConexao(erroImap, "imap", [SENHA]);
    expect(imap).toMatchObject({
      tipo: "certificado",
      servico: "imap",
      frase: "O certificado do servidor IMAP não é válido.",
      permanente: true,
    });
    expect(imap).not.toHaveProperty("fraseDoServidor");
    semSegredos(imap);

    const erroSmtp = await capturar(f.verificarSmtp({ host: HOST_SMTP, porta: servidor.smtp.porta, auth: AUTH }));
    const smtp = classificarErroDeConexao(erroSmtp, "smtp", [SENHA]);
    expect(smtp).toMatchObject({ tipo: "certificado", servico: "smtp", permanente: true });
    expect(smtp).not.toHaveProperty("fraseDoServidor");
    semSegredos(smtp);
  });

  it("o nome do certificado que não confere com o host digitado também é certificado", async () => {
    servidor = await iniciarServidorDeEmailFalso();
    const f = fabrica(tabela([servidor.imap.porta, "tls"]), { ca: servidor.ca });

    const erro = await capturar(f.verificarImap({ host: "outro.exemplo.teste", porta: servidor.imap.porta, auth: AUTH }));
    expect(classificarErroDeConexao(erro, "imap")).toMatchObject({ tipo: "certificado", permanente: true });
  });
});

describe("tempo e conexão", () => {
  it("servidor que aceita e nunca saúda, com tempos de 300 ms, é tempo esgotado", async () => {
    const mudo = await subirServidorDeNet(() => undefined);
    const f = fabrica(tabela([mudo.porta, "tls"], [mudo.porta, "tls"]), { tempos: TEMPOS_CURTOS });

    const imap = classificarErroDeConexao(
      await capturar(f.verificarImap({ host: HOST_IMAP, porta: mudo.porta, auth: AUTH })),
      "imap",
    );
    expect(imap).toMatchObject({ tipo: "tempo", frase: "O servidor IMAP não respondeu a tempo.", permanente: false });
    semSegredos(imap);

    const smtp = classificarErroDeConexao(
      await capturar(f.verificarSmtp({ host: HOST_SMTP, porta: mudo.porta, auth: AUTH })),
      "smtp",
    );
    expect(smtp).toMatchObject({ tipo: "tempo", frase: "O servidor SMTP não respondeu a tempo.", permanente: false });
  });

  it("porta fechada em 127.0.0.1 é não conectou, sem host, porta nem texto do sistema na frase", async () => {
    const porta = await portaFechada();
    const f = fabrica(tabela([porta, "tls"], [porta, "tls"]));

    const imap = classificarErroDeConexao(
      await capturar(f.verificarImap({ host: HOST_IMAP, porta, auth: AUTH })),
      "imap",
    );
    expect(imap).toMatchObject({
      tipo: "nao_conectou",
      frase: "Não foi possível conectar ao servidor IMAP.",
      permanente: false,
    });
    expect(imap).not.toHaveProperty("fraseDoServidor");
    semSegredos(imap);

    const smtp = classificarErroDeConexao(
      await capturar(f.verificarSmtp({ host: HOST_SMTP, porta, auth: AUTH })),
      "smtp",
    );
    expect(smtp).toMatchObject({ tipo: "nao_conectou", frase: "Não foi possível conectar ao servidor SMTP." });
    semSegredos(smtp);
  });
});

describe("a guarda de rede", () => {
  it("rede interna e porta fora da lista viram rede_recusada com a frase de produto, pela fábrica de produção", async () => {
    // A política de produção, sem injeção: 127.0.0.1 é IP literal, então nenhuma consulta de DNS acontece.
    const producao = criarFabricaDeConexao();

    const interna = classificarErroDeConexao(
      await capturar(producao.verificarImap({ host: "127.0.0.1", porta: 993, auth: AUTH })),
      "imap",
    );
    expect(interna).toMatchObject({
      tipo: "rede_recusada",
      frase: "Este servidor não é permitido: use o endereço público do seu provedor de e-mail.",
      permanente: true,
    });
    semSegredos(interna);

    const porta = classificarErroDeConexao(
      await capturar(producao.verificarSmtp({ host: "93.184.216.34", porta: 25, auth: AUTH })),
      "smtp",
    );
    expect(porta).toMatchObject({
      tipo: "rede_recusada",
      frase: "Use a porta 993 ou 143 para o IMAP e 465 ou 587 para o SMTP.",
      permanente: true,
    });
  });

  it("os motivos que sobram da recusa", () => {
    expect(classificarErroDeConexao(new RecusaDeRede("host_invalido", "imap"), "imap")).toMatchObject({
      tipo: "rede_recusada",
      frase: FRASES_DE_CONEXAO.host_invalido,
    });
    expect(classificarErroDeConexao(new RecusaDeRede("sem_endereco", "smtp"), "smtp")).toMatchObject({
      tipo: "nao_conectou",
      frase: "Não foi possível conectar ao servidor SMTP.",
      permanente: false,
    });
  });
});

describe("protocolo", () => {
  it("SMTP 587 num servidor sem STARTTLS: protocolo, e a conexão não cai em texto puro", async () => {
    const semStarttls = new SMTPServer({
      secure: false,
      disabledCommands: ["STARTTLS"],
      authOptional: true,
      logger: false,
    });
    await new Promise<void>((resolve) => semStarttls.listen(0, "127.0.0.1", resolve));
    fechaveis.push(semStarttls);
    const porta = (semStarttls.server.address() as { port: number }).port;

    const f = fabrica(tabela(undefined, [porta, "starttls"]), { tempos: { teste: { conectarMs: 3000, saudacaoMs: 3000, socketMs: 3000 } } });
    const falha = classificarErroDeConexao(
      await capturar(f.verificarSmtp({ host: HOST_SMTP, porta, auth: AUTH })),
      "smtp",
      [SENHA],
    );

    expect(falha).toMatchObject({ tipo: "protocolo", servico: "smtp", permanente: true });
    expect(falha).not.toHaveProperty("fraseDoServidor");
    semSegredos(falha);
  });

  it("IMAP 143 num servidor sem STARTTLS: protocolo, e a senha nunca é enviada", async () => {
    const recebido: string[] = [];
    const semStarttls = await subirServidorDeNet((socket) => {
      socket.write("* OK [CAPABILITY IMAP4rev1 AUTH=PLAIN] pronto\r\n");
      socket.on("data", (dado) => {
        const linha = dado.toString("utf8");
        recebido.push(linha);
        const etiqueta = /^(\S+) /.exec(linha)?.[1] ?? "*";
        if (/CAPABILITY/i.test(linha)) {
          socket.write(`* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n${etiqueta} OK feito\r\n`);
        }
      });
    });

    const f = fabrica(tabela([semStarttls.porta, "starttls"]), {
      tempos: { teste: { conectarMs: 3000, saudacaoMs: 3000, socketMs: 3000 } },
    });
    const falha = classificarErroDeConexao(
      await capturar(f.verificarImap({ host: HOST_IMAP, porta: semStarttls.porta, auth: AUTH })),
      "imap",
      [SENHA],
    );

    expect(falha).toMatchObject({ tipo: "protocolo", servico: "imap", permanente: true });
    expect(falha).not.toHaveProperty("fraseDoServidor");
    semSegredos(falha);
    // Nada de LOGIN nem AUTHENTICATE: a senha não saiu em texto puro.
    expect(recebido.join("")).not.toMatch(/LOGIN|AUTHENTICATE/i);
    expect(recebido.join("")).not.toContain(SENHA);
  });

  it("um erro que nada explica é protocolo, e um valor que nem é erro também", () => {
    expect(classificarErroDeConexao(new Error("algo"), "imap")).toMatchObject({ tipo: "protocolo", permanente: true });
    expect(classificarErroDeConexao("texto solto", "smtp")).toMatchObject({ tipo: "protocolo" });
    expect(classificarErroDeConexao(undefined, "smtp")).toMatchObject({ tipo: "protocolo" });
  });

  it("os códigos de rede e de tempo do Node e das bibliotecas", () => {
    for (const code of ["ECONNREFUSED", "ENOTFOUND", "ECONNECTION", "ESOCKET", "EDNS"]) {
      expect(classificarErroDeConexao(Object.assign(new Error("x"), { code }), "imap").tipo, code).toBe("nao_conectou");
    }
    for (const code of ["CONNECT_TIMEOUT", "GREETING_TIMEOUT", "ETIMEDOUT"]) {
      expect(classificarErroDeConexao(Object.assign(new Error("x"), { code }), "smtp").tipo, code).toBe("tempo");
    }
    for (const code of [
      "CERT_HAS_EXPIRED",
      "ERR_TLS_CERT_ALTNAME_INVALID",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "ETLS",
    ]) {
      expect(classificarErroDeConexao(Object.assign(new Error("x"), { code }), "imap").tipo, code).toBe("certificado");
    }
  });
});
