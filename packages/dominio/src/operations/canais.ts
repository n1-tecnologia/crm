/**
 * CANAIS (C36): o Canal é a conta conectada de um Tipo de Canal — um número de
 * WhatsApp, um endereço de e-mail, um perfil de Instagram ou de LinkedIn —
 * contida pela Caixa de Entrada (documento 14, 7.2). Até 2026-09-22 nenhuma
 * operação o criava ou configurava: os Canais eram só os do seed.
 *
 * Duas coisas moram aqui:
 *   1. o Canal como registro: `criarCanal` (o "adicionar" do popup) e
 *      `configurarCanal` (nome, o setor — a Fila padrão — e a Origem padrão);
 *   2. o que a Lista conversacional faz com Canais: os "canais de atendimento"
 *      (`validarCanaisDeAtendimento`, `canalForaDaLista`, `LISTA_SEM_CANAIS`),
 *      lidos por `createList`, `definirCanaisDaLista`, `criarTarefaConversacional`,
 *      `trocarCanalDaTarefa` e `iniciarConversa`.
 *
 * Quem governa: criar e configurar Canal é ato de quem administra o Espaço de
 * Trabalho (B35; RN-ET-24) — o Canal não tem Proprietário (DO-CXE-02). Marcar
 * ou desmarcar os canais de UMA Lista é de quem administra a Lista (fica em
 * `definirCanaisDaLista`).
 *
 * O protótipo SIMULA o provedor: um Canal criado aqui já nasce `conectada`. A
 * ontologia (12.2) faz a conta nascer desconectada e conectar depois; sem
 * provedor de verdade, a espera seria teatro. Registrado em C36.
 *
 * O Chat do site é Tipo de Canal do domínio, mas não é canal de atendimento
 * de Lista: ele nasce de visitante anônimo, não de um Contato que a Tarefa
 * carrega. A tela não o oferece porque o domínio o recusa — não o contrário.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Channel, ChannelType, Id, List } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { administraOEspaco } from "./ia/permissoes-ia";

const now = (): string => new Date().toISOString();

/** Os Tipos de Canal por onde uma Lista conversacional atende. */
export const TIPOS_DE_ATENDIMENTO = ["whatsapp", "email", "instagram", "linkedin"] as const;
export type TipoDeAtendimento = (typeof TIPOS_DE_ATENDIMENTO)[number];

/** O rótulo de cada Tipo de Canal — a fonte única; `CHANNEL_TYPE_LABEL` da tela lê daqui. */
export const ROTULO_DO_TIPO_DE_CANAL: Record<ChannelType, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  chatDoSite: "Chat do site",
};

/**
 * O que cada tipo pede para conectar uma conta — é o que o popup de "adicionar"
 * mostra: o rótulo do campo, um exemplo e a dica que vira a recusa quando a
 * forma não serve. A forma canônica (`identificadorCanonico`) é a mesma que o
 * Identificador externo do seed usa, para a unicidade (INV-CXE-01) comparar
 * iguais com iguais.
 */
export const FORMA_DO_IDENTIFICADOR: Record<TipoDeAtendimento, { readonly rotulo: string; readonly exemplo: string; readonly dica: string }> = {
  whatsapp: {
    rotulo: "Número",
    exemplo: "+55 11 98765-4321",
    dica: "O número com o código do país, como +55 11 98765-4321.",
  },
  email: {
    rotulo: "Endereço de e-mail",
    exemplo: "atendimento@empresa.com.br",
    dica: "Um endereço de e-mail completo, como atendimento@empresa.com.br.",
  },
  instagram: {
    rotulo: "Usuário do Instagram",
    exemplo: "@empresa",
    dica: "O usuário da conta, com ou sem @ — letras, números, ponto e sublinhado.",
  },
  linkedin: {
    rotulo: "Página ou perfil do LinkedIn",
    exemplo: "company/empresa ou in/nome",
    dica: "A página (company/…) ou o perfil (in/…) do LinkedIn, ou o endereço completo.",
  },
};

/** A forma canônica do identificador externo por tipo; `undefined` quando a forma não serve. */
export function identificadorCanonico(tipo: TipoDeAtendimento, bruto: string): string | undefined {
  const texto = bruto.trim();
  if (!texto) return undefined;
  if (tipo === "whatsapp") {
    const digitos = texto.replace(/[\s().-]/g, "");
    return /^\+\d{10,15}$/.test(digitos) ? digitos : undefined;
  }
  if (tipo === "email") {
    const endereco = texto.toLocaleLowerCase("pt-BR");
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(endereco) ? endereco : undefined;
  }
  if (tipo === "instagram") {
    const usuario = texto
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/\/.*$/, "")
      .replace(/^@/, "")
      .toLocaleLowerCase("pt-BR");
    return /^[a-z0-9._]{1,30}$/.test(usuario) ? usuario : undefined;
  }
  // linkedin: `in/<perfil>` ou `company/<página>`; um nome solto é perfil.
  const caminho = texto
    .replace(/^https?:\/\/(www\.)?linkedin\.com\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLocaleLowerCase("pt-BR");
  const partes = caminho.split("/");
  const [prefixo, nome] = partes.length === 1 ? ["in", partes[0]] : [partes[0], partes[1]];
  if (!nome || partes.length > 2 || !/^[a-z0-9._-]{2,100}$/.test(nome)) return undefined;
  if (prefixo !== "in" && prefixo !== "company") return undefined;
  return `${prefixo}/${nome}`;
}

/** Só quem administra o Espaço de Trabalho conecta e configura Canais (B35). */
export function recusaDeGerirCanais(state: DataState, memberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === memberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo mexe nos Canais.";
  if (!administraOEspaco(state, memberId)) {
    return "Só quem administra o Espaço de Trabalho conecta e configura Canais.";
  }
  return undefined;
}

export const LISTA_SEM_CANAIS =
  "Esta Lista ainda não tem canais de atendimento: configure-os nas Configurações da Lista.";

export const CANAIS_SO_NA_CONVERSACIONAL = "Só uma Lista conversacional tem canais de atendimento.";

/**
 * Os canais de atendimento de uma Lista, validados: ao menos um, todos Canais
 * ativos e de um tipo de atendimento. Devolve os ids sem repetição, ou a frase
 * da recusa. A conexão NÃO entra aqui — é transitória; a tela impede marcar um
 * Canal desconectado, e o domínio recusa usá-lo na hora de abrir a conversa.
 */
export function validarCanaisDeAtendimento(
  state: DataState,
  ids: readonly Id[] | undefined,
): { readonly ids: readonly Id[] } | string {
  const unicos = [...new Set(ids ?? [])];
  if (unicos.length === 0) return "Escolha ao menos um Canal de atendimento.";
  for (const id of unicos) {
    const canal = state.channels.find((c) => c.id === id);
    if (!canal || canal.lifecycle !== "ativo") return "Canal não encontrado ou arquivado.";
    if (!(TIPOS_DE_ATENDIMENTO as readonly string[]).includes(canal.channelType)) {
      return `${ROTULO_DO_TIPO_DE_CANAL[canal.channelType]} não é canal de atendimento de Lista.`;
    }
  }
  return { ids: unicos };
}

/** A recusa quando o Canal não está entre os de atendimento da Lista. */
export function canalForaDaLista(state: DataState, list: List, channel: Channel): string | undefined {
  if (list.modeloDeTarefa !== "conversacional") return undefined;
  const canais = list.canaisDeAtendimento ?? [];
  if (canais.length === 0) return LISTA_SEM_CANAIS;
  if (canais.includes(channel.id)) return undefined;
  return `Esta Lista não atende por “${channel.name}” (${ROTULO_DO_TIPO_DE_CANAL[channel.channelType]}).`;
}

/** Nome único entre Canais ativos (RN-CXE-31), sem distinção de caixa nem espaços nas pontas. */
function nomeEmUso(state: DataState, nome: string, excetoId?: Id): Channel | undefined {
  const norm = (valor: string) => valor.trim().toLocaleLowerCase("pt-BR");
  return state.channels.find((c) => c.lifecycle === "ativo" && c.id !== excetoId && norm(c.name) === norm(nome));
}

function filaValida(state: DataState, queueId: Id): string | undefined {
  const fila = state.queues.find((q) => q.id === queueId);
  if (!fila || fila.lifecycle !== "ativo") return "Fila não encontrada ou arquivada.";
  return undefined;
}

function origemValida(state: DataState, originId: Id): string | undefined {
  const origem = state.catalog.find((item) => item.id === originId && item.kind === "origem");
  if (!origem || origem.lifecycle !== "ativo") return "Origem não encontrada no catálogo do Espaço de Trabalho.";
  return undefined;
}

export interface CriarCanalInput {
  readonly channelType: TipoDeAtendimento;
  readonly name: string;
  /** Como a pessoa digitou; a forma canônica é decidida aqui. */
  readonly externalId: string;
  /** O setor que atende: a Fila em que as Conversas deste Canal entram. */
  readonly defaultQueueId?: Id;
  /** De onde vêm os Contatos que nascem por este Canal. */
  readonly defaultOriginId?: Id;
}

/**
 * Conecta uma conta nova. Nasce `conectada` (o protótipo simula o provedor),
 * sem Mensagens de modelo e sem grupos — os dois se configuram depois, na
 * ficha do Canal. Quem conectou fica como Membro configurador: rastreabilidade,
 * não governança (B35).
 */
export function criarCanal(state: DataState, actingMemberId: Id, input: CriarCanalInput): OperationResult<Channel> {
  const permissao = recusaDeGerirCanais(state, actingMemberId);
  if (permissao) return fail(permissao);
  const nome = input.name.trim();
  if (!nome) return fail("Dê um nome ao Canal.", "nome");
  if (!(TIPOS_DE_ATENDIMENTO as readonly string[]).includes(input.channelType)) {
    return fail("Este Tipo de Canal não se conecta por aqui.", "tipo");
  }
  const externalId = identificadorCanonico(input.channelType, input.externalId);
  if (!externalId) return fail(FORMA_DO_IDENTIFICADOR[input.channelType].dica, "identificador");

  const mesmoNome = nomeEmUso(state, nome);
  if (mesmoNome) return fail(`Já existe um Canal chamado “${mesmoNome.name}”.`, "nome");
  // INV-CXE-01 — a mesma conta não é conectada duas vezes.
  const mesmaConta = state.channels.find(
    (c) => c.lifecycle === "ativo" && c.channelType === input.channelType && c.externalId === externalId,
  );
  if (mesmaConta) return fail(`Esta conta já está conectada como “${mesmaConta.name}”.`, "identificador");
  if (input.defaultQueueId !== undefined) {
    const fila = filaValida(state, input.defaultQueueId);
    if (fila) return fail(fila, "fila");
  }
  if (input.defaultOriginId !== undefined) {
    const origem = origemValida(state, input.defaultOriginId);
    if (origem) return fail(origem, "origem");
  }

  const channel: Channel = {
    id: nextId("chn"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    name: nome,
    channelType: input.channelType,
    externalId,
    connection: "conectada",
    configuredByMemberId: actingMemberId,
    ...(input.defaultQueueId !== undefined ? { defaultQueueId: input.defaultQueueId } : {}),
    ...(input.defaultOriginId !== undefined ? { defaultOriginId: input.defaultOriginId } : {}),
    messageTemplates: [],
    groupsEnabled: false,
  };
  state.channels.push(channel);
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Canal conectado",
    objectType: "channel",
    objectId: channel.id,
    objectName: channel.name,
    detail: `${ROTULO_DO_TIPO_DE_CANAL[channel.channelType]} · ${channel.externalId}`,
  });
  return ok(channel, channel.id);
}

export interface ConfigurarCanalInput {
  readonly name?: string;
  /** `null` limpa: as Conversas passam a nascer sem Fila. */
  readonly defaultQueueId?: Id | null;
  /** `null` limpa. */
  readonly defaultOriginId?: Id | null;
}

/** O resumo de uma configuração, para o antes/depois do Registro de Atividade. */
function resumoDeConfiguracao(state: DataState, channel: Channel): string {
  const fila = channel.defaultQueueId ? state.queues.find((q) => q.id === channel.defaultQueueId)?.name : undefined;
  const origem = channel.defaultOriginId ? state.catalog.find((i) => i.id === channel.defaultOriginId)?.name : undefined;
  return `${channel.name} · Fila: ${fila ?? "nenhuma"} · Origem: ${origem ?? "nenhuma"}`;
}

/**
 * Configura o Canal: o nome, o setor (Fila padrão) e a Origem padrão. O Tipo e
 * o identificador externo são imutáveis (INV-CXE-02; seção 5): outra conta é
 * outro Canal.
 */
export function configurarCanal(
  state: DataState,
  actingMemberId: Id,
  channelId: Id,
  input: ConfigurarCanalInput,
): OperationResult<Channel> {
  const permissao = recusaDeGerirCanais(state, actingMemberId);
  if (permissao) return fail(permissao);
  const channel = state.channels.find((c) => c.id === channelId);
  if (!channel) return fail("Canal não encontrado.");
  if (channel.lifecycle !== "ativo") return fail("Um Canal arquivado não muda de configuração.");

  const nome = input.name?.trim();
  if (input.name !== undefined && !nome) return fail("Dê um nome ao Canal.", "nome");
  if (nome !== undefined) {
    const mesmoNome = nomeEmUso(state, nome, channel.id);
    if (mesmoNome) return fail(`Já existe um Canal chamado “${mesmoNome.name}”.`, "nome");
  }
  if (input.defaultQueueId) {
    const fila = filaValida(state, input.defaultQueueId);
    if (fila) return fail(fila, "fila");
  }
  if (input.defaultOriginId) {
    const origem = origemValida(state, input.defaultOriginId);
    if (origem) return fail(origem, "origem");
  }

  const antes = resumoDeConfiguracao(state, channel);
  if (nome !== undefined) channel.name = nome;
  if (input.defaultQueueId !== undefined) {
    if (input.defaultQueueId === null) delete channel.defaultQueueId;
    else channel.defaultQueueId = input.defaultQueueId;
  }
  if (input.defaultOriginId !== undefined) {
    if (input.defaultOriginId === null) delete channel.defaultOriginId;
    else channel.defaultOriginId = input.defaultOriginId;
  }
  const depois = resumoDeConfiguracao(state, channel);
  if (antes === depois) return ok(channel);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Canal configurado",
    objectType: "channel",
    objectId: channel.id,
    objectName: channel.name,
    before: antes,
    after: depois,
  });
  return ok(channel, channel.id);
}
