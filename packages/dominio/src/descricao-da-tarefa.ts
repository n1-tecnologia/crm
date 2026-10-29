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
  return posicaoDaMencao(texto, nome) !== -1;
}

/** Índice (em unidades UTF-16) da primeira menção de `@nome` com fronteira, ou -1. */
function posicaoDaMencao(texto: string, nome: string): number {
  let i = texto.indexOf("@");
  while (i !== -1) {
    if (mencaoEmPosicao(texto, i, nome)) return i;
    i = texto.indexOf("@", i + 1);
  }
  return -1;
}

/**
 * Quem a descrição menciona DE FATO: percorre `task.descriptionMentions`, acha
 * o Membro em `state.members` e só o mantém se o `@Nome` dele continua escrito
 * na descrição (sem repetição, na ordem da lista). É a ÚNICA leitura da lista:
 * menção sem `@Nome` no texto nunca avisa nem destaca (D-09), qualquer que seja
 * o escritor da descrição (`updateTask`, o rollback do financeiro, a recorrência).
 */
export function membrosMencionadosNaDescricao(state: DataState, task: Task): Id[] {
  const ids: Id[] = [];
  for (const mencao of task.descriptionMentions ?? []) {
    if (mencao.type !== "member" || ids.includes(mencao.id)) continue;
    const membro = state.members.find((m) => m.id === mencao.id);
    if (membro && mencionaNoTexto(task.description, membro.displayName)) ids.push(membro.id);
  }
  return ids;
}

/**
 * Parte o texto em pedaços de texto puro e pedaços de menção, para a tela
 * destacar sem montar HTML. Em cada `@`, tenta os nomes do mais longo para o
 * mais curto (com a mesma fronteira de `mencionaNoTexto`), então "@Ana Lima"
 * vence "@Ana". Nunca devolve HTML. Texto vazio devolve `[]`.
 */
export function segmentosComMencoes(
  texto: string,
  nomes: readonly string[],
): ReadonlyArray<{ readonly mencao: boolean; readonly texto: string }> {
  if (texto === "") return [];
  const ordenados = [...new Set(nomes)].filter((n) => n !== "").sort((a, b) => b.length - a.length);
  const segmentos: Array<{ mencao: boolean; texto: string }> = [];
  let comum = "";
  let i = 0;
  while (i < texto.length) {
    const nome = texto[i] === "@" ? ordenados.find((n) => mencaoEmPosicao(texto, i, n)) : undefined;
    if (nome === undefined) {
      comum += texto[i];
      i += 1;
      continue;
    }
    if (comum !== "") segmentos.push({ mencao: false, texto: comum });
    comum = "";
    segmentos.push({ mencao: true, texto: `@${nome}` });
    i += 1 + nome.length;
  }
  if (comum !== "") segmentos.push({ mencao: false, texto: comum });
  return segmentos;
}

/**
 * O pedaço da descrição que a Notificação mostra: uma janela de `raio` pontos
 * de código ao redor da primeira ocorrência de `@nome`, com espaços e quebras de
 * linha seguidos virando um espaço e "…" onde cortou. Sem a menção no texto,
 * devolve o começo dele, cortado pela mesma régua.
 */
export function trechoDaMencao(texto: string, nome: string, raio = 60): string {
  const plano = texto.replace(/\s+/g, " ").trim();
  const pontos = Array.from(plano);
  const indice = posicaoDaMencao(plano, nome);
  let inicio = 0;
  let fim = Math.min(pontos.length, raio * 2);
  if (indice !== -1) {
    const antes = Array.from(plano.slice(0, indice)).length;
    inicio = Math.max(0, antes - raio);
    fim = Math.min(pontos.length, antes + 1 + Array.from(nome).length + raio);
  }
  return `${inicio > 0 ? "…" : ""}${pontos.slice(inicio, fim).join("")}${fim < pontos.length ? "…" : ""}`;
}
