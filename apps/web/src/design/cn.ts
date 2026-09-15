/**
 * Junção de classes sem dependência.
 *
 * Aceita string, condicional e objeto — o suficiente para tudo que este app faz.
 * Não faz merge de conflito do Tailwind: quando duas classes brigam, a última do
 * CSS vence, e é por isso que a ordem dos argumentos importa — variante primeiro,
 * sobrescrita do chamador por último.
 */
export type Classe =
  | string
  | number
  | false
  | null
  | undefined
  | Record<string, boolean | null | undefined>
  | Classe[];

export function cn(...entradas: Classe[]): string {
  const saida: string[] = [];

  for (const entrada of entradas) {
    if (!entrada) continue;

    if (typeof entrada === "string" || typeof entrada === "number") {
      saida.push(String(entrada));
      continue;
    }

    if (Array.isArray(entrada)) {
      const aninhado = cn(...entrada);
      if (aninhado) saida.push(aninhado);
      continue;
    }

    for (const [chave, ativo] of Object.entries(entrada)) {
      if (ativo) saida.push(chave);
    }
  }

  return saida.join(" ");
}
