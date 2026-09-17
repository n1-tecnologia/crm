/**
 * (22, 7.2) — o que cada Tipo de Canal admite em Ativos de Canal. É fixo
 * pelo Tipo, como as Capacidades de Canal do documento 14: nem o Canal nem o
 * Grupo redefinem. Só o WhatsApp tem grupos administráveis, comunidades e
 * formulários interativos hoje.
 */

import type { ChannelType } from "../../types";

export interface CapacidadesDeAtivos {
  readonly gruposAdministraveis: boolean;
  readonly comunidades: boolean;
  readonly formulariosInterativos: boolean;
  /** Limite de participantes do provedor (24, 6). */
  readonly capacidadeDoGrupo: number;
  /** Incluindo o Grupo de avisos (25, 6). */
  readonly limiteDeGruposPorComunidade: number;
  readonly limiteDoNome: number;
  readonly limiteDaDescricao: number;
  /** Versão de esquema do provedor que o catálogo de Componentes segue (23, 6.2). */
  readonly versaoDeEsquemaDoFlow: string;
}

const NENHUMA: CapacidadesDeAtivos = {
  gruposAdministraveis: false,
  comunidades: false,
  formulariosInterativos: false,
  capacidadeDoGrupo: 0,
  limiteDeGruposPorComunidade: 0,
  limiteDoNome: 100,
  limiteDaDescricao: 2048,
  versaoDeEsquemaDoFlow: "",
};

export const CAPACIDADES_DE_ATIVOS: Record<ChannelType, CapacidadesDeAtivos> = {
  whatsapp: {
    gruposAdministraveis: true,
    comunidades: true,
    formulariosInterativos: true,
    capacidadeDoGrupo: 1024,
    limiteDeGruposPorComunidade: 100,
    limiteDoNome: 100,
    limiteDaDescricao: 2048,
    versaoDeEsquemaDoFlow: "7.3",
  },
  instagram: NENHUMA,
  linkedin: NENHUMA,
  email: NENHUMA,
  chatDoSite: NENHUMA,
};

/** C33 — Limite imposto de Grupos por Espaço de Trabalho; verificado ANTES de criar ou importar. */
export const LIMITE_DE_GRUPOS_POR_ESPACO = 200;

/** O esquema que a plataforma constrói hoje; um Flow novo nasce nele. */
export const VERSAO_DE_ESQUEMA_CORRENTE = "7.3";
