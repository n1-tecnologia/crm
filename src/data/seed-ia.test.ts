/**
 * O seed da área de IA precisa dizer a verdade: o Catálogo tem toda
 * Ferramenta que as Automações seedadas usam, cada Automação publicada nasce
 * operante e válida, os textos de Personalizar são próprios (não o nome
 * repetido nem um modelo por Habilidade) e a Versão 1 de cada Agente
 * fotografa as Concessões com que ele nasce.
 */

import { describe, expect, it } from "vitest";
import { inoperante, versaoCorrenteDoAgente, versaoVigenteDaAutomacao } from "./derive-ia";
import { eventoCompativel } from "./operations/ia/automacoes-catalogo";
import { validarAutomacao } from "./operations/ia/automacoes-validacao";
import { permitirFerramenta } from "./operations/ia/agentes";
import { buildSeed } from "./seed";
import { buildProductSeed } from "./seed-produto";

const SEEDS = [
  ["completo", buildSeed],
  ["produto", buildProductSeed],
] as const;

describe("seed da IA — Automações", () => {
  it("nenhuma Automação publicada do seed nasce inoperante nem com problema de validação", () => {
    for (const [nome, build] of SEEDS) {
      const state = build();
      const publicadas = state.automations.filter((a) => versaoVigenteDaAutomacao(a) !== undefined);
      expect(publicadas.length, nome).toBeGreaterThanOrEqual(20);
      for (const automacao of publicadas) {
        const vigente = versaoVigenteDaAutomacao(automacao);
        if (!vigente) continue;
        const problemas = validarAutomacao(state, automacao, vigente).map((p) => `${p.regra}: ${p.mensagem}`);
        expect(problemas, `${nome} · ${automacao.id}`).toEqual([]);
        expect(inoperante(state, automacao), `${nome} · ${automacao.id}`).toBeUndefined();
      }
    }
  });

  it("as Ferramentas do processo comercial estão no Catálogo, com permissão e classe de efeito da ontologia de Negócio", () => {
    const state = buildSeed();
    const porId = new Map(state.tools.map((t) => [t.id, t]));
    // Toda Ferramenta que uma Ação de Automação seedada cita existe.
    for (const a of state.automations) {
      for (const v of a.versions) {
        for (const acao of v.actions) if (acao.kind === "escrita" && acao.toolId) expect(porId.has(acao.toolId), `${a.id} → ${acao.toolId}`).toBe(true);
      }
    }
    // negocios.md 17: mover é `editar`; perder é `editar` de classe irreversível (RN-NEG-21); transferir Proprietário é `administrar`.
    expect(porId.get("criar_negocio")).toMatchObject({ targetResourceType: "funnel", requiredAction: "criar", effectClass: "escritaReversivel", origin: "plataforma" });
    expect(porId.get("vincular_conversa_negocio")).toMatchObject({ targetResourceType: "deal", requiredAction: "editar", effectClass: "escritaReversivel" });
    expect(porId.get("mover_negocio_etapa")).toMatchObject({ targetResourceType: "deal", requiredAction: "editar", effectClass: "escritaReversivel" });
    expect(porId.get("mover_negocio_funil")).toMatchObject({ targetResourceType: "deal", requiredAction: "editar", effectClass: "escritaReversivel" });
    expect(porId.get("marcar_negocio_perdido")).toMatchObject({ targetResourceType: "deal", requiredAction: "editar", effectClass: "escritaIrreversivel" });
    expect(porId.get("atualizar_campos_contato")).toMatchObject({ targetResourceType: "contact", requiredAction: "editar", effectClass: "escritaReversivel" });
    expect(porId.get("atualizar_campos_negocio")).toMatchObject({ targetResourceType: "deal", requiredAction: "editar", effectClass: "escritaReversivel" });
    expect(porId.get("alterar_proprietario_negocio")).toMatchObject({ targetResourceType: "deal", requiredAction: "administrar", effectClass: "escritaReversivel" });
    // Nenhum id repetido no Catálogo.
    expect(new Set(state.tools.map((t) => t.id)).size).toBe(state.tools.length);
  });

  it("o Evento da Caixa “Contato criado por Mensagem” ocorre na Caixa de Entrada e na Fila; “Contato criado” segue só no Espaço de Trabalho (RN-AUT-07)", () => {
    expect(eventoCompativel("inbox", "contatoCriadoPorMensagem")).toBe(true);
    expect(eventoCompativel("queue", "contatoCriadoPorMensagem")).toBe(true);
    expect(eventoCompativel("workspace", "contatoCriadoPorMensagem")).toBe(true);
    expect(eventoCompativel("list", "contatoCriadoPorMensagem")).toBe(false);
    expect(eventoCompativel("funnel", "contatoCriadoPorMensagem")).toBe(false);
    expect(eventoCompativel("inbox", "contatoCriado")).toBe(false);
    expect(eventoCompativel("workspace", "contatoCriado")).toBe(true);
    // A porta de entrada do SDR escuta o Evento da Caixa, no escopo da Caixa.
    const state = buildSeed();
    const entrada = state.automations.find((a) => a.id === "aut_sdr_entrada");
    expect(entrada?.scopeType).toBe("inbox");
    expect(versaoVigenteDaAutomacao(entrada!)?.trigger).toEqual({ kind: "evento", eventType: "contatoCriadoPorMensagem" });
  });

  it("cada Automação do processo comercial escuta um Evento que ocorre no seu escopo: Mensagem na Caixa, Negócio no Funil, Tarefa na Lista", () => {
    const state = buildSeed();
    const escopoDe = (id: string) => {
      const a = state.automations.find((x) => x.id === id);
      if (!a) throw new Error(`seed sem ${id}`);
      return { scopeType: a.scopeType, scopeId: a.scopeId, eventType: versaoVigenteDaAutomacao(a)?.trigger?.kind === "evento" ? versaoVigenteDaAutomacao(a)?.trigger?.eventType : undefined };
    };
    expect(escopoDe("aut_sdr_abordagem")).toEqual({ scopeType: "inbox", scopeId: "inbox_n1", eventType: "mensagemEnviada" });
    expect(escopoDe("aut_sdr_resposta")).toEqual({ scopeType: "inbox", scopeId: "inbox_n1", eventType: "mensagemRecebida" });
    expect(escopoDe("aut_sdr_conexao")).toEqual({ scopeType: "inbox", scopeId: "inbox_n1", eventType: "mensagemRecebida" });
    expect(escopoDe("aut_sdr_enriquecimento")).toEqual({ scopeType: "funnel", scopeId: "fnl_sdr", eventType: "negocioEntrouEmEtapa" });
    expect(escopoDe("aut_clo_proposta")).toEqual({ scopeType: "list", scopeId: "lst_funil_closer", eventType: "tarefaAtualizada" });
    // A Lista espelho do Closer existe nos dois seeds (o escopo não fica pendurado).
    for (const [, build] of SEEDS) expect(build().lists.some((l) => l.id === "lst_funil_closer")).toBe(true);
  });
});

describe("seed da IA — textos de Personalizar", () => {
  it("toda Ferramenta do Catálogo tem uma descrição própria, em uma frase, diferente do nome", () => {
    const state = buildSeed();
    expect(state.tools.length).toBeGreaterThanOrEqual(39);
    for (const tool of state.tools) {
      expect(tool.description.trim().length, tool.id).toBeGreaterThan(20);
      expect(tool.description.trim().toLocaleLowerCase("pt-BR"), tool.id).not.toBe(tool.name.trim().toLocaleLowerCase("pt-BR"));
      expect(tool.description.trim().endsWith("."), tool.id).toBe(true);
    }
    expect(new Set(state.tools.map((t) => t.description)).size).toBe(state.tools.length);
  });

  it("toda Habilidade tem uma descrição própria, não um modelo derivado do nome", () => {
    const state = buildSeed();
    expect(state.skills).toHaveLength(9);
    for (const skill of state.skills) {
      expect(skill.description, skill.id).not.toMatch(/^Competência reutilizável/);
      expect(skill.description.trim().length, skill.id).toBeGreaterThan(20);
      expect(skill.description.toLocaleLowerCase("pt-BR"), skill.id).not.toBe(skill.name.toLocaleLowerCase("pt-BR"));
    }
    expect(new Set(state.skills.map((s) => s.description)).size).toBe(state.skills.length);
  });

  it("nenhum Agente repete a descrição nem o objetivo de outro; Enriquecedor e Classificador têm texto próprio", () => {
    const state = buildSeed();
    const ativos = state.agents.filter((a) => a.lifecycle !== "naLixeira");
    expect(new Set(ativos.map((a) => a.description)).size).toBe(ativos.length);
    expect(new Set(ativos.map((a) => versaoCorrenteDoAgente(a)?.objective)).size).toBe(ativos.length);
    const enriquecedor = ativos.find((a) => a.id === "agt_enriquecedor");
    const classificador = ativos.find((a) => a.id === "agt_classificador");
    expect(enriquecedor?.description).toMatch(/perfil/i);
    expect(classificador?.description).toMatch(/conexão/i);
    expect(enriquecedor?.description).not.toMatch(/proposta/i);
    expect(classificador?.description).not.toMatch(/proposta/i);
    // O Enriquecedor só lê e grava Valor de Campo — não fala com o lead; o Classificador só lê.
    expect(versaoCorrenteDoAgente(enriquecedor!)?.allowedToolIds).not.toContain("enviar_mensagem");
    expect(versaoCorrenteDoAgente(enriquecedor!)?.allowedToolIds).toContain("atualizar_campos_contato");
    for (const id of versaoCorrenteDoAgente(classificador!)?.allowedToolIds ?? []) expect(state.tools.find((t) => t.id === id)?.effectClass, id).toBe("leitura");
  });
});

describe("seed da IA — a foto da Versão 1 do Agente", () => {
  it("a Versão 1 de cada Agente grava as Habilidades das Concessões seedadas (DO-AGE-02)", () => {
    const state = buildSeed();
    for (const agent of state.agents) {
      const concedidas = state.skillGrants.filter((g) => g.agentId === agent.id).map((g) => g.skillId).sort();
      const v1 = agent.versions.find((v) => v.number === 1);
      expect([...(v1?.grantedSkillIds ?? [])].sort(), agent.id).toEqual(concedidas);
    }
    expect(state.agents.find((a) => a.id === "agt_sdr")?.versions[0]?.grantedSkillIds.length).toBe(4);
  });

  it("a Versão criada por permitir Ferramenta continua fotografando as mesmas Habilidades — não um conjunto vazio", () => {
    const state = buildSeed();
    const antes = state.skillGrants.filter((g) => g.agentId === "agt_sdr").map((g) => g.skillId).sort();
    const r = permitirFerramenta(state, "mem_rafael", "agt_sdr", "ler_tarefa");
    expect(r.ok).toBe(true);
    const v2 = versaoCorrenteDoAgente(state.agents.find((a) => a.id === "agt_sdr")!);
    expect(v2?.number).toBe(2);
    expect([...(v2?.grantedSkillIds ?? [])].sort()).toEqual(antes);
  });
});
