/**
 * Catálogo de configuração da Lista "Solicitações de pagamento"
 * (`docs/07-processos/solicitacao-de-pagamento.md`), ao lado de "Contas a
 * pagar" na mesma Pasta "Financeiro" (D-01, D-06 da spec). Este arquivo é a
 * tradução literal daquele documento para dado tipado: quatro Status, os 25
 * Campos na ordem A..Z, a Tag única, os cinco Papéis e a configuração de
 * roteamento do aprovador por Centro de Custo e Valor.
 *
 * Divergir deste catálogo é divergir do processo real — cada bloco carrega o
 * comentário da seção da spec de onde veio. Nada aqui é função nem I/O: é
 * dado puro, consumido pelo evolver que materializa a Lista de verdade no
 * `DataState` (Plan 02-08) e por `resolverAprovador`, a única leitura
 * derivada exportada daqui.
 *
 * D-01 sobrepõe a enumeração preliminar de CON-04 em REQUIREMENTS.md: os
 * quatro Status abaixo são os únicos oficiais. Criar `em revisão`,
 * `convertida`, `recebida` ou `em validação` nesta fase é erro (D-14) — a
 * Solicitação termina em `aprovado`; a Conta a pagar e o Vínculo estruturado
 * são Fase 3.
 */

import type { FieldType, Id, PermissionAction, StatusSet } from "./types";

/* ── Ids literais e estáveis (nunca `nextId`) ─────────────────────────── */

export const SOL = {
  status: {
    paraFazer: "sts_sp_para_fazer",
    emAprovacao: "sts_sp_em_aprovacao",
    naoAprovado: "sts_sp_nao_aprovado",
    aprovado: "sts_sp_aprovado",
  },
  tags: {
    contaTria: "tag_sp_conta_tria",
  },
  papeis: {
    solicitante: "rol_sp_solicitante",
    aprovador: "rol_sp_aprovador",
    financeiro: "rol_sp_financeiro",
    revisorResumo: "rol_sp_revisor_resumo",
    agentePipeline: "rol_sp_agente_pipeline",
  },
} as const;

/* ── Status (§3) ───────────────────────────────────────────────────────── */
//
// Quatro Definições, nesta ordem exata: `para fazer` → `em aprovação` →
// `não aprovado` → `aprovado`. `para fazer` é o inicial (categoria
// `naoIniciado`); `não aprovado` e `aprovado` são terminais (categorias
// `concluido` e `fechado` — a ontologia não tem um campo "terminal" à parte,
// a categoria já carrega esse significado, A4.3). Cores do mesmo vocabulário
// de tokens que `seed-financeiro.ts` usa para a Lista irmã "Contas a pagar" —
// nada de hex novo.
//
// `em revisão` — específico da Lista MP/FO (OQ-CMP-02 da spec) — e
// `convertida`/`recebida`/`em validação` — enumeração preliminar de CON-04 —
// NÃO entram aqui: é a proibição de D-01/D-14, não um esquecimento.

export const STATUS_SET_SOLICITACAO_DE_PAGAMENTO: StatusSet = {
  id: "sts_solicitacao_de_pagamento",
  definitions: [
    { id: SOL.status.paraFazer, name: "para fazer", color: "#94a3b8", category: "naoIniciado", order: 0 },
    { id: SOL.status.emAprovacao, name: "em aprovação", color: "#3b82f6", category: "emAndamento", order: 1 },
    { id: SOL.status.naoAprovado, name: "não aprovado", color: "#ef4444", category: "concluido", order: 2 },
    { id: SOL.status.aprovado, name: "aprovado", color: "#166534", category: "fechado", order: 3 },
  ],
};

/* ── Tags (§5) ─────────────────────────────────────────────────────────── */
//
// Uma única ocorrência de Tag em toda a amostra das 19 Tarefas: `conta
// tria`. As oito Tags `conta *` de `contas-a-pagar.md` §5 (uma por conta
// bancária/empresa) NÃO são replicadas aqui — nesta Lista o eixo "de qual
// conta sai o dinheiro" é calculado por `computeTaskTag` (`automation/`,
// `payment-rules.ts`) já do lado de Contas a pagar, não configurado na
// Solicitação.

export interface TagDaSolicitacao {
  readonly id: Id;
  readonly nome: string;
  readonly cor: string;
}

export const TAGS_SOLICITACAO_DE_PAGAMENTO: readonly TagDaSolicitacao[] = [
  { id: SOL.tags.contaTria, nome: "conta tria", cor: "#0f766e" },
];

/* ── Papéis (§10) ──────────────────────────────────────────────────────── */
//
// Cinco Papéis da Lista. `capacidades` é a lista de ações que a tabela de
// permissões concede; `escopo` é o recorte de QUAIS Solicitações essas
// capacidades alcançam — a mesma distinção que a tabela do §10 faz entre
// "sem restrição" (Financeiro), "só as próprias" (Solicitante), "só as
// roteadas" (Aprovador) e "só as já aprovadas" (Revisor do RESUMO). Isto não
// é uma Grant já aplicada a um Membro: é o catálogo que o evolver (Plan
// 02-08) usa para gerar as Grants reais quando a Lista nasce.
//
// D-13 — `ocupantesPadrao` de "Revisor do RESUMO" fica vazio de propósito:
// Maryane e Liliane entram por convite/atribuição quando suas identidades
// estiverem resolvidas (§12, L-11 da spec), nunca por um array de ids
// hand-authored neste arquivo.

export interface PapelDaSolicitacao {
  readonly id: Id;
  readonly nome: string;
  readonly capacidades: readonly PermissionAction[];
  readonly escopo: "proprias" | "roteadas" | "aprovadas" | "todas";
  /** Só preenchido quando `capacidades` inclui `"editar"` mas restrito a um único atributo. */
  readonly editarRestritoA?: "status";
  readonly ocupantesPadrao: readonly Id[];
}

export const PAPEIS_SOLICITACAO_DE_PAGAMENTO: readonly PapelDaSolicitacao[] = [
  {
    id: SOL.papeis.solicitante,
    nome: "Solicitante",
    capacidades: ["ver", "criar", "comentar"],
    escopo: "proprias",
    ocupantesPadrao: [],
  },
  {
    id: SOL.papeis.aprovador,
    nome: "Aprovador",
    capacidades: ["ver", "comentar"],
    escopo: "roteadas",
    ocupantesPadrao: [],
  },
  {
    id: SOL.papeis.financeiro,
    nome: "Financeiro",
    capacidades: ["ver", "criar", "editar", "comentar", "excluir", "administrar"],
    escopo: "todas",
    ocupantesPadrao: [],
  },
  {
    id: SOL.papeis.revisorResumo,
    nome: "Revisor do RESUMO",
    capacidades: ["ver", "comentar"],
    escopo: "aprovadas",
    // D-13 — nunca a lista de ids da Maryane/Liliane aqui.
    ocupantesPadrao: [],
  },
  {
    id: SOL.papeis.agentePipeline,
    nome: "Agente do pipeline",
    capacidades: ["ver", "comentar", "editar"],
    escopo: "todas",
    // §9 — Convidado com `editar` restrito a Status; não edita os demais Campos.
    editarRestritoA: "status",
    ocupantesPadrao: [],
  },
];

/* ── Campos (§4), 25 Definições na ordem A..Z ─────────────────────────── */
//
// O prefixo de letra é ordem de exibição, nunca parte do rótulo (a spec diz
// isso explicitamente em §4). `ordem` é a posição sequencial entre os 25
// Campos existentes (a letra V não é usada por nenhum Campo da Lista real —
// a sequência A..Z-menos-V fica 1..25, crescente e sem buraco).
//
// Nenhum Campo além destes 25; nenhuma obrigatoriedade além de `Centro de
// Custo` (RN-SP-01) — documento/anexo/pagamento continuam sendo validação do
// pipeline (§11, RN-SP-02/RN-SP-06), não obrigatoriedade de UI.

export interface CampoDaSolicitacao {
  readonly id: Id;
  readonly ordem: number;
  readonly rotulo: string;
  readonly tipo: FieldType;
  readonly obrigatorio: boolean;
  readonly opcoes?: readonly string[];
  readonly descricao?: string;
  /** Marca uma lacuna real da spec (opções não enumeradas) — nunca preencher com dado inventado. */
  readonly lacuna?: string;
}

// §4.1 — mesmas 16 opções literais da Lista real (`fields.json`).
const OPCOES_CENTRO_DE_CUSTO = [
  "Marcos Paulo", "Renato Cariani", "Igor Alves", "Kaka Diniz", "PLX Apoio", "TRIA",
  "Anthony Miranda", "Tria Tech", "IVL", "Roberth Resende", "Presidência", "USI",
  "Konq", "Auton Health", "Kops", "Inevitaveis",
] as const;

// §4.1 — 13 opções.
const OPCOES_BU = [
  "Roberth Resende", "Igor Alves", "CLAIRIS", "Marcos Paulo", "Instituto Visão Livre",
  "Renato Cariani", "TRIA - Apoio Funcional", "Kaka Diniz", "Iallas Oliveira", "Tria Tech",
  "Expert Lucrativo", "KONQ", "Auton Heath",
] as const;

// §4.1 — 11 opções.
const OPCOES_EMPRESA = [
  "Tria Company", "Oliveira Participações", "EXO Loteamento", "EXO Participações", "Loovi",
  "PLX digital", "IVL", "USI", "Konq Intermediações", "O2", "Inevitaveis",
] as const;

// §4.1 — 24 opções.
const OPCOES_CATEGORIA_DE_PAGAMENTO = [
  "Distribuição de Lucro", "Impostos", "Prestação de Serviços", "Móveis e Utensílios",
  "Administrativo", "Evento", "Contas de consumo", "A identificar", "Cursos e treinamentos",
  "Comissão", "Tráfego Pago", "Ferramentas", "Insumos", "Viagens e Hospedagens", "Aporte",
  "Aluguel", "Tarifas", "Ação Gente e Cultura", "Devolução/Estorno de venda", "Editora",
  "Correios e Transportadora", "Doação", "Publicidade de Marca / Patrocínio", "Salário",
] as const;

// §4.2 — Fornecedor: 2 opções.
const OPCOES_FORNECEDOR = ["CPF", "CNPJ"] as const;

// §4.4 — Forma de pagamento: as 3 observadas + `Cartão` como quarta opção
// (D-08 — o código do `automation/` já reconhece Cartão como método real;
// só está ausente desta amostra de 19 Tarefas por raridade, não por não
// existir).
const OPCOES_FORMA_DE_PAGAMENTO = ["Chave Pix", "Boleto", "QRCode Pix", "Cartão"] as const;

// §4.5 — Integração manual: 1 opção.
const OPCOES_INTEGRACAO_MANUAL = ["Manual"] as const;

export const CAMPOS_SOLICITACAO_DE_PAGAMENTO: readonly CampoDaSolicitacao[] = [
  // §4.1 — Classificação (quem paga, para quê).
  { id: "fld_sp_a_centro_de_custo", ordem: 1, rotulo: "Centro de Custo", tipo: "singleSelect", obrigatorio: true, opcoes: OPCOES_CENTRO_DE_CUSTO, descricao: "Quem paga (RN-SP-01: único obrigatório)." },
  { id: "fld_sp_b_bu", ordem: 2, rotulo: "BU", tipo: "singleSelect", obrigatorio: false, opcoes: OPCOES_BU },
  { id: "fld_sp_c_empresa", ordem: 3, rotulo: "Empresa", tipo: "singleSelect", obrigatorio: false, opcoes: OPCOES_EMPRESA },
  { id: "fld_sp_d_categoria_de_pagamento", ordem: 4, rotulo: "Categoria de pagamento", tipo: "singleSelect", obrigatorio: false, opcoes: OPCOES_CATEGORIA_DE_PAGAMENTO },

  // §4.2 — Fornecedor (a quem se paga).
  { id: "fld_sp_e_pessoa", ordem: 5, rotulo: "Pessoa", tipo: "person", obrigatorio: false, descricao: "Membro ou Convidado, único — quando o fornecedor é interno." },
  { id: "fld_sp_f_fornecedor", ordem: 6, rotulo: "Fornecedor", tipo: "singleSelect", obrigatorio: false, opcoes: OPCOES_FORNECEDOR },
  { id: "fld_sp_g_cnpj", ordem: 7, rotulo: "CNPJ", tipo: "text", obrigatorio: false },
  { id: "fld_sp_h_cpf", ordem: 8, rotulo: "CPF", tipo: "text", obrigatorio: false },
  { id: "fld_sp_i_nome_do_fornecedor", ordem: 9, rotulo: "Nome do fornecedor", tipo: "text", obrigatorio: false, descricao: "Quando a Pessoa não está no Espaço de Trabalho." },

  // §4.3 — Documento e datas.
  { id: "fld_sp_j_anexo", ordem: 10, rotulo: "Anexo", tipo: "file", obrigatorio: false, descricao: "Nota fiscal ou comprovante — o Agente do pipeline audita por IA (§6.2)." },
  { id: "fld_sp_k_data_de_emissao", ordem: 11, rotulo: "Data de Emissão", tipo: "date", obrigatorio: false },
  { id: "fld_sp_l_data_vencimento", ordem: 12, rotulo: "Data Vencimento", tipo: "date", obrigatorio: false },

  // §4.4 — Pagamento (como se paga).
  { id: "fld_sp_m_forma_de_pagamento", ordem: 13, rotulo: "Forma de pagamento", tipo: "singleSelect", obrigatorio: false, opcoes: OPCOES_FORMA_DE_PAGAMENTO },
  { id: "fld_sp_n_chave_pix", ordem: 14, rotulo: "Chave pix", tipo: "text", obrigatorio: false },
  { id: "fld_sp_o_codigo_de_barras", ordem: 15, rotulo: "Código de barras", tipo: "text", obrigatorio: false },
  { id: "fld_sp_p_pix_copia_e_cola", ordem: 16, rotulo: "Pix copia e cola", tipo: "text", obrigatorio: false },
  { id: "fld_sp_q_link_de_pagamento", ordem: 17, rotulo: "Link de pagamento", tipo: "url", obrigatorio: false },
  { id: "fld_sp_r_boleto", ordem: 18, rotulo: "Boleto", tipo: "file", obrigatorio: false },
  { id: "fld_sp_s_qr_code", ordem: 19, rotulo: "QR Code", tipo: "file", obrigatorio: false },
  { id: "fld_sp_t_valor", ordem: 20, rotulo: "Valor", tipo: "currency", obrigatorio: false, descricao: "Moeda BRL, 2 casas." },

  // §4.5 — Controle.
  { id: "fld_sp_u_integracao_manual", ordem: 21, rotulo: "Integração manual", tipo: "singleSelect", obrigatorio: false, opcoes: OPCOES_INTEGRACAO_MANUAL, descricao: "Marcado quando o lançamento deve pular a automação (Fluxo Manual, §6.5)." },
  // W-Equipe: Campo órfão preservado como está hoje (D-08) — mesmo padrão
  // observado em `contas-a-pagar.md` §12, sem uso registrado nas 19 Tarefas.
  { id: "fld_sp_w_equipe", ordem: 22, rotulo: "Equipe", tipo: "currency", obrigatorio: false },
  { id: "fld_sp_x_nome_do_solicitante", ordem: 23, rotulo: "Nome do solicitante", tipo: "text", obrigatorio: false, descricao: "Quem pediu o pagamento." },
  // LACUNA-SP-Y — a spec (§4.1) cita 63 opções de Produto sem enumerá-las.
  // Não inventar os 63 nomes: as opções reais vêm de `fields.json` exportado
  // (`apps/api/exportacoes/`) e são carregadas pelo evolver do Plan 02-08.
  { id: "fld_sp_y_produto", ordem: 24, rotulo: "Produto", tipo: "multiSelect", obrigatorio: false, opcoes: [], lacuna: "LACUNA-SP-Y" },
  { id: "fld_sp_z_whatsapp", ordem: 25, rotulo: "WhatsApp", tipo: "phone", obrigatorio: false, descricao: "Contato do solicitante." },
];

/* ── O catálogo (parcial — Roteamento entra na Task 3) ────────────────── */

export const CATALOGO_SOLICITACAO_DE_PAGAMENTO = {
  statusSet: STATUS_SET_SOLICITACAO_DE_PAGAMENTO,
  tags: TAGS_SOLICITACAO_DE_PAGAMENTO,
  papeis: PAPEIS_SOLICITACAO_DE_PAGAMENTO,
  campos: CAMPOS_SOLICITACAO_DE_PAGAMENTO,
};
