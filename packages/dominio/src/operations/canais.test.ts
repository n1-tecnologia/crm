/**
 * C36 — os canais de atendimento da Lista conversacional e o Canal como
 * registro (criar e configurar). Cada teste afirma o RESULTADO da operação e
 * o estado que ela deixou, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { canaisDaLista, canaisDaListaQueAlcancam, listaSemCanais } from "../derive-conversacional";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import {
  FORMA_DO_IDENTIFICADOR,
  LISTA_SEM_CANAIS,
  configurarCanal,
  criarCanal,
  identificadorCanonico,
} from "./canais";
import { administraOEspaco, baseDoPapel } from "./ia/permissoes-ia";
import { funilDaLista, iniciarConversa } from "./iniciar-conversa";
import { createList } from "./structure";
import { alterarModeloDaLista, criarTarefaConversacional, definirCanaisDaLista, trocarCanalDaTarefa } from "./tarefas-conversacionais";

const THIAGO = "mem_thiago";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

/** Um Membro ativo que NÃO administra o Espaço de Trabalho (para as recusas de B35). */
const semAdmin = (): string => {
  const m = state.members.find((x) => x.state === "ativo" && !administraOEspaco(state, x.id));
  if (!m) throw new Error("o seed precisa de um Membro ativo que não administre o Espaço");
  return m.id;
};
const admin = (): string => {
  const m = state.members.find((x) => x.state === "ativo" && administraOEspaco(state, x.id));
  if (!m) throw new Error("o seed precisa de um Administrador");
  return m.id;
};

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
    expect(canaisDaLista(state, com.value.id).map((c) => c.id)).toEqual(["chn_wpp", "chn_mail"]);
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
    expect(listaSemCanais(state, listId)).toBe(true);

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
    expect(canaisDaLista(state, listId)).toEqual([]);
  });

  it("criarTarefaConversacional: Canal fora da Lista é recusado e nada nasce; Lista sem canais idem", () => {
    const tarefas = state.tasks.length;
    const conversas = state.conversations.length;
    const links = state.links.length;
    // Iallas (cnt_35) tem LinkedIn, mas o Pós-venda atende por WhatsApp e e-mail.
    const fora = criarTarefaConversacional(state, THIAGO, { listId: "lst_pos_venda", contactId: "cnt_35", channelId: "chn_linkedin" });
    expect(fora.ok).toBe(false);
    if (!fora.ok) {
      expect(fora.error).toBe("Esta Lista não atende por “Instituto Igor Alves no LinkedIn” (LinkedIn).");
      expect(fora.field).toBe("canal");
    }
    expect(state.tasks.length).toBe(tarefas);
    expect(state.conversations.length).toBe(conversas);
    expect(state.links.length).toBe(links);

    const listId = listaConversacionalVazia();
    const semCanais = criarTarefaConversacional(state, THIAGO, { listId, contactId: "cnt_35", channelId: "chn_wpp" });
    expect(semCanais.ok).toBe(false);
    if (!semCanais.ok) expect(semCanais.error).toBe(LISTA_SEM_CANAIS);
  });

  it("trocarCanalDaTarefa respeita os canais da Lista", () => {
    const fora = trocarCanalDaTarefa(state, THIAGO, "tsk_pv_1", "chn_linkedin");
    expect(fora.ok).toBe(false);
    if (!fora.ok) expect(fora.error).toContain("não atende por");
    const dentro = trocarCanalDaTarefa(state, THIAGO, "tsk_pv_1", "chn_mail");
    expect(dentro.ok).toBe(true);
  });

  it("iniciarConversa (espelho do Funil) respeita os canais da Lista e não deixa rastro ao recusar", () => {
    // O SDR atende por WhatsApp e LinkedIn: o e-mail fica de fora.
    const funil = funilDaLista(state, "lst_funil_sdr");
    if (!funil) throw new Error("lst_funil_sdr devia espelhar um Funil");
    const etapa = funil.stages[0];
    if (!etapa) throw new Error("o Funil precisa de uma Etapa");
    const negocios = state.deals.length;
    const tarefas = state.tasks.length;
    const conversas = state.conversations.length;
    const fora = iniciarConversa(state, THIAGO, { listId: "lst_funil_sdr", contactId: "cnt_1", stageId: etapa.id, channelId: "chn_mail" });
    expect(fora.ok).toBe(false);
    if (!fora.ok) expect(fora.error).toContain("não atende por");
    expect(state.deals.length).toBe(negocios);
    expect(state.tasks.length).toBe(tarefas);
    expect(state.conversations.length).toBe(conversas);
    // Por um canal da Lista nasce — numa Etapa em que o Negócio possa nascer
    // (algumas exigem campo preenchido, regra que não é desta história).
    const nasceu = funil.stages.some((s) => iniciarConversa(state, THIAGO, { listId: "lst_funil_sdr", contactId: "cnt_1", stageId: s.id, channelId: "chn_wpp" }).ok);
    expect(nasceu).toBe(true);
  });

  it("canaisDaListaQueAlcancam cruza os canais da Lista com os Identificadores do Contato", () => {
    // Um Contato com WhatsApp e sem e-mail: só o WhatsApp da Lista o alcança.
    const soWhats = state.contacts.find(
      (c) => c.lifecycle === "ativo" && c.identifiers.some((i) => i.type === "identidadeDeWhatsApp") && !c.identifiers.some((i) => i.type === "email"),
    );
    if (!soWhats) throw new Error("o seed precisa de um Contato com WhatsApp e sem e-mail");
    expect(canaisDaListaQueAlcancam(state, "lst_pos_venda", soWhats).map((c) => c.id)).toEqual(["chn_wpp"]);
    // Um Contato com os dois é alcançado pelos dois.
    const iallas = state.contacts.find((c) => c.id === "cnt_35");
    expect(canaisDaListaQueAlcancam(state, "lst_pos_venda", iallas).map((c) => c.id)).toEqual(["chn_wpp", "chn_mail"]);
    // Sem Contato, todos os canais da Lista.
    expect(canaisDaListaQueAlcancam(state, "lst_pos_venda", undefined).map((c) => c.id)).toEqual(["chn_wpp", "chn_mail"]);
    // Numa Lista operacional não há canais.
    expect(canaisDaListaQueAlcancam(state, "lst_ativacao", soWhats)).toEqual([]);
  });
});

describe("O Canal como registro: conectar e configurar (C36)", () => {
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

    const invalido = criarCanal(state, admin(), { channelType: "whatsapp", name: "Loja", externalId: "98765" });
    expect(invalido.ok).toBe(false);
    if (!invalido.ok) {
      expect(invalido.error).toBe(FORMA_DO_IDENTIFICADOR.whatsapp.dica);
      expect(invalido.field).toBe("identificador");
    }
  });

  it("criarCanal: só quem administra o Espaço conecta (B35); o Canal nasce conectado e acende como recente", () => {
    const recusa = criarCanal(state, semAdmin(), { channelType: "email", name: "Suporte", externalId: "suporte@x.com.br" });
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) expect(recusa.error).toBe("Só quem administra o Espaço de Trabalho conecta e configura Canais.");

    const quem = admin();
    const criado = criarCanal(state, quem, {
      channelType: "email",
      name: "Suporte",
      externalId: "Suporte@X.com.br",
      defaultQueueId: "fila_sup",
      defaultOriginId: "cat_org_site",
    });
    expect(criado.ok).toBe(true);
    if (!criado.ok) return;
    expect(criado.id).toBe(criado.value.id);
    const canal = state.channels.find((c) => c.id === criado.value.id);
    expect(canal?.connection).toBe("conectada");
    expect(canal?.lifecycle).toBe("ativo");
    expect(canal?.externalId).toBe("suporte@x.com.br");
    expect(canal?.configuredByMemberId).toBe(quem);
    expect(canal?.defaultQueueId).toBe("fila_sup");
    expect(canal?.defaultOriginId).toBe("cat_org_site");
    expect(canal?.messageTemplates).toEqual([]);
    expect(canal?.groupsEnabled).toBe(false);
    expect(state.activity[0]?.action).toBe("Canal conectado");
    expect(state.activity[0]?.detail).toBe("E-mail · suporte@x.com.br");
    // O Canal novo já pode ser canal de atendimento de uma Lista.
    const lista = createList(state, THIAGO, { name: "Suporte", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: [criado.value.id] });
    expect(lista.ok).toBe(true);
  });

  it("criarCanal: nome repetido e a mesma conta são recusados (RN-CXE-31, INV-CXE-01); Fila e Origem inválidas também", () => {
    const quem = admin();
    const nome = criarCanal(state, quem, { channelType: "whatsapp", name: "  comercial sp ", externalId: "+5511900000000" });
    expect(nome.ok).toBe(false);
    if (!nome.ok) expect(nome.error).toBe("Já existe um Canal chamado “Comercial SP”.");

    const conta = criarCanal(state, quem, { channelType: "whatsapp", name: "Outro nome", externalId: "+55 11 98765-4321" });
    expect(conta.ok).toBe(false);
    if (!conta.ok) {
      expect(conta.error).toBe("Esta conta já está conectada como “Comercial SP”.");
      expect(conta.field).toBe("identificador");
    }

    const fila = criarCanal(state, quem, { channelType: "whatsapp", name: "Outro nome", externalId: "+5511900000000", defaultQueueId: "fila_nada" });
    expect(fila.ok).toBe(false);
    if (!fila.ok) expect(fila.field).toBe("fila");

    const naoOrigem = state.catalog.find((i) => i.kind !== "origem");
    if (!naoOrigem) throw new Error("o catálogo precisa de um item que não seja Origem");
    const origem = criarCanal(state, quem, { channelType: "whatsapp", name: "Outro nome", externalId: "+5511900000000", defaultOriginId: naoOrigem.id });
    expect(origem.ok).toBe(false);
    if (!origem.ok) expect(origem.field).toBe("origem");
    expect(state.channels.some((c) => c.name === "Outro nome")).toBe(false);
  });

  it("configurarCanal troca o setor e a origem, null limpa, e registra antes/depois; sem mudança não registra", () => {
    const quem = admin();
    const recusa = configurarCanal(state, semAdmin(), "chn_wpp", { defaultQueueId: "fila_sup" });
    expect(recusa.ok).toBe(false);

    const antes = state.activity.length;
    const trocado = configurarCanal(state, quem, "chn_wpp", { defaultQueueId: "fila_sup", defaultOriginId: "cat_org_site" });
    expect(trocado.ok).toBe(true);
    const canal = state.channels.find((c) => c.id === "chn_wpp");
    expect(canal?.defaultQueueId).toBe("fila_sup");
    expect(canal?.defaultOriginId).toBe("cat_org_site");
    expect(state.activity[0]?.action).toBe("Canal configurado");
    expect(state.activity[0]?.before).toContain("Fila: Comercial");
    expect(state.activity[0]?.after).toContain("Fila: Suporte");
    expect(state.activity.length).toBe(antes + 1);

    const igual = configurarCanal(state, quem, "chn_wpp", { defaultQueueId: "fila_sup" });
    expect(igual.ok).toBe(true);
    expect(state.activity.length).toBe(antes + 1);

    const limpo = configurarCanal(state, quem, "chn_wpp", { defaultQueueId: null, defaultOriginId: null });
    expect(limpo.ok).toBe(true);
    expect(canal?.defaultQueueId).toBeUndefined();
    expect(canal?.defaultOriginId).toBeUndefined();
    expect(state.activity[0]?.after).toContain("Fila: nenhuma · Origem: nenhuma");

    const semNome = configurarCanal(state, quem, "chn_wpp", { name: "  " });
    expect(semNome.ok).toBe(false);
    const nomeEmUso = configurarCanal(state, quem, "chn_wpp", { name: "Chat do site" });
    expect(nomeEmUso.ok).toBe(false);
  });
});

describe("configurarCanal e o Canal relacional (D-11)", () => {
  it("recusa Canal da tabela própria e não muda nada", () => {
    const canal = state.channels.find((c) => c.id === "chn_wpp");
    if (!canal) throw new Error("seed sem chn_wpp");
    (canal as { relational?: boolean }).relational = true;
    const nomeAntes = canal.name;
    const resultado = configurarCanal(state, admin(), canal.id, { name: "X" });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBe("Este Canal vem da tabela própria: configure-o pela ficha do Canal, que grava pela api.");
    expect(canal.name).toBe(nomeAntes);
  });
});
