/**
 * Serviço de Negócios: a regra entre a rota e o repositório.
 *
 * ESQUELETO do RED (07-08, Task 2): a interface completa, cada método devolvendo
 * 404 `pendente`. A implementação entra no GREEN.
 */

import type { Pool } from "pg";
import type { EstadoCrm, Pagina, SituacaoNegocio } from "@n1/dominio/crm/comum";
import type {
  EdicaoDeNegocio,
  Ganho,
  Movimento,
  NegocioDetalhado,
  NegocioResumo,
  NovoNegocio,
  Perda,
  Reabertura,
} from "@n1/dominio/crm/negocios";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import { recusa, type ResultadoCrm } from "./resultado";

export interface FiltroDeNegocios {
  readonly estado: EstadoCrm;
  readonly funilId?: string | undefined;
  readonly situacao?: SituacaoNegocio | undefined;
  readonly empresaId?: string | undefined;
  readonly contatoId?: string | undefined;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export interface ServicoDeNegocios {
  listar(membro: MembroDaSessao, filtro: FiltroDeNegocios): Promise<ResultadoCrm<Pagina<NegocioResumo>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<NegocioDetalhado>>;
  criar(membro: MembroDaSessao, entrada: NovoNegocio): Promise<ResultadoCrm<NegocioDetalhado>>;
  editar(membro: MembroDaSessao, id: string, entrada: EdicaoDeNegocio): Promise<ResultadoCrm<NegocioDetalhado>>;
  mover(membro: MembroDaSessao, id: string, entrada: Movimento): Promise<ResultadoCrm<NegocioDetalhado>>;
  ganhar(membro: MembroDaSessao, id: string, entrada: Ganho): Promise<ResultadoCrm<NegocioDetalhado>>;
  perder(membro: MembroDaSessao, id: string, entrada: Perda): Promise<ResultadoCrm<NegocioDetalhado>>;
  reabrir(membro: MembroDaSessao, id: string, entrada: Reabertura): Promise<ResultadoCrm<NegocioDetalhado>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<NegocioDetalhado>>;
  restaurar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<NegocioDetalhado>>;
  enviarParaLixeira(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<NegocioDetalhado>>;
  excluirPermanentemente(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<{ readonly id: string }>>;
}

const pendente = async () => recusa<never>(404, "pendente", { codigo: "PENDENTE" });

export function criarServicoDeNegocios(_deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
}): ServicoDeNegocios {
  return {
    listar: pendente,
    obter: pendente,
    criar: pendente,
    editar: pendente,
    mover: pendente,
    ganhar: pendente,
    perder: pendente,
    reabrir: pendente,
    arquivar: pendente,
    restaurar: pendente,
    enviarParaLixeira: pendente,
    excluirPermanentemente: pendente,
  };
}
