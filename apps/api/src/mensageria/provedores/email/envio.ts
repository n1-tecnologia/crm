/**
 * A saída do e-mail (Fase 17, 17-09, D-17-03, D-17-16 a D-17-20, EML-05, EML-07): a resposta escrita na Caixa de um Canal de
 * e-mail sai pelo SMTP da caixa conectada, no mesmo fio, e o que o servidor da pessoa não guarda sozinho é copiado a Enviados.
 *
 * O MIME é montado UMA vez (`MailComposer`, SEM campo de cópia oculta) e vai como mensagem pronta (`raw`) com o ENVELOPE dito
 * à parte: o destinatário, as cópias e as cópias ocultas ficam no envelope, e a oculta nunca entra em cabeçalho nenhum, seja
 * qual for o padrão da biblioteca (A6, T-17-35). O mesmo MIME vai ao `APPEND` em Enviados.
 *
 * Quando é ambíguo, nunca se reenvia (T-17-37): o servidor que respondeu (código 4xx ou 5xx) recusou de forma limpa; o que
 * esgotou o tempo ou caiu DEPOIS de a conexão estar de pé pode ter entregue, e a Mensagem fica `falhou` com "confira em Enviados"
 * para a pessoa decidir. Só o que certamente não saiu (não conectou, nome não resolvido, certificado, recusa de login, recusa
 * antes do `DATA`) é transitório ou permanente pelo código.
 *
 * Senha recusada (`EAUTH`) ou autorização retirada passa o Canal a `desconectada` com o motivo (D-17-20) e o resultado leva o
 * código de Canal desconectado: a Mensagem fica `pendente` até a caixa voltar.
 *
 * Nada aqui loga nem devolve senha, token, endereço, assunto ou corpo: os motivos são frases fixas (com, no máximo, o número do
 * código SMTP) e o `registrar` só leva contagens (T-17-38).
 */

import { domainToASCII } from "node:url";
import MailComposer from "nodemailer/lib/mail-composer";
import type { Pool } from "pg";
import { cabecalhosDaResposta, messageIdDaMensagem } from "@n1/dominio/crm/fio-de-email";
import { FRASE_DO_TETO_DO_EMAIL, TETO_DO_EMAIL_ENVIADO_BYTES, type EnderecoAdicional } from "@n1/dominio/crm/mensagens";
import { normalizarEmail } from "@n1/dominio/crm/normalizacao";
import { pool as poolPadrao } from "../../../persistencia/conexao";
import type { ArmazenamentoDeAnexos } from "../../../servicos/armazenamento-de-anexos";
import { CODIGO_DO_CANAL_DESCONECTADO } from "../../fila-de-saida";
import type { CanalParaProvedor, EnvioAoProvedor, ResultadoDoEnvio } from "../../provedor";
import type { AcessoDoEmail, AutenticacaoDoEmail } from "./credencial";
import { classificarErroDeConexao, type FalhaDeConexao } from "./erros";
import type { FabricaDeConexao } from "./fabrica-de-conexao";
import { registrarQuedaDoEmail } from "./queda";
import { RecusaDeRede } from "./rede";
import { contaDoCanal, type ContaDeEmail } from "./repositorio";

export const FRASE_DA_SENHA_RECUSADA_NO_ENVIO = "O servidor SMTP recusou o usuário ou a senha: conecte a caixa de novo.";
export const FRASE_SEM_CONTA = "O Canal não tem a conta de e-mail: conecte-o pela ficha dele.";
const FRASE_SEM_CONFIRMACAO = "O servidor de e-mail não confirmou o envio.";

type Registrar = (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
type Alvo = { readonly workspaceId: string; readonly canalId: string };

export interface DependenciasDoEnvioDeEmail {
  readonly fabrica: FabricaDeConexao;
  /** Como autenticar na caixa do Canal (senha ou token renovado). */
  readonly acesso: AcessoDoEmail;
  /** O bucket: os anexos vêm pela chave, nunca por URL. */
  readonly armazenamento: ArmazenamentoDeAnexos;
  /** A conta (servidores, pasta de enviados) do Canal. Padrão: `contaDoCanal` no banco do processo. */
  readonly contas?: (workspaceId: string, canalId: string) => Promise<ContaDeEmail | undefined>;
  readonly pool?: () => Pool;
  /** Padrão: `registrarQuedaDoEmail` no `pool`. */
  readonly registrarQueda?: (alvo: Alvo, motivo: string) => Promise<unknown>;
  readonly registrar?: Registrar;
}

export interface EnvioDeEmail {
  enviar(canal: CanalParaProvedor, envio: EnvioAoProvedor): Promise<ResultadoDoEnvio>;
  /** O `Message-ID` da Mensagem, sem os colchetes: o mesmo que sai no cabeçalho e que a entrega grava antes de enviar. */
  idExternoDoEnvio(canal: CanalParaProvedor, envio: EnvioAoProvedor): string;
}

/** Pressupostos A4 e A5: o Gmail e o Microsoft 365 já guardam o que sai pelo SMTP deles em Enviados. */
const SERVIDORES_QUE_GUARDAM_SOZINHOS: ReadonlySet<string> = new Set([
  "imap.gmail.com",
  "imap.googlemail.com",
  "outlook.office365.com",
  "outlook.office.com",
  "imap-mail.outlook.com",
]);

/**
 * D-17-17: copiar o e-mail enviado a Enviados por `APPEND`? `sim` e `nao` mandam; em `auto`, copia, EXCETO quando o servidor é
 * o do Gmail ou o do Microsoft 365 (pressupostos A4 e A5: a confirmar na prova real, 9.4.4; trocar por `append_enviados` da
 * conta, sem código, se algum deles se mostrar errado). O login por Google ou Microsoft só existe nesses servidores.
 */
export function deveGuardarEmEnviados(conta: ContaDeEmail): boolean {
  if (conta.appendEnviados === "sim") return true;
  if (conta.appendEnviados === "nao") return false;
  if (conta.tipoDeLogin === "google" || conta.tipoDeLogin === "microsoft") return false;
  return !SERVIDORES_QUE_GUARDAM_SOZINHOS.has(conta.imap.host.trim().toLowerCase());
}

const recusa = (codigo: string, motivo: string): ResultadoDoEnvio => ({ ok: false, transitorio: false, codigo, motivo });
const transitorio = (codigo: string, motivo: string): ResultadoDoEnvio => ({ ok: false, transitorio: true, codigo, motivo });
const ambiguo = (codigo: string, motivo: string): ResultadoDoEnvio => ({ ok: false, transitorio: false, ambiguo: true, codigo, motivo });

// Qualquer caractere de controle (inclui CR, LF e NUL) e os que quebrariam um endereço no envelope ou no cabeçalho.
const CONTROLE = /[\u0000-\u001F\u007F]/g;
const INSEGURO_NO_ENDERECO = /[\u0000-\u001F\u007F\s<>(),;:"\\[\]]/;
const MAX_ASSUNTO = 500;
const MAX_NOME = 200;
const MAX_NOME_DE_ARQUIVO = 200;

/** O endereço normalizado e seguro para o envelope e para o cabeçalho, ou `undefined` (defesa em profundidade: o domínio já validou). */
function enderecoSeguro(valor: string): string | undefined {
  const normalizado = normalizarEmail(valor);
  if (!normalizado.ok) return undefined;
  const endereco = normalizado.value;
  if (endereco.length > 254 || INSEGURO_NO_ENDERECO.test(endereco)) return undefined;
  const [local, dominio, ...resto] = endereco.split("@");
  if (!local || !dominio || resto.length > 0) return undefined;
  const ascii = domainToASCII(dominio);
  return ascii === "" ? undefined : `${local}@${ascii}`;
}

const semControle = (valor: string): string => valor.replace(CONTROLE, " ").replace(/\s+/g, " ").trim();

function nomeDeExibicao(nome: string | undefined): string | undefined {
  if (nome === undefined) return undefined;
  const limpo = semControle(nome).replace(/[<>"]/g, "").slice(0, MAX_NOME).trim();
  return limpo === "" ? undefined : limpo;
}

function nomeDoArquivo(nome: string, indice: number): string {
  const limpo = semControle(nome).replace(/[\\/"<>:*?|]/g, "_").slice(0, MAX_NOME_DE_ARQUIVO).trim();
  return limpo === "" ? `anexo-${indice + 1}` : limpo;
}

const TIPO_DE_MIDIA = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const tipoSeguro = (tipo: string): string => (TIPO_DE_MIDIA.test(tipo) ? tipo.toLowerCase() : "application/octet-stream");

/** O texto como HTML simples: tudo escapado, quebra de linha vira `<br>`. */
function htmlDoTexto(texto: string): string {
  const escapado = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return `<div>${escapado.replace(/\r\n|\r|\n/g, "<br>\n")}</div>`;
}

/** Os ids do fio como cabeçalho: com colchetes, só os que têm forma de id (sem controle, sem `<` nem `>`). */
const comColchetes = (ids: readonly string[]): string[] => ids.filter((id) => id !== "" && !/[\u0000-\u001F\u007F\s<>]/.test(id)).map((id) => `<${id}>`);

interface ErroLido {
  readonly code?: string;
  readonly originalCode?: string;
  readonly command?: string;
  readonly responseCode?: number;
  readonly timeoutType?: string;
}

function lerErro(erro: unknown): ErroLido {
  if (typeof erro !== "object" || erro === null) return {};
  const e = erro as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);
  const codigo = typeof e.responseCode === "number" && Number.isFinite(e.responseCode) ? e.responseCode : undefined;
  return {
    ...(texto(e.code) !== undefined ? { code: texto(e.code)! } : {}),
    ...(texto(e.originalCode) !== undefined ? { originalCode: texto(e.originalCode)! } : {}),
    ...(texto(e.command) !== undefined ? { command: texto(e.command)! } : {}),
    ...(codigo !== undefined ? { responseCode: codigo } : {}),
    ...(texto(e.timeoutType) !== undefined ? { timeoutType: texto(e.timeoutType)! } : {}),
  };
}

/** Os erros que só acontecem ANTES de a mensagem ser enviada: nada chegou ao servidor. */
const CODIGOS_DE_ANTES_DA_CONEXAO = new Set(["ECONNREFUSED", "ENOTFOUND", "EDNS", "EHOSTUNREACH", "ENETUNREACH", "EAI_AGAIN"]);
const TEMPOS_DE_ANTES_DO_ENVIO = new Set(["CONNECT_TIMEOUT", "GREETING_TIMEOUT", "UPGRADE_TIMEOUT"]);

function resultadoDeFalhaDeConexao(falha: FalhaDeConexao): ResultadoDoEnvio {
  const codigo = `SMTP_${falha.tipo.toUpperCase()}`;
  return falha.permanente ? recusa(codigo, falha.frase) : transitorio(codigo, falha.frase);
}

export function criarEnvioDeEmail(deps: DependenciasDoEnvioDeEmail): EnvioDeEmail {
  const { fabrica, acesso, armazenamento } = deps;
  const pool = deps.pool ?? poolPadrao;
  const contas = deps.contas ?? ((workspaceId: string, canalId: string) => contaDoCanal(pool(), workspaceId, canalId));
  const registrarQueda = deps.registrarQueda ?? ((alvo: Alvo, motivo: string) => registrarQuedaDoEmail(pool, alvo, motivo));
  const registrar: Registrar = deps.registrar ?? (() => undefined);

  const idExternoDoEnvio = (canal: CanalParaProvedor, envio: EnvioAoProvedor): string =>
    messageIdDaMensagem(envio.mensagemId, canal.canal.identificadorExterno);

  /** D-17-20: a caixa recusou a senha (ou a autorização foi retirada). O Canal cai e a Mensagem espera a reconexão. */
  async function caixaCaiu(canal: CanalParaProvedor, motivo: string): Promise<ResultadoDoEnvio> {
    try {
      await registrarQueda({ workspaceId: canal.workspaceId, canalId: canal.canal.id }, motivo);
    } catch {
      // Não registrou a queda: nada foi enviado, e a Mensagem tenta de novo (senão ficaria à espera de uma reconexão que nunca viria).
      return transitorio("ERRO_AO_REGISTRAR_QUEDA", "Não foi possível registrar a queda da caixa agora.");
    }
    return recusa(CODIGO_DO_CANAL_DESCONECTADO, motivo);
  }

  /** O desfecho de um envio que falhou DEPOIS de a conexão ser pedida. Nunca devolve o texto do servidor. */
  async function resultadoDoErro(canal: CanalParaProvedor, erro: unknown, auth: AutenticacaoDoEmail): Promise<ResultadoDoEnvio> {
    if (erro instanceof RecusaDeRede) return resultadoDeFalhaDeConexao(classificarErroDeConexao(erro, "smtp"));
    const { code, originalCode, command, responseCode, timeoutType } = lerErro(erro);
    const segredos = auth.tipo === "senha" ? [auth.senha] : [auth.accessToken];

    // Recusa de login: 4xx é temporário do servidor; o resto é a senha (ou o token) que deixou de valer.
    if (code === "EAUTH" || (erro as { authenticationFailed?: unknown } | null)?.authenticationFailed === true) {
      if (responseCode !== undefined && responseCode >= 400 && responseCode < 500) {
        return transitorio("SMTP_LOGIN_TEMPORARIO", "O servidor SMTP não pôde autenticar agora.");
      }
      return caixaCaiu(canal, FRASE_DA_SENHA_RECUSADA_NO_ENVIO);
    }

    // O servidor respondeu: recusa limpa, antes ou no `DATA`. Pelo código, repetir adianta (4xx, 503) ou não (5xx).
    if (responseCode !== undefined) {
      const permanente = responseCode >= 500 && responseCode !== 503;
      const onde = command === "RCPT TO" ? "o destinatário" : command === "MAIL FROM" ? "o remetente" : "a Mensagem";
      return permanente
        ? recusa(`SMTP_${responseCode}`, `O servidor de e-mail recusou ${onde} (código ${responseCode}).`)
        : transitorio(`SMTP_${responseCode}`, `O servidor de e-mail não pôde receber agora (código ${responseCode}).`);
    }

    // Endereço que o transporte recusou sem falar com o servidor.
    if (code === "EENVELOPE") return recusa("DESTINO_INVALIDO", "Um dos endereços do e-mail não é válido.");

    // Falhas que acontecem antes de o servidor ouvir a Mensagem: certamente não saiu.
    const antesDaConexao =
      (originalCode !== undefined && CODIGOS_DE_ANTES_DA_CONEXAO.has(originalCode)) ||
      (code !== undefined && CODIGOS_DE_ANTES_DA_CONEXAO.has(code)) ||
      (timeoutType !== undefined && TEMPOS_DE_ANTES_DO_ENVIO.has(timeoutType)) ||
      code === "ETLS" ||
      // O certificado que não confere recusa o aperto de mão do TLS: a Mensagem nem chegou a ser dita ao servidor.
      classificarErroDeConexao(erro, "smtp", segredos).tipo === "certificado";
    if (antesDaConexao) return resultadoDeFalhaDeConexao(classificarErroDeConexao(erro, "smtp", segredos));

    // Tempo esgotado ou conexão caída com a sessão de pé: o servidor pode ter aceitado. Nunca reenvia sozinho.
    return ambiguo(code === "ETIMEDOUT" ? "SMTP_TEMPO_ESGOTADO" : "SMTP_SEM_CONFIRMACAO", FRASE_SEM_CONFIRMACAO);
  }

  /** D-17-17: copia o e-mail enviado a Enviados. Qualquer falha só é registrada: a Mensagem já saiu. */
  async function guardarEmEnviados(conta: ContaDeEmail, auth: AutenticacaoDoEmail, raw: Buffer): Promise<void> {
    if (!deveGuardarEmEnviados(conta)) return;
    if (conta.pastaEnviados === null || conta.pastaEnviados === "") {
      registrar("info", "email.enviados.sem_pasta");
      return;
    }
    try {
      const imap = await fabrica.abrirImap({ host: conta.imap.host, porta: conta.imap.porta, auth, uso: "envio" });
      try {
        await imap.append(conta.pastaEnviados, raw, ["\\Seen"]);
        await imap.logout();
      } catch (erro) {
        try {
          imap.close();
        } catch {
          // já fechado
        }
        throw erro;
      }
    } catch (erro) {
      registrar("warn", "email.enviados.falhou", { tipo: classificarErroDeConexao(erro, "imap").tipo });
    }
  }

  async function enviar(canal: CanalParaProvedor, envio: EnvioAoProvedor): Promise<ResultadoDoEnvio> {
    if (envio.destino.tipo !== "email") return recusa("DESTINO_INVALIDO", "Este Canal só responde a um endereço de e-mail.");
    const destino = enderecoSeguro(envio.destino.valor);
    if (destino === undefined) return recusa("DESTINO_INVALIDO", "O e-mail do Contato não é válido.");
    const remetente = enderecoSeguro(canal.canal.identificadorExterno);
    if (remetente === undefined) return recusa("REMETENTE_INVALIDO", "O endereço do Canal de e-mail não é válido.");

    // Para, Cópia e Cópia oculta: cada endereço uma vez só (a primeira função vence), a oculta só no envelope.
    const vistos = new Set<string>([destino]);
    const para: { name?: string; address: string }[] = [{ address: destino }];
    const copia: { name?: string; address: string }[] = [];
    const ocultos: string[] = [];
    for (const adicional of envio.enderecosAdicionais ?? ([] as readonly EnderecoAdicional[])) {
      const endereco = enderecoSeguro(adicional.endereco);
      if (endereco === undefined) return recusa("DESTINO_INVALIDO", "Um dos endereços do e-mail não é válido.");
      if (vistos.has(endereco)) continue;
      vistos.add(endereco);
      const nome = nomeDeExibicao(adicional.nomeExibido);
      const item = { ...(nome === undefined ? {} : { name: nome }), address: endereco };
      if (adicional.tipo === "para") para.push(item);
      else if (adicional.tipo === "copia") copia.push(item);
      else ocultos.push(endereco);
    }

    const texto = envio.conteudo ?? "";
    const anexosDoEnvio = envio.anexos ?? [];
    if (texto.trim() === "" && anexosDoEnvio.length === 0) return recusa("MENSAGEM_VAZIA", "A Mensagem está vazia.");

    // D-17-18: o teto do total, conferido antes de baixar nada e de abrir o SMTP.
    const somaConhecida = anexosDoEnvio.reduce((soma, anexo) => soma + (anexo.tamanhoBytes ?? 0), 0);
    if (somaConhecida > TETO_DO_EMAIL_ENVIADO_BYTES) return recusa("EMAIL_GRANDE_DEMAIS", FRASE_DO_TETO_DO_EMAIL);

    // Antes de qualquer conexão: uma falha aqui certamente não enviou.
    let conta: ContaDeEmail | undefined;
    let auth: AutenticacaoDoEmail;
    try {
      conta = await contas(canal.workspaceId, canal.canal.id);
      if (!conta) return recusa("CONTA_NAO_ENCONTRADA", FRASE_SEM_CONTA);
      const acessoLido = await acesso.acessoParaUsar(canal);
      if (!acessoLido.ok) {
        if (acessoLido.codigo === "AUTORIZACAO_RECUSADA") return await caixaCaiu(canal, acessoLido.motivo);
        return acessoLido.permanente ? recusa(acessoLido.codigo, acessoLido.motivo) : transitorio(acessoLido.codigo, acessoLido.motivo);
      }
      auth = acessoLido.auth;
    } catch {
      return transitorio("ERRO_ANTES_DO_ENVIO", "Não foi possível preparar o envio do e-mail.");
    }

    // Os arquivos vêm do bucket pela chave, nunca por URL, e a soma real é conferida de novo.
    const arquivos: { filename: string; contentType: string; content: Buffer; contentDisposition: "attachment" }[] = [];
    let restante = TETO_DO_EMAIL_ENVIADO_BYTES;
    for (const [i, anexo] of anexosDoEnvio.entries()) {
      if (anexo.objectKey === undefined || anexo.objectKey === "") return recusa("ANEXO_INDISPONIVEL", "O arquivo desta Mensagem não está disponível.");
      try {
        const bytes = await armazenamento.baixar(anexo.objectKey, { tetoBytes: restante });
        restante -= bytes.byteLength;
        arquivos.push({
          filename: nomeDoArquivo(anexo.nome, i),
          contentType: tipoSeguro(anexo.tipoDeMidia),
          content: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
          contentDisposition: "attachment",
        });
      } catch (erro) {
        if (erro instanceof Error && erro.message === "objeto_grande_demais") return recusa("EMAIL_GRANDE_DEMAIS", FRASE_DO_TETO_DO_EMAIL);
        // A mensagem do erro do bucket pode citar a chave do objeto: não sobe.
        return transitorio("ARMAZENAMENTO_INDISPONIVEL", "O arquivo não pôde ser preparado para o envio.");
      }
    }

    // O MIME, sem cópia oculta, sem ler arquivo nem URL (T-17-35, T-17-36).
    const fio = cabecalhosDaResposta({ idsDoFio: envio.referencias ?? [], ...(envio.emRespostaAIdExterno === undefined ? {} : { respondida: envio.emRespostaAIdExterno }) });
    const referencias = comColchetes(fio.references);
    const respondida = fio.inReplyTo === undefined ? [] : comColchetes([fio.inReplyTo]);
    const assunto = semControle(envio.assunto ?? "").slice(0, MAX_ASSUNTO);
    let raw: Buffer;
    try {
      raw = await new MailComposer({
        from: remetente,
        to: para,
        ...(copia.length > 0 ? { cc: copia } : {}),
        ...(assunto === "" ? {} : { subject: assunto }),
        messageId: `<${idExternoDoEnvio(canal, envio)}>`,
        ...(respondida[0] === undefined ? {} : { inReplyTo: respondida[0] }),
        ...(referencias.length === 0 ? {} : { references: referencias }),
        ...(texto.trim() === "" ? {} : { text: texto, html: htmlDoTexto(texto) }),
        ...(arquivos.length === 0 ? {} : { attachments: arquivos }),
        disableFileAccess: true,
        disableUrlAccess: true,
      })
        .compile()
        .build();
    } catch {
      return recusa("MIME_INVALIDO", "Não foi possível montar o e-mail.");
    }

    // O envelope diz a quem entregar; só ele conhece a cópia oculta.
    const envelope = { from: remetente, to: [...vistos] };

    let transporte;
    try {
      transporte = await fabrica.abrirSmtp({ host: conta.smtp.host, porta: conta.smtp.porta, auth, uso: "envio" });
    } catch (erro) {
      return resultadoDoErro(canal, erro, auth);
    }

    let recusados = 0;
    try {
      const info = (await transporte.sendMail({ envelope, raw })) as { accepted?: unknown[]; rejected?: unknown[] };
      recusados = info.rejected?.length ?? 0;
      if ((info.accepted?.length ?? 1) === 0) return recusa("SMTP_SEM_DESTINATARIO_ACEITO", "O servidor de e-mail não aceitou nenhum destinatário.");
    } catch (erro) {
      return resultadoDoErro(canal, erro, auth);
    } finally {
      transporte.close();
    }
    // Um destinatário recusado com algum aceito é `ok`: só a contagem, nunca o endereço, vai ao registro.
    if (recusados > 0) registrar("warn", "email.envio.destinatarios_recusados", { recusados });

    await guardarEmEnviados(conta, auth, raw);
    return { ok: true, idExterno: idExternoDoEnvio(canal, envio) };
  }

  return { enviar, idExternoDoEnvio };
}
