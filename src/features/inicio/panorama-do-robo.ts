"use client";

/**
 * O PANORAMA DO ROBÔ — o que ele sabe do Membro, lido do armazém NA HORA da
 * pergunta (não na renderização: a tela do Início nasce igual no servidor e no
 * navegador, e "vencida" depende de agora). Alimenta `responderEmTexto`.
 */

import { useCallback } from "react";
import { contactDisplayName, isOverdue, notificacoesDoMembro, tarefasAbertasDoMembro, weightedValue } from "@/data/derive";
import type { DataState } from "@/data/state";
import { useStore } from "@/data/store";
import type { Formatters } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { responderEmTexto, type Panorama } from "./respostas-do-robo";

/** Quantos títulos e nomes o robô cita. */
const CITADOS = 3;

export function montarPanorama(state: DataState, memberId: string | undefined, formato: Formatters, agora: Date): Panorama {
  const membro = state.members.find((m) => m.id === memberId);
  const minhas = memberId ? tarefasAbertasDoMembro(state, memberId) : [];
  const vencidas = minhas.filter((tarefa) => isOverdue(state, tarefa, agora));
  const notificacoes = memberId ? notificacoesDoMembro(state, memberId, agora) : null;
  const contatos = state.contacts.filter((contato) => contato.lifecycle === "ativo");
  const recentes = [...contatos]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, CITADOS)
    .map(contactDisplayName);
  const abertos = state.deals.filter((negocio) => negocio.lifecycle === "ativo" && negocio.situation === "aberto");
  const moedas = new Set(abertos.map((negocio) => negocio.value?.currency).filter((moeda): moeda is string => Boolean(moeda)));
  const [moeda] = moedas;
  const valorPonderado =
    moedas.size === 1 && moeda
      ? formato.money({ amount: abertos.reduce((soma, negocio) => soma + (weightedValue(state, negocio) ?? 0), 0), currency: moeda })
      : null;
  const conversasAbertas = state.conversations.filter((conversa) => conversa.lifecycle === "ativo" && conversa.state !== "resolvida");
  return {
    nome: membro?.displayName.trim().split(/\s+/)[0] ?? "",
    tarefas: { abertas: minhas.length, vencidas: vencidas.length, urgentes: vencidas.slice(0, CITADOS).map((tarefa) => tarefa.title) },
    notificacoes: {
      total: notificacoes?.total ?? 0,
      mencoes: notificacoes?.mencoes.length ?? 0,
      aprovacoes: notificacoes?.aprovacoes.length ?? 0,
      conversas: notificacoes?.conversas.length ?? 0,
      vencidas: notificacoes?.vencidas.length ?? 0,
    },
    contatos: { total: contatos.length, recentes },
    negocios: { abertos: abertos.length, valorPonderado },
    conversas: { abertas: conversasAbertas.length, minhas: notificacoes?.conversas.length ?? 0 },
  };
}

/** A resposta em texto do robô a uma pergunta, com o panorama do instante. */
export function useRespostaDoRobo(): (pergunta: string | null) => string {
  // O grafo é mutado no lugar: a referência não muda, e a leitura na hora da
  // pergunta vê o estado de agora sem re-renderizar a tela a cada operação.
  const dados = useStore((estado) => estado.data);
  const memberId = useStore((estado) => estado.session.memberId);
  const formato = useFormat();
  return useCallback((pergunta) => responderEmTexto(pergunta, montarPanorama(dados, memberId, formato, new Date())), [dados, memberId, formato]);
}
