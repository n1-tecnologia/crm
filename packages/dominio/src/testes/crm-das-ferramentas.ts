/**
 * O CRM das Ferramentas (Grupo, Comunidade, Flow) para os testes (15-42): o Canal e os Contatos como o servidor os
 * leria de `plataforma.canais` e `plataforma.contatos` (`CrmDasFerramentas`), e as Conversas 1:1 do WhatsApp que o
 * Flow e o link de convite usam, que ainda moram no estado (F14-D-05). É o recorte do CRM antigo de demonstração que
 * os testes de Ferramentas precisam, montado à mão: o construtor do CRM antigo de demonstração não é mais necessário (sai no 15-43). Nada
 * aqui toca as coleções do CRM antigo do estado.
 */

import { nextId } from "../operations/activity";
import { FLOW_TRIAGEM_ID } from "../seed-ferramentas";
import type { DataState } from "../state";
import type { ContatoDaFerramenta, Conversation, CrmDasFerramentas, Message } from "../types";
import { canalDeTeste, conversaDeTeste } from "./crm-de-teste";

/** [id, nome, WhatsApp, estado]: os Contatos do demo que os Grupos e Flows do seed referenciam. */
const CONTATOS: ReadonlyArray<readonly [string, string, string | null, string]> = [
  ["cnt_1", "Ana Ribeiro", "5511970000000", "ativo"],
  ["cnt_2", "Marina Alves", "5511970001237", "ativo"],
  ["cnt_3", "Paulo Cardoso", "5511970002474", "ativo"],
  ["cnt_4", "Renata Moreira", "5511970003711", "ativo"],
  ["cnt_5", "Diego Barbosa", "5511970004948", "ativo"],
  ["cnt_6", "Fernanda Rocha", "5511970006185", "ativo"],
  ["cnt_7", "Bruno Teixeira", "5511970007422", "ativo"],
  ["cnt_8", "Carla Dias", "5511970008659", "ativo"],
  ["cnt_9", "Eduardo Correia", "5511970009896", "ativo"],
  ["cnt_10", "Patrícia Freitas", "5511970011133", "ativo"],
  ["cnt_11", "Lucas Pinto", "5511970012370", "ativo"],
  ["cnt_12", "Juliana Araújo", "5511970013607", "ativo"],
  ["cnt_13", "Roberto Monteiro", "5511970014844", "ativo"],
  ["cnt_14", "Sandra Melo", "5511970016081", "ativo"],
  ["cnt_15", "Thiago Cunha", "5511970017318", "ativo"],
  ["cnt_16", "Vanessa Farias", "5511970018555", "ativo"],
  ["cnt_17", "Gustavo Batista", "5511970019792", "ativo"],
  ["cnt_18", "Bianca Nogueira", "5511970021029", "ativo"],
  ["cnt_19", "Rodrigo Peixoto", "5511970022266", "ativo"],
  ["cnt_20", "Letícia Xavier", "5511970023503", "ativo"],
  ["cnt_21", "André Aguiar", "5511970024740", "na_lixeira"],
  ["cnt_22", "Priscila Brandão", "5511970025977", "ativo"],
  ["cnt_23", "Felipe Coelho", "5511970027214", "ativo"],
  ["cnt_24", "Camila Fonseca", "5511970028451", "ativo"],
  ["cnt_25", "Marcelo Guimarães", "5511970029688", "ativo"],
  ["cnt_26", "Aline Leal", "5511970030925", "ativo"],
  ["cnt_27", "Vinícius Macedo", "5511970032162", "ativo"],
  ["cnt_28", "Débora Nunes", "5511970033399", "ativo"],
  ["cnt_29", "Otávio Prado", "5511970034636", "ativo"],
  ["cnt_30", "Natália Quirino", "5511970035873", "ativo"],
  ["cnt_31", "Sérgio", "5511988887777", "ativo"],
  ["cnt_35", "Iallas", "5511993451188", "ativo"],
];

/** Os Canais do demo: o WhatsApp do Comercial (com Grupos), o Instagram desconectado e o e-mail. */
export function canaisDasFerramentas() {
  return [
    canalDeTeste({ id: "chn_wpp", nome: "Comercial SP", identificadorExterno: "+5511987654321", filaPadraoId: "fila_com", gruposHabilitados: true, criadoEm: "2025-11-21T09:00:00.000Z" }),
    canalDeTeste({ id: "chn_insta", nome: "@institutoigoralves", tipo: "instagram", provedor: "instagram-graph", identificadorExterno: "institutoigoralves", conexao: "desconectada", gruposHabilitados: false }),
    canalDeTeste({ id: "chn_mail", nome: "contato@institutoigoralves.com.br", tipo: "email", provedor: "email-imap-smtp", identificadorExterno: "contato@institutoigoralves.com.br", gruposHabilitados: false }),
  ];
}

export function contatosDasFerramentas(): ContatoDaFerramenta[] {
  return CONTATOS.map(([id, nome, whatsapp, estado]) => ({ id, nome, estado, whatsapp }));
}

/** O que o servidor leria das tabelas para as operações de Grupo, Comunidade e Flow. */
export function crmDasFerramentas(): CrmDasFerramentas {
  return { canais: canaisDasFerramentas(), contatos: contatosDasFerramentas() };
}

const MARCA = (dias: number, hora: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString();
};

/**
 * As Conversas 1:1 do WhatsApp que as Ferramentas usam e os Envios de Flow (1 por Conversa; 3 respondidos): cnv_5, cnv_9
 * e cnv_13 abertas e respondidas, cnv_17 resolvida e sem resposta, mais cnv_1 e cnv_sdr_1 (abertas, sem Flow) e cnv_2,
 * a do Instagram. É o recorte do demo antigo que `metricasDoFlow`, `enviarFlow` e o link de convite leem.
 */
export function semearConversasDasFerramentas(estado: DataState): void {
  const flow = estado.flows.find((f) => f.id === FLOW_TRIAGEM_ID);
  const v1 = flow?.versoes.find((v) => v.numero === 1);
  if (!flow || !v1) throw new Error("o seed precisa do Flow de triagem com a v1");
  const agora = new Date().toISOString();
  const abertas = (id: string, contatoId: string): Conversation => conversaDeTeste(id, "chn_wpp", contatoId, [["recebida", agora]]);
  const cnv5 = abertas("cnv_5", "cnt_5");
  const cnv9 = abertas("cnv_9", "cnt_9");
  const cnv13 = abertas("cnv_13", "cnt_13");
  const cnv17 = conversaDeTeste("cnv_17", "chn_wpp", "cnt_17", [["recebida", MARCA(4, 10)]]);
  cnv17.state = "resolvida";
  cnv17.resolvedAt = MARCA(1, 17);
  const envio = (conversa: Conversation, quando: string, respondeu: { formacao: string; cidade: string } | undefined, quandoRespondeu: string): void => {
    const enviada: Message = {
      id: nextId("msg"),
      conversationId: conversa.id,
      direction: "enviada",
      actor: { kind: "member", id: "mem_julia" },
      content: "Antes de falarmos, me conta em 30 segundos sobre você? É só tocar em Abrir.",
      attachments: [{ fileId: flow.id, order: 0, mediaType: "flow", displayName: flow.nome }],
      deliveryStatus: "lida",
      internalReads: [],
      reactions: [],
      externalEdits: [],
      createdAt: quando,
      flow: { flowId: flow.id, versaoId: v1.id, numeroDaVersao: 1, flowNome: flow.nome, rotuloDoBotao: "Abrir", telaInicial: "perfil" },
    };
    conversa.messages.push(enviada);
    if (!respondeu) return;
    conversa.messages.push({
      id: nextId("msg"),
      conversationId: conversa.id,
      direction: "recebida",
      actor: { kind: "integration", id: "chn_wpp" },
      content: `Resposta ao Flow “${flow.nome}”: formacao: ${respondeu.formacao} · cidade: ${respondeu.cidade} · aceite: true`,
      attachments: [{ fileId: flow.id, order: 0, mediaType: "flow", displayName: flow.nome }],
      externalId: nextId("ext"),
      internalReads: [],
      reactions: [],
      externalEdits: [],
      createdAt: quandoRespondeu,
      respostaDeFlow: { flowId: flow.id, versaoId: v1.id, numeroDaVersao: 1, flowNome: flow.nome, identificadorDeRespostaDoProvedor: nextId("resp"), em: quandoRespondeu, valores: { ...respondeu, aceite: true }, telaDeConclusao: "confirmacao", mensagemDeOrigemId: enviada.id },
    });
  };
  envio(cnv5, MARCA(20, 10), { formacao: "dentista", cidade: "Campinas" }, MARCA(20, 11));
  envio(cnv9, MARCA(14, 15), { formacao: "biomedico", cidade: "Santo André" }, MARCA(13, 9));
  envio(cnv13, MARCA(6, 9), { formacao: "medico", cidade: "São Paulo" }, MARCA(6, 10));
  envio(cnv17, MARCA(1, 16), undefined, "");
  estado.conversations.push(
    cnv5,
    cnv9,
    cnv13,
    cnv17,
    abertas("cnv_1", "cnt_2"),
    abertas("cnv_sdr_1", "cnt_35"),
    conversaDeTeste("cnv_2", "chn_insta", "cnt_2", [["recebida", agora]]),
  );
}
