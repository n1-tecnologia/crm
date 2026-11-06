// @vitest-environment jsdom
/**
 * 14-16 Task 2 — os três gestos da ficha da Tarefa conversacional chamam as rotas
 * REST (trocar o Canal, ligar o Negócio, criar o Negócio) e re-hidratam o store
 * depois (A5). Nada de `run()` com as operações antigas. A api é falsa: as
 * funções de `dados/crm/tarefas-conversacionais` e os hooks de Canais, Negócios,
 * Funis e Contato são mocks. A Tarefa é a do seed (`tsk_lst_funil_sdr_deal_sdr_2`);
 * o resumo mockado traz ids novos, e a Lista dela atende pelos Canais novos.
 * Molde de `tarefa-completa-resumo.test.tsx`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Canal } from "@n1/dominio/crm/canais";
import type { ResumoDaTarefaConversacional } from "@n1/dominio/crm/resumo-da-tarefa";
import type { DataState } from "@n1/dominio/state";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { TarefaCompleta } from "@/features/estrutura/tarefa-completa";

const { resumo, conversa, trocar, vincular, criarNegocio, rehidratar } = vi.hoisted(() => ({
  resumo: { atual: undefined as unknown },
  /** `undefined` = verificando, `null` = sem Conversa aberta, `{ id }` = há uma. */
  conversa: { atual: { id: "cv_1" } as { id: string } | null | undefined },
  trocar: vi.fn(),
  vincular: vi.fn(),
  criarNegocio: vi.fn(),
  rehidratar: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/estrutura/tarefas/x",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/dados/store", async (original) => ({
  ...(await original<typeof import("@/dados/store")>()),
  useRehidratar: () => rehidratar,
}));

vi.mock("@/dados/crm/tarefas-conversacionais", () => ({
  useResumoDaTarefa: () => resumo.atual,
  useConversaAbertaDoPar: () => ({ conversa: conversa.atual }),
  trocarCanalDaTarefa: trocar,
  vincularNegocioATarefa: vincular,
  criarNegocioDaTarefa: criarNegocio,
}));

const canal = (id: string, nome: string, tipo: Canal["tipo"], conexao: Canal["conexao"] = "conectada"): Canal =>
  ({ id, nome, tipo, provedor: "whatsapp-nao-oficial", conexao, estado: "ativo" }) as unknown as Canal;

vi.mock("@/dados/crm/contatos", () => ({
  useContato: () => ({
    data: {
      contato: { id: "ct_novo_77", nome: "Helena", sobrenome: "Prado", estado: "ativo" },
      identificadores: [
        { id: "i1", tipo: "whatsapp", valor: "5511999990000" },
        { id: "i2", tipo: "email", valor: "helena@exemplo.com" },
      ],
      vinculos: [],
    },
  }),
}));
vi.mock("@/dados/crm/canais", () => ({
  useCanais: () => ({
    data: {
      ok: true,
      total: 2,
      itens: [canal("ck_novo_1", "Atendimento do Resumo", "whatsapp"), canal("ck_novo_2", "E-mail do Suporte", "email")],
    },
  }),
}));
vi.mock("@/dados/crm/negocios", () => ({
  useNegocios: () => ({
    data: {
      ok: true,
      total: 2,
      itens: [
        { id: "ng_novo_5", titulo: "Proposta do Resumo" },
        { id: "ng_novo_9", titulo: "Outro negócio aberto" },
      ],
    },
  }),
}));
vi.mock("@/dados/crm/funis", () => ({
  useFunis: () => ({ data: { ok: true, total: 1, itens: [{ funil: { id: "fn_novo_1", nome: "Funil de Vendas Novo" }, totalEtapas: 3, negociosAbertos: 0 }] } }),
}));

const TAREFA = "tsk_lst_funil_sdr_deal_sdr_2";

const RESUMO: ResumoDaTarefaConversacional = {
  taskId: TAREFA,
  contato: { id: "ct_novo_77", nome: "Helena Prado do Resumo" },
  canal: { id: "ck_novo_1", nome: "Atendimento do Resumo", tipo: "whatsapp", provedor: "whatsapp-nao-oficial", conexao: "conectada" },
  ultimaMensagem: null,
  negocio: { id: "ng_novo_5", titulo: "Proposta do Resumo", etapa: "Etapa do Resumo" },
  empresa: null,
  qualificacaoId: null,
  conversa: null,
};

let state: DataState;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  state = buildSeed();
  const lista = state.lists.find((l) => l.id === state.tasks.find((t) => t.id === TAREFA)?.listId);
  if (!lista) throw new Error("a Lista da Tarefa do seed não existe");
  lista.canaisDeAtendimento = ["ck_novo_1", "ck_novo_2"];
  resumo.atual = RESUMO;
  conversa.atual = { id: "cv_1" };
  trocar.mockReset();
  vincular.mockReset();
  criarNegocio.mockReset();
  rehidratar.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar(): void {
  const transporte: Transporte = {
    gravar: vi.fn(),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  render(
    <StoreProvider sessao={{ memberId: state.workspace.ownerMemberId }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
      <TarefaCompleta taskId={TAREFA} modo="popup" />
    </StoreProvider>,
  );
}

/** Abre o seletor do Canal: a linha de propriedade pelo valor que mostra, e depois o combobox do editor. */
function abrirOSeletorDoCanal(): void {
  fireEvent.click(screen.getByText("Atendimento do Resumo").closest("button") as HTMLElement);
  fireEvent.click(document.getElementById("canal-da-tarefa") as HTMLElement);
}

/** Abre o seletor do Negócio: o "Trocar" da linha e depois o combobox do editor. */
function abrirOSeletorDoNegocio(): void {
  fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
  fireEvent.click(document.getElementById("negocio-da-tarefa") as HTMLElement);
}

function escolher(opcao: string): void {
  fireEvent.click(screen.getByRole("option", { name: new RegExp(opcao) }));
}

describe("trocar o Canal", () => {
  it("(a) com Conversa aberta no Canal novo: confirma no diálogo sem pedir Mensagem, chama a rota e re-hidrata", async () => {
    trocar.mockResolvedValue({ task: {}, mudou: true, conversa: { id: "cv_2", aberta: false } });
    montar();
    abrirOSeletorDoCanal();
    escolher("E-mail do Suporte");
    expect(screen.getByText("Trocar o Canal da Tarefa")).toBeTruthy();
    expect(screen.queryByLabelText(/Primeira Mensagem/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Trocar o Canal" }));
    await waitFor(() => expect(trocar).toHaveBeenCalledWith(TAREFA, { canalId: "ck_novo_2" }));
    await waitFor(() => expect(rehidratar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Canal alterado.")).toBeTruthy());
    expect(screen.queryByText("Trocar o Canal da Tarefa")).toBeNull();
  });

  it("(b) sem Conversa aberta no Canal novo: pede a primeira Mensagem, que é obrigatória, e a manda", async () => {
    conversa.atual = null;
    trocar.mockResolvedValue({ task: {}, mudou: true, conversa: { id: "cv_3", aberta: true } });
    montar();
    abrirOSeletorDoCanal();
    escolher("E-mail do Suporte");
    fireEvent.click(screen.getByRole("button", { name: "Trocar o Canal" }));
    expect(trocar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Primeira Mensagem/), { target: { value: "  Olá, Helena  " } });
    fireEvent.click(screen.getByRole("button", { name: "Trocar o Canal" }));
    await waitFor(() => expect(trocar).toHaveBeenCalledWith(TAREFA, { canalId: "ck_novo_2", mensagem: { conteudo: "Olá, Helena" } }));
  });

  it("(c) a recusa da api fica no diálogo: nada é re-hidratado e o diálogo segue aberto", async () => {
    trocar.mockRejectedValue(new ErroDeApi(409, "O Canal E-mail do Suporte está desconectado.", { codigo: "RECUSA_DO_DOMINIO", campo: "canal" }));
    montar();
    abrirOSeletorDoCanal();
    escolher("E-mail do Suporte");
    fireEvent.click(screen.getByRole("button", { name: "Trocar o Canal" }));
    await waitFor(() => expect(screen.getByText("O Canal E-mail do Suporte está desconectado.")).toBeTruthy());
    expect(rehidratar).not.toHaveBeenCalled();
    expect(screen.getByText("Trocar o Canal da Tarefa")).toBeTruthy();
  });
});

describe("ligar o Negócio", () => {
  it("(d) escolher outro Negócio chama a rota com o id e re-hidrata; o aviso aparece na ficha", async () => {
    vincular.mockResolvedValue({});
    montar();
    abrirOSeletorDoNegocio();
    escolher("Outro negócio aberto");
    await waitFor(() => expect(vincular).toHaveBeenCalledWith(TAREFA, "ng_novo_9"));
    await waitFor(() => expect(rehidratar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Negócio vinculado.")).toBeTruthy());
  });

  it("(e) escolher \"Sem Negócio\" desliga com null", async () => {
    vincular.mockResolvedValue({});
    montar();
    abrirOSeletorDoNegocio();
    escolher("Sem Negócio");
    await waitFor(() => expect(vincular).toHaveBeenCalledWith(TAREFA, null));
    await waitFor(() => expect(screen.getByText("Negócio desvinculado.")).toBeTruthy());
  });

  it("(f) a recusa da api (Negócio de outro Contato) aparece no aviso de erro da ficha, sem re-hidratar", async () => {
    vincular.mockRejectedValue(new ErroDeApi(409, "Este Negócio não é deste Contato.", { codigo: "NEGOCIO_DE_OUTRO_CONTATO", campo: "negocioId" }));
    montar();
    abrirOSeletorDoNegocio();
    escolher("Outro negócio aberto");
    await waitFor(() => expect(screen.getByText("Este Negócio não é deste Contato.")).toBeTruthy());
    expect(rehidratar).not.toHaveBeenCalled();
  });
});

describe("criar o Negócio", () => {
  const semNegocio: ResumoDaTarefaConversacional = { ...RESUMO, negocio: null };

  function abrirOMenuECriar(): void {
    fireEvent.click(screen.getAllByRole("button", { name: "Ações" })[0] as HTMLElement);
    fireEvent.click(screen.getByRole("menuitem", { name: "Criar Negócio a partir desta Tarefa" }));
  }

  it("(g) com Negócio já ligado o item do menu fica desligado, com o motivo", () => {
    montar();
    fireEvent.click(screen.getAllByRole("button", { name: "Ações" })[0] as HTMLElement);
    expect(screen.getByRole("menuitem", { name: "Criar Negócio a partir desta Tarefa" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("(h) escolhe o Funil das tabelas, manda só funilId, título e valor em texto, e re-hidrata", async () => {
    resumo.atual = semNegocio;
    criarNegocio.mockResolvedValue({ task: {}, negocio: { id: "ng_novo_77", titulo: "Proposta da Helena" } });
    montar();
    abrirOMenuECriar();
    expect(screen.getByText(/O Negócio nasce com Helena Prado do Resumo/)).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: /Funil/ }));
    escolher("Funil de Vendas Novo");
    fireEvent.change(screen.getByLabelText(/Valor em reais/), { target: { value: "1500.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Negócio" }));
    await waitFor(() => expect(criarNegocio).toHaveBeenCalledTimes(1));
    const [taskId, corpo] = criarNegocio.mock.calls[0] as [string, Record<string, unknown>];
    expect(taskId).toBe(TAREFA);
    expect(corpo).toMatchObject({ funilId: "fn_novo_1", valor: "1500.50" });
    expect(Object.keys(corpo).sort()).toEqual(["funilId", "titulo", "valor"]);
    await waitFor(() => expect(rehidratar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Negócio criado: Proposta da Helena.")).toBeTruthy());
  });

  it("(i) a recusa da api fica no diálogo e nada é re-hidratado", async () => {
    resumo.atual = semNegocio;
    criarNegocio.mockRejectedValue(new ErroDeApi(409, "Esta Tarefa já tem Negócio vinculado.", { codigo: "RECUSA_DO_DOMINIO" }));
    montar();
    abrirOMenuECriar();
    fireEvent.click(screen.getByRole("combobox", { name: /Funil/ }));
    escolher("Funil de Vendas Novo");
    fireEvent.click(screen.getByRole("button", { name: "Criar Negócio" }));
    await waitFor(() => expect(screen.getByText("Esta Tarefa já tem Negócio vinculado.")).toBeTruthy());
    expect(rehidratar).not.toHaveBeenCalled();
  });
});
