/**
 * A Atividade do CRM novo (D-15-09, 3.4): o vocabulário dos gestos que a linha do
 * tempo registra e o filtro de leitura. Espelha `apps/api/migracoes/012-atividade-do-crm.sql`
 * (`plataforma.crm_atividades`), cujas linhas voltam como `ActivityRecord`
 * (`types/primitives`) — o mesmo tipo do modelo antigo, para a linha do tempo e a
 * Auditoria lerem as duas origens sem tradução.
 *
 * `TIPOS_DE_OBJETO_DO_CRM` são as cadeias que `ActivityRecord.objectType` já usa;
 * não há `check` de lista no banco, então o vocabulário cresce aqui sem migração.
 * O ator vem sempre da sessão, nunca de quem pede: nenhum tipo deste módulo
 * carrega um ator de entrada vindo de fora da api.
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/atividades`.
 */

import { fail, ok, type OperationResult } from "../state";

/** O tipo de objeto de uma Atividade do CRM (as cadeias de `ActivityRecord.objectType`). */
export const TIPOS_DE_OBJETO_DO_CRM = ["contact", "company", "deal", "conversation", "funnel", "channel"] as const;
export type TipoDeObjetoDoCrm = (typeof TIPOS_DE_OBJETO_DO_CRM)[number];

/** A frase gravada em `ActivityRecord.action` por cada gesto do CRM novo. */
export const ACOES_DO_CRM = {
  notaRegistrada: "Nota registrada no Contato",
  conversaMovida: "Conversa movida para outro Contato",
  conversaAtribuida: "Conversa atribuída",
  atribuidoRemovido: "Atribuído removido da Conversa",
  conversaParaLixeira: "Conversa enviada à lixeira",
  conversaRestaurada: "Conversa restaurada",
  estrelaMarcada: "Conversa marcada com estrela",
  estrelaRemovida: "Estrela removida da Conversa",
  conversaLida: "Conversa lida",
  identificadorTransferido: "Identificador transferido",
  consentimentoRegistrado: "Consentimento registrado",
  contatoPassadoAoSucessor: "Contato passado ao Sucessor",
  empresaPassadaAoSucessor: "Empresa passada ao Sucessor",
  negocioPassadoAoSucessor: "Negócio passado ao Sucessor",
  conversaPassadaAoSucessor: "Conversa passada ao Sucessor",
} as const;
export type AcaoDoCrm = (typeof ACOES_DO_CRM)[keyof typeof ACOES_DO_CRM];

/** Quantas Atividades uma leitura devolve: o padrão e o teto que a rota aceita. */
export const LIMITES_DE_ATIVIDADE = { paginaPadrao: 50, paginaMaxima: 200 } as const;

/**
 * O filtro de uma leitura de Atividades. `objetoTipo` e `objetoId` vêm juntos ou
 * nenhum (a linha do tempo de UM objeto, ou a de todo o Espaço); `ate` é o
 * instante ISO a partir do qual se pagina para trás.
 */
export interface FiltroDeAtividades {
  readonly objetoTipo?: string;
  readonly objetoId?: string;
  readonly limite: number;
  readonly ate?: string;
}

/** Recusa o objeto pela metade e o limite fora de `1..paginaMaxima`; devolve o filtro como veio. */
export function validarFiltroDeAtividades(filtro: FiltroDeAtividades): OperationResult<FiltroDeAtividades> {
  const temTipo = filtro.objetoTipo !== undefined && filtro.objetoTipo !== "";
  const temId = filtro.objetoId !== undefined && filtro.objetoId !== "";
  if (temTipo !== temId) {
    return fail("Informe o tipo e o identificador do objeto juntos, ou nenhum dos dois.", temTipo ? "objetoId" : "objetoTipo");
  }
  if (!Number.isInteger(filtro.limite) || filtro.limite < 1 || filtro.limite > LIMITES_DE_ATIVIDADE.paginaMaxima) {
    return fail(`O limite vai de 1 a ${LIMITES_DE_ATIVIDADE.paginaMaxima}.`, "limite");
  }
  if (filtro.ate !== undefined && Number.isNaN(Date.parse(filtro.ate))) {
    return fail("A data limite precisa ser um instante válido.", "ate");
  }
  return ok(filtro);
}
