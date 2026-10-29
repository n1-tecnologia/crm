/**
 * TAR-05 no domínio (11-04, D-07, D-08, D-09): a menção na descrição avisa a
 * pessoa em Notificações, derivada do dado. `pendingMentions` devolve uma lista
 * única com as menções de Comentário e as da descrição.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { effectiveListConfig, memberSeesTask, newestFirst, notificacoesDoMembro, pendingMentions } from "../derive";
import type { MencaoPendente } from "../derive";
import { visibilidadePara } from "../derive-visibilidade";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { CP } from "./financeiro-base";
import { addTaskComment, changeTaskStatus, restoreTask, trashTask, updateTask, watchTask } from "./tasks";

const THIAGO = "mem_thiago";
const JULIA = "mem_julia";
const TAREFA = "tsk_seed_1";
const MENCAO_JULIA = { type: "member", id: JULIA } as const;
const MENCAO_THIAGO = { type: "member", id: THIAGO } as const;

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const tarefa = () => state.tasks.find((t) => t.id === TAREFA)!;
const daDescricao = (lista: MencaoPendente[], taskId = TAREFA) =>
  lista.filter((m): m is Extract<MencaoPendente, { tipo: "descricao" }> => m.tipo === "descricao" && m.task.id === taskId);

describe("menção na descrição — o caso positivo (11-04, TAR-05)", () => {
  it("a Tarefa que a Júlia vê, com @Júlia Prado na descrição, entra em pendingMentions e no total", () => {
    expect(memberSeesTask(state, JULIA, TAREFA)).toBe(true);
    const antes = notificacoesDoMembro(state, JULIA, new Date());

    const r = updateTask(state, THIAGO, TAREFA, { description: "Pedir a @Júlia Prado a revisão", descriptionMentions: [MENCAO_JULIA] });
    expect(r.ok).toBe(true);

    const entradas = daDescricao(pendingMentions(state, JULIA));
    expect(entradas).toHaveLength(1);
    expect(entradas[0]?.trecho).toContain("@Júlia Prado");

    const depois = notificacoesDoMembro(state, JULIA, new Date());
    expect(daDescricao(depois.mencoes)).toHaveLength(1);
    expect(depois.total).toBe(antes.total + 1);
  });
});

const gravarMencao = (descricao = "Pedir a @Júlia Prado a revisão") => {
  const r = updateTask(state, THIAGO, TAREFA, { description: descricao, descriptionMentions: [MENCAO_JULIA] });
  expect(r.ok).toBe(true);
};
const julia = () => daDescricao(pendingMentions(state, JULIA));
const statusTerminal = () => {
  const def = effectiveListConfig(state, tarefa().listId)?.statusSet.definitions.find((d) => d.category === "concluido" || d.category === "fechado");
  if (!def) throw new Error("a Lista da Tarefa precisa de um Status concluído ou fechado");
  return def;
};

/** Leva a Tarefa a um Status concluído/fechado; a Lista exige o checklist fechado antes, então o fecha. */
const concluir = () => {
  for (const item of tarefa().checklists.flatMap((c) => c.items)) item.done = true;
  expect(changeTaskStatus(state, THIAGO, TAREFA, statusTerminal().id).ok).toBe(true);
};

describe("a menção da descrição some por conta própria (D-08)", () => {
  it("Tarefa concluída ou fechada: o aviso some; reaberta, volta", () => {
    gravarMencao();
    const aberto = tarefa().statusId;
    expect(julia()).toHaveLength(1);

    concluir();
    expect(julia()).toHaveLength(0);

    expect(changeTaskStatus(state, THIAGO, TAREFA, aberto).ok).toBe(true);
    expect(julia()).toHaveLength(1);
  });

  it("Tarefa na lixeira: o aviso some; restaurada, volta", () => {
    gravarMencao();

    expect(trashTask(state, THIAGO, TAREFA).ok).toBe(true);
    expect(julia()).toHaveLength(0);

    expect(restoreTask(state, THIAGO, TAREFA).ok).toBe(true);
    expect(julia()).toHaveLength(1);
  });

  it("Tarefa arquivada: o aviso some", () => {
    gravarMencao();
    tarefa().lifecycle = "arquivado";

    expect(julia()).toHaveLength(0);
  });

  it("updateTask tirando @Júlia Prado do texto: o aviso some e a chave sai da Tarefa", () => {
    gravarMencao();

    expect(updateTask(state, THIAGO, TAREFA, { description: "Pedir a revisão" }).ok).toBe(true);

    expect(julia()).toHaveLength(0);
    expect("descriptionMentions" in tarefa()).toBe(false);
  });

  it("descrição trocada por atribuição direta (caminho do rollback): o aviso some mesmo com a lista intacta", () => {
    gravarMencao();
    tarefa().description = "texto sem o nome";

    expect(tarefa().descriptionMentions).toEqual([MENCAO_JULIA]);
    expect(julia()).toHaveLength(0);
  });
});

describe("a menção da descrição nunca vaza nem se forja (D-09, RN-TAR-14)", () => {
  it("id na lista sem o @Nome no texto (menção forjada) não avisa ninguém", () => {
    tarefa().description = "uma descrição qualquer";
    tarefa().descriptionMentions = [MENCAO_JULIA];

    expect(julia()).toHaveLength(0);
  });

  it("Membro mencionado que não vê a Tarefa não recebe o aviso", () => {
    const semAcesso = state.members.find((x) => x.state === "ativo" && visibilidadePara(state, x.id).ocultos.has(CP.spaceId));
    if (!semAcesso) throw new Error("o seed precisa de um Membro ativo que não enxergue Gestão");
    const gestao = state.tasks.find((t) => t.listId === CP.listId && t.lifecycle === "ativo");
    if (!gestao) throw new Error("o seed precisa de uma Tarefa na Lista de Gestão");
    expect(memberSeesTask(state, semAcesso.id, gestao.id)).toBe(false);
    gestao.description = `Cuidar disto @${semAcesso.displayName}`;
    gestao.descriptionMentions = [{ type: "member", id: semAcesso.id }];

    expect(daDescricao(pendingMentions(state, semAcesso.id), gestao.id)).toHaveLength(0);
    expect(notificacoesDoMembro(state, semAcesso.id, new Date()).mencoes.some((m) => m.task.id === gestao.id)).toBe(false);
  });

  it("quem se menciona na própria descrição também recebe o aviso (a descrição não tem autor)", () => {
    const r = updateTask(state, THIAGO, TAREFA, { description: "Lembrete para @Thiago Nascimento", descriptionMentions: [MENCAO_THIAGO] });
    expect(r.ok).toBe(true);

    const entradas = daDescricao(pendingMentions(state, THIAGO));
    expect(entradas).toHaveLength(1);
    expect(entradas[0]?.trecho).toContain("@Thiago Nascimento");
  });

  it("o nome escrito várias vezes avisa uma vez só por Tarefa", () => {
    gravarMencao("@Júlia Prado olha isto, @Júlia Prado, por favor");

    expect(julia()).toHaveLength(1);
  });

  it("o aviso não guarda estado novo: nada além da Tarefa muda para ele entrar ou sair", () => {
    gravarMencao();
    const antes = JSON.stringify({ ...state, activity: undefined });

    pendingMentions(state, JULIA);
    notificacoesDoMembro(state, JULIA, new Date());

    expect(JSON.stringify({ ...state, activity: undefined })).toBe(antes);
    expect(Object.keys(tarefa()).filter((k) => /visto|dispens|lida/i.test(k))).toEqual([]);
  });
});

describe("Comentário continua como era", () => {
  it("o Comentário com menção numa Tarefa de categoria terminal continua avisando", () => {
    const c = addTaskComment(state, THIAGO, TAREFA, { content: "Júlia, confirma?", mentions: [MENCAO_JULIA] });
    expect(c.ok).toBe(true);
    concluir();

    expect(pendingMentions(state, JULIA).some((m) => m.tipo === "comentario" && m.task.id === TAREFA)).toBe(true);
  });
});

describe("ordem e contagem da lista única", () => {
  it("vem do instante mais novo para o mais velho: Comentário depois da edição vem antes; antes, vem depois", () => {
    gravarMencao();
    const edicao = state.activity.find((a) => a.objectId === TAREFA && a.action === "Descrição alterada");
    expect(edicao).toBeDefined();
    (edicao as { at: string }).at = "2026-03-10T12:00:00.000Z";

    const velho = addTaskComment(state, THIAGO, TAREFA, { content: "comentário velho", mentions: [MENCAO_JULIA] });
    const novo = addTaskComment(state, THIAGO, TAREFA, { content: "comentário novo", mentions: [MENCAO_JULIA] });
    if (!velho.ok || !novo.ok) throw new Error("os Comentários deviam ser criados");
    (velho.value as { createdAt: string }).createdAt = "2026-03-09T12:00:00.000Z";
    (novo.value as { createdAt: string }).createdAt = "2026-03-11T12:00:00.000Z";

    const doTarefa = pendingMentions(state, JULIA).filter((m) => m.task.id === TAREFA);
    expect(doTarefa.map((m) => (m.tipo === "comentario" ? m.comment.content : "descricao"))).toEqual(["comentário novo", "descricao", "comentário velho"]);
  });

  it("o instante da descrição vem da edição mais recente, em qualquer ordem do array de Registros", () => {
    gravarMencao("Pedir a @Júlia Prado a revisão");
    gravarMencao("Pedir de novo a @Júlia Prado a revisão");
    const edicoes = state.activity.filter((a) => a.objectId === TAREFA && a.action === "Descrição alterada");
    expect(edicoes.length).toBeGreaterThanOrEqual(2);
    // As duas edições em instantes distintos; a mais nova é a que decide.
    const [maisNova, maisVelha] = newestFirst(edicoes) as Array<{ at: string }>;
    maisNova!.at = "2026-03-10T12:00:00.000Z";
    maisVelha!.at = "2026-03-01T12:00:00.000Z";

    const comentario = addTaskComment(state, THIAGO, TAREFA, { content: "entre as duas edições", mentions: [MENCAO_JULIA] });
    if (!comentario.ok) throw new Error("o Comentário devia ser criado");
    (comentario.value as { createdAt: string }).createdAt = "2026-03-05T12:00:00.000Z";

    const ordem = () =>
      pendingMentions(state, JULIA)
        .filter((m) => m.task.id === TAREFA)
        .map((m) => (m.tipo === "comentario" ? "comentario" : "descricao"));

    // Mais nova (10/03) vence o Comentário (05/03), seja qual for a posição no array.
    expect(ordem()).toEqual(["descricao", "comentario"]);
    state.activity = [...state.activity].reverse();
    expect(ordem()).toEqual(["descricao", "comentario"]);
  });

  it("sem Registro de edição, o instante da descrição é a criação da Tarefa", () => {
    tarefa().description = "Rever com @Júlia Prado";
    tarefa().descriptionMentions = [MENCAO_JULIA];
    state.activity = state.activity.filter((a) => !(a.objectId === TAREFA && a.action === "Descrição alterada"));

    expect(julia()).toHaveLength(1);
  });

  it("total soma as listas contando a descrição uma vez; observadas só exclui id de Comentário", () => {
    expect(watchTask(state, JULIA, TAREFA, JULIA, true).ok).toBe(true);
    const mencionado = addTaskComment(state, THIAGO, TAREFA, { content: "Júlia, vê isto", mentions: [MENCAO_JULIA] });
    const comum = addTaskComment(state, THIAGO, TAREFA, { content: "um comentário sem menção" });
    if (!mencionado.ok || !comum.ok) throw new Error("os Comentários deviam ser criados");
    gravarMencao();

    const n = notificacoesDoMembro(state, JULIA, new Date());

    expect(daDescricao(n.mencoes)).toHaveLength(1);
    expect(n.mencoes.some((m) => m.tipo === "comentario" && m.comment.id === mencionado.value.id)).toBe(true);
    expect(n.observadas.some((o) => o.comment.id === mencionado.value.id)).toBe(false);
    expect(n.observadas.some((o) => o.comment.id === comum.value.id)).toBe(true);
    expect(n.total).toBe(n.aprovacoes.length + n.mencoes.length + n.observadas.length + n.conversas.length + n.vencidas.length + n.bloqueadas.length + n.execucoesFalhas.length);
  });
});
