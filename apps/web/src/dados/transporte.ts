/**
 * `Transporte` é a fronteira entre `store.ts` e o resto do mundo: como o
 * híbrido de D-05 grava o que a cópia aceitou, e como a carga inicial
 * re-hidrata quando o servidor avisa que a revisão local ficou para trás
 * (D-06). Existe como interface — não um `fetch` direto dentro de `store.ts`
 * — por dois motivos: o store fica testável sem rede real (`store.test.ts`
 * injeta um transporte falso), e as rotas públicas (`/f/<segredo>`,
 * `/p/<segredo>`) continuam funcionando em memória até que OQ-PF-01 decida
 * em nome de quem uma resposta anônima age (Deferred Ideas, `01-CONTEXT.md`)
 * — hoje `submitForm` não é uma operação registrada, então não há o que
 * mandar ao servidor por essa via.
 *
 * `transporteHttp` é a ÚNICA implementação de produção — o que fala de
 * verdade com o `apps/api` (contrato do Plan 01-04). `transporteEmMemoria`
 * serve só ao `PublicoProvider`.
 */

import type { DataState, OperationResult } from "@n1/dominio/state";
import type { Diferenca, Ordens } from "@n1/dominio";
import type { Id } from "@n1/dominio/types";
import type { ChamadaDeOperacao } from "@n1/dominio/operations";
import { serializarArgumentos } from "@n1/dominio/operations";

export interface EstadoDoServidor {
  readonly data: DataState;
  readonly revisao: number;
  readonly ordens: Ordens;
  readonly memberId: Id;
}

export type RespostaDeGravacao =
  | {
      readonly tipo: "diferenca";
      readonly resultado: OperationResult<unknown>;
      readonly diferenca: Diferenca;
      readonly revisao: number;
      readonly revisaoAnterior: number;
    }
  // Caminho do transporte em memória: não há revisão do servidor para
  // divergir dela — a cópia gravada VIRA o estado.
  | { readonly tipo: "estado"; readonly resultado: OperationResult<unknown>; readonly estado: EstadoDoServidor }
  // 409 — revisão defasada esgotou as tentativas da Unidade de Trabalho.
  | { readonly tipo: "conflito"; readonly erro: string }
  // Rede, 401/403/404/500 — falha de transporte, não recusa de domínio.
  | { readonly tipo: "falha"; readonly erro: string; readonly sessaoExpirada?: boolean };

export interface PedidoDeGravacao {
  readonly chamadas: readonly ChamadaDeOperacao[];
  readonly revisao: number;
  readonly copia: DataState;
  /** O `OperationResult` que a cópia calculou — o transporte em memória o devolve de volta, já que não há servidor para recalculá-lo. */
  readonly resultado: OperationResult<unknown>;
}

export interface Transporte {
  gravar(pedido: PedidoDeGravacao): Promise<RespostaDeGravacao>;
  hidratar(): Promise<EstadoDoServidor | { readonly tipo: "falha"; readonly erro: string }>;
  /**
   * Checklist E2 — só a revisão do Espaço no servidor (`GET /estado/revisao`),
   * para a tela saber se alguém (a ponte, o `automation/`, outra pessoa)
   * gravou. `undefined` quando não deu para saber. Opcional: as rotas
   * públicas não têm servidor.
   */
  revisaoAtual?(): Promise<number | undefined>;
}

interface CorpoDeOperacao {
  readonly ok: boolean;
  readonly value?: unknown;
  readonly error?: string;
  readonly field?: string;
  readonly diferenca: Diferenca;
  readonly revisao: number;
  readonly revisaoAnterior: number;
}

async function corpoDeErro(resposta: Response): Promise<string | undefined> {
  try {
    const corpo = (await resposta.json()) as { readonly error?: string };
    return corpo.error;
  } catch {
    return undefined;
  }
}

/**
 * Uma chamada por `POST /operacoes/:nome`. Nunca loga o token; nunca manda
 * para outra origem que não `apiUrl` — as duas coisas seguram T-1-11 (o
 * header `authorization` só existe dentro desta função, fechado sobre
 * `apiUrl` do `transporteHttp`).
 */
async function gravarUma(
  apiUrl: string,
  obterToken: () => Promise<string | undefined>,
  chamada: ChamadaDeOperacao,
  revisao: number,
): Promise<RespostaDeGravacao> {
  const token = await obterToken();
  if (!token) {
    return { tipo: "falha", erro: "Sua sessão expirou. Entre de novo.", sessaoExpirada: true };
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}/operacoes/${chamada.nome}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ args: serializarArgumentos(chamada.args), revisao }),
    });
  } catch {
    return { tipo: "falha", erro: "Sem conexão com o servidor." };
  }

  if (resposta.status === 409) {
    return { tipo: "conflito", erro: (await corpoDeErro(resposta)) ?? "Outra alteração entrou antes desta." };
  }
  if (resposta.status === 401) {
    return { tipo: "falha", erro: "Sua sessão expirou. Entre de novo.", sessaoExpirada: true };
  }
  if (!resposta.ok) {
    return { tipo: "falha", erro: (await corpoDeErro(resposta)) ?? "O servidor não respondeu." };
  }

  const corpo = (await resposta.json()) as CorpoDeOperacao;
  const resultado: OperationResult<unknown> = corpo.ok
    ? { ok: true, value: corpo.value }
    : corpo.field === undefined
      ? { ok: false, error: corpo.error ?? "O servidor recusou a operação." }
      : { ok: false, error: corpo.error ?? "O servidor recusou a operação.", field: corpo.field };

  return {
    tipo: "diferenca",
    resultado,
    diferenca: corpo.diferenca,
    revisao: corpo.revisao,
    revisaoAnterior: corpo.revisaoAnterior,
  };
}

/**
 * A implementação de produção: fala com o `apps/api` pelo contrato do
 * Plan 01-04 (`GET /estado`, `POST /operacoes/:nome`).
 */
export function transporteHttp(opcoes: { readonly apiUrl: string; readonly obterToken: () => Promise<string | undefined> }): Transporte {
  const { apiUrl, obterToken } = opcoes;

  return {
    async gravar(pedido) {
      if (pedido.chamadas.length === 0) {
        // Uma tela que muta a cópia sem passar por uma operação do registro
        // (foi o caso da troca de Papel em `configuracoes/membros/[membro]`,
        // hoje `alterarPapelDoMembro`): gravar em silêncio seria mentir para
        // a tela sobre o que persistiu.
        return { tipo: "falha", erro: "Esta ação não passa por uma operação do domínio e não foi gravada." };
      }

      // Mais de uma chamada no mesmo `run` — caso de `(shell)/page.tsx`, que
      // cria uma Sessão de Chat e manda a mensagem no mesmo clique: cada
      // chamada é uma transação própria no servidor, gravada em sequência.
      // O `resultado` que a tela usa veio da cópia local; o servidor é a
      // verdade sobre o que persistiu — paramos na primeira resposta que não
      // for `"diferenca"` e devolvemos essa (a última processada).
      let ultima: RespostaDeGravacao = { tipo: "falha", erro: "Nenhuma chamada foi gravada." };
      for (const chamada of pedido.chamadas) {
        ultima = await gravarUma(apiUrl, obterToken, chamada, pedido.revisao);
        if (ultima.tipo !== "diferenca") break;
      }
      return ultima;
    },

    async hidratar() {
      const token = await obterToken();
      if (!token) return { tipo: "falha", erro: "Sua sessão expirou. Entre de novo." };

      let resposta: Response;
      try {
        resposta = await fetch(`${apiUrl}/estado`, { headers: { authorization: `Bearer ${token}` } });
      } catch {
        return { tipo: "falha", erro: "Sem conexão com o servidor." };
      }
      if (!resposta.ok) {
        return { tipo: "falha", erro: (await corpoDeErro(resposta)) ?? "O servidor não respondeu." };
      }

      const corpo = (await resposta.json()) as { data: DataState; revisao: number; ordens: Ordens; sessao: { memberId: Id } };
      return { data: corpo.data, revisao: corpo.revisao, ordens: corpo.ordens, memberId: corpo.sessao.memberId };
    },

    async revisaoAtual() {
      const token = await obterToken();
      if (!token) return undefined;
      try {
        const resposta = await fetch(`${apiUrl}/estado/revisao`, { headers: { authorization: `Bearer ${token}` } });
        if (!resposta.ok) return undefined;
        const { revisao } = (await resposta.json()) as { revisao?: unknown };
        return typeof revisao === "number" && Number.isFinite(revisao) ? revisao : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

/**
 * As rotas públicas: sem sessão, sem servidor. `gravar` devolve a própria
 * cópia como o novo estado — não há diff de servidor para aplicar por cima
 * dela. `hidratar` nunca é chamado na prática (a carga inicial das rotas
 * públicas vem do seed do produto montado pelo `PublicoProvider`, não de
 * `rehidratar()`), mas devolve uma falha explícita em vez de lançar,
 * coerente com a interface.
 */
export function transporteEmMemoria(): Transporte {
  return {
    async gravar(pedido) {
      return {
        tipo: "estado",
        resultado: pedido.resultado,
        estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: {}, memberId: "" },
      };
    },
    async hidratar() {
      return { tipo: "falha", erro: "Sem servidor nas rotas públicas." };
    },
  };
}
