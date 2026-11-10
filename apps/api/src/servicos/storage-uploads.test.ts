/**
 * `storage-uploads.ts` — a mesma disciplina de `convidar-membro.test.ts`:
 * a seção pura roda sempre, sem env, sobre a lógica de recusa (assinatura de
 * arquivo, limites, caminho do objeto). A seção de integração pula sem
 * `DATABASE_URL`/`SUPABASE_STORAGE_BUCKET` (e as credenciais do Auth que o
 * client admin de Storage reaproveita) e prova V02-02C contra o Postgres e o
 * bucket de teste reais: recusa por MIME/tamanho/sessão alheia, e que o
 * bucket é de fato privado (02-VALIDATION.md, "Upload/download real
 * permanece privado").
 *
 * `WS`/`FORM` usam o literal `"teste"` de propósito — o caminho gerado por
 * `gerarObjectKey` vira `workspace/teste/forms/teste-upload/...`: um prefixo
 * que nunca colide com um Espaço de Trabalho ou Formulário real (cujos ids
 * seguem outro padrão), fácil de auditar/limpar manualmente se a suíte
 * deixar algo para trás.
 */

import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { clienteAdmin } from "../autenticacao/verificar-token";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { consumirSessao, objetosDaSessao } from "../persistencia/sessoes-de-upload";
import {
  MAX_ARQUIVOS_POR_ENVIO,
  MAX_BYTES_POR_ARQUIVO,
  abrirSessaoDeUpload,
  assinaturaConfereComTipo,
  coletarOrfaos,
  confirmarObjeto,
  emitirTicket,
  familiaDoZip,
  gerarObjectKey,
  limiteDeArquivosAtingido,
  pareceTexto,
  tamanhoAceito,
  tetoDoTipo,
  tetosDeMidia,
  tipoAceito,
  TIPOS_ACEITOS,
  urlDeDownload,
} from "./storage-uploads";

// ---------------------------------------------------------------------------
// Seção pura — sempre roda, sem env.
// ---------------------------------------------------------------------------

describe("storage-uploads — funções puras", () => {
  it("PDF válido passa na verificação de assinatura", () => {
    const conteudo = new TextEncoder().encode("%PDF-1.4\n%âãÏÓ\n1 0 obj\n");
    expect(assinaturaConfereComTipo(conteudo, "application/pdf")).toBe(true);
  });

  it("JPEG declarado como application/pdf é recusado", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(assinaturaConfereComTipo(jpeg, "application/pdf")).toBe(false);
    expect(assinaturaConfereComTipo(jpeg, "image/jpeg")).toBe(true);
  });

  it("PNG e WebP válidos passam; um no lugar do outro é recusado", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webp = new TextEncoder().encode("RIFF\x00\x00\x00\x00WEBPVP8 ");
    expect(assinaturaConfereComTipo(png, "image/png")).toBe(true);
    expect(assinaturaConfereComTipo(webp, "image/webp")).toBe(true);
    expect(assinaturaConfereComTipo(png, "image/webp")).toBe(false);
    expect(assinaturaConfereComTipo(webp, "image/png")).toBe(false);
  });

  it("XML só passa se o primeiro caractere não-espaço for '<'", () => {
    const xmlValido = new TextEncoder().encode("  \n<?xml version=\"1.0\"?><nota/>");
    const xmlInvalido = new TextEncoder().encode("nao e xml de verdade");
    expect(assinaturaConfereComTipo(xmlValido, "application/xml")).toBe(true);
    expect(assinaturaConfereComTipo(xmlValido, "text/xml")).toBe(true);
    expect(assinaturaConfereComTipo(xmlInvalido, "text/xml")).toBe(false);
  });

  it("arquivo de 25 MiB + 1 byte é recusado; exatamente 25 MiB passa", () => {
    expect(tamanhoAceito(MAX_BYTES_POR_ARQUIVO)).toBe(true);
    expect(tamanhoAceito(MAX_BYTES_POR_ARQUIVO + 1)).toBe(false);
    expect(tamanhoAceito(0)).toBe(false);
  });

  it("mediaType fora da allowlist é recusado", () => {
    expect(tipoAceito("application/zip")).toBe(false);
    expect(tipoAceito("application/pdf")).toBe(true);
  });

  it("o 11º ticket da mesma sessão é recusado", () => {
    expect(MAX_ARQUIVOS_POR_ENVIO).toBe(10);
    expect(limiteDeArquivosAtingido(MAX_ARQUIVOS_POR_ENVIO - 1)).toBe(false); // o 10º ainda cabe
    expect(limiteDeArquivosAtingido(MAX_ARQUIVOS_POR_ENVIO)).toBe(true); // o 11º não
  });

  it("objectKey gerado não contém o displayName informado (T-02-14)", () => {
    const displayName = "nota-fiscal-razao-social-ltda-R$12345,67.pdf";
    const objectKey = gerarObjectKey({ workspaceId: "ws_1", formId: "form_1", submissionId: "sub_1" });
    expect(objectKey).not.toContain(displayName);
    expect(objectKey).not.toContain("razao-social");
    expect(objectKey.startsWith("workspace/ws_1/forms/form_1/sub_1/")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Seção pura da Mensagem (16-09, 3.9.2, D-16-08, D-16-09) — mídia e documentos conferidos pelo CONTEÚDO.
// ---------------------------------------------------------------------------

const MIB = 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const ascii = (texto: string): Uint8Array => new TextEncoder().encode(texto);
const juntar = (...partes: Uint8Array[]): Uint8Array => {
  const saida = new Uint8Array(partes.reduce((soma, p) => soma + p.length, 0));
  let deslocamento = 0;
  for (const p of partes) {
    saida.set(p, deslocamento);
    deslocamento += p.length;
  }
  return saida;
};

/**
 * Um ZIP de verdade na própria suíte (sem pacote): entradas guardadas sem compressão, diretório central e EOCD. O CRC
 * é zero porque nada aqui descomprime — o código sob teste lê só os NOMES do diretório central.
 */
function montarZip(nomes: readonly string[], opcoes: { readonly comentario?: string } = {}): Uint8Array {
  const u16 = (n: number) => Uint8Array.from([n & 0xff, (n >> 8) & 0xff]);
  const u32 = (n: number) => Uint8Array.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]);
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let deslocamento = 0;
  for (const nome of nomes) {
    const bytesDoNome = ascii(nome);
    const local = juntar(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), u32(0), u16(bytesDoNome.length), u16(0), bytesDoNome);
    centrais.push(
      juntar(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), u32(0), u16(bytesDoNome.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(deslocamento), bytesDoNome),
    );
    locais.push(local);
    deslocamento += local.length;
  }
  const diretorio = juntar(...centrais);
  const comentario = ascii(opcoes.comentario ?? "");
  const eocd = juntar(u32(0x06054b50), u16(0), u16(0), u16(nomes.length), u16(nomes.length), u32(diretorio.length), u32(deslocamento), u16(comentario.length), comentario);
  return juntar(...locais, diretorio, eocd);
}

describe("storage-uploads — assinatura de áudio, vídeo e documento (D-16-09)", () => {
  it("OGG de verdade (OggS) passa como audio/ogg, inclusive com o parâmetro de codec", () => {
    const ogg = juntar(ascii("OggS"), Uint8Array.from([0x00, 0x02]), new Uint8Array(24));
    expect(assinaturaConfereComTipo(ogg, "audio/ogg")).toBe(true);
    expect(assinaturaConfereComTipo(ogg, "audio/ogg; codecs=opus")).toBe(true);
  });

  it("T-16-31: um arquivo de texto renomeado para .ogg (tipo audio/ogg) é recusado", () => {
    expect(assinaturaConfereComTipo(ascii("olá, isto é só um texto"), "audio/ogg")).toBe(false);
    expect(assinaturaConfereComTipo(ascii("olá"), "audio/mpeg")).toBe(false);
    expect(assinaturaConfereComTipo(ascii("olá"), "video/mp4")).toBe(false);
  });

  it("MP3 passa com ID3 e com o quadro 0xFF 0xFB (e 0xF3, 0xF2); um OGG declarado como mp3 não", () => {
    expect(assinaturaConfereComTipo(juntar(ascii("ID3"), Uint8Array.from([4, 0, 0])), "audio/mpeg")).toBe(true);
    for (const segundo of [0xfb, 0xf3, 0xf2]) expect(assinaturaConfereComTipo(Uint8Array.from([0xff, segundo, 0x90, 0x00]), "audio/mpeg")).toBe(true);
    expect(assinaturaConfereComTipo(ascii("OggS\u0000"), "audio/mpeg")).toBe(false);
  });

  it("MP4, M4A e 3GP passam com ftyp no byte 4; sem ftyp não", () => {
    const comFtyp = (marca: string) => juntar(Uint8Array.from([0, 0, 0, 0x20]), ascii("ftyp"), ascii(marca), new Uint8Array(8));
    expect(assinaturaConfereComTipo(comFtyp("isom"), "video/mp4")).toBe(true);
    expect(assinaturaConfereComTipo(comFtyp("M4A "), "audio/mp4")).toBe(true);
    expect(assinaturaConfereComTipo(comFtyp("3gp4"), "video/3gpp")).toBe(true);
    expect(assinaturaConfereComTipo(ascii("0000ftxx isom"), "video/mp4")).toBe(false);
    expect(assinaturaConfereComTipo(ascii("OggS"), "audio/mp4")).toBe(false);
  });

  it("AAC passa com o cabeçalho ADTS (0xFFF1 e 0xFFF9) e recusa o resto", () => {
    expect(assinaturaConfereComTipo(Uint8Array.from([0xff, 0xf1, 0x50, 0x80]), "audio/aac")).toBe(true);
    expect(assinaturaConfereComTipo(Uint8Array.from([0xff, 0xf9, 0x50, 0x80]), "audio/aac")).toBe(true);
    expect(assinaturaConfereComTipo(Uint8Array.from([0xff, 0xfb, 0x90, 0x00]), "audio/aac")).toBe(false);
    expect(assinaturaConfereComTipo(ascii("texto"), "audio/aac")).toBe(false);
  });
});

describe("storage-uploads — familiaDoZip lê só os nomes do diretório central (T-16-32)", () => {
  it("[Content_Types].xml + word/ é docx; aceito como docx e recusado como xlsx, pptx e como PDF", () => {
    const docx = montarZip(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
    expect(familiaDoZip(docx)).toBe("docx");
    expect(assinaturaConfereComTipo(docx, DOCX)).toBe(true);
    expect(assinaturaConfereComTipo(docx, XLSX)).toBe(false);
    expect(assinaturaConfereComTipo(docx, PPTX)).toBe(false);
    expect(assinaturaConfereComTipo(docx, "application/pdf")).toBe(false);
  });

  it("xl/ é xlsx e ppt/ é pptx", () => {
    expect(familiaDoZip(montarZip(["[Content_Types].xml", "xl/workbook.xml"]))).toBe("xlsx");
    expect(familiaDoZip(montarZip(["[Content_Types].xml", "ppt/presentation.xml"]))).toBe("pptx");
    expect(assinaturaConfereComTipo(montarZip(["[Content_Types].xml", "xl/workbook.xml"]), XLSX)).toBe(true);
    expect(assinaturaConfereComTipo(montarZip(["[Content_Types].xml", "ppt/presentation.xml"]), PPTX)).toBe(true);
  });

  it("zip sem [Content_Types].xml: recusado como docx, aceito como application/zip", () => {
    const zip = montarZip(["relatorio.txt", "fotos/a.png"]);
    expect(familiaDoZip(zip)).toBe("zip");
    expect(assinaturaConfereComTipo(zip, DOCX)).toBe(false);
    expect(assinaturaConfereComTipo(zip, "application/zip")).toBe(true);
  });

  it("word/ sem [Content_Types].xml não é docx (o pacote Office exige os dois)", () => {
    const zip = montarZip(["word/document.xml"]);
    expect(familiaDoZip(zip)).toBe("zip");
    expect(assinaturaConfereComTipo(zip, DOCX)).toBe(false);
  });

  it("um docx também é um zip válido para quem declara application/zip", () => {
    expect(assinaturaConfereComTipo(montarZip(["[Content_Types].xml", "word/document.xml"]), "application/zip")).toBe(true);
  });

  it("ZIP vazio válido (só o fim do diretório) é aceito como application/zip", () => {
    const vazio = montarZip([]);
    expect(familiaDoZip(vazio)).toBe("zip");
    expect(assinaturaConfereComTipo(vazio, "application/zip")).toBe(true);
    expect(assinaturaConfereComTipo(vazio, DOCX)).toBe(false);
  });

  it("bytes aleatórios que começam com PK, sem diretório central, são recusados", () => {
    const falso = juntar(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), new Uint8Array(200).fill(0x41));
    expect(familiaDoZip(falso)).toBeUndefined();
    for (const tipo of ["application/zip", DOCX, XLSX, PPTX]) expect(assinaturaConfereComTipo(falso, tipo)).toBe(false);
  });

  it("o zip cortado antes do fim, ou com o diretório apontando para fora do arquivo, é recusado", () => {
    const zip = montarZip(["[Content_Types].xml", "word/document.xml"]);
    expect(familiaDoZip(zip.subarray(0, zip.length - 10))).toBeUndefined();
    const fora = zip.slice();
    // O deslocamento do diretório central (4 bytes, 16 a partir do início do EOCD) passa do fim do arquivo.
    const eocd = fora.length - 22;
    fora[eocd + 16] = 0xff;
    fora[eocd + 17] = 0xff;
    fora[eocd + 18] = 0xff;
    expect(familiaDoZip(fora)).toBeUndefined();
  });

  it("um fim de diretório que promete 65535 entradas num diretório minúsculo termina e é recusado (sem laço longo)", () => {
    const zip = montarZip(["a.txt"]);
    const adulterado = zip.slice();
    const eocd = adulterado.length - 22;
    adulterado[eocd + 10] = 0xff;
    adulterado[eocd + 11] = 0xff;
    expect(familiaDoZip(adulterado)).toBeUndefined();
  });

  it("um comentário que imita um fim de diretório não engana a leitura", () => {
    const zip = montarZip(["[Content_Types].xml", "word/document.xml"], { comentario: "PK\u0005\u0006 não sou o fim" });
    expect(familiaDoZip(zip)).toBe("docx");
  });
});

describe("storage-uploads — csv e txt só valem se o conteúdo for texto", () => {
  it("CSV do Excel em Windows-1252 com ponto e vírgula e CRLF é aceito (não exige UTF-8)", () => {
    const csv = Uint8Array.from([...ascii("nome;cidade\r\nJos"), 0xe9, ...ascii(";S"), 0xe3, ...ascii("o Paulo\r\n")]);
    expect(pareceTexto(csv)).toBe(true);
    expect(assinaturaConfereComTipo(csv, "text/csv")).toBe(true);
    expect(assinaturaConfereComTipo(ascii("a;b\r\nc;d"), "text/csv")).toBe(true);
    expect(assinaturaConfereComTipo(ascii("linha 1\n\tlinha 2\f"), "text/plain")).toBe(true);
  });

  it("conteúdo com NUL, ou com controle C0 que não seja tab, LF, CR e FF, é recusado", () => {
    expect(pareceTexto(Uint8Array.from([0x61, 0x00, 0x62]))).toBe(false);
    expect(pareceTexto(Uint8Array.from([0x61, 0x1b, 0x62]))).toBe(false);
    expect(pareceTexto(Uint8Array.from([0x61, 0x07, 0x62]))).toBe(false);
    expect(assinaturaConfereComTipo(Uint8Array.from([0x61, 0x00, 0x62]), "text/plain")).toBe(false);
    expect(assinaturaConfereComTipo(juntar(ascii("%PDF-1.4"), Uint8Array.from([0x00, 0x01])), "text/csv")).toBe(false);
  });
});

describe("storage-uploads — teto por tipo e a lista do Formulário (D-16-08, T-16-36)", () => {
  it("image/png de 20 MiB é aceito; audio/ogg de 17 MiB é recusado; o limite exato passa", () => {
    expect(tamanhoAceito(20 * MIB, tetoDoTipo("image/png"))).toBe(true);
    expect(tamanhoAceito(17 * MIB, tetoDoTipo("audio/ogg"))).toBe(false);
    expect(tamanhoAceito(16 * MIB, tetoDoTipo("audio/ogg"))).toBe(true);
    expect(tamanhoAceito(16 * MIB + 1, tetoDoTipo("video/mp4"))).toBe(false);
    expect(tamanhoAceito(25 * MIB + 1, tetoDoTipo("application/pdf"))).toBe(false);
  });

  it("UPLOAD_MAX_BYTES_MIDIA muda o teto de áudio e vídeo, e UPLOAD_MAX_BYTES o dos demais", () => {
    expect(tetosDeMidia({})).toEqual({ midia: 16 * MIB, demais: 25 * MIB });
    expect(tetosDeMidia({ UPLOAD_MAX_BYTES_MIDIA: "1000" })).toEqual({ midia: 1000, demais: 25 * MIB });
    expect(tetosDeMidia({ UPLOAD_MAX_BYTES: "2000", UPLOAD_MAX_BYTES_MIDIA: "1000" })).toEqual({ midia: 1000, demais: 2000 });
  });

  it("a lista do Formulário continua com os seis tipos de hoje: áudio, vídeo, Office e zip seguem recusados", () => {
    expect([...TIPOS_ACEITOS].sort()).toEqual(["application/pdf", "application/xml", "image/jpeg", "image/png", "image/webp", "text/xml"]);
    for (const tipo of ["audio/ogg", "audio/mpeg", "video/mp4", "application/zip", DOCX, XLSX, PPTX, "text/csv", "text/plain"]) {
      expect(tipoAceito(tipo)).toBe(false);
    }
  });

  it("emitirTicket sem opções (o caminho do Formulário) recusa áudio antes de tocar no banco ou no bucket", async () => {
    await expect(emitirTicket({ submissionId: "s", displayName: "voz.ogg", mediaType: "audio/ogg" })).rejects.toThrow("tipo_nao_aceito");
    await expect(emitirTicket({ submissionId: "s", displayName: "a.zip", mediaType: "application/zip" })).rejects.toThrow("tipo_nao_aceito");
  });

  it("a chave com prefixo é <prefixo>/<uuid>; sem prefixo, a do Formulário", () => {
    const chave = gerarObjectKey({ workspaceId: "ws_1", formId: "conversa-c1", submissionId: "s1", prefixo: "workspace/ws_1/conversas/c1" });
    expect(chave).toMatch(/^workspace\/ws_1\/conversas\/c1\/[0-9a-f-]{36}$/);
    expect(gerarObjectKey({ workspaceId: "ws_1", formId: "f1", submissionId: "s1" }).startsWith("workspace/ws_1/forms/f1/s1/")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Seção de integração — pula sem DATABASE_URL/SUPABASE_STORAGE_BUCKET (e as
// credenciais do Auth que o client admin de Storage reaproveita).
// ---------------------------------------------------------------------------

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const temBucket = Boolean(
  process.env.SUPABASE_STORAGE_BUCKET && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
);
const d = temBanco && temBucket ? describe : describe.skip;

const WS = "teste";
const FORM = "teste-upload";
const chavesCriadas: string[] = [];

function armazenamentoDeTeste() {
  return clienteAdmin().storage.from(process.env.SUPABASE_STORAGE_BUCKET as string);
}

async function enviarConteudo(ticket: { readonly objectKey: string; readonly token: string }, conteudo: Buffer, contentType: string) {
  const resultado = await armazenamentoDeTeste().uploadToSignedUrl(ticket.objectKey, ticket.token, conteudo, {
    contentType,
  });
  if (resultado.error) throw resultado.error;
  chavesCriadas.push(ticket.objectKey);
}

d("storage-uploads — integração contra o banco e o bucket de teste", () => {
  afterAll(async () => {
    if (chavesCriadas.length > 0) {
      await armazenamentoDeTeste().remove(chavesCriadas);
    }
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `delete from plataforma.upload_objects
          where session_id in (select id from plataforma.upload_sessions where workspace_id = $1)`,
        [WS],
      );
      await cliente.query("delete from plataforma.upload_sessions where workspace_id = $1", [WS]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  it("(a) emitirTicket -> upload real pelo uploadUrl -> confirmarObjeto marca enviado e devolve o sha-256 correto", async () => {
    const aberta = await abrirSessaoDeUpload({ workspaceId: WS, formId: FORM });
    const ticket = await emitirTicket({
      submissionId: aberta.submissionId,
      displayName: "nota.pdf",
      mediaType: "application/pdf",
    });

    const conteudo = Buffer.from("%PDF-1.4\n%teste-de-integracao-02-11\n");
    await enviarConteudo(ticket, conteudo, "application/pdf");

    const resultado = await confirmarObjeto({ submissionId: aberta.submissionId, objectId: ticket.objectId });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error("deveria confirmar");
    expect(resultado.sizeBytes).toBe(conteudo.byteLength);
    expect(resultado.sha256).toBe(createHash("sha256").update(conteudo).digest("hex"));

    const objetos = await objetosDaSessao(aberta.submissionId);
    expect(objetos.find((o) => o.id === ticket.objectId)?.state).toBe("enviado");
  });

  it("(b) confirmarObjeto com objectId de OUTRA sessão recusa (T-02-06)", async () => {
    const minha = await abrirSessaoDeUpload({ workspaceId: WS, formId: FORM });
    const alheia = await abrirSessaoDeUpload({ workspaceId: WS, formId: FORM });
    const ticketAlheio = await emitirTicket({
      submissionId: alheia.submissionId,
      displayName: "boleto.pdf",
      mediaType: "application/pdf",
    });

    const resultado = await confirmarObjeto({ submissionId: minha.submissionId, objectId: ticketAlheio.objectId });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error("deveria recusar");
    expect(resultado.motivo).toBe("objeto_nao_pertence_a_sessao");
  });

  it("(c) urlDeDownload responde 200; o mesmo caminho sem assinatura NÃO responde 200 — o bucket é privado", async () => {
    const aberta = await abrirSessaoDeUpload({ workspaceId: WS, formId: FORM });
    const ticket = await emitirTicket({
      submissionId: aberta.submissionId,
      displayName: "comprovante.pdf",
      mediaType: "application/pdf",
    });
    await enviarConteudo(ticket, Buffer.from("%PDF-1.4\n%download-privado\n"), "application/pdf");

    const { downloadUrl } = await urlDeDownload(ticket.objectKey);
    const comAssinatura = await fetch(downloadUrl);
    expect(comAssinatura.status).toBe(200);

    const semAssinatura = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/${process.env.SUPABASE_STORAGE_BUCKET}/${ticket.objectKey}`,
    );
    expect(semAssinatura.status).not.toBe(200);
    expect([400, 401, 403]).toContain(semAssinatura.status);
  });

  it("(d) consumirSessao duas vezes: a segunda recusa", async () => {
    const aberta = await abrirSessaoDeUpload({ workspaceId: WS, formId: FORM });
    const cliente = await pool().connect();
    try {
      await consumirSessao(cliente, aberta.submissionId);
      await expect(consumirSessao(cliente, aberta.submissionId)).rejects.toThrow(/sessao_ja_consumida/);
    } finally {
      cliente.release();
    }
  });

  it("(e) sessão expirada: emitirTicket recusa; coletarOrfaos remove o objeto do bucket e marca expirado", async () => {
    const aberta = await abrirSessaoDeUpload({ workspaceId: WS, formId: FORM });
    const ticket = await emitirTicket({
      submissionId: aberta.submissionId,
      displayName: "orfao.pdf",
      mediaType: "application/pdf",
    });
    await enviarConteudo(ticket, Buffer.from("%PDF-1.4\n%vira-orfao\n"), "application/pdf");

    const cliente = await pool().connect();
    try {
      await cliente.query(
        "update plataforma.upload_sessions set expires_at = now() - interval '1 hour' where id = $1",
        [aberta.submissionId],
      );
    } finally {
      cliente.release();
    }

    await expect(
      emitirTicket({ submissionId: aberta.submissionId, displayName: "outro.pdf", mediaType: "application/pdf" }),
    ).rejects.toThrow(/sessao_expirada/);

    const antes = await armazenamentoDeTeste().info(ticket.objectKey);
    expect(antes.error).toBeNull();

    const coleta = await coletarOrfaos({ limite: 200 });
    expect(coleta.sessoesExpiradas).toBeGreaterThanOrEqual(1);

    const depois = await armazenamentoDeTeste().info(ticket.objectKey);
    expect(depois.error).not.toBeNull();

    const objetos = await objetosDaSessao(aberta.submissionId);
    expect(objetos.find((o) => o.id === ticket.objectId)?.state).toBe("expirado");
  });

  it("(f) confirmarObjeto sobre objeto nunca enviado recusa com motivo objeto_ausente, sem lançar", async () => {
    const aberta = await abrirSessaoDeUpload({ workspaceId: WS, formId: FORM });
    const ticket = await emitirTicket({
      submissionId: aberta.submissionId,
      displayName: "nunca-enviado.pdf",
      mediaType: "application/pdf",
    });

    const resultado = await confirmarObjeto({ submissionId: aberta.submissionId, objectId: ticket.objectId });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error("deveria recusar");
    expect(resultado.motivo).toBe("objeto_ausente");
  });
});
