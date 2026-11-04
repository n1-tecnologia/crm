"use client";

/**
 * Consentimentos do Contato (3.2.4), lidos e gravados só por HTTP: cada função
 * aqui é uma rota de `apps/api` (`rotas/crm/consentimentos.ts`) atrás de
 * `chamarCrm`. O histórico é SÓ INSERÇÃO: revogar é registrar um `revogado`, por
 * isso este módulo não tem editar nem apagar. O vigente por finalidade e tipo de
 * Canal a tela calcula com `consentimentoVigente` do domínio.
 *
 * A chave de SWR é `/contatos/<id>/consentimentos` e a revalidação depois de
 * registrar é só a do histórico daquele Contato. Numa recusa a `ErroDeApi` sobe
 * com `status`, `codigo` e `campo` e nada é revalidado.
 */

import useSWR from "swr";
import type { ConsentimentoDoContato, NovoConsentimento } from "@n1/dominio/crm/consentimentos";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

export interface RespostaDosConsentimentos {
  readonly ok: true;
  readonly itens: ConsentimentoDoContato[];
  readonly total: number;
}

export function chaveDosConsentimentos(contatoId: string): string {
  return `/contatos/${contatoId}/consentimentos`;
}

/** Recusa 4xx não melhora ao repetir: só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** O histórico inteiro do Contato (sem paginação), o mais recente primeiro. */
export function useConsentimentosDoContato(contatoId: string | undefined) {
  return useSWR<RespostaDosConsentimentos, Error>(
    contatoId === undefined ? null : chaveDosConsentimentos(contatoId),
    (chave: string) => chamarCrm<RespostaDosConsentimentos>(chave),
    { shouldRetryOnError: valeRepetir },
  );
}

export function registrarConsentimento(contatoId: string, entrada: NovoConsentimento): Promise<ConsentimentoDoContato> {
  return chamarCrm<{ ok: true; dados: ConsentimentoDoContato }>(chaveDosConsentimentos(contatoId), {
    method: "POST",
    corpo: entrada,
  }).then(async (resposta) => {
    await invalidarCrm(chaveDosConsentimentos(contatoId));
    return resposta.dados;
  });
}
