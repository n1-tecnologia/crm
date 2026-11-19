/**
 * O certificado TLS dos dublês de e-mail (Fase 17, 17-02): gerado na hora do teste, nunca commitado.
 *
 * Commitar uma chave privada, mesmo de teste, dispara o bloqueio de segredo do GitHub e confunde a auditoria
 * (T-17-04). Por isso o par nasce aqui, pelo binário `openssl`, num diretório temporário que é apagado em seguida, e
 * vive só na memória do processo de teste. Sem `openssl` no PATH o teste falha alto, de propósito.
 *
 * O certificado é autoassinado e vale para os nomes que os testes usam (`localhost`, `imap.caixa.teste`,
 * `smtp.caixa.teste`) e para `127.0.0.1`. Ele chega ao cliente (`imapflow`, `nodemailer`) só como `ca`, injetada pelo
 * teste (T-17-05): nenhuma variável de ambiente, nenhum `rejectUnauthorized: false`, nada disso existe na produção.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CertificadoDeTeste {
  /** Certificado em PEM; também serve de `ca` do cliente, porque é autoassinado. */
  readonly cert: string;
  /** Chave privada em PEM. Só o servidor falso a recebe. */
  readonly chave: string;
}

/** Nomes que o certificado de teste cobre (os testes escolhem o SNI entre eles). */
export const NOMES_DO_CERTIFICADO_DE_TESTE = ["localhost", "imap.caixa.teste", "smtp.caixa.teste"] as const;

const CONFIGURACAO_DO_OPENSSL = [
  "[req]",
  "distinguished_name = nome",
  "x509_extensions = extensoes",
  "prompt = no",
  "",
  "[nome]",
  "CN = localhost",
  "",
  "[extensoes]",
  "basicConstraints = critical, CA:TRUE",
  "subjectAltName = DNS:localhost, DNS:imap.caixa.teste, DNS:smtp.caixa.teste, IP:127.0.0.1",
  "",
].join("\n");

let emCache: CertificadoDeTeste | undefined;

/** Um par certificado/chave por processo: gerar RSA a cada teste custaria segundos à toa. */
export function gerarCertificadoDeTeste(): CertificadoDeTeste {
  if (emCache) return emCache;

  const pasta = mkdtempSync(join(tmpdir(), "n1-cert-de-teste-"));
  try {
    const configuracao = join(pasta, "openssl.cnf");
    const arquivoDaChave = join(pasta, "chave.pem");
    const arquivoDoCert = join(pasta, "cert.pem");
    writeFileSync(configuracao, CONFIGURACAO_DO_OPENSSL);
    try {
      execFileSync(
        "openssl",
        [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-days",
          "3650",
          "-config",
          configuracao,
          "-keyout",
          arquivoDaChave,
          "-out",
          arquivoDoCert,
        ],
        { stdio: "pipe" },
      );
    } catch (erro) {
      throw new Error(
        `Não foi possível gerar o certificado de teste: o binário "openssl" é necessário no PATH (${
          erro instanceof Error ? erro.message : String(erro)
        })`,
      );
    }
    emCache = { cert: readFileSync(arquivoDoCert, "utf8"), chave: readFileSync(arquivoDaChave, "utf8") };
    return emCache;
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}
