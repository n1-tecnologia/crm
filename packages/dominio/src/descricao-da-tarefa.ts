/**
 * A descrição da Tarefa e o que se lê dela (Fase 11, 2.6.6 e 2.6.8).
 *
 * Três ideias moram aqui, para o domínio, as Notificações e a tela dizerem a
 * mesma coisa:
 * - a descrição não tem autor (ontologia `tarefa.md`:68): quem a alterou é o
 *   autor do Registro de Atividade, e o texto antigo e o novo vão nele;
 * - a menção sai do texto (D-06, D-09): `Task.descriptionMentions` é só a lista
 *   de quem foi escolhido ao digitar, e vale apenas enquanto o `@Nome` continua
 *   escrito na descrição;
 * - o corte do histórico é do dado (D-10), não da tela: o Registro grava, no
 *   máximo, 2.000 pontos de código de cada lado.
 *
 * Módulo-folha: importa só tipos, nunca `./derive` (evita ciclo de import).
 */

import type { DataState } from "./state";
import type { ActivityRecord, Id, Task } from "./types";

/** D-10 — pontos de código de conteúdo que o histórico guarda de cada lado. */
export const LIMITE_DO_HISTORICO = 2000;

/** O texto da ação que `updateTask` grava, e que a tela e a Notificação reconhecem. */
export const ACAO_DESCRICAO_ALTERADA = "Descrição alterada";

/**
 * O texto como o histórico o guarda: até `LIMITE_DO_HISTORICO` pontos de código
 * fica igual; acima, os primeiros 2.000 e "…" (2.001 no total). Corta por ponto
 * de código, nunca no meio de um par substituto (emoji).
 */
export function cortarParaHistorico(texto: string): string {
  const pontos = Array.from(texto);
  if (pontos.length <= LIMITE_DO_HISTORICO) return texto;
  return `${pontos.slice(0, LIMITE_DO_HISTORICO).join("")}…`;
}

/** Este Registro é a alteração da descrição de uma Tarefa? */
export function ehAlteracaoDeDescricao(record: Pick<ActivityRecord, "objectType" | "action">): boolean {
  return record.objectType === "task" && record.action === ACAO_DESCRICAO_ALTERADA;
}

const PARTE_DE_PALAVRA = /[\p{L}\p{N}_]/u;

/** O `@` + `nome` começa em `inicio` e termina numa fronteira (fim, espaço ou pontuação)? */
function mencaoEmPosicao(texto: string, inicio: number, nome: string): boolean {
  if (nome === "" || texto[inicio] !== "@" || !texto.startsWith(nome, inicio + 1)) return false;
  const depois = texto.slice(inicio + 1 + nome.length, inicio + 1 + nome.length + 2);
  const seguinte = Array.from(depois)[0];
  return seguinte === undefined || !PARTE_DE_PALAVRA.test(seguinte);
}

/**
 * O texto menciona `@nome`? Comparação exata (sensível a acento) e com
 * fronteira depois do nome: "@Júlia Pradoso" não menciona "Júlia Prado", e
 * "Júlia Prado" sem `@` também não. É a ÚNICA régua da menção (domínio, hook de
 * digitação e destaque na tela).
 */
export function mencionaNoTexto(texto: string, nome: string): boolean {
  let i = texto.indexOf("@");
  while (i !== -1) {
    if (mencaoEmPosicao(texto, i, nome)) return true;
    i = texto.indexOf("@", i + 1);
  }
  return false;
}
