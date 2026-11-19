/**
 * Os dublês de e-mail da Fase 17 (17-02): um IMAP e um SMTP de verdade, em `127.0.0.1`, porta efêmera, TLS de teste.
 *
 * Como `servidor-falso.ts`, nunca é um mock do cliente: o `imapflow` e o `nodemailer` conversam com ele pelo socket, e é
 * o transporte (certificado, SNI, autenticação, queda, silêncio) que os planos de conexão, leitura e envio precisam
 * provar falhando de verdade. O certificado nasce na hora do teste (`certificado-de-teste.ts`) e chega ao cliente só
 * como `ca` (`ServidorDeEmailFalso.ca`): nada disto existe na produção.
 *
 * A parte IMAP é o `imapkit` (spike do pressuposto A1, resultado no `CONTEXT.md` desta pasta) usado como módulo, com
 * TLS direto na porta principal (`secureConnection`). Um limite dele, de propósito do `imapkit`: a árvore de caixas é
 * UMA só para o servidor inteiro ("single user, multiple connection"). Vários `usuarios` autenticam com credenciais
 * próprias, mas enxergam as mesmas pastas e mensagens; o argumento `usuario` de `adicionarMensagem`, `recriarCaixa` e
 * `mensagensDaPasta` só documenta de quem é a caixa no teste. Um teste que precisa de duas caixas separadas sobe dois
 * servidores.
 */

import type { Socket } from "node:net";
import type { TLSSocket } from "node:tls";
import imapkit from "imapkit";
import { SMTPServer } from "smtp-server";
import { gerarCertificadoDeTeste } from "./certificado-de-teste";

export interface UsuarioDeEmailFalso {
  readonly usuario: string;
  /** Senha aceita por LOGIN e AUTHENTICATE PLAIN. */
  readonly senha?: string;
  /** Tokens aceitos por XOAUTH2. */
  readonly tokens?: readonly string[];
}

export interface OpcoesDoServidorDeEmailFalso {
  readonly usuarios?: readonly UsuarioDeEmailFalso[];
  /** O IMAP não anuncia `IDLE` (17-10): o cliente só vê mensagem nova quando pergunta (a conferência periódica do leitor). */
  readonly semIdle?: boolean;
}

export interface ConexaoRegistrada {
  /** `endereço:porta` de quem conectou. */
  readonly remoto: string;
  /** O nome que o cliente pediu no TLS (SNI), se pediu. */
  readonly sni?: string;
}

/** Uma entrega que o SMTP falso recebeu: o envelope e o `DATA` cru, como o servidor de destino os veria. */
export interface EntregaSmtp {
  readonly envelope: { readonly de: string; readonly para: readonly string[] };
  readonly dados: Buffer;
  /** Quem autenticou na sessão. */
  readonly usuario: string;
}

/**
 * Uma falha programada. Vale para o próximo envio (a próxima transação `MAIL FROM`) e some; `recusarAuth` vale para o
 * próximo login.
 */
export type RegraSmtp =
  /** `enderecos` limita a recusa a esses destinatários (os outros da mesma transação são aceitos); sem ele, recusa todos. */
  | { readonly tipo: "recusarRcpt"; readonly codigo: number; readonly enderecos?: readonly string[] }
  | { readonly tipo: "recusarData"; readonly codigo: number }
  /** Recebe o `DATA` inteiro, registra a entrega e não responde: o caso ambíguo (o cliente não sabe se saiu). */
  | { readonly tipo: "mudoNoData" }
  | { readonly tipo: "recusarAuth" };

export interface ServidorDeEmailFalso {
  readonly imap: { readonly host: "127.0.0.1"; readonly porta: number };
  readonly smtp: { readonly host: "127.0.0.1"; readonly porta: number };
  /** A CA de teste, para o cliente (`tls.ca`). Só existe no teste. */
  readonly ca: string;
  /**
   * Insere uma mensagem na pasta (INBOX por padrão) como se tivesse chegado, avisando as sessões em IDLE.
   * Devolve o UID.
   */
  adicionarMensagem(usuario: string, mime: string | Buffer, pasta?: string): Promise<number>;
  /**
   * Muda o UIDVALIDITY da pasta (as mensagens ficam, renumeradas de 1 a n), como quando o servidor recria a caixa. As
   * sessões que a têm aberta recebem `BYE`.
   */
  recriarCaixa(usuario: string, pasta?: string): Promise<void>;
  /** O MIME cru de cada mensagem da pasta, na ordem dos UIDs. */
  mensagensDaPasta(usuario: string, pasta: string): Promise<readonly Buffer[]>;
  /** Cada envio que chegou ao `DATA`, inclusive o que o dublê deixou sem resposta (`mudoNoData`). */
  readonly entregues: readonly EntregaSmtp[];
  programarSmtp(regra: RegraSmtp): void;
  conexoesImap(): readonly ConexaoRegistrada[];
  conexoesSmtp(): readonly ConexaoRegistrada[];
  /** Quantos sockets de cada lado estão abertos agora (as `conexoesImap` são o histórico, não o que está de pé). */
  conexoesAbertas(): { readonly imap: number; readonly smtp: number };
  /** Troca a senha do usuário nos dois servidores (17-10: "a senha mudou"). Não derruba as sessões abertas: use `derrubarConexoes`. */
  trocarSenha(usuario: string, nova: string): void;
  /** Destrói os sockets abertos (queda de rede); o servidor continua aceitando conexões novas. */
  derrubarConexoes(): void;
  fechar(): Promise<void>;
}

const USUARIOS_PADRAO: readonly UsuarioDeEmailFalso[] = [
  { usuario: "ana@caixa.teste", senha: "senha-certa", tokens: ["token-certo"] },
];

/** A pasta de enviados do dublê tem nome em português de propósito: o código tem de achá-la por SPECIAL-USE. */
export const PASTA_DE_ENVIADOS_FALSA = "Enviados";

const PLUGINS_DO_IMAP = [
  "IDLE",
  "SASL-IR",
  "AUTH-PLAIN",
  "XOAUTH2",
  "SPECIAL-USE",
  "UIDPLUS",
  "MOVE",
  "NAMESPACE",
  "ID",
  "ENABLE",
  "UNSELECT",
  "LITERAL+",
];

function erroSmtp(mensagem: string, codigo: number): Error {
  return Object.assign(new Error(mensagem), { responseCode: codigo });
}

function lerTudo(fluxo: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pedacos: Buffer[] = [];
    fluxo.on("data", (pedaco: Buffer) => pedacos.push(pedaco));
    fluxo.on("end", () => resolve(Buffer.concat(pedacos)));
    fluxo.on("error", reject);
  });
}

function paraTexto(mime: string | Buffer): string | Uint8Array {
  return typeof mime === "string" ? mime : new Uint8Array(mime);
}

export async function iniciarServidorDeEmailFalso(
  opcoes: OpcoesDoServidorDeEmailFalso = {},
): Promise<ServidorDeEmailFalso> {
  // Cópia: a troca de senha mexe nela, e a lista de quem chamou (ou o padrão do módulo) não pode mudar.
  const usuarios: { -readonly [K in keyof UsuarioDeEmailFalso]: UsuarioDeEmailFalso[K] }[] = (opcoes.usuarios ?? USUARIOS_PADRAO).map((u) => ({ ...u }));
  const certificado = gerarCertificadoDeTeste();

  const tokensPorUsuario = new Map<string, readonly string[]>();
  const usuariosDoImap: Record<string, { password?: string; xoauth2?: { accessToken: string } }> = {};
  for (const u of usuarios) {
    tokensPorUsuario.set(u.usuario, u.tokens ?? []);
    usuariosDoImap[u.usuario] = {
      ...(u.senha !== undefined ? { password: u.senha } : {}),
      ...(u.tokens && u.tokens[0] !== undefined ? { xoauth2: { accessToken: u.tokens[0] } } : {}),
    };
  }

  const imap = imapkit({
    plugins: opcoes.semIdle ? PLUGINS_DO_IMAP.filter((plugin) => plugin !== "IDLE") : PLUGINS_DO_IMAP,
    users: usuariosDoImap,
    secureConnection: true,
    credentials: { key: certificado.chave, cert: certificado.cert },
    storage: {
      INBOX: {},
      "": {
        folders: {
          [PASTA_DE_ENVIADOS_FALSA]: { "special-use": "\\Sent" },
          Rascunhos: { "special-use": "\\Drafts" },
        },
      },
    },
  });

  // O `imapkit` guarda um token por usuário; o dublê aceita a lista inteira (um token trocado por refresh, por exemplo).
  imap.checkAccessToken = (token: string, username?: string) => {
    const dono = username ?? [...tokensPorUsuario.keys()].find((u) => tokensPorUsuario.get(u)?.includes(token));
    return dono !== undefined && tokensPorUsuario.get(dono)?.includes(token)
      ? { user: dono }
      : { error: "invalid_token", reason: "token desconhecido" };
  };

  const conexoes: ConexaoRegistrada[] = [];
  const sockets = new Set<Socket>();
  imap.server.on("connection", (socket: Socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  imap.server.on("secureConnection", (socket: TLSSocket) => {
    conexoes.push({
      remoto: `${socket.remoteAddress ?? "?"}:${socket.remotePort ?? 0}`,
      ...(socket.servername ? { sni: socket.servername } : {}),
    });
  });

  const portaDoImap = await imap.start(0, "127.0.0.1");

  // O SMTP: `smtp-server` com TLS implícito, a mesma lista de usuários do IMAP e as falhas programadas.
  const entregues: EntregaSmtp[] = [];
  const conexoesSmtp: ConexaoRegistrada[] = [];
  const socketsSmtp = new Set<Socket>();
  const regras: RegraSmtp[] = [];
  /** A regra que pegou a transação em curso de cada sessão (`session.id`). */
  const regraDaTransacao = new Map<string, RegraSmtp>();

  const smtp = new SMTPServer({
    secure: true,
    key: certificado.chave,
    cert: certificado.cert,
    authMethods: ["PLAIN", "LOGIN", "XOAUTH2"],
    logger: false,
    disabledCommands: [],
    onSecure(socket, session, retorno) {
      conexoesSmtp.push({
        remoto: `${session.remoteAddress}:${socket.remotePort ?? 0}`,
        ...("servername" in socket && typeof socket.servername === "string" && socket.servername
          ? { sni: socket.servername }
          : {}),
      });
      retorno();
    },
    onAuth(auth, _session, retorno) {
      const indice = regras.findIndex((r) => r.tipo === "recusarAuth");
      if (indice >= 0) {
        regras.splice(indice, 1);
        retorno(erroSmtp("535 Autenticação recusada (programada)", 535));
        return;
      }
      const usuario = auth.username ?? "";
      const valida =
        auth.method === "XOAUTH2"
          ? auth.accessToken !== undefined && (tokensPorUsuario.get(usuario) ?? []).includes(auth.accessToken)
          : usuarios.some((u) => u.usuario === usuario && u.senha !== undefined && u.senha === auth.password);
      if (!valida) {
        retorno(erroSmtp("Credenciais inválidas", 535));
        return;
      }
      retorno(null, { user: usuario });
    },
    onMailFrom(_endereco, session, retorno) {
      const indice = regras.findIndex((r) => r.tipo !== "recusarAuth");
      if (indice >= 0) regraDaTransacao.set(session.id, regras.splice(indice, 1)[0]!);
      else regraDaTransacao.delete(session.id);
      retorno();
    },
    onRcptTo(endereco, session, retorno) {
      const regra = regraDaTransacao.get(session.id);
      if (regra?.tipo === "recusarRcpt" && (regra.enderecos === undefined || regra.enderecos.includes(endereco.address.toLowerCase()))) {
        retorno(erroSmtp("Destinatário recusado (programado)", regra.codigo));
        return;
      }
      retorno();
    },
    onData(fluxo, session, retorno) {
      void lerTudo(fluxo).then((dados) => {
        const regra = regraDaTransacao.get(session.id);
        regraDaTransacao.delete(session.id);
        entregues.push({
          envelope: {
            de: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
            para: session.envelope.rcptTo.map((r) => r.address),
          },
          dados,
          usuario: typeof session.user === "string" ? session.user : "",
        });
        if (regra?.tipo === "mudoNoData") return; // nunca chama `retorno`: o cliente fica esperando
        if (regra?.tipo === "recusarData") {
          entregues.pop(); // recusado: o servidor de verdade não guarda a mensagem
          retorno(erroSmtp("Mensagem recusada (programado)", regra.codigo));
          return;
        }
        retorno(null, "Mensagem aceita");
      });
    },
  });
  smtp.server.on("connection", (socket: Socket) => {
    socketsSmtp.add(socket);
    socket.on("close", () => socketsSmtp.delete(socket));
  });
  const portaDoSmtp = await new Promise<number>((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(0, "127.0.0.1", () => {
      const endereco = smtp.server.address();
      resolve(typeof endereco === "object" && endereco ? endereco.port : 0);
    });
  });

  return {
    imap: { host: "127.0.0.1", porta: portaDoImap },
    smtp: { host: "127.0.0.1", porta: portaDoSmtp },
    ca: certificado.cert,
    entregues,
    programarSmtp(regra) {
      regras.push(regra);
    },
    async adicionarMensagem(_usuario, mime, pasta = "INBOX") {
      return imap.control.addMessage(pasta, { raw: paraTexto(mime) }).uid;
    },
    async recriarCaixa(_usuario, pasta = "INBOX") {
      imap.control.resetUidValidity(pasta, { uids: "renumber" });
    },
    async mensagensDaPasta(_usuario, pasta) {
      return imap.control
        .listMessages(pasta, { raw: true })
        .map((mensagem) => mensagem.raw)
        .filter((raw): raw is Buffer => raw !== undefined);
    },
    conexoesImap: () => conexoes.slice(),
    conexoesSmtp: () => conexoesSmtp.slice(),
    conexoesAbertas: () => ({ imap: [...sockets].filter((s) => !s.destroyed).length, smtp: [...socketsSmtp].filter((s) => !s.destroyed).length }),
    trocarSenha(usuario, nova) {
      const dono = usuarios.find((u) => u.usuario === usuario);
      if (dono) dono.senha = nova;
      imap.control.updateUser(usuario, { password: nova });
    },
    derrubarConexoes() {
      for (const socket of sockets) socket.destroy();
      for (const socket of socketsSmtp) socket.destroy();
    },
    async fechar() {
      // Destruir NO MESMO INSTANTE o socket cru de um handshake TLS que o cliente acabou de recusar (certificado inválido)
      // derruba o processo do Node (SIGSEGV, Node 24.14, achado no 17-03). Um respiro deixa o TLS terminar de se desfazer;
      // o que ainda estiver aberto depois dele é derrubado.
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      for (const socket of sockets) if (!socket.destroyed) socket.destroy();
      for (const socket of socketsSmtp) if (!socket.destroyed) socket.destroy();
      await Promise.all([imap.stop(), new Promise<void>((resolve) => smtp.close(() => resolve()))]);
    },
  };
}
