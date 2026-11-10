/**
 * O que um Canal pode fazer (Documento 14, 7.1): o Tipo de Canal, o provedor e as Capacidades
 * por (tipo, provedor). Mora no CRM novo porque quem decide o que o fio pode enviar são o
 * serviço de Mensagens da api, a tela da Caixa e as Ferramentas, e nenhum deles depende mais do
 * modelo antigo de Conversa (15-32, 3.5.4).
 *
 * Os tipos `ChannelType`, `ProvedorDeCanal` e `ChannelCapabilities` nasceram em `types/crm.ts` e
 * continuam reexportados de lá enquanto o modelo antigo existe; a definição é esta.
 */

import { provedorDoCanal } from "../provedores-de-canal";
import type { Attachment, ContactIdentifierType, MessageDeliveryStatus } from "../types";

/** A1.3 — global enumeration. */
export type ChannelType =
  | "whatsapp"
  | "instagram"
  /**
   * Mensagem direta do LinkedIn. Entrou como Canal quando a tela passou a
   * precisar ENVIAR por ele; antes era só Identificador, porque registrar por
   * onde a pessoa existe não é o mesmo que poder falar com ela.
   */
  | "linkedin"
  | "email"
  | "chatDoSite";

/**
 * Depois da janela de resposta: `livre` (sem janela, ou o provedor não a impõe),
 * `soModelo` (WhatsApp oficial: só Mensagem de modelo aprovada) ou `bloqueado`
 * (Instagram: não existe modelo, e só o Contato reabre a conversa escrevendo de
 * novo; antes da primeira mensagem dele também não se fala).
 */
export type ForaDaJanela = "livre" | "soModelo" | "bloqueado";

/** Documento 14, 7.1 — fixed per channel type; neither Channel nor Conversation redefine it. */
export interface ChannelCapabilities {
  readonly resolvesIdentifierTypes: readonly ContactIdentifierType[];
  readonly responseWindowHours?: number;
  /** O que sobra depois da janela de resposta (RN-CXE-19, Sessão 8 8.3.4). Ver `ForaDaJanela`. */
  readonly foraDaJanela: ForaDaJanela;
  readonly hasSubjectAndCopies: boolean;
  readonly reportedDeliveryStatuses: readonly MessageDeliveryStatus[];
  readonly externalSenderMayEdit: boolean;
  readonly reactions: boolean;
  readonly groups: boolean;
  readonly multimodalInOneMessage: boolean;
  readonly anonymousIdentity: boolean;
  /**
   * O que dá para anexar NESTE Canal. Oferecer na tela um tipo que o Canal não
   * aceita é prometer um envio que vai falhar do lado de fora, onde nada aqui
   * desfaz.
   */
  readonly sendableMediaTypes: readonly Attachment["mediaType"][];
  /** Mídia que se apaga depois de vista uma vez. Só o WhatsApp tem. */
  readonly viewOnce: boolean;
  /** Áudio gravado na hora, diferente de anexar um arquivo de áudio. */
  readonly voiceNote: boolean;
  /** Corpo com formatação e imagem embutida, em vez de texto puro. */
  readonly richText: boolean;
}



/**
 * D-01 (Fase 8) — por onde a conta do Canal conversa. O provedor é atributo do
 * Canal, não um Tipo de Canal novo: cada provedor pertence a um Tipo só
 * (`PROVEDORES` em `provedores-de-canal.ts`, e o `CHECK canais_provedor_tipo_ck`
 * da 008 é a mesma tabela).
 */
export type ProvedorDeCanal = "whatsapp-cloud" | "whatsapp-nao-oficial" | "instagram-graph" | "email-imap-smtp";

/**
 * Documento 14, 7.1 — capabilities belong to the CHANNEL TYPE (RN-CXE-05). Esta
 * é a tabela do tipo; quem decide o que um Canal pode lê `capacidadesDoCanal`,
 * que parte daqui e só sobrepõe o que o provedor muda (D-02).
 */
export const CHANNEL_CAPABILITIES: Record<ChannelType, ChannelCapabilities> = {
  whatsapp: {
    resolvesIdentifierTypes: ["identidadeDeWhatsApp"],
    responseWindowHours: 24,
    foraDaJanela: "soModelo",
    hasSubjectAndCopies: false,
    reportedDeliveryStatuses: ["enviada", "entregue", "lida"],
    externalSenderMayEdit: true,
    reactions: true,
    groups: true,
    multimodalInOneMessage: false,
    anonymousIdentity: false,
    sendableMediaTypes: ["image", "video", "audio", "document", "sticker", "location", "flow"],
    viewOnce: true,
    voiceNote: true,
    richText: false,
  },
  instagram: {
    resolvesIdentifierTypes: ["usuarioDeInstagram"],
    responseWindowHours: 24,
    foraDaJanela: "bloqueado",
    hasSubjectAndCopies: false,
    reportedDeliveryStatuses: ["enviada", "lida"],
    externalSenderMayEdit: true,
    reactions: true,
    groups: false,
    multimodalInOneMessage: false,
    anonymousIdentity: false,
    // Sem documento: o Direct não aceita arquivo, só mídia.
    sendableMediaTypes: ["image", "video", "audio"],
    viewOnce: true,
    voiceNote: true,
    richText: false,
  },
  /*
   * LinkedIn: mensagem direta. Não tem janela de resposta, porque a permissão
   * para falar vem da conexão e não do tempo desde a última resposta. Também
   * não tem modelo aprovado: o que existe lá é limite de InMail, que é cota do
   * remetente e não aprovação de conteúdo.
   */
  linkedin: {
    resolvesIdentifierTypes: ["perfilDeLinkedIn"],
    foraDaJanela: "livre",
    hasSubjectAndCopies: false,
    reportedDeliveryStatuses: ["enviada", "lida"],
    externalSenderMayEdit: true,
    reactions: true,
    groups: true,
    multimodalInOneMessage: false,
    anonymousIdentity: false,
    sendableMediaTypes: ["image", "video", "document"],
    viewOnce: false,
    voiceNote: true,
    richText: false,
  },
  email: {
    resolvesIdentifierTypes: ["email"],
    foraDaJanela: "livre",
    hasSubjectAndCopies: true,
    reportedDeliveryStatuses: ["enviada"],
    externalSenderMayEdit: false,
    reactions: false,
    groups: true,
    multimodalInOneMessage: true,
    anonymousIdentity: false,
    // O e-mail aceita qualquer arquivo, e vários na mesma Mensagem.
    sendableMediaTypes: ["image", "video", "audio", "document", "spreadsheet", "other"],
    viewOnce: false,
    voiceNote: false,
    richText: true,
  },
  chatDoSite: {
    resolvesIdentifierTypes: ["identificadorDeChatDoSite"],
    foraDaJanela: "livre",
    hasSubjectAndCopies: false,
    reportedDeliveryStatuses: ["entregue", "lida"],
    externalSenderMayEdit: false,
    reactions: false,
    groups: false,
    multimodalInOneMessage: true,
    anonymousIdentity: true,
    sendableMediaTypes: ["image", "document"],
    viewOnce: false,
    voiceNote: false,
    richText: false,
  },
};

/**
 * As Capacidades de UM Canal. Elas continuam sendo do Tipo de Canal (RN-CXE-05;
 * documento 14, 7.1): o provedor só sobrepõe o que difere (D-02) — o WhatsApp
 * não oficial não tem janela de 24 h nem exige Mensagem de modelo aprovada.
 * Canal sem `provider` (o seed, o `criarCanal` antigo) usa `provedorDoCanal`,
 * que cai no padrão do tipo, e o resultado é a tabela do tipo, como sempre foi.
 */
export function capacidadesDoCanal(canal: {
  readonly channelType: ChannelType;
  readonly provider?: ProvedorDeCanal;
}): ChannelCapabilities {
  const base = CHANNEL_CAPABILITIES[canal.channelType];
  if (provedorDoCanal(canal) === "whatsapp-nao-oficial") {
    const { responseWindowHours: _semJanela, ...semJanela } = base;
    return { ...semJanela, foraDaJanela: "livre" };
  }
  return base;
}
