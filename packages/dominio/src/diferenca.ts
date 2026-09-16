/**
 * A forma do diff que a persistência devolve — é o espelho de `gravar()`
 * (`apps/api/src/persistencia/repositorio.ts`): o servidor manda só o que
 * mudou (D-03) e o cliente aplica sobre o grafo mutado em lugar que
 * `useData` já assina por revisão.
 *
 * `aplicarDiferenca` nunca troca a referência de uma coleção — sempre muta o
 * array em lugar (`splice`/`push`) — porque algumas propriedades de
 * `DataState` são `readonly` (`models`, `tools`): a leitura de
 * `packages/dominio/CONTEXT.md` já avisa que ninguém reatribui essas
 * coleções, só o array por dentro delas.
 */

import { COLECOES, SINGULARES } from "./colecoes";
import type { DataState } from "./state";

export interface RegistroGravado {
  readonly colecao: string;
  readonly id: string;
  readonly dados: unknown;
  readonly ordem: number;
}

export interface RegistroRemovido {
  readonly colecao: string;
  readonly id: string;
}

export interface Diferenca {
  readonly gravados: readonly RegistroGravado[];
  readonly removidos: readonly RegistroRemovido[];
}

/** colecao → id → ordem. É o que `hidratar()` devolve e o cliente mantém para aplicar diffs. Objeto simples: viaja em JSON. */
export type Ordens = Record<string, Record<string, number>>;

export const DIFERENCA_VAZIA: Diferenca = { gravados: [], removidos: [] };

const COLECOES_CONHECIDAS = new Set<string>(COLECOES);
const COLECOES_SINGULARES = new Set<string>(SINGULARES);

function comId(registro: unknown): registro is { readonly id: string } {
  return registro !== null && typeof registro === "object" && typeof (registro as { id?: unknown }).id === "string";
}

/**
 * Muta `state` e `ordens` em lugar. Coleção desconhecida é ignorada (cliente
 * antigo, servidor novo) — nunca lança.
 */
export function aplicarDiferenca(state: DataState, ordens: Ordens, diferenca: Diferenca): void {
  const estado = state as unknown as Record<string, unknown>;

  for (const removido of diferenca.removidos) {
    if (COLECOES_SINGULARES.has(removido.colecao)) continue; // um Singular não se remove
    const lista = estado[removido.colecao];
    if (!Array.isArray(lista)) continue; // coleção desconhecida
    const indice = lista.findIndex((registro) => comId(registro) && registro.id === removido.id);
    if (indice !== -1) lista.splice(indice, 1);
    delete ordens[removido.colecao]?.[removido.id];
  }

  for (const gravado of diferenca.gravados) {
    if (COLECOES_SINGULARES.has(gravado.colecao)) {
      estado[gravado.colecao] = gravado.dados;
      continue;
    }
    if (!COLECOES_CONHECIDAS.has(gravado.colecao)) continue; // coleção desconhecida

    const lista = (estado[gravado.colecao] ??= []) as unknown[];
    const ordensDaColecao = (ordens[gravado.colecao] ??= {});
    const indiceAtual = lista.findIndex((registro) => comId(registro) && registro.id === gravado.id);

    if (indiceAtual !== -1) {
      if (ordensDaColecao[gravado.id] === gravado.ordem) {
        // mesma posição: substitui em lugar, sem reordenar.
        lista[indiceAtual] = gravado.dados;
        continue;
      }
      lista.splice(indiceAtual, 1);
    }

    ordensDaColecao[gravado.id] = gravado.ordem;

    // Varredura linear até o primeiro vizinho de ordem MAIOR e conhecida —
    // array pequeno, não otimizar. Um vizinho de ordem desconhecida é
    // pulado (não interrompe a busca): registros sem ordem conhecida ficam
    // ao fim, nunca "roubados" por uma inserção nova.
    const posicao = lista.findIndex((registro) => {
      if (!comId(registro)) return false;
      const ordemVizinha = ordensDaColecao[registro.id];
      return ordemVizinha !== undefined && ordemVizinha > gravado.ordem;
    });

    if (posicao === -1) lista.push(gravado.dados);
    else lista.splice(posicao, 0, gravado.dados);
  }
}
