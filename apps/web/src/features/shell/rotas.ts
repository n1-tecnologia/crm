import type { Forma } from "@/design/esqueletos";

/**
 * O que a rota diz ANTES de a tela existir.
 *
 * Duas leituras do pathname, as duas puras (rodam no servidor e no teste):
 *   · a FAMÍLIA da tela — a forma do esqueleto que aparece enquanto o armazém
 *     não hidratou. Só `usePathname` alimenta isto, nunca o store nem os
 *     parâmetros de busca: o HTML do servidor divergiria.
 *   · a CHAVE DE CHEGADA — quando a troca de rota é uma chegada nova (a tela
 *     entra em cascata) e quando é a mesma tela mudando de miolo (a Caixa de
 *     Entrada trocando de Conversa não refaz a onda das 23 conversas).
 */

/** A forma do esqueleto por prefixo de rota. `tabela` é o padrão: Contatos, Empresas, Tarefas, índices. */
export function formaDe(pathname: string): Forma {
  if (pathname === "/") return "inicio";
  if (pathname.startsWith("/crm/caixa-de-entrada") && !pathname.startsWith("/crm/caixa-de-entrada/configuracoes")) return "caixa";
  if (pathname.startsWith("/estrutura/listas/")) return "lista";
  if (pathname === "/crm/negocios") return "quadro";
  if (/^\/paineis\/[^/]+/.test(pathname)) return "painel";
  if (/^\/crm\/(?:contatos|empresas|negocios)\/[^/]+/.test(pathname)) return "registro";
  if (/^\/estrutura\/tarefas\/[^/]+/.test(pathname)) return "registro";
  if (pathname === "/minha-conta") return "registro";
  if (pathname.startsWith("/f/") || pathname.startsWith("/p/")) return "formulario";
  return "tabela";
}

/** Rotas mestre-detalhe com coluna persistente: o detalhe não é uma chegada nova. */
const CAIXA_DE_ENTRADA = /^\/crm\/caixa-de-entrada\/(?!configuracoes(?:\/|$))[^/]+/;

/** A chave do invólucro de chegada: o pathname, salvo onde o detalhe mora dentro da mesma tela. */
export function chaveDeChegada(pathname: string): string {
  return CAIXA_DE_ENTRADA.test(pathname) ? "/crm/caixa-de-entrada" : pathname;
}
