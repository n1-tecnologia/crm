/**
 * Quem pode escrever no CRM antigo (Contatos, Empresas, Conversas, Mensagens e
 * Negócios do modelo em inglês que vive em `plataforma.registros`).
 *
 * Fase 9, 1.2.2 — várias operações registradas em `OPERACOES` não conferiam o
 * ator: um Convidado (ou um Membro suspenso) chamando `trashContact`,
 * `sendMessage` ou `winDeal` por `POST /operacoes/:nome` gravava. A rota
 * recusa o suspenso (09-07) e esta é a segunda barreira, no domínio, onde a
 * regra mora para valer igual na tela e no endpoint.
 *
 * É a mesma regra de escrita de `podeNoCrm` (`../crm/permissoes`): Membro
 * `ativo` e Papel base diferente de `convidado`. Devolve `undefined` quando
 * pode e a frase de recusa, em português, quando não pode — a forma de
 * `listWriteRefusal` e de `mayWriteDeal`, que esta função substitui.
 *
 * A Sessão 3 apaga o CRM antigo; até lá, a porta fica fechada.
 *
 * Composições internas (Automações, Flows, Grupos, iniciar conversa, Tarefas
 * conversacionais) que agem em nome do Agente do pipeline (Convidado) ou de uma
 * Automação chamam a variante `…SemConferencia` da operação, que nunca entra
 * em `OPERACOES`: lá o ator já foi conferido por quem disparou a composição.
 */

import type { DataState } from "../state";
import type { Id } from "../types";

export function recusaDeEscritaNoCrmAntigo(state: DataState, actingMemberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo altera o CRM.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return "Um Convidado não altera o CRM: ele alcança só o que foi compartilhado com ele.";
  }
  return undefined;
}
