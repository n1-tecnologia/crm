// @vitest-environment jsdom
/**
 * 15-06 Task 2 — `useMensagens` lê o fio da Conversa e `enviarMensagem` grava
 * por HTTP nas rotas de `apps/api` (`/mensagens`); a invalidação (`/mensagens`
 * e `/conversas`) só acontece no sucesso. Nenhuma rede: `fetch` falso, sessão falsa.
 */

import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("./cliente-crm", async (original) => {
  const real = await original<typeof import("./cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

import { ErroDeApi, invalidarCrm } from "./cliente-crm";
import { chaveDasMensagens, chaveDoAnexo, enviarMensagem, pedirTicketDeAnexo, reenviarMensagem, useMensagens, useUrlDoAnexo } from "./mensagens";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  vi.mocked(invalidarCrm).mockClear();
});

afterEach(() => {
  cleanup();
});

const envoltorio = ({ children }: { readonly children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

describe("useMensagens", () => {
  it("(a) a chave começa por /mensagens e leva a Conversa, o limite e o deslocamento", () => {
    expect(chaveDasMensagens("c1")).toBe("/mensagens?conversaId=c1&limite=50&deslocamento=0");
    expect(chaveDasMensagens("c1", { limite: 100, deslocamento: 50 })).toBe("/mensagens?conversaId=c1&limite=100&deslocamento=50");
  });

  it("(a) useMensagens('c1') chama /mensagens?conversaId=c1&limite=50&deslocamento=0 e devolve itens e total", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [{ id: "m1" }], total: 1 }));
    const { result } = renderHook(() => useMensagens("c1"), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data).toEqual({ ok: true, itens: [{ id: "m1" }], total: 1 }));
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://api/mensagens?conversaId=c1&limite=50&deslocamento=0");
  });

  it("(a) sem Conversa escolhida não chama a rede", () => {
    renderHook(() => useMensagens(undefined), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("enviarMensagem", () => {
  const entrada = { conversaId: "c1", direcao: "enviada", conteudo: "Olá" } as const;

  it("(b) manda POST /mensagens com o corpo, devolve a Mensagem e invalida /mensagens e /conversas", async () => {
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: { id: "m1", conversaId: "c1" } }));
    const dados = await enviarMensagem(entrada);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/mensagens");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(entrada));
    expect(dados.id).toBe("m1");
    expect(vi.mocked(invalidarCrm).mock.calls.map(([prefixo]) => prefixo).sort()).toEqual(["/conversas", "/mensagens"]);
  });

  it.each([
    [409, "CANAL_DESCONECTADO"],
    [403, "SEM_PERMISSAO"],
  ])("(b) numa recusa %i nada é invalidado e a ErroDeApi sobe com o codigo", async (status, codigo) => {
    fetchMock.mockResolvedValueOnce(resposta(status, { ok: false, error: "Recusado.", codigo }));
    const erro = (await enviarMensagem(entrada).catch((e: unknown) => e)) as ErroDeApi;
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.status).toBe(status);
    expect(erro.codigo).toBe(codigo);
    expect(invalidarCrm).not.toHaveBeenCalled();
  });
});

describe("reenviarMensagem (16-11, 3.7.3)", () => {
  it("(c) manda POST /mensagens/<id>/reenviar sem corpo, devolve a Mensagem e invalida /mensagens e /conversas", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: { id: "m1", statusEntrega: "pendente" } }));
    const dados = await reenviarMensagem("m1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/mensagens/m1/reenviar");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(dados.statusEntrega).toBe("pendente");
    expect(vi.mocked(invalidarCrm).mock.calls.map(([prefixo]) => prefixo).sort()).toEqual(["/conversas", "/mensagens"]);
  });

  it.each([
    [409, "NAO_FALHOU"],
    [409, "CANAL_ARQUIVADO"],
    [404, "MENSAGEM_NAO_ENCONTRADA"],
    [403, "SEM_PERMISSAO"],
  ])("(c) numa recusa %i (%s) nada é invalidado e a ErroDeApi sobe com o codigo", async (status, codigo) => {
    fetchMock.mockResolvedValueOnce(resposta(status, { ok: false, error: "Recusado.", codigo }));
    const erro = (await reenviarMensagem("m1").catch((e: unknown) => e)) as ErroDeApi;
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.status).toBe(status);
    expect(erro.codigo).toBe(codigo);
    expect(invalidarCrm).not.toHaveBeenCalled();
  });
});

describe("useUrlDoAnexo (16-11, 3.9.5)", () => {
  it("(d) a chave é /mensagens/<id>/anexos/<indice>", () => {
    expect(chaveDoAnexo("m1", 0)).toBe("/mensagens/m1/anexos/0");
  });

  it("(d) anexo guardado: pede GET /mensagens/<id>/anexos/<indice> e devolve a URL e o vencimento", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { url: "https://armazem.test/a?assinatura=1", expiraEm: "2026-11-09T20:05:00.000Z" } }));
    const { result } = renderHook(() => useUrlDoAnexo("m1", 0, true), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.data?.dados.url).toBe("https://armazem.test/a?assinatura=1"));
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://api/mensagens/m1/anexos/0");
  });

  it("(d) anexo que o provedor não entregou (baixado: false) não chama a rede", () => {
    renderHook(() => useUrlDoAnexo("m1", 0, false), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("pedirTicketDeAnexo e enviarMensagem com anexos (16-11, 3.9.5 / D-16-10)", () => {
  const pedido = { conversaId: "c1", nome: "foto.png", tipoDeMidia: "image/png", tamanhoBytes: 2048 } as const;

  it("(e) POST /mensagens/anexos leva a Conversa, o nome, o tipo e o tamanho e devolve o ticket, sem invalidar nada", async () => {
    const ticket = { submissionId: "s1", objectId: "o1", uploadUrl: "https://armazem.test/upload/o1" };
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: ticket }));
    expect(await pedirTicketDeAnexo(pedido)).toEqual(ticket);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/mensagens/anexos");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(pedido));
    expect(invalidarCrm).not.toHaveBeenCalled();
  });

  it.each([
    [422, "ARQUIVO_GRANDE_DEMAIS"],
    [422, "TIPO_NAO_ENVIADO_PELO_CANAL"],
    [409, "CANAL_ARQUIVADO"],
  ])("(e) numa recusa %i (%s) a ErroDeApi sobe com a frase e o codigo", async (status, codigo) => {
    fetchMock.mockResolvedValueOnce(resposta(status, { ok: false, error: "O arquivo passa do limite.", codigo }));
    const erro = (await pedirTicketDeAnexo(pedido).catch((e: unknown) => e)) as ErroDeApi;
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.status).toBe(status);
    expect(erro.codigo).toBe(codigo);
    expect(erro.message).toBe("O arquivo passa do limite.");
  });

  it("(e) enviarMensagem leva os anexos no corpo", async () => {
    const entrada = { conversaId: "c1", direcao: "enviada", conteudo: "", anexos: [{ submissionId: "s1", objectId: "o1" }] } as const;
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: { id: "m1" } }));
    await enviarMensagem(entrada);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify(entrada));
  });
});
