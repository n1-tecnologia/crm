/**
 * O cliente de leituras (Plan 04-02, Task 2) — no molde de
 * `invocar-agente.test.ts`, casos (f)-(m): todo caso injeta `fetchImpl`,
 * zero rede real, roda sem `DATABASE_URL` e sem `SUPABASE_*`.
 */

import { describe, expect, it } from "vitest";
import {
  classificarLeitura,
  criarClienteDeLeituras,
  type ArquivoParaEnviar,
} from "./cliente-leituras-financeiro";

interface ChamadaCapturada {
  readonly url: string;
  readonly metodo: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

type PassoFalso =
  | { readonly kind: "ok"; readonly status: number; readonly corpo?: unknown }
  | { readonly kind: "corpo-invalido"; readonly status: number; readonly texto: string }
  | { readonly kind: "erro"; readonly erro: unknown }
  | { readonly kind: "timeout" };

function headersParaObjeto(headers: RequestInit["headers"] | undefined): Record<string, string> {
  const objeto: Record<string, string> = {};
  if (!headers) return objeto;
  const entradas = headers instanceof Headers ? Array.from(headers.entries()) : Object.entries(headers as Record<string, string>);
  for (const [chave, valor] of entradas) objeto[chave.toLowerCase()] = valor;
  return objeto;
}

/** `fetchImpl` falso: sem rede real, com fila de passos e captura de cada chamada. */
function criarFetchFalso(passos: readonly PassoFalso[]): { fetchImpl: typeof fetch; chamadas: ChamadaCapturada[] } {
  const chamadas: ChamadaCapturada[] = [];
  let indice = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = headersParaObjeto(init?.headers);
    chamadas.push({ url: String(input), metodo: init?.method ?? "GET", headers, body: init?.body });
    const passo = passos[indice] ?? passos[passos.length - 1]!;
    indice += 1;

    if (passo.kind === "timeout") {
      return new Promise<Response>((_resolve, reject) => {
        const sinal = init?.signal;
        if (sinal) {
          sinal.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
        }
      });
    }
    if (passo.kind === "erro") throw passo.erro;
    if (passo.kind === "corpo-invalido") return new Response(passo.texto, { status: passo.status });
    return new Response(JSON.stringify(passo.corpo ?? {}), { status: passo.status });
  };
  return { fetchImpl, chamadas };
}

const DESTINO = "http://automation.invalido";
const TOKEN = "tok-leitura";

describe("classificarLeitura — mesma semântica de classificar() em invocar-agente.ts", () => {
  it.each([401, 403, 404, 422])("(d) HTTP %i sem envelope é permanente", (status) => {
    expect(classificarLeitura(status, undefined, undefined).permanente).toBe(true);
  });

  it.each([429, 500])("(d) HTTP %i sem envelope é transitório", (status) => {
    expect(classificarLeitura(status, undefined, undefined).permanente).toBe(false);
  });

  it("(e) envelope com retryable:false e status 503 é permanente (CONFIGURACAO_AUSENTE)", () => {
    const r = classificarLeitura(503, { error: { code: "CONFIGURACAO_AUSENTE", retryable: false } }, undefined);
    expect(r.permanente).toBe(true);
    expect(r.code).toBe("CONFIGURACAO_AUSENTE");
  });

  it("(f) envelope com retryable:true e status 400 é transitório — o envelope manda sobre a lista de status", () => {
    const r = classificarLeitura(400, { error: { retryable: true } }, undefined);
    expect(r.permanente).toBe(false);
  });

  it("(g) status desconhecido é permanente, por segurança", () => {
    expect(classificarLeitura(418, undefined, undefined).permanente).toBe(true);
  });
});

describe("criarClienteDeLeituras — ler/enviar/enviarArquivo, com fetchImpl injetado", () => {
  it("(a) ler com 200 devolve { ok: true, corpo } com o JSON parseado", async () => {
    const { fetchImpl } = criarFetchFalso([{ kind: "ok", status: 200, corpo: { itens: [1, 2, 3] } }]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: TOKEN, fetchImpl });
    const resultado = await cliente.ler<{ itens: number[] }>("/v1/leituras/workflows");
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.status).toBe(200);
      expect(resultado.corpo.itens).toEqual([1, 2, 3]);
    }
  });

  it("(b) authorization chega como Bearer <token> e existe x-request-id", async () => {
    const { fetchImpl, chamadas } = criarFetchFalso([{ kind: "ok", status: 200, corpo: {} }]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: TOKEN, fetchImpl });
    await cliente.ler("/v1/leituras/dashboard");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(chamadas[0]?.headers["x-request-id"]).toBeTruthy();
  });

  it("(c) query vira querystring codificada; query vazio não acrescenta ?", async () => {
    const { fetchImpl, chamadas } = criarFetchFalso([
      { kind: "ok", status: 200, corpo: {} },
      { kind: "ok", status: 200, corpo: {} },
    ]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: TOKEN, fetchImpl });

    await cliente.ler("/v1/leituras/notas-fiscais", { query: { empresa: "exo_participacoes", nome: "João Ápice" } });
    const urlComQuery = new URL(chamadas[0]!.url);
    expect(urlComQuery.searchParams.get("empresa")).toBe("exo_participacoes");
    expect(urlComQuery.searchParams.get("nome")).toBe("João Ápice");

    await cliente.ler("/v1/leituras/notas-fiscais", { query: {} });
    expect(chamadas[1]?.url).toBe(`${DESTINO}/v1/leituras/notas-fiscais`);
    expect(chamadas[1]?.url).not.toContain("?");
  });

  it("(h) fetchImpl que rejeita com AbortError vira ERRO_DE_REDE transitório", async () => {
    const { fetchImpl } = criarFetchFalso([{ kind: "erro", erro: new DOMException("The operation was aborted.", "AbortError") }]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: TOKEN, fetchImpl });
    const resultado = await cliente.ler("/v1/leituras/problemas");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.permanente).toBe(false);
      expect(resultado.code).toBe("ERRO_DE_REDE");
    }
  });

  it("(i) timeout de verdade, sem esperar mais que timeoutMs: resultado é transitório", async () => {
    const { fetchImpl } = criarFetchFalso([{ kind: "timeout" }]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: TOKEN, fetchImpl, timeoutMs: 5 });
    const resultado = await cliente.ler("/v1/leituras/dashboard");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.permanente).toBe(false);
  }, 2_000);

  it("(j) o summary do erro NUNCA contém o corpo da resposta", async () => {
    const { fetchImpl } = criarFetchFalso([
      { kind: "ok", status: 500, corpo: { error: { message: "senha=supersecreta pg: connection to 10.0.0.1 failed" } } },
    ]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: TOKEN, fetchImpl });
    const resultado = await cliente.ler("/v1/leituras/dashboard");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.summary).not.toContain("supersecreta");
      expect(resultado.summary).not.toContain("10.0.0.1");
    }
  });

  it("(k) token vazio: nenhuma chamada ao fetchImpl e CREDENCIAL_AUSENTE permanente", async () => {
    const { fetchImpl, chamadas } = criarFetchFalso([{ kind: "ok", status: 200, corpo: {} }]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: "", fetchImpl });
    const resultado = await cliente.ler("/v1/leituras/dashboard");
    expect(chamadas).toHaveLength(0);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("CREDENCIAL_AUSENTE");
      expect(resultado.permanente).toBe(true);
    }
  });

  it("(l) enviar manda content-type: application/json e o corpo serializado", async () => {
    const { fetchImpl, chamadas } = criarFetchFalso([{ kind: "ok", status: 200, corpo: { ok: true } }]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: TOKEN, fetchImpl });
    await cliente.enviar("/v1/leituras/plano-contas", { rows: [{ id: "1" }] });
    expect(chamadas[0]?.headers["content-type"]).toBe("application/json");
    expect(chamadas[0]?.body).toBe(JSON.stringify({ rows: [{ id: "1" }] }));
  });

  it("(l) enviarArquivo manda o Buffer como corpo, com x-file-name, x-source e o content-type do arquivo — sem content-type: application/json", async () => {
    const { fetchImpl, chamadas } = criarFetchFalso([{ kind: "ok", status: 200, corpo: { ok: true } }]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: TOKEN, fetchImpl });
    const arquivo: ArquivoParaEnviar = {
      conteudo: Buffer.from("conteudo-do-extrato"),
      contentType: "application/pdf",
      nome: "extrato-nubank.pdf",
      origem: "nubank",
    };
    await cliente.enviarArquivo("/v1/leituras/extratos/nubank", arquivo);
    expect(chamadas[0]?.headers["x-file-name"]).toBe("extrato-nubank.pdf");
    expect(chamadas[0]?.headers["x-source"]).toBe("crm-n1-financeiro");
    expect(chamadas[0]?.headers["content-type"]).toBe("application/pdf");
    expect(chamadas[0]?.body).toBe(arquivo.conteudo);
  });

  it("(m) corpo de resposta que não é JSON válido em um 200 é RESPOSTA_INVALIDA, permanente", async () => {
    const { fetchImpl } = criarFetchFalso([{ kind: "corpo-invalido", status: 200, texto: "isto não é json" }]);
    const cliente = criarClienteDeLeituras({ destinoUrl: DESTINO, token: TOKEN, fetchImpl });
    const resultado = await cliente.ler("/v1/leituras/workflows");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.code).toBe("RESPOSTA_INVALIDA");
      expect(resultado.permanente).toBe(true);
    }
  });
});
