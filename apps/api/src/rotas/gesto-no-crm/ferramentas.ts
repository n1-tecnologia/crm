/**
 * Gesto misto de Ferramentas: nasce VAZIO no plano 15-01 e os planos 15-07 e 15-17 o preenche.
 * Fica num arquivo próprio para que os planos paralelos da onda 2 a 4 não
 * disputem o mesmo arquivo (posse de arquivo entre planos); `index.ts` compõe.
 */

import type { TabelaDeConfirmacoes, TabelaDeLeituras } from "./tipos";

export const LER_DO_CRM_FERRAMENTAS: TabelaDeLeituras = {};

export const AO_CONFIRMAR_FERRAMENTAS: TabelaDeConfirmacoes = {};
