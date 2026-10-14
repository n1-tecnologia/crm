/**
 * PRIV-03 — o que um Membro ENXERGA do Espaço de Trabalho. A privacidade de um
 * contêiner (B38) era aplicada só pela tela: `GET /estado` entregava o estado
 * inteiro, Gestão incluída (CPF, dado bancário), e a árvore escondia. Aqui o
 * servidor recorta ANTES de responder, com as mesmas leituras que a tela usa
 * (`memberReachesContainer`, `memberSeesTask`), para que os dois lados
 * concordem sobre o que existe.
 *
 * O que sai:
 *   - Espaço, Pasta e Lista que o Membro não alcança — exceto os ANCESTRAIS de
 *     algo que ele alcança (RN-ESP-15: uma Lista compartilhada dentro de Espaço
 *     privado expõe os nomes do caminho; e a configuração efetiva dela vem do
 *     Espaço, então o registro precisa estar lá).
 *   - Tarefa que o Membro não vê (`memberSeesTask`: alcance da Lista, concessão
 *     na Tarefa, ou Campo `person` que o nomeia).
 *   - Registro de Atividade e Pedido de Aprovação sobre o que saiu.
 *
 * O que fica: tudo o mais — Membros, Papéis, Concessões, Equipes são o que a
 * própria leitura de alcance precisa. Coleções fora da Estrutura (CRM, Caixa
 * de Entrada, IA) não têm privacidade por contêiner e não são recortadas aqui.
 *
 * `ocultos` é o conjunto de ids que saíram: a rota de gravação filtra o diff
 * com ele, para um registro oculto não entrar pela porta de trás.
 */

import { containerPath, memberReachesContainer, memberSeesTask } from "./derive";
import type { Diferenca, Ordens } from "./diferenca";
import type { DataState } from "./state";
import type { Id, Task } from "./types";

export interface Visibilidade {
  readonly estado: DataState;
  readonly ocultos: ReadonlySet<Id>;
}

export function visibilidadePara(state: DataState, memberId: Id): Visibilidade {
  // Tarefas primeiro: uma Tarefa vista por concessão direta puxa o caminho da
  // Lista dela, mesmo que a Lista em si não seja alcançada.
  const tarefasVisiveis = state.tasks.filter((t) => memberSeesTask(state, memberId, t.id));
  const alcancados = new Set<Id>();
  const puxarCaminho = (type: "space" | "folder" | "list", id: Id) => {
    for (const no of containerPath(state, type, id)) alcancados.add(no.id);
  };
  const listasDasTarefas = new Set(tarefasVisiveis.map((t) => t.listId));
  for (const l of state.lists) {
    if (listasDasTarefas.has(l.id) || memberReachesContainer(state, memberId, "list", l.id)) puxarCaminho("list", l.id);
  }
  for (const f of state.folders) {
    if (!alcancados.has(f.id) && memberReachesContainer(state, memberId, "folder", f.id)) puxarCaminho("folder", f.id);
  }
  for (const s of state.spaces) {
    if (!alcancados.has(s.id) && memberReachesContainer(state, memberId, "space", s.id)) alcancados.add(s.id);
  }

  const ocultos = new Set<Id>();
  const spaces = state.spaces.filter((s) => alcancados.has(s.id) || !ocultos.add(s.id));
  const folders = state.folders.filter((f) => alcancados.has(f.id) || !ocultos.add(f.id));
  const lists = state.lists.filter((l) => alcancados.has(l.id) || !ocultos.add(l.id));
  const visiveis = new Set(tarefasVisiveis.map((t) => t.id));
  for (const t of state.tasks) if (!visiveis.has(t.id)) ocultos.add(t.id);

  if (ocultos.size === 0) return { estado: state, ocultos };

  const activity = state.activity.filter((a) => !ocultos.has(a.objectId));
  const approvals = state.approvals.filter((a) => !ocultos.has(a.object.targetResourceId));
  // Um Arquivo que só Tarefas ocultas carregam sai junto (o nome e a chave do objeto também são informação).
  const files = state.files.filter((f) => {
    const donas = tarefasComOArquivo(state, f.id);
    if (donas.length === 0) return true;
    if (donas.some((t) => visiveis.has(t.id))) return true;
    ocultos.add(f.id);
    return false;
  });
  return { estado: { ...state, spaces, folders, lists, tasks: tarefasVisiveis, activity, approvals, files }, ocultos };
}

/**
 * POSC-08 — as Tarefas que carregam um Arquivo: como Anexo, como Anexo de um
 * Comentário, ou como valor de um Campo de arquivo. É por elas que o acesso ao
 * Arquivo se decide: quem vê a Tarefa baixa o Arquivo dela.
 */
export function tarefasComOArquivo(state: DataState, fileId: Id): Task[] {
  return state.tasks.filter(
    (t) =>
      t.attachments.some((a) => a.fileId === fileId) ||
      t.comments.some((c) => c.attachments.some((a) => a.fileId === fileId)) ||
      t.fieldValues.some((v) => v.value === fileId || (Array.isArray(v.value) && v.value.includes(fileId))),
  );
}

/**
 * Quem vê alguma Tarefa que carrega o Arquivo o baixa. Um Arquivo que nenhuma
 * Tarefa carrega (o de um envio público ainda não convertido, por exemplo)
 * continua aberto a quem tem sessão no Espaço de Trabalho — era a regra única
 * antes desta.
 */
export function membroVeArquivo(state: DataState, memberId: Id, fileId: Id): boolean {
  if (!state.files.some((f) => f.id === fileId)) return false;
  const tarefas = tarefasComOArquivo(state, fileId);
  if (tarefas.length === 0) return true;
  return tarefas.some((t) => memberSeesTask(state, memberId, t.id));
}

export function estadoVisivelPara(state: DataState, memberId: Id): DataState {
  return visibilidadePara(state, memberId).estado;
}

/** O diff de uma gravação sem o que o Membro não enxerga — nem gravado nem removido. */
export function filtrarDiferenca(diferenca: Diferenca, ocultos: ReadonlySet<Id>): Diferenca {
  if (ocultos.size === 0) return diferenca;
  return {
    gravados: diferenca.gravados.filter((g) => !ocultos.has(g.id)),
    removidos: diferenca.removidos.filter((r) => !ocultos.has(r.id)),
  };
}

/** As ordens (colecao → id → ordem) sem os ids ocultos — um id também é informação. */
export function filtrarOrdens(ordens: Ordens, ocultos: ReadonlySet<Id>): Ordens {
  if (ocultos.size === 0) return ordens;
  const saida: Ordens = {};
  for (const [colecao, porId] of Object.entries(ordens)) {
    const filtrado: Record<string, number> = {};
    for (const [id, ordem] of Object.entries(porId)) if (!ocultos.has(id)) filtrado[id] = ordem;
    saida[colecao] = filtrado;
  }
  return saida;
}
