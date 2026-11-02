/**
 * `run()` híbrido (D-05/D-06, Fase 12 D-13/D-14/D-16) contra um `Transporte`
 * falso — sem `fetch`, sem `apps/api` no ar. Prova: recusa do domínio é
 * síncrona e não grava; o sucesso aparece em `data` na hora e o
 * `confirmado` só muda quando o diff volta; recusa e falha do servidor tiram
 * a mudança e mostram o erro; os pedidos saem um de cada vez; revisão
 * defasada e conflito re-hidratam; ids da cópia batem com os de um segundo
 * processo (a UoW do `apps/api` sincroniza do mesmo jeito).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { addTaskComment, changeTaskStatus, CP, createChatSession, createForm, createList, createTask, resetIdSequence, sendChatMessage, syncIdSequence, updateContainer } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import type { Id, Task } from "@n1/dominio/types";
import { DIFERENCA_VAZIA, type Diferenca, type Ordens } from "@n1/dominio";
import type { PedidoDeGravacao, RespostaDeGravacao, Transporte } from "./transporte";
import { criarStore, deveAvisarAoSair } from "./store";

function achar(estado: DataState, id: Id): Task {
  const t = estado.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

/** `ordem = índice` — o mesmo que `GET /estado` devolveria para um Espaço recém-hidratado. */
function ordensDeTodasAsColecoes(estado: DataState): Ordens {
  const resultado: Ordens = {};
  for (const [colecao, valor] of Object.entries(estado)) {
    if (!Array.isArray(valor)) continue;
    const porId: Record<string, number> = {};
    valor.forEach((registro, indice) => {
      if (registro && typeof registro === "object" && "id" in registro) {
        porId[(registro as { readonly id: string }).id] = indice;
      }
    });
    resultado[colecao] = porId;
  }
  return resultado;
}

interface TransporteFalso extends Transporte {
  readonly gravarMock: ReturnType<typeof vi.fn<Transporte["gravar"]>>;
  readonly hidratarMock: ReturnType<typeof vi.fn<Transporte["hidratar"]>>;
}

function transporteFalso(): TransporteFalso {
  const gravarMock = vi.fn<Transporte["gravar"]>();
  const hidratarMock = vi.fn<Transporte["hidratar"]>();
  // Default hermético: um teste que não configura o mock explicitamente não
  // deixa uma promise nunca resolvida nem uma rejeição sem captura.
  gravarMock.mockResolvedValue({ tipo: "falha", erro: "não configurado neste teste." });
  hidratarMock.mockResolvedValue({ tipo: "falha", erro: "não configurado neste teste." });
  return { gravar: gravarMock, hidratar: hidratarMock, gravarMock, hidratarMock };
}

let state: DataState;
let ordens: Ordens;
let transporte: TransporteFalso;
let store: ReturnType<typeof criarStore>;

beforeEach(() => {
  state = buildSeed();
  ordens = ordensDeTodasAsColecoes(state);
  transporte = transporteFalso();
  store = criarStore({ sessao: { memberId: "mem_maryane" }, estadoInicial: { data: state, revisao: 7, ordens }, transporte });
});

describe("run() — recusa do domínio (D-05)", () => {
  it("(a) recusa é instantânea: sem POST, dado real inalterado", () => {
    const antes = structuredClone(store.getState().data);
    const konq = achar(state, "tsk_cp_konq"); // em autorização — pular direto para pago é recusado (RN-CP-04)

    const resultado = store.getState().run((d, m) => changeTaskStatus(d, m, konq.id, CP.status.pago));

    expect(resultado.ok).toBe(false);
    expect(transporte.gravarMock).not.toHaveBeenCalled();
    expect(store.getState().data).toStrictEqual(antes);
    expect(store.getState().lastResult?.ok).toBe(false);
  });
});

describe("run() — sucesso otimista (D-05)", () => {
  it("(b) roda síncrono; antes do POST resolver, a mudança já está em `data` e ainda não em `confirmado` (D-13)", () => {
    transporte.gravarMock.mockImplementationOnce(() => new Promise<RespostaDeGravacao>(() => {})); // nunca resolve neste teste
    const trafego = achar(state, "tsk_cp_trafego");

    const resultado = store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    expect(resultado.ok).toBe(true);
    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    const pedido = transporte.gravarMock.mock.calls[0]?.[0] as PedidoDeGravacao;
    expect(pedido.chamadas).toEqual([{ nome: "addTaskComment", args: [trafego.id, { content: "x" }] }]);
    expect(pedido.revisao).toBe(7);

    // D-13: a cópia aceita é o que a tela mostra; o que o servidor confirmou não mudou.
    expect(achar(store.getState().data, trafego.id).comments.some((c) => c.content === "x")).toBe(true);
    expect(achar(store.getState().confirmado, trafego.id).comments.some((c) => c.content === "x")).toBe(false);
    expect(store.getState().pendentes).toBe(1);
  });

  it("(c) depois do diff: Tarefa ganha o comentário, activity[0] é o registro novo, revisaoDoServidor avança", async () => {
    const trafego = achar(state, "tsk_cp_trafego");

    // O "servidor": a mesma operação, rodada numa cópia independente — o
    // diff que ele devolveria de verdade.
    const estadoServidor = structuredClone(state);
    const resultadoNoServidor = addTaskComment(estadoServidor, "mem_maryane", trafego.id, { content: "x" });
    if (!resultadoNoServidor.ok) throw new Error(`setup inválido: ${resultadoNoServidor.error}`);
    const tarefaGravada = estadoServidor.tasks.find((t) => t.id === trafego.id);
    if (!tarefaGravada) throw new Error("setup inválido: tarefa sumiu");
    const atividadeGravada = estadoServidor.activity[0];
    if (!atividadeGravada) throw new Error("setup inválido: sem activity");

    transporte.gravarMock.mockResolvedValueOnce({
      tipo: "diferenca",
      resultado: { ok: true, value: resultadoNoServidor.value },
      diferenca: {
        gravados: [
          { colecao: "tasks", id: tarefaGravada.id, dados: tarefaGravada, ordem: ordens.tasks?.[trafego.id] ?? 0 },
          { colecao: "activity", id: atividadeGravada.id, dados: atividadeGravada, ordem: -1 },
        ],
        removidos: [],
      },
      revisao: 8,
      revisaoAnterior: 7,
    });

    store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    await vi.waitFor(() => expect(store.getState().pendentes).toBe(0));
    expect(store.getState().revisaoDoServidor).toBe(8);
    const contaDepois = achar(store.getState().data, trafego.id);
    expect(contaDepois.comments.some((c) => c.content === "x")).toBe(true);
    expect(store.getState().data.activity[0]?.id).toBe(atividadeGravada.id);
  });
});

/** Um transporte que não responde até o teste soltar: cada `gravar` deixa a sua resposta esperando em `soltar`. */
type Soltar = (resposta: RespostaDeGravacao | readonly RespostaDeGravacao[]) => void;
function segurarGravacoes(): Soltar[] {
  const soltar: Soltar[] = [];
  transporte.gravarMock.mockImplementation(() => new Promise((resolve) => soltar.push(resolve)));
  return soltar;
}

const ESPACO = "spc_com";
const NOVA_LISTA = "Lista de teste do D-13";
const DONO = "mem_thiago";

function criarComoDono(): ReturnType<typeof criarStore> {
  return criarStore({ sessao: { memberId: DONO }, estadoInicial: { data: state, revisao: 7, ordens }, transporte });
}

function listasChamadas(estado: DataState, nome: string) {
  return estado.lists.filter((l) => l.name === nome);
}

const RECUSA_DO_SERVIDOR: RespostaDeGravacao = {
  tipo: "diferenca",
  resultado: { ok: false, error: "Já existe uma Lista com este nome aqui." },
  diferenca: DIFERENCA_VAZIA,
  revisao: 7,
  revisaoAnterior: 7,
};

describe("D-13 — a mudança aparece na hora", () => {
  it("a Lista criada já está em `data` antes de o transporte responder, e ainda não em `confirmado`", () => {
    const soltar = segurarGravacoes();
    store = criarComoDono();

    const resultado = store.getState().run((d, m) => createList(d, m, { name: NOVA_LISTA, parentType: "space", parentId: ESPACO }));

    expect(resultado.ok).toBe(true);
    expect(soltar).toHaveLength(1);
    expect(listasChamadas(store.getState().data, NOVA_LISTA)).toHaveLength(1);
    expect(listasChamadas(store.getState().confirmado, NOVA_LISTA)).toHaveLength(0);
    expect(store.getState().pendentes).toBe(1);
    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
  });

  it("a recusa do servidor (`ok: false`) tira a Lista de `data` e `lastResult.error` traz a mensagem dele (D-14)", async () => {
    const soltar = segurarGravacoes();
    store = criarComoDono();
    const { confirmado } = store.getState().runConfirmado((d, m) => createList(d, m, { name: NOVA_LISTA, parentType: "space", parentId: ESPACO }));
    expect(listasChamadas(store.getState().data, NOVA_LISTA)).toHaveLength(1);

    soltar[0]?.(RECUSA_DO_SERVIDOR);

    expect(await confirmado).toEqual({ ok: false, error: "Já existe uma Lista com este nome aqui." });
    expect(listasChamadas(store.getState().data, NOVA_LISTA)).toHaveLength(0);
    expect(store.getState().data).toBe(store.getState().confirmado);
    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Já existe uma Lista com este nome aqui.");
    expect(store.getState().pendentes).toBe(0);
  });

  it("a falha de transporte tira a Lista de `data` e `lastResult.error` traz a frase da falha (D-14)", async () => {
    const soltar = segurarGravacoes();
    store = criarComoDono();
    const { confirmado } = store.getState().runConfirmado((d, m) => createList(d, m, { name: NOVA_LISTA, parentType: "space", parentId: ESPACO }));

    soltar[0]?.({ tipo: "falha", erro: "Sem conexão com o servidor." });

    expect(await confirmado).toEqual({ ok: false, error: "Sem conexão com o servidor." });
    expect(listasChamadas(store.getState().data, NOVA_LISTA)).toHaveLength(0);
    expect(store.getState().data).toBe(store.getState().confirmado);
    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Sem conexão com o servidor.");
  });

  it("a confirmação do servidor põe a Lista que ele gravou em `confirmado`, e `data` é o mesmo objeto", async () => {
    const soltar = segurarGravacoes();
    store = criarComoDono();
    const { confirmado } = store.getState().runConfirmado((d, m) => createList(d, m, { name: NOVA_LISTA, parentType: "space", parentId: ESPACO }));

    const estadoServidor = structuredClone(state);
    const noServidor = createList(estadoServidor, DONO, { name: NOVA_LISTA, parentType: "space", parentId: ESPACO });
    if (!noServidor.ok) throw new Error(`setup inválido: ${noServidor.error}`);
    soltar[0]?.({
      tipo: "diferenca",
      resultado: noServidor,
      diferenca: { gravados: [{ colecao: "lists", id: noServidor.value.id, dados: noServidor.value, ordem: 9999 }], removidos: [] },
      revisao: 8,
      revisaoAnterior: 7,
    });

    expect(await confirmado).toMatchObject({ ok: true });
    expect(listasChamadas(store.getState().confirmado, NOVA_LISTA)).toHaveLength(1);
    expect(store.getState().data).toBe(store.getState().confirmado);
    expect(store.getState().revisaoDoServidor).toBe(8);
    expect(store.getState().pendentes).toBe(0);
  });

  it("sem pendente otimista, `data` e `confirmado` são o mesmo objeto (copy-on-write)", () => {
    expect(store.getState().data).toBe(store.getState().confirmado);
  });

  it("um `run` que a cópia aceita sem registrar nenhuma chamada não muda `data` e resolve com a falha de hoje", async () => {
    const dataAntes = store.getState().data;
    transporte.gravarMock.mockResolvedValueOnce({ tipo: "falha", erro: "Esta ação não passa por uma operação do domínio e não foi gravada." });

    const { local, confirmado } = store.getState().runConfirmado(() => ({ ok: true, value: "nada" }));

    expect(local.ok).toBe(true);
    expect(store.getState().data).toBe(dataAntes);
    expect(await confirmado).toEqual({ ok: false, error: "Esta ação não passa por uma operação do domínio e não foi gravada." });
    expect(store.getState().data).toBe(dataAntes);
  });
});

describe("D-13 — as operações da lista de exceções esperam o servidor", () => {
  const LISTA_DO_FORMULARIO = "lst_prospeccao";
  const NOME_DO_FORMULARIO = "Formulário de teste do D-13";
  const perguntas = [{ label: "Assunto", required: true, target: { kind: "title" as const } }];
  const formulariosChamados = (estado: DataState) => estado.forms.filter((f) => f.name === NOME_DO_FORMULARIO);

  it("`createForm` não põe o Formulário em `data` antes da resposta; depois dela, `data` tem o segredo que o SERVIDOR gerou (T-12-17)", async () => {
    const soltar = segurarGravacoes();
    store = criarComoDono();
    const dataAntes = store.getState().data;

    const { local, confirmado } = store.getState().runConfirmado((d, m) => createForm(d, m, LISTA_DO_FORMULARIO, { name: NOME_DO_FORMULARIO, questions: perguntas }));

    // O domínio aceitou na cópia e o pedido saiu, mas a tela não mostra nada que o servidor ainda não gravou.
    expect(local.ok).toBe(true);
    expect(soltar).toHaveLength(1);
    expect(formulariosChamados(store.getState().data)).toHaveLength(0);
    expect(store.getState().data).toBe(dataAntes);
    expect(store.getState().data).toBe(store.getState().confirmado);
    expect(store.getState().pendentes).toBe(1);

    // O "servidor": a mesma operação numa cópia independente, que gera o SEU segredo.
    const estadoServidor = structuredClone(state);
    const noServidor = createForm(estadoServidor, DONO, LISTA_DO_FORMULARIO, { name: NOME_DO_FORMULARIO, questions: perguntas });
    if (!noServidor.ok) throw new Error(`setup inválido: ${noServidor.error}`);
    if (!local.ok) throw new Error("esperava a cópia aceitar");
    expect(noServidor.value.secret).not.toBe(local.value.secret);

    soltar[0]?.({
      tipo: "diferenca",
      resultado: noServidor,
      diferenca: { gravados: [{ colecao: "forms", id: noServidor.value.id, dados: noServidor.value, ordem: 9999 }], removidos: [] },
      revisao: 8,
      revisaoAnterior: 7,
    });

    expect(await confirmado).toMatchObject({ ok: true });
    const formularios = formulariosChamados(store.getState().data);
    expect(formularios).toHaveLength(1);
    expect(formularios[0]?.secret).toBe(noServidor.value.secret);
    expect(formularios[0]?.secret).not.toBe(local.value.secret);
    expect(store.getState().data).toBe(store.getState().confirmado);
    expect(store.getState().pendentes).toBe(0);
  });

  it("um gesto que mistura `createList` e `createForm` espera inteiro: a Lista também não aparece antes da resposta", () => {
    const soltar = segurarGravacoes();
    store = criarComoDono();

    const resultado = store.getState().run((d, m) => {
      const lista = createList(d, m, { name: NOVA_LISTA, parentType: "space", parentId: ESPACO });
      if (!lista.ok) return lista;
      return createForm(d, m, lista.value.id, { name: NOME_DO_FORMULARIO, questions: perguntas });
    });

    expect(resultado.ok).toBe(true);
    expect(soltar).toHaveLength(1);
    const pedido = transporte.gravarMock.mock.calls[0]?.[0] as PedidoDeGravacao;
    expect(pedido.chamadas.map((c) => c.nome)).toEqual(["createList", "createForm"]);
    expect(listasChamadas(store.getState().data, NOVA_LISTA)).toHaveLength(0);
    expect(formulariosChamados(store.getState().data)).toHaveLength(0);
    expect(store.getState().data).toBe(store.getState().confirmado);
  });

  it("a recusa do servidor a uma operação da lista não deixa nada em `data` e `lastResult.error` traz a mensagem (D-14)", async () => {
    const soltar = segurarGravacoes();
    store = criarComoDono();
    const { confirmado } = store.getState().runConfirmado((d, m) => createForm(d, m, LISTA_DO_FORMULARIO, { name: NOME_DO_FORMULARIO, questions: perguntas }));

    soltar[0]?.(RECUSA_DO_SERVIDOR);

    expect(await confirmado).toEqual({ ok: false, error: "Já existe uma Lista com este nome aqui." });
    expect(formulariosChamados(store.getState().data)).toHaveLength(0);
    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Já existe uma Lista com este nome aqui.");
  });
});

describe("D-16 — um pedido por vez", () => {
  const NOME_A = "Lista A do D-16";
  const NOME_B = "Lista B do D-16";
  const NOME_C = "Lista C do D-16";

  const criar = (nome: string) => (d: DataState, m: Id) => createList(d, m, { name: nome, parentType: "space", parentId: ESPACO });
  const ordemDoPedido = () => transporte.gravarMock.mock.calls.map((c) => (c[0].chamadas[0]?.args[0] as { name?: string } | undefined)?.name);

  /**
   * A resposta que o servidor daria para criar `nome` quando a revisão dele é `de`: roda a operação numa cópia
   * independente do estado de partida e devolve a Lista que ele gravou.
   */
  function respostaDeCriar(nome: string, de: number, base: DataState = state): RespostaDeGravacao {
    const noServidor = createList(structuredClone(base), DONO, { name: nome, parentType: "space", parentId: ESPACO });
    if (!noServidor.ok) throw new Error(`setup inválido: ${noServidor.error}`);
    return {
      tipo: "diferenca",
      resultado: noServidor,
      diferenca: { gravados: [{ colecao: "lists", id: noServidor.value.id, dados: noServidor.value, ordem: 9000 + de }], removidos: [] },
      revisao: de + 1,
      revisaoAnterior: de,
    };
  }

  beforeEach(() => {
    store = criarComoDono();
  });

  it("dois `run` seguidos: o segundo pedido só sai depois da resposta do primeiro, e as duas respostas entram na revisão sem re-hidratar", async () => {
    const soltar = segurarGravacoes();
    const a = store.getState().runConfirmado(criar(NOME_A));
    const b = store.getState().runConfirmado(criar(NOME_B));

    // As duas mudanças já estão na tela, mas só o primeiro pedido saiu.
    expect(listasChamadas(store.getState().data, NOME_A)).toHaveLength(1);
    expect(listasChamadas(store.getState().data, NOME_B)).toHaveLength(1);
    expect(store.getState().pendentes).toBe(2);
    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);

    soltar[0]?.(respostaDeCriar(NOME_A, 7));
    await a.confirmado;

    expect(transporte.gravarMock).toHaveBeenCalledTimes(2);
    expect(ordemDoPedido()).toEqual([NOME_A, NOME_B]);
    // O segundo pedido sai com a revisão que o primeiro devolveu.
    expect((transporte.gravarMock.mock.calls[1]?.[0] as PedidoDeGravacao).revisao).toBe(8);
    expect(store.getState().pendentes).toBe(1);
    // Enquanto o segundo espera, a tela mostra as duas (A confirmada, B refeita por cima).
    expect(listasChamadas(store.getState().data, NOME_A)).toHaveLength(1);
    expect(listasChamadas(store.getState().data, NOME_B)).toHaveLength(1);

    // O servidor roda B depois de A: `state` (o `confirmado` de partida, mutado em lugar) já tem A.
    soltar[1]?.(respostaDeCriar(NOME_B, 8));
    await b.confirmado;

    expect(store.getState().revisaoDoServidor).toBe(9);
    expect(transporte.hidratarMock).not.toHaveBeenCalled();
    expect(store.getState().pendentes).toBe(0);
    expect(store.getState().data).toBe(store.getState().confirmado);
    expect(listasChamadas(store.getState().data, NOME_A)).toHaveLength(1);
    expect(listasChamadas(store.getState().data, NOME_B)).toHaveLength(1);
  });

  it("três `run` seguidos: `transporte.gravar` recebe os pedidos na ordem do clique, um de cada vez", async () => {
    const soltar = segurarGravacoes();
    const envios = [NOME_A, NOME_B, NOME_C].map((nome) => store.getState().runConfirmado(criar(nome)));

    expect(ordemDoPedido()).toEqual([NOME_A]);
    soltar[0]?.(respostaDeCriar(NOME_A, 7));
    await envios[0]?.confirmado;
    expect(ordemDoPedido()).toEqual([NOME_A, NOME_B]);
    soltar[1]?.(respostaDeCriar(NOME_B, 8));
    await envios[1]?.confirmado;
    expect(ordemDoPedido()).toEqual([NOME_A, NOME_B, NOME_C]);
    soltar[2]?.(respostaDeCriar(NOME_C, 9));
    await envios[2]?.confirmado;

    expect(store.getState().revisaoDoServidor).toBe(10);
    expect(transporte.hidratarMock).not.toHaveBeenCalled();
    expect(store.getState().pendentes).toBe(0);
  });

  it("o primeiro é recusado e o segundo é independente: continua em `data`, é enviado e é confirmado", async () => {
    const soltar = segurarGravacoes();
    const a = store.getState().runConfirmado(criar(NOME_A));
    const b = store.getState().runConfirmado(criar(NOME_B));

    soltar[0]?.(RECUSA_DO_SERVIDOR);
    expect(await a.confirmado).toEqual({ ok: false, error: "Já existe uma Lista com este nome aqui." });

    // A some; B, refeita por cima de `confirmado`, fica e segue para o servidor.
    expect(listasChamadas(store.getState().data, NOME_A)).toHaveLength(0);
    expect(listasChamadas(store.getState().data, NOME_B)).toHaveLength(1);
    expect(transporte.gravarMock).toHaveBeenCalledTimes(2);
    expect(ordemDoPedido()).toEqual([NOME_A, NOME_B]);

    soltar[1]?.(respostaDeCriar(NOME_B, 7));
    expect(await b.confirmado).toMatchObject({ ok: true });
    expect(listasChamadas(store.getState().data, NOME_A)).toHaveLength(0);
    expect(listasChamadas(store.getState().data, NOME_B)).toHaveLength(1);
    expect(store.getState().data).toBe(store.getState().confirmado);
    expect(store.getState().pendentes).toBe(0);
  });

  it("criar uma Lista e renomeá-la pelo id dela: se a criação é recusada, a renomeação falha ao ser refeita, some com o erro e NUNCA vai ao servidor (T-12-16)", async () => {
    const soltar = segurarGravacoes();
    const criada = store.getState().runConfirmado(criar(NOME_A));
    if (!criada.local.ok) throw new Error(`setup inválido: ${criada.local.error}`);
    const idLocal = criada.local.value.id;
    const renomeada = store.getState().runConfirmado((d, m) => updateContainer(d, m, "list", idLocal, { name: "Nome novo do D-16" }));
    expect(renomeada.local.ok).toBe(true);
    expect(store.getState().pendentes).toBe(2);

    soltar[0]?.(RECUSA_DO_SERVIDOR);
    await criada.confirmado;
    const segundo = await renomeada.confirmado;

    expect(segundo.ok).toBe(false);
    expect(transporte.gravarMock).toHaveBeenCalledTimes(1);
    expect(store.getState().data.lists.some((l) => l.id === idLocal)).toBe(false);
    expect(store.getState().data).toBe(store.getState().confirmado);
    expect(store.getState().pendentes).toBe(0);
    // A causa (a recusa do servidor) continua no canal de erro; o erro da renomeação refeita não a encobre.
    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Já existe uma Lista com este nome aqui.");
  });

  it("conflito no primeiro: re-hidrata uma vez, o primeiro some com a frase do conflito e o segundo é refeito sobre o estado re-hidratado e enviado", async () => {
    const soltar = segurarGravacoes();
    const reidratado = structuredClone(state);
    transporte.hidratarMock.mockResolvedValueOnce({ data: reidratado, revisao: 9, ordens: ordensDeTodasAsColecoes(reidratado), memberId: DONO });
    const a = store.getState().runConfirmado(criar(NOME_A));
    const b = store.getState().runConfirmado(criar(NOME_B));

    soltar[0]?.({ tipo: "conflito", erro: "Outra alteração entrou antes desta." });

    expect(await a.confirmado).toEqual({ ok: false, error: "Outra alteração entrou antes desta." });
    expect(transporte.hidratarMock).toHaveBeenCalledTimes(1);
    expect(store.getState().revisaoDoServidor).toBe(9);
    expect(listasChamadas(store.getState().data, NOME_A)).toHaveLength(0);
    expect(listasChamadas(store.getState().data, NOME_B)).toHaveLength(1);
    expect(transporte.gravarMock).toHaveBeenCalledTimes(2);
    expect((transporte.gravarMock.mock.calls[1]?.[0] as PedidoDeGravacao).revisao).toBe(9);

    soltar[1]?.(respostaDeCriar(NOME_B, 9, reidratado));
    expect(await b.confirmado).toMatchObject({ ok: true });
    expect(store.getState().revisaoDoServidor).toBe(10);
    expect(store.getState().pendentes).toBe(0);
  });

  it("`rehidratar()` de fora com um pedido em voo espera a resposta: a Lista que o pedido criou aparece uma vez só (Pitfall 3)", async () => {
    const soltar = segurarGravacoes();
    const criada = store.getState().runConfirmado(criar(NOME_A));
    const resposta = respostaDeCriar(NOME_A, 7);
    // O `GET /estado` que vem depois do commit já traz a Lista que o pedido em voo gravou.
    const doServidor = structuredClone(state);
    const gravada = (resposta as Extract<RespostaDeGravacao, { tipo: "diferenca" }>).diferenca.gravados[0];
    if (!gravada) throw new Error("setup inválido");
    doServidor.lists.push(gravada.dados as DataState["lists"][number]);
    transporte.hidratarMock.mockResolvedValueOnce({ data: doServidor, revisao: 8, ordens: ordensDeTodasAsColecoes(doServidor), memberId: DONO });

    const fora = store.getState().rehidratar();

    expect(transporte.hidratarMock).not.toHaveBeenCalled();
    soltar[0]?.(resposta);
    await criada.confirmado;
    await fora;

    expect(transporte.hidratarMock).toHaveBeenCalledTimes(1);
    expect(listasChamadas(store.getState().data, NOME_A)).toHaveLength(1);
    expect(store.getState().data).toBe(store.getState().confirmado);
    expect(store.getState().revisaoDoServidor).toBe(8);
  });

  it("fila vazia: `data` é o mesmo objeto que `confirmado` e `rehidratar()` busca na hora", async () => {
    expect(store.getState().data).toBe(store.getState().confirmado);
    const doServidor = structuredClone(state);
    transporte.hidratarMock.mockResolvedValueOnce({ data: doServidor, revisao: 8, ordens: ordensDeTodasAsColecoes(doServidor), memberId: DONO });

    const promessa = store.getState().rehidratar();

    expect(transporte.hidratarMock).toHaveBeenCalledTimes(1); // síncrono: ninguém em voo
    await promessa;
    expect(store.getState().data).toBe(doServidor);
    expect(store.getState().confirmado).toBe(doServidor);
  });

  it("`verificarRevisao()` com uma gravação na fila não pergunta a revisão", async () => {
    const soltar = segurarGravacoes();
    const revisaoAtual = vi.fn(async () => 99);
    const comPergunta: Transporte = { gravar: transporte.gravar, hidratar: transporte.hidratar, revisaoAtual };
    const s = criarStore({ sessao: { memberId: DONO }, estadoInicial: { data: state, revisao: 7, ordens }, transporte: comPergunta });
    s.getState().run(criar(NOME_A));
    s.getState().run(criar(NOME_B));
    expect(s.getState().pendentes).toBe(2);

    expect(await s.getState().verificarRevisao()).toBe(false);

    expect(revisaoAtual).not.toHaveBeenCalled();
    soltar[0]?.({ tipo: "falha", erro: "fim do teste" });
  });
});

describe("run() — revisão defasada e conflito (D-06)", () => {
  it("(d) revisaoAnterior diferente da local aciona rehidratar() e substitui o data", async () => {
    const estadoFake = { marcador: "veio-do-rehidratar" } as unknown as DataState;
    transporte.hidratarMock.mockResolvedValueOnce({ data: estadoFake, revisao: 10, ordens: {}, memberId: "mem_maryane" });
    transporte.gravarMock.mockResolvedValueOnce({
      tipo: "diferenca",
      resultado: { ok: true, value: undefined },
      diferenca: DIFERENCA_VAZIA,
      revisao: 10,
      revisaoAnterior: 9, // !== revisaoDoServidor local (7)
    });
    const trafego = achar(state, "tsk_cp_trafego");

    store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    await vi.waitFor(() => expect(transporte.hidratarMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(store.getState().data).toBe(estadoFake));
    expect(store.getState().revisaoDoServidor).toBe(10);
  });

  it("(e) tipo: conflito aciona rehidratar() e marca lastResult com o erro", async () => {
    transporte.hidratarMock.mockResolvedValueOnce({ data: state, revisao: 11, ordens, memberId: "mem_maryane" });
    transporte.gravarMock.mockResolvedValueOnce({ tipo: "conflito", erro: "Outra alteração entrou antes desta." });
    const trafego = achar(state, "tsk_cp_trafego");

    store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    await vi.waitFor(() => expect(transporte.hidratarMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(store.getState().lastResult?.ok).toBe(false));
  });
});

describe("run() — falha de transporte", () => {
  it("(f) tipo: falha marca lastResult.error sem mexer em data", async () => {
    transporte.gravarMock.mockResolvedValueOnce({ tipo: "falha", erro: "Sem conexão com o servidor." });
    const dataAntes = store.getState().data;
    const trafego = achar(state, "tsk_cp_trafego");

    store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));

    await vi.waitFor(() => expect(store.getState().lastResult?.ok).toBe(false));
    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Sem conexão com o servidor.");
    expect(store.getState().data).toBe(dataAntes);
  });
});

describe("run() — ids determinísticos (a cópia gera o que o servidor geraria)", () => {
  it("(g) syncIdSequence evita colisão mesmo com o contador de módulo desalinhado", () => {
    const trafego = achar(state, "tsk_cp_trafego");

    const estadoReferencia = structuredClone(state);
    syncIdSequence(estadoReferencia);
    const referencia = addTaskComment(estadoReferencia, "mem_maryane", trafego.id, { content: "referência" });
    if (!referencia.ok) throw new Error(`setup inválido: ${referencia.error}`);

    // Simula um contador de módulo desalinhado — ex.: outro teste avançou.
    // `run()` precisa corrigir via `syncIdSequence(copia)` antes de gerar o
    // próximo id, senão colidiria com um registro já existente.
    resetIdSequence(0);

    const resultado = store.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));
    if (!resultado.ok) throw new Error(`recusa inesperada: ${resultado.error}`);

    expect(resultado.value.id).toBe(referencia.value.id);
  });
});

describe("run() — mais de uma chamada no mesmo run()", () => {
  it("(h) as duas chamadas viajam juntas, na ordem", () => {
    transporte.gravarMock.mockResolvedValueOnce({
      tipo: "diferenca",
      resultado: { ok: true, value: { id: "chat_x" } },
      diferenca: DIFERENCA_VAZIA,
      revisao: 8,
      revisaoAnterior: 7,
    });

    const resultado = store.getState().run((d, m) => {
      const sessao = createChatSession(d, m, { title: "Pergunta" });
      if (!sessao.ok) return sessao;
      sendChatMessage(d, m, sessao.value.id, "Pergunta");
      return sessao;
    });

    expect(resultado.ok).toBe(true);
    const pedido = transporte.gravarMock.mock.calls[0]?.[0] as PedidoDeGravacao;
    expect(pedido.chamadas.map((c) => c.nome)).toEqual(["createChatSession", "sendChatMessage"]);
  });

  /** Um registro de `chatSessions` por diferença: basta para ver cada uma aplicada, na ordem, sem montar o chat inteiro. */
  function diferencaDoRegistro(id: string): Diferenca {
    return { gravados: [{ colecao: "chatSessions", id, dados: { id }, ordem: 500 + (id === "chat_a" ? 0 : 1) }], removidos: [] };
  }

  function dividirEmDuasChamadas() {
    return store.getState().runConfirmado((d, m) => {
      const sessao = createChatSession(d, m, { title: "Pergunta" });
      if (!sessao.ok) return sessao;
      sendChatMessage(d, m, sessao.value.id, "Pergunta");
      return sessao;
    });
  }

  function registroEm(id: string): unknown {
    return (store.getState().data.chatSessions as ReadonlyArray<{ readonly id: string }>).find((r) => r.id === id);
  }

  it("(s) duas chamadas, duas diferenças encadeadas (7→8, 8→9): aplica as duas, termina na revisão 9 e não hidrata (GRV-04)", async () => {
    transporte.gravarMock.mockResolvedValueOnce([
      { tipo: "diferenca", resultado: { ok: true, value: { id: "chat_a" } }, diferenca: diferencaDoRegistro("chat_a"), revisao: 8, revisaoAnterior: 7 },
      { tipo: "diferenca", resultado: { ok: true, value: undefined }, diferenca: diferencaDoRegistro("chat_b"), revisao: 9, revisaoAnterior: 8 },
    ]);

    const { confirmado } = dividirEmDuasChamadas();
    const servidor = await confirmado;

    expect(servidor).toEqual({ ok: true, value: undefined }); // a última resposta processada
    expect(registroEm("chat_a")).toEqual({ id: "chat_a" });
    expect(registroEm("chat_b")).toEqual({ id: "chat_b" });
    expect(store.getState().revisaoDoServidor).toBe(9);
    expect(transporte.hidratarMock).not.toHaveBeenCalled();
    expect(store.getState().pendentes).toBe(0);
  });

  it("(t) a segunda resposta não encaixa (revisaoAnterior 10): aplica a primeira, re-hidrata UMA vez e o estado final é o do GET /estado (D-12, T-12-13)", async () => {
    const doServidor = { marcador: "estado do GET /estado", chatSessions: [] } as unknown as DataState;
    transporte.hidratarMock.mockResolvedValueOnce({ data: doServidor, revisao: 11, ordens: {}, memberId: "mem_maryane" });
    const aplicada = vi.fn();
    transporte.gravarMock.mockImplementationOnce(async () => {
      aplicada(registroEm("chat_a"));
      return [
        { tipo: "diferenca", resultado: { ok: true, value: { id: "chat_a" } }, diferenca: diferencaDoRegistro("chat_a"), revisao: 8, revisaoAnterior: 7 },
        { tipo: "diferenca", resultado: { ok: true, value: undefined }, diferenca: diferencaDoRegistro("chat_b"), revisao: 11, revisaoAnterior: 10 },
      ];
    });
    const revisoes: number[] = [];
    store.subscribe((estado) => revisoes.push(estado.revisaoDoServidor));

    const { confirmado } = dividirEmDuasChamadas();
    await confirmado;

    expect(aplicada).toHaveBeenCalledWith(undefined); // antes da resposta, a primeira ainda não estava na tela
    expect(revisoes).toContain(8); // a primeira encaixou e foi aplicada
    expect(transporte.hidratarMock).toHaveBeenCalledTimes(1);
    expect(store.getState().data).toBe(doServidor);
    expect(store.getState().revisaoDoServidor).toBe(11);
    expect(store.getState().pendentes).toBe(0);
  });

  it("(u) [diferença 7→8, conflito]: aplica a primeira, re-hidrata uma vez e `confirmado` resolve com a frase do conflito", async () => {
    const doServidor = { marcador: "depois do conflito" } as unknown as DataState;
    transporte.hidratarMock.mockResolvedValueOnce({ data: doServidor, revisao: 9, ordens: {}, memberId: "mem_maryane" });
    const revisoes: number[] = [];
    store.subscribe((estado) => revisoes.push(estado.revisaoDoServidor));
    transporte.gravarMock.mockResolvedValueOnce([
      { tipo: "diferenca", resultado: { ok: true, value: { id: "chat_a" } }, diferenca: diferencaDoRegistro("chat_a"), revisao: 8, revisaoAnterior: 7 },
      { tipo: "conflito", erro: "Outra alteração entrou antes desta." },
    ]);

    const { confirmado } = dividirEmDuasChamadas();

    expect(await confirmado).toEqual({ ok: false, error: "Outra alteração entrou antes desta." });
    expect(revisoes).toContain(8);
    expect(transporte.hidratarMock).toHaveBeenCalledTimes(1);
    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Outra alteração entrou antes desta.");
    expect(store.getState().data).toBe(doServidor);
  });

  it("(v) [diferença 7→8, falha]: aplica a primeira, NÃO re-hidrata e mostra a frase da falha", async () => {
    transporte.gravarMock.mockResolvedValueOnce([
      { tipo: "diferenca", resultado: { ok: true, value: { id: "chat_a" } }, diferenca: diferencaDoRegistro("chat_a"), revisao: 8, revisaoAnterior: 7 },
      { tipo: "falha", erro: "Sem conexão com o servidor." },
    ]);

    const { confirmado } = dividirEmDuasChamadas();

    expect(await confirmado).toEqual({ ok: false, error: "Sem conexão com o servidor." });
    expect(registroEm("chat_a")).toEqual({ id: "chat_a" });
    expect(registroEm("chat_b")).toBeUndefined();
    expect(store.getState().revisaoDoServidor).toBe(8);
    expect(transporte.hidratarMock).toHaveBeenCalledTimes(0);
    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Sem conexão com o servidor.");
  });

  it("(w) [ok, recusa do servidor na segunda]: aplica as duas (a segunda com diferença vazia) e lastResult traz a recusa", async () => {
    transporte.gravarMock.mockResolvedValueOnce([
      { tipo: "diferenca", resultado: { ok: true, value: { id: "chat_a" } }, diferenca: diferencaDoRegistro("chat_a"), revisao: 8, revisaoAnterior: 7 },
      { tipo: "diferenca", resultado: { ok: false, error: "O prazo virou entre o clique e a resposta." }, diferenca: DIFERENCA_VAZIA, revisao: 9, revisaoAnterior: 8 },
    ]);

    const { confirmado } = dividirEmDuasChamadas();

    expect(await confirmado).toEqual({ ok: false, error: "O prazo virou entre o clique e a resposta." });
    expect(registroEm("chat_a")).toEqual({ id: "chat_a" });
    expect(store.getState().revisaoDoServidor).toBe(9);
    expect(transporte.hidratarMock).toHaveBeenCalledTimes(0);
    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("O prazo virou entre o clique e a resposta.");
  });
});

describe("rehidratar()", () => {
  it("(i) hidratar() falho marca lastResult.error", async () => {
    transporte.hidratarMock.mockResolvedValueOnce({ tipo: "falha", erro: "Sem conexão com o servidor." });

    await store.getState().rehidratar();

    const lastResult = store.getState().lastResult;
    if (lastResult?.ok !== false) throw new Error("esperava recusa");
    expect(lastResult.error).toBe("Sem conexão com o servidor.");
  });
});

describe("runConfirmado() — o id que vale é o do servidor (checklist E1)", () => {
  it("(j) a ponte gravou no meio: a cópia calcula um id, o servidor dá outro, e `confirmado` traz o do servidor", async () => {
    const estadoDoServidor = { marcador: "rehidratado" } as unknown as DataState;
    transporte.hidratarMock.mockResolvedValueOnce({ data: estadoDoServidor, revisao: 9, ordens: {}, memberId: "mem_maryane" });
    transporte.gravarMock.mockImplementationOnce(async (pedido: PedidoDeGravacao) => {
      const local = pedido.resultado as { readonly ok: true; readonly value: Task };
      return {
        tipo: "diferenca",
        resultado: { ok: true, value: { ...local.value, id: "tsk_do_servidor" } },
        diferenca: DIFERENCA_VAZIA,
        revisao: 9,
        revisaoAnterior: 8, // a ponte gravou a revisão 8 depois da nossa hidratação (7)
      };
    });

    const { local, confirmado } = store
      .getState()
      .runConfirmado((d, m) => createTask(d, m, { listId: CP.listId, title: "Conta — TESTE AUTOMATIZADO E1" }));

    expect(local.ok).toBe(true);
    const servidor = await confirmado;
    expect(servidor).toMatchObject({ ok: true, value: { id: "tsk_do_servidor", title: "Conta — TESTE AUTOMATIZADO E1" } });
    expect(local.ok && local.value.id).not.toBe("tsk_do_servidor");
    expect(store.getState().data).toBe(estadoDoServidor);
  });

  it("(k) recusa do domínio: `confirmado` resolve com a mesma recusa, sem POST", async () => {
    const { local, confirmado } = store.getState().runConfirmado((d, m) => createTask(d, m, { listId: "lst_nao_existe", title: "Conta — TESTE AUTOMATIZADO E1" }));
    expect(local.ok).toBe(false);
    expect(await confirmado).toEqual(local);
    expect(transporte.gravarMock).not.toHaveBeenCalled();
  });

  it("(l) conflito e falha de transporte resolvem como recusa, com a frase do transporte", async () => {
    transporte.hidratarMock.mockResolvedValueOnce({ data: state, revisao: 11, ordens, memberId: "mem_maryane" });
    transporte.gravarMock.mockResolvedValueOnce({ tipo: "conflito", erro: "Outra alteração entrou antes desta." });
    const a = store.getState().runConfirmado((d, m) => createTask(d, m, { listId: CP.listId, title: "Conta A — TESTE AUTOMATIZADO E1" }));
    expect(await a.confirmado).toEqual({ ok: false, error: "Outra alteração entrou antes desta." });

    transporte.gravarMock.mockResolvedValueOnce({ tipo: "falha", erro: "Sem conexão com o servidor." });
    const b = store.getState().runConfirmado((d, m) => createTask(d, m, { listId: CP.listId, title: "Conta B — TESTE AUTOMATIZADO E1" }));
    expect(await b.confirmado).toEqual({ ok: false, error: "Sem conexão com o servidor." });
  });
});

describe("verificarRevisao() — a tela vê o que outro processo gravou (checklist E2)", () => {
  function comRevisao(revisoes: Array<number | undefined>) {
    const revisaoAtual = vi.fn(async () => revisoes.shift());
    const comPergunta: Transporte = { gravar: transporte.gravar, hidratar: transporte.hidratar, revisaoAtual };
    return { revisaoAtual, store: criarStore({ sessao: { memberId: "mem_maryane" }, estadoInicial: { data: state, revisao: 7, ordens }, transporte: comPergunta }) };
  }

  it("(m) o servidor à frente: re-hidrata e passa a valer a revisão dele", async () => {
    const outro = { marcador: "a ponte gravou" } as unknown as DataState;
    transporte.hidratarMock.mockResolvedValueOnce({ data: outro, revisao: 9, ordens: {}, memberId: "mem_maryane" });
    const { store: s } = comRevisao([9]);
    expect(await s.getState().verificarRevisao()).toBe(true);
    expect(s.getState().data).toBe(outro);
    expect(s.getState().revisaoDoServidor).toBe(9);
  });

  it("(n) mesma revisão, ou sem resposta: nada é recarregado", async () => {
    const { store: s } = comRevisao([7, undefined]);
    expect(await s.getState().verificarRevisao()).toBe(false);
    expect(await s.getState().verificarRevisao()).toBe(false);
    expect(transporte.hidratarMock).not.toHaveBeenCalled();
  });

  it("(o) com uma gravação desta tela a caminho, nem pergunta: o diff dela traz a revisão", async () => {
    let soltar: (r: RespostaDeGravacao) => void = () => {};
    transporte.gravarMock.mockImplementationOnce(() => new Promise<RespostaDeGravacao>((resolve) => (soltar = resolve)));
    const { store: s, revisaoAtual } = comRevisao([99]);
    const trafego = achar(state, "tsk_cp_trafego");
    s.getState().run((d, m) => addTaskComment(d, m, trafego.id, { content: "x" }));
    expect(s.getState().pendentes).toBe(1);
    expect(await s.getState().verificarRevisao()).toBe(false);
    expect(revisaoAtual).not.toHaveBeenCalled();
    soltar({ tipo: "falha", erro: "fim do teste" });
  });

  it("(p) sem servidor (rotas públicas): nunca pergunta", async () => {
    expect(await store.getState().verificarRevisao()).toBe(false);
  });
});

describe("revisão de código — corridas e falhas do envio", () => {
  it("(q) uma re-hidratação que chega depois com revisão MENOR não sobrescreve o estado mais novo", async () => {
    const novo = { marcador: "revisão 12" } as unknown as DataState;
    const velho = { marcador: "revisão 9" } as unknown as DataState;
    transporte.hidratarMock.mockResolvedValueOnce({ data: novo, revisao: 12, ordens: {}, memberId: "mem_maryane" });
    await store.getState().rehidratar();
    transporte.hidratarMock.mockResolvedValueOnce({ data: velho, revisao: 9, ordens: {}, memberId: "mem_maryane" });
    await store.getState().rehidratar();
    expect(store.getState().data).toBe(novo);
    expect(store.getState().revisaoDoServidor).toBe(12);
  });

  it("(r) um envio que quebra (corpo estranho) resolve `confirmado` como recusa — a tela nunca fica esperando", async () => {
    transporte.gravarMock.mockRejectedValueOnce(new SyntaxError("Unexpected token < in JSON"));
    const { confirmado } = store.getState().runConfirmado((d, m) => createTask(d, m, { listId: CP.listId, title: "Conta — TESTE AUTOMATIZADO revisão" }));
    const r = await confirmado;
    expect(r.ok).toBe(false);
    expect(store.getState().pendentes).toBe(0);
    expect(store.getState().lastResult?.ok).toBe(false);
  });
});

describe("deveAvisarAoSair — fechar a aba com gravação pendente pede confirmação (T-12-20)", () => {
  it("sem gravação pendente, a aba fecha sem perguntar", () => {
    expect(deveAvisarAoSair(0)).toBe(false);
  });

  it("com uma ou mais gravações pendentes, pergunta", () => {
    expect(deveAvisarAoSair(1)).toBe(true);
    expect(deveAvisarAoSair(3)).toBe(true);
  });
});
