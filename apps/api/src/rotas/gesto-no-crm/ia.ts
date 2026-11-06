/**
 * Gesto misto de IA: nasce VAZIO no plano 15-01 e o plano 15-08 o preenche.
 * Fica num arquivo próprio para que os planos paralelos da onda 2 a 4 não
 * disputem o mesmo arquivo (posse de arquivo entre planos); `index.ts` compõe.
 */

import type { TabelaDeConfirmacoes, TabelaDeLeituras } from "./tipos";

export const LER_DO_CRM_IA: TabelaDeLeituras = {};

export const AO_CONFIRMAR_IA: TabelaDeConfirmacoes = {};
