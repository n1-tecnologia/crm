/**
 * O GUIA DO FINANCEIRO — módulo de dados puro (sem JSX, sem `"use client"`),
 * testado com Vitest sem jsdom; a tela está em `./guia-do-financeiro-dialogo.tsx`.
 *
 * 2026-10-02, pedidos do dono: "um pequeno onboarding do financeiro quando a
 * Mari entrar na conta dela … ensinando ela a fazer as coisas" e "um vídeo com
 * Remotion explicando como vai funcionar o financeiro … aparecer para eles até
 * três vezes, até eles pedirem para não aparecer mais". Abre sozinho (com o
 * vídeo) na entrada de quem alcança a Pasta Financeiro, no máximo
 * `VEZES_DO_GUIA` vezes, e nunca mais depois de "Não mostrar mais"; reabre à
 * mão pelo item "Guia do Financeiro" do menu ⋯ das Listas do Financeiro.
 *
 * O progresso é preferência de tela, por pessoa E por navegador (como a barra
 * recolhida e a largura do Chat): mora no `localStorage`, não no domínio.
 * "Uma entrada" é uma sessão do navegador (`sessionStorage`): recarregar ou
 * navegar não conta de novo.
 */

import { memberReachesContainer } from "@n1/dominio/derive";
import { CP, CR } from "@n1/dominio/operations/financeiro";
import { LISTA_ID as LISTA_DE_SOLICITACOES } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import type { DataState } from "@n1/dominio/state";
import type { Id } from "@n1/dominio/types";

/** Quantas entradas o guia abre sozinho enquanto a pessoa não pedir para não mostrar mais. */
export const VEZES_DO_GUIA = 3;

/** O evento que "Guia do Financeiro" (menu ⋯ da Lista) dispara para reabrir o guia, de qualquer tela. */
export const EVENTO_ABRIR_GUIA = "n1:abrir-guia-do-financeiro";

export interface ProgressoDoGuia {
  /** Quantas vezes o guia já abriu sozinho. */
  readonly vezes: number;
  /** A pessoa pediu "Não mostrar mais". */
  readonly dispensado: boolean;
}

export const PROGRESSO_INICIAL: ProgressoDoGuia = { vezes: 0, dispensado: false };

export interface PassoDoGuia {
  readonly id: string;
  readonly titulo: string;
  readonly paragrafos: readonly string[];
  /** Onde o passo acontece. Sem ele, o passo é só leitura. */
  readonly destino?: { readonly href: string; readonly rotulo: string };
  /** A Lista que a pessoa precisa alcançar para o passo fazer sentido. */
  readonly lista: Id;
}

const lista = (id: Id) => `/estrutura/listas/${id}`;

/** Os passos, na ordem do trabalho: o pedido chega, vira conta, é conferido e lançado. */
export const PASSOS_DO_GUIA: readonly PassoDoGuia[] = [
  {
    id: "solicitacoes",
    titulo: "Os pedidos chegam em Solicitações de pagamento",
    paragrafos: [
      "Cada envio do Formulário vira uma Solicitação nesta Lista, com o que foi pedido e os anexos.",
      "É dela que o pedido segue para a aprovação. Abra uma Solicitação para ver em que ponto está.",
    ],
    destino: { href: lista(LISTA_DE_SOLICITACOES), rotulo: "Abrir Solicitações de pagamento" },
    lista: LISTA_DE_SOLICITACOES,
  },
  {
    id: "formulario",
    titulo: "O link do Formulário",
    paragrafos: [
      "No topo de Solicitações de pagamento, “Abrir formulário” mostra a página que quem pede o pagamento preenche. No menu ⋯ ao lado, “Copiar link do formulário” copia o endereço para você mandar.",
      "Para mudar perguntas, a ordem, as seções ou quando uma pergunta aparece: Configurações da Lista › Formulários.",
    ],
    destino: { href: `${lista(LISTA_DE_SOLICITACOES)}/configuracoes`, rotulo: "Abrir as Configurações da Lista" },
    lista: LISTA_DE_SOLICITACOES,
  },
  {
    id: "contas-a-pagar",
    titulo: "Contas a pagar",
    paragrafos: [
      "“+ Nova conta” cria uma conta a pagar.",
      "O Status diz em que ponto a conta está, de “para pagar” até “pago”. Mude pelo Status da própria conta.",
    ],
    destino: { href: lista(CP.listId), rotulo: "Abrir Contas a pagar" },
    lista: CP.listId,
  },
  {
    id: "resumo",
    titulo: "A Conferência do Resumo",
    paragrafos: [
      "Antes de lançar no Omie, o Agente publica o Resumo de pagamento na conta e abre a Conferência do Resumo.",
      "Confira fornecedor, valor, vencimento e lançamento. Está certo: “Conferir”. Precisa mudar: “Pedir ajuste”, escrevendo o que ajustar.",
    ],
    destino: { href: lista(CP.listId), rotulo: "Ver as contas a pagar" },
    lista: CP.listId,
  },
  {
    id: "contas-a-receber",
    titulo: "Contas a receber",
    paragrafos: [
      "“+ Nova conta a receber” cria uma conta; “Nova série de parcelas” cria todas as parcelas de uma vez.",
      "Para ver o vídeo e este passo a passo de novo: menu ⋯ de qualquer Lista do Financeiro › “Guia do Financeiro”.",
    ],
    destino: { href: lista(CR.listId), rotulo: "Abrir Contas a receber" },
    lista: CR.listId,
  },
];

/** Só os passos das Listas que a pessoa alcança — sem caminho para tela que ela não abre. */
export function passosPara(estado: DataState, memberId: Id): readonly PassoDoGuia[] {
  return PASSOS_DO_GUIA.filter((passo) => memberReachesContainer(estado, memberId, "list", passo.lista));
}

/** Abre sozinho: não dispensado, ainda dentro das vezes, e não aberto nesta entrada. */
export function deveAbrirSozinho(progresso: ProgressoDoGuia, jaAbriuNestaEntrada: boolean): boolean {
  return !progresso.dispensado && progresso.vezes < VEZES_DO_GUIA && !jaAbriuNestaEntrada;
}

export function registrarAbertura(progresso: ProgressoDoGuia): ProgressoDoGuia {
  return { ...progresso, vezes: progresso.vezes + 1 };
}

/** "Não mostrar mais": vale mesmo antes da terceira vez. */
export function dispensarGuia(progresso: ProgressoDoGuia): ProgressoDoGuia {
  return { ...progresso, dispensado: true };
}

/** Lê o que o navegador guardou; qualquer coisa fora da forma volta ao início. */
export function lerProgresso(texto: string | null): ProgressoDoGuia {
  if (!texto) return PROGRESSO_INICIAL;
  try {
    const valor: unknown = JSON.parse(texto);
    if (typeof valor !== "object" || valor === null) return PROGRESSO_INICIAL;
    const { vezes, dispensado } = valor as Record<string, unknown>;
    return {
      vezes: typeof vezes === "number" && Number.isInteger(vezes) && vezes >= 0 ? vezes : 0,
      dispensado: dispensado === true,
    };
  } catch {
    return PROGRESSO_INICIAL;
  }
}

export const chaveDoProgresso = (memberId: Id) => `n1:guia-do-financeiro:${memberId}`;
export const chaveDaEntrada = (memberId: Id) => `n1:guia-do-financeiro:entrada:${memberId}`;

/**
 * O vídeo "Como funciona o Financeiro": a TELA REAL do N1 gravada como uma
 * pessoa usando (dados fictícios), montada com Remotion — zoom no que se
 * explica, cursor e legendas. Gerado por `ferramentas/video-do-financeiro/`
 * (servidor de demonstração + gravação + render) e publicado no Storage do
 * Supabase, no bucket público `guias` (dado fictício; fora do repositório e
 * fora do bucket privado de anexos). O app só toca o MP4.
 */
export const BUCKET_DOS_GUIAS = "guias";

/** O endereço público de um arquivo do bucket `guias`. */
export function arquivoDoGuia(nome: string, base: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""): string {
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET_DOS_GUIAS}/${nome}`;
}

export const VIDEO_DO_GUIA = { src: arquivoDoGuia("financeiro.mp4"), poster: arquivoDoGuia("financeiro.jpg") } as const;
