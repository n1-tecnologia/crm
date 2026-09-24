/**
 * A BOCA DE PONTOS do robô do Início — a grade e a regra, puras (testadas ao
 * lado). Quem desenha é `CenaSpline` (prop `boca`): um SVG de círculos
 * projetado sobre o rosto, no padrão dos pontos dos olhos.
 */

/** A grade da boca, na caixa 0–100 do SVG: 11 colunas × 5 linhas de pontos. */
export const BOCA = {
  colunas: 5,
  linhas: 2,
  passo: 7,
  raio: 1.7,
  /**
   * A boca mexe BEM DE LEVE (2026-09-23: "conforme ele fizer o som ela deve
   * mexer levemente"; e, com três linhas inteiras piscando a cada sílaba, "a
   * boca do robô ainda mexe"): a linha de pontos (meia largura 4 = 9 pontos)
   * FICA sempre; na fala só o CENTRO das linhas de cima e de baixo acende — 1,
   * 3 ou 5 pontos, uma pequena abertura no meio. As linhas de fora (±2) não
   * acendem nunca.
   */
  meiaLinha: 4,
  /** Abaixo desta abertura (0–1) nada acende além da linha. */
  aberturaMinima: 0.25,
  /** A meia largura máxima do centro aceso acima e abaixo da linha (2 = 5 pontos). */
  meiaAberturaMaxima: 2,
} as const;

export const PONTOS_DA_BOCA: readonly { readonly coluna: number; readonly linha: number }[] = Array.from(
  { length: (2 * BOCA.colunas + 1) * (2 * BOCA.linhas + 1) },
  (_, i) => ({
    coluna: (i % (2 * BOCA.colunas + 1)) - BOCA.colunas,
    linha: Math.floor(i / (2 * BOCA.colunas + 1)) - BOCA.linhas,
  }),
);

/**
 * Acende os pontos da boca para a abertura `a` (0–1): a linha do meio sempre;
 * acima e abaixo dela, só o centro — de nada (abaixo de `aberturaMinima`) a 5
 * pontos (em `a` = 1).
 */
export function pontoDaBocaAceso(coluna: number, linha: number, a: number): boolean {
  if (linha === 0) return Math.abs(coluna) <= BOCA.meiaLinha;
  if (Math.abs(linha) !== 1) return false;
  const k = Math.min(1, Math.max(0, a));
  if (k < BOCA.aberturaMinima) return false;
  const meia = Math.round(((k - BOCA.aberturaMinima) / (1 - BOCA.aberturaMinima)) * BOCA.meiaAberturaMaxima);
  return Math.abs(coluna) <= meia;
}
