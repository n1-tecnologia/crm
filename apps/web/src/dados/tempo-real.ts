"use client";

/**
 * O tempo real da tela (16-08, 3.8.4, D-16-01, D-16-02, MSG-03): abre `GET /eventos` da api e revalida as chaves
 * SWR certas a cada evento, para a Mensagem que chega pelo webhook aparecer sem recarregar.
 *
 * Por que `fetch` e não a API nativa de fluxo de eventos do navegador: ela não manda cabeçalho, e a api só aceita o JWT do Supabase em
 * `Authorization: Bearer`. O corpo é lido em fluxo (`getReader` + `TextDecoder`).
 *
 * Só API do navegador (`fetch`, `ReadableStream`, `TextDecoder`) e nenhum import do backend: o formato do quadro vem de
 * `@n1/dominio/crm/eventos`. O token só vive dentro de `obterToken`/do cabeçalho; nunca vai para a URL nem para log
 * (T-16-29).
 *
 * D-16-02: um evento só revalida listas e o fio. Nenhuma notificação, som nem mexida no título da aba.
 */

import { useEffect } from "react";
import { lerEventoParaATela, type EventoParaATela } from "@n1/dominio/crm/eventos";
import { clienteDoNavegador } from "@/autenticacao/cliente-navegador";
import { invalidarCrmComArrays } from "./crm/cliente-crm";

/** Sem conexão, de quanto em quanto tempo as mesmas chaves são relidas. */
export const INTERVALO_SEM_TEMPO_REAL_MS = 5_000;
/** A espera entre tentativas de reconexão dobra (1 s, 2 s, 4 s…) até aqui. */
export const ESPERA_MAXIMA_DE_RECONEXAO_MS = 30_000;
/** Eventos em rajada esperam esta janela e viram uma rodada só de revalidação. */
export const JANELA_DE_AGRUPAMENTO_MS = 300;

const CAMINHO_DAS_MENSAGENS = "/mensagens";
const CAMINHO_DAS_CONVERSAS = "/conversas";
const CAMINHO_DO_RESUMO = "/tarefas-conversacionais/resumo";

/** As chaves que uma releitura completa (a cada conexão aberta e a cada 5 s sem conexão) revalida. */
export const CHAVES_DE_BASE: readonly string[] = [CAMINHO_DAS_MENSAGENS, CAMINHO_DAS_CONVERSAS, CAMINHO_DO_RESUMO];

export interface OpcoesDaConexao {
  obterToken(): Promise<string | undefined>;
  urlBase: string;
  fetchImpl?: typeof fetch;
  /** Os eventos lidos do fluxo. */
  aoEventos(eventos: readonly EventoParaATela[]): void;
  /** Releitura completa: a cada conexão aberta (cobre o que se perdeu no intervalo) e a cada 5 s sem conexão. */
  aoReler(): void;
  aoAbrir(): void;
  aoCair(): void;
  agendar?: typeof setTimeout;
}

/**
 * Pura: junta `resto` e `pedaco`, quebra em quadros (`\n\n`), lê só as linhas `data:` (comentário `: ...` e JSON
 * inválido ou de forma estranha são ignorados) e devolve o que sobrou depois do último `\n\n` como `resto`.
 */
export function lerQuadrosSse(resto: string, pedaco: string): { eventos: EventoParaATela[]; resto: string } {
  const quadros = (resto + pedaco).replace(/\r\n/g, "\n").split("\n\n");
  const sobra = quadros.pop() ?? "";
  const eventos: EventoParaATela[] = [];
  for (const quadro of quadros) {
    const dados = quadro
      .split("\n")
      .filter((linha) => linha.startsWith("data:"))
      .map((linha) => linha.slice(5).replace(/^ /, ""))
      .join("\n");
    if (dados === "") continue;
    let valor: unknown;
    try {
      valor = JSON.parse(dados);
    } catch {
      continue;
    }
    const evento = lerEventoParaATela(valor);
    if (evento) eventos.push(evento);
  }
  return { eventos, resto: sobra };
}

/** Os prefixos de chave SWR que um evento revalida (D-16-02). */
export function chavesDoEvento(evento: EventoParaATela): readonly string[] {
  const fio = `${CAMINHO_DAS_MENSAGENS}?${new URLSearchParams({ conversaId: evento.conversaId }).toString()}`;
  switch (evento.tipo) {
    case "mensagem.nova":
      return [fio, CAMINHO_DAS_CONVERSAS, CAMINHO_DO_RESUMO];
    case "mensagem.status":
      return [fio, CAMINHO_DO_RESUMO];
    case "conversa.mudou":
      return [CAMINHO_DAS_CONVERSAS, CAMINHO_DO_RESUMO];
  }
}

/** As chaves de vários eventos, unidas e sem repetir. */
export function chavesDosEventos(eventos: readonly EventoParaATela[]): readonly string[] {
  return [...new Set(eventos.flatMap((evento) => chavesDoEvento(evento)))];
}

export function criarConexaoDoTempoReal(opcoes: OpcoesDaConexao): { parar(): void } {
  const buscar = opcoes.fetchImpl ?? ((entrada, init) => fetch(entrada, init));
  const controle = new AbortController();
  let parado = false;

  async function conectar(): Promise<void> {
    const token = await opcoes.obterToken();
    if (parado || !token) return;
    const resposta = await buscar(`${opcoes.urlBase}/eventos`, {
      headers: { authorization: `Bearer ${token}` },
      signal: controle.signal,
    });
    if (parado || !resposta.ok || !resposta.body) return;
    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder();
    let resto = "";
    let abriu = false;
    for (;;) {
      const { done, value } = await leitor.read();
      if (done || parado) break;
      if (!abriu) {
        abriu = true;
        opcoes.aoAbrir();
        opcoes.aoReler();
      }
      const lido = lerQuadrosSse(resto, decodificador.decode(value, { stream: true }));
      resto = lido.resto;
      if (lido.eventos.length > 0) opcoes.aoEventos(lido.eventos);
    }
  }

  void conectar().catch(() => undefined);

  return {
    parar() {
      parado = true;
      controle.abort();
    },
  };
}

async function tokenDaSessao(): Promise<string | undefined> {
  return (await clienteDoNavegador().auth.getSession()).data.session?.access_token;
}

/**
 * Montado no `StoreProvider` ao lado do `AcompanhanteDaRevisao`: o fluxo SOMA à releitura da revisão do Espaço, não
 * a substitui. Não mostra nada na tela.
 */
export function AcompanhanteDoTempoReal(): null {
  useEffect(() => {
    const urlBase = process.env.NEXT_PUBLIC_API_URL;
    if (!urlBase) return undefined;
    const conexao = criarConexaoDoTempoReal({
      urlBase,
      obterToken: tokenDaSessao,
      aoEventos: (eventos) => {
        for (const chave of chavesDosEventos(eventos)) void invalidarCrmComArrays(chave);
      },
      aoReler: () => {
        for (const chave of CHAVES_DE_BASE) void invalidarCrmComArrays(chave);
      },
      aoAbrir: () => undefined,
      aoCair: () => undefined,
    });
    return () => conexao.parar();
  }, []);
  return null;
}
