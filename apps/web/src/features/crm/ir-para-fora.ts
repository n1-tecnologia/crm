/**
 * Sessão 8: leva o navegador para fora do app (o login do Instagram). Fica num
 * módulo próprio porque `window.location` não se substitui no jsdom: o teste da
 * ficha troca esta função e confere a URL.
 */
export function irParaForaDoApp(url: string): void {
  window.location.assign(url);
}
