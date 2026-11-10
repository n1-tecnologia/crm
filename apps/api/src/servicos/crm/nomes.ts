/**
 * Serviço de nomes do CRM novo em lote (15-10, 3.4.9 e 3.4.10, UCR-08): a regra
 * entre `POST /crm/nomes` e `repositorios/crm/nomes.ts`.
 *
 * SÓ LÊ: não abre transação, não grava Atividade e não sobe a revisão do Espaço.
 *
 * O Espaço vem SEMPRE de `membro` (a sessão), nunca do pedido (T-15-29): o
 * repositório põe `workspace_id = $1` em toda consulta. O Papel decide o que se
 * vê, tipo a tipo, com a mesma `podeNoCrm(…, "ler", recurso)` que a tela e a
 * leitura das Atividades usam: o tipo que o Papel não lê nem chega ao banco e
 * volta `nome: null`, igual ao id desconhecido ou de outro Espaço — nunca 403 por
 * item, e a resposta não distingue as três causas.
 *
 * Os limites são de forma (400): até `NOMES_MAXIMO` alvos e tipo conhecido. A rota
 * já os confere no zod; o serviço confere de novo porque também é chamado sem ela.
 * A lista vazia responde antes de ler o Papel ou o banco.
 */

import type { Pool } from "pg";
import type { TipoDeObjetoDoCrm } from "@n1/dominio/crm/atividades";
import { NOMES_MAXIMO, type AlvoDoCrm, type NomeDoAlvo } from "@n1/dominio/crm/nomes";
import { podeNoCrm } from "@n1/dominio/crm/permissoes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { nomesDosAlvos } from "../../repositorios/crm/nomes";
import type { AcessoAoCrm } from "./acesso";
import { ehTipoDoCrm, RECURSO_DO_TIPO } from "./atividades";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";

export interface ServicoDeNomes {
  /** Um item por alvo, na ordem pedida; `nome: null` quando o id não é deste Espaço, não existe ou o Papel não lê o tipo. */
  nomes(membro: MembroDaSessao, alvos: readonly AlvoDoCrm[]): Promise<ResultadoCrm<readonly NomeDoAlvo[]>>;
}

export function criarServicoDeNomes(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeNomes {
  return {
    async nomes(membro, alvos) {
      if (alvos.length > NOMES_MAXIMO) {
        return recusa<never>(400, `Os nomes aceitam até ${NOMES_MAXIMO} alvos por chamada.`, { codigo: "VALOR_INVALIDO", campo: "alvos" });
      }
      if (alvos.some((alvo) => !ehTipoDoCrm(alvo.tipo) || alvo.id === "")) {
        return recusa<never>(400, "Tipo de objeto desconhecido ou identificador vazio.", { codigo: "VALOR_INVALIDO", campo: "alvos" });
      }
      if (alvos.length === 0) return sucesso([]);

      // O Papel é lido do banco a cada chamada (como em `exigir`): mudar o Papel vale na requisição seguinte.
      const papel = await deps.acesso.papelDe(membro.workspaceId, membro.id);
      const legivel = new Map<TipoDeObjetoDoCrm, boolean>();
      const podeLer = (tipo: TipoDeObjetoDoCrm): boolean => {
        let pode = legivel.get(tipo);
        if (pode === undefined) {
          pode = podeNoCrm(papel?.base, papel?.estado, "ler", RECURSO_DO_TIPO[tipo]) === undefined;
          legivel.set(tipo, pode);
        }
        return pode;
      };

      // Só os alvos legíveis vão ao banco; as posições deles dizem onde cada nome volta.
      const posicoes: number[] = [];
      alvos.forEach((alvo, posicao) => {
        if (podeLer(alvo.tipo)) posicoes.push(posicao);
      });
      const achados = await nomesDosAlvos(
        deps.pool(),
        membro.workspaceId,
        posicoes.map((posicao) => alvos[posicao]!),
      );

      const nomes: (string | null)[] = alvos.map(() => null);
      posicoes.forEach((posicao, i) => {
        nomes[posicao] = achados[i] ?? null;
      });
      return sucesso(alvos.map((alvo, posicao) => ({ tipo: alvo.tipo, id: alvo.id, nome: nomes[posicao] ?? null })));
    },
  };
}
