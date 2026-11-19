/**
 * A fábrica de conexões de e-mail (Fase 17, 17-03, D-17-07).
 *
 * Toda abertura de IMAP ou de SMTP do `apps/api` passa por aqui: a conexão de teste da tela, o leitor, o envio e o
 * `APPEND` em Enviados (17-05, 17-09, 17-10). A fábrica sempre chama `conferirDestino` (que resolve o host UMA vez e
 * recusa a rede interna) e entrega ao `imapflow` e ao `nodemailer`:
 *
 *   - `host` = o IP já conferido (as duas bibliotecas não consultam o DNS de novo para IP literal);
 *   - `servername` = o nome que a pessoa digitou, para o certificado ser conferido pelo nome e não pelo IP.
 *
 * Regras que não têm botão: o certificado é SEMPRE conferido (esta pasta nunca desliga a verificação), TLS 1.2 ou mais,
 * 143 e 587 só com STARTTLS obrigatório, nenhuma das duas bibliotecas registra nada, e o `nodemailer` não lê arquivo
 * nem URL do disco ou da rede por conta de um e-mail. A única CA extra possível chega por injeção (`opcoes.ca`, a dos
 * testes): não há variável de ambiente nem campo de requisição que afrouxe a guarda.
 *
 * Esta pasta nunca coloca senha, token nem texto do servidor em erro ou em registro; quem classifica o erro para a tela é
 * `erros.ts`.
 */

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { AutenticacaoDoEmail } from "./credencial";
import {
  RecusaDeRede,
  conferirDestino,
  type DestinoConferido,
  type PoliticaDeRede,
  type Resolvedor,
  type ServicoDeEmail,
  type TabelaDePortas,
} from "./rede";

export type UsoDaConexao = "teste" | "leitor" | "envio";

export interface TemposDeConexao {
  /** Cobre o DNS, o TCP e o TLS. */
  readonly conectarMs: number;
  readonly saudacaoMs: number;
  /** Inatividade do socket. No leitor tem de ser MAIOR que o `maxIdleTime` do IDLE (17-10 escolhe). */
  readonly socketMs: number;
}

export const TEMPOS_PADRAO: Readonly<Record<UsoDaConexao, TemposDeConexao>> = {
  teste: { conectarMs: 10_000, saudacaoMs: 10_000, socketMs: 15_000 },
  leitor: { conectarMs: 30_000, saudacaoMs: 16_000, socketMs: 15 * 60_000 },
  envio: { conectarMs: 15_000, saudacaoMs: 15_000, socketMs: 30_000 },
};

const TLS_MINIMO = "TLSv1.2";

export interface EntradaDeImap {
  readonly host: string;
  readonly porta: number;
  readonly auth: AutenticacaoDoEmail;
  readonly uso: UsoDaConexao;
  /** Quando o servidor encerra a sessão por conta do token (Exchange Online); padrão: a validade do token OAuth. */
  readonly sessaoExpiraEm?: string;
  /** O leitor (17-10): a cada tanto o IDLE é quebrado e refeito, para a sessão nunca ficar muda. Tem de ser MENOR que o `socketMs` do uso. */
  readonly maxIdleTimeMs?: number;
}

export interface EntradaDeSmtp {
  readonly host: string;
  readonly porta: number;
  readonly auth: AutenticacaoDoEmail;
  readonly uso: UsoDaConexao;
}

/** A verificação sempre usa os tempos curtos do teste. */
export type EntradaDeVerificacaoImap = Omit<EntradaDeImap, "uso" | "sessaoExpiraEm" | "maxIdleTimeMs">;
export type EntradaDeVerificacaoSmtp = Omit<EntradaDeSmtp, "uso">;

export interface ResultadoDaVerificacaoImap {
  /** Em texto: o `imapflow` o dá como `bigint`, que nem o JSON nem o driver do Postgres aceitam. */
  readonly uidValidity: string;
  readonly uidNext: number;
  /** O caminho da pasta marcada `\Sent` pelo servidor, se ele anuncia. */
  readonly pastaEnviados?: string;
}

export interface FabricaDeConexao {
  /** Abre a sessão IMAP (já conectada e autenticada). Quem a recebe é dono dela e deve fechá-la. */
  abrirImap(entrada: EntradaDeImap): Promise<ImapFlow>;
  /** Cria o transporte SMTP no IP conferido (a conexão em si nasce no primeiro envio). Quem o recebe deve fechá-lo. */
  abrirSmtp(entrada: EntradaDeSmtp): Promise<Transporter>;
  /** Conecta, autentica, lê a INBOX e a pasta de enviados, e encerra. */
  verificarImap(entrada: EntradaDeVerificacaoImap): Promise<ResultadoDaVerificacaoImap>;
  /** Conecta, autentica e encerra. */
  verificarSmtp(entrada: EntradaDeVerificacaoSmtp): Promise<void>;
}

export interface OpcoesDaFabrica {
  readonly resolver?: Resolvedor;
  readonly politica?: PoliticaDeRede;
  readonly portas?: TabelaDePortas;
  /** CA extra, só para os testes: a produção confia nas CAs do sistema. */
  readonly ca?: string;
  readonly tempos?: Partial<Record<UsoDaConexao, TemposDeConexao>>;
}

export function criarFabricaDeConexao(opcoes: OpcoesDaFabrica = {}): FabricaDeConexao {
  async function destinoDe(host: string, porta: number, servico: ServicoDeEmail): Promise<DestinoConferido> {
    const resultado = await conferirDestino(
      { host, porta, servico },
      {
        ...(opcoes.resolver ? { resolver: opcoes.resolver } : {}),
        ...(opcoes.politica ? { politica: opcoes.politica } : {}),
        ...(opcoes.portas ? { portas: opcoes.portas } : {}),
      },
    );
    if (!resultado.ok) throw new RecusaDeRede(resultado.motivo, servico);
    return resultado.destino;
  }

  function temposDo(uso: UsoDaConexao): TemposDeConexao {
    return opcoes.tempos?.[uso] ?? TEMPOS_PADRAO[uso];
  }

  const tls = (): { minVersion: typeof TLS_MINIMO; ca?: string } => ({
    minVersion: TLS_MINIMO,
    ...(opcoes.ca ? { ca: opcoes.ca } : {}),
  });

  async function abrirImap(entrada: EntradaDeImap): Promise<ImapFlow> {
    const destino = await destinoDe(entrada.host, entrada.porta, "imap");
    const tempos = temposDo(entrada.uso);
    const expira =
      entrada.auth.tipo === "oauth" ? new Date(entrada.sessaoExpiraEm ?? entrada.auth.expiraEm) : undefined;

    const cliente = new ImapFlow({
      host: destino.ip,
      port: destino.porta,
      servername: destino.host,
      secure: destino.seguranca === "tls",
      // 143: o STARTTLS é obrigatório; o servidor que não o oferece é recusado, nunca se cai para texto puro.
      ...(destino.seguranca === "starttls" ? { doSTARTTLS: true } : {}),
      tls: tls(),
      connectionTimeout: tempos.conectarMs,
      greetingTimeout: tempos.saudacaoMs,
      socketTimeout: tempos.socketMs,
      auth:
        entrada.auth.tipo === "senha"
          ? { user: entrada.auth.usuario, pass: entrada.auth.senha }
          : { user: entrada.auth.usuario, accessToken: entrada.auth.accessToken },
      ...(expira && !Number.isNaN(expira.getTime()) ? { sessionExpires: expira } : {}),
      ...(entrada.maxIdleTimeMs !== undefined ? { maxIdleTime: entrada.maxIdleTimeMs } : {}),
      logger: false,
    });
    // Um erro de socket sem ouvinte derruba o processo; quem quer o erro o lê do `connect()` ou do próprio evento.
    cliente.on("error", () => undefined);
    try {
      await cliente.connect();
    } catch (erro) {
      try {
        cliente.close();
      } catch {
        // já fechado
      }
      throw erro;
    }
    return cliente;
  }

  async function abrirSmtp(entrada: EntradaDeSmtp): Promise<Transporter> {
    const destino = await destinoDe(entrada.host, entrada.porta, "smtp");
    const tempos = temposDo(entrada.uso);

    return nodemailer.createTransport({
      host: destino.ip,
      port: destino.porta,
      servername: destino.host,
      secure: destino.seguranca === "tls",
      // 587: o STARTTLS é obrigatório (nunca texto puro, nunca "se o servidor oferecer").
      ...(destino.seguranca === "starttls" ? { requireTLS: true } : {}),
      tls: tls(),
      connectionTimeout: tempos.conectarMs,
      greetingTimeout: tempos.saudacaoMs,
      socketTimeout: tempos.socketMs,
      dnsTimeout: tempos.conectarMs,
      auth:
        entrada.auth.tipo === "senha"
          ? { user: entrada.auth.usuario, pass: entrada.auth.senha }
          : { type: "OAuth2", user: entrada.auth.usuario, accessToken: entrada.auth.accessToken },
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async function verificarImap(entrada: EntradaDeVerificacaoImap): Promise<ResultadoDaVerificacaoImap> {
    const cliente = await abrirImap({ ...entrada, uso: "teste" });
    try {
      const caixa = await cliente.mailboxOpen("INBOX");
      const pastas = await cliente.list();
      const enviados = pastas.find((p) => p.specialUse === "\\Sent");
      const resultado: ResultadoDaVerificacaoImap = {
        uidValidity: caixa.uidValidity.toString(),
        uidNext: caixa.uidNext,
        ...(enviados ? { pastaEnviados: enviados.path } : {}),
      };
      await cliente.logout();
      return resultado;
    } catch (erro) {
      try {
        cliente.close();
      } catch {
        // já fechado
      }
      throw erro;
    }
  }

  async function verificarSmtp(entrada: EntradaDeVerificacaoSmtp): Promise<void> {
    const transporte = await abrirSmtp({ ...entrada, uso: "teste" });
    try {
      await transporte.verify();
    } finally {
      transporte.close();
    }
  }

  return { abrirImap, abrirSmtp, verificarImap, verificarSmtp };
}
