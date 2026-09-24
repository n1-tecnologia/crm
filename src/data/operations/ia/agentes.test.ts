/**
 * O módulo Agentes (17, seção 12): nascer em rascunho, ativar, pausar,
 * arquivar, transferir, permitir e retirar Ferramenta, ensaiar e cancelar
 * Execução. Cada teste afirma o RESULTADO da operação e o estado que ela
 * deixou, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../../seed";
import type { DataState } from "../../state";
import { versaoCorrenteDoAgente } from "../../derive-ia";
import { createAgent, publishAgentVersion, type AgentDraft } from "../agent-builder";
import { recusaDeRestaurarAgente, restoreAgent } from "../ai";
import { concederHabilidade } from "./habilidades";
import {
  apagarItemDeMemoria,
  arquivarAgente,
  ativarAgente,
  cancelarExecucao,
  ensaiarAgente,
  enviarAgenteALixeira,
  pausarAgente,
  permitirFerramenta,
  retirarFerramenta,
  transferirAgente,
} from "./agentes";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const registro = <T extends { readonly id: string }>(lista: readonly T[], id: string): T => {
  const item = lista.find((x) => x.id === id);
  if (!item) throw new Error(`seed sem ${id}`);
  return item;
};

const erroDe = <T>(r: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }): string => (r.ok ? "" : r.error);

const rascunho: AgentDraft = {
  name: "Assistente de Vendas",
  description: "Ajuda o time comercial",
  instructions: "Responda em português, sem inventar dados.",
  modelId: "",
  allowedToolIds: ["ler_negocio"],
  icebreakers: ["Como posso ajudar?"],
  knowledgeSources: [],
  responseFormat: "markdown",
  accessPoints: ["chat"],
};

describe("Construtor: nascer em rascunho ou ativo (D1)", () => {
  it("20. createAgent nasce em rascunho, sem activatedAt, e o Registro diz que a Versão 1 está em rascunho", () => {
    const r = createAgent(state, "mem_thiago", rascunho);
    expect(r.ok, erroDe(r)).toBe(true);
    if (!r.ok) return;
    expect(r.value.lifecycle).toBe("rascunho");
    expect(r.value.activatedAt).toBeUndefined();
    expect(r.id).toBe(r.value.id);
    expect(state.activity[0]?.action).toBe("Agente criado");
    expect(state.activity[0]?.detail).toBe("Versão 1 em rascunho");
  });

  it("21. com { ativar: true } nasce ativo com activatedAt, e um Modelo descontinuado é recusado sem efeito", () => {
    const antes = state.agents.length;
    const r = createAgent(state, "mem_thiago", { ...rascunho, name: "Ativo de saída" }, { ativar: true });
    expect(r.ok, erroDe(r)).toBe(true);
    if (!r.ok) return;
    expect(r.value.lifecycle).toBe("ativo");
    expect(r.value.activatedAt).toBeDefined();
    expect(state.activity[0]?.action).toBe("Agente criado e ativado");
    // O Construtor já barra o Modelo descontinuado antes de RN-AGE-07 — e nada é gravado.
    expect(createAgent(state, "mem_thiago", { ...rascunho, name: "Outro", modelId: "mdl_legado" }, { ativar: true }).ok).toBe(false);
    expect(state.agents).toHaveLength(antes + 1);
  });

  it("22. a Versão publicada fotografa as Habilidades concedidas; um Agente arquivado não recebe Versão", () => {
    const publicada = publishAgentVersion(state, "mem_rafael", "agt_sdr", { ...rascunho, name: "Qualificador SDR" });
    expect(publicada.ok, erroDe(publicada)).toBe(true);
    const corrente = versaoCorrenteDoAgente(registro(state.agents, "agt_sdr"));
    expect(corrente?.number).toBe(2);
    expect([...(corrente?.grantedSkillIds ?? [])].sort()).toEqual(
      state.skillGrants.filter((g) => g.agentId === "agt_sdr").map((g) => g.skillId).sort(),
    );
    // Um Agente novo não tem Concessão: a foto é vazia.
    const novo = createAgent(state, "mem_thiago", rascunho);
    if (!novo.ok) throw new Error(novo.error);
    expect(novo.value.versions[0]?.grantedSkillIds).toEqual([]);

    expect(arquivarAgente(state, "mem_rafael", "agt_redator").ok).toBe(true);
    expect(erroDe(publishAgentVersion(state, "mem_rafael", "agt_redator", { ...rascunho, name: "Redator de propostas" }))).toBe("Restaure o Agente antes de editar.");
  });
});

describe("Estado do Agente (12.1)", () => {
  it("23. ativar recusa Modelo descontinuado e objetivo vazio (RN-AGE-07), e ativa quando a Versão está inteira", () => {
    const onboarding = registro(state.agents, "agt_onboarding");
    expect(erroDe(ativarAgente(state, "mem_julia", onboarding.id))).toBe("O Modelo “Modelo legado” foi descontinuado: escolha outro antes de ativar (RN-AGE-07).");
    expect(onboarding.lifecycle).toBe("rascunho");

    const v1 = onboarding.versions[0];
    if (!v1) throw new Error("seed sem Versão");
    v1.modelId = "mdl_base";
    v1.objective = " ";
    expect(erroDe(ativarAgente(state, "mem_julia", onboarding.id))).toBe("Escreva o objetivo antes de ativar (RN-AGE-07).");
    v1.objective = "Guiar o aluno novo.";
    v1.modelId = "nao_existe";
    expect(erroDe(ativarAgente(state, "mem_julia", onboarding.id))).toBe("O Modelo desta Versão não existe mais: escolha outro antes de ativar (RN-AGE-07).");
    v1.modelId = "padraoDaPlataforma";

    // Marcos não é Proprietário nem Criador, e a base Membro não administra o Espaço.
    expect(erroDe(ativarAgente(state, "mem_marcos", onboarding.id))).toBe("Administrar este Agente exige ser o seu Proprietário ou administrar o Espaço de Trabalho.");
    const r = ativarAgente(state, "mem_julia", onboarding.id);
    expect(r.ok, erroDe(r)).toBe(true);
    expect(onboarding.lifecycle).toBe("ativo");
    expect(onboarding.activatedAt).toBeDefined();
    expect(state.activity[0]).toMatchObject({ action: "Agente ativado", before: "rascunho", after: "ativo" });
    expect(erroDe(ativarAgente(state, "mem_julia", onboarding.id))).toBe("O Agente já está ativo.");
  });

  it("24. pausar só o ativo; o Assistente padrão nunca pausa, arquiva, vai à lixeira nem é transferido (INV-AGE-11)", () => {
    const sdr = registro(state.agents, "agt_sdr");
    const r = pausarAgente(state, "mem_rafael", sdr.id);
    expect(r.ok, erroDe(r)).toBe(true);
    expect(sdr.lifecycle).toBe("pausado");
    expect(sdr.pausedAt).toBeDefined();
    expect(state.activity[0]?.detail).toBe("Responsabilidades preservadas; Execuções em curso terminam (RN-AGE-19).");
    // Pausar preserva: a Tarefa continua a listá-lo como Responsável (RN-AGE-20).
    expect(registro(state.tasks, "tsk_seed_3").assignees.some((a) => a.kind === "agent" && a.id === sdr.id)).toBe(true);
    expect(erroDe(pausarAgente(state, "mem_rafael", sdr.id))).toBe("Só um Agente ativo é pausado.");
    // Pausado volta a ativo por ato explícito.
    expect(ativarAgente(state, "mem_rafael", sdr.id).ok).toBe(true);
    expect(sdr.lifecycle).toBe("ativo");

    const padrao = state.workspace.defaultAgentId;
    expect(erroDe(pausarAgente(state, "mem_thiago", padrao))).toBe("O Assistente padrão nunca é pausado (INV-AGE-11).");
    expect(erroDe(arquivarAgente(state, "mem_thiago", padrao))).toBe("O Assistente padrão não é arquivado (INV-AGE-11).");
    expect(erroDe(enviarAgenteALixeira(state, "mem_thiago", padrao))).toBe("O Assistente padrão não vai à lixeira (INV-AGE-11).");
    expect(erroDe(transferirAgente(state, "mem_thiago", padrao, "mem_rafael"))).toBe("O Assistente padrão acompanha o Proprietário do Espaço de Trabalho (B33).");
    expect(registro(state.agents, padrao).lifecycle).toBe("ativo");
  });

  it("25. arquivar libera Responsável e Atribuído no ato e preserva as Concessões; desarquivar devolve pausado (B94)", () => {
    const sdr = registro(state.agents, "agt_sdr");
    const conversa = state.conversations[0];
    if (!conversa) throw new Error("seed sem Conversa");
    conversa.assignee = { kind: "agent", id: sdr.id };
    const concessoes = state.skillGrants.filter((g) => g.agentId === sdr.id).length;
    expect(concessoes).toBeGreaterThan(0);

    const r = arquivarAgente(state, "mem_rafael", sdr.id);
    expect(r.ok, erroDe(r)).toBe(true);
    expect(sdr.lifecycle).toBe("arquivado");
    expect(state.tasks.some((t) => t.assignees.some((a) => a.kind === "agent" && a.id === sdr.id))).toBe(false);
    expect(conversa.assignee).toBeUndefined();
    expect(state.activity.find((a) => a.action === "Agente arquivado")?.detail).toBe("1 Tarefa(s) e 1 Conversa(s) liberadas");
    expect(state.skillGrants.filter((g) => g.agentId === sdr.id)).toHaveLength(concessoes);
    expect(erroDe(ativarAgente(state, "mem_rafael", sdr.id))).toBe("Desarquive o Agente antes: ele volta a pausado (B94).");
    expect(erroDe(permitirFerramenta(state, "mem_rafael", sdr.id, "ler_tarefa"))).toBe("Restaure o Agente antes de editar.");

    expect(restoreAgent(state, "mem_rafael", sdr.id).ok).toBe(true);
    expect(sdr.lifecycle).toBe("pausado");
    // As responsabilidades não voltam com ele (RN-AGE-20).
    expect(registro(state.tasks, "tsk_seed_3").assignees.some((a) => a.kind === "agent" && a.id === sdr.id)).toBe(false);

    // A lixeira guarda o estado anterior: um rascunho volta rascunho; um ativo volta pausado.
    const onboarding = registro(state.agents, "agt_onboarding");
    expect(enviarAgenteALixeira(state, "mem_julia", onboarding.id).ok).toBe(true);
    expect(onboarding.lifecycleBeforeTrashAi).toBe("rascunho");
    expect(erroDe(ativarAgente(state, "mem_julia", onboarding.id))).toBe("Restaure o Agente da lixeira antes.");
    expect(restoreAgent(state, "mem_julia", onboarding.id).ok).toBe(true);
    expect(onboarding.lifecycle).toBe("rascunho");
    const redator = registro(state.agents, "agt_redator");
    expect(enviarAgenteALixeira(state, "mem_rafael", redator.id).ok).toBe(true);
    expect(restoreAgent(state, "mem_rafael", redator.id).ok).toBe(true);
    expect(redator.lifecycle).toBe("pausado");
  });

  it("25b. desarquivar e restaurar exigem administrar o Agente, e restaurar com o nome em uso é rejeitado até renomear (RN-AGE-02)", () => {
    const redator = registro(state.agents, "agt_redator");
    expect(arquivarAgente(state, "mem_rafael", redator.id).ok).toBe(true);
    // Marcos é base Membro, nem Proprietário nem Criador; Beatriz é Convidada. A operação recusa com a frase que a ficha mostra, sem efeito.
    const semAdministrar = "Administrar este Agente exige ser o seu Proprietário ou administrar o Espaço de Trabalho.";
    expect(recusaDeRestaurarAgente(state, "mem_marcos", redator)).toBe(semAdministrar);
    expect(erroDe(restoreAgent(state, "mem_marcos", redator.id))).toBe(semAdministrar);
    expect(erroDe(restoreAgent(state, "mem_beatriz", redator.id))).toBe("O Papel Convidado não edita Agente.");
    expect(redator.lifecycle).toBe("arquivado");
    expect(state.activity.filter((x) => x.objectId === redator.id && x.action === "Agente restaurado")).toHaveLength(0);
    expect(restoreAgent(state, "mem_rafael", redator.id).ok).toBe(true);
    expect(redator.lifecycle).toBe("pausado");

    // Na lixeira o nome fica livre: nasce um homônimo (caixa e espaços não distinguem). Restaurar é rejeitado até renomear.
    expect(enviarAgenteALixeira(state, "mem_rafael", redator.id).ok).toBe(true);
    const homonimo = createAgent(state, "mem_thiago", { ...rascunho, name: " redator DE propostas " });
    expect(homonimo.ok, erroDe(homonimo)).toBe(true);
    if (!homonimo.ok) return;
    const colisao = "Já existe um Agente chamado “redator DE propostas”: renomeie antes de restaurar (RN-AGE-02).";
    expect(recusaDeRestaurarAgente(state, "mem_rafael", redator)).toBe(colisao);
    expect(erroDe(restoreAgent(state, "mem_rafael", redator.id))).toBe(colisao);
    expect(redator.lifecycle).toBe("naLixeira");
    expect(state.agents.filter((a) => a.lifecycle !== "naLixeira" && a.name.trim().toLocaleLowerCase("pt-BR") === "redator de propostas")).toHaveLength(1);

    // Renomeado o homônimo, a restauração passa e devolve pausado (B94).
    expect(publishAgentVersion(state, "mem_thiago", homonimo.value.id, { ...rascunho, name: "Redator de contratos" }).ok).toBe(true);
    expect(recusaDeRestaurarAgente(state, "mem_rafael", redator)).toBeUndefined();
    expect(restoreAgent(state, "mem_rafael", redator.id).ok).toBe(true);
    expect(redator.lifecycle).toBe("pausado");
  });
});

describe("Ferramentas permitidas (RN-AGE-06, D8)", () => {
  it("26. permitir e retirar criam Versão com motivo; inexistente e duplicada são recusadas; o Convidado não edita", () => {
    const sdr = registro(state.agents, "agt_sdr");
    const versoes = sdr.versions.length;
    const permitida = permitirFerramenta(state, "mem_rafael", sdr.id, "ler_tarefa");
    expect(permitida.ok, erroDe(permitida)).toBe(true);
    expect(sdr.versions).toHaveLength(versoes + 1);
    const v2 = versaoCorrenteDoAgente(sdr);
    expect(v2?.number).toBe(versoes + 1);
    expect(v2?.allowedToolIds).toContain("ler_tarefa");
    expect(v2?.reason).toBe("Ferramenta “Ler Tarefa” permitida");
    expect(v2?.by).toEqual({ kind: "member", id: "mem_rafael" });
    // A Versão anterior segue como estava (DO-AGE-02).
    expect(sdr.versions[0]?.allowedToolIds).not.toContain("ler_tarefa");
    expect(state.activity[0]).toMatchObject({ action: "Versão do Agente criada", detail: "Ferramenta “Ler Tarefa” permitida" });

    expect(erroDe(permitirFerramenta(state, "mem_rafael", sdr.id, "ler_tarefa"))).toBe("Esta Ferramenta já está permitida ao Agente.");
    expect(erroDe(permitirFerramenta(state, "mem_rafael", sdr.id, "nao_existe"))).toBe("A Ferramenta “nao_existe” não existe no Catálogo.");
    expect(erroDe(retirarFerramenta(state, "mem_rafael", sdr.id, "mesclar_contatos"))).toBe("Esta Ferramenta não está permitida ao Agente.");
    expect(erroDe(permitirFerramenta(state, "mem_beatriz", sdr.id, "ler_negocio"))).toBe("O Papel Convidado não edita Agente.");
    expect(sdr.versions).toHaveLength(versoes + 1);

    const retirada = retirarFerramenta(state, "mem_rafael", sdr.id, "ler_tarefa");
    expect(retirada.ok, erroDe(retirada)).toBe(true);
    expect(sdr.versions).toHaveLength(versoes + 2);
    expect(versaoCorrenteDoAgente(sdr)?.allowedToolIds).not.toContain("ler_tarefa");
    expect(versaoCorrenteDoAgente(sdr)?.reason).toBe("Ferramenta “Ler Tarefa” retirada");
  });

  it("26b. toda Versão nova fotografa as Habilidades concedidas relidas das Concessões, nunca a foto da Versão anterior (DO-AGE-02)", () => {
    const sdr = registro(state.agents, "agt_sdr");
    const v1 = sdr.versions[0];
    if (!v1) throw new Error("seed sem Versão");
    const concedidas = state.skillGrants.filter((g) => g.agentId === sdr.id).map((g) => g.skillId).sort();
    expect(concedidas.length).toBeGreaterThan(1);
    // Uma foto desatualizada na Versão corrente (como a Versão 1 de um seed antigo) não contamina a próxima.
    v1.grantedSkillIds = [];

    const permitida = permitirFerramenta(state, "mem_rafael", sdr.id, "ler_tarefa");
    expect(permitida.ok, erroDe(permitida)).toBe(true);
    const v2 = versaoCorrenteDoAgente(sdr);
    expect(v2?.number).toBe(v1.number + 1);
    expect([...(v2?.grantedSkillIds ?? [])].sort()).toEqual(concedidas);
    expect(v2?.allowedToolIds).toContain("ler_tarefa");

    // Conceder em seguida acrescenta UMA Habilidade à foto: o histórico não diz que várias foram concedidas entre a v2 e a v3.
    const concedida = concederHabilidade(state, "mem_rafael", { agentId: sdr.id, skillId: "skl_followup" });
    expect(concedida.ok, erroDe(concedida)).toBe(true);
    const v3 = versaoCorrenteDoAgente(sdr);
    expect(v3?.number).toBe(v1.number + 2);
    expect([...(v3?.grantedSkillIds ?? [])].sort()).toEqual([...concedidas, "skl_followup"].sort());

    // Retirar a Ferramenta muda só as Ferramentas: as Concessões não mudaram e a foto segue igual; a Versão anterior fica como estava.
    const retirada = retirarFerramenta(state, "mem_rafael", sdr.id, "ler_tarefa");
    expect(retirada.ok, erroDe(retirada)).toBe(true);
    const v4 = versaoCorrenteDoAgente(sdr);
    expect([...(v4?.grantedSkillIds ?? [])].sort()).toEqual([...concedidas, "skl_followup"].sort());
    expect(v4?.allowedToolIds).not.toContain("ler_tarefa");
    expect(v3?.allowedToolIds).toContain("ler_tarefa");
    expect(v1.grantedSkillIds).toEqual([]);

    // O Construtor passa pela mesma fábrica: a Versão publicada fotografa as mesmas Concessões.
    expect(publishAgentVersion(state, "mem_rafael", sdr.id, { ...rascunho, name: "Qualificador SDR" }).ok).toBe(true);
    expect([...(versaoCorrenteDoAgente(sdr)?.grantedSkillIds ?? [])].sort()).toEqual([...concedidas, "skl_followup"].sort());
  });
});

describe("Ensaio e Execução (DO-AGE-13, RN-AGE-21)", () => {
  it("27a. ensaiar grava Execução rehearsal com leituras concluídas, escritas simuladas e Referências de Conhecimento; nunca grava Memória; pausado não ensaia", () => {
    const sdr = registro(state.agents, "agt_sdr");
    const execucoes = state.agentExecutions.length;
    const memoria = sdr.memory.length;
    const r = ensaiarAgente(state, "mem_rafael", sdr.id, { texto: "Qualifique a Marina Alves", anchor: { type: "conversation", id: "cnv_1" } });
    expect(r.ok, erroDe(r)).toBe(true);
    if (!r.ok) return;
    const e = r.value;
    expect(state.agentExecutions).toHaveLength(execucoes + 1);
    expect(r.id).toBe(e.id);
    expect(e.rehearsal).toBe(true);
    expect(e.state).toBe("concluida");
    expect(e.origin).toBe("acaoDireta");
    expect(e.delegate).toEqual({ kind: "member", id: "mem_rafael" });
    expect(e.agentVersion).toBe(1);
    expect(e.modelId).toBe("mdl_base");
    expect(e.effectiveAutonomy).toBe("supervisionado");
    // Um Passo de raciocínio e um por Ferramenta permitida, na ordem da Versão.
    const permitidas = sdr.versions[0]?.allowedToolIds ?? [];
    expect(e.steps).toHaveLength(permitidas.length + 1);
    expect(e.steps[0]).toMatchObject({ kind: "raciocinio", output: "Ensaio: responder a “Qualifique a Marina Alves” com as instruções da Versão 1." });
    expect(e.steps.slice(1).map((s) => s.toolId)).toEqual(permitidas);
    const escrita = e.steps.find((s) => s.toolId === "atualizar_qualificacao");
    expect(escrita).toMatchObject({ result: "simulado", output: "Escrita não aplicada: ensaio (B82)", effectClass: "escritaReversivel" });
    const leitura = e.steps.find((s) => s.toolId === "ler_contato");
    expect(leitura).toMatchObject({ result: "concluido", output: "Leitura simulada de Contato", toolAllowed: true, resourcePermitted: true });
    expect(e.output).toBe(`Ensaio concluído: ${permitidas.length + 1} passo(s), 1 escrita(s) simulada(s).`);
    expect(e.cost.toolCalls).toBe(permitidas.length);
    // Consultar Conhecimento permitida + Coleção concedida (cgr_2) → Referências, até três, do primeiro Fragmento.
    expect(e.knowledgeReferences).toHaveLength(3);
    expect(e.knowledgeReferences[0]).toMatchObject({ documentId: "doc_1", collectionId: "col_comercial", collectionName: "Material comercial", fragmentIds: ["frg_1"] });
    expect(e.contextComposition.fragmentRefs).toHaveLength(3);
    expect(e.contextComposition.anchor).toEqual({ type: "conversation", id: "cnv_1", name: registro(state.conversations, "cnv_1").title });
    // Nada de Memória e nada aplicado: a Qualificação do Contato segue a mesma.
    expect(sdr.memory).toHaveLength(memoria);
    expect(state.activity[0]).toMatchObject({ action: "Ensaio executado", objectType: "agent", objectId: sdr.id });

    expect(erroDe(ensaiarAgente(state, "mem_rafael", sdr.id, { texto: "  " }))).toBe("Escreva o pedido do ensaio.");
    expect(pausarAgente(state, "mem_rafael", sdr.id).ok).toBe(true);
    expect(erroDe(ensaiarAgente(state, "mem_rafael", sdr.id, { texto: "De novo" }))).toBe("Só um Agente em rascunho ou ativo ensaia (DO-AGE-13).");
  });

  it("27b. um rascunho ensaia; com Modelo descontinuado a Execução nasce e termina falhou, sem Passos (RN-AGE-08)", () => {
    const onboarding = registro(state.agents, "agt_onboarding");
    const r = ensaiarAgente(state, "mem_julia", onboarding.id, { texto: "O que falta no onboarding da Marina?" });
    expect(r.ok, erroDe(r)).toBe(true);
    if (!r.ok) return;
    expect(r.value.state).toBe("falhou");
    expect(r.value.terminationReason).toBe("Modelo descontinuado (RN-AGE-08)");
    expect(r.value.steps).toEqual([]);
    expect(r.value.cost.modelUnits).toBe(0);
    expect(state.activity[0]).toMatchObject({ action: "Ensaio executado", result: "failed" });
    // Sem instruções não há ensaio.
    const v1 = onboarding.versions[0];
    if (!v1) throw new Error("seed sem Versão");
    v1.instructions = "";
    expect(erroDe(ensaiarAgente(state, "mem_julia", onboarding.id, { texto: "Oi" }))).toBe("Escreva as instruções antes de ensaiar: sem elas o Agente não sabe o que fazer.");
  });

  it("27c. cancelar: terminal recusa; quem não administra nem delega recusa; o delegante pode; a Solicitação pendente vira cancelada", () => {
    expect(erroDe(cancelarExecucao(state, "mem_rafael", "exe_1"))).toBe("Uma Execução terminal não é cancelada (11.2).");
    // Júlia não governa o Qualificador SDR (do Rafael) e não delegou exe_em_curso.
    expect(erroDe(cancelarExecucao(state, "mem_julia", "exe_em_curso"))).toBe("Cancelar exige administrar o Agente ou ser o delegante da Execução (RN-AGE-21).");
    // Como delegante, ela pode — mesmo sem governar o Agente.
    const indice = state.agentExecutions.findIndex((e) => e.id === "exe_em_curso");
    const emCurso = state.agentExecutions[indice];
    if (!emCurso) throw new Error("seed sem exe_em_curso");
    state.agentExecutions[indice] = { ...emCurso, delegate: { kind: "member", id: "mem_julia" } };
    const r = cancelarExecucao(state, "mem_julia", "exe_em_curso", "Pedido errado");
    expect(r.ok, erroDe(r)).toBe(true);
    if (!r.ok) return;
    expect(r.value.state).toBe("cancelada");
    expect(r.value.terminationReason).toBe("Pedido errado");
    expect(r.value.endedAt).toBeDefined();
    // O Passo já produzido fica (RN-AGE-21).
    expect(r.value.steps).toHaveLength(1);
    expect(r.value.steps[0]?.result).toBe("concluido");
    expect(state.activity[0]).toMatchObject({ action: "Execução cancelada", objectType: "agentExecution", objectId: "exe_em_curso" });

    // exe_2 espera a apr_1: cancelar fecha a Solicitação e o Passo que aguardava.
    const thiago = cancelarExecucao(state, "mem_thiago", "exe_2");
    expect(thiago.ok, erroDe(thiago)).toBe(true);
    expect(registro(state.approvals, "apr_1").decision).toBe("cancelada");
    expect(registro(state.agentExecutions, "exe_2").terminationReason).toBe("Cancelada por Membro");
    expect(registro(state.agentExecutions, "exe_2").steps[1]?.result).toBe("cancelado");
    expect(erroDe(cancelarExecucao(state, "mem_thiago", "exe_2"))).toBe("Uma Execução terminal não é cancelada (11.2).");
  });

  it("27d. transferir recusa Convidado, Membro inexistente e o mesmo Proprietário; muda o dono sem criar Versão", () => {
    const sdr = registro(state.agents, "agt_sdr");
    const versoes = sdr.versions.length;
    expect(erroDe(transferirAgente(state, "mem_rafael", sdr.id, "mem_beatriz"))).toBe("O novo Proprietário precisa ser um Membro ativo sem base Convidado (RN-AGE-04).");
    expect(erroDe(transferirAgente(state, "mem_rafael", sdr.id, "mem_tiago"))).toBe("O novo Proprietário precisa ser um Membro ativo sem base Convidado (RN-AGE-04).");
    expect(erroDe(transferirAgente(state, "mem_rafael", sdr.id, "mem_rafael"))).toBe("Este Membro já é o Proprietário.");
    // Júlia não é a Proprietária: não transfere o que não governa.
    expect(erroDe(transferirAgente(state, "mem_julia", sdr.id, "mem_julia"))).toBe("Administrar este Agente exige ser o seu Proprietário ou administrar o Espaço de Trabalho.");
    const r = transferirAgente(state, "mem_rafael", sdr.id, "mem_julia");
    expect(r.ok, erroDe(r)).toBe(true);
    expect(sdr.ownerMemberId).toBe("mem_julia");
    expect(sdr.versions).toHaveLength(versoes);
    expect(state.activity[0]).toMatchObject({ action: "Proprietário do Agente alterado", before: "Rafael Nunes", after: "Júlia Prado" });
    // Agora Júlia governa, e Rafael segue por administrar o Espaço.
    expect(pausarAgente(state, "mem_julia", sdr.id).ok).toBe(true);
    expect(ativarAgente(state, "mem_rafael", sdr.id).ok).toBe(true);
  });

  it("apagar um item de Memória é editar no Agente", () => {
    const sdr = registro(state.agents, "agt_sdr");
    sdr.memory.push({ id: "mem_item_teste", content: "Marina prefere contato pela manhã.", executionId: "exe_1", referencedRecordIds: [], origin: "agente", createdAt: "2026-09-01T10:00:00.000Z" });
    expect(erroDe(apagarItemDeMemoria(state, "mem_rafael", sdr.id, "nao_existe"))).toBe("Item de Memória não encontrado.");
    expect(apagarItemDeMemoria(state, "mem_rafael", sdr.id, "mem_item_teste").ok).toBe(true);
    expect(sdr.memory.some((m) => m.id === "mem_item_teste")).toBe(false);
  });
});
