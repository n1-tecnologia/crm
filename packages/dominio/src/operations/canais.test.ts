/**
 * C36 — os canais de atendimento da Lista conversacional e a forma do
 * identificador de cada Tipo de Canal (criar e configurar Canal saíram na 15-32). Cada teste afirma o RESULTADO da operação e
 * o estado que ela deixou, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Canal } from "../crm/canais";
import { buildSeed } from "../seed";
import { canalDeTeste } from "../testes/crm-de-teste";
import type { DataState } from "../state";
import { identificadorCanonico } from "./canais";
import { baseDoPapel } from "./ia/permissoes-ia";
import { createList } from "./structure";
import { alterarModeloDaLista, definirCanaisDaLista } from "./tarefas-conversacionais";

const THIAGO = "mem_thiago";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

/** Os Canais de `plataforma.canais` que o servidor leria na transação (`lerDoCrm`): é por eles que a Lista confere os ids. */
const CANAIS: Canal[] = [
  canalDeTeste({ id: "chn_wpp", nome: "Comercial SP" }),
  canalDeTeste({ id: "chn_mail", nome: "contato@institutoigoralves.com.br", tipo: "email", provedor: "email-imap-smtp", identificadorExterno: "contato@institutoigoralves.com.br" }),
];

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
    const sem = createList(state, THIAGO, { name: "Suporte", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional" }, CANAIS);
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
    }, CANAIS);
    expect(com.ok).toBe(true);
    if (!com.ok) return;
    // Sem repetição, na ordem em que foram marcados.
    expect(com.value.canaisDeAtendimento).toEqual(["chn_wpp", "chn_mail"]);
    const atividade = state.activity.find((a) => a.action === "Lista criada" && a.objectId === com.value.id);
    expect(atividade?.detail).toContain("Atende por Comercial SP, contato@institutoigoralves.com.br");
  });

  it("createList recusa Canal inexistente e canais numa Lista operacional (o Chat do site não tem linha em plataforma.canais)", () => {
    const base = { name: "Suporte", parentType: "space" as const, parentId: "spc_com", modeloDeTarefa: "conversacional" as const };
    const inexistente = createList(state, THIAGO, { ...base, canaisDeAtendimento: ["chn_nada"] }, CANAIS);
    expect(inexistente.ok).toBe(false);
    if (!inexistente.ok) expect(inexistente.error).toBe("Canal não encontrado ou arquivado.");

    const operacional = createList(state, THIAGO, { name: "Gestão", parentType: "space", parentId: "spc_com", canaisDeAtendimento: ["chn_wpp"] }, CANAIS);
    expect(operacional.ok).toBe(false);
    if (!operacional.ok) expect(operacional.error).toBe("Só uma Lista conversacional tem canais de atendimento.");
    expect(state.lists.some((l) => l.name === "Suporte" || l.name === "Gestão")).toBe(false);
  });

  it("definirCanaisDaLista: grava com Atividade antes/depois; igual não grava; vazio e Lista operacional recusam; quem não administra recusa", () => {
    const listId = listaConversacionalVazia();

    const convidado = state.members.find((m) => m.state === "ativo" && baseDoPapel(state, m.id) === "convidado");
    if (convidado) {
      const recusa = definirCanaisDaLista(state, convidado.id, listId, ["chn_wpp"], CANAIS);
      expect(recusa.ok).toBe(false);
    }

    const antes = state.activity.length;
    const gravado = definirCanaisDaLista(state, THIAGO, listId, ["chn_wpp"], CANAIS);
    expect(gravado.ok).toBe(true);
    if (gravado.ok) expect(gravado.id).toBe(listId);
    expect(state.lists.find((l) => l.id === listId)?.canaisDeAtendimento).toEqual(["chn_wpp"]);
    expect(state.activity[0]?.action).toBe("Canais de atendimento alterados");
    expect(state.activity[0]?.before).toBe("nenhum");
    expect(state.activity[0]?.after).toBe("Comercial SP");
    expect(state.activity.length).toBe(antes + 1);

    const igual = definirCanaisDaLista(state, THIAGO, listId, ["chn_wpp"], CANAIS);
    expect(igual.ok).toBe(true);
    expect(state.activity.length).toBe(antes + 1);

    const vazio = definirCanaisDaLista(state, THIAGO, listId, [], CANAIS);
    expect(vazio.ok).toBe(false);
    if (!vazio.ok) expect(vazio.error).toBe("Escolha ao menos um Canal de atendimento.");

    const operacional = definirCanaisDaLista(state, THIAGO, "lst_ativacao", ["chn_wpp"], CANAIS);
    expect(operacional.ok).toBe(false);
    if (!operacional.ok) expect(operacional.error).toBe("Só uma Lista conversacional tem canais de atendimento.");
  });

  it("virar operacional apaga os canais de atendimento", () => {
    const listId = listaConversacionalVazia();
    expect(definirCanaisDaLista(state, THIAGO, listId, ["chn_wpp"], CANAIS).ok).toBe(true);
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

  it("definirCanaisDaLista marca um Canal da tabela, e a Atividade usa o nome dele", () => {
    const listId = listaConversacionalVazia();
    const gravado = definirCanaisDaLista(state, THIAGO, listId, ["can_tabela"], [canalDaTabela()]);
    expect(gravado.ok).toBe(true);
    expect(state.lists.find((l) => l.id === listId)?.canaisDeAtendimento).toEqual(["can_tabela"]);
    expect(state.activity[0]?.action).toBe("Canais de atendimento alterados");
    expect(state.activity[0]?.after).toBe("WhatsApp da loja");
  });

  it("um id fora de `canais` recusa com a frase de hoje e field canais", () => {
    const listId = listaConversacionalVazia();
    const recusa = definirCanaisDaLista(state, THIAGO, listId, ["inexistente"], [canalDaTabela()]);
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) {
      expect(recusa.error).toBe("Canal não encontrado ou arquivado.");
      expect(recusa.field).toBe("canais");
    }
  });

  it("Canal da tabela arquivado recusa", () => {
    const listId = listaConversacionalVazia();
    const recusa = definirCanaisDaLista(state, THIAGO, listId, ["can_tabela"], [canalDaTabela({ estado: "arquivado", arquivadoEm: "2026-11-02T10:00:00.000Z" })]);
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) expect(recusa.error).toBe("Canal não encontrado ou arquivado.");
  });

  it("sem `canais`, ou com `canais` vazio, nenhum id vale: o estado não é consultado (15-42)", () => {
    const listId = listaConversacionalVazia();
    for (const canais of [undefined, []] as const) {
      const recusa = definirCanaisDaLista(state, THIAGO, listId, ["chn_wpp"], canais);
      expect(recusa.ok).toBe(false);
      if (!recusa.ok) expect(recusa.error).toBe("Canal não encontrado ou arquivado.");
    }
    expect(state.lists.find((l) => l.id === listId)?.canaisDeAtendimento).toBeUndefined();
  });

  it("createList conversacional com o Canal da tabela passa, e a Atividade traz o nome dele", () => {
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
