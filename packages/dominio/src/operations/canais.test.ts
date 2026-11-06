/**
 * C36 — os canais de atendimento da Lista conversacional e a forma do
 * identificador de cada Tipo de Canal (criar e configurar Canal saíram na 15-32). Cada teste afirma o RESULTADO da operação e
 * o estado que ela deixou, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Canal } from "../crm/canais";
import { buildSeed } from "../seed";
import { semearCrmAntigo } from "../seed-crm-antigo";
import type { DataState } from "../state";
import { identificadorCanonico } from "./canais";
import { baseDoPapel } from "./ia/permissoes-ia";
import { createList } from "./structure";
import { alterarModeloDaLista, definirCanaisDaLista } from "./tarefas-conversacionais";

const THIAGO = "mem_thiago";

let state: DataState;
beforeEach(() => {
  // Testa código do CRM antigo que sai (15-32/15-42): o seed deixou de criar o CRM (15-31), então ele é semeado aqui.
  state = semearCrmAntigo(buildSeed());
});

/** Uma Lista conversacional recém-nascida, sem canais (virou conversacional depois de nascer). */
const listaConversacionalVazia = (): string => {
  const criada = createList(state, THIAGO, { name: "Suporte ao aluno", parentType: "space", parentId: "spc_com" });
  if (!criada.ok) throw new Error(criada.error);
  const virada = alterarModeloDaLista(state, THIAGO, criada.value.id, "conversacional");
  if (!virada.ok) throw new Error(virada.error);
  return criada.value.id;
};

describe("Canais de atendimento da Lista (C36)", () => {
  it("createList conversacional sem canais recusa; com canais grava e a Atividade diz por onde atende", () => {
    const sem = createList(state, THIAGO, { name: "Suporte", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional" });
    expect(sem.ok).toBe(false);
    if (!sem.ok) {
      expect(sem.error).toBe("Escolha ao menos um Canal de atendimento.");
      expect(sem.field).toBe("canais");
    }

    const com = createList(state, THIAGO, {
      name: "Suporte",
      parentType: "space",
      parentId: "spc_com",
      modeloDeTarefa: "conversacional",
      canaisDeAtendimento: ["chn_wpp", "chn_wpp", "chn_mail"],
    });
    expect(com.ok).toBe(true);
    if (!com.ok) return;
    // Sem repetição, na ordem em que foram marcados.
    expect(com.value.canaisDeAtendimento).toEqual(["chn_wpp", "chn_mail"]);
    const atividade = state.activity.find((a) => a.action === "Lista criada" && a.objectId === com.value.id);
    expect(atividade?.detail).toContain("Atende por Comercial SP, contato@institutoigoralves.com.br");
  });

  it("createList recusa Canal inexistente, Chat do site e canais numa Lista operacional", () => {
    const base = { name: "Suporte", parentType: "space" as const, parentId: "spc_com", modeloDeTarefa: "conversacional" as const };
    const inexistente = createList(state, THIAGO, { ...base, canaisDeAtendimento: ["chn_nada"] });
    expect(inexistente.ok).toBe(false);
    if (!inexistente.ok) expect(inexistente.error).toBe("Canal não encontrado ou arquivado.");

    const site = createList(state, THIAGO, { ...base, canaisDeAtendimento: ["chn_site"] });
    expect(site.ok).toBe(false);
    if (!site.ok) expect(site.error).toBe("Chat do site não é canal de atendimento de Lista.");

    const operacional = createList(state, THIAGO, { name: "Gestão", parentType: "space", parentId: "spc_com", canaisDeAtendimento: ["chn_wpp"] });
    expect(operacional.ok).toBe(false);
    if (!operacional.ok) expect(operacional.error).toBe("Só uma Lista conversacional tem canais de atendimento.");
    expect(state.lists.some((l) => l.name === "Suporte" || l.name === "Gestão")).toBe(false);
  });

  it("definirCanaisDaLista: grava com Atividade antes/depois; igual não grava; vazio e Lista operacional recusam; quem não administra recusa", () => {
    const listId = listaConversacionalVazia();

    const convidado = state.members.find((m) => m.state === "ativo" && baseDoPapel(state, m.id) === "convidado");
    if (convidado) {
      const recusa = definirCanaisDaLista(state, convidado.id, listId, ["chn_wpp"]);
      expect(recusa.ok).toBe(false);
    }

    const antes = state.activity.length;
    const gravado = definirCanaisDaLista(state, THIAGO, listId, ["chn_wpp"]);
    expect(gravado.ok).toBe(true);
    if (gravado.ok) expect(gravado.id).toBe(listId);
    expect(state.lists.find((l) => l.id === listId)?.canaisDeAtendimento).toEqual(["chn_wpp"]);
    expect(state.activity[0]?.action).toBe("Canais de atendimento alterados");
    expect(state.activity[0]?.before).toBe("nenhum");
    expect(state.activity[0]?.after).toBe("Comercial SP");
    expect(state.activity.length).toBe(antes + 1);

    const igual = definirCanaisDaLista(state, THIAGO, listId, ["chn_wpp"]);
    expect(igual.ok).toBe(true);
    expect(state.activity.length).toBe(antes + 1);

    const vazio = definirCanaisDaLista(state, THIAGO, listId, []);
    expect(vazio.ok).toBe(false);
    if (!vazio.ok) expect(vazio.error).toBe("Escolha ao menos um Canal de atendimento.");

    const operacional = definirCanaisDaLista(state, THIAGO, "lst_ativacao", ["chn_wpp"]);
    expect(operacional.ok).toBe(false);
    if (!operacional.ok) expect(operacional.error).toBe("Só uma Lista conversacional tem canais de atendimento.");
  });

  it("virar operacional apaga os canais de atendimento", () => {
    const listId = listaConversacionalVazia();
    expect(definirCanaisDaLista(state, THIAGO, listId, ["chn_wpp"]).ok).toBe(true);
    expect(alterarModeloDaLista(state, THIAGO, listId, "operacional").ok).toBe(true);
    expect(state.lists.find((l) => l.id === listId)?.canaisDeAtendimento).toBeUndefined();
  });
});

describe("A forma canônica do identificador de cada Tipo de Canal (C36)", () => {
  it("a forma canônica de cada tipo, e a recusa quando a forma não serve", () => {
    expect(identificadorCanonico("whatsapp", "+55 (11) 98765-4321")).toBe("+5511987654321");
    expect(identificadorCanonico("whatsapp", "11 98765-4321")).toBeUndefined();
    expect(identificadorCanonico("email", "CONTATO@X.COM.BR")).toBe("contato@x.com.br");
    expect(identificadorCanonico("email", "contato")).toBeUndefined();
    expect(identificadorCanonico("instagram", "@Loja.X")).toBe("loja.x");
    expect(identificadorCanonico("instagram", "https://www.instagram.com/loja.x/")).toBe("loja.x");
    expect(identificadorCanonico("linkedin", "https://www.linkedin.com/company/acme")).toBe("company/acme");
    expect(identificadorCanonico("linkedin", "in/maria-silva")).toBe("in/maria-silva");
    expect(identificadorCanonico("linkedin", "maria-silva")).toBe("in/maria-silva");
    expect(identificadorCanonico("linkedin", "pub/x/y/z")).toBeUndefined();
  });
});

describe("Canais da Lista conferidos num Canal[] recebido (3.3.7)", () => {
  /** Um Canal da tabela `plataforma.canais`; o seed não o conhece (o estado do teste não tem como projetá-lo). */
  const canalDaTabela = (parcial: Partial<Canal> = {}): Canal => ({
    id: "can_tabela",
    nome: "WhatsApp da loja",
    tipo: "whatsapp",
    provedor: "whatsapp-cloud",
    identificadorExterno: "+5511987654321",
    conexao: "conectada",
    conexaoSimulada: true,
    conectadaEm: "2026-11-01T10:00:00.000Z",
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: THIAGO,
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: THIAGO,
    criadoEm: "2026-11-01T10:00:00.000Z",
    atualizadoEm: "2026-11-01T10:00:00.000Z",
    ...parcial,
  });

  it("definirCanaisDaLista marca um Canal da tabela com state.channels vazio, e a Atividade usa o nome dele", () => {
    const listId = listaConversacionalVazia();
    state.channels = [];
    const gravado = definirCanaisDaLista(state, THIAGO, listId, ["can_tabela"], [canalDaTabela()]);
    expect(gravado.ok).toBe(true);
    expect(state.lists.find((l) => l.id === listId)?.canaisDeAtendimento).toEqual(["can_tabela"]);
    expect(state.activity[0]?.action).toBe("Canais de atendimento alterados");
    expect(state.activity[0]?.after).toBe("WhatsApp da loja");
  });

  it("um id fora de `canais` e de state.channels recusa com a frase de hoje e field canais", () => {
    const listId = listaConversacionalVazia();
    state.channels = [];
    const recusa = definirCanaisDaLista(state, THIAGO, listId, ["inexistente"], [canalDaTabela()]);
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) {
      expect(recusa.error).toBe("Canal não encontrado ou arquivado.");
      expect(recusa.field).toBe("canais");
    }
  });

  it("Canal da tabela arquivado recusa", () => {
    const listId = listaConversacionalVazia();
    state.channels = [];
    const recusa = definirCanaisDaLista(state, THIAGO, listId, ["can_tabela"], [canalDaTabela({ estado: "arquivado", arquivadoEm: "2026-11-02T10:00:00.000Z" })]);
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) expect(recusa.error).toBe("Canal não encontrado ou arquivado.");
  });

  it("sem `canais`, o Canal antigo de state.channels segue valendo; com `canais` vazio também (o servidor leu a tabela e não há nada)", () => {
    const listId = listaConversacionalVazia();
    expect(definirCanaisDaLista(state, THIAGO, listId, ["chn_wpp"], []).ok).toBe(true);
    expect(state.lists.find((l) => l.id === listId)?.canaisDeAtendimento).toEqual(["chn_wpp"]);
  });

  it("o nome do Canal da tabela vence o de state.channels quando o id coincide (a projeção repete o id)", () => {
    const listId = listaConversacionalVazia();
    const gravado = definirCanaisDaLista(state, THIAGO, listId, ["chn_wpp"], [canalDaTabela({ id: "chn_wpp", nome: "Nome da tabela" })]);
    expect(gravado.ok).toBe(true);
    expect(state.activity[0]?.after).toBe("Nome da tabela");
  });

  it("createList conversacional com o Canal da tabela passa, e a Atividade traz o nome dele", () => {
    state.channels = [];
    const criada = createList(
      state,
      THIAGO,
      { name: "Suporte da loja", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: ["can_tabela"] },
      [canalDaTabela()],
    );
    expect(criada.ok).toBe(true);
    if (!criada.ok) return;
    expect(criada.value.canaisDeAtendimento).toEqual(["can_tabela"]);
    const atividade = state.activity.find((a) => a.action === "Lista criada" && a.objectId === criada.value.id);
    expect(atividade?.detail).toContain("Atende por WhatsApp da loja");
  });

  it("createList com Canal inexistente recusa mesmo com `canais` e não deixa Lista", () => {
    state.channels = [];
    const recusa = createList(
      state,
      THIAGO,
      { name: "Suporte da loja", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: ["inexistente"] },
      [canalDaTabela()],
    );
    expect(recusa.ok).toBe(false);
    expect(state.lists.some((l) => l.name === "Suporte da loja")).toBe(false);
  });
});
