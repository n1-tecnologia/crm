"use client";

/**
 * O que a pessoa tem de responder, num só lugar (T51, 15-14): o selo do trilho, o sino da
 * barra global, a página de Notificações e o panorama do robô leem DAQUI, então os números
 * nunca discordam.
 *
 * Só as Conversas atribuídas vêm do CRM novo, por HTTP: duas consultas a `GET /conversas`
 * (`situacao=aberta` e `situacao=pendente`, as duas "não resolvidas"), do Membro da sessão.
 * O `total` da api é o que entra na soma — `limite: 20` só dá a página que a tela lista, e o
 * selo não pode parar em 20. Aprovações, Tarefas vencidas e bloqueadas, menções e comentários
 * observados seguem derivados do store (`notificacoesDoMembro`).
 *
 * "Hoje" é fixado na montagem: as contagens não mudam sozinhas à meia-noite (nem precisam).
 * Sem resposta da api (carregando, ou recusa), nenhuma Conversa entra no total: o selo não
 * inventa número. O SWR reaproveita a mesma chave entre o painel, a barra e a página.
 */

import { useState } from "react";
import { notificacoesDoMembro, type NotificacoesDoMembro } from "@n1/dominio/derive";
import { useConversas } from "@/dados/crm/conversas";
import { useData, useSession } from "@/dados/store";

/** Quantas Conversas a página de Notificações lista; o selo usa o `total` da api, não este número. */
const CONVERSAS_NA_PAGINA = 20;

export function useNotificacoesDoMembro(): NotificacoesDoMembro & { readonly carregando: boolean } {
  const estado = useData((data) => data);
  const { memberId } = useSession();
  const [agora] = useState(() => new Date());
  const abertas = useConversas({ atribuidoId: memberId, situacao: "aberta", limite: CONVERSAS_NA_PAGINA });
  const pendentes = useConversas({ atribuidoId: memberId, situacao: "pendente", limite: CONVERSAS_NA_PAGINA });

  const itens = [...(abertas.data?.itens ?? []), ...(pendentes.data?.itens ?? [])].sort((a, b) =>
    b.atualizadoEm.localeCompare(a.atualizadoEm),
  );
  const total = (abertas.data?.total ?? 0) + (pendentes.data?.total ?? 0);

  return {
    ...notificacoesDoMembro(estado, memberId, agora, { itens, total }),
    carregando: abertas.isLoading || pendentes.isLoading,
  };
}
