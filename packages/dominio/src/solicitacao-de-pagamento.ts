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

import type { Id, PermissionAction, StatusSet } from "./types";

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

/* ── O catálogo (parcial — Campos entram no Plan 02-06 Task 2, Roteamento na Task 3) */

export const CATALOGO_SOLICITACAO_DE_PAGAMENTO = {
  statusSet: STATUS_SET_SOLICITACAO_DE_PAGAMENTO,
  tags: TAGS_SOLICITACAO_DE_PAGAMENTO,
  papeis: PAPEIS_SOLICITACAO_DE_PAGAMENTO,
};
