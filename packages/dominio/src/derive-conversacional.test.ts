/**
 * As derivações do chat por Canal (Fase 8, D-13/D-14/D-15): a chave do chat
 * deixa de ser o TIPO e passa a ser o Canal — duas contas de WhatsApp dão duas
 * abas, o "Responder por" padrão é o Canal da última Mensagem recebida, e a
 * troca de Canal numa sequência ganha um separador "via …". Sem jsdom: tudo
 * aqui é função pura do estado.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  ORDEM_DOS_TIPOS_DE_CANAL,
  PAPEL_DO_VINCULO,
  canaisDaListaNasTabelas,
  canaisDaListaQueAlcancamNasTabelas,
  canaisDeResposta,
  canaisDoFio,
  canaisQueAlcancam,
  canalDaAbaInicial,
  canalPadraoDeResposta,
  canalPadraoDoTipo,
  listaSemCanaisNasTabelas,
  marcadoresDeCanal,
  rotuloDoCanal,
  textoDoSeparadorDeCanal,
  vinculosDoCrmDaTarefa,
} from "./derive-conversacional";
import type { Canal } from "./crm/canais";
import { effectiveListConfig } from "./derive";
import { createList } from "./operations/structure";
import { createTask, moveTask } from "./operations/tasks";
import { buildSeed } from "./seed";
import type { DataState } from "./state";
import type { Channel, Contact, Conversation, Link, List, Message, Task } from "./types";

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
  state = buildSeed();
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

describe("marcadoresDeCanal (D-13: o separador marca a troca de Canal)", () => {
  const itens = [{ channelId: "a" }, { channelId: "a" }, { channelId: "b" }, { channelId: "a" }];

  it("põe um 'via' antes de cada Mensagem cujo Canal difere da anterior", () => {
    expect(marcadoresDeCanal(itens)).toEqual([
      { tipo: "item", item: itens[0] },
      { tipo: "item", item: itens[1] },
      { tipo: "via", channelId: "b" },
      { tipo: "item", item: itens[2] },
      { tipo: "via", channelId: "a" },
      { tipo: "item", item: itens[3] },
    ]);
  });

  it("uma sequência de um Canal só não tem separador", () => {
    const so = [{ channelId: "a" }, { channelId: "a" }];
    expect(marcadoresDeCanal(so).map((m) => m.tipo)).toEqual(["item", "item"]);
  });

  it("lista vazia, nada", () => {
    expect(marcadoresDeCanal([])).toEqual([]);
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
 * 3.3.2 — a Tarefa conversacional lida por ids: o Contato, a Conversa e o
 * Negócio saem só de `state.links`, sem precisar do CRM antigo no estado.
 */
describe("leituras por id (3.3.2)", () => {
  const CONTATO = "11111111-1111-4111-8111-111111111111";
  const CONVERSA = "22222222-2222-4222-8222-222222222222";
  const NEGOCIO = "33333333-3333-4333-8333-333333333333";
  const CANAL_A = "44444444-4444-4444-8444-444444444444";
  const CANAL_B = "55555555-5555-4555-8555-555555555555";
  const CANAL_C = "66666666-6666-4666-8666-666666666666";
  const THIAGO = "mem_thiago";

  let limpo: DataState;

  const canal = (id: string, tipo: Canal["tipo"], estado: Canal["estado"] = "ativo"): Canal => ({
    id,
    nome: `Canal ${id.slice(0, 2)}`,
    tipo,
    provedor: tipo === "email" ? "email-imap-smtp" : tipo === "instagram" ? "instagram-graph" : "whatsapp-cloud",
    identificadorExterno: `ext-${id.slice(0, 2)}`,
    conexao: "conectada",
    conexaoSimulada: false,
    conectadaEm: null,
    estado,
    arquivadoEm: null,
    configuradoPor: "mem_thiago",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_thiago",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
  });

  const elo = (taskId: string, toType: Link["toType"], toId: string, role?: string): Link => ({
    id: `lnk_t_${limpo.links.length}`,
    fromType: "task",
    fromId: taskId,
    toType,
    toId,
    ...(role !== undefined ? { role } : {}),
    createdBy: { kind: "member", id: THIAGO },
    createdAt: "2026-10-01T00:00:00.000Z",
  });

  const tarefa = (): Task => {
    const t = limpo.tasks[0];
    if (!t) throw new Error("o seed precisa de uma Tarefa");
    return t;
  };

  let listaDoSuporte: List;

  beforeEach(() => {
    limpo = buildSeed();
    // A Lista conversacional que o teste usa nasce com um Canal do seed e depois o seed é esvaziado.
    const nasceu = createList(limpo, THIAGO, {
      name: "Suporte por id",
      parentType: "space",
      parentId: "spc_com",
      modeloDeTarefa: "conversacional",
      canaisDeAtendimento: ["chn_wpp"],
    });
    if (!nasceu.ok) throw new Error(nasceu.error);
    listaDoSuporte = nasceu.value;
    listaDoSuporte.canaisDeAtendimento = [CANAL_A];
    limpo.contacts = [];
    limpo.conversations = [];
    limpo.channels = [];
    limpo.deals = [];
  });

  it("vinculosDoCrmDaTarefa devolve Contato, Conversa e Negócio só pelos Vínculos", () => {
    const t = tarefa();
    limpo.links.push(
      elo(t.id, "contact", CONTATO, PAPEL_DO_VINCULO.contato),
      elo(t.id, "conversation", CONVERSA, PAPEL_DO_VINCULO.conversa),
      elo(t.id, "deal", NEGOCIO, PAPEL_DO_VINCULO.negocio),
    );
    expect(vinculosDoCrmDaTarefa(limpo, t)).toEqual({ contatoId: CONTATO, conversaId: CONVERSA, negocioId: NEGOCIO });
  });

  it("Tarefa sem Vínculos devolve objeto sem ids", () => {
    const t = tarefa();
    limpo.links = limpo.links.filter((l) => l.fromId !== t.id);
    expect(vinculosDoCrmDaTarefa(limpo, t)).toEqual({});
  });

  it("a Subtarefa sem Vínculo próprio lê a raiz", () => {
    const raiz = tarefa();
    limpo.links.push(elo(raiz.id, "contact", CONTATO, PAPEL_DO_VINCULO.contato));
    const sub: Task = { ...structuredClone(raiz), id: "tsk_sub_por_id", parentTaskId: raiz.id, rootTaskId: raiz.id };
    limpo.tasks.push(sub);
    expect(vinculosDoCrmDaTarefa(limpo, sub).contatoId).toBe(CONTATO);
  });

  it("o Vínculo com o papel certo vence outro do mesmo tipo sem papel", () => {
    const t = tarefa();
    const OUTRO = "77777777-7777-4777-8777-777777777777";
    limpo.links.push(elo(t.id, "contact", OUTRO), elo(t.id, "contact", CONTATO, PAPEL_DO_VINCULO.contato));
    expect(vinculosDoCrmDaTarefa(limpo, t).contatoId).toBe(CONTATO);
  });

  it("canaisDaListaNasTabelas devolve os Canais da Lista conversacional na ordem marcada, sem os arquivados", () => {
    const lista = { modeloDeTarefa: "conversacional" as const, canaisDeAtendimento: [CANAL_C, CANAL_A, CANAL_B] };
    const canais = [canal(CANAL_A, "whatsapp"), canal(CANAL_B, "email", "arquivado"), canal(CANAL_C, "email")];
    expect(canaisDaListaNasTabelas(lista, canais).map((c) => c.id)).toEqual([CANAL_C, CANAL_A]);
  });

  it("canaisDaListaNasTabelas: Lista operacional ou ausente devolve vazio", () => {
    const canais = [canal(CANAL_A, "whatsapp")];
    expect(canaisDaListaNasTabelas({ modeloDeTarefa: "operacional", canaisDeAtendimento: [CANAL_A] }, canais)).toEqual([]);
    expect(canaisDaListaNasTabelas(undefined, canais)).toEqual([]);
  });

  it("canaisDaListaQueAlcancamNasTabelas: Identificadores só de e-mail deixam só os Canais de e-mail; sem identificadores, todos os da Lista", () => {
    const lista = { modeloDeTarefa: "conversacional" as const, canaisDeAtendimento: [CANAL_A, CANAL_C] };
    const canais = [canal(CANAL_A, "whatsapp"), canal(CANAL_C, "email")];
    expect(canaisDaListaQueAlcancamNasTabelas(lista, canais, [{ tipo: "email" }]).map((c) => c.id)).toEqual([CANAL_C]);
    expect(canaisDaListaQueAlcancamNasTabelas(lista, canais, undefined).map((c) => c.id)).toEqual([CANAL_A, CANAL_C]);
  });

  it("listaSemCanaisNasTabelas: conversacional sem Canal ativo é vazia; operacional não", () => {
    const canais = [canal(CANAL_A, "whatsapp", "arquivado")];
    expect(listaSemCanaisNasTabelas({ modeloDeTarefa: "conversacional", canaisDeAtendimento: [CANAL_A] }, canais)).toBe(true);
    expect(listaSemCanaisNasTabelas({ modeloDeTarefa: "operacional" }, canais)).toBe(false);
  });

  it("createTask com alvoConferido nasce sem o Contato no estado; sem ele recusa como hoje", () => {
    const sem = createTask(limpo, THIAGO, {
      listId: listaDoSuporte.id,
      title: "Sem conferência",
      vinculos: [{ toType: "contact", toId: CONTATO, role: PAPEL_DO_VINCULO.contato }],
    });
    expect(sem.ok).toBe(false);
    if (!sem.ok) expect(sem.error).toBe("Contato não encontrado.");

    const com = createTask(limpo, THIAGO, {
      listId: listaDoSuporte.id,
      title: "Conferida pelo servidor",
      vinculos: [
        { toType: "contact", toId: CONTATO, role: PAPEL_DO_VINCULO.contato, alvoConferido: true },
        { toType: "conversation", toId: CONVERSA, role: PAPEL_DO_VINCULO.conversa, alvoConferido: true },
        { toType: "deal", toId: NEGOCIO, role: PAPEL_DO_VINCULO.negocio, alvoConferido: true },
      ],
    });
    expect(com.ok).toBe(true);
    if (!com.ok) return;
    expect(vinculosDoCrmDaTarefa(limpo, com.value)).toEqual({ contatoId: CONTATO, conversaId: CONVERSA, negocioId: NEGOCIO });
  });

  it("moveTask aceita entrar numa Lista conversacional a Tarefa com Vínculo de Contato fora do estado", () => {
    const operacional = limpo.lists.find((l) => l.id === "lst_ativacao");
    if (!operacional) throw new Error("o seed precisa de lst_ativacao");
    const nasceu = createTask(limpo, THIAGO, { listId: operacional.id, title: "Para entrar" });
    if (!nasceu.ok) throw new Error(nasceu.error);
    const sem = moveTask(limpo, THIAGO, nasceu.value.id, listaDoSuporte.id, mapeamentoPara(nasceu.value));
    expect(sem.ok).toBe(false);
    if (!sem.ok) expect(sem.error).toBe("Uma Lista conversacional só recebe Tarefa com Contato vinculado.");

    limpo.links.push(elo(nasceu.value.id, "contact", CONTATO, PAPEL_DO_VINCULO.contato));
    const entrou = moveTask(limpo, THIAGO, nasceu.value.id, listaDoSuporte.id, mapeamentoPara(nasceu.value));
    expect(entrou.ok).toBe(true);
    expect(nasceu.value.listId).toBe(listaDoSuporte.id);
  });

  /** Leva o Status atual da Tarefa ao primeiro Status da Lista do Suporte. */
  function mapeamentoPara(task: Task): { fromStatusId: string; toStatusId: string }[] {
    const config = effectiveListConfig(limpo, listaDoSuporte.id);
    const alvo = config?.statusSet.definitions[0];
    if (!alvo) throw new Error("a Lista do Suporte precisa de um Status");
    return [{ fromStatusId: task.statusId, toStatusId: alvo.id }];
  }
});
