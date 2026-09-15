/**
 * O assistente de construção. Não há Modelo no protótipo, então ele é um
 * ROTEIRO: olha o rascunho, pergunta a primeira coisa que falta e grava a
 * resposta no campo certo. O que ele produz é configuração de verdade, à
 * esquerda — não conversa fiada.
 */

import type { BuilderDraft } from "./state";

export type BuildStep = "nome" | "descricao" | "instrucoes" | "quebraGelos" | "pronto";

/**
 * O primeiro campo vazio, na ordem em que faz sentido preencher. O quebra-gelo
 * é opcional: quem respondeu "não" pulou a etapa, e ela não volta.
 */
export function nextStep(draft: BuilderDraft, skippedIcebreakers = false): BuildStep {
  if (!draft.name.trim()) return "nome";
  if (!draft.description.trim()) return "descricao";
  if (!draft.instructions.trim()) return "instrucoes";
  if (!skippedIcebreakers && draft.icebreakers.filter((s) => s.trim()).length === 0) return "quebraGelos";
  return "pronto";
}

export const isSkip = (answer: string): boolean => /^(n[aã]o|pular|skip)[.!]?$/i.test(answer.trim());

export function questionFor(step: BuildStep): string {
  switch (step) {
    case "nome":
      return "Vamos começar pelo básico: como o seu agente vai se chamar?";
    case "descricao":
      return "Em uma frase, o que ele faz e para quem?";
    case "instrucoes":
      return "Agora as instruções: como ele deve se comportar, o que pode fazer e o que nunca deve fazer? Escreva como se explicasse a uma pessoa nova no time.";
    case "quebraGelos":
      return "Quer sugerir uma primeira frase para quem abrir a conversa com ele? Escreva uma (ou responda “não” para pular).";
    case "pronto":
      return "A configuração básica está preenchida à esquerda. Revise em Configurar, ajuste Modelo, Ferramentas e Ponto de acesso se precisar, e publique quando estiver bom. Se quiser mudar algo pelo chat, é só me dizer o quê.";
  }
}

/** Grava a resposta no campo da etapa e devolve o rascunho novo. */
export function applyAnswer(draft: BuilderDraft, step: BuildStep, answer: string): BuilderDraft {
  const texto = answer.trim();
  switch (step) {
    case "nome":
      return { ...draft, name: texto.slice(0, 80) };
    case "descricao":
      return { ...draft, description: texto.slice(0, 200) };
    case "instrucoes":
      return { ...draft, instructions: texto.slice(0, 4000) };
    case "quebraGelos":
      return isSkip(texto)
        ? draft
        : { ...draft, icebreakers: [...draft.icebreakers.filter((s) => s.trim()), texto] };
    case "pronto":
      return draft;
  }
}

/** O que o assistente diz depois de gravar a resposta. */
export function acknowledgement(step: BuildStep, draft: BuilderDraft): string {
  switch (step) {
    case "nome":
      return `Nome gravado: “${draft.name}”.`;
    case "descricao":
      return "Descrição gravada.";
    case "instrucoes":
      return `Instruções gravadas (${draft.instructions.length}/4000).`;
    case "quebraGelos":
      return draft.icebreakers.length > 0 ? "Quebra-gelo adicionado." : "Sem quebra-gelo por enquanto.";
    case "pronto":
      return "Anotei. Para mudar um campo específico, edite-o em Configurar — eu não consigo adivinhar qual você quer trocar sem um Modelo por trás.";
  }
}
