/**
 * CRM: o que sobrou do modelo antigo em inglês depois da Fase 15 (3.5.4, UCR-12).
 *
 * Contato, Empresa, Negócio, Funil, Etapa, Canal e os Vínculos viveram aqui até o 15-43; o CRM mora
 * em `plataforma.*` (tipos em `crm/`) e o `DataState` não os guarda mais. Ficam o Tipo de Identificador
 * (a Capacidade de Canal o cita), a Fila, o Horário de atendimento e a Caixa de Entrada, e a Conversa
 * de GRUPO com as Mensagens, que Grupo e Flow ainda usam (F14-D-05), mora em `./conversa-de-grupo`.
 * Ontology: documentos 09–14, A4.4, A4.5, B8–B14, B50–B70.
 */

import type { ChannelCapabilities, ChannelType, ProvedorDeCanal } from "../crm/capacidades";
import type { CivilDate, Id, RecordBase } from "./primitives";

/** B13 — the only path by which an incoming Message resolves to a Contact. */
export type ContactIdentifierType =
  | "telefone"
  | "email"
  | "identidadeDeWhatsApp"
  | "usuarioDeInstagram"
  | "identificadorDeChatDoSite"
  /**
   * Identificador que NENHUM Canal resolve: registra por onde a pessoa existe
   * publicamente, não por onde se fala com ela. Nenhuma Capacidade de Canal o
   * lista, então ele nunca vira aba de conversa nem destino de Mensagem —
   * enquanto o LinkedIn não for um Canal com janela de resposta, modelo
   * aprovado e status de entrega definidos.
   */
  | "perfilDeLinkedIn"
  /** Como o LinkedIn: perfil público, nenhum Canal o resolve. */
  | "perfilDeTikTok";

/*
 * `ChannelType`, `ChannelCapabilities` e `ProvedorDeCanal` moraram aqui até a 15-32; a definição
 * passou a `../crm/capacidades`. O reexport fica para quem importa de `@n1/dominio/types` (a web e a api).
 */
export type { ChannelCapabilities, ChannelType, ProvedorDeCanal };

/** B70 — the queue is the only origin of permission by operational reference. */
export interface Queue extends RecordBase {
  name: string;
  description?: string;
  eligibleMemberIds: Id[];
  eligibleTeamIds: Id[];
  distribution: "herdarDaCaixa" | "manual" | "rodizio" | "menorCarga";
  maxConversationsPerAttendant?: number;
  defaultContactOwnerMemberId?: Id;
  businessHours?: BusinessHours;
}

/** DO-CXE-06 — the only source of "business hours" in messaging until C12. */
export interface BusinessHours {
  readonly days: ReadonlyArray<{ readonly weekDay: number; readonly from: string; readonly to: string }>;
  readonly holidays: readonly CivilDate[];
}

/** B11 — exactly one per workspace, created with it, never deleted. */
export interface Inbox {
  readonly id: Id;
  readonly workspaceId: Id;
  /** DO-CXE-04 — single per inbox; queues and channels do not override it. */
  reopenWindowHours: number;
  defaultDistribution: "manual" | "rodizio" | "menorCarga";
  defaultContactOwnerMemberId?: Id;
  businessHours?: BusinessHours;
}
