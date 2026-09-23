import "server-only";

/**
 * O fetch server-side das oito leituras do Financeiro, com quatro desfechos
 * — nunca um `catch` que cai serenamente para `[]` (D4-15/D4-21: o painel de
 * hoje, quando o Supabase recusa, mostra lista vazia, e isso já custou
 * confiança). Mesma forma de `apps/web/src/dados/estado-inicial.ts`, com um
 * quarto campo no desfecho `ok`: `lidoEm`, o instante em que o fetch rodou —
 * é o que "Atualizado há…" (`BotaoAtualizar`) renderiza sem precisar de
 * estado de cliente.
 *
 * Deliberadamente NÃO envolvida em `cache()` do React: `cache()` memoiza por
 * requisição, o que `estado-inicial.ts` precisa porque é chamado duas vezes
 * na mesma árvore (o layout da casca e, de novo, algo abaixo dele). Aqui cada
 * tela do Financeiro chama a leitura UMA vez; memoizar esconderia o efeito
 * do botão Atualizar (`router.refresh()` reexecuta o Server Component, mas
 * uma leitura memoizada na mesma requisição devolveria o valor já lido).
 */

import { clienteDoServidor } from "@/autenticacao/cliente-servidor";

export type Leitura<T> =
  | { readonly tipo: "ok"; readonly dados: T; readonly lidoEm: string }
  | { readonly tipo: "semSessao" } // 401 — o token do cookie não serviu ao apps/api
  | { readonly tipo: "semAcesso"; readonly motivo: string } // 403 — a frase vem da API
  | { readonly tipo: "indisponivel"; readonly erro: string }; // rede/timeout/5xx

async function corpoDeErro(resposta: Response): Promise<string | undefined> {
  try {
    const corpo = (await resposta.json()) as { readonly error?: string };
    return corpo.error;
  } catch {
    return undefined;
  }
}

/** Descarta entradas `undefined`/`""` — um filtro vazio nunca vira `?campo=`. */
function montarQuery(query: Record<string, string | undefined> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(query)) {
    if (valor === undefined || valor === "") continue;
    params.set(chave, valor);
  }
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

/**
 * `caminho` é o sufixo depois da origem do `apps/api` (ex.: `/financeiro/dashboard`).
 * `query` vira querystring via `URLSearchParams`, o que já cuida de
 * codificação (acentos, espaços) sem a tela precisar pensar nisso.
 */
export async function lerDoFinanceiro<T>(
  caminho: string,
  query?: Record<string, string | undefined>,
): Promise<Leitura<T>> {
  const supabase = await clienteDoServidor();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { tipo: "semSessao" };

  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL não definida");

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}${caminho}${montarQuery(query)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (erro) {
    return { tipo: "indisponivel", erro: erro instanceof Error ? erro.message : "Sem conexão com o servidor." };
  }

  if (resposta.status === 401) return { tipo: "semSessao" };
  if (resposta.status === 403) {
    return { tipo: "semAcesso", motivo: (await corpoDeErro(resposta)) ?? "Sem acesso." };
  }
  if (!resposta.ok) {
    return { tipo: "indisponivel", erro: (await corpoDeErro(resposta)) ?? `O servidor respondeu ${resposta.status}.` };
  }

  const dados = (await resposta.json()) as T;
  return { tipo: "ok", dados, lidoEm: new Date().toISOString() };
}
