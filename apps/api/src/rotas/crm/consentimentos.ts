/**
 * ESQUELETO do RED (14-08): as rotas de consentimento ainda não existem.
 */

import type { FastifyInstance } from "fastify";
import type { ServicoDeConsentimentos } from "../../servicos/crm/consentimentos";

export async function rotasDeConsentimentos(_app: FastifyInstance, _opcoes: { readonly servico: ServicoDeConsentimentos }): Promise<void> {}
