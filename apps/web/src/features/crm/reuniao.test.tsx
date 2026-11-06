// @vitest-environment jsdom
/**
 * 15-15 (UCR-06, UCR-03) — a Reunião em `/crm/reunioes/[reuniao]` lê o lead no CRM novo:
 * o Negócio de `plataforma.negocios` (achado pelo Vínculo da Tarefa em `state.links`), a Etapa
 * e o Funil dele, o Contato e a Empresa; a nota escrita na call vai para `POST /contatos/:id/notas`
 * (nada para `/operacoes`); e "Tudo que já aconteceu" junta `state.activity` com `GET /atividades`
 * do Negócio e do Contato. Reunião sem Negócio, ou com Negócio na lixeira, mostra o estado vazio.
 * O teste mora em `features/crm/` porque `app/` só guarda convenção de arquivo do Next. Nenhuma
 * rede: `fetch` roteado por método e URL, sessão falsa, `StoreProvider` de verdade com o seed.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import type { ContatoDetalhado } from "@n1/dominio/crm/contatos";
import type { EmpresaDetalhada } from "@n1/dominio/crm/empresas";
import type { NegocioDetalhado } from "@n1/dominio/crm/negocios";
import type { ActivityRecord } from "@n1/dominio/types/primitives";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import ReuniaoPage from "@/app/(shell)/crm/reunioes/[reuniao]/page";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

// `invalidarCrm` é espiado: o `mutate` global do SWR não alcança o cache isolado do `SWRConfig` do teste.
vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

const NEGOCIO_ID = "neg-novo";
const CONTATO_ID = "con-novo";
const EMPRESA_ID = "emp-nova";
const INSTANTE = "2026-10-01T10:00:00.000Z";

function negocio(sobre: Partial<NegocioDetalhado["negocio"]> = {}, resto: Partial<Omit<NegocioDetalhado, "negocio">> = {}): NegocioDetalhado {
  return {
    negocio: {
      id: NEGOCIO_ID,
      titulo: "Contrato Acme 2026",
      objeto: "Plano anual",
      descricao: null,
      empresaId: EMPRESA_ID,
      contatoId: CONTATO_ID,
      funilId: "f-vendas",
      etapaId: "et-proposta",
      valor: "2500.00",
      moeda: "BRL",
      probabilidade: null,
      situacao: "aberto",
      motivoPerda: null,
      motivoGanho: null,
      notaEncerramento: null,
      origem: null,
      dataPrevistaFechamento: "2026-11-30",
      encerradoEm: null,
      estado: "ativo",
      proprietarioId: "mem_julia",
      criadoPor: "mem_julia",
      criadoEm: INSTANTE,
      atualizadoEm: INSTANTE,
      ...sobre,
    },
    funil: { id: "f-vendas", nome: "Funil Comercial Novo", estado: "ativo", exigeMotivoPerda: false, exigeValorGanho: false },
    etapa: { id: "et-proposta", nome: "Etapa Proposta Nova", probabilidadePadrao: 50 },
    etapasDoFunil: [{ id: "et-proposta", nome: "Etapa Proposta Nova", ordem: 1 }],
    empresa: { id: EMPRESA_ID, nome: "Acme Indústria", estado: "ativo" },
    contato: { id: CONTATO_ID, nome: "Beatriz Lima", estado: "ativo" },
    probabilidadeEfetiva: 50,
    ...resto,
  };
}

function contato(): ContatoDetalhado {
  return {
    contato: {
      id: CONTATO_ID,
      nome: "Beatriz",
      sobrenome: "Lima",
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
      criadoEm: INSTANTE,
      atualizadoEm: INSTANTE,
    },
    identificadores: [
      { id: "i1", contatoId: CONTATO_ID, tipo: "email", valor: "beatriz@acme.com", valorExibido: null, rotuloCanal: null, verificado: false, principal: true, criadoEm: INSTANTE },
      { id: "i2", contatoId: CONTATO_ID, tipo: "instagram", valor: "beatriz.lima", valorExibido: null, rotuloCanal: null, verificado: false, principal: false, criadoEm: INSTANTE },
    ],
    vinculos: [{ id: "v1", empresaId: EMPRESA_ID, empresaNome: "Acme Indústria", cargo: "Diretora de Compras", admin: false, inicio: null, fim: null }],
  };
}

function empresa(): EmpresaDetalhada {
  return {
    empresa: {
      id: EMPRESA_ID,
      nomeFantasia: "Acme Indústria",
      razaoSocial: "Acme Indústria Ltda",
      descricao: null,
      matrizId: null,
      enderecos: [],
      camposAdicionais: {},
      origem: null,
      estado: "ativo",
      proprietarioId: "mem_julia",
      criadoPor: "mem_julia",
      criadoEm: INSTANTE,
      atualizadoEm: INSTANTE,
    },
    identificadores: [],
    vinculos: [],
    matriz: null,
    filiais: [],
  };
}

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, () => Response>;
let gravar: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  rotas = {
    [`GET /negocios/${NEGOCIO_ID}`]: () => resposta(200, { ok: true, dados: negocio() }),
    [`GET /contatos/${CONTATO_ID}`]: () => resposta(200, { ok: true, dados: contato() }),
    [`GET /empresas/${EMPRESA_ID}`]: () => resposta(200, { ok: true, dados: empresa() }),
  };
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const caminho = url.replace("http://api", "");
    const exata = rotas[`${init.method ?? "GET"} ${caminho}`];
    if (exata) return exata();
    // Atividades: a rota aceita o início da chave (a query traz limite etc.).
    const chave = Object.keys(rotas).find((k) => k.endsWith("*") && `${init.method ?? "GET"} ${caminho}`.startsWith(k.slice(0, -1)));
    if (chave) return rotas[chave]!();
    if (caminho.startsWith("/atividades")) return resposta(200, { ok: true, itens: [] });
    return resposta(404, { ok: false, error: "Não encontrado.", codigo: "NAO_ENCONTRADO" });
  });
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  gravar = vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." }));
});

afterEach(() => {
  cleanup();
});

/** O Espaço do seed com uma Tarefa de Reunião ligada (ou não) ao Negócio dado. */
function espaco(opcoes: { negocioId?: string | null; atividades?: ActivityRecord[] } = {}) {
  const dados = buildSeed();
  const tarefa = dados.tasks[0]!;
  const negocioId = opcoes.negocioId === undefined ? NEGOCIO_ID : opcoes.negocioId;
  dados.links = dados.links.filter((l) => l.fromId !== tarefa.id && l.toId !== tarefa.id);
  if (negocioId !== null) {
    dados.links.push({
      id: "lnk_reuniao",
      fromType: "task",
      fromId: tarefa.id,
      toType: "deal",
      toId: negocioId,
      createdBy: { kind: "member", id: "mem_julia" },
      createdAt: INSTANTE,
    });
  }
  dados.activity.push(...(opcoes.atividades ?? []));
  return { dados, tarefaId: tarefa.id };
}

async function montar(estado: ReturnType<typeof espaco>) {
  const transporte: Transporte = { gravar, hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })) };
  const params = Promise.resolve({ reuniao: estado.tarefaId });
  let resultado!: ReturnType<typeof render>;
  await act(async () => {
    resultado = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <StoreProvider sessao={{ memberId: "mem_julia" }} estadoInicial={{ data: estado.dados, revisao: 1, ordens: {} }} transporte={transporte}>
          <Suspense fallback="carregando">
            <ReuniaoPage params={params} />
          </Suspense>
        </StoreProvider>
      </SWRConfig>,
    );
  });
  return resultado.container;
}

describe("Reunião — o lead vem do CRM novo (3.4.5, UCR-06)", () => {
  it("mostra o Negócio, a Etapa e o Funil, o Contato e a Empresa lidos pela api, nada do state.deals", async () => {
    const estado = espaco();
    const container = await montar(estado);

    await waitFor(() => expect(container.textContent).toContain("Contrato Acme 2026"));
    const texto = container.textContent ?? "";
    expect(texto).toContain("Etapa Proposta Nova");
    expect(texto).toContain("Funil Comercial Novo");
    expect(texto).toContain("Beatriz Lima");
    expect(texto).toContain("Acme Indústria");
    expect(texto).toContain("Diretora de Compras");
    const pedidos = fetchMock.mock.calls.map(([url]) => String(url));
    expect(pedidos).toContain(`http://api/negocios/${NEGOCIO_ID}`);
    expect(pedidos).toContain(`http://api/contatos/${CONTATO_ID}`);
    expect(pedidos).toContain(`http://api/empresas/${EMPRESA_ID}`);
  });

  it("a nota da call vai para POST /contatos/:id/notas e nenhuma operação sai para /operacoes", async () => {
    rotas[`POST /contatos/${CONTATO_ID}/notas`] = () =>
      resposta(201, { ok: true, dados: { id: "n1", contatoId: CONTATO_ID, autorId: "mem_julia", conteudo: "Quer fechar em novembro.", criadoEm: INSTANTE } });
    const estado = espaco();
    const container = await montar(estado);
    await waitFor(() => expect(container.textContent).toContain("Beatriz Lima"));

    fireEvent.change(screen.getByLabelText("Anotação da call"), { target: { value: "Quer fechar em novembro." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Registrar anotação" }));
    });

    await waitFor(() => {
      const envio = fetchMock.mock.calls.find(([url, init]) => String(url) === `http://api/contatos/${CONTATO_ID}/notas` && (init as RequestInit | undefined)?.method === "POST");
      expect(envio).toBeDefined();
      expect(JSON.parse(String((envio![1] as RequestInit).body))).toEqual({ conteudo: "Quer fechar em novembro." });
    });
    expect(gravar).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/operacoes"))).toBe(false);
    await waitFor(() => expect((screen.getByLabelText("Anotação da call") as HTMLTextAreaElement).value).toBe(""));
  });

  it("a recusa da api aparece na tela e o texto digitado fica", async () => {
    rotas[`POST /contatos/${CONTATO_ID}/notas`] = () => resposta(403, { ok: false, error: "Seu Papel não permite escrever notas.", codigo: "SEM_PERMISSAO" });
    const estado = espaco();
    const container = await montar(estado);
    await waitFor(() => expect(container.textContent).toContain("Beatriz Lima"));

    fireEvent.change(screen.getByLabelText("Anotação da call"), { target: { value: "Texto que não pode sumir." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Registrar anotação" }));
    });

    await waitFor(() => expect(container.textContent).toContain("Seu Papel não permite escrever notas."));
    expect((screen.getByLabelText("Anotação da call") as HTMLTextAreaElement).value).toBe("Texto que não pode sumir.");
  });
});
