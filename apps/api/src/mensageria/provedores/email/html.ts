/**
 * Limpeza do HTML de um e-mail recebido (17-11, D-17-13, EML-03).
 *
 * O HTML de um e-mail é entrada hostil: traz script, formulário, `<base>`, `<meta refresh>` e, sobretudo, o pixel de
 * rastreio que avisa quem mandou que o atendente abriu a mensagem. O leitor (17-08) o guarda como veio; só aqui, na hora
 * de SERVIR, ele passa por `sanitize-html` (roda em Node, sem DOM) com uma lista curta do que é permitido. Nunca se
 * devolve nem se registra em log o HTML original.
 *
 * Decisões que não mudam sem rever a ameaça:
 *   - SEM `style` e SEM `<style>`: o e-mail perde parte da formatação, em troca de nenhum vetor de CSS
 *     (`url()`, `@import`, `expression`, `behavior`) e de nenhuma imagem de fundo remota.
 *   - Imagem SÓ por `data:image/(png|jpeg|gif|webp);base64,`: qualquer `<img>` com endereço remoto (inclusive o protocolo
 *     relativo `//host/p.gif`) é pixel de rastreio (T-17-42) e some, e `data:image/svg+xml` some porque SVG executa.
 *   - Esquemas de link só `http`, `https`, `mailto` e `tel`: `javascript:`, `data:` e `vbscript:` perdem o `href`.
 *   - Todo link sai com `rel="noopener noreferrer"` e `target="_blank"`.
 *
 * A segunda barreira é a moldura isolada da tela (iframe `sandbox` sem script, 17-15): esta limpeza não a dispensa, e ela
 * não dispensa esta.
 */

import sanitizeHtml from "sanitize-html";

/** Só imagem raster em `data:` (SVG executa e fica de fora). */
const IMAGEM_EMBUTIDA = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]*$/i;

const OPCOES: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "blockquote", "ul", "ol", "li", "pre", "code",
    "h1", "h2", "h3", "h4", "table", "thead", "tbody", "tr", "td", "th", "a", "img", "hr",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "width", "height"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // A imagem só aceita `data:`; o filtro abaixo confere que é raster e descarta o resto.
  allowedSchemesByTag: { img: ["data"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  nestingLimit: 20,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
  exclusiveFilter: (quadro) => quadro.tag === "img" && !IMAGEM_EMBUTIDA.test((quadro.attribs.src ?? "").trim()),
};

/** O HTML do e-mail sem script, formulário, estilo, imagem remota nem esquema perigoso. Entrada vazia devolve `""`. */
export function limparHtmlDoEmail(html: string): string {
  if (html === "") return "";
  return sanitizeHtml(html, OPCOES);
}
