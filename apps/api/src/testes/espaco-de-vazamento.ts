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
 * 09-07 acrescenta Memória, convite, Visão pessoal, link público e arquivo
 * órfão; 09-12 acrescenta Convidado, Administrador, Suspenso e um segundo Espaço.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AgentExecution, ChatFolder, ChatSession, DataState, Member } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { limparEspaco, novoEspacoDeTeste } from "./banco-crm";

/** O token de cada Membro da fábrica; qualquer outro token é recusado (`null`). */
export const TOKENS_DE_VAZAMENTO = { a: "token-a", b: "token-b", proprietario: "token-proprietario" } as const;

/** Os ids do que é PRIVADO de um Membro: a Sessão de Chat, a pasta e a Execução da conversa. */
export interface IdsPrivados {
  readonly sessao: string;
  readonly pasta: string;
  readonly execucao: string;
}

export interface EspacoDeVazamento {
  readonly workspaceId: string;
  readonly estado: DataState;
  readonly membros: { readonly a: Member; readonly b: Member; readonly proprietario: Member };
  /** As frases únicas de cada um: mensagem, entrada e saída da Execução. */
  readonly frases: { readonly a: readonly string[]; readonly b: readonly string[] };
  readonly ids: { readonly a: IdsPrivados; readonly b: IdsPrivados };
}

const curto = () => randomUUID().slice(0, 8);

interface Privado {
  readonly ids: IdsPrivados;
  readonly frases: readonly string[];
  readonly pasta: ChatFolder;
  readonly sessao: ChatSession;
  readonly execucao: AgentExecution;
}

function privadoDe(estado: DataState, membro: Member, letra: "a" | "b"): Privado {
  const agora = new Date().toISOString();
  const rotulo = letra.toUpperCase();
  const unico = randomUUID();
  const mensagem = `FRASE-PRIVADA-${rotulo}-MENSAGEM-${unico}`;
  const entrada = `FRASE-PRIVADA-${rotulo}-ENTRADA-${unico}`;
  const saida = `FRASE-PRIVADA-${rotulo}-SAIDA-${unico}`;
  const ids: IdsPrivados = {
    sessao: `chs_vaz_${letra}_${curto()}`,
    pasta: `chf_vaz_${letra}_${curto()}`,
    execucao: `exe_vaz_${letra}_${curto()}`,
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
  return { ids, frases: [mensagem, entrada, saida], pasta, sessao, execucao };
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

  const privadoA = privadoDe(estado, a, "a");
  const privadoB = privadoDe(estado, b, "b");
  for (const p of [privadoA, privadoB]) {
    estado.chatFolders.push(p.pasta);
    estado.chatSessions.push(p.sessao);
    estado.agentExecutions.push(p.execucao);
  }
  return {
    workspaceId: novoEspacoDeTeste(rotulo),
    estado,
    membros: { a, b, proprietario },
    frases: { a: privadoA.frases, b: privadoB.frases },
    ids: { a: privadoA.ids, b: privadoB.ids },
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

/** O app Fastify do Espaço, com a autenticação trocada por uma tabela de tokens (sem rede, sem Supabase). */
export function appDoEspaco(espaco: EspacoDeVazamento): FastifyInstance {
  const usuarios: Record<string, string | undefined> = {
    [TOKENS_DE_VAZAMENTO.a]: espaco.membros.a.userId,
    [TOKENS_DE_VAZAMENTO.b]: espaco.membros.b.userId,
    [TOKENS_DE_VAZAMENTO.proprietario]: espaco.membros.proprietario.userId,
  };
  return buildApp({
    logger: false,
    workspaceId: espaco.workspaceId,
    verificarToken: async (token) => {
      const sub = usuarios[token];
      return sub ? { sub } : null;
    },
    resolverMembro: async (_workspaceId, userId) => espaco.estado.members.find((m) => m.userId === userId),
  });
}
