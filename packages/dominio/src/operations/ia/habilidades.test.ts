/**
 * Habilidades (18) — criação, cópia da plataforma, rascunho único, publicar
 * com validação, obsoletar e as Concessões a Agentes. Cada teste afirma o
 * RESULTADO da operação e o estado que ela deixou, nunca que uma função foi
 * chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../../seed";
import type { DataState } from "../../state";
import type { Skill, SkillVersion } from "../../types";
import { disponibilidadeDaConcessao, rascunhoDaHabilidade, versaoCorrenteDaHabilidade } from "../../derive-ia";
import {
  concederHabilidade,
  copiarHabilidadeDaPlataforma,
  criarHabilidade,
  criarRascunhoDaHabilidade,
  descartarRascunhoDaHabilidade,
  editarRascunhoDaHabilidade,
  obsoletarVersaoDaHabilidade,
  publicarVersaoDaHabilidade,
  revogarHabilidade,
  validarRascunhoDaHabilidade,
} from "./habilidades";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const registro = <T extends { readonly id: string }>(lista: readonly T[], id: string): T => {
  const item = lista.find((x) => x.id === id);
  if (!item) throw new Error(`seed sem ${id}`);
  return item;
};

const corrente = (skill: Skill): SkillVersion => {
  const v = versaoCorrenteDaHabilidade(skill);
  if (!v) throw new Error(`${skill.id} sem Versão corrente`);
  return v;
};

const erroDe = <T>(r: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string; readonly field?: string }): string => {
  if (r.ok) throw new Error("esperava recusa");
  return r.error;
};

describe("Habilidades — criar e copiar", () => {
  it("1. cria ativa com a Versão 1 em rascunho e recusa nome repetido", () => {
    const r = criarHabilidade(state, "mem_marcos", { name: "  Sugerir próximo passo  ", description: " Propõe a ação seguinte. " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const skill = r.value;
    expect(r.id).toBe(skill.id);
    expect(skill.lifecycle).toBe("ativo");
    expect(skill.ownership).toBe("workspace");
    expect(skill.name).toBe("Sugerir próximo passo");
    expect(skill.description).toBe("Propõe a ação seguinte.");
    expect(skill.createdBy).toEqual({ kind: "member", id: "mem_marcos" });
    expect(skill.versions).toHaveLength(1);
    expect(skill.versions[0]).toMatchObject({ number: 1, state: "rascunho", instructions: "", inputContract: [], outputContract: { structured: [], text: true } });
    expect(state.skillGrants.some((g) => g.skillId === skill.id)).toBe(false);
    expect(state.activity[0]).toMatchObject({ action: "Habilidade criada", objectType: "skill", objectId: skill.id, detail: "Versão 1 em rascunho" });

    // RN-HAB-02 — sem distinção de maiúsculas e espaços nas extremidades.
    const repetido = criarHabilidade(state, "mem_marcos", { name: " qualificar LEAD " });
    expect(repetido).toEqual({ ok: false, error: "Já existe uma Habilidade chamada “qualificar LEAD”.", field: "nome" });
    expect(criarHabilidade(state, "mem_marcos", { name: "   " })).toEqual({ ok: false, error: "Dê um nome à Habilidade.", field: "nome" });
  });

  it("2. o Convidado não cria; um Membro removido não age", () => {
    expect(criarHabilidade(state, "mem_beatriz", { name: "Nova" })).toEqual({ ok: false, error: "O Papel Convidado não cria Habilidade." });
    expect(copiarHabilidadeDaPlataforma(state, "mem_beatriz", "skl_triagem")).toEqual({ ok: false, error: "O Papel Convidado não cria Habilidade." });
    expect(criarHabilidade(state, "mem_tiago", { name: "Nova" })).toEqual({ ok: false, error: "Só um Membro ativo age sobre a IA do Espaço de Trabalho." });
    expect(state.skills.some((s) => s.name === "Nova")).toBe(false);
  });

  it("3. copiar da plataforma nasce rascunho idêntico, com Proveniência e sem Concessões", () => {
    const origem = registro(state.skills, "skl_triagem");
    const r = copiarHabilidadeDaPlataforma(state, "mem_julia", origem.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const copia = r.value;
    expect(copia.id).not.toBe(origem.id);
    expect(copia.ownership).toBe("workspace");
    expect(copia.lifecycle).toBe("ativo");
    expect(copia.name).toBe("Triagem de mensagem recebida (cópia)");
    expect(copia.createdBy).toEqual({ kind: "member", id: "mem_julia" });
    expect(copia.provenance).toMatchObject({ kind: "copy", sourceId: "skl_triagem", sourceName: "Triagem de mensagem recebida" });
    expect(copia.versions).toHaveLength(1);
    const v1 = copia.versions[0];
    const base = corrente(origem);
    expect(v1).toMatchObject({ number: 1, state: "rascunho", instructions: base.instructions, toolRequirements: base.toolRequirements });
    expect(v1?.publishedBy).toBeUndefined();
    // Cópia profunda: mexer no rascunho não toca a Versão da plataforma.
    v1?.inputContract.push({ name: "extra", type: "texto", required: false, description: "" });
    expect(base.inputContract).toHaveLength(1);
    // RN-HAB-05 — nada é exercível; as Concessões à Habilidade da plataforma (sgr_2) não migram.
    expect(versaoCorrenteDaHabilidade(copia)).toBeUndefined();
    expect(state.skillGrants.filter((g) => g.skillId === copia.id)).toEqual([]);
    expect(state.skillGrants.some((g) => g.id === "sgr_2" && g.skillId === "skl_triagem")).toBe(true);
    expect(state.activity[0]).toMatchObject({ action: "Habilidade copiada da plataforma", objectId: copia.id });

    expect(erroDe(copiarHabilidadeDaPlataforma(state, "mem_julia", "skl_qualificar"))).toBe(
      "Só uma Habilidade da plataforma é copiada por aqui; as do Espaço de Trabalho são editadas.",
    );
    expect(erroDe(copiarHabilidadeDaPlataforma(state, "mem_julia", origem.id))).toBe("Já existe uma Habilidade chamada “Triagem de mensagem recebida (cópia)”.");
    expect(erroDe(copiarHabilidadeDaPlataforma(state, "mem_julia", origem.id, 9))).toBe("A Habilidade da plataforma não tem Versão publicada para copiar.");
  });
});

describe("Habilidades — rascunho e Versões", () => {
  it("4. editar o rascunho recusa dependência de si mesma, ciclo e cadeia além de 3 níveis (RN-HAB-08)", () => {
    // “Resumir contexto do Negócio” passa a requerer “Qualificar lead”: qualquer volta fecha ciclo.
    corrente(registro(state.skills, "skl_resumir")).dependencies = [{ skillId: "skl_qualificar" }];
    // Uma cadeia de 3 níveis abaixo de “Redigir follow-up”: follow-up → proposta → analisar perfil → abordar lead.
    corrente(registro(state.skills, "skl_followup")).dependencies = [{ skillId: "skl_proposta" }];
    corrente(registro(state.skills, "skl_proposta")).dependencies = [{ skillId: "skl_analisar_perfil" }];
    corrente(registro(state.skills, "skl_analisar_perfil")).dependencies = [{ skillId: "skl_abordar_lead" }];

    expect(criarRascunhoDaHabilidade(state, "mem_rafael", "skl_qualificar").ok).toBe(true);
    const skill = registro(state.skills, "skl_qualificar");

    expect(editarRascunhoDaHabilidade(state, "mem_rafael", skill.id, { dependencies: [{ skillId: "skl_qualificar" }] })).toEqual({
      ok: false,
      error: "Uma Habilidade não depende de si mesma (RN-HAB-08).",
      field: "dependencias",
    });
    expect(editarRascunhoDaHabilidade(state, "mem_rafael", skill.id, { dependencies: [{ skillId: "skl_resumir" }] })).toEqual({
      ok: false,
      error: "Esta Dependência fecharia um ciclo com “Resumir contexto do Negócio” (RN-HAB-08).",
      field: "dependencias",
    });
    // qualificar → follow-up abriria 4 níveis.
    expect(editarRascunhoDaHabilidade(state, "mem_rafael", skill.id, { dependencies: [{ skillId: "skl_followup" }] })).toEqual({
      ok: false,
      error: "A cadeia de Dependências passa de 3 níveis (RN-HAB-08).",
      field: "dependencias",
    });
    // Nada foi gravado pelas recusas; qualificar → proposta são exatamente 3 níveis e passa.
    expect(rascunhoDaHabilidade(skill)?.dependencies).toEqual([]);
    const r = editarRascunhoDaHabilidade(state, "mem_rafael", skill.id, { dependencies: [{ skillId: "skl_proposta", pinnedVersion: 2 }], instructions: "Qualificar com a proposta em mãos." });
    expect(r.ok).toBe(true);
    const rascunho = rascunhoDaHabilidade(skill);
    expect(rascunho?.dependencies).toEqual([{ skillId: "skl_proposta", pinnedVersion: 2 }]);
    expect(rascunho?.instructions).toBe("Qualificar com a proposta em mãos.");
    if (!rascunho) return;
    expect(validarRascunhoDaHabilidade(state, skill, rascunho)).toEqual([]);
    expect(state.activity[0]).toMatchObject({ action: "Rascunho da Habilidade editado", detail: "v2 · instruções, Dependências" });

    // A validação revalida o fecho: uma Dependência que mudou depois da edição aparece como problema, não como recusa.
    corrente(registro(state.skills, "skl_proposta")).dependencies = [{ skillId: "skl_qualificar" }];
    expect(validarRascunhoDaHabilidade(state, skill, rascunho)).toEqual([
      { regra: "RN-HAB-08", campo: "dependencias", mensagem: "Esta Dependência fecharia um ciclo com “Redigir proposta comercial” (RN-HAB-08)." },
    ]);
    expect(erroDe(editarRascunhoDaHabilidade(state, "mem_julia", skill.id, { instructions: "x" }))).toBe(
      "Editar esta Habilidade exige ser o seu Criador ou administrar o Espaço de Trabalho.",
    );
  });

  it("5. publicar recusa com Instruções vazias, sem efeito, e recusa o Convidado antes de olhar o rascunho", () => {
    const skill = registro(state.skills, "skl_agenda");
    const rascunho = rascunhoDaHabilidade(skill);
    if (!rascunho) throw new Error("seed sem rascunho");
    expect(validarRascunhoDaHabilidade(state, skill, rascunho)).toEqual([{ regra: "RN-HAB-06", campo: "instrucoes", mensagem: "As Instruções estão vazias." }]);

    const r = publicarVersaoDaHabilidade(state, "mem_rafael", skill.id);
    expect(r).toEqual({ ok: false, error: "O rascunho tem 1 problema de validação. Corrija antes de publicar (RN-HAB-06).", field: "validacao" });
    expect(rascunho.state).toBe("rascunho");
    expect(rascunho.publishedAt).toBeUndefined();
    expect(versaoCorrenteDaHabilidade(skill)).toBeUndefined();
    expect(state.activity[0]).toMatchObject({ action: "Validação falhou", result: "failed", objectId: skill.id });
    const falhas = state.activity.filter((a) => a.action === "Validação falhou").length;

    // O Convidado é recusado por Papel: nenhum Registro de validação nasce.
    expect(publicarVersaoDaHabilidade(state, "mem_beatriz", skill.id)).toEqual({ ok: false, error: "O Papel Convidado não edita Habilidade." });
    // Júlia (Membro) não é a Criadora: publicar exige administrar.
    expect(erroDe(publicarVersaoDaHabilidade(state, "mem_julia", skill.id))).toBe("Publicar e obsoletar exigem administrar esta Habilidade: o Criador ou um Administrador.");
    expect(state.activity.filter((a) => a.action === "Validação falhou")).toHaveLength(falhas);
    // A da plataforma ninguém publica por aqui (INV-HAB-07).
    expect(erroDe(publicarVersaoDaHabilidade(state, "mem_thiago", "skl_triagem"))).toBe("Uma Habilidade da plataforma não é editada pelo Espaço de Trabalho: copie-a (INV-HAB-07).");

    // Com as Instruções, publica: v1 passa a corrente.
    expect(editarRascunhoDaHabilidade(state, "mem_rafael", skill.id, { instructions: "Montar o plano de estudo da semana." }).ok).toBe(true);
    const ok = publicarVersaoDaHabilidade(state, "mem_rafael", skill.id);
    expect(ok.ok).toBe(true);
    expect(rascunho).toMatchObject({ state: "publicada", publishedBy: "mem_rafael" });
    expect(versaoCorrenteDaHabilidade(skill)?.number).toBe(1);
    expect(erroDe(publicarVersaoDaHabilidade(state, "mem_rafael", skill.id))).toBe("Não há rascunho para publicar.");
  });

  it("6. publicar a Versão 2 mantém a Versão 1 publicada (B71) e a corrente passa a ser a 2", () => {
    const skill = registro(state.skills, "skl_qualificar");
    expect(criarRascunhoDaHabilidade(state, "mem_rafael", skill.id).ok).toBe(true);
    expect(rascunhoDaHabilidade(skill)?.number).toBe(2);
    expect(state.activity[0]).toMatchObject({ action: "Rascunho criado a partir de Versão", after: "v2", detail: "a partir da v1 (publicada)" });
    expect(editarRascunhoDaHabilidade(state, "mem_rafael", skill.id, { instructions: "Qualificar pelo BANT." }).ok).toBe(true);

    const r = publicarVersaoDaHabilidade(state, "mem_rafael", skill.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.id).toBe(skill.id);
    expect(r.value).toMatchObject({ number: 2, state: "publicada", publishedBy: "mem_rafael", instructions: "Qualificar pelo BANT." });
    expect(skill.versions.map((v) => [v.number, v.state])).toEqual([
      [1, "publicada"],
      [2, "publicada"],
    ]);
    expect(versaoCorrenteDaHabilidade(skill)?.number).toBe(2);
    expect(rascunhoDaHabilidade(skill)).toBeUndefined();
    expect(state.activity[0]).toMatchObject({ action: "Versão de Habilidade publicada", after: "versão 2", objectId: skill.id });
  });

  it("7. um segundo rascunho é recusado (RN-HAB-04); descartar o único rascunho é recusado (INV-HAB-01)", () => {
    const skill = registro(state.skills, "skl_qualificar");
    expect(criarRascunhoDaHabilidade(state, "mem_rafael", skill.id).ok).toBe(true);
    expect(erroDe(criarRascunhoDaHabilidade(state, "mem_rafael", skill.id))).toBe("A Habilidade já tem um rascunho: edite-o ou descarte-o (RN-HAB-04).");
    expect(erroDe(criarRascunhoDaHabilidade(state, "mem_rafael", "skl_agenda"))).toBe("A Habilidade já tem um rascunho: edite-o ou descarte-o (RN-HAB-04).");
    expect(skill.versions).toHaveLength(2);

    // Descartar elimina o rascunho; o próximo nasce com o número seguinte ao maior que existe.
    expect(descartarRascunhoDaHabilidade(state, "mem_rafael", skill.id).ok).toBe(true);
    expect(skill.versions.map((v) => v.number)).toEqual([1]);
    expect(state.activity[0]).toMatchObject({ action: "Rascunho descartado", before: "v2" });
    expect(criarRascunhoDaHabilidade(state, "mem_rafael", skill.id).ok).toBe(true);
    expect(rascunhoDaHabilidade(skill)?.number).toBe(2);
    expect(erroDe(descartarRascunhoDaHabilidade(state, "mem_rafael", "skl_agenda"))).toBe("Este é a única Versão da Habilidade: descartá-la a deixaria vazia (INV-HAB-01).");
    expect(registro(state.skills, "skl_agenda").versions).toHaveLength(1);
    expect(erroDe(editarRascunhoDaHabilidade(state, "mem_rafael", "skl_resumir", { instructions: "x" }))).toBe("Não há rascunho: crie um a partir de uma Versão (12.2).");
  });

  it("8. obsoletar a Versão 1 torna a Concessão fixada nela indisponível; só uma publicada é obsoletada", () => {
    const skill = registro(state.skills, "skl_proposta");
    const concessao = registro(state.skillGrants, "sgr_4");
    expect(disponibilidadeDaConcessao(state, concessao)).toEqual({ disponivel: true });
    expect(erroDe(obsoletarVersaoDaHabilidade(state, "mem_julia", skill.id, 1))).toBe("Publicar e obsoletar exigem administrar esta Habilidade: o Criador ou um Administrador.");

    const r = obsoletarVersaoDaHabilidade(state, "mem_rafael", skill.id, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ number: 1, state: "obsoleta" });
    expect(disponibilidadeDaConcessao(state, concessao)).toEqual({ disponivel: false, motivos: ["Versão fixada 1 obsoleta"] });
    // A corrente segue a publicada de maior número; a Concessão que a segue continua disponível.
    expect(versaoCorrenteDaHabilidade(skill)?.number).toBe(2);
    expect(state.activity[0]).toMatchObject({
      action: "Versão de Habilidade obsoletada",
      before: "versão 1 publicada",
      after: "versão 1 obsoleta",
      detail: "1 Concessão fixada nesta Versão fica indisponível.",
    });
    expect(erroDe(obsoletarVersaoDaHabilidade(state, "mem_rafael", skill.id, 1))).toBe("Só uma Versão publicada é obsoletada.");
    expect(erroDe(obsoletarVersaoDaHabilidade(state, "mem_rafael", skill.id, 7))).toBe("Versão não encontrada.");
  });
});

describe("Habilidades — Concessões", () => {
  it("9. conceder cria a Concessão e uma Versão de Agente; recusa duplicada e fixação em rascunho", () => {
    const agent = registro(state.agents, "agt_enriquecedor");
    expect(agent.versions).toHaveLength(1);

    const r = concederHabilidade(state, "mem_julia", { agentId: agent.id, skillId: "skl_followup" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const grant = r.value;
    expect(r.id).toBe(grant.id);
    expect(grant).toMatchObject({ agentId: agent.id, skillId: "skl_followup", grantedBy: "mem_julia" });
    expect(grant.pinnedVersion).toBeUndefined();
    expect(state.skillGrants.some((g) => g.id === grant.id)).toBe(true);
    // D8 — a Versão nova é cópia da corrente, com as Habilidades relidas das Concessões e o motivo.
    expect(agent.versions).toHaveLength(2);
    const v2 = agent.versions[1];
    expect(v2).toMatchObject({
      number: 2,
      grantedSkillIds: ["skl_analisar_perfil", "skl_followup"],
      allowedToolIds: agent.versions[0]?.allowedToolIds,
      autonomy: "autonomo",
      reason: "Habilidade “Redigir follow-up” concedida",
      by: { kind: "member", id: "mem_julia" },
    });
    expect(state.activity[0]).toMatchObject({ action: "Habilidade concedida", objectType: "agent", objectId: agent.id, detail: "Redigir follow-up", after: "versão 2" });

    expect(concederHabilidade(state, "mem_julia", { agentId: agent.id, skillId: "skl_followup" })).toEqual({
      ok: false,
      error: "Esta Habilidade já está concedida a este Agente.",
      field: "habilidade",
    });
    // RN-HAB-03 — só uma Versão publicada é fixada; a v1 de “Sugerir plano de estudo” é rascunho.
    expect(concederHabilidade(state, "mem_julia", { agentId: agent.id, skillId: "skl_agenda", pinnedVersion: 1 })).toEqual({
      ok: false,
      error: "Só uma Versão publicada pode ser fixada (RN-HAB-03).",
      field: "versao",
    });
    // RN-HAB-12 — conceder exige `editar` no Agente: Júlia não governa o Qualificador SDR (do Rafael).
    expect(erroDe(concederHabilidade(state, "mem_julia", { agentId: "agt_sdr", skillId: "skl_followup" }))).toBe(
      "Editar este Agente exige ser o seu Proprietário ou administrar o Espaço de Trabalho.",
    );
    expect(erroDe(concederHabilidade(state, "mem_beatriz", { agentId: agent.id, skillId: "skl_proposta" }))).toBe("O Papel Convidado não edita Agente.");
    expect(agent.versions).toHaveLength(2);

    // Fixar uma publicada passa, e o detalhe registra a Versão.
    const fixada = concederHabilidade(state, "mem_julia", { agentId: agent.id, skillId: "skl_proposta", pinnedVersion: 1 });
    expect(fixada.ok).toBe(true);
    if (!fixada.ok) return;
    expect(fixada.value.pinnedVersion).toBe(1);
    expect(agent.versions[2]?.grantedSkillIds).toEqual(["skl_analisar_perfil", "skl_followup", "skl_proposta"]);
    expect(state.activity[0]).toMatchObject({ detail: "Redigir proposta comercial · versão fixada 1" });

    // Um Agente arquivado não recebe Concessões.
    registro(state.agents, "agt_classificador").lifecycle = "arquivado";
    expect(erroDe(concederHabilidade(state, "mem_julia", { agentId: "agt_classificador", skillId: "skl_followup" }))).toBe("Um Agente arquivado ou na lixeira não recebe Concessões.");
  });

  it("10. revogar remove a Concessão e cria uma Versão de Agente", () => {
    const agent = registro(state.agents, "agt_enriquecedor");
    expect(erroDe(revogarHabilidade(state, "mem_beatriz", "sgr_6"))).toBe("O Papel Convidado não edita Agente.");
    expect(erroDe(revogarHabilidade(state, "mem_marcos", "sgr_6"))).toBe("Editar este Agente exige ser o seu Proprietário ou administrar o Espaço de Trabalho.");

    const r = revogarHabilidade(state, "mem_julia", "sgr_6");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.id).toBe("sgr_6");
    expect(r.id).toBe(agent.id);
    expect(state.skillGrants.some((g) => g.id === "sgr_6")).toBe(false);
    expect(agent.versions).toHaveLength(2);
    expect(agent.versions[1]).toMatchObject({ number: 2, grantedSkillIds: [], reason: "Habilidade “Analisar perfil público” revogada" });
    expect(state.activity[0]).toMatchObject({ action: "Habilidade revogada", objectType: "agent", objectId: agent.id, detail: "Analisar perfil público", after: "versão 2" });
    expect(erroDe(revogarHabilidade(state, "mem_julia", "sgr_6"))).toBe("Concessão não encontrada.");
  });

  it("11. uma Ferramenta obrigatória não permitida ao Agente deixa a Concessão indisponível, com motivo", () => {
    // “Redigir follow-up” passa a exigir Mesclar Contatos, que o Enriquecedor não tem permitida.
    corrente(registro(state.skills, "skl_followup")).toolRequirements = [{ toolId: "mesclar_contatos", mandatory: true }];
    const r = concederHabilidade(state, "mem_julia", { agentId: "agt_enriquecedor", skillId: "skl_followup" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // A Concessão nasce (INV-HAB-06: conceder não amplia nada); a Disponibilidade é derivada.
    expect(disponibilidadeDaConcessao(state, r.value)).toEqual({ disponivel: false, motivos: ["Ferramenta obrigatória “Mesclar Contatos” não permitida ao Agente"] });
    // Opcional, não conta.
    corrente(registro(state.skills, "skl_followup")).toolRequirements = [{ toolId: "mesclar_contatos", mandatory: false }];
    expect(disponibilidadeDaConcessao(state, r.value)).toEqual({ disponivel: true });
  });
});
