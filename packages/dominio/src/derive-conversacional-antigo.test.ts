/**
 * ESTE ARQUIVO SAI NA 3.5.4 (Fase 15), junto com as leituras que ele cobre.
 *
 * São os testes das leituras da Tarefa conversacional e do chat que ainda leem o
 * CRM antigo no estado (`state.contacts`, `state.conversations`, `state.channels`,
 * `state.deals`) e que AINDA têm chamador de produção: o fio da Conversa
 * (`ConversationThread`, 3.4.2), a ficha da Tarefa (`contatoDaTarefa` e
 * `canalDaTarefa`), "Meus negócios" (`negocioDaTarefa`, 3.4.5), as Tarefas da
 * ficha antiga do Contato e os Canais da Lista no diálogo de Iniciar Conversa.
 * As leituras por id, que valem depois do corte, estão em `derive-conversacional.test.ts`,
 * com o estado sem nenhuma dessas coleções.
 *
 * As derivações do chat por Canal (Fase 8, D-13/D-14/D-15): a chave do chat
 * deixa de ser o TIPO e passa a ser o Canal — duas contas de WhatsApp dão duas
 * abas, o "Responder por" padrão é o Canal da última Mensagem recebida, e a
 * troca de Canal numa sequência ganha um separador "via …". Sem jsdom: tudo
 * aqui é função pura do estado.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  ORDEM_DOS_TIPOS_DE_CANAL,
  canaisDaLista,
  canaisDaListaQueAlcancam,
  canaisDeResposta,
  canaisDoFio,
  canaisQueAlcancam,
  canalDaAbaInicial,
  canalDaTarefa,
  canalPadraoDeResposta,
  canalPadraoDoTipo,
  contatoDaTarefa,
  conversaDaTarefa,
  listaSemCanais,
  negocioDaTarefa,
  rotuloDoCanal,
  tarefasConversacionaisDoContato,
  textoDoSeparadorDeCanal,
} from "./derive-conversacional";
import { buildSeed } from "./seed";
import { semearCrmAntigo } from "./seed-crm-antigo";
import type { DataState } from "./state";
import type { Channel, Contact, Conversation, Message } from "./types";

let state: DataState;
let contato: Contact;

/** Um Canal de WhatsApp novo, clonado do `chn_wpp` do seed, criado em `criadoEm`. */
function novoCanal(
  id: string,
  nome: string,
  provider: Channel["provider"],
  connection: Channel["connection"],
  criadoEm: string,
): Channel {
  const base = state.channels.find((c) => c.id === "chn_wpp");
  if (!base) throw new Error("o seed precisa do Canal chn_wpp");
  const canal: Channel = {
    ...structuredClone(base),
    id,
    name: nome,
    externalId: `+55119${id.length}${nome.length}000000`,
    connection,
    createdAt: criadoEm,
    messageTemplates: [],
    ...(provider ? { provider } : {}),
  };
  state.channels.push(canal);
  return canal;
}

type Recebimento = readonly [direcao: Message["direction"], criadoEm: string];

/** Uma Conversa ativa do Contato no Canal, com Mensagens nas direções e instantes dados. */
function novaConversa(id: string, canalId: string, mensagens: readonly Recebimento[]): Conversation {
  const base = state.conversations.find((c) => c.messages.length > 0);
  const modelo = base?.messages[0];
  if (!base || !modelo) throw new Error("o seed precisa de uma Conversa com Mensagem");
  const conversa: Conversation = {
    ...structuredClone(base),
    id,
    channelId: canalId,
    contactId: contato.id,
    lifecycle: "ativo",
    state: "aberta",
    drafts: [],
    messages: mensagens.map(([direction, createdAt], i) => ({
      ...structuredClone(modelo),
      id: `${id}_m${i}`,
      conversationId: id,
      direction,
      createdAt,
    })),
  };
  state.conversations.push(conversa);
  return conversa;
}

beforeEach(() => {
  // Testa código do CRM antigo que sai (15-32/15-42): o seed deixou de criar o CRM (15-31), então ele é semeado aqui.
  state = semearCrmAntigo(buildSeed());
  const candidato = state.contacts.find((c) => c.identifiers.some((i) => i.type === "identidadeDeWhatsApp"));
  if (!candidato) throw new Error("o seed precisa de um Contato com WhatsApp");
  // Só o WhatsApp: o e-mail e os demais Canais não o alcançam.
  candidato.identifiers = candidato.identifiers.filter((i) => i.type === "identidadeDeWhatsApp");
  contato = candidato;
  state.conversations = state.conversations.filter((c) => c.contactId !== contato.id);

  novoCanal("chn_comercial", "Comercial", "whatsapp-cloud", "conectada", "2026-01-01T09:00:00.000Z");
  novoCanal("chn_suporte", "Suporte", "whatsapp-nao-oficial", "conectada", "2026-01-02T09:00:00.000Z");
  novoCanal("chn_desligado", "Desligado", "whatsapp-nao-oficial", "desconectada", "2026-01-03T09:00:00.000Z");
});

/** O cenário do plano: a recebida mais recente de todas está em "Suporte". */
function cenarioComSuporteComoUltimaRecebida(): void {
  novaConversa("cnv_wpp", "chn_wpp", [
    ["recebida", "2026-10-09T10:00:00.000Z"],
    ["enviada", "2026-10-12T08:00:00.000Z"],
  ]);
  novaConversa("cnv_comercial", "chn_comercial", [
    ["recebida", "2026-10-10T10:00:00.000Z"],
    ["interna", "2026-10-12T09:00:00.000Z"],
  ]);
  novaConversa("cnv_suporte", "chn_suporte", [["recebida", "2026-10-11T09:00:00.000Z"]]);
}

describe("canaisDoFio (D-14: uma aba por Canal)", () => {
  it("traz todos os Canais ativos: WhatsApp pela criação, depois Instagram, LinkedIn, E-mail e Chat do site", () => {
    expect(canaisDoFio(state, contato).map((c) => c.canal.id)).toEqual([
      "chn_wpp",
      "chn_comercial",
      "chn_suporte",
      "chn_desligado",
      "chn_insta",
      "chn_linkedin",
      "chn_mail",
      "chn_site",
    ]);
  });

  it("os de WhatsApp alcançam o Contato; o de e-mail, o de Instagram e os demais não", () => {
    const alcance = new Map(canaisDoFio(state, contato).map((c) => [c.canal.id, c.alcancavel]));
    expect(alcance.get("chn_wpp")).toBe(true);
    expect(alcance.get("chn_comercial")).toBe(true);
    expect(alcance.get("chn_suporte")).toBe(true);
    expect(alcance.get("chn_desligado")).toBe(true);
    expect(alcance.get("chn_mail")).toBe(false);
    expect(alcance.get("chn_insta")).toBe(false);
    expect(alcance.get("chn_linkedin")).toBe(false);
    expect(alcance.get("chn_site")).toBe(false);
  });

  it("um Canal arquivado não aparece", () => {
    const suporte = state.channels.find((c) => c.id === "chn_suporte");
    if (!suporte) throw new Error("fixture");
    suporte.lifecycle = "arquivado";
    expect(canaisDoFio(state, contato).map((c) => c.canal.id)).not.toContain("chn_suporte");
  });

  it("a ordem é do tipo, depois da criação, depois do id", () => {
    const empate = novoCanal("chn_a_empate", "Empate", "whatsapp-cloud", "conectada", "2026-01-02T09:00:00.000Z");
    const ids = canaisDoFio(state, contato).map((c) => c.canal.id);
    expect(ids.indexOf(empate.id)).toBe(ids.indexOf("chn_suporte") - 1);
    expect(ORDEM_DOS_TIPOS_DE_CANAL).toEqual(["whatsapp", "instagram", "linkedin", "email", "chatDoSite"]);
  });

  it("sem Contato, todos os Canais ativos alcançam", () => {
    expect(canaisDoFio(state, undefined).every((c) => c.alcancavel)).toBe(true);
  });
});

describe("canaisDeResposta (D-15: só os conectados que alcançam)", () => {
  it("traz chn_wpp, Comercial e Suporte; não o desconectado nem o de e-mail", () => {
    expect(canaisDeResposta(state, contato).map((c) => c.id)).toEqual(["chn_wpp", "chn_comercial", "chn_suporte"]);
  });
});

describe("canalPadraoDeResposta (D-15)", () => {
  it("dois WhatsApps dão duas abas e o padrão de resposta é o da última recebida", () => {
    cenarioComSuporteComoUltimaRecebida();
    const abasDeWhatsApp = canaisDoFio(state, contato).filter((c) => c.canal.channelType === "whatsapp" && c.alcancavel);
    expect(abasDeWhatsApp.length).toBeGreaterThanOrEqual(2);
    expect(canalPadraoDeResposta(state, contato)).toBe("chn_suporte");
  });

  it("se o Canal da última recebida não serve, cai no primeiro Canal de resposta do mesmo tipo", () => {
    cenarioComSuporteComoUltimaRecebida();
    const suporte = state.channels.find((c) => c.id === "chn_suporte");
    if (!suporte) throw new Error("fixture");
    suporte.connection = "desconectada";
    expect(canalPadraoDeResposta(state, contato)).toBe("chn_wpp");
  });

  it("sem nenhuma recebida, é o primeiro Canal de resposta", () => {
    novaConversa("cnv_wpp", "chn_wpp", [["enviada", "2026-10-12T08:00:00.000Z"]]);
    expect(canalPadraoDeResposta(state, contato)).toBe("chn_wpp");
  });

  it("sem nenhum Canal que sirva, é undefined", () => {
    for (const canal of state.channels) canal.connection = "desconectada";
    expect(canalPadraoDeResposta(state, contato)).toBeUndefined();
  });

  it("uma Conversa na lixeira não conta como a última recebida", () => {
    cenarioComSuporteComoUltimaRecebida();
    const suporte = state.conversations.find((c) => c.id === "cnv_suporte");
    if (!suporte) throw new Error("fixture");
    suporte.lifecycle = "naLixeira";
    expect(canalPadraoDeResposta(state, contato)).toBe("chn_comercial");
  });
});

describe("canalDaAbaInicial (D-14)", () => {
  it("é o Canal da Conversa com a Mensagem mais recente, sem contar nota interna", () => {
    cenarioComSuporteComoUltimaRecebida();
    expect(canalDaAbaInicial(state, contato)).toBe("chn_wpp");
  });

  it("sem Conversa, é o primeiro Canal alcançável", () => {
    expect(canalDaAbaInicial(state, contato)).toBe("chn_wpp");
  });

  it("sem nenhum Canal alcançável, é undefined", () => {
    contato.identifiers = [];
    expect(canalDaAbaInicial(state, contato)).toBeUndefined();
  });
});

describe("canalPadraoDoTipo", () => {
  it("whatsapp é o Canal da última recebida; e-mail, que o Contato não alcança, é undefined", () => {
    cenarioComSuporteComoUltimaRecebida();
    expect(canalPadraoDoTipo(state, contato, "whatsapp")).toBe("chn_suporte");
    expect(canalPadraoDoTipo(state, contato, "email")).toBeUndefined();
  });

  it("sem recebida no tipo, é o primeiro Canal de resposta do tipo", () => {
    expect(canalPadraoDoTipo(state, contato, "whatsapp")).toBe("chn_wpp");
  });
});

describe("rotuloDoCanal e textoDoSeparadorDeCanal (D-13)", () => {
  const canal = (id: string): Channel => {
    const c = state.channels.find((x) => x.id === id);
    if (!c) throw new Error(`fixture: ${id}`);
    return c;
  };

  it("o rótulo junta o nome e o provedor", () => {
    expect(rotuloDoCanal(canal("chn_comercial"))).toBe("Comercial · WhatsApp oficial");
    expect(rotuloDoCanal(canal("chn_suporte"))).toBe("Suporte · WhatsApp não oficial");
  });

  it("Canal sem provider usa o provedor padrão do tipo; sem provedor, o rótulo do tipo", () => {
    expect(rotuloDoCanal(canal("chn_wpp"))).toBe("Comercial SP · WhatsApp oficial");
    expect(rotuloDoCanal(canal("chn_linkedin"))).toBe("Instituto Igor Alves no LinkedIn · LinkedIn");
    expect(rotuloDoCanal(canal("chn_site"))).toBe("Chat do site · Chat do site");
  });

  it("o separador diz por qual Canal a Mensagem passou", () => {
    expect(textoDoSeparadorDeCanal(canal("chn_suporte"))).toBe("via Suporte (WhatsApp não oficial)");
    expect(textoDoSeparadorDeCanal(canal("chn_linkedin"))).toBe("via Instituto Igor Alves no LinkedIn (LinkedIn)");
  });
});

describe("canaisQueAlcancam continua como era", () => {
  it("devolve os Canais ativos que alcançam o Contato, por tipo", () => {
    expect(canaisQueAlcancam(state, contato).map((c) => c.id)).toEqual(
      expect.arrayContaining(["chn_wpp", "chn_comercial", "chn_suporte", "chn_desligado"]),
    );
    expect(canaisQueAlcancam(state, contato).map((c) => c.id)).not.toContain("chn_mail");
  });
});

/**
 * As leituras da Tarefa conversacional que olham o CRM antigo no estado e ficaram: `contatoDaTarefa` e
 * `canalDaTarefa` (o fio e o layout da ficha, 3.4.2), `negocioDaTarefa` ("Meus negócios", 3.4.5),
 * `tarefasConversacionaisDoContato` (a ficha antiga do Contato) e os Canais da Lista (o diálogo de Iniciar
 * Conversa). Seed: `tsk_pv_1` é da Marina (`cnt_2`) na Conversa `cnv_1` do WhatsApp.
 */
describe("as leituras da Tarefa que ainda leem o CRM antigo", () => {
  const THIAGO_ID = "mem_thiago";

  it("contatoDaTarefa, conversaDaTarefa e canalDaTarefa seguem os Vínculos", () => {
    const tarefa = state.tasks.find((t) => t.id === "tsk_pv_1");
    if (!tarefa) throw new Error("seed sem tsk_pv_1");
    expect(contatoDaTarefa(state, tarefa)?.id).toBe("cnt_2");
    expect(conversaDaTarefa(state, tarefa)?.id).toBe("cnv_1");
    expect(canalDaTarefa(state, tarefa)?.id).toBe("chn_wpp");
  });

  it("a Subtarefa lê a raiz", () => {
    const raiz = state.tasks.find((t) => t.id === "tsk_pv_1");
    if (!raiz) throw new Error("seed sem tsk_pv_1");
    const sub = { ...structuredClone(raiz), id: "tsk_sub_antiga", parentTaskId: raiz.id, rootTaskId: raiz.id };
    state.tasks.push(sub);
    expect(contatoDaTarefa(state, sub)?.id).toBe("cnt_2");
    expect(canalDaTarefa(state, sub)?.id).toBe("chn_wpp");
  });

  it("um Contato mesclado responde pelo sobrevivente; na lixeira, a Tarefa fica sem Contato", () => {
    const tarefa = state.tasks.find((t) => t.id === "tsk_pv_1");
    if (!tarefa) throw new Error("seed sem tsk_pv_1");
    // cnt_32 está `mesclado` em cnt_2 no seed; um Vínculo anterior à mesclagem aponta para ele.
    state.links = state.links.map((l) => (l.fromId === tarefa.id && l.toType === "contact" ? { ...l, toId: "cnt_32" } : l));
    expect(contatoDaTarefa(state, tarefa)?.id).toBe("cnt_2");
    const sobrevivente = state.contacts.find((c) => c.id === "cnt_2");
    if (!sobrevivente) throw new Error("seed sem cnt_2");
    sobrevivente.lifecycle = "naLixeira";
    expect(contatoDaTarefa(state, tarefa)).toBeUndefined();
  });

  it("sem Vínculo de Contato, o Contato é o principal do Negócio vinculado", () => {
    const solta = state.tasks.find((t) => t.id === "tsk_seed_4");
    if (!solta) throw new Error("seed sem tsk_seed_4");
    expect(contatoDaTarefa(state, solta)).toBeUndefined();
    state.links.push({
      id: "lnk_antigo_negocio",
      fromType: "task",
      fromId: solta.id,
      toType: "deal",
      toId: "deal_sdr_1",
      role: "Negócio da Tarefa",
      createdBy: { kind: "member", id: THIAGO_ID },
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    expect(negocioDaTarefa(state, solta)?.id).toBe("deal_sdr_1");
    expect(contatoDaTarefa(state, solta)?.id).toBe("cnt_35");
    const negocio = state.deals.find((d) => d.id === "deal_sdr_1");
    if (!negocio) throw new Error("seed sem deal_sdr_1");
    negocio.lifecycle = "naLixeira";
    expect(negocioDaTarefa(state, solta)).toBeUndefined();
  });

  it("a Conversa na lixeira suspende o Vínculo: sem Conversa e sem Canal", () => {
    const tarefa = state.tasks.find((t) => t.id === "tsk_pv_1");
    const conversa = state.conversations.find((c) => c.id === "cnv_1");
    if (!tarefa || !conversa) throw new Error("seed sem tsk_pv_1/cnv_1");
    conversa.lifecycle = "naLixeira";
    expect(conversaDaTarefa(state, tarefa)).toBeUndefined();
    expect(canalDaTarefa(state, tarefa)).toBeUndefined();
  });

  it("tarefasConversacionaisDoContato traz as Tarefas ativas de Listas conversacionais ligadas ao Contato", () => {
    expect(tarefasConversacionaisDoContato(state, "cnt_2").map((t) => t.id)).toContain("tsk_pv_1");
    expect(tarefasConversacionaisDoContato(state, "cnt_nao_existe")).toEqual([]);
  });

  it("canaisDaLista, canaisDaListaQueAlcancam e listaSemCanais leem os Canais do estado", () => {
    expect(canaisDaLista(state, "lst_pos_venda").map((c) => c.id)).toEqual(["chn_wpp", "chn_mail"]);
    expect(canaisDaLista(state, "lst_ativacao")).toEqual([]);
    expect(listaSemCanais(state, "lst_pos_venda")).toBe(false);
    expect(listaSemCanais(state, "lst_ativacao")).toBe(false);
    // O Contato do seed no teste acima só tem WhatsApp: o e-mail da Lista não o alcança.
    expect(canaisDaListaQueAlcancam(state, "lst_pos_venda", contato).map((c) => c.id)).toEqual(["chn_wpp"]);
    expect(canaisDaListaQueAlcancam(state, "lst_pos_venda", undefined).map((c) => c.id)).toEqual(["chn_wpp", "chn_mail"]);
    const lista = state.lists.find((l) => l.id === "lst_pos_venda");
    if (!lista) throw new Error("seed sem lst_pos_venda");
    lista.canaisDeAtendimento = [];
    expect(listaSemCanais(state, "lst_pos_venda")).toBe(true);
  });
});
