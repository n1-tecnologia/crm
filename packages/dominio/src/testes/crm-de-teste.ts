/**
 * Massa mínima para testar o que ainda manda Mensagem pelo modelo antigo de Conversa (Grupo, Flow e
 * Automação, F14-D-05) sem o CRM antigo semeado (15-42, 3.5.4): o Canal e o Contato vêm do CRM novo,
 * na forma em que o servidor os leria das tabelas (`CrmDasFerramentas`), e só a Conversa mora em
 * `state.conversations`. Nada aqui toca as coleções do CRM antigo do estado: é o que deixa o
 * `DataState` encolher no 15-43 sem este arquivo quebrar o `tsc`.
 */

import type { Canal } from "../crm/canais";
import type { ContatoDaFerramenta, Conversation, CrmDasFerramentas, Id, Message } from "../types";

/** Um Canal de WhatsApp oficial, ativo e conectado, como a tabela `plataforma.canais` o devolve. */
export function canalDeTeste(parcial: Partial<Canal> & Pick<Canal, "id">): Canal {
  return {
    nome: "Comercial SP",
    tipo: "whatsapp",
    provedor: "whatsapp-cloud",
    identificadorExterno: "+5511900000001",
    conexao: "conectada",
    conexaoSimulada: false,
    conectadaEm: null,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_thiago",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: true,
    criadoPor: "mem_thiago",
    criadoEm: "2026-01-01T09:00:00.000Z",
    atualizadoEm: "2026-01-01T09:00:00.000Z",
    ...parcial,
  };
}

/** Um Contato como as Ferramentas o enxergam (`plataforma.contatos`): id, nome, estado e WhatsApp. */
export function contatoDeTeste(id: Id, nome: string, whatsapp: string | null = "+5511988880001", estado = "ativo"): ContatoDaFerramenta {
  return { id, nome, estado, whatsapp };
}

/** O CRM das Ferramentas montado das peças dadas. */
export function crmDeTeste(canais: Canal[], contatos: ContatoDaFerramenta[]): CrmDasFerramentas {
  return { canais, contatos };
}

export type Recebimento = readonly [direcao: Message["direction"], criadoEm: string];

/** Uma Conversa 1:1 ativa do Contato no Canal, com Mensagens nas direções e instantes dados. */
export function conversaDeTeste(id: Id, canalId: Id, contatoId: Id, mensagens: readonly Recebimento[] = []): Conversation {
  return {
    id,
    workspaceId: "ws_n1",
    createdBy: { kind: "member", id: "mem_thiago" },
    createdAt: "2026-01-01T09:00:00.000Z",
    lifecycle: "ativo",
    channelId: canalId,
    contactId: contatoId,
    state: "aberta",
    title: "Conversa de teste",
    titleEdited: false,
    drafts: [],
    starredBy: [],
    tagIds: [],
    fieldValues: [],
    participants: [],
    messages: mensagens.map(([direction, createdAt], i) => ({
      id: `${id}_m${i}`,
      conversationId: id,
      direction,
      actor: direction === "recebida" ? { kind: "integration" as const, id: canalId } : { kind: "member" as const, id: "mem_thiago" },
      content: `mensagem ${i}`,
      attachments: [],
      internalReads: [],
      reactions: [],
      externalEdits: [],
      createdAt,
    })),
    reopenCount: 0,
  };
}
