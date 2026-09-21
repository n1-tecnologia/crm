/**
 * Um servidor HTTP de verdade (`node:http`, porta efêmera), nunca um mock de
 * `fetch`: o worker de outbox e o adapter chamam `fetch` real, e um mock de
 * `fetch` esconderia justamente o erro de transporte que os planos de
 * outbox (02-10), fila (02-17) e fallback de 90 dias (02-24) precisam
 * provar — timeout, resposta perdida, 429, 503.
 *
 * A fila (`enfileirar`) é FIFO e consumida uma resposta por requisição.
 * Quando esvazia, o servidor responde 500 `SEM_RESPOSTA_PROGRAMADA`: um
 * teste que chama mais vezes do que programou deve falhar, não passar por
 * acidente.
 */

import { createServer, type IncomingMessage, type Server } from "node:http";

export type RespostaProgramada =
  | { readonly kind: "ok"; readonly status: number; readonly corpo?: unknown; readonly cabecalhos?: Record<string, string> }
  | { readonly kind: "atraso"; readonly ms: number; readonly status: number; readonly corpo?: unknown }
  /** Recebe e processa o corpo, registra o recebimento, destrói o socket sem responder — "API aplica mutação e a resposta se perde" da Fault-Injection Matrix. */
  | { readonly kind: "respostaPerdida" }
  /** Nunca responde e nunca fecha. */
  | { readonly kind: "timeout" };

export interface RequisicaoRecebida {
  readonly metodo: string;
  readonly caminho: string;
  readonly cabecalhos: Record<string, string | undefined>;
  readonly corpo: unknown;
}

export interface ServidorFalso {
  readonly url: string;
  enfileirar(resposta: RespostaProgramada): void;
  readonly recebidas: ReadonlyArray<RequisicaoRecebida>;
  fechar(): Promise<void>;
}

function lerCorpo(requisicao: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const pedacos: Buffer[] = [];
    requisicao.on("data", (pedaco: Buffer) => pedacos.push(pedaco));
    requisicao.on("end", () => {
      const bruto = Buffer.concat(pedacos).toString("utf8");
      if (!bruto) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(bruto));
      } catch {
        resolve(bruto);
      }
    });
    requisicao.on("error", reject);
  });
}

function cabecalhosSimples(requisicao: IncomingMessage): Record<string, string | undefined> {
  const saida: Record<string, string | undefined> = {};
  for (const [chave, valor] of Object.entries(requisicao.headers)) {
    saida[chave] = Array.isArray(valor) ? valor.join(", ") : valor;
  }
  return saida;
}

export async function criarServidorFalso(): Promise<ServidorFalso> {
  const fila: RespostaProgramada[] = [];
  const recebidas: RequisicaoRecebida[] = [];

  const servidor: Server = createServer((requisicao, resposta) => {
    void lerCorpo(requisicao).then((corpo) => {
      recebidas.push({
        metodo: requisicao.method ?? "GET",
        caminho: requisicao.url ?? "/",
        cabecalhos: cabecalhosSimples(requisicao),
        corpo,
      });

      const proxima = fila.shift();
      if (!proxima) {
        resposta.writeHead(500, { "content-type": "application/json" });
        resposta.end(JSON.stringify({ error: { code: "SEM_RESPOSTA_PROGRAMADA" } }));
        return;
      }

      switch (proxima.kind) {
        case "ok": {
          resposta.writeHead(proxima.status, { "content-type": "application/json", ...proxima.cabecalhos });
          resposta.end(proxima.corpo === undefined ? undefined : JSON.stringify(proxima.corpo));
          return;
        }
        case "atraso": {
          const cronometro = setTimeout(() => {
            resposta.writeHead(proxima.status, { "content-type": "application/json" });
            resposta.end(proxima.corpo === undefined ? undefined : JSON.stringify(proxima.corpo));
          }, proxima.ms);
          // O cliente pode abortar (AbortSignal) antes do prazo — não escrever num socket morto.
          resposta.on("close", () => clearTimeout(cronometro));
          return;
        }
        case "respostaPerdida": {
          requisicao.socket.destroy();
          return;
        }
        case "timeout": {
          return; // de propósito: nunca responde, nunca fecha.
        }
      }
    });
  });

  await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const endereco = servidor.address();
  if (endereco === null || typeof endereco === "string") {
    throw new Error("Servidor falso não conseguiu abrir uma porta efêmera.");
  }
  const url = `http://127.0.0.1:${endereco.port}`;

  return {
    url,
    enfileirar(respostaProgramada) {
      fila.push(respostaProgramada);
    },
    recebidas,
    async fechar() {
      // Sockets abertos por "timeout" nunca fecham sozinhos — sem isto,
      // servidor.close() esperaria para sempre por eles.
      servidor.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        servidor.close((erro) => (erro ? reject(erro) : resolve()));
      });
    },
  };
}
