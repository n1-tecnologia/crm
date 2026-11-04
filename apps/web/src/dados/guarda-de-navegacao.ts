/**
 * Fase 12, D-15 (GRV-05) — "nunca leva a uma página de id que não existe".
 *
 * Com a gravação otimista (D-13) a Lista, a Tarefa ou o Contato novo aparecem na
 * tela antes de o servidor responder, e o id que a tela inventou pode não ser o
 * que o servidor vai dar. Uma âncora para a página desse id, clicada nessa
 * janela, levaria a uma página que não existe. A árvore e a linha da Tarefa
 * desenham o "salvando" sem link (12-08); esta guarda cobre o resto: qualquer
 * âncora, em qualquer tela, sem editar tela nenhuma. Por isso é uma guarda no
 * `document`, e não uma edição de cada `<Link>`: as telas novas já nascem
 * cobertas.
 *
 * Como funciona: ouvintes de `click` e `auxclick` (o clique do meio) na fase de
 * CAPTURA do `document`. O `<Link>` do Next navega dentro do próprio `onClick`, e
 * o React escuta no contêiner raiz, que fica abaixo do `document`: parar a
 * propagação aqui impede o `onClick` do `<Link>` de rodar. Com um id pendente no
 * endereço da âncora, o clique é cancelado e a âncora ganha `aria-busy="true"`;
 * quando o id deixa de estar pendente, o `aria-busy` sai.
 *
 * "Pendente" é DERIVADO (o id que está em `data` e ainda não em `confirmado`),
 * sem estado novo guardado: a cada clique a guarda pergunta à fonte. O módulo não
 * importa `store.ts` (recebe uma `FonteDosPendentes`), sem ciclo de import.
 *
 * Só age com id pendente, por igualdade inteira de segmento ou de valor de
 * parâmetro, e nunca em endereço de outra origem: fora da janela entre o clique e
 * a confirmação a navegação é a de sempre.
 */

import type { Id } from "@n1/dominio/types";

/** O que a guarda precisa saber do store: quais ids ainda não foram confirmados e como ser avisada de uma mudança. */
export interface FonteDosPendentes {
  readonly idsPendentes: () => ReadonlySet<Id>;
  readonly assinar: (ouvinte: () => void) => () => void;
}

function decodificar(pedaco: string): string {
  try {
    return decodeURIComponent(pedaco);
  } catch {
    return pedaco;
  }
}

/**
 * O id pendente que o endereço carrega, ou `undefined`. Compara cada segmento do
 * caminho e cada valor de parâmetro com o conjunto, por igualdade inteira (`lst_1`
 * não casa com `lst_10`). O endereço é resolvido contra `base` (a origem da
 * página); endereço de outra origem ou que não é `http(s)` nunca é tocado.
 */
export function idNaoConfirmadoNoEndereco(href: string, ids: ReadonlySet<Id>, base: string = globalThis.location?.href ?? "http://localhost/"): Id | undefined {
  if (ids.size === 0) return undefined;
  let destino: URL;
  let pagina: URL;
  try {
    pagina = new URL(base);
    destino = new URL(href, pagina);
  } catch {
    return undefined;
  }
  if (destino.origin !== pagina.origin) return undefined;
  for (const segmento of destino.pathname.split("/")) {
    const candidato = decodificar(segmento);
    if (candidato && ids.has(candidato)) return candidato;
  }
  for (const valor of destino.searchParams.values()) {
    if (valor && ids.has(valor)) return valor;
  }
  return undefined;
}

/**
 * Instala a guarda no `documento` e devolve a função que a remove (ouvintes,
 * assinatura e os `aria-busy` que ela pôs).
 */
export function instalarGuardaDeNavegacao(fonte: FonteDosPendentes, documento: Document): () => void {
  /** As âncoras que a guarda marcou e que esperam o id ser confirmado. */
  const marcadas = new Set<Element>();
  let desassinar: (() => void) | undefined;

  const soltar = (ancora: Element) => {
    ancora.removeAttribute("aria-busy");
    marcadas.delete(ancora);
  };

  const reavaliar = () => {
    const ids = fonte.idsPendentes();
    for (const ancora of [...marcadas]) {
      const ainda = ancora.isConnected && idNaoConfirmadoNoEndereco(ancora.getAttribute("href") ?? "", ids, documento.baseURI) !== undefined;
      if (!ainda) soltar(ancora);
    }
    if (marcadas.size === 0 && desassinar) {
      desassinar();
      desassinar = undefined;
    }
  };

  const marcar = (ancora: Element) => {
    ancora.setAttribute("aria-busy", "true");
    marcadas.add(ancora);
    desassinar ??= fonte.assinar(reavaliar);
  };

  const aoClicar = (evento: Event) => {
    const alvo = evento.target as Element | null;
    if (!alvo || typeof alvo.closest !== "function") return;
    const ancora = alvo.closest("a[href]");
    if (!ancora) return;
    const ids = fonte.idsPendentes();
    if (ids.size === 0) return;
    if (idNaoConfirmadoNoEndereco(ancora.getAttribute("href") ?? "", ids, documento.baseURI) === undefined) return;
    evento.preventDefault();
    evento.stopPropagation();
    marcar(ancora);
  };

  documento.addEventListener("click", aoClicar, true);
  documento.addEventListener("auxclick", aoClicar, true);
  return () => {
    documento.removeEventListener("click", aoClicar, true);
    documento.removeEventListener("auxclick", aoClicar, true);
    for (const ancora of [...marcadas]) soltar(ancora);
    desassinar?.();
    desassinar = undefined;
  };
}
