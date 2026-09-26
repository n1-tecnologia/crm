/**
 * O módulo de Automações (19): o editor, a validação pura e o ciclo de vida,
 * até o motor de Lista disparar de verdade uma Automação nascida no editor.
 * Cada teste afirma o RESULTADO, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../../seed";
import type { DataState } from "../../state";
import type { AutomationExecution } from "../../types";
import { inoperante } from "../../derive-ia";
import { publishAutomation, recusaDeRestaurarAutomacao, restoreAutomation } from "../ai";
import { createTask } from "../tasks";
import {
  adicionarAcao,
  adicionarCondicao,
  arquivarAutomacao,
  criarAutomacao,
  criarRascunhoDaAutomacao,
  definirGatilho,
  descartarRascunhoDaAutomacao,
  duplicarAutomacao,
  editarAcao,
  editarAutomacao,
  editarCondicao,
  enviarAutomacaoALixeira,
  moverAcao,
  pausarAutomacao,
  removerAcao,
  retomarAutomacao,
} from "./automacoes-editor";
import { validarAutomacao } from "./automacoes-validacao";
import { arquivarHabilidade, concederHabilidade, editarRascunhoDaHabilidade, publicarVersaoDaHabilidade, restaurarHabilidade } from "./habilidades";

const THIAGO = "mem_thiago";
const RAFAEL = "mem_rafael";
const JULIA = "mem_julia";
const BEATRIZ = "mem_beatriz";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const registro = <T extends { readonly id: string }>(lista: readonly T[], id: string): T => {
  const item = lista.find((x) => x.id === id);
  if (!item) throw new Error(`seed sem ${id}`);
  return item;
};

const valor = <T>(r: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

const erro = (r: { readonly ok: boolean; readonly error?: string; readonly field?: string }): { readonly error: string; readonly field?: string } => {
  if (r.ok) throw new Error("deveria recusar");
  return { error: r.error ?? "", ...(r.field !== undefined ? { field: r.field } : {}) };
};

/** Uma Automação de Lista, em rascunho, com Gatilho "Tarefa criada" — o ponto de partida do editor. */
const novaDeLista = (me: string, name = "Comentar ao criar", listId = "lst_revisoes") =>
  valor(criarAutomacao(state, me, { name, scopeType: "list", scopeId: listId, trigger: { kind: "evento", eventType: "tarefaCriada" } }));

describe("28 — criar Automação", () => {
  it("nasce em rascunho, com a Versão 1 em rascunho, o Membro como Proprietário e o escopo fixado", () => {
    const antes = state.automations.length;
    const r = criarAutomacao(state, JULIA, { name: "  Avisar o time  ", description: "Comenta na Tarefa nova.", scopeType: "list", scopeId: "lst_revisoes" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.id).toBe(r.value.id);
    expect(state.automations).toHaveLength(antes + 1);
    expect(r.value.name).toBe("Avisar o time");
    expect(r.value.lifecycle).toBe("rascunho");
    expect(r.value.ownerMemberId).toBe(JULIA);
    expect(r.value.createdBy).toEqual({ kind: "member", id: JULIA });
    expect(r.value.reactsToAutomationEvents).toBe(false);
    expect(r.value.versions).toHaveLength(1);
    expect(r.value.versions[0]?.state).toBe("rascunho");
    expect(r.value.versions[0]?.trigger).toBeUndefined();
    expect(r.value.versions[0]?.actions).toEqual([]);
    expect(r.value.versions[0]?.errorPolicy).toEqual({ onActionFailure: "interromper", retries: 0 });
    const atividade = state.activity.find((a) => a.objectId === r.value.id && a.action === "Automação criada");
    expect(atividade?.detail).toBe("Versão 1 em rascunho · escopo Lista");
  });

  it("recusa escopo inexistente, nome repetido no escopo (sem caixa nem espaços) e Evento incompatível — e o Convidado", () => {
    expect(erro(criarAutomacao(state, RAFAEL, { name: "X", scopeType: "list", scopeId: "lst_inexistente" })).error).toBe("O escopo indicado não existe.");
    expect(erro(criarAutomacao(state, RAFAEL, { name: "X", scopeType: "list", scopeId: "grp_turma_01" })).error).toBe("O escopo indicado não existe.");

    // "Boas-vindas na Fila Comercial" já existe na Fila Comercial; noutro escopo o nome é livre.
    const repetido = criarAutomacao(state, RAFAEL, { name: "  boas-vindas NA fila comercial ", scopeType: "queue", scopeId: "fila_com" });
    expect(erro(repetido)).toEqual({ error: "Já existe uma Automação chamada “boas-vindas NA fila comercial” neste escopo (RN-AUT-03).", field: "nome" });
    expect(criarAutomacao(state, RAFAEL, { name: "Boas-vindas na Fila Comercial", scopeType: "workspace", scopeId: state.workspace.id }).ok).toBe(true);

    const incompativel = criarAutomacao(state, RAFAEL, { name: "Y", scopeType: "list", scopeId: "lst_revisoes", trigger: { kind: "evento", eventType: "contatoEntrouNoGrupo" } });
    expect(erro(incompativel)).toEqual({ error: "O Evento “contatoEntrouNoGrupo” não ocorre no escopo desta Automação.", field: "gatilho" });
    const inventado = criarAutomacao(state, RAFAEL, { name: "Y", scopeType: "list", scopeId: "lst_revisoes", trigger: { kind: "evento", eventType: "eventoInventado" } });
    expect(erro(inventado).error).toBe("O Evento “eventoInventado” não existe no catálogo.");

    expect(erro(criarAutomacao(state, BEATRIZ, { name: "Z", scopeType: "list", scopeId: "lst_revisoes" })).error).toBe("O Papel Convidado não cria Automação.");
    expect(erro(criarAutomacao(state, RAFAEL, { name: "   ", scopeType: "list", scopeId: "lst_revisoes" })).error).toBe("Dê um nome à Automação.");
  });

  it("renomear respeita RN-AUT-03 no escopo e não cria Versão; um Membro só edita a própria", () => {
    const minha = novaDeLista(JULIA, "Minha");
    novaDeLista(JULIA, "Outra");
    expect(erro(editarAutomacao(state, JULIA, minha.id, { name: "outra " })).error).toContain("RN-AUT-03");
    expect(editarAutomacao(state, JULIA, minha.id, { name: "Minha renomeada", reactsToAutomationEvents: true }).ok).toBe(true);
    expect(minha.name).toBe("Minha renomeada");
    expect(minha.reactsToAutomationEvents).toBe(true);
    expect(minha.versions).toHaveLength(1);
    // Marcos é Membro e não é Proprietário nem Criador; Rafael administra o Espaço.
    expect(erro(editarAutomacao(state, "mem_marcos", minha.id, { name: "De outro" })).error).toBe("Editar o rascunho exige administrar esta Automação.");
    expect(editarAutomacao(state, RAFAEL, minha.id, { description: "Descrita pelo Administrador." }).ok).toBe(true);
    expect(minha.description).toBe("Descrita pelo Administrador.");
  });
});

describe("29 — validarAutomacao e a recusa de publicar", () => {
  it("lista Gatilho ausente, Ação ausente e Ferramenta fora do Catálogo, cada um no seu bloco", () => {
    const a = valor(criarAutomacao(state, RAFAEL, { name: "Vazia", scopeType: "list", scopeId: "lst_revisoes" }));
    const v1 = a.versions[0];
    if (!v1) throw new Error("sem v1");
    expect(validarAutomacao(state, a, v1).map((p) => [p.bloco, p.mensagem])).toEqual([
      ["gatilho", "Escolha um Gatilho para publicar."],
      ["acoes", "Adicione ao menos uma Ação."],
    ]);

    valor(definirGatilho(state, RAFAEL, a.id, { kind: "evento", eventType: "tarefaCriada" }));
    valor(adicionarAcao(state, RAFAEL, a.id, { kind: "escrita", toolId: "ferramenta_inexistente", params: "{}" }));
    const problemas = validarAutomacao(state, a, v1);
    expect(problemas).toEqual([{ regra: "RN-AUT-21", bloco: "acoes", indice: 0, mensagem: "A Ferramenta “ferramenta_inexistente” não existe no Catálogo." }]);

    // O Gatilho por Evento sem Evento, e a Condição híbrida sem Agente, também aparecem.
    valor(definirGatilho(state, RAFAEL, a.id, { kind: "evento" }));
    v1.conditions.push({ kind: "hibrida", expression: "classificar" });
    expect(validarAutomacao(state, a, v1).map((p) => p.mensagem)).toEqual([
      "O Gatilho por Evento precisa de um Evento.",
      "Uma Condição híbrida indica o Agente que classifica (RN-AUT-06).",
      "A Ferramenta “ferramenta_inexistente” não existe no Catálogo.",
    ]);
  });

  it("publishAutomation devolve o primeiro problema com o bloco como field, sem efeito", () => {
    const a = valor(criarAutomacao(state, RAFAEL, { name: "Vazia", scopeType: "list", scopeId: "lst_revisoes" }));
    expect(erro(publishAutomation(state, RAFAEL, a.id))).toEqual({ error: "Escolha um Gatilho para publicar.", field: "gatilho" });
    valor(definirGatilho(state, RAFAEL, a.id, { kind: "evento", eventType: "tarefaCriada" }));
    expect(erro(publishAutomation(state, RAFAEL, a.id))).toEqual({ error: "Adicione ao menos uma Ação.", field: "acoes" });
    valor(adicionarAcao(state, RAFAEL, a.id, { kind: "escrita", toolId: "ferramenta_inexistente", params: "{}" }));
    expect(erro(publishAutomation(state, RAFAEL, a.id))).toEqual({ error: "A Ferramenta “ferramenta_inexistente” não existe no Catálogo.", field: "acoes" });
    expect(a.lifecycle).toBe("rascunho");
    expect(a.versions[0]?.state).toBe("rascunho");
  });

  it("a Condição de Valor de Campo aponta uma Definição que existe (RN-AUT-21)", () => {
    const a = novaDeLista(RAFAEL);
    valor(adicionarAcao(state, RAFAEL, a.id, { kind: "escrita", toolId: "tarefa.comentar", params: JSON.stringify({ template: "Oi" }) }));
    valor(adicionarCondicao(state, RAFAEL, a.id, { kind: "valorDeCampo", expression: JSON.stringify({ definitionId: "fd_inexistente", empty: true }) }));
    expect(erro(publishAutomation(state, RAFAEL, a.id))).toEqual({ error: "A Definição de Campo “fd_inexistente” não existe (RN-AUT-21).", field: "condicoes" });
    valor(editarCondicao(state, RAFAEL, a.id, 0, { expression: JSON.stringify({ definitionId: "fd_turma", empty: true }) }));
    expect(publishAutomation(state, RAFAEL, a.id).ok).toBe(true);
  });
});

describe("29b — a Disponibilidade da Concessão entra na validação e no inoperante (RN-AUT-07, RN-AUT-21)", () => {
  it("publicar recusa Habilidade concedida mas indisponível; publicada a Habilidade, publica; arquivada depois, a Automação vigente exibe-se inoperante com motivo", () => {
    // skl_agenda é ativa, mas só tem a v1 em rascunho: a Concessão nasce indisponível ("sem Versão publicada").
    valor(concederHabilidade(state, RAFAEL, { agentId: "agt_sdr", skillId: "skl_agenda" }));
    const a = novaDeLista(RAFAEL, "Plano ao criar");
    valor(adicionarAcao(state, RAFAEL, a.id, { kind: "controle", controlKind: "invocarAgente", params: "sugerir plano", agentId: "agt_sdr", skillId: "skl_agenda" }));
    const v1 = a.versions[0];
    if (!v1) throw new Error("sem v1");
    const indisponivel = "A Habilidade “Sugerir plano de estudo” está indisponível para o Agente “Qualificador SDR”: sem Versão publicada.";
    expect(validarAutomacao(state, a, v1)).toEqual([{ regra: "RN-AUT-07", bloco: "acoes", indice: 0, mensagem: indisponivel }]);
    expect(erro(publishAutomation(state, RAFAEL, a.id))).toEqual({ error: indisponivel, field: "acoes" });
    expect(a.lifecycle).toBe("rascunho");
    expect(v1.state).toBe("rascunho");

    // A mesma pergunta na Condição híbrida, no bloco dela.
    valor(adicionarCondicao(state, RAFAEL, a.id, { kind: "hibrida", expression: "vale um plano?", agentId: "agt_sdr", skillId: "skl_agenda" }));
    expect(validarAutomacao(state, a, v1)).toEqual([
      { regra: "RN-AUT-07", bloco: "condicoes", indice: 0, mensagem: indisponivel },
      { regra: "RN-AUT-07", bloco: "acoes", indice: 0, mensagem: indisponivel },
    ]);
    // Uma Habilidade não concedida continua com a frase de sempre.
    valor(editarCondicao(state, RAFAEL, a.id, 0, { skillId: "skl_proposta" }));
    expect(validarAutomacao(state, a, v1)[0]?.mensagem).toBe("A Habilidade “Redigir proposta comercial” não está concedida ao Agente “Qualificador SDR”.");
    valor(editarCondicao(state, RAFAEL, a.id, 0, { skillId: "skl_agenda" }));

    // Publicada a v1 da Habilidade (o seed a deixa sem Instruções de propósito), a Concessão fica disponível: a Automação publica e não é inoperante.
    valor(editarRascunhoDaHabilidade(state, RAFAEL, "skl_agenda", { instructions: "Monte o plano semanal a partir da turma e do tempo disponível." }));
    valor(publicarVersaoDaHabilidade(state, RAFAEL, "skl_agenda"));
    expect(validarAutomacao(state, a, v1)).toEqual([]);
    valor(publishAutomation(state, RAFAEL, a.id));
    expect(a.lifecycle).toBe("ativo");
    expect(inoperante(state, a)).toBeUndefined();

    // Arquivar a Habilidade torna a Concessão indisponível: a vigente exibe-se inoperante com o motivo, sem ato (RN-AUT-21); restaurada, cessa.
    valor(arquivarHabilidade(state, RAFAEL, "skl_agenda"));
    expect(inoperante(state, a)).toBe("referência inválida: Habilidade “Sugerir plano de estudo” indisponível para o Agente “Qualificador SDR” (Habilidade arquivada)");
    valor(restaurarHabilidade(state, RAFAEL, "skl_agenda"));
    expect(inoperante(state, a)).toBeUndefined();
  });

  it("nenhuma Automação publicada do seed nasce inoperante nem com problema por Habilidade indisponível", () => {
    for (const a of state.automations) {
      if (a.lifecycle !== "ativo") continue;
      expect(inoperante(state, a), a.id).toBeUndefined();
      const vigente = a.versions.find((v) => v.state === "publicada");
      if (vigente) expect(validarAutomacao(state, a, vigente).map((p) => p.mensagem), a.id).toEqual([]);
    }
  });
});

describe("30 — escopo Grupo", () => {
  it("uma Automação de Grupo com “Contato entrou no Grupo” publica e fica ativa", () => {
    const a = valor(criarAutomacao(state, RAFAEL, { name: "Etiquetar quem entra", scopeType: "grupo", scopeId: "grp_turma_01", trigger: { kind: "evento", eventType: "contatoEntrouNoGrupo" } }));
    const tag = state.tags[0];
    if (!tag) throw new Error("seed sem Tag");
    valor(adicionarAcao(state, RAFAEL, a.id, { kind: "escrita", toolId: "contato.adicionarTag", params: JSON.stringify({ tagId: tag.id }) }));
    const r = publishAutomation(state, RAFAEL, a.id);
    expect(r.ok).toBe(true);
    expect(a.lifecycle).toBe("ativo");
    expect(a.versions[0]?.state).toBe("publicada");
    expect(a.versions[0]?.publishedBy).toBe(RAFAEL);
    // No editor, trocar o Gatilho para um Evento de Tarefa é recusado no ato.
    valor(criarRascunhoDaAutomacao(state, RAFAEL, a.id));
    expect(erro(definirGatilho(state, RAFAEL, a.id, { kind: "evento", eventType: "tarefaCriada" }))).toEqual({
      error: "O Evento “tarefaCriada” não ocorre no escopo desta Automação.",
      field: "gatilho",
    });
  });
});

describe("31 — editar o rascunho", () => {
  it("editar Ação ou Condição exige rascunho; o rascunho novo copia a vigente e é um só", () => {
    const a = registro(state.automations, "aut_boasvindas");
    const semRascunho = "Não há rascunho: crie um a partir da Versão vigente.";
    expect(erro(adicionarAcao(state, JULIA, a.id, { kind: "controle", controlKind: "notificar", params: "{}" })).error).toBe(semRascunho);
    expect(erro(adicionarCondicao(state, JULIA, a.id, { kind: "atributo", expression: "{}" })).error).toBe(semRascunho);

    const v2 = valor(criarRascunhoDaAutomacao(state, JULIA, a.id));
    expect(v2.number).toBe(2);
    expect(v2.state).toBe("rascunho");
    expect(v2.trigger).toEqual({ kind: "evento", eventType: "conversaCriada" });
    expect(v2.actions).toEqual(a.versions[0]?.actions);
    expect(v2.actions).not.toBe(a.versions[0]?.actions);
    expect(erro(criarRascunhoDaAutomacao(state, JULIA, a.id)).error).toBe("A Automação já tem um rascunho (INV-AUT-02).");

    // O Convidado não edita; um Membro que não é Proprietário nem Criador tampouco.
    expect(erro(adicionarAcao(state, BEATRIZ, a.id, { kind: "controle", controlKind: "notificar", params: "{}" })).error).toBe("Editar o rascunho exige administrar esta Automação.");
    expect(erro(adicionarAcao(state, "mem_marcos", a.id, { kind: "controle", controlKind: "notificar", params: "{}" })).error).toBe("Editar o rascunho exige administrar esta Automação.");

    // Descartar devolve a Automação à vigente sozinha.
    valor(descartarRascunhoDaAutomacao(state, JULIA, a.id));
    expect(a.versions).toHaveLength(1);
    expect(a.versions[0]?.state).toBe("publicada");
  });

  it("Ações são renumeradas 0..n-1 ao remover e trocam de lugar ao mover; a escrita sem Ferramenta e a ramificação são recusadas", () => {
    const a = novaDeLista(RAFAEL);
    valor(adicionarAcao(state, RAFAEL, a.id, { kind: "escrita", toolId: "tarefa.comentar", params: JSON.stringify({ template: "um" }) }));
    valor(adicionarAcao(state, RAFAEL, a.id, { kind: "controle", controlKind: "notificar", params: "{}" }));
    const v1 = valor(adicionarAcao(state, RAFAEL, a.id, { kind: "escrita", toolId: "tarefa.alterarStatus", params: JSON.stringify({ statusName: "Feito" }) }));
    expect(v1.actions.map((x) => x.order)).toEqual([0, 1, 2]);

    expect(erro(adicionarAcao(state, RAFAEL, a.id, { kind: "escrita", params: "{}" }))).toEqual({ error: "Uma Ação de escrita é sempre uma Ferramenta do Catálogo (INV-AUT-05).", field: "acoes" });
    expect(erro(adicionarAcao(state, RAFAEL, a.id, { kind: "controle", controlKind: "ramificar", params: "{}" })).error).toBe("Ramificação não entra neste protótipo.");

    valor(removerAcao(state, RAFAEL, a.id, 1));
    expect(v1.actions.map((x) => [x.order, x.toolId])).toEqual([
      [0, "tarefa.comentar"],
      [1, "tarefa.alterarStatus"],
    ]);

    valor(moverAcao(state, RAFAEL, a.id, 1, "subir"));
    expect(v1.actions.map((x) => [x.order, x.toolId])).toEqual([
      [0, "tarefa.alterarStatus"],
      [1, "tarefa.comentar"],
    ]);
    // No topo, subir é um não-ato.
    valor(moverAcao(state, RAFAEL, a.id, 0, "subir"));
    expect(v1.actions.map((x) => x.toolId)).toEqual(["tarefa.alterarStatus", "tarefa.comentar"]);

    valor(editarAcao(state, RAFAEL, a.id, 1, { params: JSON.stringify({ template: "dois" }) }));
    expect(v1.actions[1]?.params).toBe(JSON.stringify({ template: "dois" }));
    expect(v1.actions[1]?.order).toBe(1);
    expect(erro(editarAcao(state, RAFAEL, a.id, 7, { params: "{}" })).error).toBe("Ação não encontrada.");
  });

  it("a Condição híbrida indica o Agente; ao virar atributo, o Agente sai", () => {
    const a = novaDeLista(RAFAEL);
    expect(erro(adicionarCondicao(state, RAFAEL, a.id, { kind: "hibrida", expression: "classificar" }))).toEqual({
      error: "Uma Condição híbrida indica o Agente que classifica (RN-AUT-06).",
      field: "condicoes",
    });
    const v1 = valor(adicionarCondicao(state, RAFAEL, a.id, { kind: "hibrida", expression: "classificar", agentId: "agt_sdr", skillId: "skl_resumir" }));
    expect(v1.conditions[0]).toEqual({ kind: "hibrida", expression: "classificar", agentId: "agt_sdr", skillId: "skl_resumir" });
    valor(editarCondicao(state, RAFAEL, a.id, 0, { kind: "atributo", expression: JSON.stringify({ status: "A fazer" }) }));
    expect(v1.conditions[0]).toEqual({ kind: "atributo", expression: JSON.stringify({ status: "A fazer" }) });
  });
});

describe("32 — ciclo completo com o motor de Lista", () => {
  it("criar em Lista → Tarefa criada → Ação tarefa.comentar → publicar → createTask gera Execução concluída com Comentário", () => {
    const a = novaDeLista(RAFAEL, "Avisar que chegou");
    valor(adicionarAcao(state, RAFAEL, a.id, { kind: "escrita", toolId: "tarefa.comentar", params: JSON.stringify({ template: "A Tarefa “{{titulo}}” acaba de nascer." }) }));
    expect(validarAutomacao(state, a, a.versions[0] as NonNullable<(typeof a.versions)[0]>)).toEqual([]);
    const publicada = valor(publishAutomation(state, RAFAEL, a.id));
    expect(publicada.state).toBe("publicada");
    expect(a.lifecycle).toBe("ativo");

    const antes = state.automationExecutions.length;
    const task = valor(createTask(state, THIAGO, { listId: "lst_revisoes", title: "Conferir a turma nova" }));

    const execucoes = state.automationExecutions.filter((e) => e.automationId === a.id);
    expect(execucoes).toHaveLength(1);
    expect(state.automationExecutions).toHaveLength(antes + 1);
    const [execucao] = execucoes;
    expect(execucao?.state).toBe("concluida");
    expect(execucao?.automationVersion).toBe(1);
    expect(execucao?.objectId).toBe(task.id);
    expect(execucao?.invokedBy).toEqual({ kind: "automation", id: a.id });
    expect(execucao?.delegate).toEqual({ kind: "member", id: RAFAEL });
    expect(execucao?.steps.map((s) => [s.toolId, s.result])).toEqual([["tarefa.comentar", "concluido"]]);

    expect(task.comments).toHaveLength(1);
    expect(task.comments[0]?.content).toBe("A Tarefa “Conferir a turma nova” acaba de nascer.");
    expect(task.comments[0]?.author).toEqual({ kind: "automation", id: a.id });
    expect(task.comments[0]?.authorDelegate).toEqual({ kind: "member", id: RAFAEL });

    // Pausada, não reage à Tarefa seguinte.
    valor(pausarAutomacao(state, RAFAEL, a.id));
    const outra = valor(createTask(state, THIAGO, { listId: "lst_revisoes", title: "Outra" }));
    expect(outra.comments).toHaveLength(0);
    expect(state.automationExecutions.filter((e) => e.automationId === a.id)).toHaveLength(1);
  });
});

describe("33 — duplicar e ciclo de vida", () => {
  it("duplicar nasce em rascunho, com Proveniência, a Versão 1 copiada da vigente e nome único no escopo", () => {
    const origem = registro(state.automations, "aut_boasvindas");
    const copia = valor(duplicarAutomacao(state, RAFAEL, origem.id));
    expect(copia.name).toBe("Boas-vindas na Fila Comercial (cópia)");
    expect(copia.lifecycle).toBe("rascunho");
    expect(copia.ownerMemberId).toBe(RAFAEL);
    expect(copia.scopeType).toBe("queue");
    expect(copia.scopeId).toBe("fila_com");
    expect(copia.provenance).toMatchObject({ kind: "copy", sourceId: origem.id, sourceName: origem.name });
    expect(copia.versions).toHaveLength(1);
    expect(copia.versions[0]).toMatchObject({ number: 1, state: "rascunho", trigger: { kind: "evento", eventType: "conversaCriada" } });
    expect(copia.versions[0]?.actions).toEqual(origem.versions[0]?.actions);
    expect(copia.versions[0]?.publishedBy).toBeUndefined();
    expect(valor(duplicarAutomacao(state, RAFAEL, origem.id)).name).toBe("Boas-vindas na Fila Comercial (cópia 2)");
    expect(erro(duplicarAutomacao(state, BEATRIZ, origem.id)).error).toBe("O Papel Convidado não cria Automação.");
  });

  it("pausar só a ativa; retomar só a pausada; quem não administra é recusado com a frase da tela", () => {
    const a = registro(state.automations, "aut_boasvindas");
    expect(erro(pausarAutomacao(state, "mem_marcos", a.id)).error).toBe("Pausar ou retomar exige administrar esta Automação.");
    expect(erro(retomarAutomacao(state, JULIA, a.id)).error).toBe("Só uma Automação pausada é retomada.");
    valor(pausarAutomacao(state, JULIA, a.id));
    expect(a.lifecycle).toBe("pausado");
    expect(erro(pausarAutomacao(state, JULIA, a.id)).error).toBe("Só uma Automação ativa é pausada.");
    valor(retomarAutomacao(state, JULIA, a.id));
    expect(a.lifecycle).toBe("ativo");
    expect(state.activity.filter((x) => x.objectId === a.id).map((x) => x.action).slice(0, 2)).toEqual(["Automação retomada", "Automação pausada"]);
  });

  it("arquivar cancela as Execuções não terminais e restaurar devolve a pausado; a lixeira guarda o estado anterior", () => {
    const a = registro(state.automations, "aut_boasvindas");
    const execucao = (id: string, estado: AutomationExecution["state"]): AutomationExecution => ({
      id,
      workspaceId: state.workspace.id,
      automationId: a.id,
      automationVersion: 1,
      state: estado,
      triggerKind: "evento",
      invokedBy: { kind: "automation", id: a.id },
      chain: { depth: 0, visitedAgentIds: [], visitedAutomationObjects: [] },
      steps: [],
      childAgentExecutionIds: [],
      cost: { modelUnits: 0, toolCalls: 0, childExecutions: 0, durationMs: 0 },
      startedAt: "2026-09-17T10:00:00.000Z",
    });
    state.automationExecutions.push(execucao("aex_t1", "executando"), execucao("aex_t2", "aguardandoAprovacao"), execucao("aex_t3", "concluida"));

    expect(erro(arquivarAutomacao(state, "mem_marcos", a.id)).error).toBe("Arquivar exige administrar esta Automação.");
    valor(arquivarAutomacao(state, JULIA, a.id));
    expect(a.lifecycle).toBe("arquivado");
    expect(a.archivedAt).toBeDefined();
    const porId = (id: string) => registro(state.automationExecutions, id);
    expect(porId("aex_t1")).toMatchObject({ state: "cancelada", terminationReason: "Automação arquivada" });
    expect(porId("aex_t1").endedAt).toBeDefined();
    expect(porId("aex_t2").state).toBe("cancelada");
    expect(porId("aex_t3").state).toBe("concluida");
    expect(state.activity.find((x) => x.objectId === a.id && x.action === "Automação arquivada")?.detail).toBe("2 Execuções canceladas");

    // Arquivada, não se edita nem se arquiva de novo; restaurar devolve a pausado (RN-AUT-05).
    expect(erro(adicionarAcao(state, JULIA, a.id, { kind: "controle", controlKind: "notificar", params: "{}" })).error).toBe("Restaure a Automação antes de editar.");
    expect(erro(arquivarAutomacao(state, JULIA, a.id)).error).toBe("Só uma Automação em rascunho, ativa ou pausada é arquivada.");
    valor(restoreAutomation(state, JULIA, a.id));
    expect(a.lifecycle).toBe("pausado");

    // Uma em rascunho arquivada volta como rascunho; a lixeira também guarda o anterior.
    const rascunho = novaDeLista(RAFAEL, "Só rascunho");
    valor(arquivarAutomacao(state, RAFAEL, rascunho.id));
    valor(restoreAutomation(state, RAFAEL, rascunho.id));
    expect(rascunho.lifecycle).toBe("rascunho");
    valor(enviarAutomacaoALixeira(state, RAFAEL, rascunho.id));
    expect(rascunho.lifecycle).toBe("naLixeira");
    expect(rascunho.lifecycleBeforeTrashAi).toBe("rascunho");
    expect(rascunho.trashedAt).toBeDefined();
    expect(erro(enviarAutomacaoALixeira(state, RAFAEL, rascunho.id)).error).toBe("A Automação já está na lixeira.");
    // Na lixeira, o nome fica livre no escopo (RN-AUT-03).
    expect(criarAutomacao(state, RAFAEL, { name: "Só rascunho", scopeType: "list", scopeId: "lst_revisoes" }).ok).toBe(true);
  });

  it("restaurar exige administrar a Automação, e com homônima no escopo é rejeitado até renomear (RN-AUT-03)", () => {
    const a = registro(state.automations, "aut_boasvindas");
    valor(arquivarAutomacao(state, JULIA, a.id));
    // Marcos é base Membro sem ser Proprietário nem Criador; Beatriz é Convidada: a frase que o editor mostra, sem efeito.
    expect(recusaDeRestaurarAutomacao(state, "mem_marcos", a)).toBe("Restaurar exige administrar esta Automação.");
    expect(erro(restoreAutomation(state, "mem_marcos", a.id)).error).toBe("Restaurar exige administrar esta Automação.");
    expect(erro(restoreAutomation(state, BEATRIZ, a.id)).error).toBe("Restaurar exige administrar esta Automação.");
    expect(a.lifecycle).toBe("arquivado");
    valor(restoreAutomation(state, JULIA, a.id));
    expect(a.lifecycle).toBe("pausado");

    // Na lixeira o nome fica livre no escopo; criada a homônima (caixa e espaços não distinguem), restaurar é rejeitado até renomear.
    valor(enviarAutomacaoALixeira(state, JULIA, a.id));
    const nova = valor(criarAutomacao(state, JULIA, { name: " boas-vindas NA fila comercial ", scopeType: "queue", scopeId: "fila_com" }));
    const colisao = "Já existe uma Automação chamada “Boas-vindas na Fila Comercial” neste escopo: renomeie antes de restaurar (RN-AUT-03).";
    expect(recusaDeRestaurarAutomacao(state, JULIA, a)).toBe(colisao);
    expect(erro(restoreAutomation(state, JULIA, a.id)).error).toBe(colisao);
    expect(a.lifecycle).toBe("naLixeira");
    // A mesma Automação noutro escopo não colide.
    valor(criarAutomacao(state, JULIA, { name: "Boas-vindas na Fila Comercial", scopeType: "list", scopeId: "lst_revisoes" }));

    // Renomeada a nova, a restauração passa e devolve pausado (era pausado ao ir à lixeira).
    valor(editarAutomacao(state, JULIA, nova.id, { name: "Boas-vindas, segunda leva" }));
    expect(recusaDeRestaurarAutomacao(state, JULIA, a)).toBeUndefined();
    valor(restoreAutomation(state, JULIA, a.id));
    expect(a.lifecycle).toBe("pausado");
  });
});
