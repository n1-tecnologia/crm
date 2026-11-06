"use client";

/**
 * Os nomes do CRM novo em lote (15-10, 3.4.9 e 3.4.10, UCR-08), lidos só por HTTP:
 * `POST /crm/nomes` de `apps/api` (`rotas/crm/nomes.ts`) atrás de `chamarCrm`. A IA
 * (alvo, âncora, escopo), Contas a receber (cliente) e outras telas só têm o id de um
 * Contato, Empresa, Negócio, Conversa, Funil ou Canal e precisam do nome sem carregar
 * a lista inteira; o store deixou de ter o CRM, e pedir um por um custaria uma ida por
 * linha.
 *
 * `useNomesDoCrm(alvos)` junta todos os alvos de uma tela numa chamada (em lotes de
 * `NOMES_MAXIMO` quando passam disso). A chave de SWR é um array: o caminho e, depois
 * dele, uma assinatura `tipo:id` por alvo, sem repetir e em ordem. A ordem e a repetição
 * dos alvos que a tela passa não mudam a chave, então dois componentes que pedem os
 * mesmos alvos compartilham a chamada e o cache. Lista vazia não vai à api.
 *
 * `nome: null` quer dizer "sem nome para mostrar": o id não é do Espaço, não existe, ou
 * o Papel não lê o tipo — a api não distingue. Quem mostra decide o texto de reserva.
 * Enquanto a primeira resposta não chega (ou se a api recusa), o alvo não tem entrada
 * e `nomeDe` devolve `undefined`: "ainda não sei", diferente de `null`.
 */

import { useMemo } from "react";
import useSWR from "swr";
import { NOMES_MAXIMO, type AlvoDoCrm, type NomeDoAlvo } from "@n1/dominio/crm/nomes";
import { chamarCrm, ErroDeApi } from "./cliente-crm";

const CAMINHO_DOS_NOMES = "/crm/nomes";

/** A resposta de `POST /crm/nomes`: um item por alvo pedido, na ordem pedida. */
interface RespostaDeNomes {
  readonly ok: true;
  readonly itens: readonly NomeDoAlvo[];
  readonly total: number;
}

export interface ResultadoDeNomes {
  /** Os nomes que a api respondeu, por `tipo:id`. Use `nomeDe` em vez de ler o mapa. */
  readonly porAlvo: ReadonlyMap<string, string | null>;
  /** Primeira busca ainda sem resposta. Com nomes anteriores na tela, uma busca nova não conta. */
  readonly carregando: boolean;
  readonly erro?: ErroDeApi;
}

/** `tipo:id`. O tipo nunca tem `:`, então a primeira ocorrência separa as duas partes sem ambiguidade. */
function assinaturaDe(alvo: AlvoDoCrm): string {
  return `${alvo.tipo}:${alvo.id}`;
}

/** Sem repetir, em ordem: o que torna a chave igual para a mesma lista pedida em outra ordem. */
function alvosUnicosEmOrdem(alvos: readonly AlvoDoCrm[]): AlvoDoCrm[] {
  const vistos = new Map<string, AlvoDoCrm>();
  for (const alvo of alvos) vistos.set(assinaturaDe(alvo), { tipo: alvo.tipo, id: alvo.id });
  return [...vistos.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, alvo]) => alvo);
}

/**
 * A chave de SWR dos alvos: o caminho e uma assinatura por alvo, sem repetir e em ordem.
 * `null` para lista vazia: o SWR não busca.
 */
export function chaveDeNomes(alvos: readonly AlvoDoCrm[]): readonly [string, ...string[]] | null {
  const unicos = alvosUnicosEmOrdem(alvos);
  return unicos.length === 0 ? null : [CAMINHO_DOS_NOMES, ...unicos.map(assinaturaDe)];
}

/** Recusa 4xx não melhora ao repetir: só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** Parte os alvos em lotes de `NOMES_MAXIMO` e junta os itens na ordem pedida. */
async function buscarEmLotes(alvos: readonly AlvoDoCrm[]): Promise<readonly NomeDoAlvo[]> {
  const lotes: AlvoDoCrm[][] = [];
  for (let i = 0; i < alvos.length; i += NOMES_MAXIMO) lotes.push(alvos.slice(i, i + NOMES_MAXIMO));
  const respostas = await Promise.all(
    lotes.map((lote) => chamarCrm<RespostaDeNomes>(CAMINHO_DOS_NOMES, { method: "POST", corpo: { alvos: lote } })),
  );
  return respostas.flatMap((resposta) => resposta.itens);
}

/** Os nomes de muitos alvos numa chamada só. A recusa da api fica em `erro` e deixa o mapa vazio. */
export function useNomesDoCrm(alvos: readonly AlvoDoCrm[]): ResultadoDeNomes {
  const unicos = alvosUnicosEmOrdem(alvos);
  const chave = chaveDeNomes(unicos);

  const busca = useSWR<readonly NomeDoAlvo[], Error>(chave, () => buscarEmLotes(unicos), {
    // Alvo novo muda a chave; os nomes antigos ficam na tela até a resposta chegar.
    keepPreviousData: true,
    shouldRetryOnError: valeRepetir,
  });

  const erro = busca.error instanceof ErroDeApi ? busca.error : undefined;
  const dados = erro ? undefined : busca.data;
  const porAlvo = useMemo(() => {
    const mapa = new Map<string, string | null>();
    for (const item of dados ?? []) mapa.set(assinaturaDe(item), item.nome);
    return mapa;
  }, [dados]);

  return { porAlvo, carregando: chave !== null && busca.isLoading, ...(erro ? { erro } : {}) };
}

/**
 * O nome do alvo: o texto, `null` quando a api respondeu sem nome (id fora do Espaço,
 * desconhecido ou tipo que o Papel não lê), `undefined` enquanto a resposta não chegou.
 */
export function nomeDe(resultado: ResultadoDeNomes, tipo: AlvoDoCrm["tipo"], id: string): string | null | undefined {
  return resultado.porAlvo.get(assinaturaDe({ tipo, id }));
}
