/**
 * Esqueleto do RED do 15-18: o contrato do serviço do Início, ainda sem leitura do banco.
 * O GREEN troca este arquivo pela implementação.
 */

import type { Pool } from "pg";
import type { EstatisticasDoCrm, LeadAAtenderDoCrm, PanoramaDoCrm } from "@n1/dominio/crm/inicio";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import { sucesso, type ResultadoCrm } from "./resultado";

export interface JanelaDeEstatisticas {
  readonly desde: string;
  readonly ate: string;
  readonly fuso: string;
}

export interface ServicoDoInicio {
  panorama(membro: MembroDaSessao): Promise<ResultadoCrm<PanoramaDoCrm>>;
  leadsAAtender(membro: MembroDaSessao, qualificacoes: readonly string[]): Promise<ResultadoCrm<readonly LeadAAtenderDoCrm[]>>;
  estatisticas(membro: MembroDaSessao, janela: JanelaDeEstatisticas): Promise<ResultadoCrm<EstatisticasDoCrm>>;
}

export function criarServicoDoInicio(_deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDoInicio {
  return {
    async panorama() {
      return sucesso({
        contatosRecentes: [],
        contatosTotal: 0,
        negociosAbertos: { quantidade: 0, valorPonderado: null, moeda: null },
        conversasAbertas: 0,
      });
    },
    async leadsAAtender() {
      return sucesso([]);
    },
    async estatisticas(_membro, janela) {
      return sucesso({ ...janela, mensagensEnviadas: [], conversasResolvidas: [], negociosGanhos: [] });
    },
  };
}
