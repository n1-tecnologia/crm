/**
 * RELO-05 — o TIPO de uma Visualização da Lista nos dois vocabulários: o da
 * tela (as abas) e o do domínio (`View["kind"]`). Só "linha" ↔ "linhaDoTempo"
 * muda de nome. Uma Visualização salva guarda o tipo em que foi salva, e abrir
 * uma troca a aba para ele — antes toda Visualização nascia como "lista", e a
 * padrão de um Quadro abria na Lista.
 */

import type { View } from "@n1/dominio/types";

export type TipoDeAba = "lista" | "quadro" | "calendario" | "tabela" | "linha" | "carga";

export const ROTULO_DA_ABA: Record<TipoDeAba, string> = {
  lista: "Lista",
  quadro: "Quadro",
  calendario: "Calendário",
  tabela: "Tabela",
  linha: "Linha do tempo",
  carga: "Carga",
};

export function abaDaView(kind: View["kind"] | undefined): TipoDeAba {
  if (kind === "linhaDoTempo") return "linha";
  return kind ?? "lista";
}

export function kindDaAba(aba: TipoDeAba): View["kind"] {
  return aba === "linha" ? "linhaDoTempo" : aba;
}
