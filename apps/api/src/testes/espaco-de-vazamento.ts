/**
 * A fábrica do teste de vazamento da Fase 9 (SEG-01): um Espaço de Trabalho com
 * DOIS Membros reais, A e B, cada um com uma Sessão de Chat, uma pasta de chat e
 * uma Execução de agente cheias de TEXTO ÚNICO. O teste procura esse texto no
 * corpo inteiro da resposta de `GET /estado` do outro — não só os ids: o
 * conteúdo da conversa é o que não pode sair (D-01, D-22).
 *
 * SÓ TESTES. Os testes que usam esta fábrica rodam com `describeComBanco`
 * (Postgres local, `localhost`/`127.0.0.1`); nada é semeado no Supabase do `.env`.
 *
 * 09-07 acrescentou Memória de Usuário, Visão pessoal, um convite pendente, o
 * segredo de uma Tarefa com link público e o de um Formulário (numa Lista que B
 * alcança sem administrar), um Campo que B grava e um Arquivo órfão de A; 09-12
 * acrescenta o Convidado e o Administrador (a matriz Papel × rota de 09-12); 09-15
 * acrescenta o SEGUNDO Espaço (`montarSegundoEspaco`), sem nenhum Usuário em comum
 * com o primeiro, para provar que um Espaço não enxerga o outro.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AgentExecution, ChatFolder, ChatSession, DataState, Form, Id, Member, View, WorkspaceFile } from "@n1/dominio";
import { containerAdminRefusal, memberReachesContainer } from "@n1/dominio/derive";
import { setTaskFieldValue } from "@n1/dominio/operations/tasks";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp, type OpcoesDoApp } from "../app";
import { pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { limparEspaco, novoEspacoDeTeste } from "./banco-crm";

/** O token de cada Membro da fábrica; qualquer outro token é recusado (`null`). */
export const TOKENS_DE_VAZAMENTO = {
  a: "token-a",
  b: "token-b",
  proprietario: "token-proprietario",
  suspenso: "token-suspenso",
  convidado: "token-convidado",
  administrador: "token-administrador",
} as const;

/** Os ids do que é PRIVADO de um Membro: a Sessão de Chat, a pasta, a Execução da conversa e a Visão pessoal. */
export interface IdsPrivados {
  readonly sessao: string;
  readonly pasta: string;
  readonly execucao: string;
  readonly visao: string;
}

/** O convite pendente: o e-mail é dado pessoal que só quem administra o Espaço lê (1.1.2). */
export interface ConviteDeVazamento {
  readonly id: string;
  readonly email: string;
}

/**
 * Os segredos que moram numa Lista que B alcança SEM administrar (1.1.3):
 * o do link público da Tarefa `tarefaComLink`, o do Formulário, e o Campo
 * (`campoGravavelPorB`) que B grava nessa Tarefa — o caminho de `POST /operacoes`.
 */
export interface SegredosDeVazamento {
  readonly link: string;
  readonly formulario: string;
  readonly tarefaComLink: string;
  readonly campoGravavelPorB: string;
}

export interface EspacoDeVazamento {
  readonly workspaceId: string;
  readonly estado: DataState;
  /**
   * `suspenso` é um Membro do seed de Papel base `membro`, marcado `suspenso` no estado da fábrica: consulta, mas
   * não grava (1.2.1). `convidado` e `administrador` são Membros ativos do seed de cada Papel base (09-12).
   */
  readonly membros: {
    readonly a: Member;
    readonly b: Member;
    readonly proprietario: Member;
    readonly suspenso: Member;
    readonly convidado: Member;
    readonly administrador: Member;
  };
  /** As frases únicas de cada um: mensagem, entrada e saída da Execução, e o item de Memória de Usuário. */
  readonly frases: { readonly a: readonly string[]; readonly b: readonly string[] };
  readonly ids: { readonly a: IdsPrivados; readonly b: IdsPrivados };
  readonly convite: ConviteDeVazamento;
  readonly segredos: SegredosDeVazamento;
  /** Um Arquivo com conteúdo real que A criou e que nenhuma Tarefa carrega (o efeito de `removeAttachment`). */
  readonly arquivoOrfao: string;
}

const curto = () => randomUUID().slice(0, 8);

interface Privado {
  readonly ids: IdsPrivados;
  readonly frases: readonly string[];
  readonly pasta: ChatFolder;
  readonly sessao: ChatSession;
  readonly execucao: AgentExecution;
  readonly visao: View;
}

function privadoDe(estado: DataState, membro: Member, letra: "a" | "b", listaDaVisao: Id): Privado {
  const agora = new Date().toISOString();
  const rotulo = letra.toUpperCase();
  const unico = randomUUID();
  const mensagem = `FRASE-PRIVADA-${rotulo}-MENSAGEM-${unico}`;
  const entrada = `FRASE-PRIVADA-${rotulo}-ENTRADA-${unico}`;
  const saida = `FRASE-PRIVADA-${rotulo}-SAIDA-${unico}`;
  const memoria = `FRASE-PRIVADA-${rotulo}-MEMORIA-${unico}`;
  const ids: IdsPrivados = {
    sessao: `chs_vaz_${letra}_${curto()}`,
    pasta: `chf_vaz_${letra}_${curto()}`,
    execucao: `exe_vaz_${letra}_${curto()}`,
    visao: `viw_vaz_${letra}_${curto()}`,
  };
  const ator = { kind: "member", id: membro.id } as const;

  const pasta: ChatFolder = {
    id: ids.pasta,
    workspaceId: estado.workspace.id,
    ownerMemberId: membro.id,
    name: `Pasta privada ${rotulo}`,
    createdAt: agora,
  };
  const execucao: AgentExecution = {
    id: ids.execucao,
    workspaceId: estado.workspace.id,
    agentId: estado.workspace.defaultAgentId,
    agentVersion: 1,
    state: "concluida",
    origin: "sessaoDeChat",
    invokedBy: ator,
    delegate: ator,
    chain: { depth: 0, visitedAgentIds: [], visitedAutomationObjects: [] },
    chatSessionId: ids.sessao,
    modelId: "mdl_base",
    effectiveAutonomy: "supervisionado",
    rehearsal: false,
    input: entrada,
    steps: [],
    output: saida,
    contextComposition: { readRecordIds: [], fragmentRefs: [], memoryItemIds: [], chatMessageIds: [`cmg_vaz_${letra}_1`] },
    knowledgeReferences: [],
    cost: { modelUnits: 1, toolCalls: 0, childExecutions: 0, durationMs: 1 },
    startedAt: agora,
    endedAt: agora,
  };
  const sessao: ChatSession = {
    id: ids.sessao,
    workspaceId: estado.workspace.id,
    createdBy: ator,
    createdAt: agora,
    lifecycle: "ativo",
    ownerMemberId: membro.id,
    folderId: ids.pasta,
    title: `Sessão privada ${rotulo}`,
    titleEdited: false,
    toolRestriction: { toolIds: [], effectClasses: [] },
    messages: [
      {
        id: `cmg_vaz_${letra}_1`,
        order: 0,
        role: "usuario",
        author: ator,
        content: mensagem,
        fileIds: [],
        knowledgeReferences: [],
        at: agora,
      },
    ],
    sharedWithMemberIds: [],
    sharedWithTeamIds: [],
  };
  // 1.1.2 — a Memória de Usuário é do Membro (D-01): o item mora no próprio registro dele.
  membro.userMemory.items.push({
    id: `umi_vaz_${letra}_${curto()}`,
    content: memoria,
    origin: { kind: "membro" },
    createdAt: agora,
    state: "ativo",
  });
  // 1.1.2 — a Visão pessoal (`ownerKind: "member"`) é de quem a salvou; a Lista é uma que os dois alcançam.
  const visao: View = {
    id: ids.visao,
    name: `Visão pessoal ${rotulo}`,
    kind: "lista",
    ownerKind: "member",
    ownerId: membro.id,
    listId: listaDaVisao,
    filters: {},
    isDefault: false,
    createdBy: membro.id,
    createdAt: agora,
  };
  return { ids, frases: [mensagem, entrada, saida, memoria], pasta, sessao, execucao, visao };
}

/**
 * A Lista que B alcança SEM administrar (e A também alcança), com uma Tarefa
 * ativa e um Campo numérico que B grava. Confere com as próprias funções do
 * domínio, num clone do estado: se o seed mudar e não oferecer, o erro diz o quê.
 */
function listaDoSegredo(estado: DataState, a: Member, b: Member): { readonly listId: Id; readonly taskId: Id; readonly fieldId: Id } {
  for (const lista of estado.lists) {
    if (!memberReachesContainer(estado, a.id, "list", lista.id)) continue;
    if (!memberReachesContainer(estado, b.id, "list", lista.id)) continue;
    if (containerAdminRefusal(estado, b.id, "list", lista.id) === undefined) continue;
    for (const tarefa of estado.tasks.filter((t) => t.listId === lista.id)) {
      for (const campo of estado.fieldDefinitions.filter((d) => d.target === "task" && d.type === "number")) {
        const teste = setTaskFieldValue(structuredClone(estado), b.id, tarefa.id, campo.id, 7);
        if (teste.ok) return { listId: lista.id, taskId: tarefa.id, fieldId: campo.id };
      }
    }
  }
  throw new Error("o seed precisa de uma Lista que B alcança sem administrar, com uma Tarefa ativa e um Campo numérico que B grave");
}

/** Monta o estado em memória; ainda não grava nada no banco. */
export function montarEspacoDeVazamento(rotulo: string): EspacoDeVazamento {
  const estado = buildSeed();
  const baseDoPapel = (membro: Member) => estado.roles.find((r) => r.id === membro.roleId)?.base;
  const candidatos = estado.members.filter((m) => m.state === "ativo" && m.userId !== undefined && baseDoPapel(m) === "membro");
  const [a, b] = candidatos;
  if (!a || !b) throw new Error("o seed precisa de dois Membros ativos, com usuário, de Papel base membro");
  const proprietario = estado.members.find((m) => m.id === estado.workspace.ownerMemberId);
  if (!proprietario?.userId) throw new Error("o seed precisa de um Proprietário com usuário");
  const papelMembro = estado.roles.find((r) => r.base === "membro");
  if (!papelMembro) throw new Error("o seed precisa de um Papel de base membro");
  // 09-12 — um Convidado e um Administrador ativos, com usuário, de Papéis base `convidado` e `administrador`.
  const convidado = estado.members.find((m) => m.state === "ativo" && m.userId !== undefined && baseDoPapel(m) === "convidado");
  if (!convidado) throw new Error("o seed precisa de um Membro ativo, com usuário, de Papel base convidado");
  const administrador = estado.members.find((m) => m.state === "ativo" && m.userId !== undefined && baseDoPapel(m) === "administrador");
  if (!administrador) throw new Error("o seed precisa de um Membro ativo, com usuário, de Papel base administrador");
  // 1.2.1 — um Membro ativo de Papel base `membro`, com usuário, diferente de A e B, que a fábrica marca `suspenso`.
  // Não é o Convidado nem o Administrador: a matriz precisa dos quatro estados ao mesmo tempo.
  const suspenso = estado.members.find((m) => m.state === "ativo" && m.userId !== undefined && baseDoPapel(m) === "membro" && ![a.id, b.id].includes(m.id));
  if (!suspenso) throw new Error("o seed precisa de um terceiro Membro ativo, com usuário, de Papel base membro, para ser o suspenso");
  suspenso.state = "suspenso";

  const alvo = listaDoSegredo(estado, a, b);
  const agora = new Date().toISOString();
  const ator = { kind: "member", id: proprietario.id } as const;

  const privadoA = privadoDe(estado, a, "a", alvo.listId);
  const privadoB = privadoDe(estado, b, "b", alvo.listId);
  for (const p of [privadoA, privadoB]) {
    estado.chatFolders.push(p.pasta);
    estado.chatSessions.push(p.sessao);
    estado.agentExecutions.push(p.execucao);
    estado.views.push(p.visao);
  }

  // 1.1.2 — um convite pendente: o e-mail está em `invitedIdentity` e também em `displayName`.
  const convite: ConviteDeVazamento = { id: `mem_vaz_convite_${curto()}`, email: `convite-${randomUUID()}@exemplo.com` };
  estado.members.push({
    id: convite.id,
    workspaceId: estado.workspace.id,
    invitedIdentity: { type: "email", value: convite.email },
    displayName: convite.email,
    state: "pendente",
    roleId: papelMembro.id,
    invitedBy: proprietario.id,
    availability: { value: "indisponivel", at: agora, origin: "membro" },
    userMemory: { enabled: true, items: [] },
  });

  // 1.1.3 — o segredo do link público de uma Tarefa e o de um Formulário, na Lista que B alcança sem administrar.
  const segredoDoLink = `SEGREDO-LINK-${randomUUID()}`;
  const segredoDoFormulario = `SEGREDO-FORM-${randomUUID()}`;
  const tarefa = estado.tasks.find((t) => t.id === alvo.taskId);
  if (!tarefa) throw new Error("a Tarefa do segredo sumiu do estado");
  tarefa.publicShare = { secret: segredoDoLink, active: true, createdBy: proprietario.id, createdAt: agora, showsComments: false, showsAttachments: false };
  const formulario: Form = {
    id: `frm_vaz_${curto()}`,
    workspaceId: estado.workspace.id,
    createdBy: ator,
    createdAt: agora,
    lifecycle: "ativo",
    listId: alvo.listId,
    name: "Formulário do vazamento",
    ownerMemberId: proprietario.id,
    questions: [{ id: `fqs_vaz_${curto()}`, label: "Assunto", required: true, target: { kind: "title" } }],
    enabled: true,
    secret: segredoDoFormulario,
    submissions: 0,
  };
  estado.forms.push(formulario);

  // R3 — um Arquivo com conteúdo real que A criou e que nenhuma Tarefa carrega.
  const arquivo: WorkspaceFile = {
    id: `wf_vaz_${curto()}`,
    workspaceId: estado.workspace.id,
    name: "orfao-de-a.pdf",
    mediaType: "document",
    sizeBytes: 10,
    createdBy: { kind: "member", id: a.id },
    createdAt: agora,
    objectKey: `privado/teste/vaz_${curto()}.pdf`,
    state: "enviado",
  };
  estado.files.push(arquivo);

  return {
    workspaceId: novoEspacoDeTeste(rotulo),
    estado,
    membros: { a, b, proprietario, suspenso, convidado, administrador },
    frases: { a: privadoA.frases, b: privadoB.frases },
    ids: { a: privadoA.ids, b: privadoB.ids },
    convite,
    segredos: { link: segredoDoLink, formulario: segredoDoFormulario, tarefaComLink: alvo.taskId, campoGravavelPorB: alvo.fieldId },
    arquivoOrfao: arquivo.id,
  };
}

/** Grava o estado da fábrica no Postgres local (o Espaço de Trabalho de `espaco.workspaceId`). */
export async function semearEspacoDeVazamento(espaco: EspacoDeVazamento): Promise<void> {
  const cliente = await pool().connect();
  try {
    await semear(cliente, espaco.workspaceId, espaco.estado);
  } finally {
    cliente.release();
  }
}

/** Apaga o que a fábrica gravou (e o que mais o Espaço de teste tiver criado). */
export async function limparEspacoDeVazamento(espaco: EspacoDeVazamento): Promise<void> {
  await limparEspaco(espaco.workspaceId);
}

/**
 * O app Fastify do Espaço, com a autenticação trocada por uma tabela de tokens (sem rede, sem Supabase).
 * `extras` entra por cima (por exemplo `financeiro` com um cliente falso); a autenticação e o Espaço não se trocam.
 */
export function appDoEspaco(espaco: EspacoDeVazamento, extras: Omit<OpcoesDoApp, "workspaceId" | "verificarToken" | "resolverMembro"> = {}): FastifyInstance {
  const usuarios: Record<string, string | undefined> = {
    [TOKENS_DE_VAZAMENTO.a]: espaco.membros.a.userId,
    [TOKENS_DE_VAZAMENTO.b]: espaco.membros.b.userId,
    [TOKENS_DE_VAZAMENTO.proprietario]: espaco.membros.proprietario.userId,
    [TOKENS_DE_VAZAMENTO.suspenso]: espaco.membros.suspenso.userId,
    [TOKENS_DE_VAZAMENTO.convidado]: espaco.membros.convidado.userId,
    [TOKENS_DE_VAZAMENTO.administrador]: espaco.membros.administrador.userId,
  };
  return buildApp({
    logger: false,
    ...extras,
    workspaceId: espaco.workspaceId,
    verificarToken: async (token) => {
      const sub = usuarios[token];
      return sub ? { sub } : null;
    },
    resolverMembro: async (_workspaceId, userId) => espaco.estado.members.find((m) => m.userId === userId),
  });
}

/** O segundo Espaço de Trabalho: nenhum Usuário em comum com o primeiro, uma frase única e um Contato do CRM novo. */
export interface SegundoEspaco {
  readonly workspaceId: string;
  readonly estado: DataState;
  /** As frases únicas do segundo Espaço (numa Sessão de Chat e numa Tarefa): nunca podem aparecer no primeiro. */
  readonly frases: readonly string[];
  /** O `userId` de um Membro que só existe no segundo Espaço. */
  readonly usuarioSoDoSegundo: string;
  /** O Contato semeado em `plataforma.contatos` com o `workspace_id` do segundo Espaço. */
  readonly contatoId: string;
}

/**
 * Monta o estado do segundo Espaço em memória. Parte de `buildSeed()`, troca o `userId` de TODO Membro por
 * `usr_ws2_<8 caracteres>` (nenhum Usuário em comum com o primeiro Espaço) e põe uma frase única numa Sessão de Chat e
 * numa Tarefa. O Contato do CRM novo só é gravado em `semearSegundoEspaco`.
 */
export function montarSegundoEspaco(rotulo: string): SegundoEspaco {
  const estado = buildSeed();
  const agora = new Date().toISOString();
  for (const membro of estado.members) {
    if (membro.userId !== undefined) membro.userId = `usr_ws2_${curto()}`;
  }
  const dono = estado.members.find((m) => m.id === estado.workspace.ownerMemberId);
  if (!dono?.userId) throw new Error("o seed precisa de um Proprietário com usuário");

  const frase = `FRASE-OUTRO-ESPACO-${randomUUID()}`;
  const ator = { kind: "member", id: dono.id } as const;
  estado.chatSessions.push({
    id: `chs_ws2_${curto()}`,
    workspaceId: estado.workspace.id,
    createdBy: ator,
    createdAt: agora,
    lifecycle: "ativo",
    ownerMemberId: dono.id,
    title: `Sessão do segundo Espaço`,
    titleEdited: false,
    toolRestriction: { toolIds: [], effectClasses: [] },
    messages: [{ id: `cmg_ws2_${curto()}`, order: 0, role: "usuario", author: ator, content: frase, fileIds: [], knowledgeReferences: [], at: agora }],
    sharedWithMemberIds: [],
    sharedWithTeamIds: [],
  });
  const tarefa = estado.tasks.find((t) => t.lifecycle === "ativo");
  if (!tarefa) throw new Error("o seed precisa de uma Tarefa ativa");
  tarefa.title = `Tarefa do segundo Espaço ${frase}`;

  return { workspaceId: novoEspacoDeTeste(rotulo), estado, frases: [frase], usuarioSoDoSegundo: dono.userId, contatoId: randomUUID() };
}

/** Grava o segundo Espaço no Postgres local: o estado em `registros` e o Contato em `plataforma.contatos`. */
export async function semearSegundoEspaco(segundo: SegundoEspaco): Promise<void> {
  const cliente = await pool().connect();
  try {
    await semear(cliente, segundo.workspaceId, segundo.estado);
    await cliente.query(
      `insert into plataforma.contatos (id, workspace_id, nome, proprietario_id, criado_por)
       values ($1, $2, $3, $4, $4)`,
      [segundo.contatoId, segundo.workspaceId, `Contato do segundo Espaço ${segundo.frases[0]}`, segundo.estado.workspace.ownerMemberId],
    );
  } finally {
    cliente.release();
  }
}

/** Apaga o segundo Espaço: o Contato, os registros e o workspace (`limparEspaco` cobre as tabelas do CRM). */
export async function limparSegundoEspaco(segundo: SegundoEspaco): Promise<void> {
  await limparEspaco(segundo.workspaceId);
}
