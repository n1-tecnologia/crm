/**
 * As tabelas do gesto misto de `POST /operacoes/:nome`, compostas por módulo
 * (Fase 15, D-15-07 / UCR-01): `LER_DO_CRM` (o que a operação confere contra as
 * tabelas do CRM ANTES de decidir) e `AO_CONFIRMAR` (o que grava nelas no MESMO
 * commit, depois do `ok` do domínio). Um arquivo por módulo — estrutura,
 * membros, ferramentas, ia, financeiro —, para que planos paralelos mexam só no
 * arquivo do próprio módulo.
 *
 * `compor` LANÇA, na carga do módulo, se um nome de operação aparece em duas
 * tabelas: sem isso o segundo módulo sobrescreveria o primeiro em silêncio.
 */

import type { NomeDeOperacao } from "@n1/dominio/operations/registro";
import { AO_CONFIRMAR_FERRAMENTAS, LER_DO_CRM_FERRAMENTAS } from "./ferramentas";
import { AO_CONFIRMAR_FINANCEIRO, LER_DO_CRM_FINANCEIRO } from "./financeiro";
import { AO_CONFIRMAR_IA, LER_DO_CRM_IA } from "./ia";
import { AO_CONFIRMAR_DOS_MEMBROS } from "./membros";
import { LER_DO_CRM_DA_ESTRUTURA } from "./estrutura";
import type { TabelaDeConfirmacoes, TabelaDeLeituras } from "./tipos";

export type { AoConfirmarNoCrm, ContatoACriar, ContatoResumido, EmpresaResumida, LeituraDoCrm, LidoDoCrm, TabelaDeConfirmacoes, TabelaDeLeituras } from "./tipos";

/** Junta as tabelas dos módulos numa só, recusando um nome de operação repetido. */
export function compor<T>(rotulo: string, tabelas: ReadonlyArray<Partial<Record<NomeDeOperacao, T>>>): Partial<Record<NomeDeOperacao, T>> {
  const junta: Partial<Record<NomeDeOperacao, T>> = {};
  for (const tabela of tabelas) {
    for (const nome of Object.keys(tabela) as NomeDeOperacao[]) {
      if (nome in junta) throw new Error(`gesto-no-crm: a operação "${nome}" aparece em dois módulos de ${rotulo}.`);
      junta[nome] = tabela[nome] as T;
    }
  }
  return junta;
}

export const LER_DO_CRM: TabelaDeLeituras = compor("LER_DO_CRM", [
  LER_DO_CRM_DA_ESTRUTURA,
  LER_DO_CRM_FERRAMENTAS,
  LER_DO_CRM_IA,
  LER_DO_CRM_FINANCEIRO,
]);

export const AO_CONFIRMAR: TabelaDeConfirmacoes = compor("AO_CONFIRMAR", [
  AO_CONFIRMAR_DOS_MEMBROS,
  AO_CONFIRMAR_FERRAMENTAS,
  AO_CONFIRMAR_IA,
  AO_CONFIRMAR_FINANCEIRO,
]);
