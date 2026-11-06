/**
 * As operações da Estrutura (Listas e Templates de Lista) que conferem os
 * Canais de atendimento contra `plataforma.canais`: o Canal só existe lá, e a
 * projeção que o levava ao estado antigo saiu no 15-33 (3.5.4). Fase 14 (3.3.7) e Fase 15 (D-15-07).
 *
 * O `canais` que o navegador mandou (último argumento, só para a execução
 * local) é DESCARTADO: a posição é sobrescrita com o que o servidor leu, deste
 * Espaço, em qualquer estado (Pitfall 12, T-14-29). Quem decide se o Canal
 * está ativo e é de atendimento é o domínio, com esse conjunto.
 *
 * `posicao` é o índice em `args`: `[listId, ids, canais]` (`definirCanaisDaLista`),
 * `[input, canais]` (`createList`) e `[templateId, input, canais]`
 * (`instantiateListTemplate`).
 */

import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import type { LeituraDoCrm, TabelaDeLeituras } from "./tipos";

/** A leitura dos Canais do Espaço, igual para as três operações; só a posição muda. */
const leituraDosCanais = (posicao: number): LeituraDoCrm => ({
  posicao,
  ler: async (cliente, workspaceId) => ({ canais: await criarRepositorioDeCanaisPg(cliente).todos(workspaceId) }),
  argumento: (lido) => lido.canais,
});

export const LER_DO_CRM_DA_ESTRUTURA: TabelaDeLeituras = {
  definirCanaisDaLista: leituraDosCanais(2),
  createList: leituraDosCanais(1),
  instantiateListTemplate: leituraDosCanais(2),
};
