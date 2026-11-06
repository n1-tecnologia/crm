/**
 * CANAIS (C36): o Canal é a conta conectada de um Tipo de Canal — um número de
 * WhatsApp, um endereço de e-mail, um perfil de Instagram ou de LinkedIn —
 * contida pela Caixa de Entrada (documento 14, 7.2).
 *
 * O Canal como registro mora em `plataforma.canais` e nasce pelas rotas `/canais`
 * (`crm/canais.ts`); `criarCanal` e `configurarCanal`, as operações do modelo antigo, saíram de
 * `OPERACOES` na 15-32. Aqui ficou o que a Lista conversacional faz com Canais: os "canais de
 * atendimento" (`validarCanaisDeAtendimento`, `canalForaDaListaNasTabelas`, `LISTA_SEM_CANAIS`),
 * lidos por `createList`, `definirCanaisDaLista` e pela Tarefa conversacional, e a tabela de
 * rótulos e de forma do identificador por Tipo de Canal.
 *
 * O Chat do site é Tipo de Canal do domínio, mas não é canal de atendimento
 * de Lista: ele nasce de visitante anônimo, não de um Contato que a Tarefa
 * carrega. A tela não o oferece porque o domínio o recusa — não o contrário.
 */

import type { DataState } from "../state";
import type { ChannelType, Id, List } from "../types";
import type { Canal } from "../crm/canais";

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

export const LISTA_SEM_CANAIS =
  "Esta Lista ainda não tem canais de atendimento: configure-os nas Configurações da Lista.";

export const CANAIS_SO_NA_CONVERSACIONAL = "Só uma Lista conversacional tem canais de atendimento.";

/**
 * Os canais de atendimento de uma Lista, validados: ao menos um, todos Canais
 * ativos e de um tipo de atendimento. Devolve os ids sem repetição, ou a frase
 * da recusa. A conexão NÃO entra aqui — é transitória; a tela impede marcar um
 * Canal desconectado, e o domínio recusa usá-lo na hora de abrir a conversa.
 *
 * 3.3.7 — `canais` é o conjunto de `plataforma.canais` que o SERVIDOR leu na
 * transação (`lerDoCrm`): um id que está nele vale pelo Canal da tabela, sem
 * depender de `state.channels` (a projeção some na 3.5.4). Quem chama de um
 * cliente nunca preenche `canais` com o que veio do navegador. Um id fora de
 * `canais` cai no ramo antigo, `state.channels`, que sai com o CRM antigo (3.5.4).
 */
export function validarCanaisDeAtendimento(
  state: DataState,
  ids: readonly Id[] | undefined,
  canais?: readonly Canal[],
): { readonly ids: readonly Id[] } | string {
  const unicos = [...new Set(ids ?? [])];
  if (unicos.length === 0) return "Escolha ao menos um Canal de atendimento.";
  for (const id of unicos) {
    const daTabela = canais?.find((c) => c.id === id);
    if (daTabela) {
      if (daTabela.estado !== "ativo") return "Canal não encontrado ou arquivado.";
      if (!(TIPOS_DE_ATENDIMENTO as readonly string[]).includes(daTabela.tipo)) {
        return `${ROTULO_DO_TIPO_DE_CANAL[daTabela.tipo]} não é canal de atendimento de Lista.`;
      }
      continue;
    }
    const canal = state.channels.find((c) => c.id === id);
    if (!canal || canal.lifecycle !== "ativo") return "Canal não encontrado ou arquivado.";
    if (!(TIPOS_DE_ATENDIMENTO as readonly string[]).includes(canal.channelType)) {
      return `${ROTULO_DO_TIPO_DE_CANAL[canal.channelType]} não é canal de atendimento de Lista.`;
    }
  }
  return { ids: unicos };
}

/** A recusa quando o Canal da tabela não está entre os de atendimento da Lista: o Canal só por id, nome e tipo. */
export function canalForaDaListaNasTabelas(list: List, canal: Pick<Canal, "id" | "nome" | "tipo">): string | undefined {
  if (list.modeloDeTarefa !== "conversacional") return undefined;
  const canais = list.canaisDeAtendimento ?? [];
  if (canais.length === 0) return LISTA_SEM_CANAIS;
  if (canais.includes(canal.id)) return undefined;
  return `Esta Lista não atende por “${canal.nome}” (${ROTULO_DO_TIPO_DE_CANAL[canal.tipo]}).`;
}
