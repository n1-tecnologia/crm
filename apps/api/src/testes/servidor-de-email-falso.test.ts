/**
 * O spike do `imapkit` (17-02, pressuposto A1) e a prova de que os dublês servem de caixa de e-mail para os planos da
 * Fase 17: os clientes de verdade (`imapflow`, `nodemailer`) conversam com eles por TLS, com a CA de teste injetada.
 * Nada aqui fala com servidor de e-mail, Google ou Microsoft de verdade.
 */

import { X509Certificate } from "node:crypto";
import { ImapFlow } from "imapflow";
import { afterEach, describe, expect, it } from "vitest";
import { gerarCertificadoDeTeste } from "./certificado-de-teste";
import { iniciarServidorDeEmailFalso, type ServidorDeEmailFalso } from "./servidor-de-email-falso";

const USUARIO = "ana@caixa.teste";
const SENHA = "senha-certa";
const TOKEN = "token-certo";

const MIME = [
  "From: Bia <bia@origem.teste>",
  "To: Ana <ana@caixa.teste>",
  "Subject: Ola do dublê",
  "Message-ID: <um@origem.teste>",
  "Date: Thu, 19 Nov 2026 10:00:00 +0000",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Corpo da mensagem.",
  "",
].join("\r\n");

let servidor: ServidorDeEmailFalso | undefined;
const clientes: ImapFlow[] = [];

async function subir(): Promise<ServidorDeEmailFalso> {
  servidor = await iniciarServidorDeEmailFalso({
    usuarios: [{ usuario: USUARIO, senha: SENHA, tokens: [TOKEN] }],
  });
  return servidor;
}

function clienteImap(
  f: ServidorDeEmailFalso,
  auth: { user: string; pass?: string; accessToken?: string },
  extras: { semCa?: boolean } = {},
): ImapFlow {
  const cliente = new ImapFlow({
    host: f.imap.host,
    port: f.imap.porta,
    secure: true,
    servername: "imap.caixa.teste",
    ...(extras.semCa ? {} : { tls: { ca: f.ca } }),
    auth,
    logger: false,
  });
  // Um erro de socket sem ouvinte derruba o processo de teste; quem quer o erro o lê do `connect()`.
  cliente.on("error", () => undefined);
  clientes.push(cliente);
  return cliente;
}

afterEach(async () => {
  for (const cliente of clientes.splice(0)) {
    try {
      cliente.close();
    } catch {
      // já fechado
    }
  }
  await servidor?.fechar();
  servidor = undefined;
});

describe("certificado de teste", () => {
  it("vale para imap.caixa.teste e 127.0.0.1, gerado na hora (cacheado por processo)", () => {
    const { cert, chave } = gerarCertificadoDeTeste();
    const x509 = new X509Certificate(cert);
    expect(x509.checkHost("imap.caixa.teste")).toBeTruthy();
    expect(x509.checkHost("smtp.caixa.teste")).toBeTruthy();
    expect(x509.checkIP("127.0.0.1")).toBeTruthy();
    expect(chave).toContain("PRIVATE KEY");
    expect(gerarCertificadoDeTeste()).toBe(gerarCertificadoDeTeste());
  });
});

describe("IMAP falso", () => {
  it("o imapflow entra por TLS com a CA de teste e abre a INBOX com uidNext e uidValidity", async () => {
    const f = await subir();
    const cliente = clienteImap(f, { user: USUARIO, pass: SENHA });
    await cliente.connect();
    const caixa = await cliente.mailboxOpen("INBOX");
    expect(typeof caixa.uidNext).toBe("number");
    expect(typeof caixa.uidValidity).toBe("bigint");
    expect(f.conexoesImap()).toHaveLength(1);
    expect(f.conexoesImap()[0]?.sni).toBe("imap.caixa.teste");
    expect(f.conexoesImap()[0]?.remoto).toMatch(/127\.0\.0\.1/);
    await cliente.logout();
  });

  it("recusa senha errada com authenticationFailed", async () => {
    const f = await subir();
    const cliente = clienteImap(f, { user: USUARIO, pass: "senha-errada" });
    await expect(cliente.connect()).rejects.toMatchObject({ authenticationFailed: true });
  });

  it("aceita XOAUTH2 com o token certo e recusa o errado", async () => {
    const f = await subir();
    const bom = clienteImap(f, { user: USUARIO, accessToken: TOKEN });
    await bom.connect();
    expect(bom.usable).toBe(true);
    await bom.logout();

    const ruim = clienteImap(f, { user: USUARIO, accessToken: "outro" });
    await expect(ruim.connect()).rejects.toMatchObject({ authenticationFailed: true });
  });

  it("avisa mensagem nova em IDLE em menos de 2 s e entrega o MIME inserido", async () => {
    const f = await subir();
    const cliente = clienteImap(f, { user: USUARIO, pass: SENHA });
    await cliente.connect();
    await cliente.mailboxOpen("INBOX");

    const chegou = new Promise<number>((resolve) => cliente.once("exists", (d: { count: number }) => resolve(d.count)));
    const idle = cliente.idle();
    const antes = Date.now();
    const uid = await f.adicionarMensagem(USUARIO, MIME);
    const contagem = await chegou;
    expect(Date.now() - antes).toBeLessThan(2000);
    expect(contagem).toBeGreaterThanOrEqual(1);
    cliente.close();
    await idle.catch(() => undefined);

    const leitor = clienteImap(f, { user: USUARIO, pass: SENHA });
    await leitor.connect();
    await leitor.mailboxOpen("INBOX");
    const mensagem = await leitor.fetchOne(String(uid), { source: true }, { uid: true });
    expect(mensagem && mensagem.source?.toString("utf8")).toBe(MIME);
    await leitor.logout();
  });

  it("recriarCaixa troca o uidValidity", async () => {
    const f = await subir();
    const primeira = clienteImap(f, { user: USUARIO, pass: SENHA });
    await primeira.connect();
    const antes = (await primeira.mailboxOpen("INBOX")).uidValidity;
    await primeira.logout().catch(() => undefined);

    await f.recriarCaixa(USUARIO);

    const segunda = clienteImap(f, { user: USUARIO, pass: SENHA });
    await segunda.connect();
    const depois = (await segunda.mailboxOpen("INBOX")).uidValidity;
    expect(depois).not.toBe(antes);
    await segunda.logout();
  });

  it("lista a pasta de enviados por SPECIAL-USE e guarda o que se anexa nela", async () => {
    const f = await subir();
    const cliente = clienteImap(f, { user: USUARIO, pass: SENHA });
    await cliente.connect();
    const pastas = await cliente.list();
    const enviados = pastas.find((p) => p.specialUse === "\\Sent");
    expect(enviados).toBeDefined();
    await cliente.append(enviados!.path, MIME, ["\\Seen"]);
    await cliente.logout();

    const guardadas = await f.mensagensDaPasta(USUARIO, enviados!.path);
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]?.toString("utf8")).toBe(MIME);
  });

  it("sem a CA injetada o connect rejeita por certificado (TLS do Node)", async () => {
    const f = await subir();
    const cliente = clienteImap(f, { user: USUARIO, pass: SENHA }, { semCa: true });
    await expect(cliente.connect()).rejects.toMatchObject({
      code: expect.stringMatching(/SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|CERT/),
    });
  });
});
