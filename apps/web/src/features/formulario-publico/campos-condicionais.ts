/**
 * Checklist 1.2/1.3 — as seções e os campos condicionais da página pública,
 * lidos do FORMULÁRIO (o DTO: `section` e `showWhen` de cada pergunta), em
 * funções puras, sem DOM. Antes, a ordem, as seções e as condições eram uma
 * tabela fixa por RÓTULO (`Fornecedor`, `Forma de pagamento`…): renomear uma
 * pergunta quebrava a página. Agora quem decide é o Formulário, editado pela
 * tela, e a regra de "está à mostra" é a MESMA do envio
 * (`perguntaVisivel`, do domínio).
 */

import { perguntaVisivel } from "@n1/dominio/operations/perguntas-do-formulario";
import type { PerguntaPublica } from "@/dados/transporte-publico";

/** Respostas atuais, indexadas pelo id da pergunta. */
export type RespostasPorId = Readonly<Record<string, string>>;

/** Os ids das perguntas à mostra para estas respostas. */
export function perguntasVisiveis(perguntas: readonly PerguntaPublica[], respostas: RespostasPorId): ReadonlySet<string> {
  return new Set(perguntas.filter((p) => perguntaVisivel(perguntas, p, respostas)).map((p) => p.id));
}

/** A pergunta decide se outra aparece (é gatilho de alguma condição). */
export function ehGatilho(perguntas: readonly PerguntaPublica[], perguntaId: string): boolean {
  return perguntas.some((p) => p.showWhen?.questionId === perguntaId);
}

/**
 * Ao trocar `perguntaId` para `valorNovo`, as perguntas que ficariam ocultas
 * por essa troca E que já têm algo (resposta digitada ou arquivo) — é a lista
 * que abre a confirmação de troca (UI-SPEC: ocultar não apaga em silêncio o
 * que já foi digitado). A que perderia a visibilidade vazia não entra.
 */
export function invalidadasPor(
  perguntas: readonly PerguntaPublica[],
  perguntaId: string,
  valorNovo: string,
  respostas: RespostasPorId,
  comArquivos: ReadonlySet<string> = new Set(),
): readonly PerguntaPublica[] {
  const antes = perguntasVisiveis(perguntas, respostas);
  const depois = perguntasVisiveis(perguntas, { ...respostas, [perguntaId]: valorNovo });
  return perguntas.filter((p) => antes.has(p.id) && !depois.has(p.id) && ((respostas[p.id] ?? "").trim() !== "" || comArquivos.has(p.id)));
}

export interface Secao {
  /** Ausente: as perguntas sem seção, num bloco sem título. */
  readonly titulo?: string;
  readonly perguntas: readonly PerguntaPublica[];
}

/** As perguntas na ordem do Formulário, em blocos: cada troca de seção começa um bloco novo. */
export function secoesDoFormulario(perguntas: readonly PerguntaPublica[]): readonly Secao[] {
  const secoes: { titulo?: string; perguntas: PerguntaPublica[] }[] = [];
  for (const pergunta of perguntas) {
    const titulo = pergunta.section?.trim() || undefined;
    const ultima = secoes.at(-1);
    if (ultima && ultima.titulo === titulo) ultima.perguntas.push(pergunta);
    else secoes.push({ ...(titulo ? { titulo } : {}), perguntas: [pergunta] });
  }
  return secoes;
}
