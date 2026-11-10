// @vitest-environment jsdom
/**
 * 15-13 Task 1 (UCR-06) — a página `/crm/contatos/[contato]` existe só no modelo novo: 404 da api
 * mostra "Contato não encontrado." mesmo quando o seed traz um Contato antigo de mesmo id (sem recuo
 * para a ficha antiga, sem ponte por `crm_de_para`); 200 desenha a ficha nova; Contato `mesclado`
 * leva ao sobrevivente (Fase 14). O teste mora em `features/crm/` porque `app/` só guarda convenção
 * de arquivo do Next. Nenhuma rede: `fetch` roteado, sessão falsa, `StoreProvider` de verdade com o seed.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { ContatoDetalhado } from "@n1/dominio/crm/contatos";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import ContatoPage from "@/app/(shell)/crm/contatos/[contato]/page";

const { obterSessao, trocarRota } = vi.hoisted(() => ({ obterSessao: vi.fn(), trocarRota: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/contatos/c1",
  useRouter: () => ({ replace: trocarRota, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function detalhado(sobre: Partial<ContatoDetalhado["contato"]> = {}): ContatoDetalhado {
  return {
    contato: {
      id: "c1",
      nome: "Ana",
      sobrenome: "Souza",
      dataNascimento: null,
      idioma: "pt-BR",
      fusoHorario: null,
      fotoUrl: null,
      descricao: null,
      enderecos: [],
      camposAdicionais: {},
      origem: null,
      qualificacao: null,
      modoCriacao: "manual",
      estado: "ativo",
      mescladoEmId: null,
      mescladoEm: null,
      proprietarioId: "mem_julia",
      criadoPor: "mem_julia",
      criadoEm: "2026-10-01T10:00:00.000Z",
      atualizadoEm: "2026-10-01T10:00:00.000Z",
      ...sobre,
    },
    identificadores: [
      { id: "i1", contatoId: "c1", tipo: "email", valor: "ana@x.com", valorExibido: null, rotuloCanal: null, verificado: false, principal: true, criadoEm: "2026-10-01T10:00:00.000Z" },
    ],
    vinculos: [],
  };
}

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const NAO_ENCONTRADO = { ok: false, error: "Contato não encontrado.", codigo: "CONTATO_NAO_ENCONTRADO" };

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, () => Response>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  rotas = {};
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const caminho = url.replace("http://api", "");
    const rota = rotas[`${init.method ?? "GET"} ${caminho}`];
    if (rota) return rota();
    // Notas, consentimentos e Negócios da ficha: listas vazias. O resto é o Contato que a api não conhece.
    if (/^\/(contatos\/[^/]+\/(notas|consentimentos)|negocios)/.test(caminho)) return resposta(200, { ok: true, itens: [], total: 0 });
    return resposta(404, NAO_ENCONTRADO);
  });
  vi.stubGlobal("fetch", fetchMock);
  trocarRota.mockClear();
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

async function montarPagina(id: string) {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  const params = Promise.resolve({ contato: id });
  let resultado!: ReturnType<typeof render>;
  await act(async () => {
    resultado = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId: "mem_julia" }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
          <Suspense fallback="carregando">
            <ContatoPage params={params} />
          </Suspense>
        </StoreProvider>
      </SWRConfig>,
    );
  });
  return resultado.container;
}

describe("página /crm/contatos/[contato] — só o modelo novo (UCR-06)", () => {
  it("404 da api para um id que não existe em lugar nenhum mostra Contato não encontrado", async () => {
    const container = await montarPagina("nao-existe");
    await vi.waitFor(() => expect(container.textContent).toContain("Contato não encontrado."));
    expect(container.textContent).toContain("Ele pode ter sido excluído permanentemente.");
  });

  it("404 da api para um id que existe no modelo antigo também mostra Contato não encontrado (sem recuo)", async () => {
    // O seed não cria mais Contato (15-31): basta o id do Contato do modelo antigo (do demo), que a api não conhece.
    const antigo = { id: "cnt_1" };
    const container = await montarPagina(antigo.id);
    await vi.waitFor(() => expect(container.textContent).toContain("Contato não encontrado."));
    expect(container.textContent).not.toContain("Consentimentos");
  });

  it("borda UCR-06: abrir o mesmo id antigo de novo mostra o mesmo não encontrado", async () => {
    // O seed não cria mais Contato (15-31): basta o id do Contato do modelo antigo (do demo), que a api não conhece.
    const antigo = { id: "cnt_1" };
    const primeira = await montarPagina(antigo.id);
    await vi.waitFor(() => expect(primeira.textContent).toContain("Contato não encontrado."));
    cleanup();
    const segunda = await montarPagina(antigo.id);
    await vi.waitFor(() => expect(segunda.textContent).toContain("Contato não encontrado."));
  });

  it("200 da api desenha a ficha nova", async () => {
    rotas["GET /contatos/c1"] = () => resposta(200, { ok: true, dados: detalhado() });
    const container = await montarPagina("c1");
    await vi.waitFor(() => expect(container.textContent).toContain("Ana Souza"));
    expect(container.textContent).toContain("ana@x.com");
    expect(container.textContent).not.toContain("Contato não encontrado.");
  });

  it("Contato mesclado (011): a página leva ao sobrevivente e não desenha a ficha do absorvido", async () => {
    rotas["GET /contatos/c_absorvido"] = () =>
      resposta(200, { ok: true, dados: detalhado({ id: "c_absorvido", estado: "mesclado", mescladoEmId: "c_sobrevivente", mescladoEm: "2026-11-01T10:00:00.000Z" }) });
    const container = await montarPagina("c_absorvido");
    await vi.waitFor(() => expect(trocarRota).toHaveBeenCalledWith("/crm/contatos/c_sobrevivente"));
    expect(container.textContent).not.toContain("ana@x.com");
    expect(container.textContent).not.toContain("Ana Souza");
  });
});
