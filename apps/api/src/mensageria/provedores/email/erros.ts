/**
 * O erro de conexão do e-mail como frase de produto (Fase 17, 17-03, D-17-07, T-17-09 e T-17-10).
 *
 * A tela de "conectar a caixa" mostra o que esta função devolve, e só isso. O erro cru do `imapflow` ou do `nodemailer`
 * carrega host, porta, IP, texto do sistema e, na falha de login, a frase do servidor: devolvê-lo viraria uma sonda da
 * rede (a diferença entre "recusou" e "esgotou" mapeia o que está atrás do endereço digitado). Por isso:
 *
 *   - toda classe de falha tem uma frase FIXA, em português, sem host, sem porta e sem texto do sistema;
 *   - o texto do servidor (`fraseDoServidor`) só aparece quando a conexão chegou a AUTENTICAR (login recusado): é o único
 *     caso em que quem responde já provou ser o servidor de e-mail da pessoa;
 *   - essa frase passa por um filtro: uma linha só, até 300 caracteres, sem o desafio XOAUTH2 (`user=`, `auth=Bearer`),
 *     sem sequência longa de base64, e sem nenhum dos segredos que o chamador informar.
 *
 * Nada aqui chama registro algum.
 */

import { RecusaDeRede, type ServicoDeEmail } from "./rede";

export type TipoDeFalhaDeConexao =
  | "rede_recusada"
  | "nao_conectou"
  | "certificado"
  | "tempo"
  | "recusou_login"
  | "protocolo";

export interface FalhaDeConexao {
  readonly tipo: TipoDeFalhaDeConexao;
  readonly servico: ServicoDeEmail;
  /** A frase que a tela mostra. */
  readonly frase: string;
  /** O que o servidor disse ao recusar o login, já filtrado. Só existe quando `tipo` é `recusou_login`. */
  readonly fraseDoServidor?: string;
  /** Repetir não adianta: a pessoa precisa mudar algo (senha, certificado, endereço). */
  readonly permanente: boolean;
}

export const FRASES_DE_CONEXAO = {
  recusou_login: {
    imap: "O servidor IMAP recusou o usuário ou a senha.",
    smtp: "O servidor SMTP recusou o usuário ou a senha.",
  },
  certificado: {
    imap: "O certificado do servidor IMAP não é válido.",
    smtp: "O certificado do servidor SMTP não é válido.",
  },
  tempo: {
    imap: "O servidor IMAP não respondeu a tempo.",
    smtp: "O servidor SMTP não respondeu a tempo.",
  },
  nao_conectou: {
    imap: "Não foi possível conectar ao servidor IMAP.",
    smtp: "Não foi possível conectar ao servidor SMTP.",
  },
  protocolo: {
    imap: "O servidor IMAP respondeu de um jeito que a plataforma não aceita.",
    smtp: "O servidor SMTP respondeu de um jeito que a plataforma não aceita.",
  },
  rede_interna: "Este servidor não é permitido: use o endereço público do seu provedor de e-mail.",
  porta: "Use a porta 993 ou 143 para o IMAP e 465 ou 587 para o SMTP.",
  host_invalido: "O endereço do servidor não é válido.",
} as const;

const CODIGOS_DE_CERTIFICADO = new Set([
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "CERT_REVOKED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_GET_ISSUER_CERT",
  "CERT_UNTRUSTED",
  "ETLS",
]);

const CODIGOS_DE_TEMPO = new Set([
  "CONNECT_TIMEOUT",
  "GREETING_TIMEOUT",
  "UPGRADE_TIMEOUT",
  "ETIMEOUT",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
]);

const CODIGOS_DE_NAO_CONECTOU = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ECONNECTION",
  "ESOCKET",
  "EDNS",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
]);

const TETO_DA_FRASE_DO_SERVIDOR = 300;

/**
 * Deixa a frase do servidor segura para a tela: uma linha, curta, sem o desafio XOAUTH2 nem nada que se pareça com um
 * token, e sem os segredos dados.
 */
function filtrarFraseDoServidor(bruta: string, segredos: readonly string[]): string | undefined {
  let texto = bruta
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\buser=\S*/gi, "")
    .replace(/\bauth=\S*(\s+\S+)?/gi, "")
    .replace(/\bBearer\s+\S+/gi, "")
    .replace(/[A-Za-z0-9+/_=-]{32,}/g, "");
  for (const segredo of segredos) {
    if (segredo.length >= 4) texto = texto.split(segredo).join("");
  }
  texto = texto.replace(/\s+/g, " ").trim();
  if (texto === "") return undefined;
  return texto.length > TETO_DA_FRASE_DO_SERVIDOR ? texto.slice(0, TETO_DA_FRASE_DO_SERVIDOR) : texto;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

function dadosDoErro(erro: unknown): {
  code?: string;
  /** O `nodemailer` troca `code` por `ESOCKET`/`ECONNECTION` e guarda o do Node (ex.: `DEPTH_ZERO_SELF_SIGNED_CERT`) aqui. */
  originalCode?: string;
  message?: string;
  authenticationFailed: boolean;
  doServidor?: string;
} {
  if (typeof erro !== "object" || erro === null) return { authenticationFailed: false };
  const e = erro as Record<string, unknown>;
  const code = texto(e.code);
  const originalCode = texto(e.originalCode);
  const message = texto(e.message);
  const doServidor = texto(e.responseText) ?? texto(e.response);
  return {
    ...(code !== undefined ? { code } : {}),
    ...(originalCode !== undefined ? { originalCode } : {}),
    ...(message !== undefined ? { message } : {}),
    authenticationFailed: e.authenticationFailed === true,
    ...(doServidor !== undefined ? { doServidor } : {}),
  };
}

function falha(
  tipo: TipoDeFalhaDeConexao,
  servico: ServicoDeEmail,
  frase: string,
  permanente: boolean,
  fraseDoServidor?: string,
): FalhaDeConexao {
  return { tipo, servico, frase, permanente, ...(fraseDoServidor !== undefined ? { fraseDoServidor } : {}) };
}

/**
 * Transforma o erro de uma conexão (da guarda de rede, do `imapflow` ou do `nodemailer`) numa frase de produto.
 * `segredos` é a lista do que nunca pode aparecer (a senha usada, o token): é tirada da frase do servidor.
 */
export function classificarErroDeConexao(
  erro: unknown,
  servico: ServicoDeEmail,
  segredos: readonly string[] = [],
): FalhaDeConexao {
  if (erro instanceof RecusaDeRede) {
    // O serviço da recusa é o que foi pedido à guarda, e não precisa bater com o do chamador.
    switch (erro.motivo) {
      case "rede_interna":
        return falha("rede_recusada", servico, FRASES_DE_CONEXAO.rede_interna, true);
      case "porta":
        return falha("rede_recusada", servico, FRASES_DE_CONEXAO.porta, true);
      case "host_invalido":
        return falha("rede_recusada", servico, FRASES_DE_CONEXAO.host_invalido, true);
      case "sem_endereco":
        return falha("nao_conectou", servico, FRASES_DE_CONEXAO.nao_conectou[servico], false);
    }
  }

  const { code, originalCode, message, authenticationFailed, doServidor } = dadosDoErro(erro);
  const codigos = [originalCode, code].filter((c): c is string => c !== undefined);
  const tem = (conjunto: ReadonlySet<string>): boolean => codigos.some((c) => conjunto.has(c));

  // A conexão chegou a autenticar: é o único caso em que se repete o que o servidor disse.
  if (authenticationFailed || code === "EAUTH") {
    const frase = doServidor !== undefined ? filtrarFraseDoServidor(doServidor, segredos) : undefined;
    return falha("recusou_login", servico, FRASES_DE_CONEXAO.recusou_login[servico], true, frase);
  }

  // O certificado vem antes do resto: o `nodemailer` embrulha a falha de TLS em `ESOCKET`.
  if (tem(CODIGOS_DE_CERTIFICADO)) {
    // `ETLS` do `nodemailer` também é o servidor que não aceita o STARTTLS que a plataforma exige: isso é protocolo.
    if (
      originalCode === undefined &&
      code === "ETLS" &&
      message !== undefined &&
      /upgrading connection with STARTTLS|closed unexpectedly/i.test(message)
    ) {
      return falha("protocolo", servico, FRASES_DE_CONEXAO.protocolo[servico], true);
    }
    return falha("certificado", servico, FRASES_DE_CONEXAO.certificado[servico], true);
  }

  if (tem(CODIGOS_DE_TEMPO)) {
    return falha("tempo", servico, FRASES_DE_CONEXAO.tempo[servico], false);
  }

  if (tem(CODIGOS_DE_NAO_CONECTOU)) {
    return falha("nao_conectou", servico, FRASES_DE_CONEXAO.nao_conectou[servico], false);
  }

  return falha("protocolo", servico, FRASES_DE_CONEXAO.protocolo[servico], true);
}
