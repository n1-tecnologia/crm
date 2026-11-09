/**
 * Envio em duas fases contra o bucket privado do Supabase Storage (D-04,
 * `02-RESEARCH.md` §"Storage e envio em duas fases"): o navegador nunca
 * recebe a service role, só um ticket assinado de escopo mínimo; o servidor
 * verifica o que chegou de verdade antes de deixar o objeto virar anexo.
 *
 * A service role de Storage vive só aqui (e em `autenticacao/`, que
 * constrói o client admin que este módulo reutiliza via `clienteAdmin()`) —
 * nenhuma rota devolve `SUPABASE_STORAGE_BUCKET` nem qualquer credencial.
 *
 * Funções puras (assinatura de arquivo, limites, caminho do objeto) são
 * exportadas separadas das funções de orquestração (`abrirSessaoDeUpload`,
 * `emitirTicket`, `confirmarObjeto`, `urlDeDownload`, `coletarOrfaos`) para a
 * suíte de teste cobrir a lógica de recusa sem precisar de banco nem de
 * bucket de teste — `storage-uploads.test.ts` §"Seção pura".
 */

import { createHash, randomUUID } from "node:crypto";
import { normalizarTipoDeMidia, tetoDaMidia, TETO_PADRAO_DE_MIDIA_BYTES } from "@n1/dominio/crm/midia";
import { clienteAdmin } from "../autenticacao/verificar-token";
import { carregarEnv } from "../persistencia/conexao";
import {
  marcarEnviado,
  marcarExpirados,
  objetosDaSessao,
  obterSessao,
  reservarObjeto,
  sessoesExpiradas,
  criarSessao,
} from "../persistencia/sessoes-de-upload";

carregarEnv();

// ---------------------------------------------------------------------------
// Limites — lidos de env com o padrão de `apps/api/.env.example`; a copy
// congelada do UI-SPEC ("PDF, XML, JPG, PNG ou WebP. Até 25 MB por arquivo e
// 10 arquivos por envio.") depende destes números — mudar um exige mudar a
// copy.
// ---------------------------------------------------------------------------

const PADRAO_MAX_BYTES_POR_ARQUIVO = 25 * 1024 * 1024;
const PADRAO_MAX_ARQUIVOS_POR_ENVIO = 10;
const PADRAO_TTL_UPLOAD_SEGUNDOS = 2 * 60 * 60;
const PADRAO_TTL_DOWNLOAD_SEGUNDOS = 5 * 60;
const PADRAO_TETO_SHA256_BYTES = 10 * 1024 * 1024;

export const MAX_BYTES_POR_ARQUIVO = Number(process.env.UPLOAD_MAX_BYTES ?? PADRAO_MAX_BYTES_POR_ARQUIVO);

/**
 * D-16-08: os dois tetos de tamanho da Mensagem. `UPLOAD_MAX_BYTES_MIDIA` vale para áudio e vídeo (padrão 16 MiB) e
 * `UPLOAD_MAX_BYTES` para os demais tipos (padrão 25 MiB). O `env` é parâmetro só para o teste.
 */
export function tetosDeMidia(env: NodeJS.ProcessEnv = process.env): { readonly midia: number; readonly demais: number } {
  return {
    midia: Number(env.UPLOAD_MAX_BYTES_MIDIA ?? TETO_PADRAO_DE_MIDIA_BYTES),
    demais: Number(env.UPLOAD_MAX_BYTES ?? PADRAO_MAX_BYTES_POR_ARQUIVO),
  };
}
export const MAX_BYTES_DE_MIDIA = tetosDeMidia().midia;

/** O teto de tamanho do tipo: áudio e vídeo 16 MiB, o resto 25 MiB (D-16-08). */
export function tetoDoTipo(mediaType: string): number {
  return tetoDaMidia(mediaType, { midia: MAX_BYTES_DE_MIDIA, demais: MAX_BYTES_POR_ARQUIVO });
}
export const MAX_ARQUIVOS_POR_ENVIO = Number(process.env.UPLOAD_MAX_ARQUIVOS ?? PADRAO_MAX_ARQUIVOS_POR_ENVIO);
export const TTL_UPLOAD = Number(process.env.UPLOAD_TTL_SEGUNDOS ?? PADRAO_TTL_UPLOAD_SEGUNDOS);
export const TTL_DOWNLOAD = Number(process.env.DOWNLOAD_TTL_SEGUNDOS ?? PADRAO_TTL_DOWNLOAD_SEGUNDOS);
/** Acima disto o sha-256 não é calculado — `confirmarObjeto` registra `sha256: undefined` sem falhar. */
export const TETO_SHA256_BYTES = Number(process.env.UPLOAD_SHA256_MAX_BYTES ?? PADRAO_TETO_SHA256_BYTES);

export const TIPOS_ACEITOS = [
  "application/pdf",
  "application/xml",
  "text/xml",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type TipoAceito = (typeof TIPOS_ACEITOS)[number];

// ---------------------------------------------------------------------------
// Funções puras — sem I/O, testadas sem env (Seção pura de storage-uploads.test.ts)
// ---------------------------------------------------------------------------

export function tipoAceito(mediaType: string): mediaType is TipoAceito {
  return (TIPOS_ACEITOS as readonly string[]).includes(mediaType);
}

export function tamanhoAceito(sizeBytes: number, teto: number = MAX_BYTES_POR_ARQUIVO): boolean {
  return sizeBytes > 0 && sizeBytes <= teto;
}

export function limiteDeArquivosAtingido(quantidadeAtual: number): boolean {
  return quantidadeAtual >= MAX_ARQUIVOS_POR_ENVIO;
}

/**
 * Caminho aleatório do objeto — nunca o nome de arquivo que o usuário
 * escolheu, porque nome de arquivo de nota fiscal costuma conter razão
 * social e valor (T-02-14).
 */
export function gerarObjectKey(args: {
  readonly workspaceId: string;
  readonly formId: string;
  readonly submissionId: string;
  /** Sem ele, a chave do Formulário e da Tarefa (`workspace/<ws>/forms/<form>/<sessão>/<uuid>`); com ele, `<prefixo>/<uuid>`. */
  readonly prefixo?: string;
}): string {
  if (args.prefixo !== undefined) return `${args.prefixo}/${randomUUID()}`;
  return `workspace/${args.workspaceId}/forms/${args.formId}/${args.submissionId}/${randomUUID()}`;
}

const ASSINATURA_PDF = Buffer.from("%PDF-", "ascii");
const ASSINATURA_JPEG = Uint8Array.from([0xff, 0xd8, 0xff]); // \xFF\xD8\xFF
const ASSINATURA_PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]); // \x89PNG
const MARCADOR_RIFF = Buffer.from("RIFF", "ascii");
const MARCADOR_WEBP = Buffer.from("WEBP", "ascii"); // RIFF....WEBP
const ESPACOS_ASCII = new Set([0x20, 0x09, 0x0d, 0x0a]);
const ASSINATURA_OGG = Buffer.from("OggS", "ascii");
const ASSINATURA_ID3 = Buffer.from("ID3", "ascii");
const MARCADOR_FTYP = Buffer.from("ftyp", "ascii"); // no byte 4 de MP4, M4A e 3GP
const INICIO_DE_ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04: o primeiro arquivo do pacote
const ZIP_VAZIO = Uint8Array.from([0x50, 0x4b, 0x05, 0x06]); // PK\x05\x06: só o fim do diretório

const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TIPO_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function comecaCom(bytes: Uint8Array, marcador: Uint8Array, offset = 0): boolean {
  if (bytes.length < offset + marcador.length) return false;
  for (let i = 0; i < marcador.length; i += 1) {
    if (bytes[offset + i] !== marcador[i]) return false;
  }
  return true;
}

/** Quantos bytes do começo valem para decidir se um arquivo é texto (csv e txt não têm assinatura). */
const BYTES_PARA_DECIDIR_SE_E_TEXTO = 4096;

/**
 * csv e txt não têm assinatura: só valem se o conteúdo for TEXTO. Recusa `NUL` e os controles C0 que não sejam tab, LF,
 * CR e FF. Não exige UTF-8: o CSV que o Excel brasileiro exporta costuma sair em Windows-1252, com `;` (A7).
 */
export function pareceTexto(bytes: Uint8Array): boolean {
  const limite = Math.min(bytes.length, BYTES_PARA_DECIDIR_SE_E_TEXTO);
  for (let i = 0; i < limite; i += 1) {
    const b = bytes[i]!;
    if (b === 0x00) return false;
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0c && b !== 0x0d) return false;
  }
  return true;
}

export type FamiliaDeZip = "docx" | "xlsx" | "pptx" | "zip";

const TAMANHO_DO_FIM_DO_DIRETORIO = 22;
const MAIOR_COMENTARIO_DE_ZIP = 0xffff;
const ASSINATURA_DO_FIM_DO_DIRETORIO = 0x06054b50;
const ASSINATURA_DE_ENTRADA_DO_DIRETORIO = 0x02014b50;
const TAMANHO_DA_ENTRADA_DO_DIRETORIO = 46;

const u16 = (bytes: Uint8Array, i: number): number => bytes[i]! | (bytes[i + 1]! << 8);
const u32 = (bytes: Uint8Array, i: number): number => (bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24)) >>> 0;

/** A posição do registro de fim do diretório central (EOCD), nos últimos 64 KiB, ou `undefined`. */
function acharFimDoDiretorio(bytes: Uint8Array): number | undefined {
  if (bytes.length < TAMANHO_DO_FIM_DO_DIRETORIO) return undefined;
  const maisBaixo = Math.max(0, bytes.length - TAMANHO_DO_FIM_DO_DIRETORIO - MAIOR_COMENTARIO_DE_ZIP);
  for (let i = bytes.length - TAMANHO_DO_FIM_DO_DIRETORIO; i >= maisBaixo; i -= 1) {
    // O comprimento do comentário tem de fechar exatamente no fim do arquivo: um comentário que imita o EOCD não passa.
    if (u32(bytes, i) === ASSINATURA_DO_FIM_DO_DIRETORIO && i + TAMANHO_DO_FIM_DO_DIRETORIO + u16(bytes, i + 20) === bytes.length) return i;
  }
  return undefined;
}

/**
 * Decide, sem descomprimir nada, de que família de ZIP um arquivo é (T-16-32: nenhuma zip-bomb se abre). Acha o fim do
 * diretório central, lê SÓ os nomes das entradas e confere a estrutura: `[Content_Types].xml` e a pasta `word/`, `xl/` ou
 * `ppt/` dizem docx, xlsx ou pptx; um zip consistente sem isso é `zip`; o que não tem diretório central consistente
 * (bytes que só começam com `PK`) devolve `undefined`. ZIP64 não é lido e também devolve `undefined`: um arquivo de
 * até 25 MiB não precisa dele. A leitura nunca passa do diretório declarado, então um número de entradas inflado acaba cedo.
 */
export function familiaDoZip(bytes: Uint8Array): FamiliaDeZip | undefined {
  const fim = acharFimDoDiretorio(bytes);
  if (fim === undefined) return undefined;
  const entradas = u16(bytes, fim + 10);
  const tamanhoDoDiretorio = u32(bytes, fim + 12);
  const inicioDoDiretorio = u32(bytes, fim + 16);
  if (entradas === 0xffff || tamanhoDoDiretorio === 0xffffffff || inicioDoDiretorio === 0xffffffff) return undefined;
  const fimDoDiretorio = inicioDoDiretorio + tamanhoDoDiretorio;
  if (fimDoDiretorio > fim) return undefined;
  if (entradas === 0) return tamanhoDoDiretorio === 0 ? "zip" : undefined;

  const nomes = new TextDecoder("utf-8");
  let temTiposDeConteudo = false;
  let temWord = false;
  let temPlanilha = false;
  let temApresentacao = false;
  let posicao = inicioDoDiretorio;
  for (let n = 0; n < entradas; n += 1) {
    if (posicao + TAMANHO_DA_ENTRADA_DO_DIRETORIO > fimDoDiretorio) return undefined;
    if (u32(bytes, posicao) !== ASSINATURA_DE_ENTRADA_DO_DIRETORIO) return undefined;
    const tamanhoDoNome = u16(bytes, posicao + 28);
    const proxima = posicao + TAMANHO_DA_ENTRADA_DO_DIRETORIO + tamanhoDoNome + u16(bytes, posicao + 30) + u16(bytes, posicao + 32);
    if (proxima > fimDoDiretorio) return undefined;
    const nome = nomes.decode(bytes.subarray(posicao + TAMANHO_DA_ENTRADA_DO_DIRETORIO, posicao + TAMANHO_DA_ENTRADA_DO_DIRETORIO + tamanhoDoNome));
    if (nome === "[Content_Types].xml") temTiposDeConteudo = true;
    else if (nome.startsWith("word/")) temWord = true;
    else if (nome.startsWith("xl/")) temPlanilha = true;
    else if (nome.startsWith("ppt/")) temApresentacao = true;
    posicao = proxima;
  }
  if (!temTiposDeConteudo) return "zip";
  if (temWord) return "docx";
  if (temPlanilha) return "xlsx";
  if (temApresentacao) return "pptx";
  return "zip";
}

/**
 * MIME declarado pelo cliente não basta (T-02-06/Tampering): confere o CONTEÚDO contra a assinatura de arquivo do tipo
 * alegado — `audio/ogg; codecs=opus` vale como `audio/ogg`. XML não tem assinatura binária fixa — exige que o primeiro
 * caractere não-espaço seja `<`; csv e txt só valem se o conteúdo for texto (`pareceTexto`). docx, xlsx e pptx começam
 * por `PK` como qualquer zip, então além disso o diretório central tem de trazer `[Content_Types].xml` e a pasta do
 * formato (`familiaDoZip`). Para o zip e o Office, passe o conteúdo INTEIRO: o diretório central fica no fim do arquivo.
 */
export function assinaturaConfereComTipo(primeirosBytes: Uint8Array, mediaType: string): boolean {
  switch (normalizarTipoDeMidia(mediaType)) {
    case "application/pdf":
      return comecaCom(primeirosBytes, ASSINATURA_PDF);
    case "image/jpeg":
      return comecaCom(primeirosBytes, ASSINATURA_JPEG);
    case "image/png":
      return comecaCom(primeirosBytes, ASSINATURA_PNG);
    case "image/webp":
      return comecaCom(primeirosBytes, MARCADOR_RIFF) && comecaCom(primeirosBytes, MARCADOR_WEBP, 8);
    case "application/xml":
    case "text/xml": {
      let indice = 0;
      while (indice < primeirosBytes.length && ESPACOS_ASCII.has(primeirosBytes[indice]!)) indice += 1;
      return primeirosBytes[indice] === 0x3c; // '<'
    }
    case "audio/ogg":
      return comecaCom(primeirosBytes, ASSINATURA_OGG);
    case "audio/mpeg":
      // ID3 (com etiqueta) ou o quadro MPEG de camada III sem etiqueta: 0xFF 0xFB, 0xF3 ou 0xF2.
      return (
        comecaCom(primeirosBytes, ASSINATURA_ID3) ||
        (primeirosBytes[0] === 0xff && (primeirosBytes[1] === 0xfb || primeirosBytes[1] === 0xf3 || primeirosBytes[1] === 0xf2))
      );
    case "audio/mp4":
    case "video/mp4":
    case "video/3gpp":
      return comecaCom(primeirosBytes, MARCADOR_FTYP, 4);
    case "audio/aac":
      // Cabeçalho ADTS: 0xFFF1 (MPEG-4) ou 0xFFF9 (MPEG-2).
      return primeirosBytes[0] === 0xff && (primeirosBytes[1] === 0xf1 || primeirosBytes[1] === 0xf9);
    case "application/zip":
      return (comecaCom(primeirosBytes, INICIO_DE_ZIP) || comecaCom(primeirosBytes, ZIP_VAZIO)) && familiaDoZip(primeirosBytes) !== undefined;
    case TIPO_DOCX:
      return comecaCom(primeirosBytes, INICIO_DE_ZIP) && familiaDoZip(primeirosBytes) === "docx";
    case TIPO_XLSX:
      return comecaCom(primeirosBytes, INICIO_DE_ZIP) && familiaDoZip(primeirosBytes) === "xlsx";
    case TIPO_PPTX:
      return comecaCom(primeirosBytes, INICIO_DE_ZIP) && familiaDoZip(primeirosBytes) === "pptx";
    case "text/csv":
    case "text/plain":
      return pareceTexto(primeirosBytes);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Orquestração — fala com a tabela de sessões (Task 1) e com o Storage do
// Supabase. Sem `deps`: a suíte de integração roda contra o banco e o
// bucket de teste reais, pulando sem `DATABASE_URL`/`SUPABASE_STORAGE_BUCKET`.
// ---------------------------------------------------------------------------

function nomeDoBucket(): string {
  const nome = process.env.SUPABASE_STORAGE_BUCKET;
  if (!nome) throw new Error("SUPABASE_STORAGE_BUCKET precisa estar em apps/api/.env.");
  return nome;
}

/** A service role NUNCA sai desta função — só o client admin já existente de `autenticacao/`. */
function armazenamento() {
  return clienteAdmin().storage.from(nomeDoBucket());
}

export interface SessaoDeUploadAberta {
  readonly submissionId: string;
  readonly expiresAt: Date;
}

/** Cria a sessão de upload. `submissionId` é opaco (uuid), nunca derivado do segredo do Formulário. */
export async function abrirSessaoDeUpload(args: {
  readonly workspaceId: string;
  readonly formId: string;
}): Promise<SessaoDeUploadAberta> {
  const sessao = await criarSessao({ workspaceId: args.workspaceId, formId: args.formId, ttlSegundos: TTL_UPLOAD });
  return { submissionId: sessao.id, expiresAt: sessao.expiresAt };
}

async function sessaoValidaParaEmissao(submissionId: string) {
  const sessao = await obterSessao(submissionId);
  if (!sessao) throw new Error(`sessao_inexistente: ${submissionId}`);
  if (sessao.consumedAt) throw new Error(`sessao_consumida: ${submissionId}`);
  if (sessao.expiresAt.getTime() < Date.now()) throw new Error(`sessao_expirada: ${submissionId}`);
  return sessao;
}

/** O que muda no ticket da Mensagem (16-09); sem isto vale o do Formulário. */
export interface OpcoesDeTicket {
  /** Os tipos aceitos, já normalizados. Padrão: `TIPOS_ACEITOS`. */
  readonly tipos?: readonly string[];
  /** A chave do objeto vira `<prefixo>/<uuid>`. Padrão: `workspace/<ws>/forms/<form>/<sessão>/<uuid>`. */
  readonly prefixoDaChave?: string;
  /** O teto de tamanho do arquivo. Padrão: `MAX_BYTES_POR_ARQUIVO`. */
  readonly tetoBytes?: number;
  /** O tamanho que o cliente diz que vai subir: acima do teto, o ticket não sai. */
  readonly tamanhoBytes?: number;
}

export interface TicketDeUpload {
  readonly objectId: string;
  readonly objectKey: string;
  readonly uploadUrl: string;
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Emite o ticket de upload de escopo mínimo. Valida tipo, existência e
 * validade da sessão, e o teto de arquivos por envio ANTES de reservar o
 * objeto e pedir a URL assinada — nada é reservado se qualquer validação
 * recusar.
 */
export async function emitirTicket(
  args: {
    readonly submissionId: string;
    readonly displayName: string;
    readonly mediaType: string;
  },
  opcoes?: OpcoesDeTicket,
): Promise<TicketDeUpload> {
  // Sem `opcoes`, o comportamento do Formulário e da Tarefa: a lista `TIPOS_ACEITOS`, a chave de `forms/`, 25 MiB.
  const tipo = normalizarTipoDeMidia(args.mediaType);
  const tipos = opcoes?.tipos ?? TIPOS_ACEITOS;
  if (!tipos.includes(tipo)) throw new Error(`tipo_nao_aceito: ${tipo}`);
  if (opcoes?.tamanhoBytes !== undefined && !tamanhoAceito(opcoes.tamanhoBytes, opcoes.tetoBytes ?? MAX_BYTES_POR_ARQUIVO)) {
    throw new Error(`tamanho_excedido: ${args.submissionId}`);
  }

  const sessao = await sessaoValidaParaEmissao(args.submissionId);

  const existentes = await objetosDaSessao(args.submissionId);
  if (limiteDeArquivosAtingido(existentes.length)) {
    throw new Error(`limite_de_arquivos_atingido: ${args.submissionId}`);
  }

  const objectKey = gerarObjectKey({
    workspaceId: sessao.workspaceId,
    formId: sessao.formId,
    submissionId: args.submissionId,
    ...(opcoes?.prefixoDaChave !== undefined ? { prefixo: opcoes.prefixoDaChave } : {}),
  });

  const objeto = await reservarObjeto({
    sessionId: args.submissionId,
    objectKey,
    displayName: args.displayName,
    mediaType: tipo,
  });

  const { data, error } = await armazenamento().createSignedUploadUrl(objectKey, { upsert: false });
  if (error || !data) throw new Error(`falha_ao_criar_ticket: ${error?.message ?? "sem dados do provedor"}`);

  return {
    objectId: objeto.id,
    objectKey,
    uploadUrl: data.signedUrl,
    token: data.token,
    expiresAt: new Date(Date.now() + TTL_UPLOAD * 1000),
  };
}

export type MotivoDeRecusaDeConfirmacao =
  | "objeto_nao_pertence_a_sessao"
  | "objeto_ausente"
  | "tamanho_excedido"
  | "tipo_nao_confere"
  | "assinatura_nao_confere";

export type ResultadoDeConfirmacao =
  | {
      readonly ok: true;
      readonly objectId: string;
      readonly sizeBytes: number;
      readonly sha256?: string;
      /** A chave do objeto, o tipo RESERVADO (normalizado) e o nome de exibição: quem grava o anexo não relê a sessão. */
      readonly objectKey: string;
      readonly mediaType: string;
      readonly displayName: string;
    }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDeConfirmacao };

/** O que muda na confirmação da Mensagem (16-09); sem isto vale a do Formulário. */
export interface OpcoesDeConfirmacao {
  /** Os tipos aceitos, já normalizados. Padrão: `TIPOS_ACEITOS`. */
  readonly tipos?: readonly string[];
  /** O teto de tamanho por tipo. Padrão: `MAX_BYTES_POR_ARQUIVO` para todos. */
  readonly tetoBytes?: (mediaType: string) => number;
}

/**
 * Verificação server-side de verdade (V02-02C): o objeto precisa pertencer
 * à `submissionId` informada (T-02-06 — `objetosDaSessao` já filtra por
 * sessão, então um `objectId` de outra sessão simplesmente não aparece na
 * lista), existir de fato no provedor, respeitar o tamanho máximo, e ter
 * conteúdo cuja assinatura bate com o `mediaType` reservado. Nunca lança —
 * toda recusa volta como `{ ok: false, motivo }`.
 */
export async function confirmarObjeto(
  args: {
    readonly submissionId: string;
    readonly objectId: string;
  },
  opcoes?: OpcoesDeConfirmacao,
): Promise<ResultadoDeConfirmacao> {
  const tipos = opcoes?.tipos ?? TIPOS_ACEITOS;
  const tetoDoTipoReservado = opcoes?.tetoBytes ?? (() => MAX_BYTES_POR_ARQUIVO);
  const objetos = await objetosDaSessao(args.submissionId);
  const objeto = objetos.find((o) => o.id === args.objectId);
  if (!objeto) return { ok: false, motivo: "objeto_nao_pertence_a_sessao" };

  const { data: info, error: erroInfo } = await armazenamento().info(objeto.objectKey);
  if (erroInfo || !info) return { ok: false, motivo: "objeto_ausente" };

  // O que vale é o tipo RESERVADO na sessão (o que o servidor aceitou no ticket), não só o que o bucket diz.
  const tipoReservado = normalizarTipoDeMidia(objeto.mediaType);
  if (!tipos.includes(tipoReservado)) return { ok: false, motivo: "tipo_nao_confere" };

  const tamanho = info.size ?? 0;
  if (!tamanhoAceito(tamanho, tetoDoTipoReservado(tipoReservado))) return { ok: false, motivo: "tamanho_excedido" };

  const tipoDoBucket = normalizarTipoDeMidia(info.contentType ?? objeto.mediaType);
  if (!tipos.includes(tipoDoBucket)) return { ok: false, motivo: "tipo_nao_confere" };

  const { data: blob, error: erroDownload } = await armazenamento().download(objeto.objectKey);
  if (erroDownload || !blob) return { ok: false, motivo: "objeto_ausente" };

  const conteudo = new Uint8Array(await blob.arrayBuffer());
  // O conteúdo inteiro: o diretório central do zip e do Office fica no fim do arquivo.
  if (!assinaturaConfereComTipo(conteudo, tipoReservado)) {
    return { ok: false, motivo: "assinatura_nao_confere" };
  }

  const sha256 =
    conteudo.byteLength <= TETO_SHA256_BYTES ? createHash("sha256").update(conteudo).digest("hex") : undefined;

  await marcarEnviado({ objectId: objeto.id, sizeBytes: conteudo.byteLength, sha256 });

  return {
    ok: true,
    objectId: objeto.id,
    sizeBytes: conteudo.byteLength,
    sha256,
    objectKey: objeto.objectKey,
    mediaType: tipoReservado,
    displayName: objeto.displayName,
  };
}

export interface UrlDeDownload {
  readonly downloadUrl: string;
  readonly expiresAt: Date;
}

/**
 * Sempre gera uma URL nova — nunca guarda. É o que o contrato v1 chama em
 * `getTask` (Plan 02-13) para o `automation/` baixar o anexo sem receber
 * credencial de Storage.
 */
export async function urlDeDownload(objectKey: string, opcoes?: { readonly download?: string }): Promise<UrlDeDownload> {
  // `download` força `Content-Disposition: attachment` com este nome: o documento baixa, nunca abre no navegador.
  const { data, error } = await armazenamento().createSignedUrl(
    objectKey,
    TTL_DOWNLOAD,
    opcoes?.download !== undefined ? { download: opcoes.download } : undefined,
  );
  if (error || !data) throw new Error(`falha_ao_gerar_url_de_download: ${error?.message ?? "sem dados do provedor"}`);
  return { downloadUrl: data.signedUrl, expiresAt: new Date(Date.now() + TTL_DOWNLOAD * 1000) };
}

/** Sobe os bytes direto pela service role (a entrada de mídia do provedor, 16-10). O objeto nunca se sobrescreve. */
export async function subirObjeto(objectKey: string, bytes: Uint8Array, tipo: string): Promise<void> {
  const { error } = await armazenamento().upload(objectKey, bytes, { contentType: tipo, upsert: false });
  if (error) throw new Error(`falha_ao_subir_objeto: ${error.message}`);
}

/** Remove objetos do bucket (a coleta de órfãos). */
export async function removerObjetos(objectKeys: readonly string[]): Promise<void> {
  if (objectKeys.length === 0) return;
  const { error } = await armazenamento().remove([...objectKeys]);
  if (error) throw new Error(`falha_ao_remover_objetos: ${error.message}`);
}

/** Os arquivos diretos do prefixo (uma pasta, sem descer), com o instante de criação que o bucket informa. */
export async function listarObjetos(
  prefixo: string,
  opcoes: { readonly limite: number },
): Promise<readonly { readonly objectKey: string; readonly criadoEm: Date }[]> {
  const { data, error } = await armazenamento().list(prefixo, { limit: opcoes.limite });
  if (error || !data) throw new Error(`falha_ao_listar_objetos: ${error?.message ?? "sem dados do provedor"}`);
  const arquivos: { objectKey: string; criadoEm: Date }[] = [];
  for (const item of data) {
    // Pasta não tem `id`; só interessa o arquivo, e só com o instante de criação que o bucket deu.
    if (item.id !== null && item.created_at) arquivos.push({ objectKey: `${prefixo}/${item.name}`, criadoEm: new Date(item.created_at) });
  }
  return arquivos;
}

export interface ResultadoDeColeta {
  readonly sessoesExpiradas: number;
  readonly objetosRemovidos: number;
}

/**
 * Para sessões expiradas e nunca consumidas, remove do provedor os objetos
 * que ainda não viraram anexo e marca `expirado`. Exportada para uso por
 * CLI/cron — não roda automaticamente dentro de uma requisição.
 */
export async function coletarOrfaos(args: { readonly limite: number }): Promise<ResultadoDeColeta> {
  const sessoes = await sessoesExpiradas(args.limite);
  let objetosRemovidos = 0;

  for (const sessao of sessoes) {
    const objetos = await objetosDaSessao(sessao.id);
    const chaves = objetos.filter((o) => o.state === "reservado" || o.state === "enviado").map((o) => o.objectKey);
    if (chaves.length > 0) {
      const { error } = await armazenamento().remove(chaves);
      if (!error) objetosRemovidos += chaves.length;
    }
  }

  if (sessoes.length > 0) {
    await marcarExpirados(sessoes.map((s) => s.id));
  }

  return { sessoesExpiradas: sessoes.length, objetosRemovidos };
}
