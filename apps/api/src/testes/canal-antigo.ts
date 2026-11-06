/**
 * O Canal de WhatsApp do CRM antigo (`chn_wpp`, "Comercial SP") como o seed o criava antes do 15-31 (D-15-13).
 *
 * O seed não cria mais Canal, mas dois testes de ponte (A projeção dos Canais da tabela ao lado do Canal antigo de
 * `registros`, e a conferência dos Canais da Lista) precisam de UM Canal antigo em `plataforma.registros`. Este módulo
 * o dá, em memória, sem ler o `.env` nem tocar banco. Sai junto com a ponte (15-33).
 */

import type { Channel } from "@n1/dominio";

export function canalAntigoDeTeste(workspaceId: string): Channel {
  return {
    id: "chn_wpp",
    workspaceId,
    createdBy: { kind: "member", id: "mem_thiago" },
    createdAt: new Date().toISOString(),
    lifecycle: "ativo",
    name: "Comercial SP",
    channelType: "whatsapp",
    externalId: "+5511987654321",
    connection: "conectada",
    configuredByMemberId: "mem_thiago",
    defaultQueueId: "fila_com",
    messageTemplates: [],
    groupsEnabled: false,
  };
}
