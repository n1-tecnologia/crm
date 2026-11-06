/**
 * O resumo do cartão da Tarefa conversacional (Fase 14, 3.3.3): Contato, Canal,
 * última Mensagem e Negócio de uma Tarefa, lidos das tabelas novas em lote; e, desde
 * a Fase 15 (D-15-05), a Empresa, a qualificação do Contato e o estado da Conversa.
 *
 * Só tipos e o teto do lote: a tela monta os `VinculoParaResumo` com
 * `vinculosDoCrmDaTarefa` (os ids que a Tarefa guarda em `state.links`) e a api
 * devolve um `ResumoDaTarefaConversacional` por Vínculo, na ordem pedida. Nenhum
 * tipo carrega `workspaceId`: o Espaço vem da sessão, nunca do corpo.
 *
 * A "última Mensagem" é a mais recente entre as Conversas `ativas` do Contato
 * no Canal da Tarefa, sem contar a Mensagem `interna` (não foi trocada com o
 * Contato): a mesma leitura que a derivação do CRM antigo fazia antes de sair no 14-17.
 *
 * Sem barril: quem precisa importa por `@n1/dominio/crm/resumo-da-tarefa`.
 */

import type { Canal } from "./canais";
import type { EstadoDaConversa, SituacaoDaConversa } from "./conversas";

/** Quantas Tarefas cabem numa chamada de resumo: a Lista maior que isso vai em lotes. */
export const RESUMO_MAXIMO = 200;

/** Os ids que uma Tarefa conversacional guarda: o que a api precisa para montar o cartão dela. */
export interface VinculoParaResumo {
  readonly taskId: string;
  readonly contatoId?: string;
  readonly conversaId?: string;
  readonly negocioId?: string;
}

export interface ResumoDaTarefaConversacional {
  readonly taskId: string;
  /** O Contato seguindo `mesclado_em_id`: quem ficou, não o absorvido. `null` se o id não existe neste Espaço. */
  readonly contato: { readonly id: string; readonly nome: string } | null;
  /** O Canal da Conversa vinculada. `null` sem Conversa, ou se ela não existe neste Espaço. */
  readonly canal: Pick<Canal, "id" | "nome" | "tipo" | "provedor" | "conexao"> | null;
  readonly ultimaMensagem: {
    /** Cortado em 140 caracteres no banco. */
    readonly trecho: string;
    readonly direcao: "recebida" | "enviada";
    readonly criadoEm: string;
  } | null;
  readonly negocio: { readonly id: string; readonly titulo: string; readonly etapa: string | null } | null;
  /**
   * A Empresa do Contato (D-15-05): entre os vínculos vigentes (`fim is null`) com Empresa fora da lixeira,
   * o `admin` mais antigo; sem admin, o mais antigo. A 007 não tem vínculo principal, então a ordem é
   * `admin desc, criado_em, id` e vale sempre a mesma. `null` sem Contato ou sem Empresa.
   */
  readonly empresa: { readonly id: string; readonly nome: string } | null;
  /** O id do item de Catálogo (`kind = "qualificacao"`) guardado no Contato; a tela resolve o rótulo. `null` sem Contato ou sem valor. */
  readonly qualificacaoId: string | null;
  /** O estado da Conversa vinculada (D-15-05); `null` sem Conversa, ou se ela não existe neste Espaço ou está na lixeira. */
  readonly conversa: {
    readonly situacao: SituacaoDaConversa;
    readonly estado: EstadoDaConversa;
    /** Quem atende: a tela resolve o nome em `members` ou `agents`. */
    readonly atribuido: { readonly tipo: "membro" | "agente"; readonly id: string } | null;
  } | null;
}
