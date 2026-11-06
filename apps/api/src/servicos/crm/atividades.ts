/**
 * Serviço de leitura das Atividades do CRM novo (15-37, D-15-09, UCR-03): a regra
 * entre `GET /atividades` e `repositorios/crm/atividades.ts`.
 *
 * SÓ LÊ. A gravação é `registrarAtividade`, chamada por cada gesto dentro da
 * transação dele (15-04); este serviço não tem caminho que escreva.
 *
 * O Espaço de Trabalho vem SEMPRE de `membro` (a sessão), nunca do pedido
 * (T-15-12): o repositório põe `workspace_id = $1` em todo `where`. O Papel decide
 * o que se vê:
 *   - com objeto (`objetoTipo` + `objetoId`): exige `ler` no recurso daquele tipo
 *     (403 senão), e só esse tipo entra na consulta;
 *   - sem objeto (a Auditoria): só os tipos que `podeNoCrm(…, "ler", recurso)` deixa,
 *     o que o Papel não pode ler nunca sai. Sem nenhum tipo legível, 403.
 * A mesma `podeNoCrm` que a tela consulta é a que decide aqui.
 *
 * A página tem teto (`LIMITES_DE_ATIVIDADE.paginaMaxima`, T-15-89) e a paginação
 * é por tempo: `ate` é exclusivo e vem de `at` da última linha recebida.
 */

import type { Pool } from "pg";
import {
  TIPOS_DE_OBJETO_DO_CRM,
  validarFiltroDeAtividades,
  type FiltroDeAtividades,
  type TipoDeObjetoDoCrm,
} from "@n1/dominio/crm/atividades";
import { podeNoCrm, type RecursoCrm } from "@n1/dominio/crm/permissoes";
import type { ActivityRecord } from "@n1/dominio/types/primitives";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { listar } from "../../repositorios/crm/atividades";
import type { AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao } from "./transacao";

export interface ServicoDeAtividades {
  /** As Atividades do Espaço da sessão, da mais recente para a mais antiga, no que o Papel pode ler. */
  listar(membro: MembroDaSessao, filtro: FiltroDeAtividades): Promise<ResultadoCrm<ActivityRecord[]>>;
}

/** O recurso de permissão de cada tipo de objeto da Atividade (as cadeias de `ActivityRecord.objectType`). Os nomes em lote (15-10) leem o mesmo mapa. */
export const RECURSO_DO_TIPO: Readonly<Record<TipoDeObjetoDoCrm, RecursoCrm>> = {
  contact: "contato",
  company: "empresa",
  deal: "negocio",
  conversation: "conversa",
  funnel: "funil",
  channel: "canal",
};

export function ehTipoDoCrm(tipo: string): tipo is TipoDeObjetoDoCrm {
  return (TIPOS_DE_OBJETO_DO_CRM as readonly string[]).includes(tipo);
}

export function criarServicoDeAtividades(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeAtividades {
  return {
    async listar(membro, filtro) {
      const validacao = validarFiltroDeAtividades(filtro);
      if (!validacao.ok) {
        return recusa<never>(400, validacao.error, {
          codigo: "VALOR_INVALIDO",
          ...(validacao.field !== undefined ? { campo: validacao.field } : {}),
        });
      }
      if (filtro.objetoTipo !== undefined && !ehTipoDoCrm(filtro.objetoTipo)) {
        return recusa<never>(400, "Tipo de objeto desconhecido.", { codigo: "VALOR_INVALIDO", campo: "objetoTipo" });
      }

      // O Papel é lido do banco a cada chamada (como em `exigir`): mudar o Papel vale na requisição seguinte.
      const papel = await deps.acesso.papelDe(membro.workspaceId, membro.id);
      const podeLer = (tipo: TipoDeObjetoDoCrm) => podeNoCrm(papel?.base, papel?.estado, "ler", RECURSO_DO_TIPO[tipo]);

      let tiposPermitidos: TipoDeObjetoDoCrm[];
      if (filtro.objetoTipo !== undefined && ehTipoDoCrm(filtro.objetoTipo)) {
        const frase = podeLer(filtro.objetoTipo);
        if (frase !== undefined) return recusa<never>(403, frase, { codigo: "PERMISSAO" });
        tiposPermitidos = [filtro.objetoTipo];
      } else {
        tiposPermitidos = TIPOS_DE_OBJETO_DO_CRM.filter((tipo) => podeLer(tipo) === undefined);
        if (tiposPermitidos.length === 0) {
          return recusa<never>(403, podeLer(TIPOS_DE_OBJETO_DO_CRM[0]) ?? "Sem permissão para consultar o CRM.", { codigo: "PERMISSAO" });
        }
      }

      return comTransacao(deps.pool, async (cliente) => sucesso(await listar(cliente, membro.workspaceId, filtro, tiposPermitidos)));
    },
  };
}
