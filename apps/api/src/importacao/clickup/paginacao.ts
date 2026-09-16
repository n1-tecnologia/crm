/**
 * A API do ClickUp pagina de duas formas incompatíveis, e um exportador que
 * confunde as duas duplica ou perde dado (RESEARCH.md "Anti-Patterns
 * › Paginar Comentários com page"):
 *
 * - Tarefas e Membros: `page` incrementa a partir de 0; a resposta traz um
 *   campo booleano que sinaliza `true` quando não há mais nada (o nome exato
 *   do campo é lido por `extrair`, no chamador — ver nota abaixo).
 * - Comentários: não existe `page` — o parâmetro é silenciosamente ignorado.
 *   A resposta traz até 25 comentários (mais novo primeiro); a próxima
 *   página pede `start`/`start_id` do ÚLTIMO item da página atual.
 *
 * A parada usa exatamente o que a API expõe (o booleano de última página;
 * página vazia) — não uma heurística de contagem ("Don't Hand-Roll ›
 * Detecção de última página"). `TETO_DE_PAGINAS` existe porque uma API que
 * nunca sinaliza o fim (ou um bug de paginação) não pode virar um loop sem
 * fim (T-0-02).
 */

import type { RespostaClickUp } from "./cliente";

export interface PaginaPorNumero {
  readonly page: number;
  readonly corpoCru: string;
  readonly itens: readonly unknown[];
  readonly ultima: boolean;
}

export interface CursorDeComentarios {
  readonly start: string;
  readonly start_id: string;
}

export interface PaginaPorCursor {
  readonly indice: number;
  readonly corpoCru: string;
  readonly itens: readonly unknown[];
  /** O cursor para a PRÓXIMA chamada; ausente quando esta já foi a última página. */
  readonly cursor?: CursorDeComentarios;
}

export const TETO_DE_PAGINAS = 1000;
export const COMENTARIOS_POR_PAGINA = 25;

/** `page` + booleano de última página — Tarefas, Campos, Membros. `extrair` lê os nomes de campo reais (ex.: `tasks` + o booleano da resposta); o generator é agnóstico a esses nomes. */
export async function* paginarPorPagina(
  buscar: (page: number) => Promise<RespostaClickUp>,
  extrair: (json: unknown) => { readonly itens: readonly unknown[]; readonly ultima: boolean },
): AsyncGenerator<PaginaPorNumero> {
  for (let page = 0; page < TETO_DE_PAGINAS; page += 1) {
    const resposta = await buscar(page);
    const { itens, ultima } = extrair(resposta.json);
    const ehUltima = ultima || itens.length === 0;
    yield { page, corpoCru: resposta.corpoCru, itens, ultima: ehUltima };
    if (ehUltima) return;
  }
  throw new Error(`paginação passou de TETO_DE_PAGINAS (${TETO_DE_PAGINAS}) páginas em paginarPorPagina`);
}

/**
 * `start`/`start_id` — Comentários. `extrair` devolve os itens brutos da
 * página (com `id`/`date`); o generator deduplica por `id` (a API é
 * inclusiva: pode repetir o item-cursor na página seguinte — D-03 preserva o
 * `corpoCru` intacto, só `itens` é deduplicado).
 *
 * Parada: uma página PARCIAL (comprimento bruto < `COMENTARIOS_POR_PAGINA`,
 * inclusive vazia) é a última — a API nunca devolve mais que
 * `COMENTARIOS_POR_PAGINA` por página (RESEARCH.md Pattern 2: "página
 * parcial = última página"). Uma página CHEIA (exatamente
 * `COMENTARIOS_POR_PAGINA`) nunca é assumida como última só pelo tamanho —
 * só o comprimento BRUTO decide, nunca a contagem pós-dedupe (Anti-Pattern:
 * não confundir "sem itens novos" com "sem mais páginas").
 *
 * O cursor da próxima chamada é o ÚLTIMO item BRUTO da página (o mais
 * antigo, já que a API devolve mais novo primeiro) — nunca o último item
 * pós-dedupe, que poderia ter sido removido.
 */
export async function* paginarPorCursor(
  buscar: (cursor?: CursorDeComentarios) => Promise<RespostaClickUp>,
  extrair: (json: unknown) => readonly { readonly id: string; readonly date: string }[],
): AsyncGenerator<PaginaPorCursor> {
  let cursor: CursorDeComentarios | undefined;
  const vistos = new Set<string>();

  for (let indice = 0; indice < TETO_DE_PAGINAS; indice += 1) {
    const resposta = await buscar(cursor);
    const brutos = extrair(resposta.json);

    const itens = brutos.filter((item) => {
      if (vistos.has(item.id)) return false;
      vistos.add(item.id);
      return true;
    });

    if (brutos.length < COMENTARIOS_POR_PAGINA) {
      yield { indice, corpoCru: resposta.corpoCru, itens, cursor: undefined };
      return;
    }

    // Não converter `date` (string epoch ms) — passa adiante como veio (Pitfall 6).
    const ultimoBruto = brutos[brutos.length - 1]!;
    const proximoCursor: CursorDeComentarios = { start: ultimoBruto.date, start_id: ultimoBruto.id };
    cursor = proximoCursor;

    yield { indice, corpoCru: resposta.corpoCru, itens, cursor: proximoCursor };
  }
  throw new Error(`paginação passou de TETO_DE_PAGINAS (${TETO_DE_PAGINAS}) páginas em paginarPorCursor`);
}
