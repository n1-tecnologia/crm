/**
 * Integrações (01, 7.4; B35): conectar e desconectar com os efeitos que a
 * ontologia liga ao estado da conexão. Cada teste afirma o RESULTADO no
 * estado e no Registro de Atividade, nunca que uma função foi chamada.
 *
 * O seed traz `int_agenda` desconectada (a Ferramenta "permitida e
 * inoperante") e `int_erp` conectada; a Fonte `integracao` e a Concessão que
 * exige a Ferramenta da Agenda são montadas aqui, porque nenhum seed as tem.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../../seed";
import type { DataState } from "../../state";
import type { KnowledgeSource, SkillGrant } from "../../types";
import { disponibilidadeDaConcessao, versaoCorrenteDaHabilidade, versaoCorrenteDoAgente } from "../../derive-ia";
import { conectarIntegracao, desconectarIntegracao, ferramentasDaIntegracao, impactoDaIntegracao } from "./integracoes";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const registro = <T extends { readonly id: string }>(lista: readonly T[], id: string): T => {
  const item = lista.find((x) => x.id === id);
  if (!item) throw new Error(`seed sem ${id}`);
  return item;
};

/** Uma Fonte `integracao` da Agenda em "Material comercial", nascida com erro porque a Integração está desconectada (20.6). */
function fonteDaAgenda(): KnowledgeSource {
  const fonte: KnowledgeSource = {
    id: "src_col_comercial_agenda",
    kind: "integracao",
    name: "Agenda (Google)",
    config: "int_agenda",
    configuredByMemberId: "mem_thiago",
    state: "comErro",
  };
  registro(state.collections, "col_comercial").sources.push(fonte);
  return fonte;
}

/** "Qualificar lead" passa a exigir a Ferramenta da Agenda e o Qualificador SDR a permite: a Concessão sgr_1 só depende da conexão. */
function concessaoQueExigeAAgenda(): SkillGrant {
  const corrente = versaoCorrenteDaHabilidade(registro(state.skills, "skl_qualificar"));
  if (!corrente) throw new Error("seed sem Versão corrente");
  corrente.toolRequirements = [{ toolId: "agenda_criar_evento", mandatory: true }];
  const versao = versaoCorrenteDoAgente(registro(state.agents, "agt_sdr"));
  if (!versao) throw new Error("seed sem Versão do Agente");
  versao.allowedToolIds.push("agenda_criar_evento");
  return registro(state.skillGrants, "sgr_1");
}

describe("Integrações — conectar e desconectar", () => {
  it("conectar a Agenda reativa a Fonte com erro, torna a Concessão disponível e registra quem conectou", () => {
    const fonte = fonteDaAgenda();
    const concessao = concessaoQueExigeAAgenda();
    expect(disponibilidadeDaConcessao(state, concessao)).toEqual({
      disponivel: false,
      motivos: ["Ferramenta “Criar evento na agenda” de Integração desconectada"],
    });

    const antes = impactoDaIntegracao(state, registro(state.integrations, "int_agenda"), "conectada");
    expect(antes.ferramentas.map((t) => t.id)).toEqual(["agenda_criar_evento"]);
    expect(antes.concessoes.map((g) => g.id)).toEqual(["sgr_1"]);
    expect(antes.habilidades).toBe(1);
    expect(antes.fontes.map((f) => f.fonte.id)).toEqual(["src_col_comercial_agenda"]);

    const r = conectarIntegracao(state, "mem_thiago", "int_agenda");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.id).toBe("int_agenda");
    const integracao = registro(state.integrations, "int_agenda");
    expect(integracao.state).toBe("conectada");
    expect(integracao.configuredBy).toBe("mem_thiago");
    expect(fonte.state).toBe("ativo");
    expect(fonte.lastUpdateResult).toBe("Integração “Agenda (Google)” reconectada");
    expect(disponibilidadeDaConcessao(state, concessao)).toEqual({ disponivel: true });

    const ato = state.activity[0];
    expect(ato?.action).toBe("Integração conectada");
    expect(ato?.objectType).toBe("integration");
    expect(ato?.objectId).toBe("int_agenda");
    expect(ato?.actor).toEqual({ kind: "member", id: "mem_thiago" });
    expect(ato?.before).toBe("desconectada");
    expect(ato?.after).toBe("conectada");
    expect(ato?.detail).toBe("1 Ferramenta(s) operante(s); 1 Habilidade(s) com Concessão disponível de novo; 1 Fonte(s) de Conhecimento reativada(s)");

    expect(conectarIntegracao(state, "mem_thiago", "int_agenda")).toEqual({ ok: false, error: "A Integração já está conectada." });
  });

  it("desconectar torna a Fonte com erro e a Concessão indisponível; reconectar reverte", () => {
    const fonte = fonteDaAgenda();
    const concessao = concessaoQueExigeAAgenda();
    expect(conectarIntegracao(state, "mem_rafael", "int_agenda").ok).toBe(true);
    expect(fonte.state).toBe("ativo");
    expect(disponibilidadeDaConcessao(state, concessao).disponivel).toBe(true);

    // Uma Fonte pausada pelo Ator fica como ele a deixou: não é "erro" o que ninguém tentou atualizar.
    const pausada: KnowledgeSource = { id: "src_col_clinico_agenda", kind: "integracao", name: "Agenda (Google)", config: "int_agenda", state: "pausado" };
    registro(state.collections, "col_clinico").sources.push(pausada);

    const r = desconectarIntegracao(state, "mem_rafael", "int_agenda");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.id).toBe("int_agenda");
    expect(registro(state.integrations, "int_agenda").state).toBe("desconectada");
    expect(fonte.state).toBe("comErro");
    expect(fonte.lastUpdateResult).toBe("Integração “Agenda (Google)” desconectada");
    expect(pausada.state).toBe("pausado");
    // A Ferramenta segue permitida ao Agente; o que muda é a Disponibilidade da Concessão, por leitura.
    expect(versaoCorrenteDoAgente(registro(state.agents, "agt_sdr"))?.allowedToolIds).toContain("agenda_criar_evento");
    const depois = disponibilidadeDaConcessao(state, concessao);
    expect(depois.disponivel).toBe(false);
    if (depois.disponivel) return;
    expect(depois.motivos).toEqual(["Ferramenta “Criar evento na agenda” de Integração desconectada"]);

    const ato = state.activity[0];
    expect(ato?.action).toBe("Integração desconectada");
    expect(ato?.objectType).toBe("integration");
    expect(ato?.before).toBe("conectada");
    expect(ato?.after).toBe("desconectada");
    expect(ato?.detail).toBe("1 Ferramenta(s) inoperante(s); 1 Habilidade(s) com Concessão indisponível; 1 Fonte(s) de Conhecimento com erro");

    expect(desconectarIntegracao(state, "mem_rafael", "int_agenda")).toEqual({ ok: false, error: "A Integração já está desconectada." });

    // Reconectar devolve a Fonte a `ativo` e a Concessão a disponível; a pausada continua pausada.
    expect(conectarIntegracao(state, "mem_rafael", "int_agenda").ok).toBe(true);
    expect(fonte.state).toBe("ativo");
    expect(pausada.state).toBe("pausado");
    expect(disponibilidadeDaConcessao(state, concessao)).toEqual({ disponivel: true });
  });

  it("uma Concessão já indisponível por outro motivo não entra na conta do ato", () => {
    const corrente = versaoCorrenteDaHabilidade(registro(state.skills, "skl_qualificar"));
    if (!corrente) throw new Error("seed sem Versão corrente");
    // Exige a Ferramenta da Agenda sem o Agente a permitir: indisponível antes e depois de conectar.
    corrente.toolRequirements = [{ toolId: "agenda_criar_evento", mandatory: true }];
    const r = conectarIntegracao(state, "mem_thiago", "int_agenda");
    expect(r.ok).toBe(true);
    expect(state.activity[0]?.detail).toBe("1 Ferramenta(s) operante(s); 0 Habilidade(s) com Concessão disponível de novo; 0 Fonte(s) de Conhecimento reativada(s)");
    expect(disponibilidadeDaConcessao(state, registro(state.skillGrants, "sgr_1"))).toEqual({
      disponivel: false,
      motivos: ["Ferramenta obrigatória “Criar evento na agenda” não permitida ao Agente"],
    });
  });

  it("um Membro que não administra o Espaço, um Convidado e um Membro removido são recusados sem efeito", () => {
    const erp = registro(state.integrations, "int_erp");
    const atosAntes = state.activity.length;
    const recusa = "Conectar ou desconectar uma Integração é ato de Administrador (B35).";
    expect(desconectarIntegracao(state, "mem_julia", "int_erp")).toEqual({ ok: false, error: recusa });
    expect(desconectarIntegracao(state, "mem_beatriz", "int_erp")).toEqual({ ok: false, error: recusa });
    expect(conectarIntegracao(state, "mem_julia", "int_agenda")).toEqual({ ok: false, error: recusa });
    expect(desconectarIntegracao(state, "mem_tiago", "int_erp")).toEqual({ ok: false, error: "Só um Membro ativo age sobre a IA do Espaço de Trabalho." });
    expect(erp.state).toBe("conectada");
    expect(erp.configuredBy).toBe("mem_rafael");
    expect(registro(state.integrations, "int_agenda").state).toBe("desconectada");
    expect(state.activity).toHaveLength(atosAntes);

    expect(desconectarIntegracao(state, "mem_thiago", "int_inexistente")).toEqual({ ok: false, error: "Integração não encontrada." });
  });

  it("o Administrador desconecta o ERP conectado do seed e o Proprietário o reconecta, tornando-se o configurador", () => {
    const erp = registro(state.integrations, "int_erp");
    expect(ferramentasDaIntegracao(state, erp).map((t) => t.id)).toEqual(["erp_consultar_fatura"]);

    const r = desconectarIntegracao(state, "mem_rafael", "int_erp");
    expect(r.ok).toBe(true);
    expect(erp.state).toBe("desconectada");
    expect(state.activity[0]?.detail).toBe("1 Ferramenta(s) inoperante(s); 0 Habilidade(s) com Concessão indisponível; 0 Fonte(s) de Conhecimento com erro");

    expect(conectarIntegracao(state, "mem_thiago", "int_erp").ok).toBe(true);
    expect(erp.state).toBe("conectada");
    expect(erp.configuredBy).toBe("mem_thiago");
    expect(state.activity[0]?.action).toBe("Integração conectada");
  });
});
