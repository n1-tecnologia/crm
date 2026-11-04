/**
 * A linha de medição de `POST /operacoes/:nome` (Fase 12, 12-01, D-02/D-03).
 *
 * Sem banco: pool, repositório, outbox e eventos de Canal são falsos (o molde de
 * `persistencia/unidade-de-trabalho.test.ts`, inclusive as mensagens de várias
 * instruções do regime travado, Fase 13); o logger escreve num array, como
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
  /** Quando verdadeiro, o `select … for update` do regime travado (dentro da mensagem de entrada) dá 55P03 (a trava esgotada): conflito, 409. */
  travaEsgotada: false,
  /** Quando preenchido, a leitura do Espaço lança isto (a exceção que vira 500). */
  hidratarLanca: undefined as Error | undefined,
}));

vi.mock("../persistencia/conexao", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../persistencia/conexao")>()),
  pool: () => ({
    connect: async () => ({
      query: async (sql: string) => {
        // A mensagem de entrada do travado: begin, prazos, trava, leitura (um resultado por instrução).
        if (sql.startsWith("begin") && sql.includes("for update")) {
          if (falso.travaEsgotada) throw Object.assign(new Error("canceling statement due to lock timeout"), { code: "55P03" });
          const vazio = { rowCount: null, rows: [] };
          return [vazio, vazio, vazio, vazio, { rowCount: 1, rows: [{ revisao: "7" }] }, { rowCount: 0, rows: [] }];
        }
        // A de saída: o update da revisão e o commit.
        if (sql.startsWith("update plataforma.workspaces") && sql.endsWith("commit")) {
          return [{ rowCount: 1, rows: [{ revisao: "8" }] }, { rowCount: null, rows: [] }];
        }
        if (sql.startsWith("update plataforma.workspaces")) return { rowCount: 1, rows: [{ revisao: "8" }] };
        return { rowCount: 0, rows: [] };
      },
      release: () => undefined,
    }),
  }),
}));
vi.mock("../persistencia/repositorio", async () => {
  const { buildSeed: semear } = await import("@n1/dominio/seed");
  const { DIFERENCA_VAZIA } = await import("@n1/dominio");
  const hidratado = () => {
    if (falso.hidratarLanca) throw falso.hidratarLanca;
    return { state: semear(), revisao: 7, original: new Map(), ordem: new Map() };
  };
  return {
    hidratar: async () => hidratado(),
    sqlDeHidratar: (espaco: string) => `<sql de hidratar ${espaco}>`,
    estadoDasLinhas: () => hidratado(),
    gravar: async () => DIFERENCA_VAZIA,
    planejarGravacao: () => ({ upserts: [], removidos: [], diferenca: DIFERENCA_VAZIA }),
    sqlsDoPlano: () => [],
  };
});
// `inviteMember` resolve e-mail → userId no Supabase Auth ANTES da transação: o teste não vai à rede.
vi.mock("../autenticacao/resolver-usuario", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("../autenticacao/resolver-usuario")>()),
  resolverUsuarioPorEmail: async () => "usr_convidado",
}));
vi.mock("../persistencia/outbox", () => ({ gravarEventos: async () => undefined }));
vi.mock("../persistencia/eventos-de-canal", () => ({ execucoesNovas: () => [], eventosDeNotificacaoPorCanal: () => [] }));

const PROPRIETARIO = buildSeed().members.find((m) => m.id === "mem_thiago")!;
const NOME_DA_LISTA = "Lista Medicao Sigilosa 4711";
const EMAIL_DO_CONVITE = "convite.medicao@exemplo.com";

/** POST autenticado numa operação: devolve a resposta e as linhas de log capturadas. */
async function postar(nome: string, args: unknown[]) {
  const { app, linhas } = appComLogCapturado();
  const resposta = await app.inject({
    method: "POST",
    url: `/operacoes/${nome}`,
    headers: { authorization: "Bearer qualquer" },
    payload: { args },
  });
  await app.close();
  return { resposta, linhas, corpo: resposta.json() as Record<string, unknown> };
}

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
  falso.travaEsgotada = false;
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
    expect(linha.medicao?.regime).toBe("travado");

    // T-12-02 — o nome da Lista que a pessoa digitou nunca entra no log de medição.
    const crua = linhas.find((l) => l.includes("gravacao medida"))!;
    expect(crua).not.toContain(NOME_DA_LISTA);
  });

  it("recusa do domínio (Espaço inexistente): 200 ok:false, corpo sem medicao, linha com desfecho recusou", async () => {
    const { resposta, linhas, corpo } = await postar("createList", [
      { name: NOME_DA_LISTA, parentType: "space", parentId: "spc_que_nao_existe" },
    ]);

    expect(resposta.statusCode).toBe(200);
    expect(corpo.ok).toBe(false);
    expect(Object.keys(corpo)).not.toContain("medicao");
    const medidas = linhasDeMedicao(linhas);
    expect(medidas).toHaveLength(1);
    expect(medidas[0]!.medicao?.desfecho).toBe("recusou");
    expect(typeof medidas[0]!.medicao?.totalMs).toBe("number");
  });

  it("409 (a trava esgotou, 55P03 no select … for update): corpo sem medicao, linha com desfecho conflito, tentativas 1 e regime travado", async () => {
    falso.travaEsgotada = true;
    const { resposta, linhas, corpo } = await postar("createList", [
      { name: NOME_DA_LISTA, parentType: "space", parentId: "spc_com" },
    ]);

    expect(resposta.statusCode).toBe(409);
    expect(corpo).toMatchObject({ ok: false, conflito: true });
    expect(typeof corpo.error).toBe("string");
    expect(Object.keys(corpo)).not.toContain("medicao");
    const medidas = linhasDeMedicao(linhas);
    expect(medidas).toHaveLength(1);
    expect(medidas[0]!.operacao).toBe("createList");
    expect(medidas[0]!.medicao?.desfecho).toBe("conflito");
    expect(medidas[0]!.medicao?.tentativas).toBe(1);
    expect(medidas[0]!.medicao?.regime).toBe("travado");
  });

  it("500 (exceção no meio da transação): corpo opaco sem medicao, linha com desfecho excecao", async () => {
    falso.hidratarLanca = new Error("falha de teste na hidratação");
    const { resposta, linhas, corpo } = await postar("createList", [
      { name: NOME_DA_LISTA, parentType: "space", parentId: "spc_com" },
    ]);

    expect(resposta.statusCode).toBe(500);
    expect(corpo).toEqual({ ok: false, error: "Erro interno." });
    expect(Object.keys(corpo)).not.toContain("medicao");
    const medidas = linhasDeMedicao(linhas);
    expect(medidas).toHaveLength(1);
    expect(medidas[0]!.medicao?.desfecho).toBe("excecao");
  });

  it("inviteMember (por SERVICOS): 200 sem medicao no corpo, linha com a operação e sem o e-mail do convite", async () => {
    const { resposta, linhas, corpo } = await postar("inviteMember", [{ email: EMAIL_DO_CONVITE, roleId: "role_adm" }]);

    expect(resposta.statusCode).toBe(200);
    expect(corpo.ok).toBe(true);
    expect(Object.keys(corpo)).not.toContain("medicao");
    const medidas = linhasDeMedicao(linhas);
    expect(medidas).toHaveLength(1);
    expect(medidas[0]!.operacao).toBe("inviteMember");
    expect(medidas[0]!.medicao?.desfecho).toBe("gravou");
    const crua = linhas.find((l) => l.includes("gravacao medida"))!;
    expect(crua).not.toContain(EMAIL_DO_CONVITE);
  });

  it("400/403/404 não gravam e não escrevem a linha de medição", async () => {
    const naoExiste = await postar("operacaoQueNaoExiste", []);
    expect(naoExiste.resposta.statusCode).toBe(404);
    expect(linhasDeMedicao(naoExiste.linhas)).toHaveLength(0);

    const malFormada = await postar("createList", [{ name: NOME_DA_LISTA }]);
    expect(malFormada.resposta.statusCode).toBe(400);
    expect(linhasDeMedicao(malFormada.linhas)).toHaveLength(0);
  });
});
