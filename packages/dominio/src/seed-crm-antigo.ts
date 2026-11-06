/**
 * O CRM antigo de demonstração, isolado (15-31, 3.5.3, UCR-11, D-15-13).
 *
 * Até o 15-30, `buildSeed()` construía Contatos, Empresas, Funis, Negócios, Canais e Conversas em
 * `state.contacts`, `state.deals` e afins, mais a Pasta "Meus negócios" com uma Lista por Funil. A partir
 * do 15-31 o seed nasce SEM isso: a demonstração do CRM é `npm run bootstrap:crm-demo` (15-29), que
 * carrega as mesmas linhas nas tabelas novas, com os mesmos ids.
 *
 * Este arquivo guarda o código que construía o CRM antigo, SEM mudar os dados, só para os testes de
 * código que um plano seguinte apaga ou reescreve (15-32, 15-33, 15-42): `semearCrmAntigo(buildSeed())`
 * devolve o estado como era antes do 15-31. NENHUM código de produção o chama (T-15-76), nenhum
 * `seed*.ts` o importa, e a guarda `sem-crm-antigo.test.ts` o lista como congelado. Ele sai no 15-43,
 * junto com o modelo antigo.
 *
 * Deve ser chamado UMA vez, sobre o estado que `buildSeed()` acabou de devolver (sem CRM antigo); muda o
 * estado no lugar e o devolve, para caber em `semearCrmAntigo(buildSeed())`.
 */

import { nextId, recordActivity } from "./operations/activity";
import { CR } from "./operations/financeiro";
import { MEUS_NEGOCIOS_ID } from "./seed-comercial";
import { FLOW_TRIAGEM_ID } from "./seed-ferramentas";
import type { DataState } from "./state";
import type {
  ActivityRecord,
  ActorRef,
  Channel,
  ChannelType,
  Company,
  Contact,
  ContactCompanyLink,
  ContactIdentifierType,
  Conversation,
  Deal,
  FieldValue,
  Funnel,
  Id,
  Message,
  StageTransition,
  StatusDefinition,
  Task,
} from "./types";

// A mesma base do seed: HOJE às 09:00 UTC (ver `seed.ts`).
const BASE = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 9);
const at = (daysAgo: number, hour = 9): string =>
  new Date(BASE - daysAgo * 86_400_000 + (hour - 9) * 3_600_000).toISOString();
const day = (daysFromNow: number): string =>
  new Date(BASE + daysFromNow * 86_400_000).toISOString().slice(0, 10);

const CITIES = ["São Paulo", "Campinas", "Santo André", "Guarulhos", "Osasco", "Sorocaba"];
const REGIONS = ["SP", "SP", "SP", "SP", "SP", "SP"];

const WORKSPACE_ID = "ws_n1";
const member = (id: Id): ActorRef => ({ kind: "member", id });
const agentRef = (id: Id): ActorRef => ({ kind: "agent", id });
const SYSTEM: ActorRef = { kind: "system", id: "sistema" };

/** As clínicas e consultórios de quem compra o Full Face. */
const COMPANY_NAMES: ReadonlyArray<readonly [string, string, string]> = [
  ["Clínica Sorriso Vivo", "Sorriso Vivo Odontologia Ltda.", "sorrisovivo.com.br"],
  ["Instituto Harmonia", "Harmonia Estética Avançada Ltda.", "institutoharmonia.com.br"],
  ["Odonto Excellence", "Excellence Odontologia S/S", "odontoexcellence.com.br"],
  ["Clínica Renovar", "Renovar Saúde e Estética Ltda.", "clinicarenovar.com.br"],
  ["Espaço Bella Face", "Bella Face Serviços Estéticos Ltda.", "bellaface.com.br"],
  ["Centro Odonto Ipê", "Ipê Odontologia Integrada Ltda.", "odontoipe.com.br"],
  ["Clínica Vittá", "Vittá Medicina e Odontologia Ltda.", "clinicavitta.com.br"],
  ["Studio Face", "Studio Face Harmonização Ltda.", "studioface.com.br"],
  ["Clínica Nova Era", "Nova Era Odontologia Ltda.", "clinicanovaera.com.br"],
  ["Consultório Dra. Lopes", "Lopes Odontologia ME", "dralopes.com.br"],
  ["Clínica Vida", "Vida Serviços Médicos Ltda.", "clinicavida.com.br"],
  ["Espaço Regenera", "Regenera Estética Avançada Ltda.", "regenera.com.br"],
];


const channel = (
  id: Id,
  name: string,
  channelType: Channel["channelType"],
  externalId: string,
  connection: Channel["connection"],
  defaultQueueId: Id,
): Channel => ({
  id,
  workspaceId: WORKSPACE_ID,
  createdBy: member("mem_thiago"),
  createdAt: at(350),
  lifecycle: "ativo",
  name,
  channelType,
  externalId,
  connection,
  configuredByMemberId: "mem_thiago",
  defaultQueueId,
  defaultContactOwnerMemberId: "mem_julia",
  defaultOriginId: "cat_org_wpp",
  messageTemplates: [],
  groupsEnabled: false,
});



const STAGE_COLORS = ["#94a3b8", "#60a5fa", "#a78bfa", "#f59e0b", "#f97316", "#22d3ee", "#e879f9", "#84cc16"];

/** C36 — os canais de atendimento de cada cópia de Funil: SDR prospecta também pelo LinkedIn; Closer e Venda direta fecham por e-mail. */
const CANAIS_DO_FUNIL: Record<string, readonly Id[]> = {
  fnl_sdr: ["chn_wpp", "chn_linkedin"],
  fnl_closer: ["chn_wpp", "chn_mail"],
  fnl_validacao: ["chn_wpp"],
  fnl_venda_direta: ["chn_wpp", "chn_mail"],
};

/** O Identificador que cada Canal exige do Contato (documento 14, 7.1). */
const IDENTIFIER_OF_CHANNEL: Partial<Record<ChannelType, ContactIdentifierType>> = {
  whatsapp: "identidadeDeWhatsApp",
  instagram: "usuarioDeInstagram",
  email: "email",
  chatDoSite: "identificadorDeChatDoSite",
};

function msg(
  conversationId: Id,
  direction: Message["direction"],
  actor: ActorRef,
  content: string,
  createdAt: string,
  deliveryStatus?: Message["deliveryStatus"],
): Message {
  return {
    id: nextId("msg"),
    conversationId,
    direction,
    actor,
    content,
    attachments: [],
    ...(direction === "enviada" ? { deliveryStatus: deliveryStatus ?? "entregue" } : {}),
    internalReads: [],
    reactions: [],
    externalEdits: [],
    createdAt,
  };
}

export function semearCrmAntigo(estado: DataState): DataState {
  const catalog = estado.catalog;

  // ── Funis: 4 (B60 — o padrão é criado com o Espaço de Trabalho) ───────────
  const funnels: Funnel[] = [
    /**
     * Funil SDR — prospecção e qualificação.
     *
     * Não há `ganho` aqui: a saída positiva é a MUDANÇA DE FUNIL para o Closer
     * (DO-FUN-11). Por isso `requireValueOnWin` é falso — valor é assunto do
     * Closer, e exigi-lo no SDR bloquearia uma passagem que não é venda.
     *
     * "Desqualificado" não é Etapa, é `perdido` com Motivo: assim a taxa de
     * desqualificação sai do Painel por Motivo e o Negócio pode ser reaberto se
     * o lead voltar.
     */
    {
      id: "fnl_sdr",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(200),
      lifecycle: "ativo",
      name: "SDR",
      description: "Da chegada do lead à reunião agendada com o Closer",
      color: "#9601c5",
      order: 2,
      isPrivate: false,
      stages: [
        // O "Resumo do perfil" NÃO entra como Requisito: ele é campo do
        // Contato, e o Requisito de Etapa só lê Valores de Campo do Negócio.
        { id: "sdr_novo", name: "Novo Lead", order: 0, defaultProbability: 5, requirements: [], allowedTransitionStageIds: [] },
        { id: "sdr_contato", name: "Contato Inicial", order: 1, defaultProbability: 10, requirements: [], allowedTransitionStageIds: [] },
        // A conexão só vira critério com FATO gravado: o momento em que o lead
        // concordou em ser qualificado.
        {
          id: "sdr_conexao",
          name: "Conexão",
          order: 2,
          defaultProbability: 20,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_conexao_em" }],
          allowedTransitionStageIds: [],
        },
        // Os cinco campos do roteiro: sair sem eles é dizer que qualificou sem
        // ter perguntado.
        {
          id: "sdr_qualificacao",
          name: "Qualificação",
          order: 3,
          defaultProbability: 35,
          requirements: [
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_criterio_fit" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_criterio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_dor" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_decisor" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_orcamento" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_prazo" },
          ],
          allowedTransitionStageIds: [],
        },
        {
          id: "sdr_qualificado",
          name: "Qualificado",
          order: 4,
          defaultProbability: 50,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_data_reuniao" }],
          allowedTransitionStageIds: [],
        },
        // Entregar ao Closer um Negócio sem Contato é entregar uma reunião com
        // ninguém.
        {
          id: "sdr_agendamento",
          name: "Agendamento",
          order: 5,
          defaultProbability: 60,
          requirements: [{ moment: "entrada", kind: "contatoObrigatorio" }],
          allowedTransitionStageIds: ["sdr_qualificado"],
        },
      ],
      closingRules: { requireLossReason: true, requireValueOnWin: false },
    },

    /**
     * Funil Closer — da reunião ao contrato.
     *
     * `ganho` aqui é a Venda (A4.4): "Venda" não é Etapa. Fechamento é a Etapa
     * de contrato em assinatura, e ela existe porque o Negócio ainda PODE SER
     * PERDIDO ali — um estado onde se perde é Etapa, não é momento.
     */
    {
      id: "fnl_closer",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(200),
      lifecycle: "ativo",
      name: "Closer",
      description: "Da reunião agendada ao contrato assinado",
      color: "#2C0263",
      order: 3,
      isPrivate: false,
      stages: [
        // Entrar sem Contato é receber uma reunião com ninguém.
        {
          id: "clo_agendamento",
          name: "Agendamento",
          order: 0,
          defaultProbability: 60,
          requirements: [
            { moment: "entrada", kind: "contatoObrigatorio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_data_reuniao" },
          ],
          allowedTransitionStageIds: [],
        },
        // Sair da Call sem diagnóstico é dizer que a reunião não produziu nada.
        {
          id: "clo_call",
          name: "Call",
          order: 1,
          defaultProbability: 70,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_diagnostico" }],
          allowedTransitionStageIds: [],
        },
        // Proposta é plano com preço: sem os dois não há o que negociar depois.
        {
          id: "clo_proposta",
          name: "Proposta",
          order: 2,
          defaultProbability: 80,
          requirements: [
            { moment: "entrada", kind: "valorObrigatorio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_plano" },
          ],
          allowedTransitionStageIds: [],
        },
        // A objeção nomeada é o que separa negociar de dar desconto.
        {
          id: "clo_negociacao",
          name: "Negociação",
          order: 3,
          defaultProbability: 88,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_objecao" }],
          allowedTransitionStageIds: [],
        },
        // Fechamento é contrato em assinatura, e ele ainda PODE ser perdido:
        // por isso é Etapa, e não o momento do ganho.
        {
          id: "clo_fechamento",
          name: "Fechamento",
          order: 4,
          defaultProbability: 95,
          requirements: [{ moment: "entrada", kind: "campoPreenchido", fieldDefinitionId: "fd_pagamento" }],
          allowedTransitionStageIds: ["clo_negociacao"],
        },
      ],
      closingRules: { requireLossReason: true, requireValueOnWin: true },
    },

    /*
     * Validação Full Face Avançado: do sinal pago ao contrato. A pessoa paga
     * para entrar no processo, passa por uma call de validação e só avança à
     * venda se for aprovada.
     *
     * "Ganho" e "Não aprovado" NÃO são Etapas, pelo mesmo motivo dos outros
     * Funis: ganho é a situação do Negócio, e reprovação é perda com Motivo
     * ("Não aprovado") — é assim que o Painel de perdas a enxerga, e é onde a
     * tratativa do sinal fica registrada (`fd_tratativa_sinal`).
     */
    {
      id: "fnl_validacao",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(60),
      lifecycle: "ativo",
      name: "Validação Full Face Avançado",
      description: "Do sinal pago à contratação, passando pela call de validação",
      color: "#0F766E",
      order: 4,
      isPrivate: false,
      stages: [
        // Sinal pago é fato com data, não intenção: sem `fd_sinal_pago_em` não entra.
        {
          id: "val_sinal",
          name: "Sinal pago",
          order: 0,
          defaultProbability: 15,
          requirements: [
            { moment: "entrada", kind: "contatoObrigatorio" },
            { moment: "entrada", kind: "campoPreenchido", fieldDefinitionId: "fd_sinal_pago_em" },
          ],
          allowedTransitionStageIds: [],
        },
        // O objetivo da Etapa é o agendamento: sair dela é ter data marcada.
        {
          id: "val_aguardando",
          name: "Aguardando agendamento",
          order: 1,
          defaultProbability: 20,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_data_reuniao" }],
          allowedTransitionStageIds: [],
        },
        {
          id: "val_agendada",
          name: "Call agendada",
          order: 2,
          defaultProbability: 35,
          requirements: [{ moment: "entrada", kind: "campoPreenchido", fieldDefinitionId: "fd_data_reuniao" }],
          allowedTransitionStageIds: [],
        },
        // A call produz a validação escrita; sem ela a análise não tem o que ler.
        {
          id: "val_realizada",
          name: "Call realizada",
          order: 3,
          defaultProbability: 50,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_validacao" }],
          allowedTransitionStageIds: [],
        },
        // Opcional: só quando a decisão não sai na hora. Pode ser pulada.
        {
          id: "val_analise",
          name: "Em análise",
          order: 4,
          defaultProbability: 55,
          requirements: [],
          allowedTransitionStageIds: [],
        },
        // Aprovado é o resultado registrado, não a opinião de quem moveu o card.
        {
          id: "val_aprovado",
          name: "Aprovado",
          order: 5,
          defaultProbability: 75,
          requirements: [{ moment: "entrada", kind: "campoPreenchido", fieldDefinitionId: "fd_resultado_validacao" }],
          allowedTransitionStageIds: [],
        },
        // Venda é proposta com valor; o ganho fecha com pagamento confirmado.
        {
          id: "val_venda",
          name: "Venda",
          order: 6,
          defaultProbability: 90,
          requirements: [
            { moment: "entrada", kind: "valorObrigatorio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_pagamento" },
          ],
          allowedTransitionStageIds: ["val_aprovado"],
        },
      ],
      closingRules: { requireLossReason: true, requireValueOnWin: true },
    },

    /*
     * Venda direta pelo WhatsApp: um Funil só, do lead ao pagamento, sem
     * passagem entre SDR e Closer. "Ganho" e "Perdido" são a situação do
     * Negócio, como nos outros três: ganhar é pagamento confirmado, perder é
     * Motivo registrado (sem resposta, desistiu, sem perfil).
     */
    {
      id: "fnl_venda_direta",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(45),
      lifecycle: "ativo",
      name: "Venda direta",
      description: "Funil de vendas pelo WhatsApp: do lead ao pagamento, numa conversa só",
      color: "#15803D",
      order: 5,
      isPrivate: false,
      stages: [
        { id: "vd_novo", name: "Novo lead", order: 0, defaultProbability: 5, requirements: [], allowedTransitionStageIds: [] },
        // Automação de abordagem move para cá quando a primeira Mensagem sai.
        { id: "vd_contato", name: "Primeiro contato", order: 1, defaultProbability: 10, requirements: [], allowedTransitionStageIds: [] },
        // Perfil, necessidade, momento e potencial: quatro Campos, os mesmos do roteiro.
        {
          id: "vd_qualificacao",
          name: "Em qualificação",
          order: 2,
          defaultProbability: 30,
          requirements: [
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_criterio_fit" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_dor" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_prazo" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_orcamento" },
          ],
          allowedTransitionStageIds: [],
        },
        // Oferta é produto com preço: sem valor não houve oferta.
        {
          id: "vd_oferta",
          name: "Oferta apresentada",
          order: 3,
          defaultProbability: 55,
          requirements: [
            { moment: "entrada", kind: "valorObrigatorio" },
            { moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_plano" },
          ],
          allowedTransitionStageIds: [],
        },
        // Objeções, condições, follow-up e o pagamento em trânsito. Sair daqui
        // é ganhar com a forma de pagamento definida.
        {
          id: "vd_negociacao",
          name: "Em negociação",
          order: 4,
          defaultProbability: 75,
          requirements: [{ moment: "saida", kind: "campoPreenchido", fieldDefinitionId: "fd_pagamento" }],
          allowedTransitionStageIds: ["vd_oferta"],
        },
      ],
      closingRules: { requireLossReason: true, requireValueOnWin: true },
    },
  ];

  // ── Empresas: 12, com matriz + 2 filiais e um Vínculo `parceira` ──────────
  const segmentOf = ["Odontologia", "Multidisciplinar", "Odontologia", "Medicina", "Biomedicina", "Odontologia", "Multidisciplinar", "Biomedicina", "Odontologia", "Odontologia", "Medicina", "Biomedicina"];
  const companies: Company[] = COMPANY_NAMES.map(([trade, legal, domain], index) => ({
    id: `cmp_${index + 1}`,
    workspaceId: WORKSPACE_ID,
    createdBy: member(index % 3 === 0 ? "mem_julia" : "mem_rafael"),
    createdAt: at(300 - index * 7),
    lifecycle: "ativo" as const,
    tradeName: trade,
    legalName: legal,
    ownerMemberId: index % 2 === 0 ? "mem_rafael" : "mem_julia",
    description: "",
    originId: catalog[index % 4]?.id,
    identifiers: [
      { id: `cmi_${index + 1}a`, type: "dominio" as const, value: domain, verified: true, principal: true, createdAt: at(300 - index * 7) },
      { id: `cmi_${index + 1}b`, type: "documentoFiscal" as const, value: `${10_000_000 + index * 137}000199`, country: "BR", verified: false, principal: true, createdAt: at(300 - index * 7) },
    ],
    addresses: [],
    tagIds: index % 5 === 0 ? ["tag_convenio"] : [],
    fieldValues: [
      { definitionId: "fd_segmento", value: segmentOf[index] ?? "Serviços", state: "ativo" as const },
      { definitionId: "fd_porte", value: index < 4 ? "Rede" : index < 8 ? "Clínica" : "Consultório", state: "ativo" as const },
    ],
    attachments: [],
    comments: [],
  }));
  // Matriz com 2 filiais (B51 — floresta acíclica, sem herança).
  const alfa = companies[1];
  const brasa = companies[2];
  if (alfa) alfa.parentCompanyId = "cmp_1";
  if (brasa) brasa.parentCompanyId = "cmp_1";

  // ── Contatos: 30 + 1 não identificado + 1 mesclado ───────────────────────
  const firstNames = ["Ana", "Marina", "Paulo", "Renata", "Diego", "Fernanda", "Bruno", "Carla", "Eduardo", "Patrícia", "Lucas", "Juliana", "Roberto", "Sandra", "Thiago", "Vanessa", "Gustavo", "Bianca", "Rodrigo", "Letícia", "André", "Priscila", "Felipe", "Camila", "Marcelo", "Aline", "Vinícius", "Débora", "Otávio", "Natália"];
  const lastNames = ["Ribeiro", "Alves", "Cardoso", "Moreira", "Barbosa", "Rocha", "Teixeira", "Dias", "Correia", "Freitas", "Pinto", "Araújo", "Monteiro", "Melo", "Cunha", "Farias", "Batista", "Nogueira", "Peixoto", "Xavier", "Aguiar", "Brandão", "Coelho", "Fonseca", "Guimarães", "Leal", "Macedo", "Nunes", "Prado", "Quirino"];

  const contacts: Contact[] = firstNames.map((first, index) => {
    const last = lastNames[index] ?? "Silva";
    const domain = COMPANY_NAMES[index % 12]?.[2] ?? "exemplo.com.br";
    const local = `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return {
      id: `cnt_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member(index % 4 === 0 ? "mem_julia" : "mem_rafael"),
      createdAt: at(280 - index * 6),
      lifecycle: "ativo" as const,
      firstName: first,
      lastName: last,
      ownerMemberId: index % 3 === 0 ? "mem_julia" : index % 3 === 1 ? "mem_rafael" : "mem_thiago",
      creationMode: index % 7 === 0 ? ("automaticoPorMensagem" as const) : ("manual" as const),
      originId: catalog[index % 4]?.id,
      qualificationId: index < 8 ? "cat_qual_cli" : index < 18 ? "cat_qual_prosp" : "cat_qual_lead",
      temperatureId: index % 3 === 0 ? "cat_temp_quente" : index % 3 === 1 ? "cat_temp_morno" : "cat_temp_frio",
      description: "",
      identifiers: [
        { id: `cid_${index + 1}a`, type: "email" as const, value: `${local}@${domain}`, displayValue: `${local}@${domain}`, verified: true, principal: true, createdBy: member("mem_rafael"), createdAt: at(280 - index * 6) },
        { id: `cid_${index + 1}b`, type: "identidadeDeWhatsApp" as const, value: `5511${970_000_000 + index * 1_237}`, displayValue: `+55 11 9${String(7_000_000 + index * 1_237).slice(0, 4)}-${1000 + index}`, channelOriginId: "chn_wpp", verified: true, principal: true, createdBy: SYSTEM, createdAt: at(280 - index * 6) },
        { id: `cid_${index + 1}d`, type: "perfilDeLinkedIn" as const, value: `linkedin.com/in/${local}`, displayValue: `linkedin.com/in/${local}`, verified: false, principal: true, createdBy: member("mem_julia"), createdAt: at(280 - index * 6) },
      ],
      consents: [
        { purposeId: "cat_fin_atend", channelType: "todos" as const, decision: "concedido" as const, at: at(280 - index * 6), origin: "mensagem" as const, recordedBy: SYSTEM, recordedAt: at(280 - index * 6) },
        ...(index % 3 === 0
          ? [{ purposeId: "cat_fin_mkt", channelType: "whatsapp" as const, decision: "concedido" as const, at: at(200 - index), origin: "formulario" as const, recordedBy: member("mem_julia"), recordedAt: at(200 - index) }]
          : []),
      ],
      addresses: [
        {
          kind: "comercial",
          city: CITIES[index % CITIES.length] ?? "São Paulo",
          region: REGIONS[index % REGIONS.length] ?? "SP",
          country: "BR",
          principal: true,
        },
      ],
      tagIds: index % 6 === 0 ? ["tag_convenio"] : [],
      fieldValues: [],
      comments: [],
    };
  });

  /**
   * Um par que dispara Suspeita de Duplicidade sem violar INV-CON-02: o mesmo
   * número aparece como `telefone` num Contato e como `identidadeDeWhatsApp` no
   * outro — Tipos distintos, então não é o mesmo Identificador (RN-CON-10).
   */
  const paraDuplicar = contacts[3];
  const numeroDuplicado = paraDuplicar?.identifiers.find(
    (i) => i.type === "identidadeDeWhatsApp",
  );
  if (paraDuplicar) {
    contacts.push({
      ...paraDuplicar,
      id: "cnt_33",
      firstName: paraDuplicar.firstName,
      lastName: paraDuplicar.lastName,
      creationMode: "automaticoPorMensagem",
      createdBy: SYSTEM,
      createdAt: at(3),
      ownerMemberId: "mem_julia",
      identifiers: [
        {
          id: "cid_33a",
          type: "telefone",
          value: numeroDuplicado?.value ?? "5511970000000",
          displayValue: numeroDuplicado?.displayValue ?? "+55 11 97000-0000",
          verified: false,
          principal: true,
          createdBy: SYSTEM,
          createdAt: at(3),
        },
      ],
      comments: [],
    });
  }

  const first = contacts[0];
  const second = contacts[1];
  if (first) {
    // 1 Contato "não identificado": Nome vazio é condição derivada, não estado.
    contacts.push({
      ...first,
      id: "cnt_31",
      firstName: "",
      lastName: "",
      creationMode: "automaticoPorMensagem",
      createdBy: SYSTEM,
      createdAt: at(2),
      ownerMemberId: "mem_julia",
      qualificationId: "cat_qual_lead",
      identifiers: [
        { id: "cid_31", type: "identidadeDeWhatsApp", value: "5511988887777", displayValue: "+55 11 98888-7777", channelOriginId: "chn_wpp", channelLabel: "Sérgio", verified: true, principal: true, createdBy: SYSTEM, createdAt: at(2) },
      ],
      consents: [],
      tagIds: [],
    });
  }
  if (second) {
    // 1 Contato `mesclado`, apontando o sobrevivente e guardando o estado (B14).
    contacts.push({
      ...second,
      id: "cnt_32",
      firstName: "Marina",
      lastName: "A.",
      lifecycle: "mesclado",
      mergedIntoId: "cnt_2",
      mergedAt: at(15),
      identifiers: [],
      preMergeState: { at: at(15), snapshot: JSON.stringify({ firstName: "Marina", lastName: "A." }) },
    });
  }

  /*
   * O decisor do Negócio de referência. A conversa diz que quem decide junto é
   * a Camila, e um Negócio em Negociação cujo decisor não existe como Contato é
   * um Negócio que ninguém consegue tocar.
   */
  if (first) {
    contacts.push({
      ...first,
      id: "cnt_34",
      firstName: "Camila",
      lastName: "Iallas",
      creationMode: "manual",
      createdBy: member("mem_julia"),
      createdAt: at(7),
      ownerMemberId: "mem_rafael",
      qualificationId: "cat_qual_qualificado",
      temperatureId: "cat_temp_morno",
      description: "",
      identifiers: [
        { id: "cid_34a", type: "email", value: "financeiro@clinicarenovar.com.br", displayValue: "financeiro@clinicarenovar.com.br", verified: true, principal: true, createdBy: member("mem_julia"), createdAt: at(7) },
        { id: "cid_34b", type: "perfilDeLinkedIn", value: "linkedin.com/in/camilaiallas", displayValue: "linkedin.com/in/camilaiallas", verified: false, principal: true, createdBy: member("mem_julia"), createdAt: at(7) },
      ],
      consents: [],
      tagIds: [],
      fieldValues: [
        {
          definitionId: "fd_resumo_perfil",
          value: "Cuida do financeiro da clínica. Entra na conversa quando a proposta chega com número.",
          state: "ativo",
        },
      ],
      comments: [],
    });
  }

  /*
   * Iallas, Cliente. É o Contato que carrega FOTO: `photoFileId` aponta para
   * `public/contatos/<id>.jpg`, e o avatar cai nas iniciais se o arquivo não
   * estiver lá.
   */
  if (first) {
    contacts.push({
      ...first,
      id: "cnt_35",
      firstName: "Iallas",
      lastName: "",
      creationMode: "manual",
      createdBy: member("mem_rafael"),
      createdAt: at(180),
      ownerMemberId: "mem_rafael",
      qualificationId: "cat_qual_cli",
      temperatureId: "cat_temp_quente",
      photoFileId: "iallas",
      description: "",
      identifiers: [
        { id: "cid_35a", type: "email", value: "iallas@clinicarenovar.com.br", displayValue: "iallas@clinicarenovar.com.br", verified: true, principal: true, createdBy: member("mem_rafael"), createdAt: at(180) },
        { id: "cid_35b", type: "identidadeDeWhatsApp", value: "5511993451188", displayValue: "+55 11 99345-1188", channelOriginId: "chn_wpp", verified: true, principal: true, createdBy: SYSTEM, createdAt: at(180) },
        { id: "cid_35c", type: "usuarioDeInstagram", value: "@dr.iallas", displayValue: "@dr.iallas", channelOriginId: "chn_insta", verified: true, principal: true, createdBy: SYSTEM, createdAt: at(180) },
        { id: "cid_35d", type: "perfilDeLinkedIn", value: "linkedin.com/in/iallas", displayValue: "linkedin.com/in/iallas", verified: true, principal: true, createdBy: member("mem_rafael"), createdAt: at(180) },
        { id: "cid_35e", type: "perfilDeTikTok", value: "@dr.iallas", displayValue: "@dr.iallas", verified: false, principal: true, createdBy: member("mem_rafael"), createdAt: at(180) },
      ],
      consents: [
        { purposeId: "cat_fin_atend", channelType: "todos" as const, decision: "concedido" as const, at: at(180), origin: "mensagem" as const, recordedBy: SYSTEM, recordedAt: at(180) },
        { purposeId: "cat_fin_mkt", channelType: "whatsapp" as const, decision: "concedido" as const, at: at(178), origin: "formulario" as const, recordedBy: member("mem_rafael"), recordedAt: at(178) },
      ],
      addresses: [{ kind: "comercial", city: "São Paulo", region: "SP", country: "BR", principal: true }],
      tagIds: ["tag_convenio"],
      fieldValues: [
        {
          definitionId: "fd_resumo_perfil",
          value: "Cirurgião-dentista com CRO ativo e clínica própria há quatro anos, cerca de 60 pacientes por mês. Já aplica toxina e preenchimento labial e quer o protocolo completo de full face.",
          state: "ativo",
        },
      ],
      comments: [],
    });
  }

  // 4 Contatos sem Empresa: os índices 26..29 ficam sem Vínculo.
  /** O Contato `cnt_N` trabalha nesta Empresa — a mesma conta usada abaixo. */
  const empresaDoContato = (numeroDoContato: number): Id =>
    numeroDoContato === 35 ? "cmp_4" : `cmp_${((numeroDoContato - 1) % 12) + 1}`;

  const contactCompanyLinks: ContactCompanyLink[] = [];
  for (let index = 0; index < 26; index += 1) {
    contactCompanyLinks.push({
      id: `ccl_c${index + 1}`,
      contactId: `cnt_${index + 1}`,
      companyId: `cmp_${(index % 12) + 1}`,
      role: index % 4 === 0 ? "Cirurgiã-dentista" : index % 4 === 1 ? "Médico" : index % 4 === 2 ? "Biomédica" : "Cirurgião-dentista",
      principalForContact: true,
      principalForCompany: index < 12,
      start: day(-300 + index * 5),
      createdBy: member("mem_rafael"),
      createdAt: at(280 - index * 6),
    });
  }
  contactCompanyLinks.push({
    id: "ccl_iallas",
    contactId: "cnt_35",
    companyId: "cmp_4",
    role: "Cirurgião-dentista",
    principalForContact: true,
    principalForCompany: false,
    start: day(-180),
    createdBy: member("mem_rafael"),
    createdAt: at(180),
  });

  // 2 Contatos em duas Empresas (B8) e 1 Vínculo encerrado (RN-CON-06).
  contactCompanyLinks.push(
    { id: "ccl_x1", contactId: "cnt_3", companyId: "cmp_9", role: "Conselheiro", principalForContact: false, principalForCompany: false, start: day(-120), createdBy: member("mem_rafael"), createdAt: at(120) },
    { id: "ccl_x2", contactId: "cnt_7", companyId: "cmp_11", role: "Sócio", principalForContact: false, principalForCompany: false, start: day(-90), createdBy: member("mem_rafael"), createdAt: at(90) },
    { id: "ccl_x3", contactId: "cnt_5", companyId: "cmp_6", role: "Analista de Marketing", principalForContact: false, principalForCompany: false, start: day(-400), end: day(-140), createdBy: member("mem_rafael"), createdAt: at(400) },
  );

  // ── Negócios: 25 (5 ganhos, 4 perdidos com Motivo, 1 reaberto) ───────────
  const deals: Deal[] = [];

  /**
   * Negócios percorrendo o Funil SDR e o Closer.
   *
   * Cada um carrega EXATAMENTE os campos que a Etapa dele já exige: quem está
   * em Qualificado tem os cinco do roteiro e a data da reunião; quem está em
   * Conexão tem o momento da conexão. Assim o quadro mostra Requisitos
   * satisfeitos, e não um formulário vazio que bloqueia todo arrasto.
   */
  const campo = (definitionId: Id, value: FieldValue["value"]): FieldValue => ({
    definitionId,
    value,
    state: "ativo",
  });
  const conexaoEm = (dias: number) => campo("fd_conexao_em", at(dias, 11));

  /*
   * Um Negócio aberto por Funil, os dois do Iallas: o quadro fica legível para
   * demonstrar o processo. O histórico continua inteiro nos encerrados, que o
   * quadro não mostra como card e os Painéis continuam medindo.
   */
  const sdrDeals: ReadonlyArray<{
    readonly stage: Id;
    readonly empresa: number;
    readonly contato: number;
    readonly campos: readonly FieldValue[];
  }> = [
    // O primeiro vira o Negócio de referência e é entregue ao Closer logo
    // abaixo; o segundo é a nova turma, e é o que fica no quadro do SDR.
    { stage: "sdr_novo", empresa: 4, contato: 35, campos: [] },
    {
      stage: "sdr_qualificacao",
      empresa: 4,
      contato: 35,
      campos: [conexaoEm(3)],
    },
  ];

  sdrDeals.forEach((entrada, index) => {
    deals.push({
      id: `deal_sdr_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_julia"),
      createdAt: at(20 - index),
      lifecycle: "ativo",
      readableId: `NEG-${2000 + index}`,
      title:
        index === 0
          ? `Full Face para ${contacts[entrada.contato - 1]?.firstName ?? "Lead"}`
          : `Módulo prático para ${contacts[entrada.contato - 1]?.firstName ?? "Lead"}`,
      object: "Full Face Avançado",
      description: "",
      companyId: empresaDoContato(entrada.contato),
      ownerMemberId: index % 2 === 0 ? "mem_julia" : "mem_marcos",
      funnelId: "fnl_sdr",
      stageId: entrada.stage,
      situation: "aberto",
      originId: index % 2 === 0 ? "cat_org_insta" : "cat_org_site",
      expectedCloseDate: day(20 + index),
      enteredStageAt: at(3 + index),
      contactLinks:
        entrada.stage === "sdr_qualificado"
          ? []
          : [
              { id: `dcl_sdr_${index + 1}`, contactId: `cnt_${entrada.contato}`, role: "decisor", principal: true, createdBy: member("mem_julia"), createdAt: at(20 - index) },
            ],
      tagIds: [],
      fieldValues: [...entrada.campos],
      attachments: [],
      comments: [],
      stageHistory: [],
    });
  });

  const protagonista = contacts.find((c) => c.id === "cnt_35");
  if (protagonista) {
    protagonista.fieldValues = [
      ...protagonista.fieldValues,
      {
        definitionId: "fd_sinais_fit",
        value: ["Habilitação ativa", "Clínica própria", "Já aplica toxina"],
        state: "ativo",
      },
    ];
  }

  /*
   * O Negócio de referência: o mesmo que a conversa de WhatsApp conta, já
   * entregue ao Closer e em Negociação.
   *
   * Cada Valor de Campo aqui tem origem numa resposta do Iallas na conversa, e
   * o histórico guarda o caminho inteiro, inclusive a mudança de Funil. É o
   * Negócio que o time abre para julgar a tela, então ele precisa estar cheio
   * como um Negócio real de verdade estaria.
   */
  const referencia = deals.find((d) => d.id === "deal_sdr_1");
  if (referencia) {
    referencia.title = "Full Face Avançado para Iallas";
    referencia.funnelId = "fnl_closer";
    referencia.stageId = "clo_negociacao";
    referencia.ownerMemberId = "mem_thiago";
    // Plano Elite: 10 casos, 4 mentorias, 90 dias de suporte.
    referencia.value = { amount: 16_997, currency: "BRL" };
    referencia.originId = "cat_org_insta";
    referencia.expectedCloseDate = day(18);
    referencia.enteredStageAt = at(3, 11);
    referencia.description =
      "Cirurgião-dentista com clínica própria há quatro anos e cerca de 60 pacientes por mês. Já aplica toxina e preenchimento labial; quer o protocolo completo.";
    referencia.fieldValues = [
      campo("fd_conexao_em", at(12, 14)),
      campo("fd_criterio_fit", "Cirurgião-dentista com CRO ativo, clínica própria há quatro anos, 60 pacientes por mês. Já faz toxina e preenchimento labial."),
      campo("fd_criterio", "Ver caso real do começo ao fim, não só teoria, e ter mentoria para tirar dúvida na hora de aplicar no próprio paciente."),
      campo("fd_dor", "Oito pacientes por mês pedem full face ou rinomodelação e ele encaminha para uma colega. São uns 16 mil por mês saindo da clínica."),
      campo("fd_decisor", "Decisão dele, com a Camila, que cuida do financeiro da clínica. Ela entra na call."),
      campo("fd_orcamento", 10_000),
      campo("fd_prazo", "Até 90 dias"),
      campo("fd_result_qual", "Qualificado"),
      campo("fd_data_reuniao", at(4, 10)),
      campo("fd_sdr_origem", "mem_thiago"),
      campo("fd_diagnostico", "Faz toxina e preenchimento labial há dois anos, nunca fez o protocolo completo. O medo declarado é a transição do terço médio. Encaminha oito casos por mês."),
      campo("fd_plano", "Elite"),
      campo("fd_objecao", "Parcelamento"),
    ];
    referencia.tagIds = ["tag_convenio"];
    referencia.contactLinks = [
      { id: "dcl_ref_1", contactId: "cnt_35", role: "influenciador", principal: true, createdBy: member("mem_thiago"), createdAt: at(12) },
      { id: "dcl_ref_2", contactId: "cnt_34", role: "decisor", principal: false, createdBy: member("mem_thiago"), createdAt: at(7) },
    ];
    const caminho: ReadonlyArray<[Id, string, number, Id, StageTransition["entryOrigin"], number]> = [
      ["sdr_novo", "Novo Lead", 0, "fnl_sdr", "criacao", 13],
      ["sdr_contato", "Contato Inicial", 1, "fnl_sdr", "avanco", 12],
      ["sdr_conexao", "Conexão", 2, "fnl_sdr", "avanco", 12],
      ["sdr_qualificacao", "Qualificação", 3, "fnl_sdr", "avanco", 11],
      ["sdr_qualificado", "Qualificado", 4, "fnl_sdr", "avanco", 9],
      ["sdr_agendamento", "Agendamento", 5, "fnl_sdr", "avanco", 7],
      ["clo_agendamento", "Agendamento", 0, "fnl_closer", "mudancaDeFunil", 7],
      ["clo_call", "Call", 1, "fnl_closer", "avanco", 4],
      ["clo_negociacao", "Negociação", 2, "fnl_closer", "avanco", 3],
    ];
    referencia.stageHistory = caminho.map(([id, nome, ordem, funil, origem, dias], posicao) => {
      const anterior = caminho[posicao - 1];
      return {
        id: nextId("trn"),
        at: at(dias, 12),
        ...(anterior
          ? { fromStageId: anterior[0], fromStageName: anterior[1], fromStageOrder: anterior[2], fromFunnelId: anterior[3] }
          : {}),
        toStageId: id,
        toStageName: nome,
        toStageOrder: ordem,
        toFunnelId: funil,
        entryOrigin: origem,
        actor: member(origem === "mudancaDeFunil" ? "mem_julia" : posicao > 5 ? "mem_rafael" : "mem_julia"),
      };
    });
  }

  /*
   * O Iallas no Funil de Validação: sinal pago, call marcada. Carrega
   * exatamente o que as Etapas até "Call agendada" exigem — a data do sinal e
   * a data da call — e o histórico das duas passagens.
   */
  {
    const trilha: ReadonlyArray<[Id, string, number, number]> = [
      ["val_sinal", "Sinal pago", 0, 5],
      ["val_aguardando", "Aguardando agendamento", 1, 5],
      ["val_agendada", "Call agendada", 2, 2],
    ];
    deals.push({
      id: "deal_val_1",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_thiago"),
      createdAt: at(5, 10),
      lifecycle: "ativo",
      readableId: "NEG-3000",
      title: "Validação para Iallas",
      object: "Full Face Avançado",
      description: "Pagou o sinal pelo link da proposta. Call de validação marcada com a Camila junto.",
      companyId: empresaDoContato(35),
      ownerMemberId: "mem_thiago",
      funnelId: "fnl_validacao",
      stageId: "val_agendada",
      situation: "aberto",
      value: { amount: 16_997, currency: "BRL" },
      originId: "cat_org_insta",
      expectedCloseDate: day(12),
      enteredStageAt: at(2, 15),
      contactLinks: [
        { id: "dcl_val_1", contactId: "cnt_35", role: "decisor", principal: true, createdBy: member("mem_thiago"), createdAt: at(5, 10) },
      ],
      tagIds: [],
      fieldValues: [
        campo("fd_sinal_pago_em", at(5, 9)),
        campo("fd_data_reuniao", at(-1, 10)),
        campo("fd_plano", "Elite"),
      ],
      attachments: [],
      comments: [],
      stageHistory: trilha.map(([id, nome, ordem, dias], posicao) => {
        const anterior = trilha[posicao - 1];
        return {
          id: nextId("trn"),
          at: at(dias, 15),
          ...(anterior
            ? { fromStageId: anterior[0], fromStageName: anterior[1], fromStageOrder: anterior[2], fromFunnelId: "fnl_validacao" }
            : {}),
          toStageId: id,
          toStageName: nome,
          toStageOrder: ordem,
          toFunnelId: "fnl_validacao",
          entryOrigin: posicao === 0 ? "criacao" : "avanco",
          actor: member("mem_thiago"),
        };
      }),
    });
  }

  /* O Iallas na Venda direta: qualificado no WhatsApp, oferta na mesa. */
  {
    const trilha: ReadonlyArray<[Id, string, number, number]> = [
      ["vd_novo", "Novo lead", 0, 9],
      ["vd_contato", "Primeiro contato", 1, 9],
      ["vd_qualificacao", "Em qualificação", 2, 8],
      ["vd_oferta", "Oferta apresentada", 3, 6],
    ];
    deals.push({
      id: "deal_vd_1",
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_marcos"),
      createdAt: at(9, 10),
      lifecycle: "ativo",
      readableId: "NEG-4000",
      title: "Venda direta para Iallas",
      object: "Full Face Avançado",
      description: "Chegou pelo anúncio e respondeu no WhatsApp no mesmo dia. Quer o Pro; pediu as condições por escrito.",
      companyId: empresaDoContato(35),
      ownerMemberId: "mem_marcos",
      funnelId: "fnl_venda_direta",
      stageId: "vd_oferta",
      situation: "aberto",
      value: { amount: 10_997, currency: "BRL" },
      originId: "cat_org_insta",
      expectedCloseDate: day(7),
      enteredStageAt: at(6, 16),
      contactLinks: [
        { id: "dcl_vd_1", contactId: "cnt_35", role: "decisor", principal: true, createdBy: member("mem_marcos"), createdAt: at(9, 10) },
      ],
      tagIds: [],
      fieldValues: [
        campo("fd_criterio_fit", "Cirurgião-dentista, clínica própria, já aplica toxina. Perfil do curso."),
        campo("fd_dor", "Encaminha os casos de full face para uma colega e perde a receita."),
        campo("fd_prazo", "Até 30 dias"),
        campo("fd_orcamento", 11_000),
      ],
      attachments: [],
      comments: [],
      stageHistory: trilha.map(([id, nome, ordem, dias], posicao) => {
        const anterior = trilha[posicao - 1];
        return {
          id: nextId("trn"),
          at: at(dias, 16),
          ...(anterior
            ? { fromStageId: anterior[0], fromStageName: anterior[1], fromStageOrder: anterior[2], fromFunnelId: "fnl_venda_direta" }
            : {}),
          toStageId: id,
          toStageName: nome,
          toStageOrder: ordem,
          toFunnelId: "fnl_venda_direta",
          entryOrigin: posicao === 0 ? "criacao" : "avanco",
          actor: member("mem_marcos"),
        };
      }),
    });
  }

  /**
   * Desqualificados pelo SDR. O Motivo de Perda aqui é do começo do funil — sem
   * resposta, sem conexão, não é decisor — e não o motivo comercial do Closer.
   */
  const desqualificados: ReadonlyArray<{
    readonly etapa: Id;
    readonly empresa: number;
    readonly motivo: Id;
    readonly dono: Id;
  }> = [
    { etapa: "sdr_contato", empresa: 4, motivo: "cat_perda_semresp", dono: "mem_julia" },
    { etapa: "sdr_contato", empresa: 12, motivo: "cat_perda_semresp", dono: "mem_marcos" },
    { etapa: "sdr_conexao", empresa: 1, motivo: "cat_perda_semconex", dono: "mem_julia" },
    { etapa: "sdr_qualificacao", empresa: 11, motivo: "cat_perda_naodecisor", dono: "mem_marcos" },
    { etapa: "sdr_qualificacao", empresa: 2, motivo: "cat_perda_desqual", dono: "mem_julia" },
    { etapa: "sdr_agendamento", empresa: 7, motivo: "cat_perda_semagend", dono: "mem_marcos" },
  ];

  desqualificados.forEach((entrada, index) => {
    deals.push({
      id: `deal_sdr_perd_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member(entrada.dono),
      createdAt: at(60 - index * 4),
      lifecycle: "ativo",
      readableId: `NEG-${2100 + index}`,
      title: `Full Face para ${contacts[19 + index]?.firstName ?? "Lead"} ${contacts[19 + index]?.lastName ?? ""}`.trim(),
      object: "Full Face Avançado",
      description: "",
      companyId: empresaDoContato(20 + index),
      ownerMemberId: entrada.dono,
      funnelId: "fnl_sdr",
      stageId: entrada.etapa,
      situation: "perdido",
      lossReasonId: entrada.motivo,
      closedAt: at(40 - index * 4),
      originId: index % 2 === 0 ? "cat_org_insta" : "cat_org_site",
      expectedCloseDate: day(-20 + index),
      enteredStageAt: at(50 - index * 4),
      contactLinks: [
        { id: `dcl_sdr_perd_${index + 1}`, contactId: `cnt_${20 + index}`, role: "decisor", principal: true, createdBy: member(entrada.dono), createdAt: at(60 - index * 4) },
      ],
      tagIds: [],
      fieldValues: [],
      attachments: [],
      comments: [],
      stageHistory: [],
    });
  });

  /**
   * Os Campos que o Closer já teria preenchido para o Negócio ter chegado
   * àquela Etapa. Sem eles o seed nasce num estado que as próprias Regras de
   * Etapa não deixariam alcançar, e a reabertura recusa com razão.
   */
  const camposDoCloser = (etapa: Id): FieldValue[] => {
    const ordem = ["clo_agendamento", "clo_call", "clo_proposta", "clo_negociacao", "clo_fechamento"];
    const ate = ordem.indexOf(etapa);
    const campos: FieldValue[] = [];
    if (ate >= 1) {
      campos.push(
        campo("fd_diagnostico", "Já aplica toxina e preenchimento, mas nunca fez o protocolo completo. Encaminha os casos de full face."),
      );
    }
    if (ate >= 2) campos.push(campo("fd_plano", "Pro"));
    if (ate >= 3) campos.push(campo("fd_objecao", "Parcelamento"));
    if (ate >= 4) campos.push(campo("fd_pagamento", "Cartão em 12x"));
    return campos;
  };

  // Negócios já entregues ao Closer. O histórico guarda a passagem: sem ele, o
  // Painel do SDR não conseguiria contar o que ele entregou.
  const closerDeals: ReadonlyArray<{ readonly stage: Id; readonly empresa: number; readonly valor?: number }> = [];

  /**
   * Negócios encerrados no Closer. Eles existem para o Painel ter o que medir e
   * para as regras de encerramento terem o que exercitar: `ganho` exige valor,
   * `perdido` exige Motivo, e a reabertura precisa de um ganho para desfazer.
   */
  const encerrados: ReadonlyArray<{
    readonly situacao: "ganho" | "perdido";
    readonly etapa: Id;
    readonly empresa: number;
    readonly valor: number;
    readonly motivo: Id;
  }> = [
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 1, valor: 16_997, motivo: "cat_ganho_preco" },
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 2, valor: 10_997, motivo: "cat_ganho_escopo" },
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 5, valor: 16_997, motivo: "cat_ganho_preco" },
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 7, valor: 8_997, motivo: "cat_ganho_escopo" },
    { situacao: "ganho", etapa: "clo_fechamento", empresa: 8, valor: 10_997, motivo: "cat_ganho_preco" },
    { situacao: "perdido", etapa: "clo_negociacao", empresa: 3, valor: 16_997, motivo: "cat_perda_preco" },
    { situacao: "perdido", etapa: "clo_call", empresa: 6, valor: 10_997, motivo: "cat_perda_concor" },
    { situacao: "perdido", etapa: "clo_negociacao", empresa: 9, valor: 8_997, motivo: "cat_perda_semorc" },
    { situacao: "perdido", etapa: "clo_agendamento", empresa: 11, valor: 10_997, motivo: "cat_perda_naocomp" },
  ];

  encerrados.forEach((entrada, index) => {
    deals.push({
      id: `deal_fim_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_julia"),
      createdAt: at(120 - index * 7),
      lifecycle: "ativo",
      readableId: `NEG-${2200 + index}`,
      title: `Full Face para ${contacts[entrada.empresa % 12]?.firstName ?? "Cliente"} ${contacts[entrada.empresa % 12]?.lastName ?? ""}`.trim(),
      object: "Full Face Avançado",
      description: "",
      companyId: `cmp_${entrada.empresa}`,
      ownerMemberId: "mem_rafael",
      funnelId: "fnl_closer",
      stageId: entrada.etapa,
      value: { amount: entrada.valor, currency: "BRL" },
      situation: entrada.situacao,
      ...(entrada.situacao === "ganho"
        ? { winReasonId: entrada.motivo }
        : { lossReasonId: entrada.motivo }),
      closedAt: at(30 - index * 2),
      originId: "cat_org_indic",
      expectedCloseDate: day(-30 + index),
      enteredStageAt: at(45 - index * 2),
      contactLinks: [
        { id: `dcl_fim_${index + 1}`, contactId: `cnt_${index + 1}`, role: "decisor", principal: true, createdBy: member("mem_rafael"), createdAt: at(120 - index * 7) },
      ],
      tagIds: [],
      fieldValues: [
        campo("fd_sdr_origem", "mem_julia"),
        campo("fd_data_reuniao", at(40 - index * 2, 10)),
        ...camposDoCloser(entrada.etapa),
      ],
      attachments: [],
      comments: [],
      stageHistory: [],
    });
  });


  closerDeals.forEach((entrada, index) => {
    const origem = funnels.find((f) => f.id === "fnl_sdr");
    deals.push({
      id: `deal_closer_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: member("mem_julia"),
      createdAt: at(40 - index * 3),
      lifecycle: "ativo",
      readableId: `NEG-${2100 + index}`,
      title: `Full Face para ${contacts[entrada.empresa % 12]?.firstName ?? "Cliente"} ${contacts[entrada.empresa % 12]?.lastName ?? ""}`.trim(),
      object: "Full Face Avançado",
      description: "",
      companyId: `cmp_${entrada.empresa}`,
      // A7 — depois da passagem, quem responde é o Closer.
      ownerMemberId: "mem_rafael",
      funnelId: "fnl_closer",
      stageId: entrada.stage,
      ...(entrada.valor ? { value: { amount: entrada.valor, currency: "BRL" } } : {}),
      situation: "aberto",
      originId: "cat_org_indic",
      expectedCloseDate: day(10 + index * 5),
      enteredStageAt: at(5 + index),
      contactLinks: [
        { id: `dcl_clo_${index + 1}`, contactId: `cnt_${20 + index}`, role: "decisor", principal: true, createdBy: member("mem_rafael"), createdAt: at(40 - index * 3) },
      ],
      tagIds: [],
      fieldValues: [
        campo("fd_sdr_origem", "mem_julia"),
        campo("fd_data_reuniao", at(6 - index, 14)),
        ...camposDoCloser(entrada.stage),
      ],
      attachments: [],
      comments: [],
      ...(index === 3 ? { lifecycle: "arquivado" as const } : {}),
      stageHistory: [
        {
          id: `stt_pass_${index + 1}`,
          at: at(12 - index),
          fromStageId: "sdr_agendamento",
          fromStageName: "Agendamento",
          fromStageOrder: 5,
          toStageId: "clo_agendamento",
          toStageName: "Agendamento",
          toStageOrder: 0,
          fromFunnelId: origem?.id ?? "fnl_sdr",
          toFunnelId: "fnl_closer",
          entryOrigin: "mudancaDeFunil",
          actor: member("mem_julia"),
        },
      ],
    });
  });
  for (const deal of deals) {
    if (deal.stageHistory.length > 0) continue;
    const stage = funnels
      .find((funnel) => funnel.id === deal.funnelId)
      ?.stages.find((etapa) => etapa.id === deal.stageId);
    if (!stage) continue;
    deal.stageHistory.push({
      id: nextId("trn"),
      at: deal.createdAt,
      toStageId: stage.id,
      toStageName: stage.name,
      toStageOrder: stage.order,
      toFunnelId: deal.funnelId,
      entryOrigin: "criacao",
      actor: deal.createdBy,
    });
  }

  // ── Caixa de Entrada: 4 Canais (1 desconectado), 2 Filas, 20 Conversas ───
  const channels: Channel[] = [
    channel("chn_wpp", "Comercial SP", "whatsapp", "+5511987654321", "conectada", "fila_com"),
    channel("chn_insta", "@institutoigoralves", "instagram", "institutoigoralves", "desconectada", "fila_com"),
    channel("chn_mail", "contato@institutoigoralves.com.br", "email", "contato@institutoigoralves.com.br", "conectada", "fila_sup"),
    channel("chn_site", "Chat do site", "chatDoSite", "institutoigoralves.com.br", "conectada", "fila_sup"),
    channel("chn_linkedin", "Instituto Igor Alves no LinkedIn", "linkedin", "company/institutoigoralves", "conectada", "fila_com"),
  ];
  const whatsapp = channels[0];
  if (whatsapp) {
    whatsapp.messageTemplates = [
      { providerId: "tpl_retomada", name: "Retomada de contato", language: "pt_BR", body: "Olá, {{1}}! Podemos retomar a conversa sobre o programa?", category: "utilidade", approval: "aprovado", syncedAt: at(5) },
      { providerId: "tpl_campanha", name: "Convite para webinar", language: "pt_BR", body: "Olá, {{1}}! A aula aberta sobre full face é dia {{2}}.", category: "marketing", approval: "aprovado", syncedAt: at(5) },
    ];
  }

  const conversations: Conversation[] = [];
  for (let index = 0; index < 20; index += 1) {
    const state: Conversation["state"] = index < 8 ? "aberta" : index < 12 ? "pendente" : "resolvida";
    const chn = channels[index % 4];
    const contact = contacts[index];
    if (!chn || !contact) continue;
    // A aba de Canal do registro sai dos Identificadores do Contato. Uma
    // Conversa num Canal que ele não tem seria Conversa que ninguém vê.
    const tipoDeIdentificador = IDENTIFIER_OF_CHANNEL[chn.channelType];
    if (tipoDeIdentificador && !contact.identifiers.some((i) => i.type === tipoDeIdentificador)) {
      const valor =
        chn.channelType === "instagram"
          ? `@${contact.firstName.toLocaleLowerCase("pt-BR")}.${index}`
          : `sessao-${index + 1}`;
      contact.identifiers.push({
        id: `cid_${index + 1}c`,
        type: tipoDeIdentificador,
        value: valor,
        displayValue: valor,
        channelOriginId: chn.id,
        verified: true,
        principal: true,
        createdBy: SYSTEM,
        createdAt: at(280 - index * 6),
      });
    }
    const opening = index % 3 === 0 ? "Bom dia! Recebi a proposta e queria entender como funciona o acompanhamento dos casos." : index % 3 === 1 ? "Olá, o curso serve para quem já faz toxina mas nunca fez full face?" : "Preciso remarcar o treinamento da equipe comercial.";
    // A Conversa não resolvida precisa estar DENTRO da janela de resposta do
    // Tipo de Canal (RN-CXE-19), senão nada nela pode ser respondido livremente
    // e a Caixa de Entrada nasce inoperante. As resolvidas podem ser antigas.
    const receivedAt = state === "resolvida" ? at(5 - (index % 3), 10) : at(0, 4 - (index % 3));
    const messages: Message[] = [msg(`cnv_${index + 1}`, "recebida", { kind: "integration", id: chn.id }, opening, receivedAt)];
    if (index % 2 === 0) messages.push(msg(`cnv_${index + 1}`, "enviada", member("mem_julia"), "Bom dia! Consigo te enviar o cronograma ainda hoje.", at(0, 5 - (index % 3)), "lida"));
    if (index % 5 === 0) messages.push(msg(`cnv_${index + 1}`, "interna", member("mem_rafael"), "Cliente estratégico, priorizar.", at(0, 6 - (index % 3))));
    conversations.push({
      id: `cnv_${index + 1}`,
      workspaceId: WORKSPACE_ID,
      createdBy: SYSTEM,
      createdAt: receivedAt,
      lifecycle: "ativo",
      channelId: chn.id,
      contactId: contact.id,
      state,
      ...(chn.defaultQueueId ? { queueId: chn.defaultQueueId } : {}),
      ...(index % 3 !== 2 ? { assignee: member(index % 2 === 0 ? "mem_julia" : "mem_marcos") } : {}),
      title: opening.slice(0, 60),
      titleEdited: false,
      ...(index === 9 ? { snooze: { until: at(-2, 14), reason: "Cliente pediu retorno na quinta", by: member("mem_julia") } } : {}),
      drafts: [],
      starredBy: [],
      tagIds: [],
      fieldValues: [],
      participants: [{ id: nextId("prt"), subject: { kind: "contact", id: contact.id }, role: "contato", principal: true, enteredAt: receivedAt }],
      messages,
      ...(state === "resolvida" ? { resolvedAt: at(2, 16) } : {}),
      reopenCount: index === 13 ? 1 : 0,
    });
  }
  /**
   * A conversa de WhatsApp do Negócio `deal_sdr_1`: a abordagem do SDR, a
   * resposta do lead e a nota interna. É a tela de Negócio que o time usa como
   * referência — e uma coluna de conversa vazia ali não mostra o produto.
   */
  const wpp = channels[0];
  const iallas = contacts.find((c) => c.id === "cnt_35");
  if (wpp && iallas) {
    const inicio = at(0, 3);
    conversations.push({
      id: "cnv_sdr_1",
      workspaceId: WORKSPACE_ID,
      createdBy: SYSTEM,
      createdAt: inicio,
      lifecycle: "ativo",
      channelId: wpp.id,
      contactId: iallas.id,
      state: "aberta",
      ...(wpp.defaultQueueId ? { queueId: wpp.defaultQueueId } : {}),
      assignee: member("mem_thiago"),
      title: "Iallas, Full Face Avançado",
      titleEdited: false,
      drafts: [],
      starredBy: [],
      tagIds: [],
      fieldValues: [],
      participants: [
        { id: nextId("prt"), subject: { kind: "contact", id: iallas.id }, role: "contato", principal: true, enteredAt: inicio },
      ],
      /*
       * A conversa inteira, do primeiro contato à negociação, seguindo o
       * roteiro: abordagem, conexão (pedir permissão para perguntar), as seis
       * perguntas de qualificação, agendamento e passagem ao Closer.
       *
       * Ela existe porque a ficha do Negócio é a tela que o time usa para
       * julgar o produto, e uma conversa de quatro linhas não mostra o que o
       * processo faz. Cada resposta do Iallas é a origem de um Valor de Campo
       * gravado abaixo: dá para conferir de onde veio cada coisa.
       */
      messages: [
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Oi Iallas, tudo bem? Aqui é o Thiago, do Instituto Igor Alves. Vi que você comentou no post do Full Face. Você já faz harmonização na clínica hoje?", at(12, 9), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Oi Thiago, tudo bem! Faço toxina e um pouco de preenchimento labial, mas sempre no básico. Queria fazer o full face completo e trava.", at(12, 11)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "É onde a maioria trava mesmo. Posso te fazer algumas perguntas rápidas para entender se o curso faz sentido para o seu momento? Cinco minutos, e se não fizer sentido eu mesmo te digo.", at(12, 14), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Pode sim, fica à vontade.", at(12, 15)),

        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Primeiro para eu me situar: você é dentista ou médico, e há quanto tempo está na clínica?", at(11, 9), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Sou cirurgião-dentista, CRO ativo, e tenho clínica própria há quatro anos. Atendo umas 60 pessoas por mês.", at(11, 10)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "E dessas 60, quantas pedem alguma coisa de harmonização que hoje você acaba não fazendo?", at(11, 11), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Umas oito por mês perguntam por full face ou rinomodelação. Eu encaminho para uma colega porque não me sinto seguro no protocolo completo.", at(11, 13)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Esses encaminhamentos, dá para estimar quanto ficaria no seu caixa se ficassem com você?", at(11, 14), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Full face na minha região sai uns 4 mil. Se eu fechasse metade, seriam uns 16 mil por mês que estão indo embora.", at(11, 15)),
        msg("cnv_sdr_1", "interna", member("mem_thiago"), "Dor com número: 16 mil por mês em encaminhamento. O Elite se paga no primeiro mês, usar isso na call.", at(11, 16)),

        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Faz sentido. Se você for escolher um curso para isso, o que vai pesar na sua decisão?", at(9, 10), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Duas coisas. Quero ver caso real do começo ao fim, não só teoria, porque já fiz curso que só mostra slide. E preciso de alguém para tirar dúvida quando eu for aplicar no meu paciente.", at(9, 12)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Anotei as duas. E essa decisão é só sua ou tem mais alguém junto?", at(9, 13), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "A decisão é minha, mas eu converso com a minha esposa, que cuida do financeiro da clínica.", at(9, 14)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Perfeito, aí a gente já deixa a proposta no formato que ela precisa ver. Você tem uma faixa de investimento em mente para este ano?", at(9, 15), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Eu separei uns 10 mil para capacitação. Consigo esticar se o retorno estiver claro.", at(9, 16)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Dá para trabalhar dentro disso. E para quando você quer estar aplicando o protocolo completo?", at(9, 17), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Queria começar a atender full face até o fim do ano. Janeiro é quando enche de paciente querendo se cuidar.", at(9, 18)),

        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Iallas, pelo que você me contou faz muito sentido a gente seguir. Quero te mostrar o acompanhamento dos 10 pacientes e como funciona a mentoria, com o seu caso na tela. Consigo quinta às 10h, uns 40 minutos. Funciona para você?", at(7, 10), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Quinta às 10h está ótimo. Posso chamar a minha esposa junto?", at(7, 11)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Melhor ainda, chama ela sim. Vou mandar o convite agora e um resumo do que conversamos para vocês dois.", at(7, 12), "lida"),
        msg("cnv_sdr_1", "interna", member("mem_thiago"), "Qualificado, com o roteiro preenchido. A Camila, que cuida do financeiro, vem na call, o que encurta o ciclo.", at(7, 12)),

        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Iallas, bom dia! Obrigado pelo tempo de ontem, a call rendeu. Estou finalizando a proposta do Elite, com os 10 casos e as quatro mentorias que a gente falou.", at(1, 9), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Bom dia Thiago! Gostamos bastante. Ela só ficou com uma dúvida sobre o parcelamento.", at(1, 10)),
        msg("cnv_sdr_1", "enviada", member("mem_thiago"), "Fica em 12x de R$ 1.757,89 no cartão, ou R$ 16.997 à vista. A garantia é de 7 dias, então dá para entrar, ver o conteúdo e decidir sem risco. Mandei a proposta no seu e-mail agora.", at(0, 9), "lida"),
        msg("cnv_sdr_1", "recebida", { kind: "integration", id: wpp.id }, "Recebi. Vou falar com ela hoje à tarde e te dou um retorno até sexta.", at(0, 11)),
      ],
      reopenCount: 0,
    });
  }

  /**
   * Um registro de cada família na lixeira. Sem eles, as restaurações existem no
   * código e não têm linha na tela: a lixeira só mostraria Tarefas, e o botão
   * das outras famílias nunca seria clicado.
   */
  const conversaNaLixeira = conversations.find((c) => c.state === "resolvida");
  if (conversaNaLixeira) {
    conversaNaLixeira.lifecycle = "naLixeira";
    conversaNaLixeira.trashedAt = at(7);
  }
  const contatoNaLixeira = contacts.find(
    (c) => c.lifecycle === "ativo" && c.id !== "cnt_2" && !conversations.some((cv) => cv.contactId === c.id),
  );
  if (contatoNaLixeira) {
    contatoNaLixeira.lifecycle = "naLixeira";
    contatoNaLixeira.lifecycleBeforeTrash = "ativo";
    contatoNaLixeira.trashedAt = at(8);
  }
  const empresaNaLixeira = companies.find(
    (c) =>
      c.lifecycle === "ativo" &&
      !companies.some((filial) => filial.parentCompanyId === c.id) &&
      !deals.some((d) => d.companyId === c.id && d.situation === "aberto"),
  );
  if (empresaNaLixeira) {
    empresaNaLixeira.lifecycle = "naLixeira";
    empresaNaLixeira.lifecycleBeforeTrash = "ativo";
    empresaNaLixeira.trashedAt = at(11);
  }
  const negocioNaLixeira = deals.find((d) => d.situation === "perdido" && d.lifecycle === "ativo");
  if (negocioNaLixeira) {
    negocioNaLixeira.lifecycle = "naLixeira";
    negocioNaLixeira.lifecycleBeforeTrash = "ativo";
    negocioNaLixeira.trashedAt = at(13);
  }

  // A Conversa do fluxo 5: Rascunho de IA à espera de uso (B66).
  const conversaMarina = conversations[0];
  if (conversaMarina) {
    conversaMarina.contactId = "cnt_2";
    conversaMarina.assignee = member("mem_thiago");
    conversaMarina.drafts.push({
      actor: agentRef("agt_sdr"),
      content: "Oi, Marina! A turma começa na primeira semana de outubro e o acompanhamento dos casos dura 90 dias. Posso reservar a sua vaga?",
      origin: "agente",
      executionId: "exe_1",
      at: at(0, 10),
    });
  }

  // ── Os Contatos-cliente de Contas a receber (eram criados por `applyContasAReceber`) ──
  const clienteDeContasAReceber = (id: Id, firstName: string, lastName: string, ownerMemberId: Id, email: string): Contact => ({
    id,
    workspaceId: WORKSPACE_ID,
    createdBy: member(ownerMemberId),
    createdAt: at(260),
    lifecycle: "ativo",
    firstName,
    lastName,
    ownerMemberId,
    creationMode: "manual",
    qualificationId: "cat_qual_cli",
    description: "",
    identifiers: [{ id: `cid_${id}`, type: "email", value: email, displayValue: email, verified: true, principal: true, createdBy: member(ownerMemberId), createdAt: at(260) }],
    consents: [],
    addresses: [],
    tagIds: [],
    fieldValues: [],
    comments: [],
  });
  contacts.push(
    clienteDeContasAReceber("cnt_cr_helena", "Helena", "Vasconcelos", CR.comercialId, "helena.vasconcelos@exemplo.com.br"),
    clienteDeContasAReceber("cnt_cr_ricardo", "Ricardo", "Tavares", CR.comercialId, "financeiro@tavaresclinica.exemplo.com.br"),
    clienteDeContasAReceber("cnt_cr_camila", "Camila", "Duarte", "mem_rafael", "camila.duarte@exemplo.com.br"),
    clienteDeContasAReceber("cnt_cr_otavio", "Otávio", "Ramires", "mem_rafael", "otavio.ramires@exemplo.com.br"),
  );

  // ── As coleções voltam ao estado ────────────────────────────────────────
  estado.contacts.push(...contacts);
  estado.companies.push(...companies);
  estado.deals.push(...deals);
  estado.funnels.push(...funnels);
  estado.contactCompanyLinks.push(...contactCompanyLinks);
  estado.companyCompanyLinks.push({ id: "ccl_1", fromCompanyId: "cmp_4", toCompanyId: "cmp_7", kind: "parceira", createdAt: at(120) });
  estado.distinctFromLinks.push({ id: "dfl_1", contactAId: "cnt_11", contactBId: "cnt_23", createdBy: member("mem_julia"), createdAt: at(45) });
  estado.channels.push(...channels);
  // As Conversas do CRM vinham antes das de Grupo (que o seed novo mantém).
  estado.conversations.unshift(...conversations);

  // ── O que as Ferramentas faziam sobre o CRM antigo ──────────────────────
  // O Canal de WhatsApp passa a ter Grupos habilitados.
  const canalDeWhatsapp = estado.channels.find((c) => c.id === "chn_wpp");
  if (canalDeWhatsapp) canalDeWhatsapp.groupsEnabled = true;
  // Quem está numa Turma ganha a Tag "Em grupo de alunos".
  for (const grupoId of ["grp_turma_01", "grp_turma_02", "grp_turma_03"]) {
    for (const p of estado.grupos.find((g) => g.id === grupoId)?.participacoes ?? []) {
      const c = p.contactId ? estado.contacts.find((x) => x.id === p.contactId) : undefined;
      if (c && p.saidaEm === undefined && !c.tagIds.includes("tag_aluno_grupo")) c.tagIds.push("tag_aluno_grupo");
    }
  }
  enviarFlowNasConversas(estado);
  // A resposta do Contato `cnt_10` na Conversa da Turma #02 apontava o Identificador de WhatsApp dele.
  const via10 = estado.contacts.find((c) => c.id === "cnt_10")?.identifiers.find((i) => i.type === "identidadeDeWhatsApp");
  const respostaDe10 = estado.conversations.find((c) => c.id === "cnv_grp_turma_02")?.messages.find((m) => m.direction === "recebida" && m.viaIdentifierId === undefined);
  if (via10 && respostaDe10) Object.assign(respostaDe10, { viaIdentifierId: via10.id });

  // ── Atividade do CRM (era `seedActivity`) ───────────────────────────────
  semearAtividadeDoCrm(estado);

  // ── A Pasta "Meus negócios" e uma Lista por Funil ───────────────────────
  espelharFunis(estado);
  return estado;
}

/** Envios e Respostas do Flow nas Conversas do WhatsApp (eram de `applyFerramentas`). */
function enviarFlowNasConversas(estado: DataState): void {
  const CANAL = "chn_wpp";
  const flow = estado.flows.find((f) => f.id === FLOW_TRIAGEM_ID);
  const v1 = flow?.versoes.find((v) => v.numero === 1);
  if (!flow || !v1) return;
  const envio = (conversa: Conversation, quando: string, respondeu: { formacao: string; cidade: string } | undefined, quandoRespondeu: string) => {
    const enviada: Message = {
      id: nextId("msg"),
      conversationId: conversa.id,
      direction: "enviada",
      actor: member("mem_julia"),
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
    const c = estado.contacts.find((x) => x.id === conversa.contactId);
    const via = c?.identifiers.find((i) => i.type === "identidadeDeWhatsApp");
    conversa.messages.push({
      id: nextId("msg"),
      conversationId: conversa.id,
      direction: "recebida",
      actor: { kind: "integration", id: CANAL },
      ...(via ? { viaIdentifierId: via.id } : {}),
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
  const conversa = (id: Id) => estado.conversations.find((c) => c.id === id && c.channelId === CANAL);
  const cnv5 = conversa("cnv_5");
  const cnv9 = conversa("cnv_9");
  const cnv13 = conversa("cnv_13");
  const cnv17 = conversa("cnv_17");
  if (cnv5) envio(cnv5, at(20, 10), { formacao: "dentista", cidade: "Campinas" }, at(20, 11));
  if (cnv9) envio(cnv9, at(14, 15), { formacao: "biomedico", cidade: "Santo André" }, at(13, 9));
  if (cnv13) envio(cnv13, at(6, 9), { formacao: "medico", cidade: "São Paulo" }, at(6, 10));
  if (cnv17) envio(cnv17, at(1, 16), undefined, "");
  recordActivity(estado, { actor: member("mem_julia"), action: "Flow enviado", objectType: "flow", objectId: flow.id, objectName: flow.nome, at: at(1, 16), detail: `v1 · ${cnv17?.title ?? ""}` });
  recordActivity(estado, { actor: SYSTEM, action: "Resposta de Flow recebida", objectType: "flow", objectId: flow.id, objectName: flow.nome, at: at(6, 10), detail: `v1 · ${cnv13 ? (estado.contacts.find((c) => c.id === cnv13.contactId)?.firstName ?? "") : ""}` });
}

/** Os Registros de Atividade de Negócio, Contato e Conversa que `seedActivity` derivava do CRM. */
function semearAtividadeDoCrm(estado: DataState): void {
  const records: ActivityRecord[] = [];
  const add = (
    actor: ActorRef,
    action: string,
    objectType: string,
    objectId: Id,
    objectName: string,
    when: string,
    change?: { readonly before?: string; readonly after?: string },
  ) => {
    records.push({
      id: nextId("act"),
      workspaceId: WORKSPACE_ID,
      actor,
      action,
      objectType,
      objectId,
      objectName,
      at: when,
      result: "ok",
      ...(change?.before ? { before: change.before } : {}),
      ...(change?.after ? { after: change.after } : {}),
    });
  };
  for (const deal of estado.deals) {
    add(deal.createdBy, "Negócio criado", "deal", deal.id, deal.title, deal.createdAt);
    for (const transition of deal.stageHistory) {
      const mudouDeFunil =
        transition.fromFunnelId !== undefined && transition.fromFunnelId !== transition.toFunnelId;
      const ondeFica = (funilId: Id | undefined, etapa: string) => {
        const funil = estado.funnels.find((f) => f.id === funilId);
        return mudouDeFunil && funil ? `${funil.name} · ${etapa}` : etapa;
      };
      add(
        transition.actor,
        mudouDeFunil ? "Negócio mudou de Funil" : "Negócio entrou em Etapa",
        "deal",
        deal.id,
        deal.title,
        transition.at,
        {
          ...(transition.fromStageName
            ? { before: ondeFica(transition.fromFunnelId, transition.fromStageName) }
            : {}),
          after: ondeFica(transition.toFunnelId, transition.toStageName),
        },
      );
    }
    if (deal.situation === "ganho") add(member(deal.ownerMemberId), "Negócio marcado como ganho", "deal", deal.id, deal.title, deal.closedAt ?? deal.createdAt);
    if (deal.situation === "perdido") add(member(deal.ownerMemberId), "Negócio marcado como perdido", "deal", deal.id, deal.title, deal.closedAt ?? deal.createdAt);
  }
  for (const contact of estado.contacts) {
    // Os clientes de Contas a receber nasceram depois da Atividade genérica e nunca tiveram "Contato criado".
    if (contact.id.startsWith("cnt_cr_")) continue;
    const name = `${contact.firstName} ${contact.lastName}`.trim() || "Contato sem nome";
    add(contact.createdBy, "Contato criado", "contact", contact.id, name, contact.createdAt);
  }
  for (const conversation of estado.conversations) {
    // As Conversas de Grupo nunca entraram na Atividade de Conversa: nasceram depois, nas Ferramentas.
    if (conversation.groupIdentifier !== undefined) continue;
    add(SYSTEM, "Conversa criada por Mensagem recebida", "conversation", conversation.id, conversation.title, conversation.createdAt);
    if (conversation.assignee) add(member("mem_julia"), "Conversa atribuída", "conversation", conversation.id, conversation.title, conversation.createdAt);
    if (conversation.state === "resolvida") add(member("mem_julia"), "Conversa resolvida", "conversation", conversation.id, conversation.title, conversation.resolvedAt ?? conversation.createdAt);
  }
  records.sort((a, b) => b.at.localeCompare(a.at));
  estado.activity.push(...records);
}


/** A Pasta espelho, a Lista de cada Funil e uma Tarefa por Negócio (era `applyEspelhoComercial`; o atalho da Caixa de entrada ficou no seed). */
function espelharFunis(state: DataState): void {
  const workspaceId = WORKSPACE_ID;
  const spaceId = "spc_com";
  const folderId = MEUS_NEGOCIOS_ID;
  state.folders.push({
    id: folderId,
    workspaceId,
    createdBy: member("mem_julia"),
    createdAt: at(200),
    lifecycle: "ativo",
    name: "Meus negócios",
    description: "Uma Lista por Funil de Negócios, com as Etapas como Status e cada Negócio como Tarefa.",
    order: 3,
    isPrivate: false,
    modes: {},
    blocks: {},
    parentType: "space",
    parentId: spaceId,
  });
  const funnels = state.funnels.filter((f) => f.lifecycle === "ativo").sort((a, b) => a.order - b.order);
  let readable = 1;
  for (const [ordem, funnel] of funnels.entries()) {
    const listId = `lst_funil_${funnel.id.replace(/^fnl_/, "")}`;
    const stages = [...funnel.stages].sort((a, b) => a.order - b.order);
    const definitions: StatusDefinition[] = [
      ...stages.map((s, i) => ({
        id: `st_${listId}_${s.id}`,
        name: s.name,
        color: s.color ?? STAGE_COLORS[i % STAGE_COLORS.length] ?? "#94a3b8",
        category: (i === 0 ? "naoIniciado" : "emAndamento") as StatusDefinition["category"],
        order: i,
      })),
      { id: `st_${listId}_ganho`, name: "Ganho", color: "#22c55e", category: "concluido", order: stages.length },
      { id: `st_${listId}_perdido`, name: "Perdido", color: "#64748b", category: "fechado", order: stages.length + 1 },
    ];
    state.lists.push({
      id: listId,
      workspaceId,
      createdBy: member("mem_julia"),
      createdAt: at(200),
      lifecycle: "ativo",
      name: funnel.name,
      description: `Espelho do Funil ${funnel.name}: Etapas como Status, Negócios como Tarefas.`,
      order: ordem,
      isPrivate: false,
      // C35 — o espelho é o caso particular da Lista conversacional: com Negócio obrigatório.
      modeloDeTarefa: "conversacional",
      // C36 — por onde cada Funil atende (o WhatsApp em todos; o resto conforme a etapa do comercial).
      canaisDeAtendimento: CANAIS_DO_FUNIL[funnel.id] ?? ["chn_wpp"],
      modes: { statusSet: "sobrescrito" },
      statusSet: { id: `sts_${listId}`, definitions },
      // Negócio não tem Subtarefa nem Checklist aqui: a Tarefa é o cartão do Kanban.
      features: { subtarefas: false, checklists: false },
      parentType: "folder",
      parentId: folderId,
    });
    // Kanban por padrão: a Visualização compartilhada e padrão da Lista é o Quadro.
    state.views.push({
      id: `viw_${listId}_quadro`,
      name: "Quadro do Funil",
      kind: "quadro",
      ownerKind: "container",
      ownerId: listId,
      listId,
      filters: {},
      isDefault: true,
      createdBy: "mem_julia",
      createdAt: at(200),
    });

    const deals = state.deals.filter((d) => d.funnelId === funnel.id && d.lifecycle === "ativo");
    for (const [i, deal] of deals.entries()) {
      const statusId = deal.situation === "ganho" ? `st_${listId}_ganho` : deal.situation === "perdido" ? `st_${listId}_perdido` : `st_${listId}_${deal.stageId}`;
      const task: Task = {
        id: `tsk_${listId}_${deal.id}`,
        workspaceId,
        createdBy: deal.createdBy,
        createdAt: deal.createdAt,
        lifecycle: "ativo",
        listId,
        siblingOrder: i,
        readableId: `NEG-${String(readable).padStart(3, "0")}`,
        title: deal.title,
        description: deal.object,
        statusId,
        taskTypeId: "tt_tarefa_com",
        priority: "normal",
        ...(deal.expectedCloseDate ? { dueDate: { form: "civilDay", value: deal.expectedCloseDate } } : {}),
        ...(deal.closedAt ? { completedAt: deal.closedAt } : {}),
        assignees: [member(deal.ownerMemberId)],
        observerMemberIds: [],
        tagIds: [],
        fieldValues: [],
        checklists: [],
        timeEntries: [],
        dependencies: [],
        attachments: [],
        comments: [],
        provenance: { kind: "deal", sourceId: deal.id, sourceName: deal.title, at: deal.createdAt },
        updatedAt: deal.createdAt,
      };
      readable += 1;
      state.tasks.push(task);
      state.links.push({ id: `lnk_${task.id}`, fromType: "task", fromId: task.id, toType: "deal", toId: deal.id, role: "espelho do Negócio", createdBy: deal.createdBy, createdAt: deal.createdAt });
      // A Lista é conversacional: o cartão mostra o Contato principal do Negócio.
      const principal = deal.contactLinks.find((l) => l.principal) ?? deal.contactLinks[0];
      if (principal) {
        state.links.push({ id: `lnk_${task.id}_contato`, fromType: "task", fromId: task.id, toType: "contact", toId: principal.contactId, role: "contato da Tarefa", createdBy: deal.createdBy, createdAt: deal.createdAt });
      }
    }
  }
}
