/**
 * O acesso ao CRM: a permissão do Papel (D-14) e a validação do Proprietário
 * (D-11), aplicadas no serviço — o backend decide, não só a tela.
 *
 * `AcessoAoCrm` é a costura de teste: a implementação `pg` lê `members` →
 * `roles` de `plataforma.registros` no Espaço da sessão; um teste sem banco
 * injeta um acesso falso (`OpcoesDeCrm.acesso`). A regra em si
 * (`podeNoCrm`) mora em `@n1/dominio/crm/permissoes`, a mesma que a tela usa.
 *
 * Todo serviço do CRM chama `exigir` ANTES de ler ou escrever, e
 * `resolverProprietario` para o `proprietarioId` que chega do corpo.
 */

import type { Pool } from "pg";
import { podeNoCrm, type AcaoCrm, type RecursoCrm } from "@n1/dominio/crm/permissoes";
import type { SituacaoNegocio } from "@n1/dominio/crm/comum";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { membroAtivo, papelDoMembro, type PapelDoMembro } from "../../repositorios/crm/membros";
import { recusa, sucesso, type Recusa, type ResultadoCrm } from "./resultado";

export interface AcessoAoCrm {
  papelDe(workspaceId: string, membroId: string): Promise<PapelDoMembro | undefined>;
  membroAtivo(workspaceId: string, membroId: string): Promise<boolean>;
}

/** Só chama `pool()` quando uma requisição chega, nunca na montagem. */
export function criarAcessoAoCrmPg(pool: () => Pool): AcessoAoCrm {
  return {
    papelDe: (workspaceId, membroId) => papelDoMembro(pool(), workspaceId, membroId),
    membroAtivo: (workspaceId, membroId) => membroAtivo(pool(), workspaceId, membroId),
  };
}

/**
 * `undefined` quando o Membro da sessão pode; senão a recusa 403 com a frase
 * de `podeNoCrm`. O Papel é lido do banco a cada chamada: mudar o Papel vale
 * na requisição seguinte, sem esperar o token expirar.
 */
export async function exigir(
  acesso: AcessoAoCrm,
  membro: MembroDaSessao,
  acao: AcaoCrm,
  recurso: RecursoCrm,
  contexto?: { readonly situacao?: SituacaoNegocio },
): Promise<Recusa | undefined> {
  const papel = await acesso.papelDe(membro.workspaceId, membro.id);
  const frase = podeNoCrm(papel?.base, papel?.estado, acao, recurso, contexto);
  if (frase === undefined) return undefined;
  return { status: 403, error: frase, codigo: "PERMISSAO" };
}

/**
 * O Proprietário de um registro: ausente → o Membro da sessão; presente → tem
 * de ser Membro `ativo` do MESMO Espaço (a consulta é escopada por
 * `workspace_id`, então id de outro Espaço, removido ou inexistente cai na
 * mesma recusa — T-07-40).
 */
export async function resolverProprietario(
  acesso: AcessoAoCrm,
  membro: MembroDaSessao,
  proprietarioId?: string,
): Promise<ResultadoCrm<string>> {
  if (proprietarioId === undefined) return sucesso(membro.id);
  if (await acesso.membroAtivo(membro.workspaceId, proprietarioId)) return sucesso(proprietarioId);
  return recusa(409, "O Proprietário precisa ser um Membro ativo deste Espaço de Trabalho.", {
    codigo: "PROPRIETARIO_INVALIDO",
    campo: "proprietarioId",
  });
}
