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
 *   - IA pessoal (DO-CHT-09, D-01, D-22): a Sessão de Chat que o Membro não lê
 *     (`membroVeSessaoDeChat` — vale para todo Papel, o Proprietário incluído),
 *     a pasta de chat que não é dele e a Execução de agente cuja origem é uma
 *     Sessão que saiu (o texto da conversa mora em `input`/`output`). Uma Sessão
 *     compartilhada chega sem `folderId` quando a pasta é de outro Membro.
 *
 *   - Dado pessoal de outro Membro (D-01, 1.1.2): a Memória de Usuário chega
 *     como `{ enabled, items: [] }`; o e-mail de um convite `pendente` chega
 *     como "Convite pendente" a quem não administra o Espaço (o convite grava o
 *     e-mail também em `displayName`); a Visão pessoal (`ownerKind: "member"`)
 *     de outro Membro sai.
 *   - Segredo de link público (1.1.3, Pattern 2): `Task.publicShare.secret` e
 *     `Form.secret` chegam como "" a quem não administra a Lista
 *     (`containerAdminRefusal`). O segredo some trocando o valor, não apagando
 *     a chave — os tipos dizem `readonly secret: string`. O Formulário de uma
 *     Lista oculta sai.
 *
 * O que fica: tudo o mais — Membros, Papéis, Concessões, Equipes são o que a
 * própria leitura de alcance precisa. Coleções fora da Estrutura e da IA
 * pessoal (CRM, Caixa de Entrada) não têm privacidade por contêiner e não são
 * recortadas aqui. O recorte parte sempre do estado INTEIRO, e nunca devolve o
 * mesmo objeto: não existe atalho "nada oculto, devolve como veio".
 *
 * `ocultos` é o conjunto de ids que saíram: a rota de gravação filtra o diff
 * com ele, para um registro oculto não entrar pela porta de trás.
 */

import { containerAdminRefusal, containerPath, membroVeSessaoDeChat, memberReachesContainer, memberSeesTask } from "./derive";
import type { Diferenca, Ordens } from "./diferenca";
import { administraOEspaco } from "./operations/ia/permissoes-ia";
import type { DataState } from "./state";
import type { ChatSession, Form, Id, Member, Task } from "./types";

export interface Visibilidade {
  readonly estado: DataState;
  readonly ocultos: ReadonlySet<Id>;
}

/** O `displayName` de um Membro `pendente` para quem não administra o Espaço (o convite o grava com o e-mail). */
const NOME_DO_CONVITE_PENDENTE = "Convite pendente";

function recortarMembro(membro: Member, state: DataState, memberId: Id): Member {
  let saida = membro;
  if (membro.id !== memberId) saida = { ...saida, userMemory: { enabled: membro.userMemory.enabled, items: [] } };
  if (membro.state === "pendente" && !administraOEspaco(state, memberId)) {
    // Sem a chave (exactOptionalPropertyTypes): `invitedIdentity: undefined` não é o mesmo que ausente.
    const { invitedIdentity: _email, ...semEmail } = saida;
    saida = { ...semEmail, displayName: NOME_DO_CONVITE_PENDENTE };
  }
  return saida;
}

/**
 * O registro de UMA coleção como o Membro pode lê-lo (Pattern 2 da Fase 9):
 * cópia sem os campos que não são dele, sem tocar no original. Coleção sem
 * regra volta intacta (os Canais projetados da Fase 8 passam por aqui sem
 * mudança). `state` é sempre o estado INTEIRO: a decisão olha Papéis e
 * concessões que o estado recortado já não traz.
 */
export function recortarRegistro<T>(colecao: string, dados: T, state: DataState, memberId: Id): T {
  switch (colecao) {
    case "members":
      return recortarMembro(dados as Member, state, memberId) as T;
    case "tasks": {
      const tarefa = dados as Task;
      if (tarefa.publicShare === undefined) return dados;
      if (containerAdminRefusal(state, memberId, "list", tarefa.listId) === undefined) return dados;
      return { ...tarefa, publicShare: { ...tarefa.publicShare, secret: "" } } as T;
    }
    case "forms": {
      const form = dados as Form;
      if (containerAdminRefusal(state, memberId, "list", form.listId) === undefined) return dados;
      return { ...form, secret: "" } as T;
    }
    default:
      return dados;
  }
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

  // Dado pessoal e segredos de link (D-01, 1.1.2 e 1.1.3): sempre a partir do estado inteiro.
  const members = state.members.map((m) => recortarRegistro("members", m, state, memberId));
  const views = state.views.filter((v) => (v.ownerKind === "member" && v.ownerId !== memberId ? !ocultos.add(v.id) : true));
  const tasks = tarefasVisiveis.map((t) => recortarRegistro("tasks", t, state, memberId));
  const forms = state.forms
    .filter((f) => !ocultos.has(f.listId) || !ocultos.add(f.id))
    .map((f) => recortarRegistro("forms", f, state, memberId));

  // IA pessoal, a partir do estado INTEIRO (Pattern 1 da Fase 9). Sem retorno
  // antecipado acima: o Proprietário alcança toda a Estrutura e, ainda assim,
  // não lê a Sessão de Chat de outro Membro (DO-CHT-09).
  const sessoesQueSaem = new Set<Id>();
  const chatSessions: ChatSession[] = [];
  for (const sessao of state.chatSessions) {
    if (!membroVeSessaoDeChat(state, memberId, sessao)) {
      sessoesQueSaem.add(sessao.id);
      ocultos.add(sessao.id);
    } else if (sessao.ownerMemberId !== memberId && sessao.folderId !== undefined) {
      // A pasta de chat é pessoal: a Sessão compartilhada chega sem ela.
      const semPasta: ChatSession = { ...sessao };
      delete semPasta.folderId;
      chatSessions.push(semPasta);
    } else {
      chatSessions.push(sessao);
    }
  }
  const chatFolders = state.chatFolders.filter((f) => f.ownerMemberId === memberId || !ocultos.add(f.id));
  const agentExecutions = state.agentExecutions.filter(
    (e) => e.chatSessionId === undefined || !sessoesQueSaem.has(e.chatSessionId) || !ocultos.add(e.id),
  );

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
  return {
    estado: { ...state, members, views, spaces, folders, lists, tasks, forms, activity, approvals, files, chatSessions, chatFolders, agentExecutions },
    ocultos,
  };
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
