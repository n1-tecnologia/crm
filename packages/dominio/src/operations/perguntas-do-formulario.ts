/**
 * Checklist 1.3 — a regra de quando uma pergunta do Formulário está à mostra,
 * sem dependência nenhuma: o envio (`submitForm`, `./scale.ts`) e a página
 * pública (`apps/web/src/features/formulario-publico`) usam a MESMA função, e
 * a página não leva o domínio inteiro para o navegador por causa dela.
 */

type Id = string;

/**
 * A pergunta está à mostra para estas respostas: sem condição, sempre; com
 * condição, quando a pergunta-gatilho está à mostra E tem um dos valores.
 * Genérica na forma (`id` + `showWhen`): serve à pergunta do domínio e à do
 * DTO público.
 */
export function perguntaVisivel<P extends { readonly id: Id; readonly showWhen?: { readonly questionId: Id; readonly values: readonly string[] } }>(
  perguntas: readonly P[],
  pergunta: P,
  respostas: Readonly<Record<Id, string | undefined>>,
): boolean {
  const vistas = new Set<Id>();
  let atual: P | undefined = pergunta;
  while (atual?.showWhen) {
    if (vistas.has(atual.id)) return false;
    vistas.add(atual.id);
    const { questionId, values }: { readonly questionId: Id; readonly values: readonly string[] } = atual.showWhen;
    const gatilho: P | undefined = perguntas.find((q) => q.id === questionId);
    if (!gatilho || !values.includes((respostas[gatilho.id] ?? "").trim())) return false;
    atual = gatilho;
  }
  return true;
}
