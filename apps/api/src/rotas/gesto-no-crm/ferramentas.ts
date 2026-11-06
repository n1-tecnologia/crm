/**
 * O gesto misto das Ferramentas do Canal (Grupo, Comunidade, Flow): as
 * operações que conferem Canal e Contato contra as tabelas do CRM novo
 * (`plataforma.canais`, `plataforma.contatos`), não contra a projeção antiga do
 * estado, que some na 3.5.4. Fase 15, 3.4.8 (UCR-08).
 *
 * O `crm` que o navegador mandou (último argumento, só para a execução local)
 * é DESCARTADO: a posição é sobrescrita com o que o servidor leu, deste Espaço,
 * em qualquer estado (T-15-20). Quem decide é o domínio, com esse conjunto.
 *
 * `posicao` é o índice do `crm` em `args` (o argumento depois dos que a
 * operação recebe do navegador). Grupo e Flow CONTINUAM gravando a Conversa de
 * Grupo e o envio de Flow em `state.conversations` (F14-D-05): só a conferência
 * de Canal e de Contato vem das tabelas.
 *
 * Fica num arquivo próprio para que os planos paralelos não disputem o mesmo
 * arquivo; `index.ts` compõe. O 15-17 acrescenta aqui a criação do Contato do
 * Participante (`AO_CONFIRMAR_FERRAMENTAS`).
 */

import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import type { LeituraDoCrm, TabelaDeConfirmacoes, TabelaDeLeituras } from "./tipos";

/** A leitura dos Canais do Espaço; só a posição do `crm` em `args` muda de operação para operação. */
const leituraDasFerramentas = (posicao: number): LeituraDoCrm => ({
  posicao,
  ler: async (cliente, workspaceId) => ({
    canais: await criarRepositorioDeCanaisPg(cliente).todos(workspaceId),
    contatos: [],
  }),
  argumento: (lido) => ({ canais: lido.canais ?? [], contatos: lido.contatos ?? [] }),
});

export const LER_DO_CRM_FERRAMENTAS: TabelaDeLeituras = {
  criarGrupo: leituraDasFerramentas(1),
};

export const AO_CONFIRMAR_FERRAMENTAS: TabelaDeConfirmacoes = {};
