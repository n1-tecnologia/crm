/**
 * Os recortes de Minhas Tarefas, fora da tela: a mesma conta serve à página
 * `/estrutura/tarefas` e a quem precisar dos mesmos números (o Início), para
 * o contador de uma tela nunca discordar do da outra.
 *
 * Funções puras, sem React: `agora` vem de fora, para o teste fixar o relógio.
 */

import { effectiveLifecycleOfTask, isOverdue, isTerminalCategory, statusCategory, tarefasAbertasDoMembro } from "@/data/derive";
import type { DataState } from "@/data/state";
import type { Id, Task } from "@/data/types";

/** Um formatador por fuso: montar um `Intl.DateTimeFormat` custa mais que usá-lo, e a tela chama isto por Tarefa. */
const formatosDoDia = new Map<string, Intl.DateTimeFormat>();

/**
 * O dia civil (AAAA-MM-DD) de um instante no fuso do Espaço de Trabalho —
 * `getDate()` responderia no fuso do navegador, e "hoje" seria o de quem olha,
 * não o do Espaço de Trabalho.
 */
export function diaCivilNoFuso(instante: Date | string, fuso: string): string {
  let formato = formatosDoDia.get(fuso);
  if (!formato) {
    formato = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" });
    formatosDoDia.set(fuso, formato);
  }
  return formato.format(typeof instante === "string" ? new Date(instante) : instante);
}

/** O dia civil em que a Tarefa vence: o próprio, se é dia civil; o do instante no fuso, se tem hora. */
export function diaDoVencimento(task: Task, fuso: string): string | null {
  if (!task.dueDate) return null;
  return task.dueDate.form === "civilDay" ? task.dueDate.value : diaCivilNoFuso(task.dueDate.value, fuso);
}

export interface RecortesDeTarefas {
  /** Atribuídas a quem olha e efetivamente ativas — concluídas inclusive. */
  readonly minhas: readonly Task[];
  /** Das minhas, fora de categoria terminal — a mesma conta de `tarefasAbertasDoMembro` (a barra global e o Início). */
  readonly abertas: readonly Task[];
  /** Das minhas, as vencidas (Glossário: uma concluída nunca vence). */
  readonly vencidas: readonly Task[];
  /** A agenda de hoje: abertas com data E HORA no dia de hoje, no fuso do Espaço de Trabalho. */
  readonly hoje: readonly Task[];
  /** Abertas que vencem até hoje + 7 dias e ainda não venceram. */
  readonly semana: readonly Task[];
  /** Todas as Tarefas efetivamente ativas do Espaço de Trabalho. */
  readonly todas: readonly Task[];
}

/**
 * Vencida primeiro, depois pelo vencimento mais próximo; sem data vai ao fim.
 * Na agenda de hoje isso é a ordem do relógio. A comparação é do texto gravado
 * (dia civil ou instante), e a ordenação é estável: empate fica na ordem do estado.
 */
function porVencimento(tasks: readonly Task[]): Task[] {
  const chave = (task: Task): string => String(task.dueDate?.value ?? "9999");
  return [...tasks].sort((a, b) => chave(a).localeCompare(chave(b)));
}

/**
 * Os seis recortes de Minhas Tarefas, cada um já na ordem em que a tela os
 * mostra. A agenda e a semana são do que ainda está aberto: uma Tarefa
 * concluída não é compromisso. O vencido tem recorte próprio e não se repete
 * na semana. "Hoje" e "semana" leem o dia no fuso do Espaço de Trabalho
 * (`workspace.locale.timezone`), nunca no de quem renderiza.
 */
export function recortesDeTarefas(state: DataState, memberId: Id, agora: Date): RecortesDeTarefas {
  const fuso = state.workspace.locale.timezone;

  const ativas = state.tasks.filter((task) => effectiveLifecycleOfTask(state, task.id) === "ativo");
  const minhas = ativas.filter((task) => task.assignees.some((a) => a.kind === "member" && a.id === memberId));
  const vencidas = minhas.filter((task) => isOverdue(state, task, agora));

  const abertas = minhas.filter((task) => !isTerminalCategory(statusCategory(state, task)));
  const hojeDia = diaCivilNoFuso(agora, fuso);
  const limiteDaSemana = diaCivilNoFuso(new Date(agora.getTime() + 7 * 86_400_000), fuso);
  const hoje = abertas.filter((task) => task.dueDate?.form === "instant" && diaDoVencimento(task, fuso) === hojeDia);
  const semana = abertas.filter((task) => {
    const dia = diaDoVencimento(task, fuso);
    return dia !== null && dia <= limiteDaSemana && !isOverdue(state, task, agora);
  });

  return {
    minhas: porVencimento(minhas),
    abertas: porVencimento(abertas),
    vencidas: porVencimento(vencidas),
    hoje: porVencimento(hoje),
    semana: porVencimento(semana),
    todas: porVencimento(ativas),
  };
}

/** Os grupos de "Suas Tarefas" no resumo do Início, cada Tarefa num grupo só, do mais urgente ao mais folgado. */
export interface GruposDeTarefas {
  /** Abertas e vencidas. */
  readonly vencidas: readonly Task[];
  /** Abertas, não vencidas, na categoria `em andamento` — as "tasks atuais". */
  readonly emAndamento: readonly Task[];
  /** O recorte "Esta semana" (vencem em até 7 dias), fora as já em andamento. */
  readonly proximas: readonly Task[];
  /** O resto das abertas: vencem depois, ou sem vencimento. */
  readonly depois: readonly Task[];
}

/**
 * Reparte as Tarefas ABERTAS de quem olha (`tarefasAbertasDoMembro`, a conta
 * da barra global) nos quatro grupos do resumo — cada Tarefa em UM grupo, na
 * ordem de urgência: Vencidas primeiro; depois Em andamento; depois as que
 * vencem em até 7 dias (o recorte "Esta semana"); depois o resto. Fora daqui,
 * o atalho "n em andamento" do Início lê o MESMO grupo. Cada grupo na ordem
 * do vencimento.
 */
export function gruposDeTarefas(state: DataState, memberId: Id, agora: Date): GruposDeTarefas {
  const abertas = tarefasAbertasDoMembro(state, memberId);
  const { semana } = recortesDeTarefas(state, memberId, agora);
  const listadas = new Set<Id>();
  const tomar = (tasks: readonly Task[], condicao: (task: Task) => boolean): Task[] => {
    const grupo = porVencimento(tasks.filter((task) => !listadas.has(task.id) && condicao(task)));
    for (const task of grupo) listadas.add(task.id);
    return grupo;
  };
  const vencidas = tomar(abertas, (task) => isOverdue(state, task, agora));
  const emAndamento = tomar(abertas, (task) => statusCategory(state, task) === "emAndamento");
  const proximas = tomar(semana, () => true);
  const depois = tomar(abertas, () => true);
  return { vencidas, emAndamento, proximas, depois };
}
