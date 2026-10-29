/**
 * RELO-05 — o TIPO de uma Visualização da Lista nos dois vocabulários: o da
 * tela (as abas) e o do domínio (`View["kind"]`). Só "linha" ↔ "linhaDoTempo"
 * muda de nome. Uma Visualização salva guarda o tipo em que foi salva, e abrir
 * uma troca a aba para ele — antes toda Visualização nascia como "lista", e a
 * padrão de um Quadro abria na Lista.
 */

import type { View } from "@n1/dominio/types";

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
