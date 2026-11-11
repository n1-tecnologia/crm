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
  /**
   * Sessão 4 (4.4.2): a Mensagem foi digitada no próprio aparelho do Canal (o WhatsApp no celular da pessoa), não pelo CRM. Nesse
   * caso `remetente` continua sendo o Contato, o OUTRO lado da conversa (nunca o dono do número), e a Mensagem entra como
   * `enviada` pelo Canal (`destinoDaDigitadaNoAparelho` decide a Conversa). Ausente = a Mensagem veio do Contato.
   */
  readonly digitadaNoAparelho?: boolean;
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

/**
 * RN-CXE-09: a Conversa aberta ou pendente do par recebe a Mensagem (a pendente volta a aberta); sem
 * ela, a última resolvida reabre se ainda cabe na janela do Espaço, senão abre-se outra. Uma Conversa
 * na lixeira nunca reabre (`conversas_lixeira_ck`: a lixeira só guarda resolvidas). A conta é a de
 * `receiveMessage` do modelo antigo: `agora - resolvidaEm <= horas * 3_600_000`.
 */
export function destinoDaRecebida(entrada: EntradaDoDestino): DestinoDaRecebida {
  const { aberta, ultimaResolvida, janelaDeReaberturaHoras, agora } = entrada;
  if (aberta) return { acao: "usar", conversaId: aberta.id, voltaParaAberta: aberta.situacao === "pendente" };
  if (ultimaResolvida && !ultimaResolvida.naLixeira) {
    const resolvidaEm = Date.parse(ultimaResolvida.resolvidaEm);
    if (!Number.isNaN(resolvidaEm) && agora - resolvidaEm <= janelaDeReaberturaHoras * 3_600_000) {
      return { acao: "reabrir", conversaId: ultimaResolvida.id };
    }
  }
  return { acao: "abrir" };
}

export type DestinoDaDigitadaNoAparelho = { readonly acao: "usar"; readonly conversaId: string } | { readonly acao: "abrir" };

/**
 * A Mensagem que a pessoa digitou no celular (4.4.2) só entra no fio: nunca reabre uma Conversa resolvida, nunca tira uma pendente
 * do Adiamento e nunca mexe na lixeira (a resposta de "obrigado, até logo" depois de resolver não pode reabrir o atendimento).
 * Usa a aberta ou pendente do par; sem ela, a última resolvida (fora da lixeira) que ainda cabe na janela de `inbox` do Espaço, no
 * estado em que está; senão abre-se uma Conversa nova (a pessoa puxou assunto pelo celular).
 */
export function destinoDaDigitadaNoAparelho(entrada: EntradaDoDestino): DestinoDaDigitadaNoAparelho {
  const { aberta, ultimaResolvida, janelaDeReaberturaHoras, agora } = entrada;
  if (aberta) return { acao: "usar", conversaId: aberta.id };
  if (ultimaResolvida && !ultimaResolvida.naLixeira) {
    const resolvidaEm = Date.parse(ultimaResolvida.resolvidaEm);
    if (!Number.isNaN(resolvidaEm) && agora - resolvidaEm <= janelaDeReaberturaHoras * 3_600_000) {
      return { acao: "usar", conversaId: ultimaResolvida.id };
    }
  }
  return { acao: "abrir" };
}

export type AcaoSobreOContato = { readonly acao: "manter" } | { readonly acao: "reativar" } | { readonly acao: "recusar" };

/**
 * RN-CON-13: quem escreve volta à ativa. Arquivado e na lixeira reativam; o mesclado é recusado: o
 * Identificador dele vive no sobrevivente, então a Mensagem nunca deveria chegar a ele.
 */
export function contatoDaRecebida(estado: EstadoDoContato): AcaoSobreOContato {
  switch (estado) {
    case "ativo":
      return { acao: "manter" };
    case "arquivado":
    case "na_lixeira":
      return { acao: "reativar" };
    case "mesclado":
      return { acao: "recusar" };
  }
}
