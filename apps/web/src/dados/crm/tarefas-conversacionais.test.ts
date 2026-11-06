// @vitest-environment jsdom
/**
 * 14-15 Task 1 — o resumo em lote da Tarefa conversacional (3.3.3, lado web):
 * uma Lista com 50 Tarefas faz UMA chamada a `POST /tarefas-conversacionais/resumo`
 * com os Vínculos montados por `vinculosDoCrmDaTarefa`; 250 Tarefas vão em dois
 * lotes (200 + 50); render repetido não refaz a chamada; a Subtarefa leva os
 * Vínculos da raiz; a recusa da api fica em `erro`. Nenhuma rede: `fetch` falso,
 * sessão falsa, estado falso (só `tasks` e `links`, o que a leitura por ids pede).
 */

import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { RESUMO_MAXIMO, type ResumoDaTarefaConversacional } from "@n1/dominio/crm/resumo-da-tarefa";
import { PAPEL_DO_VINCULO } from "@n1/dominio/derive-conversacional";
import type { DataState } from "@n1/dominio/state";
import type { Link, Task } from "@n1/dominio/types";

const { obterSessao, estado } = vi.hoisted(() => ({
  obterSessao: vi.fn(),
  estado: { atual: undefined as unknown },
}));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

// O hook lê o estado só por `useData`; o estado falso substitui o store inteiro.
vi.mock("@/dados/store", () => ({
  useData: <T>(seletor: (dados: DataState) => T): T => seletor(estado.atual as DataState),
}));

import { ErroDeApi } from "./cliente-crm";
import {
  ProvedorDoResumoDasTarefas,
  conversaAbertaDoPar,
  criarNegocioDaTarefa,
  criarTarefaConversacional,
  trocarCanalDaTarefa,
  useResumoDaTarefa,
  useResumoDasTarefas,
  vincularNegocioATarefa,
} from "./tarefas-conversacionais";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

function tarefa(id: string, extra: Partial<Task> = {}): Task {
  return { id, listId: "l1", ...extra } as unknown as Task;
}

function vinculo(taskId: string, toType: Link["toType"], toId: string, role: string): Link {
  return { id: `v_${taskId}_${toType}`, fromType: "task", fromId: taskId, toType, toId, role } as unknown as Link;
}

/** Cada Tarefa `t<n>` aponta para o Contato `c<n>` e a Conversa `v<n>`; as pares também para o Negócio `n<n>`. */
function montarEstado(quantas: number): { readonly tarefas: Task[] } {
  const tarefas = Array.from({ length: quantas }, (_, i) => tarefa(`t${i}`));
  const links: Link[] = [];
  tarefas.forEach((t, i) => {
    links.push(vinculo(t.id, "contact", `c${i}`, PAPEL_DO_VINCULO.contato));
    links.push(vinculo(t.id, "conversation", `v${i}`, PAPEL_DO_VINCULO.conversa));
    if (i % 2 === 0) links.push(vinculo(t.id, "deal", `n${i}`, PAPEL_DO_VINCULO.negocio));
  });
  estado.atual = { tasks: tarefas, links } as unknown as DataState;
  return { tarefas };
}

function itemDoResumo(taskId: string): ResumoDaTarefaConversacional {
  return {
    taskId,
    contato: { id: `c_${taskId}`, nome: `Contato ${taskId}` },
    canal: null,
    ultimaMensagem: null,
    negocio: null,
    empresa: null,
    qualificacaoId: null,
    conversa: null,
  };
}

/** A api falsa: devolve um item por Vínculo recebido, na ordem pedida. */
function responderComOsItens(): void {
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
    const { vinculos } = JSON.parse(String(init.body)) as { vinculos: { taskId: string }[] };
    const itens = vinculos.map((v) => itemDoResumo(v.taskId));
    return resposta(200, { ok: true, itens, total: itens.length });
  });
}

function corpoDaChamada(indice: number): { vinculos: Record<string, string>[] } {
  const [, init] = fetchMock.mock.calls[indice] as [string, RequestInit];
  return JSON.parse(String(init.body)) as { vinculos: Record<string, string>[] };
}

const envoltorio = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false } }, children);

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

describe("useResumoDasTarefas — o lote", () => {
  it("(a) 50 Tarefas fazem uma chamada só, com 50 Vínculos montados pelos ids da Tarefa", async () => {
    const { tarefas } = montarEstado(50);
    responderComOsItens();
    const { result } = renderHook(() => useResumoDasTarefas(tarefas), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.porTarefa.size).toBe(50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api/tarefas-conversacionais/resumo");
    expect(init.method).toBe("POST");
    const { vinculos } = corpoDaChamada(0);
    expect(vinculos).toHaveLength(50);
    expect(vinculos[0]).toEqual({ taskId: "t0", contatoId: "c0", conversaId: "v0", negocioId: "n0" });
    expect(vinculos[1]).toEqual({ taskId: "t1", contatoId: "c1", conversaId: "v1" });
    expect(result.current.porTarefa.get("t7")?.contato?.nome).toBe("Contato t7");
    expect(result.current.erro).toBeUndefined();
  });

  it("(a) 250 Tarefas vão em duas chamadas, 200 e 50 (RESUMO_MAXIMO)", async () => {
    const { tarefas } = montarEstado(250);
    responderComOsItens();
    const { result } = renderHook(() => useResumoDasTarefas(tarefas), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.porTarefa.size).toBe(250));
    expect(RESUMO_MAXIMO).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(corpoDaChamada(0).vinculos).toHaveLength(200);
    expect(corpoDaChamada(1).vinculos).toHaveLength(50);
  });

  it("(b) re-renderizar com as mesmas Tarefas não refaz a chamada", async () => {
    const { tarefas } = montarEstado(5);
    responderComOsItens();
    const { result, rerender } = renderHook(() => useResumoDasTarefas([...tarefas]), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.porTarefa.size).toBe(5));
    rerender();
    rerender();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("(c) a Subtarefa usa os Vínculos da raiz", async () => {
    const { tarefas } = montarEstado(1);
    const filha = tarefa("filha", { parentTaskId: "t0", rootTaskId: "t0" });
    estado.atual = { tasks: [...tarefas, filha], links: (estado.atual as DataState).links } as unknown as DataState;
    responderComOsItens();
    const { result } = renderHook(() => useResumoDasTarefas([filha]), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.porTarefa.size).toBe(1));
    expect(corpoDaChamada(0).vinculos).toEqual([{ taskId: "filha", contatoId: "c0", conversaId: "v0", negocioId: "n0" }]);
  });

  it("(d) o erro da api fica em `erro` e `porTarefa` fica vazio", async () => {
    const { tarefas } = montarEstado(3);
    fetchMock.mockResolvedValue(resposta(409, { ok: false, error: "Resumo recusado.", codigo: "RESUMO_RECUSADO" }));
    const { result } = renderHook(() => useResumoDasTarefas(tarefas), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.erro).toBeInstanceOf(ErroDeApi));
    expect(result.current.erro?.status).toBe(409);
    expect(result.current.porTarefa.size).toBe(0);
    expect(result.current.carregando).toBe(false);
  });

  it("(e) Tarefa sem nenhum Vínculo do CRM não vai à api: o resumo dela é vazio e local", async () => {
    estado.atual = { tasks: [tarefa("solta")], links: [] } as unknown as DataState;
    const { result } = renderHook(() => useResumoDasTarefas([tarefa("solta")]), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.porTarefa.get("solta")).toEqual({ taskId: "solta", contato: null, canal: null, ultimaMensagem: null, negocio: null, empresa: null, qualificacaoId: null, conversa: null });
    expect(result.current.carregando).toBe(false);
  });
});

describe("ProvedorDoResumoDasTarefas e useResumoDaTarefa", () => {
  it("(f) dentro do provedor, cada Tarefa lê do lote: 50 cartões, uma chamada", async () => {
    const { tarefas } = montarEstado(50);
    responderComOsItens();
    const dentro = ({ children }: { children: ReactNode }) =>
      envoltorio({ children: createElement(ProvedorDoResumoDasTarefas, { tarefas }, children) });
    const { result } = renderHook(() => tarefas.map((t) => useResumoDaTarefa(t.id)), { wrapper: dentro });
    await waitFor(() => expect(result.current.every((r) => r !== undefined)).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current[3]?.taskId).toBe("t3");
  });

  it("(g) fora do provedor, faz a própria chamada para a Tarefa", async () => {
    montarEstado(3);
    responderComOsItens();
    const { result } = renderHook(() => useResumoDaTarefa("t2"), { wrapper: envoltorio });
    await waitFor(() => expect(result.current).toBeDefined());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(corpoDaChamada(0).vinculos).toEqual([{ taskId: "t2", contatoId: "c2", conversaId: "v2", negocioId: "n2" }]);
    expect(result.current?.contato?.nome).toBe("Contato t2");
  });

  it("(h) `pausado` não chama a api; Tarefa que não existe no estado também não", async () => {
    montarEstado(3);
    const pausado = renderHook(() => useResumoDaTarefa("t2", { pausado: true }), { wrapper: envoltorio });
    const inexistente = renderHook(() => useResumoDaTarefa("nao-existe"), { wrapper: envoltorio });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pausado.result.current).toBeUndefined();
    expect(inexistente.result.current).toBeUndefined();
  });

  it("(i) a Tarefa que mudou de Conversa (Vínculo novo) busca de novo: a chave leva os ids, não só o taskId", async () => {
    const { tarefas } = montarEstado(1);
    responderComOsItens();
    const { result, rerender } = renderHook(() => useResumoDasTarefas(tarefas), { wrapper: envoltorio });
    await waitFor(() => expect(result.current.porTarefa.size).toBe(1));
    estado.atual = {
      tasks: tarefas,
      links: [
        vinculo("t0", "contact", "c0", PAPEL_DO_VINCULO.contato),
        vinculo("t0", "conversation", "v_outra", PAPEL_DO_VINCULO.conversa),
      ],
    } as unknown as DataState;
    rerender();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(corpoDaChamada(1).vinculos).toEqual([{ taskId: "t0", contatoId: "c0", conversaId: "v_outra" }]);
  });
});

// 14-16 Task 1 — as mutações da Tarefa conversacional por HTTP (3.3.4 a 3.3.6, lado web).
// Cada função manda só ids e a primeira Mensagem; o resto o servidor lê.
describe("as mutações da Tarefa conversacional", () => {
  const tarefaDaApi = { id: "t9", title: "Maria" };

  function chamada(indice: number): { url: string; metodo: string | undefined; corpo: unknown } {
    const [url, init] = fetchMock.mock.calls[indice] as [string, RequestInit];
    return { url, metodo: init.method, corpo: init.body === undefined ? undefined : JSON.parse(String(init.body)) };
  }

  it("criarTarefaConversacional: POST /tarefas-conversacionais com os ids e a primeira Mensagem; devolve a Tarefa e a Conversa", async () => {
    fetchMock.mockResolvedValue(
      resposta(201, { ok: true, dados: { ok: true, value: { task: tarefaDaApi }, revisao: 4, conversa: { id: "cv1", aberta: true } } }),
    );
    const saida = await criarTarefaConversacional({
      listId: "l1",
      contatoId: "c1",
      canalId: "k1",
      mensagem: { conteudo: "Oi, Maria" },
      title: "Retorno",
      assignees: [{ kind: "member", id: "m1" }],
    });
    expect(chamada(0)).toEqual({
      url: "http://api/tarefas-conversacionais",
      metodo: "POST",
      corpo: {
        listId: "l1",
        contatoId: "c1",
        canalId: "k1",
        mensagem: { conteudo: "Oi, Maria" },
        title: "Retorno",
        assignees: [{ kind: "member", id: "m1" }],
      },
    });
    expect(saida.task).toEqual(tarefaDaApi);
    expect(saida.conversa).toEqual({ id: "cv1", aberta: true });
  });

  it("criarTarefaConversacional: o 400 da primeira Mensagem sobe como ErroDeApi com o campo", async () => {
    fetchMock.mockResolvedValue(resposta(400, { ok: false, error: "A primeira Mensagem é obrigatória.", codigo: "VALOR_INVALIDO", campo: "mensagem" }));
    const erro = await criarTarefaConversacional({ listId: "l1", contatoId: "c1", canalId: "k1" }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect((erro as ErroDeApi).campo).toBe("mensagem");
    expect((erro as ErroDeApi).status).toBe(400);
  });

  it("trocarCanalDaTarefa: POST /tarefas-conversacionais/:taskId/canal; devolve a Tarefa, mudou e a Conversa", async () => {
    fetchMock.mockResolvedValue(
      resposta(200, { ok: true, dados: { ok: true, value: { task: tarefaDaApi, mudou: true }, conversa: { id: "cv2", aberta: false } } }),
    );
    const saida = await trocarCanalDaTarefa("t 9", { canalId: "k2", mensagem: { conteudo: "Olá" } });
    expect(chamada(0)).toEqual({
      url: "http://api/tarefas-conversacionais/t%209/canal",
      metodo: "POST",
      corpo: { canalId: "k2", mensagem: { conteudo: "Olá" } },
    });
    expect(saida).toEqual({ task: tarefaDaApi, mudou: true, conversa: { id: "cv2", aberta: false } });
  });

  it("vincularNegocioATarefa: POST .../negocio com o id, e com null para desligar", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, dados: { ok: true, value: tarefaDaApi } }));
    expect(await vincularNegocioATarefa("t9", "n1")).toEqual(tarefaDaApi);
    expect(chamada(0)).toEqual({ url: "http://api/tarefas-conversacionais/t9/negocio", metodo: "POST", corpo: { negocioId: "n1" } });
    await vincularNegocioATarefa("t9", null);
    expect(chamada(1).corpo).toEqual({ negocioId: null });
  });

  it("criarNegocioDaTarefa: POST .../negocio/novo com o Funil; devolve a Tarefa e o Negócio que nasceu", async () => {
    fetchMock.mockResolvedValue(
      resposta(201, { ok: true, dados: { ok: true, value: tarefaDaApi, negocio: { id: "n7", titulo: "Proposta" } } }),
    );
    const saida = await criarNegocioDaTarefa("t9", { funilId: "f1", titulo: "Proposta", valor: "1500.00" });
    expect(chamada(0)).toEqual({
      url: "http://api/tarefas-conversacionais/t9/negocio/novo",
      metodo: "POST",
      corpo: { funilId: "f1", titulo: "Proposta", valor: "1500.00" },
    });
    expect(saida).toEqual({ task: tarefaDaApi, negocio: { id: "n7", titulo: "Proposta" } });
  });

  it("a recusa da api (409) sobe com a mensagem dela, sem reescrevê-la", async () => {
    fetchMock.mockResolvedValue(resposta(409, { ok: false, error: "Esta Tarefa já tem Negócio vinculado.", codigo: "RECUSA_DO_DOMINIO" }));
    const erro = await criarNegocioDaTarefa("t9", { funilId: "f1" }).catch((e: unknown) => e);
    expect((erro as ErroDeApi).message).toBe("Esta Tarefa já tem Negócio vinculado.");
    expect((erro as ErroDeApi).status).toBe(409);
  });
});

describe("conversaAbertaDoPar", () => {
  function consulta(indice: number): URLSearchParams {
    const [url] = fetchMock.mock.calls[indice] as [string];
    expect(url.startsWith("http://api/conversas?")).toBe(true);
    return new URLSearchParams(url.slice(url.indexOf("?") + 1));
  }

  /** A api falsa responde por `situacao`: só devolve a Conversa da situação que o teste montou. */
  function conversasPorSituacao(porSituacao: Record<string, { id: string }[]>): void {
    fetchMock.mockImplementation(async (url: string) => {
      const situacao = new URLSearchParams(url.slice(url.indexOf("?") + 1)).get("situacao") ?? "";
      const itens = porSituacao[situacao] ?? [];
      return resposta(200, { ok: true, itens, total: itens.length });
    });
  }

  it("pergunta pelas Conversas ativas do par, uma `aberta` e uma `pendente`", async () => {
    conversasPorSituacao({});
    await conversaAbertaDoPar("c1", "k1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const situacoes = [consulta(0), consulta(1)].map((q) => q.get("situacao")).sort();
    expect(situacoes).toEqual(["aberta", "pendente"]);
    for (const q of [consulta(0), consulta(1)]) {
      expect(q.get("contatoId")).toBe("c1");
      expect(q.get("canalId")).toBe("k1");
      expect(q.get("estado")).toBe("ativo");
    }
  });

  it("devolve a Conversa aberta, ou a pendente quando não há aberta", async () => {
    conversasPorSituacao({ aberta: [{ id: "cv_a" }], pendente: [{ id: "cv_p" }] });
    expect(await conversaAbertaDoPar("c1", "k1")).toEqual({ id: "cv_a" });
    conversasPorSituacao({ pendente: [{ id: "cv_p" }] });
    expect(await conversaAbertaDoPar("c1", "k1")).toEqual({ id: "cv_p" });
  });

  it("devolve null quando o par só tem Conversa resolvida (ou nenhuma)", async () => {
    conversasPorSituacao({ resolvida: [{ id: "cv_r" }] });
    expect(await conversaAbertaDoPar("c1", "k1")).toBeNull();
  });

  it("a falha da api sobe: quem pergunta decide o que mostrar", async () => {
    fetchMock.mockResolvedValue(resposta(500, { ok: false, error: "Falha." }));
    await expect(conversaAbertaDoPar("c1", "k1")).rejects.toBeInstanceOf(ErroDeApi);
  });
});
