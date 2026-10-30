/**
 * A linha de medição de `POST /operacoes/:nome` (Fase 12, 12-01, D-02/D-03).
 *
 * Sem banco: pool, repositório, outbox e eventos de Canal são falsos (o molde de
 * `persistencia/unidade-de-trabalho.test.ts`); o logger escreve num array, como
 * `observabilidade/log.test.ts`. O que se prova aqui é a FORMA da saída:
 *
 *   - toda gravação deixa UMA linha `"gravacao medida"` com as etapas como números;
 *   - a medição nunca vai para o corpo da resposta (T-12-01: o painel de rede da
 *     tela mostraria o tempo interno do servidor);
 *   - a linha nunca carrega dado de negócio (T-12-02): nem o nome da Lista
 *     enviado, nem o e-mail do convite.
 */

import { buildSeed } from "@n1/dominio/seed";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app";
import { opcoesDoLogger } from "../observabilidade/log";

const falso = vi.hoisted(() => ({
  /** Linhas do `update plataforma.workspaces`: 0 simula a revisão que mudou (conflito). */
  linhasDoUpdate: 1,
  /** Quando preenchido, `hidratar` lança isto (a exceção que vira 500). */
  hidratarLanca: undefined as Error | undefined,
}));

vi.mock("../persistencia/conexao", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../persistencia/conexao")>()),
  pool: () => ({
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.startsWith("update plataforma.workspaces")) {
          return falso.linhasDoUpdate === 0 ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ revisao: "8" }] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => undefined,
    }),
  }),
}));
vi.mock("../persistencia/repositorio", async () => {
  const { buildSeed: semear } = await import("@n1/dominio/seed");
  const { DIFERENCA_VAZIA } = await import("@n1/dominio");
  return {
    hidratar: async () => {
      if (falso.hidratarLanca) throw falso.hidratarLanca;
      return { state: semear(), revisao: 7, original: new Map(), ordem: new Map() };
    },
    gravar: async () => DIFERENCA_VAZIA,
  };
});
vi.mock("../persistencia/outbox", () => ({ gravarEventos: async () => undefined }));
vi.mock("../persistencia/eventos-de-canal", () => ({ execucoesNovas: () => [], eventosDeNotificacaoPorCanal: () => [] }));

const PROPRIETARIO = buildSeed().members.find((m) => m.id === "mem_thiago")!;
const NOME_DA_LISTA = "Lista Medicao Sigilosa 4711";

function appComLogCapturado() {
  const linhas: string[] = [];
  const destino = { write: (linha: string) => void linhas.push(linha) };
  const app = buildApp({
    logger: opcoesDoLogger({ LOG_LEVEL: "info" }, destino),
    workspaceId: "ws_medicao",
    verificarToken: async () => ({ sub: "usr_medicao" }),
    resolverMembro: async () => PROPRIETARIO,
  });
  return { app, linhas };
}

/** As linhas de medição do log, já em objeto. */
function linhasDeMedicao(linhas: readonly string[]) {
  return linhas
    .map((linha) => JSON.parse(linha) as { msg?: string; operacao?: string; medicao?: Record<string, unknown> })
    .filter((l) => l.msg === "gravacao medida");
}

beforeEach(() => {
  falso.linhasDoUpdate = 1;
  falso.hidratarLanca = undefined;
});

describe("POST /operacoes/:nome — a linha de medição (D-02/D-03)", () => {
  it("200: uma linha com as etapas em número e o corpo sem a chave medicao", async () => {
    const { app, linhas } = appComLogCapturado();
    const resposta = await app.inject({
      method: "POST",
      url: "/operacoes/createList",
      headers: { authorization: "Bearer qualquer" },
      payload: { args: [{ name: NOME_DA_LISTA, parentType: "space", parentId: "spc_com" }] },
    });
    await app.close();

    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json() as Record<string, unknown>;
    expect(corpo.ok).toBe(true);
    expect(Object.keys(corpo)).not.toContain("medicao");
    expect(resposta.headers["server-timing"]).toBeUndefined();

    const medidas = linhasDeMedicao(linhas);
    expect(medidas).toHaveLength(1);
    const linha = medidas[0]!;
    expect(linha.operacao).toBe("createList");
    expect(typeof linha.medicao?.hidratarMs).toBe("number");
    expect(typeof linha.medicao?.recorteMs).toBe("number");
    expect(typeof linha.medicao?.totalMs).toBe("number");
    expect(linha.medicao?.desfecho).toBe("gravou");

    // T-12-02 — o nome da Lista que a pessoa digitou nunca entra no log de medição.
    const crua = linhas.find((l) => l.includes("gravacao medida"))!;
    expect(crua).not.toContain(NOME_DA_LISTA);
  });
});
