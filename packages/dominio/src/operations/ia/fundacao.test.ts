/**
 * A fundação da área de IA: o catálogo do editor de Automação, as recusas
 * numa só voz e as leituras derivadas que os módulos seguintes compartilham.
 * Cada teste afirma o RESULTADO, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../../seed";
import type { DataState } from "../../state";
import {
  disponibilidadeDaConcessao,
  disponibilidadeDoAgente,
  efeitoDeclarado,
  fragmentarTexto,
  inoperante,
  versaoCorrenteDaHabilidade,
} from "../../derive-ia";
import { EVENTOS, FERRAMENTAS_QUE_EXECUTAM, escopoExecutaNoPrototipo, escopoExiste, eventoCompativel } from "./automacoes-catalogo";
import {
  recusaDeAdministrarAutomacao,
  recusaDeAdministrarIntegracao,
  recusaDeConvidado,
  recusaDeGovernarAgente,
  recusaDeGovernarHabilidade,
  recusaNaColecao,
} from "./permissoes-ia";
import { TRIGGER_EVENT_LABEL } from "../../rotulos";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const registro = <T extends { readonly id: string }>(lista: readonly T[], id: string): T => {
  const item = lista.find((x) => x.id === id);
  if (!item) throw new Error(`seed sem ${id}`);
  return item;
};

describe("Catálogo do editor de Automação", () => {
  it("o Evento de Grupo ocorre no escopo Grupo, Comunidade e Espaço de Trabalho — e não numa Lista", () => {
    expect(eventoCompativel("grupo", "contatoEntrouNoGrupo")).toBe(true);
    expect(eventoCompativel("comunidade", "contatoEntrouNoGrupo")).toBe(true);
    expect(eventoCompativel("workspace", "contatoEntrouNoGrupo")).toBe(true);
    expect(eventoCompativel("list", "contatoEntrouNoGrupo")).toBe(false);
    expect(eventoCompativel("list", "tarefaCriada")).toBe(true);
    expect(eventoCompativel("funnel", "tarefaCriada")).toBe(false);
    // Fora do catálogo não é compatível com nada.
    expect(eventoCompativel("workspace", "eventoInventado")).toBe(false);
    expect(eventoCompativel("workspace", undefined)).toBe(false);
  });

  it("todo Evento que os seeds usam está no catálogo e tem rótulo", () => {
    const usados = new Set<string>();
    for (const a of state.automations) for (const v of a.versions) if (v.trigger?.kind === "evento" && v.trigger.eventType) usados.add(v.trigger.eventType);
    expect(usados.size).toBeGreaterThan(0);
    for (const id of usados) expect(EVENTOS.some((e) => e.id === id), id).toBe(true);
    for (const e of EVENTOS) expect(TRIGGER_EVENT_LABEL[e.id]).toBe(e.rotulo);
  });

  it("o escopo existe pelo id da coleção certa; o Espaço de Trabalho é o próprio", () => {
    expect(escopoExiste(state, "workspace", state.workspace.id)).toBe(true);
    expect(escopoExiste(state, "list", "lst_revisoes")).toBe(true);
    expect(escopoExiste(state, "queue", "fila_com")).toBe(true);
    expect(escopoExiste(state, "grupo", "grp_turma_01")).toBe(true);
    expect(escopoExiste(state, "list", "grp_turma_01")).toBe(false);
    expect(escopoExiste(state, "space", "lst_revisoes")).toBe(false);
  });

  it("marca o que os motores executam: Lista por Tarefa, Grupo pelos Eventos de Grupo; o resto não", () => {
    expect(escopoExecutaNoPrototipo("list", { kind: "evento", eventType: "tarefaCriada" })).toBe(true);
    expect(escopoExecutaNoPrototipo("list", { kind: "condicaoTemporal", temporalPredicate: "{}" })).toBe(true);
    expect(escopoExecutaNoPrototipo("grupo", { kind: "evento", eventType: "contatoEntrouNoGrupo" })).toBe(true);
    expect(escopoExecutaNoPrototipo("flow", { kind: "evento", eventType: "respostaDeFlowRecebida" })).toBe(true);
    expect(escopoExecutaNoPrototipo("queue", { kind: "evento", eventType: "conversaCriada" })).toBe(false);
    expect(escopoExecutaNoPrototipo("list", { kind: "manual" })).toBe(false);
    expect(escopoExecutaNoPrototipo("list", undefined)).toBe(false);
  });

  it("as Ferramentas que os motores executam existem no Catálogo do seed", () => {
    for (const id of FERRAMENTAS_QUE_EXECUTAM) expect(state.tools.some((t) => t.id === id), id).toBe(true);
    const agenda = registro(state.tools, "agenda_criar_evento");
    expect(agenda.origin).toBe("integracao");
    expect(agenda.integrationId).toBe("int_agenda");
    expect(registro(state.integrations, "int_agenda").state).toBe("desconectada");
  });
});

describe("Permissões da IA numa só voz", () => {
  it("o Convidado é recusado em tudo; o Administrador passa", () => {
    const agente = registro(state.agents, "agt_sdr");
    const habilidade = registro(state.skills, "skl_qualificar");
    const colecao = registro(state.collections, "col_comercial");
    const automacao = registro(state.automations, "aut_rascunho");

    expect(recusaDeConvidado(state, "mem_beatriz", "cria Habilidade")).toBe("O Papel Convidado não cria Habilidade.");
    expect(recusaDeGovernarAgente(state, "mem_beatriz", agente, "administrar")).toBe("O Papel Convidado não edita Agente.");
    expect(recusaDeGovernarHabilidade(state, "mem_beatriz", habilidade, "editar")).toBe("O Papel Convidado não edita Habilidade.");
    expect(recusaNaColecao(state, "mem_beatriz", colecao, "criar")).toBe("O Papel Convidado não age sobre Coleções.");
    expect(recusaDeAdministrarAutomacao(state, "mem_beatriz", automacao, "publicar")).toBe("Publicar uma Versão exige administrar esta Automação.");
    expect(recusaDeAdministrarIntegracao(state, "mem_beatriz")).toBe("Conectar ou desconectar uma Integração é ato de Administrador (B35).");

    expect(recusaDeConvidado(state, "mem_rafael", "cria Habilidade")).toBeUndefined();
    expect(recusaDeGovernarAgente(state, "mem_rafael", registro(state.agents, "agt_enriquecedor"), "administrar")).toBeUndefined();
    expect(recusaDeGovernarHabilidade(state, "mem_rafael", habilidade, "administrar")).toBeUndefined();
    expect(recusaNaColecao(state, "mem_rafael", colecao, "administrar")).toBeUndefined();
    expect(recusaDeAdministrarAutomacao(state, "mem_rafael", automacao, "editar")).toBeUndefined();
    expect(recusaDeAdministrarIntegracao(state, "mem_rafael")).toBeUndefined();
  });

  it("um Membro governa só o que é dele; a Coleção privada não abre nem ao Administrador", () => {
    // Júlia é Proprietária do Enriquecedor, não do Qualificador SDR (do Rafael).
    expect(recusaDeGovernarAgente(state, "mem_julia", registro(state.agents, "agt_enriquecedor"), "editar")).toBeUndefined();
    expect(recusaDeGovernarAgente(state, "mem_julia", registro(state.agents, "agt_sdr"), "editar")).toBe(
      "Editar este Agente exige ser o seu Proprietário ou administrar o Espaço de Trabalho.",
    );
    expect(recusaDeGovernarHabilidade(state, "mem_julia", registro(state.skills, "skl_triagem"), "editar")).toBe(
      "Uma Habilidade da plataforma não é editada pelo Espaço de Trabalho: copie-a (INV-HAB-07).",
    );
    const privada = registro(state.collections, "col_interno");
    expect(recusaNaColecao(state, "mem_rafael", privada, "criar")).toBe("Esta Coleção é privada: só o Proprietário age nela.");
    expect(recusaNaColecao(state, "mem_thiago", privada, "administrar")).toBeUndefined();
    // Um Membro removido não age, com o verbo da ação.
    expect(recusaDeAdministrarAutomacao(state, "mem_tiago", registro(state.automations, "aut_rascunho"), "publicar")).toBe(
      "Só um Membro ativo publica uma Versão de Automação.",
    );
  });
});

describe("Leituras derivadas da IA", () => {
  it("fragmenta um texto colado em um Fragmento por parágrafo", () => {
    const fragmentos = fragmentarTexto("Primeiro parágrafo.\n\nSegundo, com duas linhas\nde texto.\n\n\n  Terceiro.  \n");
    expect(fragmentos).toHaveLength(3);
    expect(fragmentos.map((f) => f.position.locator)).toEqual(["p1", "p2", "p3"]);
    expect(fragmentos[1]?.derivedContent).toBe("Segundo, com duas linhas\nde texto.");
    expect(fragmentos[2]?.derivedContent).toBe("Terceiro.");
    expect(fragmentarTexto("   \n\n ")).toEqual([]);
  });

  it("a Concessão fixada em v1 de “Redigir proposta comercial” está disponível hoje e fica indisponível quando a Versão é obsoletada", () => {
    const concessao = registro(state.skillGrants, "sgr_4");
    expect(disponibilidadeDaConcessao(state, concessao)).toEqual({ disponivel: true });
    const v1 = registro(state.skills, "skl_proposta").versions.find((v) => v.number === 1);
    if (!v1) throw new Error("seed sem v1");
    v1.state = "obsoleta";
    const depois = disponibilidadeDaConcessao(state, concessao);
    expect(depois.disponivel).toBe(false);
    if (depois.disponivel) return;
    expect(depois.motivos).toEqual(["Versão fixada 1 obsoleta"]);
    // A corrente segue sendo a publicada de maior número, a v2.
    expect(versaoCorrenteDaHabilidade(registro(state.skills, "skl_proposta"))?.number).toBe(2);
  });

  it("uma Ferramenta obrigatória não permitida ao Agente torna a Concessão indisponível com motivo", () => {
    const v = versaoCorrenteDaHabilidade(registro(state.skills, "skl_qualificar"));
    if (!v) throw new Error("sem corrente");
    v.toolRequirements = [{ toolId: "mesclar_contatos", mandatory: true }];
    const r = disponibilidadeDaConcessao(state, registro(state.skillGrants, "sgr_1"));
    expect(r).toEqual({ disponivel: false, motivos: ["Ferramenta obrigatória “Mesclar Contatos” não permitida ao Agente"] });
    expect(efeitoDeclarado(state, v)).toBe("irreversivel");
  });

  it("o Assistente de onboarding é indisponível pelo Modelo descontinuado; a Automação ativa do seed não é inoperante", () => {
    const r = disponibilidadeDoAgente(state, registro(state.agents, "agt_onboarding"));
    expect(r).toEqual({ disponivel: false, motivos: ["Agente em rascunho", "Modelo “Modelo legado” descontinuado"] });
    expect(inoperante(state, registro(state.automations, "aut_boasvindas"))).toBeUndefined();
    // Um Proprietário suspenso torna a Automação inoperante sem ato.
    registro(state.members, "mem_julia").state = "suspenso";
    expect(inoperante(state, registro(state.automations, "aut_boasvindas"))).toBe("Proprietário suspenso");
  });
});
