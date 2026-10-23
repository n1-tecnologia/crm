/**
 * Fase 9, D-03 e R5 — o nome de um Agente para quem não recebe a coleção
 * `agents` (o Convidado chega com ela vazia). A tela nunca pede a coleção de
 * volta ao servidor: sem o registro, mostra "Agente".
 */

import type { DataState } from "@n1/dominio/state";
import type { Id } from "@n1/dominio/types";

/** O nome do Agente, ou "Agente" quando o registro não está no estado. */
export function nomeDoAgente(estado: DataState, agentId: Id): string {
  void estado;
  void agentId;
  return "";
}
