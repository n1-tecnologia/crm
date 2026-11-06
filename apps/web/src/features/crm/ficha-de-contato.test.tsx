// @vitest-environment jsdom
/**
 * 07-06 Task 3 — a ficha nova de Contato lê o `ContatoDetalhado` da api,
 * edita por `PATCH`, mostra a recusa D-09 com os links de `bloqueios` e deixa
 * o Contato `ativo` na tela, esconde a edição quando ele está na lixeira, e não
 * mostra nada do que a 007 não guarda (D-02). Nenhuma rede: `fetch` roteado por
 * URL, sessão falsa, `StoreProvider` de verdade com o seed.
 */

import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig, useSWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { podeNoCrm } from "@n1/dominio/crm/permissoes";
import type { ConsentimentoDoContato } from "@n1/dominio/crm/consentimentos";
import type { ContatoDetalhado, ContatoResumo } from "@n1/dominio/crm/contatos";
import type { NotaDoContato } from "@n1/dominio/crm/notas";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { invalidarCrm } from "@/dados/crm/cliente-crm";
import { useContato } from "@/dados/crm/contatos";
import { FichaDeContato } from "./ficha-de-contato";

const { obterSessao, trocarRota, revalidador } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  trocarRota: vi.fn(),
  // O `mutate` do SWRConfig do teste: o global não alcança o cache isolado, este sim.
  revalidador: { revalidar: undefined as undefined | ((prefixo: string) => Promise<unknown>) },
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

// `invalidarCrm` é espiado: o `mutate` global do SWR não alcança o cache isolado do `SWRConfig` do teste.
// Aqui se prova que a gravação a invalida; quem a faz valer no cache do teste é `RegistrarRevalidacao`, que
// repassa o prefixo ao `mutate` do próprio `SWRConfig` (é assim que a nota nova, depois do POST, aparece na lista).
vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async (prefixo: string) => revalidador.revalidar?.(prefixo)) };
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
      { id: "i2", contatoId: "c1", tipo: "email", valor: "ana2@x.com", valorExibido: null, rotuloCanal: null, verificado: true, principal: false, criadoEm: "2026-10-01T10:00:01.000Z" },
      { id: "i3", contatoId: "c1", tipo: "telefone", valor: "+5511987654321", valorExibido: "(11) 98765-4321", rotuloCanal: null, verificado: false, principal: true, criadoEm: "2026-10-01T10:00:02.000Z" },
    ],
    vinculos: [
      { id: "v1", empresaId: "e1", empresaNome: "Alfa", cargo: "Diretora", admin: true, inicio: "2025-01-10", fim: null },
      { id: "v2", empresaId: "e2", empresaNome: "Beta", cargo: null, admin: false, inicio: "2024-01-01", fim: "2024-12-31" },
    ],
  };
}

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(invalidarCrm).mockClear();
  trocarRota.mockClear();
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

/** A página de verdade: `useContato` lê a ficha e `FichaDeContato` a desenha, então uma gravação revalida. */
function Pagina() {
  const { data } = useContato("c1");
  return data ? <FichaDeContato contatoId="c1" detalhado={data} /> : null;
}

function RegistrarRevalidacao() {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    revalidador.revalidar = (prefixo) => mutate((chave) => typeof chave === "string" && chave.startsWith(prefixo));
    return () => {
      revalidador.revalidar = undefined;
    };
  }, [mutate]);
  return null;
}

function montar(memberId = "mem_julia") {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        <RegistrarRevalidacao />
        <Pagina />
      </StoreProvider>
    </SWRConfig>,
  );
}

interface Servidor {
  detalhado: ContatoDetalhado;
  notas: NotaDoContato[];
  consentimentos: ConsentimentoDoContato[];
  /** Resposta fixa do POST de notas (uma recusa); ausente: a nota é gravada. */
  postDeNotas?: Response;
  postDeConsentimentos?: Response;
  /** O que a busca do seletor (`GET /contatos?q=…`) devolve. */
  contatosDaBusca: ContatoResumo[];
  /** Resposta fixa de `POST /contatos/c1/mesclar` ou de `.../transferir` (uma recusa); ausente: o gesto vale. */
  postDeMesclagem?: Response;
  postDeTransferencia?: Response;
}

/** A api falsa do Contato `c1`: ficha, notas e consentimentos com estado, e Negócios vazios. O POST grava e o GET seguinte devolve. */
function servir(sobre: Partial<Servidor> = {}): Servidor {
  const servidor: Servidor = { detalhado: detalhado(), notas: [], consentimentos: [], contatosDaBusca: [], ...sobre };
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const caminho = url.replace("http://api", "");
    if (caminho === "/contatos/c1/notas") {
      if (init.method === "POST") {
        if (servidor.postDeNotas) return servidor.postDeNotas;
        const { conteudo } = JSON.parse(init.body as string) as { conteudo: string };
        const nota: NotaDoContato = { id: `n${servidor.notas.length + 1}`, contatoId: "c1", conteudo, autorId: "mem_julia", criadoEm: "2026-11-01T12:00:00.000Z" };
        servidor.notas = [nota, ...servidor.notas];
        return resposta(201, { ok: true, dados: nota });
      }
      return resposta(200, { ok: true, itens: servidor.notas, total: servidor.notas.length });
    }
    if (caminho === "/contatos/c1/consentimentos") {
      if (init.method === "POST") {
        if (servidor.postDeConsentimentos) return servidor.postDeConsentimentos;
        const entrada = JSON.parse(init.body as string) as Omit<ConsentimentoDoContato, "id" | "contatoId" | "em" | "evidenciaMensagemId" | "registradoPor" | "registradoEm">;
        const registro: ConsentimentoDoContato = {
          ...entrada,
          id: `k${servidor.consentimentos.length + 1}`,
          contatoId: "c1",
          em: "2026-11-01T12:00:00.000Z",
          evidenciaMensagemId: null,
          registradoPor: "mem_julia",
          registradoEm: "2026-11-01T12:00:00.000Z",
        };
        servidor.consentimentos = [registro, ...servidor.consentimentos];
        return resposta(201, { ok: true, dados: registro });
      }
      return resposta(200, { ok: true, itens: servidor.consentimentos, total: servidor.consentimentos.length });
    }
    if (caminho.startsWith("/negocios")) return resposta(200, { ok: true, itens: [], total: 0 });
    if (caminho.startsWith("/contatos?")) return resposta(200, { ok: true, itens: servidor.contatosDaBusca, total: servidor.contatosDaBusca.length });
    if (caminho === "/contatos/c1/mesclar" && init.method === "POST") {
      if (servidor.postDeMesclagem) return servidor.postDeMesclagem;
      // O sobrevivente recebe o Identificador do absorvido: a leitura seguinte já o traz.
      const absorvido = (JSON.parse(init.body as string) as { absorvidoId: string }).absorvidoId;
      servidor.detalhado = {
        ...servidor.detalhado,
        identificadores: [
          ...servidor.detalhado.identificadores,
          { id: "i9", contatoId: "c1", tipo: "email", valor: `${absorvido}@x.com`, valorExibido: null, rotuloCanal: null, verificado: false, principal: false, criadoEm: "2026-10-02T10:00:00.000Z" },
        ],
      };
      return resposta(200, { ok: true, dados: servidor.detalhado });
    }
    if (caminho.startsWith("/contatos/c1/identificadores/") && caminho.endsWith("/transferir") && init.method === "POST") {
      if (servidor.postDeTransferencia) return servidor.postDeTransferencia;
      const identificadorId = caminho.split("/")[4];
      servidor.detalhado = { ...servidor.detalhado, identificadores: servidor.detalhado.identificadores.filter((i) => i.id !== identificadorId) };
      return resposta(200, { ok: true, dados: servidor.detalhado });
    }
    return resposta(200, { ok: true, dados: servidor.detalhado });
  });
  return servidor;
}

function chamadas(): string[] {
  return (fetchMock.mock.calls as Array<[string, RequestInit]>).map(([url, init]) => `${init.method} ${url.replace("http://api", "")}`);
}

describe("FichaDeContato — leitura", () => {
  it("(a) mostra nome, Proprietário, Identificadores com rótulo e selo, e Empresas vinculadas", async () => {
    servir();
    const { container } = montar();

    await vi.waitFor(() => expect(container.textContent).toContain("ana@x.com"));
    expect(container.textContent).toContain("Ana Souza");
    expect(container.textContent).toContain("Proprietário: Júlia Prado");
    // "E-mail" também é coluna do quadro de Consentimentos: aqui só contam as linhas de Identificador.
    expect(screen.getAllByText("E-mail").filter((rotulo) => rotulo.closest("li") !== null).length).toBe(2);
    expect(screen.getByText("Telefone")).toBeTruthy();
    expect(screen.getByText("(11) 98765-4321")).toBeTruthy();
    expect(screen.getAllByText("principal").length).toBe(2);
    expect(screen.getByText("verificado")).toBeTruthy();

    const alfa = screen.getByRole("link", { name: "Alfa" });
    expect(alfa.getAttribute("href")).toBe("/crm/empresas/e1");
    expect(screen.getByText("Diretora")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    expect(container.textContent).toMatch(/desde .*2025/);
    expect(container.textContent).toMatch(/encerrado em .*2024/);
  });

  it("(e) não mostra Tags, Comentários, Anexos, Conversas nem Temperatura (Notas, Consentimentos e Mesclar agora existem)", async () => {
    servir();
    const { container } = montar();
    await screen.findByText("ana@x.com");
    for (const proibido of ["Tags", "Comentários", "Anexos", "Conversas", "Temperatura"]) {
      expect(container.textContent).not.toContain(proibido);
    }
  });
});

describe("FichaDeContato — Identificadores e ciclo de vida", () => {
  it("(b) Tornar principal manda PATCH com principal: true e invalida a ficha para revalidar", async () => {
    const depois = detalhado();
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (init.method === "PATCH") return resposta(200, { ok: true, dados: depois });
      return resposta(200, { ok: true, dados: detalhado() });
    });
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Tornar principal" }));

    await waitFor(() => expect(chamadas()).toContain("PATCH /contatos/c1/identificadores/i2"));
    const patch = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(([, init]) => init.method === "PATCH");
    expect(patch?.[1].body).toBe(JSON.stringify({ principal: true }));
    await waitFor(() => expect(invalidarCrm).toHaveBeenCalledWith("/contatos"));
  });

  it("(c) Excluir → confirmar → 409 CONTATO_BLOQUEADO mostra a frase e o link da Empresa, e o selo não vira na lixeira", async () => {
    const frase = "Este Contato não pode ir para a lixeira: é o único admin da Empresa Alfa. Antes, nomeie outro admin.";
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      if (init.method === "DELETE") {
        return resposta(409, {
          ok: false,
          error: frase,
          codigo: "CONTATO_BLOQUEADO",
          bloqueios: { empresas: [{ id: "e1", nome: "Alfa" }] },
        });
      }
      return resposta(200, { ok: true, dados: detalhado() });
    });
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar para a Lixeira" }));

    const aviso = await screen.findByText(frase);
    const caixa = aviso.closest('[role="alert"]') as HTMLElement;
    expect(within(caixa).getByRole("link", { name: "Alfa" }).getAttribute("href")).toBe("/crm/empresas/e1");
    expect(screen.queryByText("na lixeira")).toBeNull();
    expect(chamadas()).toContain("DELETE /contatos/c1");
  });

  it("(d) Contato na lixeira mostra Restaurar e Excluir permanentemente, e esconde Editar", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: detalhado({ estado: "na_lixeira" }) }));
    montar();

    await screen.findByText("ana@x.com");
    expect(screen.getByText("na lixeira")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir permanentemente" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tornar principal" })).toBeNull();
  });

  it("(f) um Convidado vê as ações desligadas com a frase do Papel", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: detalhado() }));
    montar("mem_beatriz");

    const excluir = await screen.findByRole("button", { name: "Excluir" });
    expect(excluir.getAttribute("aria-disabled")).toBe("true");
    expect(excluir.getAttribute("title")).toBe(podeNoCrm("convidado", "ativo", "enviar_para_lixeira", "contato"));
    fireEvent.click(excluir);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("FichaDeContato — edição e Identificadores novos", () => {
  it("(g) Editar abre o formulário sem os Identificadores e Salvar alterações manda PATCH com o Proprietário", async () => {
    fetchMock.mockImplementation(async () => resposta(200, { ok: true, dados: detalhado() }));
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.queryByLabelText("E-mail")).toBeNull();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana Maria" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(chamadas()).toContain("PATCH /contatos/c1"));
    const patch = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(([, init]) => init.method === "PATCH");
    const corpo = JSON.parse(patch?.[1].body as string) as { nome: string; proprietarioId: string };
    expect(corpo.nome).toBe("Ana Maria");
    expect(corpo.proprietarioId).toBe("mem_julia");
  });

  it("(h) Adicionar Identificador valida no domínio e só então manda POST /identificadores", async () => {
    fetchMock.mockImplementation(async () => resposta(200, { ok: true, dados: detalhado() }));
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Adicionar Identificador" }));
    fireEvent.change(screen.getByLabelText("Valor do Identificador"), { target: { value: "isto-nao-e-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(chamadas().some((c) => c.startsWith("POST"))).toBe(false);

    fireEvent.change(screen.getByLabelText("Valor do Identificador"), { target: { value: "ana3@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(chamadas()).toContain("POST /contatos/c1/identificadores"));
    const post = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(([, init]) => init.method === "POST");
    expect(post?.[1].body).toBe(JSON.stringify({ tipo: "email", valor: "ana3@x.com" }));
  });
});

const NOTA_ANTIGA: NotaDoContato = { id: "n1", contatoId: "c1", conteudo: "Pediu retorno na segunda.", autorId: "mem_beatriz", criadoEm: "2026-10-01T10:00:00.000Z" };
const NOTA_NOVA: NotaDoContato = { id: "n2", contatoId: "c1", conteudo: "Fechou o contrato.", autorId: "mem_julia", criadoEm: "2026-10-20T10:00:00.000Z" };

function registro(sobre: Partial<ConsentimentoDoContato>): ConsentimentoDoContato {
  return {
    id: "k1",
    contatoId: "c1",
    finalidadeId: "cat_fin_mkt",
    tipoDeCanal: "whatsapp",
    decisao: "concedido",
    em: "2026-10-01T10:00:00.000Z",
    origem: "verbal",
    evidenciaMensagemId: null,
    registradoPor: "mem_julia",
    registradoEm: "2026-10-01T10:00:00.000Z",
    ...sobre,
  };
}

/** Abre o `Select` do rótulo e escolhe a opção pelo texto exato. */
function escolher(rotulo: string, opcao: string) {
  fireEvent.click(screen.getByRole("combobox", { name: rotulo }));
  fireEvent.click(screen.getByRole("option", { name: opcao }));
}

describe("FichaDeContato — Notas (14-06, 3.2.7)", () => {
  it("(l) mostra as notas da api, a mais recente primeiro, com o autor pelo nome do Membro e a data", async () => {
    servir({ notas: [NOTA_ANTIGA, NOTA_NOVA] });
    const { container } = montar();

    await screen.findByText("Fechou o contrato.");
    const texto = container.textContent ?? "";
    expect(texto.indexOf("Fechou o contrato.")).toBeLessThan(texto.indexOf("Pediu retorno na segunda."));
    expect(texto).toContain("Júlia Prado · ");
    expect(texto).toContain("Beatriz Sales · ");
    expect(texto).toMatch(/2026/);
  });

  it("(m) escrever e salvar manda POST /contatos/c1/notas e a nota aparece na lista", async () => {
    servir({ notas: [NOTA_ANTIGA] });
    montar();
    await screen.findByText("Pediu retorno na segunda.");

    fireEvent.change(screen.getByLabelText("Nova nota"), { target: { value: "  Ligar amanhã.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));

    await waitFor(() => expect(chamadas()).toContain("POST /contatos/c1/notas"));
    const post = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(([url, init]) => init.method === "POST" && url.endsWith("/notas"));
    expect(post?.[1].body).toBe(JSON.stringify({ conteudo: "Ligar amanhã." }));
    expect(await screen.findByText("Ligar amanhã.")).toBeTruthy();
    expect(screen.getByText("Nota salva.")).toBeTruthy();
    expect((screen.getByLabelText("Nova nota") as HTMLTextAreaElement).value).toBe("");
    await waitFor(() => expect(invalidarCrm).toHaveBeenCalledWith("/contatos/c1/notas"));
  });

  it("(n) nota vazia: o botão fica desligado com o motivo e nada é enviado", async () => {
    servir();
    montar();

    const salvar = await screen.findByRole("button", { name: "Salvar nota" });
    expect(salvar.getAttribute("aria-disabled")).toBe("true");
    expect(salvar.getAttribute("title")).toBe("Escreva a nota antes de salvar.");
    fireEvent.change(screen.getByLabelText("Nova nota"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    expect(chamadas().some((c) => c.startsWith("POST"))).toBe(false);
  });

  it("(n) um 400 da api marca o campo com a frase dela, sem aviso de sucesso", async () => {
    const frase = "A nota vai até 5000 caracteres.";
    servir({ postDeNotas: resposta(400, { ok: false, error: frase, codigo: "VALOR_INVALIDO", campo: "conteudo" }) });
    montar();
    await screen.findByRole("button", { name: "Salvar nota" });

    fireEvent.change(screen.getByLabelText("Nova nota"), { target: { value: "texto" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));

    expect(await screen.findByText(frase)).toBeTruthy();
    expect(screen.queryByText("Nota salva.")).toBeNull();
    expect((screen.getByLabelText("Nova nota") as HTMLTextAreaElement).value).toBe("texto");
  });

  it("(o) um 409 da api aparece por MensagemDeRecusa, com a frase literal", async () => {
    const frase = "Um Contato mesclado é somente leitura. Escreva a nota no Contato que ficou.";
    servir({ postDeNotas: resposta(409, { ok: false, error: frase, codigo: "NOTA_RECUSADA" }) });
    montar();
    await screen.findByRole("button", { name: "Salvar nota" });

    fireEvent.change(screen.getByLabelText("Nova nota"), { target: { value: "texto" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));

    const aviso = await screen.findByText(frase);
    expect(aviso.closest('[role="alert"]')).toBeTruthy();
  });

  it("(p) um Convidado lê as notas, mas o botão fica desligado com a frase do Papel", async () => {
    servir({ notas: [NOTA_NOVA] });
    montar("mem_beatriz");

    await screen.findByText("Fechou o contrato.");
    const salvar = screen.getByRole("button", { name: "Salvar nota" });
    expect(salvar.getAttribute("aria-disabled")).toBe("true");
    expect(salvar.getAttribute("title")).toBe(podeNoCrm("convidado", "ativo", "editar", "contato"));
  });

  it("(p) Contato na lixeira: escrever nota fica desligado com a frase do domínio", async () => {
    servir({ detalhado: detalhado({ estado: "na_lixeira" }) });
    montar();

    const salvar = await screen.findByRole("button", { name: "Salvar nota" });
    expect(salvar.getAttribute("aria-disabled")).toBe("true");
    expect(salvar.getAttribute("title")).toBe("Este Contato está na lixeira. Restaure-o antes de escrever a nota.");
  });
});

describe("FichaDeContato — Consentimentos (14-08, 3.2.4)", () => {
  it("(q) mostra o histórico (finalidade, tipo de Canal, decisão, origem) e o vigente calculado pelo domínio", async () => {
    servir({
      consentimentos: [
        registro({ id: "k2", decisao: "revogado", em: "2026-10-10T10:00:00.000Z", origem: "mensagem" }),
        registro({ id: "k1", decisao: "concedido", em: "2026-10-01T10:00:00.000Z", origem: "verbal" }),
        registro({ id: "k3", finalidadeId: "cat_fin_atend", tipoDeCanal: "todos", decisao: "concedido", origem: "formulario" }),
      ],
    });
    const { container } = montar();

    const historico = await screen.findByRole("list", { name: "Histórico de consentimento" });
    expect(within(historico).getAllByRole("listitem").length).toBe(3);
    expect(historico.textContent).toContain("Marketing");
    expect(historico.textContent).toContain("WhatsApp");
    expect(historico.textContent).toContain("Revogado");
    expect(historico.textContent).toContain("Formulário");

    // Marketing no WhatsApp: o mais recente é o revogado. No e-mail nunca houve decisão. Atendimento vale para todos.
    expect(container.querySelector('[data-vigente="cat_fin_mkt:whatsapp"]')?.textContent).toBe("Revogado");
    expect(container.querySelector('[data-vigente="cat_fin_mkt:email"]')?.textContent).toBe("Sem registro");
    expect(container.querySelector('[data-vigente="cat_fin_atend:instagram"]')?.textContent).toBe("Concedido");
  });

  it("(r) Registrar consentimento abre o formulário e manda POST com finalidade, tipo de Canal, decisão e origem", async () => {
    const servidor = servir();
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Registrar consentimento" }));

    const registrar = screen.getByRole("button", { name: "Registrar" });
    expect(registrar.getAttribute("aria-disabled")).toBe("true");
    expect(registrar.getAttribute("title")).toBe("Escolha a finalidade.");

    escolher("Finalidade", "Marketing");
    escolher("Tipo de Canal", "E-mail");
    escolher("Decisão", "Concedido");
    escolher("Origem", "Verbal");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(chamadas()).toContain("POST /contatos/c1/consentimentos"));
    const post = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(([url, init]) => init.method === "POST" && url.endsWith("/consentimentos"));
    expect(JSON.parse(post?.[1].body as string)).toEqual({ finalidadeId: "cat_fin_mkt", tipoDeCanal: "email", decisao: "concedido", origem: "verbal" });
    expect(await screen.findByText("Consentimento registrado.")).toBeTruthy();
    expect(servidor.consentimentos.length).toBe(1);
    await waitFor(() => expect(screen.getByRole("list", { name: "Histórico de consentimento" })).toBeTruthy());
    await waitFor(() => expect(invalidarCrm).toHaveBeenCalledWith("/contatos/c1/consentimentos"));
  });

  it("(s) um 409 ao registrar aparece por MensagemDeRecusa e o formulário continua aberto", async () => {
    const frase = "Este Contato está na lixeira. Restaure-o antes de registrar o consentimento.";
    servir({ postDeConsentimentos: resposta(409, { ok: false, error: frase, codigo: "CONSENTIMENTO_RECUSADO" }) });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Registrar consentimento" }));
    escolher("Finalidade", "Marketing");
    escolher("Tipo de Canal", "WhatsApp");
    escolher("Decisão", "Revogado");
    escolher("Origem", "Verbal");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    const aviso = await screen.findByText(frase);
    expect(aviso.closest('[role="alert"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeTruthy();
  });

  it("(t) um Convidado lê o histórico, mas Registrar consentimento fica desligado com a frase do Papel", async () => {
    servir({ consentimentos: [registro({})] });
    montar("mem_beatriz");

    await screen.findByRole("list", { name: "Histórico de consentimento" });
    const botao = screen.getByRole("button", { name: "Registrar consentimento" });
    expect(botao.getAttribute("aria-disabled")).toBe("true");
    expect(botao.getAttribute("title")).toBe(podeNoCrm("convidado", "ativo", "editar", "contato"));
    fireEvent.click(botao);
    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
  });
});

function resumo(id: string, nome: string, sobre: Partial<ContatoResumo> = {}): ContatoResumo {
  return { id, nomeDeExibicao: nome, estado: "ativo", proprietarioId: "mem_julia", emailPrincipal: `${id}@y.com`, telefonePrincipal: null, atualizadoEm: "2026-10-01T10:00:00.000Z", ...sobre };
}

const BUSCA = [resumo("c1", "Ana Souza"), resumo("c9", "Bruno Dias")];

/** Digita no seletor do diálogo e escolhe o resultado pelo nome (a busca espera 300 ms). */
async function buscarEscolher(dialogo: HTMLElement, rotulo: string, digitado: string, nome: string) {
  fireEvent.change(within(dialogo).getByLabelText(rotulo), { target: { value: digitado } });
  const lista = await within(dialogo).findByRole("listbox", undefined, { timeout: 2000 });
  fireEvent.click(await within(lista).findByText(nome, undefined, { timeout: 2000 }));
}

/** D-15-10: a mesclagem é irreversível, então o botão só liga com o nome do absorvido digitado. */
function digitarONomeDoAbsorvido(dialogo: HTMLElement, nome: string) {
  fireEvent.change(within(dialogo).getByLabelText("Digite o nome do Contato que será absorvido"), { target: { value: nome } });
}

describe("FichaDeContato — Mesclar com… (14-09, 3.2.2)", () => {
  it("(u) o diálogo não oferece o próprio Contato; confirmar chama POST /contatos/c1/mesclar com o absorvido e a ficha mostra o resultado", async () => {
    servir({ contatosDaBusca: BUSCA });
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Mesclar com…" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/Não dá para desfazer/)).toBeTruthy();
    const confirmar = within(dialogo).getByRole("button", { name: "Mesclar" });
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");
    expect(confirmar.getAttribute("title")).toBe("Escolha o Contato a mesclar.");

    fireEvent.change(within(dialogo).getByLabelText("Mesclar com"), { target: { value: "a" } });
    const lista = await within(dialogo).findByRole("listbox", undefined, { timeout: 2000 });
    expect(await within(lista).findByText("Bruno Dias", undefined, { timeout: 2000 })).toBeTruthy();
    expect(within(lista).queryByText("Ana Souza")).toBeNull();
    fireEvent.click(within(lista).getByText("Bruno Dias"));
    digitarONomeDoAbsorvido(dialogo, "Bruno Dias");

    fireEvent.click(within(dialogo).getByRole("button", { name: "Mesclar" }));

    await waitFor(() => expect(chamadas()).toContain("POST /contatos/c1/mesclar"));
    const post = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(([url]) => url.endsWith("/mesclar"));
    expect(post?.[1].body).toBe(JSON.stringify({ absorvidoId: "c9" }));
    expect(await screen.findByText("Contatos mesclados. Tudo de Bruno Dias agora está em Ana Souza.")).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    // A ficha mostra o sobrevivente já com o que o absorvido trouxe.
    expect(await screen.findByText("c9@x.com")).toBeTruthy();
    await waitFor(() => expect(invalidarCrm).toHaveBeenCalledWith("/contatos"));
  });

  it("(v) um 409 da api aparece no diálogo com a frase, e o diálogo continua aberto", async () => {
    const frase = "Só é possível mesclar Contatos ativos ou arquivados.";
    servir({ contatosDaBusca: BUSCA, postDeMesclagem: resposta(409, { ok: false, error: frase, codigo: "MESCLAGEM_RECUSADA", campo: "absorvidoId" }) });
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Mesclar com…" }));
    const dialogo = await screen.findByRole("alertdialog");
    await buscarEscolher(dialogo, "Mesclar com", "bru", "Bruno Dias");
    digitarONomeDoAbsorvido(dialogo, "Bruno Dias");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Mesclar" }));

    const aviso = await within(dialogo).findByText(frase);
    expect(aviso.getAttribute("role")).toBe("alert");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.queryByText(/Contatos mesclados\./)).toBeNull();
  });

  it("(w) D-15-10: o botão só liga com o nome do absorvido digitado (sem diferença de maiúsculas e de espaços nas pontas)", async () => {
    servir({ contatosDaBusca: BUSCA });
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Mesclar com…" }));
    const dialogo = await screen.findByRole("alertdialog");
    await buscarEscolher(dialogo, "Mesclar com", "bru", "Bruno Dias");
    const confirmar = within(dialogo).getByRole("button", { name: "Mesclar" });

    // Escolheu o Contato, mas ainda não digitou o nome: o botão diz o que falta e o clique não chama a api.
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");
    expect(confirmar.getAttribute("title")).toBe("Digite o nome do Contato para confirmar.");
    fireEvent.click(confirmar);
    expect(chamadas()).not.toContain("POST /contatos/c1/mesclar");

    // Nome errado ou incompleto continua desligado.
    digitarONomeDoAbsorvido(dialogo, "Bruno");
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");

    // O nome do sobrevivente (o da ficha) não serve: é o do absorvido que se confirma.
    digitarONomeDoAbsorvido(dialogo, "Ana Souza");
    expect(confirmar.getAttribute("aria-disabled")).toBe("true");

    // Caixa e espaços nas pontas não contam.
    digitarONomeDoAbsorvido(dialogo, "  bruno dias ");
    expect(confirmar.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("(x) um Convidado vê Mesclar com… desligado com a frase do Papel, e o diálogo não abre", async () => {
    servir();
    montar("mem_beatriz");

    const botao = await screen.findByRole("button", { name: "Mesclar com…" });
    expect(botao.getAttribute("aria-disabled")).toBe("true");
    expect(botao.getAttribute("title")).toBe(podeNoCrm("convidado", "ativo", "editar", "contato"));
    fireEvent.click(botao);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("(y) Contato na lixeira: Mesclar com… fica desligado com a frase do domínio", async () => {
    servir({ detalhado: detalhado({ estado: "na_lixeira" }) });
    montar();

    const botao = await screen.findByRole("button", { name: "Mesclar com…" });
    expect(botao.getAttribute("aria-disabled")).toBe("true");
    expect(botao.getAttribute("title")).toBe("Só é possível mesclar Contatos ativos ou arquivados.");
  });
});

describe("FichaDeContato — Transferir Identificador (14-06, 3.2.3)", () => {
  function linhaDoIdentificador(valor: string): HTMLElement {
    return screen.getByText(valor).closest("li") as HTMLElement;
  }

  it("(w) Transferir na linha abre o diálogo; escolher o destino chama o POST e a linha some da ficha", async () => {
    servir({ contatosDaBusca: BUSCA });
    montar();
    await screen.findByText("ana2@x.com");

    fireEvent.click(within(linhaDoIdentificador("ana2@x.com")).getByRole("button", { name: "Transferir" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/Só a resolução/)).toBeTruthy();
    const confirmar = within(dialogo).getByRole("button", { name: "Transferir" });
    expect(confirmar.getAttribute("title")).toBe("Escolha o Contato de destino.");

    await buscarEscolher(dialogo, "Contato de destino", "bru", "Bruno Dias");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Transferir" }));

    await waitFor(() => expect(chamadas()).toContain("POST /contatos/c1/identificadores/i2/transferir"));
    const post = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(([url]) => url.endsWith("/transferir"));
    expect(post?.[1].body).toBe(JSON.stringify({ paraContatoId: "c9" }));
    expect(await screen.findByText("Identificador ana2@x.com transferido para Bruno Dias.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("ana2@x.com")).toBeNull());
    expect(screen.getByText("ana@x.com")).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("(w) um 409 da api aparece no diálogo com a frase, e a linha continua na ficha", async () => {
    const frase = "Um Contato tem no máximo 20 Identificadores.";
    servir({ contatosDaBusca: BUSCA, postDeTransferencia: resposta(409, { ok: false, error: frase, codigo: "TRANSFERENCIA_RECUSADA", campo: "paraContatoId" }) });
    montar();
    await screen.findByText("ana2@x.com");

    fireEvent.click(within(linhaDoIdentificador("ana2@x.com")).getByRole("button", { name: "Transferir" }));
    const dialogo = await screen.findByRole("alertdialog");
    await buscarEscolher(dialogo, "Contato de destino", "bru", "Bruno Dias");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Transferir" }));

    expect((await within(dialogo).findByText(frase)).getAttribute("role")).toBe("alert");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getAllByText("ana2@x.com").length).toBeGreaterThan(0);
  });

  it("(x) um Convidado vê Transferir desligado com a frase do Papel", async () => {
    servir();
    montar("mem_beatriz");
    await screen.findByText("ana2@x.com");

    const botao = within(linhaDoIdentificador("ana2@x.com")).getByRole("button", { name: "Transferir" });
    expect(botao.getAttribute("aria-disabled")).toBe("true");
    expect(botao.getAttribute("title")).toBe(podeNoCrm("convidado", "ativo", "editar", "contato"));
    fireEvent.click(botao);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
