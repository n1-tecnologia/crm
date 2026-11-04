"use client";

/**
 * A prévia da sucessão de um Membro nas tabelas do CRM (Fase 14, 3.2.8, lado
 * web): quantos Contatos, Empresas e Negócios passam ao Sucessor e quantas
 * Conversas ficam sem Atribuído se o Membro for removido. Só HTTP —
 * `GET /membros/:id/sucessao-no-crm` de `apps/api` (plano 14-10); nenhum arquivo
 * do web importa o workspace da api, então o tipo da resposta é declarado aqui
 * e o contrato é o JSON.
 *
 * Só Administrador ou Proprietário ativo lê (403 aos demais, 404 para um Membro
 * de outro Espaço): a tela de Membros já é deles, e a recusa, se vier, aparece
 * no lugar das contagens. A passagem em si não é daqui: roda dentro de
 * `removeMember` no servidor, e quem remove só precisa invalidar o que ela moveu
 * (`invalidarCrmDaSucessao`). Só vai ao ar no deploy da Fase 15.
 */

import useSWR from "swr";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

/** O que a remoção do Membro move ou libera nas tabelas do CRM. */
export interface SucessaoNoCrm {
  readonly contatos: number;
  readonly empresas: number;
  readonly negocios: number;
  /** Conversas atribuídas a ele que ficam SEM Atribuído (liberadas). */
  readonly conversasLiberadas: number;
}

export function chaveDaSucessao(membroId: string): string {
  return `/membros/${encodeURIComponent(membroId)}/sucessao-no-crm`;
}

/** Recusa 4xx não melhora ao repetir (403, 404): só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** `undefined` não lê nada (nenhum Membro em remoção). A recusa da api fica em `error` (`ErroDeApi`). */
export function useSucessaoNoCrm(membroId: string | undefined) {
  return useSWR<SucessaoNoCrm, Error>(
    membroId === undefined ? null : chaveDaSucessao(membroId),
    async (chave: string) => (await chamarCrm<{ ok: true; dados: SucessaoNoCrm }>(chave)).dados,
    { shouldRetryOnError: valeRepetir },
  );
}

/** Depois de remover o Membro: os donos e Atribuídos mudaram em Contatos, Empresas, Negócios e Conversas. */
export async function invalidarCrmDaSucessao(): Promise<void> {
  await Promise.all(["/contatos", "/empresas", "/negocios", "/conversas"].map((prefixo) => invalidarCrm(prefixo)));
}
