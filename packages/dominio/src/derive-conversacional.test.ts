/**
 * A Tarefa conversacional lida por ids (3.3.2): o Contato, a Conversa e o Negócio
 * saem só de `state.links`, e os Canais da Lista são os das tabelas novas, passados
 * por quem chama. Nenhuma destas leituras olha o CRM antigo: o estado de teste
 * abaixo esvazia `contacts`, `conversations`, `channels` e `deals`, e tudo passa.
 *
 * Fase 15 (15-42): as leituras que procuravam o Contato, a Conversa, o Canal e o Negócio no estado
 * (e o `derive-conversacional-antigo.test.ts` que as cobria) saíram do módulo.
 */

import { beforeEach, describe, expect, it } from "vitest";
import * as derivacoes from "./derive-conversacional";
import {
  PAPEL_DO_VINCULO,
  canaisDaListaNasTabelas,
  canaisDaListaQueAlcancamNasTabelas,
  listaSemCanaisNasTabelas,
  marcadoresDeCanal,
  rotuloDoCanal,
  tarefasConversacionaisDoContato,
  textoDoSeparadorDeCanal,
  vinculosDoCrmDaTarefa,
} from "./derive-conversacional";
import type { Canal } from "./crm/canais";
import { effectiveListConfig } from "./derive";
import { createList } from "./operations/structure";
import { VINCULO_NAO_CONFERIDO, createTask, moveTask } from "./operations/tasks";
import { buildSeed } from "./seed";
import type { DataState } from "./state";
import { canalDeTeste } from "./testes/crm-de-teste";
import type { Link, List, Task } from "./types";

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
  const comercial = { name: "Comercial", channelType: "whatsapp" as const, provider: "whatsapp-cloud" as const };
  const suporte = { name: "Suporte", channelType: "whatsapp" as const, provider: "whatsapp-nao-oficial" as const };

  it("o rótulo junta o nome e o provedor", () => {
    expect(rotuloDoCanal(comercial)).toBe("Comercial · WhatsApp oficial");
    expect(rotuloDoCanal(suporte)).toBe("Suporte · WhatsApp não oficial");
  });

  it("Canal sem provider usa o provedor padrão do tipo; sem provedor, o rótulo do tipo", () => {
    expect(rotuloDoCanal({ name: "Comercial SP", channelType: "whatsapp" })).toBe("Comercial SP · WhatsApp oficial");
    expect(rotuloDoCanal({ name: "Instituto Igor Alves no LinkedIn", channelType: "linkedin" })).toBe("Instituto Igor Alves no LinkedIn · LinkedIn");
    expect(rotuloDoCanal({ name: "Chat do site", channelType: "chatDoSite" })).toBe("Chat do site · Chat do site");
  });

  it("o separador diz por qual Canal a Mensagem passou", () => {
    expect(textoDoSeparadorDeCanal(suporte)).toBe("via Suporte (WhatsApp não oficial)");
    expect(textoDoSeparadorDeCanal({ name: "Instituto Igor Alves no LinkedIn", channelType: "linkedin" })).toBe("via Instituto Igor Alves no LinkedIn (LinkedIn)");
  });
});

describe("tarefasConversacionaisDoContato (a ficha do Contato)", () => {
  it("traz as Tarefas ativas de Listas conversacionais ligadas ao Contato, a mais recente primeiro", () => {
    const estado = buildSeed();
    const lista = estado.lists[0];
    const base = estado.tasks[0];
    if (!lista || !base) throw new Error("o seed precisa de uma Lista e de uma Tarefa");
    lista.modeloDeTarefa = "conversacional";
    const antiga = { ...structuredClone(base), id: "tsk_c_antiga", listId: lista.id, lifecycle: "ativo" as const, createdAt: "2026-09-01T00:00:00.000Z" };
    const nova = { ...structuredClone(base), id: "tsk_c_nova", listId: lista.id, lifecycle: "ativo" as const, createdAt: "2026-10-01T00:00:00.000Z" };
    const naLixeira = { ...structuredClone(base), id: "tsk_c_lixo", listId: lista.id, lifecycle: "naLixeira" as const, createdAt: "2026-10-02T00:00:00.000Z" };
    estado.tasks.push(antiga, nova, naLixeira);
    for (const t of [antiga, nova, naLixeira]) {
      estado.links.push({
        id: `lnk_${t.id}`,
        fromType: "task",
        fromId: t.id,
        toType: "contact",
        toId: "cnt_x",
        createdBy: { kind: "member", id: "mem_thiago" },
        createdAt: "2026-10-01T00:00:00.000Z",
      });
    }
    expect(tarefasConversacionaisDoContato(estado, "cnt_x").map((t) => t.id)).toEqual(["tsk_c_nova", "tsk_c_antiga"]);
    expect(tarefasConversacionaisDoContato(estado, "cnt_nao_existe")).toEqual([]);
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
    // O demo atende a Pós-venda por `chn_wpp`, e um Canal só atende em uma Lista conversacional (5.1.2).
    const posVenda = limpo.lists.find((l) => l.id === "lst_pos_venda");
    if (posVenda) posVenda.canaisDeAtendimento = [];
    // A Lista conversacional que o teste usa nasce com um Canal da tabela (o que o servidor leria de `plataforma.canais`).
    const nasceu = createList(
      limpo,
      THIAGO,
      {
        name: "Suporte por id",
        parentType: "space",
        parentId: "spc_com",
        modeloDeTarefa: "conversacional",
        canaisDeAtendimento: ["chn_wpp"],
      },
      [canalDeTeste({ id: "chn_wpp" })],
    );
    if (!nasceu.ok) throw new Error(nasceu.error);
    listaDoSuporte = nasceu.value;
    listaDoSuporte.canaisDeAtendimento = [CANAL_A];
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

  it("createTask com alvoConferido nasce sem o Contato no estado; sem ele o Vínculo é recusado", () => {
    const sem = createTask(limpo, THIAGO, {
      listId: listaDoSuporte.id,
      title: "Sem conferência",
      vinculos: [{ toType: "contact", toId: CONTATO, role: PAPEL_DO_VINCULO.contato }],
    });
    expect(sem.ok).toBe(false);
    if (!sem.ok) expect(sem.error).toBe(VINCULO_NAO_CONFERIDO);

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

  it("o corte do CRM antigo: as leituras da Tarefa que olhavam Mensagem e Contato do estado saíram do módulo (14-17)", () => {
    // `ultimaMensagemDaTarefa` não tinha mais chamador de produção. Quem precisa da última Mensagem lê
    // o resumo da api (`POST /tarefas-conversacionais/resumo`).
    expect("ultimaMensagemDaTarefa" in derivacoes).toBe(false);
  });

  it("moveTask só olha o Vínculo de Contato: um Negócio vinculado, sozinho, não basta", () => {
    // A Tarefa só aponta para um Negócio (sem Contato): a Lista conversacional não a recebe.
    const operacional = limpo.lists.find((l) => l.id === "lst_ativacao");
    if (!operacional) throw new Error("o seed precisa de lst_ativacao");
    const nasceu = createTask(limpo, THIAGO, { listId: operacional.id, title: "Só com Negócio" });
    if (!nasceu.ok) throw new Error(nasceu.error);
    limpo.links.push(elo(nasceu.value.id, "deal", "deal_sdr_1", PAPEL_DO_VINCULO.negocio));

    const recusada = moveTask(limpo, THIAGO, nasceu.value.id, listaDoSuporte.id, mapeamentoPara(nasceu.value));
    expect(recusada.ok).toBe(false);
    if (!recusada.ok) expect(recusada.error).toBe("Uma Lista conversacional só recebe Tarefa com Contato vinculado.");
    expect(nasceu.value.listId).toBe(operacional.id);
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
