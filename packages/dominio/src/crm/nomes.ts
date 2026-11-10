/**
 * Dar nome a ids do CRM novo, em lote (15-10, 3.4.9 e 3.4.10, UCR-08): a IA (alvo,
 * âncora, escopo), Contas a receber (cliente) e outras telas mostram o nome de um
 * Contato, Empresa, Negócio, Conversa, Funil ou Canal sem carregar a lista inteira.
 *
 * Só tipos e o teto do lote. Os tipos de objeto são os mesmos da Atividade
 * (`TIPOS_DE_OBJETO_DO_CRM`), as cadeias que `ActivityRecord.objectType` já usa.
 * Nenhum tipo carrega `workspaceId`: o Espaço vem da sessão, nunca do pedido.
 *
 * `nome: null` quer dizer "não há nome para mostrar": o id não existe neste
 * Espaço, ou o Papel não pode ler aquele tipo. As duas causas são
 * indistinguíveis de propósito (UCR-08: a resposta não revela o que existe).
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/nomes`.
 */

import type { TipoDeObjetoDoCrm } from "./atividades";

/** O objeto do CRM novo cujo nome se pede. */
export interface AlvoDoCrm {
  readonly tipo: TipoDeObjetoDoCrm;
  readonly id: string;
}

/** O alvo com o nome que a api achou, ou `null` (ver o cabeçalho). */
export interface NomeDoAlvo extends AlvoDoCrm {
  readonly nome: string | null;
}

/** Quantos alvos cabem numa chamada: o teto da rota e a conferência do serviço. */
export const NOMES_MAXIMO = 200;
