/**
 * A Nota do Contato (3.2.7): o texto que um Membro deixa na ficha do Contato.
 * Tipos camelCase dos campos de `plataforma.contato_notas` (011), mais a regra
 * que vale dos dois lados da fronteira — a tela pré-valida e o endpoint aplica
 * as MESMAS funções.
 *
 * D-04: a nota é só texto. Os anexos e as menções da nota do modelo antigo não
 * vêm para cá; ficam em `registros_crm_antigo`. O autor é sempre o Membro da
 * sessão, nunca um campo de quem escreve: por isso `NovaNota` só tem `conteudo`
 * e nenhum tipo aqui carrega `workspaceId`.
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/notas`.
 */

import { fail, ok, type OperationResult } from "../state";
import { LIMITES_CRM } from "./comum";
import type { Contato } from "./contatos";

export interface NotaDoContato {
  readonly id: string;
  readonly contatoId: string;
  readonly conteudo: string;
  readonly autorId: string;
  readonly criadoEm: string;
}

export interface NovaNota {
  readonly conteudo: string;
}

/** O conteúdo aparado, nem vazio nem acima do teto do texto longo do CRM (`contato_notas_conteudo_ck`). */
export function validarNovaNota(entrada: NovaNota): OperationResult<NovaNota> {
  const conteudo = entrada.conteudo.trim();
  if (conteudo === "") return fail("Escreva a nota antes de salvar.", "conteudo");
  if (conteudo.length > LIMITES_CRM.textoLongo) {
    return fail(`A nota vai até ${LIMITES_CRM.textoLongo} caracteres.`, "conteudo");
  }
  return ok({ conteudo });
}

/**
 * Em que Contato a nota não entra: o `mesclado` é somente leitura (RN-CON-14) e o
 * que está na lixeira está parado. O arquivado aceita nota, como aceita Negócio
 * (RN-CON-19). `undefined` quando entra.
 */
export function recusaDeNotaNoContato(contato: Pick<Contato, "estado">): string | undefined {
  if (contato.estado === "mesclado") return "Um Contato mesclado é somente leitura. Escreva a nota no Contato que ficou.";
  if (contato.estado === "na_lixeira") return "Este Contato está na lixeira. Restaure-o antes de escrever a nota.";
  return undefined;
}
