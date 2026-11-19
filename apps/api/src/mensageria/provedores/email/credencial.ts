/**
 * A credencial do e-mail de um Canal, no cofre (009, `tipo = "email-imap-smtp"`), e a PORTA por onde o leitor e o envio a
 * usam. É o que `canalParaProvedor` decifra e entrega ao provedor em `CanalParaProvedor.credencial`.
 *
 * NADA deste arquivo vai a log, a resposta nem a erro: a senha, o `refreshToken` e o `accessToken` só existem em memória, dentro
 * de `AutenticacaoDoEmail`, pelo tempo de uma conexão. As mensagens de erro e de recusa são frases fixas, e este arquivo não
 * chama registro nenhum (T-17-11).
 *
 * O formato é JSON versionado (D-17-05): lê-se só a versão conhecida (`v: 1`), e um formato novo entra como `v: 2` lido ao
 * lado, sem migração. As duas formas de `v: 1`:
 *
 *   { v: 1, tipo: "senha", usuario, senha }
 *   { v: 1, tipo: "oauth", servico: "google" | "microsoft", usuario, refreshToken, accessToken?, expiraEm? }
 *
 * O login por Google e Microsoft usa a porta pelo mesmo caminho da senha: quem lê ou envia só pede `acessoParaUsar(canal)`
 * e recebe a `AutenticacaoDoEmail` pronta para o IMAP e o SMTP. A renovação do `accessToken` é preguiçosa e é de um
 * `RenovadorDeToken` injetado por serviço (o plano 17-12 liga o da Microsoft, o 17-13 o do Google). Sem renovador, a
 * credencial OAuth devolve `OAUTH_NAO_CONFIGURADO` (transitório): quem usa a porta nunca muda quando o login chegar.
 */

import type { Pool, PoolClient } from "pg";
import { pool as poolPadrao } from "../../../persistencia/conexao";
import { guardarCredencial, lerChavesDoCofre, type ChavesDoCofre } from "../../../servicos/cofre";
import type { CanalParaProvedor } from "../../provedor";
import { lerConfiguracaoDoOauth } from "./configuracao";
import { renovadoresDoAmbiente } from "./token";

/**
 * O `tipo` da credencial do Canal no cofre: o nome do provedor, como o Instagram (`instagram-graph`). É o que
 * `canalParaProvedor` decifra e o que `esquecerContaDoEmail` apaga.
 */
export const TIPO_DA_CREDENCIAL = "email-imap-smtp";

export type ServicoDeLoginDoEmail = "google" | "microsoft";

export type CredencialDoEmail =
  | { readonly v: 1; readonly tipo: "senha"; readonly usuario: string; readonly senha: string }
  | {
      readonly v: 1;
      readonly tipo: "oauth";
      readonly servico: ServicoDeLoginDoEmail;
      readonly usuario: string;
      readonly refreshToken: string;
      readonly accessToken?: string;
      /** ISO 8601: quando o `accessToken` vence. */
      readonly expiraEm?: string;
    };

function textoNaoVazio(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim() !== "";
}

/** A credencial decifrada, ou `undefined` para qualquer outra forma (ausente, JSON quebrado, versão e tipo desconhecidos, campo vazio). */
export function lerCredencialDoEmail(texto: string | undefined): CredencialDoEmail | undefined {
  if (texto === undefined || texto === "") return undefined;
  let lida: unknown;
  try {
    lida = JSON.parse(texto);
  } catch {
    return undefined;
  }
  if (typeof lida !== "object" || lida === null || Array.isArray(lida)) return undefined;
  const campos = lida as Record<string, unknown>;
  if (campos.v !== 1) return undefined;
  if (campos.tipo === "senha") {
    if (!textoNaoVazio(campos.usuario) || !textoNaoVazio(campos.senha)) return undefined;
    return { v: 1, tipo: "senha", usuario: campos.usuario, senha: campos.senha };
  }
  if (campos.tipo === "oauth") {
    const servico: ServicoDeLoginDoEmail | undefined = campos.servico === "google" || campos.servico === "microsoft" ? campos.servico : undefined;
    if (servico === undefined) return undefined;
    if (!textoNaoVazio(campos.usuario) || !textoNaoVazio(campos.refreshToken)) return undefined;
    const base = { v: 1 as const, tipo: "oauth" as const, servico, usuario: campos.usuario, refreshToken: campos.refreshToken };
    // O `accessToken` e o instante em que vence andam juntos; um sem o outro é lixo (renova-se do `refreshToken`).
    if (campos.accessToken === undefined && campos.expiraEm === undefined) return base;
    if (!textoNaoVazio(campos.accessToken) || typeof campos.expiraEm !== "string" || Number.isNaN(Date.parse(campos.expiraEm))) return undefined;
    return { ...base, accessToken: campos.accessToken, expiraEm: campos.expiraEm };
  }
  return undefined;
}

export async function guardarCredencialDoEmail(
  cliente: Pick<Pool | PoolClient, "query">,
  chaves: ChavesDoCofre,
  dono: { readonly workspaceId: string; readonly canalId: string },
  credencial: CredencialDoEmail,
): Promise<void> {
  await guardarCredencial(cliente, chaves, {
    workspaceId: dono.workspaceId,
    donoTipo: "canal",
    donoId: dono.canalId,
    tipo: TIPO_DA_CREDENCIAL,
    segredo: JSON.stringify(credencial),
  });
}

/** Como o IMAP e o SMTP se autenticam: o que a conexão usa. Nunca vai a log, resposta nem erro. */
export type AutenticacaoDoEmail =
  | { readonly tipo: "senha"; readonly usuario: string; readonly senha: string }
  | { readonly tipo: "oauth"; readonly usuario: string; readonly accessToken: string; readonly expiraEm: string };

export type CodigoDeAcessoNegado = "CREDENCIAL_AUSENTE" | "OAUTH_NAO_CONFIGURADO" | "AUTORIZACAO_RECUSADA" | "RENOVACAO_FALHOU";

export type AcessoParaUsar =
  | { readonly ok: true; readonly auth: AutenticacaoDoEmail; readonly servico: "senha" | ServicoDeLoginDoEmail }
  | { readonly ok: false; readonly permanente: boolean; readonly codigo: CodigoDeAcessoNegado; readonly motivo: string };

export const FRASE_SEM_CREDENCIAL = "O Canal não tem a credencial do e-mail: conecte-o pela ficha dele.";
export const FRASE_OAUTH_NAO_CONFIGURADO = "O login deste serviço não está configurado na plataforma.";
export const FRASE_AUTORIZACAO_RECUSADA = "O serviço de e-mail retirou a autorização: conecte o Canal de novo pela ficha dele.";
export const FRASE_RENOVACAO_FALHOU = "Não foi possível renovar o acesso ao e-mail agora; a plataforma tenta de novo.";

/** O que um renovador lança: `permanente` é a autorização retirada ou o `refreshToken` recusado (conectar de novo); senão, falha passageira. */
export class ErroDeRenovacao extends Error {
  readonly permanente: boolean;
  /** A frase de produto da recusa permanente (vai a `motivo_da_queda` e à ficha). Fixa por serviço: nunca leva token nem resposta do servidor. */
  readonly frase?: string;
  constructor(permanente: boolean, frase?: string) {
    // Mensagem fixa: nunca leva token, resposta do servidor nem endereço.
    super(permanente ? "autorização do e-mail recusada" : "renovação do acesso ao e-mail falhou");
    this.name = "ErroDeRenovacao";
    this.permanente = permanente;
    if (frase !== undefined) this.frase = frase;
  }
}

/** Troca o `refreshToken` por um `accessToken` novo. O `refreshToken` novo, quando o serviço o gira, vem junto. */
export type RenovadorDeToken = (refreshToken: string) => Promise<{ accessToken: string; expiraEm: string; refreshToken?: string }>;

/** A porta que o leitor e o envio usam para saber COMO se autenticar na caixa de um Canal. */
export interface AcessoDoEmail {
  acessoParaUsar(canal: CanalParaProvedor): Promise<AcessoParaUsar>;
}

/** Renova quando o `accessToken` vence em menos de 5 min. */
const MARGEM_DE_RENOVACAO_MS = 5 * 60_000;

/**
 * Grava a credencial renovada numa transação própria: `guardarCredencial` revoga a ativa e insere a nova em duas
 * instruções, e as duas precisam valer juntas. Duas renovações ao mesmo tempo: a segunda esbarra em
 * `credenciais_ativa_unica`, desfaz, e quem chama segue com o token que acabou de receber.
 */
async function gravarRenovada(
  pool: Pick<Pool, "connect">,
  chaves: ChavesDoCofre,
  canal: CanalParaProvedor,
  credencial: CredencialDoEmail,
): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    await guardarCredencialDoEmail(cliente, chaves, { workspaceId: canal.workspaceId, canalId: canal.canal.id }, credencial);
    await cliente.query("commit");
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}

export function criarAcessoDoEmail(
  deps: {
    readonly pool?: () => Pick<Pool, "connect">;
    readonly chaves?: () => ChavesDoCofre;
    readonly renovadores?: Partial<Record<ServicoDeLoginDoEmail, RenovadorDeToken>>;
    readonly agora?: () => number;
  } = {},
): AcessoDoEmail {
  const agora = deps.agora ?? Date.now;
  const pool = deps.pool ?? poolPadrao;
  const chaves = deps.chaves ?? (() => lerChavesDoCofre());
  const renovadores = deps.renovadores ?? {};
  /**
   * Renovações em andamento, por Canal: o leitor e o envio pedem o acesso ao mesmo tempo, e duas renovações ao mesmo tempo
   * girariam o `refreshToken` duas vezes (a Microsoft troca o token a cada uso). Quem chega com uma renovação do Canal em
   * curso espera por ela e usa o resultado: as renovações de um Canal são SERIALIZADAS dentro do processo. Entre processos, a
   * escrita do cofre esbarra em `credenciais_ativa_unica` e a Microsoft não revoga o token antigo (T-17-56).
   */
  const emCurso = new Map<string, Promise<AcessoParaUsar>>();

  async function renovarEGravar(canal: CanalParaProvedor, credencial: Extract<CredencialDoEmail, { tipo: "oauth" }>, renovar: RenovadorDeToken): Promise<AcessoParaUsar> {
    let nova: Awaited<ReturnType<RenovadorDeToken>>;
    try {
      nova = await renovar(credencial.refreshToken);
    } catch (erro) {
      // Só a classe do erro e a frase fixa importam: a mensagem e a causa nunca saem daqui.
      if (erro instanceof ErroDeRenovacao && erro.permanente) {
        return { ok: false, permanente: true, codigo: "AUTORIZACAO_RECUSADA", motivo: erro.frase ?? FRASE_AUTORIZACAO_RECUSADA };
      }
      return { ok: false, permanente: false, codigo: "RENOVACAO_FALHOU", motivo: FRASE_RENOVACAO_FALHOU };
    }

    const renovada: CredencialDoEmail = {
      v: 1,
      tipo: "oauth",
      servico: credencial.servico,
      usuario: credencial.usuario,
      // O `refreshToken` novo (rotação) é gravado ANTES de o antigo deixar de existir: a escrita revoga a ativa e insere a nova
      // na mesma transação.
      refreshToken: nova.refreshToken ?? credencial.refreshToken,
      accessToken: nova.accessToken,
      expiraEm: nova.expiraEm,
    };
    try {
      await gravarRenovada(pool(), chaves(), canal, renovada);
    } catch {
      // Corrida com outra renovação (ou o cofre indisponível): o token recebido vale para este uso; o próximo grava.
    }
    return { ok: true, servico: credencial.servico, auth: { tipo: "oauth", usuario: credencial.usuario, accessToken: nova.accessToken, expiraEm: nova.expiraEm } };
  }

  return {
    async acessoParaUsar(canal) {
      const credencial = lerCredencialDoEmail(canal.credencial);
      if (!credencial) return { ok: false, permanente: true, codigo: "CREDENCIAL_AUSENTE", motivo: FRASE_SEM_CREDENCIAL };

      if (credencial.tipo === "senha") {
        return { ok: true, servico: "senha", auth: { tipo: "senha", usuario: credencial.usuario, senha: credencial.senha } };
      }

      const instante = agora();
      if (credencial.accessToken !== undefined && credencial.expiraEm !== undefined && Date.parse(credencial.expiraEm) - instante > MARGEM_DE_RENOVACAO_MS) {
        return {
          ok: true,
          servico: credencial.servico,
          auth: { tipo: "oauth", usuario: credencial.usuario, accessToken: credencial.accessToken, expiraEm: credencial.expiraEm },
        };
      }

      const renovar = renovadores[credencial.servico];
      if (!renovar) return { ok: false, permanente: false, codigo: "OAUTH_NAO_CONFIGURADO", motivo: FRASE_OAUTH_NAO_CONFIGURADO };

      const chave = `${canal.workspaceId}:${canal.canal.id}`;
      const andando = emCurso.get(chave);
      if (andando) return andando;
      const nova = renovarEGravar(canal, credencial, renovar).finally(() => emCurso.delete(chave));
      emCurso.set(chave, nova);
      return nova;
    },
  };
}

/**
 * A porta montada com o banco e o cofre do processo e os renovadores dos serviços de login que o ambiente configura (17-12,
 * Microsoft; o 17-13 acrescenta o Google em `renovadoresDoAmbiente`). Sem o par de variáveis do serviço, a credencial dele
 * devolve `OAUTH_NAO_CONFIGURADO` (transitório). Uma URI de retorno inválida desliga os renovadores, não derruba a senha.
 */
export function acessoDoEmailDoAmbiente(env: NodeJS.ProcessEnv = process.env): AcessoDoEmail {
  let configuracao;
  try {
    configuracao = lerConfiguracaoDoOauth(env);
  } catch {
    configuracao = undefined;
  }
  return criarAcessoDoEmail({ pool: poolPadrao, chaves: () => lerChavesDoCofre(env), renovadores: renovadoresDoAmbiente(configuracao) });
}
