/**
 * D-23 (02-CONTEXT.md) exige medir p50/p95/p99 VPS ↔ Postgres e VPS ↔ Storage
 * antes de congelar a topologia — não estimar. Este arquivo tem duas partes:
 *
 * 1. Uma seção pura, sem env, que prova `construirSsl()` de `conexao.ts`
 *    (T-02-TLS): sem CA nem flag de escape a conexão remota recusa, em vez
 *    de degradar — sem abrir socket nenhum.
 * 2. A medição real: 200 transações representativas contra o Postgres e,
 *    quando o bucket de teste estiver configurado, 50 downloads assinados
 *    contra o Storage. Pula inteiro sem `DATABASE_URL` (D-DEC-09).
 *
 * A asserção da medição é **não bloqueante por padrão** — imprime p50/p95/p99
 * e passa, porque grande parte do desenvolvimento roda contra um Postgres
 * distante (notebook → Supabase remoto) e isso não deveria quebrar
 * `npm run check`. Definir `LATENCIA_P95_MAX_MS` torna a asserção bloqueante:
 * é o gate que o Plan 02-27 (pré-corte) liga contra o Postgres/bucket reais
 * da VPS. A saída imprime só números e nomes de operação — nenhum dado de
 * Espaço, Tarefa ou Membro.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clienteAdmin } from "../autenticacao/verificar-token";
import { bootstrapGestao } from "../bootstrap/gestao";
import { carregarEnv, construirSsl, encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { abrirSessaoDeUpload, confirmarObjeto, emitirTicket, urlDeDownload } from "../servicos/storage-uploads";

// ---------------------------------------------------------------------------
// Seção pura — sempre roda, sem env, sem socket (T-02-TLS).
// ---------------------------------------------------------------------------

describe("conexao — construirSsl() decide TLS sem abrir socket", () => {
  const REMOTO = "postgresql://user:pass@db.supabase.co:5432/postgres";
  const LOCAL = "postgresql://user:pass@127.0.0.1:5432/postgres";

  it("host local nunca usa TLS, mesmo sem nenhuma variável definida", () => {
    expect(construirSsl({ connectionString: LOCAL, env: {} })).toBeUndefined();
  });

  it("host remoto sem DATABASE_CA_CERT/DATABASE_CA_PATH/DATABASE_SSL_INSECURE falha com mensagem explícita", () => {
    expect(() => construirSsl({ connectionString: REMOTO, env: {} })).toThrow(
      /verificação de TLS definida/,
    );
  });

  it("DATABASE_CA_CERT define a CA e habilita rejectUnauthorized: true", () => {
    const opcoes = construirSsl({
      connectionString: REMOTO,
      env: { DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----" },
    });
    expect(opcoes).toEqual({
      ca: "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----",
      rejectUnauthorized: true,
    });
  });

  it("DATABASE_CA_PATH lê o arquivo e habilita rejectUnauthorized: true", () => {
    const opcoes = construirSsl({
      connectionString: REMOTO,
      env: { DATABASE_CA_PATH: "/tmp/ca.pem" },
      lerArquivo: (caminho) => {
        expect(caminho).toBe("/tmp/ca.pem");
        return "conteudo-do-arquivo-pem";
      },
    });
    expect(opcoes).toEqual({ ca: "conteudo-do-arquivo-pem", rejectUnauthorized: true });
  });

  it("DATABASE_SSL_INSECURE=true volta ao comportamento antigo e avisa alto no log", () => {
    const avisos: unknown[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => avisos.push(args);
    try {
      const opcoes = construirSsl({ connectionString: REMOTO, env: { DATABASE_SSL_INSECURE: "true" } });
      expect(opcoes).toEqual({ rejectUnauthorized: false });
      expect(avisos.length).toBe(1);
      expect(String(avisos[0])).toMatch(/DESLIGADA/);
      expect(String(avisos[0])).toMatch(/proibido fora de desenvolvimento/);
    } finally {
      console.warn = original;
    }
  });

  it("DATABASE_SSL_INSECURE vence mesmo com DATABASE_CA_CERT também definida", () => {
    const original = console.warn;
    console.warn = () => undefined;
    try {
      const opcoes = construirSsl({
        connectionString: REMOTO,
        env: { DATABASE_SSL_INSECURE: "true", DATABASE_CA_CERT: "ignorada" },
      });
      expect(opcoes).toEqual({ rejectUnauthorized: false });
    } finally {
      console.warn = original;
    }
  });
});

// ---------------------------------------------------------------------------
// Medição real — pula inteiro sem DATABASE_URL (D-DEC-09).
// ---------------------------------------------------------------------------

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const temBucket = Boolean(
  process.env.SUPABASE_STORAGE_BUCKET && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
);
const d = temBanco ? describe : describe.skip;

const WS = "ws_latencia_teste";
const LIMITE_P95_MS = process.env.LATENCIA_P95_MAX_MS ? Number(process.env.LATENCIA_P95_MAX_MS) : undefined;

function percentil(amostrasMs: readonly number[], p: number): number {
  const ordenadas = [...amostrasMs].sort((a, b) => a - b);
  const indice = Math.min(ordenadas.length - 1, Math.max(0, Math.ceil((p / 100) * ordenadas.length) - 1));
  return ordenadas[indice]!;
}

/** Imprime só o nome da operação e os três números — nenhum dado do Espaço. */
function resumo(nomeDaOperacao: string, amostrasMs: readonly number[]): { p50: number; p95: number; p99: number } {
  const p50 = percentil(amostrasMs, 50);
  const p95 = percentil(amostrasMs, 95);
  const p99 = percentil(amostrasMs, 99);
  console.log(
    `\n  latência — ${nomeDaOperacao}: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms (n=${amostrasMs.length})`,
  );
  return { p50, p95, p99 };
}

/** Passa sempre quando não há LIMITE_P95_MS (só mede e imprime); vira gate quando há (Plan 02-27). */
function afirmarDentroDoLimiteQuandoConfigurado(p95: number): void {
  if (LIMITE_P95_MS !== undefined) {
    expect(p95).toBeLessThan(LIMITE_P95_MS);
  } else {
    expect(p95).toBeGreaterThanOrEqual(0);
  }
}

d("latência real VPS ↔ Postgres / VPS ↔ Storage (D-23)", () => {
  beforeAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
      await bootstrapGestao(cliente, { workspaceId: WS });
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      if (temBucket) {
        await cliente.query(
          `delete from plataforma.upload_objects
            where session_id in (select id from plataforma.upload_sessions where workspace_id = $1)`,
          [WS],
        );
        await cliente.query("delete from plataforma.upload_sessions where workspace_id = $1", [WS]);
      }
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  it(
    "banco: 200 transações representativas (begin → hidratar → update revisão → rollback)",
    async () => {
      const amostras: number[] = [];
      for (let i = 0; i < 200; i += 1) {
        const cliente = await pool().connect();
        const t0 = performance.now();
        try {
          await cliente.query("begin");
          const antes = await hidratar(cliente, WS);
          await cliente.query(
            "update plataforma.workspaces set revisao = revisao + 1, atualizado_em = now() where workspace_id = $1 and revisao = $2",
            [WS, antes.revisao],
          );
          await cliente.query("rollback");
        } finally {
          amostras.push(performance.now() - t0);
          cliente.release();
        }
      }
      const { p95 } = resumo("banco (begin → hidratar → update revisão → rollback)", amostras);
      afirmarDentroDoLimiteQuandoConfigurado(p95);
    },
    120_000,
  );

  it.skipIf(!temBucket)(
    "storage: 50 downloads assinados de um objeto real (urlDeDownload + GET)",
    async () => {
      const bucket = process.env.SUPABASE_STORAGE_BUCKET as string;
      const aberta = await abrirSessaoDeUpload({ workspaceId: WS, formId: "form_latencia_teste" });
      const ticket = await emitirTicket({
        submissionId: aberta.submissionId,
        displayName: "latencia.pdf",
        mediaType: "application/pdf",
      });
      const conteudo = Buffer.from("%PDF-1.4\n%teste-de-latencia-plan-02-15\n");

      const envio = await clienteAdmin()
        .storage.from(bucket)
        .uploadToSignedUrl(ticket.objectKey, ticket.token, conteudo, { contentType: "application/pdf" });
      if (envio.error) throw envio.error;

      try {
        const confirmado = await confirmarObjeto({ submissionId: aberta.submissionId, objectId: ticket.objectId });
        expect(confirmado.ok).toBe(true);

        const amostras: number[] = [];
        for (let i = 0; i < 50; i += 1) {
          const t0 = performance.now();
          const { downloadUrl } = await urlDeDownload(ticket.objectKey);
          const resposta = await fetch(downloadUrl);
          if (!resposta.ok) throw new Error(`download assinado falhou: ${resposta.status}`);
          await resposta.arrayBuffer();
          amostras.push(performance.now() - t0);
        }
        const { p95 } = resumo("storage (urlDeDownload + GET ao objeto assinado)", amostras);
        afirmarDentroDoLimiteQuandoConfigurado(p95);
      } finally {
        await clienteAdmin().storage.from(bucket).remove([ticket.objectKey]);
      }
    },
    60_000,
  );
});
