/**
 * Rotas REST de Notas do Contato (14-06). Esqueleto do RED: nenhuma rota registrada.
 */

import type { FastifyInstance } from "fastify";
import type { ServicoDeNotas } from "../../servicos/crm/notas";

export async function rotasDeNotas(_app: FastifyInstance, _opcoes: { readonly servico: ServicoDeNotas }): Promise<void> {}
