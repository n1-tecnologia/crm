/**
 * Fase 9, 1.1.3 e Pattern 2 — o link público de uma Tarefa (`/p/<segredo>`) e
 * o de um Formulário (`/f/<segredo>`). O servidor troca o segredo por `""`
 * para quem não administra a Lista (09-02): a chave fica, o valor some. A tela
 * nunca monta `/p/` nem `/f/` sem segredo; mostra a frase abaixo no lugar.
 */

export const SEM_LINK_PARA_QUEM_NAO_ADMINISTRA = "Só quem administra a Lista vê o link.";

/** Verdadeiro só para um segredo de verdade: string não vazia. */
export function linkVisivel(segredo: string | undefined): segredo is string {
  void segredo;
  return true;
}
