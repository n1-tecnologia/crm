// @vitest-environment jsdom
/**
 * 07-10 Task 1 — as mutações de Negócio chamam a rota certa de `apps/api`
 * (D-04, D-05), invalidam `/negocios`, `/funis` (contagens por Etapa) e o
 * Contato/Empresa do Negócio só no sucesso, e a recusa sobe como `ErroDeApi`
 * com `codigo` e `campo`. `valorDigitadoParaDecimal` entende o jeito de
 * digitar do Brasil. Nenhuma rede: `fetch` falso, sessão falsa.
 */

import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { VALOR_DECIMAL } from "@n1/dominio/crm/negocios";

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
import {
  arquivarNegocio,
  chaveDeNegocios,
  chaveDoNegocio,
  criarNegocio,
  editarNegocio,
  enviarNegocioParaLixeira,
  excluirNegocioPermanentemente,
  ganharNegocio,
  moverNegocio,
  perderNegocio,
  reabrirNegocio,
  restaurarNegocio,
  useNegocio,
  useNegocios,
  valorDigitadoParaDecimal,
} from "./negocios";

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

function chamadaFeita(indice = 0): { readonly url: string; readonly init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[indice] as [string, RequestInit];
  return { url, init };
}

function cabecalhos(init: RequestInit): string[] {
  return Object.keys((init.headers ?? {}) as Record<string, string>).map((k) => k.toLowerCase());
}

const DETALHADO = { negocio: { id: "n1", titulo: "Proposta" }, funil: { id: "f1" }, etapa: { id: "e2" } };

describe("mutações de Negócio — a rota certa", () => {
  it("(a) moverNegocio manda POST /negocios/n1/mover com a Etapa de destino", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    const dados = await moverNegocio("n1", { etapaId: "e2" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = chamadaFeita();
    expect(url).toBe("http://api/negocios/n1/mover");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ etapaId: "e2" }));
    expect(dados).toEqual(DETALHADO);
  });

  it("(a) ganharNegocio e perderNegocio mandam POST …/ganhar e …/perder com o corpo recebido", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await ganharNegocio("n1", { valor: "100.00" });
    await perderNegocio("n1", { motivoPerda: "Preço", notaEncerramento: "Foi para o concorrente." });
    const ganhar = chamadaFeita(0);
    expect(ganhar.url).toBe("http://api/negocios/n1/ganhar");
    expect(ganhar.init.method).toBe("POST");
    expect(ganhar.init.body).toBe(JSON.stringify({ valor: "100.00" }));
    const perder = chamadaFeita(1);
    expect(perder.url).toBe("http://api/negocios/n1/perder");
    expect(perder.init.method).toBe("POST");
    expect(perder.init.body).toBe(JSON.stringify({ motivoPerda: "Preço", notaEncerramento: "Foi para o concorrente." }));
  });

  it("(a) reabrirNegocio vai sem corpo e sem content-type quando não há destino, e com corpo quando há", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await reabrirNegocio("n1");
    await reabrirNegocio("n1", { funilId: "f2", etapaId: "e9" });
    const semDestino = chamadaFeita(0);
    expect(semDestino.url).toBe("http://api/negocios/n1/reabrir");
    expect(semDestino.init.method).toBe("POST");
    expect(semDestino.init.body).toBeUndefined();
    expect(cabecalhos(semDestino.init)).not.toContain("content-type");
    const comDestino = chamadaFeita(1);
    expect(comDestino.init.body).toBe(JSON.stringify({ funilId: "f2", etapaId: "e9" }));
  });

  it("(a) enviarNegocioParaLixeira manda DELETE /negocios/n1 e o resto do ciclo de vida usa as rotas do contrato", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: DETALHADO }));
    await enviarNegocioParaLixeira("n1");
    await criarNegocio({ titulo: "Proposta", contatoId: "c1" });
    await editarNegocio("n1", { valor: "10.50" });
    await arquivarNegocio("n1");
    await restaurarNegocio("n1");
    await excluirNegocioPermanentemente("n1");
    const chamadas = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(chamadas.map(([url, init]) => `${init.method} ${url.replace("http://api", "")}`)).toEqual([
      "DELETE /negocios/n1",
      "POST /negocios",
      "PATCH /negocios/n1",
      "POST /negocios/n1/arquivar",
      "POST /negocios/n1/restaurar",
      "DELETE /negocios/n1/permanente",
    ]);
    expect(chamadas[0]?.[1].body).toBeUndefined();
    expect(chamadas[1]?.[1].body).toBe(JSON.stringify({ titulo: "Proposta", contatoId: "c1" }));
  });

  it("(a) as chaves começam por /negocios e carregam o filtro", () => {
    expect(chaveDeNegocios({})).toBe("/negocios?estado=ativo&limite=50&deslocamento=0");
    expect(chaveDeNegocios({ funilId: "f1", estado: "ativo", limite: 200 })).toBe("/negocios?estado=ativo&funilId=f1&limite=200&deslocamento=0");
    expect(chaveDeNegocios({ empresaId: "e1", situacao: "aberto", q: "alfa sa", deslocamento: 50 })).toBe(
      "/negocios?estado=ativo&situacao=aberto&empresaId=e1&q=alfa+sa&limite=50&deslocamento=50",
    );
    expect(chaveDoNegocio("n1")).toBe("/negocios/n1");
  });

  it("(a) useNegocios lê a chave do filtro e useNegocio desembrulha o detalhe", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/negocios/n1") ? resposta(200, { ok: true, dados: DETALHADO }) : resposta(200, { ok: true, itens: [], total: 0 }),
    );
    const envoltorio = ({ children }: { readonly children: ReactNode }) =>
      createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
    const lista = renderHook(() => useNegocios({ funilId: "f1", estado: "ativo", limite: 200 }), { wrapper: envoltorio });
    await waitFor(() => expect(lista.result.current.data).toEqual({ ok: true, itens: [], total: 0 }));
    expect(chamadaFeita().url).toBe("http://api/negocios?estado=ativo&funilId=f1&limite=200&deslocamento=0");
    const ficha = renderHook(() => useNegocio("n1"), { wrapper: envoltorio });
    await waitFor(() => expect(ficha.result.current.data).toEqual(DETALHADO));
  });
});

describe("mutações de Negócio — invalidação e recusa", () => {
  it("(a) depois do sucesso, /negocios, /funis, /contatos e /empresas são invalidados", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true, dados: DETALHADO }));
    await moverNegocio("n1", { etapaId: "e2" });
    expect(invalidarCrm).toHaveBeenCalledWith("/negocios");
    expect(invalidarCrm).toHaveBeenCalledWith("/funis");
    expect(invalidarCrm).toHaveBeenCalledWith("/contatos");
    expect(invalidarCrm).toHaveBeenCalledWith("/empresas");
  });

  it("(a) numa recusa a ErroDeApi sobe com codigo e campo, e nada é invalidado", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(409, { ok: false, error: "Este Funil exige o motivo da perda para marcar o Negócio como perdido.", codigo: "NEGOCIO_EXIGE_MOTIVO", campo: "motivoPerda" }),
    );
    const erro = await perderNegocio("n1", {}).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect((erro as ErroDeApi).codigo).toBe("NEGOCIO_EXIGE_MOTIVO");
    expect((erro as ErroDeApi).campo).toBe("motivoPerda");
    expect((erro as ErroDeApi).status).toBe(409);
    expect(invalidarCrm).not.toHaveBeenCalled();
  });
});

describe("valorDigitadoParaDecimal", () => {
  it("(a) aceita o jeito de digitar do Brasil e devolve texto decimal que cabe em VALOR_DECIMAL", () => {
    expect(valorDigitadoParaDecimal("1.234,56")).toBe("1234.56");
    expect(valorDigitadoParaDecimal("1234,5")).toBe("1234.5");
    expect(valorDigitadoParaDecimal("1234.50")).toBe("1234.50");
    expect(valorDigitadoParaDecimal("  R$ 2.500  ")).toBe("2500");
    expect(valorDigitadoParaDecimal("1.234.567,89")).toBe("1234567.89");
    expect(valorDigitadoParaDecimal("0,99")).toBe("0.99");
    expect(valorDigitadoParaDecimal("1500")).toBe("1500");
    for (const texto of ["1.234,56", "1234,5", "1234.50", "2.500"]) {
      expect(VALOR_DECIMAL.test(valorDigitadoParaDecimal(texto) ?? "")).toBe(true);
    }
  });

  it("(a) devolve undefined para o que não cabe em numeric(15,2)", () => {
    for (const texto of ["", "   ", "abc", "-5", "1,234,56", "12,345", "1.2.3,4", "12345678901234", "1e5", ","]) {
      expect(valorDigitadoParaDecimal(texto)).toBeUndefined();
    }
  });
});
