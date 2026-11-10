"use client";

/**
 * O PANORAMA DO ROBÔ — o que ele sabe do Membro, lido do armazém NA HORA da
 * pergunta (não na renderização: a tela do Início nasce igual no servidor e no
 * navegador, e "vencida" depende de agora). Alimenta `responderEmTexto`.
 * Desde o 15-23 o CRM vem de `GET /crm/inicio/panorama`, não do store.
 */

import { useCallback } from "react";
import type { PanoramaDoCrm } from "@n1/dominio/crm/inicio";
import { isOverdue, tarefasAbertasDoMembro, type NotificacoesDoMembro } from "@n1/dominio/derive";
import type { DataState } from "@n1/dominio/state";
import { usePanoramaDoCrm } from "@/dados/crm/inicio";
import { useData, useSession } from "@/dados/store";
import type { Formatters } from "@/features/shell/format";
import { useNotificacoesDoMembro } from "@/features/shell/use-notificacoes";
import { useFormat } from "@/features/shell/use-format";
import { responderEmTexto, type Panorama } from "./respostas-do-robo";

/** Quantos títulos e nomes o robô cita. */
const CITADOS = 3;

/**
 * O que o robô sabe. As Tarefas saem do store; Contatos, Negócios e Conversas
 * abertas saem do que o servidor somou (`GET /crm/inicio/panorama`, 15-18), que
 * chega por `panorama`: sem ele (carregando, recusado) ou com o bloco `null` (Papel
 * sem `ler`), o número é zero e o valor ponderado some, nunca um palpite.
 */
export function montarPanorama(
  state: DataState,
  memberId: string | undefined,
  formato: Formatters,
  agora: Date,
  notificacoes: NotificacoesDoMembro | null,
  panorama: PanoramaDoCrm | undefined,
): Panorama {
  const membro = state.members.find((m) => m.id === memberId);
  const minhas = memberId ? tarefasAbertasDoMembro(state, memberId) : [];
  const vencidas = minhas.filter((tarefa) => isOverdue(state, tarefa, agora));
  const abertos = panorama?.negociosAbertos ?? null;
  const valorPonderado =
    abertos && abertos.valorPonderado !== null && abertos.moeda !== null
      ? formato.money({ amount: abertos.valorPonderado, currency: abertos.moeda })
      : null;
  return {
    nome: membro?.displayName.trim().split(/\s+/)[0] ?? "",
    tarefas: { abertas: minhas.length, vencidas: vencidas.length, urgentes: vencidas.slice(0, CITADOS).map((tarefa) => tarefa.title) },
    notificacoes: {
      total: notificacoes?.total ?? 0,
      mencoes: notificacoes?.mencoes.length ?? 0,
      aprovacoes: notificacoes?.aprovacoes.length ?? 0,
      conversas: notificacoes?.conversasTotal ?? 0,
      vencidas: notificacoes?.vencidas.length ?? 0,
    },
    contatos: {
      total: panorama?.contatosTotal ?? 0,
      recentes: (panorama?.contatosRecentes ?? []).slice(0, CITADOS).map((contato) => contato.nome),
    },
    negocios: { abertos: abertos?.quantidade ?? 0, valorPonderado },
    conversas: { abertas: panorama?.conversasAbertas ?? 0, minhas: notificacoes?.conversasTotal ?? 0 },
  };
}

/** A resposta em texto do robô a uma pergunta, com o panorama do instante. */
export function useRespostaDoRobo(): (pergunta: string | null) => string {
  // O grafo é mutado no lugar: a referência não muda, e a leitura na hora da
  // pergunta vê o estado de agora sem re-renderizar a tela a cada operação.
  const dados = useData((estado) => estado);
  const { memberId } = useSession();
  const formato = useFormat();
  // As notificações (com as Conversas atribuídas da api) vêm do mesmo hook do selo e da página.
  const notificacoes = useNotificacoesDoMembro();
  // O resto do CRM (Contatos, Negócios, Conversas abertas) é o que o servidor somou.
  const { panorama } = usePanoramaDoCrm();
  return useCallback(
    (pergunta) => responderEmTexto(pergunta, montarPanorama(dados, memberId, formato, new Date(), memberId ? notificacoes : null, panorama)),
    [dados, memberId, formato, notificacoes, panorama],
  );
}
