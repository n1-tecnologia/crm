/**
 * O recebimento de uma Mensagem do provedor (3.6.2, MSG-01): o que o evento
 * traz e as duas decisões puras que o serviço de `apps/api` aplica dentro da
 * transação — em que Conversa a Mensagem cai (RN-CXE-09) e o que fazer com o
 * Contato que a mandou (RN-CON-13).
 *
 * O tipo do evento mora aqui, e não no módulo do provedor da api, para que a
 * regra e a Sessão 5 leiam o mesmo tipo e o domínio não dependa de ninguém.
 * Nenhum tipo carrega `workspaceId`: o Espaço vem do Canal, nunca do evento.
 *
 * Sem barril: quem precisa importa por `@n1/dominio/crm/recebimento`.
 */

import type { EstadoDoContato, TipoIdentificadorContato } from "./contatos";

/** O padrão do seed (`inbox.reopenWindowHours`) quando o Espaço não tem a linha `inbox`. */
export const JANELA_DE_REABERTURA_PADRAO_HORAS = 72;

/** Quem mandou: o Identificador que o provedor entrega, ainda sem normalizar. */
export interface RemetenteDaRecebida {
  readonly tipo: TipoIdentificadorContato;
  readonly valor: string;
  readonly nomeExibido?: string;
}

/** Um anexo como o provedor o descreve; o serviço de mídia (16-09) o baixa e o guarda. */
export interface AnexoRecebidoDoProvedor {
  readonly referenciaNoProvedor: string;
  readonly tipoDeMidia: string;
  readonly nome: string;
}

export interface RecebidaDoProvedor {
  readonly idExterno: string;
  /** O instante do PROVEDOR, em ISO 8601 (Pitfall 9). */
  readonly criadoEm: string;
  readonly remetente: RemetenteDaRecebida;
  readonly conteudo?: string;
  readonly anexos?: readonly AnexoRecebidoDoProvedor[];
  readonly emRespostaAIdExterno?: string;
  readonly assunto?: string;
  /** O payload cru; dado pessoal, só o banco o guarda. */
  readonly cargaBruta: unknown;
}

export type DestinoDaRecebida =
  | { readonly acao: "usar"; readonly conversaId: string; readonly voltaParaAberta: boolean }
  | { readonly acao: "reabrir"; readonly conversaId: string }
  | { readonly acao: "abrir" };

export interface EntradaDoDestino {
  readonly aberta: { readonly id: string; readonly situacao: "aberta" | "pendente" } | null;
  readonly ultimaResolvida: { readonly id: string; readonly resolvidaEm: string; readonly naLixeira: boolean } | null;
  readonly janelaDeReaberturaHoras: number;
  /** `Date.now()` de quem chama. */
  readonly agora: number;
}

export function destinoDaRecebida(_entrada: EntradaDoDestino): DestinoDaRecebida {
  return { acao: "abrir" };
}

export type AcaoSobreOContato = { readonly acao: "manter" } | { readonly acao: "reativar" } | { readonly acao: "recusar" };

export function contatoDaRecebida(_estado: EstadoDoContato): AcaoSobreOContato {
  return { acao: "manter" };
}
