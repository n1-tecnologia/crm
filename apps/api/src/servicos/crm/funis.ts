/**
 * Serviço de Funis e Etapas: a regra entre a rota e o repositório.
 *
 * Esqueleto do RED (07-04, Task 2): a interface está completa e cada método
 * devolve 404 `pendente`. O GREEN substitui o corpo.
 */

import type { Pool } from "pg";
import type { EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import type {
  EdicaoDeEtapa,
  EdicaoDeFunil,
  FunilDetalhado,
  FunilResumo,
  MapeamentoDeEtapas,
  NovaEtapa,
  NovoFunil,
} from "@n1/dominio/crm/funis";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import { recusa, type ResultadoCrm } from "./resultado";

export interface FiltroDeFunis {
  readonly estado: EstadoCrm;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export type NovaEtapaNoFunil = NovaEtapa & { readonly posicao?: number | undefined };

export interface ServicoDeFunis {
  listar(membro: MembroDaSessao, filtro: FiltroDeFunis): Promise<ResultadoCrm<Pagina<FunilResumo>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  criar(membro: MembroDaSessao, entrada: NovoFunil): Promise<ResultadoCrm<FunilDetalhado>>;
  editar(membro: MembroDaSessao, id: string, entrada: EdicaoDeFunil): Promise<ResultadoCrm<FunilDetalhado>>;
  definirPadrao(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  adicionarEtapa(membro: MembroDaSessao, funilId: string, entrada: NovaEtapaNoFunil): Promise<ResultadoCrm<FunilDetalhado>>;
  editarEtapa(membro: MembroDaSessao, etapaId: string, entrada: EdicaoDeEtapa): Promise<ResultadoCrm<FunilDetalhado>>;
  reordenarEtapas(membro: MembroDaSessao, funilId: string, etapaIds: readonly string[]): Promise<ResultadoCrm<FunilDetalhado>>;
  removerEtapa(membro: MembroDaSessao, etapaId: string): Promise<ResultadoCrm<FunilDetalhado>>;
  remapearEtapa(membro: MembroDaSessao, etapaId: string, paraEtapaId: string): Promise<ResultadoCrm<FunilDetalhado>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  restaurar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  enviarParaLixeira(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  excluirPermanentemente(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<{ readonly id: string }>>;
  migrarNegocios(
    membro: MembroDaSessao,
    id: string,
    entrada: { readonly paraFunilId: string; readonly mapeamento: MapeamentoDeEtapas },
  ): Promise<ResultadoCrm<{ readonly migrados: number }>>;
}

const pendente = <T>(): Promise<ResultadoCrm<T>> => Promise.resolve(recusa<T>(404, "pendente", { codigo: "PENDENTE" }));

export function criarServicoDeFunis(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeFunis {
  void deps;
  return {
    listar: () => pendente(),
    obter: () => pendente(),
    criar: () => pendente(),
    editar: () => pendente(),
    definirPadrao: () => pendente(),
    adicionarEtapa: () => pendente(),
    editarEtapa: () => pendente(),
    reordenarEtapas: () => pendente(),
    removerEtapa: () => pendente(),
    remapearEtapa: () => pendente(),
    arquivar: () => pendente(),
    restaurar: () => pendente(),
    enviarParaLixeira: () => pendente(),
    excluirPermanentemente: () => pendente(),
    migrarNegocios: () => pendente(),
  };
}
