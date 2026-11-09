/**
 * O evento de tempo real do CRM (16-07, D-16-01, MSG-03): o que o backend avisa à tela quando uma Mensagem ou uma
 * Conversa muda. Só ids e o tipo, nunca texto, nome nem telefone: a tela busca o resto pelas rotas que já conferem
 * o acesso (prohibition de MSG-03).
 *
 * O tipo mora aqui para a api (que escreve e lê o aviso) e a web (que lê o fluxo) usarem a mesma forma.
 * `workspaceId` só existe dentro do servidor: o hub filtra por ele e a aba recebe `EventoParaATela`.
 *
 * Sem barril: quem precisa importa por `@n1/dominio/crm/eventos`.
 */

export const TIPOS_DE_EVENTO_DO_CRM = ["mensagem.nova", "mensagem.status", "conversa.mudou"] as const;

export type TipoDeEventoDoCrm = (typeof TIPOS_DE_EVENTO_DO_CRM)[number];

export interface EventoDoCrm {
  readonly workspaceId: string;
  readonly tipo: TipoDeEventoDoCrm;
  readonly conversaId: string;
  readonly mensagemId?: string;
}

/** O que sai para a aba: o mesmo evento sem o Espaço. */
export type EventoParaATela = Omit<EventoDoCrm, "workspaceId">;

export function lerEventoDoCrm(_valor: unknown): EventoDoCrm | undefined {
  return undefined;
}

export function lerEventoParaATela(_valor: unknown): EventoParaATela | undefined {
  return undefined;
}
