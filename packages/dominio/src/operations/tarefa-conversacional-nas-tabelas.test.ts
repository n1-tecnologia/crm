/**
 * 3.3.4 a 3.3.6 — a Tarefa conversacional sobre ids das tabelas novas. Todos os
 * testes rodam sobre um estado em que `contacts`, `conversations`, `channels` e
 * `deals` estão vazios: o que o servidor conferiu chega em `referencias`, e a
 * operação nunca o procura no CRM antigo. Cada teste afirma o RESULTADO e o
 * estado que a operação deixou.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { PAPEL_DO_VINCULO, vinculosDoCrmDaTarefa } from "../derive-conversacional";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { LISTA_SEM_CANAIS } from "./canais";
import { OPERACOES } from "./registro";
import { changeTaskStatus, listWriteRefusal } from "./tasks";
import {
  aplicarTarefaDaRecebida,
  atorDaMensagemRecebida,
  autorizadorDaTarefaDaRecebida,
  criarTarefaConversacionalNasTabelas,
  ligarNegocioNovoATarefaNasTabelas,
  tarefaDaRecebida,
  trocarCanalDaTarefaNasTabelas,
  vincularNegocioATarefaNasTabelas,
  type ReferenciasDaTarefaConversacional,
} from "./tarefa-conversacional-nas-tabelas";

const THIAGO = "mem_thiago";
const LISTA = "lst_pos_venda";
const OPERACIONAL = "lst_ativacao";

const CONTATO = "11111111-1111-4111-8111-111111111111";
const CONVERSA = "22222222-2222-4222-8222-222222222222";
const OUTRA_CONVERSA = "88888888-8888-4888-8888-888888888888";
const NEGOCIO = "33333333-3333-4333-8333-333333333333";
const OUTRO_NEGOCIO = "99999999-9999-4999-8999-999999999999";
const CANAL_A = "44444444-4444-4444-8444-444444444444";
const CANAL_B = "55555555-5555-4555-8555-555555555555";
const CANAL_FORA = "66666666-6666-4666-8666-666666666666";

const referencias = (sobre: Partial<ReferenciasDaTarefaConversacional> = {}): ReferenciasDaTarefaConversacional => ({
  contato: { id: CONTATO, nome: "Marina Duarte" },
  canal: { id: CANAL_A, nome: "Comercial", tipo: "whatsapp", conexao: "conectada" },
  conversaId: CONVERSA,
  ...sobre,
});

let state: DataState;

beforeEach(() => {
  state = buildSeed();
  const lista = state.lists.find((l) => l.id === LISTA);
  if (!lista) throw new Error("o seed precisa de lst_pos_venda");
  lista.canaisDeAtendimento = [CANAL_A, CANAL_B];
  // O seed não cria Contato, Canal nem Negócio (15-31): a operação só enxerga as referências.
  state.conversations = [];
});

/** O tamanho do que a operação pode deixar para trás. */
const pegada = (): readonly number[] => [state.tasks.length, state.links.length, state.activity.length];

function nasce(sobre: Partial<ReferenciasDaTarefaConversacional> = {}, listId: string = LISTA): Task {
  const r = criarTarefaConversacionalNasTabelas(state, THIAGO, { listId }, referencias(sobre));
  if (!r.ok) throw new Error(r.error);
  return r.value.task;
}

describe("criarTarefaConversacionalNasTabelas", () => {
  it("a Tarefa nasce com os Vínculos para os ids das referências, o nome do Contato, a proveniência e a Atividade", () => {
    const task = nasce({ negocio: { id: NEGOCIO, titulo: "Renovação 2027" } });
    expect(task.title).toBe("Marina Duarte");
    expect(task.listId).toBe(LISTA);
    expect(vinculosDoCrmDaTarefa(state, task)).toEqual({ contatoId: CONTATO, conversaId: CONVERSA, negocioId: NEGOCIO });
    const papeis = state.links.filter((l) => l.fromId === task.id).map((l) => [l.toType, l.role]);
    expect(papeis).toEqual(
      expect.arrayContaining([
        ["contact", PAPEL_DO_VINCULO.contato],
        ["conversation", PAPEL_DO_VINCULO.conversa],
        ["deal", PAPEL_DO_VINCULO.negocio],
      ]),
    );
    expect(task.provenance).toMatchObject({ kind: "contact", sourceId: CONTATO, sourceName: "Marina Duarte" });
    const atividade = state.activity.find((a) => a.action === "Tarefa vinculada ao Contato" && a.objectId === task.id);
    expect(atividade?.detail).toBe("Marina Duarte · Comercial");
  });

  it("sem Negócio nas referências não nasce Vínculo de Negócio; o título do input vence o nome do Contato", () => {
    const r = criarTarefaConversacionalNasTabelas(state, THIAGO, { listId: LISTA, title: "  Reenviar certificado " }, referencias());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.task.title).toBe("Reenviar certificado");
    expect(vinculosDoCrmDaTarefa(state, r.value.task).negocioId).toBeUndefined();
  });

  it("recusa a Lista operacional, com o campo lista", () => {
    const r = criarTarefaConversacionalNasTabelas(state, THIAGO, { listId: OPERACIONAL }, referencias());
    expect(r).toEqual({ ok: false, error: "Esta Lista é operacional: a Tarefa nasce pelo título, sem Contato.", field: "lista" });
  });

  it("recusa a Lista conversacional sem canais de atendimento, com o campo lista", () => {
    const lista = state.lists.find((l) => l.id === LISTA);
    if (lista) lista.canaisDeAtendimento = [];
    const r = criarTarefaConversacionalNasTabelas(state, THIAGO, { listId: LISTA }, referencias());
    expect(r).toEqual({ ok: false, error: LISTA_SEM_CANAIS, field: "lista" });
  });

  it("recusa o Canal que a Lista não atende, com o campo canal", () => {
    const r = criarTarefaConversacionalNasTabelas(
      state,
      THIAGO,
      { listId: LISTA },
      referencias({ canal: { id: CANAL_FORA, nome: "Atendimento", tipo: "email", conexao: "conectada" } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe("canal");
      expect(r.error).toBe("Esta Lista não atende por “Atendimento” (E-mail).");
    }
  });

  it("recusa o Canal desconectado com a mesma frase de hoje, e deixa passar o com_erro", () => {
    const desligado = criarTarefaConversacionalNasTabelas(
      state,
      THIAGO,
      { listId: LISTA },
      referencias({ canal: { id: CANAL_A, nome: "Comercial", tipo: "whatsapp", conexao: "desconectada" } }),
    );
    expect(desligado.ok).toBe(false);
    if (!desligado.ok) {
      expect(desligado.field).toBe("canal");
      expect(desligado.error).toBe("O Canal Comercial está desconectado: escolha outro Canal ou reconecte-o.");
    }
    const comErro = criarTarefaConversacionalNasTabelas(
      state,
      THIAGO,
      { listId: LISTA },
      referencias({ canal: { id: CANAL_A, nome: "Comercial", tipo: "whatsapp", conexao: "com_erro" } }),
    );
    expect(comErro.ok).toBe(true);
  });

  it("recusa quem não pode escrever na Lista, com a frase de listWriteRefusal", () => {
    const esperada = listWriteRefusal(state, "mem_que_nao_existe", LISTA);
    expect(esperada).toBeTruthy();
    const r = criarTarefaConversacionalNasTabelas(state, "mem_que_nao_existe", { listId: LISTA }, referencias());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(esperada);
  });

  it("uma recusa de createTask desfaz Tarefa, Vínculos e Atividade: o estado volta igual", () => {
    const antes = pegada();
    const r = criarTarefaConversacionalNasTabelas(
      state,
      THIAGO,
      { listId: LISTA, statusId: "st_que_nao_existe" },
      referencias({ negocio: { id: NEGOCIO, titulo: "Renovação 2027" } }),
    );
    expect(r.ok).toBe(false);
    expect(pegada()).toEqual(antes);
  });

  it("nunca abre Conversa no estado: a Conversa é da tabela, aberta pela api", () => {
    nasce();
    expect(state.conversations).toEqual([]);
  });
});

describe("trocarCanalDaTarefaNasTabelas", () => {
  const outroCanal = (sobre: Partial<ReferenciasDaTarefaConversacional["canal"]> = {}): ReferenciasDaTarefaConversacional["canal"] => ({
    id: CANAL_B,
    nome: "Suporte",
    tipo: "whatsapp",
    conexao: "conectada",
    ...sobre,
  });

  it("para outra Conversa, troca só o Vínculo da conversa e grava a Atividade com antes e depois", () => {
    const task = nasce({ negocio: { id: NEGOCIO, titulo: "Renovação 2027" } });
    const r = trocarCanalDaTarefaNasTabelas(state, THIAGO, task.id, {
      canal: outroCanal(),
      conversaId: OUTRA_CONVERSA,
      canalAnterior: { nome: "Comercial" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.mudou).toBe(true);
    expect(vinculosDoCrmDaTarefa(state, task)).toEqual({ contatoId: CONTATO, conversaId: OUTRA_CONVERSA, negocioId: NEGOCIO });
    expect(state.links.filter((l) => l.fromId === task.id && l.toType === "conversation")).toHaveLength(1);
    expect(state.activity[0]).toMatchObject({ action: "Canal da Tarefa alterado", objectId: task.id, before: "Comercial", after: "Suporte" });
  });

  it("para a mesma Conversa, mudou é falso e nada muda", () => {
    const task = nasce();
    const antes = pegada();
    const r = trocarCanalDaTarefaNasTabelas(state, THIAGO, task.id, { canal: outroCanal(), conversaId: CONVERSA });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.mudou).toBe(false);
    expect(pegada()).toEqual(antes);
  });

  it("recusa o Canal fora da Lista e o desconectado, com o campo canal", () => {
    const task = nasce();
    const fora = trocarCanalDaTarefaNasTabelas(state, THIAGO, task.id, {
      canal: outroCanal({ id: CANAL_FORA, nome: "Atendimento", tipo: "email" }),
      conversaId: OUTRA_CONVERSA,
    });
    expect(fora.ok).toBe(false);
    if (!fora.ok) expect(fora.field).toBe("canal");
    const desligado = trocarCanalDaTarefaNasTabelas(state, THIAGO, task.id, {
      canal: outroCanal({ conexao: "desconectada" }),
      conversaId: OUTRA_CONVERSA,
    });
    expect(desligado.ok).toBe(false);
    if (!desligado.ok) expect(desligado.error).toBe("O Canal Suporte está desconectado: escolha outro Canal ou reconecte-o.");
  });
});

describe("vincularNegocioATarefaNasTabelas", () => {
  it("liga o Negócio, troca por outro e desliga com null, cada passo com a sua Atividade", () => {
    const task = nasce();
    const liga = vincularNegocioATarefaNasTabelas(state, THIAGO, task.id, { id: NEGOCIO, titulo: "Renovação 2027" });
    expect(liga.ok).toBe(true);
    expect(vinculosDoCrmDaTarefa(state, task).negocioId).toBe(NEGOCIO);
    expect(state.activity[0]).toMatchObject({ action: "Negócio vinculado à Tarefa", after: "Renovação 2027" });

    const troca = vincularNegocioATarefaNasTabelas(state, THIAGO, task.id, { id: OUTRO_NEGOCIO, titulo: "Upsell" }, { titulo: "Renovação 2027" });
    expect(troca.ok).toBe(true);
    expect(vinculosDoCrmDaTarefa(state, task).negocioId).toBe(OUTRO_NEGOCIO);
    expect(state.links.filter((l) => l.fromId === task.id && l.toType === "deal")).toHaveLength(1);
    expect(state.activity[0]).toMatchObject({ before: "Renovação 2027", after: "Upsell" });

    const desliga = vincularNegocioATarefaNasTabelas(state, THIAGO, task.id, null, { titulo: "Upsell" });
    expect(desliga.ok).toBe(true);
    expect(vinculosDoCrmDaTarefa(state, task).negocioId).toBeUndefined();
    expect(state.activity[0]).toMatchObject({ action: "Negócio desvinculado da Tarefa", before: "Upsell" });
  });

  it("ligar o mesmo Negócio de novo e desligar sem Negócio não mexem em nada", () => {
    const task = nasce({ negocio: { id: NEGOCIO, titulo: "Renovação 2027" } });
    const antes = pegada();
    expect(vincularNegocioATarefaNasTabelas(state, THIAGO, task.id, { id: NEGOCIO, titulo: "Renovação 2027" }).ok).toBe(true);
    expect(pegada()).toEqual(antes);
    const outra = nasce();
    const antesDeDesligar = pegada();
    expect(vincularNegocioATarefaNasTabelas(state, THIAGO, outra.id, null).ok).toBe(true);
    expect(pegada()).toEqual(antesDeDesligar);
  });
});

describe("ligarNegocioNovoATarefaNasTabelas", () => {
  it("liga o Negócio recém-criado pela api", () => {
    const task = nasce();
    const r = ligarNegocioNovoATarefaNasTabelas(state, THIAGO, task.id, { id: NEGOCIO, titulo: "Renovação 2027" });
    expect(r.ok).toBe(true);
    expect(vinculosDoCrmDaTarefa(state, task).negocioId).toBe(NEGOCIO);
  });

  it("recusa quando a Tarefa já tem Vínculo de Negócio", () => {
    const task = nasce({ negocio: { id: NEGOCIO, titulo: "Renovação 2027" } });
    const antes = pegada();
    const r = ligarNegocioNovoATarefaNasTabelas(state, THIAGO, task.id, { id: OUTRO_NEGOCIO, titulo: "Upsell" });
    expect(r).toMatchObject({ ok: false, error: "Esta Tarefa já tem Negócio vinculado." });
    expect(pegada()).toEqual(antes);
  });
});

describe("as quatro recusam o que não é Tarefa conversacional com Contato", () => {
  const chamadas: ReadonlyArray<readonly [string, (taskId: string) => { ok: boolean; error?: string }]> = [
    [
      "trocarCanalDaTarefaNasTabelas",
      (id) => trocarCanalDaTarefaNasTabelas(state, THIAGO, id, { canal: referencias().canal, conversaId: CONVERSA }),
    ],
    ["vincularNegocioATarefaNasTabelas", (id) => vincularNegocioATarefaNasTabelas(state, THIAGO, id, { id: NEGOCIO, titulo: "N" })],
    ["ligarNegocioNovoATarefaNasTabelas", (id) => ligarNegocioNovoATarefaNasTabelas(state, THIAGO, id, { id: NEGOCIO, titulo: "N" })],
  ];

  it.each(chamadas)("%s: Tarefa inexistente", (_nome, chamar) => {
    const r = chamar("tsk_que_nao_existe");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Tarefa não encontrada.");
  });

  it.each(chamadas)("%s: Tarefa de Lista operacional", (_nome, chamar) => {
    const operacional = state.tasks.find((t) => t.listId === OPERACIONAL);
    if (!operacional) throw new Error("o seed precisa de uma Tarefa em lst_ativacao");
    const r = chamar(operacional.id);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Esta Lista é operacional: a Tarefa nasce pelo título, sem Contato.");
  });

  it.each(chamadas)("%s: Tarefa sem Vínculo de Contato", (_nome, chamar) => {
    const task = nasce();
    state.links = state.links.filter((l) => !(l.fromId === task.id && l.toType === "contact"));
    const r = chamar(task.id);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Esta Tarefa não tem Contato vinculado.");
  });

  it("criarTarefaConversacionalNasTabelas: Lista inexistente", () => {
    expect(criarTarefaConversacionalNasTabelas(state, THIAGO, { listId: "lst_que_nao_existe" }, referencias())).toMatchObject({
      ok: false,
      error: "Lista não encontrada.",
    });
  });
});

/**
 * Sessão 5 (5.1.4) — o que a Mensagem recebida faz com a Tarefa. As decisões (A, A, C) do plano valem aqui: Contato sem
 * Tarefa aberta na Lista do Canal ganha uma; com Tarefa aberta, nada; a Tarefa encerrada reabre se a Mensagem é da Conversa
 * dela e uma Conversa nova ganha Tarefa nova.
 */
describe("tarefaDaRecebida", () => {
  const entrada = (sobre: Partial<{ canalId: string; contatoId: string; conversaId: string }> = {}) => ({
    canalId: CANAL_A,
    contatoId: CONTATO,
    conversaId: CONVERSA,
    ...sobre,
  });

  /** Leva a Tarefa ao Status concluído da Lista do teste. */
  const concluirTarefa = (task: Task): void => {
    const alvo = state.lists.find((l) => l.id === LISTA)?.statusSet?.definitions.find((d) => d.category === "concluido");
    if (!alvo) throw new Error("a Lista de pós-venda precisa de um Status concluído");
    const r = changeTaskStatus(state, THIAGO, task.id, alvo.id);
    if (!r.ok) throw new Error(r.error);
  };

  it("Canal que nenhuma Lista conversacional atende: nada", () => {
    expect(tarefaDaRecebida(state, entrada({ canalId: CANAL_FORA }))).toEqual({ acao: "nada" });
  });

  it("Contato sem Tarefa na Lista do Canal: cria nessa Lista (5.1.1, A)", () => {
    expect(tarefaDaRecebida(state, entrada())).toEqual({ acao: "criar", listId: LISTA });
    expect(tarefaDaRecebida(state, entrada({ canalId: CANAL_B }))).toEqual({ acao: "criar", listId: LISTA });
  });

  it("Contato com Tarefa aberta na Lista: nada, seja qual for a Conversa (as seguintes não criam outra)", () => {
    nasce();
    expect(tarefaDaRecebida(state, entrada())).toEqual({ acao: "nada" });
    expect(tarefaDaRecebida(state, entrada({ conversaId: OUTRA_CONVERSA }))).toEqual({ acao: "nada" });
  });

  it("a Tarefa de OUTRO Contato não conta", () => {
    nasce();
    expect(tarefaDaRecebida(state, entrada({ contatoId: "77777777-7777-4777-8777-777777777777" }))).toEqual({ acao: "criar", listId: LISTA });
  });

  it("Tarefa concluída da mesma Conversa: reabre, no Status inicial da Lista (5.1.3, C)", () => {
    const task = nasce();
    const inicial = task.statusId;
    concluirTarefa(task);
    expect(task.statusId).not.toBe(inicial);
    expect(tarefaDaRecebida(state, entrada())).toEqual({ acao: "reabrir", listId: LISTA, taskId: task.id, statusId: inicial });
  });

  it("Tarefa concluída e Conversa nova: cria uma Tarefa nova, e a concluída fica como histórico (5.1.3, C)", () => {
    const task = nasce();
    concluirTarefa(task);
    expect(tarefaDaRecebida(state, entrada({ conversaId: OUTRA_CONVERSA }))).toEqual({ acao: "criar", listId: LISTA });
  });

  it("Tarefa na lixeira não conta como aberta nem como concluída: cria", () => {
    const task = nasce();
    task.lifecycle = "naLixeira";
    expect(tarefaDaRecebida(state, entrada())).toEqual({ acao: "criar", listId: LISTA });
  });

  it("Lista arquivada deixa de atender: nada", () => {
    const lista = state.lists.find((l) => l.id === LISTA);
    if (!lista) throw new Error("falta a Lista");
    lista.lifecycle = "arquivado";
    expect(tarefaDaRecebida(state, entrada())).toEqual({ acao: "nada" });
  });

  it("repetir a decisão depois de criar não cria de novo (o passo pode rodar duas vezes)", () => {
    const primeira = tarefaDaRecebida(state, entrada());
    expect(primeira.acao).toBe("criar");
    const aplicada = aplicarTarefaDaRecebida(state, primeira, {
      autorizadorId: THIAGO,
      ator: atorDaMensagemRecebida(CANAL_A),
      referencias: referencias(),
    });
    expect(aplicada.ok).toBe(true);
    expect(tarefaDaRecebida(state, entrada())).toEqual({ acao: "nada" });
  });
});

describe("aplicarTarefaDaRecebida", () => {
  const ator = atorDaMensagemRecebida(CANAL_A);
  const decisaoDeCriar = { acao: "criar", listId: LISTA } as const;

  it("a Tarefa nasce com o nome do Contato, os Vínculos e SEM responsável, assinada pelo Canal e não pelo Membro que autorizou", () => {
    const r = aplicarTarefaDaRecebida(state, decisaoDeCriar, { autorizadorId: THIAGO, ator, referencias: referencias() });
    if (!r.ok || !r.value.task) throw new Error(r.ok ? "sem Tarefa" : r.error);
    const task = r.value.task;
    expect(task.title).toBe("Marina Duarte");
    expect(task.assignees).toEqual([]);
    expect(task.createdBy).toEqual(ator);
    expect(state.tasks.find((t) => t.id === task.id)).toBe(task);
    expect(vinculosDoCrmDaTarefa(state, task)).toEqual({ contatoId: CONTATO, conversaId: CONVERSA });
    for (const vinculo of state.links.filter((l) => l.fromId === task.id)) expect(vinculo.createdBy).toEqual(ator);
    const atividade = state.activity.filter((a) => a.objectId === task.id);
    expect(atividade.length).toBeGreaterThan(0);
    for (const registro of atividade) expect(registro.actor).toEqual(ator);
    // Nada do que já existia foi reescrito.
    expect(state.activity.some((a) => a.actor.kind === "member" && a.actor.id === THIAGO)).toBe(true);
  });

  it("o atribuído da Conversa vira o responsável quando é Membro ativo que alcança a Lista; um Convidado, não", () => {
    const comResponsavel = aplicarTarefaDaRecebida(state, decisaoDeCriar, { autorizadorId: THIAGO, ator, responsavelId: "mem_maryane", referencias: referencias() });
    if (!comResponsavel.ok || !comResponsavel.value.task) throw new Error("não criou");
    expect(comResponsavel.value.task.assignees).toEqual([{ kind: "member", id: "mem_maryane" }]);

    const convidado = state.members.find((m) => state.roles.find((r) => r.id === m.roleId)?.base === "convidado" && m.state === "ativo");
    if (!convidado) return;
    const semConvidado = aplicarTarefaDaRecebida(
      state,
      decisaoDeCriar,
      { autorizadorId: THIAGO, ator, responsavelId: convidado.id, referencias: referencias({ conversaId: OUTRA_CONVERSA, contato: { id: "77777777-7777-4777-8777-777777777777", nome: "Outro" } }) },
    );
    if (!semConvidado.ok || !semConvidado.value.task) throw new Error("não criou");
    expect(semConvidado.value.task.assignees).toEqual([]);
  });

  it("uma recusa do domínio (Canal desconectado) não deixa Tarefa, Vínculo nem Atividade", () => {
    const antes = [state.tasks.length, state.links.length, state.activity.length];
    const r = aplicarTarefaDaRecebida(state, decisaoDeCriar, {
      autorizadorId: THIAGO,
      ator,
      referencias: referencias({ canal: { id: CANAL_A, nome: "Comercial", tipo: "whatsapp", conexao: "desconectada" } }),
    });
    expect(r.ok).toBe(false);
    expect([state.tasks.length, state.links.length, state.activity.length]).toEqual(antes);
  });

  it("reabrir volta a Tarefa ao Status inicial e assina a Atividade da mudança; `nada` não grava", () => {
    const criada = aplicarTarefaDaRecebida(state, decisaoDeCriar, { autorizadorId: THIAGO, ator, referencias: referencias() });
    if (!criada.ok || !criada.value.task) throw new Error("não criou");
    const task = criada.value.task;
    const inicial = task.statusId;
    const concluido = state.lists.find((l) => l.id === LISTA)?.statusSet?.definitions.find((d) => d.category === "concluido");
    if (!concluido) throw new Error("falta Status concluído");
    expect(changeTaskStatus(state, THIAGO, task.id, concluido.id).ok).toBe(true);
    const atividadeAntes = state.activity.length;

    const reaberta = aplicarTarefaDaRecebida(
      state,
      { acao: "reabrir", listId: LISTA, taskId: task.id, statusId: inicial },
      { autorizadorId: THIAGO, ator, referencias: referencias() },
    );
    expect(reaberta.ok).toBe(true);
    expect(state.tasks.find((t) => t.id === task.id)?.statusId).toBe(inicial);
    const nova = state.activity.slice(0, state.activity.length - atividadeAntes);
    expect(nova.length).toBeGreaterThan(0);
    for (const registro of nova) expect(registro.actor).toEqual(ator);

    const antes = state.activity.length;
    expect(aplicarTarefaDaRecebida(state, { acao: "nada" }, { autorizadorId: THIAGO, ator, referencias: referencias() }).ok).toBe(true);
    expect(state.activity).toHaveLength(antes);
  });
});

describe("autorizadorDaTarefaDaRecebida", () => {
  it("vale o preferido quando ele pode escrever na Lista", () => {
    expect(autorizadorDaTarefaDaRecebida(state, LISTA, "mem_maryane")).toBe("mem_maryane");
  });

  it("sem preferido, ou com um que não pode, cai no Proprietário e depois no Administrador", () => {
    const sem = autorizadorDaTarefaDaRecebida(state, LISTA);
    expect(sem).toBeDefined();
    if (!sem) return;
    expect(listWriteRefusal(state, sem, LISTA)).toBeUndefined();
    const base = state.roles.find((r) => r.id === state.members.find((m) => m.id === sem)?.roleId)?.base;
    expect(["proprietario", "administrador"]).toContain(base);
    expect(autorizadorDaTarefaDaRecebida(state, LISTA, "mem_que_nao_existe")).toBe(sem);
  });

  it("um Membro suspenso ou Convidado nunca autoriza; sem ninguém que possa, devolve undefined", () => {
    for (const m of state.members) m.state = "suspenso";
    expect(autorizadorDaTarefaDaRecebida(state, LISTA)).toBeUndefined();
  });
});

describe("fora do registro", () => {
  it("nenhuma das quatro está em OPERACOES: o navegador não as alcança por POST /operacoes/:nome", () => {
    const nomes = Object.keys(OPERACOES);
    expect(nomes.filter((n) => n.endsWith("NasTabelas"))).toEqual([]);
    for (const nome of [
      "criarTarefaConversacionalNasTabelas",
      "trocarCanalDaTarefaNasTabelas",
      "vincularNegocioATarefaNasTabelas",
      "ligarNegocioNovoATarefaNasTabelas",
    ]) {
      expect(nomes).not.toContain(nome);
    }
  });

  // Só no deploy da Fase 15 (14-17, T-14-42): as quatro operações antigas, que conferiam o CRM antigo
  // no estado do navegador, saíram do registro. Quem cria e altera a Tarefa conversacional são as rotas.
  it("as quatro operações antigas da Tarefa conversacional também não estão mais em OPERACOES", () => {
    const nomes = Object.keys(OPERACOES);
    for (const nome of ["criarTarefaConversacional", "trocarCanalDaTarefa", "vincularNegocioATarefa", "criarNegocioDaTarefa"]) {
      expect(nomes).not.toContain(nome);
    }
    // O que a Lista conversacional ainda usa do registro segue lá.
    expect(nomes).toContain("alterarModeloDaLista");
    expect(nomes).toContain("definirCanaisDaLista");
  });
});
