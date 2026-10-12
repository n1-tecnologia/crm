/**
 * 08-01 Task 2 — o cliente HTTP de Canais contra um `fetch` falso: o corpo e os
 * cabeçalhos do `POST /canais`, a recusa 409 que chega à tela com `codigo` e
 * `campo`, e a invalidação de `/canais` só no sucesso. Nenhuma rede, nenhum
 * `apps/api` no ar.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

// `invalidarCrm` é espiado; `chamarCrm`/`ErroDeApi` são os de verdade.
vi.mock("./cliente-crm", async (original) => {
  const real = await original<typeof import("./cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

import { ErroDeApi, invalidarCrm } from "./cliente-crm";
import { chaveDeCanais, criarCanal } from "./canais";

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

describe("criarCanal", () => {
  it("faz UM POST /canais com o Bearer, content-type JSON e só as três chaves, e devolve dados", async () => {
    const canal = { id: "9b2f6c1e-0801-4c3a-9f00-000000000002", nome: "Comercial", conexao: "desconectada" };
    fetchMock.mockResolvedValueOnce(resposta(201, { ok: true, dados: canal }));

    const criado = await criarCanal({ provedor: "whatsapp-cloud", nome: "Comercial", identificador: "+55 11 97777-0002" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/canais");
    expect(init.method).toBe("POST");
    const cabecalhos = init.headers as Record<string, string>;
    expect(cabecalhos["authorization"]).toBe("Bearer tok");
    expect(cabecalhos["content-type"]).toBe("application/json");
    const corpo = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(corpo).sort()).toEqual(["identificador", "nome", "provedor"]);
    expect(corpo).toEqual({ provedor: "whatsapp-cloud", nome: "Comercial", identificador: "+55 11 97777-0002" });
    expect(criado).toEqual(canal);
    expect(invalidarCrm).toHaveBeenCalledWith("/canais");
  });

  it("um 409 CANAL_CONTA_EM_USO vira ErroDeApi com status, codigo e campo, e não invalida nada", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(409, {
        ok: false,
        error: "Esta conta já está conectada em outro Canal ativo.",
        codigo: "CANAL_CONTA_EM_USO",
        campo: "identificador",
      }),
    );

    const erro = await criarCanal({ provedor: "whatsapp-nao-oficial", nome: "Outro", identificador: "+55 11 97777-0002" }).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(ErroDeApi);
    const e = erro as ErroDeApi;
    expect(e.status).toBe(409);
    expect(e.codigo).toBe("CANAL_CONTA_EM_USO");
    expect(e.campo).toBe("identificador");
    expect(e.message).toBe("Esta conta já está conectada em outro Canal ativo.");
    expect(invalidarCrm).not.toHaveBeenCalled();
  });
});

describe("chaveDeCanais", () => {
  it("o filtro vazio é /canais?estado=ativo&limite=50&deslocamento=0", () => {
    expect(chaveDeCanais({})).toBe("/canais?estado=ativo&limite=50&deslocamento=0");
  });

  it("respeita estado, limite e deslocamento e começa por /canais (para invalidarCrm)", () => {
    const chave = chaveDeCanais({ estado: "arquivado", limite: 10, deslocamento: 20 });
    expect(chave).toBe("/canais?estado=arquivado&limite=10&deslocamento=20");
    expect(chave.startsWith("/canais")).toBe(true);
  });
});
