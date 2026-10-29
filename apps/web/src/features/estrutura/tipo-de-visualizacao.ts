/**
 * RELO-05 — o TIPO de uma Visualização da Lista nos dois vocabulários: o da
 * tela (as abas) e o do domínio (`View["kind"]`). Só "linha" ↔ "linhaDoTempo"
 * muda de nome. Uma Visualização salva guarda o tipo em que foi salva, e abrir
 * uma troca a aba para ele — antes toda Visualização nascia como "lista", e a
 * padrão de um Quadro abria na Lista.
 */

import type { TipoDeVisualizacao, View } from "@n1/dominio/types";

export type TipoDeAba = "lista" | "quadro" | "calendario" | "tabela" | "linha";

export const ROTULO_DA_ABA: Record<TipoDeAba, string> = {
  lista: "Lista",
  quadro: "Quadro",
  calendario: "Calendário",
  tabela: "Tabela",
  linha: "Linha do tempo",
};

/**
 * Total: qualquer valor fora das abas (inclusive uma Visualização salva do tipo
 * Carga, removido em 10-07, que ainda não passou pela migração 010) abre na
 * aba Lista — Pitfall 4: `view-bar.tsx` nunca recebe um rótulo indefinido.
 */
export function abaDaView(kind: string | undefined): TipoDeAba {
  if (kind === "linhaDoTempo") return "linha";
  if (kind !== undefined && Object.prototype.hasOwnProperty.call(ROTULO_DA_ABA, kind)) return kind as TipoDeAba;
  return "lista";
}

export function kindDaAba(aba: TipoDeAba): View["kind"] {
  return aba === "linha" ? "linhaDoTempo" : aba;
}

/** A ordem da barra de Abas e do editor de Visualizações padrão: a mesma nos dois. */
export const ORDEM_DAS_ABAS: readonly TipoDeAba[] = ["lista", "quadro", "calendario", "tabela", "linha"];

export type LenteDaLista = "comum" | "conversacional" | "financeira";

/**
 * 2.6.2, D-07 — as abas que a página da Lista mostra: os tipos que a
 * configuração efetiva libera (`config.views.disponiveis`), na ordem da barra,
 * ainda filtrados pela lente. A financeira não tem restrição; a conversacional
 * não planeja esforço, então perde a Linha do tempo. A interseção vazia (o
 * Espaço só liberou o que a lente proíbe) mostra só a aba Lista, a única que
 * existe em qualquer Lista.
 */
export function abasDaLista(disponiveis: readonly TipoDeVisualizacao[], lente: LenteDaLista): readonly TipoDeAba[] {
  const liberadas = new Set(disponiveis.map((kind) => abaDaView(kind)));
  const mostradas = ORDEM_DAS_ABAS.filter((aba) => liberadas.has(aba) && !(lente === "conversacional" && aba === "linha"));
  return mostradas.length > 0 ? mostradas : ["lista"];
}

/**
 * 2.6.2, D-06 — a aba em que a Lista abre: a Visualização salva `isDefault`
 * dela, se o tipo está entre as abas mostradas; senão a inicial da
 * configuração efetiva, se está; senão a primeira mostrada. Uma padrão salva
 * de tipo indisponível não é apagada — só deixa de mandar na abertura.
 */
export function abaInicialDaLista(
  abas: readonly TipoDeAba[],
  padraoSalva: Pick<View, "kind"> | undefined,
  inicial: TipoDeVisualizacao,
): TipoDeAba {
  if (padraoSalva) {
    const daPadrao = abaDaView(padraoSalva.kind);
    if (abas.includes(daPadrao)) return daPadrao;
  }
  const daInicial = abaDaView(inicial);
  if (abas.includes(daInicial)) return daInicial;
  return abas[0] ?? "lista";
}
