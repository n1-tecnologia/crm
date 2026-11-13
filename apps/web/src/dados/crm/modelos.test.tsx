// @vitest-environment jsdom
/**
 * Sessão 7 (7.3.5) — os modelos de mensagem pela api: `useModelosDoCanal` lê `GET /canais/:id/modelos`, `useModelosEnviaveis` deixa
 * só os que o Canal envia agora (e só pede à api no WhatsApp oficial) e `sincronizarModelosDoCanal` faz `POST …/sincronizar` sem corpo
 * e revalida a lista só no sucesso. Enviar a Mensagem de modelo é `enviarMensagem`, `abrirConversa` e `criarTarefaConversacional`, que
 * levam `modeloId` e `variaveis` no corpo, com o `conteudo` vazio.
 */

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

const { obterSessao, invalidar } = vi.hoisted(() => ({ obterSessao: vi.fn(), invalidar: vi.fn(async () => undefined) }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));
vi.mock("./cliente-crm", async (original) => ({ ...(await original<typeof import("./cliente-crm")>()), invalidarCrm: invalidar }));

import { ErroDeApi } from "./cliente-crm";
import { abrirConversa } from "./conversas";
import { enviarMensagem } from "./mensagens";
import { chaveDosModelos, sincronizarModelosDoCanal, useModelosDoCanal, useModelosEnviaveis } from "./modelos";
import { criarTarefaConversacional, trocarCanalDaTarefa } from "./tarefas-conversacionais";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const modelo = (id: string, enviavel: boolean) => ({
  id,
  canalId: "uuid-1",
  idNoProvedor: `meta_${id}`,
  nome: `modelo_${id}`,
  idioma: "pt_BR",
  categoria: "utilidade",
  estado: enviavel ? "aprovado" : "pendente",
  motivoDeRejeicao: null,
  componentes: [{ type: "BODY", text: "Olá {{1}}" }],
  quantidadeDeVariaveis: 1,
  sincronizadoEm: "2026-11-13T12:00:00.000Z",
  enviavel,
  motivoDeNaoEnviavel: null,
});

let fetchMock: ReturnType<typeof vi.fn>;

const envolver = ({ children }: { readonly children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryInterval: 10 }}>{children}</SWRConfig>
);

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  invalidar.mockClear();
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

// Desmonta os hooks de cada teste: o de 5xx continua repetindo e chamaria o `fetch` do teste seguinte.
afterEach(() => {
  cleanup();
});

describe("useModelosDoCanal", () => {
  it("lê GET /canais/:id/modelos com o Bearer e devolve a lista no formato das outras listas", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [modelo("m1", true)], total: 1 }));
    const { result } = renderHook(() => useModelosDoCanal("uuid-1"), { wrapper: envolver });

    await waitFor(() => expect(result.current.data?.total).toBe(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/canais/uuid-1/modelos");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer tok");
    expect(result.current.data?.itens[0]).toMatchObject({ nome: "modelo_m1", enviavel: true });
  });

  it("sem Canal, ou pausado: não lê nada", async () => {
    renderHook(() => useModelosDoCanal(undefined), { wrapper: envolver });
    renderHook(() => useModelosDoCanal("uuid-1", { pausado: true }), { wrapper: envolver });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a chave é debaixo de /canais (toda escrita de Canal a revalida) e codifica o id", () => {
    expect(chaveDosModelos("uuid-1")).toBe("/canais/uuid-1/modelos");
    expect(chaveDosModelos("a/b")).toBe("/canais/a%2Fb/modelos");
  });

  it("403 fica em `error` como ErroDeApi e não é repetido (recusa 4xx não melhora ao repetir)", async () => {
    fetchMock.mockResolvedValue(resposta(403, { ok: false, error: "Sem permissão.", codigo: "PERMISSAO" }));
    const { result } = renderHook(() => useModelosDoCanal("uuid-1"), { wrapper: envolver });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ErroDeApi));
    await new Promise((r) => setTimeout(r, 60));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("useModelosEnviaveis", () => {
  it("WhatsApp oficial: devolve só os enviáveis; enquanto a lista não chega, `carregando`", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, itens: [modelo("m1", true), modelo("m2", false)], total: 2 }));
    const { result } = renderHook(() => useModelosEnviaveis({ id: "uuid-1", provedor: "whatsapp-cloud" }), { wrapper: envolver });

    expect(result.current).toMatchObject({ oficial: true, carregando: true, enviaveis: [] });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.enviaveis.map((m) => m.nome)).toEqual(["modelo_m1"]);
  });

  it("outro provedor, ou sem Canal: nunca pede modelos à api e não fica carregando", async () => {
    const { result } = renderHook(() => useModelosEnviaveis({ id: "uuid-2", provedor: "whatsapp-nao-oficial" }), { wrapper: envolver });
    const semCanal = renderHook(() => useModelosEnviaveis(undefined), { wrapper: envolver });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ oficial: false, enviaveis: [], carregando: false });
    expect(semCanal.result.current).toEqual({ oficial: false, enviaveis: [], carregando: false });
  });

  it("a leitura que falha vale como sem modelo: sem enviáveis e sem ficar carregando", async () => {
    fetchMock.mockResolvedValue(resposta(500, { ok: false, error: "fora do ar" }));
    const { result } = renderHook(() => useModelosEnviaveis({ id: "uuid-1", provedor: "whatsapp-cloud" }), { wrapper: envolver });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.enviaveis).toEqual([]);
  });

  it("pausado: não lê e não fica carregando (o diálogo fechado, ou a Conversa que já existe)", async () => {
    const { result } = renderHook(() => useModelosEnviaveis({ id: "uuid-1", provedor: "whatsapp-cloud" }, { pausado: true }), { wrapper: envolver });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.carregando).toBe(false);
  });
});

describe("sincronizarModelosDoCanal", () => {
  it("POST /canais/:id/modelos/sincronizar sem corpo e sem content-type, devolve as contagens e revalida a lista", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { criados: 1, atualizados: 2, removidos: 3, ignorados: 0 } }));
    expect(await sincronizarModelosDoCanal("uuid-1")).toEqual({ criados: 1, atualizados: 2, removidos: 3, ignorados: 0 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/canais/uuid-1/modelos/sincronizar");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)["content-type"]).toBeUndefined();
    expect(invalidar).toHaveBeenCalledWith("/canais/uuid-1/modelos");
  });

  it("a recusa sobe como ErroDeApi com a frase da api, e a lista NÃO é revalidada", async () => {
    fetchMock.mockResolvedValue(resposta(409, { ok: false, error: "Conecte o Canal antes de sincronizar os modelos.", codigo: "CANAL_NAO_CONECTADO" }));
    const erro = (await sincronizarModelosDoCanal("uuid-1").catch((e: unknown) => e)) as ErroDeApi;
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro).toMatchObject({ status: 409, codigo: "CANAL_NAO_CONECTADO", message: "Conecte o Canal antes de sincronizar os modelos." });
    expect(invalidar).not.toHaveBeenCalled();
  });
});

describe("a Mensagem de modelo vai no corpo, com o conteúdo vazio", () => {
  const corpoDe = (n = 0) => JSON.parse(String((fetchMock.mock.calls[n] as [string, RequestInit])[1].body));

  it("enviarMensagem: POST /mensagens com modeloId e variaveis", async () => {
    fetchMock.mockResolvedValue(resposta(201, { ok: true, dados: { id: "msg_1" } }));
    await enviarMensagem({ conversaId: "cnv_1", direcao: "enviada", conteudo: "", modeloId: "m1", variaveis: ["Ana", "1234"] });
    expect(corpoDe()).toEqual({ conversaId: "cnv_1", direcao: "enviada", conteudo: "", modeloId: "m1", variaveis: ["Ana", "1234"] });
  });

  it("abrirConversa: POST /conversas com a mensagem de modelo", async () => {
    fetchMock.mockResolvedValue(resposta(201, { ok: true, dados: { conversa: { id: "cnv_1" }, primeiraMensagem: { id: "msg_1" } } }));
    await abrirConversa({ canalId: "uuid-1", contatoId: "ct_1", mensagem: { conteudo: "", modeloId: "m1", variaveis: ["Ana"] } });
    expect(corpoDe()).toEqual({ canalId: "uuid-1", contatoId: "ct_1", mensagem: { conteudo: "", modeloId: "m1", variaveis: ["Ana"] } });
  });

  it("criarTarefaConversacional e trocarCanalDaTarefa: a primeira Mensagem também pode ser de modelo", async () => {
    fetchMock.mockResolvedValue(resposta(201, { ok: true, dados: { value: { task: { id: "tsk_1" } }, conversa: { id: "cnv_1", aberta: true } } }));
    await criarTarefaConversacional({ listId: "lst_1", contatoId: "ct_1", canalId: "uuid-1", mensagem: { conteudo: "", modeloId: "m1", variaveis: ["Ana"] } });
    expect(corpoDe(0)).toMatchObject({ mensagem: { conteudo: "", modeloId: "m1", variaveis: ["Ana"] } });

    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { value: { task: { id: "tsk_1" }, mudou: true }, conversa: { id: "cnv_2" } } }));
    await trocarCanalDaTarefa("tsk_1", { canalId: "uuid-2", mensagem: { conteudo: "", modeloId: "m1", variaveis: ["Ana"] } });
    expect(corpoDe(1)).toEqual({ canalId: "uuid-2", mensagem: { conteudo: "", modeloId: "m1", variaveis: ["Ana"] } });
  });
});
