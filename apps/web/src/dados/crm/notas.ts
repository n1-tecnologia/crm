"use client";

/**
 * Notas do Contato (3.2.7), lidas e gravadas só por HTTP: cada função aqui é uma
 * rota de `apps/api` (`rotas/crm/notas.ts`) atrás de `chamarCrm`. A nota é só
 * texto (D-04) e o autor é o Membro da sessão: o corpo leva apenas `conteudo`.
 *
 * A chave de SWR é `/contatos/<id>/notas`: começa por `/contatos`, como as do
 * resto do Contato, mas a revalidação depois de escrever é só das notas daquele
 * Contato — escrever uma nota não muda a ficha nem a lista. Numa recusa a
 * `ErroDeApi` sobe com `status`, `codigo` e `campo` e nada é revalidado.
 */

import useSWR from "swr";
import type { NotaDoContato } from "@n1/dominio/crm/notas";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

export interface RespostaDasNotas {
  readonly ok: true;
  readonly itens: NotaDoContato[];
  readonly total: number;
}

export function chaveDasNotas(contatoId: string): string {
  return `/contatos/${contatoId}/notas`;
}

/** Recusa 4xx não melhora ao repetir: só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** As notas do Contato, a mais recente primeiro (a ordem é da api). */
export function useNotasDoContato(contatoId: string | undefined) {
  return useSWR<RespostaDasNotas, Error>(
    contatoId === undefined ? null : chaveDasNotas(contatoId),
    (chave: string) => chamarCrm<RespostaDasNotas>(chave),
    { shouldRetryOnError: valeRepetir },
  );
}

export function adicionarNotaAoContato(contatoId: string, conteudo: string): Promise<NotaDoContato> {
  return chamarCrm<{ ok: true; dados: NotaDoContato }>(chaveDasNotas(contatoId), { method: "POST", corpo: { conteudo } }).then(
    async (resposta) => {
      await invalidarCrm(chaveDasNotas(contatoId));
      return resposta.dados;
    },
  );
}
