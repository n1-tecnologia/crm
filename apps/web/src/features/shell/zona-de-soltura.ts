/**
 * Onde, dentro de uma linha da árvore, o ponteiro está soltando (D-08, D-09,
 * D-10; UI-SPEC S1, A1, A2, A10).
 *
 * É uma função pura de números e de fatos, e de propósito: o jsdom zera
 * `getBoundingClientRect`, então o teste entrega `y`, `topo` e `altura` à mão, e
 * quem lê o DOM (o gesto, em `arrastar-na-arvore.ts`) só repassa o que viu. Nada
 * aqui conhece React, o estado nem o domínio: a recusa de mover é do domínio
 * (`recusaDeMover`) e sai no Toast; esta função só diz de que lado da linha a
 * pessoa está soltando.
 */

import type { Id } from "@n1/dominio/types";

/** `antes`/`depois` reordenam entre irmãos; `dentro` move para dentro; `null` não é alvo. */
export type Zona = "antes" | "dentro" | "depois" | null;

type TipoDeNo = "space" | "folder" | "list";

interface Arrastado {
  readonly tipo: TipoDeNo;
  readonly id: Id;
  readonly paiTipo?: "space" | "folder";
  readonly paiId?: Id;
}

interface Alvo {
  readonly tipo: TipoDeNo;
  readonly id: Id;
  readonly paiTipo?: "space" | "folder";
  readonly paiId?: Id;
  /** A linha está expandida. */
  readonly aberto: boolean;
  /** Há filhos desenhados logo abaixo dela. */
  readonly temFilhosVisiveis: boolean;
  /** O alvo mora dentro do que está sendo arrastado (não se solta algo dentro de si). */
  readonly descendenteDoArrastado: boolean;
}

/** O quarto de cima e o quarto de baixo de uma Pasta ou Subpasta: o meio é «dentro». */
const QUARTO = 0.25;

const mesmoPai = (a: Arrastado, b: Alvo): boolean => a.paiTipo === b.paiTipo && a.paiId === b.paiId;

/** Metade de cima reordena para antes, metade de baixo para depois. */
const metade = (fracao: number): Exclude<Zona, "dentro" | null> => (fracao < 0.5 ? "antes" : "depois");

/**
 * @param y      posição vertical do ponteiro (`clientY`)
 * @param topo   topo da linha (`getBoundingClientRect().top`)
 * @param altura altura da linha; zero (jsdom) lê como o meio
 */
export function zonaDaSoltura(y: number, topo: number, altura: number, arrastado: Arrastado, alvo: Alvo): Zona {
  // Ele mesmo e o que mora nele nunca são alvo.
  if (alvo.id === arrastado.id || alvo.descendenteDoArrastado) return null;

  const fracao = altura > 0 ? Math.min(1, Math.max(0, (y - topo) / altura)) : 0.5;

  // D-09: o Espaço só reordena entre Espaços; nunca «dentro», nunca sobre Pasta ou Lista.
  if (arrastado.tipo === "space") return alvo.tipo === "space" ? metade(fracao) : null;

  // O pai atual não é alvo e não dá aviso (A10): é um gesto ambíguo, não um erro.
  if (alvo.tipo !== "list" && alvo.id === arrastado.paiId && alvo.tipo === arrastado.paiTipo) return null;

  // Espaço: recebe Lista e Pasta «dentro» na linha inteira (não é irmão de nenhuma delas).
  if (alvo.tipo === "space") return "dentro";

  if (alvo.tipo === "list") {
    // Lista só é alvo de Lista do mesmo pai (reordenar). Pasta e Lista de outro pai, não.
    return arrastado.tipo === "list" && mesmoPai(arrastado, alvo) ? metade(fracao) : null;
  }

  // Alvo é Pasta ou Subpasta.
  if (arrastado.tipo === "list") return "dentro";

  // Pasta sobre Pasta: irmã reordena nas pontas, move no meio; de outro pai (A2) é sempre «dentro».
  if (!mesmoPai(arrastado, alvo)) return "dentro";
  // Em contêiner aberto com filhos, inserir «depois» cairia visualmente dentro dele: o quarto de baixo vale «dentro».
  if (fracao > 1 - QUARTO) return alvo.aberto && alvo.temFilhosVisiveis ? "dentro" : "depois";
  if (fracao < QUARTO) return "antes";
  return "dentro";
}
