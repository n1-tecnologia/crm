/**
 * Serviço de Empresas e vínculos Contato-Empresa — esqueleto do RED de 07-05.
 * Todos os métodos recusam com 404 "pendente"; o GREEN os substitui.
 */

import type { Pool } from "pg";
import type { EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import type {
  AdminDaNovaEmpresa,
  EdicaoDeEmpresa,
  EdicaoDeVinculo,
  EmpresaDetalhada,
  EmpresaResumo,
  NovaEmpresa,
  NovoIdentificadorDeEmpresa,
  NovoVinculo,
  TrocaDeAdmin,
} from "@n1/dominio/crm/empresas";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import { recusa, type ResultadoCrm } from "./resultado";

export interface FiltroDeEmpresas {
  readonly estado: EstadoCrm;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export interface EntradaDeCriacaoDeEmpresa {
  readonly empresa: NovaEmpresa;
  readonly admin: AdminDaNovaEmpresa;
}

export interface EdicaoDeIdentificadorDeEmpresa {
  readonly principal?: boolean;
  readonly verificado?: boolean;
  readonly pais?: string;
}

export interface EntradaDeRestauracaoDeEmpresa {
  readonly admin?: { readonly contatoId: string; readonly cargo?: string };
}

export interface ServicoDeEmpresas {
  listar(membro: MembroDaSessao, filtro: FiltroDeEmpresas): Promise<ResultadoCrm<Pagina<EmpresaResumo>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<EmpresaDetalhada>>;
  criar(membro: MembroDaSessao, entrada: EntradaDeCriacaoDeEmpresa): Promise<ResultadoCrm<EmpresaDetalhada>>;
  editar(membro: MembroDaSessao, id: string, entrada: EdicaoDeEmpresa): Promise<ResultadoCrm<EmpresaDetalhada>>;
  adicionarIdentificador(
    membro: MembroDaSessao,
    id: string,
    entrada: NovoIdentificadorDeEmpresa,
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  editarIdentificador(
    membro: MembroDaSessao,
    id: string,
    identificadorId: string,
    entrada: EdicaoDeIdentificadorDeEmpresa,
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  removerIdentificador(membro: MembroDaSessao, id: string, identificadorId: string): Promise<ResultadoCrm<EmpresaDetalhada>>;
  vincularContato(membro: MembroDaSessao, id: string, entrada: NovoVinculo): Promise<ResultadoCrm<EmpresaDetalhada>>;
  editarVinculo(
    membro: MembroDaSessao,
    id: string,
    vinculoId: string,
    entrada: EdicaoDeVinculo,
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  encerrarVinculo(
    membro: MembroDaSessao,
    id: string,
    vinculoId: string,
    entrada: { readonly fim?: string },
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  trocarAdmin(membro: MembroDaSessao, id: string, entrada: TrocaDeAdmin): Promise<ResultadoCrm<EmpresaDetalhada>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<EmpresaDetalhada>>;
  restaurar(
    membro: MembroDaSessao,
    id: string,
    entrada: EntradaDeRestauracaoDeEmpresa,
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  enviarParaLixeira(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<EmpresaDetalhada>>;
  excluirPermanentemente(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<{ readonly id: string }>>;
}

const pendente = () => Promise.resolve(recusa<never>(404, "pendente"));

export function criarServicoDeEmpresas(_deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
}): ServicoDeEmpresas {
  return {
    listar: pendente,
    obter: pendente,
    criar: pendente,
    editar: pendente,
    adicionarIdentificador: pendente,
    editarIdentificador: pendente,
    removerIdentificador: pendente,
    vincularContato: pendente,
    editarVinculo: pendente,
    encerrarVinculo: pendente,
    trocarAdmin: pendente,
    arquivar: pendente,
    restaurar: pendente,
    enviarParaLixeira: pendente,
    excluirPermanentemente: pendente,
  };
}
