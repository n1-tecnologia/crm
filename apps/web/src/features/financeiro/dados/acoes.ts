"use server";

/**
 * As Server Actions do Financeiro (D4-07). Nesta fase, a única escrita
 * simples é a alíquota de Produto (Task 3 deste plano) e os dois gatilhos de
 * lote de Notas fiscais (D4-12, Task 2); o CRUD/import do Plano de contas
 * fica pronto aqui para 04-13 usar sem duplicar o transporte.
 *
 * Nenhuma função lança: uma exceção não tratada numa Server Action vira uma
 * tela de erro inteira no lugar de um `Toast` — todas devolvem
 * `{ ok: true } | { ok: false; erro: string }`.
 */

import { revalidatePath } from "next/cache";
import { clienteDoServidor } from "@/autenticacao/cliente-servidor";

export type ResultadoDaAcao = { readonly ok: true } | { readonly ok: false; readonly erro: string };

async function corpoDeErro(resposta: Response): Promise<string | undefined> {
  try {
    const corpo = (await resposta.json()) as { readonly error?: string };
    return corpo.error;
  } catch {
    return undefined;
  }
}

/**
 * O helper interno que toda ação usa: pega o `access_token` da sessão do
 * jeito que `dados/leitura.ts` já faz, `POST` com `authorization: Bearer` e
 * `cache: "no-store"`, e traduz o desfecho em `ResultadoDaAcao` — nunca
 * lança. O `apps/api` (04-10) já devolve o corpo de erro saneado; este
 * helper só decide a mensagem quando a resposta nem chega a ter corpo útil
 * (401/403/rede).
 */
async function escreverNoFinanceiro(caminho: string, corpo: unknown): Promise<ResultadoDaAcao> {
  const supabase = await clienteDoServidor();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, erro: "Sua sessão expirou." };

  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { ok: false, erro: "NEXT_PUBLIC_API_URL não definida." };

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}${caminho}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
      cache: "no-store",
    });
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Sem conexão com o servidor." };
  }

  if (resposta.status === 401) return { ok: false, erro: "Sua sessão expirou." };
  if (resposta.status === 403) return { ok: false, erro: "Sem acesso ao Financeiro." };
  if (!resposta.ok) {
    return { ok: false, erro: (await corpoDeErro(resposta)) ?? `O servidor respondeu ${resposta.status}.` };
  }

  return { ok: true };
}

/**
 * Grava as duas alíquotas de um Produto (D4-07, Task 3 deste plano). Só o
 * campo alterado precisa ir no corpo — o `apps/api` (04-10) aceita os dois
 * como opcionais.
 */
export async function salvarAliquotas(
  id: string,
  corpo: { readonly porcentagemProduto?: string; readonly porcentagemServico?: string },
): Promise<ResultadoDaAcao> {
  const resultado = await escreverNoFinanceiro(`/financeiro/produtos/${id}/aliquotas`, corpo);
  if (resultado.ok) revalidatePath("/financeiro/produtos");
  return resultado;
}

/**
 * Dispara um dos dois gatilhos de lote (D4-12): `tria-invoice-mark-7days`
 * ("Marcar 7 dias") ou `tria-invoice-emit` ("Emitir notas pendentes"). O
 * `apps/api` responde 202 — a corrida roda em segundo plano no
 * `automation/`. NÃO revalida: a tela mostra o `Toast` neutro e é a pessoa,
 * pelo "Atualizar agora", quem decide quando reler (D4-12) — revalidar aqui
 * mostraria a tabela de antes da corrida terminar, como se já fosse o
 * resultado.
 */
export async function executarWorkflow(key: string): Promise<ResultadoDaAcao> {
  return escreverNoFinanceiro(`/financeiro/workflows/${key}/executar`, {});
}

type LinhaDoPlanoDeContas = {
  readonly cod?: string;
  readonly categoria?: string;
  readonly categoriaClickup?: string;
  readonly descricao?: string;
};

/**
 * O import do Plano de contas (D4-10) — pronto aqui para 04-13 (a tela)
 * usar sem duplicar o transporte. `linhas` repassa tal como a tela monta; a
 * tradução `categoriaClickup` → `categoria_clickup` é responsabilidade da
 * borda do `apps/api` (04-10), não desta ação.
 */
export async function importarPlanoDeContas(entrada: {
  readonly empresa: string;
  readonly tipo: "pagar" | "receber";
  readonly linhas: ReadonlyArray<LinhaDoPlanoDeContas>;
}): Promise<ResultadoDaAcao> {
  const resultado = await escreverNoFinanceiro("/financeiro/plano-contas/importar", entrada);
  if (resultado.ok) revalidatePath("/financeiro/plano-contas");
  return resultado;
}

/** Remove uma linha do Plano de contas por id (D4-10) — pronta para 04-13. */
export async function removerLinhaDoPlanoDeContas(id: string): Promise<ResultadoDaAcao> {
  const resultado = await escreverNoFinanceiro(`/financeiro/plano-contas/${id}/remover`, {});
  if (resultado.ok) revalidatePath("/financeiro/plano-contas");
  return resultado;
}

/**
 * `enviarExtrato` NÃO mora aqui: o upload precisa de barra de progresso
 * real (evento de progresso do `XMLHttpRequest`, UI-SPEC §5), o que uma
 * Server Action não expõe — por isso o envio sai do cliente direto para um
 * route handler, não para esta ação. É trabalho de 04-13; ninguém deve
 * procurar essa função neste arquivo.
 */
