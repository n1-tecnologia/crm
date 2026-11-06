"use client";

/**
 * Quantas Conversas ativas estão atribuídas a um Agente (Fase 15, 3.4.9, UCR-08): o número que a
 * ficha diz antes de arquivar o Agente ou enviá-lo à lixeira ("N Conversa(s) ficam sem este
 * Responsável", RN-AGE-20). As Conversas vivem em `plataforma.conversas`, não no store: o total
 * vem de `GET /conversas?atribuidoId=` (`limite: 1`, só o `total` interessa). `undefined`
 * enquanto a primeira resposta não chega (ou se a api recusa): a tela não afirma um número que
 * não tem. `atribuidoId` vazio (Agente que ainda não existe) não vai à api.
 */

import { useConversas } from "@/dados/crm/conversas";

export function useConversasDoAgente(agentId: string | undefined): number | undefined {
  const lista = useConversas({ atribuidoId: agentId ?? "", limite: 1 }, { pausado: agentId === undefined || agentId === "" });
  return lista.data?.total;
}
