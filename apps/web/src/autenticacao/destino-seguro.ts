/**
 * 12.3.8 — para onde o login pode mandar a pessoa depois de entrar.
 *
 * `para` vem da URL (`/entrar?para=…`), então qualquer um monta um link com o
 * valor que quiser. Aceitar só "começa com `/` e não com `//`" deixava passar
 * `/\evil.com`: o navegador lê a barra invertida como barra, e `/\evil.com`
 * vira `//evil.com`, outro site. A regra agora: só um caminho que começa com
 * UMA `/`, sem `//` nem `\` em lugar nenhum, e que, resolvido contra a origem
 * do próprio app, continua na mesma origem. Qualquer outra coisa vira `/`.
 */

/** Uma origem qualquer serve: só a comparação "mesma origem" importa. */
const ORIGEM_DE_REFERENCIA = "https://app.invalid";

export function destinoSeguro(para: string | null | undefined): string {
  if (!para || !para.startsWith("/")) return "/";
  if (para.includes("//") || para.includes("\\")) return "/";
  // Caracteres de controle (tab, quebra de linha) são descartados pelo parser de URL e podem montar `//`.
  if (/[\u0000-\u001f\u007f]/.test(para)) return "/";
  let url: URL;
  try {
    url = new URL(para, ORIGEM_DE_REFERENCIA);
  } catch {
    return "/";
  }
  if (url.origin !== ORIGEM_DE_REFERENCIA) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
