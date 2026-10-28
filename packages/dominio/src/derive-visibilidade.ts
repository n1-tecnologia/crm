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
 *   - Execução de IA (CR-01): a de agente também sai quando o objeto que ela ancora
 *     saiu, e a de Automação quando o objeto em que atuou saiu (`input`, `output`
 *     e `steps` carregam o conteúdo do objeto). Ver "IA do Espaço para o Convidado".
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
 *   - IA do Espaço para o Convidado (D-02, escolha A): quem tem Papel de base
 *     `convidado` recebe Agentes, Automações, Documentos, Coleções e Habilidades
 *     como `[]` (e os ids em `ocultos`), e também as Execuções (de agente e de
 *     Automação) e as Concessões de Habilidade e de Coleção; a regra fina por
 *     registro é a Sessão 17.
 *   - Arquivo órfão (R3): o que nenhuma Tarefa carrega só é visto por quem o
 *     criou e por quem administra o Espaço; o `legado/*` (sem conteúdo) segue aberto.
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
import { arquivoSemConteudo } from "./operations/anexos-enviados";
import { administraOEspaco, baseDoPapel } from "./operations/ia/permissoes-ia";
import type { DataState } from "./state";
import type { AgentExecution, ChatSession, Form, Id, Member, Task, WorkspaceFile } from "./types";

export interface Visibilidade {
  readonly estado: DataState;
  readonly ocultos: ReadonlySet<Id>;
}

/** O `displayName` de um Membro `pendente` para quem não administra o Espaço (o convite o grava com o e-mail). */
const NOME_DO_CONVITE_PENDENTE = "Convite pendente";

function recortarMembro(membro: Member, state: DataState, memberId: Id): Member {
  let saida = membro;
  // O tipo exige `userMemory`, mas o Membro hidratado do Postgres pode vir sem ele; o recorte não pode derrubar
  // `GET /estado` por isso. Sem o campo, o de outro chega com o padrão de criação (`enabled: true`) e sem itens.
  if (membro.id !== memberId) saida = { ...saida, userMemory: { enabled: (membro.userMemory as Member["userMemory"] | undefined)?.enabled ?? true, items: [] } };
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

  // D-02 (escolha A): o Convidado não recebe a IA do Espaço — a barreira é o servidor, a tela só deixa de oferecer.
  // Calculado ANTES das Execuções: elas carregam conteúdo (`input`/`output`/`steps`) e fazem parte da IA do Espaço.
  const convidado = baseDoPapel(state, memberId) === "convidado";

  // CR-01 — a Execução de IA segue o que ela toca. A de agente sai se a Sessão de Chat saiu, se o objeto que ela
  // ancora (`anchor`, ou a âncora da composição de contexto, que traz o nome) está em `ocultos`, ou se o chamador
  // é Convidado. A de Automação sai se o objeto em que atuou (`objectId`) está em `ocultos`, ou se é Convidado.
  // O id da que sai entra em `ocultos`: o diff de `POST /operacoes/:nome` e o Registro de Atividade dela também saem.
  const ancoraOculta = (ancora: { readonly id: Id } | undefined): boolean => ancora !== undefined && ocultos.has(ancora.id);
  const agentExecutions = state.agentExecutions.filter((e) => {
    const sai =
      convidado ||
      (e.chatSessionId !== undefined && sessoesQueSaem.has(e.chatSessionId)) ||
      ancoraOculta(e.anchor) ||
      ancoraOculta((e.contextComposition as AgentExecution["contextComposition"] | undefined)?.anchor);
    if (sai) ocultos.add(e.id);
    return !sai;
  });
  const automationExecutions = state.automationExecutions.filter((e) => {
    const sai = convidado || (e.objectId !== undefined && ocultos.has(e.objectId));
    if (sai) ocultos.add(e.id);
    return !sai;
  });

  const semIA = <T extends { readonly id: Id }>(registros: T[]): T[] => {
    if (!convidado) return registros;
    for (const r of registros) ocultos.add(r.id);
    return [];
  };
  const agents = semIA(state.agents);
  const automations = semIA(state.automations);
  const documents = semIA(state.documents);
  const collections = semIA(state.collections);
  const skills = semIA(state.skills);
  // As Concessões ligam Agente a Habilidade e a Coleção: sem os dois lados, ficariam só como ids soltos.
  const skillGrants = semIA(state.skillGrants);
  const collectionGrants = semIA(state.collectionGrants);

  const activity = state.activity.filter((a) => !ocultos.has(a.objectId));
  // CR-01 (residual, 09-21): a aprovação de uma Execução de agente oculta carrega `object.input` dela —
  // o `targetResourceId` sozinho não basta, porque pode ser de um objeto diferente e visível.
  const approvals = state.approvals.filter((a) => {
    const execOculta = a.origin.kind === "agentExecution" && ocultos.has(a.origin.executionId);
    return !execOculta && !ocultos.has(a.object.targetResourceId);
  });
  // Um Arquivo que só Tarefas ocultas carregam sai junto (o nome e a chave do objeto também são informação).
  const files = state.files.filter((f) => {
    const donas = tarefasComOArquivo(state, f.id);
    if (donas.length === 0 ? arquivoOrfaoVisivel(state, memberId, f) : donas.some((t) => visiveis.has(t.id))) return true;
    ocultos.add(f.id);
    return false;
  });
  return {
    estado: { ...state, members, views, spaces, folders, lists, tasks, forms, activity, approvals, files, chatSessions, chatFolders, agentExecutions, automationExecutions, agents, automations, documents, collections, skills, skillGrants, collectionGrants },
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
 * R3 — o Arquivo que nenhuma Tarefa carrega (removido de uma Tarefa, ou o de um
 * envio público ainda não convertido). Com conteúdo real, é de quem o criou e
 * de quem administra o Espaço; o `legado/*` não tem o que baixar e segue aberto.
 */
function arquivoOrfaoVisivel(state: DataState, memberId: Id, arquivo: WorkspaceFile): boolean {
  if (arquivoSemConteudo(arquivo)) return true;
  if (arquivo.createdBy.kind === "member" && arquivo.createdBy.id === memberId) return true;
  return administraOEspaco(state, memberId);
}

/**
 * Quem vê alguma Tarefa que carrega o Arquivo o baixa. Um Arquivo que nenhuma
 * Tarefa carrega só é visto por quem o criou e por quem administra o Espaço de
 * Trabalho (R3) — deixou de ser "aberto a quem tem sessão". O Arquivo
 * `legado/*` (sem conteúdo) segue como antes.
 */
export function membroVeArquivo(state: DataState, memberId: Id, fileId: Id): boolean {
  const arquivo = state.files.find((f) => f.id === fileId);
  if (!arquivo) return false;
  const tarefas = tarefasComOArquivo(state, fileId);
  if (tarefas.length === 0) return arquivoOrfaoVisivel(state, memberId, arquivo);
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

/**
 * F1 (1.1.5) — o diff de uma gravação passa pela MESMA regra do estado: o que
 * saiu de `ocultos` não entra pela porta de trás, e cada registro gravado vai
 * por `recortarRegistro` (segredo de link, Memória de outro Membro, e-mail de
 * convite). A rota soma `diferenca` e `value` ao corpo, e os dois saíam inteiros.
 * `ocultos` é opcional para a rota não calcular `visibilidadePara` duas vezes;
 * `state` é o estado INTEIRO, depois da gravação. A ordem dos que ficam é a de
 * entrada.
 */
export function recortarDiferenca(diferenca: Diferenca, state: DataState, memberId: Id, ocultos?: ReadonlySet<Id>): Diferenca {
  const o = ocultos ?? visibilidadePara(state, memberId).ocultos;
  return {
    gravados: diferenca.gravados
      .filter((g) => !o.has(g.id))
      .map((g) => ({ ...g, dados: recortarRegistro(g.colecao, g.dados, state, memberId) })),
    removidos: diferenca.removidos.filter((r) => !o.has(r.id)),
  };
}

/** Quatro níveis de array/objeto: o `value` de uma operação é uma entidade, uma lista ou um objeto com entidades dentro. */
const PROFUNDIDADE_MAXIMA_DO_VALOR = 4;

const objetoSimples = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * F1 (1.1.5) — o `value` que uma operação devolve (a Tarefa inteira, por
 * exemplo) passa pelo mesmo recorte do estado. Reconhece Membro, Tarefa e
 * Formulário pelo id no estado inteiro, em qualquer lugar de arrays e de
 * objetos simples até quatro níveis; troca por `null` o que está em `ocultos`;
 * o resto volta como veio. Nunca muta a entrada.
 */
export function recortarValor(valor: unknown, state: DataState, memberId: Id, ocultos?: ReadonlySet<Id>): unknown {
  const o = ocultos ?? visibilidadePara(state, memberId).ocultos;
  const andar = (v: unknown, nivel: number): unknown => {
    if (nivel > PROFUNDIDADE_MAXIMA_DO_VALOR) return v;
    if (Array.isArray(v)) {
      const itens = v.map((item) => andar(item, nivel + 1));
      return itens.every((item, i) => item === v[i]) ? v : itens;
    }
    if (!objetoSimples(v)) return v;
    const id = v["id"];
    if (typeof id === "string") {
      if (o.has(id)) return null;
      if (state.members.some((m) => m.id === id)) return recortarRegistro("members", v, state, memberId);
      if (state.tasks.some((t) => t.id === id)) return recortarRegistro("tasks", v, state, memberId);
      if (state.forms.some((f) => f.id === id)) return recortarRegistro("forms", v, state, memberId);
    }
    let mudou = false;
    const copia: Record<string, unknown> = {};
    for (const [chave, filho] of Object.entries(v)) {
      const novo = andar(filho, nivel + 1);
      if (novo !== filho) mudou = true;
      copia[chave] = novo;
    }
    return mudou ? copia : v;
  };
  return andar(valor, 0);
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
