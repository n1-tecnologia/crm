/**
 * O e-mail lido da caixa, interpretado e pronto para a fila de entrada (Fase 17, 17-08, D-17-10 a D-17-13, D-17-18, F4).
 *
 * O leitor (17-10) só busca os bytes de um e-mail e chama `prepararEmailRecebido`; daqui sai o `corpo` que entra em
 * `plataforma.webhooks_recebidos` (`v: 1`), já INTERPRETADO: remetente, destinatários, assunto, texto, os ids do fio, os
 * anexos já guardados no bucket e a referência do HTML. Nunca o MIME cru, nunca base64, nunca o HTML dentro da linha da
 * fila (T-17-33): o HTML vai ao bucket como objeto `text/html` em `entrada/` e fica em `corpoHtml`.
 *
 * O HTML NÃO vai em `anexos` porque não é um arquivo para baixar e não está na lista de tipos da Mensagem (D-17-13,
 * D-16-09): ele é lido pela tela (17-11), que o limpa na hora de mostrar e o mostra numa moldura sem script (17-15).
 *
 * Os anexos (inclusive a imagem embutida por `cid:`, que o `mailparser` também troca por `data:` dentro do HTML) passam
 * pela MESMA guarda da Fase 16 (`guardarAnexosRecebidos`: tipo, teto e assinatura do conteúdo inteiro), por um adaptador
 * em memória que devolve os bytes que o `mailparser` já leu. Tipo fora da lista, arquivo acima do teto ou conteúdo que não
 * confere com o tipo ficam `baixado: false`, com nome e tipo, e nada sobe ao bucket (T-17-31).
 *
 * `eventosDoCorpo` faz o caminho de volta, do corpo da fila ao evento que `receberMensagem` entende, e NUNCA lança: corpo
 * fora do formato vira `ignorado`.
 *
 * O e-mail é de terceiro e o MIME é hostil por natureza: teto de 50 MiB conferido ANTES do parser, texto, `References`,
 * `To`/`Cc` e anexos com teto, e a chave de deduplicação sempre existe (sem `Message-ID`, um `sem-id:` calculado).
 * Nada aqui loga (T-17-33).
 */

import { createHash, randomUUID } from "node:crypto";
import { simpleParser, type AddressObject, type EmailAddress, type ParsedMail } from "mailparser";
import { z } from "zod";
import type { AnexoDaMensagem, CorpoHtmlDaMensagem, EnderecoAdicional } from "@n1/dominio/crm/mensagens";
import { idLimpo, idsDoCabecalho, MAX_REFERENCIAS_RECEBIDAS, motivoParaIgnorarEmail, type MotivoParaIgnorarEmail } from "@n1/dominio/crm/fio-de-email";
import { normalizarEmail } from "@n1/dominio/crm/normalizacao";
import { normalizarTipoDeMidia } from "@n1/dominio/crm/midia";
import type { AnexoRecebidoDoProvedor } from "@n1/dominio/crm/recebimento";
import type { ArmazenamentoDeAnexos } from "../../../servicos/armazenamento-de-anexos";
import type { GuardaDeMidia } from "../../midia";
import { ErroDeProvedor, type CanalParaProvedor, type EventoDoProvedor, type ProvedorDeMensageria } from "../../provedor";

const MIB = 1024 * 1024;

/** Acima disto o e-mail nem é interpretado: vira `ignorado:grande_demais` (T-17-30). */
export const TETO_DO_EMAIL_RECEBIDO_BYTES = 50 * MIB;
/** O HTML guardado no bucket tem este teto; acima dele a Mensagem entra sem HTML. */
export const TETO_DO_HTML_GUARDADO_BYTES = 5 * MIB;
/** O texto que a linha da fila carrega; o que passa disto vai inteiro como o anexo `texto-completo.txt`. */
export const MAX_TEXTO_NO_CORPO = 200_000;

/** Quantos arquivos de um e-mail passam pela guarda; os que passam disso ficam `baixado: false`. */
const MAX_ANEXOS_GUARDADOS = 50;
const MAX_DESTINATARIOS = 100;
const MAX_ASSUNTO = 500;
const MAX_NOME = 200;
const MAX_NOME_DE_ARQUIVO = 200;
const MAX_AUTENTICACAO = 2000;
/** Um `Message-ID` maior que isto não é de ninguém que preste: cai na chave calculada. */
const MAX_MESSAGE_ID = 512;

export interface Endereco {
  readonly endereco: string;
  readonly nome?: string | undefined;
}

/** Por que o e-mail não vira Conversa: os do domínio, mais os dois que só o tradutor conhece. */
export type MotivoIgnoradoDoCorpo = MotivoParaIgnorarEmail | "grande_demais" | "ilegivel" | "sem_conteudo";

/** O e-mail interpretado, como entra em `webhooks_recebidos.corpo`. Versionado: o processador e o tradutor leem este formato. */
export type CorpoDoEmail =
  | {
      readonly v: 1;
      /** O `Message-ID` sem `< >`, ou a chave `sem-id:` quando o e-mail não traz um. É o `id_externo` da Mensagem. */
      readonly messageId: string;
      readonly uid: number;
      readonly uidValidity: string;
      /** O instante em que o e-mail chegou à caixa (ISO 8601). */
      readonly data: string;
      readonly de: Endereco;
      readonly para: readonly Endereco[];
      readonly cc: readonly Endereco[];
      readonly assunto?: string;
      readonly inReplyTo: readonly string[];
      readonly references: readonly string[];
      readonly texto?: string;
      readonly truncado?: boolean;
      readonly anexos: readonly AnexoDaMensagem[];
      readonly corpoHtml?: CorpoHtmlDaMensagem;
      readonly lista?: boolean;
      readonly autenticacao?: string;
    }
  | {
      readonly v: 1;
      readonly ignorado: MotivoIgnoradoDoCorpo;
      readonly messageId?: string;
      readonly uid: number;
      readonly uidValidity: string;
    };

export interface EmailParaPreparar {
  readonly bytes: Uint8Array;
  readonly uid: number;
  readonly uidValidity: string;
  /** O `INTERNALDATE` do IMAP: a chegada na caixa. O cabeçalho `Date` é de quem manda e pode estar errado ou forjado. */
  readonly recebidoEm?: string | undefined;
  readonly workspaceId: string;
  readonly canal: CanalParaProvedor;
  readonly guarda: GuardaDeMidia;
  readonly armazenamento: ArmazenamentoDeAnexos;
}

export interface EmailPreparado {
  /** A chave de deduplicação da fila: o `Message-ID` sem `< >`, ou `sem-id:<sha256>`. */
  readonly chave: string;
  readonly corpo: CorpoDoEmail;
  /** Algum arquivo ou o HTML falhou por causa que pode passar sozinha (bucket fora do ar): o leitor repete antes de avançar o cursor. */
  readonly algumTransitorio: boolean;
}

const CONTROLE = /[\u0000-\u001F\u007F]/g;
const TEM_CONTROLE = /[\u0000-\u001F\u007F]/;

function semControle(valor: string): string {
  return bemFormado(valor.replace(CONTROLE, " ")).trim();
}

/**
 * O `jsonb` do Postgres recusa o NUL e o par substituto solto, e um e-mail de terceiro pode trazer os dois: sem isto, o
 * `insert` da fila falharia sempre e o leitor ficaria preso nesse e-mail. O substituto solto vira U+FFFD.
 */
function bemFormado(valor: string): string {
  return valor.toWellFormed();
}

/** Corta sem partir um par substituto no meio. */
function cortar(valor: string, tamanho: number): string {
  if (valor.length <= tamanho) return valor;
  const fim = valor.charCodeAt(tamanho - 1);
  return valor.slice(0, fim >= 0xd800 && fim <= 0xdbff ? tamanho - 1 : tamanho);
}

function sha256(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

/** A chave de um e-mail que não pôde (ou nem precisou) ser lido: a mesma para os mesmos bytes e a mesma posição na caixa. */
function chaveDePosicao(uidValidity: string, uid: number, tamanho: number): string {
  return `sem-id:${sha256(`${uidValidity}\n${uid}\n${tamanho}`)}`;
}

/** O corpo de um e-mail que fica registrado na fila mas não vira Conversa (D-17-11). */
export function corpoIgnorado(
  motivo: MotivoIgnoradoDoCorpo,
  e: { readonly messageId?: string | undefined; readonly uid: number; readonly uidValidity: string },
): CorpoDoEmail {
  return { v: 1, ignorado: motivo, ...(e.messageId === undefined ? {} : { messageId: e.messageId }), uid: e.uid, uidValidity: e.uidValidity };
}

/** Os endereços de um cabeçalho de endereço, com os grupos desdobrados; o que não tem endereço fica fora. */
function enderecosDoCabecalho(campo: AddressObject | AddressObject[] | undefined): Endereco[] {
  if (!campo) return [];
  const saida: Endereco[] = [];
  const visitar = (itens: readonly EmailAddress[]) => {
    for (const item of itens) {
      if (item.group) visitar(item.group);
      else if (typeof item.address === "string" && item.address.trim() !== "" && !TEM_CONTROLE.test(item.address)) {
        const nome = cortar(semControle(item.name ?? ""), MAX_NOME);
        saida.push({ endereco: bemFormado(item.address.trim()), ...(nome === "" ? {} : { nome }) });
      }
    }
  };
  for (const objeto of Array.isArray(campo) ? campo : [campo]) visitar(objeto.value);
  return saida;
}

/** Os cabeçalhos em texto, nome em minúsculas, o PRIMEIRO de cada nome, dobra de linha desfeita. */
function cabecalhosEmTexto(mail: ParsedMail): Record<string, string> {
  const mapa = new Map<string, string>();
  for (const { key, line } of mail.headerLines) {
    if (mapa.has(key)) continue;
    mapa.set(key, line.slice(line.indexOf(":") + 1).replace(/\r?\n[ \t]+/g, " ").trim());
  }
  return Object.fromEntries(mapa);
}

function tipoDeConteudoDoEmail(mail: ParsedMail, cabecalhos: Record<string, string>): string {
  const estruturado = mail.headers.get("content-type");
  if (estruturado && typeof estruturado === "object" && "value" in estruturado && typeof estruturado.value === "string") return estruturado.value;
  return (cabecalhos["content-type"] ?? "").split(";")[0] ?? "";
}

function nomeDoArquivo(nome: string | undefined, indice: number): string {
  const limpo = cortar(semControle((nome ?? "").replace(/[\\/]/g, "_")), MAX_NOME_DE_ARQUIVO);
  return limpo === "" ? `anexo-${indice + 1}` : limpo;
}

function instanteValido(valor: string | undefined): string | undefined {
  if (valor === undefined) return undefined;
  const t = Date.parse(valor);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

/**
 * Lê os bytes de UM e-mail e devolve o corpo da fila. Não lança por causa do conteúdo do e-mail (MIME que o parser recusa
 * vira `ignorado:ilegivel`); lança só o que não é do e-mail (um erro que escapou do bucket, por exemplo, não: a guarda e o
 * HTML o convertem em `algumTransitorio`).
 */
export async function prepararEmailRecebido(e: EmailParaPreparar): Promise<EmailPreparado> {
  const { uid, uidValidity } = e;
  const tamanho = e.bytes.byteLength;

  // O teto vale ANTES do parser: um e-mail enorme nunca é interpretado (T-17-30).
  if (tamanho > TETO_DO_EMAIL_RECEBIDO_BYTES) {
    const chave = chaveDePosicao(uidValidity, uid, tamanho);
    return { chave, corpo: corpoIgnorado("grande_demais", { messageId: chave, uid, uidValidity }), algumTransitorio: false };
  }

  let mail: ParsedMail;
  try {
    mail = await simpleParser(Buffer.from(e.bytes.buffer, e.bytes.byteOffset, e.bytes.byteLength), {
      maxHtmlLengthToParse: TETO_DO_HTML_GUARDADO_BYTES,
      checksumAlgo: false,
    });
  } catch {
    const chave = chaveDePosicao(uidValidity, uid, tamanho);
    return { chave, corpo: corpoIgnorado("ilegivel", { messageId: chave, uid, uidValidity }), algumTransitorio: false };
  }

  const cabecalhos = cabecalhosEmTexto(mail);
  const de = enderecosDoCabecalho(mail.from)[0];
  const assuntoBruto = cortar(semControle(mail.subject ?? ""), MAX_ASSUNTO);

  const idDoCabecalho = idLimpo(mail.messageId);
  const chave =
    idDoCabecalho !== undefined && idDoCabecalho.length <= MAX_MESSAGE_ID && !TEM_CONTROLE.test(idDoCabecalho)
      ? idDoCabecalho
      : `sem-id:${sha256([de?.endereco ?? "", cabecalhos["date"] ?? "", assuntoBruto, tamanho].join("\n"))}`;

  // Sem remetente não há quem seja o Contato: não é uma pessoa escrevendo.
  if (!de) return { chave, corpo: corpoIgnorado("ilegivel", { messageId: chave, uid, uidValidity }), algumTransitorio: false };

  const motivo = motivoParaIgnorarEmail({
    cabecalhos,
    de: de.endereco,
    enderecoDoCanal: e.canal.canal.identificadorExterno,
    tipoDeConteudo: tipoDeConteudoDoEmail(mail, cabecalhos),
  });
  if (motivo) return { chave, corpo: corpoIgnorado(motivo, { messageId: chave, uid, uidValidity }), algumTransitorio: false };

  // O que fica na fila é um corte do texto; o texto inteiro vai como arquivo.
  const textoInteiro = bemFormado((mail.text ?? "").replace(/\u0000/g, ""));
  const truncado = textoInteiro.length > MAX_TEXTO_NO_CORPO;
  const texto = truncado ? cortar(textoInteiro, MAX_TEXTO_NO_CORPO) : textoInteiro;

  // Os bytes que o parser já leu, por referência: é o que o adaptador entrega à guarda no lugar de uma requisição.
  const conteudos = new Map<string, { bytes: Uint8Array; tipoDeMidia: string; nome: string }>();
  const aGuardar: AnexoRecebidoDoProvedor[] = [];
  /** A posição, no e-mail, de cada item de `aGuardar` (a guarda devolve um resultado por item, na mesma ordem). */
  const posicoes: number[] = [];
  /** O resultado de cada arquivo, na ordem do e-mail. */
  const naOrdem: (AnexoDaMensagem | undefined)[] = new Array(mail.attachments.length).fill(undefined);

  mail.attachments.forEach((anexo, i) => {
    const referencia = `${uidValidity}:${uid}:${i}`;
    const nome = nomeDoArquivo(anexo.filename, i);
    // Passou do limite de arquivos por e-mail: não entra na guarda, mas o atendente vê que veio (nome e tipo).
    if (aGuardar.length >= MAX_ANEXOS_GUARDADOS) {
      naOrdem[i] = { tipoDeMidia: normalizarTipoDeMidia(anexo.contentType), nome, referenciaExterna: referencia, baixado: false };
      return;
    }
    conteudos.set(referencia, { bytes: anexo.content, tipoDeMidia: anexo.contentType, nome });
    aGuardar.push({ referenciaNoProvedor: referencia, tipoDeMidia: anexo.contentType, nome });
    posicoes.push(i);
  });

  // O texto inteiro vai como o último arquivo, depois dos do e-mail.
  if (truncado) {
    const referencia = `${uidValidity}:${uid}:texto`;
    conteudos.set(referencia, { bytes: Buffer.from(textoInteiro, "utf8"), tipoDeMidia: "text/plain", nome: "texto-completo.txt" });
    aGuardar.push({ referenciaNoProvedor: referencia, tipoDeMidia: "text/plain", nome: "texto-completo.txt" });
  }

  const adaptador: Pick<ProvedorDeMensageria, "baixarMidia"> = {
    async baixarMidia(_canal, referencia, { tetoBytes }) {
      const conteudo = conteudos.get(referencia);
      if (!conteudo) throw new ErroDeProvedor("MIDIA_INDISPONIVEL");
      if (conteudo.bytes.byteLength > tetoBytes) throw new ErroDeProvedor("MIDIA_GRANDE_DEMAIS");
      return { bytes: conteudo.bytes, tipoDeMidia: conteudo.tipoDeMidia, nome: conteudo.nome };
    },
  };

  const guardados = await e.guarda.guardarAnexosRecebidos({ workspaceId: e.workspaceId, canal: e.canal, provedor: adaptador, anexos: aGuardar });
  let algumTransitorio = guardados.algumTransitorio;

  posicoes.forEach((posicao, k) => {
    naOrdem[posicao] = guardados.anexos[k];
  });
  const anexos: AnexoDaMensagem[] = naOrdem.filter((a): a is AnexoDaMensagem => a !== undefined);
  if (truncado) {
    const completo = guardados.anexos[posicoes.length];
    if (completo) anexos.push(completo);
  }

  // O HTML: objeto `text/html` em `entrada/`, referenciado no corpo. Falha do bucket deixa a Mensagem só com o texto.
  let corpoHtml: CorpoHtmlDaMensagem | undefined;
  const html = typeof mail.html === "string" ? mail.html : "";
  if (html.trim() !== "") {
    const bytesDoHtml = Buffer.from(html, "utf8");
    if (bytesDoHtml.byteLength <= TETO_DO_HTML_GUARDADO_BYTES) {
      const objectKey = `workspace/${e.workspaceId}/entrada/${e.canal.canal.id}/${randomUUID()}`;
      try {
        await e.armazenamento.subir(objectKey, bytesDoHtml, "text/html");
        corpoHtml = { objectKey, tamanhoBytes: bytesDoHtml.byteLength };
      } catch {
        algumTransitorio = true;
      }
    }
  }

  const idsLimpos = (ids: string[]) => ids.filter((id) => !TEM_CONTROLE.test(id) && id.length <= MAX_MESSAGE_ID).map(bemFormado);
  const referencias = idsLimpos(idsDoCabecalho(Array.isArray(mail.references) ? mail.references.join(" ") : mail.references)).slice(-MAX_REFERENCIAS_RECEBIDAS);
  const inReplyTo = idsLimpos(idsDoCabecalho(mail.inReplyTo)).slice(0, MAX_REFERENCIAS_RECEBIDAS);
  const lista = cabecalhos["list-unsubscribe"] !== undefined || cabecalhos["list-id"] !== undefined;
  const autenticacao = cabecalhos["authentication-results"];

  const corpo: CorpoDoEmail = {
    v: 1,
    messageId: chave,
    uid,
    uidValidity,
    data: instanteValido(e.recebidoEm) ?? (mail.date && !Number.isNaN(mail.date.getTime()) ? mail.date.toISOString() : new Date().toISOString()),
    de,
    para: enderecosDoCabecalho(mail.to).slice(0, MAX_DESTINATARIOS),
    cc: enderecosDoCabecalho(mail.cc).slice(0, MAX_DESTINATARIOS),
    ...(assuntoBruto === "" ? {} : { assunto: assuntoBruto }),
    inReplyTo,
    references: referencias,
    ...(texto.trim() === "" ? {} : { texto }),
    ...(truncado ? { truncado: true } : {}),
    anexos,
    ...(corpoHtml ? { corpoHtml } : {}),
    ...(lista ? { lista: true } : {}),
    ...(autenticacao ? { autenticacao: cortar(semControle(autenticacao), MAX_AUTENTICACAO) } : {}),
  };

  return { chave, corpo, algumTransitorio };
}

// ---------------------------------------------------------------------------
// O caminho de volta: o corpo da fila vira o evento que `receberMensagem` entende.
// ---------------------------------------------------------------------------

const EnderecoZ = z.object({ endereco: z.string().min(1).max(320), nome: z.string().max(MAX_NOME).optional() });

const AnexoZ = z.object({
  tipoDeMidia: z.string().max(200),
  nome: z.string().max(300),
  referenciaExterna: z.string().max(200).optional(),
  objectKey: z.string().max(1024).optional(),
  tamanhoBytes: z.number().int().nonnegative().optional(),
  baixado: z.boolean(),
});

const MOTIVOS: readonly [MotivoIgnoradoDoCorpo, ...MotivoIgnoradoDoCorpo[]] = [
  "resposta_automatica",
  "nao_entrega",
  "lista",
  "proprio_canal",
  "grande_demais",
  "ilegivel",
  "sem_conteudo",
];

const CorpoIgnoradoZ = z.object({
  v: z.literal(1),
  ignorado: z.enum(MOTIVOS),
  messageId: z.string().min(1).max(600).optional(),
  uid: z.number().int().nonnegative(),
  uidValidity: z.string().min(1).max(40),
});

const CorpoLidoZ = z.object({
  v: z.literal(1),
  messageId: z.string().min(1).max(600),
  uid: z.number().int().nonnegative(),
  uidValidity: z.string().min(1).max(40),
  data: z.string().min(1).max(40),
  de: EnderecoZ,
  para: z.array(EnderecoZ).max(MAX_DESTINATARIOS),
  cc: z.array(EnderecoZ).max(MAX_DESTINATARIOS),
  assunto: z.string().max(MAX_ASSUNTO).optional(),
  inReplyTo: z.array(z.string().min(1).max(600)).max(MAX_REFERENCIAS_RECEBIDAS),
  references: z.array(z.string().min(1).max(600)).max(MAX_REFERENCIAS_RECEBIDAS),
  texto: z.string().max(MAX_TEXTO_NO_CORPO).optional(),
  truncado: z.boolean().optional(),
  anexos: z.array(AnexoZ).max(MAX_ANEXOS_GUARDADOS + 1),
  corpoHtml: z.object({ objectKey: z.string().min(1).max(1024), tamanhoBytes: z.number().int().nonnegative() }).optional(),
  lista: z.boolean().optional(),
  autenticacao: z.string().max(MAX_AUTENTICACAO).optional(),
});

/** A chave de deduplicação do corpo (o `messageId`), ou `undefined` se ele não tem a forma de `v: 1`. */
export function chaveDoCorpo(corpo: unknown): string | undefined {
  const lido = CorpoLidoZ.safeParse(corpo);
  if (lido.success) return lido.data.messageId;
  const ignorado = CorpoIgnoradoZ.safeParse(corpo);
  return ignorado.success ? ignorado.data.messageId : undefined;
}

const mesmoEndereco = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Os endereços além do remetente, só os que normalizam (um endereço torto do e-mail de terceiro não derruba a Mensagem) e
 * sem o do próprio Canal (D-17-12): `para` vira `para`, `cc` vira `copia`.
 */
function enderecosAdicionais(
  para: readonly Endereco[],
  cc: readonly Endereco[],
  enderecoDoCanal: string,
): EnderecoAdicional[] {
  const saida: EnderecoAdicional[] = [];
  const incluir = (lista: readonly Endereco[], tipo: EnderecoAdicional["tipo"]) => {
    for (const item of lista) {
      const normalizado = normalizarEmail(item.endereco);
      if (!normalizado.ok || mesmoEndereco(normalizado.value, enderecoDoCanal)) continue;
      saida.push({ tipo, endereco: normalizado.value, ...(item.nome === undefined ? {} : { nomeExibido: item.nome }) });
    }
  };
  incluir(para, "para");
  incluir(cc, "copia");
  return saida;
}

/** O corpo da fila como eventos do provedor. Nunca lança: corpo fora do formato vira `ignorado`. */
export function eventosDoCorpo(corpo: unknown, enderecoDoCanal: string): readonly EventoDoProvedor[] {
  const ignorado = CorpoIgnoradoZ.safeParse(corpo);
  if (ignorado.success) {
    const { ignorado: motivo, messageId } = ignorado.data;
    return [{ tipo: "ignorado", motivo, ...(messageId === undefined ? {} : { idExterno: messageId }) }];
  }

  const lido = CorpoLidoZ.safeParse(corpo);
  if (!lido.success) return [{ tipo: "ignorado", motivo: "corpo_invalido" }];
  const c = lido.data;

  const instante = instanteValido(c.data);
  if (instante === undefined) return [{ tipo: "ignorado", motivo: "corpo_invalido", idExterno: c.messageId }];

  // Um e-mail sem texto, sem assunto, sem arquivo e sem HTML não tem o que mostrar: fica registrado em vez de repetir na fila.
  const semTexto = (c.texto ?? "").trim() === "";
  const semAssunto = (c.assunto ?? "").trim() === "";
  if (semTexto && semAssunto && c.anexos.length === 0 && c.corpoHtml === undefined) {
    return [{ tipo: "ignorado", motivo: "sem_conteudo", idExterno: c.messageId }];
  }

  const adicionais = enderecosAdicionais(c.para, c.cc, enderecoDoCanal);
  const cargaBruta = {
    messageId: c.messageId,
    uid: c.uid,
    uidValidity: c.uidValidity,
    ...(c.lista ? { lista: true } : {}),
    ...(c.autenticacao === undefined ? {} : { autenticacao: c.autenticacao }),
  };

  return [
    {
      tipo: "mensagem",
      idExterno: c.messageId,
      criadoEm: instante,
      remetente: { tipo: "email", valor: c.de.endereco, ...(c.de.nome === undefined ? {} : { nomeExibido: c.de.nome }) },
      ...(semTexto ? {} : { conteudo: c.texto }),
      ...(semAssunto ? {} : { assunto: c.assunto }),
      ...(c.inReplyTo[0] === undefined ? {} : { emRespostaAIdExterno: c.inReplyTo[0] }),
      ...(c.references.length === 0 ? {} : { referencias: c.references }),
      ...(adicionais.length === 0 ? {} : { enderecosAdicionais: adicionais }),
      ...(c.anexos.length === 0 ? {} : { anexosGuardados: c.anexos as AnexoDaMensagem[] }),
      ...(c.corpoHtml === undefined ? {} : { corpoHtml: c.corpoHtml }),
      cargaBruta,
    },
  ];
}
