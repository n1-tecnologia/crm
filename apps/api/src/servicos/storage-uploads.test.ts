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
  gerarObjectKey,
  limiteDeArquivosAtingido,
  tamanhoAceito,
  tipoAceito,
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
