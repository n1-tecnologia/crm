import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarServidorFalso, type ServidorFalso } from "./servidor-falso";

describe("criarServidorFalso", () => {
  let servidor: ServidorFalso;

  beforeEach(async () => {
    servidor = await criarServidorFalso();
  });

  afterEach(async () => {
    await servidor.fechar();
  });

  it("kind: ok devolve o status e o corpo programados", async () => {
    servidor.enfileirar({ kind: "ok", status: 201, corpo: { criado: true } });
    const resposta = await fetch(servidor.url);
    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toEqual({ criado: true });
  });

  it("kind: respostaPerdida registra a requisição em recebidas e o fetch do chamador rejeita", async () => {
    servidor.enfileirar({ kind: "respostaPerdida" });
    await expect(
      fetch(servidor.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ valor: 1 }),
      }),
    ).rejects.toThrow();
    expect(servidor.recebidas).toHaveLength(1);
    expect(servidor.recebidas[0]).toMatchObject({ metodo: "POST", corpo: { valor: 1 } });
  });

  it("kind: atraso com AbortSignal.timeout menor que ms faz o fetch abortar", async () => {
    servidor.enfileirar({ kind: "atraso", ms: 300, status: 200, corpo: {} });
    await expect(fetch(servidor.url, { signal: AbortSignal.timeout(30) })).rejects.toThrow();
  });

  it("fila vazia devolve 500 SEM_RESPOSTA_PROGRAMADA", async () => {
    const resposta = await fetch(servidor.url);
    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toEqual({ error: { code: "SEM_RESPOSTA_PROGRAMADA" } });
  });

  it("a ordem de recebidas é a ordem das chamadas", async () => {
    servidor.enfileirar({ kind: "ok", status: 200, corpo: {} });
    servidor.enfileirar({ kind: "ok", status: 200, corpo: {} });
    servidor.enfileirar({ kind: "ok", status: 200, corpo: {} });

    await fetch(`${servidor.url}/um`);
    await fetch(`${servidor.url}/dois`);
    await fetch(`${servidor.url}/tres`);

    expect(servidor.recebidas.map((r) => r.caminho)).toEqual(["/um", "/dois", "/tres"]);
  });
});
