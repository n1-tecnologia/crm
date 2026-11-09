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

type Temporizador = ReturnType<typeof setTimeout>;

/**
 * A conexão com `GET /eventos`, do abrir ao `parar()`.
 *
 * - Cai (rede, 401, 403, 503, token indefinido, o servidor que fecha aos 45 min): `aoCair`, liga a releitura de
 *   `INTERVALO_SEM_TEMPO_REAL_MS` e tenta de novo com espera de 1 s, 2 s, 4 s… até `ESPERA_MAXIMA_DE_RECONEXAO_MS`.
 *   Cada tentativa pede o token de novo: um 401 de token vencido pega o renovado.
 * - Abre (primeiro pedaço do corpo, o `: aberto` do servidor): `aoAbrir`, desliga a releitura, zera a espera e relê
 *   tudo uma vez (`aoReler`) — o servidor não reenvia o que se perdeu no intervalo (não há "ressincronizar").
 * - Eventos em rajada esperam `JANELA_DE_AGRUPAMENTO_MS` e saem em UMA chamada de `aoEventos` (T-16-30).
 * - `parar()` aborta o `fetch`, limpa os temporizadores e descarta o que esperava a janela.
 */
export function criarConexaoDoTempoReal(opcoes: OpcoesDaConexao): { parar(): void } {
  const buscar = opcoes.fetchImpl ?? ((entrada, init) => fetch(entrada, init));
  // Lazy de propósito: pega o `setTimeout` de quando agenda, não o de quando o módulo carregou.
  const agendar: (retorno: () => void, ms: number) => Temporizador = opcoes.agendar
    ? (retorno, ms) => opcoes.agendar!(retorno, ms)
    : (retorno, ms) => setTimeout(retorno, ms);
  const controle = new AbortController();
  let parado = false;
  let tentativas = 0;
  let emQueda = false;
  let reconexao: Temporizador | undefined;
  let releitura: Temporizador | undefined;
  let agrupamento: Temporizador | undefined;
  let pendentes: EventoParaATela[] = [];

  function ligarReleitura(): void {
    if (releitura !== undefined) return;
    releitura = agendar(() => {
      releitura = undefined;
      if (parado) return;
      opcoes.aoReler();
      ligarReleitura();
    }, INTERVALO_SEM_TEMPO_REAL_MS);
  }

  function desligarReleitura(): void {
    if (releitura !== undefined) clearTimeout(releitura);
    releitura = undefined;
  }

  function cair(): void {
    if (parado) return;
    // `aoCair` avisa a queda uma vez por episódio: as tentativas que falham em seguida não repetem o aviso.
    if (!emQueda) opcoes.aoCair();
    emQueda = true;
    ligarReleitura();
    const espera = Math.min(1_000 * 2 ** Math.min(tentativas, 16), ESPERA_MAXIMA_DE_RECONEXAO_MS);
    tentativas += 1;
    reconexao = agendar(() => {
      reconexao = undefined;
      void conectar();
    }, espera);
  }

  function abrir(): void {
    tentativas = 0;
    emQueda = false;
    desligarReleitura();
    opcoes.aoAbrir();
    opcoes.aoReler();
  }

  function receber(eventos: readonly EventoParaATela[]): void {
    pendentes.push(...eventos);
    if (agrupamento !== undefined) return;
    agrupamento = agendar(() => {
      agrupamento = undefined;
      if (parado) return;
      const lote = pendentes;
      pendentes = [];
      if (lote.length > 0) opcoes.aoEventos(lote);
    }, JANELA_DE_AGRUPAMENTO_MS);
  }

  async function conectar(): Promise<void> {
    if (parado) return;
    try {
      const token = await opcoes.obterToken().catch(() => undefined);
      if (parado) return;
      if (!token) {
        cair();
        return;
      }
      const resposta = await buscar(`${opcoes.urlBase}/eventos`, {
        headers: { authorization: `Bearer ${token}` },
        signal: controle.signal,
      });
      if (parado) return;
      if (!resposta.ok || !resposta.body) {
        void resposta.body?.cancel().catch(() => undefined);
        cair();
        return;
      }
      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      let resto = "";
      let abriu = false;
      for (;;) {
        const { done, value } = await leitor.read();
        if (parado) return;
        if (done) break;
        if (!abriu) {
          abriu = true;
          abrir();
        }
        const lido = lerQuadrosSse(resto, decodificador.decode(value, { stream: true }));
        resto = lido.resto;
        if (lido.eventos.length > 0) receber(lido.eventos);
      }
      cair();
    } catch {
      cair();
    }
  }

  void conectar();

  return {
    parar() {
      parado = true;
      controle.abort();
      for (const temporizador of [reconexao, releitura, agrupamento]) {
        if (temporizador !== undefined) clearTimeout(temporizador);
      }
      reconexao = releitura = agrupamento = undefined;
      pendentes = [];
    },
  };
}

async function tokenDaSessao(): Promise<string | undefined> {
  return (await clienteDoNavegador().auth.getSession()).data.session?.access_token;
}

/**
 * Montado no `StoreProvider` ao lado do `AcompanhanteDaRevisao`: o fluxo SOMA à releitura da revisão do Espaço, não
 * a substitui. Não mostra nada na tela.
 *
 * `ativo` liga a conexão. O padrão é ligado, menos sob o Vitest (`NODE_ENV === "test"`): dezenas de testes de tela
 * montam o `StoreProvider` com `NEXT_PUBLIC_API_URL` e um `fetch` falso que conta os pedidos, e um `GET /eventos` a
 * mais em cada um quebraria a contagem sem que o tempo real tivesse nada a ver com o que eles provam. Os testes
 * deste módulo passam `ativo` de propósito.
 */
export function AcompanhanteDoTempoReal({ ativo = process.env.NODE_ENV !== "test" }: { readonly ativo?: boolean }): null {
  useEffect(() => {
    const urlBase = process.env.NEXT_PUBLIC_API_URL;
    if (!ativo || !urlBase) return undefined;
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
  }, [ativo]);
  return null;
}
