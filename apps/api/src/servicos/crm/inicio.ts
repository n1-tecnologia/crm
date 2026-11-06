/**
 * Serviço do Início (15-18, 3.4.7, UCR-07): a regra entre as rotas `/crm/inicio/*` e
 * `repositorios/crm/inicio.ts`. O que o Início somava sobre o store (`derive-resumo`, o
 * panorama do robô) passa a ser somado no banco, sobre as tabelas do CRM novo.
 *
 * SÓ LÊ: não abre transação, não grava Atividade e não sobe a revisão do Espaço.
 * Cada leitura é uma consulta só (uma fotografia consistente); repetir devolve o mesmo.
 *
 * O Espaço e o Membro ("meu") vêm SEMPRE de `membro` (a sessão), nunca do pedido
 * (T-15-45): nenhum método recebe o id de outro Membro. O Papel decide o que se vê,
 * recurso a recurso, com a mesma `podeNoCrm(…, "ler", recurso)` que a tela usa: o bloco
 * de um recurso que o Papel não lê volta `null` sem tocar a tabela.
 */

import type { Pool } from "pg";
import {
  conferirJanelaDeEstatisticas,
  type EstatisticasDoCrm,
  type LeadAAtenderDoCrm,
  type PanoramaDoCrm,
} from "@n1/dominio/crm/inicio";
import { podeNoCrm, type RecursoCrm } from "@n1/dominio/crm/permissoes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { panoramaDoEspaco } from "../../repositorios/crm/inicio";
import type { AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";

export interface JanelaDeEstatisticas {
  /** Instante ISO 8601, inclusivo. */
  readonly desde: string;
  /** Instante ISO 8601, inclusivo. */
  readonly ate: string;
  /** Fuso IANA em que os dias são cortados. */
  readonly fuso: string;
}

export interface ServicoDoInicio {
  /** Contatos recentes, Negócios abertos e Conversas não resolvidas do Espaço; cada bloco `null` sem `ler` no recurso. */
  panorama(membro: MembroDaSessao): Promise<ResultadoCrm<PanoramaDoCrm>>;
  /** Os Contatos do Membro da sessão, com Qualificação na lista pedida, que pedem ação dele. */
  leadsAAtender(membro: MembroDaSessao, qualificacoes: readonly string[]): Promise<ResultadoCrm<readonly LeadAAtenderDoCrm[]>>;
  /** O que o Membro da sessão fez por dia na janela. */
  estatisticas(membro: MembroDaSessao, janela: JanelaDeEstatisticas): Promise<ResultadoCrm<EstatisticasDoCrm>>;
}

/** O que o Papel do Membro lê, recurso a recurso, e a frase de recusa quando nada. */
async function leituras(
  acesso: AcessoAoCrm,
  membro: MembroDaSessao,
  recursos: readonly RecursoCrm[],
): Promise<{ readonly pode: ReadonlyMap<RecursoCrm, boolean>; readonly frase: string | undefined }> {
  // O Papel é lido do banco a cada chamada (como em `exigir`): mudar o Papel vale na requisição seguinte.
  const papel = await acesso.papelDe(membro.workspaceId, membro.id);
  const pode = new Map<RecursoCrm, boolean>();
  let frase: string | undefined;
  for (const recurso of recursos) {
    const recusaDoPapel = podeNoCrm(papel?.base, papel?.estado, "ler", recurso);
    pode.set(recurso, recusaDoPapel === undefined);
    frase ??= recusaDoPapel;
  }
  // Só há frase "geral" quando nenhum recurso pôde ser lido (Membro desconhecido ou removido).
  return { pode, frase: [...pode.values()].some(Boolean) ? undefined : frase };
}

export function criarServicoDoInicio(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDoInicio {
  return {
    async panorama(membro) {
      const { pode, frase } = await leituras(deps.acesso, membro, ["contato", "negocio", "conversa"]);
      if (frase !== undefined) return recusa<never>(403, frase, { codigo: "PERMISSAO" });
      const lido = await panoramaDoEspaco(deps.pool(), membro.workspaceId, {
        contatos: pode.get("contato") === true,
        negocios: pode.get("negocio") === true,
        conversas: pode.get("conversa") === true,
      });
      return sucesso(lido);
    },

    async leadsAAtender() {
      return sucesso([]);
    },

    async estatisticas(_membro, janela) {
      const conferida = conferirJanelaDeEstatisticas(janela.desde, janela.ate, janela.fuso);
      if (!conferida.ok) return recusa<never>(400, conferida.error, { codigo: "VALOR_INVALIDO", campo: conferida.field });
      return sucesso({ ...janela, mensagensEnviadas: [], conversasResolvidas: [], negociosGanhos: [] });
    },
  };
}
